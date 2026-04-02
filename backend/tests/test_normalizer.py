"""Tests for the deterministic normalizer (T1, T7, T6, jurisdiction)."""
import pytest
from app.schemas.citation import ParseResponse
from app.utils.normalizer import (
    normalize_reporter,
    normalize_court,
    derive_jurisdiction,
    normalize,
    normalize_fields,
    CANONICAL_REPORTERS,
    SCOTUS_REPORTERS,
)


# ── Reporter normalization (T1) ──────────────────────────────────────────────

class TestNormalizeReporter:
    def test_exact_match_unchanged(self):
        assert normalize_reporter("U.S.") == "U.S."
        assert normalize_reporter("F.3d") == "F.3d"
        assert normalize_reporter("S. Ct.") == "S. Ct."

    def test_full_name_alias(self):
        assert normalize_reporter("supreme court reporter") == "S. Ct."
        assert normalize_reporter("federal reporter third") == "F.3d"
        assert normalize_reporter("united states reports") == "U.S."

    def test_compressed_fuzzy_match(self):
        assert normalize_reporter("F3d") == "F.3d"
        assert normalize_reporter("US") == "U.S."
        assert normalize_reporter("F.  3d") == "F.3d"

    def test_passthrough_for_unknown(self):
        assert normalize_reporter("Obscure Rptr.") == "Obscure Rptr."

    def test_empty_string(self):
        assert normalize_reporter("") == ""

    def test_whitespace_stripped(self):
        assert normalize_reporter("  U.S.  ") == "U.S."

    def test_case_insensitive_alias(self):
        assert normalize_reporter("Supreme Court Reporter") == "S. Ct."
        assert normalize_reporter("FEDERAL REPORTER THIRD") == "F.3d"


# ── Court normalization ───────────────────────────────────────────────────────

class TestNormalizeCourt:
    def test_numbered_circuit_word(self):
        assert normalize_court("Ninth Circuit") == "9th Cir."
        assert normalize_court("First Circuit") == "1st Cir."
        assert normalize_court("Second Circuit") == "2d Cir."
        assert normalize_court("Third Circuit") == "3d Cir."

    def test_numbered_circuit_digit(self):
        assert normalize_court("9th Cir.") == "9th Cir."
        assert normalize_court("5th Cir") == "5th Cir."

    def test_long_form_circuit(self):
        assert normalize_court("United States Court of Appeals for the Ninth Circuit") == "9th Cir."
        assert normalize_court("Court of Appeals for the Fifth Circuit") == "5th Cir."

    def test_dc_circuit(self):
        assert normalize_court("D.C. Circuit") == "D.C. Cir."
        assert normalize_court("DC Circuit") == "D.C. Cir."

    def test_federal_circuit(self):
        assert normalize_court("Federal Circuit") == "Fed. Cir."
        assert normalize_court("Fed. Cir.") == "Fed. Cir."

    def test_ca_aliases(self):
        assert normalize_court("ca9") == "9th Cir."
        assert normalize_court("cadc") == "D.C. Cir."
        assert normalize_court("cafc") == "Fed. Cir."

    def test_district_court(self):
        assert normalize_court("Northern District of California") == "N.D. Cal."
        assert normalize_court("Southern District of New York") == "S.D.N.Y."
        assert normalize_court("Eastern District of Pennsylvania") == "E.D. Pa."

    def test_district_no_direction(self):
        assert normalize_court("District of Massachusetts") == "D. Mass."

    def test_passthrough_for_unknown(self):
        assert normalize_court("Imaginary Tribunal") == "Imaginary Tribunal"

    def test_empty_string(self):
        assert normalize_court("") == ""


# ── Jurisdiction derivation ───────────────────────────────────────────────────

class TestDeriveJurisdiction:
    def test_scotus_from_reporter(self):
        assert derive_jurisdiction("U.S.", "") == "SCOTUS"
        assert derive_jurisdiction("S. Ct.", "") == "SCOTUS"

    def test_circuit_from_reporter(self):
        assert derive_jurisdiction("F.3d", "") == "Circuit"
        assert derive_jurisdiction("F.4th", "") == "Circuit"

    def test_district_from_reporter(self):
        assert derive_jurisdiction("F. Supp. 3d", "") == "District"
        assert derive_jurisdiction("B.R.", "") == "District"

    def test_state_from_reporter(self):
        assert derive_jurisdiction("A.3d", "") == "State"
        assert derive_jurisdiction("P.3d", "") == "State"
        assert derive_jurisdiction("Cal. Rptr. 3d", "") == "State"

    def test_fallback_to_court_circuit(self):
        assert derive_jurisdiction(None, "9th Cir.") == "Circuit"

    def test_fallback_to_court_district(self):
        assert derive_jurisdiction(None, "N.D. Cal.") == "District"
        assert derive_jurisdiction(None, "D. Mass.") == "District"

    def test_fallback_to_court_state(self):
        assert derive_jurisdiction(None, "Cal. Ct. App.") == "State"

    def test_unknown_fallback(self):
        assert derive_jurisdiction(None, None) == "Unknown"
        assert derive_jurisdiction(None, "") == "Unknown"
        assert derive_jurisdiction("", "") == "Unknown"


# ── Full normalize() on ParseResponse ─────────────────────────────────────────

class TestNormalize:
    def test_scotus_case(self):
        p = ParseResponse(
            caseName="Brown v. Board of Education",
            volume="347",
            reporter="United States Reports",
            firstPage="483",
            court="",
            year="1954",
        )
        result = normalize(p)
        assert result.reporter == "U.S."
        assert result.isScotus is True
        assert result.jurisdiction == "SCOTUS"
        assert "Educ." in result.caseName  # T6 abbreviation applied

    def test_circuit_case(self):
        p = ParseResponse(
            caseName="Smith v. Jones",
            volume="800",
            reporter="F.3d",
            firstPage="100",
            court="Ninth Circuit",
            year="2020",
        )
        result = normalize(p)
        assert result.court == "9th Cir."
        assert result.isScotus is False
        assert result.jurisdiction == "Circuit"

    def test_normalize_fields_dict(self):
        fields = {
            "caseName": "Test Association v. Board of Education",
            "volume": "100",
            "reporter": "federal reporter third",
            "firstPage": "200",
            "court": "ca9",
            "year": "2023",
        }
        result = normalize_fields(fields)
        assert result["reporter"] == "F.3d"
        assert result["court"] == "9th Cir."
        assert result["isScotus"] is False
        assert result["jurisdiction"] == "Circuit"
        assert "Ass'n" in result["caseName"]  # T6 applied
