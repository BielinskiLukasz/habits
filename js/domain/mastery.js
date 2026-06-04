/**
 * @file Pure mastery threshold evaluator (MASTERY-01..07, D-85..D-87).
 *
 * Exports a single pure function `evaluateMastery` that decides whether a
 * habit has crossed its rolling-window completion threshold. No IDB reads
 * occur inside this module — all facts are passed in by the caller.
 *
 * Design decisions:
 *   - Grace period (MASTERY-06): new habits skip mastery for their first 7
 *     days (configurable via caller, but the plan locks 7-day default).
 *     Implemented via `isInGracePeriod` from date.js so the date arithmetic
 *     is DST-safe and tested alongside other date helpers.
 *   - Cadence-aware denominator (MASTERY-05, Pitfall 1): applicable days are
 *     counted by calling `ctx.appliesToday(habit, dayYMD, ctx)` for each
 *     day in the rolling window, NOT by using windowDays as the raw
 *     denominator. A Mon-Fri habit over 70 days yields ~50 applicable days.
 *   - LOG_COMPLETED dispatch table (Pitfall 5, T-04-02): no if-else chain on
 *     targetType. Unknown types fall back to `?.(log, habit) ?? false` — they
 *     do not count as completed and do not throw.
 *   - Per-habit override (MASTERY-02): `masteryThresholdOverride` and
 *     `masteryWindowOverride` take precedence over global ctx values when
 *     non-null and non-undefined (using `??` nullish coalescing).
 *   - Window iteration uses `daysFrom` and setDate-based local-calendar steps
 *     (Pitfall 4 / date.js pattern) — no raw millisecond arithmetic.
 *
 * ctx.appliesToday is injected by the caller (not imported directly from
 * cadence.js) to keep mastery.js free of the ctx-wiring logic and fully
 * unit-testable with any cadence mock.
 */

import {
  isInGracePeriod,
  daysFrom,
} from '../util/date.js';

/**
 * Dispatch table for log completion detection.
 * Each entry is `(log, habit) => boolean`.
 * Unknown targetType → `undefined` → `?? false` fallback (T-04-02 mitigation).
 *
 * @type {Record<string, (log: object, habit: object) => boolean>}
 */
const LOG_COMPLETED = {
  binary: (log, _habit) => log.completed === true,

  numeric: (log, habit) => (log.count ?? 0) >= (habit.target ?? 1),

  'slot-checklist': (log, _habit) =>
    Array.isArray(log.slots) &&
    log.slots.length > 0 &&
    log.slots.every(s => s.checked),
};

/**
 * Evaluate mastery status for a habit on a given date.
 *
 * Mastery = `completedCount / applicableDayCount >= threshold / 100`, where
 * applicable days are those within the rolling window where the habit's
 * cadence says it applies (non-applicable days, e.g. weekends for a Mon-Fri
 * habit, are excluded from both the numerator and denominator).
 *
 * @param {{
 *   id: string,
 *   cadence: { type: string, n?: number, days?: string[] },
 *   createdAt: string,
 *   targetType?: 'binary' | 'numeric' | 'slot-checklist',
 *   target?: number,
 *   masteryThresholdOverride?: number | null,
 *   masteryWindowOverride?: number | null
 * }} habit — IDB habit row
 * @param {Array<{
 *   habitId: string,
 *   date: string,
 *   completed?: boolean,
 *   count?: number,
 *   slots?: Array<{ checked: boolean }>
 * }>} logsForHabit — all log rows for this habit (may span any date range)
 * @param {string} evaluationDate — YYYY-MM-DD (usually "today")
 * @param {{
 *   globalThreshold: number,
 *   globalWindow: number,
 *   appliesToday: (habit: object, date: string, ctx: object) => boolean,
 *   weekStart: 'mon' | 'sun',
 *   weekCompletions: (habitId: string, startYMD: string, endYMD: string) => number,
 *   monthCompletions: (habitId: string, startYMD: string, endYMD: string) => number
 * }} ctx — caller-supplied context (pure; no IDB inside)
 * @returns {{
 *   isMastered: boolean,
 *   isInGracePeriod: boolean,
 *   completedCount: number,
 *   applicableDayCount: number,
 *   percentage: number,
 *   threshold: number,
 *   windowDays: number
 * }}
 */
export function evaluateMastery(habit, logsForHabit, evaluationDate, ctx) {
  // Step 1 — Resolve per-habit overrides, falling back to global defaults.
  const threshold = habit.masteryThresholdOverride ?? ctx.globalThreshold;
  const windowDays = habit.masteryWindowOverride ?? ctx.globalWindow;

  // Step 2 — Grace period check (MASTERY-06). New habits skip mastery for
  // the first `graceDays` calendar days after creation. isInGracePeriod uses
  // daysBetween (Math.round, DST-safe) from date.js.
  if (isInGracePeriod(habit.createdAt, evaluationDate)) {
    return {
      isMastered: false,
      isInGracePeriod: true,
      completedCount: 0,
      applicableDayCount: 0,
      percentage: 0,
      threshold,
      windowDays,
    };
  }

  // Step 3 — Compute rolling window: [windowStart, evaluationDate] inclusive.
  // daysFrom(evaluationDate, -(windowDays - 1)) gives windowStart so that the
  // window spans exactly windowDays calendar days ending at evaluationDate.
  const windowStart = daysFrom(evaluationDate, -(windowDays - 1));

  // Step 4 — Count applicable days using cadence-aware denominator.
  // Iterate from windowStart forward windowDays steps, calling ctx.appliesToday
  // for each day. DST-safe: each day is computed via daysFrom (setDate-based).
  let applicableDayCount = 0;
  for (let i = 0; i < windowDays; i++) {
    const dayYMD = daysFrom(windowStart, i);
    if (ctx.appliesToday(habit, dayYMD, ctx)) {
      applicableDayCount++;
    }
  }

  // Step 5 — Zero applicable days: return zeroed non-grace result.
  if (applicableDayCount === 0) {
    return {
      isMastered: false,
      isInGracePeriod: false,
      completedCount: 0,
      applicableDayCount: 0,
      percentage: 0,
      threshold,
      windowDays,
    };
  }

  // Step 6 — Count completed days within the window.
  // Only logs in [windowStart, evaluationDate] are considered; future logs
  // and logs before the window are excluded by string comparison (ISO YYYY-MM-DD
  // lexicographic order = chronological order — safe without Date parsing).
  const targetType = habit.targetType ?? 'binary';
  const logCompleted = LOG_COMPLETED[targetType];

  let completedCount = 0;
  for (const log of logsForHabit) {
    if (log.date < windowStart) continue;    // Before window.
    if (log.date > evaluationDate) continue; // After evaluation date.
    // Dispatch to LOG_COMPLETED[targetType]; unknown types fall back to false.
    const counts = logCompleted?.(log, habit) ?? false;
    if (counts) completedCount++;
  }

  // Step 7 — Compute percentage and mastery verdict.
  const percentage = Math.round((completedCount / applicableDayCount) * 100);
  const isMastered = percentage >= threshold;

  return {
    isMastered,
    isInGracePeriod: false,
    completedCount,
    applicableDayCount,
    percentage,
    threshold,
    windowDays,
  };
}
