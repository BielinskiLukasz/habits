/**
 * @file Unit tests for js/views/desktop/planning.js — pure description-tree
 * builders for the Planning view (D-26 Tier 1, D-121, DESKTOP-05, DESKTOP-06).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Test data:
 *   - 2 weeks: [{key:'2026-W27', label:'W27'}, {key:'2026-W28', label:'W28'}]
 *   - 2 habits in wave 1 and wave 3 (both future startDates)
 *   - waveGroups: only waves with at least one scheduled habit
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlanningHeader,
  buildPlanningRows,
  buildPlanningEmpty,
} from '../../../../js/views/desktop/planning.js';

/**
 * Helper — find a descendant in a description tree matching `predicate`
 * (depth-first). Returns the first match or `undefined`.
 *
 * @param {object|string} desc
 * @param {(d: object) => boolean} predicate
 * @returns {object|undefined}
 */
function findDesc(desc, predicate) {
  if (!desc || typeof desc !== 'object') return undefined;
  if (predicate(desc)) return desc;
  for (const c of (desc.children ?? [])) {
    const m = findDesc(c, predicate);
    if (m) return m;
  }
  return undefined;
}

/**
 * Collect all descendants matching `predicate`.
 * @param {object|string} desc
 * @param {(d: object) => boolean} predicate
 * @returns {object[]}
 */
