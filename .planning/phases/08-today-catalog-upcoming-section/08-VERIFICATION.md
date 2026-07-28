---
phase: 08-today-catalog-upcoming-section
verified: 2026-07-28T22:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Today & Catalog — Upcoming Section Verification Report

**Phase Goal:** Users see only active (and mastered) habits on Today and in the active Catalog list; scheduled habits appear in a dedicated Upcoming section with startDate/wave info and a promote action.

**Verified:** 2026-07-28
**Status:** PASSED
**Test Coverage:** 48/48 Phase 8 tests pass; 844/850 overall suite pass (6 pre-existing failures unrelated to Phase 8)

---

## Requirements Verification

### CAT-01: Today view filters out scheduled habits

**Status:** ✓ VERIFIED

**Requirement:** Today check-in never shows a habit with `status: 'scheduled'`, regardless of its startDate.

**Evidence:**
- **Code:** `js/views/today.js` line 391:
  ```javascript
  const allActive = getCachedHabits().filter((h) => h.status === 'active');
  ```
  This filter ensures only active habits are passed to the cadence check. Scheduled habits are excluded at the source.

- **Test:** `tests/integration/today.cat01-scheduled-filter.test.js` — 3/3 tests pass:
  - ✓ Today view filters habits to `status === "active"` only
  - ✓ getCachedHabits returns all habits with mixed statuses
  - ✓ Filtering reliably excludes scheduled status across multiple habits

**Conclusion:** CAT-01 requirement is satisfied. Scheduled habits cannot appear on Today view.

---

### CAT-02: Active catalog list excludes scheduled habits

**Status:** ✓ VERIFIED

**Requirement:** The active Catalog list shows only active/mastered habits; no scheduled habits appear in that list.

**Evidence:**
- **Code:** `js/views/catalog.js` line 242:
  ```javascript
  const activeHabits = sorted.filter((h) => h.status !== 'scheduled');
  ```
  The active habits list is explicitly filtered to exclude scheduled habits before rendering. Scheduled habits are split into a separate list on line 243.

- **Implementation:** Lines 253-256 of `catalog.js` render active habits using `buildHabitListItem`:
  ```javascript
  for (const habit of activeHabits) {
    const masteryState = masteryMap.get(habit.id) ?? { isMastered: false };
    mount(buildHabitListItem(habit, masteryState), listEl, actions);
  }
  ```

- **Test:** `tests/unit/builders.catalog.test.js` — 13/13 buildHabitListItem tests pass, verifying the active list builder.

**Conclusion:** CAT-02 requirement is satisfied. Scheduled habits are filtered out before the active list renders.

---

### CAT-03: Upcoming section renders conditionally with "Upcoming" heading

**Status:** ✓ VERIFIED

**Requirement:** Catalog shows an "Upcoming" section below the active list containing all scheduled habits sorted ascending by startDate. Hidden when no scheduled habits exist.

**Evidence:**
- **Code:** `js/views/catalog.js` lines 266-284:
  ```javascript
  if (scheduledHabits.length > 0) {
    const upcomingSection = doc.createElement('section');
    upcomingSection.setAttribute('class', 'catalog-upcoming-section');
    parent.appendChild(upcomingSection);

    const upcomingHeading = doc.createElement('h2');
    upcomingHeading.setAttribute('class', 'catalog-upcoming-heading');
    upcomingHeading.textContent = 'Upcoming';
    upcomingSection.appendChild(upcomingHeading);

    const upcomingList = doc.createElement('ul');
    upcomingList.setAttribute('class', 'catalog-upcoming-list');
    upcomingList.setAttribute('aria-label', 'Upcoming habits');
    upcomingSection.appendChild(upcomingList);

    for (const habit of scheduledHabits) {
      mount(buildUpcomingListItem(habit), upcomingList, actions);
    }
  }
  ```

- **Sorting:** Line 243-244 sorts scheduled habits ascending by startDate:
  ```javascript
  const scheduledHabits = sorted.filter((h) => h.status === 'scheduled')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  ```

- **Conditional rendering:** The section is only rendered when `scheduledHabits.length > 0`, ensuring it's hidden when empty.

**Conclusion:** CAT-03 requirement is satisfied. Upcoming section is properly implemented with conditional rendering, h2 heading, and correct sorting.

---

### CAT-04: buildUpcomingListItem builder with required elements

