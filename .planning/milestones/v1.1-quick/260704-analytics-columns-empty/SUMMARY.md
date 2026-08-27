---
quick_id: 260704-analytics-columns-empty
status: complete
date: 2026-07-04
commit: 43ad561 7bc7c99
---

# Quick Task 260704-analytics-columns-empty: Summary

## What was done

Fixed four discrete bugs causing empty values in the Analytics panel (Rolling %, Mastery, S2, Stage columns):

1. **Missing createdAt fallback** — Seeded habits in `habits.json` have no `createdAt` field. `writeHabitSnapshots` used `habit.createdAt` as the date-range start; `dateRange(undefined, today)` yields zero iterations because `undefined <= dateString` is `false`. Fixed by adding a fallback chain: `habit.createdAt ?? habit.startDate ?? daysFrom(today, -(windowDays-1))`.
2. **Boot-time snapshots never written** — Analytics was blank on first open because no log write had ever triggered the snapshot writer. Fixed by adding a fire-and-forget boot-time rebuild in `desktop.js` gated on `meta.snapshotsBootstrapped`.
3. **Stage column blank** — `analytics.js` read `habit.stage` (undefined); the IDB schema uses `stages[]` + `currentStageIndex`. Fixed by deriving stage from `currentStageIndex + 1`.
4. **S3 double-normalization + weekly denominator inflation** — S3 was double-dividing by `loadCount` then `applicableDays`. Weekly habits had denominator inflated to 70 because `ctx.weekCompletions` was hardcoded to `() => 0`. Both fixed in `scoring.js` and `scoreSnapshots.js`.

## Files changed

- `js/io/scoreSnapshots.js` — createdAt fallback, correct weekly cadence ctx
- `js/desktop.js` — boot-time snapshot rebuild
- `js/domain/scoring.js` — S3 formula fix
- `js/views/desktop/analytics.js` — Stage column derivation fix
- `tests/unit/io/scoreSnapshots.test.js` — regression tests for missing createdAt

## Commits

`43ad561` — fix(analytics): normalize missing createdAt in writeHabitSnapshots (UAT-T21-v3)
`7bc7c99` — fix(analytics): fix Stage column, S3 scale, and weekly Rolling% bugs
