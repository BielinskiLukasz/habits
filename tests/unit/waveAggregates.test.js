/**
 * @file Unit tests for js/domain/waveAggregates.js (WAVE-01..06, D-83).
 *
 * Tests cover:
 *   - Empty wave (no habits) → zero-value result
 *   - Status counts: active / mastered / archived via ctx.isMastered callback
 *   - Completion % = applicable+completed / total-applicable × 100 (archived excluded)
 *   - Longest streak: consecutive days where >= streakThreshold% of applicable habits completed
 *   - currentStreak: streak ending on today (0 if today not a streak day)
 *   - isAtRisk: true when >= atRiskSlipRatio of active habits have sub-threshold completion
 *   - isAtRisk boundary: >= not > (exact 50% fires)
 *   - Mastered habits excluded from isAtRisk denominator
 *   - Defaults: streakThreshold=80, atRiskSlipRatio=0.5
 *
 * Pattern S8 (D-26 Tier 1) — pure-function fixture tests in Node, no DOM.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeWaveAggregates } from '../../js/domain/waveAggregates.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Minimal valid ctx object for tests.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function makeCtx(overrides = {}) {
  return {
    appliesToday: (_habit, _date) => true,  // All habits apply by default
    weekStart: 'mon',
    weekCompletions: () => 0,
    monthCompletions: () => 0,
    globalThreshold: 90,
    globalWindow: 70,
    isMastered: () => false,
    streakThreshold: 80,
    atRiskSlipRatio: 0.5,
    ...overrides,
  };
}

/**
 * Create a minimal habit row.
 *
 * @param {object} fields
 * @returns {object}
 */
function makeHabit(fields) {
  return {
    id: 'h1',
    wave: 1,
    status: 'active',
    cadence: { type: 'daily' },
    createdAt: '2026-01-01',
    ...fields,
  };
}

/**
 * Create a completed log row for a habit on a date.
 *
 * @param {string} habitId
 * @param {string} date  YYYY-MM-DD
 * @param {boolean} [completed]
 * @returns {object}
 */
function makeLog(habitId, date, completed = true) {
  return { habitId, date, completed };
}

// ---------------------------------------------------------------------------
// Empty wave
// ---------------------------------------------------------------------------

describe('empty wave', () => {
  test('zero-value result for waveNumber with no matching habits', () => {
    const result = computeWaveAggregates(99, [], [], '2026-06-04', makeCtx());
    assert.equal(result.waveNumber, 99);
    assert.equal(result.habitCount, 0);
    assert.deepEqual(result.statusCounts, { active: 0, mastered: 0, archived: 0 });
    assert.equal(result.completionPct, 0);
    assert.equal(result.longestStreak, 0);
    assert.equal(result.currentStreak, 0);
    assert.equal(result.isAtRisk, false);
  });

  test('habits array has entries but none match waveNumber', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 2 }),
      makeHabit({ id: 'h2', wave: 3 }),
    ];
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', makeCtx());
    assert.equal(result.habitCount, 0);
    assert.equal(result.completionPct, 0);
    assert.equal(result.longestStreak, 0);
    assert.equal(result.isAtRisk, false);
  });
});

// ---------------------------------------------------------------------------
// waveNumber propagation
// ---------------------------------------------------------------------------

describe('waveNumber in result', () => {
  test('result.waveNumber matches input waveNumber', () => {
    const result = computeWaveAggregates(4, [], [], '2026-06-04', makeCtx());
    assert.equal(result.waveNumber, 4);
  });

  test('result.waveNumber is 0 when waveNumber is 0', () => {
    const result = computeWaveAggregates(0, [], [], '2026-06-04', makeCtx());
    assert.equal(result.waveNumber, 0);
  });
});

// ---------------------------------------------------------------------------
// Status counts
// ---------------------------------------------------------------------------

