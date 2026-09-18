# Backlog

Ideas and scope items captured outside the active roadmap. Anything here is *not* in v1 — it has either been deferred by explicit decision, surfaced during UAT, or earmarked for a later milestone. Items graduate to a `ROADMAP.md` phase when picked up (`/gsd-review-backlog` to promote, `/gsd-phase add` to materialize).

Last updated: 2026-09-18 (removed B-002 — ⓘ Polish-name button deleted via quick task 260918-vtr, moot by obsolescence)
Last assigned ID: **B-028** — next new item must be **B-029**

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

---

## Phase 7 UAT findings (2026-07-15)

### B-015 · Scheduled habits have no distinct visual treatment

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass (after Phase 8 ships the scheduled-habits UX)

**What:** Habits with `status: 'scheduled'` show the same label color and visual treatment as `status: 'active'` habits in the Catalog view. There is no visual signal that a habit is scheduled (i.e., not yet started).

**Why:** A user scanning the catalog cannot distinguish an upcoming habit from one that is already running. Once Phase 8 introduces scheduled-habit management in the UI, the lack of differentiation will cause confusion — the user won't know at a glance which habits are future vs. present.

**Open questions when this gets planned:**

- Should the scheduled indicator be a color change (e.g. muted blue vs active green), a label chip (e.g. "Scheduled · 2027-01-01"), or both?
- Should the scheduled start date be displayed inline in the catalog row?
- Phase 8 may define a richer scheduled-habits UX that makes this moot — verify scope before implementing.

**Implementation notes:**

- Add a `habit-row--scheduled` CSS class (or equivalent) to catalog row builders when `habit.status === 'scheduled'`.
- Effort: Low (CSS + one conditional class in the builder).

---

### B-016 · No "Back to mobile view" link from desktop shell

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** The mobile shell (index.html) Settings page links the user to the desktop shell (`desktop.html`) via a "Open desktop view →" affordance. But there is no reciprocal link — once on `desktop.html`, there is no button or link to return to `index.html`. The user must manually edit the URL or use browser back.

**Why:** Mobile ↔ desktop navigation should be bidirectional. A user who accidentally navigates to desktop.html on a phone, or who finishes analytics work and wants to return to check-in, has no in-app path back.

**Open questions when this gets planned:**

- Where in the desktop shell should the link live — top-right corner of the header, footer, or as a Settings card item?
- Should the link be a simple `<a href="./index.html">Back to check-in →</a>` or something more prominent?

**Implementation notes:**

- Add a `<a href="./index.html">Back to mobile view</a>` (or "Back to check-in") in `desktop.html` — likely in the sidebar footer or header area.
- Mirror the existing "Open desktop view →" affordance in `index.html` settings for consistency.
- Effort: Very low (one anchor in desktop.html template/builder).

---

### B-017 · No success confirmation after JSON import

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** After a successful JSON import, the page silently reloads with no toast or confirmation message. The `showSuccessToast` function is imported in `js/views/settings.js` (line 90) but never called on the happy path — only errors show a toast.

**Why:** The user has no way to know whether import succeeded or silently failed. The page reload is the only signal, and it's easy to miss or misinterpret. A "Import complete — N habits, M logs merged" success toast would close the feedback loop.

**Open questions when this gets planned:**

- Should the toast fire before the reload (brief window) or should import success suppress the reload and show the toast instead?
- Should the toast include a count of merged records (habits, logs) for reassurance?

**Implementation notes:**

- `js/views/settings.js` import handler (~line 542): add `showSuccessToast('Import complete')` before the broadcast/reload sequence, or restructure so the toast appears and the reload is deferred by ~1.5 s.
- `showSuccessToast` is already imported at line 90 — no new import needed.
- Effort: Very low.

---

## v1.0 tech-debt review (2026-07-15)

### B-019 · Phase 2 has no VERIFICATION.md

**Status:** captured · accepted as-is · not scheduled
**Earliest sensible slot:** only if Phase 2 scope is revisited; otherwise close permanently

**What:** Phase 2 shipped without a `VERIFICATION.md`. The gap was accepted at ship time because UAT returned 10/10 and REQUIREMENTS.md checkboxes provided equivalent coverage.

**Why it is still tracked:** If auditors or future contributors look for `VERIFICATION.md` across all phases they will find a gap here and may draw wrong conclusions. A lightweight retrospective verification document would close the audit trail cleanly.

**Open questions when this gets planned:**

- Is it worth back-filling a VERIFICATION.md for Phase 2, or should a single "Phase 2 verification rationale" note in the milestone archive suffice?

**Implementation notes:**

