"""Exact-match Bluebook formatter tests — parametrized with per-field xfail.

Spec: docs/superpowers/specs/2026-04-06-formatter-test-suite-design.md
Data: tests/fixtures/formatter_cases.py
"""
import pytest
from app.services.formatter import format_case, FormatterError
from tests.fixtures.formatter_cases import ALL_CASES, SHORT_ONLY_CASES, ERROR_CASES


class TestAcademicFull:
    """Test academicFull output (law review format, R2.1(a) — roman case names)."""

    @pytest.mark.parametrize("case", ALL_CASES, ids=[c["id"] for c in ALL_CASES])
    def test_academic_full(self, case):
        if case.get("xfail_academic"):
            pytest.xfail(f"academicFull not yet correct: {case['rule']}")
        result = format_case(case["fields"])
        assert result.academicFull == case["academicFull"]


class TestFullCitation:
    """Test fullCitation output (court document format, B2 — italic case names)."""

    @pytest.mark.parametrize("case", ALL_CASES, ids=[c["id"] for c in ALL_CASES])
    def test_full_citation(self, case):
        if case.get("xfail_full"):
            pytest.xfail(f"fullCitation not yet correct: {case['rule']}")
        result = format_case(case["fields"])
        assert result.fullCitation == case["fullCitation"]


class TestShortForm:
    """Test shortForm output (R10.9 / B10.2 — always italic party name)."""

    _all = ALL_CASES + SHORT_ONLY_CASES

    @pytest.mark.parametrize("case", _all, ids=[c["id"] for c in _all])
    def test_short_form(self, case):
        if case.get("xfail_short"):
            pytest.xfail(f"shortForm not yet correct: {case['rule']}")
        result = format_case(case["fields"])
        assert result.shortForm == case["shortForm"]


class TestFormatterErrors:
    """Test that missing required fields raise FormatterError."""

    @pytest.mark.parametrize("case", ERROR_CASES, ids=[c["id"] for c in ERROR_CASES])
    def test_raises(self, case):
        with pytest.raises(FormatterError, match=case["match"]):
            format_case(case["fields"])
