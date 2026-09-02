---
phase: 11
plan: "02"
subsystem: tests
tags: [tdd, integration-tests, unit-tests, markSkipped, csv-export, 4-state]
requires: [11-01]
provides: [markSkipped-coverage, csv-skipped-coverage]
affects: [tests/integration/, tests/unit/]
tech-stack:
  added: []
  patterns: [cache-bust-freshApply, fake-idb, configure-di]
key-files:
  created:
    - tests/integration/apply.markSkipped.test.js
  modified:
    - tests/unit/export.csv.test.js
decisions:
  - "Retroactive TDD: tests pass immediately against existing implementation (markSkipped.js already written)"
  - "markSkipped D-52 guard verified: handler storeNames:['logs'] only — habits store never touched"
  - "CSV skipped cell: status:skipped on applicable day returns 'x' matching CLAUDE.md CSV spec"
metrics:
  duration_seconds: 300
  completed: "2026-08-31"
  tasks_completed: 3
  commits: 2
status: complete
estimate:
actuals:
  tokens: 8500
  tasks: 3
  commits: 2
---

# Phase 11 Plan 02: New Coverage — markSkipped Handler + CSV Skipped State Summary

**One-liner:** Integration test for markSkipped (7 cases) + CSV skipped-status unit test covering the 4-state log model.

## What Was Built

### Task 1 — `tests/integration/apply.markSkipped.test.js` (new file)

Created a full integration test suite for `apply({ type: 'markSkipped' })`. Modeled after `apply.markCompleted.test.js` using the cache-bust `freshApply()` pattern with `fake-idb` and configure-based DI.

Seven test cases:
- **a) Happy path** — verifies `log.status === 'skipped'`, `log.definitionVersion === null`, no legacy `completed` field.
- **b) D-52 guard** — seeds habit with `lastCompletedDate: null`, calls markSkipped, asserts habit row is unchanged (handler writes only to `logs` store).
- **c) Inverse shape** — asserts `event.inverse.type === 'restoreLogRow'` and `prior === undefined` when no prior row existed.
- **d) Broadcast shape** — spies on broadcast; asserts `{ type, event, keys, at }` shape, keys-only payload `{ habitId, date }`, broadcast fires after write.
- **e1) Undo round-trip (prior row)** — seeds completed row, calls markSkipped, then restoreLogRow; asserts log restored to prior row.
- **e2) Undo round-trip (no prior)** — calls markSkipped on blank, then restoreLogRow with `prior: undefined`; asserts log deleted.
- **f) Defensive** — calls markSkipped with nonexistent habitId; asserts log written, habits store remains empty.

All 7 cases pass. Commit: `01efc49`

### Task 2 — `tests/unit/export.csv.test.js` (new test block)

Added `describe('csvCellValue — binary habit, applicable, skipped')` block after the existing "completed" block:

```js
test('returns "x" when binary habit has status:skipped log', () => {
  const logs = [{ habitId: 'h1', date: '2026-06-06', status: 'skipped' }];
  assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
});
```

Verifies the `if (log.status === 'skipped') return 'x'` branch in `csvCellValue`. Test count: 29 → 30. Commit: `ea0a44a`

### Task 3 — Full suite smoke check

`node --test "tests/**/*.test.js"` — **918 tests, 0 failures**. Prior: 910. New: 8 (+7 integration, +1 unit).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `tests/integration/apply.markSkipped.test.js` exists — 7 tests pass
- [x] `tests/unit/export.csv.test.js` skipped test exists — 30 tests pass
- [x] Full suite: 918/918 pass, 0 failures
- [x] Commits `01efc49` and `ea0a44a` present in git log