- If created, it should reference the UAT score (10/10) and the REQUIREMENTS.md checkboxes as the evidence base rather than repeating them.
- Effort: Very low (doc only).

---

### B-020 · REQUIREMENTS.md Phase 1 checkboxes show `[ ]` (cosmetic)

**Status:** captured · cosmetic · not scheduled
**Earliest sensible slot:** next doc-hygiene pass

**What:** The Phase 1 requirement checkboxes in `.planning/REQUIREMENTS.md` still display as `[ ]` (unchecked) even though Phase 1 is complete. `VERIFICATION.md` is the authoritative source; this is a cosmetic inconsistency.

**Why:** A reader scanning `REQUIREMENTS.md` will see unchecked boxes and assume Phase 1 requirements are outstanding. The inconsistency erodes trust in the planning artifacts even though implementation is correct.

**Open questions when this gets planned:**

- Tick the checkboxes manually, or add a header note that VERIFICATION.md supersedes the checkbox state?

**Implementation notes:**

- Find and replace `[ ]` → `[x]` for all Phase 1 requirement lines in `.planning/REQUIREMENTS.md`.
- Effort: Very low (doc only).

---

### B-021 · Two intentional stub failures in test suite

**Status:** captured · accepted as-is · documented
**Earliest sensible slot:** next test-coverage pass (after mastery promotion flow and wave aggregates are built)

**What:** `mastery-cadence.test.js` and `wave-aggregates.test.js` each contain pre-existing stub tests that intentionally fail. These were Phase 4 stubs left in place as placeholders for features not yet implemented.

**Why it is tracked:** The failures are documented and intentional, but they pollute the test-run output with red and require anyone running the suite to know which failures to ignore. Removing or skipping the stubs with a clear `test.skip` would make the baseline cleaner.

**Open questions when this gets planned:**

- Convert to `test.skip(...)` with an explanatory comment, or implement the missing features and make them pass?
- If the features (mastery cadence handling, wave aggregates) are scoped into a future phase, skip them until that phase executes.

**Implementation notes:**

- `mastery-cadence.test.js` — mark stub assertions as `test.skip`.
- `wave-aggregates.test.js` — mark stub assertions as `test.skip`.
- Effort: Very low (skip annotation only); higher if the underlying feature is implemented.

---

### B-022 · Planning-doc legacy identifier drift (doc-alignment pass)

**Status:** captured · not scheduled
**Earliest sensible slot:** next doc-hygiene pass

**What:** Several planning documents still carry stale identifiers that diverge from the locked decisions in CLAUDE.md and the live codebase:

1. `.planning/REQUIREMENTS.md` line 100 — `DATA-07` spec text says `BroadcastChannel('nawyki')`; actual code (`js/platform/sync.js`) uses `'habits'` (locked D-30, Phase 2).
2. `.planning/research/STACK.md` lines 20 + 512 — same legacy channel name.
3. `.planning/research/SUMMARY.md` line 22 — same.
4. `.planning/phases/01-pwa-shell-tooling-hygiene/*` — multiple `python -m http.server 8000` references in archived Phase 1 plans, summaries, and research; CLAUDE.md now documents `node scripts/serve.js` as the canonical dev-server command (D-46, locked Phase 2).

The Phase 2 plan author deliberately limited the doc-alignment scope (02-06) to CLAUDE.md / PROJECT.md / README.md / ARCHITECTURE.md / `js/util/version.js`, so these files were knowingly left untouched and flagged for this pass.

**Why:** Requirement-vs-implementation drift in live planning docs misleads contributors who search for the channel name or the serve command. The archived Phase 1 docs are research-era artifacts and lower priority, but the active REQUIREMENTS.md and STACK.md drifts are confusing.

**Open questions when this gets planned:**

- Update the active docs in place, or add a "NOTE: superseded by D-30 / D-46" annotation so the historical context is preserved?
- The Phase 1 archived docs correctly reflect what Phase 1 specified at the time — leave them annotated rather than rewritten?

**Implementation notes:**

- Priority order: `REQUIREMENTS.md` DATA-07 (active, misleading) → `STACK.md` (active research artifact) → `SUMMARY.md` (active summary) → Phase 1 archives (historical, lowest risk).
- Effort: Very low (doc edits only).

---

### B-018 · Bottom nav floats up when content is short

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass

**What:** The mobile bottom navigation bar (Today / History / Catalog / Settings) is not pinned to the viewport bottom. When the page content is shorter than the full viewport height (e.g. History on a day with few habits, or Settings), the nav bar floats up and sits directly below the content instead of staying at the bottom edge of the screen.

