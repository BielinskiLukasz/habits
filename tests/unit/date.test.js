/**
 * @file Unit tests for js/util/date.js (DATA-06, Pitfall 4).
 *
 * Fixtures locked at three concrete dates per RESEARCH §Pitfall 4:
 *   - 2026-03-29 — Europe/Warsaw DST spring-forward (02:00 → 03:00)
 *   - 2026-10-25 — Europe/Warsaw DST fall-back (03:00 → 02:00)
 *   - 2028-02-29 — leap day
 *
 * The fixtures are intentionally written in plain `new Date(y, m-1, d)` form
 * so they evaluate in the runner's LOCAL timezone — same regime the real
 * `todayLocal()` runs in on the user's browser.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayLocal,
  formatLocalYMD,
  parseLocalYMD,
  daysFrom,
  daysBetween,
  isInGracePeriod,
  getMonthStart,
  getMonthEnd,
} from '../../js/util/date.js';

describe('todayLocal', () => {
  test('returns a string matching YYYY-MM-DD', () => {
    const out = todayLocal();
    assert.equal(typeof out, 'string');
    assert.match(out, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatLocalYMD', () => {
  test('formats DST spring-forward day 2026-03-29 (month 1-indexed in output)', () => {
    // new Date(2026, 2, 29) — month=2 is March (0-indexed). Output is 1-indexed: '2026-03-29'.
    assert.equal(formatLocalYMD(new Date(2026, 2, 29)), '2026-03-29');
  });

  test('formats DST fall-back day 2026-10-25', () => {
    assert.equal(formatLocalYMD(new Date(2026, 9, 25)), '2026-10-25');
  });

  test('formats leap day 2028-02-29', () => {
    assert.equal(formatLocalYMD(new Date(2028, 1, 29)), '2028-02-29');
  });
});

describe('parseLocalYMD', () => {
  test('parses 2026-03-29 with month 0-indexed internally (Date.getMonth === 2)', () => {
    const d = parseLocalYMD('2026-03-29');
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 29);
  });

  test('parses leap day 2028-02-29 with getMonth === 1', () => {
    const d = parseLocalYMD('2028-02-29');
    assert.equal(d.getMonth(), 1);
    assert.equal(d.getDate(), 29);
  });
});

describe('daysFrom — DST spring-forward (Europe/Warsaw 2026-03-29)', () => {
  test('2026-03-28 + 1 day === 2026-03-29 (DST jump does not skip a day)', () => {
    assert.equal(daysFrom('2026-03-28', 1), '2026-03-29');
  });

  test('2026-03-29 + 1 day === 2026-03-30', () => {
    assert.equal(daysFrom('2026-03-29', 1), '2026-03-30');
  });
});

describe('daysFrom — DST fall-back (Europe/Warsaw 2026-10-25)', () => {
  test('2026-10-24 + 1 day === 2026-10-25', () => {
    assert.equal(daysFrom('2026-10-24', 1), '2026-10-25');
  });

  test('2026-10-25 + 1 day === 2026-10-26', () => {
    assert.equal(daysFrom('2026-10-25', 1), '2026-10-26');
  });
});

describe('daysFrom — leap day 2028-02-29', () => {
  test('2028-02-28 + 1 day === 2028-02-29', () => {
    assert.equal(daysFrom('2028-02-28', 1), '2028-02-29');
  });

  test('2028-02-29 + 1 day === 2028-03-01', () => {
    assert.equal(daysFrom('2028-02-29', 1), '2028-03-01');
  });

  test('2028-03-01 - 1 day === 2028-02-29', () => {
    assert.equal(daysFrom('2028-03-01', -1), '2028-02-29');
  });
});

describe('round-trip parseLocalYMD ∘ formatLocalYMD', () => {
  test('2026-05-26 round-trips identically', () => {
    assert.equal(formatLocalYMD(parseLocalYMD('2026-05-26')), '2026-05-26');
  });
});

describe('daysBetween', () => {
  test('same day returns 0', () => {
    assert.equal(daysBetween('2026-06-04', '2026-06-04'), 0);
  });

  test('1 day forward returns 1', () => {
    assert.equal(daysBetween('2026-06-04', '2026-06-05'), 1);
  });

  test('1 day backward returns -1', () => {
    assert.equal(daysBetween('2026-06-05', '2026-06-04'), -1);
  });

  test('DST spring-forward (2026-03-28 to 2026-03-30) crosses DST jump, returns 2 (not 1)', () => {
    // 2026-03-29 02:00 → 03:00 loses an hour. daysBetween uses Math.round to avoid truncation.
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  });

  test('DST fall-back (2026-10-24 to 2026-10-26) crosses DST repeat, returns 2 (not 1)', () => {
    // 2026-10-25 03:00 → 02:00 gains an hour. Math.round avoids truncation.
    assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  });
});

describe('isInGracePeriod', () => {
  test('same day (day 0) is in grace period', () => {
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-04', 7), true);
  });

  test('day 6 (within 7-day grace) is in grace period', () => {
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-10', 7), true);
  });

  test('day 7 (on grace boundary, grace STRICTLY less than graceDays) is NOT in grace period', () => {
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-11', 7), false);
  });

  test('day 8 is not in grace period', () => {
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-12', 7), false);
  });

  test('default graceDays is 7', () => {
    // If graceDays defaults to 7, then day 6 from createdAt should be true.
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-10'), true);
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-11'), false);
  });

  test('custom graceDays=3 works correctly', () => {
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-06', 3), true); // day 2
    assert.equal(isInGracePeriod('2026-06-04', '2026-06-07', 3), false); // day 3
  });
});

describe('getMonthStart', () => {
  test('2026-03-15 returns 2026-03-01', () => {
    assert.equal(getMonthStart('2026-03-15'), '2026-03-01');
  });

  test('2026-03-01 returns 2026-03-01 (already at start)', () => {
    assert.equal(getMonthStart('2026-03-01'), '2026-03-01');
  });

  test('2026-01-31 returns 2026-01-01', () => {
    assert.equal(getMonthStart('2026-01-31'), '2026-01-01');
  });

  test('leap day 2028-02-29 returns 2028-02-01', () => {
    assert.equal(getMonthStart('2028-02-29'), '2028-02-01');
  });
});

describe('getMonthEnd', () => {
  test('2026-02-15 returns 2026-02-28 (non-leap year)', () => {
    assert.equal(getMonthEnd('2026-02-15'), '2026-02-28');
  });

  test('2028-02-15 returns 2028-02-29 (leap year)', () => {
    assert.equal(getMonthEnd('2028-02-15'), '2028-02-29');
  });

  test('2026-01-15 returns 2026-01-31', () => {
    assert.equal(getMonthEnd('2026-01-15'), '2026-01-31');
  });

  test('2026-12-01 returns 2026-12-31', () => {
    assert.equal(getMonthEnd('2026-12-01'), '2026-12-31');
  });

  test('2026-04-15 returns 2026-04-30', () => {
    assert.equal(getMonthEnd('2026-04-15'), '2026-04-30');
  });
});
