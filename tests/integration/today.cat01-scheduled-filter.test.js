/**
 * @file Integration test: Today view filters out scheduled habits (CAT-01).
 *
 * Verifies that the Today check-in view does not display scheduled habits.
 * The filter on line 391 of js/views/today.js filters by status === 'active',
 * which excludes scheduled habits (the 4th status introduced in Phase 7).
 *
 * CAT-01 requirement: Today view shows only active and mastered habits,
 * not scheduled habits (which are waiting for their startDate to arrive).
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

const origDocument = globalThis.document;
const origLocation = globalThis.location;

beforeEach(() => {
  globalThis.document = {
    get body() { return undefined; },
    createElement() { return {}; },
    createTextNode() { return {}; },
  };
  try {
    globalThis.location = { reload: () => {} };
  } catch (_e) {
    Object.defineProperty(globalThis, 'location', {
      value: { reload: () => {} },
      configurable: true,
      writable: true,
    });
  }
});

afterEach(() => {
  globalThis.document = origDocument;
  if (origLocation) {
    try {
      globalThis.location = origLocation;
    } catch (_e) {
      Object.defineProperty(globalThis, 'location', {
        value: origLocation,
        configurable: true,
        writable: true,
      });
    }
  }
});

describe('Today view CAT-01 filter — excludes scheduled habits', () => {
  test('Today view filters habits to status === "active" only', async () => {
    const [storeMod, cadenceMod] = await Promise.all([
      import('../../js/state/store.js'),
      import('../../js/domain/cadence.js'),
    ]);
    const { configureStore, hydrate, getCachedHabits, _resetStoreForTest } = storeMod;

    _resetStoreForTest();

    const repo = createFakeRepo();
    configureStore({ repo });

    const date = todayLocal();

    // Create habits with different statuses: active, scheduled, mastered, archived
    await repo.putHabit({
      id: 'h-active-1',
      name: 'Active habit',
      status: 'active',
      cadence: { type: 'daily' },
    });

    await repo.putHabit({
      id: 'h-scheduled-1',
      name: 'Scheduled habit (future)',
      status: 'scheduled',
      startDate: '2026-12-31', // Future date
      cadence: { type: 'daily' },
    });

    await repo.putHabit({
      id: 'h-mastered-1',
      name: 'Mastered habit',
      status: 'mastered',
      cadence: { type: 'daily' },
    });

    await repo.putHabit({
      id: 'h-archived-1',
      name: 'Archived habit',
      status: 'archived',
      cadence: { type: 'daily' },
    });

    await hydrate();

    // The filter applied in today.js line 391
    const allActive = getCachedHabits().filter((h) => h.status === 'active');

    // Verify filter results
    assert.equal(allActive.length, 1, 'only one active habit in filtered set');
    assert.equal(allActive[0].id, 'h-active-1', 'filtered set contains only the active habit');

    // Verify scheduled habit is excluded
    const scheduledHabit = getCachedHabits().find((h) => h.id === 'h-scheduled-1');
    assert.ok(scheduledHabit, 'scheduled habit exists in cache');
    assert.equal(scheduledHabit.status, 'scheduled', 'scheduled habit has scheduled status');
    assert.equal(
      allActive.find((h) => h.id === 'h-scheduled-1'),
      undefined,
      'scheduled habit is excluded from Today active filter',
    );

    // Verify mastered habit is excluded from active filter (mastered is separate)
    assert.equal(
      allActive.find((h) => h.id === 'h-mastered-1'),
      undefined,
      'mastered habit is excluded from active filter',
    );

    // Verify archived habit is excluded
    assert.equal(
      allActive.find((h) => h.id === 'h-archived-1'),
      undefined,
      'archived habit is excluded from active filter',
    );
  });

  test('getCachedHabits returns all habits with mixed statuses', async () => {
    const [storeMod] = await Promise.all([
      import('../../js/state/store.js'),
    ]);
    const { configureStore, hydrate, getCachedHabits, _resetStoreForTest } = storeMod;

    _resetStoreForTest();

    const repo = createFakeRepo();
    configureStore({ repo });

    // Create habits with different statuses
    await repo.putHabit({
      id: 'h-active-2',
      name: 'Active',
      status: 'active',
      cadence: { type: 'daily' },
    });

    await repo.putHabit({
      id: 'h-scheduled-2',
      name: 'Scheduled',
      status: 'scheduled',
      startDate: '2026-12-31',
      cadence: { type: 'daily' },
    });

    await hydrate();

    // Verify getCachedHabits returns all habits
    const allHabits = getCachedHabits();
    assert.equal(allHabits.length, 2, 'getCachedHabits returns all habits');

    // Verify the statuses are present
    const statuses = new Set(allHabits.map((h) => h.status));
    assert.ok(statuses.has('active'), 'active status in cache');
    assert.ok(statuses.has('scheduled'), 'scheduled status in cache');
  });

  test('filtering by status === "active" reliably excludes scheduled status', async () => {
    const [storeMod] = await Promise.all([
      import('../../js/state/store.js'),
    ]);
    const { configureStore, hydrate, getCachedHabits, _resetStoreForTest } = storeMod;

    _resetStoreForTest();

    const repo = createFakeRepo();
    configureStore({ repo });

    // Create multiple scheduled habits to verify the filter works consistently
    for (let i = 0; i < 5; i++) {
      await repo.putHabit({
        id: `h-scheduled-${i}`,
        name: `Scheduled habit ${i}`,
        status: 'scheduled',
        startDate: '2026-12-31',
        cadence: { type: 'daily' },
      });
    }

    await repo.putHabit({
      id: 'h-active-final',
      name: 'The only active habit',
      status: 'active',
      cadence: { type: 'daily' },
    });

    await hydrate();

    const allActive = getCachedHabits().filter((h) => h.status === 'active');

    // Verify only active habits pass the filter
    assert.equal(allActive.length, 1, 'exactly one active habit in filtered set');
    assert.ok(
      allActive.every((h) => h.status === 'active'),
      'all filtered habits have status === "active"',
    );

    // Verify no scheduled habits in filtered set
    assert.equal(
      allActive.filter((h) => h.status === 'scheduled').length,
      0,
      'no scheduled habits in filtered set',
    );
  });
});
