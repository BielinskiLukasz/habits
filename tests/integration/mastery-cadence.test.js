/** @file Mastery evaluation with cadence-aware denominator integration tests (MASTERY-05).
 *
 * Verifies that evaluateMastery + the real appliesToday from cadence.js
 * compute the denominator from applicable days only, not raw windowDays.
 * The unit test in tests/unit/mastery.test.js covers the same function but
 * uses a mock appliesToday — this file wires the real cadence resolver.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMastery } from '../../js/domain/mastery.js';
import { appliesToday } from '../../js/domain/cadence.js';

/**
 * Build a shared ctx using the real appliesToday from cadence.js.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function makeCtx(overrides = {}) {
  return {
    globalThreshold: 90,
    globalWindow: 7,
    weekStart: 'mon',
    weekCompletions: () => 0,
    monthCompletions: () => 0,
    appliesToday,
    ...overrides,
  };
}

/**
 * Build completed binary log rows for a habit on the given dates.
 *
 * @param {string} habitId
 * @param {string[]} dates
 * @param {boolean} [completed]
 * @returns {object[]}
 */
function makeLogs(habitId, dates, isCompleted = true) {
  return dates.map(date => ({ habitId, date, status: isCompleted ? 'completed' : 'failed' }));
}

describe('mastery + cadence integration', () => {
  // Window = 7 days ending 2026-06-05 (Fri):
  //   May 30 Sat — N/A    Jun  1 Mon — applicable
  //   May 31 Sun — N/A    Jun  2 Tue — N/A
  //                        Jun  3 Wed — applicable
  //                        Jun  4 Thu — N/A
  //                        Jun  5 Fri — applicable (evaluation date)
  // → 3 applicable days out of 7 calendar days.

  const MON_WED_FRI = {
    id: 'h1',
    createdAt: '2026-01-01',
    cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
  };

  test('Mon-Wed-Fri habit: all 3 applicable days completed → mastered', () => {
    const logs = makeLogs('h1', ['2026-06-01', '2026-06-03', '2026-06-05']);
    const result = evaluateMastery(MON_WED_FRI, logs, '2026-06-05', makeCtx());
    assert.equal(result.applicableDayCount, 3, 'denominator must be applicable days, not windowDays (7)');
    assert.equal(result.completedCount, 3);
    assert.equal(result.isMastered, true);
  });

  test('Mon-Wed-Fri habit: 2 of 3 applicable days completed → not mastered (66% < 90%)', () => {
    const logs = makeLogs('h1', ['2026-06-01', '2026-06-03']); // miss Friday
    const result = evaluateMastery(MON_WED_FRI, logs, '2026-06-05', makeCtx());
    assert.equal(result.applicableDayCount, 3);
    assert.equal(result.completedCount, 2);
    assert.equal(result.isMastered, false);
    assert.ok(result.percentage < 90, `percentage ${result.percentage} should be < 90`);
  });

  test('daily habit over 7 days: denominator equals windowDays', () => {
    const habit = { id: 'h2', createdAt: '2026-01-01', cadence: { type: 'daily' } };
    const dates = ['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02',
                   '2026-06-03', '2026-06-04', '2026-06-05'];
    const result = evaluateMastery(habit, makeLogs('h2', dates), '2026-06-05', makeCtx());
    assert.equal(result.applicableDayCount, 7, 'daily habit: all 7 days applicable');
    assert.equal(result.isMastered, true);
  });

  test('future startDate guard via real appliesToday: habit not yet active → 0 applicable days', () => {
    const habit = {
      id: 'h3',
      createdAt: '2026-01-01',
      startDate: '2026-12-01', // far future
      cadence: { type: 'daily' },
    };
    const result = evaluateMastery(habit, [], '2026-06-05', makeCtx());
    assert.equal(result.applicableDayCount, 0, 'scheduled habit: no applicable days before startDate');
    assert.equal(result.isMastered, false);
  });
});
