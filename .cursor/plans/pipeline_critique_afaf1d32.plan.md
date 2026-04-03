---
name: Pipeline Critique
overview: A critical review of the 10-step citation pipeline, identifying architectural risks to the 99.9% accuracy / zero-hallucination goal, with prioritized recommendations.
todos:
  - id: deterministic-formatter
    content: "P0: Build deterministic_formatter.py with string templates for all three citation formats (academicFull, fullCitation, shortForm) for cases"
    status: pending
  - id: courtlistener-api
    content: "P0: Implement CourtListener API integration in citation_lookup.py to replace LLM-based data enrichment"
    status: pending
  - id: validation-layer
    content: "P1: Build structural + cross-field validation (regex patterns, balanced HTML, reporter/court consistency, year range)"
    status: completed
  - id: split-parse-normalize
    content: "P1: Split citation_parser into raw extraction (LLM) + deterministic normalization (T6/T1/T7 lookups, isScotus, jurisdiction)"
    status: pending
  - id: unverified-llm-enrichment
    content: "P2: Demote LLM enrichment to 'unverified' status with UI indication and mandatory user confirmation"
    status: completed
  - id: fix-had-missing
    content: "P2: Fix had_missing recomputation bug in chat.py after enrich_parsed runs"
    status: pending
  - id: cleanup-dead-code
    content: "P3: Remove unused COMMON_REPORTERS regex, dead history branch in rule_lookup.py, duplicate schemas"
    status: pending
isProject: false
---

# Pipeline Critique: Bluebook Case Citation Generator

## Overall Assessment

The pipeline structure is sound -- the instinct to push every decision that *can* be deterministic out of the LLM is exactly right. But three areas currently undercut the 99.9% accuracy target:

1. **Step 9 (Format)** is still LLM-based despite being entirely rule-governed.
2. **Step 6 (Data Retrieval)** uses LLM "parametric recall" as its only live data source -- the single biggest hallucination vector.
3. **Step 10 (Validate)** doesn't exist yet, so there's no safety net.

---

## Step-by-Step Critique

### Steps 1-2: Intent + Source Type (UI) -- No Issues

Clean and deterministic. Nothing to change.

---

### Step 3: Rule Retrieval Phase 1 -- Low Value in Current State

`get_general_rules("case")` loads `[b10_cases.md](Bluebook/Bluepages/b10_cases.md)`, which is a 6-line index with links. This gives the parser almost no useful context.

**Recommendations:**

- For the *parser*, the most useful rule content isn't B10 prose -- it's **recognition patterns**: what reporters look like, how courts are abbreviated, what the parts of a citation are. Consider either (a) loading the actual content of `b10_1_full_citation.md` at parse time too, or (b) writing a concise "parser cheat sheet" that lists the structural patterns the LLM should look for, separate from the full Bluebook prose.
- Don't load Tables T1/T6/T7 into the LLM context for parsing -- they're too large. Instead, use them in a **deterministic post-processing** step (see Step 4 below).

---

### Step 4: Extract Fields (LLM) -- Good, But LLM Does Too Much

`[citation_parser.py](backend/app/services/citation_parser.py)` asks the LLM to both **extract** raw fields AND **normalize** them (apply T6 case name abbreviations, T1 reporter abbreviations, decide `isScotus`, determine `jurisdiction`). Bundling extraction and normalization means the LLM can silently mis-abbreviate and you'd never know.

**Recommendations:**

- **Split extraction from normalization.** Have the LLM extract *raw* fields (verbatim from input), then apply deterministic post-processing:
  - `isScotus`: trivially deterministic -- `reporter in {"U.S.", "S. Ct.", "L. Ed.", "L. Ed. 2d"}`
  - `jurisdiction`: deterministic from reporter/court (T1 lookup table)
  - Case name abbreviation (T6): a dictionary-based find-and-replace on the raw `caseName`
  - Reporter normalization (T1): match raw reporter string against a canonical list
  - Court abbreviation (T7): same approach
