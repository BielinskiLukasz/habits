---
phase: 13-code-review-documentation
plan: 03
subsystem: docs
tags: [qa-02, decisions, i18n, 4-state-log]
requires: [13-01-SUMMARY.md]
provides: [D-43 enriched, D-44 added, QA-02 satisfied]
affects: [.planning/PROJECT.md]
actuals:
  tasks: 2
  files: 1
  tests_before: 876
  tests_after: 876
  deviations: 2
duration: ~300s
---

# Plan 13-03 Summary — QA-02 Documentation (D-43 + D-44)

## What Was Done

**Task 1** — Enriched D-43 row in PROJECT.md Key Decisions table with four additional rationale points:
- Absence-as-undefined simplifies query logic
- `markUncompleted` → `status:'failed'` (not delete) preserves streak and undo
- Backwards-compat normalization in `import.js` for legacy `completed:boolean` backup files
- Stale-caller hotfix context (Plan 13-01, 2026-09-08)

**Task 2** — Added D-44 row for EN/PL i18n architecture immediately after D-43.

## D-44 Content (as documented)

- Flat ES module exports, no namespace nesting, no `Intl.*`
- `t(key, subs)` with `{name}` single-brace placeholders, English-first fallback
- `localStorage` key `'habits-lang'` for locale preference (null-safe in Node/SW via `typeof` guard)
- `location.reload()` on language change (not BroadcastChannel)

## Deviations from Plan

- **D-13-03-01**: Plan specified IDB `settings` store + key `habitLanguage` for D-44 locale persistence. Actual implementation (verified in `js/i18n/index.js`) uses `localStorage` key `'habits-lang'`. D-44 documents the actual implementation.
- **D-13-03-02**: Plan specified `{{var}}` double-brace placeholder format for D-44. Actual `t()` uses `{name}` single-brace. D-44 documents the actual implementation.

## Verification

```
grep -c "absence-as-undefined|phantom rows" .planning/PROJECT.md  → 1
grep -c "stale-caller hotfix" .planning/PROJECT.md                → 1
grep -c "D-44" .planning/PROJECT.md                               → 1
grep -c "habits-lang" .planning/PROJECT.md                        → 1
```

## Commit

- `52d510c` — `docs(project): enrich D-43 and add D-44 for i18n architecture (QA-02)`
