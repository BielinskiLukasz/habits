---
status: resolved
trigger: "Analytics view on desktop.html still shows empty columns (Rolling %, Mastery, S2 score) after previous fix (commit 9fd5266)"
created: 2026-07-04T00:00:00Z
updated: 2026-07-04T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "analytics.js refresh() calls repo.getSnapshot(habitId, today) which queries score_snapshots by the exact compound key [habitId, todayLocal()]; snapshots are only written when a log is mutated (writeHabitSnapshots runs from habit.createdAt to todayLocal() AT THE TIME of the log write); if no log was written today, no row for [habitId, today] exists in score_snapshots, so getSnapshot returns undefined for every habit, producing empty columns"
  confirming_evidence:
    - "analytics.js lines 446-451: const today = todayLocal(); snap = await repo.getSnapshot(habit.id, today)"
    - "repo.getSnapshot(habitId, date) calls idb.get(db, 'score_snapshots', [habitId, date]) — exact primary-key match only, no fallback"
    - "scoreSnapshots.js writeHabitSnapshots() iterates dateRange(habit.createdAt, todayYMD) where todayYMD = todayLocal() at the time of write; writes one snapshot row per date up to that day"
    - "If the last log write was on day D, the store has rows through D but no rows for D+1 through today — so querying [habitId, today] returns undefined when today > D"
  falsification_test: "If a log was written for habit h today (date = todayLocal()), then getSnapshot(h, today) would return a row and columns would be populated — the bug only appears on days when no log was written"
  fix_rationale: "Add getLatestSnapshot(habitId) to repo.js that queries score_snapshots by IDBKeyRange.bound([habitId, '0000-01-01'], [habitId, '9999-12-31']) on the primary compound keypath and returns the last result (latest date row) — mirrors getHabitVersionAtDate() pattern exactly; analytics.js calls getLatestSnapshot instead of getSnapshot(today)"
  blind_spots: "Habits that have never had any log written will still have no snapshot — this is correct (they show —)"

next_action: Apply fix — add getLatestSnapshot to repo.js, fake-idb.js, contract test EXPECTED list, update analytics.js

## Symptoms

expected: Analytics columns (Rolling %, Mastery, S2 score) show computed values per habit
actual: Columns are empty — all habits show blank/zero in those columns
errors: No JS errors reported; data simply missing
reproduction: Open desktop.html Analytics tab on a day when no log was written
started: Still failing after commit 9fd5266 which fixed a raw IDBRequest promisification issue

## Eliminated

## Evidence

- timestamp: 2026-07-04T00:00:00Z
  checked: analytics.js refresh() function, lines 446-455
  found: uses const today = todayLocal(); snap = await repo.getSnapshot(habit.id, today) — exact compound key lookup
  implication: any day where no log was written returns undefined for every habit

- timestamp: 2026-07-04T00:00:00Z
  checked: repo.js getSnapshot(); idb.js get()
  found: get(db, 'score_snapshots', [habitId, date]) — primary key exact match only, no range fallback
  implication: only finds a row if a snapshot was written for that specific date

- timestamp: 2026-07-04T00:00:00Z
  checked: scoreSnapshots.js writeHabitSnapshots()
  found: iterates dateRange(habit.createdAt, todayYMD) where todayYMD = todayLocal() at write time; writes one row per date
  implication: rows exist through the write day; no rows for subsequent days until next log write

- timestamp: 2026-07-04T00:00:00Z
  checked: schema.js
  found: score_snapshots has both 'date' and 'habitId' indexes; primary keypath is [habitId, date]
  implication: IDBKeyRange.bound([habitId, min], [habitId, max]) on primary keypath is sufficient to get all snapshots for a habit

## Resolution

root_cause: analytics.js queried score_snapshots by [habitId, today] (exact match), but writeHabitSnapshots only writes rows through todayLocal() at log-write time; on any day after the last log write, no [habitId, today] row exists so all score columns show '—'
fix: added repo.getLatestSnapshot(habitId) using IDBKeyRange.bound on compound primary keypath to return the most recent snapshot row; analytics.js now calls getLatestSnapshot instead of getSnapshot(today); A7 contract maintained in fake-idb.js and contract test
verification: contract test + analytics builders + scoreSnapshots tests: 33/33 pass; commit 2d38c94
files_changed:
  - js/db/repo.js
  - js/views/desktop/analytics.js
  - tests/helpers/fake-idb.js
  - tests/integration/contract.fake-vs-real.test.js
