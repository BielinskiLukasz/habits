/**
 * @file Unit tests for pure scoring model functions (SCORING-01, SCORING-02,
 * SCORING-04..07, D-110, D-111, D-112, D-124).
 *
 * Tests computeS1, computeS2, computeS3 exported from js/domain/scoring.js.
 * No IDB — all facts injected via habit, logs, and ctx mock objects.
 *
 * Coverage:
 *   S1: 14/14 daily (100, Healthy), grace period, zero applicable days,
 *       status thresholds (Healthy/Watch/At-risk/Failing), mastered habit.
 *   S2: [0,1] range, 21-day all-completed ≈ 1.0, never-completed = 0,
 *       grace period, etap2 > etap1 with same pattern, mastered [0,1].
 *   S3: single habit all-applicable ≈ 1.0, grace period,
 *       mastered contributes 0.3 automatically.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeS1, computeS2, computeS3 } from '../../js/domain/scoring.js';
import { daysFrom } from '../../js/util/date.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Build a ctx object with daily appliesToday and configurable fields.
 *
 * @param {{ windowDays?: number, globalThreshold?: number, appliesToday?: Function }} opts
 * @returns {object}
 */
function makeCtx({
  windowDays = 70,
  globalThreshold = 90,
  weekStart = 'mon',
  appliesToday = null,
} = {}) {
  return {
    appliesToday: appliesToday ?? ((_h, _d, _c) => true),
    windowDays,
    globalThreshold,
    weekStart,
    weekCompletions: () => 1,
    monthCompletions: () => 1,
    evaluationDate: '2026-06-29',
  };
}

/**
 * Build a daily binary log array: completed:true for each date from
 * `daysFrom(evalDate, -(count-1))` up to `evalDate` inclusive.
 *
 * @param {string} habitId
 * @param {string} evalDate YYYY-MM-DD
 * @param {number} count number of completed days (ending on evalDate)
 * @returns {Array<{habitId: string, date: string, completed: boolean}>}
 */
function buildCompletedLogs(habitId, evalDate, count) {
  const logs = [];
  for (let i = count - 1; i >= 0; i--) {
    logs.push({ habitId, date: daysFrom(evalDate, -i), status: 'completed' });
  }
  return logs;
}

// ---------------------------------------------------------------------------
// S1 — Rolling Threshold Health
// ---------------------------------------------------------------------------

describe('computeS1 — basic rolling-window score', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx(), evaluationDate: EVAL };

  test('14/14 daily completed in 14-day window → s1Score 100, s1Status Healthy', () => {
    const ctx14 = { ...makeCtx({ windowDays: 14 }), evaluationDate: EVAL };
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
    };
    // Window is [EVAL-14, EVAL-1] (evaluationDate itself excluded — see
    // s1-systemic-low-bias), so the 14 completed days must end the day
    // BEFORE EVAL, not on EVAL.
    const logs = buildCompletedLogs('h1', daysFrom(EVAL, -1), 14);
    const result = computeS1(habit, logs, ctx14);
    assert.equal(result.s1Score, 100);
    assert.equal(result.s1Status, 'Healthy');
  });

  test('grace period: createdAt today → {s1Score: null, s1Status: null}', () => {
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: EVAL,
      targetType: 'binary',
    };
    const result = computeS1(habit, [], ctx);
    assert.equal(result.s1Score, null);
    assert.equal(result.s1Status, null);
  });

  test('no applicable days (appliesToday always false) → s1Score 0, s1Status Failing', () => {
    const neverCtx = { ...makeCtx({ appliesToday: () => false }), evaluationDate: EVAL };
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
    };
    const result = computeS1(habit, [], neverCtx);
    assert.equal(result.s1Score, 0);
    assert.equal(result.s1Status, 'Failing');
  });
});

