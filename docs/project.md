# Lexter — Citation Pipeline Reference

Court case citation generation flow. Bluebook 22nd edition.

This document describes the **current implementation** of the create-citation pipeline for court cases, step by step. Each step includes the code that implements it, what it does, and suggestions for improvement.

---

## Pipeline Overview

```
User Input ─> LLM Triage ─> Extract & Post-Process ─> CourtListener ─> User Confirmation ─> Normalize ─> Format ─> Validate ─> Output
```

| Step | Name | Type | Entry Point |
|------|------|------|-------------|
| 1 | Collect input | UI | `SourceSelector.tsx`, `InputBox.tsx` |
| 2 | LLM triage | LLM | `chat.py:stream_chat` |
| 3 | Extract & post-process fields | LLM + Deterministic | `parser.py:parse_citation` |
| 4 | CourtListener cross-validation | External API | `lookup.py:cross_validate` |
| 5 | User confirmation | UI | `ConfirmBubble.tsx` |
| 6 | Normalize confirmed fields | Deterministic | `normalizer.py:normalize_fields` |
| 7 | Format citation | Deterministic (LLM fallback) | `generator.py:generate_citation` |
| 8 | Validate | Deterministic | `validator.py:validate_citation` |

---

## Step 1: Collect Input

**Type:** UI
**Files:** `frontend/src/components/SourceSelector.tsx`, `frontend/src/components/InputBox.tsx`, `frontend/src/App.tsx`

The user selects an intent (`create`, `validate`, `explain`) and source type (`case`, `statute`, etc.) via pill buttons in `SourceSelector`. Only `case` is currently active — all other source types are disabled. The user types or pastes their input (case name, raw citation, or file text) into `InputBox`.

On submit, `App.tsx:send()` bundles the input with the last 10 messages as history and sends a `POST /chat/stream` request:

```json
{
  "message": "Brown v. Board of Education",
  "history": [...],
  "intent": "create",
  "source_type": "case"
}
```

**Schema:** `ChatRequest` in `backend/app/schemas/chat.py`

### Improvements

- File upload reads the first 4000 chars (`App.tsx:181`) with no format detection. Could validate file type and give feedback if the file doesn't contain recognizable legal text.
- The intent and source type are separate UI rows but are tightly coupled — selecting "create" + "statute" is a dead path. Could disable invalid combinations or merge into a single selector.

---

## Step 2: LLM Triage

**Type:** LLM
**Files:** `backend/app/api/routes/chat.py:stream_chat`, `backend/app/core/prompts.py:build_chat_system`

The backend builds a system prompt via `build_chat_system(intent, source_type)` that instructs the LLM to decide: does this message contain a recognizable legal source?

- If **yes**: the LLM responds with a short sentence and a trigger token `%%PROCEED::<raw input verbatim>%%`
- If **no** (greetings, vague messages): the LLM responds conversationally, tokens are streamed to the frontend, and the pipeline ends

The LLM call uses `stream()` with `max_tokens=200`. The full response is buffered, then checked for the `%%PROCEED::` token. If found, the raw input is extracted and the pipeline continues to step 3.

**Prompt:** `PARSE_SYSTEM` is not used here — triage uses a separate lightweight prompt from `build_chat_system()`.

### Improvements

- **This step is redundant for the `create` intent.** The user already explicitly selected "Create Citation" + "Court Case" and typed input. The LLM triage adds ~1-2s latency to decide something the user already told us. For `create`, skip triage and go straight to step 3. Reserve triage for ambiguous intents or a future auto-detect mode.
- The `%%PROCEED::` token extraction (`full.split("%%PROCEED::")[1].split("%%")[0]`) is fragile — if the LLM doesn't close with `%%`, the raw input captures everything after the token. Consider a more robust delimiter or structured response.
- The step ticker during triage ("Thinking") is a single step that covers the entire LLM call. Accurate, but could be removed if triage itself is removed.

---

## Step 3: Extract & Post-Process Fields

