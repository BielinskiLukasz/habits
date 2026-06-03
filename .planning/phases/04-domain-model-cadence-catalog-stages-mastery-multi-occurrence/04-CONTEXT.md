# Phase 4: Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves) - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Light up the full habit lifecycle the user already practices, with definition edits that never rewrite history. Extend the cadence engine (D-48..D-51 from P3) with full coverage and edge-case handling. Introduce catalog CRUD (create, edit, archive, restore, future-schedule habits), stage progression with composable triggers, mastery threshold evaluation, multi-occurrence logging (numeric +1 counter and slot-checklist), history navigation (past-day lookup and bulk uncomplete), and wave-level aggregate metrics.

ROADMAP goal: *"Light up the full habit lifecycle the user already practices, with definition edits that never rewrite history."*

The 47 requirements in scope (CATALOG-01..07, CADENCE-01..07, STAGE-01..07, MASTERY-01..07, LOG-02..06, HISTORY-01..06, WAVE-01..06, SETTINGS-01, NFR-10) are pinned by REQUIREMENTS.md. P4 completes the domain model that P1–P3 have scaffolded.

**Explicitly NOT in P4:**
- JSON/CSV export, JSON import, backup nag — P5
- Desktop analytics views, scoring models S1/S2/S3 — P6
- Wave model persistence in IDB + v1→v2 migration — deferred to P4 UAT if user-defined waves (WAVE-06) are needed; seed-only waves may stay in-memory

</domain>

<decisions>
## Locked Requirements

**Requirements in scope (from REQUIREMENTS.md):**

- **CATALOG-01..07** — Create, edit, archive, restore, future-schedule habits with versioning
- **CADENCE-01..07** — Daily, weekly, monthly, every-N-days, day-of-week-subset; DST/leap-day edge case handling; cadence-aware denominator in mastery
- **STAGE-01..07** — Ordered stages with manual button, scheduled-by-week, after-N-days triggers (composable); manual demotion
- **MASTERY-01..07** — Default 90% / 70 days rolling threshold, per-habit override, visual treatment (muted + badge, always visible), 7-day grace period, recompute on write
- **LOG-02..06** — Numeric +1 counter logging, slot-checklist logging (anonymous or user-labeled slots), progress indicator (e.g., "3 / 7 meals"), completion only when target reached
- **HISTORY-01..06** — Navigate any past day, see applicable habits (per cadence at that time), mark not-completed, bulk uncomplete, interpret logs against historical habit_versions
- **WAVE-01..06** — Each habit belongs to one wave, waves have metadata, aggregate metrics (completion %, status counts, longest active streak, "at risk" indicator), extensible to 2027+ waves
- **SETTINGS-01** — Global mastery threshold (90%) and window (70 days) configurable in Settings
- **NFR-10** — No mutation path can corrupt prior history; every test case verifies historical logs survive edits intact

## Carried-Forward Decisions

**From Phase 1–3 (locked, non-negotiable):**
- D-27: JSDoc file headers and exported APIs; inline `//` only for "why" notes
- D-28: APP_VERSION follows SemVer 2.0.0; starting `'0.1.0'`; cache name `habits-${APP_VERSION}`
- D-29: Module service worker with ES `import`; cache prefix `habits-`
- D-30: Namespace `habits` everywhere (manifest, IDB DB name, BroadcastChannel channel name, CSV export prefix)
- D-35: English UI + English habit names primary; optional Polish in `name_pl`
- D-39: 7 IDB stores including `score_snapshots` (written in P6)
- D-40: `habits` store carries optional `name_pl` field
- D-42: `events` store uses UUID keyPath
- D-44: Reset-data wired into Settings (P3 complete)
- D-48: Minimal `js/domain/cadence.js` covering all 4 cadence types (P3 complete)
- D-49: Weekly resolver is log-aware; hides after a completed log in the current ISO week
- D-50: Every-N-days anchor = last completed log + N days (fallback: creation date)
- D-51: `settings.weekStart` configurable, default `'mon'`, in Settings (P3 complete)
- D-52: `habits` schema denormalized `lastCompletedDate`, maintained at chokepoint (P3 complete)
- D-74: `markUncompleted` handler, writes `{completed: false}` (P3 complete)
- D-75: `setSetting` handler, self-inverting for undo (P3 complete)
- **History integrity rule** — Habit-definition edits never rewrite historical logs; logs always reference the `habit_versions` entry effective at the time they were written (PROJECT.md, core constraint)
- **Single mutator chokepoint** — All mutations flow through `js/state/apply.js` with deterministic undo via `meta.undoToken` (P2 complete)
- **Data persistence** — IndexedDB with BroadcastChannel cross-tab sync and `visibilitychange → hidden` flush (P2 complete)