**Why:** A floating nav bar breaks the standard mobile shell pattern. On a phone, users expect the bottom nav to always occupy the bottom of the screen regardless of content length — this is the convention in every major mobile app. A nav that moves around is disorienting and makes the app feel unpolished.

**Open questions when this gets planned:**

- Is the fix a CSS-only change (`position: fixed; bottom: 0`) or does the layout shell need structural changes (e.g. `min-height: 100vh` + flexbox on the page wrapper)?
- Does pinning the nav require adding `padding-bottom` to the content area so content isn't hidden behind the fixed bar?

**Implementation notes:**

- The bottom nav element in `index.html` / mobile CSS likely needs `position: fixed; bottom: 0; left: 0; right: 0` (or equivalent).
- Content wrapper needs matching `padding-bottom` equal to nav height to prevent overlap.
- Effort: Low.

---

## Captured 2026-07-20

### B-023 · Today view: order habits by average historical tap time

**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 8; requires data-model change before UI work

**What:** When the user taps a habit on the Today screen, record the clock time of the tap (not just the date). Over time, compute each habit's average tap time across recent completions and use that average to sort the Today habit list — habits the user typically does in the morning appear near the top; evening habits sink lower.

**Why:** The current Today sort order is creation order, which is arbitrary with respect to the user's daily routine. A time-of-day sort would naturally surface morning habits first and evening habits last, reducing the cognitive cost of scanning the list and matching the user's actual flow.

**Open questions when this gets planned:**

- How many recent completions to average over (last 14 days? last 30 completions?), and what fallback order to use for habits with no tap-time history?
- Should non-completed habits (shown because they are due but not yet done) be placed at their predicted average time, or pushed to the bottom?
- Does the sort apply to all habit types (binary, numeric, slot) equally?
- User preference: purely automatic sort, or a hybrid where the user can pin specific habits to top/bottom regardless of average?

**Implementation notes:**

- **Data model change (prerequisite):** The current log row shape is `{ habitId, date, completed, definitionVersion }` — no clock-time field. Add a `tappedAt: ISO-8601 timestamp string` (e.g. `"2026-07-20T07:23:11"`) to the row written by `markCompleted`, `logNumeric`, and `logSlot` apply handlers. This is an additive field — existing rows simply lack it and are excluded from the average.
- **Average computation:** On Today mount, for each active habit, fetch its recent log rows, filter to those with `tappedAt` present, extract the time-of-day component, and compute the mean minute-of-day. Sort ascending by mean minute (or by a fallback sentinel for habits with no history).
- **Storage:** Compute on read (no separate IDB store needed); result is ephemeral per render.
- Effort: Medium — schema additive change + three apply handler edits + sort logic in `today.js`.

---

## Captured 2026-07-29

### B-024 · Polish/English language switch

**Status:** captured · not scheduled
**Earliest sensible slot:** post-v1 milestone; after `name_pl` display work (B-002) lands
**Reference implementation:** `../little-words` — see `src/i18n/index.ts` (i18next + localStorage key `little-words-lang`, defaults to `'pl'`) and `src/features/settings/components/LanguageSwitcher.tsx` (PL/EN pill-button toggle in Settings)

**What:** Add a user-controlled language toggle (English ↔ Polish) that switches the visible habit names — and optionally the UI chrome — between English and Polish. The `name_pl` field is already stored on every seed habit (D-40, locked Phase 2); this item is about surfacing a toggle that makes it the active display language app-wide.

**Why:** The underlying data model already carries `name_pl` for all seed habits. The user is Polish-speaking and runs the app personally — an in-app language switch would let them move between English habit names (default, D-35) and the original Polish names without a data migration or seed change. It also aligns the app with the user's native language for habit labels that read naturally in Polish but feel slightly awkward in English.

**Open questions when this gets planned:**

- Scope: habit names only, or also UI chrome strings (tab labels, button text, headings)? Full i18n of UI chrome is significantly more work; habit-name swap alone reuses the existing `name_pl` field with minimal new code.
- Fallback: if `name_pl` is null (user-created habit with no Polish name), show the English name silently or surface a "(no Polish name)" placeholder?
- Persistence: store the active language in `localStorage` (tiny UI preference, acceptable per CLAUDE.md) or in the `settings` IDB store?
- Toggle placement: Settings card, header gear icon, or a flag/globe icon in the bottom nav?
- Should user-created habits gain an optional "Add Polish name" field in the Create/Edit form once this feature lands?

**Implementation notes:**

