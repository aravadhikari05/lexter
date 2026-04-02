"""Tests for the citation validation layer."""
import pytest
from app.schemas.citation import GenerateResponse
from app.services.citation_validator import (
    ValidationResult,
    validate_citation,
    sanitize_output,
    _check_balanced_html,
    _validate_structure,
    _validate_cross_fields,
    _validate_fields_in_output,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resp(
    academic: str = '<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).',
    full: str = '<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).',
    short: str = '<em>Brown</em>, 347 U.S. at 483.',
) -> GenerateResponse:
    return GenerateResponse(
        academicFull=academic,
        fullCitation=full,
        shortForm=short,
    )


_BROWN_FIELDS: dict = {
    "caseName": "Brown v. Bd. of Educ.",
    "volume": "347",
    "reporter": "U.S.",
    "firstPage": "483",
    "court": "",
    "year": "1954",
    "isScotus": True,
    "isUnpublished": False,
}


# ── HTML balance ──────────────────────────────────────────────────────────────

class TestBalancedHtml:
    def test_balanced(self):
        assert _check_balanced_html("<em>Hello</em>") == []

    def test_unclosed(self):
        issues = _check_balanced_html("<em>Hello")
        assert any("Unclosed" in i for i in issues)

    def test_mismatched(self):
        issues = _check_balanced_html("<em>Hello</span>")
        assert any("Mismatched" in i for i in issues)

    def test_nested_balanced(self):
        assert _check_balanced_html('<em><span class="sc">Text</span></em>') == []

    def test_self_closing_ignored(self):
        assert _check_balanced_html("<br/>text") == []


# ── Structural validation ─────────────────────────────────────────────────────

class TestStructuralValidation:
    def test_valid_citation_passes(self):
        errors, warnings = _validate_structure(_resp())
        assert errors == []

    def test_empty_field(self):
        resp = _resp(academic="")
        errors, _ = _validate_structure(resp)
        assert any("empty" in e for e in errors)

    def test_missing_period(self):
        resp = _resp(
            academic='<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954)',
        )
        errors, _ = _validate_structure(resp)
        assert any("period" in e for e in errors)

    def test_unbalanced_html_caught(self):
        resp = _resp(academic='<em>Brown v. Bd. of Educ., 347 U.S. 483 (1954).')
        errors, _ = _validate_structure(resp)
        assert any("Unclosed" in e for e in errors)

    def test_missing_em_tags(self):
        resp = _resp(academic='Brown v. Bd. of Educ., 347 U.S. 483 (1954).')
        errors, _ = _validate_structure(resp)
        assert any("<em>" in e for e in errors)

    def test_double_space_warning(self):
        resp = _resp(
            academic='<em>Brown v. Bd. of Educ.</em>,  347 U.S. 483 (1954).',
        )
        _, warnings = _validate_structure(resp)
        assert any("double" in w.lower() for w in warnings)

    def test_leading_whitespace_warning(self):
        resp = _resp(
            academic=' <em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).',
        )
        _, warnings = _validate_structure(resp)
        assert any("whitespace" in w for w in warnings)

    def test_missing_year_parenthetical_warning(self):
        resp = _resp(
            academic='<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483.',
        )
        _, warnings = _validate_structure(resp)
        assert any("year parenthetical" in w for w in warnings)

    def test_unpublished_full_date_paren_ok(self):
        resp = _resp(
            academic='<em>Smith v. Jones</em>, No. 22-1234 (9th Cir. Dec. 30, 2022).',
            full='<em>Smith v. Jones</em>, No. 22-1234 (9th Cir. Dec. 30, 2022).',
        )
        _, warnings = _validate_structure(resp)
        assert not any("year parenthetical" in w for w in warnings)


# ── Cross-field validation ────────────────────────────────────────────────────

class TestCrossFieldValidation:
    def test_scotus_no_court_ok(self):
        errors, _ = _validate_cross_fields(_BROWN_FIELDS)
        assert errors == []

    def test_scotus_with_court_errors(self):
        fields = {**_BROWN_FIELDS, "court": "9th Cir."}
        errors, _ = _validate_cross_fields(fields)
        assert any("SCOTUS" in e for e in errors)

    def test_unknown_reporter_warns(self):
        fields = {**_BROWN_FIELDS, "reporter": "Fake. Rptr."}
        _, warnings = _validate_cross_fields(fields)
        assert any("T1" in w for w in warnings)

    def test_unknown_court_warns(self):
        fields = {
            **_BROWN_FIELDS,
            "reporter": "F.3d",
            "isScotus": False,
            "court": "Imaginary Ct.",
        }
        _, warnings = _validate_cross_fields(fields)
        assert any("T7" in w for w in warnings)

    def test_known_court_no_warning(self):
        fields = {
            **_BROWN_FIELDS,
            "reporter": "F.3d",
            "isScotus": False,
            "court": "9th Cir.",
        }
        _, warnings = _validate_cross_fields(fields)
        assert not any("T7" in w for w in warnings)

    def test_year_too_early(self):
        fields = {**_BROWN_FIELDS, "year": "1200"}
        errors, _ = _validate_cross_fields(fields)
        assert any("plausible" in e for e in errors)

    def test_year_non_numeric(self):
        fields = {**_BROWN_FIELDS, "year": "19X4"}
        errors, _ = _validate_cross_fields(fields)
        assert any("4-digit" in e for e in errors)

    def test_non_numeric_volume_warns(self):
        fields = {**_BROWN_FIELDS, "volume": "ABC"}
        _, warnings = _validate_cross_fields(fields)
        assert any("numeric" in w for w in warnings)

    def test_numeric_volume_ok(self):
        _, warnings = _validate_cross_fields(_BROWN_FIELDS)
        assert not any("numeric" in w for w in warnings)


# ── Fields-in-output consistency ──────────────────────────────────────────────

class TestFieldsInOutput:
    def test_all_fields_present(self):
        warnings = _validate_fields_in_output(_BROWN_FIELDS, _resp())
        assert warnings == []

    def test_missing_case_name(self):
        resp = _resp(academic='<em>Wrong Name</em>, 347 U.S. 483 (1954).')
        warnings = _validate_fields_in_output(_BROWN_FIELDS, resp)
        assert any("case name" in w for w in warnings)

    def test_missing_volume(self):
        resp = _resp(academic='<em>Brown v. Bd. of Educ.</em>, 999 U.S. 483 (1954).')
        warnings = _validate_fields_in_output(_BROWN_FIELDS, resp)
        assert any("volume" in w for w in warnings)


# ── sanitize_output ───────────────────────────────────────────────────────────

class TestSanitizeOutput:
    def test_removes_double_spaces(self):
        resp = _resp(academic='<em>Brown</em>,  347  U.S. 483 (1954).')
        cleaned = sanitize_output(resp)
        assert "  " not in cleaned.academicFull

    def test_strips_whitespace(self):
        resp = _resp(short=' <em>Brown</em>, 347 U.S. at 483. ')
        cleaned = sanitize_output(resp)
        assert cleaned.shortForm == '<em>Brown</em>, 347 U.S. at 483.'


# ── Full integration: validate_citation ───────────────────────────────────────

class TestValidateCitation:
    def test_clean_scotus_citation(self):
        result = validate_citation(_BROWN_FIELDS, _resp())
        assert result.is_valid
        assert result.errors == []

    def test_collects_all_issue_types(self):
        bad_fields = {
            **_BROWN_FIELDS,
            "year": "1200",
            "court": "9th Cir.",
        }
        bad_resp = _resp(academic='<em>Brown v. Bd. of Educ., 347 U.S. 483 (1200).')
        result = validate_citation(bad_fields, bad_resp)
        assert not result.is_valid
        assert len(result.errors) >= 2  # HTML + year + SCOTUS court
