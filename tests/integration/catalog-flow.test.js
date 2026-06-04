/**
 * @file End-to-end catalog flow integration test (CATALOG-01..07).
 *
 * Phase 04 plan 05 coverage: createHabit + editHabit basic flows.
 * Phase 04 plan 06 will extend this with: archiveHabit, restoreHabit, deleteHabit.
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

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let repo;
beforeEach(() => {
  repo = createFakeRepo();
});

describe('Catalog flow', () => {
  test('create habit → habit is in habits store with status:active (CATALOG-01)', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Drink water',
        wave: 0,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    const habits = Array.from(repo._stores.habits.values());
    assert.equal(habits.length, 1);
    assert.equal(habits[0].status, 'active');
    assert.equal(habits[0].name, 'Drink water');
    assert.match(habits[0].id, UUID_V4);
  });

  test('create habit with future startDate → effectiveFrom set correctly (CATALOG-07)', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Future habit',
        wave: 2,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2026-09-01',
      },
    });

    const versions = Array.from(repo._stores.habit_versions.values());
    assert.equal(versions.length, 1);
    assert.equal(versions[0].effectiveFrom, '2026-09-01');
  });

  test('edit habit → second habit_versions entry created (CATALOG-02, CATALOG-03)', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: { name: 'Read', wave: 1, cadence: { type: 'daily' }, targetType: 'binary', startDate: '2026-01-01' },
    });
    const habitId = Array.from(repo._stores.habits.values())[0].id;

    await apply.apply({
      type: 'editHabit',
      payload: { habitId, name: 'Read books', wave: 1, cadence: { type: 'daily' }, targetType: 'binary' },
    });

    const versions = Array.from(repo._stores.habit_versions.values())
      .filter((v) => v.habitId === habitId);
    assert.equal(versions.length, 2, 'edit should create a second habit_versions entry');
    assert.equal(Array.from(repo._stores.habits.values())[0].name, 'Read books');
  });
});
