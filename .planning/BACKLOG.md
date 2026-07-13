# Backlog

Ideas and scope items captured outside the active roadmap. Anything here is *not* in v1 — it has either been deferred by explicit decision, surfaced during UAT, or earmarked for a later milestone. Items graduate to a `ROADMAP.md` phase when picked up (`/gsd-review-backlog` to promote, `/gsd-phase add` to materialize).

Last updated: 2026-07-13 (reformatted all items to B-NNN standard; assigned IDs B-001–B-014)
Last assigned ID: **B-014** — next new item must be **B-015**

---

## How to use this file

- **Adding an item:** increment the "Last assigned ID" counter at the top, then drop a new `### B-NNN` block with Source / Status / Earliest slot / What / Why / Open questions / Implementation notes. IDs are monotonic and never reused — even if the previous entry was promoted or removed.
- **Promoting an item:** `/gsd-review-backlog` (interactive) — moves a chosen item into the active milestone roadmap. Or manually run `/gsd-phase add` and reference the backlog ID in the phase description.
- **Removing an item:** delete the block or move it under a `## Rejected` heading with a one-line rationale (decisions cost; keep the rationale).
- **Memory ↔ backlog:** memory captures "this idea exists and here's the context"; this file is the project-level decision queue. Memory is the source for cross-session continuity; this file is the source for milestone planning. Update both when an item lands.

## Related

- `ROADMAP.md` — active milestone phases
- `milestones/v1.0-REQUIREMENTS.md` — v1.0 archived requirements (all 51 complete)
- `PROJECT.md` — core constraints (single subject v1, no build step, no frameworks)
- `CLAUDE.md` — v1/v2 split rules

---

## Phase 4 UAT findings (2026-06-05)

### B-001 · Completion visualization for numeric/slot habits

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** When a numeric or slot-checklist habit reaches its daily target, show the same visual completion indicator (checkmark, strikethrough, `habit-row--complete` class) that binary habits already display.

**Why:** Binary habits give clear done-state feedback the moment they're completed; numeric and slot habits silently reach their target with no visual reward. The inconsistency breaks the "finished for today" mental model and leaves the user wondering whether the tap registered.

**Open questions when this gets planned:**

- Should numeric and slot completion also trigger the vibration tap that binary completion does?
- Is "count ≥ target" the only condition, or should over-logging (count > target) be styled differently?

**Implementation notes:**

- Add `habit-row--complete` logic to `buildNumericRow()` and `buildSlotRow()` in `today/builders.js` — mirror the existing binary check.
- Effort: Low.

---

### B-002 · Polish name button (ⓘ) missing for numeric/slot habits

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** The ⓘ button that reveals `name_pl` only renders for binary habits (line 168 in `today/builders.js`). Numeric and slot rows omit it, so those habits have no bilingual name reveal.

**Why:** All habit types carry a `name_pl` field from the seed; hiding the reveal affordance on two of three types creates an arbitrary and unexplained inconsistency in the daily check-in view.

**Open questions when this gets planned:**

- Should the shared helper live in `today/builders.js` or a sibling utility module?

**Implementation notes:**

- Refactor the ⓘ button construction into a shared helper function.
- Call the helper from `buildNumericRow()` and `buildSlotRow()` alongside the existing `buildTodayRow()` call.
- Effort: Low.

---

### B-003 · Create/Edit forms open at bottom, not inline

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass or a dedicated forms-UX suB-0plan

**What:** When creating a new habit or editing an existing one, the form slides in below the full catalog list instead of appearing near the habit row being edited or as a focused overlay.

**Why:** The displaced form position loses visual context — the user can no longer see the habit they are editing once the form renders at the bottom. Inline or modal-anchored editing is the expected pattern for list-item editing.

**Open questions when this gets planned:**

- Modal overlay vs. inline replacement of the habit row?
- Should Today view and History view use the same form positioning as Catalog, or is their use-case different enough to warrant separate treatment?
- Does the fix require a shared form component or can it stay in per-view builders?

**Implementation notes:**

- `data-panel="create"` / `data-panel="edit"` currently render at the top-level panel level; need to move rendering anchor closer to the triggering row.
- Effort: Medium.

---

### B-004 · Edit and Archive buttons should be in the same row

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** Edit and Archive buttons in the Catalog habit card stack vertically on mobile, consuming more vertical space than necessary.

**Why:** Vertical stacking wastes screen real-estate on the primary mobile surface. Side-by-side buttons are the conventional pattern for paired primary/destructive actions and save a full button-height of scroll.

**Open questions when this gets planned:**

- Wrap on very narrow viewports (< 320 px) or always force one row?

**Implementation notes:**

- Change `.catalog-habit-actions` from `flex-direction: column` to `flex-direction: row`.
- Add an optional `flex-wrap: wrap` media query for very narrow viewports.
- Effort: Low.

---

### B-005 · Archive button visually indistinguishable from Edit

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** The Archive button in the Catalog card looks identical to the Edit button — same size, same color, no destructive-action signaling.

**Why:** Archiving a habit is a consequential action (removes it from the daily view). Without visual differentiation, a user scanning quickly can trigger it accidentally. Destructive actions must look different from safe ones.

