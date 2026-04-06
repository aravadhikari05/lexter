"""Shared fixtures for the backend test suite."""
import json
import pytest
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.schemas.citation import ParseResponse, GenerateResponse


# ── Canned LLM responses ─────────────────────────────────────────────────────

BROWN_PARSED_JSON = json.dumps({
    "caseName": "Brown v. Board of Education",
    "volume": "347",
    "reporter": "U.S.",
    "firstPage": "483",
    "court": "",
    "year": "1954",
})

BROWN_GENERATED_JSON = json.dumps({
    "academicFull": "<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).",
    "shortForm": "<em>Brown</em>, 347 U.S. at 483.",
    "fullCitation": "<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).",
    "rulesUsed": ["B10.1", "B10.1.1"],
})

ENRICHMENT_JSON = json.dumps({
    "volume": "347",
    "reporter": "U.S.",
    "firstPage": "483",
    "court": "",
    "year": "1954",
})


# ── LLM mock fixtures ────────────────────────────────────────────────────────

_COMPLETE_PATCH_TARGETS = [
    "app.core.llm.complete",
    "app.services.parser.complete",
    "app.services.generator.complete",
]

_STREAM_PATCH_TARGETS = [
    "app.core.llm.stream",
    "app.api.routes.chat.stream",
]


@pytest.fixture
def mock_llm_complete(monkeypatch):
    """Patch llm.complete everywhere it's imported.

    Tests can override via `mock.return_value = '...'` before calling code.
    """
    mock = AsyncMock(return_value=BROWN_PARSED_JSON)
    for target in _COMPLETE_PATCH_TARGETS:
        monkeypatch.setattr(target, mock)
    return mock


class FakeChoice:
    def __init__(self, content):
        self.delta = type("D", (), {"content": content})()


class FakeChunk:
    def __init__(self, content):
        self.choices = [FakeChoice(content)]


class FakeStream:
    def __init__(self, text):
        self._chunks = [FakeChunk(c) for c in text]
        self._idx = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._idx >= len(self._chunks):
            raise StopAsyncIteration
        chunk = self._chunks[self._idx]
        self._idx += 1
        return chunk


@pytest.fixture
def mock_llm_stream(monkeypatch):
    """Patch llm.stream everywhere it's imported."""
    mock = AsyncMock(return_value=FakeStream("Hello, I can help with that."))
    for target in _STREAM_PATCH_TARGETS:
        monkeypatch.setattr(target, mock)
    return mock


# ── HTTPX client fixture ─────────────────────────────────────────────────────

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ── Model factories ──────────────────────────────────────────────────────────

def make_parse_response(**overrides) -> ParseResponse:
    defaults = dict(
        caseName="Brown v. Bd. of Educ.",
        volume="347",
        reporter="U.S.",
        firstPage="483",
        court="",
        year="1954",
        isScotus=True,
        isUnpublished=False,
        jurisdiction="SCOTUS",
        missingFields=[],
        needsConfirmation=[],
    )
    defaults.update(overrides)
    return ParseResponse(**defaults)


def make_generate_response(**overrides) -> GenerateResponse:
    defaults = dict(
        academicFull="<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).",
        shortForm="<em>Brown</em>, 347 U.S. at 483.",
        fullCitation="<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).",
        rulesUsed=["B10.1"],
    )
    defaults.update(overrides)
    return GenerateResponse(**defaults)