## Implementation Decisions

### Catalog CRUD and Habit Lifecycle

- **D-82 — Catalog entry point: separate `#catalog` route** — A new route alongside `#today` and `#settings`. Dedicated Catalog view with habit list + inline edit panels. Mobile and desktop both navigate via a link in Settings or a header button. Not a modal-on-Today approach.
- **Habit creation flow** — Create button in Catalog → inline edit panel with fields: English name, wave (dropdown), cadence type (dropdown), target type (binary / numeric / slot-checklist), stage definitions (flexible table: user adds 1-N rows, each with stage label + target value), mastery threshold override (checkbox + fields if checked). On save: new habit row with `startDate` = today OR a future date (CATALOG-07 for scheduling). New event recorded in `events`.
- **Habit editing** — Click an existing habit in list → edit panel pre-populated with current definition. On save: creates a new `habit_versions` entry; the habit row's `currentVersionId` is updated. Existing logs are NOT touched. Definition change is recorded as an event.
- **Archive / Restore** — Habit status field (`active` / `mastered` / `archived`). Archived habits stop appearing on Today; history and logs are preserved. Single button toggle. Reversal is restore.
- **Future scheduling (CATALOG-07)** — Create panel allows `startDate` to be a future date (e.g., 3 weeks from now). Habit does not appear on Today until `startDate` is reached. No special UI per habit; the general "scheduled" concept is baked into applicability filters.

### Cadence Engine Extensions (P4 completes D-48)

- **DST and leap-day handling** — `daysBetween` (D-52 era) uses `Math.round`, not floor. Every-N-days math is exact. ISO week rules hold for weekly cadence across DST transitions. Test matrix: 2026-03-29 spring-forward, 2026-10-25 fall-back, 2028-02-29 leap day.
- **Day-of-week subset syntax** — Habits can specify "Mon-Fri" (weekdays), "Sa-Su" (weekends), "Mon" (single), or an arbitrary subset. String format (e.g., "pn-pt", "sb-nd", "sr", "pn,sr,pt") or array `['Mon', 'Fri', 'Sat']` is planner's call.
- **Monthly cadence** — First draft: "once per calendar month" (same ISO-week logic as weekly, but month-wise). Exact spec (e.g., "1st of month", "last Friday", "15th") deferred to planner.
- **Grace period (7 days)** — New habits don't surface mastery stats for their first 7 days (MASTERY-06). Implemented as: `if (habitCreatedDate + 7 days > today) { hide mastery UI }` — simple date math, no special epoch tracking.
- **Cadence-aware denominator** — Mastery threshold is evaluated as `completed / applicable` where applicable = days matching the habit's cadence. Non-applicable days don't count. Example: a Mon-Fri habit over 70 days has ~50 applicable days (Mon–Fri only); 45 of 50 = 90% mastery.

### Stage Model