**Open questions when this gets planned:**

- Add a confirmation step (e.g., "Are you sure?") in addition to the color change, or rely on color alone?
- Use the existing `--color-error` token or introduce a `--color-destructive` alias?

**Implementation notes:**

- Add a CSS rule for `.catalog-btn--archive` using `background: var(--color-error, #ef4444)` and a contrasting text color.
- Effort: Low.

---

### B-006 · Cannot add or manage waves via UI

**Status:** captured · not scheduled
**Earliest sensible slot:** post-B-038 (waves data model must land first); likely a dedicated post-v1 phase

**What:** There is no UI to create, rename, or reorder waves. The user depends entirely on seed data or manual IDB edits to introduce a new wave.

**Why:** Waves are a first-class organizing primitive in the Nawyki system. Adding new habits to new waves is a natural lifecycle event (new wave in 2027, etc.). Having no UI path forces risky manual IDB surgery.

**Open questions when this gets planned:**

- Wave CRUD in Catalog (subsection), in a Settings panel, or as a dedicated Waves admin view?
- What happens to habits in a deleted wave — reassign to a default wave, or block deletion until wave is empty?
- Reordering: drag-and-drop or numeric order field?

**Implementation notes:**

- Depends on B-038; without a `waves` IDB store this is not implementable without touching every habit row.
- Effort: High — new IDB store, CRUD handlers, UI surface.

---

## Captured 2026-06-30

### B-007 · Import JSON control has no visible label

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** The import control in Settings → Data is a raw `<input type="file">` with only an `aria-label` (screen-reader only). No visible text tells the user what the control does or that it accepts a JSON backup file.

**Why:** Without a visible label the import action is opaque to any user who hasn't memorized the layout. The export download has a clear button label; import should match.

**Open questions when this gets planned:**

- Style it as a labeled button wrapper (consistent with export) or a plain `<label>` above the input?

**Implementation notes:**

- Add a `<label for="import-file-input">Import JSON backup</label>` in `settings/builders.js`.
- Effort: Low.

---

### B-008 · Move waves to a first-class data model

**Status:** captured · not scheduled
**Earliest sensible slot:** early post-v1 milestone; prerequisite for B-036

**What:** Replace the free-form `wave` string field on each habit with a dedicated `waves` IDB store (UUID, label, order, optional description, color, date range). Habits reference their wave by ID instead of by name string.

**Why:** Wave identity as a plain string means no metadata, no reordering, no CRUD — any wave management degrades into a mass-edit on every habit row. A proper relational model is the prerequisite for wave creation, renaming, reordering, and richer analytics groupings. Also fixes the current situation where renaming a wave string requires touching every habit in it.

**Open questions when this gets planned:**

- What is the migration path for existing habits that carry a raw wave string (seed habits)? Auto-generate wave records from distinct strings on first migration run?
- Should wave `order` be a float (easy insert between) or an integer (requires re-number on reorder)?
- Color: free-form hex or a curated palette of tokens?

**Implementation notes:**

- Requires a v2 IDB migration (additive — new `waves` store only; habits store gains a `waveId` field).
- Seed loader must write wave records first, then reference their IDs when inserting habits.
- All habit CRUD paths that currently write `wave: string` must switch to `waveId: uuid`.
- All views that group by wave (Catalog, Desktop analytics, CSV export) must join through the new store.
- Effort: High.

---

## Debug session findings (2026-07-05)

### B-009 · Today view mastery badge not rendered

**Status:** captured · not scheduled
**Earliest sensible slot:** next feature sprint — prerequisite for mastery promotion flow

**What:** The Today view never displays a mastery badge for habits that have crossed the mastery threshold. The write path (`scoreSnapshots.js`) now persists `isMastered` on every snapshot row (fixed in debug session 2026-07-05). The read path in Today is the remaining gap: `today.js` does not read `score_snapshots` and the builder functions neither accept nor render `isMastered`.

**Why:** Users cannot act on mastery promotion suggestions if the daily check-in view gives no indication which habits are mastered. Mastery badge visibility in Today is a prerequisite for the promotion-suggestion flow planned for a later phase.

**Open questions when this gets planned:**

- Cache snapshot reads alongside the habit list fetch to avoid per-habit async overhead in the render loop, or accept a second pass?
- Should the badge in Today be identical to the one in Catalog, or a smaller/inline variant to avoid cluttering the check-in surface?

**Implementation notes:**

- `today.js` — fetch today's snapshot rows (or a per-habitId lookup via `repo.getLatestSnapshot`) and pass `isMastered` through to each builder call.
- `buildTodayRow`, `buildNumericRow`, `buildSlotRow` in `js/views/today/builders.js` — accept an `isMastered` boolean and conditionally render `.mastery-badge`.
- Related files: `js/views/today/builders.js`, `js/views/today.js`, `js/io/scoreSnapshots.js`.
- Effort: Low–Medium.

---

## Unscheduled features

### B-010 · Slot collapse behavior after selection

**Status:** captured · not scheduled
**Earliest sensible slot:** needs scoping before it can be slotted

