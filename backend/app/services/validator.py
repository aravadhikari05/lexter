"""
Post-generation validation layer for Bluebook case citations.

Two layers:
  1. Structural — regex patterns, balanced HTML, whitespace, terminal period.
  2. Cross-field — reporter/court consistency, year range, volume format,
     and presence of key fields in the formatted output.
"""
import re
from dataclasses import dataclass, field

from app.schemas.citation import GenerateResponse
from datetime import datetime


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


# ── Reference data (T1 reporters, T7 courts) ─────────────────────────────────

SCOTUS_REPORTERS = {"U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d"}

KNOWN_REPORTERS: set[str] = {
    # Federal
    "U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d",
    "F.", "F.2d", "F.3d", "F.4th",
    "F. Supp.", "F. Supp. 2d", "F. Supp. 3d",
    "F. App'x", "B.R.",
    # Regional
    "A.", "A.2d", "A.3d",
    "N.E.", "N.E.2d", "N.E.3d",
    "N.W.", "N.W.2d",
    "P.", "P.2d", "P.3d",
    "S.E.", "S.E.2d",
    "S.W.", "S.W.2d", "S.W.3d",
    "So.", "So. 2d", "So. 3d",
    # State-specific
    "Cal. Rptr.", "Cal. Rptr. 2d", "Cal. Rptr. 3d",
    "N.Y.S.", "N.Y.S.2d", "N.Y.S.3d",
    "Ill. Dec.",
    # California official
    "Cal.", "Cal. 2d", "Cal. 3d", "Cal. 4th", "Cal. 5th",
    "Cal. App.", "Cal. App. 2d", "Cal. App. 3d", "Cal. App. 4th", "Cal. App. 5th",
    # New York official
    "N.Y.", "N.Y.2d", "N.Y.3d",
    "A.D.", "A.D.2d", "A.D.3d",
    "Misc.", "Misc. 2d", "Misc. 3d",
}