function findAll(desc, predicate) {
  /** @type {object[]} */
  const out = [];
  function walk(d) {
    if (!d || typeof d !== 'object') return;
    if (predicate(d)) out.push(d);
    for (const c of (d.children ?? [])) walk(c);
  }
  walk(desc);
  return out;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const WEEKS = [
  { key: '2026-W27', label: 'W27' },
  { key: '2026-W28', label: 'W28' },
];

// Habits with future startDates falling in the 12-week window
const HABIT_W27 = { id: 'h1', name: 'Morning run', wave: 1, status: 'active', startDate: '2026-06-29' };
const HABIT_W28 = { id: 'h2', name: 'Evening yoga', wave: 3, status: 'active', startDate: '2026-07-06' };

// waveGroups — only waves with scheduled habits (D-121)
const WAVE_GROUPS = [
  {
    waveNumber: 1,
    waveName: 'Wave 1 — Foundation',
    habits: [HABIT_W27],
  },
  {
    waveNumber: 3,
    waveName: 'Wave 3 — Strength',
    habits: [HABIT_W28],
  },
];

// Single-wave group for focused tests
const SINGLE_WAVE_GROUP = [
  {
    waveNumber: 1,
    waveName: 'Wave 1 — Foundation',
    habits: [HABIT_W27],
  },
];

// ---------------------------------------------------------------------------
// buildPlanningHeader
// ---------------------------------------------------------------------------

describe('buildPlanningHeader — DESKTOP-05 planning grid column headers', () => {
  test('returns element tree with tag "tr"', () => {
    const out = buildPlanningHeader({ weeks: WEEKS });
    assert.equal(out.tag, 'tr');
  });

  test('first column header has text "Wave / Habit"', () => {
    const out = buildPlanningHeader({ weeks: WEEKS });
    const firstTh = out.children[0];
    assert.ok(firstTh, 'Header row should have children');
    assert.equal(firstTh.tag, 'th');
    assert.equal(firstTh.text, 'Wave / Habit');
  });

  test('returns N+1 columns for N weeks (label column + N week columns)', () => {
    const out = buildPlanningHeader({ weeks: WEEKS });
    // WEEKS has 2 entries → 2 + 1 = 3 columns total
    assert.equal(out.children.length, WEEKS.length + 1);
  });

  test('week column headers display week labels from the weeks array', () => {
    const out = buildPlanningHeader({ weeks: WEEKS });
    const weekTexts = out.children.slice(1).map(c => c.text);
    assert.deepEqual(weekTexts, ['W27', 'W28']);
  });
});

// ---------------------------------------------------------------------------
// buildPlanningRows
// ---------------------------------------------------------------------------

describe('buildPlanningRows — DESKTOP-05 planning grid body rows', () => {
  test('returns an array', () => {
    const out = buildPlanningRows({ waveGroups: WAVE_GROUPS, weeks: WEEKS });
    assert.ok(Array.isArray(out));
  });

  test('wave group row has class containing "analytics-wave-header"', () => {
    const out = buildPlanningRows({ waveGroups: WAVE_GROUPS, weeks: WEEKS });
    const waveHeaderRow = out.find(row =>
      row.tag === 'tr' && row.attrs && row.attrs.class &&
      row.attrs.class.includes('analytics-wave-header')
    );
    assert.ok(waveHeaderRow, 'Should have a wave header row with class "analytics-wave-header"');
  });

  test('habit name cell with an <a> element whose href starts with "./index.html"', () => {
    const out = buildPlanningRows({ waveGroups: SINGLE_WAVE_GROUP, weeks: WEEKS });
    const link = findDesc({ children: out }, d =>
      d.tag === 'a' && d.attrs && typeof d.attrs.href === 'string' &&
      d.attrs.href.startsWith('./index.html')
    );
    assert.ok(link, 'Should find an <a> element with href starting with ./index.html');
  });

  test('href attribute on habit link is exactly "./index.html#catalog"', () => {
    const out = buildPlanningRows({ waveGroups: SINGLE_WAVE_GROUP, weeks: WEEKS });
    const link = findDesc({ children: out }, d =>
      d.tag === 'a' && d.attrs && d.attrs.href === './index.html#catalog'
    );
    assert.ok(link, 'Habit link href should be "./index.html#catalog"');
  });

  test('empty week cell is a <td> with empty text when no habits scheduled that week', () => {
    // HABIT_W27 has startDate 2026-06-29 which falls in W26, not W27 or W28
    // So week cells for W27 and W28 should be empty for HABIT_W27
    // Wait — HABIT_W27 startDate 2026-06-29 is in W26 which is NOT in WEEKS
    // So both W27 and W28 cells should be empty for HABIT_W27
    const out = buildPlanningRows({ waveGroups: SINGLE_WAVE_GROUP, weeks: WEEKS });
    // Find habit rows (not wave header rows)
    const habitRows = out.filter(row =>
      row.tag === 'tr' && !(row.attrs && row.attrs.class && row.attrs.class.includes('analytics-wave-header'))
    );
    assert.ok(habitRows.length > 0, 'Should have at least one habit row');
    // The week cells in the habit row for weeks not matching startDate should be empty <td>
    // Since HABIT_W27 startDate 2026-06-29 is in W26 (not in WEEKS=[W27,W28]), all cells empty
    const habitRow = habitRows[0];
    const weekCells = habitRow.children ? habitRow.children.slice(1) : []; // skip habit name cell
    const emptyCell = weekCells.find(cell => cell.tag === 'td' && (cell.text === '' || cell.text == null) && !cell.children);
    assert.ok(emptyCell, 'Empty week cell should be a <td> with empty text');
  });

  test('only waves with scheduled habits are rendered (no empty wave sections)', () => {
    // If waveGroups only has waves with habits (per plan filter logic), buildPlanningRows
    // trusts that waveGroups is pre-filtered — all passed waves appear in output
    const out = buildPlanningRows({ waveGroups: WAVE_GROUPS, weeks: WEEKS });
    const waveHeaderRows = out.filter(row =>
      row.tag === 'tr' && row.attrs && row.attrs.class &&
      row.attrs.class.includes('analytics-wave-header')
    );
    // Should only have as many wave headers as the input waveGroups
    assert.equal(waveHeaderRows.length, WAVE_GROUPS.length, 'Number of wave headers should match input waveGroups');
  });
});

// ---------------------------------------------------------------------------
// buildPlanningEmpty
// ---------------------------------------------------------------------------

describe('buildPlanningEmpty — DESKTOP-06 empty state', () => {
  test('returns element tree with a heading "No upcoming habit starts"', () => {
    const out = buildPlanningEmpty();
    const heading = findDesc(out, d =>
      d.tag === 'h2' && d.text === 'No upcoming habit starts'
    );
    assert.ok(heading, 'Should have an <h2> with text "No upcoming habit starts"');
  });

  test('contains a link to "./index.html#catalog"', () => {
    const out = buildPlanningEmpty();
    const link = findDesc(out, d =>
      d.tag === 'a' && d.attrs && d.attrs.href === './index.html#catalog'
    );
    assert.ok(link, 'Should have an <a> element with href "./index.html#catalog"');
  });

  test('link text is "Catalog view"', () => {
    const out = buildPlanningEmpty();
    const link = findDesc(out, d =>
      d.tag === 'a' && d.attrs && d.attrs.href === './index.html#catalog'
    );
    assert.ok(link, 'Link should exist');
    assert.equal(link.text, 'Catalog view', 'Catalog link should say "Catalog view"');
  });

  test('root element has class "planning-empty"', () => {
    const out = buildPlanningEmpty();
    assert.ok(
      out.attrs && out.attrs.class && out.attrs.class.includes('planning-empty'),
      'Root element should have class "planning-empty"'
    );
  });
});
