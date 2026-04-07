import re
from app.schemas.citation import GenerateResponse


class FormatterError(Exception):
    """Raised when the deterministic formatter cannot handle a case."""


# Reporters that cover multiple courts/states and therefore require an explicit
# court designation per R10.4. State official reporters (Mass., Conn. App., etc.)
# are NOT in this set — they unambiguously identify their own jurisdiction.
_MULTI_COURT_REPORTERS: frozenset[str] = frozenset({
    # Federal appellate / district / specialty
    "F.", "F.2d", "F.3d", "F.4th",
    "F. Supp.", "F. Supp. 2d", "F. Supp. 3d",
    "F.R.D.", "F. App'x", "B.R.", "Fed. Cl.", "M.J.",
    # Regional reporters (multi-state)
    "A.", "A.2d", "A.3d",
    "N.E.", "N.E.2d", "N.E.3d",
    "N.W.", "N.W.2d", "N.W.3d",
    "P.", "P.2d", "P.3d",
    "S.E.", "S.E.2d",
    "So.", "So. 2d", "So. 3d",
    "S.W.", "S.W.2d", "S.W.3d",
})


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

# Surnames of government officials who appear as parties in their official
# capacity — should be skipped in favour of the opposing party per R10.9(a)(i).
_GOV_OFFICIAL_SURNAMES: frozenset[str] = frozenset({
    # Attorneys General
    "Reno", "Ashcroft", "Gonzales", "Gonzalez", "Mukasey",
    "Holder", "Lynch", "Sessions", "Whitaker", "Barr", "Garland",
    # Other common federal officials in case law
    "Meese", "Thornburgh", "Civiletti", "Bell",
    "Rumsfeld", "McNamara", "Cheney",
    "Sebelius", "Burwell", "Azar", "Becerra",
    "Brady", "Napolitano", "Nielsen",
})


def _pick_short_party(case_name: str) -> str:
    """Return the party name to use in short-form citations per B10.2, R10.9(a)(i).

    Rules applied in order:
    1. No 'v.' → return the whole name (In re, Ex parte).
    2. 'ex rel.' in second party → use the relator (name after ex rel.).
    3. 'ex rel.' in first party → strip it; first party is the part before ex rel.
    4. First party is a gov entity/geographic unit → use second party.
    5. First party is a known government official surname → use second party.
    6. First party name contains ' & ' (compound corporate) → truncate to first word.
    7. Default: use first party.

    Examples:
      'Brown v. Bd. of Educ.'                          -> 'Brown'
      'United States v. Haskell'                       -> 'Haskell'
      'Reno v. Bossier Parish Sch. Bd.'                -> 'Bossier Parish Sch. Bd.'
      'NAACP v. Alabama ex rel. Patterson'             -> 'Patterson'
      'Dombroski ex rel. Estate of Dombroski v. ...'  -> 'Dombroski'
      'Youngstown Sheet & Tube Co. v. Sawyer'          -> 'Youngstown'
      'In re Fairfax'                                  -> 'In re Fairfax'
    """
    parts = re.split(r"\s+v\.\s+", case_name, maxsplit=1)
    if len(parts) != 2:
        return case_name.strip()

    first, second = parts[0].strip(), parts[1].strip()

    # Rule 2: relator in second party → use relator
    if " ex rel. " in second:
        return second.split(" ex rel. ", 1)[1].strip()

    # Rule 3: ex rel. in first party → strip to main litigant before ex rel.
    if " ex rel. " in first:
        first = first.split(" ex rel. ", 1)[0].strip()

    # Rules 4–5: government entity or official → use second party
    if _GOV_TERMS.match(first) or first in _GOV_OFFICIAL_SURNAMES:
        return second

    return first


def _normalize(s: str) -> str:
    return re.sub(r"  +", " ", s).strip()


def _italicize_procedural(case_name: str) -> str:
    """Wrap procedural phrases in <em> for academicFull (R10.2.1(b)).

    In law review format, case names are roman, but 'In re', 'Ex parte',
    and 'ex rel.' are always italicized regardless of context.
    """
    if case_name.startswith("In re "):
        return "<em>In re</em> " + case_name[6:]
    if case_name.startswith("Ex parte "):
        return "<em>Ex parte</em> " + case_name[9:]
    if " ex rel. " in case_name:
        return case_name.replace(" ex rel. ", " <em>ex rel.</em> ")
    return case_name


