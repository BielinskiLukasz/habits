/**
 * @file editHabit apply handler (CATALOG-02, CATALOG-03, NFR-10).
 * Creates new habit_versions entry; NEVER rewrites logs.
 *
 * Handler contract:
 *   - Signature: `handleEditHabit(event, repo) -> {storeNames, writes, inverse}`
 *   - Reads the current habit row via `repo.getHabit(habitId)` to capture prior
 *     state for the undo inverse.
 *   - Writes: updated habits row + NEW habit_versions row (effectiveFrom = today).
 *   - Does NOT include 'logs' in storeNames or writes — existing logs are NEVER
 *     touched (NFR-10, history integrity rule).
 *   - `inverse`: `{type:'restoreHabitVersion', payload:{habitId, priorVersion}}`
 *     where `priorVersion` is the snapshot of the definition BEFORE this edit.
 *   - `broadcastKeys(event) -> {habitId}` — keys only (Pitfall 8)
 *
 * Locked decisions: D-82 (catalog route), CATALOG-02/03 (version-creating edit),
 * NFR-10 (no log rewrites), D-27 (JSDoc comments), D-42 (UUID identity).
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers (DATA-04 — apply.js owns writes)
 *   - `switch` statement (Anti-Pattern 4)
 *   - `.innerHTML` family (D-78 grep gate)
 *   - Any write to the 'logs' store (NFR-10 — history integrity)
 */

import { todayLocal } from '../../util/date.js';

/**
 * `editHabit` handler — write an updated habits row and a NEW habit_versions
 * row (effectiveFrom = today) atomically via the apply.js chokepoint. Existing
 * log rows are NEVER modified (NFR-10).
 *
 * @param {{
 *   type: 'editHabit',
 *   payload: {
 *     habitId: string,
 *     name?: string,
 *     name_pl?: string|null,
 *     wave?: number,
 *     cadence?: object,
 *     targetType?: 'binary'|'numeric'|'slot-checklist',
 *     target?: number|null,
 *     stages?: Array<{label: string, target: number}>,
 *     masteryThresholdOverride?: number|null,
 *     masteryWindowOverride?: number|null,
 *     startDate?: string|null,
 *   }
 * }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: object[], inverse: object }>}
 */
export async function handleEditHabit(event, repo) {
  const {
    habitId,
    name,
    name_pl,
    wave,
    cadence,
    targetType,
    target,
    stages,
    masteryThresholdOverride,
    masteryWindowOverride,
    startDate,
  } = event.payload;

  const priorHabit = await repo.getHabit(habitId);
  if (!priorHabit) {
    throw new Error(`editHabit: habit not found: ${habitId}`);
  }

  const today = todayLocal();

  // Build updated habits row: spread prior, override only provided fields.
  // Using explicit field checks so `undefined` payload values don't erase
  // existing data (only explicitly-provided fields update the row).
  /** @type {object} */
  const habitRow = { ...priorHabit };
  if (name !== undefined) habitRow.name = name;
  if (name_pl !== undefined) habitRow.name_pl = name_pl;
  if (wave !== undefined) habitRow.wave = wave;
  if (cadence !== undefined) habitRow.cadence = cadence;
  if (targetType !== undefined) habitRow.targetType = targetType;
  if (target !== undefined) habitRow.target = target;
  if (stages !== undefined) habitRow.stages = stages;
  if (masteryThresholdOverride !== undefined) habitRow.masteryThresholdOverride = masteryThresholdOverride;
  if (masteryWindowOverride !== undefined) habitRow.masteryWindowOverride = masteryWindowOverride;
  if (startDate !== undefined) habitRow.startDate = startDate;

  // New version entry captures the habit's definition state as of today.
  /** @type {object} */
  const versionRow = {
    habitId,
    effectiveFrom: today,
    name: habitRow.name,
    name_pl: habitRow.name_pl,
    cadence: habitRow.cadence,
    targetType: habitRow.targetType,
    target: habitRow.target,
    stages: habitRow.stages,
  };

  // priorVersion snapshot: what the definition looked like BEFORE this edit.
  // Captured at write-time for undo (D-43 / Pitfall 7).
  const priorVersion = {
    habitId,
    effectiveFrom: today,
    name: priorHabit.name,
    name_pl: priorHabit.name_pl ?? null,
    cadence: priorHabit.cadence,
    targetType: priorHabit.targetType,
    target: priorHabit.target ?? null,
    stages: priorHabit.stages ?? [],
  };

  return {
    // IMPORTANT: 'logs' is intentionally ABSENT — editHabit must NEVER write
    // to the logs store (NFR-10, history integrity rule).
    storeNames: ['habits', 'habit_versions'],
    writes: [
      { store: 'habits', value: habitRow },
      { store: 'habit_versions', value: versionRow },
    ],
    inverse: { type: 'restoreHabitVersion', payload: { habitId, priorVersion } },
  };
}

/**
 * Broadcast keys for `editHabit` — `{habitId}` only (Pitfall 8).
 * Peer tabs re-read the habit definition from habits + habit_versions on notification.
 *
 * @param {{ type: 'editHabit', payload: { habitId: string } }} event
 * @returns {{ habitId: string }}
 */
handleEditHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
