# Phase 11 Context — 4-State Log Model Tests

## Root Cause Analysis

Running `node --test "tests/**/*.test.js"` reveals **29 failing tests** across 12 files. All failures trace to one root cause: the 4-state log status model (`status: 'completed'|'failed'|'skipped'|undefined`) was implemented in the handlers but (a) two handlers pass synthetic rows with the old boolean field, and (b) twelve test files still assert or construct log rows using the old `{completed: true/false}` model.

## Failure Map

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

## Model Reference

Current log row shape per handler:
- `markCompleted` → `{ habitId, date, status: 'completed', definitionVersion: null }`
- `markUncompleted` → `{ habitId, date, status: 'failed', definitionVersion: null }`
- `markSkipped` → `{ habitId, date, status: 'skipped', definitionVersion: null }`
- `logNumeric` → `{ habitId, date, count, definitionVersion: null }` (no status field in stored row)
- `logSlot` → `{ habitId, date, slots, definitionVersion: null }` (no status field in stored row)
- `restoreLogRow` → restores whatever prior row shape was captured

D-52 invariant: `habit.lastCompletedDate` = latest date where `log.status === 'completed'`.
