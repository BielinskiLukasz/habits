/**
 * @file Per-event handler for `markUncompleted` (D-74) and the shared
 * `_recomputeLastCompletedDate` invariant helper (D-52).
 *
 * D-74 — markUncompleted writes `{habitId, date, completed: false,
 * definitionVersion: null}` instead of deleting the log row, so the
 * audit log is preserved (the row's mere existence with `completed: false`
 * is meaningful: "user explicitly said this didn't happen today").
 *
 * D-52 — `habit.lastCompletedDate` is the denormalized field the every-N-days
 * cadence resolver (D-50) reads. It MUST equal the YYYY-MM-DD of the most
 * recent `completed: true` log for the habit (or null when no completed log
 * exists). Maintained inside the SAME tx as the log write — same atomic
 * boundary, no observable intermediate state.
 *
 * `_recomputeLastCompletedDate({habitId, currentLogRow, repo})` is the
 * single source of truth for the D-52 recompute. Both `handleMarkCompleted`
 * (sibling file) and `handleMarkUncompleted` (this file) import + call it.
 * `handleRestoreLogRow` (sibling file) also calls it on undo round-trips so
 * the invariant stays correct after undo.
 *
 * Handler contract (matches `markCompleted.js`):
 *   - Signature: `handleMarkUncompleted(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames` is `['logs']` when habit row is missing (D-52 fallback),
 *     `['logs', 'habits']` otherwise.
 *   - `writes` is `[{store:'logs', value:next}, {store:'habits', value:habitRow}]`
 *     (or just the logs write when habit row is missing).
 *   - `inverse` is `{type:'restoreLogRow', payload:{habitId, date, prior}}`
 *     where `prior` is whatever the log store held at write-time (D-43,
 *     Pitfall 7 — prior locked in at capture time).
 *   - `broadcastKeys(event) -> {habitId, date}` mirrors markCompleted.
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers (DATA-04 — only apply.js
 *     writes; this file READS via `repo.getLog` + `repo.getHabit` +
 *     `repo.getLogsByHabit`).
 *   - `.innerHTML` family — D-78 grep gate.
 */

/**
 * `markUncompleted` handler — write `{completed: false, definitionVersion:
 * null}` for `(habitId, date)` (D-74) and the D-52 invariant habit row.
 *
 * @param {{ type: 'markUncompleted', payload: { habitId: string, date: string } }} event
 * @param {{
 *   getLog: (habitId: string, date: string) => Promise<object|undefined>,
 *   getHabit: (habitId: string) => Promise<object|undefined>,
 *   getLogsByHabit: (habitId: string) => Promise<object[]>,
 * }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object} | {op: 'delete', store: string, key: unknown}>, inverse: { type: string, payload: object } }>}
 */
export async function handleMarkUncompleted(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date);
  /** @type {{ habitId: string, date: string, completed: false, definitionVersion: null }} */
  const next = { habitId, date, completed: false, definitionVersion: null };
  const habitRow = await _recomputeLastCompletedDate({
    habitId,
    currentLogRow: next,
    repo,
  });

  /** @type {Array<{store: string, value: object}>} */
  const writes = [{ store: 'logs', value: next }];
  /** @type {string[]} */
  const storeNames = ['logs'];
  if (habitRow !== null) {
    writes.push({ store: 'habits', value: habitRow });
    storeNames.push('habits');
  }

  return {
    storeNames,
    writes,
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior } },
  };
}

handleMarkUncompleted.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});

/**
 * Recompute the D-52 denormalized `habit.lastCompletedDate` field.
 *
 * Strategy:
 *   1. Look up the habit row. If absent, return null — caller skips the
 *      habit write (synthetic edge case, e.g. orphan logs in tests).
 *   2. Read all logs for the habit via `repo.getLogsByHabit(habitId)`.
 *   3. Merge in `currentLogRow` (the about-to-write row) — it OVERRIDES any
 *      pre-existing row at the same `[habitId, date]` pair because the
 *      chokepoint write hasn't committed yet at the time this runs.
 *   4. Filter to `completed: true` rows; pick the max `date` (ASCII / ISO
 *      lexicographic sort works for YYYY-MM-DD).
 *   5. Return `{...habit, lastCompletedDate: maxDate ?? null}`.
 *
 * The returned object is what the caller PUTs into the `habits` store — not
 * a diff, the full row.
 *
 * @param {{ habitId: string, currentLogRow: { habitId: string, date: string, completed: boolean, definitionVersion?: string|null }, repo: { getHabit: (habitId: string) => Promise<object|undefined>, getLogsByHabit: (habitId: string) => Promise<object[]> } }} args
 * @returns {Promise<object|null>}
 */
export async function _recomputeLastCompletedDate({ habitId, currentLogRow, repo }) {
  const habit = await repo.getHabit(habitId);
  if (!habit) return null;
  const allLogs = await repo.getLogsByHabit(habitId);
  // Replace any prior log at `(habitId, currentLogRow.date)` with the
  // about-to-be-written row. Comparison by date alone is sufficient — the
  // habitId is already constrained by getLogsByHabit.
  const merged = allLogs
    .filter((l) => l.date !== currentLogRow.date)
    .concat([currentLogRow]);
  const completedDates = merged
    .filter((l) => l.completed === true)
    .map((l) => l.date)
    .sort();
  const lastCompletedDate =
    completedDates.length > 0
      ? completedDates[completedDates.length - 1]
      : null;
  return { ...habit, lastCompletedDate };
}
