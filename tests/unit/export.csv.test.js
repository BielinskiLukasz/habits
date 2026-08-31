/**
 * @file Unit tests for js/io/export.js — CSV cell encoding logic (EXPORT-03, EXPORT-06).
 *
 * Tests cover:
 *   - csvCellValue: binary, numeric, slot-checklist log shapes
 *   - csvCellValue: cadence exclusion via appliesToday
 *   - csvCellValue: future-scheduled habits (startDate guard)
 *   - csvCellValue: archived habits (status check)
 *   - escapeCSVField: semicolon, double-quote, newline, carriage return, leading/trailing whitespace
 *
 * Pattern: D-26 Tier 1 — pure function tests, no DOM, no IDB.
 * Framework: node --test (D-23).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { csvCellValue, escapeCSVField } from '../../js/io/export.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal binary habit fixture.
 * @param {object} [overrides]
 * @returns {object}
 */
function binaryHabit(overrides = {}) {
  return {
    id: 'h1',
    name: 'Morning walk',
    cadence: { type: 'daily' },
    targetType: 'binary',
    status: 'active',
    ...overrides,
  };
}

/**
 * Build a minimal numeric habit fixture.
 * @param {object} [overrides]
 * @returns {object}
 */
function numericHabit(overrides = {}) {
  return {
    id: 'h2',
    name: 'Water cups',
    cadence: { type: 'daily' },
    targetType: 'numeric',
    target: 7,
    status: 'active',
    ...overrides,
  };
}

/**
 * Build a minimal slot-checklist habit fixture.
 * @param {object} [overrides]
 * @returns {object}
 */
function slotHabit(overrides = {}) {
  return {
    id: 'h3',
    name: 'Meals',
    cadence: { type: 'daily' },
    targetType: 'slot-checklist',
    target: 7,
    status: 'active',
    ...overrides,
  };
}

/**
 * Build a cadence context that reads completions from an in-memory logs array.
 *
 * @param {Array<{habitId: string, date: string, completed: boolean|number}>} logs
 * @param {string} [weekStart]
 * @returns {{ weekStart: string, weekCompletions: Function, monthCompletions: Function }}
 */
function makeCtx(logs = [], weekStart = 'mon') {
  return {
    weekStart,
    weekCompletions: (habitId, start, end) => {
      return logs.filter(
        l => l.habitId === habitId && l.date >= start && l.date <= end && l.status === 'completed'
      ).length;
    },
    monthCompletions: (habitId, start, end) => {
      return logs.filter(
        l => l.habitId === habitId && l.date >= start && l.date <= end && l.status === 'completed'
      ).length;
    },
  };
}

// ---------------------------------------------------------------------------
// Test 1: Binary habit, applicable today, no log → cell value is '0'
// ---------------------------------------------------------------------------
describe('csvCellValue — binary habit, applicable, no log', () => {
  test('returns "0" when no log exists for applicable binary habit', () => {
    const habit = binaryHabit();
    const date = '2026-06-06';
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });
});

