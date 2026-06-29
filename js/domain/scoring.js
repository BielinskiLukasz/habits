/**
 * @file Pure scoring model functions S1/S2/S3 (SCORING-01..07, D-110..D-112, D-114).
 *
 * Called only by js/io/scoreSnapshots.js — never by views. No IDB calls.
 *
 * Three exported pure functions compute per-habit scores for a given
 * evaluation date. All inputs are injected by the caller; this module has
 * no side effects and no imports beyond js/util/date.js.
 *
 * Shared constraints (D-114, SCORING-07):
 *   - cadence-aware denominator: only applicable days (per ctx.appliesToday)
 *     are counted, matching mastery.js's denominator logic.
 *   - 7-day grace period: habits < 7 days old return null scores.
 *   - Mastered habits (habit.isMastered === true) apply 0.3× weighting.
 *   - ctx.evaluationDate: YYYY-MM-DD; passed by the snapshot writer.
 *
 * LOG_COMPLETED dispatch table is self-contained (NOT imported from mastery.js)
 * to keep scoring.js independently testable and free of mastery-specific
 * threshold logic (T-04-02 pattern, D-124 self-contained design).
 */

import {
  isInGracePeriod,
  daysFrom,
} from '../util/date.js';

// ---------------------------------------------------------------------------
// Internal: LOG_COMPLETED dispatch table
// (same shape as mastery.js — duplicated intentionally for self-containment)
// ---------------------------------------------------------------------------

/**
 * Dispatch table for log completion detection.
 * Each entry: `(log, habit) => boolean`.
 * Unknown targetType → `undefined` → `?? false` fallback (T-04-02 pattern).
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

// ---------------------------------------------------------------------------
// Internal: isLogCompleted helper
// ---------------------------------------------------------------------------

/**
 * Return true if a log row counts as completed for a given habit.
 *
 * @param {object|undefined} log — log row (may be undefined if no log for that day)
 * @param {object} habit — IDB habit row
 * @returns {boolean}
 */
function isLogCompleted(log, habit) {
  if (!log) return false;
  const targetType = habit.targetType ?? 'binary';
  const fn = LOG_COMPLETED[targetType];
  return fn?.(log, habit) ?? false;
}

// ---------------------------------------------------------------------------
// computeS1 — Rolling Threshold Health (D-110)
// ---------------------------------------------------------------------------

/**
 * Compute S1 (Rolling Threshold Health) for a habit on ctx.evaluationDate.
 *
 * S1 score = completedCount / applicableDayCount * 100 over the rolling window.
 * S1 status buckets (D-110):
 *   Healthy  — score >= globalThreshold (default 90%)
 *   Watch    — 70 <= score < globalThreshold
 *   At-risk  — 50 <= score < 70
 *   Failing  — score < 50
 *
 * @param {{
 *   id: string,
 *   cadence: object,
 *   createdAt: string,
 *   targetType?: string,
 *   target?: number,
 *   isMastered?: boolean
 * }} habit — IDB habit row
 * @param {Array<{ habitId: string, date: string, completed?: boolean, count?: number, slots?: Array<{checked:boolean}> }>} logsForHabit
 * @param {{
 *   evaluationDate: string,
 *   windowDays: number,
 *   globalThreshold: number,
 *   appliesToday: (habit: object, date: string, ctx: object) => boolean
 * }} ctx
 * @returns {{ s1Score: number|null, s1Status: string|null }}
 */
export function computeS1(habit, logsForHabit, ctx) {
  // Grace period: exclude habit for its first 7 days.
  if (isInGracePeriod(habit.createdAt, ctx.evaluationDate)) {
    return { s1Score: null, s1Status: null };
  }

  // Mastered shortcut: always Healthy at 100 (0.3× weighting → always over threshold).
  if (habit.isMastered === true) {
    return { s1Score: 100, s1Status: 'Healthy' };
  }

  // Rolling window: [windowStart, evaluationDate] inclusive.
  // daysFrom(evaluationDate, -(windowDays-1)) gives a span of exactly windowDays.
  const windowStart = daysFrom(ctx.evaluationDate, -(ctx.windowDays - 1));

  // Count applicable days (cadence-aware denominator).
  let applicableDayCount = 0;
  for (let i = 0; i < ctx.windowDays; i++) {
    const dayYMD = daysFrom(windowStart, i);
    if (ctx.appliesToday(habit, dayYMD, ctx)) {
      applicableDayCount++;
    }
  }

  // Zero applicable days: score 0, status Failing (habit never applies in window).
  if (applicableDayCount === 0) {
    return { s1Score: 0, s1Status: 'Failing' };
  }

  // Count completed days within the window.
  // Only logs within [windowStart, evaluationDate] are considered; ISO YYYY-MM-DD
  // string comparison is safe for lexicographic (= chronological) ordering.
  let completedCount = 0;
  for (const log of logsForHabit) {
    if (log.date < windowStart) continue;
    if (log.date > ctx.evaluationDate) continue;
    if (isLogCompleted(log, habit)) completedCount++;
  }

  const s1Score = Math.round((completedCount / applicableDayCount) * 100);

  // Determine S1 status bucket (D-110).
  let s1Status;
  if (s1Score >= ctx.globalThreshold) {
    s1Status = 'Healthy';
  } else if (s1Score >= 70) {
    s1Status = 'Watch';
  } else if (s1Score >= 50) {
    s1Status = 'At-risk';
  } else {
    s1Status = 'Failing';
  }

  return { s1Score, s1Status };
}

