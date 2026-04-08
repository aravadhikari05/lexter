"""
End-to-end benchmark: LLM parse + CourtListener cross-validation → generate.

Tests the full pipeline and compares three stages:
  1. LLM-only parsed fields
  2. After CL cross-validation
  3. Final generated citation strings

Usage:
    cd backend
    source .venv/bin/activate
    python -m tests.benchmarks.bench_e2e
"""

import asyncio
import time
from app.core.config import settings
from app.schemas.citation import ParseRequest, GenerateRequest
from app.services.parser import parse_citation
from app.services.lookup import cross_validate
from app.services.generator import generate_citation
from tests.fixtures.bench_cases import CASES, CHECKED_FIELDS
from tests.benchmarks.helpers import check_fields, all_pass, field_symbols, print_fails, print_field_summary

MODELS = [
    "google/gemini-3.1-flash-lite-preview",
]

SEP = "─" * 120


async def run_case(case: dict) -> dict:
    req = ParseRequest(raw_input=case["input"])
    t0 = time.time()

    try:
        # Stage 1: LLM parse
        parsed = await parse_citation(req)
        t_parse = time.time() - t0
        llm_fields = check_fields(case["expected"], parsed)

        # Stage 2: CL cross-validation
        t1 = time.time()
        validated = await cross_validate(parsed)
        t_cl = time.time() - t1
        cl_fields = check_fields(case["expected"], validated)

        # Track what CL changed
        cl_changes = {}
        for f in CHECKED_FIELDS:
            llm_val = getattr(parsed, f, None)
            cl_val = getattr(validated, f, None)
            if llm_val != cl_val:
                cl_changes[f] = {"from": llm_val, "to": cl_val}

        # Stage 3: Generate citation
        t2 = time.time()
        generated = await generate_citation(GenerateRequest(parsed=validated))
        t_gen = time.time() - t2

        return {
            "id": case["id"],
            "llm_fields": llm_fields,
            "cl_fields": cl_fields,
            "cl_changes": cl_changes,
            "citation": generated.fullCitation,
            "times": {"parse": t_parse, "cl": t_cl, "gen": t_gen, "total": time.time() - t0},
            "error": None,
        }
    except Exception as e:
        return {
            "id": case["id"],
            "llm_fields": {},
            "cl_fields": {},
            "cl_changes": {},
            "citation": None,
            "times": {"parse": 0, "cl": 0, "gen": 0, "total": time.time() - t0},
            "error": str(e),
        }


def print_case(r: dict):
    if r["error"]:
        print(f"  {r['id']:<16} ERROR: {r['error']}")
        return

    t = r["times"]

    # LLM-only row
    print(f"  {r['id']:<16} [LLM     ] {field_symbols(r['llm_fields'])}  {t['parse']:4.1f}s")
    if not all_pass(r["llm_fields"]):
        print_fails(r["llm_fields"], f"  {'':>16} {'':>12}")

    # CL row
    change_info = "CL: no changes"
    if r["cl_changes"]:
        changes = ", ".join(f"{f}: {c['from']!r}→{c['to']!r}" for f, c in r["cl_changes"].items())
        change_info = f"CL changed: {changes}"
    print(f"  {'':>16} [LLM + CL] {field_symbols(r['cl_fields'])}  {t['cl']:4.1f}s  {change_info}")
    if not all_pass(r["cl_fields"]):
        print_fails(r["cl_fields"], f"  {'':>16} {'':>12}")

    # Generated citation
    cite = (r["citation"] or "—")[:80]
    print(f"  {'':>16} [citation] {cite}")


async def bench_model(model: str):
    settings.model = model
    has_cl = bool(settings.courtlistener_api_key)
    print(f"\n{'═' * 120}")
    print(f"  MODEL: {model}")
    print(f"  CL:    {'enabled' if has_cl else 'disabled (no API key)'}")
    print(f"{'═' * 120}")
    print(f"  {'ID':<16} {'stage':>12} {'vol':>5} {'rptr':>8} {'page':>6} {'court':>10} {'year':>6}  {'time / info'}")
    print(f"  {SEP}")

    results = []
    for case in CASES:
        r = await run_case(case)
        results.append(r)
        print_case(r)
        print(f"  {SEP}")

    # Field accuracy table
    print(f"\n  FIELD ACCURACY")
    print(f"  {'stage':<12}", end="")
    for f in CHECKED_FIELDS:
        print(f"  {f:>10}", end="")
    print(f"  {'ALL':>8}")

    print_field_summary("LLM only", results, "llm_fields", len(results))
    print_field_summary("LLM + CL", results, "cl_fields", len(results))

    # CL impact
    helped = hurt = no_change = 0
    for r in results:
        if not r["cl_changes"]:
            no_change += 1
            continue
        llm_ok = all_pass(r["llm_fields"])
        cl_ok = all_pass(r["cl_fields"])
        if cl_ok and not llm_ok:
            helped += 1
        elif llm_ok and not cl_ok:
            hurt += 1
        else:
            llm_n = sum(1 for v in r["llm_fields"].values() if v == "PASS")
            cl_n = sum(1 for v in r["cl_fields"].values() if v == "PASS")
            if cl_n > llm_n:
                helped += 1
            elif cl_n < llm_n:
                hurt += 1
            else:
                no_change += 1

    print(f"\n  CL IMPACT")
    print(f"    Helped (fixed LLM errors):  {helped}")
    print(f"    Hurt (introduced errors):   {hurt}")
    print(f"    No change:                  {no_change}")

    avg = {k: sum(r["times"][k] for r in results) / len(results) for k in ("parse", "cl", "gen", "total")}
    print(f"\n  LATENCY (avg per case)")
    print(f"    Parse (LLM): {avg['parse']:.2f}s  |  CL lookup: {avg['cl']:.2f}s  |  Generate: {avg['gen']:.2f}s  |  Total: {avg['total']:.2f}s")

    return results


async def main():
    print("\n  LEXTER E2E BENCHMARK (LLM + CourtListener)")
    print(f"  {len(CASES)} cases × {len(MODELS)} models\n")

    for model in MODELS:
        await bench_model(model)
    print()


if __name__ == "__main__":
    asyncio.run(main())
