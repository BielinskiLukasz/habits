/**
 * @file Unit tests for js/views/desktop/waveboard.js — pure description-tree
 * builders for the Wave-board heat-map view (D-26 Tier 1, D-118, DESKTOP-04,
 * SCORING-02).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Test data:
 *   - 2 weeks: ['2026-W26', '2026-W27']
 *   - 2 habits in wave 1 (1 active, 1 archived)
 *   - cellData with explicit statuses per habit per week
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWaveboardHeader,
  buildWaveboardRows,
  weeksInRange,
  isoWeekKey,
} from '../../../../js/views/desktop/waveboard.js';

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

const WEEKS = ['2026-W26', '2026-W27'];

const HABIT_ACTIVE = { id: 'h1', name: 'Morning walk', wave: 1, stage: 1, status: 'active' };
const HABIT_ARCHIVED = { id: 'h2', name: 'Old habit', wave: 1, stage: 0, status: 'archived' };

const HABITS_BY_WAVE = [
  {
    waveNumber: 1,
    waveName: 'Wave 1 — Foundation',
    habits: [HABIT_ACTIVE, HABIT_ARCHIVED],
  },
];

// cellData: Map<habitId, Map<isoWeekKey, { status, applicable, completed }>>
const CELL_DATA_HEALTHY = new Map([
  [
    'h1',
    new Map([
      ['2026-W26', { status: 'Healthy', applicable: 7, completed: 7 }],
      ['2026-W27', { status: 'Watch', applicable: 7, completed: 5 }],
    ]),
  ],
]);

const CELL_DATA_EMPTY = new Map(); // no data — all N/A

// ---------------------------------------------------------------------------
// buildWaveboardHeader
// ---------------------------------------------------------------------------

describe('buildWaveboardHeader — DESKTOP-04 heat-map column headers', () => {
  test('returns element tree with tag "tr"', () => {
    const out = buildWaveboardHeader({ weeks: WEEKS });
    assert.equal(out.tag, 'tr');
  });

  test('first column header has text "Habit"', () => {
    const out = buildWaveboardHeader({ weeks: WEEKS });
    // First child should be a <th> with text 'Habit'
    const habitTh = out.children[0];
    assert.ok(habitTh, 'Header row should have children');
    assert.equal(habitTh.tag, 'th');
    assert.equal(habitTh.text, 'Habit');
  });

  test('returns N+1 columns for N weeks (habit name column + N week columns)', () => {
    const out = buildWaveboardHeader({ weeks: WEEKS });
    // WEEKS has 2 entries → 2 + 1 = 3 columns total
    assert.equal(out.children.length, WEEKS.length + 1);
  });

  test('week labels present as "W26", "W27" for "2026-W26", "2026-W27"', () => {
    const out = buildWaveboardHeader({ weeks: WEEKS });
    const texts = out.children.slice(1).map(c => c.text);
    assert.deepEqual(texts, ['W26', 'W27']);
  });
});

// ---------------------------------------------------------------------------
// buildWaveboardRows
// ---------------------------------------------------------------------------

describe('buildWaveboardRows — DESKTOP-04 heat-map body rows', () => {
  test('returns an array', () => {
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_HEALTHY,
      weeks: WEEKS,
      showArchived: false,
    });
    assert.ok(Array.isArray(out));
  });

  test('wave header row has class containing "analytics-wave-header"', () => {
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_HEALTHY,
      weeks: WEEKS,
      showArchived: false,
    });
    const waveHeaderRow = out.find(row =>
      row.tag === 'tr' && row.attrs && row.attrs.class &&
      row.attrs.class.includes('analytics-wave-header')
    );
    assert.ok(waveHeaderRow, 'Should have a wave header row with class "analytics-wave-header"');
  });

  test('habit row with Healthy status cell contains element with class "waveboard-cell--healthy"', () => {
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_HEALTHY,
      weeks: WEEKS,
      showArchived: false,
    });
    const rows = out.filter(row =>
      row.tag === 'tr' && !(row.attrs && row.attrs.class && row.attrs.class.includes('analytics-wave-header'))
    );
    // First non-header row is the active habit with Healthy in W26
    const healthyCell = findDesc({ children: rows }, d =>
      d.tag === 'td' && d.attrs && d.attrs.class &&
      d.attrs.class.includes('waveboard-cell--healthy')
    );
    assert.ok(healthyCell, 'Should find a waveboard-cell--healthy element');
  });

  test('habit row with N/A (no data) cell contains element with class "waveboard-cell--na"', () => {
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_EMPTY,
      weeks: WEEKS,
      showArchived: false,
    });
    const naCell = findDesc({ children: out }, d =>
      d.tag === 'td' && d.attrs && d.attrs.class &&
      d.attrs.class.includes('waveboard-cell--na')
    );
    assert.ok(naCell, 'Should find a waveboard-cell--na element when no data');
  });

  test('cell title attribute shows "Healthy (7/7 days)" when habit had 7/7 applicable days', () => {
    const out = buildWaveboardRows({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: [HABIT_ACTIVE] }],
      cellData: CELL_DATA_HEALTHY,
      weeks: ['2026-W26'],
      showArchived: false,
    });
    const healthyCell = findDesc({ children: out }, d =>
      d.tag === 'td' && d.attrs && d.attrs.title &&
      d.attrs.title.includes('Healthy') && d.attrs.title.includes('7/7')
    );
    assert.ok(healthyCell, 'Cell title should contain "Healthy (7/7 days)"');
    assert.ok(healthyCell.attrs.title.includes('7/7'), 'Title should include 7/7');
  });

  test('N/A cell has title attribute "Not applicable"', () => {
    const out = buildWaveboardRows({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: [HABIT_ACTIVE] }],
      cellData: CELL_DATA_EMPTY,
      weeks: ['2026-W26'],
      showArchived: false,
    });
    const naCell = findDesc({ children: out }, d =>
      d.tag === 'td' && d.attrs && d.attrs.title === 'Not applicable'
    );
    assert.ok(naCell, 'N/A cell should have title="Not applicable"');
  });

  test('archived habit row has class "analytics-row--archived" when showArchived is true', () => {
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_EMPTY,
      weeks: WEEKS,
      showArchived: true,
    });
    const archivedRow = out.find(row =>
      row.tag === 'tr' && row.attrs && row.attrs.class &&
      row.attrs.class.includes('analytics-row--archived')
    );
    assert.ok(archivedRow, 'Archived habit row should have "analytics-row--archived" class');
  });

  test('wave header td wraps its label in an inner sticky-positionable span (wave-header-label), not directly as td text', () => {
    // Regression test for waveboard-wave-row-not-pinned: a <td> with colspan
    // spanning every column has zero "room" for position: sticky to move it
    // (verified empirically against real Chromium — the box already equals
    // the full scrollable width, so sticky computes a zero offset even
    // though getComputedStyle reports position:sticky/left:0 correctly).
    // The fix moves the sticky target to a small inner inline-block span,
    // mirroring how the single-column .waveboard-sticky-column cells work.
    // This test asserts the DOM *structure* the CSS fix depends on — a
    // CSS-text-only assertion (see waveboard.css.test.js) cannot catch this
    // class of bug, because the old CSS rule was syntactically correct and
    // still failed to pin the content in a real browser.
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_HEALTHY,
      weeks: WEEKS,
      showArchived: false,
    });
    const waveHeaderRow = out.find(row =>
      row.tag === 'tr' && row.attrs && row.attrs.class &&
      row.attrs.class.includes('analytics-wave-header')
    );
    assert.ok(waveHeaderRow, 'Should have a wave header row');
    const td = waveHeaderRow.children[0];
    assert.equal(td.tag, 'td');
    assert.equal(td.text, undefined,
      'Label text must live on an inner span, not directly on the colspan td (colspan tds cannot be sticky-positioned in real browsers)');
    const label = (td.children ?? []).find(c =>
      c.tag === 'span' && c.attrs && c.attrs.class === 'wave-header-label'
    );
    assert.ok(label, 'Expected an inner <span class="wave-header-label"> carrying the sticky-positionable label');
    assert.equal(label.text, 'Wave 1', 'Label span should carry the wave label text');
  });

  test('archived habit is not rendered when showArchived is false', () => {
    const out = buildWaveboardRows({
      habitsByWave: HABITS_BY_WAVE,
      cellData: CELL_DATA_EMPTY,
      weeks: WEEKS,
      showArchived: false,
    });
    // Only 1 wave header row + 1 habit row (active habit), archived should be absent
    const archivedRow = out.find(row =>
      row.tag === 'tr' && row.attrs && row.attrs.class &&
      row.attrs.class.includes('analytics-row--archived')
    );
    assert.equal(archivedRow, undefined, 'Archived habit row should not be present when showArchived is false');

    // Also verify that the archived habit name "Old habit" is not in the output
    const oldHabitFound = findDesc({ children: out }, d =>
      d.tag === 'td' && d.text === 'Old habit'
    );
    assert.equal(oldHabitFound, undefined, '"Old habit" should not appear in output when showArchived=false');
  });
});

// ---------------------------------------------------------------------------
// weeksInRange
// ---------------------------------------------------------------------------

describe('weeksInRange — DESKTOP-04 full-history week-range builder', () => {
  test('single-day range (start === end) returns exactly one week key', () => {
    const out = weeksInRange('2026-06-24', '2026-06-24');
    assert.deepEqual(out, [isoWeekKey('2026-06-24')]);
  });

  test('year-boundary multi-week range returns chronological keys with no duplicates', () => {
    const out = weeksInRange('2025-12-01', '2026-01-20');
    assert.equal(out[0], isoWeekKey('2025-12-01'));
    assert.equal(out[out.length - 1], isoWeekKey('2026-01-20'));
    assert.ok(out.length >= 6, `Expected at least 6 weeks, got ${out.length}`);
    assert.equal(new Set(out).size, out.length, 'Should contain no duplicate week keys');
  });
});