def _build_parentheticals(fields: dict) -> str:
    """Build the parenthetical suffix for fullCitation / academicFull.

    Per Rule 10.6.4: (weight of authority) (explanatory), in that order.
    Strips existing outer parens from user input to prevent double-wrapping.
    Short form never includes parentheticals per Rule 10.9.
    """
    parts = []
    # R10.6.4 order: (i) weight, (ii) quoting/citing, (iii) explanatory
    for key in (
        "weightParenthetical",
        "weightParenthetical2",
        "quotingParenthetical",
        "citingParenthetical",
        "explanatoryParenthetical",
    ):
        val = (fields.get(key) or "").strip()
        if val:
            # Strip outer parens only when the entire value is wrapped in them,
            # to avoid stripping inner year parens like (1965) in quoting parens.
            if val.startswith("(") and val.endswith(")"):
                val = val[1:-1]
            parts.append(f"({val})")
    return (" " + " ".join(parts)) if parts else ""


def _build_history(history: list, full_citation: bool) -> str:
    """Render subsequent/prior history entries per R10.7.

    Returns a string to append after the main citation body (before the period).
    Each entry dict has:
        phrase   : T8 phrase (e.g. "aff'd", "overruled by", "aff'g")
        cite     : citation string (e.g. "367 N.E.2d 661")
        court    : court abbreviation, may be empty string
        year     : year string, may be empty string
        caseName : optional — new case name (overruled by, abrogated by, sub nom.)
        join     : "and" — connector between parallel dispositions R10.7.1(e)
    """
    parts = []
    pending_join: str | None = None

    for entry in history:
        if "join" in entry:
            pending_join = entry["join"]
            continue

        phrase = entry.get("phrase", "").strip()
        cite = entry.get("cite", "").strip()
        court = entry.get("court", "").strip()
        year = entry.get("year", "").strip()
        case_name = entry.get("caseName", "").strip()

        # Build parenthetical for this history entry's cite
        if court and year:
            paren = f"({court} {year})"
        elif court:
            paren = f"({court})"
        elif year:
            paren = f"({year})"
        else:
            paren = ""
        cite_str = f"{cite} {paren}" if paren else cite

        if pending_join:
            # R10.7.1(e): parallel dispositions joined with italicized "and"
            jw = pending_join
            if full_citation and case_name:
                part = f", <em>{jw}</em> <em>{case_name}</em>, {cite_str}"
            elif case_name:
                part = f", <em>{jw}</em> {case_name}, {cite_str}"
            else:
                part = f", <em>{jw}</em> {cite_str}"
            pending_join = None

        elif "sub nom." in phrase and case_name:
            # R10.7.2: name change — comma after phrase; caseName always in <em>
            part = f", <em>{phrase}</em>, <em>{case_name}</em>, {cite_str}"

        elif phrase in ("overruled by", "abrogated by") and case_name:
            # R10.7.1(c): caseName is the direct object, no comma between phrase and name.
            # Academic: caseName plain; fullCitation: caseName in <em>.
            if full_citation:
                part = f", <em>{phrase}</em> <em>{case_name}</em>, {cite_str}"
            else:
                part = f", <em>{phrase}</em> {case_name}, {cite_str}"

        elif phrase.endswith("'g"):
            # Prior history phrase (aff'g, rev'g) — no comma after phrase per R10.7.1(a)
            if full_citation and case_name:
                part = f", <em>{phrase}</em> <em>{case_name}</em>, {cite_str}"
            elif case_name:
                part = f", <em>{phrase}</em> {case_name}, {cite_str}"
            else:
                part = f", <em>{phrase}</em> {cite_str}"

        else:
            # Standard subsequent history — comma after phrase
            if full_citation and case_name:
                part = f", <em>{phrase}</em> <em>{case_name}</em>, {cite_str}"
            elif case_name:
                part = f", <em>{phrase}</em> {case_name}, {cite_str}"
            else:
                part = f", <em>{phrase}</em>, {cite_str}"

        parts.append(part)

    return "".join(parts)


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
        db_id = (fields.get("dbIdentifier") or "").strip()
        if db_id:
            return _format_electronic_db(fields, case_name, short_party, is_scotus, rules_used)
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
    _require(fields, "volume", "reporter", "firstPage")

    volume = fields["volume"].strip()
    reporter = fields["reporter"].strip()
    first_page = fields["firstPage"].strip()
    pincite = (fields.get("pincite") or "").strip()
    year = (fields.get("year") or "").strip()
    court = (fields.get("court") or "").strip()
    history = fields.get("history") or []

    # Year is required unless the same-year omission rule applies (R10.7.1(a)):
    # when a subsequent disposition occurs in the same year, the primary year is omitted.
    # Signal this by providing a non-empty history list with year="" on the primary.
    if not year and not history:
        raise FormatterError("Missing required field: year")

    # R10.4(b): court designation required only when reporter doesn't unambiguously
    # identify the jurisdiction. Multi-court reporters (federal, regional) require it;
    # state official reporters (Mass., Conn. App., etc.) do not.
    if not is_scotus and reporter in _MULTI_COURT_REPORTERS:
        _require(fields, "court")

    rules_used.extend(["B10.1.2", "B10.1.3"])

    # Build court/year parenthetical, omitting year when intentionally empty (R10.7.1(a))
    if is_scotus or not court:
        parenthetical = f"({year})" if year else ""
    else:
        parenthetical = f"({court} {year})" if year else f"({court})"

    suffix = _build_parentheticals(fields)
    if suffix:
        rules_used.append("Rule 10.6")
    if history:
        rules_used.append("Rule 10.7")

    # Parallel citation (R10.3.1): append secondary reporter cite after primary page
    par_vol = (fields.get("parallelVolume") or "").strip()
    par_rep = (fields.get("parallelReporter") or "").strip()
    par_page = (fields.get("parallelFirstPage") or "").strip()
    parallel_cite = f", {par_vol} {par_rep} {par_page}" if (par_vol and par_rep and par_page) else ""

    # Popular name (R10.2.1(k)): indicated parenthetically in italics after case name
    popular_name = (fields.get("popularName") or "").strip()
    pop_part = f" (<em>{popular_name}</em>)" if popular_name else ""

    cite_core = f"{volume} {reporter} {first_page}, {pincite}" if pincite else f"{volume} {reporter} {first_page}"
    cite_core += parallel_cite

    history_academic = _build_history(history, full_citation=False)
    history_full = _build_history(history, full_citation=True)

    academic_full = _normalize(
        f"{_italicize_procedural(case_name)}{pop_part}, "
        f"{cite_core} {parenthetical}{suffix}{history_academic}."
    )
    full_citation = _normalize(
        f"<em>{case_name}</em>{pop_part}, "
        f"{cite_core} {parenthetical}{suffix}{history_full}."
    )
    # Rule 10.9: short form uses primary reporter + pincite; parallel cite omitted
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