- This makes the LLM's job simpler (just "what did the user literally say?"), reduces hallucination surface, and lets you unit-test each normalization rule independently.
- `isScotus` is already checked in `[missing_fields.py](backend/app/services/missing_fields.py)` downstream, but the **parse prompt still asks the LLM to decide it**. Unify this.

---

### Step 5: Missing Field Detection -- Solid

`[missing_fields.py](backend/app/services/missing_fields.py)` is well-structured and correctly overrides the LLM's guesses. Two minor issues:

- `COMMON_REPORTERS` (the compiled regex on lines 5-14) is **defined but never referenced** -- only the `known` set inside `_looks_suspicious_reporter` is used. Dead code, should be removed or unified.
- The `.+\.` fallback in that unused regex would match *any* string containing a period -- it wouldn't be useful even if the regex were referenced.

---

### Step 6: Data Retrieval -- Highest Hallucination Risk

This is the most dangerous step for accuracy. `[_enrich_via_llm](backend/app/services/citation_lookup.py)` asks the LLM to *guess* missing citation metadata (volume, reporter, page, court, year). This is pure parametric recall -- the model is reciting from training data. For well-known cases it may be right; for anything obscure, it will confidently hallucinate.

**Recommendations (priority order):**

1. **Implement CourtListener immediately.** The stub is already in place. Their free API (`/api/rest/v3/search/?q=...&type=o`) returns structured case data. This should be the **primary** enrichment path.
2. **Demote LLM enrichment to "unverified" status.** If CL returns nothing, the LLM can suggest values, but they should be:
  - Always routed through `needsConfirmation` (never silently accepted)
  - Visually marked in the UI as "unverified / AI-suggested"
  - Never used to generate a final citation without user confirmation
3. **Fix the `had_missing` bug in `[chat.py](backend/app/api/routes/chat.py)` (around line 82).** After `enrich_parsed` runs, `had_missing` is never recomputed. So even if enrichment fills every field, the user still gets a ConfirmBubble. This is actually a *safe* failure (over-confirming), but it should be intentional, not accidental. Re-evaluate `missingFields` after enrichment and show the confirm bubble when appropriate.

---

### Step 7: Build Citation Object -- No Issues

Deterministic merge logic. Clean.

---

### Step 8: Rule Retrieval Phase 2 -- Gaps

`[get_specific_rules](backend/app/services/rule_lookup.py)` in `rule_lookup.py` loads B10.1.1-1.3, conditionally 1.4 and 1.6. Issues:

