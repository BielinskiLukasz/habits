# Backlog

Ideas and issues captured during phase work for consideration in future milestones. Not commitments.

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

## Captured 2026-06-30

### Fix import JSON UI label

**Issue:** The import control in Settings → Data is a raw `<input type="file">` with no visible label. Browsers render it as "Choose File" — the user has no indication it's for importing a JSON backup.

**Current:** `builders.js` renders the `<input>` with only an `aria-label="Import JSON backup file"` (screen-reader only). No visible `<label>` or adjacent text.

**Expected:** A visible "Import JSON" label or a styled button wrapper so the action is self-explanatory without relying on context.

**Effort:** Low — add a `<label for="import-file-input">` in `settings/builders.js`.

---

### Move waves to a first-class data model

**Issue:** Wave is a plain string field on each habit (e.g. `wave: "Fala 1"`). There is no `waves` IDB store — no wave-level metadata (description, start date, color, order) can be stored, and wave CRUD is impossible without touching every habit row.

**Current:** Wave grouping is purely derived at query time from the `habits.wave` index. Wave identity = the string value.

**Desired:** A dedicated `waves` IDB store with its own UUID, label, order, optional description/color, and date range. Habits reference a wave by ID. Enables wave creation, editing, reordering, and richer analytics groupings.

**Dependencies:** Requires a v2 IDB migration (additive — new store only), an update to seed loader, and changes to all habit CRUD paths that currently write the wave string.

**Note:** The existing "Cannot add waves" backlog entry (Phase 4 UAT findings) is a UI gap; this is the underlying data model prerequisite for that feature.

**Effort:** High — schema migration + seed update + CRUD + all views that group by wave.

---

## Debug session findings (2026-07-05)

### Today view mastery badge not rendered (Gap 3 from debug/mastery-badge-propagation)

**Issue:** The Today view never displays a mastery badge for habits that have crossed the mastery threshold. `buildTodayRow`, `buildNumericRow`, and `buildSlotRow` in `today/builders.js` accept no `isMastered` parameter and contain zero mastery-related rendering code.

**Root cause (partially fixed):** The write path (`scoreSnapshots.js`) now persists `isMastered` on every snapshot row (fixed in debug session). The read path in Today is the remaining gap: `today.js` does not read `score_snapshots` and the builder functions do not accept or render `isMastered`.

**What needs doing:**
1. `today.js` — fetch today's snapshot rows (or a per-habitId lookup) and pass `isMastered` through to each builder call.
2. `buildTodayRow`, `buildNumericRow`, `buildSlotRow` — accept an `isMastered` boolean param and conditionally render a mastery badge (same `.mastery-badge` element used in catalog).
3. (Optional) Cache snapshot reads alongside habit list to avoid per-habit async overhead in the render loop.

**Related files:** `js/views/today/builders.js`, `js/views/today.js`, `js/io/scoreSnapshots.js` (read side via `repo.getLatestSnapshot`).

**Effort:** Low-Medium — builder changes are mechanical; the main work is wiring the snapshot read into the today render loop without blocking UX.

**Prerequisite for mastery promotion flow:** Mastery badge visibility in Today is required before users can act on promotion suggestions (future phase).

---

## Unscheduled features

### Slot collapse behavior after selection

**Goal:** Captured for future planning.

**Description:** When a user selects slots in a slot-checklist habit and reaches the target, define whether the slot row collapses or remains open.

**Requirements:** TBD

**Status:** Needs scoping before planning.

---

### Override global mastery settings not working in custom mastery

**Goal:** Captured for future planning.

**Description:** Custom per-habit mastery threshold/window settings may not properly override global defaults in some edge cases. Needs investigation and fix.

**Requirements:** TBD

**Status:** Needs scoping before planning.

---

### Add edit history capability for numeric and slot habits

**Goal:** Captured for future planning.

**Description:** Numeric and slot-checklist habit logs should support edit history (correct a previously-logged value) similar to the undo capability for binary habits.

**Requirements:** TBD

**Status:** Needs scoping before planning.

---

### Every-N-days cadence: reset on both completion AND undone

**Goal:** Captured for future planning.

**Description:** For habits with "every N days" cadence, the habit should be considered unfinished/undone if N days have passed since either the last completion OR the last time it was explicitly marked undone. Currently the logic may only track the last completion timestamp, causing habits to incorrectly show as not-yet-due when they should re-appear because they've exceeded the N-day threshold from their last undone state.

**Requirements:** TBD

**Status:** Needs scoping before planning.

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
