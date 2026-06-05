/**
 * @file setMasteryWindow handler — global mastery window days configurable (SETTINGS-01, MASTERY-01, D-86).
 * Self-inverting like setSetting (D-75).
 *
 * Handler contract (mirrors `setSetting.js`):
 *   - Signature: `handleSetMasteryWindow(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames` is always `['settings']`.
 *   - `writes` is `[{store:'settings', value:{key:'masteryWindow', value}}]`.
 *   - `inverse` is `{type:'setMasteryWindow', payload:{value: prior?.value}}`
 *     — the handler is self-inverting given the prior value (D-43, Pitfall 7).
 *   - When `prior?.value` is `undefined` (first write), the inverse payload value
 *     is `undefined`. Undo of the first-ever write therefore writes
 *     `{key:'masteryWindow', value:undefined}`. The settings cache hydrate path
 *     treats `undefined` as "no override — fall back to first-run default at next
 *     hydrate," which is acceptable per D-75.
 *
 *   - `broadcastKeys(event) -> {key:'masteryWindow'}` ONLY (Pitfall 8 — value
 *     NEVER on the wire). Peer tabs re-read the settings row via the notify-driven
 *     cache refresh (D-72).
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers (DATA-04 — only apply.js writes;
 *     this file READS via `repo.getSetting`).
 *   - `.innerHTML` family — D-78 grep gate.
 */

/**
 * `setMasteryWindow` handler — write the global mastery rolling window days setting.
 *
 * @param {{ type: 'setMasteryWindow', payload: { value: number } }} event
 * @param {{
 *   getSetting: (key: string) => Promise<object|undefined>,
 * }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleSetMasteryWindow(event, repo) {
  const { value } = event.payload;
  const prior = await repo.getSetting('masteryWindow');
  return {
    storeNames: ['settings'],
    writes: [{ store: 'settings', value: { key: 'masteryWindow', value } }],
    inverse: { type: 'setMasteryWindow', payload: { value: prior?.value } },
  };
}

/**
 * Broadcast keys for `setMasteryWindow` — `{key:'masteryWindow'}` only
 * (Pitfall 8). Peer tabs re-read the canonical value from the settings store;
 * the broadcast envelope NEVER carries the value.
 *
 * @param {{ type: 'setMasteryWindow', payload: { value: number } }} _event
 * @returns {{ key: string }}
 */
handleSetMasteryWindow.broadcastKeys = (_event) => ({ key: 'masteryWindow' });
