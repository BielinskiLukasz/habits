/**
 * @file Mastery evaluation unit tests (MASTERY-01..07).
 *
 * Tests the pure `evaluateMastery(habit, logsForHabit, evaluationDate, ctx)`
 * function from js/domain/mastery.js. No IDB reads inside the function —
 * all inputs are passed by the caller.
 *
 * Test coverage:
 *   - Grace period: first 7 days return isMastered:false, isInGracePeriod:true
 *   - Cadence-aware denominator: Mon-Fri habit over 70 days yields ~50
 *     applicable days, not 70 (Pitfall 1 guard)
 *   - Per-habit override: masteryThresholdOverride and masteryWindowOverride
 *     take precedence over global defaults
 *   - Log type dispatch table (LOG_COMPLETED):
 *       binary: log.completed === true
 *       numeric: log.count >= habit.target
 *       slot-checklist: all slots checked
 *   - Zero applicable days edge case
 *   - Unknown targetType falls back to false (T-04-02 threat mitigation)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMastery } from '../../js/domain/mastery.js';

// ---------------------------------------------------------------------------
// Shared ctx factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a ctx with globalThreshold/globalWindow and a simple appliesToday
 * that returns `true` for all daily habits (cadence.type === 'daily') or
 * delegates based on `days` for day-of-week-subset.
 *
 * weekCompletions always returns 0 (no weekly completions in test window).
 * monthCompletions always returns 0.
 *
 * @param {{ globalThreshold?: number, globalWindow?: number, weekStart?: string, appliesToday?: Function }} opts
 * @returns {object}
 */
function makeCtx({
  globalThreshold = 90,
  globalWindow = 70,
  weekStart = 'mon',
  appliesToday = null,
} = {}) {
  const defaultAppliesToday = (habit, date) => {
    if (!habit.cadence) return true;
    if (habit.cadence.type === 'daily') return true;
    if (habit.cadence.type === 'day-of-week-subset') {
      const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const [y, m, d] = date.split('-').map(Number);
      const dayCode = dow[new Date(y, m - 1, d).getDay()];
      return habit.cadence.days.includes(dayCode);
    }
    return true;
  };

  return {
    globalThreshold,
    globalWindow,
    weekStart,
    appliesToday: appliesToday ?? defaultAppliesToday,
    weekCompletions: () => 0,
    monthCompletions: () => 0,
  };
}

/**
 * Build a set of daily binary logs: for each date in the range [start, end]
 * (inclusive), emit a log with `completed: true` (or false).
 *
 * @param {string} habitId
 * @param {string} startYMD YYYY-MM-DD
 * @param {string} endYMD YYYY-MM-DD
 * @param {boolean} completed
 * @returns {Array<{habitId: string, date: string, completed: boolean}>}
 */
