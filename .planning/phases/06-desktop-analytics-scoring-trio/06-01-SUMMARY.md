---
phase: "06"
plan: "01"
subsystem: scoring-domain
tags: [scoring, s1, s2, s3, tdd, pure-domain]
dependency_graph:
  requires: [js/util/date.js, js/domain/mastery.js (pattern only)]
  provides: [js/domain/scoring.js]
  affects: [js/io/scoreSnapshots.js (future), score_snapshots IDB store]
tech_stack:
  added: []
  patterns: [LOG_COMPLETED dispatch table (self-contained), exponential day-weighting, cadence-aware denominator, 0.3x mastered weighting]
key_files:
  created:
    - js/domain/scoring.js
    - tests/unit/scoring.test.js
  modified: []
decisions:
  - D-124 single-row score_snapshots schema (s1Score+s1Status+s2Score+s3Score in one row) confirmed and honored
  - LOG_COMPLETED table self-contained in scoring.js (not imported from mastery.js) for independent testability
  - computeS2 uses Map for O(1) log lookup per day rather than Array.find per day
metrics:
  duration: "~8 min"
  completed: "2026-06-29"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_added: 18
---

# Phase 06 Plan 01: Pure Scoring Domain (S1/S2/S3) Summary

**One-liner:** Three pure scoring model functions (S1 rolling-threshold, S2 exponential day-weighted, S3 load-adjusted capacity) with cadence-aware denominator, 7-day grace period, and mastered-habit 0.3x weighting.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | ee7470b | Failing tests for computeS1, computeS2, computeS3 (15 test cases, module absent — RED confirmed) |
| T2 GREEN | feat | 4244fe5 | Implement js/domain/scoring.js; all 18 tests pass |

## What Was Built

### js/domain/scoring.js

Pure domain module with three exported functions — no IDB calls, no side effects.

**`computeS1(habit, logsForHabit, ctx)`** — Rolling Threshold Health (D-110):
- Grace period → `{s1Score: null, s1Status: null}`
- Mastered → `{s1Score: 100, s1Status: 'Healthy'}`
- Cadence-aware denominator: iterates `ctx.windowDays` calling `ctx.appliesToday`
- Status buckets: Healthy ≥ globalThreshold, Watch 70–threshold, At-risk 50–70, Failing < 50

**`computeS2(habit, logsForHabit, ctx)`** — Day-Weighted Wave Score (D-111):
- Exponential decay weight: `2^(-i/21)` where `i` = days ago
- Stage multiplier on numerator: etap1=1.0×, etap2=1.25×, etap3=1.5×
- Mastered: 0.3× applied to both numerator and denominator weights
- Result clamped to [0, 1]; uses a Map for O(1) log lookup per day

**`computeS3(habit, logsForHabit, ctx, allHabits)`** — Load-Adjusted Capacity Score (D-112):
- Per day: `completedContrib / loadCount` where loadCount = applicable habits on that day
- Mastered: 0.3 auto-contribution on applicable days
- Normalized to [0, 1] via `Math.min(1, rawSum / applicableDays)`

### tests/unit/scoring.test.js

18 test cases across 8 describe blocks:
- S1: 14/14 in 14-day window → 100/Healthy; grace period; zero applicable days; 4 threshold scenarios; mastered shortcut
- S2: [0,1] range; 21/21 in 21-day window ≈ 1.0; never-completed → 0; grace period; etap2 > etap1; mastered [0,1]
- S3: single-habit all-completed ≈ 1.0; grace period; partial range; mastered 0.3 contribution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test setup corrected for window-log mismatch**
- **Found during:** T2 GREEN verification
- **Issue:** T1's test "14/14 daily completed" provided 14 logs against a 70-day window, yielding s1Score=20 (14/70) instead of 100. Similarly "21 days near 1.0" provided 21 logs against 70 applicable days, yielding s2Score≈0.555.
- **Fix:** Changed first S1 test to use `windowDays: 14` (matching the plan's "14/14 days completed in window" wording exactly). Changed S2 near-1.0 test to use `windowDays: 21`.
- **Files modified:** tests/unit/scoring.test.js
- **Commit:** 4244fe5 (included with T2 GREEN)

## Known Stubs

None. `scoring.js` is a complete, fully-wired pure function module. The snapshot writer (`js/io/scoreSnapshots.js`) that calls these functions is Phase 6 plan 02.

## Threat Flags

None. `scoring.js` is a pure computation module with no network endpoints, no auth paths, no file access, and no IDB writes.

## TDD Gate Compliance

- RED gate: `test(06-01)` commit `ee7470b` — 15 initial failing test cases (ERR_MODULE_NOT_FOUND confirmed)
- GREEN gate: `feat(06-01)` commit `4244fe5` — 18/18 tests passing

## Self-Check

### Files exist:
- js/domain/scoring.js — FOUND
- tests/unit/scoring.test.js — FOUND

### Commits exist:
- ee7470b — FOUND (test(06-01): failing tests for computeS1 computeS2 computeS3)
- 4244fe5 — FOUND (feat(06-01): implement computeS1 computeS2 computeS3 in js/domain/scoring.js)

### Tests pass:
- `node --test tests/unit/scoring.test.js` → 18/18 pass
- Full suite: 732/734 pass (2 pre-existing stub failures from plans 04-02 and 04-04, unrelated to this plan)

## Self-Check: PASSED
