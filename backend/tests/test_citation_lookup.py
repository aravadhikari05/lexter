"""Tests for citation_lookup enrichment (LLM mocked)."""
import json
from app.services.citation_lookup import enrich_parsed
from tests.conftest import make_parse_response


class TestEnrichParsed:
    async def test_no_missing_fields_skips_llm(self, mock_llm_complete):
        parsed = make_parse_response(missingFields=[])
        result = await enrich_parsed(parsed)
        mock_llm_complete.assert_not_called()
        assert result.caseName == parsed.caseName

    async def test_fills_missing_fields_from_llm(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({
            "volume": "500",
            "reporter": "F.3d",
        })
        parsed = make_parse_response(
            volume=None,
            reporter=None,
            missingFields=["volume", "reporter"],
            isScotus=False,
            court="9th Cir.",
        )
        result = await enrich_parsed(parsed)

        mock_llm_complete.assert_called_once()
        assert result.volume == "500"
        assert result.reporter == "F.3d"

    async def test_llm_filled_fields_need_confirmation(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({"year": "2020"})
        parsed = make_parse_response(year=None, missingFields=["year"])
        result = await enrich_parsed(parsed)
        assert "year" in result.needsConfirmation

    async def test_invalid_llm_json_graceful_fallback(self, mock_llm_complete):
        mock_llm_complete.return_value = "not valid json at all"
        parsed = make_parse_response(
            volume=None,
            missingFields=["volume"],
        )
        result = await enrich_parsed(parsed)
        assert "volume" in result.missingFields

    async def test_docket_excluded_from_enrichment(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({})
        parsed = make_parse_response(
            missingFields=["docket"],
            docket=None,
        )
        result = await enrich_parsed(parsed)
        mock_llm_complete.assert_not_called()

    async def test_partially_filled(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({"volume": "100"})
        parsed = make_parse_response(
            volume=None,
            firstPage=None,
            missingFields=["volume", "firstPage"],
        )
        result = await enrich_parsed(parsed)
        assert result.volume == "100"
        assert "firstPage" in result.missingFields
