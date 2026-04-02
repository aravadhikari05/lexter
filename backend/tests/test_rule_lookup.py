"""Tests for the Bluebook rule lookup / prompt injection."""
from app.services.rule_lookup import (
    get_general_rules,
    get_specific_rules,
    _extract_section,
    BLUEPAGES,
)


class TestGetGeneralRules:
    def test_case_returns_content(self):
        result = get_general_rules("case")
        assert len(result) > 0
        assert "B10" in result or "case" in result.lower()

    def test_statute_returns_empty(self):
        assert get_general_rules("statute") == ""

    def test_unknown_type_returns_empty(self):
        assert get_general_rules("unknown_type") == ""


class TestGetSpecificRules:
    def test_published_case_includes_core_sections(self):
        parsed = {"isUnpublished": False, "history": None, "pincite": None}
        result = get_specific_rules("case", parsed)
        assert "B10.1.1" in result
        assert "B10.1.2" in result
        assert "B10.1.3" in result

    def test_unpublished_includes_b10_1_4(self):
        parsed = {"isUnpublished": True, "history": None, "pincite": None}
        result = get_specific_rules("case", parsed)
        assert "B10.1.4" in result

    def test_pincite_adds_emphasis(self):
        parsed = {"isUnpublished": False, "history": None, "pincite": "490"}
        result = get_specific_rules("case", parsed)
        assert "IMPORTANT" in result

    def test_non_case_returns_empty(self):
        assert get_specific_rules("statute", {}) == ""


class TestExtractSection:
    def test_extracts_known_section(self):
        filepath = str(BLUEPAGES / "b10_1_full_citation.md")
        result = _extract_section(filepath, "B10.1.1")
        assert len(result) > 0
        assert "B10.1.1" in result

    def test_nonexistent_heading_returns_empty(self):
        filepath = str(BLUEPAGES / "b10_1_full_citation.md")
        result = _extract_section(filepath, "B99.99.99")
        assert result == ""

    def test_nonexistent_file_returns_empty(self):
        result = _extract_section("/nonexistent/path.md", "B10.1.1")
        assert result == ""
