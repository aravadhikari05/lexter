# Deterministic missing-field checker for parsed citations
import re
from app.schemas.citation import ParseResponse
from app.services.normalizer import CANONICAL_REPORTERS


def _is_empty(value) -> bool:
    return value is None or value == ""


def _looks_suspicious_volume(v: str) -> bool:
    return not v.isdigit()


def _looks_suspicious_year(y: str) -> bool:
    return not re.fullmatch(r"\d{4}", y)


def _looks_suspicious_reporter(r: str) -> bool:
    return r not in CANONICAL_REPORTERS


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

    # Docket and fullDate required for unpublished (Rule 10.5(b))
    if parsed.isUnpublished and _is_empty(parsed.docket):
        missing.append("docket")
    if parsed.isUnpublished and _is_empty(parsed.fullDate):
        missing.append("fullDate")

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
