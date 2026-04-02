"""
citation_lookup.py

Fills in missing citation fields before generation.

RIGHT NOW: Uses an LLM call to infer/fill missing fields.
LATER: Replace `_fetch_from_courtlistener` with a real CourtListener API lookup.
       The rest of this function stays the same — just swap the data source.

Trust hierarchy:
  1. CourtListener (verified)  — accepted silently
  2. LLM parametric recall     — marked "unverified", always needs user confirmation
"""

from app.schemas.citation import ParseResponse
from app.services.llm import complete, safe_json


# ─── CourtListener stub ───────────────────────────────────────────────────────
# TODO: Replace this entire function with a real CourtListener API call.
#       CourtListener REST API docs: https://www.courtlistener.com/help/api/rest/
#       Endpoint to use: GET https://www.courtlistener.com/api/rest/v3/search/
#         params: q=<case name>, type=o (opinions)
#       Extract: volume, reporter, first_page, court, year from the top result.
#       Return a dict with the same keys as below.
async def _fetch_from_courtlistener(case_name: str, parsed: ParseResponse) -> dict:
    # ── INSERT COURTLISTENER API LOGIC HERE ───────────────────────────────────
    # For now: fall through to LLM enrichment below.
    return {}


# ─── LLM fallback enrichment ──────────────────────────────────────────────────
async def _enrich_via_llm(parsed: ParseResponse, missing: list[str]) -> dict:
    fields_needed = ", ".join(missing)
    prompt = f"""You are a Bluebook legal citation expert with broad knowledge of U.S. case law.

A citation is missing the following fields: {fields_needed}

Known information:
- Case name: {parsed.caseName}
- Volume: {parsed.volume or "unknown"}
- Reporter: {parsed.reporter or "unknown"}
- First page: {parsed.firstPage or "unknown"}
- Court: {parsed.court or "unknown"}
- Year: {parsed.year or "unknown"}

Fill in the missing fields as accurately as possible based on your knowledge of this case.
Return ONLY valid JSON with the missing field names as keys. No markdown, no extra text.
Only include fields that were listed as missing. Be as accurate as possible — this is legal work."""

    text = await complete(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0,
    )
    try:
        return safe_json(text)
    except Exception:
        return {}


# ─── Main enrichment entry point ──────────────────────────────────────────────

ENRICHABLE_FIELDS = {
    "caseName":  "caseName",
    "volume":    "volume",
    "reporter":  "reporter",
    "firstPage": "firstPage",
    "court":     "court",
    "year":      "year",
}


async def enrich_parsed(parsed: ParseResponse) -> ParseResponse:
    """
    Takes a ParseResponse that may have missing fields.
    Attempts to fill them — first via CourtListener, then LLM fallback.

    Fields filled by LLM are added to ``needsConfirmation`` so the UI can
    mark them as unverified and require explicit user approval before
    generating a final citation.
    """
    missing = [f for f in (parsed.missingFields or []) if f != "docket"]
    if not missing:
        return parsed

    cl_data = await _fetch_from_courtlistener(parsed.caseName or "", parsed)

    still_missing = [f for f in missing if f not in cl_data or not cl_data[f]]
    llm_data = await _enrich_via_llm(parsed, still_missing) if still_missing else {}

    # CourtListener values take priority over LLM guesses
    merged = {**llm_data, **cl_data}

    updated = parsed.model_dump()
    llm_filled: list[str] = []

    for field in missing:
        key = ENRICHABLE_FIELDS.get(field)
        if key and merged.get(field):
            updated[key] = merged[field]
            # Track provenance: LLM-filled fields are unverified
            if field not in cl_data or not cl_data.get(field):
                llm_filled.append(field)

    updated["missingFields"] = [
        f for f in missing if not merged.get(f)
    ]

    # Any field the LLM supplied (rather than CourtListener) requires
    # explicit user confirmation before we trust it.
    existing_confirms = set(parsed.needsConfirmation or [])
    updated["needsConfirmation"] = sorted(
        existing_confirms | set(llm_filled)
    )

    return ParseResponse(**updated)