// ---------------------------------------------------------------------------
// computeS2 — Day-Weighted Wave Score (D-111)
// ---------------------------------------------------------------------------

/**
 * Compute S2 (Day-Weighted Wave Score) for a habit on ctx.evaluationDate.
 *
 * Exponential weighting with 21-day half-life: weight(d) = 2^(-d/21)
 * where d = days ago (0 = today).
 * Stage multiplier applied to numerator only: etap1=1.0, etap2=1.25, etap3=1.5.
 * Mastered habits: both numerator and denominator weights multiplied by 0.3.
 *
 * @param {{
 *   id: string,
 *   cadence: object,
 *   createdAt: string,
 *   targetType?: string,
 *   target?: number,
 *   stage?: number,
 *   isMastered?: boolean
 * }} habit
 * @param {Array<{ habitId: string, date: string, completed?: boolean, count?: number, slots?: Array<{checked:boolean}> }>} logsForHabit
 * @param {{
 *   evaluationDate: string,
 *   windowDays: number,
 *   appliesToday: (habit: object, date: string, ctx: object) => boolean
 * }} ctx
 * @returns {{ s2Score: number|null }}
 */
export function computeS2(habit, logsForHabit, ctx) {
  // Grace period.
  if (isInGracePeriod(habit.createdAt, ctx.evaluationDate)) {
    return { s2Score: null };
  }

  // Stage difficulty multiplier (numerator only).
  const stageMultiplier = { 1: 1.0, 2: 1.25, 3: 1.5 }[habit.stage] ?? 1.0;

  // Mastered habits are weighted at 0.3× (both numerator and denominator).
  const baseWeightMultiplier = habit.isMastered === true ? 0.3 : 1.0;

  let numerator = 0;
  let denominator = 0;

  // Iterate from today (i=0) back through the rolling window (i=windowDays-1).
  // Build a lookup map for fast log access.
  const logByDate = new Map();
  for (const log of logsForHabit) {
    logByDate.set(log.date, log);
  }

  for (let i = 0; i < ctx.windowDays; i++) {
    const dayYMD = daysFrom(ctx.evaluationDate, -i);
    if (!ctx.appliesToday(habit, dayYMD, ctx)) continue;

    // Exponential weight decaying with 21-day half-life.
    const w = Math.pow(2, -i / 21) * baseWeightMultiplier;
    denominator += w;

    if (isLogCompleted(logByDate.get(dayYMD), habit)) {
      numerator += w * stageMultiplier;
    }
  }

  if (denominator === 0) {
    return { s2Score: 0 };
  }

  // Clamp to [0, 1] — stage multiplier can push ratio above 1 theoretically
  // only when stageMultiplier > 1 AND all days completed. Clamping is safe.
  const s2Score = Math.min(1, numerator / denominator);
  return { s2Score };
}

// ---------------------------------------------------------------------------
// computeS3 — Load-Adjusted Capacity Score (D-112)
// ---------------------------------------------------------------------------

/**
 * Compute S3 (Load-Adjusted Capacity Score) for a habit on ctx.evaluationDate.
 *
 * Per day: s3DayScore = completedContrib / applicableHabitsOnDay (the "load").
 * Mastered habits are treated as always-completed with 0.3 contribution.
 * Per-habit S3 = sum of daily contributions / applicableDays, clamped to [0,1].
 *
 * @param {{
 *   id: string,
 *   cadence: object,
 *   createdAt: string,
 *   targetType?: string,
 *   target?: number,
 *   isMastered?: boolean
 * }} habit
 * @param {Array<{ habitId: string, date: string, completed?: boolean, count?: number, slots?: Array<{checked:boolean}> }>} logsForHabit
 * @param {{
 *   evaluationDate: string,
 *   windowDays: number,
 *   appliesToday: (habit: object, date: string, ctx: object) => boolean
 * }} ctx
 * @param {Array<object>} allHabits — full habit array (needed to compute per-day load)
 * @returns {{ s3Score: number|null }}
 */
export function computeS3(habit, logsForHabit, ctx, allHabits) {
  // Grace period.
  if (isInGracePeriod(habit.createdAt, ctx.evaluationDate)) {
    return { s3Score: null };
  }

  // Build a lookup map for fast log access.
  const logByDate = new Map();
  for (const log of logsForHabit) {
    logByDate.set(log.date, log);
  }

  let rawSum = 0;
  let applicableDays = 0;

  for (let i = 0; i < ctx.windowDays; i++) {
    const dayYMD = daysFrom(ctx.evaluationDate, -i);

    // Skip if the target habit does not apply on this day.
    if (!ctx.appliesToday(habit, dayYMD, ctx)) continue;

    // Compute load: count of ALL habits applicable on this day.
    const loadCount = allHabits.filter(h => ctx.appliesToday(h, dayYMD, ctx)).length;

    // Skip days where no habits apply (division-by-zero guard).
    if (loadCount === 0) continue;

    // Determine this habit's completion contribution for the day.
    let completedContrib;
    if (habit.isMastered === true) {
      // Mastered habits always contribute 0.3 (SCORING-07).
      completedContrib = 0.3;
    } else {
      completedContrib = isLogCompleted(logByDate.get(dayYMD), habit) ? 1 : 0;
    }

    rawSum += completedContrib / loadCount;
    applicableDays++;
  }

  if (applicableDays === 0) {
    return { s3Score: 0 };
  }

  const s3Score = Math.min(1, rawSum / applicableDays);
  return { s3Score };
}
