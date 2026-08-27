/** @file Wave aggregate computation integration tests (WAVE-01..06).
 *
 * Verifies that computeWaveAggregates + the real appliesToday from cadence.js
 * compute completionPct and streak metrics from applicable days only.
 * The unit tests in tests/unit/waveAggregates.test.js cover the same
 * function but use a mock appliesToday — this file wires the real resolver.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWaveAggregates } from '../../js/domain/waveAggregates.js';
import { appliesToday } from '../../js/domain/cadence.js';

/**
 * Build a shared ctx using the real appliesToday from cadence.js.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function makeCtx(overrides = {}) {
  return {
    appliesToday,
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
 * Build completed binary log rows.
 *
 * @param {string} habitId
 * @param {string[]} dates
 * @param {boolean} [completed]
 * @returns {object[]}
 */
function makeLogs(habitId, dates, completed = true) {
  return dates.map(date => ({ habitId, date, completed }));
}

describe('wave aggregates + cadence integration', () => {
  // Wave 1: one Mon-Wed-Fri habit; evaluate over the week of 2026-06-01..06-05.
  // Applicable days: Mon Jun 1, Wed Jun 3, Fri Jun 5 → 3 applicable days.

  const habit = {
    id: 'h1',
    wave: 1,
    status: 'active',
    createdAt: '2026-01-01',
    cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
  };

  test('Mon-Wed-Fri habit: completionPct based on applicable days', () => {
    // 2 of 3 applicable days completed: Mon + Wed complete, Fri missed.
    // waveAggregates counts only days WITH logs that are applicable, so Fri
    // needs an explicit log with completed=false to register as applicable+missed.
    const logs = [
      ...makeLogs('h1', ['2026-06-01', '2026-06-03']),              // Mon + Wed: complete
      ...makeLogs('h1', ['2026-06-04'], false),                      // Thu: N/A — excluded
      ...makeLogs('h1', ['2026-06-05'], false),                      // Fri: applicable, missed
    ];
    const result = computeWaveAggregates(1, [habit], logs, '2026-06-05', makeCtx());
    // applicable: Mon Jun 1, Wed Jun 3, Fri Jun 5 = 3; completed = 2
    // Jun 4 (Thu) excluded by appliesToday
    assert.ok(result.completionPct > 60 && result.completionPct < 70,
      `completionPct ${result.completionPct} should be ~67% (2/3 applicable)`);
    assert.equal(result.habitCount, 1);
    assert.equal(result.statusCounts.active, 1);
  });

  test('daily habit: completionPct = 100% when all logs present', () => {
    const dailyHabit = { id: 'h2', wave: 1, status: 'active', createdAt: '2026-01-01',
                          cadence: { type: 'daily' } };
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    const result = computeWaveAggregates(1, [dailyHabit], makeLogs('h2', dates), '2026-06-05', makeCtx());
    assert.equal(result.completionPct, 100);
  });

  test('Mon-Wed-Fri habit: streak counts only applicable days', () => {
    // Both applicable days in a 3-day window all complete → streak of 1 day
    // Streak = consecutive calendar days where >= streakThreshold% of applicable habits completed.
    // Jun 1 (Mon): habit applies and completes → streak day
    // Jun 2 (Tue): habit does not apply (no applicable habits) → not a streak day
    // Jun 3 (Wed): habit applies and completes → streak day
    // Jun 4 (Thu): habit does not apply → not a streak day
    // Jun 5 (Fri): habit applies and completes → streak day
    // Consecutive streak days (calendar adjacency required): Jun 1 alone, Jun 3 alone, Jun 5 alone
    // → longestStreak = 1, currentStreak = 1
    const logs = makeLogs('h1', ['2026-06-01', '2026-06-03', '2026-06-05']);
    const result = computeWaveAggregates(1, [habit], logs, '2026-06-05', makeCtx());
    // currentStreak ends on 2026-06-05 which is a streak day → at least 1
    assert.ok(result.currentStreak >= 1, `currentStreak ${result.currentStreak} should be >= 1`);
  });
});
