---
plan: 12-02
phase: 12-swipe-ux-navigation-verification
subsystem: today-view + history-view
status: complete
tasks_complete: 2
tasks_total: 2
self_check: PASSED
tags: [visual-states, swipe, log-cycle, history-view, today-view]
key-decisions:
  - isFailed branch inserted between isCompleted and isSkipped in buildTodayRow
  - Glyph spans use text: property — no innerHTML (D-78 compliant)
  - history.js reads repo.getLog for arbitrary-date status (cache only holds current week)
  - null return from nextLogState maps to markUncompleted (idempotent safe default)
metrics:
  duration_seconds: 420
  completed_date: "2026-09-01"
actuals:
  tokens: 8000
  tasks: 2
  commits: 2
---

# Phase 12 Plan 02: Failed/Skipped Visuals + History Swipe Cycle Summary

**One-liner:** today/builders.js gains ✕/↷ glyphs and today-row--failed CSS class; history.js swipe-right now cycles all 4 log states via repo.getLog + nextLogState.

## What Was Built

Updated `js/views/today/builders.js` — `buildTodayRow` gains an `isFailed` const, a `✕` glyph span for failed state, a `↷` glyph span for skipped state (skipped previously had no glyph), and pushes `today-row--failed` into rowClasses when status is 'failed'. All glyph spans use the `text:` property — no `.innerHTML` (D-78).

Added `--color-failed-bg: rgba(239, 68, 68, 0.12)` to `css/tokens.css` following the existing score color naming convention.

Added `.today-row--failed { background: var(--color-failed-bg); }` and `.today-row--failed .today-row-name { opacity: 0.75; }` to `css/today.css`, parallel to the existing completed/skipped modifier patterns.

Updated `js/views/history.js` — added `import { nextLogState } from '../domain/logStatus.js'`; replaced the unconditional `apply({ type: 'markCompleted' })` in the dx > 60 branch with a `repo.getLog(habitId, selectedDate)` chain that reads the current status, calls `nextLogState`, derives the correct event type (markCompleted / markFailed / markSkipped / markUncompleted), and dispatches it. The dx < -60 branch (left-swipe actions panel) is untouched (D-02).

## Tasks Completed

### Task 1: Add failed/skipped visual indicators to today/builders.js and CSS

- Status: Complete
- Commit: 5031cdb — feat(12-02): add failed/skipped visuals to today/builders.js
- Files: js/views/today/builders.js, css/tokens.css, css/today.css
- Verification: node --test "tests/**/*.test.js" — 941 tests, 0 failures

### Task 2: Wire history.js swipe-right to use nextLogState

- Status: Complete
- Commit: f2c3326 — feat(12-02): wire history.js swipe-right to cycle 4 log states
- Files: js/views/history.js
- Verification: node --test "tests/**/*.test.js" — 941 tests, 0 failures

## Decisions / Deviations

None — plan executed exactly as written. The PATTERNS.md code blocks were followed precisely for both builders.js extension and the history.js repo.getLog chain.

## Self-Check

### Must-Haves Verified

- today/builders.js shows '✕' glyph for failed state — confirmed in source (text: '✕')
- today/builders.js shows '↷' glyph for skipped state — confirmed in source (text: '↷')
- today/builders.js applies 'today-row--failed' CSS class — confirmed (rowClasses.push)
- css/tokens.css defines '--color-failed-bg' — confirmed (rgba(239, 68, 68, 0.12))
- css/today.css has '.today-row--failed' rule — confirmed with background + opacity
- history.js imports nextLogState from '../domain/logStatus.js' — confirmed line 32
- history.js uses repo.getLog to read current status — confirmed in handleSwipeEnd
- history.js dispatches markCompleted/markFailed/markSkipped/markUncompleted — confirmed
- today/builders.js does not use .innerHTML — confirmed (D-78 compliant)
- history.js dx < -60 branch unchanged — confirmed (left-swipe panel intact, D-02)

### Key Artifacts

- js/views/today/builders.js — modified, exports buildTodayRow with isFailed + glyphs
- css/tokens.css — --color-failed-bg token added
- css/today.css — .today-row--failed rule added
- js/views/history.js — imports nextLogState, handleSwipeEnd cycles 4 states via repo.getLog

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes introduced. The repo.getLog null/undefined return coerces to currentStatus null, which nextLogState maps to 'markCompleted' (first cycle step) — safe default per T-12-04 mitigation.

## Self-Check: PASSED
