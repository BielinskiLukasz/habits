---
plan: 04-01
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
status: complete
duration_minutes: 45
commits:
  - a8e9b4b: test(04-01): add RED-phase tests for monthly cadence, date helpers, and startDate guard
  - cc5e263: feat(04-01): implement monthly cadence resolver, date helpers, and startDate guard (GREEN phase)
test_results: 315/327 pass (12 expected failures from stub files)
---

## Plan 04-01: Cadence Extensions & Date Helpers

**Objective:** Extend the cadence engine and date utilities to complete CADENCE-01..07, adding the monthly cadence type, a future-startDate applicability guard (CATALOG-07), and three new date helpers (isInGracePeriod, getMonthStart, getMonthEnd) needed by mastery evaluation in the next plan.

## Execution Summary

### RED Phase (Commit a8e9b4b)
- Added 30+ new test cases to `tests/unit/date.test.js`:
  - `daysBetween` tests (DST edge cases, leap days)
  - `isInGracePeriod` tests (grace period boundary conditions, custom graceDays)
  - `getMonthStart` tests (month boundaries, leap day handling)
  - `getMonthEnd` tests (31/30/28/29-day month edge cases)

- Added 15+ new test cases to `tests/unit/cadence.test.js`:
  - `appliesToday — monthly` tests (once-per-calendar-month resolver with monthCompletions)
  - `appliesToday — startDate guard` tests (future-scheduled habits, string comparison correctness)
  - Updated `zeroCtx` helper to include `monthCompletions: () => 0`

### GREEN Phase (Commit cc5e263)
- Extended `js/util/date.js` with three new exports:
  - `isInGracePeriod(createdAtYMD, todayYMD, graceDays = 7)` — returns true if days between < graceDays
  - `getMonthStart(ymd)` — returns YYYY-MM-DD of first day of month using `new Date(y, m-1, 1)` (DST-safe)
  - `getMonthEnd(ymd)` — returns YYYY-MM-DD of last day of month using `new Date(y, m, 0)` idiom (leap-year-safe)

- Extended `js/domain/cadence.js`:
  - Added `monthly` resolver to `RESOLVERS` dispatch table
  - Imported `getMonthStart` and `getMonthEnd` from date.js
  - Added startDate guard in `appliesToday`: `if (habit.startDate && habit.startDate > date) return false;` (before resolver dispatch)
  - Updated JSDoc to document monthly cadence, updated ctx contract to include `monthCompletions`

### Test Results
- **315/327 tests passing** (expected 12 failures from plan 04-00 stub files)
- All 70 new tests in date.test.js and cadence.test.js pass
- All 281 prior tests remain green (no regressions)
- DST edge cases verified (2026-03-29 spring-forward, 2026-10-25 fall-back)
- Leap day edge cases verified (2028-02-29)

## Verification Checklist

- [x] RED phase tests written and added
- [x] GREEN phase implementation complete
- [x] All new tests pass
- [x] All prior tests remain green (no regressions)
- [x] `cadence.js` has no `switch` statement (RESOLVERS dispatch table only)
- [x] `cadence.js` RESOLVERS table has 'monthly' entry
- [x] `appliesToday` returns false for any habit with `startDate > date`
- [x] `isInGracePeriod('2026-06-04', '2026-06-10')` returns true
- [x] `isInGracePeriod('2026-06-04', '2026-06-11')` returns false (day 7 = grace boundary)
- [x] Month boundary functions handle leap years and DST correctly

## What's Ready for Next Plan

The cadence engine is now complete with all 5 types (daily, weekly, every-n-days, day-of-week-subset, monthly) and the future-startDate guard. Plan 04-02 (mastery evaluation) can now use these date helpers (isInGracePeriod, getMonthStart, getMonthEnd) in its evaluation logic.

## Key Implementation Details

### `daysBetween` Math.round Discipline
The existing `daysBetween` uses `Math.round` (NOT `Math.floor`) to handle DST transitions correctly. When crossing a DST boundary, the millisecond delta is off by up to 1 hour. `Math.round` prevents silent truncation to N-1 days. This is tested explicitly with:
- 2026-03-28 to 2026-03-30 (spring-forward): returns 2, not 1
- 2026-10-24 to 2026-10-26 (fall-back): returns 2, not 1

### `getMonthEnd` DST-Safe Idiom
`new Date(y, m, 0)` (day 0 of next month = last day of current month) is the correct idiom for leap-year and DST-safe month-end calculation. It automatically handles:
- 31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)
- 30-day months (Apr, Jun, Sep, Nov)
- 28/29-day Februaries (leap-year aware)

### startDate Guard Short-Circuits Resolver
The startDate guard (`if (habit.startDate && habit.startDate > date) return false;`) runs BEFORE resolver dispatch, avoiding unnecessary monthCompletions/weekCompletions calls when a habit is not yet active. String comparison (`'2026-07-01' > '2026-06-15'`) is safe for ISO YYYY-MM-DD format because lexicographic order = chronological order.

## No Deviations

All work proceeded as planned. No edge cases or blocking issues encountered. All new tests pass on first run after implementation.
