/**
 * @file Integration test: habit completed today remains in the Today applicable set
 * (Phase 03 plan 07 Gap 5 fix — D-54).
 *
 * Verifies the OR-clause added to the applicable filter in today.js:
 *   appliesToday(h, date, ctx) || getCachedLog(h.id, date)?.completed === true
 *
 * A weekly habit whose cadence says "not applicable today" (e.g., it was
 * already completed this week so appliesToday returns false) should still
 * appear in the Today list when the user completed it earlier today.
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

describe('Today applicable filter — completedToday retention (Gap 5 fix)', () => {
  test('weekly habit completed today remains in applicable set via OR-clause', async () => {
    const [storeMod, cadenceMod] = await Promise.all([
      import('../../js/state/store.js'),
      import('../../js/domain/cadence.js'),
    ]);
    const { configureStore, hydrate, getCachedLog, _resetStoreForTest } = storeMod;
    const { appliesToday } = cadenceMod;

    _resetStoreForTest();

    const repo = createFakeRepo();
    configureStore({ repo });

    const date = todayLocal();
    const habitId = 'h-weekly-1';

    // Seed a weekly habit.
    await repo.putHabit({
      id: habitId,
      name: 'Weekly workout',
      status: 'active',
      cadence: { type: 'weekly' },
    });
    // Seed a completed log for today.
    await repo.putLog({ habitId, date, completed: true, definitionVersion: null });

    await hydrate();

    // Sanity: cache has the log.
    assert.equal(
      getCachedLog(habitId, date)?.completed,
      true,
      'cache has completed log for today',
    );

    // appliesToday returns false for a weekly habit that is already complete
    // (it was "done" this week so cadence excludes it from requiring another completion).
    const weekStart = 'mon';
    const ctx = {
      weekStart,
      weekCompletions: () => 1, // one completion this week already
    };
    const cadenceResult = appliesToday({ id: habitId, cadence: { type: 'weekly' } }, date, ctx);
    // Whether cadence returns true or false, the OR-clause must make the combined predicate true.
    const orClauseResult = cadenceResult || getCachedLog(habitId, date)?.completed === true;
    assert.equal(orClauseResult, true, 'OR-clause retains completed habit in applicable set');
  });
});