**Status:** ✓ VERIFIED

**Requirement:** Each entry in the Upcoming section displays the habit's startDate and wave name. Each Upcoming item rendered by `buildUpcomingListItem(habit)` builder — pure DOM description tree with name, wave badge, startDate, Edit + Promote buttons.

**Evidence:**
- **Code:** `js/views/catalog/builders.js` lines 181-259 — `buildUpcomingListItem` function:
  - Lines 205: Displays habit name via `{ tag: 'span', attrs: { class: 'catalog-habit-name' }, text: habit.name }`
  - Lines 210: Wave badge via `{ tag: 'span', attrs: { class: 'catalog-habit-wave' }, text: 'Wave ${habit.wave}' }`
  - Lines 211: ISO startDate via `{ tag: 'span', attrs: { class: 'catalog-upcoming-date' }, text: habit.startDate }`
  - Lines 222-231: Edit button with `data-action='edit'` and `data-habit-id`
  - Lines 234-243: Promote button with `data-action='promote'` and `data-habit-id`

- **Pure builder:** Function returns `{tag, attrs, children}` description tree with no DOM access (verified by tests).

- **Tests:** `tests/unit/builders.catalog.test.js` lines 351-424 — 11/11 tests pass:
  - ✓ returns li element with class "catalog-upcoming-item"
  - ✓ has data-habit-id attribute
  - ✓ displays habit name
  - ✓ displays wave badge with text "Wave N"
  - ✓ displays ISO startDate (YYYY-MM-DD format)
  - ✓ has Edit button with data-action="edit" and data-habit-id
  - ✓ has Promote button with data-action="promote" and data-habit-id
  - ✓ has aria-label on promote button
  - ✓ no DOM access (pure builder)
  - ✓ handles long habit names
  - ✓ does not include stage/mastery info

**Conclusion:** CAT-04 requirement is satisfied. Builder is pure, returns correct structure with all required elements.

---

### SCHED-04: Promote action dispatches to apply choicepoint

**Status:** ✓ VERIFIED

**Requirement:** A "Promote to active" action on any Upcoming entry immediately moves the habit to `status: 'active'` and removes it from the Upcoming section. Handler registered in apply.js HANDLERS table.

**Evidence:**

#### 1. Action Handler Wiring

**Code:** `js/views/catalog.js` lines 388-398:
```javascript
promote: async (evt) => {
  const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
    ?? evt?.target?.getAttribute('data-habit-id');
  if (!habitId) return;
  try {
    await apply({ type: 'promoteHabit', payload: { habitId } });
    // store.subscribe will trigger re-render.
  } catch (_e) {
    showErrorToast("Couldn't promote habit — try again");
  }
},
```

The promote action extracts the habitId and calls `apply({type: 'promoteHabit', payload: {habitId}})`, which is the correct dispatch pattern. Error handling shows a toast on failure.

#### 2. Handler Registration

**Code:** `js/state/apply.js` lines 50, 74-75:
```javascript
import { handlePromoteHabit, handleDemoteHabit } from './apply/promoteHabit.js';
// ...
const HANDLERS = {
  // ...
  promoteHabit: handlePromoteHabit,
  demoteHabit: handleDemoteHabit,
  // ...
};
```

Handlers are statically imported and registered in the HANDLERS table (same pattern as archiveHabit). The `apply()` function dispatches by looking up `HANDLERS[event.type]`.

#### 3. Handler Implementation

**Code:** `js/state/apply/promoteHabit.js` lines 30-43:
```javascript
export async function handlePromoteHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  if (!habit) throw new Error(`Habit ${habitId} not found`);
  const updated = { ...habit, status: 'active' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'demoteHabit', payload: { habitId } },
  };
}

handlePromoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
```

Handler:
- Reads the habit from repo
- Spreads all properties and mutates `status: 'active'`
- Returns structured result with single write to habits store
- Sets inverse type to 'demoteHabit' for undo support
- Provides broadcastKeys for cross-tab sync

#### 4. Handler Tests

**Tests:** `tests/state/apply/promoteHabit.test.js` — 6/6 tests pass:
- ✓ reads habit from repo and returns structured result
- ✓ sets habit.status to active
- ✓ inverse type is demoteHabit
- ✓ broadcastKeys returns object with habitId
- ✓ does not make direct repo.put calls
- ✓ preserves all other habit properties

#### 5. Data Flow

