/**
 * @file History integrity integration test — logs survive definition edits (NFR-10).
 *
 * Fleshed out in Phase 04 plan 05 (createHabit + editHabit handlers).
 * Verifies the core NFR-10 invariant: after a habit definition edit,
 * pre-existing logs are bit-for-bit identical to what was written before
 * the edit. The habit_versions store carries the edit history.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** Fresh import per test so apply.js module-level state is clean. */
async function freshApply() {
  const url = new URL('../../js/state/apply.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

let repo;
beforeEach(() => {
  repo = createFakeRepo();
});

describe('Habit versions (NFR-10)', () => {
  test('logs survive definition edit: pre-edit log is unchanged after editHabit', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Create the habit.
    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Morning walk',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2026-01-01',
      },
    });
    const habitId = Array.from(repo._stores.habits.values())[0].id;

    // Log a completion BEFORE the definition edit.
    const preEditLog = { habitId, date: '2026-01-15', completed: true, definitionVersion: null };
    await repo.putLog(preEditLog);

    const logsBefore = repo._stores.logs.size;

    // Edit the habit definition — name change creates a new version.
    await apply.apply({
      type: 'editHabit',
      payload: {
        habitId,
        name: 'Evening walk', // renamed
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    // Logs store size must not change (NFR-10).
    assert.equal(repo._stores.logs.size, logsBefore, 'no log rows should be added or removed');

    // The pre-edit log is unchanged.
    const key = JSON.stringify([habitId, '2026-01-15']);
    const persistedLog = repo._stores.logs.get(key);
    assert.ok(persistedLog, 'original log must still exist');
    assert.deepEqual(persistedLog, preEditLog, 'original log must be bit-for-bit identical (NFR-10)');

    // The habit_versions store has 2 entries for this habit.
    const versions = Array.from(repo._stores.habit_versions.values())
      .filter((v) => v.habitId === habitId);
    assert.equal(versions.length, 2, 'edit should create a second habit_versions entry');

    // The first version preserves the original name.
    const sortedVersions = versions.sort((a, b) => a.effectiveFrom < b.effectiveFrom ? -1 : 1);
    assert.equal(sortedVersions[0].name, 'Morning walk', 'original version name preserved');
    assert.equal(sortedVersions[1].name, 'Evening walk', 'new version has updated name');
  });
});
