/**
 * @file Integration tests for `apply({ type: 'logSlot' })` end-to-end
 * (LOG-03, LOG-04, LOG-05, LOG-06, D-89, Phase 04 plan 06 Task 3).
 *
 * Verifies:
 *   - logSlot writes log row with slots array (no completed field)
 *   - lastCompletedDate updates when all slots are checked
 *   - lastCompletedDate remains null when not all slots checked
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

const HABIT_ID = 'habit-slot-test-001';
const DATE = todayYMD();

const ALL_UNCHECKED = [
  { name: 'A', checked: false },
  { name: 'B', checked: false },
  { name: 'C', checked: false },
];

const PARTIAL_CHECKED = [
  { name: 'A', checked: true },
  { name: 'B', checked: false },
  { name: 'C', checked: false },
];

const ALL_CHECKED = [
  { name: 'A', checked: true },
  { name: 'B', checked: true },
  { name: 'C', checked: true },
];

let repo;
beforeEach(() => {
  repo = createFakeRepo();
  // Seed a slot-checklist habit with target:3
  repo._stores.habits.set(HABIT_ID, {
    id: HABIT_ID,
    name: 'Morning routine',
    status: 'active',
    wave: 0,
    cadence: { type: 'daily' },
    targetType: 'slot-checklist',
    target: 3,
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

describe('apply(logSlot) — log row shape', () => {
  test('logSlot writes a log row with slots array (no completed field)', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: PARTIAL_CHECKED },
    });

    const logKey = JSON.stringify([HABIT_ID, DATE]);
    const log = repo._stores.logs.get(logKey);
    assert.ok(log, 'log row should exist');
    assert.deepEqual(log.slots, PARTIAL_CHECKED);
    assert.equal(log.habitId, HABIT_ID);
    assert.equal(log.date, DATE);
    assert.equal(log.definitionVersion, null);
    assert.equal(log.completed, undefined, 'completed field must NOT be present');
    assert.equal(log.count, undefined, 'count field must NOT be present');
  });
});

describe('apply(logSlot) — lastCompletedDate semantics', () => {
  test('logSlot does NOT set lastCompletedDate when not all slots checked', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: PARTIAL_CHECKED },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, null, 'lastCompletedDate should remain null (1/3 checked)');
  });

  test('logSlot sets lastCompletedDate when all slots are checked', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: ALL_CHECKED },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, DATE, 'lastCompletedDate should be today (all 3 checked)');
  });

  test('logSlot with none checked does not set lastCompletedDate', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: ALL_UNCHECKED },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, null, 'lastCompletedDate should remain null (none checked)');
  });

  test('logSlot resets lastCompletedDate when slots unchecked after prior complete', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // First: complete (all checked)
    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: ALL_CHECKED },
    });
    assert.equal(repo._stores.habits.get(HABIT_ID).lastCompletedDate, DATE);

    // Then: partial (un-check some)
    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: PARTIAL_CHECKED },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.lastCompletedDate, null, 'lastCompletedDate should reset when not all checked');
  });
});

describe('apply(logSlot) — events row and inverse', () => {
  test('logSlot emits events row with inverse restoreLogRow', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: PARTIAL_CHECKED },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.type, 'logSlot');
    assert.equal(evt.payload.habitId, HABIT_ID);
    assert.deepEqual(evt.payload.slots, PARTIAL_CHECKED);
    assert.ok(evt.inverse, 'inverse must be present');
    assert.equal(evt.inverse.type, 'restoreLogRow');
    assert.equal(evt.inverse.payload.habitId, HABIT_ID);
    assert.equal(evt.inverse.payload.date, DATE);
    // prior should be undefined (no prior log row existed)
    assert.equal(evt.inverse.payload.prior, undefined);
  });

  test('logSlot captures prior log row in inverse', async () => {
    // Pre-seed a prior log row
    repo._stores.logs.set(JSON.stringify([HABIT_ID, DATE]), {
      habitId: HABIT_ID,
      date: DATE,
      slots: PARTIAL_CHECKED,
      definitionVersion: null,
    });

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: ALL_CHECKED },
    });

    const evt = repo._stores.events.get(eventId);
    assert.deepEqual(evt.inverse.payload.prior.slots, PARTIAL_CHECKED,
      'prior should capture previous slots state');
  });
});

describe('apply(logSlot) — broadcastKeys', () => {
  test('broadcastKeys returns {habitId, date}', async () => {
    const broadcastKeys = [];
    const apply = await freshApply();
    apply.configure({
      repo,
      broadcast: (msg) => broadcastKeys.push(msg.keys),
      trackTx: () => {},
    });

    await apply.apply({
      type: 'logSlot',
      payload: { habitId: HABIT_ID, date: DATE, slots: ALL_CHECKED },
    });

    assert.equal(broadcastKeys.length, 1);
    assert.equal(broadcastKeys[0].habitId, HABIT_ID);
    assert.equal(broadcastKeys[0].date, DATE);
  });
});
