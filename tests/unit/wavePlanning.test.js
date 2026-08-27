/**
 * @file Unit tests for js/views/desktop/wavePlanning.js — pure builder
 * `buildWavePlanningSection` (WAVE-01, WAVE-02, WAVE-03, WAVE-04, D-11, D-05, D-06).
 *
 * Builders are pure functions returning description trees. NO DOM polyfill needed.
 * Pattern S8 (D-26 Tier 1) — fixture-based tests on object shapes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildWavePlanningSection } from '../../js/views/desktop/wavePlanning.js';

// ---------------------------------------------------------------------------
// Tree traversal helpers
// ---------------------------------------------------------------------------

/** Recursively find all nodes matching a predicate in a description tree. */
function findAll(desc, pred) {
  if (!desc || typeof desc === 'string') return [];
  const results = [];
  if (pred(desc)) results.push(desc);
  for (const child of desc.children ?? []) {
    results.push(...findAll(child, pred));
  }
  return results;
}

function findFirst(desc, pred) { return findAll(desc, pred)[0]; }

function allText(desc) {
  if (typeof desc === 'string') return [desc];
  const results = [];
  if (desc.text !== undefined) results.push(String(desc.text));
  for (const child of desc.children ?? []) results.push(...allText(child));
  return results;
}

// ---------------------------------------------------------------------------
// Fixtures (shared across all describe blocks)
// ---------------------------------------------------------------------------

const WAVES = [
  { number: 1, name: 'Morning rituals', startDate: '2026-01-05', theme: 'morning' },
  { number: 2, name: 'Focus', startDate: '2026-06-15', theme: 'focus' },
];

// Extended HABITS fixture for Task 2 tests (Task 1 tests use empty slice)
const ALL_HABITS = [
  { id: 'h1', wave: 1, status: 'active', stage: 2, name: 'Morning walk', cadence: { type: 'daily' } },
  { id: 'h2', wave: 1, status: 'scheduled', startDate: '2026-02-01', name: 'Evening read', cadence: { type: 'daily' } },
  { id: 'h3', wave: 1, status: 'archived', name: 'Old habit', cadence: { type: 'daily' } },
  { id: 'h4', wave: 2, status: 'scheduled', startDate: '2026-06-15', name: 'Deep work', cadence: { type: 'weekly' } },
];

// D-11: caller pre-filters archived habits before passing to builder
const HABITS_FILTERED = ALL_HABITS.filter(h => h.status !== 'archived');

const SNAPSHOTS = new Map([
  ['h1', new Map([['2026-W01', 'Healthy']])],
]);

const CURRENT_WEEK = '2026-W01';

// ---------------------------------------------------------------------------
// WAVE-01: wave headers with startDate
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — WAVE-01: wave headers with startDate', () => {
  test('renders a button.waveplanning-wave-header per wave containing startDate text', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: [],
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: new Map(),
    });
    const headers = findAll(desc, n => n.attrs?.class?.includes('waveplanning-wave-header'));
    assert.equal(headers.length, WAVES.length, 'one header per wave');
    const texts = allText(headers[0]).join(' ');
    assert.ok(texts.includes('2026-01-05'), 'wave 1 header contains startDate 2026-01-05');
  });
});

// ---------------------------------------------------------------------------
// WAVE-02: active/scheduled counts
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — WAVE-02: active/scheduled counts', () => {
  test('shows "1 active · 1 scheduled" for wave 1 (h3 archived excluded from counts)', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS_FILTERED,
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    // Find wave 1 header
    const headers = findAll(desc, n => n.attrs?.class?.includes('waveplanning-wave-header'));
    const wave1Header = headers[0];
    const countsNode = findFirst(wave1Header, n => n.attrs?.class === 'waveplanning-wave-counts');
    assert.ok(countsNode, 'counts span found in wave 1 header');
    assert.ok(countsNode.text?.includes('1 active'), `expected "1 active" in "${countsNode.text}"`);
    assert.ok(countsNode.text?.includes('1 scheduled'), `expected "1 scheduled" in "${countsNode.text}"`);
  });
});

