"""Tests for the Bluebook rule lookup / prompt injection."""
from app.utils.rule_lookup import (
    get_general_rules,
    get_specific_rules,
    get_parser_rules,
    _extract_section,
    BLUEPAGES,
    CONDENSED_DIR,
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


class TestGetParserRules:
    def test_published_includes_base_and_published(self):
        result = get_parser_rules(["published"])
        assert "T6" in result or "case name" in result.lower()
        assert "T7" in result or "reporter" in result.lower()

    def test_unpublished_includes_base_and_unpublished(self):
        result = get_parser_rules(["unpublished"])
        assert "docket" in result.lower() or "slip op" in result.lower()

    def test_electronic_database_uses_unpublished_bundle(self):
        result = get_parser_rules(["electronic_database"])
        assert "docket" in result.lower() or "slip op" in result.lower()

    def test_scotus_includes_published_bundle(self):
        # "scotus" maps to the same published_case.md — no duplicate should be added
        result_published_scotus = get_parser_rules(["published", "scotus"])
        result_published = get_parser_rules(["published"])
        assert result_published_scotus == result_published

    def test_multiple_tags(self):
        result = get_parser_rules(["published", "parenthetical", "history"])
        assert "parenthetical" in result.lower() or "weight" in result.lower()
        assert "history" in result.lower() or "aff'd" in result.lower()

    def test_empty_tags_returns_base_only(self):
        result = get_parser_rules([])
        assert len(result) > 0

    def test_unknown_tag_ignored(self):
        result_base = get_parser_rules([])
        result_unknown = get_parser_rules(["nonexistent_tag"])
        assert result_base == result_unknown

    def test_condensed_dir_exists(self):
        assert CONDENSED_DIR.exists()
