# Phase 11: 4-State Log Model Tests — Context

**Gathered:** 2026-08-31  
**Investigation updated:** 2026-09-02  
**Status:** Ready for planning

<domain>
## Phase Boundary

Write unit tests for the 4-state log status model (completed/failed/skipped/undefined) and verify data round-trips for both export formats. Covers LOG4-01 (handler behavior, state transitions, edge cases) and LOG4-04 (JSON export preserves all 4 statuses, CSV cells emit correct values for all 4 states). Also fixes a stale JSDoc in `js/state/apply/markUncompleted.js`.

</domain>

---

## Root Cause Analysis

Running `node --test "tests/**/*.test.js"` reveals **29 failing tests** across 12 files. All failures trace to one root cause: the 4-state log status model (`status: 'completed'|'failed'|'skipped'|undefined`) was implemented in the handlers but (a) two handlers pass synthetic rows with the old boolean field, and (b) twelve test files still assert or construct log rows using the old `{completed: true/false}` model.

### A — Source code bugs (2 files)

**`js/state/apply/logNumeric.js`**  
Synthetic D-52 row passed to `_recomputeLastCompletedDate`:
```js
currentLogRow: { ...newLog, completed: isCompleted }   // BUG: old field
```
`_recomputeLastCompletedDate` filters `l.status === 'completed'`, so `isCompleted:true` rows have no `status` field and are never counted → `lastCompletedDate` is always null for numeric habits.

**`js/state/apply/logSlot.js`**  
Same pattern: `currentLogRow: { ...newLog, completed: allChecked }` → same bug.

**`js/state/store.js` (`getCachedWeekCompletions`, line ~319)**  
Checks `log.completed === true`. After `apply()` writes `{status:'completed'}`, this function never counts the new-model log. Silent bug affecting weekly cadence's `ctx.weekCompletions`.

### B — Stale test assertions (10 files)

Files using `log.completed === true/false` in assertions or `{completed: true/false}` in fixture log rows:
- `tests/integration/apply.markCompleted.test.js` — 2 tests
- `tests/integration/apply.markUncompleted.test.js` — 3 tests
- `tests/integration/apply.lastCompletedDate.test.js` — 1 test
- `tests/integration/export.integration.test.js` — 2 spots (fixture + assertion)
- `tests/integration/history-flow.test.js` — 5 tests
- `tests/integration/mastery-cadence.test.js` — 3 tests (makeLogs creates `{completed:true}`)
- `tests/integration/today.tap.test.js` — 2 tests
- `tests/integration/toast.undo.test.js` — 1 test
- `tests/unit/store.hydrate.test.js` — 3 tests + fixture putLog calls
- `tests/unit/views/desktop/analytics.builders.test.js` — 2 tests (Phase 10 i18n strings changed)

### C — Test setup bug (1 file)

**`tests/integration/import.integration.test.js`**  
`makeBroadcastSpy()` returns `{ messages, postMessage(msg) {} }` — an object.  
`import.js` calls `_broadcast({ type: 'import:done' })` — expects a function.  
Fix: make the spy a callable function with a `.messages` property.

### D — Phase 10 i18n regression (1 file)

**`tests/unit/views/desktop/analytics.builders.test.js`**  
Phase 10 changed:
- `'desktop.status.atRisk'` → locale value `'At Risk'` (capital R, no hyphen). Test checks `'At-risk: 1'`.
- Wave header text changed from `waveGroup.waveName` to `t('catalog.wave', { n })` = `"Wave 1"`. Test checks `'Wave 1 — Foundation'`.

---

## Model Reference

Current log row shape per handler:
- `markCompleted` → `{ habitId, date, status: 'completed', definitionVersion: null }`
- `markUncompleted` → `{ habitId, date, status: 'failed', definitionVersion: null }`
- `markSkipped` → `{ habitId, date, status: 'skipped', definitionVersion: null }`
- `logNumeric` → `{ habitId, date, count, definitionVersion: null }` (no status field in stored row)
- `logSlot` → `{ habitId, date, slots, definitionVersion: null }` (no status field in stored row)
- `restoreLogRow` → restores whatever prior row shape was captured

D-52 invariant: `habit.lastCompletedDate` = latest date where `log.status === 'completed'`.

---

<decisions>
## Implementation Decisions

### Test file structure (LOG4-01)

- **D-01:** Create a new `tests/unit/logStatus.test.js` as the dedicated home for all 4-state log status unit tests. Mirrors the cadence.test.js / scoring.test.js pattern — one test file per logical domain.
- **D-02:** Tests import and exercise the apply handlers directly (`handleMarkCompleted`, `handleMarkSkipped`, `handleMarkUncompleted`). No new domain module (`js/domain/logStatus.js`) is created — the handlers are the domain logic.
- **D-03:** Schema v2 migration tests stay in `tests/unit/schema.test.js` (where the migration code lives). `logStatus.test.js` tests the post-migration model only.

### Invalid input scope (LOG4-01)

- **D-04:** "Invalid inputs" means edge cases on IDB reads, not status string validation. No new guard code is added to handlers. Three specific edge cases are tested:
  1. No prior log row (handler writes a fresh row with correct status)
  2. Prior log with the same status (idempotent write behavior)
  3. Missing habitId in `habits` store (D-52 recompute returns null, habit write skipped gracefully)
