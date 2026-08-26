# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## phase-06-uat-11-history-names — seeded habits display post-edit name in history view
- **Date:** 2026-08-27
- **Error patterns:** historical habit names changed, history shows new name after edit, version undefined, getHabitVersionAtDate returns undefined, NFR-10, UAT-11, history integrity
- **Root cause(s):** seed.js never wrote rows to the `habit_versions` store; the runTx stores list omitted `habit_versions`; when a seeded habit was edited, the only version row had effectiveFrom=editDate (new name); getHabitVersionAtDate returned undefined for any date before the edit; history.js fell back to the current habit object (post-edit name)
- **Fix:** Added `habit_versions` to seed.js runTx stores list; writes initial version row per seeded habit (effectiveFrom = startDate ?? '0000-01-01'); added one-time backfill migration for existing databases gated by meta.habitVersionsSeeded
- **Files changed:** js/io/seed.js, tests/integration/seed.idempotent.test.js
- **Why not caught:** no test asserted that seeded habits had habit_versions rows; the NFR-10 (history integrity) invariant was tested at the editHabit layer but not at the seed layer; gap between createHabit (which correctly wrote versions) and seed (which bypassed the createHabit handler)
- **Recurrence guard:** regression test at tests/integration/seed.idempotent.test.js — "NFR-10 — each seeded habit gets an initial habit_versions row (UAT-11 fix)" (2 tests: first-run write + migration backfill)
---

