"""
citation_lookup.py

Fills in missing citation fields before generation.

RIGHT NOW: Uses an LLM call to infer/fill missing fields.
LATER: Replace `_fetch_from_courtlistener` with a real CourtListener API lookup.
       The rest of this function stays the same — just swap the data source.
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
async def enrich_parsed(parsed: ParseResponse) -> ParseResponse:
    """
    Takes a ParseResponse that may have missing fields.
    Attempts to fill them — first via CourtListener (stub for now), then LLM fallback.
    Returns a new ParseResponse with as many fields filled as possible.
    """
    missing = [f for f in (parsed.missingFields or []) if f != "docket"]
    if not missing:
        return parsed

    # Step 1: Try CourtListener (stub — returns {} until wired up)
    cl_data = await _fetch_from_courtlistener(parsed.caseName or "", parsed)

    # Step 2: LLM fills whatever CourtListener didn't cover
    still_missing = [f for f in missing if f not in cl_data or not cl_data[f]]
    llm_data = await _enrich_via_llm(parsed, still_missing) if still_missing else {}

    # Step 3: Merge — CourtListener takes priority over LLM
    merged = {**llm_data, **cl_data}

    # Apply to parsed object
    field_map = {
        "caseName":  "caseName",
        "volume":    "volume",
        "reporter":  "reporter",
        "firstPage": "firstPage",
        "court":     "court",
        "year":      "year",
    }
    updated = parsed.model_dump()
    for field in missing:
        key = field_map.get(field)
        if key and merged.get(field):
            updated[key] = merged[field]

    # Clear out the fields we've now filled
    updated["missingFields"] = [
        f for f in missing if not merged.get(f)
    ]

    return ParseResponse(**updated)