- **D-05:** Fix the stale JSDoc in `js/state/apply/markUncompleted.js` — the `@file` header still references `'completed: false'` (old boolean model) but the code writes `status: 'failed'`. Update the header to match the current 4-state model. — **Reversibility:** reversible

### Export round-trip (LOG4-04)

- **D-06:** JSON round-trip test uses a fake repo (unit test tier), matching the existing `export.json.test.js` and `import.test.js` pattern. No full fake-IDB integration test.
- **D-07:** Round-trip assertions are added to **existing files**: `export.json.test.js` (exportJSON output preserves all 4 `status` values) and `import.test.js` (importJSON merge-by-id preserves all 4 status values — including skipped and failed — without coercion or data loss). All 4 status values are explicitly tested.
- **D-08:** The missing `status:'skipped' → 'x'` CSV cell test is fixed in **Phase 11** (not deferred to Phase 12). The existing `export.csv.test.js` gets an explicit test case for this gap. This closes LOG4-04 completely.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — LOG4-01 and LOG4-04 requirements (active section)
- `.planning/ROADMAP.md` §Phase 11 — success criteria and scope

### Implementation files to test

- `js/state/apply/markCompleted.js` — writes `status:'completed'`; also exports `handleRestoreLogRow`
- `js/state/apply/markUncompleted.js` — writes `status:'failed'`; exports `_recomputeLastCompletedDate` (D-52 helper)
- `js/state/apply/markSkipped.js` — writes `status:'skipped'`
- `js/io/export.js` — `exportJSON()`, `importJSON()` (JSON round-trip), `csvCellValue()` (CSV 4-state encoding)
- `js/db/schema.js` §v2 migration — migrates old `completed:boolean` rows to `status` field (already tested in schema.test.js; referenced for context only)

### Source code bugs to fix first (from investigation)

- `js/state/apply/logNumeric.js` — synthetic D-52 row uses `completed: isCompleted` (old field); fix to `status: isCompleted ? 'completed' : undefined`
- `js/state/apply/logSlot.js` — same: `completed: allChecked` → `status: allChecked ? 'completed' : undefined`
- `js/state/store.js` — `getCachedWeekCompletions` checks `log.completed === true`; fix to `log.status === 'completed'`

### Existing tests to extend

- `tests/unit/export.json.test.js` — add assertions for all 4 `status` values in JSON export output
- `tests/unit/import.test.js` — add merge-by-id assertions for all 4 log status values
- `tests/unit/export.csv.test.js` — add missing `status:'skipped' → 'x'` cell test

### Stale test files to update (from investigation)

- `tests/integration/apply.markCompleted.test.js`, `apply.markUncompleted.test.js`, `apply.lastCompletedDate.test.js`
- `tests/integration/export.integration.test.js`, `history-flow.test.js`, `mastery-cadence.test.js`
- `tests/integration/today.tap.test.js`, `toast.undo.test.js`
- `tests/unit/store.hydrate.test.js`
- `tests/unit/views/desktop/analytics.builders.test.js` — also update i18n strings (Phase 10 regression)
- `tests/integration/import.integration.test.js` — fix `makeBroadcastSpy()` to be a callable function

### Testing patterns

- `tests/helpers/fake-idb.js` — NOT used for Phase 11 (unit tier only, fake repo pattern)
- Existing handler tests in `tests/unit/apply.discipline.test.js` — reference for fake repo shape used in handler tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Fake repo pattern** (`apply.discipline.test.js`): Handler tests inject a minimal fake repo with `getLog`, `getHabit`, `getLogsByHabit` stubs — copy this pattern for `logStatus.test.js`
- **`binaryHabit()` / `makeCtx()` helpers** (`export.csv.test.js`): Reuse these fixture builders when adding the `skipped → 'x'` test case

### Established Patterns

- **D-23**: Node built-in `node:test` + `node:assert/strict` — no test framework
- **`_resetXxxForTest()`** exports: Not needed for handler tests (handlers are stateless pure functions — they take `event` and `repo` as parameters, no module-level mutable state)
- **Handler contract**: Each handler returns `{ storeNames, writes, inverse }` — tests assert on this shape, not on direct IDB writes
- **JSDoc @file header**: Every `.js` file starts with `/** @file ... */` (D-27, locked convention)

### Integration Points

- `js/state/apply.js` `HANDLERS` table: `markCompleted`, `markUncompleted`, `markSkipped`, `restoreLogRow` are all registered — tests import the handler functions directly, not `apply.js`
- `js/io/export.js` `csvCellValue()` and `exportJSON()`/`importJSON()` are the export surfaces to test

</code_context>

<specifics>
## Specific Ideas

- The `skipped → 'x'` CSV gap is a named test to add (parallel to existing "Test 2: status:completed → '1'" and "Test 2b: status:failed → '0'" — name it "Test 2c: status:skipped → 'x'")
- The `markUncompleted.js` JSDoc fix is a scoped doc change (2-3 lines in the `@file` header and the `@type` annotation on `next`)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-4-State Log Model Tests*  
*Context gathered: 2026-08-31 | Investigation merged: 2026-09-02*