describe('computeS1 — status thresholds (D-110)', () => {
  // Use a custom ctx that returns a known score via controlled logs.
  const EVAL = '2026-06-29';

  /**
   * Create a scenario where s1Score will equal targetScore by providing
   * exactly floor(targetScore/100 * windowDays) completed days and
   * adjusting if Math.round lands on a different integer.
   */
  function makeScenario(targetScore, threshold = 90) {
    const windowDays = 100; // easy maths: score == completedCount
    const ctx = { ...makeCtx({ windowDays, globalThreshold: threshold }), evaluationDate: EVAL };
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -200),
      targetType: 'binary',
    };
    // Build exactly targetScore completed logs out of 100 applicable days.
    // Window is [EVAL-100, EVAL-1] (evaluationDate itself excluded — see
    // s1-systemic-low-bias), so anchor the log run on EVAL-1, not EVAL.
    const logs = buildCompletedLogs('h1', daysFrom(EVAL, -1), targetScore);
    return { ctx, habit, logs };
  }

  test('score 95, threshold 90 → Healthy', () => {
    const { ctx, habit, logs } = makeScenario(95, 90);
    const result = computeS1(habit, logs, ctx);
    assert.equal(result.s1Score, 95);
    assert.equal(result.s1Status, 'Healthy');
  });

  test('score 75 → Watch', () => {
    const { ctx, habit, logs } = makeScenario(75, 90);
    const result = computeS1(habit, logs, ctx);
    assert.equal(result.s1Score, 75);
    assert.equal(result.s1Status, 'Watch');
  });

  test('score 60 → At-risk', () => {
    const { ctx, habit, logs } = makeScenario(60, 90);
    const result = computeS1(habit, logs, ctx);
    assert.equal(result.s1Score, 60);
    assert.equal(result.s1Status, 'At-risk');
  });

  test('score 40 → Failing', () => {
    const { ctx, habit, logs } = makeScenario(40, 90);
    const result = computeS1(habit, logs, ctx);
    assert.equal(result.s1Score, 40);
    assert.equal(result.s1Status, 'Failing');
  });
});

describe('computeS1 — mastered habit (SCORING-07)', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx(), evaluationDate: EVAL };

  test('isMastered: true → {s1Score: 100, s1Status: Healthy} regardless of logs', () => {
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
      isMastered: true,
    };
    const result = computeS1(habit, [], ctx);
    assert.equal(result.s1Score, 100);
    assert.equal(result.s1Status, 'Healthy');
  });
});

// ---------------------------------------------------------------------------
// S1 — daily rolling window must exclude the still-open evaluationDate
// (s1-systemic-low-bias)
// ---------------------------------------------------------------------------
//
// The rolling window for non-periodic cadences (daily / day-of-week-subset /
// every-n-days) must be the `windowDays` days STRICTLY BEFORE evaluationDate —
// [evaluationDate-windowDays, evaluationDate-1] — not
// [evaluationDate-(windowDays-1), evaluationDate] (evaluationDate INCLUSIVE).
// evaluationDate itself is the current, still-in-progress day: it has not
// fully elapsed, so counting it as an applicable-but-undecided day biases the
// score. This mirrors the already-correct "still-open period doesn't count
// as a miss" guard `_computeS1Periodic` applies to weekly/monthly cadences —
// see .planning/debug/s1-systemic-low-bias.md for the full investigation
// (real-data replay dropped the average |reference-computed| discrepancy
// from 1.040pp to 0.042pp once the boundary was moved).

describe('computeS1 — daily rolling window excludes evaluationDate itself (s1-systemic-low-bias)', () => {
  const EVAL = '2026-09-18'; // "today" — still open/in-progress, not yet logged
  const ctx5 = { ...makeCtx({ windowDays: 5 }), evaluationDate: EVAL };

  test('5/5 FULLY-ELAPSED prior days completed, evaluationDate itself not yet logged → s1Score 100 (evaluationDate excluded from window)', () => {
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
    };
    // Completed for the 5 days strictly BEFORE EVAL: EVAL-5..EVAL-1.
    // Nothing logged for EVAL itself — the still-open current day.
    const logs = [];
    for (let i = 5; i >= 1; i--) {
      logs.push({ habitId: 'h1', date: daysFrom(EVAL, -i), status: 'completed' });
    }
    const result = computeS1(habit, logs, ctx5);
    assert.equal(result.s1Score, 100,
      `Expected 100 — the 5-day trailing window is [EVAL-5, EVAL-1]; EVAL ` +
      `itself (still open, unlogged) must not be counted as an ` +
      `applicable-but-missed day. Got ${result.s1Score} (a value < 100 ` +
      `means evaluationDate is still being counted in the window).`);
    assert.equal(result.s1Status, 'Healthy');
  });
});

