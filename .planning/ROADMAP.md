# Roadmap: Nawyki (Habits)

## Overview

A vanilla multi-file static PWA habit tracker delivered in 6 phases: P1 lays a tooling-clean PWA shell, P2 builds the storage spine (raw IndexedDB, 7 stores, single-mutator chokepoint, versioned definitions, BroadcastChannel sync, lifecycle flush, idempotent seed), P3 ships the first usable artifact (mobile Today view rendering seed data with single-tap binary mark/unmark and persistent undo), P4 lights up the full domain model (cadence engine, catalog CRUD with versioned edits, stages, mastery threshold, multi-occurrence logging, history navigation, wave aggregates), P5 ships export/import (JSON full-fidelity + Polish-Windows-Excel-compatible CSV) plus the backup nag, and P6 ships the desktop analytics surface with the full S1/S2/S3 scoring trio behind a Settings toggle. Every phase from P3 onward delivers a user-visible slice that builds on the prior one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: PWA Shell & Tooling Hygiene** - Static-hostable, file://-safe, versioned-cache PWA chassis with reset-app debug
- [ ] **Phase 2: Storage Foundation (The Spine)** - Date utils, raw IDB, 7 stores + migrations, repo, single mutator, sync, lifecycle, seed
- [ ] **Phase 3: Today View & Settings v1 (First Usable Slice)** - Mobile shell rendering seed data, single-tap binary mark/unmark, persistent undo, install help, persistence status
- [ ] **Phase 4: Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves)** - Full habit lifecycle honoring the versioned-edit invariant
- [ ] **Phase 5: Backup & Restore (JSON + CSV Exports, JSON Import, Nag)** - Full-fidelity JSON round-trip + Polish-Excel-compatible CSV + weekly backup banner
- [ ] **Phase 6: Desktop Analytics & Scoring Trio** - Desktop shell, analytics/wave-board/planning views, all three S1/S2/S3 scoring models with Settings toggle

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
**Plans**: TBD

### Phase 3: Today View & Settings v1 (First Usable Slice)
**Goal**: Deliver the friction-free daily check-in that is the product's literal core value, against seed data
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, LOG-01, UNDO-01, UNDO-02, UNDO-03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07
**Success Criteria** (what must be TRUE):
  1. User opens `index.html` on mobile and the Today view renders synchronously with today's date, current wave context, and today's binary habits in under 300 ms cold paint
  2. User marks a binary habit complete with a single tap and sees the row update in under 100 ms
  3. User unmarks a previously-completed binary habit with a single tap from the same row
  4. User undoes the last mark/unmark from a toast or Settings shortcut; the undo still works after a full page reload (persisted via `meta.undoToken`)
  5. User opens Settings and sees persistence status (Persistent: yes/no), app + schema versions, and platform-detected install instructions (iOS Share / Android Install / desktop URL-bar icon)
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PWA Shell & Tooling Hygiene | 5/5 | Awaiting human verification | - |
| 2. Storage Foundation (The Spine) | 0/TBD | Not started | - |
| 3. Today View & Settings v1 | 0/TBD | Not started | - |
| 4. Domain Model | 0/TBD | Not started | - |
| 5. Backup & Restore | 0/TBD | Not started | - |
| 6. Desktop Analytics & Scoring Trio | 0/TBD | Not started | - |
