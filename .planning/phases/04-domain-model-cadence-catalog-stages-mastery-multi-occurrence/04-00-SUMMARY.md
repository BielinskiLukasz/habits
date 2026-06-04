---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: "00"
subsystem: testing
tags: [node-test, tdd, stubs, wave0]

requires:
  - phase: 03-today-view-settings-v1
    provides: existing 281 passing tests; node:test infrastructure and fake-idb helpers

provides:
  - 12 stub test files (6 unit + 6 integration) establishing RED state for Wave 1 TDD plans
  - tests/unit/mastery.test.js — stub for evaluateMastery (plan 04-02)
  - tests/unit/stage.test.js — stub for evaluateStageTriggers + demoteStage (plan 04-03)
  - tests/unit/waveAggregates.test.js — stub for computeWaveAggregates (plan 04-04)
  - tests/unit/builders.catalog.test.js — stub for catalog view builders (plan 04-08)
  - tests/unit/builders.history.test.js — stub for history view builders (plan 04-09)
  - tests/unit/builders.today.numeric.test.js — stub for numeric/slot today builders (plan 04-09)
  - tests/integration/catalog-flow.test.js — stub for catalog end-to-end flow (plans 04-05/04-06)
  - tests/integration/history-flow.test.js — stub for history navigation flow (plan 04-09)
  - tests/integration/stage-advancement.test.js — stub for stage trigger integration (plan 04-06)
  - tests/integration/habit-versions.test.js — stub for NFR-10 history integrity (plan 04-05)
  - tests/integration/wave-aggregates.test.js — stub for wave aggregate computation (plans 04-04/04-06)
  - tests/integration/mastery-cadence.test.js — stub for mastery + cadence-aware denominator (plans 04-02/04-06)

affects:
  - 04-01 through 04-09: all Wave 1+ TDD plans find stub files instead of missing-file errors

tech-stack:
  added: []
  patterns:
    - "Wave 0 stub pattern: create assert.fail placeholder stubs before TDD RED phase so test runner finds file (not file-not-found) on RED"

key-files:
  created:
    - tests/unit/mastery.test.js
    - tests/unit/stage.test.js
    - tests/unit/waveAggregates.test.js
    - tests/unit/builders.catalog.test.js
    - tests/unit/builders.history.test.js
    - tests/unit/builders.today.numeric.test.js
    - tests/integration/catalog-flow.test.js
    - tests/integration/history-flow.test.js
    - tests/integration/stage-advancement.test.js
    - tests/integration/habit-versions.test.js
    - tests/integration/wave-aggregates.test.js
    - tests/integration/mastery-cadence.test.js
  modified: []

key-decisions:
  - "Stubs for unit tests that import non-existent modules (mastery.js, stage.js, waveAggregates.js, catalog/builders.js, history/builders.js) will fail at import time — this IS the intended RED state; the file is found by the runner but the module cannot resolve"
  - "Integration stubs import createFakeRepo from existing helpers/fake-idb.js so they run without missing module errors and fail cleanly with assert.fail"

patterns-established:
  - "Wave 0 stub pattern: each stub file carries @file JSDoc header citing the requirement IDs and the Wave 1+ plan that will flesh it out"

requirements-completed:
  - CADENCE-01
  - MASTERY-01
  - STAGE-01
  - CATALOG-01
  - LOG-02
  - WAVE-01
  - HISTORY-01
  - NFR-10

duration: 4min
completed: "2026-06-05"
---

# Phase 04 Plan 00: Test Stub Scaffolding Summary

**12 assert.fail stub test files created (6 unit + 6 integration) establishing clean RED state for all Wave 1 TDD plans — runner finds files, imports are wired, assertions will fail until implementations land**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-05T12:00:25Z
- **Completed:** 2026-06-05T12:04:38Z
- **Tasks:** 2
- **Files created:** 12

## Accomplishments

- All 6 unit test stubs created with correct `../../js/domain/` and `../../js/views/` import paths
- All 6 integration test stubs created with `createFakeRepo` import from existing helpers
- Existing 281 tests remain 281/281 green — no regression

## Task Commits

Each task was committed atomically:

1. **Task 1: Unit test stubs — mastery, stage, waveAggregates, builders** — `5ea6d39` (test)
2. **Task 2: Integration test stubs — catalog-flow, history-flow, stage-advancement, habit-versions, wave-aggregates, mastery-cadence** — `5324883` (test)

## Files Created/Modified

- `tests/unit/mastery.test.js` — stub for evaluateMastery; imports from js/domain/mastery.js (plan 04-02)
- `tests/unit/stage.test.js` — stub for evaluateStageTriggers + demoteStage; imports from js/domain/stage.js (plan 04-03)
- `tests/unit/waveAggregates.test.js` — stub for computeWaveAggregates; imports from js/domain/waveAggregates.js (plan 04-04)
- `tests/unit/builders.catalog.test.js` — stub for catalog view builders; imports from js/views/catalog/builders.js (plan 04-08)
- `tests/unit/builders.history.test.js` — stub for history view builders; imports from js/views/history/builders.js (plan 04-09)
- `tests/unit/builders.today.numeric.test.js` — stub for numeric/slot today builders; imports from js/views/today/builders.js (plan 04-09)
- `tests/integration/catalog-flow.test.js` — catalog CRUD end-to-end stub (plans 04-05/04-06)
- `tests/integration/history-flow.test.js` — history navigation flow stub (plan 04-09)
- `tests/integration/stage-advancement.test.js` — stage trigger integration stub (plan 04-06)
- `tests/integration/habit-versions.test.js` — NFR-10 history integrity stub (plan 04-05)
- `tests/integration/wave-aggregates.test.js` — wave aggregate computation stub (plans 04-04/04-06)
- `tests/integration/mastery-cadence.test.js` — mastery + cadence-aware denominator stub (plans 04-02/04-06)

## Decisions Made

- Unit stubs that import not-yet-created modules (mastery.js, stage.js, waveAggregates.js, catalog/builders.js, history/builders.js) fail at import time rather than at `assert.fail`. This is the correct RED state — the file is found by the test runner, the failure is a module-resolution error rather than "file not found", satisfying the Wave 0 goal.
- Integration stubs use `createFakeRepo` from existing `tests/helpers/fake-idb.js` to avoid adding any missing-module failures on the integration side; they fail cleanly with `assert.fail`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

All 12 files are intentional stubs by design. Each is labeled with the Wave 1+ plan that will replace the placeholder. The stubs do NOT prevent the plan's goal (Wave 0 scaffolding) from being achieved.

## Next Phase Readiness

Wave 1 TDD plans (04-01 through 04-04) can now begin. Each will:
1. Find its stub file when running `node --test tests/unit/<name>.test.js`
2. See a RED failure (import error for unit stubs, assert.fail for integration stubs)
3. Replace the stub with real failing tests (RED commit), then implement the module (GREEN commit)

---
*Phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence*
*Completed: 2026-06-05*
