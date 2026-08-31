---
phase: 10-i18n-tests-verification
plan: "03"
subsystem: i18n
tags: [i18n, locale, today, toast, history, settings, I18N-02]
status: complete
completed: "2026-08-31"

dependency_graph:
  requires: [10-02-SUMMARY.md]
  provides: [js/views/today.js, js/views/toast.js, js/views/history.js, js/views/settings.js, js/views/history/builders.js]
  affects: [10-04-PLAN.md]

tech_stack:
  added: []
  patterns: [t() locale lookup, namespace-based key substitution with {placeholder}]

key_files:
  created: []
  modified:
    - js/views/today.js
    - js/views/toast.js
    - js/views/history.js
    - js/views/settings.js
    - js/views/history/builders.js
    - js/i18n/en.js
    - js/i18n/pl.js

decisions:
  - today.skippedToast and today.markedNotDone keys added to en.js/pl.js (undo toast messages not covered by Plan 10-02)
  - history.js undo toast messages use shared today.* keys (markedComplete, skippedToast, markedNotDone) per Task 2 plan guidance
  - settings.js "browser declined persistence" error consolidated into settings.errorPersistenceRequest key alongside the exception path

requirements:
  - I18N-02

metrics:
  duration_seconds: 1200
  completed: "2026-08-31"
  tasks: 2
  commits: 2

estimate:
  tokens: 160000
  tasks: 2

actuals:
  tokens: 12000
  tasks: 2
  commits: 2
---

# Phase 10 Plan 03: Fix Remaining View i18n (today.js, toast.js, history.js, settings.js, history/builders.js) Summary

**One-liner:** Added t() import to today.js and toast.js; replaced all hardcoded string sites across five view files using today, toast, history, and settings namespace keys.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix today.js and toast.js — add t() import and replace all hardcoded strings | b7664d8 | js/views/today.js, js/views/toast.js, js/i18n/en.js, js/i18n/pl.js |
| 2 | Fix history.js, settings.js, history/builders.js — replace hardcoded strings | 10c38dd | js/views/history.js, js/views/settings.js, js/views/history/builders.js |

## What Was Built

### Task 1 — today.js and toast.js i18n Adoption

**today.js** now imports `{ t }` from `../i18n/index.js`. All string replacement sites:

| Site | Before | After |
|------|--------|-------|
| listEl aria-label | `"Today's habits"` | `t('today.listAriaLabel')` |
| mark error (×5) | `"Couldn't mark — try again"` | `t('today.errorMark')` |
| skip error | `"Couldn't skip — try again"` | `t('today.errorSkip')` |
| update count error (×2) | `"Couldn't update count — try again"` | `t('today.errorUpdateCount')` |
| update slot error | `"Couldn't update slot — try again"` | `t('today.errorUpdateSlot')` |
| marked complete undo (×2) | `` `Marked ${habitName} complete` `` | `t('today.markedComplete', { name: habitName })` |
| marked uncomplete undo | `` `Marked ${habitName} uncomplete` `` | `t('today.markedUncomplete', { name: habitName })` |
| skipped undo | `` `Skipped ${habitName}` `` | `t('today.skippedToast', { name: habitName })` |
| not done undo | `` `Marked ${habitName} not done` `` | `t('today.markedNotDone', { name: habitName })` |

**toast.js** now imports `{ t }` from `../i18n/index.js`. Two string replacement sites:

| Site | Before | After |
|------|--------|-------|
| closeBtn aria-label | `'Dismiss'` | `t('toast.dismiss')` |
| undo error (×2) | `"Couldn't undo — try again"` | `t('toast.errorUndo')` |

### Task 2 — history.js, settings.js, history/builders.js i18n Adoption

**history/builders.js** (t() already imported): two aria-label sites replaced.

| Site | Before | After |
|------|--------|-------|
| prev-day aria-label | `'Previous day'` | `t('history.prevDay')` |
| next-day aria-label | `'Next day'` | `t('history.nextDay')` |

**history.js** (t() already imported): error toasts and undo toast messages replaced.

