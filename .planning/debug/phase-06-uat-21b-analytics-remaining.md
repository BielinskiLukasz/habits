---
slug: phase-06-uat-21b-analytics-remaining
status: resolved
trigger: manual
goal: find_and_fix
created: 2026-07-04
---

# Debug Session: Analytics Remaining Bugs (UAT-T21b)

## Current Focus

hypothesis: Three discrete bugs in the desktop Analytics view — Stage field mismatch, S3 formula double-normalization, and weekly cadence denominator inflation.
next_action: Apply fixes to analytics.js, scoring.js, and scoreSnapshots.js

## Evidence

- timestamp: 2026-07-04T00:00:00Z
  file: js/views/desktop/analytics.js
  line: 240
  observation: Stage cell reads `habit.stage` (undefined for all habits) — IDB schema uses `stages[]` + `currentStageIndex`, not a `stage` number field. Condition `undefined >= 1` is always false; cell always renders empty string.

- timestamp: 2026-07-04T00:00:01Z
  file: js/domain/scoring.js
  lines: 272-301
  observation: computeS3 computes `s3Score = Math.min(1, rawSum / applicableDays)` where rawSum is sum of `(completedContrib / loadCount)` over applicable days. With ~60 habits, loadCount ≈ 60, so rawSum ≤ applicableDays/60. Dividing by applicableDays gives max s3Score = 1/60 ≈ 0.017. All habits cluster in 0.00–0.02 range and display identically with `toFixed(2)`. Root cause: double-normalization — dividing by loadCount per day then again by applicableDays.

- timestamp: 2026-07-04T00:00:02Z
  file: js/io/scoreSnapshots.js
  lines: 131-133
  observation: `ctx.weekCompletions = () => 0` and `ctx.monthCompletions = () => 0` are hardcoded. The weekly cadence resolver in cadence.js returns `true` (applicable) when `weekCompletions === 0`. With the override always returning 0, weekly habits appear applicable every day in the 70-day window, making `applicableDayCount = 70` instead of ~10. A habit completed once per week shows Rolling% = 10/70 = 14% instead of 100%.

## Root Cause Summary

### Bug 1 — Stage Column Blank
- Location: `js/views/desktop/analytics.js` line 240
- Cause: `habit.stage >= 1` reads a non-existent field. Habit IDB rows use `stages: [{label, target, ...}]` and `currentStageIndex: number`. No `stage` number field exists.
- Fix: derive stage number from `currentStageIndex + 1` when `stages.length > 0`

### Bug 2 — S3 Identical for Every Habit
- Location: `js/domain/scoring.js` lines 297-302 (computeS3)
- Cause: formula divides `completedContrib` by `loadCount` per day (compressing values to 1/N scale) then divides the sum by `applicableDays` (further compressing). Max achievable S3 = 1/N ≈ 0.017 for 60 habits; all values show as 0.00–0.02 with `toFixed(2)`.
- Fix: normalize by `expectedSum = sum(1/loadCount over applicable days)` instead of `applicableDays`. This gives `s3Score = rawSum/expectedSum` which is 1.0 for perfect completion and 0.0 for no completion, properly [0,1].

### Bug 3 — Rolling % Wrong for Weekly Habits
- Location: `js/io/scoreSnapshots.js` + `js/domain/scoring.js` (computeS1)
- Cause A: `weekCompletions: () => 0` → `appliesToday` returns true every day for weekly habits → denominator is 70 instead of ~10
- Fix A: Provide real weekCompletions from `logsForHabit`, capped at evaluation day minus 1 (to avoid counting the current day's own completion as "already done")
- Cause B: Even with the weekCompletions fix, the applicable-days count for weekly habits that are completed mid-week (e.g. Thursday) would be 4× too large (Mon–Thu × 10 weeks = 40 vs correct 10). The S1 formula counts applicable DAYS, not expected PERIODS.
- Fix B: Add period-based counting in `computeS1` for weekly/monthly cadences — count ISO weeks (months) in the window as denominator, completed weeks (months) as numerator.

## Resolution

root_cause: See Root Cause Summary above (three independent bugs)
fix: Applied in analytics.js (stage field), scoring.js (S3 denominator + S1 period-based weekly), scoreSnapshots.js (weekCompletions from logs)
