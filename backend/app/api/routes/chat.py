# app/api/routes/chat.py
import json
import os

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from app.schemas.chat import (
    ChatRequest,
    ParseRequest, ParseResponse,
    GenerateRequest, GenerateResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL  = "gpt-4o-mini"

# ─── System prompts ────────────────────────────────────────────────────────────

CHAT_SYSTEM = """You are Lexter, a friendly but focused legal citation assistant (Bluebook 21st ed.).

You're the nerdy friend who knows citations cold — warm, a little witty, never stuffy.
You can say hi back, make small talk briefly, but always nudge back toward citations.

Examples:
- "hey!" → "Hey! Ready to cite something? Drop a case name or paste a citation."
- "what can you do?" → "Bluebook citations, mostly — case law, short forms, pincites. Try me."
- "thanks!" → "Anytime! Got another one to cite?"

When the user wants to generate or format a citation, respond ONLY with this exact token on its own line:
  %%CITE::<raw input>%%

For everything else: 1–3 sentences max, friendly but concise, steer back to citations.
Never make up citations."""

PARSE_SYSTEM = """You are a Bluebook 21st edition citation parser. Extract fields from raw input and return ONLY valid JSON — no markdown, no extra text.

Required shape:
{
  "caseName":           string | null,
  "volume":             string | null,
  "reporter":           string | null,
  "firstPage":          string | null,
  "pincite":            string | null,
  "court":              string | null,
  "year":               string | null,
  "docket":             string | null,
  "isScotus":           boolean,
  "isUnpublished":      boolean,
  "jurisdiction":       string,
  "missingFields":      string[],
  "needsConfirmation":  string[]
}

Field rules:
- caseName: "Party A v. Party B" format, apply Table T6 abbreviations
- reporter: Bluebook Table T1 abbreviations (U.S., F.3d, S. Ct., L. Ed., etc.)
- court: use T1 abbreviations (e.g. "9th Cir.", "S.D.N.Y.")
- isScotus: true if reporter is U.S., S. Ct., L. Ed., or L. Ed. 2d — these are SCOTUS-only reporters
- jurisdiction: one of "SCOTUS", "Circuit", "District", "State", "Unknown"
- pincite: extract if present, never put in missingFields

missingFields rules — STRICT, do not guess:
- Always required: caseName, year
- Required for published cases: volume, reporter, firstPage
- court: ONLY required if isScotus is false AND jurisdiction is not SCOTUS
  - Never put "court" in missingFields for SCOTUS cases (U.S., S. Ct., L. Ed. reporters)
- If a field is not explicitly stated in the input, it is missing — do NOT infer or guess it
- Fields guessed or uncertain go in needsConfirmation

Return ONLY the JSON."""

GENERATE_SYSTEM = """You are a Bluebook 21st edition formatter. Given complete case fields, return ONLY valid JSON — no markdown.

Required shape:
{
  "academicFull": string,
  "shortForm":    string,
  "fullCitation": string,
  "rulesUsed":    string[]
}

Formatting rules:
- academicFull (Rule 10, law review): case name in SMALL CAPS using <span class="sc">...</span>, comma, Vol Reporter FirstPage (Court Year).
    e.g. <span class="sc">Brown v. Bd. of Educ.</span>, 347 U.S. 483 (1954).
    Omit court parenthetical for SCOTUS reporters (U.S., S. Ct., L. Ed.) per Rule 10.4(b).
- shortForm (Rule 10.9): case name in italics <em>...</em>, Vol Reporter at FirstPage.
    e.g. <em>Brown</em>, 347 U.S. at 483.
- fullCitation (Rule B10, court docs/memos): case name in italics <em>...</em>, same structure as academic.
    e.g. <em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).
- rulesUsed: list specific rules applied, e.g. ["Rule 10", "Rule 10.4(b)", "Table T1", "Table T6"]
- Do NOT inject pincite — handled client-side.

Return ONLY the JSON."""


# ─── Helper ────────────────────────────────────────────────────────────────────

def _safe_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    return json.loads(text)


# ─── POST /chat/stream ────────────────────────────────────────────────────────

@router.post("/stream")
async def stream_chat(req: ChatRequest):
    messages = [{"role": "system", "content": CHAT_SYSTEM}]
    for h in req.history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    if not messages or messages[-1].get("content") != req.message:
        messages.append({"role": "user", "content": req.message})

    async def event_stream():
        full   = ""
        chunks = []

        stream = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=400,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full += delta
                chunks.append(delta)

        is_cite    = "%%CITE::" in full
        cite_input = None

        if is_cite:
            try:
                cite_input = full.split("%%CITE::")[1].split("%%")[0].strip()
            except Exception:
                cite_input = req.message
            # stream only the text before the %%CITE:: marker
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


# ─── POST /chat/parse ─────────────────────────────────────────────────────────

@router.post("/parse", response_model=ParseResponse)
async def parse_citation(req: ParseRequest):
    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": PARSE_SYSTEM},
            {"role": "user",   "content": req.raw_input},
        ],
        max_tokens=500,
        temperature=0,
    )
    data = _safe_json(resp.choices[0].message.content or "{}")
    return ParseResponse(**data)


# ─── POST /chat/generate ─────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateResponse)
async def generate_citation(req: GenerateRequest):
    merged = req.parsed.model_dump(exclude_none=True)
    merged.update(req.fields)
    # strip meta fields before sending to formatter
    for k in ("missingFields", "needsConfirmation", "isUnpublished", "jurisdiction", "docket"):
        merged.pop(k, None)

    prompt = (
        "Generate a Bluebook citation for this case:\n"
        + json.dumps(merged, indent=2)
        + "\n\nDo NOT include pincite — return base citation only."
    )

    resp = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": GENERATE_SYSTEM},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=500,
        temperature=0,
    )
    data = _safe_json(resp.choices[0].message.content or "{}")
    return GenerateResponse(**data)