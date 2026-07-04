---
status: resolved
created: 2026-07-04
slug: phase-06-uat-21-analytics-empty
trigger: manual
---

# Debug Session: UAT-T21 Analytics Columns Empty

## Symptom
Rolling%, Mastery, S2 columns empty in desktop analytics after 2 fix commits:
- commit 9fd5266: fix(analytics): populate Rolling%, Mastery, S2 columns from score_snapshots (UAT-T21)
- commit 2d38c94: fix(analytics): fall back to latest snapshot when today has no log (UAT-T21-v2)

## Current Focus
**hypothesis:** CONFIRMED — seed habits lack `createdAt`; dateRange(undefined, today) yields zero iterations; no snapshots written
**next_action:** Apply fix to scoreSnapshots.js (normalize effectiveCreatedAt) and desktop.js (boot-time rebuild)

## Evidence
- 2026-07-04: habits.json seed data has NO `createdAt` field on any habit (confirmed by reading file)
- 2026-07-04: seed.js line 168 spreads habit as-is: `tx.objectStore('habits').put({ ...h, slots: normalizeSlotsToArray(h.slots) })` — no createdAt added
- 2026-07-04: writeHabitSnapshots line 137: `const startDate = habit.createdAt` — undefined for seeded habits
- 2026-07-04: node -e confirmed: `undefined <= '2026-07-04'` evaluates to `false`; dateRange(undefined, today) yields []
- 2026-07-04: snapshotRows stays empty → repo.runTx puts nothing → score_snapshots store stays empty
- 2026-07-04: analytics.js refresh() calls getLatestSnapshot(habitId) → returns undefined → cachedSnapshots Map is empty → all cells show '—'
- 2026-07-04: Both main.js and desktop.js correctly wire onLogWrite seam ✓
- 2026-07-04: getLatestSnapshot IDBKeyRange.bound([habitId,'0000'],[habitId,'9999']) is correct ✓

## Eliminated
- hypothesis: desktop.js onLogWrite seam not wired
  evidence: desktop.js line 82-84 correctly wires onLogWrite; main.js also correctly wired
  timestamp: 2026-07-04

- hypothesis: IDBKeyRange.bound incorrect for compound key
  evidence: range = [habitId,'0000-01-01'] to [habitId,'9999-12-31'] is correct IDB compound key range
  timestamp: 2026-07-04

## Root Cause
Seeded habits in habits.json lack `createdAt` field. seed.js writes them as-is (no backfill). In writeHabitSnapshots, `startDate = habit.createdAt = undefined`. The condition `undefined <= todayYMD` evaluates to false (confirmed by running node), causing dateRange to yield zero iterations and no snapshot rows to be written. The analytics view reads getLatestSnapshot() → undefined → shows '—' for all score columns.

## Resolution
root_cause: habits.json seed data lacks `createdAt` field; seeded habits in IDB have habit.createdAt = undefined; writeHabitSnapshots uses habit.createdAt as the snapshot date range start; dateRange(undefined, today) yields zero rows because `undefined <= dateString` is false in JavaScript; score_snapshots store stays perpetually empty for seeded habits; analytics shows '—' for all score columns
fix: (1) scoreSnapshots.js: normalize effectiveCreatedAt with fallback chain `habit.createdAt ?? habit.startDate ?? daysFrom(today, -(windowDays-1))`; pass habitForScoring (with guaranteed createdAt) to scoring functions to prevent TypeError in isInGracePeriod. (2) desktop.js: add fire-and-forget boot-time rebuild when meta.snapshotsBootstrapped is not set, so analytics populates on first open without requiring a manual log write.
files_changed: [js/io/scoreSnapshots.js, js/desktop.js]