**Type:** LLM + Deterministic
**Files:** `backend/app/services/parser.py`, `backend/app/core/prompts.py:PARSE_SYSTEM`, `backend/app/utils/normalizer.py:normalize`, `backend/app/utils/missing_fields.py:check_missing_fields`, `backend/app/services/lookup.py:mark_auto_filled`, `backend/app/utils/rule_lookup.py:get_parser_rules`

This is the core extraction step. It has four sequential sub-steps that always run together:

### 3a: LLM Field Extraction

`parse_citation()` loads Bluebook rule bundles via `get_parser_rules(tags)` and appends them to the `PARSE_SYSTEM` prompt, then calls `complete()` with `temperature=0`.

**Tiered rule bundle system:** The triage step (step 2) now classifies the input and emits `%%TAGS::...%%` alongside `%%PROCEED::%%`. Tags are parsed by `parse_triage_output()` in `chat.py` and passed to `parse_citation()`. `get_parser_rules(tags)` in `rule_lookup.py` selects and combines condensed rule bundles from `Bluebook/Condensed/`:

| Bundle | Tags | ~Tokens | Content |
|--------|------|---------|---------|
| `base_case.md` | Always | ~5,200 | B10.1.1 case names, Rule 10.2, full T6 table |
| `published_case.md` | `published`, `scotus` | ~3,900 | B10.1.2-3 reporters/courts, Rules 10.3-10.4, full T7 table |
| `unpublished_case.md` | `unpublished`, `electronic_database` | ~1,900 | B10.1.4 slip opinions/e-db, Rule 10.8.1 |
| `parenthetical_case.md` | `parenthetical` | ~1,100 | B10.1.5, Rule 10.6 weight/explanatory |
| `history_case.md` | `history` | ~1,950 | B10.1.6, Rule 10.7, full T8 table |

**Tags emitted by triage:** `published`, `unpublished`, `electronic_database` (mutually exclusive) plus additive `scotus`, `parenthetical`, `history`. Defaults to `["published"]` if no tags emitted. Typical request: ~9,100 tokens of rule context (base + published).

The LLM returns JSON with structured fields:

```json
{
  "caseName": "Brown v. Board of Education",
  "volume": "347",
  "reporter": "U.S.",
  "firstPage": "483",
  "court": null,
  "year": "1954",
  "isUnpublished": false,
  "missingFields": [],
  "needsConfirmation": ["volume", "reporter", "firstPage", "year"]
}
```

For well-known cases, the LLM infers fields from training data. Inferred fields go in `needsConfirmation`, not `missingFields`.

**Schema:** `ParseRequest` -> `ParseResponse` in `backend/app/schemas/citation.py`

### 3b: Deterministic Normalization

`normalize(parsed)` in `normalizer.py` runs four normalizations in order:

1. **Reporter (T1):** `normalize_reporter()` — exact match -> full-name alias -> compressed fuzzy match -> passthrough. Canonical set of ~60 reporters. Handles variations like "Federal Reporter Third Series" -> "F.3d".
2. **Court (T7):** `normalize_court()` — circuit pattern -> district pattern -> CourtListener alias -> T7 full-name lookup -> passthrough. Handles "Ninth Circuit" -> "9th Cir.", "Northern District of California" -> "N.D. Cal.", etc.
3. **Derived fields:** `isScotus` set from reporter membership in `SCOTUS_REPORTERS`. `jurisdiction` derived from reporter (preferred) or court (fallback).
4. **Case name (T6):** Title-cases the name, then applies T6 abbreviations via `t6_abbreviator.py`. Multi-word phrases matched first ("United States" -> "U.S."), then single words ("Education" -> "Educ.").

### 3c: Missing Field Check

`check_missing_fields(parsed)` in `missing_fields.py` overrides the LLM's `missingFields` and `needsConfirmation` lists with a strict deterministic check:

- `caseName` and `year` always required
- Published cases require `volume`, `reporter`, `firstPage`
- Non-SCOTUS cases require `court`
- Unpublished cases require `docket` and `fullDate`
- Suspicious values (non-numeric volume, non-4-digit year, unknown reporter) get added to `needsConfirmation`