function buildDailyLogs(habitId, startYMD, endYMD, completed = true) {
  const logs = [];
  const [sy, sm, sd] = startYMD.split('-').map(Number);
  const [ey, em, ed] = endYMD.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    logs.push({ habitId, date: `${y}-${mo}-${day}`, completed });
    cur.setDate(cur.getDate() + 1);
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Grace period tests (MASTERY-06)
// ---------------------------------------------------------------------------

describe('evaluateMastery — grace period (MASTERY-06)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });

  test('habit created on evaluation day is in grace period', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt: '2026-06-04', targetType: 'binary' };
    const result = evaluateMastery(habit, [], '2026-06-04', ctx);
    assert.equal(result.isInGracePeriod, true);
    assert.equal(result.isMastered, false);
    assert.equal(result.completedCount, 0);
    assert.equal(result.applicableDayCount, 0);
    assert.equal(result.percentage, 0);
  });

  test('habit created 6 days before evaluation (day 6) is still in grace', () => {
    // daysBetween('2026-06-04', '2026-06-10') = 6 < 7 → grace
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt: '2026-06-04', targetType: 'binary' };
    const result = evaluateMastery(habit, [], '2026-06-10', ctx);
    assert.equal(result.isInGracePeriod, true);
    assert.equal(result.isMastered, false);
  });

  test('habit created 7 days before evaluation (day 7) is past grace', () => {
    // daysBetween('2026-06-04', '2026-06-11') = 7, NOT < 7 → not grace
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt: '2026-06-04', targetType: 'binary' };
    const result = evaluateMastery(habit, [], '2026-06-11', ctx);
    assert.equal(result.isInGracePeriod, false);
  });

  test('habit created 8 days before evaluation (day 8) is past grace', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt: '2026-06-04', targetType: 'binary' };
    const result = evaluateMastery(habit, [], '2026-06-12', ctx);
    assert.equal(result.isInGracePeriod, false);
  });

  test('grace period result includes threshold and windowDays fields', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt: '2026-06-04', targetType: 'binary' };
    const result = evaluateMastery(habit, [], '2026-06-04', ctx);
    assert.equal(typeof result.threshold, 'number');
    assert.equal(typeof result.windowDays, 'number');
    assert.equal(result.threshold, 90);
    assert.equal(result.windowDays, 70);
  });
});

// ---------------------------------------------------------------------------
// Cadence-aware denominator tests (MASTERY-01, MASTERY-05, Pitfall 1)
// ---------------------------------------------------------------------------

describe('evaluateMastery — cadence-aware denominator (MASTERY-01, MASTERY-05)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  // Evaluation on 2026-09-30 (day 70+ away from 2026-01-01 for daily habit)
  const evalDate = '2026-09-30';
  const windowStart = '2026-07-23'; // 70 days back: daysFrom('2026-09-30', -69) = '2026-07-23'

  test('daily habit: 70 logs in window → applicableDayCount = 70, isMastered = true', () => {
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: '2026-01-01',
      targetType: 'binary',
    };
    const logs = buildDailyLogs('h1', windowStart, evalDate, true);
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.applicableDayCount, 70);
    assert.equal(result.completedCount, 70);
    assert.equal(result.percentage, 100);
    assert.equal(result.isMastered, true);
    assert.equal(result.isInGracePeriod, false);
  });

  test('daily habit: 63/70 completed = 90% → isMastered = true (threshold is >=)', () => {
    const habit = {
      id: 'h1',
      cadence: { type: 'daily' },
      createdAt: '2026-01-01',
      targetType: 'binary',
    };
    // Build 63 completed + 7 not-completed
    const logs = buildDailyLogs('h1', windowStart, evalDate, true);
    // Replace last 7 with not-completed
    logs.slice(-7).forEach(l => { l.completed = false; });
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.applicableDayCount, 70);
    assert.equal(result.completedCount, 63);
    assert.equal(result.percentage, 90);
    assert.equal(result.isMastered, true);
  });

  test('Mon-Fri habit over 70 days: applicableDayCount is ~50 (not 70)', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      createdAt: '2026-01-01',
      targetType: 'binary',
    };
    // evalDate = 2026-09-30 (Wednesday), window = 70 days back
    const result = evaluateMastery(habit, [], evalDate, ctx);
    // 70 days contain 10 complete weeks = 50 weekdays (exact depends on alignment)
    assert.ok(result.applicableDayCount >= 49 && result.applicableDayCount <= 51,
      `Expected ~50, got ${result.applicableDayCount}`);
    assert.equal(result.isMastered, false); // 0 completions
    assert.equal(result.isInGracePeriod, false);
  });

  test('Mon-Fri habit: 45 completions / ~50 applicable → at least at 90% if counted correctly', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      createdAt: '2026-01-01',
      targetType: 'binary',
    };
    // Build weekday-only logs with completed:true
    const allLogs = [];
    const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const [sy, sm, sd] = windowStart.split('-').map(Number);
    const [ey, em, ed] = evalDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const cur = new Date(start);
    while (cur <= end) {
      const dayCode = dow[cur.getDay()];
      if (['mon', 'tue', 'wed', 'thu', 'fri'].includes(dayCode)) {
        const y = cur.getFullYear();
        const mo = String(cur.getMonth() + 1).padStart(2, '0');
        const day = String(cur.getDate()).padStart(2, '0');
        allLogs.push({ habitId: 'h2', date: `${y}-${mo}-${day}`, completed: true });
      }
      cur.setDate(cur.getDate() + 1);
    }

    // Take the first 45 as completed; rest not counted (no log = not completed)
    const logs = allLogs.slice(0, 45);
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    // applicableDayCount should be ~50 (the full weekday count in window)
    assert.ok(result.applicableDayCount >= 49 && result.applicableDayCount <= 51,
      `Expected ~50, got ${result.applicableDayCount}`);
    assert.equal(result.completedCount, 45);
    const expectedPct = Math.round((45 / result.applicableDayCount) * 100);
    assert.equal(result.percentage, expectedPct);
    // 45/50 = 90% → mastered; 45/51 = 88% → not mastered (depends on exact weekday count)
    assert.equal(result.isMastered, expectedPct >= 90);
  });

  test('Mon-Fri habit: 43 completions / ~50 applicable = ~86% → isMastered = false', () => {
    const habit = {
      id: 'h2',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
      createdAt: '2026-01-01',
      targetType: 'binary',
    };
    const allLogs = [];
    const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const [sy, sm, sd] = windowStart.split('-').map(Number);
    const [ey, em, ed] = evalDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const cur = new Date(start);
    while (cur <= end) {
      const dayCode = dow[cur.getDay()];
      if (['mon', 'tue', 'wed', 'thu', 'fri'].includes(dayCode)) {
        const y = cur.getFullYear();
        const mo = String(cur.getMonth() + 1).padStart(2, '0');
        const day = String(cur.getDate()).padStart(2, '0');
        allLogs.push({ habitId: 'h2', date: `${y}-${mo}-${day}`, completed: true });
      }
      cur.setDate(cur.getDate() + 1);
    }
    // Only 43 completions out of ~50 applicable (43/50 = 86%)
    const logs = allLogs.slice(0, 43);
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 43);
    // 43 / ~50 = ~86% which is < 90%
    assert.equal(result.isMastered, false);
  });
});