// ---------------------------------------------------------------------------
// WAVE-03: scheduled habit rows with date + promote button
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — WAVE-03: scheduled habit rows', () => {
  test('wave 1 list contains li.waveplanning-scheduled-row with date and promote button', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS_FILTERED,
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    const scheduledRows = findAll(desc, n => n.attrs?.class === 'waveplanning-scheduled-row');
    assert.ok(scheduledRows.length >= 1, 'at least one scheduled row');
    const row = scheduledRows[0]; // h2 (Evening read, wave 1)
    const dateSpan = findFirst(row, n => n.attrs?.class === 'waveplanning-scheduled-date');
    assert.ok(dateSpan, 'waveplanning-scheduled-date span found');
    assert.equal(dateSpan.text, '2026-02-01', 'startDate in scheduled row');
    const promoteBtn = findFirst(row, n => n.attrs?.class?.includes('waveplanning-promote-btn'));
    assert.ok(promoteBtn, 'promote button found');
    assert.equal(promoteBtn.attrs?.['data-habit-id'], 'h2', 'promote button data-habit-id');
    assert.equal(promoteBtn.attrs?.['aria-label'], 'Promote Evening read to active', 'promote button aria-label');
  });
});

// ---------------------------------------------------------------------------
// WAVE-04: active habit rows with status, cadence
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — WAVE-04: active habit rows', () => {
  test('wave 1 list contains li.waveplanning-habit-row with status and cadence', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS_FILTERED,
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    const habitRows = findAll(desc, n => n.attrs?.class === 'waveplanning-habit-row');
    assert.ok(habitRows.length >= 1, 'at least one active habit row');
    const row = habitRows[0]; // h1 Morning walk
    const statusSpan = findFirst(row, n => n.attrs?.class === 'waveplanning-habit-status');
    assert.ok(statusSpan, 'habit-status span found');
    assert.equal(statusSpan.text, 'active', 'status is "active"');
    const cadenceSpan = findFirst(row, n => n.attrs?.class === 'waveplanning-habit-cadence');
    assert.ok(cadenceSpan, 'habit-cadence span found');
    assert.equal(cadenceSpan.text, 'Daily', 'daily cadence renders as "Daily"');
  });
});

// ---------------------------------------------------------------------------
// D-11: archived habits excluded from description tree
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — D-11: archived habits excluded', () => {
  test('archived habit "Old habit" does not appear in the description tree', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS_FILTERED, // archived already filtered by caller
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    const texts = allText(desc).join(' ');
    assert.ok(!texts.includes('Old habit'), 'archived habit must not appear in tree');
  });
});

// ---------------------------------------------------------------------------
// D-06: Upcoming badge when no active habits in a wave
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — D-06: Upcoming badge for waves with no active habits', () => {
  test('wave 2 (only scheduled habits) has waveplanning-badge--upcoming class', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS_FILTERED,
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    const headers = findAll(desc, n => n.attrs?.class?.includes('waveplanning-wave-header'));
    const wave2Header = headers[1]; // wave 2
    const badge = findFirst(wave2Header, n => n.attrs?.class?.includes('waveplanning-badge'));
    assert.ok(badge, 'badge found in wave 2 header');
    assert.ok(badge.attrs?.class?.includes('waveplanning-badge--upcoming'), `expected --upcoming, got "${badge.attrs?.class}"`);
  });
});

// ---------------------------------------------------------------------------
// D-05: Health badge reflects worstStatus of active habits
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — D-05: health badge from snapshot', () => {
  test('wave 1 has active h1 with Healthy snapshot → waveplanning-badge--healthy', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS_FILTERED,
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    const headers = findAll(desc, n => n.attrs?.class?.includes('waveplanning-wave-header'));
    const wave1Header = headers[0]; // wave 1
    const badge = findFirst(wave1Header, n => n.attrs?.class?.includes('waveplanning-badge'));
    assert.ok(badge, 'badge found in wave 1 header');
    assert.ok(badge.attrs?.class?.includes('waveplanning-badge--healthy'), `expected --healthy, got "${badge.attrs?.class}"`);
  });
});
