# Phase 3: Today View & Settings v1 (First Usable Slice) - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the first user-visible artifact — a mobile Today view that renders cadence-filtered seed habits with single-tap binary mark/unmark and persistent undo, plus a Settings v1 panel hosting persistence status, app/schema versions, install help, the migrated Reset-data action, an Undo shortcut, and a week-start toggle.

ROADMAP goal: *"Deliver the friction-free daily check-in that is the product's literal core value, against seed data."*

The 17 requirements in scope (CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07) are pinned by ROADMAP.md. P3 also lands a minimal `js/domain/cadence.js` resolver and a `js/domain/wave.js` lookup with `seed/waves.json` — borrowed from the P4 cadence/wave scope to honor CORE-04 / CORE-05 on the first usable slice.

**Explicitly NOT in P3:**
- Full cadence engine surface (DST/leap-day edge cases, MASTERY-06 grace period) — P4 extends `js/domain/cadence.js`
- Catalog CRUD, edit history, habit_versions evaluation in history — P4
- Multi-occurrence logging (numeric `+1` counter, slot-checklist) — only LOG-01 (binary) is in P3; LOG-02..06 are P4
- Mastery threshold visual treatment — P4 (MASTERY-01..07)
- Wave aggregate metrics, wave-at-risk indicator, full wave data model — P4 (WAVE-03..06)
- History view, past-day navigation, bulk uncomplete — P4 (HISTORY-01..06)
- JSON/CSV export, JSON import, backup nag — P5
- Desktop analytics, scoring models — P6
- Wave IDB store + DB_VERSION 1→2 migration — deferred to P4 when WAVE-06 requires user-extensibility; P3 keeps waves in-memory only

</domain>

<decisions>
## Implementation Decisions

### Cadence (foundational — borrowed scope to honor CORE-04)
- **D-48 — Minimal `js/domain/cadence.js` resolver lands in P3** covering all 4 cadence types in the seed (`daily`, `weekly`, `every-n-days`, `day-of-week-subset`). Same module is extended by P4; CORE-04 fully met on first usable slice. Shared with future CSV export (P5) per CLAUDE.md's "single source of truth" note.
- **D-49 — Weekly resolver is log-aware:** signature `appliesToday(habit, date, ctx)` where `ctx` provides `weekCompletions(habitId, weekStart, weekEnd)`. Habit hides from Today the day after a `completed: true` log lands within the current ISO week (and stays hidden for the rest of the week). Matches user practice from the xlsx: weekly habits log on whichever day they actually happen.
- **D-50 — Every-N-days anchor = last completed log + N days**, with fallback to habit creation date if no log exists yet. Resolver reads `habit.lastCompletedDate` (the denormalized field — see D-52) to avoid an extra IDB query in the render path.
- **D-51 — `settings.weekStart` is user-configurable, default `'mon'`, with a Mon/Sun radio in Settings v1.** First-run defaults grow by one row (joining `defaultThreshold`, `defaultWindowDays`, `schemaVersion`). Cadence resolver reads it at hydrate and caches.
- **D-52 — `habits` schema gains a denormalized `lastCompletedDate: string | null` field**, maintained as a chokepoint invariant by `apply.js` on every `markCompleted` / `markUncompleted` tx. Enables a single bounded read on cold-paint (NFR-01 < 300 ms) — Today hydrate is `repo.getAllHabits()` + `repo.getLogsInRange(today-7, today)` (7-day window covers weekly; every-N reads `lastCompletedDate` from the habit row directly). New contract test enforces "after markCompleted, habit.lastCompletedDate == event.payload.date".

