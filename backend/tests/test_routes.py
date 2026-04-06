"""Integration tests for API routes (LLM mocked via conftest fixtures)."""
import json
from tests.conftest import make_parse_response, BROWN_PARSED_JSON, BROWN_GENERATED_JSON
from app.api.routes.chat import parse_triage_output


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealthRoute:
    async def test_health_check(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ── Citation parse ────────────────────────────────────────────────────────────

class TestCitationParse:
    async def test_parse_returns_200(self, client, mock_llm_complete):
        resp = await client.post(
            "/citation/parse",
            json={"raw_input": "347 U.S. 483"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "caseName" in data
        assert "volume" in data
        assert "reporter" in data

    async def test_parse_response_shape(self, client, mock_llm_complete):
        resp = await client.post(
            "/citation/parse",
            json={"raw_input": "347 U.S. 483"},
        )
        data = resp.json()
        assert isinstance(data["missingFields"], list)
        assert isinstance(data["needsConfirmation"], list)
        assert isinstance(data["isScotus"], bool)


# ── Citation generate ─────────────────────────────────────────────────────────

class TestCitationGenerate:
    async def test_generate_returns_200(self, client, mock_llm_complete):
        parsed = make_parse_response()
        resp = await client.post(
            "/citation/generate",
            json={"parsed": parsed.model_dump(), "fields": {}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "academicFull" in data
        assert "shortForm" in data
        assert "fullCitation" in data

    async def test_generate_response_has_rules(self, client, mock_llm_complete):
        parsed = make_parse_response()
        resp = await client.post(
            "/citation/generate",
            json={"parsed": parsed.model_dump(), "fields": {}},
        )
        data = resp.json()
        assert isinstance(data.get("rulesUsed"), list)
        assert len(data["rulesUsed"]) > 0


# ── Citation orchestrate (SSE) ────────────────────────────────────────────────

class TestCitationOrchestrate:
    async def test_orchestrate_returns_sse(self, client, mock_llm_complete):
        resp = await client.post(
            "/citation/orchestrate",
            json={"raw_input": "347 U.S. 483"},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

    async def test_orchestrate_event_sequence(self, client, mock_llm_complete):
        resp = await client.post(
            "/citation/orchestrate",
            json={"raw_input": "347 U.S. 483"},
        )
        events = _parse_sse_events(resp.text)
        event_types = [e["type"] for e in events]

        assert "step" in event_types
        assert "extracted" in event_types
        assert "checkpoint" in event_types
        assert event_types[-1] == "done"

    async def test_orchestrate_extracted_has_fields(self, client, mock_llm_complete):
        resp = await client.post(
            "/citation/orchestrate",
            json={"raw_input": "347 U.S. 483"},
        )
        events = _parse_sse_events(resp.text)
        extracted = _find_event(events, "extracted")
        assert extracted is not None
        assert "caseName" in extracted["data"]
        assert "volume" in extracted["data"]


# ── Chat confirm (SSE) ───────────────────────────────────────────────────────

class TestChatConfirm:
    async def test_confirm_returns_sse(self, client, mock_llm_complete):
        parsed = make_parse_response()
        resp = await client.post(
            "/chat/confirm",
            json={"parsed": parsed.model_dump(), "source_type": "case"},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

    async def test_confirm_emits_citation_event(self, client, mock_llm_complete):
        parsed = make_parse_response()
        resp = await client.post(
            "/chat/confirm",
            json={"parsed": parsed.model_dump(), "source_type": "case"},
        )
        events = _parse_sse_events(resp.text)
        event_types = [e["type"] for e in events]
        assert "citation" in event_types
        assert "done" in event_types

    async def test_confirm_citation_data(self, client, mock_llm_complete):
        parsed = make_parse_response()
        resp = await client.post(
            "/chat/confirm",
            json={"parsed": parsed.model_dump(), "source_type": "case"},
        )
        events = _parse_sse_events(resp.text)
        citation_event = _find_event(events, "citation")
        assert citation_event is not None
        data = citation_event["data"]
        assert "academicFull" in data
        assert "shortForm" in data
        assert "fullCitation" in data


# ── Triage tag parsing ───────────────────────────────────────────────────────

class TestParseTriageOutput:
    def test_parses_raw_and_tags(self):
        full = "Citing your case now. %%PROCEED::Brown v. Board%%TAGS::published,scotus%%"
        raw, tags = parse_triage_output(full)
        assert raw == "Brown v. Board"
        assert tags == ["published", "scotus"]

    def test_defaults_to_published_when_no_tags(self):
        full = "Citing your case now. %%PROCEED::Brown v. Board%%"
        raw, tags = parse_triage_output(full)
        assert raw == "Brown v. Board"
        assert tags == ["published"]

    def test_handles_single_tag(self):
        full = "Sure! %%PROCEED::Smith v. Jones%%TAGS::unpublished%%"
        raw, tags = parse_triage_output(full)
        assert raw == "Smith v. Jones"
        assert tags == ["unpublished"]

    def test_strips_whitespace_in_tags(self):
        full = "%%PROCEED::Test v. Case%%TAGS:: published , scotus %%"
        raw, tags = parse_triage_output(full)
        assert tags == ["published", "scotus"]

    def test_electronic_database_tag(self):
        full = "%%PROCEED::Doe v. Smith, 2024 WL 12345%%TAGS::electronic_database%%"
        raw, tags = parse_triage_output(full)
        assert raw == "Doe v. Smith, 2024 WL 12345"
        assert tags == ["electronic_database"]

    def test_multiple_additive_tags(self):
        full = "%%PROCEED::Cooper v. Dupnik%%TAGS::published,parenthetical,history%%"
        raw, tags = parse_triage_output(full)
        assert tags == ["published", "parenthetical", "history"]


# ── Helper ────────────────────────────────────────────────────────────────────

def _parse_sse_events(raw: str) -> list[dict]:
    """Parse SSE text into a list of JSON event dicts."""
    events = []
    for line in raw.strip().splitlines():
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


def _find_event(events: list[dict], event_type: str) -> dict | None:
    for e in events:
        if e.get("type") == event_type:
            return e
    return None