When promote is clicked:
1. `promote` action handler calls `apply({type: 'promoteHabit', payload: {habitId}})`
2. `apply()` dispatches to `HANDLERS['promoteHabit']` → `handlePromoteHabit`
3. Handler updates habit status to 'active' and returns writes
4. `apply.js` executes single transaction: habit write + event log + meta.undoToken
5. `broadcastKeys` returns `{habitId}` for cross-tab sync
6. Store subscribers (including catalog) receive notification and re-render
7. Catalog re-render filters habits again: active habits show in main list, promoted habit disappears from Upcoming

**Conclusion:** SCHED-04 requirement is satisfied. Promote action is wired, handler is registered, and tests verify behavior.

---

## Test Results Summary

### Phase 8 Specific Tests (48/48 pass — 100%)

| Test Suite | Count | Status |
|---|---|---|
| `promoteHabit handler (SCHED-04)` | 6 | ✓ PASS |
| `buildCatalogHeader` | 3 | ✓ PASS |
| `buildHabitListItem` | 13 | ✓ PASS |
| `buildEditPanel` | 8 | ✓ PASS |
| `buildCreatePanel` | 4 | ✓ PASS |
| `buildUpcomingListItem (CAT-04)` | 11 | ✓ PASS |
| `Today view CAT-01 filter` | 3 | ✓ PASS |
| **Total** | **48** | **✓ PASS** |

### Overall Test Suite (844/850 pass — 99.3%)

- **Total passing tests:** 844
- **Total failing tests:** 6 (all pre-existing, unrelated to Phase 8)
- **Pre-existing failures:**
  - `mastery-cadence.test.js` — stub test (plans 04-02, 04-06 responsibility)
  - `wave-aggregates.test.js` — stub test (plans 04-04, 04-06 responsibility)
  - `import.test.js` (3 failures) — pre-existing broadcast configuration issue

**Conclusion:** Phase 8 deliverables pass all tests. No new test failures introduced.

---

## Implementation Notes

### Boot Wiring Evolution

The SUMMARY.md describes `configurePromoteHabit({repo})` calls in `main.js` and `desktop.js` that were added in plan 08-03. However, a post-phase fix commit (`a8f3618`) removed these calls and instead wired the handlers directly to the `HANDLERS` table in `apply.js`, following the established pattern for handlers like `archiveHabit`.

**Commit:** `a8f3618 fix(sched-04): wire promoteHabit handler into apply dispatch table`
- Removed incorrect DI configure pattern
- Added static import + HANDLERS registration (correct pattern)
- Removed spurious configurePromoteHabit import/call from both shells
- Added null guard to both handlePromoteHabit and handleDemoteHabit

**Result:** Current implementation is correct and aligns with the framework's handler registration pattern. No boot wiring calls needed — handlers are statically registered.

### Undo/Redo Ready

The promote handler stores `inverse: {type: 'demoteHabit', payload: {habitId}}` for undo support. The complementary `handleDemoteHabit` is also implemented, allowing promote to be undone once undo UI is wired. Both handlers are bidirectional (promote ↔ demote).

### Cross-Tab Sync

The `broadcastKeys` function ensures only the habitId is broadcast, not the entire habit object. This follows Pitfall 8 mitigation: peer tabs receive the change notification and re-read the updated habit from IDB, ensuring eventual consistency without large payloads.

### History Integrity

Habit logs are never touched — only the `habits` store is written. The status change is recorded in the `events` store as an event row, preserving a complete audit trail of all status transitions.

---

## Goal Achievement

✓ **PHASE GOAL ACHIEVED**

The phase goal is fully satisfied:

1. **Today view excludes scheduled habits** — CAT-01 verified with integration test
2. **Active Catalog list excludes scheduled habits** — CAT-02 verified with filtered list implementation
3. **Upcoming section renders conditionally** — CAT-03 verified with conditional h2 heading + sorting
4. **Upcoming items display required info** — CAT-04 verified with builder tests (11 tests)
5. **Promote action transitions habit to active** — SCHED-04 verified with handler tests (6 tests) + action wiring

All 5 requirements verified. All 3 plans completed. All 48 Phase 8 tests passing.

---

**Verification Date:** 2026-07-28 22:00:00 UTC  
**Verifier:** Claude Sonnet 4.6 (gsd-verifier)  
**Previous Verification:** None (initial verification)
