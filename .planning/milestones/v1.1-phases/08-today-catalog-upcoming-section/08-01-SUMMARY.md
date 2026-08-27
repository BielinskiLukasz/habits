---
phase: 08
plan: 01
subsystem: state/apply
tags: [handler, tdd, sched-04, promote-habit]
requires: []
provides: [promoteHabit handler for apply layer]
affects: [catalog view, today view, BroadcastChannel sync]
tech_stack:
  - Vanilla JavaScript (ES modules)
  - Node --test runner (unit tests)
  - Structured mutation pattern (matches archiveHabit)
key_files:
  created:
    - js/state/apply/promoteHabit.js
    - tests/state/apply/promoteHabit.test.js
  modified: []
decisions:
  - D-08: promoteHabit handler implements status transition from scheduled → active
  - D-07: Inverse type is 'demoteHabit' for undo/redo support
  - SCHED-04: Direct promote action on Upcoming list items
metrics:
  duration_minutes: 15
  completed_date: "2026-07-28"
  commits_count: 3
  test_count: 6
  files_created: 2
status: complete
---

# Phase 8 Plan 01: TDD — promoteHabit Handler (SCHED-04) Summary

**One-liner:** Implemented promoteHabit handler (SCHED-04) with RED/GREEN/REFACTOR cycle, completing the state mutation layer for scheduled → active habit promotion.

## What Was Built

**TDD Execution:** Full RED → GREEN → REFACTOR cycle

1. **RED (Test)** — `test(sched-04): add failing tests for promoteHabit handler`
   - Created `tests/state/apply/promoteHabit.test.js` with 6 test cases
   - Tests verify: handler signature, status mutation, inverse type, broadcastKeys function, no direct repo.put calls, property preservation
   - All tests initially failed (module not found)

2. **GREEN (Implementation)** — `feat(sched-04): implement promoteHabit handler`
   - Created `js/state/apply/promoteHabit.js` — new apply handler
   - Exported `handlePromoteHabit(event, repo)` function
   - Mirrors `archiveHabit.js` pattern exactly: read habit, spread object, mutate status field, return structured result
   - Status changed from any value → `'active'`
   - Inverse type: `'demoteHabit'` for undo/redo support
   - `broadcastKeys` static property: `(event) => ({habitId: event.payload.habitId})`
   - All 6 tests passed

3. **REFACTOR (Polish)** — `refactor(sched-04): verify promoteHabit JSDoc and pattern consistency`
   - Verified D-27 JSDoc compliance: file header with @file, rationale, forbidden constructs
   - Confirmed function JSDoc with @param and @returns type hints
   - Pattern alignment verified against archiveHabit.js reference
   - Zero code changes; confirmation commit only

## Verification

**Automated test suite:** `npm test -- tests/state/apply/promoteHabit.test.js`

```
✔ promoteHabit handler (SCHED-04) [6 tests]
  ✔ reads habit from repo and returns structured result
  ✔ sets habit.status to active
  ✔ inverse type is demoteHabit with same habitId
  ✔ broadcastKeys returns object with habitId
  ✔ does not make direct repo.put calls
  ✔ preserves all other habit properties
```

**Test coverage:** 6/6 passing (100%)

## Done Criteria Met

- [x] promoteHabit.js exists and exports handlePromoteHabit function with correct signature
- [x] promoteHabit.js exports broadcastKeys static property
- [x] All behavior cases in feature section have passing tests (6 tests, all GREEN)
- [x] File has JSDoc header (D-27) with D-08/SCHED-04 reference
- [x] Three commits created: test (RED), feat (GREEN), refactor (polish)
- [x] No forbidden constructs found (no switch, no repo.put calls)

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| 3e4e1fb | test(sched-04): add failing tests for promoteHabit handler | tests/state/apply/promoteHabit.test.js |
| 06403dd | feat(sched-04): implement promoteHabit handler | js/state/apply/promoteHabit.js |
| 79ce8ce | refactor(sched-04): verify promoteHabit JSDoc and pattern consistency | — |

## Handler Contract

**Input:** `{type: 'promoteHabit', payload: {habitId: string}}`

**Output:** 
```javascript
{
  storeNames: ['habits'],
  writes: [{store: 'habits', value: {... updatedHabit with status: 'active'}}],
  inverse: {type: 'demoteHabit', payload: {habitId}}
}
```

**Broadcast:** `broadcastKeys(event) => {habitId: event.payload.habitId}`

## Integration Points (Phase 8-03)

The handler is wired in Phase 8 plan 03:
- `js/main.js`: Add `import` + `configurePromoteHabit({repo})` call in P2 boot block
- `js/desktop.js`: Add `import` + `configurePromoteHabit({repo})` call in P2 boot block
- `js/views/catalog.js`: Wire promote action to `apply({type: 'promoteHabit', payload:{habitId}})` in buildActions
- `js/views/catalog/builders.js`: Use `buildUpcomingListItem(habit)` to render promote button

## Notes

- Handler follows exact pattern from `archiveHabit.js`: read for undo, spread, mutate status, return structured result
- No direct IDB writes; mutation is consumed by `apply.js` chokepoint for transactional safety
- BroadcastChannel integration automatic via `apply.js` (D-07, D-30)
- Undo/redo support ready: inverse type `demoteHabit` paired with future demote handler
- History integrity preserved: logs never touched, only `habits` store written

## Deviations from Plan

None — plan executed exactly as written. TDD cycle complete with all tests passing.

---

**Status:** ✅ Complete
**Next:** Phase 8 plan 02 — Catalog view split and Upcoming section UI
