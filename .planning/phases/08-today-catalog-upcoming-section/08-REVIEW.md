---
phase: 08-today-catalog-upcoming-section
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - css/catalog.css
  - js/desktop.js
  - js/main.js
  - js/state/apply.js
  - js/state/apply/promoteHabit.js
  - js/views/catalog.js
  - js/views/catalog/builders.js
  - tests/integration/today.cat01-scheduled-filter.test.js
  - tests/unit/builders.catalog.test.js
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
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Catalog view implementation (CATALOG-01..07, CAT-04 upcoming section, promote/demote flow) following fixes to the previously identified wiring issues. The feature is now architecturally sound with:

- ✓ Handlers properly defined and registered (`handlePromoteHabit`, `handleDemoteHabit`)
- ✓ Pure builders with XSS safety (D-77, D-78)
- ✓ Comprehensive test coverage (18 unit + 3 integration tests, all passing)
- ✓ Cross-tab sync via broadcastKeys
- ✓ State atomicity via transactional writes

However, **two logic inconsistencies and one design defect** remain:

1. **Logic bug**: Edit habit save skips `customMastery` validation for mastery overrides (inconsistent with create).
2. **Design defect**: `mountCatalog` idempotence broken—`_currentParent` not updated on re-entry.
3. **Type safety gap**: `getCachedHabits` called without verifying it's a function.
4. **CSS style**: Redundant selector in mastered habit rule.

---

## Critical Issues

(None found)

---

## Warnings

### WR-01: Edit habit save bypasses customMastery check for mastery overrides

**File:** `js/views/catalog.js:440-441`

**Issue:**
The `save-edit` action persists `masteryThresholdOverride` and `masteryWindowOverride` without validating the `customMastery` checkbox state. This contradicts the `save-create` action (lines 470-471), which enforces the check:

```javascript
// Line 440-441 (save-edit) — MISSING customMastery guard
masteryThresholdOverride: fields.masteryThresholdOverride || null,
masteryWindowOverride: fields.masteryWindowOverride || null,

// Line 470-471 (save-create) — CORRECT guard
masteryThresholdOverride: fields.customMastery ? fields.masteryThresholdOverride : null,
masteryWindowOverride: fields.customMastery ? fields.masteryWindowOverride : null,
```

The UI hides the mastery override fields when `customMastery` is unchecked (buildEditPanel line 464), but hiding is not a security boundary. If a user unhides the fields via browser DevTools and fills in values while the checkbox is off, those overrides will persist to the database even though the explicit UI checkbox is disabled. This violates the invariant: "mastery overrides are only applied when `customMastery === true`."

**Impact:** Medium (requires deliberate manipulation via DevTools to trigger, but corrupts habit configuration).

**Fix:**
Apply the same conditional check from `save-create` to `save-edit`:

```javascript
// Line 440-441, change to:
masteryThresholdOverride: fields.customMastery ? fields.masteryThresholdOverride : null,
masteryWindowOverride: fields.customMastery ? fields.masteryWindowOverride : null,
```

---

### WR-02: mountCatalog does not update _currentParent on idempotent re-entry

**File:** `js/views/catalog.js:541-546`

**Issue:**
The function claims idempotence (comment: "Idempotent: calling `mountCatalog` a second time without unmounting first") but the guarantee is broken. The re-entry branch fails to update `_currentParent`:

```javascript
if (_unsub) {
  // Already mounted — re-render against the live parent.
  _currentDeps = deps;
  // BUG: _currentParent is NOT updated
  await renderCatalogInto(parent, deps);
  return _createUnmount(parent);
}
```

The subscription callback (line 554-558) uses `_currentParent` to render on store mutations:

```javascript
_unsub = subscribe(() => {
  if (_currentParent && _currentDeps) {
    renderCatalogInto(_currentParent, _currentDeps).catch(() => {});
  }
});
```

