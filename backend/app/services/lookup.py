"""
citation_lookup.py

Post-LLM cross-validation against CourtListener.

Workflow:
  1. LLM fills ALL fields — from user input or its own knowledge
  2. parser.py calls mark_auto_filled() to track what the user didn't provide
  3. cross_validate() searches CL with caseName + volume
  4. CL verifies/corrects reporter / firstPage / court / year
  5. autoFilled persists so UI always shows the badge for non-user-provided fields
"""

import re
import httpx
from app.schemas.citation import ParseResponse
from app.core.config import settings

CL_SEARCH = "https://www.courtlistener.com/api/rest/v4/search/"

CL_COURT_MAP = {
    "scotus": None,
    "ca1":    "1st Cir.",
    "ca2":    "2d Cir.",
    "ca3":    "3d Cir.",
    "ca4":    "4th Cir.",
    "ca5":    "5th Cir.",
    "ca6":    "6th Cir.",
    "ca7":    "7th Cir.",
    "ca8":    "8th Cir.",
    "ca9":    "9th Cir.",
    "ca10":   "10th Cir.",
    "ca11":   "11th Cir.",
    "cadc":   "D.C. Cir.",
    "cafc":   "Fed. Cir.",
    "dcd":    "D.D.C.",
    "nysd":   "S.D.N.Y.",
    "nyed":   "E.D.N.Y.",
    "nynd":   "N.D.N.Y.",
    "nywd":   "W.D.N.Y.",
    "cand":   "N.D. Cal.",
    "cacd":   "C.D. Cal.",
    "caed":   "E.D. Cal.",
    "casd":   "S.D. Cal.",
    "ilnd":   "N.D. Ill.",
    "ilsd":   "S.D. Ill.",
    "txsd":   "S.D. Tex.",
    "txnd":   "N.D. Tex.",
    "txed":   "E.D. Tex.",
    "txwd":   "W.D. Tex.",
    "mad":    "D. Mass.",
    "mdd":    "D. Md.",
    "ctd":    "D. Conn.",
    "njd":    "D.N.J.",
    "ded":    "D. Del.",
    "paed":   "E.D. Pa.",
    "pawd":   "W.D. Pa.",
    "gamd":   "M.D. Ga.",
    "gand":   "N.D. Ga.",
    "gasd":   "S.D. Ga.",
    "vaed":   "E.D. Va.",
    "vawd":   "W.D. Va.",
    "ohnd":   "N.D. Ohio",
    "ohsd":   "S.D. Ohio",
    "mied":   "E.D. Mich.",
    "miwd":   "W.D. Mich.",
    "mnd":    "D. Minn.",
    "ord":    "D. Or.",
    "wawd":   "W.D. Wash.",
    "waed":   "E.D. Wash.",
    "cod":    "D. Colo.",
    "azd":    "D. Ariz.",
    "nvd":    "D. Nev.",
    "utd":    "D. Utah",
    "flnd":   "N.D. Fla.",
    "flmd":   "M.D. Fla.",
    "flsd":   "S.D. Fla.",
    "moed":   "E.D. Mo.",
    "mowd":   "W.D. Mo.",
}

# Fields we track for auto-fill detection
TRACKED_FIELDS = ("volume", "reporter", "firstPage", "court", "year")


# ── Mark auto-filled fields ───────────────────────────────────────────────────

def mark_auto_filled(parsed: ParseResponse, raw_input: str) -> ParseResponse:
    """
    Compare the raw user input against extracted fields.
    Any field whose value doesn't appear in the raw input was auto-filled
    by the LLM from its own knowledge — mark it in autoFilled.
    Called in parser.py right after parsing.
    """
    raw_lower = raw_input.lower()
    auto: dict[str, str] = dict(parsed.autoFilled or {})

    for field in TRACKED_FIELDS:
        val = getattr(parsed, field)
        if val and str(val).lower() not in raw_lower:
            auto[field] = "LLM"

    updated = parsed.model_dump()
    updated["autoFilled"] = auto
    return ParseResponse(**updated)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_cl_citation(citation_str: str) -> dict:
    """'347 U.S. 483' → {volume, reporter, firstPage}"""
    m = re.match(r"^(\d+)\s+(.+?)\s+(\d+)$", citation_str.strip())
    if not m:
        return {}
    return {
        "volume":    m.group(1),
        "reporter":  m.group(2),
        "firstPage": m.group(3),
    }


# ── CourtListener fetch ───────────────────────────────────────────────────────

async def _fetch_from_courtlistener(case_name: str, volume: str) -> dict | None:
    query   = f"{case_name} {volume}"
    headers = {"Authorization": f"Token {settings.courtlistener_api_key}"}
    params  = {"q": query, "type": "o", "page_size": 3}

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(CL_SEARCH, params=params, headers=headers)
        if resp.status_code != 200:
            return None
        results = resp.json().get("results", [])
        if not results:
            return None
        return max(results, key=lambda r: r.get("score", 0))
    except Exception:
        return None


# ── Sanity check ─────────────────────────────────────────────────────────────

def _is_same_case(cl: dict, llm_volume: str) -> bool:
    cl_citations = cl.get("citation", [])
    if not cl_citations:
        return False
    cl_parsed = _parse_cl_citation(cl_citations[0])
    cl_volume = cl_parsed.get("volume", "").strip()
    return cl_volume == str(llm_volume).strip()


# ── Main cross-validation entry point ────────────────────────────────────────

async def cross_validate(parsed: ParseResponse) -> ParseResponse:
    """
    Search CL with caseName + volume, sanity-check, then overwrite
    reporter / firstPage / court / year with CL values.
    autoFilled is preserved — CL verifying a field doesn't hide the badge.
    needsConfirmation is cleared for CL-verified fields since they're now trusted.
    """
    if not parsed.caseName or not parsed.volume:
        return parsed

    cl = await _fetch_from_courtlistener(parsed.caseName, parsed.volume)
    if not cl:
        return parsed

    if not _is_same_case(cl, parsed.volume):
        return parsed  # wrong case — trust LLM entirely

    needs_conf  = set(parsed.needsConfirmation or [])
    updated     = parsed.model_dump()
    auto_filled = dict(updated.get("autoFilled") or {})

    # ── Reporter + firstPage ──────────────────────────────────────────────────
    cl_citations = cl.get("citation", [])
    if cl_citations:
        cl_parsed = _parse_cl_citation(cl_citations[0])
        for field in ("reporter", "firstPage"):
            cl_val = cl_parsed.get(field)
            if cl_val:
                updated[field] = cl_val
                needs_conf.discard(field)  # CL verified it — trusted
                if field in auto_filled:
                    auto_filled[field] = "CL"

    # ── Court ─────────────────────────────────────────────────────────────────
    cl_court_id = cl.get("court", "")
    if cl_court_id in CL_COURT_MAP:
        updated["court"] = CL_COURT_MAP[cl_court_id]
        needs_conf.discard("court")
        if "court" in auto_filled:
            auto_filled["court"] = "CL"

    # ── Year ──────────────────────────────────────────────────────────────────
    date_filed = (cl.get("dateFiled") or "")[:4]
    if date_filed:
        updated["year"] = date_filed
        needs_conf.discard("year")
        if "year" in auto_filled:
            auto_filled["year"] = "CL"

    # autoFilled intentionally NOT cleared — badge always shows for
    # fields the user didn't provide, even if CL verified them
    updated["autoFilled"] = auto_filled
    updated["needsConfirmation"] = sorted(needs_conf)
    return ParseResponse(**updated)