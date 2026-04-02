"""Tests for citation_generator (deterministic path + LLM fallback)."""
import json
from app.schemas.citation import GenerateRequest, ParseResponse, GenerateResponse
from app.services.citation_generator import generate_citation
from tests.conftest import make_parse_response, BROWN_GENERATED_JSON


class TestDeterministicPath:
    async def test_scotus_published_no_llm_call(self, mock_llm_complete):
        """Published SCOTUS case should use format_case, not the LLM."""
        parsed = make_parse_response()
        req = GenerateRequest(parsed=parsed, fields={})
        result = await generate_citation(req, source_type="case")

        mock_llm_complete.assert_not_called()
        assert "<em>" in result.academicFull
        assert "347 U.S. 483" in result.academicFull
        assert "(1954)" in result.academicFull
        assert result.academicFull.endswith(".")

    async def test_deterministic_path_returns_rules_used(self, mock_llm_complete):
        parsed = make_parse_response()
        req = GenerateRequest(parsed=parsed, fields={})
        result = await generate_citation(req, source_type="case")
        assert len(result.rulesUsed) > 0

    async def test_validation_warnings_attached(self, mock_llm_complete):
        parsed = make_parse_response()
        req = GenerateRequest(parsed=parsed, fields={})
        result = await generate_citation(req, source_type="case")
        assert isinstance(result.validationWarnings, list)


class TestLLMFallback:
    async def test_non_case_source_type_uses_llm(self, mock_llm_complete):
        mock_llm_complete.return_value = BROWN_GENERATED_JSON
        parsed = make_parse_response()
        req = GenerateRequest(parsed=parsed, fields={})
        result = await generate_citation(req, source_type="statute")

        mock_llm_complete.assert_called_once()
        assert result.academicFull is not None

    async def test_formatter_error_falls_back_to_llm(self, mock_llm_complete):
        """When deterministic formatter raises (e.g., missing fields), LLM kicks in."""
        mock_llm_complete.return_value = BROWN_GENERATED_JSON
        parsed = make_parse_response(
            isUnpublished=True,
            fullDate="",
            docket="22-1234",
        )
        req = GenerateRequest(parsed=parsed, fields={})
        result = await generate_citation(req, source_type="case")

        mock_llm_complete.assert_called_once()
        assert result.academicFull is not None

    async def test_llm_result_is_sanitized(self, mock_llm_complete):
        mock_llm_complete.return_value = json.dumps({
            "academicFull": " <em>Brown v. Bd. of Educ.</em>,  347 U.S. 483 (1954). ",
            "shortForm": "<em>Brown</em>, 347 U.S. at 483.",
            "fullCitation": "<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).",
        })
        parsed = make_parse_response()
        req = GenerateRequest(parsed=parsed, fields={})
        result = await generate_citation(req, source_type="statute")

        assert "  " not in result.academicFull
        assert not result.academicFull.startswith(" ")

    async def test_fields_override_merged(self, mock_llm_complete):
        """User-confirmed field edits should override parsed values."""
        parsed = make_parse_response(year="1900")
        req = GenerateRequest(parsed=parsed, fields={"year": "1954"})
        result = await generate_citation(req, source_type="case")

        mock_llm_complete.assert_not_called()
        assert "1954" in result.academicFull
