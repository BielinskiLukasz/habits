/**
 * @file Per-event handler for `markSkipped` — writes `status:'skipped'` for a
 * (habitId, date) pair without touching `habit.lastCompletedDate` (D-52).
 *
 * Skipping a habit is a neutral state: the user consciously chose not to do it
 * today (e.g. rest day, travel) but does NOT want it counted as a failure.
 * It is excluded from S1/S2/S3 denominators (scoring.js) and rendered with a
 * distinct label in the Today and History views.
 *
 * Handler contract (matches markCompleted.js / markUncompleted.js):
 *   - `storeNames`: ['logs'] only — no habit row needed (D-52 not triggered).
 *   - `writes`: one log put with `status: 'skipped'`.
 *   - `inverse`: `restoreLogRow` with the prior state locked in at write-time
 *     (D-43, Pitfall 7).
 *   - `broadcastKeys(event) -> {habitId, date}` (Pitfall 8 — keys only).
 *
 * Forbidden constructs in this file:
 *   - Direct calls to js/db/repo.js write helpers (DATA-04).
 *   - `.innerHTML` family — D-78 grep gate.
 */

/**
 * `markSkipped` handler — write `{status: 'skipped', definitionVersion: null}`
 * for `(habitId, date)`. Does not recompute `lastCompletedDate` because
 * skipping does not change the completion history.
 *
 * @param {{ type: 'markSkipped', payload: { habitId: string, date: string } }} event
 * @param {{ getLog: (habitId: string, date: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleMarkSkipped(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date);
  /** @type {{ habitId: string, date: string, status: 'skipped', definitionVersion: null }} */
  const next = { habitId, date, status: 'skipped', definitionVersion: null };

  return {
    storeNames: ['logs'],
    writes: [{ store: 'logs', value: next }],
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior } },
  };
}

handleMarkSkipped.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
