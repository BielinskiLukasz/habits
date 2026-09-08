/**
 * @file Per-event handler for `markSkipped` — writes `status:'skipped'` for a
 * (habitId, date) pair, and recomputes `habit.lastCompletedDate` (D-52) when
 * the prior log was `status:'completed'`.
 *
 * Skipping a habit is a neutral state: the user consciously chose not to do it
 * today (e.g. rest day, travel) but does NOT want it counted as a failure.
 * It is excluded from S1/S2/S3 denominators (scoring.js) and rendered with a
 * distinct label in the Today and History views.
 *
 * Handler contract (matches markCompleted.js / markUncompleted.js):
 *   - `storeNames`: ['logs'] when no D-52 recompute needed;
 *     ['logs', 'habits'] when overwriting a completed log (D-52 fires).
 *   - `writes`: one log put with `status: 'skipped'`, plus optionally a
 *     habit put when D-52 fires.
 *   - `inverse`: `restoreLogRow` with the prior state locked in at write-time
 *     (D-43, Pitfall 7).
 *   - `broadcastKeys(event) -> {habitId, date}` (Pitfall 8 — keys only).
 *
 * D-52 recompute: fires ONLY when prior.status === 'completed'. D-52 does not
 * fire when skipping a habit that was not previously completed (prior undefined,
 * failed, or skipped); it DOES fire when overwriting a completed log to restore
 * the correct lastCompletedDate.
 *
 * Forbidden constructs in this file:
 *   - Direct calls to js/db/repo.js write helpers (DATA-04).
 *   - `.innerHTML` family — D-78 grep gate.
 */

import { _recomputeLastCompletedDate } from './markUncompleted.js';

/**
 * `markSkipped` handler — write `{status: 'skipped', definitionVersion: null}`
 * for `(habitId, date)`. Recomputes `lastCompletedDate` (D-52) when overwriting
 * a completed log; otherwise leaves the habit row unchanged.
 *
 * @param {{ type: 'markSkipped', payload: { habitId: string, date: string } }} event
 * @param {{ getLog: (habitId: string, date: string) => Promise<object|undefined>, getHabit: (habitId: string) => Promise<object|undefined>, getLogsByHabit: (habitId: string) => Promise<object[]> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleMarkSkipped(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date);
  /** @type {{ habitId: string, date: string, status: 'skipped', definitionVersion: null }} */
  const next = { habitId, date, status: 'skipped', definitionVersion: null };

  /** @type {string[]} */
  const storeNames = ['logs'];
  /** @type {Array<{store: string, value: object}>} */
  const writes = [{ store: 'logs', value: next }];

  // D-52: when overwriting a completed log, recompute lastCompletedDate so it
  // is not left stranded at the now-skipped date.
  if (prior && prior.status === 'completed') {
    const habitRow = await _recomputeLastCompletedDate({
      habitId,
      currentLogRow: next,
      repo,
    });
    if (habitRow !== null) {
      storeNames.push('habits');
      writes.push({ store: 'habits', value: habitRow });
    }
  }

  return {
    storeNames,
    writes,
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior } },
  };
}

handleMarkSkipped.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