- **B10.1.5** (weight of authority / explanatory parentheticals) is never loaded. If you ever support parentheticals, this will be needed.
- **B10.1.6 is dead code.** It triggers on `parsed["history"]`, but `ParseResponse` has no `history` field. Either add the field or remove the branch.
- **No Whitepages rules loaded.** The academic citation format (`academicFull`) is governed by Whitepages Rule 10, not Bluepages B10. Bluepages is for practitioner documents. If you're generating both academic and practitioner formats, you should be loading the appropriate rule set for each.
- **No table content injected.** T1 (jurisdictions), T6 (case names), T7 (court names) are critical for correct formatting. These should be used deterministically (see Step 9), not injected as LLM context.
- **Broken cross-links.** Bluepages markdown links to `../Tables/...` but the actual files are under `Bluebook/Whitepages/`. Not a runtime issue (links aren't followed by code), but misleading if you ever build link-following.

**Recommendation:** For the immediate scope (cases only), phase 2 rule retrieval matters less if you make Step 9 deterministic. The rules are only needed as LLM context *because* the LLM is formatting. A deterministic formatter encodes the rules directly.

---

### Step 9: Format Citation (LLM) -- Should Be Fully Deterministic

This is the step with the most room for improvement. `[GENERATE_SYSTEM](backend/app/core/prompts.py)` in `prompts.py` (line 76) instructs the LLM to produce three formatted citation strings. But Bluebook case formatting is **entirely template-driven** with zero ambiguity:

**Published case templates:**

```
academicFull:  <sc>{caseName}</sc>, {volume} {reporter} {firstPage} ({court} {year}).
               (omit {court} if SCOTUS reporter)

fullCitation:  <em>{caseName}</em>, {volume} {reporter} {firstPage} ({court} {year}).
               (omit {court} if SCOTUS reporter)

shortForm:     <em>{firstParty}</em>, {volume} {reporter} at {firstPage}.
```

There is no reason for an LLM to be in this loop. A deterministic formatter:

- Is faster (no API call)
- Is free (no token cost)
- Is 100% reproducible
- Can be unit-tested exhaustively
- Eliminates an entire class of hallucination (wrong punctuation, extra spaces, missing periods, wrong HTML tags)

**Recommendation:** Build a `deterministic_formatter.py` that takes a `ParseResponse` and returns `GenerateResponse` using string templates. Handle the known variants:

- Published vs. unpublished (Lexis/Westlaw cite format for unpublished)
- SCOTUS vs. non-SCOTUS (court parenthetical inclusion)
- State cases with parallel citations

Keep the LLM formatter as a temporary fallback during the transition, but the goal should be to remove it entirely for cases.

---

### Step 10: Validate -- Critical, Not Started

Without validation, every upstream error propagates to the user. This is the safety net for 99.9%.

**Recommended validation layers (in order of implementation priority):**

1. **Structural validation (deterministic):**
  - Final string matches expected regex pattern for each format
  - Periods, commas, parentheses are correctly placed
  - HTML tags are balanced (`<em>` closed, `<span class="sc">` closed)
  - No double spaces, no trailing/leading whitespace anomalies
2. **Cross-field validation (deterministic):**
  - If reporter is "U.S." / "S. Ct." / "L. Ed.", court parenthetical must be absent
  - If court is present, it must be a valid T7 abbreviation
  - Reporter must be in T1
  - Year must be a plausible 4-digit number (1600-2026)
  - Volume must be numeric (for standard reporters)
3. **Source verification (API, optional):**
  - Given the final citation string, query CourtListener to confirm it resolves to a real case
  - If it doesn't match, flag for user review
4. **LLM-as-judge (last resort):**
  - Only if deterministic checks pass but you want an extra layer
  - Show the LLM the final citation + the raw fields and ask "does this look correct?"
  - This is the weakest layer and should not be relied on alone

---

## Priority Ranking for Reaching 99.9%


| Priority | Action                                                  | Impact on Accuracy                                      |
| -------- | ------------------------------------------------------- | ------------------------------------------------------- |
| **P0**   | Build deterministic formatter (Step 9)                  | Eliminates formatting hallucinations entirely           |
| **P0**   | Implement CourtListener (Step 6)                        | Eliminates data hallucinations for cases CL knows about |
| **P1**   | Build structural + cross-field validation (Step 10)     | Catches any remaining errors before output              |
| **P1**   | Split extraction from normalization (Step 4)            | Reduces parse errors, makes them testable               |
| **P2**   | Demote LLM enrichment to "unverified" (Step 6)          | Prevents silent hallucination when CL has no data       |
| **P2**   | Fix `had_missing` recomputation (Step 6)                | Correct confirm flow after enrichment                   |
| **P3**   | Build T6/T1/T7 lookup tables as code (Step 4/9)         | Enables deterministic abbreviation                      |
| **P3**   | Remove dead code (`COMMON_REPORTERS`, `history` branch) | Code clarity                                            |


---

## Architectural Principle

The guiding principle for 99.9% accuracy should be: **the LLM should only do what humans also find ambiguous** -- interpreting messy natural language input. Everything downstream of "I understood what the user meant" should be deterministic code.

Currently, the LLM is used in three places:

1. **Parsing raw input** -- legitimate LLM use (NLP)
2. **Filling in missing data** -- should be an API call, not LLM recall
3. **Formatting the citation** -- should be a string template, not LLM generation

The end state should be: LLM for step 1 only, deterministic code for everything else, with CourtListener as the data source and validation as the safety net.