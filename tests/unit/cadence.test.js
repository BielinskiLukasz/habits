/**
 * @file Unit tests for js/domain/cadence.js (D-48..D-52).
 *
 * Pure-resolver coverage for the four cadence types in seed/habits.json:
 *   - daily (D-48)
 *   - weekly (D-49 log-aware via ctx.weekCompletions)
 *   - every-n-days (D-50 anchor on habit.lastCompletedDate, fallback createdAt)
 *   - day-of-week-subset
 *
 * Pattern S8 (D-26 Tier 1) — per-fixture describe/test, concrete DST + leap-day dates.
 *
 * Plus a discipline assertion that cadence.js dispatches via a RESOLVERS table
 * (Anti-Pattern 4 extended: no `switch (habit.cadence.type)`).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { appliesToday } from '../../js/domain/cadence.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Helper: a ctx that always reports zero completions (most tests don't
// exercise the log-aware branches).
const zeroCtx = (weekStart = 'mon') => ({
  weekStart,
  weekCompletions: () => 0,
  monthCompletions: () => 0,
});

describe('appliesToday — daily', () => {
  test('returns true regardless of date', () => {
    const habit = { id: 'h', cadence: { type: 'daily' } };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), true);
  });

  test('daily ignores ctx entirely (no calls to weekCompletions)', () => {
    let calls = 0;
    const ctx = {
      weekStart: 'mon',
      weekCompletions: () => { calls++; return 0; },
    };
    const habit = { id: 'h', cadence: { type: 'daily' } };
    appliesToday(habit, '2026-05-28', ctx);
    assert.equal(calls, 0);
  });

  test('daily on DST spring-forward (2026-03-29) returns true', () => {
    const habit = { id: 'h', cadence: { type: 'daily' } };
    assert.equal(appliesToday(habit, '2026-03-29', zeroCtx()), true);
  });
});

describe('appliesToday — weekly (D-49 log-aware)', () => {
  test('returns true when weekCompletions returns 0', () => {
    const habit = { id: 'h', cadence: { type: 'weekly' } };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx('mon')), true);
  });

  test('returns false when weekCompletions >= 1', () => {
    const habit = { id: 'h', cadence: { type: 'weekly' } };
    const ctx = { weekStart: 'mon', weekCompletions: () => 1 };
    assert.equal(appliesToday(habit, '2026-05-28', ctx), false);
  });

  test('returns false when weekCompletions returns 5 (any positive count)', () => {
    const habit = { id: 'h', cadence: { type: 'weekly' } };
    const ctx = { weekStart: 'mon', weekCompletions: () => 5 };
    assert.equal(appliesToday(habit, '2026-05-28', ctx), false);
  });

  test('weekStart "mon" passes Mon..Sun week boundaries for 2026-05-28', () => {
    /** @type {Array<[string, string, string]>} */
    const calls = [];
    const ctx = {
      weekStart: 'mon',
      weekCompletions: (hid, start, end) => {
        calls.push([hid, start, end]);
        return 0;
      },
    };
    const habit = { id: 'h-weekly', cadence: { type: 'weekly' } };
    appliesToday(habit, '2026-05-28', ctx);
    assert.deepEqual(calls, [['h-weekly', '2026-05-25', '2026-05-31']]);
  });

  test('weekStart "sun" passes Sun..Sat week boundaries for 2026-05-28', () => {
    /** @type {Array<[string, string, string]>} */
    const calls = [];
    const ctx = {
      weekStart: 'sun',
      weekCompletions: (hid, start, end) => {
        calls.push([hid, start, end]);
        return 0;
      },
    };
    const habit = { id: 'h-weekly', cadence: { type: 'weekly' } };
    appliesToday(habit, '2026-05-28', ctx);
    assert.deepEqual(calls, [['h-weekly', '2026-05-24', '2026-05-30']]);
  });
});

