---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - js/views/catalog/builders.js
  - js/views/catalog.js
  - css/catalog.css
  - js/views/history/builders.js
  - js/views/history.js
  - css/history.css
  - js/views/today/builders.js
  - js/views/today.js
  - seed/habits.json
  - sw.js
  - tests/integration/sw.shell.test.js
  - tests/unit/seed.shape.test.js
  - js/util/version.js
  - VERSIONING.md
  - README.md
  - index.html
  - js/main.js
  - css/main.css
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z  
**Depth:** standard  
**Files Reviewed:** 18  
**Status:** issues_found

## Summary

Phase 04 introduces the core domain model (catalog CRUD, stages, mastery evaluation, multi-occurrence logging, history navigation). The implementation is well-structured with clean separation between builders and mount functions, consistent error handling, and strong XSS discipline via textContent-only rendering. However, two Critical issues were identified:

1. **CSS Cascade Layer mismatch** — `css/history.css` is imported into an undeclared `history` layer, breaking the documented layer architecture and creating unintended specificity.
2. **Stale closure capture in history toggle handlers** — The `logsForDate` array is captured at render time but re-renders invalidate it, causing toggle handlers to operate on stale data without re-fetching.

Additionally, five Warnings flag edge cases around mastery evaluation context construction, optional-chaining safety, and form field handling that should be hardened before production.

---

## Critical Issues

### CR-01: CSS Cascade Layer Import Mismatch — Undeclared `history` Layer

**File:** `css/main.css:29`  
**Issue:** Line 29 imports `history.css` into a `history` layer: `@import url("./history.css") layer(history);`. However, the layer declaration on line 20 does NOT include `history` in its ordered list: `@layer reset, tokens, base, layout, components, view, utilities;`.

Per CSS Cascade Layers spec, undeclared layers (those not present in the `@layer` declaration) are treated as implicit layers and placed AFTER all declared layers in the cascade order. This means rules in `history.css` have **higher specificity than the `view` layer**, breaking the documented architecture which states history should be part of the `view` layer (lines 11-13 comment).

**Impact:** History view styles may override other view styles unintentionally. Since both `history.css` and `today.css` / `settings.css` use the same CSS custom properties and component classes (e.g., `.history-habit-status`, `.today-row`), the specificity inversion could cause layout breakage when switching between views.

**Fix:**  
Change line 20 from:
```css
@layer reset, tokens, base, layout, components, view, utilities;
```
to:
```css
@layer reset, tokens, base, layout, components, view, utilities;
```

And change line 29 from:
```css
@import url("./history.css")    layer(history);
```
to:
```css
@import url("./history.css")    layer(view);
```

This places history styles in the `view` layer alongside `today.css` and `settings.css`, honoring the documented architecture.

---

### CR-02: Stale Closure Capture in History Toggle Handlers — Logs Array Not Re-fetched After Render

**File:** `js/views/history.js:196-211`  
**Issue:** The `toggle-log` action handler (lines 196-211) captures `logsForDate` from the outer `render()` function's scope. This array is fetched fresh at line 89 during render. However, when the handler calls `render(selectedDate)` at line 210 to re-render after marking a log, the closure still references the **old** `logsForDate` array.

On subsequent toggles without a full page reload, the handler evaluates `currentLog` (line 200) against stale log data that no longer reflects the database state. This causes incorrect toggle decisions:

- If a habit was just marked complete, the stale `logsForDate` still shows the prior state (not completed), causing the next toggle to mark it uncompleted again instead of toggling to completed.
- The same stale array is also used in the bulk-action filter at lines 173-175 (`notYetCompleted = rows.filter(r => r.log === null || r.log.completed !== true)`), applying the stale filter to a fresh `rows` list.

**Scenario:**
1. User views history for 2026-01-15 (logs fetched in `logsForDate`).
2. User clicks toggle for "Morning walk" — `apply({ type: 'markCompleted' })` succeeds.
3. `render(selectedDate)` is called, re-fetching `logsForDate` from IDB into a new array.
4. Closure still references the OLD `logsForDate` array.
5. User clicks toggle again — `currentLog` is looked up in the OLD array, finds it still marked incomplete, and calls `markCompleted` again (expected: toggle to incomplete).

**Fix:** The `render()` function already has a closure-based pattern for the `prev-day` and `next-day` handlers (lines 130-139), which use closure variables (`selectedDate`). For the toggle and bulk-action handlers, capture `logsForDate` and `rows` as mutable references, or re-fetch them inside the handler:

