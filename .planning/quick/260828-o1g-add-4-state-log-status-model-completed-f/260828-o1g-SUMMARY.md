---
phase: quick
plan: 260828-o1g
subsystem: log-model,today-view,history-view,scoring,export
tags: [log-status, 4-state, swipe-ux, migration, scoring]
status: complete

requires: []
provides: [4-state-log-status]
affects: [db/schema, state/apply, domain/scoring, domain/mastery, io/export, views/today, views/history]

tech_stack:
  added: []
  patterns: [4-state-status-field, swipe-gesture-pointer-events, idb-cursor-migration]

key_files:
  created:
    - js/state/apply/markSkipped.js
  modified:
    - js/db/schema.js
    - js/state/apply/markCompleted.js
    - js/state/apply/markUncompleted.js
    - js/state/apply.js
    - js/domain/scoring.js
    - js/domain/mastery.js
    - js/io/export.js
    - js/i18n/en.js
    - js/i18n/pl.js
    - js/views/today/builders.js
    - js/views/today.js
    - css/today.css
    - js/views/history/builders.js
    - tests/unit/scoring.test.js
    - tests/unit/mastery.test.js
    - tests/unit/export.csv.test.js
    - tests/unit/schema.test.js
    - tests/unit/builders.today.test.js
    - tests/unit/builders.history.test.js

decisions:
  - id: D-o1g-01
    summary: Replace completed:boolean with status:'completed'|'failed'|'skipped'|null on log rows; IDB migration uses cursor callbacks (no async/await in upgrade transaction per IDB spec)
  - id: D-o1g-02
    summary: markSkipped does NOT update habit.lastCompletedDate (D-52); only markCompleted/markUncompleted maintain that denormalized field
  - id: D-o1g-03
    summary: Skipped days excluded from S1/S2/S3 denominators so they do not penalize scores
  - id: D-o1g-04
    summary: Swipe UX — right (dx>60) marks complete, left (dx<-60) reveals Skip/Fail panel 120px wide; pointer events on listEl with setPointerCapture; touch-action:pan-y on slide for vertical scroll coexistence

metrics:
  duration: ~90min
  completed: 2026-08-28
  tasks: 3
  commits: 3

actuals:
  tokens: 62000
  tasks: 3
  commits: 3
---

# Quick Task 260828-o1g: Add 4-State Log Status Model — Summary

**One-liner:** Replace `completed: boolean` with `status: 'completed'|'failed'|'skipped'|null` across DB, state, domain, export, and both views.

## What Was Built

### Task 1 — Core data model (commit `05229ba`)

- **DB migration:** `DB_VERSION` bumped to 2; `MIGRATIONS[2]` iterates all `logs` rows via IDB cursor and converts `completed: true` → `status: 'completed'`, `completed: false` → `status: 'failed'`, missing → `status: null`. Used raw `onsuccess` chain callbacks — no async/await inside the upgrade transaction (IDB spec constraint).
- **`markSkipped` handler** (`js/state/apply/markSkipped.js`): new handler writing `status: 'skipped'`; registered in `HANDLERS` dispatch table in `apply.js`.
- **`markCompleted`** updated: writes `status: 'completed'` (was `completed: true`).
- **`markUncompleted`** updated: writes `status: 'failed'` (was `completed: false`); filter uses `status === 'completed'`.
- **Scoring (`scoring.js`):** `LOG_COMPLETED.binary` checks `log.status === 'completed'`; skipped days (`status === 'skipped'`) excluded from S1/S2/S3 denominators.
- **Mastery (`mastery.js`):** `LOG_COMPLETED.binary` updated to `status === 'completed'`.
- **CSV export (`export.js`):** binary branch: `skipped` → `x`, `completed` → `1`, otherwise `0`.
- **i18n:** Added `today.skip`, `today.fail`, `today.skipped`, `today.failed` keys to EN and PL bundles.
- **Tests updated:** scoring, mastery, export.csv, schema tests all updated for new status-based fixtures.

### Task 2 — Today view swipe UX (commit `1e351f1`)

- **`builders.js`:** `buildTodayRow` accepts `status` (not `completed`); emits `.today-row__slide` wrapper and `.today-row__actions` sibling with Skip (`swipeSkip`) and Fail (`swipeFail`) buttons.
- **`today.js`:** Module-level `_openSwipeRow`, `_swipeEl`, `_swipeStartX` tracking for one-at-a-time panel management. Pointer event handlers (`handleSwipeStart/Move/End/Cancel`) attached to `listEl`. `_closeOpenSwipeRow()` snaps slide back. `handleMarkSkipTap` dispatches `markSkipped`; `handleMarkFailTap` dispatches `markUncompleted` (status→'failed'). All `log.completed` references updated to `log.status`.
- **`css/today.css`:** `.today-row` clips with `overflow:hidden; position:relative`. `.today-row__slide` translates on swipe with `will-change:transform; touch-action:pan-y`. `.today-row__actions` positioned absolutely at right. `.today-row__action--skip` uses `--color-score-watch`; `--fail` uses `--color-score-failing`. No literal hex codes.
- **Tests updated:** `builders.today.test.js` — all fixtures use `status` param; tests navigate through `.today-row__slide`; new tests for actions panel.

### Task 3 — History display (commit `beb23e7`)

- **`history/builders.js`:** Both `buildHistoryHabitRow` (editable) and `buildHistoryReadOnly` binary branches updated: `log.completed === true` → `log.status === 'completed'`.
- **Tests updated:** `builders.history.test.js` — four fixtures updated: `{ completed: true }` → `{ status: 'completed' }`, `{ completed: false }` → `{ status: 'failed' }`.

## Test Results

All 139 unit tests pass (0 failures):
- `builders.history.test.js` — all tests pass after fixture updates
- `builders.today.test.js` — 21 tests pass including new swipe/actions tests
- `scoring.test.js`, `mastery.test.js`, `export.csv.test.js`, `schema.test.js` — all pass

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `js/views/history/builders.js` — exists, both `log.completed` references replaced
- `js/state/apply/markSkipped.js` — exists (created in Task 1)
- Commits verified: `05229ba`, `1e351f1`, `beb23e7` all present in git log
- 139/139 tests pass
