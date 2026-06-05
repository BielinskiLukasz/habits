# Backlog

Ideas captured during phase work for consideration in future milestones. Not commitments.

---

## Phase 4 UAT findings (2026-06-05)

### Completion visualization for numeric/slot habits

**Issue:** When a numeric or slot-checklist habit reaches its daily target, no visual indicator (checkmark, strikethrough, "complete" styling) shows like binary habits do.

**Current:** Only binary habits show the `habit-row--complete` class and visual feedback.

**Expected:** Numeric and slot rows should also highlight or show a checkmark when `count >= target`.

**Effort:** Low — add `habit-row--complete` logic to `buildNumericRow()` and `buildSlotRow()` in `today/builders.js`.

---

### Polish name button (ⓘ) missing for numeric/slot habits

**Issue:** The ⓘ button to reveal `name_pl` only renders for binary habits (line 168 in `today/builders.js`).

**Current:** `buildTodayRow()` includes the button; `buildNumericRow()` and `buildSlotRow()` omit it.

**Expected:** All habit types should offer Polish name reveal.

**Effort:** Low — refactor button into a shared helper, add to numeric/slot row children.

---

### Create/Edit forms open at bottom (not inline)

**Issue:** When creating a new habit or editing an existing one, the form slides in below the catalog list instead of appearing inline (like editing does in catalog.js).

**Current:** Forms use `data-panel="create"` / `data-panel="edit"` at the top level.

**Expected:** Forms should replace the habit row or stack at the top like they do in catalog view.

**Effort:** Medium — requires rethinking Today/History form positioning; may need a modal or overlay approach.

---

### Edit and Archive buttons should be in same row

**Issue:** Edit and Archive buttons stack vertically on mobile, taking extra space.

**Current:** `.catalog-habit-actions` uses `flex-direction: column`.

**Expected:** Buttons in one row, or responsive (row on desktop, wrap on mobile).

**Effort:** Low — CSS flexbox change + optional media query.

---

### Archive habit styling indistinguishable from other buttons

**Issue:** Archive button looks identical to Edit button; no visual difference to warn it's a destructive action.

**Current:** Only `catalog-btn--archive` class; no distinct styling.

**Expected:** Archive button should be red/warning color to signal destructiveness.

**Effort:** Low — add CSS rule for `.catalog-btn--archive` with `background: var(--color-error, #ef4444)`.

---

### Cannot add waves

**Issue:** No UI to create or manage waves. User must rely on seed data or manual IDB edits.

**Current:** Waves are static from seed data; no create/edit/delete waves UI.

**Expected:** Wave management panel (add, edit, delete waves).

**Effort:** High — requires new IDB schema (waves store), CRUD handlers, UI (catalog subsection or settings panel).

---

## Post-v1 explorations

### Install card: predict-and-override platform switch

**Source:** UAT Phase 3 Test 14 (2026-05-28, lukasz.bielinski).

**Idea:** Replace the current "show all three labeled subsections" Install card with a predicted-platform-first card (e.g. show iOS instructions on Safari/iOS UA) + an override control to flip to Android Chrome / Desktop browsers.

**Current (locked, D-61 + 03-DISCUSSION-LOG.md Q3):** All three subsections render simultaneously with no detection. User explicitly chose this over "Feature-test first, UA as fallback" or "UA-only switch" during Phase 2 questioning.

**When to revisit:** If Install help grows so long it becomes hard to scan, or if there's evidence users scroll past the wrong-platform sections. For v1 there's no signal in either direction.

**Cost of switching:**
- Add UA detection (`navigator.userAgent`) or persistent platform setting in IDB.
- Add a 3-segment toggle / radio for override.
- New IDB key for the override (or live in `settings` store).
- Risk: detection drift (every new device/browser breaks the guess).

**Cost of staying:** A few extra inches of vertical scroll on the Install card — only encountered when consulting install help, which is once-per-device.

**Disposition:** Park for post-v1. Revisit if a user complaint or instrumentation signal surfaces.