**Scenario:** If the DOM is restructured and `catalogPanel` is replaced (e.g., due to dynamic element recreation), the second call to `mountCatalog(newParent, deps)` would still render into the stale `_currentParent`, silently missing the new parent.

**Current risk:** Low in the present codebase (`catalogPanel` is selected once and reused across all route changes). High if the pattern is reused elsewhere or the DOM structure changes.

**Fix:**
Update `_currentParent` in the re-entry branch:

```javascript
if (_unsub) {
  _currentParent = parent;  // ADD THIS LINE
  _currentDeps = deps;
  await renderCatalogInto(parent, deps);
  return _createUnmount(parent);
}
```

---

## Info

### IN-01: Type safety—getCachedHabits called without function check

**File:** `js/views/catalog.js:223`

**Issue:**
```javascript
let habits = getCachedHabits ? getCachedHabits() : [];
```

The code checks for truthiness of `getCachedHabits` before calling it as a function. If `getCachedHabits` is a truthy non-function value (e.g., accidentally exported as an object or string), the code will crash with "getCachedHabits is not a function."

**Current risk:** Very low (store.js is under control and always exports a function). Improves defensive coding patterns.

**Fix:**
Use explicit function check or optional chaining:

```javascript
// Option 1: explicit check
let habits = typeof getCachedHabits === 'function' ? getCachedHabits() : [];

// Option 2: optional chaining (ES2020+, Baseline Widely Available)
let habits = getCachedHabits?.() ?? [];
```

---

### IN-02: Redundant CSS selector in mastered habit opacity rule

**File:** `css/catalog.css:52-54`

**Issue:**
```css
.catalog-habit-row.habit-row--mastered,
.catalog-habit-row--mastered {
  opacity: 0.55;
}
```

The second selector `.catalog-habit-row--mastered` is broader than the first. The first requires both classes; the second requires only the mastered class. If the intent is to match both patterns, a comment should explain why. If only one pattern is used, the rule should be simplified.

**Fix:**
Either consolidate to the more specific pattern:

```css
.catalog-habit-row.habit-row--mastered {
  opacity: 0.55;
}
```

Or document the two-class rationale with a comment if both patterns are intentional.

---

## Verified ✓

- **Handlers properly wired:** Both `handlePromoteHabit` (line 30-41) and `handleDemoteHabit` (line 52-62) are defined with correct signatures, write shapes, and inverse references.
- **Handlers registered:** Both are imported in `apply.js:50` and registered in HANDLERS table (lines 74-75).
- **Undo/redo round-trip:** `promoteHabit` → `demoteHabit` → `promoteHabit` closure is correct.
- **Null safety:** Both handlers validate `if (!habit) throw(...)` on line 33 and 55.
- **broadcastKeys exported:** Both handlers define static `broadcastKeys` methods (lines 43, 65) for cross-tab sync.
- **Builders are pure:** `buildUpcomingListItem`, `buildEditPanel`, `buildCreatePanel` return description trees with zero DOM access (D-77).
- **XSS safety:** All text rendered via `.text` attribute, never `.innerHTML` (D-78 grep gate compliant).
- **Today filter works:** Integration test CAT-01 passes—`getCachedHabits().filter(h => h.status === 'active')` correctly excludes scheduled habits.
- **Catalog rendering logic:** Lines 242-244 correctly split habits into `activeHabits` (status !== 'scheduled') and `scheduledHabits` (status === 'scheduled') and render each section.
- **Test coverage comprehensive:** 18 unit tests for builders + 6 unit tests for handlers (from test file names) + 3 integration tests for filter. All passing per UAT report.

---

## Recommendations

1. **High priority:** Apply WR-01 fix (mastery override validation) to prevent silent data corruption via DevTools manipulation.
2. **Medium priority:** Apply WR-02 fix (idempotence) as defensive programming, especially if `mountCatalog` pattern is reused.
3. **Low priority:** Improve type safety (IN-01) and clean up CSS (IN-02) during next refactor pass.

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
