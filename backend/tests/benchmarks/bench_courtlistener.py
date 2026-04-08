"""
CourtListener accuracy benchmark.

Tests whether CL's search API returns correct citation fields
for each ground-truth case, using two strategies:
  1. case name + volume (how cross_validate uses it)
  2. case name only (harder test)

Usage:
    cd backend
    source .venv/bin/activate
    python -m tests.benchmarks.bench_courtlistener
"""

import asyncio
import re
import time
import httpx
from app.core.config import settings
from tests.fixtures.bench_cases import CASES, CHECKED_FIELDS
from tests.benchmarks.helpers import match_field, all_pass

CL_SEARCH = "https://www.courtlistener.com/api/rest/v4/search/"


def _parse_cl_citation(citation_str: str) -> dict:
    m = re.match(r"^(\d+)\s+(.+?)\s+(\d+)$", citation_str.strip())
    if not m:
        return {}
    return {
        "volume": m.group(1),
        "reporter": m.group(2),
        "firstPage": m.group(3),
    }


async def search_courtlistener(case_name: str, volume: str = "") -> dict | None:
    query = f"{case_name} {volume}".strip()
    headers = {"Authorization": f"Token {settings.courtlistener_api_key}"}
    params = {"q": query, "type": "o", "page_size": 5}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(CL_SEARCH, params=params, headers=headers)
    if resp.status_code != 200:
        return None
    results = resp.json().get("results", [])
    if not results:
        return None
    return max(results, key=lambda r: r.get("score", 0))


def extract_fields(cl_result: dict) -> dict:
    fields = {}
    citations = cl_result.get("citation", [])
    if citations:
        fields.update(_parse_cl_citation(citations[0]))

    court_cite = cl_result.get("court_citation_string", "")
    court_id = cl_result.get("court_id", "")
    if court_id == "scotus":
        fields["court"] = ""
    elif court_cite:
        fields["court"] = court_cite
    else:
        fields["court"] = cl_result.get("court", "")

    date_filed = (cl_result.get("dateFiled") or "")[:4]
    if date_filed:
        fields["year"] = date_filed
    return fields


async def run_case(case: dict) -> dict:
    t0 = time.time()
    cl_vol = await search_courtlistener(case["input"], case["expected"]["volume"])
    cl_name = await search_courtlistener(case["input"])
    elapsed = time.time() - t0

    results = {}
    cl_cites = {}
    for strategy, cl_result in [("with_volume", cl_vol), ("name_only", cl_name)]:
        if cl_result is None:
            results[strategy] = {f: "NO RESULT" for f in case["expected"]}
            cl_cites[strategy] = []
            continue
        extracted = extract_fields(cl_result)
        field_results = {}
        for field, exp_val in case["expected"].items():
            actual = extracted.get(field)
            if match_field(exp_val, actual):
                field_results[field] = "PASS"
            else:
                field_results[field] = f"FAIL (got {actual!r})"
        results[strategy] = field_results
        cl_cites[strategy] = cl_result.get("citation", [])

    return {
        "id": case["id"],
        "results": results,
        "cl_cites": cl_cites,
        "elapsed": elapsed,
    }


def print_result(r: dict):
    for strategy in ["with_volume", "name_only"]:
        f = r["results"][strategy]
        def sym(field):
            return "✓" if f.get(field) == "PASS" else "✗"
        label = "vol+name" if strategy == "with_volume" else "name only"
        marks = f"{sym('volume'):>5} {sym('reporter'):>8} {sym('firstPage'):>6} {sym('court'):>10} {sym('year'):>6}"
        cite = r["cl_cites"][strategy][0] if r["cl_cites"][strategy] else "—"
        print(f"  {r['id']:<16} [{label:<9}] {marks}  {cite}")
        for field, detail in f.items():
            if detail != "PASS":
                print(f"  {'':>16} {'':>13}  └─ {field}: {detail}")


SEP = "─" * 110


async def main():
    print("\n  COURTLISTENER ACCURACY BENCHMARK")
    print(f"  {len(CASES)} cases\n")

    if not settings.courtlistener_api_key:
        print("  ERROR: COURTLISTENER_API_KEY not set in .env")
        return

    print(f"  {'ID':<16} {'strategy':>13} {'vol':>5} {'rptr':>8} {'page':>6} {'court':>10} {'year':>6}  {'CL citation'}")
    print(f"  {SEP}")

    all_results = []
    for case in CASES:
        r = await run_case(case)
        all_results.append(r)
        print_result(r)
        print(f"  {SEP}")

    for strategy in ["with_volume", "name_only"]:
        passed = sum(1 for r in all_results if all_pass(r["results"][strategy]))
        total = len(all_results)
        field_scores = {}
        for field in CHECKED_FIELDS:
            correct = sum(1 for r in all_results if r["results"][strategy].get(field) == "PASS")
            field_scores[field] = f"{correct}/{total}"
        label = "case name + volume" if strategy == "with_volume" else "case name only"
        print(f"\n  [{label}]")
        print(f"    Overall: {passed}/{total} cases fully correct")
        print(f"    By field: {', '.join(f'{k}={v}' for k, v in field_scores.items())}")

    avg_time = sum(r["elapsed"] for r in all_results) / len(all_results)
    print(f"\n  Avg latency: {avg_time:.2f}s per case (2 queries each)")
    print()


if __name__ == "__main__":
    asyncio.run(main())
