# Release Notes

## 🟩 **v1.1.0**
*Release date: 2026‑08‑27*

Scheduled Habits milestone — 3 phases, 15/15 requirements satisfied, milestone audit passed.

### Features

- **Scheduled habit status** (SCHED-01/02): Habits with a future `startDate` are stored with `status: 'scheduled'` rather than `active`. The `convert-nawyki.js` seed converter emits `scheduled` automatically for any habit whose `startDate` is in the future at seed load time, and the seed carries an optional `name_pl` field for source-derived habits.
- **Auto-promotion on boot** (SCHED-03): `bootScheduled()` runs in both shells at startup and auto-transitions any `scheduled` habit to `active` when `startDate ≤ today`. No manual action required for habits that simply reach their start date.
- **Manual promote to active** (SCHED-04): One-tap promote button in the Catalog Upcoming section lets the user move any scheduled habit to active before its start date. The promoted habit appears in Today's check-in immediately in the same session without a reload.
- **Catalog Upcoming section** (CAT-03/04): Scheduled habits are surfaced in their own "Upcoming" section below the active list, sorted ascending by `startDate`. Each item shows the habit name, wave assignment, and formatted start date.
- **Today and active Catalog exclude scheduled** (CAT-01/02): Scheduled habits never appear in the Today check-in list. The active Catalog list is likewise scoped to `active` and `mastered` habits only.
- **Waveboard Wave Planning section** (WAVE-01..04): The desktop Waveboard tab gains a planning section listing each wave with its active vs scheduled habit counts. Each wave is drillable: active habits show their current stage and S1 status; scheduled habits show their `startDate`. Built as a static DOM section driven by `buildWavePlanningSection`.
- **JSON import preserves scheduled status** (DATA-02): The merge-by-ID import path passes `status` through unchanged, so a backup taken before a habit's start date still correctly reflects its state.
- **One-time boot migration** (DATA-03): On first boot after the v1.1 schema upgrade, any existing habit whose `startDate` is in the future is silently reclassified from `active` to `scheduled`.

### Fixes

- **Waveboard IDB query non-iterable** (`0757a57`): `getHabitsForWave` was returning an `IDBRequest` object where the call-site expected an iterable array. Fixed the query to `await` the request before iteration; regression guard added in `tests/integration/`.
- **Wave planning showed 0 habits after import** (`c77923d`/`57e1977`): Habits imported from JSON were missing the `wave` field if the backup predated the field's introduction. Boot now backfills `wave` from the seed catalog on any habit where it is absent.
- **Waveboard stage column** (`c0592ef`): Stage label was read from `stages[currentStageIndex]` but the field is `label`, not `name`. Fixed; waveboard stage column now shows the correct stage label.
- **Waveboard `applicableToday`/`loggedToday` fields** (`374055b`): Heat-map cells were always rendering as "not logged" because the fields were never wired from the IDB query result. Fixed the projection in `buildWaveboard`.
- **`isMastered` not written to snapshots** (`c3a0800`): The mastery evaluation result was computed but not persisted in `score_snapshots`, so the Catalog mastery column was always blank. Fixed the `writeHabitSnapshots` write path to include `isMastered`.
- **Analytics columns blank after UAT** (`8cc38c4`/`43ad561`): `Rolling%`, `Mastery`, and `S2` columns were always empty because the view was computing inline rather than reading `score_snapshots`. Fixed to read persisted snapshot rows; fallback to latest snapshot when today has no log entry.
- **Scoring model not persisted across navigation** (`60e4a73`): The `scoringModel` setting was written to IDB but the Analytics view re-read the default on each mount. Fixed the mount to load from `getCachedSettings()`.
- **Import `_broadcast` call** (`92387e2`): `_broadcast` was referenced as a value where it should be called as a function in the import completion path. Fixed; cross-tab sync now fires correctly on import.
- **Catalog modal** (`651605c`): Create/edit panels were injected into the DOM as inline expanded sections. Reworked to use `<dialog id="catalog-modal">` and `showModal()` so the browser manages focus trapping and backdrop.
- **Dynamic form input accessibility** (`bb1f2de`/`d23ab7d`): Stage input fields and the history date picker were missing `id` and `name` attributes, breaking label association. Fixed across all dynamic builders.
- **Numeric/slot row completion styling** (`328031a`/`5a5d56b`): Completed numeric and slot rows were not receiving the `today-row--completed` class or the strikethrough decoration. `evt.preventDefault()` was also missing from the increment tap handler, causing scroll jitter on mobile.
- **6 pre-existing test failures resolved** (`fe060a7`): `import.test.js` broadcast stub (`_broadcast is not a function`), `mastery-cadence.test.js` and `wave-aggregates.test.js` stub failures — all pre-dating v1.1 work — were fixed and the suite brought to a clean baseline.

### Infrastructure

- **App icons** (`82c8274`/`e25b3f4`): 192 px and 512 px PNG icons added; `manifest.json` and the diagnostics install-state check updated to reference them.
- **Desktop Settings route** (`4bd644e`): Desktop shell now has a Settings nav item and `#settings` route, parity with mobile shell.
- **Regression guard for IDB non-iterable** (`63854b5`): Integration test asserts that `getHabitsForWave` returns an array, not an `IDBRequest`.

---

## 🟩 **v1.0.0**
*Release date: 2026‑06‑30*

Full v1.0.0 release of Nawyki — a vanilla-JS, offline-first PWA for tracking daily habits against a 47-week wave plan (~65 habits across 10 themed waves). Built across 6 vertical-slice phases, all completed and verified. Tagged `v1.0` on develop; full-app UAT (25 test cases) passed.

### What's included