**What:** Define and implement whether a slot-checklist habit row collapses (or otherwise signals completion) automatically once the user fills enough slots to reach the target count.

**Why:** No behavior is currently specified. Leaving it open risks the slot row staying visually open forever after completion — inconsistent with binary habits, which visually resolve when done, and potentially confusing on a mobile check-in screen.

**Open questions when this gets planned:**

- Auto-collapse to a compact row (like binary does), or stay open so the user can see which specific slots were filled?
- Should over-filling (selecting more slots than the target) collapse or resist further selection?
- Is the desired behavior the same in Today view and in History view?

**Implementation notes:**

- Likely a CSS class toggle on the slot row container, triggered by the same `count >= target` condition used for B-031.

---

### B-011 · Custom per-habit mastery settings may not override global defaults

**Status:** captured · not scheduled
**Earliest sensible slot:** needs investigation before scoping

**What:** Custom per-habit mastery threshold and window settings may not reliably override the global defaults in edge cases. Symptoms and exact conditions are not yet pinned down.

**Why:** If the override silently falls back to global defaults, a habit the user specifically tuned has an untrustworthy mastery score — the user would have no way of knowing their custom setting is being ignored.

**Open questions when this gets planned:**

- Is this a read-time priority bug (global read before per-habit check) or a write-time bug (custom setting not persisted correctly)?
- Which edge cases trigger it — only on freshly created habits, or also on imported ones?
- Does the bug affect `isMastered` in `score_snapshots` (stale snapshot) or only the live read path?

**Implementation notes:**

- Start with a debug session: log the resolved threshold/window values during a snapshot write for a habit with a custom setting, and compare to the habit record in IDB.

---

### B-012 · Edit history for numeric and slot habits

**Status:** captured · not scheduled
**Earliest sensible slot:** post-v1; natural companion to binary habit undo

**What:** Numeric and slot-checklist habit logs should support correcting a previously-logged value — comparable to the undo capability binary habits already have. A user who logged "5 reps" but meant "15" should have a correction path.

**Why:** Logging errors happen, especially on a mobile tap surface. Without edit history, numeric and slot data becomes permanently wrong with no correction path. Binary habits have undo; the inconsistency is a usability gap.

**Open questions when this gets planned:**

- Correction model: overwrite the log row (simpler, loses the original) or append a correction event to `history_edits` (full audit trail, aligns with the existing binary undo mechanism)?
- UI: inline edit on the log row, or a dedicated correction modal?
- Should corrections trigger snapshot recomputation for the affected date range?

**Implementation notes:**

- The `history_edits` store already exists for binary habits; extending the schema to carry `previousCount` / `newCount` for numeric corrections would be the cleanest path.

---

### B-013 · Every-N-days cadence: re-due countdown should reset on undone, not only on completion

**Status:** captured · not scheduled
**Earliest sensible slot:** next bug-fix pass

**What:** For habits with an "every N days" cadence, the re-due date should reset when the habit is explicitly marked undone — not only on completion. Currently the logic may track only the last completion timestamp, so a habit can stay "not yet due" even after N days have elapsed since its last undone state.

**Why:** The current behavior makes a habit disappear from the daily view indefinitely if the user skips it: it was never "completed," so the countdown never reset, so it never re-appears. This silently drops habits from the rotation without the user knowing.

**Open questions when this gets planned:**

- "Explicitly marked undone" — does that mean any day the habit was shown but not completed, or only days where the user actively tapped "skip / undone"?
- Should the reset be to "due from undone date" or "due from next available slot after undone date"?

**Implementation notes:**

- The fix lives in `js/domain/cadence.js` (or wherever `nextDueDate` / slot eligibility is computed).
- Requires checking the `logs` store for the most recent row with `completed: false` as well as `completed: true` when computing the next slot.

---

## Post-v1 explorations

### B-014 · Install card: predict-and-override platform switch

**Status:** captured · not scheduled
**Earliest sensible slot:** post-v1; revisit only if a user complaint or usage signal surfaces

**What:** Replace the current "show all three labeled subsections simultaneously" Install card with a predicted-platform-first display (e.g., surface iOS instructions on Safari/iOS user-agent) plus an override toggle to flip to Android Chrome or Desktop browser instructions.

**Why:** Showing all three platform subsections at once is the safe choice but adds scroll noise for a first-time installer on a specific device. A correct platform prediction would surface the right steps immediately with no hunting. The current all-three approach (D-61) was chosen because there was no evidence of user confusion at the time — not because it is optimal UX.

**Open questions when this gets planned:**

- UA detection (`navigator.userAgent`) or persistent IDB platform setting + override?
- 3-segment toggle UI or a simple "Switch to: iOS / Android / Desktop" link?
- How to handle detection drift as new browser/device classes appear and break the UA heuristic?

**Implementation notes:**

- Current decision: all-three layout is locked (D-61 + `03-DISCUSSION-LOG.md` Q3); any change requires explicitly superseding that decision.
- Cost of switching: UA detection logic, 3-segment override toggle, optional IDB key for the override, and ongoing UA maintenance burden.
- Cost of staying: a few extra inches of vertical scroll on the Install card, encountered at most once per device.
