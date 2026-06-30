# Roadmap: Nawyki (Habits)

## Overview

A vanilla multi-file static PWA habit tracker delivered in 6 phases: P1 lays a tooling-clean PWA shell, P2 builds the storage spine (raw IndexedDB, 7 stores, single-mutator chokepoint, versioned definitions, BroadcastChannel sync, lifecycle flush, idempotent seed), P3 ships the first usable artifact (mobile Today view rendering seed data with single-tap binary mark/unmark and persistent undo), P4 lights up the full domain model (cadence engine, catalog CRUD with versioned edits, stages, mastery threshold, multi-occurrence logging, history navigation, wave aggregates), P5 ships export/import (JSON full-fidelity + Polish-Windows-Excel-compatible CSV) plus the backup nag, and P6 ships the desktop analytics surface with the full S1/S2/S3 scoring trio behind a Settings toggle. Every phase from P3 onward delivers a user-visible slice that builds on the prior one.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: PWA Shell & Tooling Hygiene** - Static-hostable, file://-safe, versioned-cache PWA chassis with reset-app debug (completed 2026-05-26)
- [x] **Phase 2: Storage Foundation (The Spine)** - Date utils, raw IDB, 7 stores + migrations, repo, single mutator, sync, lifecycle, seed (completed 2026-05-27)
- [ ] **Phase 3: Today View & Settings v1 (First Usable Slice)** - Mobile shell rendering seed data, single-tap binary mark/unmark, persistent undo, install help, persistence status
- [x] **Phase 4: Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves)** - Full habit lifecycle honoring the versioned-edit invariant (completed 2026-06-05)
- [x] **Phase 5: Backup & Restore (JSON + CSV Exports, JSON Import, Nag)** - Full-fidelity JSON round-trip + Polish-Excel-compatible CSV + weekly backup banner (completed 2026-06-06)
- [x] **Phase 6: Desktop Analytics & Scoring Trio** - Desktop shell, analytics/wave-board/planning views, all three S1/S2/S3 scoring models with Settings toggle (completed 2026-06-30)

## Phase Details

**Plans**: 5 plans

Plans:

- [x] 01-01-PLAN.md — Static scaffolding (APP_VERSION constant, CSS Cascade-Layers composer, locked token set, maskable icon, Web App Manifest)
- [x] 01-02-PLAN.md — Module service worker (versioned cache, activate cleanup, same-origin guard, cache-first shell + stale-while-revalidate for js/**) — switched from classic to module SW post-execution to fix the `importScripts` + `export` SyntaxError; cache prefix renamed `nawyki-` → `habits-`
- [x] 01-03-PLAN.md — Toast primitive + diagnostics panel (long-press, ?debug=1, Reset-shell handler with D-06 verbatim confirm)
- [x] 01-04-PLAN.md — Wiring (sw-register.js, mobile shell with empty Today scaffold, desktop stub, entry points; Walking Skeleton acceptance steps 1-7)
- [x] 01-05-PLAN.md — README + phase-gate device installs + GH Pages sub-path deploy verification

### Phase 2: Storage Foundation (The Spine)

**Goal**: Make every catastrophic data-integrity pitfall structurally impossible before any feature ships
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, SEED-01, SEED-02, SEED-03, SEED-04, SEED-05
**Success Criteria** (what must be TRUE):

  1. On first run, the bundled seed JSON loads ~65 habits into IndexedDB exactly once (subsequent loads are no-ops)
  2. All habit, log, and event data persists across full browser restarts via IndexedDB scoped to the app origin
  3. `navigator.storage.persist()` is called on the first write and its result is observable in DevTools
  4. Two open tabs of the app see each other's writes (BroadcastChannel propagates mutations; receiving tabs re-read from IDB)
  5. Pending writes flush on `visibilitychange → hidden` (never on `beforeunload`) so backgrounding the PWA on mobile is durable

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — CI workflow + scripts/serve.js + test fakes (fake-IDB with tx-shape per W1, fake-BC, fake-storage, fake-document) + js/util/date.js (DATA-06 with DST + leap fixtures) + js/util/id.js (UUID + Pitfall 13 fallback)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — js/db/schema.js (7-store v1 incl. score_snapshots per D-39, events UUID per D-42) + js/db/idb.js (~80-line promise wrapper, DB_NAME=habits per D-30) + js/db/repo.js (typed facade matching fake-IDB surface) + A7 contract test + repo surface driver test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — js/state/{store,apply,undo}.js + js/state/apply/markCompleted.js + js/platform/{sync,lifecycle}.js (BroadcastChannel(habits), visibilitychange flush, persistent undo via meta.undoToken)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — seed/habits.json (8 habits covering D-32 matrix) + js/io/seed.js (idempotent merge-by-id + first-run persist()) + integration tests (split per W2: seed-only)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Reset-data wiring (D-44) + main/desktop boot calls (top-level await per N1) + sw.js SHELL extension + checkpoint:human-verify (manual smoke checklist) (split per W2: wiring + checkpoint)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-06-PLAN.md — APP_VERSION bump 0.1.0 → 0.2.0 + docs edits for D-30 (BroadcastChannel name) + D-35 (English habit names primary) + D-46 (node scripts/serve.js) + ARCHITECTURE.md forward-edits

### Phase 3: Today View & Settings v1 (First Usable Slice)

**Goal**: Deliver the friction-free daily check-in that is the product's literal core value, against seed data
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, LOG-01, UNDO-01, UNDO-02, UNDO-03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07
**Success Criteria** (what must be TRUE):

  1. User opens `index.html` on mobile and the Today view renders synchronously with today's date, current wave context, and today's binary habits in under 300 ms cold paint
  2. User marks a binary habit complete with a single tap and sees the row update in under 100 ms
  3. User unmarks a previously-completed habit with a single tap from the same row
  4. User undoes the last mark/unmark from a toast or Settings shortcut; the undo still works after a full page reload (persisted via `meta.undoToken`)
  5. User opens Settings and sees persistence status (Persistent: yes/no), app + schema versions, and platform-detected install instructions (iOS Share / Android Install / desktop URL-bar icon)

**Plans**: 7 (03-01 .. 03-07; cadence/today/tap-to-log/undo-toast/settings-v1/closeout/uat-gap-closure)

- [x] 03-01-PLAN.md — pure-domain foundations: `js/domain/cadence.js` (4-cadence resolver, D-48..D-51) + `js/domain/wave.js` + `seed/waves.json` (D-56/D-57) + `js/util/mount.js` (D-77) + D-78 grep-gate + 4 new util/date.js helpers + 2 new repo bounded-reads (NFR-01 enabler); 100 → 174 tests green
- [x] 03-02-PLAN.md — Today renders: `js/router.js` (hash router with allowlist resolution, D-60/D-80) + `js/views/today/builders.js` (4 pure description-tree builders, D-54..D-58/D-76/D-79) + `js/views/today.js` (mountToday + mountFooterNav with subscribe/unsubscribe) + expanded `js/state/store.js` cache (habits + this-week logs + weekStart, D-52/NFR-01) + 3-section `<section data-route>` shell + 44×44 tap targets (NFR-06); 174 → 209 tests green
- [x] 03-03-PLAN.md — tap-to-log: `js/state/apply/markUncompleted.js` (D-74 handler + `_recomputeLastCompletedDate` D-52 invariant) + `markCompleted.js` rewired through the shared helper + `apply.js` HANDLERS + notify DI seam + `store.js` notify-driven cache refresh (D-72) + `repo.getLogsByHabit` + `views/today.js` synchronous optimistic flip + revertRow on apply reject; 209 → 232 tests green (CORE-02, CORE-03, LOG-01, NFR-02 functionally complete)
- [x] 03-04-PLAN.md — undo toast surface: `js/views/toast.js` extended with `_showToast` internal helper + `showUndoToast` (D-69 5s auto-dismiss + hover-pause + D-70 single-toast invariant + D-71 verb+habit copy) + `showErrorToast` (D-73 error variant); `js/views/today.js` wires both onto the tap success/reject paths so the 03-03 `console.warn` placeholder is GONE; D-08 SW-update no-auto-dismiss contract regression-guarded; 232 → 249 tests green (UNDO-01, UNDO-02, UNDO-03 functionally complete)
- [x] 03-05-PLAN.md — Settings v1: `js/state/apply/setSetting.js` (D-75 self-inverting chokepoint handler) + HANDLERS extension + `js/views/settings/builders.js` (5 pure builders for Storage/Schedule/Install/Data/About cards, D-61..D-66/D-79) + `js/views/settings.js` (mountSettings composes the 5 cards in locked order, subscribes to D-72 notify for Schedule + Data live refresh, wires action closures through apply/undo with D-67 SETTINGS-flavored Reset confirm distinct from D-06) + `css/settings.css` + `index.html` h1 slot + `js/main.js` route function; 249 → 275 tests green (SETTINGS-04, SETTINGS-05, PWA-07 functionally complete; UNDO-01 2nd surface complete)
- [x] 03-06-PLAN.md — closeout: `tests/integration/sw.shell.test.js` (D-81 SHELL coverage regression guard — 4 tests: P2 baseline + P3 required + SWR exception + on-disk existence) + `sw.js` SHELL +11 P3 entries + `js/util/version.js` APP_VERSION 0.2.0 → 0.3.0 (D-28) + `README.md` 'Version history' section + `VERSIONING.md` 'Release history' section (v0.3.0 entry + back-filled v0.1.0/v0.2.0); 3 atomic commits (1 test + 1 feat + 1 docs); 275 → 279 tests green

**UI hint**: yes

### Phase 4: Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves)

**Goal**: Light up the full habit lifecycle the user already practices, with definition edits that never rewrite history
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CATALOG-01, CATALOG-02, CATALOG-03, CATALOG-04, CATALOG-05, CATALOG-06, CATALOG-07, CADENCE-01, CADENCE-02, CADENCE-03, CADENCE-04, CADENCE-05, CADENCE-06, CADENCE-07, STAGE-01, STAGE-02, STAGE-03, STAGE-04, STAGE-05, STAGE-06, STAGE-07, MASTERY-01, MASTERY-02, MASTERY-03, MASTERY-04, MASTERY-05, MASTERY-06, MASTERY-07, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, HISTORY-01, HISTORY-02, HISTORY-03, HISTORY-04, HISTORY-05, HISTORY-06, WAVE-01, WAVE-02, WAVE-03, WAVE-04, WAVE-05, WAVE-06, SETTINGS-01, NFR-10
**Success Criteria** (what must be TRUE):

  1. Today view filters habits to only those whose cadence rules say they apply today (daily / weekly / monthly / every-N-days / day-of-week subset), including correct behavior across DST and leap days
  2. User creates, edits, archives, restores, and future-schedules habits from a catalog view; editing a habit creates a new `habit_versions` row and leaves all prior log rows untouched (a 3-month-old day still evaluates against its original definition)
  3. User logs multi-occurrence habits as numeric `+1` counters OR slot-checklists (with anonymous or user-labeled slots per habit) and sees progress toward target (e.g., `3 / 7 meals`); the period counts as completed only when the target is reached
  4. User advances habit stages via any composition of manual button / scheduled-by-week / after-N-days triggers; manual demotion is possible
  5. Habits that meet their threshold over their window display a "mastered" visual treatment (muted + badge) but remain visible and tappable on Today; default 90% / 70 days is configurable globally in Settings and overridable per habit; new habits get a 7-day grace period
  6. User navigates to any past day, sees the habits that applied that day (per their cadence at that time), and can mark not-completed individually or bulk-mark all not-yet-completed
  7. User views wave-level aggregates (completion %, status counts, longest active streak, "wave at risk" indicator) and can define a future wave plan (e.g., 2027)

**Plans**: 10 plans

Plans:

**Wave 1** *(pure domain — parallel)*

- [x] 04-01-PLAN.md — Cadence extension: monthly resolver + startDate guard + date helpers (isInGracePeriod, getMonthStart, getMonthEnd) — CADENCE-01..07, CATALOG-07
- [x] 04-02-PLAN.md — Mastery domain: `js/domain/mastery.js` evaluateMastery (rolling window, cadence-aware denominator, grace period, per-habit override, multi-log-type dispatch) — MASTERY-01..07
- [x] 04-03-PLAN.md — Stage domain: `js/domain/stage.js` evaluateStageTriggers (OR-composed manual/scheduled/N-days/threshold triggers) + demoteStage — STAGE-01..07
- [x] 04-04-PLAN.md — Wave aggregates: `js/domain/waveAggregates.js` computeWaveAggregates (completion%, status counts, streak, at-risk) — WAVE-01..06

**Wave 2** *(infrastructure + handlers — parallel)*

- [x] 04-05-PLAN.md — Repo extensions (getLogsForDate, getHabitVersionAtDate) + createHabit + editHabit apply handlers + fake-idb extension + integration tests — CATALOG-01..04, CATALOG-07, NFR-10
- [x] 04-06-PLAN.md — archiveHabit + restoreHabit + advanceStage + demoteStage + logNumeric + logSlot apply handlers — CATALOG-05..06, STAGE-03..07, LOG-02..06, HISTORY-05
- [x] 04-07-PLAN.md — setMasteryThreshold + setMasteryWindow apply handlers + Settings Mastery card (SETTINGS-01) — MASTERY-01..02, SETTINGS-01

**Wave 3** *(UI — parallel)*

- [x] 04-08-PLAN.md — Catalog view: `js/views/catalog.js` + `js/views/catalog/builders.js` + `css/catalog.css` + #catalog route in router/main/HTML — CATALOG-01..07, STAGE-01..03, MASTERY-02..03
- [x] 04-09-PLAN.md — History view: `js/views/history.js` + builders + CSS + Today multi-occurrence renderers (numeric +/- buttons, slot disclosure) — HISTORY-01..06, LOG-02..06

**Wave 4** *(closeout)*

- [x] 04-10-PLAN.md — Phase closeout: seed.json enrichment (stages, targetType), sw.js SHELL P4 extension, sw.shell.test.js P4_REQUIRED list, APP_VERSION 0.3.0 → 0.4.0, VERSIONING.md — CADENCE-01..05, NFR-10

**UI hint**: yes

### Phase 5: Backup & Restore (JSON + CSV Exports, JSON Import, Nag)

**Goal**: Make catastrophic IndexedDB loss recoverable and give the user the CSV they actually paste into Polish Windows Excel
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, EXPORT-05, EXPORT-06, EXPORT-07, EXPORT-08, IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, SETTINGS-03
**Success Criteria** (what must be TRUE):

  1. User downloads a full-fidelity JSON backup from Settings; the file embeds `schemaVersion` and round-trips byte-for-byte through re-import (merge-by-id, never deletes local-only records)
  2. User downloads a habit × day CSV from Settings; opening it by double-click in Polish Windows Excel renders Polish diacritics (ą ć ę ł ń ó ś ź ż) correctly and aligns columns (semicolon delimiter, UTF-8 BOM, CRLF)
  3. CSV cells encode `1` (applicable + done), `0` (applicable + missed), `x` (not applicable per cadence); multi-occurrence habits show their numeric count instead of `1`; filename includes the export date
  4. Import rejects files from a newer `schemaVersion` with a clear error and broadcasts a reload signal to other tabs after a successful merge
  5. Settings shows "Last backup: N days ago" and a nag appears weekly to remind the user to export

**Plans**: 6 plans

Plans:

**Wave 1** *(TDD: CSV, JSON export, import, nag logic — parallel)*

- [x] 05-01-PLAN.md — CSV cell encoding (TDD): csvCellValue (1/0/x/numeric), escapeCSVField (RFC 4180 quoting), cadence-aware denominators, multi-occurrence handling — EXPORT-03, EXPORT-06
- [x] 05-02-PLAN.md — JSON export (TDD): exportJSON (all 7 stores), schemaVersion embedding, configureExport DI — EXPORT-01, EXPORT-02
- [x] 05-03-PLAN.md — JSON import (TDD): mergeImportedStores (merge-by-id), schema validation (reject newer), atomic tx — IMPORT-01, IMPORT-02, IMPORT-03
- [x] 05-04-PLAN.md — Backup nag (TDD): daysSinceLastBackup, shouldShowNag (7-day threshold + dismissal), dismissNag (localStorage) — EXPORT-08 calculation

**Wave 2** *(execute: file I/O, UI wiring, nag banner — parallel)*

- [x] 05-05-PLAN.md — Export/import file I/O + Settings Data card: exportCSV full generation (BOM/CRLF), Blob download, file picker, lastBackupDate update, broadcast on import — EXPORT-04, EXPORT-05, EXPORT-07, IMPORT-04, SETTINGS-03
- [x] 05-06-PLAN.md — Nag banner UI + dismissal: buildDataCard with conditional banner, Settings mount logic, live refresh, dismiss action, localStorage reset on Reset-data — EXPORT-08 UI

**UI hint**: yes

### Phase 6: Desktop Analytics & Scoring Trio

**Goal**: Deliver the desktop analytics surface with all three scoring models live and switchable
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: SCORING-01, SCORING-02, SCORING-03, SCORING-04, SCORING-05, SCORING-06, SCORING-07, SCORING-08, SCORING-09, DESKTOP-01, DESKTOP-02, DESKTOP-03, DESKTOP-04, DESKTOP-05, DESKTOP-06, DESKTOP-07, SETTINGS-02, SETTINGS-06, NFR-03, NFR-05, NFR-08
**Success Criteria** (what must be TRUE):

  1. User opens `desktop.html` (reachable via an explicit "Switch to desktop view" link in Settings — never auto-redirected by viewport) and sees a true desktop analytics layout, not a widened mobile view
  2. User views per-habit stats, per-wave aggregates, a wave-board timeline of habits across waves with status colors, and a planning view to schedule habits to start in a future week
  3. User picks between S1 (Rolling Threshold Health), S2 (Day-Weighted Wave Score), S3 (Load-Adjusted Capacity Score) from Settings; switching models updates dashboards without a reload; S1 is the default
  4. All three scoring models honor cadence-aware denominators, a 7-day new-habit grace period, and a 0.3× weighting for mastered habits; scoring outputs are persisted in the `score_snapshots` store (views read snapshots, never call `scoring.js` on render)
  5. User triggers "Recompute scores" from Settings and snapshots are re-run; the desktop view renders 5 years of synthetic data in under 2 s on the latest 2 versions of Chrome / Edge / Firefox / Safari with zero outbound network calls

**Plans**: 9/8 plans complete

Plans:

**Wave 1** *(pure domain — parallel)*

- [x] 06-01-PLAN.md — Pure scoring domain: `js/domain/scoring.js` (computeS1, computeS2, computeS3 — pure functions, TDD) — SCORING-01, SCORING-04, SCORING-05, SCORING-06, SCORING-07, SCORING-09
- [x] 06-02-PLAN.md — Score snapshot writer: `js/io/scoreSnapshots.js` (writeHabitSnapshots + rebuildAllSnapshots with single-tx-per-habit strategy, TDD) — SCORING-08, SCORING-09, NFR-03

**Wave 2** *(infrastructure + shell — parallel)*

- [x] 06-03-PLAN.md — Snapshot write-time trigger + Settings Scoring Model card + Recompute action: apply.js onLogWrite DI seam, buildScoringModelCard, Recompute button in Data card, desktop link in Settings — SCORING-02, SCORING-03, SETTINGS-02, SETTINGS-06, DESKTOP-01
- [x] 06-04-PLAN.md — Desktop shell: router.js defaultRoute param, desktop.html sidebar+panels structure, js/desktop.js route dispatch, css/desktop.css layout + scoring status tokens in css/tokens.css — DESKTOP-02, DESKTOP-07, NFR-05

**Wave 3** *(desktop views — parallel)*

- [x] 06-05-PLAN.md — Analytics view: `js/views/desktop/analytics.js` (mountAnalytics + pure builders, TDD), reactive model switching, "Show archived" toggle — DESKTOP-03, SCORING-02, SCORING-03
- [x] 06-06-PLAN.md — Wave-board view: `js/views/desktop/waveboard.js` (mountWaveboard + builders, TDD), 12-week heat-map, sticky habit column, S1 status colors — DESKTOP-04
- [x] 06-07-PLAN.md — Planning view: `js/views/desktop/planning.js` (mountPlanning + builders, TDD), forward 12-week grid, future habits only, Catalog links — DESKTOP-05, DESKTOP-06

**Wave 4** *(closeout)*

- [x] 06-08-PLAN.md — Phase closeout: sw.js SHELL P6 extension, sw.shell.test.js P6_REQUIRED list, APP_VERSION 0.4.0 → 0.5.0, VERSIONING.md v0.5.0 entry — NFR-08

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PWA Shell & Tooling Hygiene | 5/5 | Complete | 2026-05-26 |
| 2. Storage Foundation (The Spine) | 6/6 | Complete    | 2026-05-27 |
| 3. Today View & Settings v1 | 7/7 | Complete | 2026-05-29 |
| 4. Domain Model | 11/11 | Complete    | 2026-06-05 |
| 5. Backup & Restore | 6/6 | Complete    | 2026-06-06 |
| 6. Desktop Analytics & Scoring Trio | 9/8 | Complete   | 2026-06-30 |

## Backlog

See [BACKLOG.md](BACKLOG.md) for captured ideas and issues.
