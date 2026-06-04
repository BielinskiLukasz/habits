/**
 * @file Pure stage advancement trigger evaluator (STAGE-01..07, D-83..D-84).
 *
 * Each habit can have 1-N ordered stages. Stage advancement uses OR-composed
 * triggers — any enabled trigger firing is sufficient to advance to the next
 * stage. This avoids the else-if short-circuit bug (Pitfall 3) by iterating
 * a TRIGGER_CHECKS dispatch array instead of a chain of if/else-if blocks.
 *
 * Four trigger types (D-84):
 *   manual              — user explicitly taps "Advance stage" button
 *   scheduled-by-week   — auto-advance on or after a target week's Monday
 *   after-n-days        — unconditional after N days at current stage
 *   after-n-days-with-threshold — N days AND completion% both required
 */

import { daysBetween } from '../util/date.js';

/**
 * Ordered list of trigger checks. Each entry has a `name` and a pure `check`
 * function. `evaluateStageTriggers` iterates this array; the first truthy
 * result wins for `triggeredBy`, but the loop stops there (first-match
 * semantics are sufficient for OR-logic: any one firing = advance).
 *
 * Order matters for `triggeredBy` naming: manual is checked first so that
 * an explicit user tap reports `'manual'` even when an auto-trigger would
 * also have fired on the same day.
 *
 * @type {Array<{name: string, check: (stage: object, habit: object, date: string, ctx: object) => boolean}>}
 */
const TRIGGER_CHECKS = [
  {
    name: 'manual',
    /** @param {object} stage @param {object} _h @param {string} _d @param {object} ctx */
    check: (stage, _h, _d, ctx) => Boolean(stage.allowManual) && ctx.triggerType === 'manual',
  },
  {
    name: 'scheduled-by-week',
    /** @param {object} stage @param {object} _h @param {string} d @param {object} _ctx */
    check: (stage, _h, d, _ctx) => stage.targetWeekDate != null && d >= stage.targetWeekDate,
  },
  {
    name: 'after-n-days',
    // Only fires when advanceAfterDaysThreshold is NOT set — otherwise the
    // threshold variant takes responsibility for this trigger combination.
    /** @param {object} stage @param {object} h @param {string} d @param {object} _ctx */
    check: (stage, h, d, _ctx) =>
      stage.advanceAfterDays != null &&
      !stage.advanceAfterDaysThreshold &&
      daysBetween(h.stageStartedAt, d) >= stage.advanceAfterDays,
  },
  {
    name: 'after-n-days-with-threshold',
    /** @param {object} stage @param {object} h @param {string} d @param {object} ctx */
    check: (stage, h, d, ctx) =>
      stage.advanceAfterDays != null &&
      stage.advanceAfterDaysThreshold != null &&
      daysBetween(h.stageStartedAt, d) >= stage.advanceAfterDays &&
      (ctx.completionPercentage ?? 0) >= stage.advanceAfterDaysThreshold,
  },
];

/**
 * Evaluate whether any advancement trigger fires for the current stage of a habit.
 *
 * Returns `{shouldAdvance: true, nextStageIndex, triggeredBy}` when any trigger
 * fires, or `{shouldAdvance: false, nextStageIndex: currentStageIndex, triggeredBy: null}`
 * when none fire or the habit is already at its last stage.
 *
 * Guard (T-04-03): never advances past the last stage index.
 *
 * @param {{ id: string, stages: object[], currentStageIndex: number, stageStartedAt: string }} habit
 * @param {string} date YYYY-MM-DD evaluation date
 * @param {{ triggerType?: string, completionPercentage?: number }} ctx
 * @returns {{ shouldAdvance: boolean, nextStageIndex: number, triggeredBy: string|null }}
 */
export function evaluateStageTriggers(habit, date, ctx) {
  // Guard: already at the last stage — nothing to advance to (T-04-03).
  if (habit.currentStageIndex >= habit.stages.length - 1) {
    return { shouldAdvance: false, nextStageIndex: habit.currentStageIndex, triggeredBy: null };
  }

  const stage = habit.stages[habit.currentStageIndex];
  let triggeredBy = null;

  for (const entry of TRIGGER_CHECKS) {
    if (entry.check(stage, habit, date, ctx)) {
      triggeredBy = entry.name;
      break; // OR logic: first truthy trigger is sufficient
    }
  }

  if (triggeredBy !== null) {
    return {
      shouldAdvance: true,
      nextStageIndex: habit.currentStageIndex + 1,
      triggeredBy,
    };
  }

  return { shouldAdvance: false, nextStageIndex: habit.currentStageIndex, triggeredBy: null };
}

/**
 * Demote the habit's stage by 1, floored at 0.
 *
 * Does not mutate the habit object — returns a new result object.
 * Guard (T-04-03b): cannot go below stage index 0.
 *
 * @param {{ currentStageIndex?: number }} habit
 * @returns {{ newStageIndex: number }}
 */
export function demoteStage(habit) {
  return { newStageIndex: Math.max(0, (habit.currentStageIndex ?? 0) - 1) };
}