// ---------------------------------------------------------------------------
// S1 — weekly/monthly periodic denominator boundary (s1-weekly-period-premature)
// ---------------------------------------------------------------------------
//
// _computeS1Periodic must not count the current, still-open period (the ISO
// week / calendar month containing ctx.evaluationDate) as an expected-but-
// missed period before it has actually elapsed (pEnd <= evaluationDate).
// EVAL = '2026-06-24' is a Wednesday; with weekStart='mon' the current ISO
// week is 2026-06-22..2026-06-28 (pEnd 06-28 > EVAL 06-24 → still open).
// The current calendar month is 2026-06-01..2026-06-30 (pEnd 06-30 > EVAL →
// still open). See .planning/debug/s1-weekly-period-premature.md.

describe('computeS1 — weekly cadence periodic boundary (s1-weekly-period-premature)', () => {
  const EVAL = '2026-06-24'; // Wednesday
  const ctx21 = { ...makeCtx({ windowDays: 21, weekStart: 'mon' }), evaluationDate: EVAL };

  function weeklyHabit() {
    return {
      id: 'hw',
      cadence: { type: 'weekly' },
      createdAt: '2026-01-01',
      startDate: '2026-01-01',
      targetType: 'binary',
    };
  }

  test('current open week not yet logged does NOT count as a miss (elapsed weeks all completed → 100)', () => {
    const habit = weeklyHabit();
    // Elapsed periods within the 21-day window: partial week (06-04..06-07),
    // full week (06-08..06-14), full week (06-15..06-21). Current week
    // (06-22..06-24, clamped) has no completion yet — habit hasn't been
    // logged today or this week, but 4 days remain until 06-28.
    const logs = [
      { habitId: 'hw', date: '2026-06-05', status: 'completed' }, // partial week 1
      { habitId: 'hw', date: '2026-06-10', status: 'completed' }, // week 2
      { habitId: 'hw', date: '2026-06-17', status: 'completed' }, // week 3
      // no completion 06-22..06-24 — current week still open, not a miss
    ];
    const result = computeS1(habit, logs, ctx21);
    assert.equal(result.s1Score, 100,
      `Expected 100 (only elapsed weeks count), got ${result.s1Score} — ` +
      `the still-open current week is being counted as a missed period`);
    assert.equal(result.s1Status, 'Healthy');
  });

  test('current open week already completed mid-week still counts as completed (no regression)', () => {
    const habit = weeklyHabit();
    const logs = [
      { habitId: 'hw', date: '2026-06-05', status: 'completed' },
      { habitId: 'hw', date: '2026-06-10', status: 'completed' },
      { habitId: 'hw', date: '2026-06-17', status: 'completed' },
      { habitId: 'hw', date: '2026-06-23', status: 'completed' }, // current week, logged early
    ];
    const result = computeS1(habit, logs, ctx21);
    assert.equal(result.s1Score, 100);
    assert.equal(result.s1Status, 'Healthy');
  });

  test('a fully-elapsed past week with no completion still counts as a miss (no regression)', () => {
    const habit = weeklyHabit();
    const logs = [
      { habitId: 'hw', date: '2026-06-05', status: 'completed' }, // partial week 1 — hit
      // week 2 (06-08..06-14) — MISSED, fully elapsed
      { habitId: 'hw', date: '2026-06-17', status: 'completed' }, // week 3 — hit
      // current week (06-22..06-24) — not logged yet, still open (excluded)
    ];
    const result = computeS1(habit, logs, ctx21);
    // 2 of 3 elapsed weeks completed → round(2/3*100) = 67, NOT 100 and NOT the
    // old buggy 50 (which double-counted the still-open current week as a
    // 4th expected-but-missed period: round(2/4*100) = 50).
    assert.equal(result.s1Score, 67,
      `Expected 67 (2/3 elapsed weeks), got ${result.s1Score}`);
    assert.equal(result.s1Status, 'At-risk');
  });
});

