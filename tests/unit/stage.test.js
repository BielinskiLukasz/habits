/** @file Stage advancement trigger unit tests (STAGE-01..07). Fleshed out in plan 04-03. */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStageTriggers, demoteStage } from '../../js/domain/stage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal multi-stage habit for testing. */
function makeHabit(overrides = {}) {
  return {
    id: 'h1',
    stages: [
      { label: 'Stage 1', target: 10 },
      { label: 'Stage 2', target: 20 },
      { label: 'Stage 3', target: 30 },
    ],
    currentStageIndex: 0,
    stageStartedAt: '2026-05-01',
    ...overrides,
  };
}

/** Empty ctx for use when no trigger context is needed. */
const CTX_EMPTY = {};

// ---------------------------------------------------------------------------
// evaluateStageTriggers — already at last stage
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — already at last stage', () => {
  it('returns shouldAdvance:false when habit has only 1 stage (nothing to advance to)', () => {
    const habit = {
      id: 'h1',
      stages: [{ label: 'Only stage', target: 10 }],
      currentStageIndex: 0,
      stageStartedAt: '2026-05-01',
    };
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('returns shouldAdvance:false when currentStageIndex is at last stage (3 stages, index 2)', () => {
    const habit = makeHabit({ currentStageIndex: 2 });
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('returns triggeredBy:null when already at last stage', () => {
    const habit = makeHabit({ currentStageIndex: 2 });
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.triggeredBy, null);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — manual trigger
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — manual trigger (STAGE-02)', () => {
  it('fires when allowManual:true and ctx.triggerType === "manual"', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'manual');
    assert.equal(result.nextStageIndex, 1);
  });

  it('does NOT fire when allowManual:true but ctx.triggerType is not "manual"', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when allowManual:false and ctx.triggerType === "manual"', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: false },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when allowManual is undefined and ctx.triggerType === "manual"', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10 }, // no allowManual field
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, false);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — scheduled-by-week trigger (STAGE-03)
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — scheduled-by-week trigger (STAGE-03)', () => {
  it('fires on the exact Monday (targetWeekDate date)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, targetWeekDate: '2026-06-01' },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'scheduled-by-week');
    assert.equal(result.nextStageIndex, 1);
  });

  it('fires on a date AFTER the targetWeekDate (Wednesday of same week)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, targetWeekDate: '2026-06-01' },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-03', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'scheduled-by-week');
  });

  it('fires on a date well after targetWeekDate (next month)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, targetWeekDate: '2026-06-01' },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-07-15', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'scheduled-by-week');
  });

  it('does NOT fire on the day BEFORE targetWeekDate (Sunday before target Monday)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, targetWeekDate: '2026-06-01' },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-31', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when targetWeekDate is null (no scheduled trigger configured)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, targetWeekDate: null },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-03', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when targetWeekDate field is absent', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10 }, // no targetWeekDate
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-03', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — after-N-days unconditional trigger (STAGE-04)
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — after-N-days unconditional trigger (STAGE-04)', () => {
  it('fires when exactly N days have elapsed (30 days, boundary)', () => {
    // stageStartedAt 2026-05-01, date 2026-05-31 = 30 days
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-31', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days');
    assert.equal(result.nextStageIndex, 1);
  });

  it('fires when MORE than N days have elapsed (45 days, past threshold)', () => {
    // stageStartedAt 2026-05-01, date 2026-06-15 = 45 days
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-15', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days');
  });

  it('does NOT fire when fewer than N days have elapsed (29 days)', () => {
    // stageStartedAt 2026-05-01, date 2026-05-30 = 29 days
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-30', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when advanceAfterDays is null (field absent means no trigger)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: null },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-15', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire for after-n-days (no threshold) when advanceAfterDaysThreshold is also present', () => {
    // When threshold IS present, this should be handled by after-n-days-with-threshold variant
    // The unconditional after-n-days check should NOT fire if threshold is defined
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 80 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // 30 days elapsed but no completionPercentage — should not fire for unconditional trigger
    const result = evaluateStageTriggers(habit, '2026-05-31', CTX_EMPTY);
    // The threshold variant should not fire either since completionPercentage is 0 (< 80%)
    assert.equal(result.shouldAdvance, false);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — after-N-days with C% threshold trigger (STAGE-05)
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — after-N-days-with-threshold trigger (STAGE-05)', () => {
  it('fires when BOTH days AND completion% conditions are met', () => {
    // 30 days elapsed, 85% completion >= 80% threshold
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 80 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-31', { completionPercentage: 85 });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days-with-threshold');
    assert.equal(result.nextStageIndex, 1);
  });

  it('fires when completion% exactly equals the threshold (boundary: 80% = 80%)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 80 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-31', { completionPercentage: 80 });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days-with-threshold');
  });

  it('does NOT fire when completion% is below threshold (70% < 80%)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 80 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-31', { completionPercentage: 70 });
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when days have not elapsed even with high completion% (25 days, 90%)', () => {
    // stageStartedAt 2026-05-01, date 2026-05-26 = 25 days (< 30)
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 80 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-26', { completionPercentage: 90 });
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when completionPercentage is absent (defaults to 0, below any positive threshold)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 80 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // 30 days elapsed but no completionPercentage provided
    const result = evaluateStageTriggers(habit, '2026-05-31', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('does NOT fire when completionPercentage is 0 explicitly', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 30, advanceAfterDaysThreshold: 1 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-05-31', { completionPercentage: 0 });
    assert.equal(result.shouldAdvance, false);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — OR composition (STAGE-06, Pitfall 3)
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — OR composition (STAGE-06, Pitfall 3)', () => {
  it('returns shouldAdvance:false when NEITHER manual NOR after-n-days fires (25 days, no tap)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // Only 25 days elapsed, no manual tap
    const result = evaluateStageTriggers(habit, '2026-05-26', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });

  it('returns shouldAdvance:true via manual when manual fires but days have not elapsed (25 days, manual tap)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // Only 25 days elapsed but user tapped manually
    const result = evaluateStageTriggers(habit, '2026-05-26', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'manual');
  });

  it('returns shouldAdvance:true via after-n-days when days elapsed but no manual tap (30 days)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // 30 days elapsed, no manual tap
    const result = evaluateStageTriggers(habit, '2026-05-31', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days');
  });

  it('returns triggeredBy:"manual" when BOTH manual and after-n-days fire (first trigger wins)', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true, advanceAfterDays: 30 },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // 30 days elapsed AND manual tap — manual is checked first
    const result = evaluateStageTriggers(habit, '2026-05-31', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'manual');
  });

  it('returns shouldAdvance:true when scheduled-by-week fires but manual does not', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true, targetWeekDate: '2026-06-01' },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // Date is on or after targetWeekDate, no manual tap
    const result = evaluateStageTriggers(habit, '2026-06-03', CTX_EMPTY);
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'scheduled-by-week');
  });

  it('returns shouldAdvance:true when only threshold trigger fires among 4 configured triggers', () => {
    const habit = makeHabit({
      stages: [
        {
          label: 'Stage 1',
          target: 10,
          allowManual: false, // manual disabled
          targetWeekDate: '2026-07-01', // not yet
          advanceAfterDays: 60, // not yet
          advanceAfterDaysThreshold: 80,
        },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // Only 30 days elapsed but threshold check requires 60 days — wait, let's make threshold variant fire
    // Actually advanceAfterDays: 60 means we need 60 days; let's use 30 days with threshold
    const habit2 = makeHabit({
      stages: [
        {
          label: 'Stage 1',
          target: 10,
          allowManual: false,
          targetWeekDate: '2026-07-01', // future, won't fire
          advanceAfterDays: 30,
          advanceAfterDaysThreshold: 80,
        },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // 30 days elapsed, 85% completion — only threshold trigger fires
    const result = evaluateStageTriggers(habit2, '2026-05-31', { completionPercentage: 85 });
    assert.equal(result.shouldAdvance, true);
    assert.equal(result.triggeredBy, 'after-n-days-with-threshold');
  });

  it('all 4 triggers configured — none fire — returns shouldAdvance:false', () => {
    const habit = makeHabit({
      stages: [
        {
          label: 'Stage 1',
          target: 10,
          allowManual: true,
          targetWeekDate: '2026-07-01', // future
          advanceAfterDays: 30,
          advanceAfterDaysThreshold: 80,
        },
        { label: 'Stage 2', target: 20 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 0,
    });
    // 25 days elapsed, no manual tap, date before targetWeekDate, completion 70% < 80%
    const result = evaluateStageTriggers(habit, '2026-05-26', { completionPercentage: 70 });
    assert.equal(result.shouldAdvance, false);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — threat model: cannot advance past last stage (T-04-03)
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — guard: cannot advance past last stage (T-04-03)', () => {
  it('does not advance when already at the last stage index even with manual trigger', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true },
        { label: 'Stage 2', target: 20, allowManual: true },
        { label: 'Stage 3', target: 30, allowManual: true },
      ],
      currentStageIndex: 2, // last stage (index 2 of 3)
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', { triggerType: 'manual' });
    assert.equal(result.shouldAdvance, false);
    assert.equal(result.nextStageIndex, 2);
  });

  it('does not advance when at last stage with after-n-days trigger configured', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, advanceAfterDays: 10 },
        { label: 'Stage 2', target: 20, advanceAfterDays: 10 },
      ],
      stageStartedAt: '2026-05-01',
      currentStageIndex: 1, // last stage (index 1 of 2)
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
  });
});

// ---------------------------------------------------------------------------
// evaluateStageTriggers — return shape validation
// ---------------------------------------------------------------------------

describe('evaluateStageTriggers — return shape', () => {
  it('always returns an object with shouldAdvance, nextStageIndex, triggeredBy', () => {
    const habit = makeHabit();
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'shouldAdvance'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'nextStageIndex'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'triggeredBy'));
  });

  it('returns numeric nextStageIndex when shouldAdvance:true', () => {
    const habit = makeHabit({
      stages: [
        { label: 'Stage 1', target: 10, allowManual: true },
        { label: 'Stage 2', target: 20 },
      ],
      currentStageIndex: 0,
    });
    const result = evaluateStageTriggers(habit, '2026-06-01', { triggerType: 'manual' });
    assert.equal(typeof result.nextStageIndex, 'number');
    assert.equal(result.nextStageIndex, 1);
  });

  it('returns nextStageIndex = currentStageIndex when shouldAdvance:false', () => {
    const habit = makeHabit({ currentStageIndex: 1 });
    const result = evaluateStageTriggers(habit, '2026-06-01', CTX_EMPTY);
    assert.equal(result.shouldAdvance, false);
    assert.equal(result.nextStageIndex, 1);
  });
});