- The data layer already supports this: `habit.name_pl` is present for all seed habits and null for user-created ones.
- A `lang` setting key in `localStorage` (`'en'` / `'pl'`, default `'en'`) is the simplest persistence path — mirrors little-words' `LANG_KEY` pattern without requiring i18next (no npm constraint).
- All builder functions that render habit names (`buildTodayRow`, `buildNumericRow`, `buildSlotRow`, catalog row builders) would read `lang` from the setting and select `habit.name_pl ?? habit.name` vs `habit.name`.
- For full UI chrome i18n (little-words approach): a `js/i18n/en.js` + `js/i18n/pl.js` string-table module replaces i18next — plain ES module export of a keyed object, no library needed. A `t(key)` helper reads the active lang from localStorage and returns the translation string.
- The PL/EN toggle UI is two pill-buttons in Settings (same pattern as `LanguageSwitcher.tsx` in little-words, but implemented as plain DOM in `settings/builders.js`).
- Effort: Low for habit-names-only toggle; Medium for full UI chrome i18n (string tables + `t()` helper + updating all builders).

---

### B-025 · Catalog action buttons: replace text with icons

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass; pairs naturally with B-004 (same-row layout) and B-005 (archive visual differentiation)

**What:** Replace the text-labelled action buttons in the Catalog habit card — "Edit", "Archive", "Advance stage", and "Promote" — with icon-only buttons (or icon + compact label). Active habits carry Edit + Archive + Advance stage; scheduled (upcoming) habits carry Edit + Promote.

**Why:** Text buttons consume horizontal space and force the card to grow vertically. Icon buttons let the three actions sit in a compact row while remaining tappable on mobile. The catalog is scanned repeatedly; familiar icons (pencil, archive box, chevron-up, play/arrow-right) are faster to parse at a glance than reading full words.

**Open questions when this gets planned:**

- Icon source: inline SVG sprites, CSS-drawn icons, or Unicode glyphs (e.g. ✏️ 📥 ⬆)? Inline SVG is cleanest for accessibility and theming; Unicode glyphs are zero-dependency but less controllable.
- Icon-only vs. icon + short label (e.g. icon above/beside "Edit")? Pure icon-only requires a `title` / `aria-label` for accessibility; short labels add context but partially defeat the space saving.
- Should the "Advance stage" button use a different visual metaphor from "Archive" to avoid confusion (both imply state change)?
- The full confirmed button set: active habits → Edit, Archive, Advance stage; scheduled habits → Edit, Promote. Icon choices for Promote: play triangle (▶), right-pointing arrow, or a "start" glyph — must feel distinct from Advance stage (upward chevron) to avoid confusion.

**Implementation notes:**

- Replace button text content with `<svg>` (or `<span aria-hidden>icon</span>`) in the catalog row builder.
- Every icon button must carry an accessible name: `aria-label="Edit habit"`, `aria-label="Archive habit"`, `aria-label="Advance stage"`, `aria-label="Promote to active"`.
- Add a CSS `title` tooltip or visible `<span class="sr-only">` for screen readers.
- With B-004 already captured (same-row layout), consider tackling both together — row layout and icon swap are a natural combined pass.
- With B-005 already captured (archive destructive styling), apply the red/destructive treatment to the archive icon at the same time.
- Effort: Low.

---

## Captured 2026-08-25

### B-026 · UI density pass — tighter layout without framework migration

**Status:** captured · not scheduled
**Earliest sensible slot:** next UI polish pass; can land independently of any feature work
**Reference implementations:** `../little-words` (React + Tailwind compact card layout), `../med-stock` (Tailwind utility-class density)

**What:** Reduce the visual footprint of all views — Today check-in, Catalog, History, Settings, desktop analytics — by shrinking font sizes, line heights, and margins so more habits are visible without scrolling. The goal is to display the same data in roughly 70–80 % of the current vertical space, matching the density feel of the little-words and med-stock sibling apps.

**Why:** The current layout feels spacious-bordering-on-sparse on a modern phone screen. The Today view shows ~8–10 habits before scroll; little-words shows 15+ items in the same viewport with no sense of crowding. Daily check-in friction drops when the user can see their full list (or close to it) without scrolling.

**Open questions when this gets planned:**

- Which views are highest priority? Today (daily use, highest impact) → Catalog → History → Settings → Desktop.
- Specific target sizes: drop base habit-row height from current to ~40–44 px? Drop `--space-3` tokens by 25–30 %? Benchmark against little-words at the same viewport.
- Typography: reduce base font size from current root size (check `css/tokens.css`) or only tighten specific components?
- Is a global token rescale (edit `css/tokens.css`) the right lever, or per-component CSS tweaks? Token rescale is lower effort and more consistent; per-component tweaks are safer but repetitive.
- Should density be a user preference (compact / comfortable toggle in Settings) or a flat change? The user is single-user so a flat change is simpler; a toggle is extra UI for no audience.

