# Roadmap: Nawyki (Habits)

## Milestones

### ✅ v1.0 MVP — Phases 1–6 (shipped 2026-06-30)

Complete offline-first PWA habit tracker: static vanilla HTML/JS/CSS, IndexedDB (7 stores),
mobile Today check-in + desktop analytics, S1/S2/S3 scoring trio, JSON/CSV export-import.
309 commits · 36 days · 123 requirements · 756 tests

→ Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

<details>
<summary>Phase details (v1.0 — archived)</summary>

## Overview

A vanilla multi-file static PWA habit tracker delivered in 6 phases: P1 lays a tooling-clean PWA shell, P2 builds the storage spine (raw IndexedDB, 7 stores, single-mutator chokepoint, versioned definitions, BroadcastChannel sync, lifecycle flush, idempotent seed), P3 ships the first usable artifact (mobile Today view rendering seed data with single-tap binary mark/unmark and persistent undo), P4 lights up the full domain model (cadence engine, catalog CRUD with versioned edits, stages, mastery threshold, multi-occurrence logging, history navigation, wave aggregates), P5 ships export/import (JSON full-fidelity + Polish-Windows-Excel-compatible CSV) plus the backup nag, and P6 ships the desktop analytics surface with the full S1/S2/S3 scoring trio behind a Settings toggle.

## Phases

- [x] **Phase 1: PWA Shell & Tooling Hygiene** — Static-hostable, file://-safe, versioned-cache PWA chassis (completed 2026-05-26)
- [x] **Phase 2: Storage Foundation (The Spine)** — Date utils, raw IDB, 7 stores, repo, single mutator, sync, lifecycle, seed (completed 2026-05-27)
- [x] **Phase 3: Today View & Settings v1 (First Usable Slice)** — Mobile check-in, single-tap mark/unmark, persistent undo, install help (completed 2026-05-29)
- [x] **Phase 4: Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves)** — Full habit lifecycle honoring versioned-edit invariant (completed 2026-06-05)
- [x] **Phase 5: Backup & Restore (JSON + CSV Exports, JSON Import, Nag)** — Full-fidelity JSON round-trip + Polish-Excel-compatible CSV + weekly backup banner (completed 2026-06-06)
- [x] **Phase 6: Desktop Analytics & Scoring Trio** — Desktop shell, analytics/wave-board/planning views, all three S1/S2/S3 scoring models (completed 2026-06-30)

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. PWA Shell & Tooling Hygiene | 5/5 | Complete | 2026-05-26 |
| 2. Storage Foundation (The Spine) | 6/6 | Complete | 2026-05-27 |
| 3. Today View & Settings v1 | 7/7 | Complete | 2026-05-29 |
| 4. Domain Model | 11/11 | Complete | 2026-06-05 |
| 5. Backup & Restore | 6/6 | Complete | 2026-06-06 |
| 6. Desktop Analytics & Scoring Trio | 8/8 | Complete | 2026-06-30 |

</details>

---

### v1.1 Scheduled Habits — Phases 7–9 (in progress)

Introduces `scheduled` as a first-class habit status for future-start habits, auto-transition on boot, manual promote, Catalog Upcoming section, and a desktop Waveboard showing per-wave scheduled/active habit lists with startDates.

## Phases

- [ ] **Phase 7: Scheduled Status Foundation** — Domain, storage, boot migration, converter, import
- [ ] **Phase 8: Today & Catalog — Upcoming Section** — Filter Today, Catalog Upcoming list, manual promote
- [ ] **Phase 9: Desktop Waveboard** — Wave rows with startDates, scheduled/active counts, habit lists

## Phase Details

### Phase 7: Scheduled Status Foundation
**Goal**: The app fully understands `scheduled` as a first-class status — stored correctly on create/import, auto-promoted to active on boot, and migrated from existing data
**Depends on**: Nothing (continues from v1.0 storage foundation)
**Requirements**: SCHED-01, SCHED-02, SCHED-03, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A habit created with a future startDate is stored in IDB with `status: 'scheduled'`, not `'active'`
  2. On app boot, any habit with `status: 'scheduled'` and `startDate <= today` is automatically set to `'active'` without user action
  3. Existing IDB habits that have `status: 'active'` and `startDate > today` are silently reclassified to `'scheduled'` on the first boot after this phase ships
  4. `scripts/convert-nawyki.js` outputs `status: 'scheduled'` for source habits whose `startDate` is in the future (relative to the run date)
  5. A JSON backup file containing `status: 'scheduled'` habits round-trips correctly through `mergeImportedStores` without status being overwritten
**Plans**: 3 plans
Plans:
- [ ] 07-01-PLAN.md — TDD: scheduled.js domain service (configureScheduled + bootScheduled + runMigration + runPromotion)
- [ ] 07-02-PLAN.md — TDD: createHabit status derivation from startDate
- [ ] 07-03-PLAN.md — Boot wiring (main.js + desktop.js) + convert-nawyki.js status fix + DATA-02 verification

### Phase 8: Today & Catalog — Upcoming Section
**Goal**: Users see only active (and mastered) habits on Today and in the active Catalog list; scheduled habits appear in a dedicated Upcoming section with startDate/wave info and a promote action
**Depends on**: Phase 7
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, SCHED-04
**Success Criteria** (what must be TRUE):
  1. Today check-in never shows a habit with `status: 'scheduled'`, regardless of its startDate
  2. The active Catalog list shows only active/mastered habits; no scheduled habits appear in that list
  3. Catalog shows an "Upcoming" section below the active list containing all scheduled habits sorted ascending by startDate
  4. Each entry in the Upcoming section displays the habit's startDate and wave name
  5. A "Promote to active" action on any Upcoming entry immediately moves the habit to `status: 'active'` and removes it from the Upcoming section
**Plans**: TBD
**UI hint**: yes

### Phase 9: Desktop Waveboard
**Goal**: The desktop Waveboard gives a planning-level overview of every wave — its startDate, how many habits are active vs scheduled, and a drillable list of those habits with their individual statuses
**Depends on**: Phase 8
**Requirements**: WAVE-01, WAVE-02, WAVE-03, WAVE-04
**Success Criteria** (what must be TRUE):
  1. Each wave is displayed in the desktop Waveboard as a row showing the wave's planned startDate
  2. Each wave row shows two counts at a glance: number of active habits and number of scheduled habits in that wave
  3. A user can expand (or always see) per-wave habit lists: scheduled habits show their individual startDate
  4. Active and mastered habits are listed per wave with their current status label (active / mastered)
**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Scheduled Status Foundation | 0/3 | Not started | - |
| 8. Today & Catalog — Upcoming Section | 0/? | Not started | - |
| 9. Desktop Waveboard | 0/? | Not started | - |

---

## Backlog

See [BACKLOG.md](BACKLOG.md) for captured ideas and issues.
