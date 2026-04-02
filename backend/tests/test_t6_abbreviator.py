"""Tests for T6 case-name abbreviation."""
from app.services.t6_abbreviator import t6_abbreviate


class TestT6Abbreviate:
    def test_multi_word_replacement(self):
        result = t6_abbreviate("United States v. Jones")
        assert "U.S." in result

    def test_single_word_replacement(self):
        result = t6_abbreviate("National Association of Manufacturers")
        assert "Ass'n" in result
        assert "Nat'l" in result

    def test_education_abbreviation(self):
        result = t6_abbreviate("Brown v. Board of Education")
        assert "Educ." in result

    def test_preserves_words_with_no_entry(self):
        result = t6_abbreviate("Smith v. Jones")
        assert "Smith" in result
        assert "Jones" in result
        assert "v." in result

    def test_double_space_cleanup(self):
        result = t6_abbreviate("American Insurance Company")
        assert "  " not in result

    def test_empty_string(self):
        assert t6_abbreviate("") == ""

    def test_department_abbreviation(self):
        result = t6_abbreviate("Department of Transportation")
        assert "Dep't" in result
        assert "Transp." in result

    def test_company_abbreviation(self):
        result = t6_abbreviate("General Electric Company")
        assert "Co." in result

    def test_government_abbreviation(self):
        result = t6_abbreviate("Brown v. Board of Education of Topeka")
        assert "Educ." in result
