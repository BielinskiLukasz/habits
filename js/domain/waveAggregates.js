/**
 * @file Wave-level aggregate metrics (WAVE-01..06, D-83 wave data structure).
 *
 * `computeWaveAggregates` is a pure function over habit definitions, log rows,
 * and a caller-supplied context (appliesToday, isMastered, thresholds). No IDB
 * reads happen inside this module — all data is passed in by the caller, keeping
 * this module easily unit-testable in Node without a fake IDB.
 *
 * Streak computation:
 *   A day is a "streak day" when `completedApplicable / totalApplicable >= streakThreshold/100`
 *   across all non-archived habits in the wave that apply on that day.
 *   Consecutive streak days (adjacent dates differ by 1 calendar day) form a streak.
 *   Streak scan is O(log-count) not O(calendar-days × habits). Acceptable for Phase 4;
 *   snapshot writes in Phase 6 will cache this result (T-04-04).
 *
 * isAtRisk:
 *   For each truly active (non-archived, non-mastered) habit, compute its own
 *   completion% from its logs. If that ratio is below ctx.globalThreshold,
 *   the habit is "slipping". When slipping count / activeCount >= atRiskSlipRatio,
 *   the wave is flagged at-risk.
 */

import { daysBetween } from '../util/date.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Given a set of logs for one habit (all with the same habitId), compute the
 * applicable-day count and completed-day count, respecting appliesToday.
 *
 * @param {object} habit
 * @param {object[]} habitLogs - Logs belonging to this habit only.
 * @param {object} ctx
 * @returns {{ applicable: number, completed: number }}
 */
function _countForHabit(habit, habitLogs, ctx) {
  let applicable = 0;
  let completed = 0;
  for (const log of habitLogs) {
    if (ctx.appliesToday(habit, log.date, ctx)) {
      applicable += 1;
      if (log.status === 'completed') {
        completed += 1;
      }
    }
  }
  return { applicable, completed };
}

/**
 * Format a Date object as YYYY-MM-DD using local calendar.
 * Inlined here so streak walk-back is self-contained (avoids circular imports).
 *
 * @param {Date} d
 * @returns {string}
 */
function _formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute wave-level aggregate metrics for a single wave.
 *
 * @param {number} waveNumber - Wave number (0..9, extensible).
 * @param {object[]} habits - All habit rows (filtered internally to the given wave).
 * @param {object[]} logs - All log rows relevant to this computation (no IDB inside).
 * @param {string} today - YYYY-MM-DD evaluation date.
 * @param {{
 *   appliesToday: (habit: object, date: string, ctx: object) => boolean,
 *   weekStart: 'mon'|'sun',
 *   weekCompletions: (habitId: string, start: string, end: string) => number,
 *   monthCompletions: (habitId: string, month: string) => number,
 *   globalThreshold: number,
 *   globalWindow: number,
 *   isMastered: (habit: object) => boolean,
 *   streakThreshold?: number,
 *   atRiskSlipRatio?: number,
 * }} ctx - Caller-supplied evaluation context.
 * @returns {{
 *   waveNumber: number,
 *   habitCount: number,
 *   statusCounts: { active: number, mastered: number, archived: number },
 *   completionPct: number,
 *   longestStreak: number,
 *   currentStreak: number,
 *   isAtRisk: boolean,
 * }}
 */
