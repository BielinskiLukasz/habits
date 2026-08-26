/**
 * @file Integration tests for `repo.getSnapshotsInRange()` via the fake-IDB
 * (D-25, A7 contract).
 *
 * Regression guard for the waveboard-idb-databinding bug: waveboard.js called
 * `repo.runTx(['score_snapshots'], 'readonly', tx => tx.objectStore(...).getAll(...))`.
 * The body returned a raw IDBRequest (not a Promise), so `await body(tx)` in
 * idb.js runTx resolved to the IDBRequest object itself (non-thenable). The
 * subsequent `for (const row of snapshotRows)` threw `TypeError: snapshotRows
 * is not iterable` — silently caught — leaving cachedCellData empty and all
 * waveboard cells rendering as "na".
 *
 * Fix: replace the inline runTx call with `repo.getSnapshotsInRange(start, end)`,
 * which uses `indexGetAll()` and always returns a real Promise<object[]>.
 *
 * These tests assert that `getSnapshotsInRange` returns an iterable Array
 * (not an IDBRequest or any other non-iterable), and that date-range filtering
 * is correct — including the boundary off-by-one neighbours that the single
 * in-range case misses.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

let fake;
beforeEach(() => {
  fake = createFakeRepo();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal score_snapshots row with the given habitId and date.
 *
 * @param {string} habitId
 * @param {string} date YYYY-MM-DD
 * @returns {object}
 */
function snap(habitId, date) {
  return { habitId, date, s1Status: 'Healthy', applicableToday: true, loggedToday: true };
}

// ---------------------------------------------------------------------------
// Core contract: return type is always an iterable Array
// ---------------------------------------------------------------------------

describe('repo.getSnapshotsInRange — return type (regression: IDBRequest non-iterable bug)', () => {
  test('returns an Array (not an IDBRequest or other non-iterable) when store is empty', async () => {
    const result = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.ok(Array.isArray(result), 'result must be an Array, got: ' + Object.prototype.toString.call(result));
  });

  test('result from non-empty store is iterable via for-of without throwing TypeError', async () => {
    await fake.putSetting({ key: 'dummy', value: 1 }); // unrelated store — no pollution
    await fake.score_snapshots; // does not exist — just ensuring store is clean
    const row = snap('h1', '2026-06-15');
    await fake.putHabit({ id: 'h1', name: 'Morning walk', wave: 1, status: 'active' });
    // Directly write a snapshot row via the fake
    await (async () => {
      // Use fake's internal _stores to seed a snapshot
      fake._stores.score_snapshots.set(JSON.stringify([row.habitId, row.date]), row);
    })();

    const result = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');

    // Must be an Array — the bug produced an IDBRequest which is not iterable
    assert.ok(Array.isArray(result), 'result must be an Array');

    // Must be iterable without throwing TypeError
    let count = 0;
    assert.doesNotThrow(() => {
      for (const _r of result) count++;
    }, 'for-of on result must not throw TypeError');
    assert.equal(count, 1, 'should have iterated exactly one row');
  });
});

// ---------------------------------------------------------------------------
// Date-range filtering (inclusive bounds + boundary neighbours)
// ---------------------------------------------------------------------------

describe('repo.getSnapshotsInRange — filtering', () => {
  test('returns [] when the score_snapshots store is empty', async () => {
    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.deepEqual(out, []);
  });

  test('includes a snapshot exactly on the start date (boundary: N == start)', async () => {
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-06-01']),
      snap('h1', '2026-06-01'),
    );
    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.equal(out.length, 1);
    assert.equal(out[0].date, '2026-06-01');
  });

  test('includes a snapshot exactly on the end date (boundary: N == end)', async () => {
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-06-30']),
      snap('h1', '2026-06-30'),
    );
    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.equal(out.length, 1);
    assert.equal(out[0].date, '2026-06-30');
  });

  test('excludes a snapshot one day before the start date (boundary: N == start - 1)', async () => {
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-05-31']),
      snap('h1', '2026-05-31'),
    );
    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.equal(out.length, 0, 'snapshot at 2026-05-31 must not appear in [06-01, 06-30]');
  });

  test('excludes a snapshot one day after the end date (boundary: N == end + 1)', async () => {
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-07-01']),
      snap('h1', '2026-07-01'),
    );
    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.equal(out.length, 0, 'snapshot at 2026-07-01 must not appear in [06-01, 06-30]');
  });

  test('single-day range [D, D] returns only snapshots on that exact day', async () => {
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-06-15']),
      snap('h1', '2026-06-15'),
    );
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-06-14']),
      snap('h1', '2026-06-14'),
    );
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-06-16']),
      snap('h1', '2026-06-16'),
    );
    const out = await fake.getSnapshotsInRange('2026-06-15', '2026-06-15');
    assert.equal(out.length, 1);
    assert.equal(out[0].date, '2026-06-15');
  });

  test('returns snapshots across multiple habits within the window', async () => {
    fake._stores.score_snapshots.set(
      JSON.stringify(['h1', '2026-06-10']),
      snap('h1', '2026-06-10'),
    );
    fake._stores.score_snapshots.set(
      JSON.stringify(['h2', '2026-06-11']),
      snap('h2', '2026-06-11'),
    );
    fake._stores.score_snapshots.set(
      JSON.stringify(['h3', '2026-06-12']),
      snap('h3', '2026-06-12'),
    );
    // One outside the range
    fake._stores.score_snapshots.set(
      JSON.stringify(['h4', '2026-07-01']),
      snap('h4', '2026-07-01'),
    );

    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.equal(out.length, 3);
    const ids = new Set(out.map(r => r.habitId));
    assert.ok(ids.has('h1'));
    assert.ok(ids.has('h2'));
    assert.ok(ids.has('h3'));
    assert.ok(!ids.has('h4'), 'h4 snapshot outside range must be excluded');
  });
});

// ---------------------------------------------------------------------------
// Data integrity: returned rows carry full snapshot fields
// ---------------------------------------------------------------------------

describe('repo.getSnapshotsInRange — row contents', () => {
  test('returned rows include habitId, date, s1Status fields from the stored row', async () => {
    const row = {
      habitId: 'h1',
      date: '2026-06-20',
      s1Status: 'Watch',
      applicableToday: true,
      loggedToday: false,
    };
    fake._stores.score_snapshots.set(JSON.stringify([row.habitId, row.date]), row);

    const out = await fake.getSnapshotsInRange('2026-06-01', '2026-06-30');
    assert.equal(out.length, 1);
    assert.equal(out[0].habitId, 'h1');
    assert.equal(out[0].date, '2026-06-20');
    assert.equal(out[0].s1Status, 'Watch');
    assert.equal(out[0].loggedToday, false);
  });
});
