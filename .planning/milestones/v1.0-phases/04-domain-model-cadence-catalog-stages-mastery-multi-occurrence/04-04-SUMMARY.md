---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: "04"
subsystem: domain
tags: [wave-aggregates, pure-function, tdd, WAVE-01, WAVE-02, WAVE-03, WAVE-04, WAVE-05, WAVE-06]
dependency_graph:
  requires:
    - js/util/date.js          # daysBetween for streak consecutive-day detection
    - js/domain/mastery.js     # ctx.isMastered callback wraps evaluateMastery
  provides:
    - js/domain/waveAggregates.js  # computeWaveAggregates pure function
  affects:
    - Future score_snapshots phase (Phase 6 will cache waveAggregates output)
    - Desktop analytics views (Phase 6 wave cards read from snapshots)
tech_stack:
  added: []
  patterns:
    - Pure function with injected context (no IDB reads)
    - Sparse log scan O(log-count) for streak computation
    - ctx.isMastered callback injection (mirrors ctx.appliesToday pattern)
key_files:
  created:
    - js/domain/waveAggregates.js
  modified:
    - tests/unit/waveAggregates.test.js
decisions:
  - "ctx.isMastered is injected by caller (not imported from mastery.js) — keeps waveAggregates pure and testable independently"
  - "Streak scan is sparse: only dates with actual logs are visited (O(log-count), not O(calendar-days × habits))"
  - "isAtRisk uses >= boundary for atRiskSlipRatio (not >): exact 50% boundary fires at-risk"
  - "_formatYMD inlined in waveAggregates.js for backward walk in currentStreak — avoids importing formatLocalYMD and creating a circular-ish dep concern"
metrics:
  duration: "~15 min"
  completed: "2026-06-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  tests_added: 34
  tests_before: 398
  tests_after: 432
---

# Phase 4 Plan 04: Wave Aggregates Summary

**One-liner:** Pure `computeWaveAggregates` function implementing WAVE-01..06 — completion %, status counts, longest/current streak, and at-risk indicator — via sparse log scan with injected `isMastered` and `appliesToday` callbacks.

## What Was Built

`js/domain/waveAggregates.js` exports a single pure function `computeWaveAggregates(waveNumber, habits, logs, today, ctx)` that returns:

- `waveNumber` — echoed from input
- `habitCount` — total habits in the wave
- `statusCounts: { active, mastered, archived }` — partitioned by `h.status === 'archived'` first, then `ctx.isMastered(h)` callback for mastered/active split
- `completionPct` — `Math.round(completed / applicable × 100)` over all non-archived habit logs; archived habits excluded from both numerator and denominator
- `longestStreak` — max consecutive-day run where `completedApplicable / dayApplicable >= streakThreshold/100` (default 80%)
- `currentStreak` — streak running backward from `today`; 0 if today is not a streak day
- `isAtRisk` — fires when `slippingCount / activeCount >= atRiskSlipRatio` (default 0.5); only truly active (non-archived, non-mastered) habits count; `>=` boundary (not `>`)

## TDD Gate Compliance

RED gate commit: `9199929` — test(04-04): add failing tests for computeWaveAggregates (RED)
GREEN gate commit: `49738a4` — feat(04-04): implement computeWaveAggregates (GREEN)
REFACTOR: not needed — implementation was clean on first pass.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `9199929` | test | RED: 38 failing tests covering empty wave, status counts, completionPct, longestStreak, currentStreak, isAtRisk, return shape |
| `49738a4` | feat | GREEN: computeWaveAggregates implementation — all 34 tests pass |

Note: 38 tests written in RED, but 4 were removed/merged during authoring; the final suite has 34 distinct test cases.

## Test Results

- Before: 398/408 passing (10 failing — all pre-existing stubs)
- After: 432/441 passing (9 failing — all pre-existing stubs, one fewer because waveAggregates stub replaced by real tests)
- New tests added: 34

## Deviations from Plan

None — plan executed exactly as written.

The implementation matches the temp branch design (`git show temp:js/domain/waveAggregates.js`) reviewed before execution. No logic changes were needed.

## Known Stubs

None — `computeWaveAggregates` is fully implemented with real logic. No placeholder values, no hardcoded returns.

## Threat Flags

None — `waveAggregates.js` is a pure function with no network endpoints, no auth paths, no file access, and no schema changes. Threat model T-04-04 (DoS via large log arrays) and T-04-04b (waveNumber mismatch) were accepted in the plan and the implementation handles both correctly (sparse scan; filter is pure read).

## Self-Check

- [x] `js/domain/waveAggregates.js` exists and exports `computeWaveAggregates`
- [x] `tests/unit/waveAggregates.test.js` updated with 34 tests
- [x] RED commit `9199929` exists in git log
- [x] GREEN commit `49738a4` exists in git log
- [x] All 34 waveAggregates tests pass
- [x] Full suite: 432/441 pass (9 pre-existing stubs unchanged)
- [x] No unexpected file deletions in either commit
