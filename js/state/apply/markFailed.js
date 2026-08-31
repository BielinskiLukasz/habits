/**
 * @file Per-event handler for `markFailed` — writes `status:'failed'` for a
 * (habitId, date) pair without touching `habit.lastCompletedDate` (D-52).
 *
 * Failing a habit is an explicit "did not do this, and it counts against me"
 * state. It is included in S1/S2/S3 denominators as a non-completion.
 * Does NOT recompute `lastCompletedDate` because failing does not change the
 * completion history.
 *
 * Handler contract (matches markCompleted.js / markSkipped.js):
 *   - `storeNames`: ['logs'] only — no habit row needed (D-52 not triggered).
 *   - `writes`: one log put with `status: 'failed'`.
 *   - `inverse`: `restoreLogRow` with the prior state locked in at write-time
 *     (D-43, Pitfall 7).
 *   - `broadcastKeys(event) -> {habitId, date}` (Pitfall 8 — keys only).
 *
 * Forbidden constructs in this file:
 *   - Direct calls to js/db/repo.js write helpers (DATA-04).
 *   - `.innerHTML` family — D-78 grep gate.
 */

/**
 * `markFailed` handler — write `{status: 'failed', definitionVersion: null}`
 * for `(habitId, date)`. Does not recompute `lastCompletedDate` because
 * failing does not change the completion history.
 *
 * @param {{ type: 'markFailed', payload: { habitId: string, date: string } }} event
 * @param {{ getLog: (habitId: string, date: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleMarkFailed(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date);
  /** @type {{ habitId: string, date: string, status: 'failed', definitionVersion: null }} */
  const next = { habitId, date, status: 'failed', definitionVersion: null };

  return {
    storeNames: ['logs'],
    writes: [{ store: 'logs', value: next }],
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior } },
  };
}

handleMarkFailed.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