### 3d: Auto-Fill Tracking

`mark_auto_filled(parsed, raw_input)` in `lookup.py` compares each tracked field (`volume`, `reporter`, `firstPage`, `court`, `year`) against the raw input via substring matching. Fields whose values don't appear in the user's text are marked in `autoFilled[]`.

### Improvements

- **T6 abbreviation runs too early.** The user sees abbreviated names like "Bd. of Educ." in the confirm bubble (step 5) instead of "Board of Education". Defer T6 to step 6 (post-confirmation) so the user confirms what they recognize.
- **Auto-fill detection is fragile.** `str(val).lower() not in raw_lower` is simple substring matching. "347" in "case from 1347" would be a false negative. "U.S." won't match "United States". Consider having the LLM report which fields it inferred directly (it already tracks `needsConfirmation`, which largely overlaps), or use token-level provenance.
- **The step ticker during this phase is cosmetic.** `chat.py:58-82` emits "Extracting case name", "Identifying reporter", "Resolving fields" with `asyncio.sleep()` spacers, but the LLM extracts all fields in a single call. Either make it honest (one "Parsing" step) or break extraction into real stages.
- **No retry on malformed JSON.** If `safe_json()` fails, the error propagates with no recovery. Could retry the LLM call once, or return a structured error with partial fields.

---

## Step 4: CourtListener Cross-Validation

**Type:** External API
**Files:** `backend/app/services/lookup.py:cross_validate`, `backend/app/api/routes/chat.py:85-90`

Queries the CourtListener REST API (`/api/rest/v4/search/`) with `caseName + volume` to verify and correct LLM-extracted fields.

