import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.schemas.citation import ParseRequest, ParseResponse, GenerateRequest, GenerateResponse
from app.services.citation_parser import parse_citation
from app.services.citation_generator import generate_citation

router = APIRouter(prefix="/citation", tags=["citation"])


# ─── Existing endpoints ───────────────────────────────────────────────────────

@router.post("/parse", response_model=ParseResponse)
async def parse(req: ParseRequest):
    return await parse_citation(req)


@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    return await generate_citation(req)


# ─── Orchestrate ──────────────────────────────────────────────────────────────

class OrchestrateRequest(BaseModel):
    raw_input: str


def sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _orchestrate_stream(raw_input: str):
    # ── Parse steps UI animation + real LLM call in parallel ─────────────────
    yield sse({"type": "step", "id": "read",     "status": "running", "label": "Reading input"})
    await asyncio.sleep(0.20)
    yield sse({"type": "step", "id": "read",     "status": "done"})

    yield sse({"type": "step", "id": "name",     "status": "running", "label": "Extracting case name"})
    await asyncio.sleep(0.25)
    yield sse({"type": "step", "id": "name",     "status": "done"})

    yield sse({"type": "step", "id": "reporter", "status": "running", "label": "Identifying reporter"})

    # Fire LLM parse while remaining steps tick
    parse_task = asyncio.create_task(
        parse_citation(ParseRequest(raw_input=raw_input), source_type="case")
    )

    await asyncio.sleep(0.25)
    yield sse({"type": "step", "id": "reporter", "status": "done"})

    yield sse({"type": "step", "id": "court",    "status": "running", "label": "Resolving court"})
    await asyncio.sleep(0.25)
    yield sse({"type": "step", "id": "court",    "status": "done"})

    yield sse({"type": "step", "id": "fields",   "status": "running", "label": "Finalising fields"})

    try:
        parsed = await parse_task
    except Exception as e:
        yield sse({"type": "error", "message": str(e)})
        return

    yield sse({"type": "step", "id": "fields", "status": "done"})
    await asyncio.sleep(0.10)

    # ── Emit extracted JSON ───────────────────────────────────────────────────
    extracted = {
        "caseName":                 parsed.caseName,
        "volume":                   parsed.volume,
        "reporter":                 parsed.reporter,
        "firstPage":                parsed.firstPage,
        "pincite":                  parsed.pincite,
        "court":                    parsed.court,
        "year":                     parsed.year,
        "fullDate":                 parsed.fullDate,
        "docket":                   parsed.docket,
        "weightParenthetical":      parsed.weightParenthetical,
        "explanatoryParenthetical": parsed.explanatoryParenthetical,
        "isScotus":                 parsed.isScotus,
        "isUnpublished":            parsed.isUnpublished,
        "jurisdiction":             parsed.jurisdiction,
        "missingFields":            parsed.missingFields     or [],
        "needsConfirmation":        parsed.needsConfirmation or [],
    }
    yield sse({"type": "extracted", "data": extracted})
    await asyncio.sleep(0.15)

    # ── Route to checkpoint then stop ─────────────────────────────────────────
    missing = [f for f in (parsed.missingFields     or []) if f != "docket"]
    warn    = [f for f in (parsed.needsConfirmation or []) if f != "docket"]

    if missing or warn:
        yield sse({
            "type":    "checkpoint",
            "reason":  "courtlistener",
            "message": "Using CourtListener to fill missing fields…",
            "missing": missing,
            "warn":    warn,
        })
    else:
        yield sse({
            "type":    "checkpoint",
            "reason":  "bluebook",
            "message": "Doing RAG on Bluebook rules…",
        })

    yield sse({"type": "done"})


@router.post("/orchestrate")
async def orchestrate(req: OrchestrateRequest):
    return StreamingResponse(
        _orchestrate_stream(req.raw_input),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )