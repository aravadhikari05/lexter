"""Tests for citation_parser (LLM mocked via conftest fixtures)."""
import json
from unittest.mock import patch
from app.schemas.citation import ParseRequest
from app.services.parser import parse_citation


class TestParseCitation:
    async def test_returns_parse_response(self, mock_llm_complete):
        result = await parse_citation(ParseRequest(raw_input="347 U.S. 483"))
        assert result.caseName is not None
        assert result.volume == "347"
        assert result.reporter == "U.S."

    async def test_normalize_applied(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({
            "caseName": "Brown v. Board of Education",
            "volume": "347",
            "reporter": "United States Reports",
            "firstPage": "483",
            "court": "",
            "year": "1954",
        })
        result = await parse_citation(ParseRequest(raw_input="347 U.S. 483"))
        assert result.reporter == "U.S."
        assert result.isScotus is True
        assert result.jurisdiction == "SCOTUS"

    async def test_missing_fields_detected(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({
            "caseName": "Smith v. Jones",
            "volume": "",
            "reporter": "",
            "firstPage": "",
            "court": "",
            "year": "2020",
        })
        result = await parse_citation(ParseRequest(raw_input="Smith v. Jones (2020)"))
        assert "volume" in result.missingFields
        assert "reporter" in result.missingFields
        assert "firstPage" in result.missingFields

    async def test_llm_called_with_correct_params(self, mock_llm_complete):
        await parse_citation(ParseRequest(raw_input="test input"))
        mock_llm_complete.assert_called_once()
        call_kwargs = mock_llm_complete.call_args
        assert call_kwargs.kwargs.get("temperature") == 0
        assert call_kwargs.kwargs.get("max_tokens") == 500

    async def test_system_prompt_includes_bluebook_rules(self, mock_llm_complete):
        await parse_citation(ParseRequest(raw_input="test"), source_type="case")
        call_args = mock_llm_complete.call_args
        messages = call_args.args[0] if call_args.args else call_args.kwargs["messages"]
        system_msg = messages[0]["content"]
        assert "Bluebook" in system_msg

    async def test_parser_calls_get_parser_rules_with_tags(self, mock_llm_complete):
        with patch("app.services.parser.get_parser_rules") as mock_rules:
            mock_rules.return_value = "some rules"
            req = ParseRequest(raw_input="Brown v. Board of Education")
            await parse_citation(req, source_type="case", tags=["published", "scotus"])
            mock_rules.assert_called_once_with(["published", "scotus"])

    async def test_parser_defaults_to_published(self, mock_llm_complete):
        with patch("app.services.parser.get_parser_rules") as mock_rules:
            mock_rules.return_value = "some rules"
            req = ParseRequest(raw_input="Brown v. Board of Education")
            await parse_citation(req, source_type="case")
            mock_rules.assert_called_once_with(["published"])

    async def test_t6_abbreviation_applied(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({
            "caseName": "National Association of Manufacturers",
            "volume": "100",
            "reporter": "F.3d",
            "firstPage": "200",
            "court": "9th Cir.",
            "year": "2023",
        })
        result = await parse_citation(ParseRequest(raw_input="test"))
        assert "Ass'n" in result.caseName
        assert "Nat'l" in result.caseName