Flow:
1. Skip if `caseName` or `volume` is missing
2. Search CourtListener with combined query, `page_size=3`
3. Pick the highest-scoring result
4. Sanity check: does the CL result's volume match the LLM's volume? If not, wrong case — abort
5. If verified, overwrite `reporter`, `firstPage`, `court`, `year` with CL values
6. Clear `needsConfirmation` for CL-verified fields (they're now trusted)
7. `autoFilled` is intentionally NOT cleared — the badge always shows for fields the user didn't provide

**Court mapping:** `CL_COURT_MAP` maps CourtListener court IDs (e.g., `"ca9"`) to Bluebook abbreviations (e.g., `"9th Cir."`). ~50 federal courts covered.

**Error handling:** Non-fatal. If CL is down or returns nothing, the code catches the exception and proceeds with LLM values (`chat.py:88-89: except: pass`).

**Timeout:** 8 seconds via `httpx.AsyncClient(timeout=8)`.

### Improvements

- **Blocks the critical path.** The 8s timeout means the user can wait up to 8s between parsing and confirmation with no feedback. Consider showing the confirm bubble immediately with LLM values, then updating fields in-place when CourtListener responds. Or run CL in parallel with some post-processing.
- **No caching.** Identical queries (same case, same session or across sessions) hit the API every time. A short-TTL cache keyed on `(caseName, volume)` would reduce latency and API load.
- **Court map coverage.** `CL_COURT_MAP` covers ~50 federal courts. State courts, bankruptcy courts, and specialty courts are not mapped — CL results for those cases won't update the court field.
- **Sanity check is volume-only.** `_is_same_case()` only compares volume numbers. Two different cases can share a volume in the same reporter. Could additionally check that the case name has meaningful overlap.
- **SCOTUS handling.** When `CL_COURT_MAP` maps a court to `None` (SCOTUS), the court field is not updated. This is correct for SCOTUS (no court parenthetical), but the mapping silently drops it — worth a comment or explicit handling.

---

## Step 5: User Confirmation

**Type:** UI
**Files:** `frontend/src/components/ConfirmBubble.tsx`, `frontend/src/App.tsx:runConfirm`

The backend emits an SSE `confirm` event with the full `ParseResponse`. The frontend renders a `ConfirmBubble` showing all extracted fields in an editable form:

- **Row 1:** Case Name (full width)
- **Row 2:** Volume, Reporter, First Page
- **Row 3:** Court (hidden for SCOTUS), Year, Pincite
- **Row 4:** Weight Parenthetical, Explanatory Parenthetical

Fields in `autoFilled[]` get a "FILLED IN" badge and a distinct border color. The user can edit any field. Edits are tracked in `pendingEdits` state (not merged into `pendingParsed` until confirm).

On confirm, `runConfirm()` merges `pendingParsed` with `pendingEdits` and sends `POST /chat/confirm`:

```json
{
  "parsed": { ...merged fields },
  "source_type": "case"
}
```

### Improvements

- **No field-level validation before confirm.** The user can confirm nonsensical values (year "abcd", empty case name) with no warning. Cross-field consistency checks (e.g., reporter/court mismatch, year outside reporter's publication range) should run before the user confirms, not after generation.
- **T6-abbreviated case names are confusing.** Users see "Bd. of Educ." instead of "Board of Education" because normalization ran in step 3. Deferring T6 to step 6 would show the recognizable name here.
- **Confirmation is always required.** Even when all fields came from CourtListener (high confidence, no `needsConfirmation`, no `missingFields`), the user must manually confirm. Could auto-confirm or show a lighter "quick confirm" UI when confidence is high.
- **No cancel/back.** Once the confirm bubble appears, the user can only confirm or start a new message. There's no explicit "this is the wrong case" action that would let them re-enter input without starting over.
- **`pendingEdits` uses `defaultValue`.** The input fields use uncontrolled `defaultValue`, so React doesn't re-render them if `pendingParsed` is updated (e.g., by a late CourtListener response). Would need controlled inputs for async field updates.

---

## Step 6: Normalize Confirmed Fields

**Type:** Deterministic
**Files:** `backend/app/services/generator.py:17-20`, `backend/app/utils/normalizer.py:normalize_fields`

After confirmation, the backend merges `parsed` with user edits and re-runs normalization via `normalize_fields()`:

1. Reporter normalization (T1)
2. Court normalization (T7)
3. Derive `isScotus` and `jurisdiction`
4. T6 case name abbreviation

This is the same logic as step 3b but applied to a plain dict (user edits may have introduced non-canonical values).

### Improvements

- **This step exists because normalization ran too early.** If T6 and normalization were deferred to here (not run in step 3b), this would be the only normalization pass. The pre-confirmation normalization in step 3b is only needed for `isScotus` and `jurisdiction` (which affect the confirm bubble layout and the missing-field check). A lighter pre-confirm pass that only derives booleans — without T6 — would eliminate the redundancy.
- **Reporter/court re-normalization is usually a no-op.** If the user didn't edit those fields, normalization produces the same result as step 3b. Could skip normalization for unchanged fields.

---

## Step 7: Format Citation

**Type:** Deterministic with LLM fallback
**Files:** `backend/app/services/generator.py:generate_citation`, `backend/app/services/formatter.py:format_case`, `backend/app/utils/rule_lookup.py:get_specific_rules`

Two-tier formatting approach:

### 7a: Deterministic Formatter (Primary)

`format_case()` in `formatter.py` handles three case types:

**Published cases (B10.1.1-B10.1.3):**
```
<em>Brown v. Bd. of Educ.</em>, 347 U.S. 483 (1954).
```
- Requires: `caseName`, `volume`, `reporter`, `firstPage`, `year`
- SCOTUS: year-only parenthetical `(1954)`
- Non-SCOTUS: court + year `(9th Cir. 2023)`
- Parentheticals appended per Rule 10.6.4: `(weight) (explanatory)`

**Unpublished slip opinions (B10.1.4):**
```
<em>Doe v. Smith</em>, No. 22-1234 (S.D.N.Y. Jan. 15, 2023).
```
- Requires: `caseName`, `docket`, `court`, `fullDate`
- Raises `FormatterError` if `fullDate` is missing

**Electronic database cases (B10.1.4(i)):**
```
<em>Doe v. Smith</em>, No. 22-1234, 2023 WL 12345 (S.D.N.Y. Jan. 15, 2023).
```
- Requires: `caseName`, `docket`, `dbIdentifier`, `court`, `fullDate`

**Short form (Rule 10.9):**
- Uses `_pick_short_party()` to select party name
- If first party is a government entity (United States, State, People, any US state name, etc.), uses the second party
- Published: `<em>Brown</em>, 347 U.S. at 483.`
- Unpublished: `<em>Doe</em>, slip op. at 5.`

### 7b: LLM Fallback

If `format_case()` raises `FormatterError`, falls back to `_generate_via_llm()`:

1. Loads context-specific Bluebook rules via `get_specific_rules()` (sections B10.1.1-B10.1.3, optionally B10.1.4 for unpublished)
2. Strips metadata fields (`missingFields`, `needsConfirmation`, `isUnpublished`, etc.) from the input
3. Calls `complete()` with `GENERATE_SYSTEM` prompt + rules + field JSON
4. Parses the response as `GenerateResponse`
5. Runs `sanitize_output()` to fix double spaces and whitespace

**Output schema:** `GenerateResponse` with `academicFull`, `shortForm`, `fullCitation`, `rulesUsed`

### Improvements

- **Unpublished cases always fall to LLM** when `fullDate` is missing. Instead of silently falling back, prompt the user for `fullDate` in the confirm step (step 5) when `isUnpublished` is true and `fullDate` is empty.
- **Non-case source types have no deterministic path.** `generator.py:22` guards the formatter with `if source_type == "case"`. Statutes, regulations, etc. go straight to LLM. `rule_lookup.py:13` has a TODO for this. Statutes are highly templatable and should get a deterministic formatter next.
- **LLM fallback uses the same model.** The generation LLM call uses the same model and temperature as parsing. For formatting (a more constrained task), a smaller/faster model or higher temperature might be acceptable.
- **`get_specific_rules()` is only implemented for cases.** Returns empty string for all other source types.
- **The formatter doesn't handle subsequent history (B10.1.6).** The schema has a `history` check in `get_specific_rules()` but `ParseResponse` has no `history` field.

---

## Step 8: Validate

**Type:** Deterministic
**Files:** `backend/app/services/validator.py:validate_citation`

Three validation layers run on the formatted output:

### 8a: Structural Validation

Checks each of `academicFull`, `fullCitation`, `shortForm`:

- Not empty
- No double spaces
- No leading/trailing whitespace
- Ends with a period
- Balanced HTML tags (`<em>`/`</em>`)
- Contains `<em>...</em>` (italicized case name)
- Full citations contain a year parenthetical

### 8b: Cross-Field Validation

Checks the input fields (not the formatted output):

- SCOTUS reporter must not have a court parenthetical
- Non-SCOTUS published cases must have a court
- Reporter must be in `KNOWN_REPORTERS` set (~55 reporters)
- Court must be in `KNOWN_COURTS` set (~130 courts)
- Year must be a 4-digit number in range 1600 to current year + 1
- Volume must be numeric for published cases

### 8c: Output-vs-Fields Consistency

Spot-checks that key field values appear in the formatted text:

- Case name appears in `academicFull` and `fullCitation`
- Volume, reporter, first page appear in `academicFull` and `fullCitation` (published cases only)

### Output

Returns `ValidationResult` with `errors` (hard failures) and `warnings` (advisory). Both are attached to `GenerateResponse.validationWarnings` and surfaced in the frontend's `CitationCards` component as a collapsible warning panel.

### Improvements

- **Validation has no teeth.** Errors and warnings are both attached as `validationWarnings`. The citation is always returned regardless of errors. A citation with unbalanced HTML or a missing period ships to the user. Distinguish hard errors (block output or auto-fix) from warnings (show to user).
- **`sanitize_output()` already fixes some issues** (double spaces, whitespace) but doesn't fix terminal periods or simple HTML issues. Extend it to auto-fix structural errors that the validator catches.
- **Cross-field validation runs too late.** Reporter/court consistency, suspicious years, and volume format could be checked in step 5 (before confirmation) to catch issues before generation. Currently the user gets a formatted citation with a warning buried in a collapsible panel.
- **No validation of short form correctness.** The validator checks structural properties but doesn't verify that the short form uses the correct party name or the correct "at" page.
- **Warning UX is easy to miss.** Warnings are in a collapsed accordion at the bottom of `CitationCards`. Users can copy the citation without ever seeing them. Consider surfacing errors more prominently or inline.

---

## Data Flow Diagram

```
Frontend                          Backend
────────                          ───────

SourceSelector
  intent: "create"
  source: "case"
      │
InputBox ──── POST /chat/stream ────────> build_chat_system()
  message                                     │
  history                                  LLM triage
                                              │
                                    %%PROCEED:: detected?
                                      │              │
                                     NO             YES
                                      │              │
                                  stream          parse_citation()
                                  tokens             │
                                      │         ┌────┴────────────────┐
                                      │     get_general_rules()      │
                                      │         │                    │
                                      │     LLM complete()           │
                                      │         │                    │
                                      │     normalize()              │
                                      │         │                    │
                                      │     check_missing_fields()   │
                                      │         │                    │
                                      │     mark_auto_filled()       │
                                      │         └────┬───────────────┘
                                      │              │
                                      │     cross_validate() [CourtListener]
                                      │              │
                                SSE: token     SSE: confirm
                                      │              │
                                      ▼              ▼
                                  text bubble    ConfirmBubble
                                                     │
                                              user edits + confirm
                                                     │
                               POST /chat/confirm ◄──┘
                                      │
                              normalize_fields()
                                      │
                              format_case() ──── FormatterError? ──> _generate_via_llm()
                                      │                                      │
                                      └──────────────┬───────────────────────┘
                                                     │
                                            validate_citation()
                                                     │
                                               SSE: citation
                                                     │
                                                     ▼
                                              CitationCards
                                          [academic | short | practitioner]
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Main state, chat stream handling, confirm flow |
| `frontend/src/components/SourceSelector.tsx` | Intent + source type selection |
| `frontend/src/components/InputBox.tsx` | Text input + file upload |
| `frontend/src/components/ConfirmBubble.tsx` | Field review + edit + confirm |
| `frontend/src/components/CitationCards.tsx` | Final citation display (3 tabs) |
| `frontend/src/components/StepTicker.tsx` | Progress step indicators |
| `frontend/src/types/index.ts` | TypeScript interfaces |
| `backend/app/api/routes/chat.py` | `/chat/stream` and `/chat/confirm` endpoints |
| `backend/app/api/routes/citation.py` | `/citation/parse` and `/citation/generate` endpoints |
| `backend/app/core/prompts.py` | System prompts (triage, parse, generate) |
| `backend/app/core/llm.py` | OpenRouter client, `complete()`, `stream()`, `safe_json()` |
| `backend/app/core/config.py` | Settings (API keys, model) |
| `backend/app/schemas/citation.py` | `ParseRequest`, `ParseResponse`, `GenerateRequest`, `GenerateResponse` |
| `backend/app/schemas/chat.py` | `ChatRequest`, `HistoryMessage` |
| `backend/app/services/parser.py` | LLM field extraction + post-processing |
| `backend/app/services/generator.py` | Two-tier citation generation |
| `backend/app/services/formatter.py` | Deterministic Bluebook formatter |
| `backend/app/services/validator.py` | Post-generation validation |
| `backend/app/services/lookup.py` | CourtListener cross-validation + auto-fill tracking |
| `backend/app/utils/normalizer.py` | T1 reporter, T7 court, T6 case name normalization |
| `backend/app/utils/t6_abbreviator.py` | Table T6 word-level abbreviation |
| `backend/app/utils/missing_fields.py` | Deterministic missing field checker |
| `backend/app/utils/rule_lookup.py` | Bluebook rule file loader; `get_parser_rules(tags)` for tiered bundle selection, `get_specific_rules()` for generator |
| `backend/Bluebook/` | Bluebook rule documentation (Bluepages + Whitepages) |
| `backend/Bluebook/Condensed/` | Condensed rule bundles for parser RAG (base_case, published_case, unpublished_case, parenthetical_case, history_case) |