```javascript
'toggle-log': async (evt) => {
  const btn = evt.currentTarget;
  const habitId = btn.getAttribute('data-habit-id');
  const logDate = btn.getAttribute('data-date') || selectedDate;
  // Re-fetch logs for the selected date to avoid stale closure
  const freshLogs = await repo.getLogsForDate(logDate);
  const currentLog = freshLogs.find((l) => l.habitId === habitId) ?? null;
  try {
    if (currentLog?.completed === true) {
      await apply({ type: 'markUncompleted', payload: { habitId, date: logDate } });
    } else {
      await apply({ type: 'markCompleted', payload: { habitId, date: logDate } });
    }
  } catch (_e) {}
  render(selectedDate);
},
```

Similarly, update the `bulk-mark-uncompleted` handler to use fresh `rows` data:

```javascript
'bulk-mark-uncompleted': async () => {
  // Re-fetch to ensure notYetCompleted is evaluated against fresh data
  const freshLogs = await repo.getLogsForDate(selectedDate);
  const freshHabits = await repo.getAllHabits();
  // Rebuild rows with fresh data...
  const notYetCompleted = freshRows.filter(r => r.log === null || r.log.completed !== true);
  for (const { habit } of notYetCompleted) {
    try {
      await apply({ type: 'markUncompleted', payload: { habitId: habit.id, date: selectedDate } });
    } catch (_e) {}
  }
  render(selectedDate);
},
```

---

## Warnings

### WR-01: Unsafe Defaults in `buildMasteryCtx()` — Function Existence Not Checked

**File:** `js/views/catalog.js:79-91`  
**Issue:** The `buildMasteryCtx()` function checks if `getCachedSettings` is defined (line 80) and `getCachedWeekStart` is defined (line 81), but line 87 calls `getCachedWeekCompletions(habitId, start, end)` **without checking if it exists first**.

If the store module has not exposed `getCachedWeekCompletions` on import, the line 87 assignment will silently create a reference to an undefined function, and later calls to `ctx.weekCompletions(...)` will fail with `TypeError: getCachedWeekCompletions is not a function`.

**Impact:** Low to Medium — the function is only called during mastery evaluation in catalog render, which is wrapped in a try-catch at line 114-121. However, a missing function would be swallowed silently, and the habit's mastery state would default to `isMastered: false` without diagnostic visibility.

**Fix:** Add a safety check:
```javascript
weekCompletions: (habitId, start, end) => 
  typeof getCachedWeekCompletions === 'function' 
    ? getCachedWeekCompletions(habitId, start, end) 
    : 0,
```

---

### WR-02: Missing Null Check on `habit` Object Before Stage Access

**File:** `js/views/catalog/builders.js:73-74`  
**Issue:** In `buildHabitListItem()`, line 73 accesses `habit.stages[habit.currentStageIndex]` without first checking if `habit.stages` exists or is an array. If a habit row is loaded from IDB without the `stages` array (e.g., from an older schema or partial load), the code will throw when indexing.

```javascript
const currentStage = habit.stages[habit.currentStageIndex];  // may error if habit.stages is undefined
```

**Impact:** Low — the seed file and schema migrations should always include `stages` as an array (even empty). However, defensive code is safer if the schema evolves or imports are malformed.

**Fix:**
```javascript
const currentStage = habit.stages?.[habit.currentStageIndex];
const stageLabel = currentStage?.label ?? '';
```

---

### WR-03: History View — `getAttribute('data-date')` Not Validated for Valid YYYY-MM-DD Format

**File:** `js/views/history.js:199`  
**Issue:** The toggle handler reads `logDate = btn.getAttribute('data-date') || selectedDate` (line 199). The `data-date` attribute is set by the builder at line 194, but there is no validation that the value is a valid YYYY-MM-DD string. If the builder or mount process corrupts the attribute, the handler will pass an invalid date string to `apply({ ... payload: { habitId, date: logDate } })`, which may fail silently or corrupt the log.

**Impact:** Low — the builder always sets `data-date` to the `date` parameter passed in (which is `selectedDate`, a valid YYYY-MM-DD). However, if the DOM is mutated manually (e.g., via DevTools or a third-party script), invalid dates could propagate.

**Fix:** Add a simple format check in the handler:
```javascript
const logDate = btn.getAttribute('data-date') || selectedDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
  console.error(`Invalid date format in data-date: ${logDate}`);
  return;
}
```

---

### WR-04: Catalog Field Collection — Stage Row May Have Missing Input Elements

