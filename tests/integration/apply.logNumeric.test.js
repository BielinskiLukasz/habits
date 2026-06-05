/**
 * @file Integration tests for `apply({ type: 'logNumeric' })` end-to-end
 * (LOG-02, LOG-05, LOG-06, D-88, Phase 04 plan 06 Task 3).
 *
 * Verifies:
 *   - logNumeric writes log row with count field (no completed field)
 *   - lastCompletedDate updates when count >= target
 *   - lastCompletedDate remains null when count < target
 *   - lastCompletedDate resets when count drops to 0
 *   - inverse is restoreLogRow with prior state
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

/** Today's date as YYYY-MM-DD in local time. */
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const HABIT_ID = 'habit-numeric-test-001';
const DATE = todayYMD();

let repo;
beforeEach(() => {
  repo = createFakeRepo();
  // Seed a numeric habit with target:5
  repo._stores.habits.set(HABIT_ID, {
    id: HABIT_ID,
    name: 'Push-ups',
    status: 'active',
    wave: 2,
    cadence: { type: 'daily' },
    targetType: 'numeric',
    target: 5,
    stages: [],
    currentStageIndex: 0,
    stageStartedAt: DATE,
    createdAt: DATE,
    startDate: DATE,
    lastCompletedDate: null,
    masteryThresholdOverride: null,
    masteryWindowOverride: null,
    name_pl: null,
  });
});

describe('apply(logNumeric) — log row shape', () => {
  test('logNumeric writes a log row with count field (no completed field)', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 3 },
    });

    const logKey = JSON.stringify([HABIT_ID, DATE]);
    const log = repo._stores.logs.get(logKey);
    assert.ok(log, 'log row should exist');
    assert.equal(log.count, 3);
    assert.equal(log.habitId, HABIT_ID);
    assert.equal(log.date, DATE);
    assert.equal(log.definitionVersion, null);
    assert.equal(log.completed, undefined, 'completed field must NOT be present');
  });

  test('logNumeric does NOT set lastCompletedDate when count < target', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 3 },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, null, 'lastCompletedDate should remain null (3 < 5)');
  });

  test('logNumeric sets lastCompletedDate to today when count >= target', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 5 },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, DATE, 'lastCompletedDate should be today (5 >= 5)');
  });

  test('logNumeric sets lastCompletedDate when count exceeds target', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 7 },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, DATE, 'lastCompletedDate should be today (7 >= 5)');
  });
});

describe('apply(logNumeric) — lastCompletedDate reset', () => {
  test('logNumeric with count:0 resets lastCompletedDate to null', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // First, complete with count:5
    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 5 },
    });
    assert.equal(repo._stores.habits.get(HABIT_ID).lastCompletedDate, DATE);

    // Then reset with count:0
    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 0 },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, null, 'lastCompletedDate should reset to null');
  });
});

describe('apply(logNumeric) — events row and inverse', () => {
  test('logNumeric emits events row with inverse restoreLogRow', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 3 },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.type, 'logNumeric');
    assert.equal(evt.payload.habitId, HABIT_ID);
    assert.equal(evt.payload.count, 3);
    assert.ok(evt.inverse, 'inverse must be present');
    assert.equal(evt.inverse.type, 'restoreLogRow');
    assert.equal(evt.inverse.payload.habitId, HABIT_ID);
    assert.equal(evt.inverse.payload.date, DATE);
    // prior should be undefined (no prior log row existed)
    assert.equal(evt.inverse.payload.prior, undefined);
  });

  test('logNumeric captures prior log row in inverse', async () => {
    // Pre-seed a prior log row
    repo._stores.logs.set(JSON.stringify([HABIT_ID, DATE]), {
      habitId: HABIT_ID,
      date: DATE,
      count: 2,
      definitionVersion: null,
    });

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 5 },
    });

    const evt = repo._stores.events.get(eventId);
    assert.equal(evt.inverse.payload.prior.count, 2, 'prior should capture previous count');
  });
});

describe('apply(logNumeric) — broadcastKeys', () => {
  test('broadcastKeys returns {habitId, date}', async () => {
    const broadcastKeys = [];
    const apply = await freshApply();
    apply.configure({
      repo,
      broadcast: (msg) => broadcastKeys.push(msg.keys),
      trackTx: () => {},
    });

    await apply.apply({
      type: 'logNumeric',
      payload: { habitId: HABIT_ID, date: DATE, count: 3 },
    });

    assert.equal(broadcastKeys.length, 1);
    assert.equal(broadcastKeys[0].habitId, HABIT_ID);
    assert.equal(broadcastKeys[0].date, DATE);
  });
});
