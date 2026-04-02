"""Deterministic post-LLM normalizer for parsed citation fields.

Applies Bluebook table lookups (T1, T6, T7, T10.1) to canonicalize
reporter, court, isScotus, and jurisdiction values that the LLM
may have extracted imprecisely.
"""

import re
from pathlib import Path

from app.schemas.citation import ParseResponse
from app.utils.t6_abbreviator import t6_abbreviate

_TABLES = Path(__file__).resolve().parents[3] / "Bluebook" / "Whitepages"


# ══════════════════════════════════════════════════════════════════════════════
# 1. REPORTER NORMALIZATION (T1)
# ══════════════════════════════════════════════════════════════════════════════

CANONICAL_REPORTERS: set[str] = {
    # SCOTUS
    "U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d", "U.S.L.W.",
    # Federal — circuit
    "F.", "F.2d", "F.3d", "F.4th", "F. App'x", "F. Cas.",
    # Federal — district
    "F. Supp.", "F. Supp. 2d", "F. Supp. 3d", "F.R.D.", "B.R.",
    # Specialty federal
    "Fed. Cl.", "Cl. Ct.", "Ct. Cl.", "Cust. Ct.", "Ct. Int'l Trade",
    "T.C.", "B.T.A.", "Vet. App.", "C.M.A.", "M.J.", "C.M.R.", "Rapp",
    # Regional / state
    "A.", "A.2d", "A.3d",
    "N.E.", "N.E.2d", "N.E.3d",
    "N.W.", "N.W.2d",
    "P.", "P.2d", "P.3d",
    "S.E.", "S.E.2d",
    "S.W.", "S.W.2d", "S.W.3d",
    "So.", "So. 2d", "So. 3d",
    "Cal. Rptr.", "Cal. Rptr. 2d", "Cal. Rptr. 3d",
}

SCOTUS_REPORTERS: set[str] = {"U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d"}

_FULL_NAME_ALIASES: dict[str, str] = {
    "united states reports": "U.S.",
    "supreme court reporter": "S. Ct.",
    "lawyers edition": "L. Ed.",
    "lawyers edition second": "L. Ed. 2d",
    "lawyers' edition": "L. Ed.",
    "lawyers' edition second": "L. Ed. 2d",
    "united states law week": "U.S.L.W.",
    "federal reporter": "F.",
    "federal reporter second": "F.2d",
    "federal reporter second series": "F.2d",
    "federal reporter third": "F.3d",
    "federal reporter third series": "F.3d",
    "federal reporter fourth": "F.4th",
    "federal reporter fourth series": "F.4th",
    "federal appendix": "F. App'x",
    "federal cases": "F. Cas.",
    "federal supplement": "F. Supp.",
    "federal supplement second": "F. Supp. 2d",
    "federal supplement third": "F. Supp. 3d",
    "federal rules decisions": "F.R.D.",
    "bankruptcy reporter": "B.R.",
    "federal claims reporter": "Fed. Cl.",
    "tax court": "T.C.",
    "military justice reporter": "M.J.",
    "atlantic reporter": "A.",
    "atlantic reporter second": "A.2d",
    "atlantic reporter third": "A.3d",
    "north eastern reporter": "N.E.",
    "northeastern reporter": "N.E.",
    "northeastern reporter second": "N.E.2d",
    "north eastern reporter second": "N.E.2d",
    "north western reporter": "N.W.",
    "northwestern reporter": "N.W.",
    "northwestern reporter second": "N.W.2d",
    "north western reporter second": "N.W.2d",
    "pacific reporter": "P.",
    "pacific reporter second": "P.2d",
    "pacific reporter third": "P.3d",
    "south eastern reporter": "S.E.",
    "southeastern reporter": "S.E.",
    "southeastern reporter second": "S.E.2d",
    "south eastern reporter second": "S.E.2d",
    "south western reporter": "S.W.",
    "southwestern reporter": "S.W.",
    "southwestern reporter second": "S.W.2d",
    "south western reporter second": "S.W.2d",
    "southwestern reporter third": "S.W.3d",
    "south western reporter third": "S.W.3d",
    "southern reporter": "So.",
    "southern reporter second": "So. 2d",
    "southern reporter third": "So. 3d",
    "california reporter": "Cal. Rptr.",
    "california reporter second": "Cal. Rptr. 2d",
    "california reporter third": "Cal. Rptr. 3d",
}


def _compress(s: str) -> str:
    """Strip periods, spaces, apostrophes and lowercase for fuzzy matching."""
    return re.sub(r"[\s.'\u2019]", "", s).lower()


_COMPRESSED_INDEX: dict[str, str] = {}
for _r in CANONICAL_REPORTERS:
    _COMPRESSED_INDEX.setdefault(_compress(_r), _r)
