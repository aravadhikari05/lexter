# Formatter Test Progress

`backend/tests/test_deterministic_formatter.py` — 214 total tests across 4 classes

Run: `cd backend && pytest tests/test_deterministic_formatter.py -v`

> **Note:** xfail counts may be inaccurate — some xfail flags could be wrong (test marked as expected-fail but formatter already handles it correctly, or vice versa). The score table tracks what actually runs; the xfail breakdown is best-effort.

---

## Current Score

| Date | Passed | XFailed | Failed |
|---|---|---|---|
| 2026-04-06 (baseline) | 106 | 108 | 0 |
| 2026-04-06 (typeface fix) | 142 | 72 | 0 |
| 2026-04-06 (procedural phrases) | 146 | 68 | 0 |
| 2026-04-06 (pincite variants) | 152 | 62 | 0 |
| 2026-04-06 (state reporter-implies) | **158** | **56** | **0** |

---

## What's Fixed

### Typeface (R2.1(a) vs B2)
`academicFull` now uses roman case names (no `<em>`); `fullCitation` keeps `<em>`.
- **36 tests flipped from xfail → passing**
- Changed: `_format_published`, `_format_unpublished`, `_format_electronic_db` in `formatter.py`

---

## Remaining XFails (72)

### ~~Procedural Phrases~~ — FIXED
`_italicize_procedural()` added to `formatter.py`. Wraps `In re`, `Ex parte`, `ex rel.` in `<em>` for `academic_full` only. 4 tests flipped.

---

### ~~Pincite Variants~~ — FIXED
The formatter already handled these correctly — the xfail flags in the fixture were wrong. 6 flags flipped to False. No formatter changes needed.

---

### ~~State Court Reporter-Implies~~ — FIXED
`_MULTI_COURT_REPORTERS` frozenset added; `_format_published` now requires `court` only when reporter is in that set. Year-only parenthetical when `court` is empty. 6 tests flipped.

---

### Parenthetical Extensions — 8 academic + 5 full xfails
Schema gaps — formatter ignores unknown fields:
- `weight_multiple` (academic + full) — schema only supports one `weightParenthetical`
- `quoting_parenthetical` (academic + full) — no `quotingParenthetical` schema field
- `citing_parenthetical` (academic + full) — no `citingParenthetical` schema field
- `three_layer_order` (academic + full) — needs quoting + weight + explanatory
- `nested_quoting_in_explanatory` (academic + full) — nested quoting

**Fix:** Add `quotingParenthetical`, `citingParenthetical`, and support for multiple weight parens to schema + formatter.

---

### Subsequent History — 30 xfails (14 academic + 14 full + 2 short)
All 14 history tests require a `history` list field not yet in the schema. The formatter has no history support.
- `history_affd`, `history_affd_mem`, `history_revd`, `history_revd_other_grounds`, `history_rev_en_banc`, `history_vacated`, `history_cert_denied`, `history_overruled_by`, `history_abrogated_by`, `history_sub_nom`, `history_same_year`, `history_multiple_and`, `history_after_explanatory`, `history_chain`
- Also: `typeface_history_phrase_italic` (academic + full)

**Fix:** Add `history: list[dict]` to `ParseResponse`. Implement history rendering in formatter (append `, <em>phrase</em>, cite (court year)` after main citation).

---

### Electronic DB Edge Cases — 6 xfails (academic + full + short each)
- `elec_db_multiple_star_pages` — pincite `"*1, *3"` rendered as `at **1, *3` (double asterisk)
- `elec_db_multiple_dockets` — formatter prepends `No.` to a value already starting with `Nos.`

**Fix:** Detect `*` prefix in pincite for star pages; detect `Nos.` prefix in docket to skip the `No.` prepend.

---

### Short Form Party Selection — 3 short xfails
- `short_reno_rule` — `Reno` is a government official surname not in `_GOV_TERMS`; should use `Bossier Parish Sch. Bd.`
- `short_ex_rel_use_relator` — `NAACP v. Alabama ex rel. Patterson` should use `Patterson`, not `NAACP`
- `short_long_party_name_truncated` — `Youngstown Sheet & Tube Co.` should shorten to `Youngstown`

**Fix:** Extend `_GOV_TERMS` or add logic for government officials; parse `ex rel.` to extract relator; allow unambiguous shortening of long party names.

---

### Other — 3 xfails
- `parallel_citation` (academic + full + short) — dual reporter not supported
- `case_name_popular_name` (academic + full) — `popularName` schema gap
- `case_name_ex_rel` short — short form should use relator name

---

## Recommended Fix Order

| Priority | Fix | XFails resolved |
|---|---|---|
| 1 | **Procedural phrases** (`In re`, `Ex parte`, `ex rel.` → italic in academic) | ~4 |
| 2 | **Pincite variants** (footnote `n.`, range digit-drop, passim) in short form | ~6 |
| 3 | **State reporter-implies** (allow empty court for implicit jurisdiction) | ~6 |
| 4 | **Short form party selection** (Reno rule, ex rel. relator, long name truncation) | ~3 |
| 5 | **Electronic DB edge cases** (star pages, multiple dockets) | ~6 |
| 6 | **Parenthetical schema** (quoting, citing, multiple weight parens) | ~10 |
| 7 | **Subsequent history** (schema + formatter) — biggest scope | ~30 |
| 8 | **Popular name / parallel citation** | ~5 |
