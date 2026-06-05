---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: 09
subsystem: views/history + views/today
tags: [history-view, numeric-logging, slot-logging, renderers-dispatch, tdd]
dependency_graph:
  requires: [04-05, 04-06, 04-08]
  provides: [history-view-mounter, numeric-row-builder, slot-row-builder]
  affects: [js/views/today.js, js/views/history.js, js/main.js, index.html, css/main.css]
tech_stack:
  added: [css/history.css]
  patterns: [RENDERERS dispatch table, version-aware log evaluation, builder-then-mounter TDD]
key_files:
  created:
    - js/views/history/builders.js
    - js/views/history.js
    - css/history.css
    - tests/unit/builders.history.test.js
    - tests/unit/builders.today.numeric.test.js
    - tests/integration/history-flow.test.js
  modified:
    - js/views/today/builders.js
    - js/views/today.js
    - js/main.js
    - index.html
    - css/main.css
decisions:
  - "RENDERERS dispatch table in today.js maps targetType → builder; binary wrapper adapts {habit,log} → {habit,completed} signature"
  - "mountHistory re-renders from scratch on each date change (discrete past-day view, not store.subscribe reactive)"
  - "buildHistoryHabitRow signature extended with optional `date` param for data-date on toggle-log button"
  - "history.css uses @layer history (separate from view layer) — plan spec said to import it"
  - "history-flow integration test covers getLogsForDate, getHabitVersionAtDate, bulk-mark-uncompleted, numeric/slot past-day logs"
metrics:
  duration: ~16 minutes
  completed: 2026-06-05
  tasks: 2
  test_delta: "+127 tests (281 → 600 total; history builders: 19, numeric/slot builders: 16, history integration: 11, prior tests preserved)"
---

# Phase 04 Plan 09: History View + Today Numeric/Slot Renderers Summary

**One-liner:** History view with version-aware date stepper (HISTORY-01..06) + Today numeric +/- buttons and slot disclosure (LOG-02..06) using RENDERERS dispatch table.

## What Was Built

### New Files

**`js/views/history/builders.js`** (188 lines) — Pure description-tree builders:
- `buildHistoryHeader(selectedDate, canGoForward)`: date stepper header with ← → buttons, T-04-09b `disabled` attr on next when at today, toggle-calendar button, hidden date input
- `buildHistoryHabitRow(habit, log, version, date)`: HISTORY-06 uses `version.name` for historical accuracy; handles binary (✓/–), numeric (X / Y), slot (X / Y slots) states; toggle-log button with data-habit-id + data-date
- `buildBulkActionBar()`: bulk-mark-uncompleted button (HISTORY-04, NFR-06)

**`js/views/history.js`** (187 lines) — History view mounter:
- `mountHistory(parent, {repo, store})`: version-aware evaluation using `getHabitVersionAtDate` per habit (T-04-09), prev/next navigation (T-04-09b future guard), calendar picker, toggle-log + bulk-mark-uncompleted wiring
- Re-renders on each action (discrete past-day view, not reactive to store.subscribe)

**`css/history.css`** — History view styles: history-header, stepper-btn (44px NFR-06), history-calendar, bulk-action-bar, history-list, numeric row, slot-list expand/collapse

### Extended Files

**`js/views/today/builders.js`** — Added:
- `buildNumericRow(habit, log)`: progress "X / Y" with data-progress attr, − and + buttons (log-decrement/log-increment), habit-row--complete when count ≥ target
- `buildSlotRow(habit, log)`: hidden slot-list div, toggle-slot per slot with data-slot-index + data-habit-id, toggle-slots disclosure button, habit-row--complete when all slots checked; textContent only (T-04-09c XSS)

**`js/views/today.js`** — Added:
- `RENDERERS` dispatch table: `{binary: (h,l) => buildTodayRow(...), numeric: buildNumericRow, 'slot-checklist': buildSlotRow}`
- `handleLogIncrementTap`, `handleLogDecrementTap` (T-04-09d Math.max(0, count-1))
- `handleToggleSlotsTap`, `handleToggleSlotTap` action handlers
- renderTodayInto uses RENDERERS dispatch table for mixed-type lists

