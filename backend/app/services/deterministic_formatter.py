import re
from app.schemas.citation import GenerateResponse


class FormatterError(Exception):
    """Raised when the deterministic formatter cannot handle a case."""


# ── Government / geographic party names that should not be used in short form ─
# Per B10.2 and Rule 10.9(a)(i): when the first party is one of these, use the
# second party instead.
_GOV_TERMS = re.compile(
    r"""^(
        United\ States |
        U\.S\. |
        People |
        State |
        Commonwealth |
        Government |
        City\ of\ \w+ |
        County\ of\ \w+ |
        Town\ of\ \w+ |
        Board\ of\ \w+ |
        Dep(?:artment|'t)\ of\ \w+ |
        Office\ of\ \w+ |
        Secretary\ of\ \w+ |
        Commissioner |
        # Two-letter state postal codes used as party names (e.g. "Texas")
        Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|
        Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|
        Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|
        Mississippi|Missouri|Montana|Nebraska|Nevada|New\ Hampshire|
        New\ Jersey|New\ Mexico|New\ York|North\ Carolina|North\ Dakota|
        Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\ Island|South\ Carolina|
        South\ Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|
        West\ Virginia|Wisconsin|Wyoming
    )$""",
    re.VERBOSE | re.IGNORECASE,
)


def _pick_short_party(case_name: str) -> str:
    """Return the party name to use in short-form citations.

    Uses the first party unless it is a government entity, geographic unit,
    or other common litigant, in which case the second party is used.
    Per B10.2 and Rule 10.9(a)(i).

    'Brown v. Bd. of Educ.'         -> 'Brown'
    'United States v. Haskell'      -> 'Haskell'
    'Reno v. Bossier Parish Sch. Bd.' -> 'Bossier Parish Sch. Bd.'
    'In re Fairfax'                 -> 'In re Fairfax'  (no v.)
    """
    parts = re.split(r"\s+v\.\s+", case_name, maxsplit=1)
    if len(parts) != 2:
        return case_name.strip()

    first, second = parts[0].strip(), parts[1].strip()
    if _GOV_TERMS.match(first):
        return second
    return first


def _normalize(s: str) -> str:
    return re.sub(r"  +", " ", s).strip()


def _build_parentheticals(fields: dict) -> str:
    """Build the parenthetical suffix for fullCitation / academicFull.

    Per Rule 10.6.4: (weight of authority) (explanatory), in that order.
    Strips existing outer parens from user input to prevent double-wrapping.
    Short form never includes parentheticals per Rule 10.9.
    """
    parts = []
    for key in ("weightParenthetical", "explanatoryParenthetical"):
        val = (fields.get(key) or "").strip()
        if val:
            val = val.strip("()")
            parts.append(f"({val})")
    return (" " + " ".join(parts)) if parts else ""


def _require(fields: dict, *keys: str) -> None:
    for k in keys:
        v = fields.get(k)
        if not v or (isinstance(v, str) and not v.strip()):
            raise FormatterError(f"Missing required field: {k}")


def format_case(fields: dict) -> GenerateResponse:
    """Deterministic Bluebook formatter for court cases.

    Handles published cases (B10.1) and unpublished slip opinions (B10.1.4).
    Raises FormatterError for anything it cannot yet template.
    """
    is_scotus = fields.get("isScotus", False)
    is_unpublished = fields.get("isUnpublished", False)

    _require(fields, "caseName")
    case_name = fields["caseName"].strip()
    short_party = _pick_short_party(case_name)
    rules_used: list[str] = ["B10.1", "B10.1.1"]

    if is_unpublished:
        return _format_unpublished(fields, case_name, short_party, is_scotus, rules_used)
    return _format_published(fields, case_name, short_party, is_scotus, rules_used)


# ── Published cases (B10.1.1–B10.1.3) ────────────────────────────────────────

def _format_published(
    fields: dict,
    case_name: str,
    short_party: str,
    is_scotus: bool,
    rules_used: list[str],
) -> GenerateResponse:
    _require(fields, "volume", "reporter", "firstPage", "year")
    if not is_scotus:
        _require(fields, "court")

    volume = fields["volume"].strip()
    reporter = fields["reporter"].strip()
    first_page = fields["firstPage"].strip()
    pincite = (fields.get("pincite") or "").strip()
    year = fields["year"].strip()
    court = fields.get("court", "").strip()

    rules_used.extend(["B10.1.2", "B10.1.3"])

    parenthetical = f"({year})" if is_scotus else f"({court} {year})"
    suffix = _build_parentheticals(fields)
    if suffix:
        rules_used.append("Rule 10.6")

    cite_core = f"{volume} {reporter} {first_page}, {pincite}" if pincite else f"{volume} {reporter} {first_page}"

    academic_full = _normalize(
        f"<em>{case_name}</em>, "
        f"{cite_core} {parenthetical}{suffix}."
    )
    full_citation = _normalize(
        f"<em>{case_name}</em>, "
        f"{cite_core} {parenthetical}{suffix}."
    )
    # Rule 10.9: short form uses pincite when present, otherwise firstPage
    at_page = pincite or first_page
    short_form = _normalize(
        f"<em>{short_party}</em>, {volume} {reporter} at {at_page}."
    )

    return GenerateResponse(
        academicFull=academic_full,
        shortForm=short_form,
        fullCitation=full_citation,
        rulesUsed=rules_used,
    )


# ── Unpublished / slip-opinion cases (B10.1.4) ───────────────────────────────

def _format_unpublished(
    fields: dict,
    case_name: str,
    short_party: str,
    is_scotus: bool,
    rules_used: list[str],
) -> GenerateResponse:
    # Rule 10.5(b): unreported cases require a full date, not just a year.
    # Raise FormatterError if fullDate is absent so the LLM fallback handles it.
    full_date = (fields.get("fullDate") or "").strip()
    if not full_date:
        raise FormatterError(
            "Unpublished cases require a full date (fullDate field, e.g. 'Dec. 30, 1977') "
            "per Rule 10.5(b). Falling back to LLM."
        )

    _require(fields, "docket")
    if not is_scotus:
        _require(fields, "court")

    docket = fields["docket"].strip()
    pincite = (fields.get("pincite") or "").strip()
    court = fields.get("court", "").strip()

    rules_used.extend(["B10.1.4", "Rule 10.5(b)"])

    parenthetical = f"({full_date})" if is_scotus else f"({court} {full_date})"
    suffix = _build_parentheticals(fields)
    if suffix:
        rules_used.append("Rule 10.6")

    slip_pin = f", slip op. at {pincite}" if pincite else ""

    academic_full = _normalize(
        f"<em>{case_name}</em>, No. {docket}{slip_pin} {parenthetical}{suffix}."
    )
    full_citation = _normalize(
        f"<em>{case_name}</em>, No. {docket}{slip_pin} {parenthetical}{suffix}."
    )
    # Rule 10.9(a)(iii): slip opinion short form
    if pincite:
        short_form = _normalize(f"<em>{short_party}</em>, slip op. at {pincite}.")
    else:
        short_form = _normalize(f"<em>{short_party}</em>, slip op.")

    return GenerateResponse(
        academicFull=academic_full,
        shortForm=short_form,
        fullCitation=full_citation,
        rulesUsed=rules_used,
    )