describe('computeS1 — monthly cadence periodic boundary (s1-weekly-period-premature)', () => {
  const EVAL = '2026-06-24';
  const ctx95 = { ...makeCtx({ windowDays: 95, weekStart: 'mon' }), evaluationDate: EVAL };

  function monthlyHabit() {
    return {
      id: 'hm',
      cadence: { type: 'monthly' },
      createdAt: '2025-01-01',
      startDate: '2025-01-01',
      targetType: 'binary',
    };
  }

  test('current open month not yet logged does NOT count as a miss (elapsed months all completed → 100)', () => {
    const habit = monthlyHabit();
    // windowStart = 2026-03-22 (partial March), then full April, full May.
    // June (current month, pEnd 06-30 > EVAL 06-24) is still open — no
    // completion yet, but days remain until 06-30.
    const logs = [
      { habitId: 'hm', date: '2026-03-25', status: 'completed' }, // partial March
      { habitId: 'hm', date: '2026-04-10', status: 'completed' }, // April
      { habitId: 'hm', date: '2026-05-15', status: 'completed' }, // May
      // no completion in June — current month still open, not a miss
    ];
    const result = computeS1(habit, logs, ctx95);
    assert.equal(result.s1Score, 100,
      `Expected 100 (only elapsed months count), got ${result.s1Score} — ` +
      `the still-open current month is being counted as a missed period`);
    assert.equal(result.s1Status, 'Healthy');
  });
});

// ---------------------------------------------------------------------------
// S1 — weekly/monthly periodic leading-window completion visibility
// (s1-weekly-numeric-anomalies)
// ---------------------------------------------------------------------------
//
// _computeS1Periodic's completion scan clamped its LEFT bound to windowStart
// when checking whether a period had any completion. For the leading period
// that straddles the rolling window's start (pStart < windowStart <= pEnd),
// this hides a real completion that landed a few days BEFORE windowStart but
// still within that same period — the period is fully elapsed, so it gets
// counted as "expected", but the (invisible) completion means it also gets
// wrongly counted as "missed". A period that was actually completed is
// misclassified as a miss purely because the visible slice happened not to
// contain the completion date. Fix: scan the FULL period [pStart, pEnd]
// (clamped only on the right, to evaluationDate) for a completion — the left
// edge of the rolling window should bound which periods are *counted*, not
// which days are *visible* to the completion check for a period that is
// counted. See .planning/debug/s1-weekly-numeric-anomalies.md.

