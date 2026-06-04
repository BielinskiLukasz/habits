/**
 * @file createHabit apply handler (CATALOG-01, CATALOG-07, D-82).
 *
 * Atomically writes: habits row, habit_versions row (effectiveFrom = startDate
 * or today), and an events row via the apply.js chokepoint. This is the
 * entry point for all new habit creation; no writes bypass this path.
 *
 * Handler contract:
 *   - Signature: `handleCreateHabit(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['habits', 'habit_versions']` (apply.js auto-adds `events` + `meta`)
 *   - `writes`: habits row + habit_versions row
 *   - `inverse`: `{type:'deleteHabit', payload:{habitId}}` — deleteHabit handler not
 *     in this plan but the inverse shape is locked so undo scaffolding is correct.
 *   - `broadcastKeys(event) -> {habitId}` — keys only (Pitfall 8)
 *
 * Caller convention: the caller may pre-generate `habitId` in the event payload
 * (via `newId()`) so that `broadcastKeys` can echo it back and peer tabs know
 * which habit was created. If `payload.habitId` is absent the handler generates
 * one and mutates `event.payload.habitId` so that broadcastKeys sees it.
 *
 * Locked decisions: D-82 (catalog route), CATALOG-01 (creation fields),
 * CATALOG-07 (future startDate), D-27 (JSDoc comments), D-42 (UUID identity),
 * history integrity rule (new version effectiveFrom = startDate).
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers (DATA-04 — apply.js owns writes)
 *   - `switch` statement (Anti-Pattern 4)
 *   - `.innerHTML` family (D-78 grep gate)
 */

import { newId } from '../../util/id.js';
import { todayLocal } from '../../util/date.js';

/**
 * `createHabit` handler — write a new habit row, its initial habit_versions
 * row, and an events row atomically via the apply.js chokepoint.
 *
 * @param {{
 *   type: 'createHabit',
 *   payload: {
 *     habitId?: string,
 *     name: string,
 *     name_pl?: string|null,
 *     wave: number,
 *     cadence: object,
 *     targetType?: 'binary'|'numeric'|'slot-checklist',
 *     target?: number|null,
 *     stages?: Array<{label: string, target: number}>,
 *     startDate?: string|null,
 *     masteryThresholdOverride?: number|null,
 *     masteryWindowOverride?: number|null,
 *   }
 * }} event
 * @param {object} _repo unused — create has no prior-state read
 * @returns {Promise<{ storeNames: string[], writes: object[], inverse: object }>}
 */
export async function handleCreateHabit(event, _repo) {
  const {
    name,
    name_pl = null,
    wave,
    cadence,
    targetType = 'binary',
    target = null,
    stages = [],
    startDate,
    masteryThresholdOverride = null,
    masteryWindowOverride = null,
  } = event.payload;

  // Generate a habitId if the caller did not supply one, then write it back
  // into event.payload so broadcastKeys (called after this function returns)
  // can echo it without needing access to this closure's local variables.
  if (!event.payload.habitId) {
    event.payload.habitId = newId();
  }
  const habitId = event.payload.habitId;
  const sd = startDate ?? todayLocal();

  /** @type {object} */
  const habitRow = {
    id: habitId,
    name,
    name_pl,
    wave,
    status: 'active',
    cadence,
    targetType,
    target,
    stages,
    currentStageIndex: 0,
    stageStartedAt: sd,
    masteryThresholdOverride,
    masteryWindowOverride,
    createdAt: sd,
    startDate: sd,
    lastCompletedDate: null,
  };

  /** @type {object} */
  const versionRow = {
    habitId,
    effectiveFrom: sd,
    name,
    name_pl,
    cadence,
    targetType,
    target,
    stages,
  };

  return {
    storeNames: ['habits', 'habit_versions'],
    writes: [
      { store: 'habits', value: habitRow },
      { store: 'habit_versions', value: versionRow },
    ],
    inverse: { type: 'deleteHabit', payload: { habitId } },
  };
}

/**
 * Broadcast keys for `createHabit` — `{habitId}` only (Pitfall 8).
 * Relies on the handler having set `event.payload.habitId` before apply.js
 * calls this function.
 *
 * @param {{ type: 'createHabit', payload: { habitId?: string } }} event
 * @returns {{ habitId: string|undefined }}
 */
handleCreateHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
