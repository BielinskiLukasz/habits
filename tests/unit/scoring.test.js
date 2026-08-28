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
    const logs = buildCompletedLogs('h1', EVAL, 14);
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
    const logs = buildCompletedLogs('h1', EVAL, targetScore);
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
