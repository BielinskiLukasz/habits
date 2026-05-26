/**
 * @file Per-event handlers for `markCompleted` and its inverse `restoreLogRow`
 * (D-34 — the one round-trip event P2 ships; D-43 — undo seam via prior-row capture).
 *
 * Each handler returns the canonical handler-contract shape:
 *   `{ storeNames, writes, inverse }`
 *
 * - `storeNames`: stores the apply.js tx must include (apply.js auto-adds
 *   `events` + `meta` on every call).
 * - `writes`: list of `{store, value}` OR `{op: 'delete', store, key}`
 *   operations that the chokepoint loops through inside the tx.
 * - `inverse`: a `{type, payload}` shape that — when dispatched back through
 *   `apply()` — undoes this event. Captured at write-time so the prior state
 *   is locked in (Pitfall 7).
 *
 * Each handler also exposes a static `broadcastKeys(event)` that returns the
 * IDs-only keys for the cross-tab broadcast (Pitfall 8 — keys not values).
 *
 * Locked decisions implemented here:
 *   - D-34: markCompleted ships in P2; its inverse `restoreLogRow` lives
 *           here too because they are a logical pair.
 *   - D-43: every undoable event captures `prior` at write-time so the
 *           inverse is fully self-contained (no rolling-stack ambiguity).
 *   - DATA-05: `definitionVersion: null` ("current") on every new log row
 *           written by `markCompleted`.
 *   - Pitfall 8: `broadcastKeys` returns IDs only.
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers — handlers READ via repo
 *     to capture `prior`, but the apply.js chokepoint owns the writes.
 */

/**
 * `markCompleted` handler — write the canonical log row for (habitId, date)
 * and capture `prior` so the inverse can restore exactly the state we
 * displaced.
 *
 * @param {{ type: 'markCompleted', payload: { habitId: string, date: string } }} event
 * @param {{ getLog: (habitId: string, date: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object} | {op: 'delete', store: string, key: unknown}>, inverse: { type: string, payload: object } }>}
 */
export async function handleMarkCompleted(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date); // undefined when no prior row exists
  /** @type {{ habitId: string, date: string, completed: true, definitionVersion: null }} */
  const next = { habitId, date, completed: true, definitionVersion: null };
  return {
    storeNames: ['logs'],
    writes: [{ store: 'logs', value: next }],
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior } },
  };
}

handleMarkCompleted.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});

/**
 * `restoreLogRow` handler — the inverse of any logs-row mutation. If `prior`
 * is undefined or null the row is deleted; otherwise `prior` is put back
 * verbatim. The inverse of this restore is itself a `restoreLogRow` that
 * captures the now-current row (which apply.js will compute and lock in).
 *
 * @param {{ type: 'restoreLogRow', payload: { habitId: string, date: string, prior: object|undefined|null } }} event
 * @param {{ getLog: (habitId: string, date: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object} | {op: 'delete', store: string, key: unknown}>, inverse: { type: string, payload: object } }>}
 */
export async function handleRestoreLogRow(event, repo) {
  const { habitId, date, prior } = event.payload;
  const current = await repo.getLog(habitId, date);
  /** @type {Array<{store: string, value: object} | {op: 'delete', store: string, key: unknown}>} */
  let writes;
  if (prior === undefined || prior === null) {
    // Delete the (habitId, date) row — the prior state was "no row at all".
    writes = [{ op: 'delete', store: 'logs', key: [habitId, date] }];
  } else {
    writes = [{ store: 'logs', value: prior }];
  }
  return {
    storeNames: ['logs'],
    writes,
    // Inverse of restore is another restore that puts back what is CURRENTLY there.
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior: current } },
  };
}

handleRestoreLogRow.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
