/**
 * @file RED tests proving four stale-boolean bugs in the 4-state log model (QA-01, D-02).
 *
 * After Phase 11 migrated `completed: boolean` to `status: string`, four call-sites
 * still read the old boolean field. These tests confirm the bugs exist BEFORE any
 * production fix is applied (RED phase, D-23 TDD).
 *
 * Bugs under test:
 *   A) js/domain/waveAggregates.js:44  — _countForHabit checks log.completed === true
 *   B) js/domain/waveAggregates.js:198 — streak walk-back checks log.completed === true
 *   C) js/io/import.js:133             — does not normalize completed:boolean to status:string
 *
 * Test D (markSkipped D-52 overwrite) lives in
 *   tests/integration/apply.markSkipped.test.js (requires fake IDB + freshApply pattern).
 *
 * ScoreSnapshots regression guard (GREEN immediately):
 *   Confirms js/io/scoreSnapshots.js:_logCompleted already uses log.status
 *   (hotfix from commit 0dbd185). This guard must pass before AND after production fixes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeWaveAggregates } from '../../js/domain/waveAggregates.js';
import { mergeImportedStores, configureImport } from '../../js/io/import.js';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { DB_VERSION } from '../../js/db/schema.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ---------------------------------------------------------------------------
// Shared helpers (local copies of patterns from waveAggregates.test.js)
// ---------------------------------------------------------------------------

/**
 * Minimal valid ctx object for waveAggregates tests.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function makeCtx(overrides = {}) {
  return {
    appliesToday: (_habit, _date) => true,
    weekStart: 'mon',
    weekCompletions: () => 0,
    monthCompletions: () => 0,
    globalThreshold: 90,
    globalWindow: 70,
    isMastered: () => false,
    streakThreshold: 80,
    atRiskSlipRatio: 0.5,
    ...overrides,
  };
}

/**
 * Create a minimal habit row for wave 1.
 *
 * @param {object} [fields]
 * @returns {object}
 */
function makeHabit(fields = {}) {
  return {
    id: 'h1',
    wave: 1,
    status: 'active',
    cadence: { type: 'daily' },
    createdAt: '2026-01-01',
    ...fields,
  };
}

/**
 * Build a minimal import payload (matches makeImportPayload in import.test.js).
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function makeImportPayload(overrides = {}) {
  return {
    schemaVersion: DB_VERSION,
    habits: [],
    habit_versions: [],
    logs: [],
    events: [],
    settings: [],
    meta: [],
    score_snapshots: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test A: waveAggregates — _countForHabit reads log.completed not log.status
// ---------------------------------------------------------------------------

describe('waveAggregates bug A — completionPct is 0 when log has status:completed but no completed field', () => {
  test('computeWaveAggregates returns completionPct > 0 for a status:completed log (fails before fix)', () => {
    const habit = makeHabit();
    // 4-state model row: status field only — no legacy completed boolean
    const log = { habitId: 'h1', date: '2026-09-01', status: 'completed' };
    const ctx = makeCtx({ appliesToday: () => true });

    const result = computeWaveAggregates(1, [habit], [log], '2026-09-01', ctx);
    assert.ok(
      result.completionPct > 0,
      `completionPct should be > 0 for a completed log but got ${result.completionPct} ` +
        '— _countForHabit still checks log.completed === true (stale boolean, D-02)',
    );
  });
});

// ---------------------------------------------------------------------------
// Test B: waveAggregates — streak walk-back reads log.completed not log.status
// ---------------------------------------------------------------------------

describe('waveAggregates bug B — longestStreak is 0 when log has status:completed but no completed field', () => {
  test('computeWaveAggregates returns longestStreak >= 1 for a status:completed log (fails before fix)', () => {
    const habit = makeHabit();
    const log = { habitId: 'h1', date: '2026-09-01', status: 'completed' };
    // Only the target date is applicable so the streak walk-back exercises exactly one date
    const ctx = makeCtx({
      appliesToday: (_h, date) => date === '2026-09-01',
    });

    const result = computeWaveAggregates(1, [habit], [log], '2026-09-01', ctx);
    assert.ok(
      result.longestStreak >= 1,
      `longestStreak should be >= 1 for a completed applicable day but got ${result.longestStreak} ` +
        '— streak walk-back still checks log.completed === true (stale boolean, D-02)',
    );
  });
});

// ---------------------------------------------------------------------------
// Test C: import.js — legacy completed:boolean not normalized to status:string
// ---------------------------------------------------------------------------

describe('import.js bug C — legacy completed:true row stored without status field', () => {
  test('mergeImportedStores normalizes completed:true to status:completed (fails before fix)', async () => {
    const repo = createFakeRepo();
    // Inject our isolated fake repo for this test
    configureImport({ repo, broadcast: null });

    const payload = makeImportPayload({
      // Legacy backup format: row has completed:boolean, no status field
      logs: [{ habitId: 'h1', date: '2026-09-01', completed: true }],
    });

    await mergeImportedStores(payload);

    const stored = await repo.getLog('h1', '2026-09-01');
    assert.ok(stored, 'log row must have been written to IDB by mergeImportedStores');
    assert.equal(
      stored.status,
      'completed',
      `stored.status should be 'completed' but got ${stored.status} ` +
        '— import.js does not normalize legacy completed:boolean to status:string (D-43)',
    );
  });
});

// ---------------------------------------------------------------------------
// ScoreSnapshots regression guard (GREEN from the start — not a RED test)
// ---------------------------------------------------------------------------

describe('scoreSnapshots regression guard — log.status already used in _logCompleted', () => {
  test('js/io/scoreSnapshots.js _logCompleted contains log.status (hotfix 0dbd185 intact)', () => {
    const src = readFileSync(`${ROOT}js/io/scoreSnapshots.js`, 'utf8');
    assert.ok(
      src.includes('log.status'),
      'scoreSnapshots.js must contain log.status — the 0dbd185 hotfix appears to have been reverted',
    );
  });
});