- **D-83 — Flexible stage table in habit definition** — Habit carries an ordered array: `stages: [{label, target}, ...]`. User adds 1-N rows in the Catalog edit panel. Each row: stage label (e.g., 'Etap 1') + target value (e.g., 10 reps). Habit also carries `currentStageIndex` (0-based) to track which stage is active. No minimum or maximum number of stages per habit.
- **D-84 — Advancement triggers (composable, OR logic)** — Each habit specifies one or more triggers; any trigger firing advances the stage:
  - **Manual button** — Checkbox in edit panel: "Allow manual stage advance". If checked, "Advance stage" button appears on Today when the habit is active. User presses button → stage increments on next log write.
  - **Scheduled by calendar week** — Field per stage (Catalog edit): "Auto-advance to next stage at week N" (e.g., week 10, week 20). Stage auto-advances on that week's Monday.
  - **After N days (unconditional)** — Field per stage: "Auto-advance after N days at this stage". Stage increments when the user has been at the current stage for N days, regardless of completion.
  - **After N days with C% completion threshold** — Field per stage: "Auto-advance after N days AND completion ≥ C%". Stage increments when both conditions are met. Prevents auto-advance if the user is not keeping up with the habit.
  - **Composition:** User enables any subset of these four types. At each log write, apply.js checks all enabled triggers for that stage and advances if ANY fire (OR logic).
- **Manual demotion** — Catalog edit or Today header demotion button: stage decrements by 1 (if not already at stage 0). Undo-able like any mutation.
- **Stage progression display on Today** — Minimal in P4 (e.g., "Etap 1" badge or label on the row). Full stage dashboard with timelines is P6. P4 target: show which stage is active and allow manual advance if enabled.

### Mastery Threshold Evaluation

- **D-85 — Mastery visual treatment: muted row + badge, always visible and tappable** — When a habit meets its rolling threshold, display with muted text color (opacity 0.55) and a "Mastered" badge. Habit remains visible on Today and is still tappable for logging (so user can continue to feed it). If the habit drops below threshold, badge and muting revert. Reason: mastered habits can slip below threshold; keeping them visible alerts the user when they need to re-engage.
- **Threshold formula** — `completedCount / applicableDayCount >= threshold%` where:
  - `completedCount` = days with `completed:true` logs (or for numeric/slots, days where target was met)
  - `applicableDayCount` = days matching the habit's cadence rules over the window
  - `threshold%` = global default (90%) or per-habit override
  - `window` = global default (70 days) or per-habit override, rolling backward from today
- **D-86 — Global threshold settings in Settings (SETTINGS-01)** — Settings panel adds (or extends existing card with) two fields: "Mastery threshold (%)" and "Mastery window (days)". Defaults: 90%, 70 days. Affects all habits without a per-habit override.
- **D-87 — Per-habit threshold override in Catalog edit** — Catalog edit panel has optional "Custom mastery" checkbox. If checked, reveal threshold % and window (days) fields. Empty or unchecked = use global defaults. User can tune individual habits (e.g., a new habit might have a lower threshold initially, then increase it later).

### Multi-Occurrence Logging

- **Logging UX variants** — Habit's `targetType` is `'binary'` (P3 done) / `'numeric'` (numeric +1 counter) / `'slot-checklist'` (slot-based).
- **D-88 — Numeric +1 counter with +/- buttons (mobile-first)** — Row displays progress "X / Y" (e.g., "5 / 7 cups"). Two buttons flanking the counter: + (increment) and - (decrement). Each tap increments or decrements and writes a log mutation with `count: X`. Completion threshold: `count >= habit.target` (e.g., 7 cups). Partial counts (e.g., 3 cups) are logged and count as "incomplete for the day" in mastery evaluation. UX rationale: +/- buttons prevent accidental overshooting and are explicit on touch.
- **D-89 — Slot-checklist with expandable disclosure pattern** — Row displays progress "X / Y slots" (e.g., "3 / 7 meals") with a disclosure arrow (▼). Tap arrow to expand row → reveals all Y slots as toggles (checked/unchecked). User taps any slot to toggle it. Tap arrow again to collapse. Slots can be user-labeled (e.g., "Breakfast", "Lunch", "Dinner", or "Meal 1"–"Meal 7") or anonymous (labeled auto-generated "Slot 1", etc.). Completion: all slots checked = completed for the day. Partial completion (3 / 7) counts as incomplete. UX rationale: keeps Today clean (collapsed by default), but expands in one tap for detailed logging on mobile.
- **Slot definition in Catalog** — Edit panel offers choice: "Anonymous slots (auto-labeled 'Slot 1', 'Slot 2', ...)" or "User-labeled slots". If user-labeled, provide a table: one row per slot with a label field. User defines labels once at habit creation; labels persist across edits.
- **Log row schema** — A single log can have one of three shapes:
  - Binary: `{habitId, date, completed: true|false}`
  - Numeric: `{habitId, date, count: N}` (no `completed` field; inferred as `count >= habit.target`)
  - Slots: `{habitId, date, slots: [{name, checked}, ...]}` (checked count vs total infers completion)
