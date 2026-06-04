---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: "03"
subsystem: domain
tags: [stage-advancement, trigger-composition, pure-functions, tdd]

requires:
  - phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence/04-00
    provides: stub files (tests/unit/stage.test.js, js/domain/stage.js stubs)
  - phase: 03-today-view-settings-v1-first-usable-slice
    provides: js/util/date.js daysBetween function

provides:
  - js/domain/stage.js with evaluateStageTriggers and demoteStage pure functions
  - TRIGGER_CHECKS dispatch array pattern (no if-else chain, prevents Pitfall 3)
  - 42 passing unit tests covering all 4 trigger types, OR composition, and floor guards

affects:
  - js/state/apply.js (will call evaluateStageTriggers when handling stage-advance events)
  - js/views/today.js (will call evaluateStageTriggers to decide whether to show manual advance button result)

tech-stack:
  added: []
  patterns:
    - "TRIGGER_CHECKS dispatch array: iterate named check functions instead of if-else-if chain for OR-composed triggers"
    - "Pure function output: {shouldAdvance, nextStageIndex, triggeredBy} — caller owns state mutation"

key-files:
  created:
    - js/domain/stage.js
  modified:
    - tests/unit/stage.test.js

key-decisions:
  - "TRIGGER_CHECKS array with break-on-first-truthy implements OR composition without if-else chain (Pitfall 3 prevention)"
  - "after-n-days check explicitly guards !stage.advanceAfterDaysThreshold so the two N-days variants are mutually exclusive"
  - "Manual trigger is ordered first in TRIGGER_CHECKS so an explicit user tap reports triggeredBy:'manual' even when an auto-trigger would also have fired"

patterns-established:
  - "Dispatch array pattern: const CHECKS = [{name, check}]; loop + break for first-match OR logic"
  - "ctx ?? 0 default for optional numeric fields (completionPercentage) prevents runtime errors on missing ctx fields"

requirements-completed:
  - STAGE-01
  - STAGE-02
  - STAGE-03
  - STAGE-04
  - STAGE-05
  - STAGE-06
  - STAGE-07

duration: 20min
completed: 2026-06-05
---

# Phase 04 Plan 03: Stage Advancement Triggers Summary

**OR-composed stage trigger evaluation (manual, scheduled-by-week, after-N-days, after-N-days-with-threshold) via TRIGGER_CHECKS dispatch array, plus demoteStage with floor guard — 42 tests, all green**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-05T23:20:00Z
- **Completed:** 2026-06-05T23:40:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Wrote 42 unit tests covering all 4 trigger types, OR composition (Pitfall 3 guard), last-stage guard (T-04-03), demotion floor guard (T-04-03b), and return shape validation
- Implemented `evaluateStageTriggers` using a `TRIGGER_CHECKS` dispatch array — no if-else chain — preventing the else-if short-circuit bug (Pitfall 3)
- Implemented `demoteStage` with `Math.max(0, ...)` floor preventing demotion below stage 0 (T-04-03b)
- Full prior test suite (date, cadence, mastery, wave, id) remains green — 192 passing tests plus the 42 new stage tests

## Task Commits

1. **RED phase: failing tests** — `4916c28` (test)
2. **GREEN phase: stage.js implementation** — `ba92aa1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `js/domain/stage.js` — pure `evaluateStageTriggers` and `demoteStage` functions with TRIGGER_CHECKS dispatch array (~114 lines)
- `tests/unit/stage.test.js` — 42 tests across 9 describe blocks covering all trigger types, OR composition, guards, and return shape

## Decisions Made

- `after-n-days` and `after-n-days-with-threshold` are made mutually exclusive by checking `!stage.advanceAfterDaysThreshold` in the unconditional variant. This avoids double-counting: when both `advanceAfterDays` and `advanceAfterDaysThreshold` are set, only the threshold variant fires.
- Manual trigger is ordered first in TRIGGER_CHECKS so an explicit user tap always reports `triggeredBy: 'manual'` even when another trigger would also have fired on the same day. This matches user intent: if they tapped, credit the tap.
- `ctx.completionPercentage ?? 0` defaults missing percentage to 0, ensuring threshold variant never fires on a missing argument without any special null check.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The `waveAggregates.test.js` failure observed during full-suite verification is a pre-existing stub failure for a module not yet created in a different plan — not caused by this plan's changes.

## Known Stubs

None. Both `evaluateStageTriggers` and `demoteStage` are fully implemented with no placeholder values.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. The file is pure domain logic with no I/O.

## TDD Gate Compliance

- RED gate: `test(04-03)` commit `4916c28` — 42 failing tests committed before implementation
- GREEN gate: `feat(04-03)` commit `ba92aa1` — all 42 tests passing after implementation

## Self-Check: PASSED

- `js/domain/stage.js` exists and exports both functions
- `tests/unit/stage.test.js` exists with 42 tests
- Commits `4916c28` and `ba92aa1` verified in git log

## Next Phase Readiness

- `evaluateStageTriggers` is ready to be called from `apply.js` stage-advance handlers (plan 04-05 or equivalent)
- `demoteStage` is ready for the manual demotion UI flow in Catalog
- No blockers

---
*Phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence*
*Completed: 2026-06-05*
