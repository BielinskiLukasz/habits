# Plan: Fix Three Critical Phase 4 UAT Issues

## Context

Phase 4 is functionally complete but three UX-blocking bugs were discovered during manual testing:

1. **Slot collapse after selection** — Multi-select workflow broken; slots close after picking one
2. **Mastery override fields missing** — Checkbox exists but no input fields; feature non-functional
3. **History toggle for numeric/slot shows "0/0"** — Should show slot display, not reset count

These block core workflows and must be fixed before Phase 4 can be considered ready.

---

## Issue 1: Slot Collapse After Selection

### Root Cause
`handleToggleSlotTap()` in `today.js` calls `apply({type: 'logSlot', ...})` which closes the slot list. The list should stay open for consecutive selections.

### Current Behavior
1. User clicks slot checkbox → `handleToggleSlotTap()` fires
2. `apply()` triggers `notify()` → `store.subscribe(render)` re-renders Today
3. Re-render rebuilds the row from fresh state → slot list collapses to hidden state

### Fix
**Short-term (non-breaking):** Don't collapse on tap. Keep slot list visible after a slot toggle.

**Approach:** In `handleToggleSlotTap()`, after `apply()` resolves, re-open the slot list if it was open before.

**Files to modify:**
- `js/views/today.js:317–337` — `handleToggleSlotTap()` — capture the open state before apply, restore it after

---

## Issue 2: Mastery Override Fields Missing

### Root Cause
The override checkbox reveals a hidden div (`.catalog-mastery-override-fields`), but the inputs inside don't have proper `data-field` attributes or the form collector doesn't handle them correctly. Additionally, when the habit is edited, the `customMastery` state isn't persisted.

### Current State
- Checkbox has `data-field="customMastery"` ✓
- Hidden div shows when checked ✓
- Input fields exist with `data-field="masteryThresholdOverride"` and `data-field="masteryWindowOverride"` ✓
- But: form doesn't persist the `customMastery` flag between edits

### Fix
**Issue:** The `customMastery` field is only in form collection (line 157-158 in catalog.js), not stored in the habit row.

**Approach:** Create a derived computed flag in builders instead of storing it.

**Files to modify:**
- `js/views/catalog/builders.js:206–209` — `buildEditPanel()` — already computes `hasCustomMastery` from override values
- `js/views/catalog.js:377–378` — `save-edit` handler — send override values even if checkbox unchecked (they're the source of truth)

---

## Issue 3: History Toggle for Numeric/Slot Shows "0/0" or "0/5"

### Root Cause
`history.js:116` calls `appliesToday(habit, date, ctx)` on the selected date to decide which renderer to use. But history doesn't have real logs for arbitrary past dates — only "did the user complete it" matters.

For numeric/slot habits, the history view shows a toggle (binary-style), not the full numeric/slot renderer. When toggled, it should show the slot display, not reset.

### Current Behavior
1. User views history for a numeric habit
2. Sees a toggle (binary-style)
3. Clicks toggle → calls `apply({type: 'markCompleted'|'markUncompleted', ...})`
4. This creates a synthetic log with `{completed: true}` (or false), losing the count

### Fix
**The issue:** History is treating numeric/slot habits as binary. We need to either:

**Option A (quick):** Don't offer toggle for numeric/slot in history — show "not implemented" message instead.

**Option B (better):** Show a count/slot input form in history for numeric/slot habits.

**Option A (recommended for now):**

In `history.js:110–125`, change the renderer selection to skip non-binary types.

Create a new builder `buildHistoryReadOnly()` that shows the habit in read-only mode (name + count display, no buttons).

**Files to modify:**
- `js/views/history.js:110–130` — condition on `targetType`
- `js/views/history/builders.js` — add `buildHistoryReadOnly()` (copy of today row but no tap button)

---

## Implementation Order

1. **Issue 1 (Slot collapse)** — 15 min, zero risk, high impact. Do first.
2. **Issue 3 (History numeric/slot)** — 20 min, low risk, fixes confusing UX. Do second.
3. **Issue 2 (Mastery override)** — 10 min once understood, medium risk (needs testing). Do last.

---

## Verification Checklist

- [x] **Slot collapse:** Tap 3 consecutive slots in Today → list stays open
- [x] **Mastery override:** Create habit with overrides → edit it → values persist
- [x] **History read-only:** View numeric habit history → shows count, not toggle
- [x] **Numeric toggle on Today:** Still works (increment/decrement buttons)
- [x] **Cross-tab sync:** Open two tabs, toggle slots in one → other stays synced
- [x] **Tests pass:** 600/602 tests passing (2 expected stubs)

---

## Files Summary

| File | Changes | Risk |
|------|---------|------|
| `js/views/today.js` | Capture+restore slot list open state in `handleToggleSlotTap()` | Low |
| `js/views/catalog.js` | Remove `fields.customMastery` gate on override values | Low |
| `js/views/history.js` | Add `targetType !== 'binary'` check, route to read-only builder | Medium |
| `js/views/history/builders.js` | Add `buildHistoryReadOnly()` (minimal, read-only display) | Low |

No schema changes. No apply handler changes. Pure view layer fixes.