### Today view UI
- **D-53 — Whole-row tap target with optimistic flip + apply()**, then reconcile via `store.subscribe()` re-render. On `apply()` error: `revertRow(rowEl, priorState)` + error toast. Hits NFR-02 < 100 ms trivially since the visual response is one frame. Subscribe path also serves cross-tab broadcast re-renders — single render code path.
- **D-54 — Completed visual treatment: ✓ glyph + strikethrough + opacity 0.55**, single-line row. No color-only state encoding (NFR-07): the ✓ glyph is the load-bearing signal; `aria-pressed="true|false"` carries the state for screen readers.
- **D-55 — Polish (`name_pl`) surface = ⓘ icon at row end, tap reveals an inline popover/expansion under the row.** Polish is the "I forgot what this English habit means" rescue — discreet by design. ⓘ button's click handler MUST call `event.stopPropagation()` so the row's mark-complete handler does not also fire.
- **D-56 — Today header content: date `"Wed 27 May"` (short weekday + day + month abbreviation) + wave `"Wave 4"` (single active wave: highest wave whose `startDate ≤ today`).** Locale-deterministic format built from `util/date.js`; no `Intl.DateTimeFormat` to keep it predictable.
- **D-57 — Waves stored in `seed/waves.json`, loaded in-memory only by `js/domain/wave.js` at boot (via the existing seed loader or a sibling).** P3 fields: `{number, name: "Wave N", startDate: "YYYY-MM-DD", theme?}`. No IDB persistence in P3; no schema migration. P4 promotes to an IDB `waves` store with a v1→v2 migration when WAVE-06 needs user-extensibility (deferred idea).
- **D-58 — Two distinct empty states on Today:** (a) "No habits scheduled today." when zero habits pass the cadence filter, (b) "All done today — see you tomorrow." + "N of N" counter when every applicable habit is completed. Distinct meanings get distinct text.
- **D-59 — No vibration in P3.** iOS has no Vibration API; mixing haptic on Android with silent on iOS introduces platform inconsistency the user doesn't want.

### Settings v1 shell
- **D-60 — Single index.html with hash routing** (`#today` / `#settings` / `#history`). New `js/router.js` listens to `hashchange` and toggles which panel is visible. Footer-nav spans become `<a href="#X" aria-current="page">`. On route change, focus moves to the new panel's `<h1>` (`.focus({preventScroll:true})`) for keyboard users.
- **D-61 — Flat-card Settings layout, top-down by importance: Storage → Schedule → Install → Data → About.** No collapsible/sub-tab affordance in v1. Deferred to a future release when Settings content grows beyond ~6 cards.
- **D-62 — Storage card is the hybrid:** live `navigator.storage.persisted()` status (refreshed on Settings mount), a "Request persistence" button shown when status is `false` (calls `navigator.storage.persist()` again to retry the browser prompt), and a single-line storage estimate from `navigator.storage.estimate()` (e.g., "Using 0.4 MB of ~600 MB"). All three async-loaded with "loading…" placeholders.
- **D-63 — Schedule card hosts the `settings.weekStart` Mon/Sun radio** (D-51). Bound to a `repo.putSetting({key:'weekStart', value})` writer that goes through `apply.js` via a new `setSetting` event handler. Cadence resolver re-reads at next hydrate.
- **D-64 — Install card shows all three sets of instructions labeled (iOS Share → Add to Home Screen, Android Chrome menu → Install, Desktop URL-bar icon).** No JS platform detection; user picks the section that matches their device. Functionally equivalent to PWA-07's "platform-detected install instructions" requirement (the user effectively self-detects).
- **D-65 — Data card has two sub-blocks with destructive treatment:**
  - **(a) "Undo last action"** — button + preview text "Last: marked Drink water complete · 2 minutes ago" read from the `events` row referenced by `meta.undoToken` (and re-rendered live via `store.subscribe()` — D-72). Disabled when `meta.undoToken` is empty.
  - **(b) "Reset data"** — destructive-red button. Settings-flavored confirm dialog (D-67), NOT the D-06 verbatim text used in diagnostics. Same handler shape as `js/views/diagnostics.js`'s Reset-data button (D-44).
