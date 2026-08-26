---
slug: phase-06-uat-11-history-names
status: resolved
trigger: manual
goal: find_and_fix
created: 2026-07-03
updated: 2026-08-27
---

# Debug Session: phase-06-uat-11-history-names

## Current Focus

hypothesis: seed.js does not write habit_versions rows during seeding; when a seeded habit is edited, the only habit_versions row has effectiveFrom=today; getHabitVersionAtDate returns undefined for any past date; history.js falls back to the current habit object (new name) instead of the original name

test: confirmed by code reading — seed.js runTx stores list is ['habits', 'events', 'meta', 'settings'], missing 'habit_versions'; createHabit.js correctly writes both habits and habit_versions rows; editHabit.js writes habit_versions with effectiveFrom=today containing the NEW name

expecting: fix seed.js to write initial habit_versions rows, plus a one-time backfill migration for existing seeded databases

next_action: apply fix to seed.js — add habit_versions to runTx stores list, write version row per toInsert habit, add one-time migration for existing databases

reasoning_checkpoint:
  hypothesis: "seed.js never writes habit_versions rows, so getHabitVersionAtDate returns undefined for seeded habits on any date before their first edit, causing history.js to fall back to the current (post-edit) habit name"
  confirming_evidence:
    - "seed.js runTx stores=['habits', 'events', 'meta', 'settings'] — habit_versions absent (line 159)"
    - "createHabit.js writes storeNames=['habits', 'habit_versions'] with effectiveFrom=startDate — original name captured"
    - "editHabit.js writes ONE new habit_versions row with effectiveFrom=today, name=NEW name"
    - "repo.getHabitVersionAtDate uses IDBKeyRange.bound([habitId,'0000-01-01'],[habitId,date]) — returns undefined when no row exists"
    - "history.js line 107: effectiveVersion = version ?? { ...habit } — fallback uses current habit (new name)"
    - "seed habits have startDate:null — no existing version anchoring date"
  falsification_test: "If habit_versions rows existed for seeded habits at their original effectiveFrom date, getHabitVersionAtDate would return the original-name version for dates before the edit, and history would show the correct name"
  fix_rationale: "Writing initial habit_versions rows in seed.js gives getHabitVersionAtDate a row to find for pre-edit dates; the fallback in history.js would only trigger for genuinely unversioned habits (impossible after fix)"
  blind_spots: "Same-day create-and-edit overwrites initial version (same compound key); not the UAT failure but a secondary edge case"

## Symptoms

**UAT Test 11 FAILED — CRITICAL: Historical habit names were changed (should be immutable)**

When a user edits an existing habit's name or definition in the Catalog view and saves, the historical log entries for that habit reflect the NEW name/values instead of the original values at the time of logging.

This violates the hard project constraint: "History integrity: Habit-definition edits never rewrite historical logs; the habit identity is preserved across edits."

**Expected behavior:** Old logs show the original habit name/state at the time of logging. Edits create new version entries. The habit identity (ID) is preserved, but historical display uses the version that was active at the time each log was recorded.

**Actual behavior:** After editing a habit name, all historical displays (history view) show the new name instead of the name that was active when the log was recorded.

## Evidence

- timestamp: 2026-07-03
  checked: js/io/seed.js runTx stores parameter
  found: ['habits', 'events', 'meta', 'settings'] — 'habit_versions' is absent
  implication: seeded habits never get an initial habit_versions row

- timestamp: 2026-07-03
  checked: js/state/apply/createHabit.js
  found: writes storeNames=['habits', 'habit_versions'], versionRow with effectiveFrom=startDate (original name)
  implication: user-created habits work correctly; seeded habits are the gap

- timestamp: 2026-07-03
  checked: js/state/apply/editHabit.js
  found: writes ONE new habit_versions row with effectiveFrom=today and name=NEW (post-edit) name
  implication: for seeded habits, the only version row ever written is the edit version (new name)

- timestamp: 2026-07-03
  checked: js/db/repo.js getHabitVersionAtDate
  found: IDBKeyRange.bound([habitId,'0000-01-01'],[habitId,date]) — returns last row whose effectiveFrom <= date, undefined if none
  implication: for seeded habits before first edit, no row matches any past date; returns undefined

- timestamp: 2026-07-03
  checked: js/views/history.js line 107
  found: effectiveVersion = version ?? { ...habit, cadence: habit.cadence }
  implication: undefined version falls back to current habit object; after edit this has the new name

- timestamp: 2026-07-03
  checked: seed/habits.json sample habits
  found: startDate: null for all checked habits; no createdAt field
  implication: effectiveFrom for initial version rows must use install date (todayLocal() at seed time)

## Eliminated

- hypothesis: history.js builders use habit.name instead of version.name
  evidence: builders.js line 111 uses displayName = version.name ?? habit.name; version is passed correctly; the issue is version being undefined, not wrong field access
  timestamp: 2026-07-03

- hypothesis: editHabit.js rewrites logs directly
  evidence: editHabit.js storeNames=['habits', 'habit_versions'] — 'logs' is intentionally absent; confirmed by NFR-10 comment
  timestamp: 2026-07-03

- hypothesis: getHabitVersionAtDate is implemented incorrectly
  evidence: implementation correctly uses IDBKeyRange.bound with compound key; logic is sound; the issue is no rows to find
  timestamp: 2026-07-03

## Resolution

root_cause: seed.js wrote seeded habits to 'habits' store only, never to 'habit_versions'. The runTx included stores ['habits', 'events', 'meta', 'settings'] — 'habit_versions' was missing. When a seeded habit was edited, editHabit.js wrote one habit_versions row (effectiveFrom=today, new name). getHabitVersionAtDate returned undefined for any date before the edit. history.js fell back to the current habit object (new name). Result: historical logs displayed the post-edit name.

fix: Two changes in js/io/seed.js:
  1. FRESH INSTALL PATH: Added 'habit_versions' to the seed runTx stores list. For each newly seeded habit, writes an initial habit_versions row with effectiveFrom = h.startDate ?? '0000-01-01'. The '0000-01-01' sentinel ensures the key is always different from any future edit row (effectiveFrom=editDate), preventing same-day overwrites.
  2. EXISTING DATABASE MIGRATION: Added a one-time backfill that runs when meta.habitVersionsSeeded is not set. Checks each seeded habit for existing version rows; backfills missing ones with effectiveFrom = startDate ?? createdAt ?? '0000-01-01'. Sets meta.habitVersionsSeeded = true to prevent re-runs. The fast-path early-return now requires all three flags (seededIds, persistResult, habitVersionsSeeded) so existing databases aren't skipped.
  3. Added 2 new regression tests in tests/integration/seed.idempotent.test.js covering NFR-10 invariant.

verification: All 7 seed.idempotent tests pass (5 pre-existing + 2 new NFR-10 tests). Full suite: 870 tests, 870 pass, 0 fail. oracle_type: specified (contract: getHabitVersionAtDate must return original name for dates before edit). Boundary neighbors tested: effectiveFrom='0000-01-01' sentinel, far-future date '9999-12-31', existing-DB migration path.
files_changed: [js/io/seed.js, tests/integration/seed.idempotent.test.js]
