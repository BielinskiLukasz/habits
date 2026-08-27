---
phase: 08-today-catalog-upcoming-section
reviewed: 2026-07-29T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - js/state/apply/promoteHabit.js
  - tests/state/apply/promoteHabit.test.js
  - js/views/catalog.js
  - js/main.js
  - js/desktop.js
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-07-29
**Depth:** standard
**Files Reviewed:** 5
**Status:** Issues found

## Summary

Reviewed the core implementation for Phase 08 (Upcoming section, promote/demote workflow). The code demonstrates strong architectural patterns with proper handler registration, error handling, and state management. However, two functional bugs and two quality concerns were identified:

- **Functional bug (idempotence):** `mountCatalog` does not update `_currentParent` on re-entry, causing re-renders from subscriptions to target the wrong parent element.
- **Test coverage gap:** The undo handler (`handleDemoteHabit`) lacks direct test coverage despite being a critical component of the promotion/demotion round-trip.

---

## Critical Issues

None found.

---

## Warnings

### WR-01: mountCatalog does not update _currentParent on idempotent re-entry

**File:** `js/views/catalog.js:541-546`

**Issue:** The `mountCatalog` function claims to be idempotent (docstring line 533: "Idempotent: calling `mountCatalog` a second time without unmounting first returns the existing unmount closure"), but the re-entry logic fails to update `_currentParent`:

```javascript
export async function mountCatalog(parent, deps) {
  if (_unsub) {
    // Already mounted — re-render against the live parent.
    _currentDeps = deps;                            // ← Updated
    await renderCatalogInto(parent, deps);          // ← Uses new parent for initial render
    return _createUnmount(parent);
    // ← BUG: _currentParent is NOT updated
  }

  _currentParent = parent;                          // ← Set here only on first call
  _currentDeps = deps;
  // ...
}
```

The stored `_currentParent` is used by the subscription callback (lines 554-558) to re-render when the store notifies:

```javascript
_unsub = subscribe(() => {
  if (_currentParent && _currentDeps) {
    renderCatalogInto(_currentParent, _currentDeps).catch(() => {});
  }
});
```

**Scenario:** If `mountCatalog(newParent, deps)` is called after initial mount with a different parent element, the initial render on line 544 targets the new parent, but subsequent store notifications will continue rendering into the old `_currentParent`. This creates a silent desync where mutations update a stale element.

**Current risk:** Low in the present codebase (in `main.js:182-187`, `catalogPanel` is queried once at boot and reused). High risk if this pattern is copied to other mount functions or if the DOM structure becomes more dynamic.

**Fix:** Update `_currentParent` in the re-entry branch:

```javascript
if (_unsub) {
  _currentParent = parent;  // ADD THIS LINE
  _currentDeps = deps;
  await renderCatalogInto(parent, deps);
  return _createUnmount(parent);
}
```

---

### WR-02: Missing test coverage for handleDemoteHabit (undo handler)

**File:** `tests/state/apply/promoteHabit.test.js`

**Issue:** The test file imports and exercises only `handlePromoteHabit` (line 10):

```javascript
import { handlePromoteHabit } from '../../../js/state/apply/promoteHabit.js';
```

The paired undo handler `handleDemoteHabit` (exported from the same module, line 52 of `js/state/apply/promoteHabit.js`) is **never tested**. It is properly registered in the HANDLERS table in `js/state/apply/apply.js` (lines 50, 75) and is critical to the undo/redo workflow, but has zero test coverage.

Both handlers are symmetric:
- `handlePromoteHabit`: reads habit, sets `status: 'active'`, returns inverse `{ type: 'demoteHabit', ... }`
- `handleDemoteHabit`: reads habit, sets `status: 'scheduled'`, returns inverse `{ type: 'promoteHabit', ... }`

Since undo is a first-class feature of this system and state round-trips are critical to data integrity, both directions must be tested.

**Fix:** Add test suite for `handleDemoteHabit` at the end of the file:

```javascript
describe('demoteHabit handler (inverse of promoteHabit)', () => {
  // Test 1: handleDemoteHabit accepts event with habitId and reads habit
  test('reads habit from repo and returns structured result', async () => {
    const mockRepo = {
      getHabit: async (id) => ({
        id: 'habit-123',
        name: 'Morning walk',
        status: 'active',
        wave: 1,
        startDate: '2026-08-01',
      }),
    };

    const event = {
      type: 'demoteHabit',
      payload: { habitId: 'habit-123' },
    };

    const result = await handleDemoteHabit(event, mockRepo);

    assert(result, 'handler returns a result object');
    assert(result.storeNames, 'result has storeNames property');
    assert(result.writes, 'result has writes property');
    assert(result.inverse, 'result has inverse property');
  });

  // Test 2: habit.status is set to 'scheduled'
  test('sets habit.status to scheduled', async () => {
    const mockRepo = {
      getHabit: async () => ({
        id: 'habit-456',
        name: 'Evening routine',
        status: 'active',
        wave: 2,
      }),
    };

    const event = {
      type: 'demoteHabit',
      payload: { habitId: 'habit-456' },
    };

    const result = await handleDemoteHabit(event, mockRepo);

    assert.strictEqual(result.writes[0].value.status, 'scheduled', 'status is scheduled');
  });

  // Test 3: inverse type is 'promoteHabit' (round-trip closure)
  test('inverse type is promoteHabit', async () => {
    const mockRepo = {
      getHabit: async () => ({
        id: 'habit-789',
        name: 'Test habit',
        status: 'active',
      }),
    };

    const event = {
      type: 'demoteHabit',
      payload: { habitId: 'habit-789' },
    };

    const result = await handleDemoteHabit(event, mockRepo);

    assert.strictEqual(result.inverse.type, 'promoteHabit', 'inverse type is promoteHabit');
    assert.strictEqual(
      result.inverse.payload.habitId,
      'habit-789',
      'inverse carries same habitId'
    );
  });

  // Test 4: error handling when habit not found
  test('throws when habit not found', async () => {
    const mockRepo = {
      getHabit: async () => undefined,
    };

    const event = {
      type: 'demoteHabit',
      payload: { habitId: 'nonexistent' },
    };

    await assert.rejects(
      () => handleDemoteHabit(event, mockRepo),
      /Habit nonexistent not found/,
      'throws error with habitId'
    );
  });
});
```

Also add the missing import at the top:

```javascript
import { handlePromoteHabit, handleDemoteHabit } from '../../../js/state/apply/promoteHabit.js';
```

---

## Info

### IN-01: Misleading comment on accessibility behavior

**File:** `js/main.js:127-130`

**Issue:** The docstring for the `show()` function contains contradictory phrasing regarding accessibility:

```javascript
/**
 * Show one route panel and hide the others. Uses the `hidden` HTML attribute
 * rather than a CSS-class toggle so the panels stay accessible to keyboard
 * navigation by default (browsers treat `hidden` as removed from the a11y
 * tree).
 */
```

The phrase "so the panels stay accessible" contradicts the parenthetical explanation that `hidden` removes them from the a11y tree. The code correctly uses `hidden` to hide panels, but the comment is poorly written and could confuse future maintainers about the intended behavior.

**Fix:** Clarify the comment to explain the actual intent:

```javascript
/**
 * Show one route panel and hide the others. Uses the `hidden` HTML attribute
 * (which properly removes hidden panels from keyboard navigation and the a11y tree)
 * rather than a CSS-class toggle (which might leave hidden panels tab-focusable).
 */
```

---

### IN-02: Defensive truthiness check on getCachedHabits

**File:** `js/views/catalog.js:223`

**Issue:** The code uses a truthiness check instead of an explicit function type check:

```javascript
let habits = getCachedHabits ? getCachedHabits() : [];
```

If `getCachedHabits` is accidentally exported as a non-function truthy value (e.g., an object, string, or number), the code will crash at runtime with "getCachedHabits is not a function." This is a minor defensive-coding pattern improvement.

**Current risk:** Very low (the import is from a module under control, and store.js consistently exports a function). Does not block shipping.

**Recommendation:** For consistency with other repo.* type checks in the file (line 224: `typeof repo.getAllHabits === 'function'`), improve the check using optional chaining (ES2020+, Baseline Widely Available since 2022):

```javascript
let habits = getCachedHabits?.() ?? [];
```

---

## Verified ✓

- **Handler contract compliance:** Both `handlePromoteHabit` and `handleDemoteHabit` follow the required contract: accept `(event, repo)`, return `{ storeNames, writes, inverse }`, define `broadcastKeys` static method.
- **Null safety:** Both handlers validate `if (!habit) throw(...)` on lines 33 and 55.
- **Atomic writes:** Both return `storeNames: ['habits']` for transactional commit via `apply.js` (lines 37, 59).
- **Undo round-trip:** `promoteHabit` → `demoteHabit` → `promoteHabit` inverse chain is correct and symmetric.
- **Handler registration:** Both handlers are imported in `apply.js:50` and registered in HANDLERS table (lines 74-75).
- **Bootstrap order:** Boot sequence in `main.js` (configureApply → bootSeed → bootScheduled → hydrate → bootWaves) is correct per T-02-BOOT. Desktop.js follows same pattern (lines 79-126).
- **Cross-tab sync:** `broadcastKeys` on line 43 and 65 return ID-only payloads, compliant with Pitfall 8 design (D-08, T-02-11).
- **Error handling:** Top-level try/catch blocks in main.js (lines 107-109) and desktop.js (lines 95-97, 105-114) with documented swallows.
- **Fire-and-forget async:** `mountCatalog` in main.js:187 is intentionally not awaited (comment line 184-186) to allow progressive rendering.

---

## Summary of Findings

| Severity | Count | Issue |
|----------|-------|-------|
| Critical | 0 | — |
| Warning | 2 | Idempotence bug (WR-01), Missing demotion test (WR-02) |
| Info | 2 | Misleading comment (IN-01), Defensive check pattern (IN-02) |
| **Total** | **4** | — |

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