// ---------------------------------------------------------------------------
// Per-habit override tests (MASTERY-02)
// ---------------------------------------------------------------------------

describe('evaluateMastery — per-habit threshold/window override (MASTERY-02)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const evalDate = '2026-06-15';

  test('masteryThresholdOverride:80, masteryWindowOverride:30 — used instead of global', () => {
    const habit = {
      id: 'h3',
      cadence: { type: 'daily' },
      createdAt: '2026-01-01',
      targetType: 'binary',
      masteryThresholdOverride: 80,
      masteryWindowOverride: 30,
    };
    // 25 completions in 30-day window = 83% → above 80% override threshold
    // daysFrom('2026-06-15', -29) = '2026-05-17'
    const windowStart30 = '2026-05-17';
    const logs = buildDailyLogs('h3', windowStart30, evalDate, true);
    // Keep only 25 out of 30 completed
    logs.splice(25);
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.threshold, 80, 'should use per-habit threshold override (80), not global (90)');
    assert.equal(result.windowDays, 30, 'should use per-habit window override (30), not global (70)');
    assert.equal(result.applicableDayCount, 30);
    assert.equal(result.completedCount, 25);
    // 25/30 = 83% >= 80% → mastered
    assert.equal(result.isMastered, true);
  });

  test('masteryThresholdOverride:null — falls back to global threshold', () => {
    const habit = {
      id: 'h4',
      cadence: { type: 'daily' },
      createdAt: '2026-01-01',
      targetType: 'binary',
      masteryThresholdOverride: null,
      masteryWindowOverride: null,
    };
    const result = evaluateMastery(habit, [], evalDate, ctx);
    assert.equal(result.threshold, 90);
    assert.equal(result.windowDays, 70);
  });

  test('masteryThresholdOverride undefined — falls back to global threshold', () => {
    const habit = {
      id: 'h4',
      cadence: { type: 'daily' },
      createdAt: '2026-01-01',
      targetType: 'binary',
    };
    const result = evaluateMastery(habit, [], evalDate, ctx);
    assert.equal(result.threshold, 90);
    assert.equal(result.windowDays, 70);
  });

  test('override only threshold — window stays global', () => {
    const habit = {
      id: 'h5',
      cadence: { type: 'daily' },
      createdAt: '2026-01-01',
      targetType: 'binary',
      masteryThresholdOverride: 75,
      masteryWindowOverride: null,
    };
    const result = evaluateMastery(habit, [], evalDate, ctx);
    assert.equal(result.threshold, 75);
    assert.equal(result.windowDays, 70);
  });
});

