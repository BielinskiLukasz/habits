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

## Backlog

See [BACKLOG.md](BACKLOG.md) for captured ideas and issues.
