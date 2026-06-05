/**
 * @file Integration tests for `apply({ type: 'archiveHabit' })` and
 * `apply({ type: 'restoreHabit' })` end-to-end (CATALOG-05, CATALOG-06,
 * Phase 04 plan 06 Task 1).
 *
 * Verifies:
 *   - archiveHabit sets habit.status to 'archived'
 *   - restoreHabit sets habit.status to 'active'
 *   - logs in the store are untouched after archive/restore
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

/** Today's date as YYYY-MM-DD in local time (matches todayLocal() in date.js). */
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const HABIT_ID = 'habit-archive-test-001';

let repo;
beforeEach(() => {
  repo = createFakeRepo();
  // Seed a habit with status 'active'
  repo._stores.habits.set(HABIT_ID, {
    id: HABIT_ID,
    name: 'Morning walk',
    status: 'active',
    wave: 1,
    cadence: { type: 'daily' },
    targetType: 'binary',
    target: null,
    stages: [],
    currentStageIndex: 0,
    stageStartedAt: todayYMD(),
    createdAt: todayYMD(),
    startDate: todayYMD(),
    lastCompletedDate: null,
    masteryThresholdOverride: null,
    masteryWindowOverride: null,
    name_pl: null,
  });
  // Seed a log row to verify it is untouched
  repo._stores.logs.set(JSON.stringify([HABIT_ID, todayYMD()]), {
    habitId: HABIT_ID,
    date: todayYMD(),
    completed: true,
    definitionVersion: null,
  });
});

describe('apply(archiveHabit) — sets status to archived', () => {
  test('archiveHabit sets habit.status to "archived"', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'archiveHabit',
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.ok(habit, 'habit row should still exist');
    assert.equal(habit.status, 'archived', 'status should be archived');
  });

  test('archiveHabit preserves all other habit fields', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'archiveHabit',
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.name, 'Morning walk');
    assert.equal(habit.wave, 1);
    assert.equal(habit.id, HABIT_ID);
  });

  test('archiveHabit does not touch log rows', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'archiveHabit',
      payload: { habitId: HABIT_ID },
    });

    const logKey = JSON.stringify([HABIT_ID, todayYMD()]);
    const log = repo._stores.logs.get(logKey);
    assert.ok(log, 'log row should still exist');
    assert.equal(log.completed, true, 'log should be unchanged');
  });

  test('archiveHabit emits events row with correct type', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'archiveHabit',
      payload: { habitId: HABIT_ID },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.type, 'archiveHabit');
    assert.equal(evt.payload.habitId, HABIT_ID);
    assert.ok(evt.inverse, 'inverse must be present');
    assert.equal(evt.inverse.type, 'restoreHabit');
    assert.equal(evt.inverse.payload.habitId, HABIT_ID);
  });
});

describe('apply(restoreHabit) — sets status back to active', () => {
  beforeEach(async () => {
    // Archive the habit first so restoreHabit has something to restore
    repo._stores.habits.get(HABIT_ID).status = 'archived';
  });

  test('restoreHabit sets habit.status to "active"', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'restoreHabit',
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.status, 'active', 'status should be active');
  });

  test('restoreHabit does not touch log rows', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'restoreHabit',
      payload: { habitId: HABIT_ID },
    });

    const logKey = JSON.stringify([HABIT_ID, todayYMD()]);
    const log = repo._stores.logs.get(logKey);
    assert.ok(log, 'log row should still exist');
    assert.equal(log.completed, true, 'log should be unchanged');
  });

  test('restoreHabit inverse is archiveHabit', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'restoreHabit',
      payload: { habitId: HABIT_ID },
    });

    const evt = repo._stores.events.get(eventId);
    assert.equal(evt.inverse.type, 'archiveHabit');
    assert.equal(evt.inverse.payload.habitId, HABIT_ID);
  });
});

describe('apply(archiveHabit) round-trip', () => {
  test('archive then restore returns to original status', async () => {
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({ type: 'archiveHabit', payload: { habitId: HABIT_ID } });
    assert.equal(repo._stores.habits.get(HABIT_ID).status, 'archived');

    await apply.apply({ type: 'restoreHabit', payload: { habitId: HABIT_ID } });
    assert.equal(repo._stores.habits.get(HABIT_ID).status, 'active');
  });
});