- **D-66 — About card has 4 rows:** App version (from `APP_VERSION`), Schema version (from `settings.schemaVersion`), Cache name (filtered from `caches.keys()` by `/^habits-/`), SW state (controlled / registered / unsupported via `navigator.serviceWorker.controller`). Mirrors the diagnostics panel so Settings is self-sufficient — the user no longer needs the long-press-title gesture to reach this info.
- **D-67 — Reset-data confirm copy: TWO distinct strings.** Diagnostics dialog keeps D-06 verbatim: *"Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed."* Settings dialog uses user-facing prose: *"This will delete all your habits and history. Cannot be undone. Continue?"* Both stay near their use sites (or in a small `js/views/copy.js` if it grows). They serve different audiences and SHOULD NOT be kept in sync.

### Undo surface + behavior
- **D-68 — Both surfaces ship in P3:** (a) toast that auto-appears after every mark/unmark, (b) Data card "Undo last action" button in Settings. UNDO-01 verbatim.
- **D-69 — Undo toast auto-dismisses after 5 seconds**, with hover/tap resetting the timer. `js/views/toast.js` grows an `{autoDismissMs}` option. The locked D-08 no-auto-dismiss behavior for the SW-update toast is unchanged — `showUpdateToast()` continues to omit `autoDismissMs`.
- **D-70 — Single toast at any time; new tap replaces the toast contents and resets the timer.** Matches UNDO-03's locked single-step model: `undo()` always operates on `meta.undoToken` (the most recent event), and the toast UI reflects that one source of truth. Stacking toasts would create misleading "Undo" buttons; dismiss-and-skip would hide feedback for rapid taps.
- **D-71 — Toast + Settings copy uses verb + habit name:** `"Marked Drink water complete — Undo · ×"` (toast) and `"Last: marked Drink water complete · 2 minutes ago"` (Settings, with relative-time formatting via `util/date.js`). Inverse direction is unambiguous from the verb. `markUncompleted` events produce `"Marked Drink water uncomplete — Undo"`.
- **D-72 — Settings Data card subscribes to `store.notify()` for live cross-tab refresh** (matches Today panel's pattern). On Settings mount: `unsub = store.subscribe(refreshDataCard)`; on unmount: `unsub()`. Without this, a peer-tab mutation leaves Settings showing a stale "Last action" preview while the Undo button silently undoes the actual (different) most-recent event.
- **D-73 — Undo error handling:** `undo()` returning `null` is silent (the button was already disabled in that case anyway). `undo()` throwing shows an error-variant toast ("Couldn't undo — try again"). The same error toast variant is reused by Today row's `revertRow` path. `toast.js` grows a `showErrorToast(message)` variant; same `textContent` safety.

### Build / test discipline
- **D-74 — `markUncompleted` handler ships in P3** as a sibling of `markCompleted` in `js/state/apply/`. Writes `{habitId, date, completed: false, definitionVersion: null}` (NOT a delete — the log row remains so it stays auditable). Inverse is `restoreLogRow` (already in P2). `apply.js` HANDLERS table grows by one entry. The denormalized `habit.lastCompletedDate` invariant (D-52) is recomputed by either `markCompleted` or `markUncompleted` inside the same tx.
- **D-75 — `setSetting` handler ships in P3** as `js/state/apply/setSetting.js`. Writes a settings row through the chokepoint so `weekStart` changes (and any future Settings writes) get broadcasted, flushed, and undoable like any other mutation.
- **D-76 — Pure-view-builders for every render (D-26 Tier 1 enforced).** Every render lives in two halves: a pure builder `build<X>(data) → {tag, attrs, children}` that gets unit-tested in Node, and a thin mounter that walks the description tree and attaches listeners via `data-action="<name>"` attributes. Pattern applies uniformly: today rows, settings cards, toast contents. Future phases inherit.
- **D-77 — New `js/util/mount.js` helper** walks a description tree and constructs real DOM using `textContent` for string children and `setAttribute` for attrs. The single trusted DOM-construction site for the codebase. Builders return descriptions; mounters call `mount(desc, parent, eventDelegates)`.
- **D-78 — XSS discipline test in CI** — `tests/unit/discipline.xss.test.js` greps `js/` for any `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write` outside an empty allowlist (same shape as the P2 `indexedDB.open` discipline test). Belt-and-suspenders with D-77's `mount()` helper: discipline test catches bypasses; helper makes the intended path the easy one.
- **D-79 — Standard a11y baseline (NFR-06 + NFR-07):**
  - Today row: `<button aria-pressed="true|false">` wrapping row content; Enter/Space activates.
  - ⓘ button: `aria-label="Show original Polish name"`; toggles `aria-expanded`.
  - Toast: `role="status" aria-live="polite"` (existing in `toast.js`).
  - Footer-nav: `<a aria-current="page">` on the active tab.
  - History tab: `<a aria-disabled="true" tabindex="-1" title="Coming in Phase 4">` (D-80).
  - No color-only state: every visual differentiator pairs with a glyph (✓), text, or ARIA attribute.
  - On hashchange, focus moves to the new panel's `<h1>`.
  - All `aria-*` attributes captured in builders (D-76); unit tests assert their presence.
- **D-80 — History tab: visible-but-disabled anchor with tooltip** "Coming in Phase 4". URL `#history` either redirects to `#today` via the router, or shows a "History view ships in Phase 4" placeholder panel (planner's call). Keeps the three-tab layout discoverable; signals roadmap progression.
- **D-81 — SW SHELL precache for new P3 JS + CSS only; seed JSON via SWR.** SHELL list grows by: `js/router.js`, `js/views/today.js`, `js/views/settings.js`, `js/domain/cadence.js`, `js/domain/wave.js`, `js/util/mount.js`, `js/state/apply/markUncompleted.js`, `js/state/apply/setSetting.js`, plus the new `css/settings.css`. `seed/waves.json` and `seed/habits.json` continue to be fetched and runtime-cached via stale-while-revalidate. APP_VERSION bumps to `0.3.0` on P3 completion (per D-28 MINOR-on-phase-completion convention); SW activate handler deletes the prior `habits-0.2.0` cache; existing P1-locked update toast (D-08, no-auto-dismiss) fires for users still on 0.2.0.

### Claude's Discretion
- **Concrete CSS class names** (`.today-row`, `.today-row--completed`, `.settings-card`, `.settings-card--destructive`, `.toast--error`, etc.) — planner picks names that fit the existing `today.css` / `components.css` conventions; no naming scheme has been locked.
- **Router internal shape** — hashchange handler + a `routes` map vs. a single switch in `router.js` is planner's call. Constraint: hash changes must not leak file:// path concerns; the SW silent-fail (PWA-04) means router still works on `file://`.
- **`mount()` event delegation API** — `mount(desc, parent, {actions: {markComplete: fn, showPolish: fn, ...}})` vs. a global delegated click listener that reads `data-action` — both work; planner picks the simpler shape.
- **Exact prose for the three install-help panels** — content scope locked; the actual sentences ("Tap the Share button, then 'Add to Home Screen'") are copy decisions the planner can resolve from MDN's standard install copy or write inline.
- **Storage estimate display precision** — "0.4 MB of ~600 MB" vs "443 KB / 612 MB"; planner picks a single rounding rule.
- **Plan breakdown** — ROADMAP says "Plans: TBD" for P3. Likely splits: (1) cadence + wave domain modules + tests, (2) Today panel (router + view + builder + mount + tests), (3) markUncompleted + denormalized lastCompletedDate invariant + tests, (4) Settings panel (cards + setSetting handler + tests), (5) Undo toast surface + autoDismiss + Settings card live refresh, (6) SW SHELL update + APP_VERSION bump + docs. Or fewer larger plans — planner's judgment based on commit-atom sizing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs and constraints
- `.planning/PROJECT.md` — locked stack constraints, no-npm/no-bundler rule, file://-safe, privacy rule, Key Decisions table (D-01..D-47)
- `.planning/REQUIREMENTS.md` — 17 requirements in scope: CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07
- `.planning/ROADMAP.md` §"Phase 3" — goal and 5 success criteria
- `.planning/STATE.md` — current state; Phase 02 verified; Phase 03 not started
- `CLAUDE.md` — TL;DR stack table + conventions section (D-27 JSDoc, D-26 UI testing two tiers, no-vibration not in v1)
- `VERSIONING.md` — SemVer 2.0.0 policy; P3 completion bumps `APP_VERSION` 0.2.0 → 0.3.0

### Prior phase context (carry forward)
- `.planning/phases/01-pwa-shell-tooling-hygiene/01-CONTEXT.md` — Phase 1 D-01..D-22 (PWA shell, toast no-auto-dismiss D-08, diagnostics D-02/03/05/06, long-press 1500 ms / 10 px D-02 / Pitfall 7)
- `.planning/phases/02-storage-foundation-the-spine/02-CONTEXT.md` — Phase 2 D-30..D-47 (chokepoint, BroadcastChannel('habits'), meta.undoToken, name_pl D-40, D-26 UI two-tier testing, D-44 Reset-data migrates to Settings)
- `.planning/phases/02-storage-foundation-the-spine/02-RESEARCH.md` — Pitfalls 1/2/4/5/8/9 still apply; T-02 series threat model
- `.planning/phases/02-storage-foundation-the-spine/PHASE-COMPLETION.md` — Phase 02 closing state, exit gates, the `meta.persistResult` field

### Research
- `.planning/research/STACK.md` — Cascade Layers, no npm/CDN/bundler, BroadcastChannel for cross-tab, visibilitychange → hidden
- `.planning/research/ARCHITECTURE.md` §1 "Module Layout" — `js/views/`, `js/router.js` placement; §2 "State Management Pattern" — single-mutator chokepoint; §6 "Cross-Tab Sync + Undo" — BroadcastChannel protocol, meta.undoToken
- `.planning/research/FEATURES.md` §"Table Stakes T1 (Today)", §"Differentiators D2 (mastery without hiding)", §"Anti-Features A4/A6 (no streak-as-shame, no punishment)"
- `.planning/research/PITFALLS.md` §"Pitfall 2: Cross-Tab Stale Reads" — drives D-72; §"Pitfall 8: Multi-Tab Concurrency" — drives keys-only broadcast on markUncompleted too; §"Pitfall 4: Timezone & Date-Boundary Bugs" — drives ISO week computation in cadence.js

### Existing code (read before modifying)
- `index.html` — mobile shell with `.today-header`, `.today-list`, `.today-footer-nav`; adds router targets + Settings panel container
- `js/main.js` — boot sequence; P3 adds router boot + Today/Settings mounts
- `js/state/apply.js` — chokepoint; P3 adds `markUncompleted` + `setSetting` entries to `HANDLERS` table
- `js/state/apply/markCompleted.js` — pattern for `markUncompleted.js` and `setSetting.js`
- `js/state/store.js` — `subscribe(fn) → unsub`; `notify(slice)`; cache expansion lives here
- `js/state/undo.js` — `undo()` is fully wired; P3 just calls it from the toast and Settings card
- `js/db/repo.js` — `getAllHabits`, `getLogsInRange`, `getMeta`, `getEvent`, `getSetting`, `putSetting` — all exist
- `js/db/schema.js` — `habits` store keypath + indexes; D-52 adds `lastCompletedDate` field (no migration needed — IDB stores are schemaless inside the store)
- `js/views/toast.js` — extend with `{autoDismissMs}` option + `showErrorToast(message)` variant; preserve `showUpdateToast` D-08 semantics (no auto-dismiss)
- `js/views/diagnostics.js` — copy the Reset-data handler shape into Settings; keep D-06 verbatim text in diagnostics
- `js/util/date.js` — already exposes local YMD helpers; add ISO-week start/end + relative-time formatter
- `js/io/seed.js` — pattern for `seed/waves.json` loader (or extend it to also load waves into the in-memory cache)
- `seed/habits.json` — 8-habit stub; P3 does not modify
- `css/today.css` — extend with `.today-row` states; preserve the `[data-app-title]` user-select rules
- `css/main.css` — `@import` composer; add `@import url(./settings.css) layer(view)` for the new card layout
- `sw.js` — SHELL list grows per D-81; activate handler already deletes prior caches matching `/^habits-/`

### External / web
- MDN — `navigator.storage.persist()` + `persisted()` + `estimate()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager
- MDN — BroadcastChannel: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN — `hashchange` event: https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event
- MDN — `aria-pressed`: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-pressed
- MDN — `aria-current`: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-current
- MDN — `aria-live` / `role=status`: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role
- MDN — Vibration API (NOT used per D-59): https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
- WAI — Disclosure pattern (for ⓘ button revealing Polish name): https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`js/state/apply.js`** — single mutator already wired. P3 adds `markUncompleted` + `setSetting` entries to the `HANDLERS` table; the rest of the chokepoint (broadcast, lifecycle flush, meta.undoToken write) needs zero changes.
- **`js/state/undo.js`** — `undo()` is fully functional. P3 calls it from two new surfaces (toast button + Settings Data card button); no edits to undo.js itself.
- **`js/views/toast.js`** — XSS-safe primitive. P3 extends with `{autoDismissMs}` option (used by Undo toast) and a `showErrorToast(message)` variant; `showUpdateToast` semantics unchanged.
- **`js/views/diagnostics.js`** — Reset-data handler (D-44) is the pattern for Settings' Data card destructive button. Confirm string differs (D-67) but the IDB-delete + reload flow is identical.
- **`js/db/repo.js`** — `getAllHabits`, `getLogsInRange`, `getMeta`, `getEvent`, `getSetting`, `putSetting` are all in place. P3 needs no new repo methods (lastCompletedDate is just another field on the habit row that `putHabit` writes through).
- **`js/state/store.js`** — `subscribe(fn) → unsub` and `notify(slice)` work; P3 cache expansion expands `cache.logs` to "this ISO week's logs" (for weekly resolver) plus the existing `cache.habits`.
- **`js/util/date.js`** — already exposes `todayLocal`, `formatLocalYMD`, `parseLocalYMD`. P3 extends with `isoWeekStart(date, weekStart)`, `isoWeekEnd(date, weekStart)`, `daysBetween(a, b)`, and a `formatRelative(at, now)` helper for the Settings undo preview.
- **`js/io/seed.js`** — pattern for `seed/waves.json` loading; either extend `bootSeed()` to also load waves into `js/domain/wave.js`'s in-memory cache, or add a sibling `bootWaves()`.
- **`index.html`** — shell already has the three slots: `.today-header` (date + wave), `.today-list` (ul), `.today-footer-nav` (3 spans → 3 `<a>` in P3). Adds a Settings panel container alongside, both gated by router.

### Established Patterns
- **JSDoc file headers + JSDoc on exports (D-27).** Every new `.js` file in P3 opens with `/** @file <one-line summary>. <rationale + D-XX cross-refs> */`.
- **SemVer 2.0.0 (D-28) + `habits-${APP_VERSION}` cache prefix (D-29).** P3 completion → bump `APP_VERSION` to `0.3.0`.
- **Module SW + ES `import` of version.js (D-29).** Adding new files to SHELL is a single edit to the SHELL array; activate handler already cleans `habits-` caches.
- **TDD-blocking gate (`workflow.tdd_mode = true`).** Tests written before the code they test. Discipline-test pattern from P2 (`indexedDB.open` outside `js/db/idb.js`) extends to D-78's XSS discipline.
- **Two-tier UI testing (D-26).** Tier 1: pure builders unit-tested in Node. Tier 2: `tests-browser.html` for integrated mount + event flow. P3 is the first phase consuming this.
- **Configure-based DI (RESEARCH §Open Question 2).** `apply.configure({repo, broadcast, trackTx})` pattern. New handlers added to `HANDLERS` import-only (no DI seam needed for handlers).

### Integration Points
- **`js/router.js`** is new in P3. Hash-routing only; no `history.pushState`. Listens to `hashchange`; exports `mountRoutes({routes, onChange})`. Initial route = `location.hash || '#today'`.
- **`js/views/today.js`** is new in P3. Exports `mountToday(parent, {repo, store, vibrate: noop})`. Subscribes to `store.notify()`; renders builders (`buildTodayHeader`, `buildTodayList`, `buildTodayRow`). Returns unmount function.
- **`js/views/settings.js`** is new in P3. Exports `mountSettings(parent, {repo, store})`. Subscribes to `store.notify()` for Data card live refresh (D-72). Builders: `buildStorageCard`, `buildScheduleCard`, `buildInstallCard`, `buildDataCard`, `buildAboutCard`.
- **`js/domain/cadence.js`** is new in P3. Pure module. Exports `appliesToday(habit, date, ctx)`; `ctx` = `{weekStart, weekCompletions}`. Re-exported and extended by P4 with the full cadence engine.
- **`js/domain/wave.js`** is new in P3. Loads `seed/waves.json` into an in-memory map at boot. Exports `currentWave(date)`, `getWave(number)`, `getAllWaves()`.
- **`js/state/apply/markUncompleted.js`** is new in P3. Sibling of `markCompleted.js`. Writes `{habitId, date, completed: false, definitionVersion: null}`. Inverse is `restoreLogRow` (existing). Recomputes `habit.lastCompletedDate` invariant.
- **`js/state/apply/setSetting.js`** is new in P3. Writes a settings row through the chokepoint so changes broadcast and undo correctly. Inverse = `setSetting` with the prior value.
- **`js/util/mount.js`** is new in P3. Single trusted DOM-construction helper. Used by every P3 mounter; enforced via D-78 grep test.
- **`css/settings.css`** is new in P3. Imported into `css/main.css` via `@import url(./settings.css) layer(view)`.
- **`seed/waves.json`** is new in P3. Outside `js/`; runtime-cached via SWR, not in SHELL.
- **`sw.js`** SHELL list grows per D-81. No SW logic changes.
- **`tests/unit/cadence.test.js`** (new) — exhaustive coverage of all 4 cadence types × DST-adjacent dates (2026-03-29 spring-forward, 2026-10-25 fall-back) + leap day (2028-02-29).
- **`tests/unit/discipline.xss.test.js`** (new) — D-78 grep gate.
- **`tests/unit/builders.test.js`** (new) — covers all P3 builders (today rows, settings cards) per D-76.
- **`tests/integration/today.test.js`** (new) — fake-IDB-backed today panel hydrate + render + tap + undo round-trip.

</code_context>

<specifics>
## Specific Ideas

- **The denormalized `habit.lastCompletedDate` invariant is the load-bearing data contract of this phase.** A contract test must verify "after any `markCompleted` or `markUncompleted` on (habit, date), `habit.lastCompletedDate` equals the most recent `completed:true` log's date (or null if none)." Without this invariant, the every-N-days resolver (D-50) is incorrect.
- **The cadence module must NOT read from IDB.** It is a pure module. The caller (`mountToday`'s hydrate) reads the data and passes it in `ctx`. This keeps the cadence module trivially testable in Node and aligns with the "pure builders" discipline.
- **Router on `file://`** — `hashchange` works on `file://` (unlike `history.pushState`). No need to feature-gate. SW silent-fail per PWA-04 still applies.
- **The Polish-name disclosure popover is one of the few P3 features the user can't unit-test from a builder alone** — the `aria-expanded` toggle is a mounter responsibility. Tests-browser.html (D-26 Tier 2) is the right gate for the integrated behavior.
- **`weekStart` change is undoable** — because `setSetting` flows through `apply.js`, every Settings toggle is in the events journal and is the most-recent undoable action. This is intentional: the user can flip Mon→Sun, see the cadence behavior change, hit Undo, and revert. Slightly unusual but consistent with "single mutator + single-step undo."
- **Optimistic flip + revert path** — `revertRow(rowEl, priorState)` is the only error-recovery code in the visible tap path. Implementation: capture row's pre-flip class list in a `prior` local; if `apply()` rejects, restore class list + show error toast. ~10 lines.
- **Hash deep-link** — `https://.../index.html#settings` opens directly to Settings. The router's initial-route resolution honors `location.hash` on boot. Useful for bookmarking the install-help section (e.g., `#settings` → scroll to install card).
- **Wave 4 is current as of 2026-05-28** (PROJECT.md context). `seed/waves.json` startDates should be picked so that `currentWave(2026-05-28)` returns wave 4 — e.g., wave 0 starts `2025-12-29`, wave 1 `2026-01-05`, ..., wave 4 `2026-01-26`, ..., wave 9 `2026-03-02`. Planner picks exact startDates from `Nawyki v1.xlsx` / `Nawyki-fale.txt` if available; otherwise derives from a 1-wave-per-week cadence anchored at the plan start.
- **No `BeforeInstallPromptEvent` capture in P3.** The install card just shows instructions; no in-app install button. Capturing the event for a programmatic install on Chromium is a clean P5/P6 future enhancement.

</specifics>

<deferred>
## Deferred Ideas

- **Wave model as first-class IDB store + v1→v2 migration** — promoted in P4 when WAVE-06 needs user-extensibility to define 2027 waves. P3 keeps wave data in-memory only via `seed/waves.json`.
- **Cadence engine full surface** — DST/leap-day edge cases beyond the test fixtures, MASTERY-06 7-day grace period overlap with every-N-days, CADENCE-07 month-end edge cases. P4 extends `js/domain/cadence.js`.
- **Collapsible / sub-tab Settings layout** — defer until Settings grows beyond ~6 cards (post-v1).
- **Storage estimate precision and formatting refinements** — "Using 0.4 MB of ~600 MB" is the rough shape; planner picks. Could become a more elaborate "Storage breakdown" view in a later phase.
- **Hash router beyond #today / #settings / #history** — P4 adds `#catalog`, P6 adds desktop-side routing. Router shape may grow to a map or a small dispatch table; P3's hashchange listener is the seed.
- **`BeforeInstallPromptEvent` capture for in-app install button** — Chromium / Edge can offer programmatic install via the captured event. Deferred to a later phase; install card in P3 is documentation-only.
- **Toast queue for batched-action feedback** — if the user ever bulk-marks N habits, the single-toast model would lose feedback for taps 2..N. P3 doesn't surface bulk operations (HISTORY-04 is P4); revisit if needed.
- **Per-row context menu (edit habit, archive habit) from Today** — long-press on a row could open a menu. Today in P3 is mark/unmark only; catalog ops are P4. Reserve long-press for that future use.
- **`markUncompleted` semantics with a `notes`/`reason` field** — currently writes `{completed: false}` only. A future phase might extend it for "missed because…" annotations.
- **Settings `weekStart` change reflowing already-completed weekly habits** — changing Mon→Sun mid-week changes "this ISO week" boundaries, which may make a previously-completed weekly habit re-appear (or hide). P3 accepts that as expected behavior (the resolver is consistent); UI doesn't pre-warn. If the user finds this confusing, a P4 "Are you sure? This changes how the current week is computed" dialog could land.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 3 scope per `gsd-sdk query todo.match-phase`.

</deferred>

---

*Phase: 3-Today View & Settings v1 (First Usable Slice)*
*Context gathered: 2026-05-28*
