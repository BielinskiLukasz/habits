/**
 * @file Per-event handler for `setSetting` (D-75).
 *
 * The settings store is schemaless inside the store; writes go through the
 * chokepoint so `weekStart` (and any future settings writes) get broadcasted,
 * flushed via lifecycle, and undoable like any other mutation.
 *
 * Handler contract (mirrors `markCompleted.js` / `markUncompleted.js`):
 *   - Signature: `handleSetSetting(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames` is always `['settings']`.
 *   - `writes` is `[{store:'settings', value:{key, value}}]`.
 *   - `inverse` is `{type:'setSetting', payload:{key, value: prior?.value}}`
 *     — the handler is self-inverting given the prior value (D-43, Pitfall 7).
 *   - When `prior?.value` is `undefined` (first write of this key), the inverse
 *     payload value is `undefined`. Undo of the first-ever `weekStart` write
 *     therefore writes `{key:'weekStart', value: undefined}`. The settings
 *     cache hydrate path treats `undefined` as "no override — fall back to
 *     first-run default at next hydrate," which is acceptable per D-75 and
 *     the `<specifics>` line "weekStart change is undoable."
 *
 *   - `broadcastKeys(event) -> {key}` ONLY (Pitfall 8 — value NEVER on the
 *     wire). Peer tabs re-read the settings row via the notify-driven cache
 *     refresh (D-72), where the `keys.key` branch in `refreshHydratedKeys`
 *     handles the re-read.
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers (DATA-04 — only apply.js
 *     writes; this file READS via `repo.getSetting`).
 *   - `.innerHTML` family — D-78 grep gate.
 */

/**
 * `setSetting` handler — write a settings row through the chokepoint.
 *
 * @param {{ type: 'setSetting', payload: { key: string, value: * } }} event
 * @param {{
 *   getSetting: (key: string) => Promise<object|undefined>,
 * }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleSetSetting(event, repo) {
  const { key, value } = event.payload;
  const prior = await repo.getSetting(key);
  return {
    storeNames: ['settings'],
    writes: [{ store: 'settings', value: { key, value } }],
    inverse: { type: 'setSetting', payload: { key, value: prior?.value } },
  };
}

/**
 * Broadcast keys for `setSetting` — `{key}` only (Pitfall 8). Peer tabs
 * re-read the canonical value from the settings store; the broadcast
 * envelope NEVER carries the value.
 *
 * @param {{ type: 'setSetting', payload: { key: string, value: * } }} event
 * @returns {{ key: string }}
 */
handleSetSetting.broadcastKeys = (event) => ({ key: event.payload.key });