for _alias, _canon in _FULL_NAME_ALIASES.items():
    _COMPRESSED_INDEX.setdefault(_compress(_alias), _canon)


def normalize_reporter(raw: str) -> str:
    """Normalize a reporter string to its canonical Bluebook T1 form.

    Resolution: exact match -> full-name alias -> compressed fuzzy match -> passthrough.
    """
    s = raw.strip()
    if not s:
        return s
    if s in CANONICAL_REPORTERS:
        return s
    low = s.lower().strip()
    if low in _FULL_NAME_ALIASES:
        return _FULL_NAME_ALIASES[low]
    comp = _compress(s)
    if comp in _COMPRESSED_INDEX:
        return _COMPRESSED_INDEX[comp]
    return s


# ══════════════════════════════════════════════════════════════════════════════
# 2. COURT NORMALIZATION (T7 + pattern-based)
# ══════════════════════════════════════════════════════════════════════════════

# ── 2a. T10.1 state/territory abbreviations ──────────────────────────────────

def _parse_t10_states(path: Path) -> dict[str, str]:
    """Parse T10.1 markdown into {lowercase_name: abbreviation}."""
    result: dict[str, str] = {}
    text = path.read_text(encoding="utf-8")
    in_cities = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("Cities"):
            in_cities = True
            continue
        if stripped.startswith("Territories"):
            in_cities = False
            continue
        if in_cities:
            continue
        if not stripped.startswith("|") or stripped.startswith("| ---") or stripped == "| | |":
            continue
        parts = [c.strip() for c in stripped.split("|")]
        parts = [p for p in parts if p]
        if len(parts) != 2:
            continue
        result[parts[0].lower()] = parts[1]
    return result


_STATE_ABBR = _parse_t10_states(_TABLES / "t10_1_us_states_cities_and_territories.md")


# ── 2b. T7 court-name lookup ─────────────────────────────────────────────────

def _strip_t7_note(raw: str) -> str:
    """Remove parenthetical notes like '(federal)' or '(state)'."""
    return re.sub(r"\s*\([^)]*\)\s*", " ", raw).strip()


def _expand_t7_brackets(raw: str) -> list[str]:
    """Expand T7 bracket patterns into all variant forms.

    Space-separated brackets are optional following words:
        'Admiralty [Court, Division]' -> ['Admiralty Court', 'Admiralty Division']
    Attached brackets are suffixes:
        'Court of Appeal[s]' -> ['Court of Appeal', 'Court of Appeals']
    """
    s = raw.strip()
    m = re.search(r"\[([^\]]+)]", s)
    if not m:
        return [s]

    before = s[: m.start()]
    after = s[m.end() :]
    options = [opt.strip() for opt in m.group(1).split(",")]

    if before.endswith(" "):
        return [f"{before}{opt}{after}".strip() for opt in options]

    forms = [f"{before}{opt}{after}".strip() for opt in options]
    stem = before.rstrip()
    if len(stem) >= 5 and f"{stem}{after}".strip() not in forms:
        forms.insert(0, f"{stem}{after}".strip())
    return forms


def _parse_t7_courts(path: Path) -> dict[str, str]:
    """Parse T7 markdown into {lowercase_full_name: abbreviation}."""
    result: dict[str, str] = {}
    text = path.read_text(encoding="utf-8")
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or stripped.startswith("| ---"):
            continue
        parts = [c.strip() for c in stripped.split("|")]
        parts = [p for p in parts if p]
        if len(parts) != 2:
            continue
        raw_name, raw_abbr = parts[0], parts[1]
        if "<" in raw_abbr or "<" in raw_name:
            continue
        clean_name = _strip_t7_note(raw_name)
        for variant in _expand_t7_brackets(clean_name):
            result[variant.lower()] = raw_abbr
    return result


_T7_FULL_TO_ABBR = _parse_t7_courts(_TABLES / "t7_court_names.md")


# ── 2c. Federal circuit pattern matching ──────────────────────────────────────

_WORD_ORDINALS: dict[str, str] = {
    "first": "1st", "second": "2d", "third": "3d", "fourth": "4th",
    "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th",
    "ninth": "9th", "tenth": "10th", "eleventh": "11th",
}

_DIGIT_ORDINALS: dict[str, str] = {
    "1st": "1st", "2d": "2d", "2nd": "2d", "3d": "3d", "3rd": "3d",
    "4th": "4th", "5th": "5th", "6th": "6th", "7th": "7th",
    "8th": "8th", "9th": "9th", "10th": "10th", "11th": "11th",
}

_WORD_ORDINAL_PAT = "|".join(_WORD_ORDINALS.keys())