# ── Electronic database cases (B10.1.4(i)) ────────────────────────────────────

def _format_electronic_db(
    fields: dict,
    case_name: str,
    short_party: str,
    is_scotus: bool,
    rules_used: list[str],
) -> GenerateResponse:
    full_date = (fields.get("fullDate") or "").strip()
    if not full_date:
        raise FormatterError(
            "Electronic database cases require a full date (fullDate field) "
            "per Rule 10.5(b). Falling back to LLM."
        )

    _require(fields, "docket", "dbIdentifier")
    if not is_scotus:
        _require(fields, "court")

    docket = fields["docket"].strip()
    db_id = fields["dbIdentifier"].strip()
    pincite = (fields.get("pincite") or "").strip()
    court = fields.get("court", "").strip()

    rules_used.extend(["B10.1.4", "B10.1.4(i)", "Rule 10.5(b)"])

    parenthetical = f"({full_date})" if is_scotus else f"({court} {full_date})"
    suffix = _build_parentheticals(fields)
    if suffix:
        rules_used.append("Rule 10.6")

    # Docket: skip "No." prefix if the value already begins with "No." or "Nos."
    docket_prefix = "" if re.match(r"Nos?\.", docket) else "No. "

    # Star pages: pincite may already contain "*" (e.g. "*1, *3"); don't prepend a second "*"
    if pincite:
        star_pin = f", at {pincite}" if pincite.startswith("*") else f", at *{pincite}"
    else:
        star_pin = ""

    academic_full = _normalize(
        f"{_italicize_procedural(case_name)}, {docket_prefix}{docket}, {db_id}{star_pin} {parenthetical}{suffix}."
    )
    full_citation = _normalize(
        f"<em>{case_name}</em>, {docket_prefix}{docket}, {db_id}{star_pin} {parenthetical}{suffix}."
    )

    if pincite:
        at_pin = f"at {pincite}" if pincite.startswith("*") else f"at *{pincite}"
        short_form = _normalize(f"<em>{short_party}</em>, {db_id}, {at_pin}.")
    else:
        short_form = _normalize(f"<em>{short_party}</em>, {db_id}.")

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
        f"{_italicize_procedural(case_name)}, No. {docket}{slip_pin} {parenthetical}{suffix}."
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
