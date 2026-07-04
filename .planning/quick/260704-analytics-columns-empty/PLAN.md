---
slug: analytics-columns-empty
created: 2026-07-04
status: in-progress
source: UAT Test 21
---

# Fix: Analytics Columns Empty (Rolling %, Mastery, S2)

## Problem

The Analytics panel on desktop.html shows empty values for Rolling %, Mastery, and S2 score columns. Data doesn't reflect today's habit edits or newly added habits. Score snapshots exist in IDB (written by scoreSnapshots.js on log change) but the Analytics view is not reading or displaying them.

## Expected Behavior

- Rolling % column shows S1 score per habit
- Mastery column shows badge for habits above mastery threshold
- S2 score column shows when S2 model is active
- Data updates when habits are edited or added (or after Recompute Scores)

## Files to Investigate

- `js/views/desktop/analytics.js` — main analytics view; reads score_snapshots IDB
- `js/io/scoreSnapshots.js` — snapshot writer; check what row shape is written
- `js/desktop.js` — wires analytics mount; check what repo/store is passed

## Tasks

1. Read `js/views/desktop/analytics.js` — trace how snapshots are fetched and rendered into table cells
2. Read `js/io/scoreSnapshots.js` — confirm snapshot row shape (`{habitId, date, s1Score, s1Status, s2Score, s3Score}`)
3. Check if snapshots actually exist in IDB (can grep for how they're queried)
4. Find the broken link: either snapshots are not being written, not being queried correctly, or the table cell builder is not reading the right field
5. Fix and add regression test if missing
6. Run tests: `node --test`
7. Commit atomically
