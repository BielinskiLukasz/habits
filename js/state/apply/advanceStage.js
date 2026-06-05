/**
 * @file advanceStage / demoteStage handlers (STAGE-03..07, D-84).
 *
 * Stage advancement uses OR-composed triggers from `js/domain/stage.js`
 * (`evaluateStageTriggers`). Only writes when a trigger actually fires —
 * if no trigger fires, returns a no-op `{storeNames:[], writes:[], inverse:null}`.
 *
 * Handler contract (matches markCompleted.js shape):
 *   - Signature: `handle<Event>(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['habits']` on advancement; `[]` on no-op
 *   - `writes`: `[{store:'habits', value: updatedHabit}]` or `[]` for no-op
 *   - `inverse`: demoteStage → advanceStage; advanceStage → demoteStage; null for no-op
 *   - `broadcastKeys(event) -> {habitId}`: ID-only broadcast (Pitfall 8)
 *
 * Forbidden constructs:
 *   - Direct calls to js/db/repo.js write helpers
 *   - `switch (` statement (Anti-Pattern 4)
 */

import { evaluateStageTriggers, demoteStage } from '../../domain/stage.js';
import { todayLocal } from '../../util/date.js';

/**
 * `advanceStage` handler — evaluate triggers and advance currentStageIndex if any fire.
 *
 * If `evaluateStageTriggers` returns `shouldAdvance:false` (no trigger fired, or
 * already at last stage), returns a no-op with `storeNames:[], writes:[], inverse:null`.
 * This means no events row is still written by apply.js (the tx still commits with just
 * the events + meta rows), but the habit row is unchanged.
 *
 * @param {{ type: 'advanceStage', payload: { habitId: string, triggerType?: string, completionPercentage?: number } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object }|null }>}
 */
export async function handleAdvanceStage(event, repo) {
  const { habitId, triggerType, completionPercentage } = event.payload;
  const habit = await repo.getHabit(habitId);
  const today = todayLocal();

  const { shouldAdvance, nextStageIndex } = evaluateStageTriggers(habit, today, {
    triggerType,
    completionPercentage: completionPercentage ?? 0,
  });

  if (!shouldAdvance) {
    // No trigger fired — no-op. Return empty writes so apply.js still records
    // the events row but does not mutate the habit.
    return {
      storeNames: [],
      writes: [],
      inverse: null,
    };
  }

  const updated = { ...habit, currentStageIndex: nextStageIndex, stageStartedAt: today };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'demoteStage', payload: { habitId } },
  };
}

handleAdvanceStage.broadcastKeys = (event) => ({ habitId: event.payload.habitId });

/**
 * `demoteStage` handler — decrement currentStageIndex by 1 (floored at 0).
 *
 * Uses `demoteStage` from `js/domain/stage.js` for the safe Math.max(0, ...) guard.
 * Updates `stageStartedAt` to today to reset the advancement clock for the new stage.
 * Inverse is `advanceStage` with triggerType:'manual' so the undo path re-advances
 * via the manual trigger (assuming the stage has allowManual:true; if not, the inverse
 * will be a no-op — which is acceptable per the plan spec).
 *
 * @param {{ type: 'demoteStage', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleDemoteStage(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  const today = todayLocal();

  const { newStageIndex } = demoteStage(habit);
  const updated = { ...habit, currentStageIndex: newStageIndex, stageStartedAt: today };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'advanceStage', payload: { habitId, triggerType: 'manual' } },
  };
}

handleDemoteStage.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
