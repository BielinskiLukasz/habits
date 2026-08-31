/**
 * @file logNumeric handler — numeric +1 counter log writes (LOG-02, LOG-05, LOG-06, D-88).
 *
 * Handles numeric counter habit logs where the user taps +/- buttons to set a
 * total count for a (habitId, date). The log row stores `count` (NOT `completed`);
 * completion is inferred at read-time as `count >= habit.target`.
 *
 * D-88: partial numeric logs are written and preserved. A count of 3 out of 5
 * is a valid, meaningful state — the log is stored, not discarded. The
 * `lastCompletedDate` denormalization (D-52) is updated only when count >= target.
 *
 * The `_recomputeLastCompletedDate` helper from markUncompleted.js is re-used
 * here via a synthetic log row where `completed = (count >= target)`. This
 * avoids changing the existing helper and keeps the D-52 invariant consistent
 * across all log types.
 *
 * Handler contract:
 *   - Signature: `handleLogNumeric(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['logs']` or `['logs', 'habits']` (if habit row exists for D-52)
 *   - `writes`: log row write + optional habit row write (D-52)
 *   - `inverse`: `{type:'restoreLogRow', payload:{habitId, date, prior}}`
 *   - `broadcastKeys(event) -> {habitId, date}`: ID+date keys (Pitfall 8)
 *
 * Forbidden constructs:
 *   - Direct calls to js/db/repo.js write helpers
 *   - `switch (` statement (Anti-Pattern 4)
 *   - `completed` field on the log row (D-88 — completion is inferred, not stored)
 */

import { _recomputeLastCompletedDate } from './markUncompleted.js';

/**
 * `logNumeric` handler — write a numeric count log row for (habitId, date) and
 * update the D-52 `lastCompletedDate` denormalization on the habit row.
 *
 * The log row MUST have `count` and MUST NOT have `completed`. The D-52 helper
 * receives a synthetic `{...newLog, completed: count >= target}` so it can
 * compute the correct lastCompletedDate without requiring a separate code path.
 *
 * @param {{ type: 'logNumeric', payload: { habitId: string, date: string, count: number } }} event
 * @param {{
 *   getLog: (habitId: string, date: string) => Promise<object|undefined>,
 *   getHabit: (habitId: string) => Promise<object|undefined>,
 *   getLogsByHabit: (habitId: string) => Promise<object[]>,
 * }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object} | {op: 'delete', store: string, key: unknown}>, inverse: { type: string, payload: object } }>}
 */
export async function handleLogNumeric(event, repo) {
  const { habitId, date, count } = event.payload;
  const prior = await repo.getLog(habitId, date);
  const habit = await repo.getHabit(habitId);

  /** @type {{ habitId: string, date: string, count: number, definitionVersion: null }} */
  const newLog = { habitId, date, count, definitionVersion: null };

  // D-52 recompute via synthetic log row: completed = (count >= target).
  // Falls back to target:1 when habit has no explicit target.
  const isCompleted = count >= (habit?.target ?? 1);
  const habitRow = await _recomputeLastCompletedDate({
    habitId,
    currentLogRow: { ...newLog, status: isCompleted ? 'completed' : 'failed' },
    repo,
  });

  /** @type {Array<{store: string, value: object}>} */
  const writes = [{ store: 'logs', value: newLog }];
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

handleLogNumeric.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