#### Phase 1 — PWA Shell Chassis (`v0.1.0`, 2026-05-26)
- Versioned-cache module service worker: cache-first SHELL list + stale-while-revalidate for `/js/`; SW cache name derived from `APP_VERSION` (`habits-${APP_VERSION}`)
- Web App Manifest with maskable `icon.svg`; install affordance available at `localhost`
- Two HTML shells: `index.html` (mobile check-in) and `desktop.html` (desktop analytics), each with Cascade-Layers CSS scaffold (`@layer reset → tokens → base → components → view`)
- Silent-fail SW registration — `sw-register.js` guards `register()` behind `location.protocol.startsWith('http')` so `file://` opens without console errors
- Diagnostics panel reachable via `?debug=1` or long-press the title (~1.5 s, pointer-events based): shows version, schema version, SW state, cache name, install state, persistence state; Reset-shell and Reset-data actions

#### Phase 2 — Storage Foundation (`v0.2.0`, 2026-05-27)
- IndexedDB wrapper (`js/db/idb.js`) — ~80-line promise helper; the only file that calls `indexedDB` directly
- 7-store schema (`habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`) with additive migration dispatch table
- Single-mutator `apply()` chokepoint: all writes go through here; enforces data write + `events` row + `meta.undoToken` in one IDB transaction
- Persistent undo via `meta.undoToken`; undo path re-applies inverse event without a separate undo stack
- `BroadcastChannel('habits')` cross-tab sync — payload is keys-only; receivers re-read from IDB
- `visibilitychange → hidden` lifecycle flush (not `beforeunload`) — the only reliable hook on mobile PWAs
- `navigator.storage.persist()` requested on first write; idempotent seed loader for `seed/habits.json`
- Fake-IDB integration test helper (`tests/helpers/fake-idb.js`) with contract test enforcing surface parity with `repo.js`

#### Phase 3 — Today View + Settings v1 (`v0.3.0`, 2026-05-28)
- Cadence-aware Today view: 4 cadence resolvers (`weekly`, `everyNDays`, `byWeekday`, `free`) in a `RESOLVERS` dispatch table — no `switch` statements; shared single source of truth between Today and CSV export
- Tap-to-complete with optimistic DOM flip; `markCompleted` / `markUncompleted` handlers
- Undo toast: 5 s auto-dismiss, hover-pause, click-to-act; second undo surface in Settings → Data card
- Hash router (`js/router.js`) — file://-compatible; no `history.pushState`
- Settings panel: 5 groups (Storage, Schedule, Install, Data, About); Reset-data confirmation; `setSetting` handler

#### Phase 4 — Domain Model (`v0.4.0`, 2026-06-05)
- Habit CRUD: create, edit, archive, restore; UUID identity preserved across all edits via `habit_versions` — history records are never rewritten when a habit definition changes
- Future scheduling: habits can be given a `startDate`; the seed supports this at load time
- Stage progression: manual advance/demote and auto-advance after N consecutive days; composable OR triggers between conditions
- Mastery threshold evaluation: global defaults (90% completion in 70 days) with per-habit threshold and window overrides; Settings panel fields (SETTINGS-01)
- Multi-occurrence logging: numeric `+1` counter (`logNumeric`) for repeatable habits; slot-checklist (`logSlot`) for bounded sets
- History navigation: past-day lookup, mark-not-completed on historical days, bulk uncomplete
- Wave aggregate metrics (`js/domain/waveAggregates.js`): completion rate, status counts, longest streak, at-risk indicator

#### Phase 5 — Backup & Restore (`v0.5.0`*, 2026-06-29)
- JSON export: full-fidelity backup of every IDB store as a single Blob download; filename `habits-backup-YYYY-MM-DD.json`
- JSON import: merge-by-ID semantics — existing records overwritten where IDs match, new records inserted, local-only records preserved
- CSV export: wide habit × day matrix (rows = habits, columns = dates); cells `1` / `0` / `x` / numeric count; UTF-8 BOM for Windows Excel; CRLF row separators; filename `habits-completion-YYYY-MM-DD.csv`
- Backup-nag banner: tracks `nag:lastDismissed` in `localStorage`; surfaces after a configurable inactivity window
- Reset-data wired from Settings Data card and diagnostics panel

#### Phase 6 — Desktop Analytics & Scoring (`v0.5.0`, 2026-06-29)
- Desktop analytics shell (`desktop.html`) with sidebar navigation and three hash-routed panels: `#analytics`, `#waveboard`, `#planning`
- Analytics view: per-habit stats grouped by wave; S1 status badge; active scoring model score column
- Wave-board: 12-week heat-map grid (habit × ISO week); S1 status color coding (`--color-score-healthy/watch/atrisk/failing/na`)
- Planning view: forward-looking 12-week grid of habits sorted by startDate; links to Catalog
- Three scoring models computed in `js/domain/scoring.js`:
  - **S1** Rolling Threshold Health — primary model; drives the status badge
  - **S2** Day-Weighted — recency-weighted completion rate
  - **S3** Load-Adjusted Capacity — penalises high-cadence habits in proportion to load
- `score_snapshots` IDB store populated on every log write (rolling 70-day window) and on bulk Recompute; views read persisted rows — never recompute on render
- Settings: Scoring Model radio (S1/S2/S3) and "Recompute Scores" action

*Phase 5 APP_VERSION was bundled into the v0.5.0 bump at Phase 6 ship.

### Fixes (post-phase, pre-tag)

- **3 integration blockers** (`74f6468`): Wiring gaps discovered in the v1.0 milestone audit closed — DI seams in `desktop.js`, `apply.js` dispatch table registration for a handler, and a missing `configure*` call at boot.
- **Full-app UAT** (`022b6d1`): 25-case `UAT-v1.md` written and signed off across all 6 phases before tagging.