// ---------------------------------------------------------------------------
// Log type dispatch (LOG_COMPLETED table) — MASTERY-07, Pitfall 5
// ---------------------------------------------------------------------------

describe('evaluateMastery — binary log type dispatch', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const createdAt = '2026-01-01';
  const evalDate = '2026-06-01';

  test('binary: log.completed === true → counts as completed', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    const logs = [{ habitId: 'h1', date: evalDate, completed: true }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });

  test('binary: log.completed === false → does NOT count as completed', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    const logs = [{ habitId: 'h1', date: evalDate, completed: false }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('binary: no log for that date → not completed (no log = no count)', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    const result = evaluateMastery(habit, [], evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });
});

describe('evaluateMastery — numeric log type dispatch (LOG-02, MASTERY-07)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const createdAt = '2026-01-01';
  const evalDate = '2026-06-01';

  test('numeric: log.count >= habit.target → counts as completed (exact target)', () => {
    const habit = {
      id: 'h2', cadence: { type: 'daily' }, createdAt,
      targetType: 'numeric', target: 7,
    };
    const logs = [{ habitId: 'h2', date: evalDate, count: 7 }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });

  test('numeric: log.count > habit.target → counts as completed (over target)', () => {
    const habit = {
      id: 'h2', cadence: { type: 'daily' }, createdAt,
      targetType: 'numeric', target: 7,
    };
    const logs = [{ habitId: 'h2', date: evalDate, count: 10 }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });

  test('numeric: log.count < habit.target → does NOT count (partial completion)', () => {
    const habit = {
      id: 'h2', cadence: { type: 'daily' }, createdAt,
      targetType: 'numeric', target: 7,
    };
    const logs = [{ habitId: 'h2', date: evalDate, count: 5 }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('numeric: log.count === 0 → does NOT count', () => {
    const habit = {
      id: 'h2', cadence: { type: 'daily' }, createdAt,
      targetType: 'numeric', target: 7,
    };
    const logs = [{ habitId: 'h2', date: evalDate, count: 0 }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('numeric: count missing/undefined treated as 0 → not completed', () => {
    const habit = {
      id: 'h2', cadence: { type: 'daily' }, createdAt,
      targetType: 'numeric', target: 7,
    };
    const logs = [{ habitId: 'h2', date: evalDate }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });
});

describe('evaluateMastery — slot-checklist log type dispatch (LOG-03, MASTERY-07)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const createdAt = '2026-01-01';
  const evalDate = '2026-06-01';

  test('slot-checklist: all slots checked → counts as completed (7/7)', () => {
    const habit = {
      id: 'h3', cadence: { type: 'daily' }, createdAt,
      targetType: 'slot-checklist',
    };
    const logs = [{
      habitId: 'h3', date: evalDate,
      slots: [
        { name: 'Slot 1', checked: true }, { name: 'Slot 2', checked: true },
        { name: 'Slot 3', checked: true }, { name: 'Slot 4', checked: true },
        { name: 'Slot 5', checked: true }, { name: 'Slot 6', checked: true },
        { name: 'Slot 7', checked: true },
      ],
    }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });

  test('slot-checklist: 2/2 slots checked → counts (all checked)', () => {
    const habit = {
      id: 'h3', cadence: { type: 'daily' }, createdAt,
      targetType: 'slot-checklist',
    };
    const logs = [{
      habitId: 'h3', date: evalDate,
      slots: [{ checked: true }, { checked: true }],
    }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });

  test('slot-checklist: 3/7 slots checked → does NOT count (partial completion)', () => {
    const habit = {
      id: 'h3', cadence: { type: 'daily' }, createdAt,
      targetType: 'slot-checklist',
    };
    const logs = [{
      habitId: 'h3', date: evalDate,
      slots: [
        { checked: true }, { checked: true }, { checked: true },
        { checked: false }, { checked: false }, { checked: false }, { checked: false },
      ],
    }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('slot-checklist: 6/7 slots checked → does NOT count (not all)', () => {
    const habit = {
      id: 'h3', cadence: { type: 'daily' }, createdAt,
      targetType: 'slot-checklist',
    };
    const logs = [{
      habitId: 'h3', date: evalDate,
      slots: [
        { checked: true }, { checked: true }, { checked: true },
        { checked: true }, { checked: true }, { checked: true }, { checked: false },
      ],
    }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('slot-checklist: empty slots array → does NOT count', () => {
    const habit = {
      id: 'h3', cadence: { type: 'daily' }, createdAt,
      targetType: 'slot-checklist',
    };
    const logs = [{ habitId: 'h3', date: evalDate, slots: [] }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('slot-checklist: missing slots field → does NOT count', () => {
    const habit = {
      id: 'h3', cadence: { type: 'daily' }, createdAt,
      targetType: 'slot-checklist',
    };
    const logs = [{ habitId: 'h3', date: evalDate }];
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });
});

// ---------------------------------------------------------------------------
// Zero applicable days edge case
// ---------------------------------------------------------------------------

describe('evaluateMastery — zero applicable days', () => {
  const createdAt = '2026-01-01';
  const evalDate = '2026-06-01';

  test('habit with cadence that never applies: applicableDayCount = 0, isMastered = false', () => {
    const neverCtx = makeCtx({
      appliesToday: () => false,
    });
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    const result = evaluateMastery(habit, [], evalDate, neverCtx);
    assert.equal(result.applicableDayCount, 0);
    assert.equal(result.completedCount, 0);
    assert.equal(result.percentage, 0);
    assert.equal(result.isMastered, false);
    assert.equal(result.isInGracePeriod, false);
  });
});

// ---------------------------------------------------------------------------
// Return shape completeness tests
// ---------------------------------------------------------------------------

describe('evaluateMastery — return shape', () => {
  const ctx = makeCtx();
  const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt: '2026-01-01', targetType: 'binary' };

  test('result has all required fields', () => {
    const result = evaluateMastery(habit, [], '2026-06-01', ctx);
    assert.ok('isMastered' in result, 'missing isMastered');
    assert.ok('isInGracePeriod' in result, 'missing isInGracePeriod');
    assert.ok('completedCount' in result, 'missing completedCount');
    assert.ok('applicableDayCount' in result, 'missing applicableDayCount');
    assert.ok('percentage' in result, 'missing percentage');
    assert.ok('threshold' in result, 'missing threshold');
    assert.ok('windowDays' in result, 'missing windowDays');
  });

  test('isMastered is boolean', () => {
    const result = evaluateMastery(habit, [], '2026-06-01', ctx);
    assert.equal(typeof result.isMastered, 'boolean');
  });

  test('isInGracePeriod is boolean', () => {
    const result = evaluateMastery(habit, [], '2026-06-01', ctx);
    assert.equal(typeof result.isInGracePeriod, 'boolean');
  });

  test('completedCount is a non-negative integer', () => {
    const result = evaluateMastery(habit, [], '2026-06-01', ctx);
    assert.equal(typeof result.completedCount, 'number');
    assert.ok(result.completedCount >= 0);
  });

  test('percentage is a non-negative integer rounded value', () => {
    const result = evaluateMastery(habit, [], '2026-06-01', ctx);
    assert.equal(typeof result.percentage, 'number');
    assert.equal(result.percentage, Math.round(result.percentage));
  });
});

// ---------------------------------------------------------------------------
// Security: unknown targetType → false (T-04-02 threat mitigation)
// ---------------------------------------------------------------------------

describe('evaluateMastery — unknown targetType fallback (T-04-02)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const createdAt = '2026-01-01';
  const evalDate = '2026-06-01';

  test('unknown targetType falls back to false (does not count, does not throw)', () => {
    const habit = {
      id: 'h99', cadence: { type: 'daily' }, createdAt,
      targetType: 'future-unknown-type',
    };
    const logs = [{ habitId: 'h99', date: evalDate, completed: true, count: 99 }];
    // Should not throw; unknown type just does not count as completed.
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });
});

// ---------------------------------------------------------------------------
// Mastery threshold boundary tests
// ---------------------------------------------------------------------------

describe('evaluateMastery — mastery threshold boundary (MASTERY-01)', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const createdAt = '2026-01-01';
  const evalDate = '2026-09-30';
  const windowStart = '2026-07-23'; // daysFrom('2026-09-30', -69)

  test('exactly 90% completions → isMastered = true (threshold is >=)', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    // 63/70 = 90%
    const logs = buildDailyLogs('h1', windowStart, evalDate, true);
    logs.splice(63);
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.percentage, 90);
    assert.equal(result.isMastered, true);
  });

  test('89% completions → isMastered = false (just below threshold)', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    // 62/70 = 88.57% → Math.round = 89
    const logs = buildDailyLogs('h1', windowStart, evalDate, true);
    logs.splice(62);
    const result = evaluateMastery(habit, logs, evalDate, ctx);
    assert.equal(result.percentage, Math.round(62 / 70 * 100));
    assert.equal(result.isMastered, false);
  });
});

// ---------------------------------------------------------------------------
// Logs outside the rolling window are excluded
// ---------------------------------------------------------------------------

describe('evaluateMastery — log date range filtering', () => {
  const ctx = makeCtx({ globalThreshold: 90, globalWindow: 70 });
  const createdAt = '2026-01-01';
  const evalDate = '2026-06-01';

  test('logs before the 70-day window are NOT counted', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    // A log 100 days before evalDate (outside 70-day window)
    const oldLog = { habitId: 'h1', date: '2026-02-21', completed: true };
    const result = evaluateMastery(habit, [oldLog], evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('logs in the future (after evalDate) are NOT counted', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    const futureLog = { habitId: 'h1', date: '2026-07-01', completed: true };
    const result = evaluateMastery(habit, [futureLog], evalDate, ctx);
    assert.equal(result.completedCount, 0);
  });

  test('log on evalDate itself is included in window', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    const todayLog = { habitId: 'h1', date: evalDate, completed: true };
    const result = evaluateMastery(habit, [todayLog], evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });

  test('log on window start date (70 days back inclusive) is included', () => {
    const habit = { id: 'h1', cadence: { type: 'daily' }, createdAt, targetType: 'binary' };
    // windowStart = daysFrom('2026-06-01', -69) = '2026-03-24'
    const windowStartLog = { habitId: 'h1', date: '2026-03-24', completed: true };
    const result = evaluateMastery(habit, [windowStartLog], evalDate, ctx);
    assert.ok(result.completedCount >= 1);
  });
});