| Site | Before | After |
|------|--------|-------|
| swipe-right mark error | `"Couldn't mark — try again"` | `t('history.errorMark')` |
| swipe-skip error | `"Couldn't skip — try again"` | `t('history.errorSkip')` |
| swipe-fail error | `"Couldn't mark — try again"` | `t('history.errorMark')` |
| swipe-right undo | `` `Marked ${habitName} complete` `` | `t('today.markedComplete', { name: habitName })` |
| swipe-skip undo | `` `Skipped ${habitName}` `` | `t('today.skippedToast', { name: habitName })` |
| swipe-fail undo | `` `Marked ${habitName} not done` `` | `t('today.markedNotDone', { name: habitName })` |

**settings.js** (t() already imported): all 12 error toast sites replaced.

| Key Used | Original Literal |
|----------|-----------------|
| `settings.errorPersistenceUnsupported` | `'Storage persistence not supported'` |
| `settings.errorPersistenceRequest` (×2) | `'Browser declined persistence...'` + `"Couldn't request persistence"` |
| `settings.errorWeekStart` | `"Couldn't change week start — try again"` |
| `settings.errorUndo` | `"Couldn't undo — try again"` |
| `settings.errorMasteryThreshold` | `"Couldn't change mastery threshold — try again"` |
| `settings.errorMasteryWindow` | `"Couldn't change mastery window — try again"` |
| `settings.errorExportJson` | `'JSON export failed: ' + err.message` |
| `settings.errorExportCsv` | `'CSV export failed: ' + err.message` |
| `settings.errorImport` | `'Import failed: ' + err.message` |
| `settings.errorDismissNag` | `"Couldn't dismiss nag: " + err.message` |
| `settings.errorScoringModel` | `"Couldn't change scoring model — try again"` |
| `settings.errorRecompute` | `'Recompute failed: ' + err.message` |

## Verification Results

- `grep -c "import { t } from '../i18n/index.js'" js/views/today.js`: 1
- `grep -c "import { t } from '../i18n/index.js'" js/views/toast.js`: 1
- `grep -c "t('history.prevDay')" js/views/history/builders.js`: 1
- `grep -c "t('history.nextDay')" js/views/history/builders.js`: 1
- `grep -c "t('settings.errorExportJson" js/views/settings.js`: 1
- `node --test tests/unit/i18n.test.js`: 17/17 pass
- `node --test tests/unit/*.test.js`: 563/566 pass (3 pre-existing store.hydrate failures, unrelated)
- `grep -n "showErrorToast('" js/views/today.js js/views/toast.js js/views/history.js js/views/settings.js js/views/history/builders.js`: 0 results (zero hardcoded strings remain)

## Deviations from Plan

### Auto-added Missing Keys (Rule 2 — Missing Critical Functionality)

**[Rule 2 - i18n] Added today.skippedToast and today.markedNotDone locale keys**

- **Found during:** Task 1 implementation
- **Issue:** Plan 10-02 added today namespace keys covering errorMark, errorSkip, errorUpdateCount, errorUpdateSlot, listAriaLabel, markedComplete, and markedUncomplete — but not the "Skipped {name}" or "Marked {name} not done" undo toast messages used in today.js handleMarkSkipTap and handleMarkFailTap respectively. The must_haves truth "All showErrorToast and showUndoToast message literals in today.js route through t()" required covering these too.
- **Fix:** Added `today.skippedToast: 'Skipped {name}'` and `today.markedNotDone: 'Marked {name} not done'` to en.js with matching Polish translations in pl.js. Same keys reused in history.js for equivalent undo toast messages (per Task 2 plan guidance to use shared keys where appropriate).
- **Files modified:** js/i18n/en.js, js/i18n/pl.js
- **Commit:** b7664d8

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All locale values flow to `textContent` or `setAttribute` only — consistent with D-78 and T-10-05 accepted disposition. The {msg} substitution in settings error toasts puts err.message into a local-only toast per T-10-06 accepted disposition.

## Known Stubs

None.

## Self-Check: PASSED

- js/views/today.js modified with t() import and all string replacements: FOUND
- js/views/toast.js modified with t() import and all string replacements: FOUND
- js/views/history.js modified with t() replacements: FOUND
- js/views/settings.js modified with t() replacements: FOUND
- js/views/history/builders.js modified with t() replacements: FOUND
- js/i18n/en.js modified with 2 new keys: FOUND
- js/i18n/pl.js modified with 2 new keys: FOUND
- Commit b7664d8 (today.js + toast.js + locale keys): FOUND
- Commit 10c38dd (history.js + settings.js + builders.js): FOUND
