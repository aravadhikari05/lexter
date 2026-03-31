# Deterministic missing-field checker for parsed citations
import re
from app.schemas.citation import ParseResponse

COMMON_REPORTERS = re.compile(
    r"^("
    r"U\.S\.|S\.\s*Ct\.|L\.\s*Ed\.\s*(2d)?|"
    r"F\.\s*(2d|3d|4th)|F\.\s*Supp\.\s*(2d|3d)?|F\.\s*App'x|"
    r"A\.\s*(2d|3d)?|N\.E\.\s*(2d|3d)?|N\.W\.\s*(2d)?|"
    r"P\.\s*(2d|3d)?|S\.E\.\s*(2d)?|S\.W\.\s*(2d|3d)?|So\.\s*(2d|3d)?|"
    r"Cal\.\s*Rptr\.\s*(2d|3d)?|"
    r".+\." # fallback: anything with a period is plausible
    r")$"
)


def _is_empty(value) -> bool:
    return value is None or value == ""


def _looks_suspicious_volume(v: str) -> bool:
    return not v.isdigit()


def _looks_suspicious_year(y: str) -> bool:
    return not re.fullmatch(r"\d{4}", y)


def _looks_suspicious_reporter(r: str) -> bool:
    known = {
        "U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d",
        "F.", "F.2d", "F.3d", "F.4th",
        "F. Supp.", "F. Supp. 2d", "F. Supp. 3d", "F. App'x",
        "A.", "A.2d", "A.3d",
        "N.E.", "N.E.2d", "N.E.3d",
        "N.W.", "N.W.2d",
        "P.", "P.2d", "P.3d",
        "S.E.", "S.E.2d",
        "S.W.", "S.W.2d", "S.W.3d",
        "So.", "So. 2d", "So. 3d",
        "Cal. Rptr.", "Cal. Rptr. 2d", "Cal. Rptr. 3d",
    }
    return r not in known


def check_missing_fields(parsed: ParseResponse) -> tuple[list[str], list[str]]:
    missing: list[str] = []
    needs_confirmation: list[str] = list(parsed.needsConfirmation)

    # Always required
    if _is_empty(parsed.caseName):
        missing.append("caseName")
    if _is_empty(parsed.year):
        missing.append("year")

    # Published case requirements
    if not parsed.isUnpublished:
        if _is_empty(parsed.volume):
            missing.append("volume")
        if _is_empty(parsed.reporter):
            missing.append("reporter")
        if _is_empty(parsed.firstPage):
            missing.append("firstPage")

    # Court required unless SCOTUS
    if not parsed.isScotus and _is_empty(parsed.court):
        missing.append("court")

    # Docket required for unpublished
    if parsed.isUnpublished and _is_empty(parsed.docket):
        missing.append("docket")

    # Suspicious value checks — only for non-empty, non-missing fields
    if not _is_empty(parsed.volume) and "volume" not in missing:
        if _looks_suspicious_volume(parsed.volume):
            if "volume" not in needs_confirmation:
                needs_confirmation.append("volume")

    if not _is_empty(parsed.year) and "year" not in missing:
        if _looks_suspicious_year(parsed.year):
            if "year" not in needs_confirmation:
                needs_confirmation.append("year")

    if not _is_empty(parsed.reporter) and "reporter" not in missing:
        if _looks_suspicious_reporter(parsed.reporter):
            if "reporter" not in needs_confirmation:
                needs_confirmation.append("reporter")

    return missing, needs_confirmation
