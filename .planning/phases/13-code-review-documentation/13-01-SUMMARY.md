---
phase: 13-code-review-documentation
plan: 01
subsystem: domain/io/state
tags: [tdd, bug-fix, 4-state-log-model, wave-analytics, import, mark-skipped]
status: complete

dependency_graph:
  requires:
    - Phase 11 (4-state log model migration, D-02)
    - js/state/apply/markUncompleted.js (_recomputeLastCompletedDate export)
  provides:
    - Correct wave analytics for logs with status:'completed'
    - Legacy backup normalization on import (D-43)
    - Correct lastCompletedDate after marking a completed habit as skipped (D-52)
  affects:
    - js/domain/waveAggregates.js
    - js/io/import.js
    - js/state/apply/markSkipped.js

tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (D-23): failing test before any production change
    - _recomputeLastCompletedDate reuse pattern (markCompleted.js → markSkipped.js)
    - Normalization-by-copy: legacy import rows rewritten without mutating originals

key_files:
  created:
    - tests/unit/stale-boolean-bugs.test.js
  modified:
    - js/domain/waveAggregates.js
    - js/io/import.js
    - js/state/apply/markSkipped.js
    - tests/integration/apply.markSkipped.test.js
    - tests/unit/waveAggregates.test.js
    - tests/integration/wave-aggregates.test.js
    - tests/unit/import.test.js
    - tests/integration/import.integration.test.js

decisions:
  - D-43 applied: legacy {completed:boolean} rows normalized to {status:string} on import
  - D-52 extended: markSkipped now calls _recomputeLastCompletedDate when overwriting a completed log
  - makeLog/makeLogs test helpers updated to 4-state format (auto-fix, not a new decision)

metrics:
  duration: "~90 minutes"
  completed_date: "2026-09-08"
  tasks_completed: 3
  commits: 3

actuals:
  tokens: 71000
  tasks: 3
  commits: 3
---

# Phase 13 Plan 01: Stale-Boolean TDD Summary

Fix four stale-boolean callers that silently produced wrong data after the Phase 11
4-state log model migration (`completed: boolean` → `status: string`), confirmed by
RED tests before any production change.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | RED: Write failing tests proving stale-boolean bugs | `6d34560` | tests/unit/stale-boolean-bugs.test.js, tests/integration/apply.markSkipped.test.js |
| 2 | GREEN: Fix waveAggregates.js + import.js stale callers | `0f425ff` | js/domain/waveAggregates.js, js/io/import.js |
| 3 | GREEN: Fix markSkipped.js — recompute lastCompletedDate on completed-log overwrite | `8e73a80` | js/state/apply/markSkipped.js |

## What Was Fixed

**Bug A — waveAggregates._countForHabit** (line 44): checked `log.completed === true`
instead of `log.status === 'completed'`. Wave completion rates returned 0 for all logs
written after the Phase 11 migration.

**Bug B — waveAggregates streak walk-back** (line 198): same stale boolean check.
`longestStreak` and `currentStreak` returned 0 for all modern log rows.

**Bug C — import.js normalization** (line 130): rows imported from pre-4-state backup
files were stored without a `status` field. The `completed: boolean` field was passed
through unchanged, making imported rows invisible to all post-migration analytics.

**Bug D — markSkipped.js D-52 gap**: when overwriting a completed log with a skipped log,
`_recomputeLastCompletedDate` was not called. `habit.lastCompletedDate` was stranded at
the now-skipped date, corrupting streak and mastery calculations.

**ScoreSnapshots (already fixed)**: `js/io/scoreSnapshots.js:_logCompleted` already uses
`log.status === 'completed'` (hotfix commit `0dbd185`). The guard test in Task 1 confirms
this is intact and will catch any future regression.

## TDD Gate Compliance

RED commit (`6d34560`) confirmed:
- Test A (waveAggregates completionPct) — FAIL before fix
- Test B (waveAggregates longestStreak) — FAIL before fix
- Test C (import normalization) — FAIL before fix
- Test D (markSkipped D-52 overwrite) — FAIL before fix
- ScoreSnapshots guard — PASS (confirms hotfix 0dbd185 is intact)

GREEN commits confirm all four tests pass; 876 tests total, 0 failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated makeLog helper in tests/unit/waveAggregates.test.js**
- **Found during:** Task 2 (GREEN), after fixing waveAggregates.js
- **Issue:** `makeLog(habitId, date, completed = true)` returned `{habitId, date, completed}` (old boolean format). After the production fix checked `log.status`, all 12 existing waveAggregates unit tests failed (completionPct/longestStreak returned 0).
- **Fix:** Updated helper to return `{habitId, date, status: completed ? 'completed' : 'failed'}`.
- **Files modified:** `tests/unit/waveAggregates.test.js`
- **Commit:** included in `0f425ff`

**2. [Rule 1 - Bug] Updated makeLogs helper in tests/integration/wave-aggregates.test.js**
- **Found during:** Task 2 (GREEN)
- **Issue:** Same pattern as above — 3 integration tests failed after production fix.
- **Fix:** Updated helper the same way.
- **Files modified:** `tests/integration/wave-aggregates.test.js`
- **Commit:** included in `0f425ff`

**3. [Rule 1 - Bug] Updated Test 6 assertion in tests/unit/import.test.js**
- **Found during:** Task 2 (GREEN)
- **Issue:** Test 6 asserted `log.completed === true`; after normalization the stored row has `status: 'completed'` (no `completed` field).
- **Fix:** Changed assertion to `assert.equal(log.status, 'completed', ...)` with explanatory comment.
- **Files modified:** `tests/unit/import.test.js`
- **Commit:** included in `0f425ff`

**4. [Rule 1 - Bug] Updated assertion in tests/integration/import.integration.test.js**
- **Found during:** Task 2 (GREEN)
- **Issue:** "imported log appears in logs store" test asserted `log.completed === true`.
- **Fix:** Changed to `assert.equal(log.status, 'completed')` with explanatory comment.
- **Files modified:** `tests/integration/import.integration.test.js`
- **Commit:** included in `0f425ff`

## Known Stubs

None. All four bugs are fully fixed with tests.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced.
The import normalization block fires only inside the existing `mergeImportedStores` function
and only for rows that lack a `status` field — no new trust boundary crossed.
Mitigations T-13-01-01 and T-13-01-02 are satisfied (see plan threat model).

## Self-Check: PASSED

- tests/unit/stale-boolean-bugs.test.js — FOUND
- js/domain/waveAggregates.js — FOUND
- js/io/import.js — FOUND
- js/state/apply/markSkipped.js — FOUND
- Commit 6d34560 (RED) — FOUND
- Commit 0f425ff (GREEN waveAggregates+import) — FOUND
- Commit 8e73a80 (GREEN markSkipped) — FOUND
