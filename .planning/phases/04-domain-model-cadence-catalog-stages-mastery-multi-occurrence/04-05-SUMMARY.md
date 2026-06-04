---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: "05"
subsystem: catalog-crud-versioning
tags: [apply-handlers, repo-extensions, catalog, versioning, nfr-10, tdd]
dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04]
  provides: [createHabit-handler, editHabit-handler, getLogsForDate, getHabitVersionAtDate]
  affects: [js/db/repo.js, js/db/idb.js, js/state/apply.js, tests/helpers/fake-idb.js]
tech_stack:
  added: []
  patterns:
    - apply-handler-with-broadcastKeys
    - tdd-red-green-refactor
    - compound-key-idb-range-query
    - version-creating-edit-pattern
key_files:
  created:
    - js/state/apply/createHabit.js
    - js/state/apply/editHabit.js
    - tests/integration/apply.createHabit.test.js
    - tests/integration/apply.editHabit.test.js
    - tests/integration/repo.getHabitHistory.test.js
  modified:
    - js/db/repo.js
    - js/db/idb.js
    - js/state/apply.js
    - tests/helpers/fake-idb.js
    - tests/integration/contract.fake-vs-real.test.js
    - tests/integration/catalog-flow.test.js
    - tests/integration/habit-versions.test.js
decisions:
  - "editHabit NEVER writes to logs store (NFR-10): enforced by handler contract + structural test"
  - "createHabit pre-generates habitId or generates inside handler then mutates event.payload for broadcastKeys"
  - "idb.js getAll() extended with optional range param for compound key range queries on habit_versions"
  - "A7 contract test EXPECTED list updated to include getLogsForDate + getHabitVersionAtDate"
metrics:
  duration: "approx 40 minutes"
  completed_date: "2026-06-05"
  tasks_completed: 2
  files_changed: 12
---

# Phase 04 Plan 05: Repo Extensions + createHabit/editHabit Handlers Summary

## One-liner

Repo methods getLogsForDate/getHabitVersionAtDate + createHabit/editHabit apply handlers with NFR-10 version-creating edit proof via 18 new integration tests.

## What Was Built

### Task 1: Repo Extensions + fake-idb + Contract Test

**`js/db/repo.js`** — Two new exported functions:
- `getLogsForDate(date)`: queries `logs` store via `date` index with `IDBKeyRange.only(date)`; returns all log rows for a single calendar day (all habitIds)
- `getHabitVersionAtDate(habitId, date)`: queries `habit_versions` store via primary compound key range `IDBKeyRange.bound([habitId,'0000-01-01'],[habitId,date])`; returns last element (most recent effectiveFrom <= date) or `undefined`

**`js/db/idb.js`** — `getAll()` extended with an optional `query` parameter for primary-key range queries, enabling compound key range scans without a named index.

**`tests/helpers/fake-idb.js`** — Matching fake implementations:
- `getLogsForDate(date)`: linear scan of logs.values() where `log.date === date`
- `getHabitVersionAtDate(habitId, date)`: filter + sort by effectiveFrom, return last or undefined

**`tests/integration/contract.fake-vs-real.test.js`** — `EXPECTED` list updated with `getLogsForDate` and `getHabitVersionAtDate` (A7 contract preserved).

**`tests/integration/repo.getHabitHistory.test.js`** — 9 new tests:
- getLogsForDate: empty store, multi-habit same date, exact-match boundary
- getHabitVersionAtDate: no versions, single version, two versions (latest selected), future-only version (returns undefined), exact effectiveFrom boundary, habitId isolation

### Task 2: createHabit + editHabit Handlers

**`js/state/apply/createHabit.js`** — `handleCreateHabit(event, repo)` handler:
- Writes: habits row + habit_versions row (effectiveFrom = startDate ?? todayLocal())
- Habits row fields: id, name, name_pl, wave, status:'active', cadence, targetType, target, stages, currentStageIndex:0, stageStartedAt, masteryThresholdOverride, masteryWindowOverride, createdAt, startDate, lastCompletedDate:null
- Inverse: `{type:'deleteHabit', payload:{habitId}}`
- broadcastKeys: `{habitId}` (habitId written into event.payload during handler execution)

