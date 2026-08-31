/**
 * @file Unit tests for js/views/desktop/analytics.js — pure description-tree
 * builders for the Analytics view (D-26 Tier 1, D-116, DESKTOP-03,
 * SCORING-02, SCORING-03, SCORING-04).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Test data:
 *   - 2 habits in wave 1, 1 habit in wave 2 (archived)
 *   - Mock snapshot: {habitId:'h1', date:'2026-06-29', s1Score:95,
 *     s1Status:'Healthy', s2Score:0.85, s3Score:0.7, scoreVersion:1}
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalyticsHeader,
  buildAnalyticsTable,
} from '../../../../js/views/desktop/analytics.js';

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

const HABITS_WAVE1 = [
  { id: 'h1', name: 'Morning walk', wave: 1, stage: 1, status: 'active' },
  { id: 'h2', name: 'Strength training', wave: 1, stage: 2, status: 'mastered' },
];

const HABIT_WAVE2_ARCHIVED = [
  { id: 'h3', name: 'Old habit', wave: 2, stage: 0, status: 'archived' },
];

const SNAPSHOT_H1 = {
  habitId: 'h1',
  date: '2026-06-29',
  s1Score: 95,
  s1Status: 'Healthy',
  s2Score: 0.85,
  s3Score: 0.7,
  scoreVersion: 1,
};

const SNAPSHOT_H2 = {
  habitId: 'h2',
  date: '2026-06-29',
  s1Score: 80,
  s1Status: 'Watch',
  s2Score: 0.75,
  s3Score: 0.6,
  scoreVersion: 1,
};

const SNAPSHOT_H3 = {
  habitId: 'h3',
  date: '2026-06-29',
  s1Score: 60,
  s1Status: 'Failing',
  s2Score: 0.50,
  s3Score: 0.4,
  scoreVersion: 1,
};

const SNAPSHOTS_MAP_ALL = new Map([
  ['h1', SNAPSHOT_H1],
  ['h2', SNAPSHOT_H2],
  ['h3', SNAPSHOT_H3],
]);

const HABITS_BY_WAVE = [
  {
    waveNumber: 1,
    waveName: 'Wave 1 — Foundation',
    habits: HABITS_WAVE1,
  },
  {
    waveNumber: 2,
    waveName: 'Wave 2 — Advanced',
    habits: HABIT_WAVE2_ARCHIVED,
  },
];

// ---------------------------------------------------------------------------
// buildAnalyticsHeader
// ---------------------------------------------------------------------------

describe('buildAnalyticsHeader — D-116 dashboard + scoring model selector', () => {
  test('returns element tree with tag "div" and class "analytics-header"', () => {
    const out = buildAnalyticsHeader({
      statusCounts: { Healthy: 3, Watch: 1, 'At-risk': 0, Failing: 0 },
      scoringModel: 'S1',
    });
    assert.equal(out.tag, 'div');
    assert.equal(out.attrs.class, 'analytics-header');
  });

  test('contains summary counts for each status label', () => {
    const out = buildAnalyticsHeader({
      statusCounts: { Healthy: 5, Watch: 2, 'At-risk': 1, Failing: 0 },
      scoringModel: 'S1',
    });
    // Find spans with status count text
    const healthySpan = findDesc(out, d => d.tag === 'span' && d.text && d.text.includes('Healthy: 5'));
    const watchSpan   = findDesc(out, d => d.tag === 'span' && d.text && d.text.includes('Watch: 2'));
    const atRiskSpan  = findDesc(out, d => d.tag === 'span' && d.text && d.text.includes('At Risk: 1'));
    const failingSpan = findDesc(out, d => d.tag === 'span' && d.text && d.text.includes('Failing: 0'));
    assert.ok(healthySpan, 'Should contain "Healthy: 5" span');
    assert.ok(watchSpan,   'Should contain "Watch: 2" span');
    assert.ok(atRiskSpan,  'Should contain "At Risk: 1" span');
    assert.ok(failingSpan, 'Should contain "Failing: 0" span');
  });

  test('contains three radio inputs with name "scoringModel" and correct values', () => {
    const out = buildAnalyticsHeader({
      statusCounts: { Healthy: 0, Watch: 0, 'At-risk': 0, Failing: 0 },
      scoringModel: 'S1',
    });
    const radios = findAll(out, d => d.tag === 'input' && d.attrs && d.attrs.type === 'radio');
    assert.equal(radios.length, 3);
    const names = radios.map(r => r.attrs.name);
    assert.ok(names.every(n => n === 'scoringModel'), 'All radios should have name="scoringModel"');
    const values = radios.map(r => r.attrs.value);
    assert.deepEqual(values.sort(), ['S1', 'S2', 'S3'].sort());
  });

  test('radio matching scoringModel param has checked attribute; others do not', () => {
    const out = buildAnalyticsHeader({
      statusCounts: { Healthy: 0, Watch: 0, 'At-risk': 0, Failing: 0 },
      scoringModel: 'S2',
    });
    const radios = findAll(out, d => d.tag === 'input' && d.attrs && d.attrs.type === 'radio');
    const s2Radio = radios.find(r => r.attrs.value === 'S2');
    const s1Radio = radios.find(r => r.attrs.value === 'S1');
    const s3Radio = radios.find(r => r.attrs.value === 'S3');
    assert.ok(s2Radio, 'S2 radio should exist');
    assert.equal(s2Radio.attrs.checked, '', 'S2 radio should have checked=""');
    assert.equal(s1Radio.attrs.checked, undefined, 'S1 radio should not be checked');
    assert.equal(s3Radio.attrs.checked, undefined, 'S3 radio should not be checked');
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsTable
// ---------------------------------------------------------------------------

describe('buildAnalyticsTable — D-116 wave-grouped habit table', () => {
  test('returns element tree with tag "table" and class "analytics-table"', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    assert.equal(out.tag, 'table');
    assert.equal(out.attrs.class, 'analytics-table');
  });

  test('each wave group produces a header row with class "analytics-wave-header"', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    const waveHeaderRows = findAll(out, d => d.tag === 'tr' && d.attrs && d.attrs.class === 'analytics-wave-header');
    assert.equal(waveHeaderRows.length, 2, 'Should have 2 wave header rows');
  });

  test('wave header row contains the wave name text', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    const wave1Header = findDesc(out, d =>
      d.tag === 'tr' && d.attrs && d.attrs.class === 'analytics-wave-header' &&
      JSON.stringify(d).includes('Wave 1')
    );
    assert.ok(wave1Header, 'Wave 1 header row should contain wave name');
  });

  test('wave header row contains aggregate S1 score text when model is S1', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1 — Foundation', habits: HABITS_WAVE1 }],
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    // avg of 95 and 80 = 87.5 → Math.round = 88
    const aggSpan = findDesc(out, d => d.tag === 'span' && d.attrs && d.attrs.class === 'analytics-wave-agg');
    assert.ok(aggSpan, 'Wave header should have aggregate span');
    assert.ok(aggSpan.text && aggSpan.text.includes('avg S1:'), 'S1 aggregate should include "avg S1:"');
    assert.ok(aggSpan.text.includes('88%'), 'S1 avg of 95+80=175/2=87.5 rounds to 88');
  });

  test('wave header row shows avg S2 score when scoringModel is S2', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: HABITS_WAVE1 }],
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S2',
      showArchived: false,
    });
    // avg s2Score: (0.85 + 0.75) / 2 = 0.80
    const aggSpan = findDesc(out, d => d.tag === 'span' && d.attrs && d.attrs.class === 'analytics-wave-agg');
    assert.ok(aggSpan, 'Wave header should have aggregate span');
    assert.ok(aggSpan.text && aggSpan.text.includes('avg S2:'), 'Should show "avg S2:"');
    assert.ok(aggSpan.text.includes('0.80'), 'S2 avg of 0.85+0.75=1.60/2=0.80');
  });

  test('wave header aggregate shows empty string when no non-null snapshot scores exist', () => {
    const emptySnapshots = new Map(); // no snapshots
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: HABITS_WAVE1 }],
      snapshots: emptySnapshots,
      scoringModel: 'S1',
      showArchived: false,
    });
    const aggSpan = findDesc(out, d => d.tag === 'span' && d.attrs && d.attrs.class === 'analytics-wave-agg');
    assert.ok(aggSpan, 'Wave header should have aggregate span even with no data');
    assert.equal(aggSpan.text, '', 'Aggregate text should be empty when no scores available');
  });

  test('each habit row contains the habit name text', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: HABITS_WAVE1 }],
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    const morningWalk = findDesc(out, d => d.tag === 'td' && d.text === 'Morning walk');
    const strength    = findDesc(out, d => d.tag === 'td' && d.text === 'Strength training');
    assert.ok(morningWalk, 'Should find "Morning walk" in a td');
    assert.ok(strength,    'Should find "Strength training" in a td');
  });

  test('when scoringModel is S1: no S2/S3 score column in thead', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    const thead = out.children.find(c => c.tag === 'thead');
    assert.ok(thead, 'Table should have a thead');
    const allText = JSON.stringify(thead);
    assert.ok(!allText.includes('S2 Score') && !allText.includes('S3 Score'),
      'S1 model should not show S2/S3 column headers');
  });

  test('when scoringModel is S2: column header is "S2 Score"', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S2',
      showArchived: false,
    });
    const thead = out.children.find(c => c.tag === 'thead');
    assert.ok(thead, 'Table should have a thead');
    const s2Header = findDesc(thead, d => d.text === 'S2 Score');
    assert.ok(s2Header, 'Should find "S2 Score" column header');
  });

  test('archived habit row has class containing "analytics-row--archived" when showArchived is true', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: true,
    });
    const archivedRow = findDesc(out, d =>
      d.tag === 'tr' && d.attrs && d.attrs.class && d.attrs.class.includes('analytics-row--archived')
    );
    assert.ok(archivedRow, 'Archived row should have "analytics-row--archived" class');
  });

  test('archived habit row is not present when showArchived is false', () => {
    const out = buildAnalyticsTable({
      habitsByWave: HABITS_BY_WAVE,
      snapshots: SNAPSHOTS_MAP_ALL,
      scoringModel: 'S1',
      showArchived: false,
    });
    const archivedRow = findDesc(out, d =>
      d.tag === 'tr' && d.attrs && d.attrs.class && d.attrs.class.includes('analytics-row--archived')
    );
    assert.equal(archivedRow, undefined, 'Archived row should not be present when showArchived is false');
  });

  test('S1 badge uses correct class for "Healthy" s1Status', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: [HABITS_WAVE1[0]] }],
      snapshots: new Map([['h1', SNAPSHOT_H1]]),
      scoringModel: 'S1',
      showArchived: false,
    });
    // h1 has s1Status: 'Healthy'
    const badge = findDesc(out, d =>
      d.tag === 'span' && d.attrs && d.attrs.class &&
      d.attrs.class.includes('score-badge') && d.attrs.class.includes('score-badge--healthy')
    );
    assert.ok(badge, 'Should find a score-badge with score-badge--healthy class for Healthy status');
  });

  // Regression: UAT-T21 — Rolling %, Mastery, S2 columns showed empty values.
  // Root cause: analytics.js used repo.runTx() whose body returned a raw
  // IDBRequest (non-thenable), so await resolved to the request object instead
  // of req.result. buildAnalyticsTable() itself was correct — this suite guards
  // the builder side; the data-fetch fix is in analytics.js refresh().
  test('regression UAT-T21: Rolling % span shows numeric score (not "—") when snapshot has s1Score', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: [HABITS_WAVE1[0]] }],
      snapshots: new Map([['h1', SNAPSHOT_H1]]), // s1Score: 95
      scoringModel: 'S1',
      showArchived: false,
    });
    // The Rolling % cell contains a span with "95%" text — not "—%"
    const scoreSpan = findDesc(out, d =>
      d.tag === 'span' && d.text === '95%'
    );
    assert.ok(scoreSpan, 'Rolling % cell should show "95%" when s1Score is 95, not "—%"');
  });

  test('regression UAT-T21: S2 Score cell shows numeric value (not "—") when snapshot has s2Score and model is S2', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: [HABITS_WAVE1[0]] }],
      snapshots: new Map([['h1', SNAPSHOT_H1]]), // s2Score: 0.85
      scoringModel: 'S2',
      showArchived: false,
    });
    // The S2 Score cell should show "0.85", not "—"
    const s2Cell = findDesc(out, d =>
      d.tag === 'td' && d.attrs && d.attrs.class === 'analytics-model-score' && d.text === '0.85'
    );
    assert.ok(s2Cell, 'S2 Score cell should show "0.85" when s2Score is 0.85, not "—"');
  });

  test('regression UAT-T21: Rolling % shows "—%" when snapshots Map is empty (no data for habit)', () => {
    const out = buildAnalyticsTable({
      habitsByWave: [{ waveNumber: 1, waveName: 'Wave 1', habits: [HABITS_WAVE1[0]] }],
      snapshots: new Map(), // no snapshot for h1
      scoringModel: 'S1',
      showArchived: false,
    });
    // When no snapshot exists, Rolling % shows "—%"
    const dashSpan = findDesc(out, d =>
      d.tag === 'span' && d.text === '—%'
    );
    assert.ok(dashSpan, 'Rolling % cell should show "—%" when no snapshot exists for the habit');
  });
});