_CIRCUIT_RE = re.compile(
    rf"(?:(?:United\s+States\s+)?Court\s+of\s+Appeals\s+(?:for\s+)?(?:the\s+)?)?"
    rf"({_WORD_ORDINAL_PAT}|\d{{1,2}}(?:st|nd|rd|th))"
    rf"\s+Circuit(?:\s+Court\s+of\s+Appeals)?",
    re.IGNORECASE,
)

_ABBR_CIRCUIT_RE = re.compile(
    r"^(\d{1,2}(?:st|nd|rd|th))\s+Cir\.?$",
    re.IGNORECASE,
)

_DC_CIRCUIT_RE = re.compile(
    r"(?:(?:United\s+States\s+)?Court\s+of\s+Appeals\s+(?:for\s+)?(?:the\s+)?)?"
    r"D\.?\s*C\.?\s+Cir(?:cuit|\.)?(?:\s+Court\s+of\s+Appeals)?$",
    re.IGNORECASE,
)

_FED_CIRCUIT_RE = re.compile(
    r"(?:(?:United\s+States\s+)?Court\s+of\s+Appeals\s+(?:for\s+)?(?:the\s+)?)?"
    r"Fed(?:eral)?\s+Cir(?:cuit|\.)?(?:\s+Court\s+of\s+Appeals)?$",
    re.IGNORECASE,
)

_CA_ALIASES: dict[str, str] = {
    "ca1": "1st Cir.", "ca2": "2d Cir.", "ca3": "3d Cir.",
    "ca4": "4th Cir.", "ca5": "5th Cir.", "ca6": "6th Cir.",
    "ca7": "7th Cir.", "ca8": "8th Cir.", "ca9": "9th Cir.",
    "ca10": "10th Cir.", "ca11": "11th Cir.",
    "cadc": "D.C. Cir.", "cafc": "Fed. Cir.",
}


def _normalize_circuit(raw: str) -> str | None:
    """Try to normalize as a federal circuit court abbreviation."""
    s = raw.strip()

    if _DC_CIRCUIT_RE.search(s):
        return "D.C. Cir."
    if _FED_CIRCUIT_RE.search(s):
        return "Fed. Cir."

    m = _CIRCUIT_RE.search(s)
    if m:
        ordinal_raw = m.group(1).lower()
        ordinal = _WORD_ORDINALS.get(ordinal_raw) or _DIGIT_ORDINALS.get(ordinal_raw)
        if ordinal:
            return f"{ordinal} Cir."

    m = _ABBR_CIRCUIT_RE.match(s)
    if m:
        ordinal_raw = m.group(1).lower()
        ordinal = _DIGIT_ORDINALS.get(ordinal_raw)
        if ordinal:
            return f"{ordinal} Cir."

    ca = _CA_ALIASES.get(s.lower().replace(" ", ""))
    if ca:
        return ca

    return None


# ── 2d. Federal district pattern matching ─────────────────────────────────────

_DIRECTION_MAP: dict[str, str] = {
    "northern": "N.", "southern": "S.", "eastern": "E.",
    "western": "W.", "central": "C.", "middle": "M.",
}

_DISTRICT_RE = re.compile(
    r"^(?:(?:United\s+States\s+)?District\s+Court\s+(?:for\s+)?(?:the\s+)?)?"
    r"(?:(Northern|Southern|Eastern|Western|Central|Middle)\s+)?"
    r"District\s+of\s+(?:the\s+)?(.+)$",
    re.IGNORECASE,
)


def _is_initial_abbr(abbr: str) -> bool:
    """True if abbreviation starts with an initial (X.), indicating close-up spacing."""
    return len(abbr) >= 2 and abbr[1] == "."


def _normalize_district(raw: str) -> str | None:
    """Try to normalize as a federal district court abbreviation."""
    m = _DISTRICT_RE.match(raw.strip())
    if not m:
        return None

    direction_word = m.group(1)
    state_name = m.group(2).strip().rstrip(".")

    state_abbr = _STATE_ABBR.get(state_name.lower())
    # Territories like "District of Columbia" parse as state_name="Columbia";
    # fall back to the full territory name in the lookup.
    if not state_abbr and not direction_word:
        state_abbr = _STATE_ABBR.get(f"district of {state_name}".lower())
    if not state_abbr:
        return None

    if direction_word:
        dir_abbr = _DIRECTION_MAP[direction_word.lower()]
        dist = f"{dir_abbr}D."
    else:
        dist = "D."

    if _is_initial_abbr(state_abbr):
        return f"{dist}{state_abbr}"
    return f"{dist} {state_abbr}"


# ── 2e. Main court normalizer ─────────────────────────────────────────────────