KNOWN_COURTS: set[str] = {
    # ── Federal circuit courts ────────────────────────────────────────────────
    "1st Cir.", "2d Cir.", "3d Cir.", "4th Cir.", "5th Cir.",
    "6th Cir.", "7th Cir.", "8th Cir.", "9th Cir.", "10th Cir.",
    "11th Cir.", "D.C. Cir.", "Fed. Cir.",
    # ── Federal district courts ───────────────────────────────────────────────
    "S.D.N.Y.", "E.D.N.Y.", "N.D.N.Y.", "W.D.N.Y.",
    "N.D. Cal.", "C.D. Cal.", "S.D. Cal.", "E.D. Cal.",
    "N.D. Ill.", "S.D. Ill.", "C.D. Ill.",
    "N.D. Tex.", "S.D. Tex.", "E.D. Tex.", "W.D. Tex.",
    "D. Mass.", "D. Md.", "D. Conn.", "D.N.J.", "D. Del.",
    "E.D. Pa.", "W.D. Pa.", "M.D. Pa.",
    "N.D. Ga.", "M.D. Ga.", "S.D. Ga.",
    "E.D. Va.", "W.D. Va.",
    "N.D. Ohio", "S.D. Ohio",
    "E.D. Mich.", "W.D. Mich.",
    "D. Minn.", "D. Or.", "W.D. Wash.", "E.D. Wash.",
    "D. Colo.", "D. Ariz.", "D. Nev.", "D. Utah",
    "D.D.C.", "D. Haw.", "D. Alaska",
    "N.D. Fla.", "M.D. Fla.", "S.D. Fla.",
    "E.D. Mo.", "W.D. Mo.",
    "D.S.C.", "D. Kan.", "D.N.M.",
    "W.D. Wis.", "E.D. Wis.",
    "D. Idaho", "D. Mont.", "D. Wyo.", "D.N.D.", "D.S.D.",
    "D. Neb.", "N.D. Iowa", "S.D. Iowa",
    "E.D.N.C.", "M.D.N.C.", "W.D.N.C.",
    "D.R.I.", "D. Vt.", "D.N.H.", "D. Me.",
    "N.D. Ala.", "M.D. Ala.", "S.D. Ala.",
    "N.D. Miss.", "S.D. Miss.",
    "E.D. Ark.", "W.D. Ark.",
    "M.D. La.", "E.D. La.", "W.D. La.",
    "E.D. Ky.", "W.D. Ky.",
    "E.D. Tenn.", "M.D. Tenn.", "W.D. Tenn.",
    "S.D. W. Va.", "N.D. W. Va.",
    "N.D. Ind.", "S.D. Ind.",
    "D.V.I.", "D. Guam", "D.P.R.",
    # ── Bankruptcy ────────────────────────────────────────────────────────────
    "Bankr. S.D.N.Y.", "Bankr. D. Del.", "Bankr. E.D. Va.",
    "Bankr. N.D. Ill.", "Bankr. C.D. Cal.", "Bankr. D. Mass.",
    # ── State supreme courts (T7 abbreviations) ──────────────────────────────
    "Ala.", "Alaska", "Ariz.", "Ark.", "Cal.", "Colo.", "Conn.",
    "Del.", "Fla.", "Ga.", "Haw.", "Idaho", "Ill.", "Ind.", "Iowa",
    "Kan.", "Ky.", "La.", "Me.", "Md.", "Mass.", "Mich.", "Minn.",
    "Miss.", "Mo.", "Mont.", "Neb.", "Nev.", "N.H.", "N.J.", "N.M.",
    "N.Y.", "N.C.", "N.D.", "Ohio", "Okla.", "Or.", "Pa.", "R.I.",
    "S.C.", "S.D.", "Tenn.", "Tex.", "Utah", "Vt.", "Va.", "Wash.",
    "W. Va.", "Wis.", "Wyo.",
    # ── State intermediate appellate courts ───────────────────────────────────
    "Cal. Ct. App.", "N.Y. App. Div.", "Ill. App. Ct.", "Tex. App.",
    "Fla. Dist. Ct. App.", "Pa. Super. Ct.", "Ohio Ct. App.",
    "Ga. Ct. App.", "N.J. Super. Ct. App. Div.", "Mich. Ct. App.",
    "Ind. Ct. App.", "Mo. Ct. App.", "Wash. Ct. App.", "Wis. Ct. App.",
    "Minn. Ct. App.", "Conn. App. Ct.", "Or. Ct. App.", "Colo. App.",
    "Md. Ct. Spec. App.", "Va. Ct. App.", "Ky. Ct. App.",
    "La. Ct. App.", "Tenn. Ct. App.", "N.C. Ct. App.",
    "Ariz. Ct. App.", "Kan. Ct. App.", "Neb. Ct. App.",
    "N.M. Ct. App.", "Okla. Civ. App.", "S.C. Ct. App.",
    "Utah Ct. App.", "Miss. Ct. App.", "Ala. Civ. App.",
}

_MIN_YEAR = 1600
_MAX_YEAR = datetime.now().year + 1



# ── HTML-tag balance checker ─────────────────────────────────────────────────

_TAG_RE = re.compile(r"<(/?)(\w+)(?:\s[^>]*)?>")
_SELF_CLOSING_RE = re.compile(r"<\w+[^>]*/\s*>")


def _check_balanced_html(text: str) -> list[str]:
    issues: list[str] = []
    cleaned = _SELF_CLOSING_RE.sub("", text)
    stack: list[str] = []

    for m in _TAG_RE.finditer(cleaned):
        is_close, name = m.group(1) == "/", m.group(2)
        if is_close:
            if not stack or stack[-1] != name:
                expected = stack[-1] if stack else "none"
                issues.append(
                    f"Mismatched closing </{name}>, expected </{expected}>"
                )
            elif stack:
                stack.pop()
        else:
            stack.append(name)

    for tag in stack:
        issues.append(f"Unclosed <{tag}> tag")

    return issues


# ── 1. Structural validation ─────────────────────────────────────────────────

def _validate_structure(generated: GenerateResponse) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    for label, text in [
        ("academicFull", generated.academicFull),
        ("fullCitation", generated.fullCitation),
        ("shortForm",    generated.shortForm),
    ]:
        if not text or not text.strip():
            errors.append(f"{label} is empty")
            continue

        if "  " in text:
            warnings.append(f"{label} contains double spaces")

        if text != text.strip():
            warnings.append(f"{label} has leading or trailing whitespace")

        if not text.rstrip().endswith("."):
            errors.append(f"{label} does not end with a period")

        for issue in _check_balanced_html(text):
            errors.append(f"{label}: {issue}")

        # academicFull legitimately has no <em> for plain party names (roman text rule)
        if label != "academicFull" and ("<em>" not in text or "</em>" not in text):
            errors.append(f"{label} missing italicized case name (<em>…</em>)")

    # Full citations must contain a parenthetical with a 4-digit year,
    # optionally preceded by a court and/or full date.
    _year_paren = re.compile(r"\([^)]*\d{4}[^)]*\)")
    for label in ("academicFull", "fullCitation"):
        text = getattr(generated, label)
        if text and not _year_paren.search(text):
            warnings.append(f"{label} may be missing a year parenthetical")

    return errors, warnings