// ---------------------------------------------------------------------------
// demoteStage (STAGE-07, T-04-03b)
// ---------------------------------------------------------------------------

describe('demoteStage (STAGE-07)', () => {
  it('decrements stage by 1 when currentStageIndex > 0', () => {
    const habit = makeHabit({ currentStageIndex: 2 });
    const result = demoteStage(habit);
    assert.equal(result.newStageIndex, 1);
  });

  it('decrements from index 1 to index 0', () => {
    const habit = makeHabit({ currentStageIndex: 1 });
    const result = demoteStage(habit);
    assert.equal(result.newStageIndex, 0);
  });

  it('returns 0 when currentStageIndex is already 0 (floor guard, T-04-03b)', () => {
    const habit = makeHabit({ currentStageIndex: 0 });
    const result = demoteStage(habit);
    assert.equal(result.newStageIndex, 0);
  });

  it('returns 0 when currentStageIndex is undefined (defaults to 0)', () => {
    const habit = { id: 'h1', stages: [{ label: 'Stage 1' }] }; // no currentStageIndex
    const result = demoteStage(habit);
    assert.equal(result.newStageIndex, 0);
  });

  it('returns an object with newStageIndex property', () => {
    const habit = makeHabit({ currentStageIndex: 2 });
    const result = demoteStage(habit);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'newStageIndex'));
  });

  it('demoteStage does not mutate the habit object', () => {
    const habit = makeHabit({ currentStageIndex: 2 });
    demoteStage(habit);
    assert.equal(habit.currentStageIndex, 2);
  });
});