def normalize_court(raw: str) -> str:
    """Normalize a court string to its canonical Bluebook abbreviation.

    Resolution: circuit pattern -> district pattern -> CA alias -> T7 lookup -> passthrough.
    """
    s = raw.strip()
    if not s:
        return s

    result = _normalize_circuit(s)
    if result:
        return result

    result = _normalize_district(s)
    if result:
        return result

    low = s.lower()
    if low in _T7_FULL_TO_ABBR:
        return _T7_FULL_TO_ABBR[low]

    return s


# ══════════════════════════════════════════════════════════════════════════════
# 3. DERIVED FIELDS (isScotus, jurisdiction)
# ══════════════════════════════════════════════════════════════════════════════

REPORTER_JURISDICTION: dict[str, str] = {
    # SCOTUS
    "U.S.": "SCOTUS", "S. Ct.": "SCOTUS", "L. Ed.": "SCOTUS",
    "L. Ed. 2d": "SCOTUS", "U.S.L.W.": "SCOTUS",
    # Federal circuit
    "F.": "Circuit", "F.2d": "Circuit", "F.3d": "Circuit", "F.4th": "Circuit",
    "F. App'x": "Circuit", "F. Cas.": "Circuit",
    "M.J.": "Circuit", "C.M.A.": "Circuit", "C.M.R.": "Circuit",
    "Vet. App.": "Circuit",
    # Federal district / trial
    "F. Supp.": "District", "F. Supp. 2d": "District", "F. Supp. 3d": "District",
    "F.R.D.": "District", "B.R.": "District",
    "Fed. Cl.": "District", "Cl. Ct.": "District", "Ct. Cl.": "District",
    "Cust. Ct.": "District", "Ct. Int'l Trade": "District", "T.C.": "District",
    "B.T.A.": "District",
    # Regional / state
    **{r: "State" for r in (
        "A.", "A.2d", "A.3d",
        "N.E.", "N.E.2d", "N.E.3d",
        "N.W.", "N.W.2d",
        "P.", "P.2d", "P.3d",
        "S.E.", "S.E.2d",
        "S.W.", "S.W.2d", "S.W.3d",
        "So.", "So. 2d", "So. 3d",
        "Cal. Rptr.", "Cal. Rptr. 2d", "Cal. Rptr. 3d",
    )},
}


def _jurisdiction_from_court(court: str | None) -> str:
    """Infer jurisdiction from court abbreviation when reporter is unknown."""
    if not court:
        return "Unknown"
    if re.search(r"\bCir\.", court):
        return "Circuit"
    if re.search(r"\b[NSEWCM]\.D\.", court) or re.search(r"\bD\.\s", court):
        return "District"
    if re.search(r"\bBankr\.", court):
        return "District"
    if re.search(
        r"\bCt\. App\b|\bApp\. Ct\b|\bApp\. Div\b|\bSup\. Ct\b"
        r"|\bSuper\. Ct\b|\bDist\. Ct\b",
        court,
    ):
        return "State"
    return "Unknown"


def derive_jurisdiction(reporter: str | None, court: str | None) -> str:
    """Derive jurisdiction from reporter (preferred) or court (fallback)."""
    if reporter:
        j = REPORTER_JURISDICTION.get(reporter)
        if j:
            return j
    return _jurisdiction_from_court(court)


# ══════════════════════════════════════════════════════════════════════════════
# 4. PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

def normalize(parsed: ParseResponse) -> ParseResponse:
    """Run all deterministic normalization on a ParseResponse.

    Order matters: reporter first (isScotus/jurisdiction depend on it),
    then court, then derived booleans, then T6 on case name.
    """
    if parsed.reporter:
        parsed.reporter = normalize_reporter(parsed.reporter)
    if parsed.court:
        parsed.court = normalize_court(parsed.court)
    parsed.isScotus = (parsed.reporter or "") in SCOTUS_REPORTERS
    parsed.jurisdiction = derive_jurisdiction(parsed.reporter, parsed.court)
    if parsed.caseName:
        parsed.caseName = t6_abbreviate(parsed.caseName)
    return parsed


def normalize_fields(fields: dict) -> dict:
    """Run all deterministic normalization on a plain dict of citation fields.

    Used in the generate path where ParseResponse has been merged with
    user-confirmed edits into a raw dict.
    """
    if fields.get("reporter"):
        fields["reporter"] = normalize_reporter(fields["reporter"])
    if fields.get("court"):
        fields["court"] = normalize_court(fields["court"])
    reporter = fields.get("reporter") or ""
    fields["isScotus"] = reporter in SCOTUS_REPORTERS
    fields["jurisdiction"] = derive_jurisdiction(reporter, fields.get("court"))
    if fields.get("caseName"):
        fields["caseName"] = t6_abbreviate(fields["caseName"])
    return fields
