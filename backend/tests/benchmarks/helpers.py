"""Shared helpers for benchmark scripts."""

from tests.fixtures.bench_cases import CHECKED_FIELDS


def match_field(expected: str, actual: str | None) -> bool:
    """Fuzzy match: strip, lowercase, ignore trailing periods."""
    if not expected:
        return True  # empty expected = don't care (e.g. SCOTUS court)
    if actual is None:
        return False
    return expected.strip().lower().rstrip(".") == actual.strip().lower().rstrip(".")


def check_fields(expected: dict, obj) -> dict[str, str]:
    """Return {field: 'PASS'|'FAIL (got X)'} for each expected field."""
    results = {}
    for field, exp_val in expected.items():
        actual = getattr(obj, field, None) if not isinstance(obj, dict) else obj.get(field)
        if match_field(exp_val, actual):
            results[field] = "PASS"
        else:
            results[field] = f"FAIL (got {actual!r})"
    return results


def all_pass(field_results: dict) -> bool:
    return all(v == "PASS" for v in field_results.values())


def field_symbols(field_results: dict) -> str:
    def sym(field):
        return "✓" if field_results.get(field) == "PASS" else "✗"
    return f"{sym('volume'):>5} {sym('reporter'):>8} {sym('firstPage'):>6} {sym('court'):>10} {sym('year'):>6}"


def print_fails(field_results: dict, indent: str = ""):
    for field, detail in field_results.items():
        if detail != "PASS":
            print(f"{indent}  └─ {field}: {detail}")


def print_field_summary(label: str, results: list[dict], key: str, total: int):
    """Print per-field accuracy for a stage."""
    print(f"  {label:<12}", end="")
    for f in CHECKED_FIELDS:
        correct = sum(1 for r in results if r[key].get(f) == "PASS")
        print(f"  {correct:>7}/{total}", end="")
    correct_all = sum(1 for r in results if all_pass(r[key]))
    print(f"  {correct_all:>5}/{total}")
