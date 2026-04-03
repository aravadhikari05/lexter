# Section-aware Bluebook rule loader for LLM prompt injection
import re
from pathlib import Path

BLUEBOOK_DIR = Path(__file__).resolve().parents[2] / "Bluebook"
BLUEPAGES = BLUEBOOK_DIR / "Bluepages"

# Tier 1 mapping: source_type -> list of overview files
_GENERAL_RULE_FILES: dict[str, list[str]] = {
    "case": ["b10_cases.md"],
    # TODO: add mappings for statutes, constitutions, etc.
    "statute": [],
    "constitution": [],
    "book": [],
}


def _read_file(filepath: Path) -> str:
    if filepath.exists():
        return filepath.read_text(encoding="utf-8")
    return ""


def _extract_section(filepath: str, heading: str) -> str:
    """Extract content under a specific heading (e.g. 'B10.1.1') until the next same-or-higher level heading."""
    text = _read_file(Path(filepath))
    if not text:
        return ""

    # Count the depth by dots: B10.1.1 has depth 3
    depth = heading.count(".")

    # Match the target heading line
    pattern = re.compile(
        rf"^(#+\s*)?{re.escape(heading)}\b.*$", re.MULTILINE
    )
    match = pattern.search(text)
    if not match:
        return ""

    start = match.start()

    # Find next heading of same or higher level (fewer or equal dots)
    # e.g. for B10.1.1 (depth 3), stop at B10.1.2 (depth 3) or B10.2 (depth 2)
    rest = text[match.end():]
    next_heading = re.compile(
        r"^(#+\s*)?(B\d+(?:\.\d+)*)\b", re.MULTILINE
    )
    for m in next_heading.finditer(rest):
        candidate_depth = m.group(2).count(".")
        if candidate_depth <= depth:
            end = match.end() + m.start()
            return text[start:end].strip()

    return text[start:].strip()


def get_general_rules(source_type: str) -> str:
    files = _GENERAL_RULE_FILES.get(source_type, [])
    parts = []
    for fname in files:
        content = _read_file(BLUEPAGES / fname)
        if content:
            parts.append(content)
    return "\n\n".join(parts)


def get_specific_rules(source_type: str, parsed: dict) -> str:
    if source_type != "case":
        return ""

    filepath = str(BLUEPAGES / "b10_1_full_citation.md")

    # Always include these core sections
    sections = ["B10.1.1", "B10.1.2", "B10.1.3"]

    if parsed.get("isUnpublished"):
        sections.append("B10.1.4")

    if parsed.get("history"):
        sections.append("B10.1.6")

    parts = []
    for sec in sections:
        content = _extract_section(filepath, sec)
        if content:
            # Emphasize pincite section if pincite exists
            if sec == "B10.1.2" and parsed.get("pincite"):
                content = "** IMPORTANT — pincite present, pay close attention: **\n" + content
            parts.append(content)

    return "\n\n".join(parts)
