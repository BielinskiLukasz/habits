/**
 * @file Integration tests for `apply({ type: 'editHabit' })` end-to-end
 * (CATALOG-02, CATALOG-03, NFR-10, Phase 04 plan 05 Task 2).
 *
 * Verifies:
 *   - editHabit creates a NEW habit_versions entry (effectiveFrom = today)
 *   - editHabit does NOT rewrite any logs (NFR-10 proof)
 *   - after editHabit, habit_versions has 2 entries for the habitId
 *   - inverse contains priorVersion for undo
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** Fresh import per test so apply.js module-level state is clean. */
async function freshApply() {
  const url = new URL('../../js/state/apply.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Today's date as YYYY-MM-DD in local time (matches todayLocal() in date.js). */
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

let repo;
beforeEach(() => {
  repo = createFakeRepo();
});

describe('apply(editHabit) — creates new version, preserves logs (NFR-10)', () => {
  test('after editHabit, habit_versions has 2 entries for the habitId', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Step 1: Create the habit.
    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Original name',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2026-01-01',
      },
    });

    const habits = Array.from(repo._stores.habits.values());
    const habitId = habits[0].id;

    // Step 2: Edit the habit's name.
    await apply.apply({
      type: 'editHabit',
      payload: {
        habitId,
        name: 'Updated name',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    // habit_versions should have 2 rows: original (2026-01-01) + new (today).
    const allVersionKeys = Array.from(repo._stores.habit_versions.keys());
    const habitVersions = Array.from(repo._stores.habit_versions.values())
      .filter((v) => v.habitId === habitId);
    assert.equal(habitVersions.length, 2, `Expected 2 habit_versions for habitId, got ${allVersionKeys.length}: ${JSON.stringify(habitVersions)}`);

    const effectiveDates = habitVersions.map((v) => v.effectiveFrom).sort();
    assert.ok(effectiveDates.includes('2026-01-01'), 'original version should still exist');
    assert.ok(effectiveDates.includes(todayYMD()), 'new version should have effectiveFrom = today');

    // habits row should have the updated name.
    const updatedHabit = await repo.getHabit(habitId);
    assert.equal(updatedHabit.name, 'Updated name');
  });

  test('NFR-10: existing logs are UNCHANGED after editHabit', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Step 1: Create the habit.
    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Daily walk',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2026-01-01',
      },
    });
    const habitId = Array.from(repo._stores.habits.values())[0].id;

    // Step 2: Manually seed a log row (simulating prior completion).
    const logRow = { habitId, date: '2026-01-15', completed: true, definitionVersion: null };
    await repo.putLog(logRow);
    assert.equal(repo._stores.logs.size, 1, 'should have exactly 1 log before edit');

    // Step 3: Edit the habit definition.
    await apply.apply({
      type: 'editHabit',
      payload: {
        habitId,
        name: 'Renamed daily walk',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    // Logs store must remain exactly 1 row — editHabit must NEVER write to logs.
    assert.equal(repo._stores.logs.size, 1, 'logs store must be unchanged after editHabit (NFR-10)');

    // The existing log row is identical to what was seeded.
    const key = JSON.stringify([habitId, '2026-01-15']);
    const persistedLog = repo._stores.logs.get(key);
    assert.ok(persistedLog, 'original log must still exist');
    assert.deepEqual(persistedLog, logRow, 'original log must be bit-for-bit identical (NFR-10)');
  });

  test('editHabit inverse contains priorVersion for undo', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Create habit first.
    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Meditation',
        wave: 0,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2026-03-01',
      },
    });
    const habitId = Array.from(repo._stores.habits.values())[0].id;

    // Edit it.
    const editEventId = await apply.apply({
      type: 'editHabit',
      payload: {
        habitId,
        name: 'Deep meditation',
        wave: 0,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    const editEvt = repo._stores.events.get(editEventId);
    assert.ok(editEvt, 'edit event must exist');
    assert.equal(editEvt.inverse.type, 'restoreHabitVersion');
    assert.equal(editEvt.inverse.payload.habitId, habitId);
    assert.ok(editEvt.inverse.payload.priorVersion, 'priorVersion must be present for undo');
  });

  test('editHabit writes array NEVER contains a logs entry (NFR-10 structural proof)', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Test habit',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2026-01-01',
      },
    });
    const habitId = Array.from(repo._stores.habits.values())[0].id;

    // Intercept runTx to inspect the storeNames arg.
    let capturedStoreNames = null;
    const originalRunTx = repo.runTx.bind(repo);
    repo.runTx = async (storeNames, mode, body) => {
      capturedStoreNames = storeNames;
      return originalRunTx(storeNames, mode, body);
    };

    await apply.apply({
      type: 'editHabit',
      payload: {
        habitId,
        name: 'New name',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    // The storeNames must NOT include 'logs'.
    assert.ok(capturedStoreNames, 'runTx should have been called');
    assert.ok(
      !capturedStoreNames.includes('logs'),
      `editHabit must never include 'logs' in storeNames (NFR-10); got: ${capturedStoreNames.join(', ')}`,
    );
  });
});
