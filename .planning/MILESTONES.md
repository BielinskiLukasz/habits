# Milestones: Nawyki (Habits)

## v1.1 Scheduled Habits (Shipped: 2026-08-27)

**Phases completed:** 3 phases, 9 plans, 10 tasks

**Key accomplishments:**

- `scheduled.js` domain service with one-time DATA-03 migration and every-boot SCHED-03 promotion passes, guarded by `scheduledMigrationV1` meta key.
- Status field in createHabit handler derives from startDate using lexicographic comparison: future startDate produces 'scheduled', past/today produces 'active'.
- Wired `configureScheduled`/`bootScheduled` into both HTML shell boot sequences and fixed `convert-nawyki.js` to emit `status:'scheduled'` for future-startDate habits.
- Implemented promoteHabit handler (SCHED-04) with RED/GREEN/REFACTOR cycle, completing the state mutation layer for scheduled → active habit promotion.
- Close gap G-08-4 by adding missing CSS rules for Upcoming section visual consistency (removes bullet dots, aligns buttons with active rows).

---

| Version | Name | Status | Shipped | Phases | Commits |
|---------|------|--------|---------|--------|---------|
| [v1.1](milestones/v1.1-ROADMAP.md) | Scheduled Habits | ✅ Shipped | 2026-08-27 | 7–9 | 169 |
| [v1.0](milestones/v1.0-ROADMAP.md) | MVP | ✅ Shipped | 2026-06-30 | 1–6 | 309 |

---

## v1.0 MVP

**Shipped:** 2026-06-30
**Phases:** 1–6 (44 plans)
**Timeline:** 2026-05-25 → 2026-06-30 (36 days)
**Commits:** 309
**Tests:** 756/758 (2 intentional stubs)
**Requirements:** 123/123 shipped

Complete offline-first PWA habit tracker: static vanilla HTML/JS/CSS, IndexedDB (7 stores), 
mobile Today check-in, desktop analytics, S1/S2/S3 scoring, JSON/CSV export-import.

Archives:

- [Roadmap](milestones/v1.0-ROADMAP.md)
- [Requirements](milestones/v1.0-REQUIREMENTS.md)
- [Audit](milestones/v1.0-MILESTONE-AUDIT.md)
