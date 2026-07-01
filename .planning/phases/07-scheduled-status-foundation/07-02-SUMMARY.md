---
phase: 07-scheduled-status-foundation
plan: 02
subsystem: state/apply
tags: [tdd, scheduled-status, createHabit, status-derivation]
dependency_graph:
  requires: []
  provides: [SCHED-01, SCHED-02]
  affects: [js/state/apply/createHabit.js, tests/integration/apply.createHabit.test.js]
tech_stack:
  added: []
  patterns: [status-derivation-from-startDate, TDD-red-green]
key_files:
  created: []
  modified:
    - js/state/apply/createHabit.js
    - tests/integration/apply.createHabit.test.js
decisions:
  - "Status derivation uses lexicographic string comparison: sd > todayLocal() → 'scheduled' : 'active'"
  - "sd is startDate ?? todayLocal() — already computed at line 78, no new variables needed"
  - "todayLocal() already imported in createHabit.js — no new imports added"
metrics:
  duration_minutes: 11
  completed_date: "2026-07-01"
  tasks_completed: 2
  files_modified: 2
status: complete
---

# Phase 07 Plan 02: createHabit Status Derivation Summary

**One-liner:** Status field in createHabit handler derives from startDate using lexicographic comparison: future startDate produces 'scheduled', past/today produces 'active'.

## What Was Built

Modified `js/state/apply/createHabit.js` to replace the hardcoded `status: 'active'` with a conditional expression that derives status from the already-computed `sd` variable:

```js
// Before (line 86):
status: 'active',

// After:
status: sd > todayLocal() ? 'scheduled' : 'active',
```

The `sd` variable (`startDate ?? todayLocal()`) was already at line 78, and `todayLocal` was already imported at line 32. The change is a single-expression replacement — no new imports, no structural changes.

Extended `tests/integration/apply.createHabit.test.js` with three new test cases inside the existing describe block:

1. `createHabit with future startDate stores habit as scheduled` — `startDate:'2099-06-01'` → `status:'scheduled'`
2. `createHabit with past startDate stores habit as active` — `startDate:'2020-01-01'` → `status:'active'`
3. `createHabit with startDate equal to today stores habit as active` — `startDate: todayYMD()` → `status:'active'`

All 5 existing tests continue to pass (including `habit row has correct default fields` which asserts `status === 'active'` for habits with no `startDate`).

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | e4ea3e6 `test(07-02): add failing tests for startDate-based status derivation` | PASS — exactly 1 new test failed (future startDate), 2 new tests passed (past/today) |
| GREEN | 57796d0 `feat(07-02): derive habit status from startDate in createHabit handler` | PASS — all 8 tests pass |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e4ea3e6 | test | RED: add failing tests for startDate-based status derivation |
| 57796d0 | feat | GREEN: derive habit status from startDate in createHabit handler |

## Verification Results

```
node --test tests/integration/apply.createHabit.test.js
tests 8 / pass 8 / fail 0
```

Full suite (814 tests): 6 pre-existing failures in `import.test.js` broadcast stubs — unrelated to this plan. My changes introduced 0 new failures and resolved 1 (the RED test is now GREEN).

## Deviations from Plan

None — plan executed exactly as written. The one-line fix at line 86 was exactly as specified. Tests were added in the correct structure (inside the existing describe block, reusing `freshApply()` and `todayYMD()` helpers).

## Known Stubs

None — status derivation is fully wired; no placeholder values remain.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The change is purely in-memory status derivation during habit creation. T-07-03 (string comparison on caller-provided startDate) accepted per threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| js/state/apply/createHabit.js | FOUND |
| tests/integration/apply.createHabit.test.js | FOUND |
| .planning/phases/07-scheduled-status-foundation/07-02-SUMMARY.md | FOUND |
| Commit e4ea3e6 (RED) | FOUND |
| Commit 57796d0 (GREEN) | FOUND |
| All 8 tests pass | VERIFIED |