describe('statusCounts', () => {
  test('3 active, 0 mastered, 0 archived', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'active' }),
      makeHabit({ id: 'h3', wave: 1, status: 'active' }),
    ];
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', makeCtx());
    assert.deepEqual(result.statusCounts, { active: 3, mastered: 0, archived: 0 });
    assert.equal(result.habitCount, 3);
  });

  test('3 active, 2 mastered, 1 archived via isMastered callback', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'active' }),
      makeHabit({ id: 'h3', wave: 1, status: 'active' }),
      makeHabit({ id: 'h4', wave: 1, status: 'active' }),
      makeHabit({ id: 'h5', wave: 1, status: 'active' }),
      makeHabit({ id: 'h6', wave: 1, status: 'archived' }),
    ];
    const masteredIds = new Set(['h4', 'h5']);
    const ctx = makeCtx({
      isMastered: (h) => masteredIds.has(h.id),
    });
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', ctx);
    assert.deepEqual(result.statusCounts, { active: 3, mastered: 2, archived: 1 });
    assert.equal(result.habitCount, 6);
  });

  test('mastered habits are non-archived active habits where isMastered returns true', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'active' }),
    ];
    const ctx = makeCtx({ isMastered: (h) => h.id === 'h1' });
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', ctx);
    assert.deepEqual(result.statusCounts, { active: 1, mastered: 1, archived: 0 });
  });

  test('all archived', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'archived' }),
      makeHabit({ id: 'h2', wave: 1, status: 'archived' }),
    ];
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', makeCtx());
    assert.deepEqual(result.statusCounts, { active: 0, mastered: 0, archived: 2 });
  });
});

// ---------------------------------------------------------------------------
// completionPct
// ---------------------------------------------------------------------------

describe('completionPct', () => {
  test('2 daily habits, 5 days: h1 completes 4/5, h2 completes 3/5 → 70%', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
    ];
    const logs = [
      // h1: days 1..4 completed, day 5 not
      makeLog('h1', '2026-06-01'), makeLog('h1', '2026-06-02'),
      makeLog('h1', '2026-06-03'), makeLog('h1', '2026-06-04'),
      makeLog('h1', '2026-06-05', false),
      // h2: days 1..3 completed, days 4..5 not
      makeLog('h2', '2026-06-01'), makeLog('h2', '2026-06-02'),
      makeLog('h2', '2026-06-03'),
      makeLog('h2', '2026-06-04', false), makeLog('h2', '2026-06-05', false),
    ];
    // 5 applicable per habit × 2 = 10 total applicable
    // completed: 4 + 3 = 7
    // completionPct = round(7/10 * 100) = 70
    const result = computeWaveAggregates(1, habits, logs, '2026-06-05', makeCtx());
    assert.equal(result.completionPct, 70);
  });

  test('no logs → completionPct is 0', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', makeCtx());
    assert.equal(result.completionPct, 0);
  });

  test('archived habits excluded from completion %', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'archived' }),
    ];
    // Use 2 days to distinguish: h1 has 1/2, h2 has 2/2
    const logs = [
      makeLog('h1', '2026-06-01'),
      makeLog('h1', '2026-06-02', false),
      makeLog('h2', '2026-06-01'),
      makeLog('h2', '2026-06-02'),
    ];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-02', makeCtx());
    // Only h1: 1/2 = 50%
    assert.equal(result.completionPct, 50);
  });

  test('mastered habits (non-archived) included in completion %', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'active' }),
    ];
    const logs = [
      makeLog('h1', '2026-06-01'),
      makeLog('h2', '2026-06-01'),
    ];
    const ctx = makeCtx({ isMastered: (h) => h.id === 'h2' });
    // Both included: 2/2 = 100%
    const result = computeWaveAggregates(1, habits, logs, '2026-06-01', ctx);
    assert.equal(result.completionPct, 100);
  });

  test('all applicable completed → 100%', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const logs = [makeLog('h1', '2026-06-01')];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-01', makeCtx());
    assert.equal(result.completionPct, 100);
  });

  test('no applicable days (appliesToday returns false for all) → 0%', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const logs = [makeLog('h1', '2026-06-01')];
    const ctx = makeCtx({ appliesToday: () => false });
    const result = computeWaveAggregates(1, habits, logs, '2026-06-01', ctx);
    assert.equal(result.completionPct, 0);
  });

  test('completion rounds correctly: 1/3 applicable → 33%', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const logs = [
      makeLog('h1', '2026-06-01'),
      makeLog('h1', '2026-06-02', false),
      makeLog('h1', '2026-06-03', false),
    ];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-03', makeCtx());
    assert.equal(result.completionPct, 33);
  });
});

// ---------------------------------------------------------------------------
// Longest streak and currentStreak
// ---------------------------------------------------------------------------