describe('computeS1 — weekly cadence leading-window completion visibility (s1-weekly-numeric-anomalies)', () => {
  const EVAL = '2026-06-24'; // Wednesday; windowStart(21) = 2026-06-04
  const ctx21 = { ...makeCtx({ windowDays: 21, weekStart: 'mon' }), evaluationDate: EVAL };

  function weeklyHabit() {
    return {
      id: 'hw',
      cadence: { type: 'weekly' },
      createdAt: '2026-01-01',
      startDate: '2026-01-01',
      targetType: 'binary',
    };
  }

  test('a completion 2 days before windowStart (same leading period) is not misclassified as a miss', () => {
    const habit = weeklyHabit();
    // Leading period is the ISO week 2026-06-01..2026-06-07 (windowStart
    // 06-04 falls inside it). The completion landed on 06-02 — before
    // windowStart, but still within the leading period.
    const logs = [
      { habitId: 'hw', date: '2026-06-02', status: 'completed' }, // leading period, before windowStart
      { habitId: 'hw', date: '2026-06-10', status: 'completed' }, // week 2
      { habitId: 'hw', date: '2026-06-17', status: 'completed' }, // week 3
      // current week (06-22..06-24) still open, not logged yet — excluded
    ];
    const result = computeS1(habit, logs, ctx21);
    assert.equal(result.s1Score, 100,
      `Expected 100 (leading period's completion is visible even though it ` +
      `landed before windowStart), got ${result.s1Score}`);
    assert.equal(result.s1Status, 'Healthy');
  });

  test('boundary neighbor: a completion exactly ON windowStart still counts (no regression)', () => {
    const habit = weeklyHabit();
    const logs = [
      { habitId: 'hw', date: '2026-06-04', status: 'completed' }, // exactly windowStart
      { habitId: 'hw', date: '2026-06-10', status: 'completed' },
      { habitId: 'hw', date: '2026-06-17', status: 'completed' },
    ];
    const result = computeS1(habit, logs, ctx21);
    assert.equal(result.s1Score, 100);
    assert.equal(result.s1Status, 'Healthy');
  });

  test('leading period genuinely never completed still counts as a miss (no over-correction)', () => {
    const habit = weeklyHabit();
    const logs = [
      // no completion anywhere in the leading period (06-01..06-07)
      { habitId: 'hw', date: '2026-06-10', status: 'completed' }, // week 2
      { habitId: 'hw', date: '2026-06-17', status: 'completed' }, // week 3
    ];
    const result = computeS1(habit, logs, ctx21);
    assert.equal(result.s1Score, 67,
      `Expected 67 (2/3 — leading period is a genuine miss), got ${result.s1Score}`);
    assert.equal(result.s1Status, 'At-risk');
  });
});

describe('computeS1 — monthly cadence leading-window completion visibility (s1-weekly-numeric-anomalies)', () => {
  const EVAL = '2026-06-24';
  const ctx95 = { ...makeCtx({ windowDays: 95, weekStart: 'mon' }), evaluationDate: EVAL };

  function monthlyHabit() {
    return {
      id: 'hm',
      cadence: { type: 'monthly' },
      createdAt: '2025-01-01',
      startDate: '2025-01-01',
      targetType: 'binary',
    };
  }

  test('a completion before windowStart in the leading partial month is not misclassified as a miss', () => {
    const habit = monthlyHabit();
    // windowStart = 2026-03-22; leading period is March (03-01..03-31).
    // Completion landed 03-05 — before windowStart, but still within March.
    const logs = [
      { habitId: 'hm', date: '2026-03-05', status: 'completed' }, // March, before windowStart
      { habitId: 'hm', date: '2026-04-10', status: 'completed' }, // April
      { habitId: 'hm', date: '2026-05-15', status: 'completed' }, // May
      // June (current month) still open, not logged yet — excluded
    ];
    const result = computeS1(habit, logs, ctx95);
    assert.equal(result.s1Score, 100,
      `Expected 100 (March's completion is visible even though it landed ` +
      `before windowStart), got ${result.s1Score}`);
    assert.equal(result.s1Status, 'Healthy');
  });
});

// ---------------------------------------------------------------------------
// S2 — Day-Weighted Wave Score
// ---------------------------------------------------------------------------

describe('computeS2 — basic weighted score', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx({ windowDays: 70 }), evaluationDate: EVAL };

  test('returns s2Score in [0, 1] range', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
      stage: 1,
    };
    const logs = buildCompletedLogs('h2', EVAL, 21);
    const result = computeS2(habit, logs, ctx);
    assert.ok(typeof result.s2Score === 'number', 's2Score should be a number');
    assert.ok(result.s2Score >= 0, `s2Score ${result.s2Score} should be >= 0`);
    assert.ok(result.s2Score <= 1, `s2Score ${result.s2Score} should be <= 1`);
  });

  test('habit completed every day for 21 days in 21-day window scores close to 1.0 (within 0.01)', () => {
    const ctx21 = { ...makeCtx({ windowDays: 21 }), evaluationDate: EVAL };
    const habit = {
      id: 'h2',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
      stage: 1,
    };
    const logs = buildCompletedLogs('h2', EVAL, 21);
    const result = computeS2(habit, logs, ctx21);
    assert.ok(result.s2Score > 0.99, `Expected s2Score near 1.0, got ${result.s2Score}`);
  });

  test('habit never completed → s2Score 0', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
      stage: 1,
    };
    const result = computeS2(habit, [], ctx);
    assert.equal(result.s2Score, 0);
  });

  test('grace period → {s2Score: null}', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'daily' },
      createdAt: EVAL,
      targetType: 'binary',
      stage: 1,
    };
    const result = computeS2(habit, [], ctx);
    assert.equal(result.s2Score, null);
  });
});