# ── 2. Cross-field validation ─────────────────────────────────────────────────

def _validate_cross_fields(fields: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    reporter = (fields.get("reporter") or "").strip()
    court = (fields.get("court") or "").strip()
    year = (fields.get("year") or "").strip()
    volume = (fields.get("volume") or "").strip()
    is_scotus = fields.get("isScotus", False)
    is_unpublished = fields.get("isUnpublished", False)

    if reporter in SCOTUS_REPORTERS and court:
        errors.append(
            f"SCOTUS reporter ({reporter}) must not include a court "
            f"parenthetical, but court is '{court}'"
        )

    if not is_scotus and not is_unpublished and not court:
        warnings.append("Non-SCOTUS published case is missing a court abbreviation")

    if reporter and reporter not in KNOWN_REPORTERS:
        warnings.append(f"Reporter '{reporter}' not found in T1 reporter list")

    if court and court not in KNOWN_COURTS:
        warnings.append(f"Court '{court}' not found in T7 court abbreviation list")

    if year:
        if re.fullmatch(r"\d{4}", year):
            y = int(year)
            if y < _MIN_YEAR or y > _MAX_YEAR:
                errors.append(f"Year {year} outside plausible range ({_MIN_YEAR}–{_MAX_YEAR})")
        else:
            errors.append(f"Year '{year}' is not a valid 4-digit number")

    if volume and not is_unpublished and not volume.isdigit():
        warnings.append(f"Volume '{volume}' is not numeric")

    return errors, warnings


# ── 3. Output-vs-fields consistency ───────────────────────────────────────────

def _validate_fields_in_output(
    fields: dict, generated: GenerateResponse,
) -> list[str]:
    """Spot-check that key field values actually appear in the formatted text."""
    warnings: list[str] = []
    is_unpublished = fields.get("isUnpublished", False)

    case_name = (fields.get("caseName") or "").strip()
    if case_name:
        for label in ("academicFull", "fullCitation"):
            text = getattr(generated, label)
            # Strip HTML tags before comparing — academicFull wraps procedural
            # phrases in <em> (e.g. "In re Fairfax" → "<em>In re</em> Fairfax")
            text_plain = re.sub(r"<[^>]+>", "", text)
            if case_name not in text_plain:
                warnings.append(f"{label} does not contain case name '{case_name}'")

    if not is_unpublished:
        for key, display in [
            ("volume", "volume"),
            ("reporter", "reporter"),
            ("firstPage", "first page"),
        ]:
            val = (fields.get(key) or "").strip()
            if not val:
                continue
            for label in ("academicFull", "fullCitation"):
                text = getattr(generated, label)
                if val not in text:
                    warnings.append(f"{label} does not contain {display} '{val}'")

    return warnings


# ── Auto-fix trivially correctable issues ─────────────────────────────────────

def sanitize_output(generated: GenerateResponse) -> GenerateResponse:
    """Fix double spaces and leading/trailing whitespace in-place."""
    def _clean(s: str) -> str:
        return re.sub(r"  +", " ", s).strip()

    return GenerateResponse(
        academicFull=_clean(generated.academicFull),
        shortForm=_clean(generated.shortForm),
        fullCitation=_clean(generated.fullCitation),
        rulesUsed=generated.rulesUsed,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def validate_citation(
    fields: dict,
    generated: GenerateResponse,
) -> ValidationResult:
    """Run all structural and cross-field checks.

    Returns a ValidationResult whose `.is_valid` property is False only when
    hard errors are present (wrong HTML, missing period, impossible year, etc.).
    Warnings are advisory and should not block output.
    """
    result = ValidationResult()

    s_err, s_warn = _validate_structure(generated)
    result.errors.extend(s_err)
    result.warnings.extend(s_warn)

    f_err, f_warn = _validate_cross_fields(fields)
    result.errors.extend(f_err)
    result.warnings.extend(f_warn)

    result.warnings.extend(_validate_fields_in_output(fields, generated))

    return result
