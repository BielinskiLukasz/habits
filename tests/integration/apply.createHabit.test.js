/**
 * @file Integration tests for `apply({ type: 'createHabit' })` end-to-end
 * (CATALOG-01, CATALOG-07, Phase 04 plan 05 Task 2; SCHED-01, SCHED-02 Phase 07 plan 02).
 *
 * Verifies:
 *   - createHabit atomically writes habits row + habit_versions row + events row
 *   - startDate payload is respected (effectiveFrom = startDate)
 *   - default startDate = today when omitted
 *   - returned value is a UUID event id
 *   - status is derived from startDate: future startDate → 'scheduled', past/today → 'active'
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

describe('apply(createHabit) — single-tx write to habits + habit_versions + events', () => {
  test('createHabit writes habits row, habit_versions row, and events row atomically', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Morning walk',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    // Returns a v4 UUID.
    assert.match(eventId, UUID_V4, `eventId should be a v4 UUID; got ${eventId}`);

    // habits store: exactly one row.
    const habits = Array.from(repo._stores.habits.values());
    assert.equal(habits.length, 1, 'habits store should have 1 row');
    const habit = habits[0];
    assert.equal(habit.name, 'Morning walk');
    assert.equal(habit.wave, 1);
    assert.equal(habit.status, 'active');
    assert.match(habit.id, UUID_V4, 'habit.id should be a v4 UUID');

    // habit_versions store: exactly one row with effectiveFrom = today.
    const versions = Array.from(repo._stores.habit_versions.values());
    assert.equal(versions.length, 1, 'habit_versions store should have 1 row');
    const version = versions[0];
    assert.equal(version.habitId, habit.id);
    assert.equal(version.effectiveFrom, todayYMD(), 'effectiveFrom should default to today');
    assert.equal(version.name, 'Morning walk');

    // events store: exactly one row.
    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.type, 'createHabit');
    assert.equal(evt.payload.name, 'Morning walk');
    assert.ok(evt.inverse, 'inverse must be present');
    assert.equal(evt.inverse.type, 'deleteHabit');
    assert.equal(evt.inverse.payload.habitId, habit.id);
  });

  test('createHabit with explicit startDate uses it for effectiveFrom and habit fields', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Strength training',
        wave: 3,
        cadence: { type: 'weekly', days: ['mon', 'wed', 'fri'] },
        targetType: 'binary',
        startDate: '2026-08-01',
      },
    });

    const habits = Array.from(repo._stores.habits.values());
    assert.equal(habits.length, 1);
    const habit = habits[0];
    assert.equal(habit.startDate, '2026-08-01');
    assert.equal(habit.stageStartedAt, '2026-08-01');
    assert.equal(habit.createdAt, '2026-08-01');

    const versions = Array.from(repo._stores.habit_versions.values());
    assert.equal(versions.length, 1);
    assert.equal(versions[0].effectiveFrom, '2026-08-01');
  });

  test('createHabit returns a UUID event id string', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Reading',
        wave: 2,
        cadence: { type: 'daily' },
        targetType: 'binary',
      },
    });

    assert.equal(typeof eventId, 'string');
    assert.match(eventId, UUID_V4);
  });

  test('createHabit inverse has type deleteHabit with habitId', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'createHabit',
      payload: { name: 'Meditation', wave: 0, cadence: { type: 'daily' }, targetType: 'binary' },
    });

    const evt = repo._stores.events.get(eventId);
    assert.equal(evt.inverse.type, 'deleteHabit');
    assert.match(evt.inverse.payload.habitId, UUID_V4);
  });

  test('createHabit habit row has correct default fields', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: { name: 'Cold shower', wave: 1, cadence: { type: 'daily' }, targetType: 'binary' },
    });

    const habits = Array.from(repo._stores.habits.values());
    const habit = habits[0];
    assert.equal(habit.status, 'active');
    assert.deepEqual(habit.stages, []);
    assert.equal(habit.currentStageIndex, 0);
    assert.equal(habit.masteryThresholdOverride, null);
    assert.equal(habit.masteryWindowOverride, null);
    assert.equal(habit.lastCompletedDate, null);
    assert.equal(habit.name_pl, null);
    assert.equal(habit.target, null);
    assert.equal(habit.targetType, 'binary');
  });

  // SCHED-01, SCHED-02 — status derived from startDate
  test('createHabit with future startDate stores habit as scheduled', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Future habit',
        wave: 5,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2099-06-01',
      },
    });

    const habits = Array.from(repo._stores.habits.values());
    assert.equal(habits.length, 1);
    assert.equal(habits[0].status, 'scheduled');
  });

  test('createHabit with past startDate stores habit as active', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Past habit',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: '2020-01-01',
      },
    });

    const habits = Array.from(repo._stores.habits.values());
    assert.equal(habits.length, 1);
    assert.equal(habits[0].status, 'active');
  });

  test('createHabit with startDate equal to today stores habit as active', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'createHabit',
      payload: {
        name: 'Today habit',
        wave: 1,
        cadence: { type: 'daily' },
        targetType: 'binary',
        startDate: todayYMD(),
      },
    });

    const habits = Array.from(repo._stores.habits.values());
    assert.equal(habits.length, 1);
    assert.equal(habits[0].status, 'active');
  });
});
