---
phase: 08
reviewed: 2026-07-28T20:30:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - js/state/apply/promoteHabit.js
  - tests/state/apply/promoteHabit.test.js
  - js/views/catalog/builders.js
  - tests/unit/builders.catalog.test.js
  - tests/integration/today.cat01-scheduled-filter.test.js
  - js/views/catalog.js
  - js/main.js
  - js/desktop.js
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 8 Code Review

## Summary

Phase 8 implements the Upcoming section for scheduled habits with a Promote button. The core handler logic, builders, and catalog integration are mostly sound, but **three critical issues prevent the feature from functioning**:

1. **Missing `configurePromoteHabit` export** — both `main.js` and `desktop.js` import and call this function, but it is not exported from `promoteHabit.js`. This causes an import-time error.
2. **Missing `demoteHabit` handler** — `promoteHabit` declares its inverse as `demoteHabit`, but no `handleDemoteHabit` function exists. This breaks undo/redo functionality.
3. **Handlers not registered in HANDLERS table** — neither `promoteHabit` nor `demoteHabit` are registered in `js/state/apply.js`, so `apply({type:'promoteHabit'})` will fail at runtime with "Unknown event type".

The builders are well-constructed and tests are comprehensive, but these wiring gaps make the feature non-functional.

---

## Critical Issues

### CR-001: Missing `configurePromoteHabit` export breaks boot sequence

**File:** `js/state/apply/promoteHabit.js`

**Issue:** 
`main.js:66` and `desktop.js:58` both import `configurePromoteHabit` from `promoteHabit.js`:
```javascript
import { configurePromoteHabit } from './state/apply/promoteHabit.js';
```

And then call it at boot time:
```javascript
// main.js:100
configurePromoteHabit({ repo });
// desktop.js:90
configurePromoteHabit({ repo });
```

However, `promoteHabit.js` only exports `handlePromoteHabit`. The `configurePromoteHabit` function does not exist. This causes an **import-time error** that prevents the entire app from loading.

**Fix:**
Add a `configurePromoteHabit` export to `promoteHabit.js`. Following the pattern in `js/domain/scheduled.js`, this should be a simple DI function:

```javascript
// Add after line 42 in promoteHabit.js
let _repo = null;

/**
 * Configure the promoteHabit handler with a repo handle (DI pattern).
 * Required by undo/demoteHabit to read the prior habit state.
 *
 * @param {{ repo: object }} deps
 * @returns {void}
 */
export function configurePromoteHabit(deps) {
  _repo = deps?.repo;
}
```

Then update `handlePromoteHabit` signature to use the injected `_repo` when the repo parameter is not provided, OR ensure callers always pass the repo. Alternatively, if no stateful config is needed, the import can simply be removed from `main.js:66` and `desktop.js:58` and the export can be a no-op.

---

### CR-002: Missing `demoteHabit` handler breaks undo/redo

**File:** `js/state/apply/promoteHabit.js`

**Issue:**
Line 38 declares the inverse event type as `demoteHabit`:
```javascript
inverse: { type: 'demoteHabit', payload: { habitId } },
```

When a user undoes a promotion, `js/state/undo.js` dispatches this inverse through `apply()`. The `apply.js` HANDLERS table (line 64–79) does not have an entry for `demoteHabit`, so the undo dispatch will fail with "Unknown event type: demoteHabit".

Additionally, there is no `js/state/apply/demoteHabit.js` file, so the handler cannot be imported and registered.

**Fix:**
Create `js/state/apply/demoteHabit.js` with a `handleDemoteHabit` export that mirrors `promoteHabit.js` (same pattern as `archiveHabit.js`/`restoreHabit.js`):

```javascript
/**
 * @file demoteHabit handler (undo inverse of promoteHabit).
 *
 * Transitions a habit from 'active' back to 'scheduled' status
 * (used only via undo/redo).
 */

/**
 * `demoteHabit` handler — set habit.status back to 'scheduled'.
 *
 * @param {{ type: 'demoteHabit', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleDemoteHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  const updated = { ...habit, status: 'scheduled' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'promoteHabit', payload: { habitId } },
  };
}

handleDemoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
```