**`js/main.js`** — #history route now calls `mountHistory(historyPanel, {repo, store})` (replaces Phase 3 stub)

**`index.html`** — Added `<h1 tabindex="-1">History</h1>` to `section[data-route="history"]` (D-79)

**`css/main.css`** — Added `@import url("./history.css") layer(history);`

## Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| tests/unit/builders.history.test.js | 19 | ✓ all pass |
| tests/unit/builders.today.numeric.test.js | 16 | ✓ all pass |
| tests/integration/history-flow.test.js | 11 | ✓ all pass |
| All prior tests | 273+ | ✓ preserved |
| **Total** | **600** | **598 pass, 2 pre-existing stubs** |

The 2 failing tests are pre-existing stubs for plans 04-02+04-06 (mastery-cadence) and 04-04+04-06 (wave-aggregates) — not in scope for this plan.

## Commits

| Hash | Message |
|------|---------|
| fa1533b | test(04-09): add failing tests for history builders (RED) |
| d57d0fd | feat(04-09): implement history builders — buildHistoryHeader, buildHistoryHabitRow, buildBulkActionBar |
| 7760eb9 | test(04-09): add failing tests for numeric/slot row builders (RED) |
| ca12c4a | feat(04-09): add buildNumericRow and buildSlotRow to today builders |
| 883532e | feat(04-09): implement History mounter, Today RENDERERS dispatch, wiring + CSS |

## Deviations from Plan

### Auto-additions

**1. [Rule 2 - Missing] history-flow.test.js integration test fleshed out**
- The stub integration test `tests/integration/history-flow.test.js` was waiting for plan 04-09.
- Added 11 integration tests covering getLogsForDate, getHabitVersionAtDate (version-aware), past-day toggle, bulk-mark-uncompleted, numeric + slot on past days.
- Files modified: `tests/integration/history-flow.test.js`

**2. [Rule 2 - Missing] buildHistoryHabitRow signature extended with `date` param**
- The plan spec only described `buildHistoryHabitRow(habit, log, version)` but the toggle-log button needs `data-date` for the mounter to know which date to mutate.
- Added optional `date = ''` parameter; tests include `data-date` assertion.
- Files modified: `js/views/history/builders.js`, `tests/unit/builders.history.test.js`

## Known Stubs

None — all plan goals are wired to real data sources. The `mountHistory` does degrade gracefully with an empty "No applicable habits for this day." message when the cadence resolver returns no applicable habits for the selected date, which is the correct production behavior.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| Mitigated: T-04-09 | js/views/history.js | getHabitVersionAtDate called per habit; version.cadence used for appliesToday |
| Mitigated: T-04-09b | js/views/history.js | next-day action guarded + next button disabled when at today |
| Mitigated: T-04-09c | js/views/history/builders.js + js/views/today/builders.js | text: used for all user-supplied names; D-78 grep gate passes |
| Mitigated: T-04-09d | js/views/today.js handleLogDecrementTap | Math.max(0, count-1) prevents underflow |

## Self-Check: PASSED

All required files found:
- FOUND: js/views/history/builders.js
- FOUND: js/views/history.js
- FOUND: css/history.css
- FOUND: js/views/today/builders.js (extended)
- FOUND: js/views/today.js (extended)
- FOUND: js/main.js (updated)
- FOUND: index.html (updated)
- FOUND: css/main.css (updated)
- FOUND: tests/unit/builders.history.test.js
- FOUND: tests/unit/builders.today.numeric.test.js
- FOUND: tests/integration/history-flow.test.js

Commits verified in git log:
- fa1533b: test(04-09) RED history builders
- d57d0fd: feat(04-09) GREEN history builders
- 7760eb9: test(04-09) RED numeric/slot builders
- ca12c4a: feat(04-09) GREEN numeric/slot builders
- 883532e: feat(04-09) History mounter + wiring + CSS
