/**
 * @file Stage advancement trigger integration test (STAGE-01..07).
 * Fleshed out in plan 04-06 (previously a stub).
 *
 * These tests verify `evaluateStageTriggers` and `demoteStage` from
 * `js/domain/stage.js` in integration, covering all 4 trigger types
 * (manual, scheduled-by-week, after-n-days, after-n-days-with-threshold).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStageTriggers, demoteStage } from '../../js/domain/stage.js';

/** A minimal 3-stage habit fixture for reuse across tests. */
function makeHabit(overrides = {}) {
  return {
    id: 'h1',
    stages: [
      { name: 'Beginner', allowManual: true, advanceAfterDays: 30 },
      { name: 'Intermediate', allowManual: true, advanceAfterDays: 14 },
      { name: 'Advanced' },
    ],
    currentStageIndex: 0,
    stageStartedAt: '2026-01-01',
    ...overrides,
  };
}

describe('evaluateStageTriggers — manual trigger', () => {
  test('manual trigger fires when stage.allowManual:true and ctx.triggerType:manual', () => {
    const habit = makeHabit();
    const result = evaluateStageTriggers(habit, '2026-01-15', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.nextStageIndex, 1);
    assert.equal(result.triggeredBy, 'manual');
  });

  test('manual trigger does NOT fire when stage.allowManual:false', () => {
    const habit = makeHabit({
      stages: [
        { name: 'Locked', allowManual: false },
        { name: 'Next' },
      ],
    });
    const result = evaluateStageTriggers(habit, '2026-01-15', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, false);
  });

  test('manual trigger does NOT fire when ctx.triggerType is not manual', () => {
    const habit = makeHabit();
    const result = evaluateStageTriggers(habit, '2026-01-15', {});
    // No auto trigger fired either (stageStartedAt 2026-01-01, only 14 days, need 30)
    assert.equal(result.shouldAdvance, false);
  });
});

describe('evaluateStageTriggers — after-n-days trigger', () => {
  test('after-n-days fires when daysBetween >= advanceAfterDays', () => {
    const habit = makeHabit({
      stages: [
        { name: 'Early', allowManual: false, advanceAfterDays: 7 },
        { name: 'Later' },
      ],
      stageStartedAt: '2026-01-01',
    });
    // 8 days later
    const result = evaluateStageTriggers(habit, '2026-01-09', {});
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days');
  });

  test('after-n-days does NOT fire before advanceAfterDays', () => {
    const habit = makeHabit({
      stages: [
        { name: 'Early', allowManual: false, advanceAfterDays: 30 },
        { name: 'Later' },
      ],
      stageStartedAt: '2026-01-01',
    });
    // Only 10 days
    const result = evaluateStageTriggers(habit, '2026-01-11', {});
    assert.equal(result.shouldAdvance, false);
  });
});

describe('evaluateStageTriggers — scheduled-by-week trigger', () => {
  test('scheduled-by-week fires when date >= stage.targetWeekDate', () => {
    const habit = makeHabit({
      stages: [
        { name: 'Wave start', targetWeekDate: '2026-02-02', allowManual: false },
        { name: 'Next wave' },
      ],
    });
    const result = evaluateStageTriggers(habit, '2026-02-02', {});
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'scheduled-by-week');
  });

  test('scheduled-by-week does NOT fire before targetWeekDate', () => {
    const habit = makeHabit({
      stages: [
        { name: 'Wave start', targetWeekDate: '2026-02-02', allowManual: false },
        { name: 'Next wave' },
      ],
    });
    const result = evaluateStageTriggers(habit, '2026-02-01', {});
    assert.equal(result.shouldAdvance, false);
  });
});

describe('evaluateStageTriggers — after-n-days-with-threshold trigger', () => {
  test('fires when both days AND completionPercentage are met', () => {
    const habit = makeHabit({
      stages: [
        {
          name: 'Threshold stage',
          allowManual: false,
          advanceAfterDays: 14,
          advanceAfterDaysThreshold: 80,
        },
        { name: 'Next' },
      ],
      stageStartedAt: '2026-01-01',
    });
    const result = evaluateStageTriggers(habit, '2026-01-20', { completionPercentage: 85 });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days-with-threshold');
  });

  test('does NOT fire when days met but completionPercentage below threshold', () => {
    const habit = makeHabit({
      stages: [
        {
          name: 'Threshold stage',
          allowManual: false,
          advanceAfterDays: 14,
          advanceAfterDaysThreshold: 80,
        },
        { name: 'Next' },
      ],
      stageStartedAt: '2026-01-01',
    });
    const result = evaluateStageTriggers(habit, '2026-01-20', { completionPercentage: 70 });
    assert.equal(result.shouldAdvance, false);
  });
});

describe('evaluateStageTriggers — last stage guard (T-04-03)', () => {
  test('returns shouldAdvance:false when already at last stage', () => {
    const habit = makeHabit({ currentStageIndex: 2 }); // 3 stages, index 2 = last
    const result = evaluateStageTriggers(habit, '2026-12-31', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, false);
    assert.equal(result.nextStageIndex, 2);
    assert.equal(result.triggeredBy, null);
  });
});

describe('demoteStage — floor guard (T-04-03b)', () => {
  test('decrements from 2 to 1', () => {
    const { newStageIndex } = demoteStage({ currentStageIndex: 2 });
    assert.equal(newStageIndex, 1);
  });

  test('decrements from 1 to 0', () => {
    const { newStageIndex } = demoteStage({ currentStageIndex: 1 });
    assert.equal(newStageIndex, 0);
  });

  test('floors at 0 when already at 0', () => {
    const { newStageIndex } = demoteStage({ currentStageIndex: 0 });
    assert.equal(newStageIndex, 0);
  });

  test('handles undefined currentStageIndex (defaults to 0, floors at 0)', () => {
    const { newStageIndex } = demoteStage({});
    assert.equal(newStageIndex, 0);
  });
});
