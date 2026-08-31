---
phase: 11
plan: "11-01"
subsystem: state/tests
tags: [bug-fix, test-alignment, 4-state-log-model]
status: complete

depends_on: []
provides: [zero-failing-tests, 4-state-status-model-consistency]
affects: [js/state/apply/logNumeric.js, js/state/apply/logSlot.js, js/state/store.js, tests/integration, tests/unit]

tech_stack:
  added: []
  patterns: [4-state-log-status-model, synthetic-row-status-field]

key_files:
  modified:
    - js/state/apply/logNumeric.js
    - js/state/apply/logSlot.js
    - js/state/store.js
    - tests/integration/apply.markCompleted.test.js
    - tests/integration/apply.markUncompleted.test.js
    - tests/integration/apply.lastCompletedDate.test.js
    - tests/integration/export.integration.test.js
    - tests/integration/mastery-cadence.test.js
    - tests/integration/history-flow.test.js
    - tests/integration/today.tap.test.js
    - tests/integration/toast.undo.test.js
    - tests/integration/import.integration.test.js
    - tests/unit/store.hydrate.test.js
    - tests/unit/views/desktop/analytics.builders.test.js

decisions:
  - "Synthetic D-52 rows in logNumeric and logSlot now carry status field (not completed boolean), matching the 4-state model contract"
  - "getCachedWeekCompletions checks status === 'completed' instead of completed === true"
  - "import.integration.test.js broadcastSpy changed from postMessage-object to callable function, matching import.js calling convention"
  - "analytics.builders.test.js At Risk label aligned to i18n key output (capital R, no hyphen)"

metrics:
  duration_seconds: 1363
  completed_date: "2026-08-31"
  tasks_completed: 15
  commits: 14

estimate:
  tokens: 40000

actuals:
  tokens: 38000
  tasks: 15
  commits: 14
---

# Phase 11 Plan 01: Fix 4-State Status Model Inconsistency Summary

**One-liner:** Aligned all source code and test fixtures from `completed: boolean` to `status: 'completed'|'failed'` across 14 files, eliminating all 29 failing tests.

## What Was Built

Tasks 1–3 fixed source code: two handlers passed synthetic log rows with `completed: boolean` to `_recomputeLastCompletedDate`, which filters on `l.status === 'completed'`. Both now pass `status: 'completed'|'failed'`. The `getCachedWeekCompletions` store function also checked `log.completed === true` which would never match logs written by `markCompleted`.

Tasks 4–14 fixed test files: twelve test files had stale assertions and fixtures using the old boolean model. The `import.integration.test.js` also had a broadcastSpy shaped as `{ postMessage }` rather than a callable function, causing a `TypeError` when `import.js` called `_broadcast(msg)` directly.

## Tasks Completed

| Task | File | Commit | Change |
|------|------|--------|--------|
| 1 | js/state/apply/logNumeric.js | 21745a6 | synthetic row: completed → status field |
| 2 | js/state/apply/logSlot.js | 4803d45 | synthetic row: completed → status field |
| 3 | js/state/store.js | 62e08fa | getCachedWeekCompletions: check status |
| 4 | apply.markCompleted.test.js | 882856b | assert status field |
| 5 | apply.markUncompleted.test.js | 04d6305 | 3 assertions + deepEqual shapes |
| 6 | apply.lastCompletedDate.test.js | f9e609a | assert status field |
| 7 | export.integration.test.js | 60a3723 | 2 fixtures + 1 assertion |
| 8 | mastery-cadence.test.js | bf775f6 | makeLogs helper uses status |
| 9 | history-flow.test.js | 0c5350c | 8 fixtures + 7 assertions |
| 10 | today.tap.test.js | e9d0608 | 1 fixture + 2 assertions |
| 11 | toast.undo.test.js | 687b5bd | 1 assertion |
| 12 | store.hydrate.test.js | 773b2b7 | 6 fixtures + 3 assertions + JSDoc |
| 13 | import.integration.test.js | aac37be | broadcastSpy → callable function |
| 14 | analytics.builders.test.js | 8b8dcd9 | At Risk label + Wave 1 text |
| 15 | Full suite verification | — | 910 pass, 0 fail |

## Verification

```
node --test "tests/**/*.test.js"
ℹ tests 910
ℹ pass 910
ℹ fail 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Scope clarification] Task 4 had 1 assertion, not 2**

The plan stated `apply.markCompleted.test.js` has 2 `assert.equal(log.completed, true)` assertions — one in the happy-path test and one in a "missing-habit defensive test". The defensive test was actually in `apply.lastCompletedDate.test.js` (correctly covered by Task 6). Only 1 assertion was changed in Task 4.

**2. [Rule 1 - Bug] analytics.builders.test.js fixture object keys**

The test fixtures passed `'At-risk'` as a key in `statusCounts`, which is the correct internal key the builder uses. The assertion text `'At-risk: 1'` was wrong — the builder runs the key through `t('desktop.status.atRisk')` which returns `'At Risk'` (capital R, space, no hyphen). Fixed per plan Task 14.

## Known Stubs

None — all changes are model-alignment fixes, no stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- All 14 source/test files exist and are modified
- All 14 task commits exist in git log
- Full suite: 910 pass, 0 fail
