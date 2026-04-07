"""
End-to-end benchmark: sparse input → full Bluebook citation.

Tests whether different models can look up and correctly cite lesser-known cases
when given only a case name (no volume, reporter, page, court, or year).

Usage:
    cd backend
    source .venv/bin/activate
    python bench.py
"""

import asyncio
import sys
import time
from app.core.config import settings
from app.schemas.citation import ParseRequest
from app.services.parser import parse_citation
from app.services.generator import generate_citation
from app.schemas.citation import GenerateRequest

# ── Models to benchmark ──────────────────────────────────────────────────────

MODELS = [
    # "qwen/qwen3.5-flash-02-23",
    # "google/gemini-3.1-flash-lite-preview",
    # "x-ai/grok-4.1-fast",
    # "google/gemma-4-31b-it",
    # "google/gemini-2.5-flash-lite",
]

# ── Ground truth cases (all web-search verified) ─────────────────────────────
# Each case uses a sparse input (just the case name or a fragment).
# Expected fields are the verified correct citation components.

CASES = [
    {
        "id": "tiano",
        "input": "Tiano v. Dillard Department Stores, Inc.",
        "expected": {
            "volume": "139",
            "reporter": "F.3d",
            "firstPage": "679",
            "court": "9th Cir.",
            "year": "1998",
        },
    },
    {
        "id": "pottenger",
        "input": "Pottenger v. Potlatch Corp.",
        "expected": {
            "volume": "329",
            "reporter": "F.3d",
            "firstPage": "740",
            "court": "9th Cir.",
            "year": "2003",
        },
    },
    {
        "id": "raniola",
        "input": "Raniola v. Bratton",
        "expected": {
            "volume": "243",
            "reporter": "F.3d",
            "firstPage": "610",
            "court": "2d Cir.",
            "year": "2001",
        },
    },
    {
        "id": "lentini",
        "input": "Lentini v. California Center for the Arts, Escondido",
        "expected": {
            "volume": "370",
            "reporter": "F.3d",
            "firstPage": "837",
            "court": "9th Cir.",
            "year": "2004",
        },
    },
    {
        "id": "bruso",
        "input": "Bruso v. United Airlines, Inc.",
        "expected": {
            "volume": "239",
            "reporter": "F.3d",
            "firstPage": "848",
            "court": "7th Cir.",
            "year": "2001",
        },
    },
    {
        "id": "zubulake",
        "input": "Zubulake v. UBS Warburg LLC",
        "expected": {
            "volume": "217",
            "reporter": "F.R.D.",
            "firstPage": "309",
            "court": "S.D.N.Y.",
            "year": "2003",
        },
    },
    {
        "id": "stout",
        "input": "Stout v. Baxter Healthcare Corp.",
        "expected": {
            "volume": "282",
            "reporter": "F.3d",
            "firstPage": "856",
            "court": "5th Cir.",
            "year": "2002",
        },
    },
    {
        "id": "nissan_fire",
        "input": "Nissan Fire & Marine Insurance Co. v. Fritz Companies, Inc.",
        "expected": {
            "volume": "210",
            "reporter": "F.3d",
            "firstPage": "1099",
            "court": "9th Cir.",
            "year": "2000",
        },
    },
    {
        "id": "swierkiewicz",
        "input": "Swierkiewicz v. Sorema N.A.",
        "expected": {
            "volume": "534",
            "reporter": "U.S.",
            "firstPage": "506",
            "court": "",  # SCOTUS — no court parenthetical
            "year": "2002",
        },
    },
    {
        "id": "colwell",
        "input": "Colwell v. Suffolk County Police Department",
        "expected": {
            "volume": "158",
            "reporter": "F.3d",
            "firstPage": "635",
            "court": "2d Cir.",
            "year": "1998",
        },
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def match_field(expected: str, actual: str | None) -> bool:
    """Fuzzy match: strip, lowercase, ignore trailing periods."""
    if not expected:
        return True  # empty expected = don't care (e.g. SCOTUS court)
    if actual is None:
        return False
    return expected.strip().lower().rstrip(".") == actual.strip().lower().rstrip(".")


def check_fields(expected: dict, parsed) -> dict[str, str]:
    """Return {field: 'PASS'|'FAIL (got X)'} for each expected field."""
    results = {}
    for field, exp_val in expected.items():
        actual = getattr(parsed, field, None)
        if match_field(exp_val, actual):
            results[field] = "PASS"
        else:
            results[field] = f"FAIL (got {actual!r})"
    return results


async def run_case(case: dict) -> dict:
    """Run a single case through parse → generate. Return results."""
    req = ParseRequest(raw_input=case["input"])
    t0 = time.time()

    try:
        parsed = await parse_citation(req)
        gen_req = GenerateRequest(parsed=parsed)
        generated = await generate_citation(gen_req)
        elapsed = time.time() - t0

        field_results = check_fields(case["expected"], parsed)
        all_pass = all(v == "PASS" for v in field_results.values())

        return {
            "id": case["id"],
            "input": case["input"],
            "fields": field_results,
            "pass": all_pass,
            "citation": generated.fullCitation,
            "elapsed": elapsed,
            "error": None,
        }
    except Exception as e:
        return {
            "id": case["id"],
            "input": case["input"],
            "fields": {},
            "pass": False,
            "citation": None,
            "elapsed": time.time() - t0,
            "error": str(e),
        }


# ── Main ─────────────────────────────────────────────────────────────────────

HEADER = f"{'ID':<16} {'vol':>5} {'rptr':>8} {'page':>6} {'court':>10} {'year':>6}  {'time':>5}  {'citation'}"
SEP = "─" * 120


def print_result(r: dict):
    if r["error"]:
        print(f"  {r['id']:<16} ERROR: {r['error']}")
        return

    f = r["fields"]

    def sym(field):
        return "✓" if f.get(field) == "PASS" else "✗"

    def detail(field):
        v = f.get(field, "—")
        if v == "PASS":
            return ""
        return v.replace("FAIL ", "")

    status = "PASS" if r["pass"] else "FAIL"
    marks = f"{sym('volume'):>5} {sym('reporter'):>8} {sym('firstPage'):>6} {sym('court'):>10} {sym('year'):>6}"
    cite = (r["citation"] or "—")[:60]
    print(f"  {r['id']:<16} {marks}  {r['elapsed']:4.1f}s  {cite}")

    # Print details for failed fields
    fails = {k: v for k, v in f.items() if v != "PASS"}
    if fails:
        for field, detail_str in fails.items():
            print(f"  {'':>16}   └─ {field}: {detail_str}")


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
    print("\n  LEXTER CITATION BENCHMARK")
    print(f"  {len(CASES)} cases × {len(MODELS)} models\n")

    # Show what we're testing
    print("  Cases:")
    for c in CASES:
        exp = c["expected"]
        court = exp["court"] or "SCOTUS"
        print(f"    {c['id']:<16} {exp['volume']} {exp['reporter']} {exp['firstPage']} ({court} {exp['year']})")

    summary = []
    for model in MODELS:
        passed, total = await bench_model(model)
        summary.append((model, passed, total))

    # Final summary
    print(f"\n\n{'═' * 60}")
    print(f"  SUMMARY")
    print(f"{'═' * 60}")
    for model, passed, total in summary:
        bar = "█" * passed + "░" * (total - passed)
        print(f"  {model:<42} {bar} {passed}/{total}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
