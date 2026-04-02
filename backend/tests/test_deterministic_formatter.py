"""Tests for the deterministic Bluebook case formatter."""
import pytest
from app.services.deterministic_formatter import (
    format_case,
    FormatterError,
    _pick_short_party,
)


# ── Helper: minimal published SCOTUS fields ──────────────────────────────────

def _scotus_fields(**overrides):
    base = {
        "caseName": "Brown v. Bd. of Educ.",
        "volume": "347",
        "reporter": "U.S.",
        "firstPage": "483",
        "court": "",
        "year": "1954",
        "isScotus": True,
        "isUnpublished": False,
    }
    base.update(overrides)
    return base


def _circuit_fields(**overrides):
    base = {
        "caseName": "Smith v. Jones",
        "volume": "800",
        "reporter": "F.3d",
        "firstPage": "100",
        "court": "9th Cir.",
        "year": "2023",
        "isScotus": False,
        "isUnpublished": False,
    }
    base.update(overrides)
    return base


def _unpublished_fields(**overrides):
    base = {
        "caseName": "Doe v. Roe",
        "docket": "22-1234",
        "court": "9th Cir.",
        "fullDate": "Dec. 30, 2022",
        "year": "2022",
        "isScotus": False,
        "isUnpublished": True,
    }
    base.update(overrides)
    return base


def _electronic_db_fields(**overrides):
    base = {
        "caseName": "Doe v. Roe",
        "docket": "22-1234",
        "dbIdentifier": "2022 WL 12345",
        "court": "9th Cir.",
        "fullDate": "Dec. 30, 2022",
        "year": "2022",
        "isScotus": False,
        "isUnpublished": True,
    }
    base.update(overrides)
    return base


# ── Published cases ───────────────────────────────────────────────────────────

class TestPublishedCases:
    def test_scotus_no_court_in_parenthetical(self):
        resp = format_case(_scotus_fields())
        assert "(1954)" in resp.academicFull
        assert "9th Cir." not in resp.academicFull
        assert resp.academicFull.endswith(".")

    def test_scotus_em_tags(self):
        resp = format_case(_scotus_fields())
        assert "<em>Brown v. Bd. of Educ.</em>" in resp.academicFull

    def test_non_scotus_includes_court(self):
        resp = format_case(_circuit_fields())
        assert "(9th Cir. 2023)" in resp.academicFull

    def test_short_form_uses_first_party(self):
        resp = format_case(_circuit_fields())
        assert "<em>Smith</em>" in resp.shortForm
        assert "at 100" in resp.shortForm

    def test_with_pincite(self):
        resp = format_case(_scotus_fields(pincite="490"))
        assert "483, 490" in resp.academicFull
        assert "at 490" in resp.shortForm

    def test_with_parentheticals(self):
        resp = format_case(_scotus_fields(
            weightParenthetical="per curiam",
            explanatoryParenthetical="holding segregation unconstitutional",
        ))
        assert "(per curiam)" in resp.academicFull
        assert "(holding segregation unconstitutional)" in resp.academicFull
        assert "Rule 10.6" in resp.rulesUsed

    def test_rules_used(self):
        resp = format_case(_scotus_fields())
        assert "B10.1" in resp.rulesUsed
        assert "B10.1.2" in resp.rulesUsed

    def test_full_citation_matches_academic(self):
        resp = format_case(_scotus_fields())
        assert resp.fullCitation == resp.academicFull


# ── Unpublished / slip opinion cases ─────────────────────────────────────────

class TestUnpublishedCases:
    def test_slip_opinion_format(self):
        resp = format_case(_unpublished_fields())
        assert "No. 22-1234" in resp.academicFull
        assert "(9th Cir. Dec. 30, 2022)" in resp.academicFull
        assert resp.academicFull.endswith(".")

    def test_slip_opinion_short_form(self):
        resp = format_case(_unpublished_fields())
        assert "slip op." in resp.shortForm

    def test_slip_opinion_with_pincite(self):
        resp = format_case(_unpublished_fields(pincite="5"))
        assert "slip op. at 5" in resp.academicFull
        assert "slip op. at 5" in resp.shortForm

    def test_missing_full_date_raises(self):
        with pytest.raises(FormatterError, match="full date"):
            format_case(_unpublished_fields(fullDate=""))

    def test_missing_docket_raises(self):
        with pytest.raises(FormatterError, match="docket"):
            format_case(_unpublished_fields(docket=""))


# ── Electronic database cases ─────────────────────────────────────────────────

class TestElectronicDbCases:
    def test_electronic_db_format(self):
        resp = format_case(_electronic_db_fields())
        assert "2022 WL 12345" in resp.academicFull
        assert "No. 22-1234" in resp.academicFull
        assert "(9th Cir. Dec. 30, 2022)" in resp.academicFull

    def test_electronic_db_star_pincite(self):
        resp = format_case(_electronic_db_fields(pincite="3"))
        assert "at *3" in resp.academicFull
        assert "at *3" in resp.shortForm

    def test_electronic_db_missing_full_date_raises(self):
        with pytest.raises(FormatterError, match="full date"):
            format_case(_electronic_db_fields(fullDate=""))

    def test_electronic_db_rules(self):
        resp = format_case(_electronic_db_fields())
        assert "B10.1.4" in resp.rulesUsed


# ── Short party selection ─────────────────────────────────────────────────────

class TestPickShortParty:
    def test_normal_case(self):
        assert _pick_short_party("Brown v. Bd. of Educ.") == "Brown"

    def test_government_first_party(self):
        assert _pick_short_party("United States v. Haskell") == "Haskell"

    def test_state_name_first_party(self):
        assert _pick_short_party("Texas v. Johnson") == "Johnson"

    def test_people_first_party(self):
        assert _pick_short_party("People v. Defore") == "Defore"

    def test_in_re_passthrough(self):
        assert _pick_short_party("In re Fairfax") == "In re Fairfax"

    def test_no_v_dot(self):
        assert _pick_short_party("In the Matter of Quinlan") == "In the Matter of Quinlan"

    def test_commonwealth_first_party(self):
        assert _pick_short_party("Commonwealth v. Hunt") == "Hunt"


# ── Missing required fields ───────────────────────────────────────────────────

class TestFormatterErrors:
    def test_missing_case_name(self):
        with pytest.raises(FormatterError, match="caseName"):
            format_case(_scotus_fields(caseName=""))

    def test_missing_volume(self):
        with pytest.raises(FormatterError, match="volume"):
            format_case(_scotus_fields(volume=""))

    def test_missing_reporter(self):
        with pytest.raises(FormatterError, match="reporter"):
            format_case(_scotus_fields(reporter=""))

    def test_missing_first_page(self):
        with pytest.raises(FormatterError, match="firstPage"):
            format_case(_scotus_fields(firstPage=""))

    def test_missing_year(self):
        with pytest.raises(FormatterError, match="year"):
            format_case(_scotus_fields(year=""))

    def test_non_scotus_missing_court(self):
        with pytest.raises(FormatterError, match="court"):
            format_case(_circuit_fields(court=""))