**React migration question:** No. The no-framework constraint (CLAUDE.md) is firm and motivated by zero-dependency longevity, not just aesthetics. Little-words achieves its density with Tailwind utility classes on small components — the same density is reachable in this app by adjusting CSS custom properties in `css/tokens.css` and trimming padding/margin rules in per-component CSS files. No migration is needed or wanted.

**Implementation notes:**

- Start with `css/tokens.css`: audit `--space-*`, `--font-size-*`, `--line-height-*` token values. A 20–25 % reduction in spacing tokens and a step down in base font size is likely the 80/20 move.
- Cross-check against minimum tap-target size (44 × 44 px per WCAG 2.5.5) — tapping accuracy on mobile must not regress.
- Today view habit rows: target 40–44 px row height. Current state: audit `css/today.css` and the `buildTodayRow` builder for hardcoded heights or paddings.
- Catalog card: reduce card padding and inter-card gap; check `css/catalog.css`.
- History list: same token-driven reduction.
- Settings: reduce section header margins and form element spacing.
- Test on a real phone at 375 px viewport width before shipping — desktop DevTools emulation misses tap-target ergonomics.
- Effort: Low–Medium (mostly CSS token tuning + visual QA on device).

---

## Captured 2026-08-31

### B-027 · App Version Number Display

**Source:** product idea — reported 2026-08-31; mirrors B-013 from med-stock sibling app
**Status:** captured · not scheduled
**Earliest sensible slot:** next available patch or alongside any Settings view work

**What:** Show the current app version somewhere visible in the UI — most naturally in the Settings → Data section footer or a dedicated "About" card. The version string should match the `VERSION` constant in `js/util/version.js` exactly (e.g., `v1.0.0`).

**Why:** Without a visible version, the user cannot report "which version broke X" and there is no way to correlate bug reports to releases. A one-line version badge costs almost nothing to add and eliminates ambiguity — especially useful as the app evolves across milestones and the user runs it on multiple devices.

**Open questions when this gets planned:**

- Where exactly: Settings → Data section footer, a small badge in the bottom-nav area, or a dedicated "About" card in Settings?
- Should the build date be shown alongside the version for debugging purposes?
- Tap-to-copy behaviour — useful for filing bug reports?

**Implementation notes:**

- `js/util/version.js` already exports a `VERSION` constant (referenced in B-022 alignment pass and Phase 2 docs). Import that export — no new constant needed.
- Render as a small `<p class="settings-version">v{VERSION}</p>` (or equivalent) in the Settings view builder (`js/views/settings.js` or `settings/builders.js`). No new module or component needed.
- Style with a muted, small-text token from `css/tokens.css` — `--font-size-xs` + `--color-text-muted` or equivalent.
- Effort: Very low.

---

## Captured 2026-09-18

### B-028 · Explicit habit-day status model (done/failed/skipped/not tracked)

**Source:** captured as pending todo `2026-09-18-habit-day-status-model.md`; surfaced during Phase 13.1 discussion (deferred, not folded)
**Status:** captured · not scheduled
**Earliest sensible slot:** needs scoping; natural follow-on once Phase 13.1's Fail-button fix ships

**What:** Historic days with no log entry currently show as missing data with no explicit recorded reason. Give every habit-day one of four explicit statuses — done, failed (applicable, not completed, counts as a miss), skipped (user explicitly excluded), or not tracked (no data / habit wasn't being tracked) — and add a UI affordance (History/Today) to retroactively set status on days with missing data. `skipped` and `not tracked` collapse to the same "not counted" bucket for scoring and CSV `x`.

**Why:** The 4-state log model (D-43) already distinguishes completed/failed/skipped by presence+status, but there is no way to retroactively mark a historic "missing" day as skipped-vs-not-tracked-vs-failed, and `appliesToday()` (`js/domain/cadence.js`) only decides applicability at render/export time, not as a persisted per-day fact.

**Open questions when this gets planned:**

- Is this a new persisted concept on `logs`, or a derived read combining `logs` + cadence applicability?
- What UI affordance lets the user retroactively set status on a missing day, and where (History view seems the natural home)?
- Must not rewrite historical logs destructively — respect the "History integrity" constraint in CLAUDE.md.

**Implementation notes:**

- Related files: `js/domain/cadence.js`, `js/db/schema.js`, `js/domain/scoring.js` (skipped/not-tracked collapse for denominators).
- Full problem statement: `.planning/todos/pending/2026-09-18-habit-day-status-model.md`.
- Effort: Medium–High — likely a schema-adjacent concept plus new UI surface, not a quick fix.
