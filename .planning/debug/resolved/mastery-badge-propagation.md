---
slug: mastery-badge-propagation
status: resolved
trigger: manual
created: 2026-07-05
updated: 2026-07-05
resolved: 2026-07-05
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED — three gaps in mastery badge propagation identified and two fixed.
next_action: Human verification — test that catalog mastery badge appears after logging enough completions.

## Symptoms

expected: Mastery badge renders in Catalog when a habit's rolling-window completion rate crosses the mastery threshold (default 90% in 70-day window). Today view should also render a mastery badge per the CLAUDE.md design spec.
actual: Catalog badge never shows for active habits (evaluateMastery always returned false due to empty logs). Today view has no mastery badge at all. score_snapshots rows had no isMastered field.
errors: No runtime errors — the mastery badge was silently absent.
reproduction: Add enough completion logs for a habit to cross the mastery threshold (default 90% in 70-day window). Open Catalog. No "Mastered" badge appeared.
started: Since initial implementation (mastery badge in catalog was never wired to actual log data; write path never included isMastered).

## Eliminated

- hypothesis: Field name mismatch between score_snapshots write and read
  evidence: The field simply wasn't written at all — not a naming issue
  timestamp: 2026-07-05

- hypothesis: catalog.js reads score_snapshots but maps the field incorrectly
  evidence: catalog.js never read score_snapshots — it called evaluateMastery with empty logs
  timestamp: 2026-07-05

## Evidence

- timestamp: 2026-07-05
  checked: scoreSnapshots.js — snapshotRows.push() at lines 198-207
  found: Row only contained {habitId, date, s1Score, s1Status, s2Score, s3Score, scoreVersion}; evaluateMastery never imported or called
  implication: isMastered was never persisted to score_snapshots — the root write-path gap

- timestamp: 2026-07-05
  checked: catalog.js::evaluateMasteryForCatalog (lines 108-126)
  found: Called evaluateMastery(habit, [], today, ctx) with EMPTY logs array — completedCount=0 always → isMastered=false for all active habits
  implication: Catalog mastery badge could never show for active habits regardless of completion history

- timestamp: 2026-07-05
  checked: today/builders.js — buildTodayRow, buildNumericRow, buildSlotRow
  found: Zero mastery-related rendering in any builder; no isMastered parameter accepted
  implication: Today view mastery badge is entirely unimplemented (missing feature)

- timestamp: 2026-07-05
  checked: scoreSnapshots.js ctx field naming vs evaluateMastery ctx
  found: scoreSnapshots ctx uses 'windowDays' but evaluateMastery expects 'globalWindow'
  implication: Must construct a separate masteryCtx when calling evaluateMastery — done in fix

- timestamp: 2026-07-05
  checked: Smoke test — writeHabitSnapshots with 68/70 days completed
  found: todayRow.isMastered === true (97% > 90% threshold)
  implication: Write path fix confirmed correct

- timestamp: 2026-07-05
  checked: Full test suite after fixes
  found: 823 pass, 6 fail (all 6 are pre-existing stubs/import-broadcast failures unrelated to mastery)
  implication: Fixes introduced no regressions

## Resolution

root_cause: Three gaps in the mastery badge propagation chain:
  1. (FIXED) scoreSnapshots.js never called evaluateMastery() → isMastered never written to score_snapshots rows
  2. (FIXED) catalog.js::evaluateMasteryForCatalog evaluated mastery with empty logs [] → always returned isMastered:false for active habits
  3. (DOCUMENTED, NOT FIXED) Today view has no mastery badge rendering — buildTodayRow/buildNumericRow/buildSlotRow accept no isMastered param and today.js doesn't read score_snapshots. This is a missing feature requiring builder + view + (optionally) store cache changes.

fix: |
  scoreSnapshots.js:
    - Import evaluateMastery from mastery.js
    - Add _evaluateMastery DI seam to configure() (optional in injected object — tests that don't supply it keep the real function)
    - Build masteryCtx once before the date loop: {globalThreshold, globalWindow: windowDays, appliesToday, weekStart, weekCompletions, monthCompletions}
    - Call _evaluateMastery(habitForScoring, logsForHabit, dateYMD, masteryCtx) per date
    - Include isMastered in snapshotRows.push()

  catalog.js:
    - Remove evaluateMastery, appliesToday, getCachedSettings, getCachedWeekStart, getCachedWeekCompletions imports (now unused)
    - Remove buildMasteryCtx() helper (dead code)
    - Change evaluateMasteryForCatalog to async; accept (habits, deps) instead of (habits, today)
    - Read repo.getLatestSnapshot(habit.id) per habit; use snap?.isMastered === true
    - Keep habit.status === 'mastered' shortcut for permanently-promoted habits
    - Remove unused today variable from renderCatalogInto

verification: All scoreSnapshots tests pass (13/13). All catalog tests pass (3/3). Catalog builders tests pass (27/27). Full suite: 823/829 pass (6 pre-existing failures unchanged).
files_changed: [js/io/scoreSnapshots.js, js/views/catalog.js]