Then register it in `js/state/apply.js`:
```javascript
// Line 49, change:
import { handleArchiveHabit, handleRestoreHabit } from './apply/archiveHabit.js';
// To:
import { handleArchiveHabit, handleRestoreHabit } from './apply/archiveHabit.js';
import { handlePromoteHabit } from './apply/promoteHabit.js';
import { handleDemoteHabit } from './apply/demoteHabit.js';

// Line 72, add to HANDLERS table:
promoteHabit: handlePromoteHabit,
demoteHabit: handleDemoteHabit,
```

---

### CR-003: Handlers not registered in HANDLERS dispatch table

**File:** `js/state/apply.js`

**Issue:**
The `HANDLERS` table (lines 64–79) controls event dispatch. `promoteHabit` and `demoteHabit` are not registered, so attempting to call:
```javascript
await apply({ type: 'promoteHabit', payload: { habitId } });
```

will fail with an error because the handler lookup at line 141 will find no entry for `'promoteHabit'`.

This is referenced in the catalog.js promote action (line 393), which will fail at runtime.

**Fix:**
Import both handlers in `js/state/apply.js` and register them in the `HANDLERS` table:

```javascript
// After line 49:
import { handlePromoteHabit } from './apply/promoteHabit.js';
import { handleDemoteHabit } from './apply/demoteHabit.js';

// In HANDLERS table (after line 78):
promoteHabit: handlePromoteHabit,
demoteHabit: handleDemoteHabit,
```

---

## Warnings

### WR-001: Null/undefined habit not validated in promoteHabit handler

**File:** `js/state/apply/promoteHabit.js`, line 32

**Issue:**
The handler reads a habit from the repo but does not validate that it exists before using it:

```javascript
const { habitId } = event.payload;
const habit = await repo.getHabit(habitId);
const updated = { ...habit, status: 'active' };  // habit could be undefined
```

If `repo.getHabit(habitId)` returns `undefined` (e.g., the habit was deleted between UI render and button click), spreading `undefined` will produce `{ status: 'active' }`, losing all other habit fields. This creates a corrupt habit record in the IDB.

**Fix:**
Add a guard check:

```javascript
const { habitId } = event.payload;
const habit = await repo.getHabit(habitId);
if (!habit) throw new Error(`Habit ${habitId} not found`);
const updated = { ...habit, status: 'active' };
```

(Note: Apply the same fix to the `demoteHabit` handler once created.)

---

## Verified ✓

- **Builders are pure and XSS-safe**: `buildUpcomingListItem` returns a description tree with no DOM access or `.innerHTML` use (D-78 pattern).
- **Builders carry all required attributes**: habit id, edit button, promote button with aria-label, wave badge, startDate badge.
- **Today view filter is correct**: Integration test confirms `getCachedHabits().filter(h => h.status === 'active')` excludes scheduled habits (CAT-01).
- **Catalog rendering splits active and scheduled**: Lines 242–244 correctly separate habits into `activeHabits` (status !== 'scheduled') and `scheduledHabits` (status === 'scheduled').
- **Promote action closure correctly extracts habitId**: Catalog.js line 388–393 reads `data-habit-id` from the button element via `currentTarget`/`target` fallback pattern.
- **Undo structure is correct**: `promoteHabit` handler returns the right shape `{storeNames, writes, inverse}` matching archiveHabit pattern.
- **Test coverage is comprehensive**: 6 unit tests for promoteHabit handler cover structure, status mutation, inverse type, broadcastKeys, property preservation, and no direct repo.put calls. 11 unit tests for builders cover all buttons, badges, and edge cases. 3 integration tests for CAT-01 verify the filter.
- **broadcastKeys is correctly exported**: Both promoteHabit and tests define the static function to enable cross-tab sync.

---

_Reviewed: 2026-07-28T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