describe('appliesToday — every-n-days (D-50)', () => {
  test('n=2 with lastCompletedDate two days ago returns true', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'every-n-days', n: 2 },
      lastCompletedDate: '2026-05-26',
      createdAt: '2026-05-01',
    };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), true);
  });

  test('n=2 with lastCompletedDate one day ago returns false', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'every-n-days', n: 2 },
      lastCompletedDate: '2026-05-27',
      createdAt: '2026-05-01',
    };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), false);
  });

  test('n=2 with null lastCompletedDate + createdAt 8 days ago returns true (fallback)', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'every-n-days', n: 2 },
      lastCompletedDate: null,
      createdAt: '2026-05-20',
    };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), true);
  });

  test('n=2 with null lastCompletedDate + createdAt 1 day ago returns false (fallback)', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'every-n-days', n: 2 },
      lastCompletedDate: null,
      createdAt: '2026-05-27',
    };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), false);
  });

  test('returns true when both lastCompletedDate AND createdAt are absent (safe default)', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'every-n-days', n: 2 },
    };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), true);
  });
});

describe('appliesToday — day-of-week-subset', () => {
  test('Mon/Wed/Fri on Mon 2026-05-25 returns true', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
    };
    assert.equal(appliesToday(habit, '2026-05-25', zeroCtx()), true);
  });

  test('Mon/Wed/Fri on Tue 2026-05-26 returns false', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
    };
    assert.equal(appliesToday(habit, '2026-05-26', zeroCtx()), false);
  });

  test('Mon/Wed/Fri on Wed 2026-05-27 returns true', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
    };
    assert.equal(appliesToday(habit, '2026-05-27', zeroCtx()), true);
  });

  test('Mon/Wed/Fri on Fri 2026-05-29 returns true', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
    };
    assert.equal(appliesToday(habit, '2026-05-29', zeroCtx()), true);
  });

  test('Mon/Wed/Fri on Sun 2026-05-31 returns false', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
    };
    assert.equal(appliesToday(habit, '2026-05-31', zeroCtx()), false);
  });
});

describe('appliesToday — DST + leap-day fixtures', () => {
  test('leap day 2028-02-29 is a Tuesday — day-of-week-subset ["tue"] returns true', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['tue'] },
    };
    assert.equal(appliesToday(habit, '2028-02-29', zeroCtx()), true);
  });

  test('DST fall-back 2026-10-25 is a Sunday — day-of-week-subset ["sun"] returns true', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'day-of-week-subset', days: ['sun'] },
    };
    assert.equal(appliesToday(habit, '2026-10-25', zeroCtx()), true);
  });
});

describe('appliesToday — monthly (D-48 extended CADENCE-03)', () => {
  test('returns true when monthCompletions returns 0 (not yet completed this month)', () => {
    const habit = { id: 'h', cadence: { type: 'monthly' } };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), true);
  });

  test('returns false when monthCompletions >= 1 (already completed this month)', () => {
    const habit = { id: 'h', cadence: { type: 'monthly' } };
    const ctx = { weekStart: 'mon', weekCompletions: () => 0, monthCompletions: () => 1 };
    assert.equal(appliesToday(habit, '2026-05-28', ctx), false);
  });

  test('returns false when monthCompletions returns 5 (any positive count)', () => {
    const habit = { id: 'h', cadence: { type: 'monthly' } };
    const ctx = { weekStart: 'mon', weekCompletions: () => 0, monthCompletions: () => 5 };
    assert.equal(appliesToday(habit, '2026-05-28', ctx), false);
  });

  test('monthCompletions is called with (habitId, monthStart, monthEnd) for current month', () => {
    /** @type {Array<[string, string, string]>} */
    const calls = [];
    const ctx = {
      weekStart: 'mon',
      weekCompletions: () => 0,
      monthCompletions: (hid, start, end) => {
        calls.push([hid, start, end]);
        return 0;
      },
    };
    const habit = { id: 'h-monthly', cadence: { type: 'monthly' } };
    appliesToday(habit, '2026-05-28', ctx);
    // May 2026: start should be 2026-05-01, end should be 2026-05-31
    assert.deepEqual(calls, [['h-monthly', '2026-05-01', '2026-05-31']]);
  });

  test('monthly on DST spring-forward (2026-03-29) returns true with zero completions', () => {
    const habit = { id: 'h', cadence: { type: 'monthly' } };
    assert.equal(appliesToday(habit, '2026-03-29', zeroCtx()), true);
  });

  test('monthly on leap day 2028-02-29 calls monthCompletions with 2028-02-01 to 2028-02-29', () => {
    /** @type {Array<[string, string, string]>} */
    const calls = [];
    const ctx = {
      weekStart: 'mon',
      weekCompletions: () => 0,
      monthCompletions: (hid, start, end) => {
        calls.push([hid, start, end]);
        return 0;
      },
    };
    const habit = { id: 'h', cadence: { type: 'monthly' } };
    appliesToday(habit, '2028-02-29', ctx);
    assert.deepEqual(calls, [['h', '2028-02-01', '2028-02-29']]);
  });
});

describe('appliesToday — startDate guard (CATALOG-07 future-scheduled habits)', () => {
  test('returns false when startDate is in the future', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'daily' },
      startDate: '2026-07-01',
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), false);
  });

  test('returns true when startDate equals today (habit starts today)', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'daily' },
      startDate: '2026-06-15',
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), true);
  });

  test('returns true when startDate is in the past', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'daily' },
      startDate: '2026-06-10',
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), true);
  });

  test('returns true when startDate is undefined (habit has no future start)', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'daily' },
      startDate: undefined,
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), true);
  });

  test('returns true when startDate is null (habit has no future start)', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'daily' },
      startDate: null,
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), true);
  });

  test('startDate guard works with weekly cadence — returns false if startDate is future', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'weekly' },
      startDate: '2026-07-15',
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), false);
  });

  test('startDate guard works with every-n-days — returns false if startDate is future', () => {
    const habit = {
      id: 'h',
      cadence: { type: 'every-n-days', n: 3 },
      lastCompletedDate: null,
      createdAt: '2026-05-01',
      startDate: '2026-07-01',
    };
    assert.equal(appliesToday(habit, '2026-06-15', zeroCtx()), false);
  });

  test('startDate guard runs BEFORE resolver dispatch (short-circuits)', () => {
    // This test verifies that if startDate is future, the resolver is not called.
    let resolverCalls = 0;
    const ctx = {
      weekStart: 'mon',
      weekCompletions: () => { resolverCalls++; return 0; },
      monthCompletions: () => 0,
    };
    const habit = {
      id: 'h',
      cadence: { type: 'weekly' },
      startDate: '2026-07-15',
    };
    appliesToday(habit, '2026-06-15', ctx);
    // The resolver should NOT be called because startDate > today returns false immediately.
    assert.equal(resolverCalls, 0);
  });
});

describe('appliesToday — unknown cadence type', () => {
  test('throws Error "cadence: unknown type X"', () => {
    const habit = { id: 'h', cadence: { type: 'unknown' } };
    assert.throws(
      () => appliesToday(habit, '2026-05-28', zeroCtx()),
      /cadence: unknown type unknown/,
    );
  });
});

describe('discipline: cadence.js dispatches via RESOLVERS (Anti-Pattern 4)', () => {
  test('contains literal `RESOLVERS` and contains NO `switch (` statement', () => {
    const src = readFileSync(`${ROOT}js/domain/cadence.js`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.ok(src.includes('RESOLVERS'), '`RESOLVERS` table must be present');
    assert.equal(
      src.match(/\bswitch\s*\(/),
      null,
      '`switch (` is forbidden in cadence.js (Anti-Pattern 4 — no god switch)',
    );
  });
});
