# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## waveboard-idb-databinding — all waveboard cells render as "na" due to IDBRequest non-iterable bug
- **Date:** 2026-08-27
- **Error patterns:** waveboard cells na, heat-map empty, TypeError snapshotRows not iterable, IDBRequest not iterable, runTx body returns IDBRequest, cachedCellData empty
- **Root cause(s):** waveboard.js called repo.runTx() with a body returning a raw IDBRequest (not a Promise); idb.js runTx does `await body(tx)` — IDBRequest is not thenable so await resolves to the IDBRequest object itself; for-of on the IDBRequest throws TypeError caught silently; cachedCellData stays empty; all cells render as waveboard-cell--na
- **Fix:** Added repo.getSnapshotsInRange(startYMD, endYMD) to js/db/repo.js following the getLogsInRange() pattern (uses indexGetAll — returns Promise<object[]>); waveboard.js refresh() replaced inline runTx block with repo.getSnapshotsInRange(); fake-idb.js and contract test updated
- **Files changed:** js/db/repo.js, js/views/desktop/waveboard.js, tests/helpers/fake-idb.js, tests/integration/contract.fake-vs-real.test.js, tests/integration/repo.snapshotsInRange.test.js
- **Why not caught:** no gate prevented direct use of runTx() with a body returning a raw IDBRequest; the pitfall was documented in repo.js JSDoc but not enforced; no test existed for the waveboard snapshot query path
- **Recurrence guard:** regression test at tests/integration/repo.snapshotsInRange.test.js — "result from non-empty store is iterable via for-of without throwing TypeError" (10 tests including boundary neighbours N±1, multi-habit, single-day range)
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

