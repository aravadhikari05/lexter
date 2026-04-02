"""Tests for the deterministic missing-field checker."""
from app.schemas.citation import ParseResponse
from app.services.missing_fields import check_missing_fields


def _parsed(**overrides) -> ParseResponse:
    defaults = dict(
        caseName="Brown v. Bd. of Educ.",
        volume="347",
        reporter="U.S.",
        firstPage="483",
        court="",
        year="1954",
        isScotus=True,
        isUnpublished=False,
        needsConfirmation=[],
    )
    defaults.update(overrides)
    return ParseResponse(**defaults)


# ── Required field detection ──────────────────────────────────────────────────

class TestRequiredFields:
    def test_published_all_present(self):
        missing, _ = check_missing_fields(_parsed())
        assert missing == []

    def test_missing_case_name(self):
        missing, _ = check_missing_fields(_parsed(caseName=""))
        assert "caseName" in missing

    def test_missing_year(self):
        missing, _ = check_missing_fields(_parsed(year=""))
        assert "year" in missing

    def test_missing_volume(self):
        missing, _ = check_missing_fields(_parsed(volume=""))
        assert "volume" in missing

    def test_missing_reporter(self):
        missing, _ = check_missing_fields(_parsed(reporter=""))
        assert "reporter" in missing

    def test_missing_first_page(self):
        missing, _ = check_missing_fields(_parsed(firstPage=""))
        assert "firstPage" in missing

    def test_scotus_court_not_required(self):
        missing, _ = check_missing_fields(_parsed(court="", isScotus=True))
        assert "court" not in missing

    def test_non_scotus_court_required(self):
        missing, _ = check_missing_fields(_parsed(
            isScotus=False, court="", reporter="F.3d",
        ))
        assert "court" in missing


# ── Unpublished case requirements ─────────────────────────────────────────────

class TestUnpublishedRequirements:
    def test_docket_required(self):
        missing, _ = check_missing_fields(_parsed(
            isUnpublished=True, docket="",
        ))
        assert "docket" in missing

    def test_full_date_required(self):
        missing, _ = check_missing_fields(_parsed(
            isUnpublished=True, fullDate="",
        ))
        assert "fullDate" in missing

    def test_unpublished_volume_not_required(self):
        missing, _ = check_missing_fields(_parsed(
            isUnpublished=True, volume="", docket="22-1234", fullDate="Dec. 30, 2022",
        ))
        assert "volume" not in missing


# ── Suspicious value detection ────────────────────────────────────────────────

class TestSuspiciousValues:
    def test_non_numeric_volume_needs_confirmation(self):
        _, needs = check_missing_fields(_parsed(volume="ABC"))
        assert "volume" in needs

    def test_numeric_volume_ok(self):
        _, needs = check_missing_fields(_parsed(volume="347"))
        assert "volume" not in needs

    def test_non_4digit_year_needs_confirmation(self):
        _, needs = check_missing_fields(_parsed(year="19X4"))
        assert "year" in needs

    def test_valid_year_ok(self):
        _, needs = check_missing_fields(_parsed(year="1954"))
        assert "year" not in needs

    def test_unknown_reporter_needs_confirmation(self):
        _, needs = check_missing_fields(_parsed(reporter="Fake Rptr."))
        assert "reporter" in needs

    def test_known_reporter_ok(self):
        _, needs = check_missing_fields(_parsed(reporter="U.S."))
        assert "reporter" not in needs

    def test_preserves_existing_needs_confirmation(self):
        _, needs = check_missing_fields(_parsed(
            needsConfirmation=["caseName"],
            volume="ABC",
        ))
        assert "caseName" in needs
        assert "volume" in needs

    def test_no_duplicate_confirmation(self):
        _, needs = check_missing_fields(_parsed(
            needsConfirmation=["volume"],
            volume="ABC",
        ))
        assert needs.count("volume") == 1
