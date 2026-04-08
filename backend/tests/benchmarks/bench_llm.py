"""
LLM-only benchmark: sparse input → LLM parse → deterministic generate.

Tests whether the configured model can look up and correctly cite cases
when given only a case name (no volume, reporter, page, court, or year).

Usage:
    cd backend
    source .venv/bin/activate
    python -m tests.benchmarks.bench_llm
"""

import asyncio
import time
from app.core.config import settings
from app.schemas.citation import ParseRequest, GenerateRequest
from app.services.parser import parse_citation
from app.services.generator import generate_citation
from tests.fixtures.bench_cases import CASES
from tests.benchmarks.helpers import check_fields, all_pass, field_symbols, print_fails, print_field_summary

MODELS = [
    "google/gemini-3.1-flash-lite-preview",
]

HEADER = f"{'ID':<16} {'vol':>5} {'rptr':>8} {'page':>6} {'court':>10} {'year':>6}  {'time':>5}  {'citation'}"
SEP = "─" * 120


async def run_case(case: dict) -> dict:
    req = ParseRequest(raw_input=case["input"])
    t0 = time.time()
    try:
        parsed = await parse_citation(req)
        generated = await generate_citation(GenerateRequest(parsed=parsed))
        elapsed = time.time() - t0
        fields = check_fields(case["expected"], parsed)
        return {
            "id": case["id"],
            "fields": fields,
            "pass": all_pass(fields),
            "citation": generated.fullCitation,
            "elapsed": elapsed,
            "error": None,
        }
    except Exception as e:
        return {
            "id": case["id"],
            "fields": {},
            "pass": False,
            "citation": None,
            "elapsed": time.time() - t0,
            "error": str(e),
        }


def print_result(r: dict):
    if r["error"]:
        print(f"  {r['id']:<16} ERROR: {r['error']}")
        return
    cite = (r["citation"] or "—")[:60]
    print(f"  {r['id']:<16} {field_symbols(r['fields'])}  {r['elapsed']:4.1f}s  {cite}")
    if not r["pass"]:
        print_fails(r["fields"], f"  {'':>16} ")


async def bench_model(model: str):
    settings.model = model
    print(f"\n{'═' * 120}")
    print(f"  MODEL: {model}")
    print(f"{'═' * 120}")
    print(f"  {HEADER}")
    print(f"  {SEP}")

    results = []
    for case in CASES:
        r = await run_case(case)
        results.append(r)
        print_result(r)

    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    avg_time = sum(r["elapsed"] for r in results) / total
    print(f"  {SEP}")
    print(f"  SCORE: {passed}/{total} cases correct  |  avg {avg_time:.1f}s per case")
    return passed, total


async def main():
    print("\n  LEXTER LLM BENCHMARK")
    print(f"  {len(CASES)} cases × {len(MODELS)} models\n")

    print("  Cases:")
    for c in CASES:
        exp = c["expected"]
        court = exp["court"] or "SCOTUS"
        print(f"    {c['id']:<16} {exp['volume']} {exp['reporter']} {exp['firstPage']} ({court} {exp['year']})")

    summary = []
    for model in MODELS:
        passed, total = await bench_model(model)
        summary.append((model, passed, total))

    print(f"\n\n{'═' * 60}")
    print(f"  SUMMARY")
    print(f"{'═' * 60}")
    for model, passed, total in summary:
        bar = "█" * passed + "░" * (total - passed)
        print(f"  {model:<42} {bar} {passed}/{total}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