describe('computeS2 — stage multiplier (D-111)', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx({ windowDays: 70 }), evaluationDate: EVAL };
  const createdAt = daysFrom(EVAL, -30);

  test('etap2 habit scores higher than identical etap1 habit with same completion pattern', () => {
    const logs = buildCompletedLogs('h2', EVAL, 21);

    const habitEtap1 = {
      id: 'h2', cadence: { type: 'daily' }, createdAt, targetType: 'binary', stage: 1,
    };
    const habitEtap2 = {
      id: 'h2', cadence: { type: 'daily' }, createdAt, targetType: 'binary', stage: 2,
    };

    const r1 = computeS2(habitEtap1, logs, ctx);
    const r2 = computeS2(habitEtap2, logs, ctx);

    assert.ok(r2.s2Score > r1.s2Score,
      `etap2 score ${r2.s2Score} should exceed etap1 score ${r1.s2Score}`);
  });
});

describe('computeS2 — mastered habit weighting (SCORING-07)', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx({ windowDays: 70 }), evaluationDate: EVAL };

  test('mastered habit s2Score is in [0, 1]', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
      stage: 1,
      isMastered: true,
    };
    const logs = buildCompletedLogs('h2', EVAL, 21);
    const result = computeS2(habit, logs, ctx);
    assert.ok(result.s2Score >= 0 && result.s2Score <= 1,
      `s2Score for mastered habit should be in [0,1], got ${result.s2Score}`);
  });
});

// ---------------------------------------------------------------------------
// S3 — Load-Adjusted Capacity Score
// ---------------------------------------------------------------------------

describe('computeS3 — basic load-adjusted score', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx({ windowDays: 70 }), evaluationDate: EVAL };

  test('single habit in allHabits, completed every applicable day → s3Score close to 1.0', () => {
    const habit = {
      id: 'h3',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
    };
    const logs = buildCompletedLogs('h3', EVAL, 70);
    const result = computeS3(habit, logs, ctx, [habit]);
    assert.ok(result.s3Score >= 0.99,
      `Expected s3Score near 1.0, got ${result.s3Score}`);
  });

  test('grace period → {s3Score: null}', () => {
    const habit = {
      id: 'h3',
      cadence: { type: 'daily' },
      createdAt: EVAL,
      targetType: 'binary',
    };
    const result = computeS3(habit, [], ctx, [habit]);
    assert.equal(result.s3Score, null);
  });

  test('s3Score is in [0, 1] for partial completion', () => {
    const habit = {
      id: 'h3',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
    };
    const logs = buildCompletedLogs('h3', EVAL, 35); // half completed
    const result = computeS3(habit, logs, ctx, [habit]);
    assert.ok(result.s3Score >= 0 && result.s3Score <= 1,
      `s3Score ${result.s3Score} should be in [0,1]`);
  });
});

describe('computeS3 — mastered habit contribution (SCORING-07)', () => {
  const EVAL = '2026-06-29';
  const ctx = { ...makeCtx({ windowDays: 70 }), evaluationDate: EVAL };

  test('mastered habit contributes 0.3 automatically (score > 0 with no logs)', () => {
    const habit = {
      id: 'h3',
      cadence: { type: 'daily' },
      createdAt: daysFrom(EVAL, -30),
      targetType: 'binary',
      isMastered: true,
    };
    // No logs, but mastered should still contribute
    const result = computeS3(habit, [], ctx, [habit]);
    assert.ok(result.s3Score !== null, 's3Score should not be null for mastered habit');
    assert.ok(result.s3Score > 0,
      `Mastered habit with 0.3 auto-contribution should yield s3Score > 0, got ${result.s3Score}`);
  });
});
