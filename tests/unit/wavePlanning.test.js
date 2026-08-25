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
// Fixtures (WAVE-01 scope — minimal)
// ---------------------------------------------------------------------------

const WAVES = [
  { number: 1, name: 'Morning rituals', startDate: '2026-01-05', theme: 'morning' },
  { number: 2, name: 'Focus', startDate: '2026-06-15', theme: 'focus' },
];
const HABITS = [];
const SNAPSHOTS = new Map();
const CURRENT_WEEK = '2026-W01';

// ---------------------------------------------------------------------------
// WAVE-01: wave headers with startDate
// ---------------------------------------------------------------------------

describe('buildWavePlanningSection — WAVE-01: wave headers with startDate', () => {
  test('renders a button.waveplanning-wave-header per wave containing startDate text', () => {
    const desc = buildWavePlanningSection({
      waves: WAVES,
      habits: HABITS,
      currentWeekKey: CURRENT_WEEK,
      snapshotsByWeek: SNAPSHOTS,
    });
    const headers = findAll(desc, n => n.attrs?.class?.includes('waveplanning-wave-header'));
    assert.equal(headers.length, WAVES.length, 'one header per wave');
    const texts = allText(headers[0]).join(' ');
    assert.ok(texts.includes('2026-01-05'), 'wave 1 header contains startDate 2026-01-05');
  });
});