**File:** `js/views/catalog.js:171-172`  
**Issue:** In `collectPanelFields()`, the stage-row collection assumes that `.querySelector('[data-field="stage-label"]')` will always find an element (line 171). If the selector returns null, the code at line 173 will read `labelInput.value` and fail with `TypeError: Cannot read property 'value' of null`.

While the current builder always creates both label and target inputs for each row (builders.js:771-789), if the builder is later modified or if the DOM is manually mutated, missing inputs could cause a crash.

**Impact:** Low to Medium — the form submission is wrapped in a try-catch at line 365 in the `save-edit` action, which will catch the error. However, the error is swallowed silently without user feedback.

**Fix:** Add null checks:
```javascript
const label = labelInput ? labelInput.value : '';
const targetVal = targetInput ? targetInput.value.trim() : '';
```

This is already present in the code (lines 173-174), so no fix is needed. **Status: VERIFIED SAFE**

---

### WR-05: Mastery Evaluation Context — `appliesToday` Function Reference in Context Object

**File:** `js/views/catalog.js:85`  
**Issue:** The `buildMasteryCtx()` function at line 85 creates a context object with `appliesToday: (habit, date, ctx) => appliesToday(habit, date, ctx)`. This creates a wrapper closure that calls the module-imported `appliesToday` function. While this is not a bug, it's unnecessary indirection — the context object is passed to `evaluateMastery()`, which expects a context with callable properties. 

The pattern is inconsistent with the direct function references in the same object (`monthCompletions: () => 0`, `weekCompletions: ...`). The wrapper adds cognitive load without benefit.

**Impact:** Very Low — this is a code-quality issue, not a correctness issue.

**Fix:** Simplify to:
```javascript
appliesToday,
```

This is a direct reference to the imported function and is more readable.

---

## Info

### IN-01: Dead Code — `clearChildren()` Function Not Used in Catalog Mount

**File:** `js/views/catalog.js:70-72`  
**Issue:** The `clearChildren()` helper function is defined but never called in the catalog.js file. The `renderCatalogInto()` function at line 225 does clear children via the direct loop pattern, but does not use the helper.

**Impact:** Very Low — the function is not harmful, but it's dead code that could be removed for clarity.

**Fix:** Remove the `clearChildren()` function or use it consistently across all mount modules (today.js, settings.js, history.js also define identical `clearChildren()` helpers).

---

### IN-02: Redundant Optional Chaining in `buildMasteryCtx()`

**File:** `js/views/catalog.js:80-81`  
**Issue:** Lines 80-81 check if `getCachedSettings` and `getCachedWeekStart` are defined before calling them:

```javascript
const cachedSettings = getCachedSettings ? getCachedSettings() : {};
const weekStart = getCachedWeekStart ? getCachedWeekStart() : 'mon';
```

While defensive, these checks are redundant if the store module is always properly configured during boot (lines 84 in main.js: `configureStore({ repo })`). The checks add cognitive load; a clearer approach is to assume the functions are always available (per module contract) or add explicit error handling at initialization time.

**Impact:** Very Low — defensive programming is safe, but this pattern is not applied consistently in other view modules.

**Fix:** Either remove the checks (trust the module contract) or document why they are necessary.

---

### IN-03: History Empty State Message — No Localization Support

**File:** `js/views/history.js:165`  
**Issue:** The history view hard-codes an English message "No applicable habits for this day." This is consistent with the project's UI-language constraint (English primary per CLAUDE.md). However, the message is not extracted to a constants file or configuration, making it harder to update if localization is added later.

**Impact:** Very Low — this is a future-proofing issue, not a correctness issue.

**Fix:** Extract to a module-level constant for consistency with other views (though this is not yet done anywhere in the codebase).

---

## Summary of Findings

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | CR-01, CR-02 |
| Warning | 5 | WR-01 through WR-05 |
| Info | 3 | IN-01 through IN-03 |
| **Total** | **10** | — |

**Next Steps:**
1. Fix CR-01 (CSS layer import) immediately — this affects layout correctness.
2. Fix CR-02 (stale closure in history toggle) immediately — this causes data corruption.
3. Address WR-01 and WR-02 before shipping Phase 04 — defensive null checks prevent silent failures.
4. WR-03, WR-04, WR-05 are edge cases; prioritize based on available time.
5. IN-01 through IN-03 are code-quality improvements; address in a post-review cleanup pass if time permits.

---

_Reviewed: 2026-06-05T00:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
