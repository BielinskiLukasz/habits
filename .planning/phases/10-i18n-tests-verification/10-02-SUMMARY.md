---
phase: 10-i18n-tests-verification
plan: "02"
subsystem: i18n
tags: [i18n, locale, catalog, en, pl, I18N-02]
status: complete
completed: "2026-08-31"

dependency_graph:
  requires: [10-01-SUMMARY.md]
  provides: [js/i18n/en.js, js/i18n/pl.js, js/views/catalog.js]
  affects: [10-03-PLAN.md]

tech_stack:
  added: []
  patterns: [t() locale lookup, namespace-based key organisation]

key_files:
  created: []
  modified:
    - js/i18n/en.js
    - js/i18n/pl.js
    - js/views/catalog.js

decisions:
  - All 37 new locale keys added to en.js and pl.js in a single authoring pass, eliminating locale-file conflicts for 10-03
  - catalog.js fully adopted t() for all 12 user-visible string sites; zero hardcoded strings remain

requirements:
  - I18N-02

metrics:
  duration_seconds: 2433
  completed: "2026-08-31"
  tasks: 2
  commits: 2

estimate:
  tokens: 130000
  tasks: 2

actuals:
  tokens: 9500
  tasks: 2
  commits: 2
---

# Phase 10 Plan 02: Add Locale Keys and Fix catalog.js Summary

**One-liner:** Added 37 new i18n keys across five namespaces to en.js/pl.js and fully adopted t() in catalog.js, replacing all 12 hardcoded string sites.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add all new locale keys to en.js and pl.js (I18N-02) | a45d252 | js/i18n/en.js, js/i18n/pl.js |
| 2 | Fix catalog.js — add t() import and replace 12 hardcoded string sites | 43dce49 | js/views/catalog.js |

## What Was Built

### Task 1 — Locale Key Expansion (37 keys)

Added 37 new keys across five namespaces to both `js/i18n/en.js` and `js/i18n/pl.js`:

| Namespace | Keys Added | Examples |
|-----------|-----------|---------|
| catalog | 11 | empty, errorArchive, errorCreate, listAriaLabel, upcomingHeading |
| history | 4 | errorMark, errorSkip, nextDay, prevDay |
| settings | 12 | errorExportCsv, errorImport, errorRecompute, errorWeekStart |
| toast | 2 | dismiss, errorUndo |
| today | 7 | errorMark, errorSkip, listAriaLabel, markedComplete, markedUncomplete |

Every key in en.js has a matching Polish translation in pl.js. Both @file JSDoc comments updated to list the new namespaces.

### Task 2 — catalog.js i18n Adoption

`js/views/catalog.js` now imports `{ t }` from `../i18n/index.js`. All 12 previously-hardcoded string sites replaced:

| Site | Before | After |
|------|--------|-------|
| Stage label placeholder | `'Stage label'` | `t('catalog.stagePlaceholder')` |
| Stage target placeholder | `'Target (optional)'` | `t('catalog.stageTargetPlaceholder')` |
| Habit list aria-label | `'Habit catalog'` | `t('catalog.listAriaLabel')` |
| Empty state text | `'No habits yet. Tap "New habit" to create one.'` | `t('catalog.empty')` |
| Upcoming heading | `'Upcoming'` | `t('catalog.upcomingHeading')` |
| Upcoming list aria-label | `'Upcoming habits'` | `t('catalog.upcomingAriaLabel')` |
| Archive error toast | `"Couldn't archive habit — try again"` | `t('catalog.errorArchive')` |
| Restore error toast | `"Couldn't restore habit — try again"` | `t('catalog.errorRestore')` |
| Promote error toast | `"Couldn't promote habit — try again"` | `t('catalog.errorPromote')` |
| Advance stage error toast | `"Couldn't advance stage — try again"` | `t('catalog.errorAdvanceStage')` |
| Save error toast | `"Couldn't save habit — try again"` | `t('catalog.errorSave')` |
| Create error toast | `"Couldn't create habit — try again"` | `t('catalog.errorCreate')` |

## Verification Results

- `node --test tests/unit/i18n.test.js`: 17/17 pass
- `grep -c "catalog.empty" js/i18n/en.js`: 1
- `grep -c "catalog.empty" js/i18n/pl.js`: 1
- `grep -c "today.markedComplete" js/i18n/en.js`: 1
- `grep -c "today.markedComplete" js/i18n/pl.js`: 1
- `grep -c "toast.dismiss" js/i18n/en.js`: 1
- `grep -c "toast.dismiss" js/i18n/pl.js`: 1
- `grep -c "import { t } from '../i18n/index.js'" js/views/catalog.js`: 1
- Full test suite: 803/830 pass (27 pre-existing failures in store.hydrate unrelated to this plan)

## Deviations from Plan

### Pre-existing Test Failures (out of scope)

27 tests in `tests/unit/store.hydrate.test.js` and related suites were already failing before this plan's changes. Confirmed by running the test suite against the pre-task state — identical failure count (803 pass / 27 fail). These failures are out of scope for this plan and not caused by any change in Plan 10-02.

### Grep Pattern Nuance

The acceptance criterion `grep -c "import.*{ t" js/views/catalog.js returns 1` counts 2 on this codebase because `{ todayLocal }` also matches the pattern `{ t`. The functionally correct check `grep -c "import { t } from '../i18n/index.js'" js/views/catalog.js` returns 1, confirming the import is correct and unique.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All locale values assigned via `textContent` (never `innerHTML`), consistent with D-78 and T-10-03 accepted disposition.

## Known Stubs

None.

## Self-Check: PASSED

- js/i18n/en.js modified and contains 37 new keys: FOUND
- js/i18n/pl.js modified and contains 37 matching Polish translations: FOUND
- js/views/catalog.js modified with t() import and 12 string replacements: FOUND
- Commit a45d252 (locale keys): FOUND
- Commit 43dce49 (catalog.js fix): FOUND
