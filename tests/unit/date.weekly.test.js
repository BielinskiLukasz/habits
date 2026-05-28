/**
 * @file Unit tests for the four ISO-week + relative-time helpers added to
 * js/util/date.js in Phase 03 plan 01 (Task 1). Mirrors the per-fixture
 * `describe`/`test` style of tests/unit/date.test.js — concrete DST/leap-day
 * dates exercised against the local-calendar arithmetic discipline.
 *
 * Pattern S8: pure-function fixture-driven (D-26 Tier 1).
 *
 * Fixtures locked at:
 *   - 2026-05-25..2026-05-31 — a "normal" ISO week in May 2026
 *   - 2026-03-29 — Europe/Warsaw DST spring-forward Sunday (in the week 2026-03-23..29)
 *   - 2026-10-25 — DST fall-back Sunday (week 2026-10-19..25)
 *   - 2028-02-29 — leap day (not a week-boundary, but checks `daysBetween` across leap math)
 *
 * `daysBetween` MUST use `Math.round` (NOT `Math.floor`) so a 1-hour DST drift
 * around `setDate`-derived ms deltas does not silently underflow to N-1.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isoWeekStart,
  isoWeekEnd,
  daysBetween,
  formatRelative,
} from '../../js/util/date.js';

describe('isoWeekStart — weekStart "mon"', () => {
  test('2026-05-28 (Thu) rolls back 3 days to Mon 2026-05-25', () => {
    assert.equal(isoWeekStart('2026-05-28', 'mon'), '2026-05-25');
  });

  test('2026-05-25 (Mon) is the week start unchanged', () => {
    assert.equal(isoWeekStart('2026-05-25', 'mon'), '2026-05-25');
  });

  test('2026-05-31 (Sun) rolls back 6 days to Mon 2026-05-25', () => {
    assert.equal(isoWeekStart('2026-05-31', 'mon'), '2026-05-25');
  });

  test('2026-03-29 (DST spring-forward Sunday) rolls back to Mon 2026-03-23', () => {
    assert.equal(isoWeekStart('2026-03-29', 'mon'), '2026-03-23');
  });
});

describe('isoWeekStart — weekStart "sun"', () => {
  test('2026-05-28 (Thu) rolls back 4 days to Sun 2026-05-24', () => {
    assert.equal(isoWeekStart('2026-05-28', 'sun'), '2026-05-24');
  });

  test('2026-05-24 (Sun) is the week start unchanged', () => {
    assert.equal(isoWeekStart('2026-05-24', 'sun'), '2026-05-24');
  });

  test('2026-05-30 (Sat) rolls back 6 days to Sun 2026-05-24', () => {
    assert.equal(isoWeekStart('2026-05-30', 'sun'), '2026-05-24');
  });
});

describe('isoWeekEnd — weekStart "mon"', () => {
  test('week containing 2026-05-25 ends on Sun 2026-05-31', () => {
    assert.equal(isoWeekEnd('2026-05-25', 'mon'), '2026-05-31');
  });

  test('week containing 2026-05-28 ends on Sun 2026-05-31', () => {
    assert.equal(isoWeekEnd('2026-05-28', 'mon'), '2026-05-31');
  });

  test('DST spring-forward week (containing 2026-03-23) ends on Sun 2026-03-29', () => {
    assert.equal(isoWeekEnd('2026-03-23', 'mon'), '2026-03-29');
  });
});

describe('isoWeekEnd — weekStart "sun"', () => {
  test('week containing 2026-05-24 ends on Sat 2026-05-30', () => {
    assert.equal(isoWeekEnd('2026-05-24', 'sun'), '2026-05-30');
  });
});

describe('daysBetween — same calendar month', () => {
  test('2026-05-25 → 2026-05-28 returns 3', () => {
    assert.equal(daysBetween('2026-05-25', '2026-05-28'), 3);
  });

  test('reverse direction 2026-05-28 → 2026-05-25 returns -3', () => {
    assert.equal(daysBetween('2026-05-28', '2026-05-25'), -3);
  });

  test('same day returns 0', () => {
    assert.equal(daysBetween('2026-05-28', '2026-05-28'), 0);
  });
});

describe('daysBetween — DST spring-forward (uses Math.round, NOT floor)', () => {
  test('2026-03-28 → 2026-03-30 across DST returns 2 (not 1)', () => {
    // If daysBetween used Math.floor, the 1-hour DST gain would make this
    // round to 1.95… → floor = 1, which silently corrupts every-n-days math.
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  });
});

describe('daysBetween — DST fall-back', () => {
  test('2026-10-24 → 2026-10-26 across DST returns 2', () => {
    assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  });
});

describe('daysBetween — leap day', () => {
  test('2028-02-28 → 2028-03-01 returns 2', () => {
    assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);
  });
});

describe('formatRelative — under 1 minute', () => {
  test('30 seconds ago returns "just now"', () => {
    const now = Date.parse('2026-05-28T12:00:00.000Z');
    const at = new Date(now - 30_000).toISOString();
    assert.equal(formatRelative(at, now), 'just now');
  });
});

describe('formatRelative — minutes', () => {
  test('120_000 ms (2 minutes) ago returns "2 minutes ago"', () => {
    const now = Date.parse('2026-05-28T12:00:00.000Z');
    const at = new Date(now - 120_000).toISOString();
    assert.equal(formatRelative(at, now), '2 minutes ago');
  });
});

describe('formatRelative — hours', () => {
  test('7_200_000 ms (2 hours) ago returns "2 hours ago"', () => {
    const now = Date.parse('2026-05-28T12:00:00.000Z');
    const at = new Date(now - 7_200_000).toISOString();
    assert.equal(formatRelative(at, now), '2 hours ago');
  });
});

describe('formatRelative — days', () => {
  test('172_800_000 ms (2 days) ago returns "2 days ago"', () => {
    const now = Date.parse('2026-05-28T12:00:00.000Z');
    const at = new Date(now - 172_800_000).toISOString();
    assert.equal(formatRelative(at, now), '2 days ago');
  });
});

describe('formatRelative — accepts ISO timestamp string input', () => {
  test('explicit ISO string for `at` argument works (no Date instance required)', () => {
    const now = Date.parse('2026-05-28T10:01:00.000Z');
    assert.equal(formatRelative('2026-05-28T10:00:00.000Z', now), '1 minutes ago');
  });
});
