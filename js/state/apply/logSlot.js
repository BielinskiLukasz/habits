/**
 * @file logSlot handler — slot-checklist log writes (LOG-03, LOG-04, LOG-05, LOG-06, D-89).
 *
 * Handles slot-checklist habit logs where the user taps individual slots within
 * a habit (e.g. 3 workouts per week). The log row stores a `slots` array of
 * `{name: string, checked: boolean}` objects (NOT `completed`); completion is
 * inferred at read-time as `slots.every(s => s.checked)`.
 *
 * D-89: partial slot logs are written and preserved. Having 1 of 3 slots checked
 * is a valid, meaningful state. The `lastCompletedDate` denormalization (D-52) is
 * updated only when all slots are checked.
 *
 * The `_recomputeLastCompletedDate` helper from markUncompleted.js is re-used
 * via a synthetic log row where `completed = slots.every(s => s.checked)`. This
 * avoids changing the existing helper and keeps the D-52 invariant consistent
 * across all log types.
 *
 * Handler contract:
 *   - Signature: `handleLogSlot(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['logs']` or `['logs', 'habits']` (if habit row exists for D-52)
 *   - `writes`: log row write + optional habit row write (D-52)
 *   - `inverse`: `{type:'restoreLogRow', payload:{habitId, date, prior}}`
 *   - `broadcastKeys(event) -> {habitId, date}`: ID+date keys (Pitfall 8)
 *
 * Forbidden constructs:
 *   - Direct calls to js/db/repo.js write helpers
 *   - `switch (` statement (Anti-Pattern 4)
 *   - `completed` field on the log row (D-89 — completion is inferred, not stored)
 */

import { _recomputeLastCompletedDate } from './markUncompleted.js';

/**
 * `logSlot` handler — write a slot-checklist log row for (habitId, date) and
 * update the D-52 `lastCompletedDate` denormalization on the habit row.
 *
 * The log row MUST have `slots` array and MUST NOT have `completed`. The D-52
 * helper receives a synthetic `{...newLog, completed: allChecked}` so it can
 * compute the correct lastCompletedDate without requiring a separate code path.
 *
 * @param {{ type: 'logSlot', payload: { habitId: string, date: string, slots: Array<{name: string, checked: boolean}> } }} event
 * @param {{
 *   getLog: (habitId: string, date: string) => Promise<object|undefined>,
 *   getHabit: (habitId: string) => Promise<object|undefined>,
 *   getLogsByHabit: (habitId: string) => Promise<object[]>,
 * }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object} | {op: 'delete', store: string, key: unknown}>, inverse: { type: string, payload: object } }>}
 */
export async function handleLogSlot(event, repo) {
  const { habitId, date, slots } = event.payload;
  const prior = await repo.getLog(habitId, date);

  /** @type {{ habitId: string, date: string, slots: Array<{name: string, checked: boolean}>, definitionVersion: null }} */
  const newLog = { habitId, date, slots, definitionVersion: null };

  // D-52 recompute via synthetic log row: completed = all slots checked.
  const allChecked = slots.every((s) => s.checked);
  const habitRow = await _recomputeLastCompletedDate({
    habitId,
    currentLogRow: { ...newLog, completed: allChecked },
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

handleLogSlot.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
