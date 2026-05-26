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
