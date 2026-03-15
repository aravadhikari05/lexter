import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatRequest
from app.core.prompts import CHAT_SYSTEM
from app.services.llm import stream

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/stream")
async def stream_chat(req: ChatRequest):
    messages = [{"role": "system", "content": CHAT_SYSTEM}]
    for h in req.history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    if not messages or messages[-1].get("content") != req.message:
        messages.append({"role": "user", "content": req.message})

    async def event_stream():
        full = ""
        chunks = []

        async for chunk in await stream(messages, max_tokens=400):
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full += delta
                chunks.append(delta)

        is_cite = "%%CITE::" in full
        cite_input = None

        if is_cite:
            try:
                cite_input = full.split("%%CITE::")[1].split("%%")[0].strip()
            except Exception:
                cite_input = req.message
            clean = full.split("%%CITE::")[0].strip()
            if clean:
                yield f"data: {json.dumps({'token': clean})}\n\n"
        else:
            for token in chunks:
                yield f"data: {json.dumps({'token': token})}\n\n"

        yield f"data: {json.dumps({'done': True, 'isCite': is_cite, 'citeInput': cite_input})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )