/**
 * @file Unit tests for writeHabitSnapshots and rebuildAllSnapshots
 * (SCORING-08, SCORING-09, SETTINGS-06, NFR-03, D-114).
 *
 * Uses a fake repo (object with getAll/getLogsByHabit/getSetting/runTx stubs)
 * and mocked scoring functions injected via the configure() DI seam.
 *
 * Tests do NOT depend on js/domain/scoring.js being correct — scoring
 * functions are mocked to return fixed values so 06-01 and 06-02 can be
 * implemented and tested in parallel.
 *
 * Coverage:
 *   writeHabitSnapshots:
 *     - writes a score_snapshots row for each date in [createdAt, today]
 *     - row shape: {habitId, date, s1Score, s1Status, s2Score, s3Score, scoreVersion: 1}
 *     - grace-period dates → all scores null in written row
 *     - uses exactly ONE runTx call per habit invocation
 *     - scoreVersion is always 1 (SCORING-09)
 *
 *   rebuildAllSnapshots:
 *     - calls writeHabitSnapshots for each habit from getAllHabits
 *     - onProgress(done, total) invoked once per habit with (index+1, total)
 *     - does not throw when getAllHabits returns empty array
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  configure,
  writeHabitSnapshots,
  rebuildAllSnapshots,
} from '../../../js/io/scoreSnapshots.js';

// ---------------------------------------------------------------------------
// Fake scoring functions — mocked S1/S2/S3 that return deterministic values.
// These are injected via configure() so tests are independent of scoring.js.
// ---------------------------------------------------------------------------

const FIXED_S1 = { s1Score: 80, s1Status: 'Watch' };
const FIXED_S2 = { s2Score: 0.75 };
const FIXED_S3 = { s3Score: 0.6 };

/** Mock computeS1 returning FIXED_S1 always. */
const mockComputeS1 = (_habit, _logs, _ctx) => FIXED_S1;
/** Mock computeS2 returning FIXED_S2 always. */
const mockComputeS2 = (_habit, _logs, _ctx) => FIXED_S2;
/** Mock computeS3 returning FIXED_S3 always. */
const mockComputeS3 = (_habit, _logs, _ctx, _allHabits) => FIXED_S3;

/** Mock computeS1 that returns null scores (grace period simulation). */
const mockGraceS1 = (_habit, _logs, _ctx) => ({ s1Score: null, s1Status: null });
const mockGraceS2 = (_habit, _logs, _ctx) => ({ s2Score: null });
const mockGraceS3 = (_habit, _logs, _ctx, _allHabits) => ({ s3Score: null });

// ---------------------------------------------------------------------------
// Fake repo builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal fake repo for scoreSnapshots tests.
 * Tracks runTx call count and captured snapshot rows.
 *
 * @param {{ habits?: object[], logsByHabit?: object[], settings?: Record<string, any> }} opts
 * @returns {{ fakeRepo: object, captured: { snapshots: object[], runTxCallCount: number } }}
 */
function buildFakeRepo({ habits = [], logsByHabit = [], settings = {} } = {}) {
  const captured = { snapshots: [], runTxCallCount: 0 };

  const fakeRepo = {
    async getAllHabits() { return habits; },
    async getLogsByHabit(_habitId) { return logsByHabit; },
    async getSetting(key) {
      const val = settings[key];
      // Return the value wrapped in a {value} object to match repo surface,
      // or raw if the test provides raw values.
      return val !== undefined ? val : undefined;
    },
    async runTx(_storeNames, _mode, body) {
      captured.runTxCallCount++;
      const tx = {
        objectStore(name) {
          if (name !== 'score_snapshots') {
            throw new Error(`fake: unexpected store '${name}' — expected score_snapshots`);
          }
          return {
            put(row) { captured.snapshots.push(row); },
          };
        },
      };
      return body(tx);
    },
  };

  return { fakeRepo, captured };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD string N days after a reference date. */
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yr = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

/** Today in YYYY-MM-DD (local). */
function todayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Tests: writeHabitSnapshots
// ---------------------------------------------------------------------------

describe('writeHabitSnapshots', () => {
  beforeEach(() => {
    // Inject mock scoring functions before each test.
    configure({
      computeS1: mockComputeS1,
      computeS2: mockComputeS2,
      computeS3: mockComputeS3,
    });
  });

  test('writes a row for each date from createdAt to today (inclusive)', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -4); // 5 days including today
    const habit = { id: 'h1', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h1', fakeRepo);

    // Should have written 5 rows (createdAt, +1, +2, +3, today)
    assert.strictEqual(captured.snapshots.length, 5);

    // Verify dates are in range [createdAt, today] — all 5 dates present
    const dates = captured.snapshots.map(r => r.date).sort();
    assert.strictEqual(dates[0], createdAt);
    assert.strictEqual(dates[dates.length - 1], today);
  });

  test('every written row has the correct shape', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -9); // 10 days: forces non-grace-period
    const habit = { id: 'h2', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h2', fakeRepo);

    for (const row of captured.snapshots) {
      assert.strictEqual(row.habitId, 'h2');
      assert.ok(typeof row.date === 'string', 'date must be string');
      assert.ok(row.date.match(/^\d{4}-\d{2}-\d{2}$/), 'date must be YYYY-MM-DD');
      assert.strictEqual(row.scoreVersion, 1, 'scoreVersion must be 1 (SCORING-09)');
      // Shape must carry all three model score fields.
      assert.ok('s1Score' in row, 'row must have s1Score');
      assert.ok('s1Status' in row, 'row must have s1Status');
      assert.ok('s2Score' in row, 'row must have s2Score');
      assert.ok('s3Score' in row, 'row must have s3Score');
    }
  });

  test('scoreVersion is always 1 in every written row (SCORING-09)', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -2);
    const habit = { id: 'h3', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h3', fakeRepo);

    for (const row of captured.snapshots) {
      assert.strictEqual(row.scoreVersion, 1);
    }
  });

  test('uses exactly ONE runTx call per writeHabitSnapshots invocation', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -6);
    const habit = { id: 'h4', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h4', fakeRepo);

    assert.strictEqual(
      captured.runTxCallCount,
      1,
      'must use exactly one IDB transaction per habit (NFR-03 perf requirement)'
    );
  });

  test('grace-period dates produce null scores in the written row', async () => {
    configure({
      computeS1: mockGraceS1,
      computeS2: mockGraceS2,
      computeS3: mockGraceS3,
    });

    const today = todayYMD();
    const createdAt = addDays(today, -3); // within 7-day grace for all dates
    const habit = { id: 'h5', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h5', fakeRepo);

    // All rows should have null scores (grace period simulated by mockGrace*)
    assert.ok(captured.snapshots.length > 0, 'must write at least one row');
    for (const row of captured.snapshots) {
      assert.strictEqual(row.s1Score, null);
      assert.strictEqual(row.s1Status, null);
      assert.strictEqual(row.s2Score, null);
      assert.strictEqual(row.s3Score, null);
    }
  });

  test('returns early (no rows written) when habit is not found', async () => {
    const today = todayYMD();
    const habit = { id: 'h-other', createdAt: addDays(today, -2), cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    // Request for a habitId not in getAllHabits → should return early without writing
    await writeHabitSnapshots('h-nonexistent', fakeRepo);

    assert.strictEqual(captured.snapshots.length, 0);
    assert.strictEqual(captured.runTxCallCount, 0);
  });

  test('non-grace-period rows carry the mocked S1/S2/S3 values', async () => {
    // Use fixed-value mocks (already configured in beforeEach)
    const today = todayYMD();
    // 10 days back → all dates past grace period (scored by mocks)
    const createdAt = addDays(today, -9);
    const habit = { id: 'h6', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h6', fakeRepo);

    // Latest row should carry mock values
    const row = captured.snapshots.find(r => r.date === today);
    assert.ok(row, 'should have a row for today');
    assert.strictEqual(row.s1Score, FIXED_S1.s1Score);
    assert.strictEqual(row.s1Status, FIXED_S1.s1Status);
    assert.strictEqual(row.s2Score, FIXED_S2.s2Score);
    assert.strictEqual(row.s3Score, FIXED_S3.s3Score);
  });
});

// ---------------------------------------------------------------------------
// Tests: rebuildAllSnapshots
// ---------------------------------------------------------------------------

describe('rebuildAllSnapshots', () => {
  beforeEach(() => {
    configure({
      computeS1: mockComputeS1,
      computeS2: mockComputeS2,
      computeS3: mockComputeS3,
    });
  });

  test('does not throw when getAllHabits returns an empty array', async () => {
    const { fakeRepo } = buildFakeRepo({ habits: [] });
    // Must not throw
    await assert.doesNotReject(
      () => rebuildAllSnapshots(fakeRepo),
      'rebuildAllSnapshots should handle empty habits list gracefully'
    );
  });

  test('calls writeHabitSnapshots for each habit (writes rows for each)', async () => {
    const today = todayYMD();
    const habits = [
      { id: 'ha', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
      { id: 'hb', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
      { id: 'hc', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
    ];
    const { fakeRepo, captured } = buildFakeRepo({ habits });

    await rebuildAllSnapshots(fakeRepo);

    // Each habit should have contributed runTx calls
    assert.strictEqual(captured.runTxCallCount, habits.length,
      'should have exactly one runTx per habit'
    );

    // Verify all three habitIds appear in written snapshots
    const writtenHabitIds = new Set(captured.snapshots.map(r => r.habitId));
    for (const h of habits) {
      assert.ok(writtenHabitIds.has(h.id), `expected rows for habitId ${h.id}`);
    }
  });

  test('onProgress callback invoked once per habit with (done, total) args', async () => {
    const today = todayYMD();
    const habits = [
      { id: 'p1', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
      { id: 'p2', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
    ];
    const { fakeRepo } = buildFakeRepo({ habits });

    const progressCalls = [];
    await rebuildAllSnapshots(fakeRepo, (done, total) => {
      progressCalls.push({ done, total });
    });

    // Should be called once per habit
    assert.strictEqual(progressCalls.length, habits.length);
    // First call: done=1, total=2
    assert.strictEqual(progressCalls[0].done, 1);
    assert.strictEqual(progressCalls[0].total, 2);
    // Second call: done=2, total=2
    assert.strictEqual(progressCalls[1].done, 2);
    assert.strictEqual(progressCalls[1].total, 2);
  });

  test('onProgress is optional (no default arg error with 1 argument)', async () => {
    const today = todayYMD();
    const habits = [
      { id: 'q1', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
    ];
    const { fakeRepo } = buildFakeRepo({ habits });

    // Call with only one argument — onProgress defaults to no-op
    await assert.doesNotReject(() => rebuildAllSnapshots(fakeRepo));
  });
});