- **Switching log types** — Changing a habit's `targetType` (e.g., binary → numeric) is a definition edit. Existing logs keep their old shape. P4 log-reader is flexible enough to handle mixed shapes (e.g., a habit with 10 logs as binary, then switched to numeric, now has 5 new numeric logs). Conversion logic: planner's detail.

### History View

- **D-90 — Date navigation: stepper + optional calendar widget (mobile-first)** — Primary path: date stepper at top of History view with ← → arrows (e.g., "Wed 27 May ← | →"). Tap arrows to step through days one at a time. Below stepper: optional "Jump to date ▼" toggle that reveals date pickers (collapsed by default to keep History clean). When expanded, reveal two tap-friendly date pickers: "From date" and "To date" (can open calendar widget or text input). User selects a date or range → History shows habits for that single day or range. Rationale: arrows are fastest for adjacent days (keyboard + touch friendly); calendar picker is there if user needs to jump 3 weeks back or view a range.
- **History list** — For the selected day (or range), show all habits whose cadence rules applied (evaluated against their `habit_versions` entry from that time). Each habit displays current status: completed (✓), not completed, or partial count (for numeric / slots). Habits that did not apply on that day are shown as "N/A" or hidden (planner's detail).
- **Edit past logs** — User can toggle a habit from completed → not completed on a past day. Each tap is a mutation through `apply.js` (recorded in events, undoable). Bulk-action (HISTORY-04): "Mark all not-yet-completed as uncompleted" button → marks all habits on this day that have no log (or have `completed:false`) as `completed:false` (refreshing the audit trail).
- **Version awareness** — When reading a log from date X, the app looks up the `habit_versions` entry that was active on date X and uses that definition for cadence evaluation, stage calculation, mastery thresholds, etc. The log row itself carries `definitionVersion` to identify the definition used at log time. This preserves history integrity (NFR-10).

### Wave Aggregates

- **Wave data structure** — `waves` (from `seed/waves.json` in P3) has `{number, name, startDate, theme}`. P4 adds optional end-date or duration fields if needed for range queries.
- **Aggregate metrics** — For each wave, compute (on-demand or snapshotted):
  - Completion % over the wave's date range (or a rolling 7-day window)
  - Count of habits by status: active / mastered / archived
  - Longest consecutive-day streak where ≥ X% of the wave's applicable habits were completed
  - "Wave at risk" indicator: if Y% of habits are slipping (e.g., below 50% threshold), flag it
- **Wave view / card** — Desktop-primary (P6), but P4 might surface a simple "Wave 4: 12 habits, 8 active / 2 mastered / 2 archived, 23 consecutive days at goal" card on Today or Settings. Planner decides depth.
- **User-extensible waves (WAVE-06)** — Deferred to P4 UAT or P5. P3 keeps waves in-memory; P4 may or may not add an IDB `waves` store + migration. If P4 doesn't ship user-defined waves, the planner notes it for P5/P6.

### NFR-10: History Integrity

- **Test coverage** — Every test that involves an edit (habit definition change, archive, stage advance) verifies that a log from a prior day still interprets correctly against the old definition. Example test: create habit, log it, edit the definition (change stage targets), then query the log → it should use the old definition.
- **Versioning enforcement** — `habit_versions` rows are created on every definition edit. `logs` and other mutable rows always carry a `definitionVersion` or equivalent pointer to the active definition at the time of mutation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs and constraints
- `.planning/PROJECT.md` — locked stack constraints, Key Decisions D-01..D-42, history integrity rule
- `.planning/REQUIREMENTS.md` — 47 requirements in scope for Phase 4 (CATALOG, CADENCE, STAGE, MASTERY, LOG-02..06, HISTORY, WAVE, SETTINGS-01, NFR-10)
- `.planning/ROADMAP.md` §"Phase 4" — goal and success criteria
- `.planning/STATE.md` — Phase 3 complete; Phase 4 ready to plan
- `CLAUDE.md` — TL;DR stack table, Technology Stack section, No-framework/no-bundler/no-npm constraints

### Prior phase context (carry forward)
- `.planning/phases/03-today-view-settings-v1-first-usable-slice/03-CONTEXT.md` — Phase 3 D-48..D-81 (cadence D-48..D-51, denormalized lastCompletedDate D-52, today view D-53..D-58, settings shell D-60..D-67, undo D-68..D-73, testing D-74..D-78, a11y D-79, history tab stub D-80, SW SHELL D-81)
- `.planning/phases/03-today-view-settings-v1-first-usable-slice/03-RESEARCH.md` — Pitfalls 1/2/4/5/8/9; researched cadence edge cases
- `.planning/phases/02-storage-foundation-the-spine/02-CONTEXT.md` — Phase 2 D-30..D-47 (chokepoint, BroadcastChannel, undo, schema)
- `.planning/phases/02-storage-foundation-the-spine/02-RESEARCH.md` — Pitfalls relevant to multi-occurrence logging and concurrency

### Existing code (read before modifying)
- `js/db/schema.js` — 7-store schema; P4 may extend `habits` store with stage fields and mastery settings
- `js/state/apply.js` — single mutator; P4 adds handlers for create/edit/archive/stage-advance/set-threshold
- `js/domain/cadence.js` — P3 starter; P4 completes with DST/leap/grace-period coverage
- `seed/habits.json` — 8 habits; P4 adds stage definitions to each if needed for testing
- `js/db/repo.js` — P3 existing methods; P4 adds queries for history navigation (getLogsForDay, getHabitVersionAtDate, etc.)

### External / web references
- MDN — `Date` and `Intl` APIs for ISO week and date formatting
- MDN — IndexedDB indexes and query patterns for date-range lookups

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`js/state/apply.js`** — single mutator chokepoint. P4 adds handlers: `createHabit`, `editHabit`, `archiveHabit`, `advanceStage`, `setMasteryThreshold`, `setMasteryWindow`, `markUncompleted` (already in P3), `setSetting` (already in P3). Each handler writes an event + updates the affected stores.
- **`js/db/schema.js`** — 7 stores already defined; P4 may extend `habits` store with `stages`, `currentStageIndex`, `masteryThresholdOverride`, `masteryWindowOverride` fields. No migration needed for P3→P4 (new fields can be absent initially).
- **`js/domain/cadence.js`** — P3 covers 4 cadence types; P4 extends with full edge-case handling (DST, leap days, grace period, cadence-aware denominator).
- **`js/db/repo.js`** — P3 has `getAllHabits`, `getLogsInRange`, `getHabit`, `getSetting`. P4 adds bounded-read methods: `getLogsForDate`, `getHabitVersionAtDate`, `getHabitAt`, `getMasteryStatus`, etc.
- **`js/views/today.js`** — P3 renders binary habits only. P4 extends with numeric counter and slot-checklist renderers.
- **Hash router** (`#today`, `#settings`, `#history`) — P3 stub; P4 adds `#catalog` route.

### Established Patterns
- **JSDoc file headers (D-27)** — Every P4 file opens with `/** @file <summary>. <D-XX rationale> */`.
- **TDD-blocking gate** — RED test commit before every behavior-adding task.
- **Pure-view-builders (D-26)** — Render logic as pure builders; mount logic as thin wrappers.
- **Chokepoint mutations** — All state changes flow through `apply.js` handlers + `store.notify()` broadcast + `meta.undoToken` persistence.

### Integration Points
- **`js/router.js`** — P3 simple hashchange listener; P4 may route `#catalog` to a new `mountCatalog()` view.
- **`js/views/catalog.js`** (new in P4) — Exports `mountCatalog(parent, {repo, store})`. Renders habit list + create/edit/archive/restore UI.
- **`js/views/history.js`** (new in P4) — Exports `mountHistory(parent, {repo, store})`. Date picker + applicable habits for selected date + edit UI.
- **`js/views/today.js`** (extended in P4) — Renderers for numeric counter and slot-checklist in addition to binary.
- **`js/state/apply/*.js`** (new handlers in P4) — `createHabit.js`, `editHabit.js`, `archiveHabit.js`, `advanceStage.js`, `setMasteryThreshold.js`, `setMasteryWindow.js`, etc.

</code_context>

<specifics>
## Specific Ideas

- **Cadence-aware denominator** is critical for accurate mastery evaluation. Test fixture: a Mon-Fri habit over 70 days should show ~50 applicable days (not 70). Completion % = completed / 50, not completed / 70.
- **Version-aware log evaluation** is the key to history integrity. When rendering a past day's logs, look up the `habit_versions` entry (via the log's `definitionVersion` field) and use that definition for stage, cadence, mastery thresholds. Future-date logs always use the current definition.
- **Wave metadata** (start date, theme, name) is initially sourced from `seed/waves.json`. Whether waves become a first-class IDB store is a P4 UAT decision (if user-defined waves are needed). For now, keep waves in-memory for simplicity.
- **Stage advancement is a pure state transition**, not a UI flow. The UI presents the triggers (manual button, auto-advance at week N, auto-advance after N days at current stage); the `apply.js` handler checks all conditions at write time and increments `currentStageIndex` if any trigger fires.
- **Numeric logging semantics** — A numeric log with `count: 0` is still a log (it's recorded). Completion is evaluated as `count >= habit.target`. Partial counts (e.g., 3 of 7) do NOT count as "completed for the day"; rolling-window mastery treats it as a miss.
- **Slot-checklist semantics** — A slot-checklist with 0 slots checked is still a log. Completion = all slots checked. Partial completion (4 of 7) does NOT count as "completed for the day" unless the habit allows it (future feature; P4 likely doesn't). Exact semantics: planner's call.

### Deferred Ideas

- **Wave model as IDB store + v1→v2 migration** — Deferred to P4 UAT or later. If user-extensibility (WAVE-06, define 2027+ waves) is needed, promote waves to a first-class `waves` store. Otherwise, keep in-memory.
- **Desktop wave board** — P6 feature. Horizontal timeline of all habits across all waves with status colors and stage labels.
- **Mastery dashboard / analytics view** — P6. Per-habit mastery trends, per-wave mastery heatmaps.
- **Bulk habit operations** (multi-select + archive/delete/stage-advance) — Deferred to a future phase.
- **Habit templates** — Deferred. Allow user to save a habit as a template and create future habits from it.
- **Per-habit notes / history annotations** — Deferred. Allow user to attach notes to a log (e.g., "missed because sick").

</specifics>

<deferred>
## Deferred Ideas (Phase 4 UAT or later)

- **Wave persistence (IDB store)** — Keep in-memory unless user-defined waves (WAVE-06) require persistence. If needed: add a `waves` store + v1→v2 migration.
- **Habit templating** — Save a habit as a template, create future habits from templates.
- **Per-log annotations** — Attach notes to a log entry.
- **Bulk habit operations** — Multi-select on today or catalog, then archive / delete / stage-advance as a batch.
- **Detailed mastery analytics** — Desktop P6 feature.
- **Habit cloning** — Duplicate an existing habit with a new name.

</deferred>

---

*Phase: 4 — Domain Model*
*Context gathered: 2026-06-03*