export function computeWaveAggregates(waveNumber, habits, logs, today, ctx) {
  const streakThreshold = ctx.streakThreshold ?? 80;
  const atRiskSlipRatio = ctx.atRiskSlipRatio ?? 0.5;

  // 1. Filter habits to this wave.
  const waveHabits = habits.filter((h) => h.wave === waveNumber);

  // Early-exit zero-value result when no habits belong to this wave.
  if (waveHabits.length === 0) {
    return {
      waveNumber,
      habitCount: 0,
      statusCounts: { active: 0, mastered: 0, archived: 0 },
      completionPct: 0,
      longestStreak: 0,
      currentStreak: 0,
      isAtRisk: false,
    };
  }

  // 2. Partition habits into archived / mastered / active buckets.
  //    archived: h.status === 'archived'  (isMastered is NOT queried for archived)
  //    mastered: non-archived AND ctx.isMastered(h) === true
  //    active:   non-archived AND not mastered
  const archivedHabits = [];
  const masteredHabits = [];
  const activeHabits = [];

  for (const h of waveHabits) {
    if (h.status === 'archived') {
      archivedHabits.push(h);
    } else if (ctx.isMastered(h)) {
      masteredHabits.push(h);
    } else {
      activeHabits.push(h);
    }
  }

  const statusCounts = {
    active: activeHabits.length,
    mastered: masteredHabits.length,
    archived: archivedHabits.length,
  };

  // 3. Build per-habit log index for efficient lookup.
  //    Key: habitId → array of log rows.
  /** @type {Map<string, object[]>} */
  const logsByHabit = new Map();
  for (const log of logs) {
    const arr = logsByHabit.get(log.habitId);
    if (arr) {
      arr.push(log);
    } else {
      logsByHabit.set(log.habitId, [log]);
    }
  }

  // 4. Completion % — scan all non-archived habit logs.
  //    Archived habits are fully excluded (neither numerator nor denominator).
  const includedHabits = [...activeHabits, ...masteredHabits];
  let totalApplicable = 0;
  let totalCompleted = 0;

  for (const h of includedHabits) {
    const habitLogs = logsByHabit.get(h.id) ?? [];
    const { applicable, completed } = _countForHabit(h, habitLogs, ctx);
    totalApplicable += applicable;
    totalCompleted += completed;
  }

  const completionPct = totalApplicable > 0
    ? Math.round((totalCompleted / totalApplicable) * 100)
    : 0;

  // 5. Streak computation.
  //    For each date present in ANY non-archived wave habit's logs, evaluate:
  //      completedApplicable / totalApplicable >= streakThreshold/100
  //    Build a sorted array of "streak days", then find consecutive runs.
  //
  //    Sparse scan: only dates that have at least one log for a wave habit
  //    are visited — O(log-count), not O(calendar-days × habits).

  const waveHabitIds = new Set(includedHabits.map((h) => h.id));
  const dateSet = new Set();
  for (const log of logs) {
    if (waveHabitIds.has(log.habitId)) {
      dateSet.add(log.date);
    }
  }

  // For each candidate date, evaluate streak criterion.
  const streakDays = [];
  for (const date of dateSet) {
    let dayApplicable = 0;
    let dayCompleted = 0;
    for (const h of includedHabits) {
      if (ctx.appliesToday(h, date, ctx)) {
        dayApplicable += 1;
        const habitLogs = logsByHabit.get(h.id) ?? [];
        const log = habitLogs.find((l) => l.date === date);
        if (log && log.status === 'completed') {
          dayCompleted += 1;
        }
      }
    }
    if (dayApplicable > 0 && dayCompleted / dayApplicable >= streakThreshold / 100) {
      streakDays.push(date);
    }
  }

  // Sort ascending for consecutive-run scan.
  streakDays.sort();

  // Find longest consecutive run (adjacent dates differ by exactly 1 day).
  let longestStreak = 0;
  let currentRun = 0;
  for (let i = 0; i < streakDays.length; i++) {
    if (i === 0 || daysBetween(streakDays[i - 1], streakDays[i]) === 1) {
      currentRun += 1;
    } else {
      // Gap detected — run resets to 1 (this day starts a new run).
      currentRun = 1;
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  // 6. currentStreak — walk backward from today counting consecutive streak days.
  let currentStreak = 0;
  if (streakDays.length > 0) {
    const streakSet = new Set(streakDays);
    let cursor = today;
    while (streakSet.has(cursor)) {
      currentStreak += 1;
      // Step one day backward using local-calendar arithmetic (DST-safe).
      const [y, m, d] = cursor.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      cursor = _formatYMD(dt);
    }
  }

  // 7. isAtRisk — evaluate truly active (non-archived, non-mastered) habits only.
  //    A habit is "slipping" when its completionPct < globalThreshold.
  //    isAtRisk fires when slippingCount / activeCount >= atRiskSlipRatio (>= boundary).
  let slippingCount = 0;
  for (const h of activeHabits) {
    const habitLogs = logsByHabit.get(h.id) ?? [];
    const { applicable, completed } = _countForHabit(h, habitLogs, ctx);
    // Habits with no logs at all have 0% completion → always slipping.
    const habitPct = applicable > 0 ? completed / applicable : 0;
    if (habitPct < ctx.globalThreshold / 100) {
      slippingCount += 1;
    }
  }

  const isAtRisk = activeHabits.length > 0
    && slippingCount / activeHabits.length >= atRiskSlipRatio;

  return {
    waveNumber,
    habitCount: waveHabits.length,
    statusCounts,
    completionPct,
    longestStreak,
    currentStreak,
    isAtRisk,
  };
}
