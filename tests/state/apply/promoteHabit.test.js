/**
 * @file Tests for promoteHabit handler (SCHED-04).
 *
 * Verifies the handler correctly transitions a habit from scheduled → active,
 * preserves undo structure, and exports the broadcastKeys function.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { handlePromoteHabit } from '../../../js/state/apply/promoteHabit.js';

describe('promoteHabit handler (SCHED-04)', () => {
  // Test 1: handlePromoteHabit accepts event with habitId and reads habit
  test('reads habit from repo and returns structured result', async () => {
    const mockRepo = {
      getHabit: async (id) => ({
        id: 'habit-123',
        name: 'Morning walk',
        status: 'scheduled',
        wave: 1,
        startDate: '2026-08-01',
      }),
    };

    const event = {
      type: 'promoteHabit',
      payload: { habitId: 'habit-123' },
    };

    const result = await handlePromoteHabit(event, mockRepo);

    assert(result, 'handler returns a result object');
    assert(result.storeNames, 'result has storeNames property');
    assert(result.writes, 'result has writes property');
    assert(result.inverse, 'result has inverse property');
  });

  // Test 2: habit.status is set to 'active' in the writes value
  test('sets habit.status to active', async () => {
    const mockRepo = {
      getHabit: async () => ({
        id: 'habit-456',
        name: 'Evening routine',
        status: 'scheduled',
        wave: 2,
      }),
    };

    const event = {
      type: 'promoteHabit',
      payload: { habitId: 'habit-456' },
    };

    const result = await handlePromoteHabit(event, mockRepo);

    assert.strictEqual(result.storeNames[0], 'habits', 'writes to habits store');
    assert.strictEqual(result.writes.length, 1, 'single write entry');
    assert.strictEqual(result.writes[0].store, 'habits', 'write targets habits store');
    assert.strictEqual(result.writes[0].value.status, 'active', 'status is active');
  });

  // Test 3: inverse type is 'demoteHabit' with same habitId
  test('inverse type is demoteHabit', async () => {
    const mockRepo = {
      getHabit: async () => ({
        id: 'habit-789',
        name: 'Test habit',
        status: 'scheduled',
      }),
    };

    const event = {
      type: 'promoteHabit',
      payload: { habitId: 'habit-789' },
    };

    const result = await handlePromoteHabit(event, mockRepo);

    assert.strictEqual(result.inverse.type, 'demoteHabit', 'inverse type is demoteHabit');
    assert.strictEqual(
      result.inverse.payload.habitId,
      'habit-789',
      'inverse carries same habitId'
    );
  });

  // Test 4: broadcastKeys function returns object with habitId key
  test('broadcastKeys returns object with habitId', () => {
    assert(
      typeof handlePromoteHabit.broadcastKeys === 'function',
      'broadcastKeys is a function'
    );

    const event = {
      type: 'promoteHabit',
      payload: { habitId: 'habit-broadcast-test' },
    };

    const keys = handlePromoteHabit.broadcastKeys(event);

    assert(keys, 'broadcastKeys returns truthy result');
    assert.strictEqual(
      keys.habitId,
      'habit-broadcast-test',
      'keys has habitId property'
    );
  });

  // Test 5: handler does not call repo.put or modify other stores
  test('does not make direct repo.put calls', async () => {
    let putCalled = false;

    const mockRepo = {
      getHabit: async () => ({
        id: 'habit-put-test',
        name: 'No direct put',
        status: 'scheduled',
      }),
      put: () => {
        putCalled = true;
      },
    };

    const event = {
      type: 'promoteHabit',
      payload: { habitId: 'habit-put-test' },
    };

    await handlePromoteHabit(event, mockRepo);

    // The handler should NOT call repo.put — it returns the mutation for apply.js to consume
    assert.strictEqual(putCalled, false, 'handler does not call repo.put');
  });

  // Test 6: handler preserves other habit properties when setting status
  test('preserves all other habit properties', async () => {
    const originalHabit = {
      id: 'habit-preserve-test',
      name: 'Preserve this',
      status: 'scheduled',
      wave: 3,
      stage: 1,
      cadence: 'daily',
      startDate: '2026-08-15',
      customField: 'should-persist',
    };

    const mockRepo = {
      getHabit: async () => originalHabit,
    };

    const event = {
      type: 'promoteHabit',
      payload: { habitId: 'habit-preserve-test' },
    };

    const result = await handlePromoteHabit(event, mockRepo);
    const updated = result.writes[0].value;

    assert.strictEqual(updated.id, 'habit-preserve-test', 'id preserved');
    assert.strictEqual(updated.name, 'Preserve this', 'name preserved');
    assert.strictEqual(updated.wave, 3, 'wave preserved');
    assert.strictEqual(updated.stage, 1, 'stage preserved');
    assert.strictEqual(updated.cadence, 'daily', 'cadence preserved');
    assert.strictEqual(updated.startDate, '2026-08-15', 'startDate preserved');
    assert.strictEqual(updated.customField, 'should-persist', 'custom fields preserved');
  });
});