describe('longestStreak and currentStreak', () => {
  test('5 consecutive days all completed (3 habits) → longestStreak=5', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
      makeHabit({ id: 'h3', wave: 1 }),
    ];
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    const logs = dates.flatMap((d) => [
      makeLog('h1', d), makeLog('h2', d), makeLog('h3', d),
    ]);
    const result = computeWaveAggregates(1, habits, logs, '2026-06-05', makeCtx());
    assert.equal(result.longestStreak, 5);
  });

  test('streak breaks when only 1/3 completed on day 6 (33% < 80%)', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
      makeHabit({ id: 'h3', wave: 1 }),
    ];
    const goodDates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    const logs = goodDates.flatMap((d) => [
      makeLog('h1', d), makeLog('h2', d), makeLog('h3', d),
    ]);
    // Day 6: only h1 completes (33%)
    logs.push(makeLog('h1', '2026-06-06'));
    const result = computeWaveAggregates(1, habits, logs, '2026-06-06', makeCtx());
    assert.equal(result.longestStreak, 5);
  });

  test('two streaks separated by a break: longestStreak=5, currentStreak=3', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    // First streak: 5 days
    const streak1 = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    // Gap: 2 days (2026-06-06, 2026-06-07) — no logs
    // Second streak: 3 days
    const streak2 = ['2026-06-08', '2026-06-09', '2026-06-10'];
    const logs = [...streak1, ...streak2].map((d) => makeLog('h1', d));
    const result = computeWaveAggregates(1, habits, logs, '2026-06-10', makeCtx());
    assert.equal(result.longestStreak, 5);
    assert.equal(result.currentStreak, 3);
  });

  test('currentStreak is 0 when today is not a streak day', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const logs = [
      makeLog('h1', '2026-06-01'),
      makeLog('h1', '2026-06-02'),
      // gap: 2026-06-03 not logged
    ];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', makeCtx());
    assert.equal(result.currentStreak, 0);
  });

  test('longestStreak is 0 when no streak day exists', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const logs = [
      makeLog('h1', '2026-06-01', false),
    ];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-01', makeCtx());
    assert.equal(result.longestStreak, 0);
    assert.equal(result.currentStreak, 0);
  });

  test('single streak day → longestStreak=1, currentStreak=1 when today matches', () => {
    const habits = [makeHabit({ id: 'h1', wave: 1 })];
    const logs = [makeLog('h1', '2026-06-04')];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', makeCtx());
    assert.equal(result.longestStreak, 1);
    assert.equal(result.currentStreak, 1);
  });

  test('streakThreshold=100 requires all habits completed', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
    ];
    const logs = [
      makeLog('h1', '2026-06-01'), makeLog('h2', '2026-06-01'),
      makeLog('h1', '2026-06-02'), // h2 missed: 50% < 100% → breaks streak
    ];
    const ctx = makeCtx({ streakThreshold: 100 });
    const result = computeWaveAggregates(1, habits, logs, '2026-06-02', ctx);
    assert.equal(result.longestStreak, 1);
    assert.equal(result.currentStreak, 0);
  });

  test('streakThreshold=50 allows 50% completion (boundary: >=)', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
    ];
    const logs = [
      makeLog('h1', '2026-06-01'), // 50% — should count at threshold=50
      makeLog('h2', '2026-06-01', false),
    ];
    const ctx = makeCtx({ streakThreshold: 50 });
    const result = computeWaveAggregates(1, habits, logs, '2026-06-01', ctx);
    assert.equal(result.longestStreak, 1);
  });

  test('empty habits → longestStreak=0 and currentStreak=0', () => {
    const result = computeWaveAggregates(1, [], [], '2026-06-04', makeCtx());
    assert.equal(result.longestStreak, 0);
    assert.equal(result.currentStreak, 0);
  });
});

// ---------------------------------------------------------------------------
// isAtRisk
// ---------------------------------------------------------------------------

