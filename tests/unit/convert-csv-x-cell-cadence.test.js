/**
 * @file Regression test for the s1-score-wrong-zakupy-piekarni bug
 * (.planning/debug/resolved/s1-score-wrong-zakupy-piekarni.md).
 *
 * `data/convert-csv-to-import-2026-09-18.mjs` (one-off, gitignored personal
 * data-migration script) mapped every CSV 'x'/'n' cell ("not applicable" per
 * the source spreadsheet) to "no log row", unconditionally — even when the
 * target habit's own cadence (js/domain/cadence.js appliesToday()) would
 * otherwise call that day applicable. For a 'daily'-cadence habit with a
 * real-world exception the cadence model can't express (e.g. "Zakupy w
 * piekarni" / Bakery shopping, closed on Sundays), this left those days with
 * NO log at all, so js/domain/scoring.js computeS1() counted them as
 * applicable-but-not-completed — inflating the denominator and deflating the
 * displayed score (94-95% expected, 73% shown).
 *
 * `resolveNotApplicableCell(habit, date, cadenceCtx)` is the extracted
 * decision point: it must return `'skipped'` (so the importer emits an
 * explicit status:'skipped' log — the app's own "user consciously opted out,
 * exclude from every scoring denominator" mechanism) whenever appliesToday()
 * would otherwise call the day applicable, and `null` (no row — the cadence
 * itself already excludes the day, existing correct behaviour) otherwise.
 *
 * This file imports the converter script purely for its named export;
 * `isMain` guards all file I/O and CSV-processing side effects behind a
 * `process.argv[1] === fileURLToPath(import.meta.url)` check, so importing
 * it here triggers zero disk reads.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNotApplicableCell } from '../../data/convert-csv-to-import-2026-09-18.mjs';

// Helper: a ctx that always reports zero completions (no habit in these
// fixtures needs log-aware weekly/monthly resolution).
const zeroCtx = (weekStart = 'mon') => ({
  weekStart,
  weekCompletions: () => 0,
  monthCompletions: () => 0,
});

describe('resolveNotApplicableCell', () => {
  test('x-cell for a daily-cadence habit becomes a skipped log', () => {
    // "Zakupy w piekarni" (Bakery shopping): cadence is 'daily', so
    // appliesToday() has no way to express "bakery closed on Sundays" — the
    // importer must therefore emit an explicit skipped log for the CSV's 'x'
    // cell instead of silently dropping the row (which counts as a missed
    // day in every scoring model's denominator).
    const habit = { id: 'h1', cadence: { type: 'daily' }, startDate: '2025-12-29' };

    // 2026-07-12 is a Sunday — a real 'x' cell from data/Nawyki v2.csv.
    assert.equal(resolveNotApplicableCell(habit, '2026-07-12', zeroCtx()), 'skipped');
  });

  test('x-cell already excluded by cadence produces no row', () => {
    // A Mon/Wed/Fri habit's 'x' cell on a Tuesday is already excluded by
    // appliesToday() itself — writing a skipped log would be redundant
    // bookkeeping, so the importer must still emit no row for this case.
    const habit = {
      id: 'h2',
      cadence: { type: 'day-of-week-subset', days: ['mon', 'wed', 'fri'] },
      startDate: '2025-12-29',
    };

    // 2026-07-14 is a Tuesday.
    assert.equal(resolveNotApplicableCell(habit, '2026-07-14', zeroCtx()), null);
  });

  test('x-cell before the habit existed produces no row', () => {
    // appliesToday()'s existence guard (startDate > date) must still take
    // precedence — a pre-startDate 'x' cell is not a "closed shop" exception,
    // it is simply a date before the habit existed.
    const habit = { id: 'h3', cadence: { type: 'daily' }, startDate: '2026-01-01' };

    assert.equal(resolveNotApplicableCell(habit, '2025-12-30', zeroCtx()), null);
  });
});
