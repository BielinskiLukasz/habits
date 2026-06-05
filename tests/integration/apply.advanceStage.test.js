/**
 * @file Integration tests for `apply({ type: 'advanceStage' })` and
 * `apply({ type: 'demoteStage' })` end-to-end (STAGE-03..07, Phase 04 plan 06 Task 2).
 *
 * Verifies:
 *   - advanceStage increments currentStageIndex when a trigger fires
 *   - advanceStage is a no-op at the last stage (guard)
 *   - advanceStage with triggerType:'manual' advances when stage.allowManual:true
 *   - advanceStage with advanceAfterDays fires when enough days have elapsed
 *   - demoteStage decrements currentStageIndex (min 0)
 *   - demoteStage at index 0 remains at 0
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

/** Returns a YYYY-MM-DD date N days before today. */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const HABIT_ID = 'habit-stage-test-001';

/**
 * Seed a habit with 3 stages for use in tests.
 * stage[0]: allowManual:true, advanceAfterDays:30
 * stage[1]: allowManual:false
 * stage[2]: (final stage — no advance from here)
 */
function seedMultiStageHabit(repo, overrides = {}) {
  repo._stores.habits.set(HABIT_ID, {
    id: HABIT_ID,
    name: 'Strength training',
    status: 'active',
    wave: 1,
    cadence: { type: 'daily' },
    targetType: 'binary',
    target: null,
    stages: [
      { name: 'Beginner', allowManual: true, advanceAfterDays: 30 },
      { name: 'Intermediate', allowManual: true, advanceAfterDays: 30 },
      { name: 'Advanced', allowManual: false },
    ],
    currentStageIndex: 0,
    stageStartedAt: '2026-05-01',
    createdAt: '2026-05-01',
    startDate: '2026-05-01',
    lastCompletedDate: null,
    masteryThresholdOverride: null,
    masteryWindowOverride: null,
    name_pl: null,
    ...overrides,
  });
}

let repo;
beforeEach(() => {
  repo = createFakeRepo();
});

describe('apply(advanceStage) — manual trigger', () => {
  test('advanceStage with triggerType:manual increments currentStageIndex to 1', async () => {
    seedMultiStageHabit(repo);
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'advanceStage',
      payload: { habitId: HABIT_ID, triggerType: 'manual' },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 1, 'currentStageIndex should advance to 1');
    assert.equal(habit.stageStartedAt, todayYMD(), 'stageStartedAt should update to today');
  });

  test('advanceStage emits events row with inverse demoteStage', async () => {
    seedMultiStageHabit(repo);
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'advanceStage',
      payload: { habitId: HABIT_ID, triggerType: 'manual' },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.type, 'advanceStage');
    assert.ok(evt.inverse, 'inverse must be present');
    assert.equal(evt.inverse.type, 'demoteStage');
    assert.equal(evt.inverse.payload.habitId, HABIT_ID);
  });
});

describe('apply(advanceStage) — no-op at last stage', () => {
  test('advanceStage at last stage (index 2 of 3) is a no-op', async () => {
    seedMultiStageHabit(repo, { currentStageIndex: 2 });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'advanceStage',
      payload: { habitId: HABIT_ID, triggerType: 'manual' },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 2, 'should remain at last stage (no advance)');
  });

  test('advanceStage at single-stage habit (only 1 stage) is a no-op', async () => {
    repo._stores.habits.set(HABIT_ID, {
      id: HABIT_ID,
      name: 'Simple habit',
      status: 'active',
      wave: 0,
      cadence: { type: 'daily' },
      targetType: 'binary',
      target: null,
      stages: [{ name: 'Only stage', allowManual: true }],
      currentStageIndex: 0,
      stageStartedAt: '2026-05-01',
      createdAt: '2026-05-01',
      startDate: '2026-05-01',
      lastCompletedDate: null,
      masteryThresholdOverride: null,
      masteryWindowOverride: null,
      name_pl: null,
    });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'advanceStage',
      payload: { habitId: HABIT_ID, triggerType: 'manual' },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 0, 'single-stage habit should remain at 0');
  });
});

describe('apply(advanceStage) — after-n-days trigger', () => {
  test('advanceStage fires after-n-days when 30+ days have elapsed', async () => {
    // stageStartedAt 30 days ago triggers advanceAfterDays:30
    seedMultiStageHabit(repo, { stageStartedAt: daysAgo(30) });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'advanceStage',
      // No manual trigger — relies on after-n-days check
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 1, 'should advance via after-n-days trigger');
  });

  test('advanceStage does NOT fire when fewer than 30 days have elapsed', async () => {
    // stageStartedAt only 10 days ago — not enough for advanceAfterDays:30
    seedMultiStageHabit(repo, {
      stageStartedAt: daysAgo(10),
      stages: [
        { name: 'Beginner', allowManual: false, advanceAfterDays: 30 },
        { name: 'Advanced', allowManual: false },
      ],
    });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'advanceStage',
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 0, 'should NOT advance before 30 days');
  });
});

describe('apply(demoteStage) — decrements index', () => {
  test('demoteStage decrements currentStageIndex from 1 to 0', async () => {
    seedMultiStageHabit(repo, { currentStageIndex: 1 });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'demoteStage',
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 0, 'currentStageIndex should decrement to 0');
    assert.equal(habit.stageStartedAt, todayYMD(), 'stageStartedAt should update to today');
  });

  test('demoteStage at index 0 stays at 0 (floor guard)', async () => {
    seedMultiStageHabit(repo, { currentStageIndex: 0 });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'demoteStage',
      payload: { habitId: HABIT_ID },
    });

    const habit = repo._stores.habits.get(HABIT_ID);
    assert.equal(habit.currentStageIndex, 0, 'should not go below 0');
  });

  test('demoteStage emits events row with inverse advanceStage', async () => {
    seedMultiStageHabit(repo, { currentStageIndex: 1 });
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'demoteStage',
      payload: { habitId: HABIT_ID },
    });

    const evt = repo._stores.events.get(eventId);
    assert.equal(evt.type, 'demoteStage');
    assert.equal(evt.inverse.type, 'advanceStage');
    assert.equal(evt.inverse.payload.habitId, HABIT_ID);
    assert.equal(evt.inverse.payload.triggerType, 'manual');
  });
});

describe('apply(advanceStage) + apply(demoteStage) round-trip', () => {
  test('advance then demote returns to original index', async () => {
    seedMultiStageHabit(repo);
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({ type: 'advanceStage', payload: { habitId: HABIT_ID, triggerType: 'manual' } });
    assert.equal(repo._stores.habits.get(HABIT_ID).currentStageIndex, 1);

    await apply.apply({ type: 'demoteStage', payload: { habitId: HABIT_ID } });
    assert.equal(repo._stores.habits.get(HABIT_ID).currentStageIndex, 0);
  });
});