// ---------------------------------------------------------------------------
// Test 2: Binary habit, applicable today, completed log → cell value is '1'
// ---------------------------------------------------------------------------
describe('csvCellValue — binary habit, applicable, completed', () => {
  test('returns "1" when binary habit has status:completed log', () => {
    const habit = binaryHabit();
    const date = '2026-06-06';
    const logs = [{ habitId: 'h1', date: '2026-06-06', status: 'completed' }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '1');
  });

  test('returns "0" when binary habit has status:failed log', () => {
    const habit = binaryHabit();
    const date = '2026-06-06';
    const logs = [{ habitId: 'h1', date: '2026-06-06', status: 'failed' }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });
});

// ---------------------------------------------------------------------------
// Test 2b: Binary habit, applicable, status:skipped → cell value is 'x'
// ---------------------------------------------------------------------------
describe('csvCellValue — binary habit, applicable, skipped', () => {
  test('returns "x" when binary habit has status:skipped log', () => {
    const habit = binaryHabit();
    const date = '2026-06-06';
    const logs = [{ habitId: 'h1', date: '2026-06-06', status: 'skipped' }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Binary habit, not applicable (cadence exclusion) → cell value is 'x'
// ---------------------------------------------------------------------------
describe('csvCellValue — cadence exclusion', () => {
  test('returns "x" when habit cadence excludes the day (day-of-week-subset)', () => {
    // Mon-only habit, tested on Tuesday 2026-06-02
    const habit = binaryHabit({
      cadence: { type: 'day-of-week-subset', days: ['mon'] },
    });
    const date = '2026-06-02'; // Tuesday
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
  });

  test('returns "x" when weekly habit was already completed this week', () => {
    const habit = binaryHabit({
      id: 'h-weekly',
      cadence: { type: 'weekly' },
    });
    const date = '2026-06-04'; // Thursday — same week as Mon 2026-06-01
    // Prior completion on Monday of the same week
    const logs = [{ habitId: 'h-weekly', date: '2026-06-01', status: 'completed' }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Binary habit, future startDate (not yet started) → cell value is 'x'
// ---------------------------------------------------------------------------
describe('csvCellValue — future-scheduled habit', () => {
  test('returns "x" when habit startDate is after the requested date', () => {
    const habit = binaryHabit({ startDate: '2026-07-01' });
    const date = '2026-06-06';
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
  });

  test('returns "0" (applicable) when habit startDate equals the requested date', () => {
    const habit = binaryHabit({ startDate: '2026-06-06' });
    const date = '2026-06-06';
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });

  test('returns "0" (applicable) when habit startDate is in the past', () => {
    const habit = binaryHabit({ startDate: '2026-01-01' });
    const date = '2026-06-06';
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });
});

// ---------------------------------------------------------------------------
// Test 5: Numeric habit, applicable, count=5 target=7 → cell value is '5'
// ---------------------------------------------------------------------------
describe('csvCellValue — numeric habit (multi-occurrence, EXPORT-06)', () => {
  test('returns numeric count string when log.count=5, target=7', () => {
    const habit = numericHabit();
    const date = '2026-06-06';
    const logs = [{ habitId: 'h2', date: '2026-06-06', count: 5 }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '5');
  });

  test('returns "7" when count equals target (fully complete)', () => {
    const habit = numericHabit();
    const date = '2026-06-06';
    const logs = [{ habitId: 'h2', date: '2026-06-06', count: 7 }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '7');
  });

  test('returns "0" when no log exists for numeric habit (applicable)', () => {
    const habit = numericHabit();
    const date = '2026-06-06';
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });

  test('partial count 3 is NOT output as "1" (Pitfall 2 — multi-occurrence encoding)', () => {
    const habit = numericHabit();
    const date = '2026-06-06';
    const logs = [{ habitId: 'h2', date: '2026-06-06', count: 3 }];
    const ctx = makeCtx(logs);
    const cell = csvCellValue(habit, date, logs, ctx);
    assert.notEqual(cell, '1', 'Partial count must not be encoded as "1"');
    assert.equal(cell, '3');
  });
});

// ---------------------------------------------------------------------------
// Test 6: Slot-checklist habit, applicable, checked=3/7 → cell value is '3'
// ---------------------------------------------------------------------------
describe('csvCellValue — slot-checklist habit (multi-occurrence, EXPORT-06)', () => {
  test('returns count of checked slots when 3/7 slots are checked', () => {
    const habit = slotHabit();
    const date = '2026-06-06';
    const slots = [
      { name: 'Meal 1', checked: true },
      { name: 'Meal 2', checked: true },
      { name: 'Meal 3', checked: true },
      { name: 'Meal 4', checked: false },
      { name: 'Meal 5', checked: false },
      { name: 'Meal 6', checked: false },
      { name: 'Meal 7', checked: false },
    ];
    const logs = [{ habitId: 'h3', date: '2026-06-06', slots }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '3');
  });

  test('returns "7" when all 7 slots are checked (fully complete)', () => {
    const habit = slotHabit();
    const date = '2026-06-06';
    const slots = Array.from({ length: 7 }, (_, i) => ({ name: `Meal ${i + 1}`, checked: true }));
    const logs = [{ habitId: 'h3', date: '2026-06-06', slots }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '7');
  });

  test('returns "0" when all slots are unchecked', () => {
    const habit = slotHabit();
    const date = '2026-06-06';
    const slots = Array.from({ length: 7 }, (_, i) => ({ name: `Meal ${i + 1}`, checked: false }));
    const logs = [{ habitId: 'h3', date: '2026-06-06', slots }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });
});

// ---------------------------------------------------------------------------
// Test 7: Habit applicable but no log today → cell value is '0'
// ---------------------------------------------------------------------------
describe('csvCellValue — applicable with no log', () => {
  test('returns "0" for daily binary habit with no log on given date', () => {
    const habit = binaryHabit();
    const date = '2026-06-06';
    // Logs exist on OTHER dates but not this one
    const logs = [
      { habitId: 'h1', date: '2026-06-05', status: 'completed' },
      { habitId: 'h1', date: '2026-06-04', status: 'completed' },
    ];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });
});

// ---------------------------------------------------------------------------
// Test 8: CSV field "Morning; walk" → escaped as '"Morning; walk"'
// ---------------------------------------------------------------------------
describe('escapeCSVField — semicolon triggers quoting', () => {
  test('field with semicolon is quoted', () => {
    assert.equal(escapeCSVField('Morning; walk'), '"Morning; walk"');
  });

  test('field without special characters is returned as-is', () => {
    assert.equal(escapeCSVField('Morning walk'), 'Morning walk');
  });
});

// ---------------------------------------------------------------------------
// Test 9: CSV field with newline → escaped and quoted
// ---------------------------------------------------------------------------
describe('escapeCSVField — newline triggers quoting', () => {
  test('field with LF newline is quoted', () => {
    assert.equal(escapeCSVField('line1\nline2'), '"line1\nline2"');
  });

  test('field with CR newline is quoted', () => {
    assert.equal(escapeCSVField('line1\rline2'), '"line1\rline2"');
  });

  test('field with CRLF is quoted', () => {
    assert.equal(escapeCSVField('line1\r\nline2'), '"line1\r\nline2"');
  });
});

// ---------------------------------------------------------------------------
// Test 10: CSV field with leading/trailing space → quoted
// ---------------------------------------------------------------------------
describe('escapeCSVField — leading/trailing whitespace triggers quoting', () => {
  test('field with leading space is quoted', () => {
    assert.equal(escapeCSVField(' leading'), '" leading"');
  });

  test('field with trailing space is quoted', () => {
    assert.equal(escapeCSVField('trailing '), '"trailing "');
  });

  test('field with both leading and trailing space is quoted', () => {
    assert.equal(escapeCSVField(' both '), '" both "');
  });

  test('field with double-quote is escaped as "" and quoted', () => {
    assert.equal(escapeCSVField('say "hello"'), '"say ""hello"""');
  });
});

// ---------------------------------------------------------------------------
// Test 11: Archived habit → cell value is 'x' (Pitfall 1 — archived status)
// ---------------------------------------------------------------------------
describe('csvCellValue — archived habit', () => {
  test('returns "x" for archived habit regardless of date', () => {
    const habit = binaryHabit({ status: 'archived' });
    const date = '2026-06-06';
    const logs = [{ habitId: 'h1', date: '2026-06-06', completed: true }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
  });

  test('returns "x" for archived habit even when it would normally be applicable', () => {
    const habit = binaryHabit({
      status: 'archived',
      cadence: { type: 'daily' },
    });
    const date = '2026-06-05';
    const logs = [];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), 'x');
  });
});

// ---------------------------------------------------------------------------
// Bonus: Correct log isolation (only matching habitId and date)
// ---------------------------------------------------------------------------
describe('csvCellValue — log isolation by habitId and date', () => {
  test('ignores logs from other habits', () => {
    const habit = binaryHabit({ id: 'h1' });
    const date = '2026-06-06';
    // Another habit's log on the same date
    const logs = [{ habitId: 'h999', date: '2026-06-06', completed: true }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });

  test('ignores logs from the same habit on different dates', () => {
    const habit = binaryHabit({ id: 'h1' });
    const date = '2026-06-06';
    // Same habit's log on a different date
    const logs = [{ habitId: 'h1', date: '2026-06-05', completed: true }];
    const ctx = makeCtx(logs);
    assert.equal(csvCellValue(habit, date, logs, ctx), '0');
  });
});