describe('isAtRisk', () => {
  test('4 active habits, 3 slipping (75% >= 50%) → isAtRisk true', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
      makeHabit({ id: 'h3', wave: 1 }),
      makeHabit({ id: 'h4', wave: 1 }),
    ];
    // Only h4 has >= globalThreshold (90%) completion over globalWindow (70 days)
    // h1, h2, h3 have no logs → 0% < 90% → slipping
    const logs = [makeLog('h4', '2026-06-04')];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', makeCtx());
    assert.equal(result.isAtRisk, true);
  });

  test('2 of 4 slipping (50% >= 50%) → isAtRisk true (boundary: >=, not >)', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
      makeHabit({ id: 'h3', wave: 1 }),
      makeHabit({ id: 'h4', wave: 1 }),
    ];
    // h3 and h4 complete on 2026-06-04 → 100% → not slipping
    // h1 and h2 have no logs → 0% < 90% → slipping
    const logs = [makeLog('h3', '2026-06-04'), makeLog('h4', '2026-06-04')];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', makeCtx());
    assert.equal(result.isAtRisk, true);
  });

  test('1 of 4 slipping (25% < 50%) → isAtRisk false', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
      makeHabit({ id: 'h3', wave: 1 }),
      makeHabit({ id: 'h4', wave: 1 }),
    ];
    // h2, h3, h4 complete → not slipping; h1 has no log → slipping
    const logs = [
      makeLog('h2', '2026-06-04'),
      makeLog('h3', '2026-06-04'),
      makeLog('h4', '2026-06-04'),
    ];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', makeCtx());
    assert.equal(result.isAtRisk, false);
  });

  test('isAtRisk false when no active habits', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'archived' }),
    ];
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', makeCtx());
    assert.equal(result.isAtRisk, false);
  });

  test('mastered habits excluded from isAtRisk denominator', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'active' }),
      makeHabit({ id: 'h3', wave: 1, status: 'active' }),
      makeHabit({ id: 'h4', wave: 1, status: 'active' }),
    ];
    const masteredIds = new Set(['h3', 'h4']);
    const ctx = makeCtx({ isMastered: (h) => masteredIds.has(h.id) });
    // Active non-mastered: h1, h2
    // h1 has no log → slipping, h2 has full log → not slipping
    // 1/2 = 50% slipping >= 50% → isAtRisk true
    const logs = [makeLog('h2', '2026-06-04')];
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', ctx);
    assert.equal(result.isAtRisk, true);
  });

  test('mastered-and-archived habits both excluded — only truly active count', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1, status: 'active' }),
      makeHabit({ id: 'h2', wave: 1, status: 'active' }),
      makeHabit({ id: 'h3', wave: 1, status: 'archived' }),
    ];
    const ctx = makeCtx({ isMastered: (h) => h.id === 'h2' });
    // Active non-mastered: only h1
    // h1 has no log → slipping: 1/1 = 100% >= 50% → isAtRisk true
    const result = computeWaveAggregates(1, habits, [], '2026-06-04', ctx);
    assert.equal(result.isAtRisk, true);
  });

  test('atRiskSlipRatio=0.25: 1/4 slipping fires at-risk', () => {
    const habits = [
      makeHabit({ id: 'h1', wave: 1 }),
      makeHabit({ id: 'h2', wave: 1 }),
      makeHabit({ id: 'h3', wave: 1 }),
      makeHabit({ id: 'h4', wave: 1 }),
    ];
    // h2, h3, h4 complete → not slipping
    // h1 has no log → slipping: 1/4 = 25% >= 25% → at risk
    const logs = [
      makeLog('h2', '2026-06-04'),
      makeLog('h3', '2026-06-04'),
      makeLog('h4', '2026-06-04'),
    ];
    const ctx = makeCtx({ atRiskSlipRatio: 0.25 });
    const result = computeWaveAggregates(1, habits, logs, '2026-06-04', ctx);
    assert.equal(result.isAtRisk, true);
  });

  test('empty wave → isAtRisk false', () => {
    const result = computeWaveAggregates(99, [], [], '2026-06-04', makeCtx());
    assert.equal(result.isAtRisk, false);
  });
});

// ---------------------------------------------------------------------------
// Return shape completeness
// ---------------------------------------------------------------------------

describe('return shape completeness', () => {
  test('all required fields present in result', () => {
    const result = computeWaveAggregates(1, [], [], '2026-06-04', makeCtx());
    const keys = Object.keys(result);
    for (const k of ['waveNumber', 'habitCount', 'statusCounts', 'completionPct', 'longestStreak', 'currentStreak', 'isAtRisk']) {
      assert.ok(keys.includes(k), `Missing key: ${k}`);
    }
  });

  test('statusCounts has exactly active, mastered, archived keys', () => {
    const result = computeWaveAggregates(1, [], [], '2026-06-04', makeCtx());
    const scKeys = Object.keys(result.statusCounts).sort();
    assert.deepEqual(scKeys, ['active', 'archived', 'mastered']);
  });
});