**`js/state/apply/editHabit.js`** — `handleEditHabit(event, repo)` handler:
- Reads current habit via `repo.getHabit(habitId)` to capture prior state for inverse
- Writes: updated habits row + NEW habit_versions row (effectiveFrom = todayLocal())
- storeNames NEVER includes 'logs' (NFR-10 structural enforcement)
- Inverse: `{type:'restoreHabitVersion', payload:{habitId, priorVersion}}`
- broadcastKeys: `{habitId}`

**`js/state/apply.js`** — HANDLERS table extended: `createHabit: handleCreateHabit, editHabit: handleEditHabit`

**`tests/integration/apply.createHabit.test.js`** — 5 new tests:
- Atomic write to all 3 stores (habits + habit_versions + events)
- Explicit startDate propagation to effectiveFrom + stageStartedAt + createdAt
- Returns UUID event id
- Inverse shape: deleteHabit with habitId
- Default fields (status, stages, currentStageIndex, masteryThresholdOverride, etc.)

**`tests/integration/apply.editHabit.test.js`** — 4 new tests:
- Two habit_versions entries after edit
- NFR-10 log preservation (log row bit-for-bit identical after editHabit)
- Inverse contains priorVersion for undo
- Structural NFR-10 proof: storeNames never includes 'logs'

**Previously-stubbed tests fleshed out:**
- `tests/integration/catalog-flow.test.js` — 3 tests (plan 04-05 portion)
- `tests/integration/habit-versions.test.js` — 1 test (NFR-10 invariant)

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Before plan 04-05 | 441 | 432 | 9 (all stubs) |
| After plan 04-05 | 461 | 454 | 7 (remaining stubs for 04-06/04-09) |
| New tests added | 22 | 22 | 0 |

Prior stubs resolved by this plan: `catalog-flow.test.js` (plan 04-05 portion), `habit-versions.test.js`

## Commits

| Hash | Description |
|------|-------------|
| b8992c1 | feat(04-05): add getLogsForDate + getHabitVersionAtDate repo methods |
| 22d82b6 | feat(04-05): add createHabit + editHabit apply handlers with integration tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] idb.js getAll() didn't support range parameter**
- **Found during:** Task 1 implementation of getHabitVersionAtDate
- **Issue:** `getAll(db, store)` in idb.js didn't accept a `query` parameter, required by the compound key range scan for `getHabitVersionAtDate`
- **Fix:** Extended `getAll()` signature to accept optional `query` parameter (primary-key range or null); backward compatible (existing calls with no third arg work unchanged)
- **Files modified:** `js/db/idb.js`
- **Commit:** b8992c1

**2. [Rule 2 - Missing] broadcastKeys habitId not accessible from event**
- **Found during:** Task 2 createHabit implementation
- **Issue:** broadcastKeys(event) is called AFTER the handler returns with only the original event; the habitId is generated inside the handler and wasn't in event.payload
- **Fix:** Handler writes generated habitId into event.payload.habitId before returning so broadcastKeys can echo it; documented as a caller convention
- **Files modified:** `js/state/apply/createHabit.js`
- **Commit:** 22d82b6

## Known Stubs

None — all files created/modified in this plan contain functional implementations.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-sanitization | js/state/apply/createHabit.js | `name` field stored as-is in IDB; XSS mitigated at render time via textContent (T-04-05) |

T-04-05b (editHabit logs rewrite) is mitigated: `storeNames` never includes `logs` + structural integration test verifies this.

## Self-Check: PASSED

- `js/state/apply/createHabit.js` — FOUND
- `js/state/apply/editHabit.js` — FOUND
- `js/db/repo.js` (getLogsForDate, getHabitVersionAtDate) — FOUND
- `tests/helpers/fake-idb.js` (getLogsForDate, getHabitVersionAtDate) — FOUND
- `tests/integration/apply.createHabit.test.js` — FOUND
- `tests/integration/apply.editHabit.test.js` — FOUND
- `tests/integration/repo.getHabitHistory.test.js` — FOUND
- Commit b8992c1 — FOUND (`feat(04-05): add getLogsForDate + getHabitVersionAtDate repo methods`)
- Commit 22d82b6 — FOUND (`feat(04-05): add createHabit + editHabit apply handlers with integration tests`)
- No switch keyword in apply.js, createHabit.js, or editHabit.js — VERIFIED
- NFR-10: storeNames never includes 'logs' in editHabit — VERIFIED by structural test
- A7 contract test passes — VERIFIED
