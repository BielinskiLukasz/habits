/**
 * @file ~30-line in-memory fake matching `js/db/repo.js` surface (D-25, DATA-01/02/03/04/05).
 *
 * Used by every `tests/integration/*.test.js` in Phase 2+. Mirrors the seven
 * stores from D-39's v1 schema (habits, habit_versions, logs, events,
 * settings, meta, score_snapshots). Compound-key stores (`logs`,
 * `habit_versions`, `score_snapshots`) use the canonical `[habitId, date|
 * effectiveFrom]` shape via `JSON.stringify` for Map keys so test assertions
 * can `.get()` by the same pair the real repo uses.
 *
 * A7 contract surface: `runTx(stores, mode, body)` passes a minimal
 * tx-shape to `body` so the same caller code (apply.js / seed.js / undo.js
 * in plans 02-03 and 02-04) works against fake AND real. `tx.objectStore(name)`
 * returns `{ put(value), delete(key) }`. The fake routes `put` through its
 * existing per-store put helper so compound-key normalization is preserved.
 *
 * Per RESEARCH §Pitfall 9 the fake does NOT model real tx isolation —
 * sequential method calls within `body` are sufficient for unit/integration
 * assertions; real-IDB durability is verified manually via tests-browser.html
 * (D-26).
 */

const COMPOUND_KEY_STORES = new Set(['logs', 'habit_versions', 'score_snapshots']);

/**
 * Compute the canonical Map key for a value going into the given store.
 * For compound-key stores, returns `JSON.stringify([habitId, date|effectiveFrom])`.
 * For the rest, returns the value's `id` (uuid stores) or `key` (settings/meta).
 *
 * @param {string} storeName
 * @param {object} value
 * @returns {string}
 */
function keyOf(storeName, value) {
  if (COMPOUND_KEY_STORES.has(storeName)) {
    return JSON.stringify([value.habitId, value.date ?? value.effectiveFrom]);
  }
  return value.id ?? value.key;
}

/**
 * Create an in-memory fake repo with the same surface as `js/db/repo.js`.
 *
 * @returns {{
 *   getHabit:   (id: string) => Promise<object|undefined>,
 *   putHabit:   (h: object) => Promise<void>,
 *   putLog:     (l: object) => Promise<void>,
 *   getLog:     (habitId: string, date: string) => Promise<object|undefined>,
 *   putEvent:   (e: object) => Promise<void>,
 *   getEvent:   (id: string) => Promise<object|undefined>,
 *   getMeta:    (key: string) => Promise<*>,
 *   putMeta:    (key: string, value: *) => Promise<void>,
 *   putSetting: (s: object) => Promise<void>,
 *   getSetting: (key: string) => Promise<object|undefined>,
 *   runTx:      (stores: string[], mode: 'readonly'|'readwrite', body: (tx: object) => *|Promise<*>) => Promise<*>,
 *   _stores:    Record<string, Map<string, object>>,
 * }}
 */
export function createFakeRepo() {
  const stores = {
    habits: new Map(),
    habit_versions: new Map(),
    logs: new Map(),
    events: new Map(),
    settings: new Map(),
    meta: new Map(),
    score_snapshots: new Map(),
  };

  // Per-store put helpers — own the compound-key normalization in ONE place
  // so `runTx`'s tx-shape can call the same path without duplicating logic.
  const putters = {
    habits: (h) => { stores.habits.set(h.id, h); },
    habit_versions: (v) => { stores.habit_versions.set(keyOf('habit_versions', v), v); },
    logs: (l) => { stores.logs.set(keyOf('logs', l), l); },
    events: (e) => { stores.events.set(e.id, e); },
    settings: (s) => { stores.settings.set(s.key, s); },
    meta: (m) => { stores.meta.set(m.key, m); },
    score_snapshots: (s) => { stores.score_snapshots.set(keyOf('score_snapshots', s), s); },
  };

  return {
    async getHabit(id) { return stores.habits.get(id); },
    async putHabit(h) { putters.habits(h); },
    async putLog(l) { putters.logs(l); },
    async getLog(habitId, date) {
      return stores.logs.get(JSON.stringify([habitId, date]));
    },
    async putEvent(e) { putters.events(e); },
    async getEvent(id) { return stores.events.get(id); },
    async getMeta(key) { return stores.meta.get(key)?.value; },
    async putMeta(key, value) { putters.meta({ key, value }); },
    async putSetting(s) { putters.settings(s); },
    async getSetting(key) { return stores.settings.get(key); },

    /**
     * Minimal tx-shape (A7 contract). Downstream apply.js / seed.js / undo.js
     * call `runTx(['habits','events','meta'], 'readwrite', async (tx) => {
     *   tx.objectStore('events').put(eventRow);
     *   tx.objectStore('meta').put({ key: 'undoToken', value: ... });
     * })` against fake AND real with the same caller code.
     */
    async runTx(_storeNames, _mode, body) {
      const tx = {
        objectStore(name) {
          const put = putters[name];
          if (!put) throw new Error(`fake-idb: unknown store '${name}'`);
          return {
            put(value) { put(value); },
            delete(key) {
              const map = stores[name];
              if (!map) return;
              if (Array.isArray(key)) {
                map.delete(JSON.stringify(key));
              } else {
                map.delete(key);
              }
            },
          };
        },
      };
      return body(tx);
    },

    _stores: stores,
  };
}
