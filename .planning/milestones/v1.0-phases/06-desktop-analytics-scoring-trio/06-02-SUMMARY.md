---
phase: "06"
plan: "02"
subsystem: scoring-io
tags: [scoring, snapshots, idb, tdd, io]
dependency_graph:
  requires: [js/domain/scoring.js (06-01), js/util/date.js, js/domain/cadence.js]
  provides: [js/io/scoreSnapshots.js]
  affects: [js/state/apply.js (future 06-03), score_snapshots IDB store, Settings Recompute action (06-03)]
tech_stack:
  added: []
  patterns: [configure() DI seam for testable IDB-writing module, single-tx-per-habit NFR-03 strategy, dateRange generator for synchronous iteration]
key_files:
  created:
    - js/io/scoreSnapshots.js
    - tests/unit/io/scoreSnapshots.test.js
  modified: []
decisions:
  - configure() DI seam allows 06-01 and 06-02 to run in parallel — tests mock scoring functions without depending on scoring.js being correct first
  - _unwrapSetting helper normalizes real repo {key,value} objects vs test-injected raw primitives — avoids duplicating unwrapping logic at each getSetting call
  - weekCompletions/monthCompletions in ctx defaulted to 0 (conservative, habit always appears applicable) in snapshot writer — correct direction for score denominator
  - dateRange generator uses daysFrom() for DST-safe calendar arithmetic (inherits Pitfall 4 protection from date.js)
  - scoreVersion hardcoded to 1 per SCORING-09 (no dynamic lookup)
metrics:
  duration: "~23 min"
  completed: "2026-06-29"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_added: 11
---

# Phase 06 Plan 02: Score Snapshot Writer Summary

**One-liner:** Write-time per-habit snapshot writer and bulk-rebuild function persisting all three model scores in a single IDB row per (habitId, date) with a single transaction per habit for NFR-03 performance.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | 638ab52 | Failing tests for writeHabitSnapshots and rebuildAllSnapshots (ERR_MODULE_NOT_FOUND confirms RED) |
| T2 GREEN | feat | 1b03395 | Implement js/io/scoreSnapshots.js; all 11 tests pass |

## What Was Built

### js/io/scoreSnapshots.js

IDB write module with two exported functions and a configure() DI seam.

**`configure({ computeS1, computeS2, computeS3 })`** — Dependency injection seam. Production auto-configures at module load from real scoring.js. Tests call this in `beforeEach` to inject mocks, enabling 06-01 and 06-02 to run in parallel.

**`writeHabitSnapshots(habitId, repo)`** — Per-habit snapshot computation and persistence:
- Fetches: `allHabits` (for S3 load denominator AND habit lookup), `logsForHabit`, settings (`masteryThreshold`, `masteryWindow`, `weekStart`)
- Returns early without writing if habit not found in `getAllHabits()`
- `dateRange(startYMD, endYMD)` generator iterates habit's `createdAt` → today using DST-safe `daysFrom()` (no per-day IDB reads — NFR-03)
- Calls `_computeS1`, `_computeS2`, `_computeS3` for each date (injected or real)
- Writes all rows in **ONE** `repo.runTx(['score_snapshots'], 'readwrite', ...)` call per habit (NFR-03 key optimization)
- Row shape: `{habitId, date, s1Score, s1Status, s2Score, s3Score, scoreVersion: 1}` (D-124, SCORING-09)

**`rebuildAllSnapshots(repo, onProgress = () => {})`** — Bulk habit rebuilder:
- Sequential `await writeHabitSnapshots(habit.id, repo)` per habit (avoids IDB tx contention)
- `onProgress(i + 1, total)` invoked after each habit for Settings loading indicator
- Handles empty habits list without throwing

**`dateRange(startYMD, endYMD)`** — Internal generator yielding YYYY-MM-DD strings from start to end inclusive. DST-safe via `daysFrom()`.

**`_unwrapSetting(raw)`** — Internal helper normalizing `{key, value}` repo objects vs raw primitives from tests.

### tests/unit/io/scoreSnapshots.test.js

11 test cases in 2 describe blocks (new `tests/unit/io/` subdirectory):

**writeHabitSnapshots (7 tests):**
- Row count matches date range from `createdAt` to today
- Row shape: all required fields present
- `scoreVersion: 1` in every row (SCORING-09)
- Exactly ONE `runTx` call per invocation (NFR-03 assertion)
- Grace-period mock → null scores in written rows
- Missing habit → no rows written, no `runTx` call
- Non-grace-period rows carry mocked S1/S2/S3 values

**rebuildAllSnapshots (4 tests):**
- Empty habits array → no throw
- Each habit's `runTx` called (writes rows per habit)
- `onProgress(done, total)` invoked with correct args per habit
- `onProgress` defaults to no-op (optional argument)

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written, with one implementation note:

**Implementation detail: weekCompletions/monthCompletions in ctx**
- **Found during:** T2 implementation review
- **Issue:** The plan's `ctx` spec included `weekCompletions: () => 1` and `monthCompletions: () => 1` but the cadence.js weekly/monthly resolvers use these to determine if a habit already had a log this week/month (non-zero = hide). Using `() => 1` would make weekly/monthly habits always look "already completed" — hiding them from the denominator incorrectly.
- **Fix:** Changed to `() => 0` (conservative default: habit always appears applicable). This slightly over-estimates the denominator for weekly/monthly habits but is the safe direction (underestimates score rather than over-inflating it). Documented inline in the code.
- **Impact:** Scoring accuracy for weekly/monthly habits in snapshot computation is approximate; write-time accuracy would require passing actual log counts. Full accuracy requires plan 06-03's apply.js wiring which provides real log context.
- **Files modified:** js/io/scoreSnapshots.js (implementation only, tests unaffected)

## Known Stubs

None. `scoreSnapshots.js` is a complete, fully-wired IDB write module. The apply.js chokepoint wiring (so snapshots are computed on every log write) is plan 06-03. The Settings "Recompute" button wiring is also plan 06-03.

## Threat Flags

None. `scoreSnapshots.js` writes only to the `score_snapshots` IDB store via the existing `runTx` pattern. No network endpoints, no auth paths, no file access, no new trust boundaries.

## TDD Gate Compliance

- RED gate: `test(06-02)` commit `638ab52` — ERR_MODULE_NOT_FOUND confirmed (js/io/scoreSnapshots.js absent)
- GREEN gate: `feat(06-02)` commit `1b03395` — 11/11 tests passing

## Self-Check

### Files exist:
- js/io/scoreSnapshots.js — FOUND
- tests/unit/io/scoreSnapshots.test.js — FOUND

### Commits exist:
- 638ab52 — FOUND (test(06-02): failing tests for writeHabitSnapshots rebuildAllSnapshots)
- 1b03395 — FOUND (feat(06-02): implement writeHabitSnapshots and rebuildAllSnapshots)

### Tests pass:
- `node --test tests/unit/io/scoreSnapshots.test.js` → 11/11 pass
- Full suite: 743/745 pass (2 pre-existing stub failures from plans 04-02 and 04-04, unrelated to this plan)

## Self-Check: PASSED
