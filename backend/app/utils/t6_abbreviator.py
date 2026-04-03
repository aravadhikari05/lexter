"""Deterministic T6 case-name abbreviation per Bluebook Table T6.

Applies word-level substitutions to case names and institutional author names.
Multi-word entries (e.g. "United States" -> "U.S.") are matched first, then
single-word entries, to avoid partial clobbering.
"""

import re
from pathlib import Path

_T6_PATH = Path(__file__).resolve().parents[2] / "Bluebook" / "Whitepages" / "t6_case_names_and_institutional_authors_in_citations.md"

# ── Build lookup tables at import time ────────────────────────────────────────

def _expand_bracket_pattern(raw: str) -> list[str]:
    """Expand 'Academ[ic, y]' -> ['Academic', 'Academy'].

    Also includes the bare stem when len >= 5 so that e.g. 'Education[al]'
    matches both 'Education' and 'Educational'. Short stems (E, N, S, W, F)
    are excluded to avoid false matches on directional abbreviations.
    """
    m = re.match(r"^(.+?)\[(.+)]$", raw.strip())
    if not m:
        return [raw.strip()]
    stem, suffixes = m.group(1), m.group(2)
    forms = [stem + s.strip() for s in suffixes.split(",")]
    if len(stem) >= 5 and stem not in forms:
        forms.insert(0, stem)
    return forms


def _parse_t6_table(path: Path) -> list[tuple[str, str]]:
    """Return (word_or_phrase, abbreviation) pairs from the markdown table."""
    entries: list[tuple[str, str]] = []
    text = path.read_text(encoding="utf-8")
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|") or line.startswith("| ---"):
            continue
        parts = [c.strip() for c in line.split("|")]
        parts = [p for p in parts if p]
        if len(parts) != 2:
            continue
        raw_word, raw_abbr = parts[0], parts[1]
        if raw_word in ("Type Word or Abbreviation to Filter",):
            continue

        abbr_variants = _expand_bracket_pattern(raw_abbr)

        for full_word in _expand_bracket_pattern(raw_word):
            # Multi-suffix abbreviations like "Adm'[r, x]" -> pick the one
            # whose suffix index matches. If only one abbr variant, use it.
            if len(abbr_variants) == 1:
                entries.append((full_word, abbr_variants[0]))
            else:
                idx = _expand_bracket_pattern(raw_word).index(full_word)
                abbr = abbr_variants[idx] if idx < len(abbr_variants) else abbr_variants[0]
                entries.append((full_word, abbr))
    return entries


def _build_lookup(entries: list[tuple[str, str]]) -> tuple[
    list[tuple[re.Pattern, str]],
    list[tuple[re.Pattern, str]],
]:
    """Split entries into multi-word and single-word regex lists.

    Multi-word patterns are checked first to handle phrases like
    "United States" -> "U.S." before "States" could match individually.
    """
    multi: list[tuple[re.Pattern, str]] = []
    single: list[tuple[re.Pattern, str]] = []

    for word, abbr in entries:
        # Possessive handling: match "Employee's" and "Employees'"
        pat = re.escape(word)
        if " " in word:
            multi.append((re.compile(r"\b" + pat + r"\b", re.IGNORECASE), abbr))
        else:
            single.append((re.compile(r"\b" + pat + r"\b", re.IGNORECASE), abbr))

    # Sort multi-word by descending length so longer phrases match first
    multi.sort(key=lambda t: -len(t[0].pattern))
    return multi, single


_RAW_ENTRIES = _parse_t6_table(_T6_PATH)
_MULTI_PATTERNS, _SINGLE_PATTERNS = _build_lookup(_RAW_ENTRIES)


# ── Public API ────────────────────────────────────────────────────────────────

def t6_abbreviate(case_name: str) -> str:
    """Apply T6 abbreviations to a case name string.

    Multi-word phrases (e.g. "United States", "Civil Rights") are replaced
    first, then individual words. Case is preserved for the abbreviation.
    The words "of" and "the" in case names are NOT removed (T6 removal of
    articles applies only to periodical titles per Rule 16).
    """
    result = case_name

    for pat, abbr in _MULTI_PATTERNS:
        result = pat.sub(abbr, result)

    for pat, abbr in _SINGLE_PATTERNS:
        result = pat.sub(abbr, result)

    # Collapse double spaces introduced by replacements
    result = re.sub(r"  +", " ", result).strip()
    return result
