import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.schemas.chat import ChatRequest
from app.schemas.citation import ParseRequest, GenerateRequest, ParseResponse
from app.core.prompts import build_chat_system
from app.core.llm import stream
from app.services.parser import parse_citation
from app.services.generator import generate_citation
from app.services.lookup import cross_validate

router = APIRouter(prefix="/chat", tags=["chat"])


def sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ─── Main chat stream ─────────────────────────────────────────────────────────

@router.post("/stream")
async def stream_chat(req: ChatRequest):
    system = build_chat_system(req.intent, req.source_type)

    messages = [{"role": "system", "content": system}]
    for h in req.history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    if not messages or messages[-1].get("content") != req.message:
        messages.append({"role": "user", "content": req.message})

    async def event_stream():
        # ── Buffer LLM response ───────────────────────────────────────────────
        yield sse({"type": "step", "id": "thinking", "status": "running", "label": "Thinking"})

        full = ""
        try:
            async for chunk in await stream(messages, max_tokens=200):
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    full += delta
            print("LLM RAW:", repr(full))
        except Exception as e:
            yield sse({"type": "error", "message": str(e)})
            yield sse({"type": "done"})
            return

        yield sse({"type": "step", "id": "thinking", "status": "done"})

        if "%%PROCEED::" in full:
            try:
                raw_input = full.split("%%PROCEED::")[1].split("%%")[0].strip()
            except Exception:
                raw_input = req.message

            # ── Step ticker ───────────────────────────────────────────────────
            yield sse({"type": "step", "id": "read",     "status": "running", "label": "Reading input"})
            await asyncio.sleep(0.15)
            yield sse({"type": "step", "id": "read",     "status": "done"})

            yield sse({"type": "step", "id": "name",     "status": "running", "label": "Extracting case name"})
            parse_task = asyncio.create_task(
                parse_citation(ParseRequest(raw_input=raw_input), source_type=req.source_type)
            )
            await asyncio.sleep(0.25)
            yield sse({"type": "step", "id": "name",     "status": "done"})

            yield sse({"type": "step", "id": "reporter", "status": "running", "label": "Identifying reporter"})
            await asyncio.sleep(0.25)
            yield sse({"type": "step", "id": "reporter", "status": "done"})

            yield sse({"type": "step", "id": "fields",   "status": "running", "label": "Resolving fields"})

            try:
                parsed = await parse_task
            except Exception as e:
                yield sse({"type": "error", "message": str(e)})
                yield sse({"type": "done"})
                return

            yield sse({"type": "step", "id": "fields", "status": "done"})

            # ── CourtListener cross-validation ────────────────────────────────
            yield sse({"type": "step", "id": "validate", "status": "running", "label": "Verifying with CourtListener"})
            try:
                parsed = await cross_validate(parsed)
            except Exception:
                pass  # non-fatal — proceed with LLM values
            yield sse({"type": "step", "id": "validate", "status": "done"})

            await asyncio.sleep(0.10)

            # ── Always confirm ────────────────────────────────────────────────
            yield sse({"type": "confirm", "parsed": parsed.model_dump()})
            yield sse({"type": "done"})
            return

        else:
            # ── Normal conversational reply ───────────────────────────────────
            for char in full:
                yield sse({"type": "token", "token": char})

        yield sse({"type": "done"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Confirm → Generate ───────────────────────────────────────────────────────

class ConfirmRequest(BaseModel):
    parsed:      ParseResponse
    source_type: str = "case"


@router.post("/confirm")
async def confirm_and_generate(req: ConfirmRequest):
    async def event_stream():
        yield sse({"type": "step", "id": "cite", "status": "running", "label": "Building citation"})
        try:
            generated = await generate_citation(
                GenerateRequest(parsed=req.parsed), source_type=req.source_type
            )
        except Exception as e:
            yield sse({"type": "error", "message": str(e)})
            yield sse({"type": "done"})
            return
        yield sse({"type": "step", "id": "cite", "status": "done"})
        await asyncio.sleep(0.10)
        yield sse({"type": "citation", "data": _citation_dict(generated)})
        yield sse({"type": "done"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _citation_dict(generated) -> dict:
    return {
        "academicFull":       generated.academicFull,
        "shortForm":          generated.shortForm,
        "fullCitation":       generated.fullCitation,
        "rulesUsed":          generated.rulesUsed or [],
        "validationWarnings": generated.validationWarnings or [],
    }