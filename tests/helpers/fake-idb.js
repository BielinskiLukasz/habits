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
 *
 * Phase 04 plan 05 (Task 1): adds `getLogsForDate` and `getHabitVersionAtDate`
 * to match the new methods added to `js/db/repo.js` (A7 contract preserved).
 *
 * Phase 05 plan 02 (Task 1): adds `getAllLogs`, `getAllHabitVersions`,
 * `getAllEvents`, `getAllSettings`, `getAllMeta`, `getAllScoreSnapshots` to
 * support `js/io/export.js#exportJSON` full-store reads (EXPORT-01, A7
 * contract preserved).
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
 *   getHabit:                 (id: string) => Promise<object|undefined>,
 *   getAllHabits:              () => Promise<object[]>,
 *   putHabit:                 (h: object) => Promise<void>,
 *   putLog:                   (l: object) => Promise<void>,
 *   getLog:                   (habitId: string, date: string) => Promise<object|undefined>,
 *   getAllLogs:                () => Promise<object[]>,
 *   getLogsInRange:           (startYMD: string, endYMD: string) => Promise<object[]>,
 *   getLogsByHabit:           (habitId: string) => Promise<object[]>,
 *   getLogsForDate:           (date: string) => Promise<object[]>,
 *   getAllHabitVersions:      () => Promise<object[]>,
 *   getHabitVersionAtDate:    (habitId: string, date: string) => Promise<object|undefined>,
 *   putEvent:                 (e: object) => Promise<void>,
 *   getEvent:                 (id: string) => Promise<object|undefined>,
 *   getAllEvents:              () => Promise<object[]>,
 *   getMeta:                  (key: string) => Promise<*>,
 *   putMeta:                  (key: string, value: *) => Promise<void>,
 *   getAllMeta:                () => Promise<object[]>,
 *   putSetting:               (s: object) => Promise<void>,
 *   getSetting:               (key: string) => Promise<object|undefined>,
 *   getAllSettings:            () => Promise<object[]>,
 *   getAllScoreSnapshots:      () => Promise<object[]>,
 *   runTx:                    (stores: string[], mode: 'readonly'|'readwrite', body: (tx: object) => *|Promise<*>) => Promise<*>,
 *   _stores:                  Record<string, Map<string, object>>,
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
    // Phase 03 plan 01 Task 5: bounded reads for Slice 2's Today hydrate path.
    async getAllHabits() {
      return Array.from(stores.habits.values());
    },
    // Phase 05 plan 02 Task 1: full-store reads for JSON export (EXPORT-01).
    async getAllLogs() {
      return Array.from(stores.logs.values());
    },
    async getLogsInRange(startYMD, endYMD) {
      /** @type {object[]} */
      const out = [];
      for (const log of stores.logs.values()) {
        if (log.date >= startYMD && log.date <= endYMD) {
          out.push(log);
        }
      }
      return out;
    },
    // Phase 03 plan 03 Task 1: per-habit log scan for the D-52
    // `lastCompletedDate` invariant recompute. Mirrors repo.getLogsByHabit
    // (A7 contract); real backing index is `habitId` per D-39 schema.
    async getLogsByHabit(habitId) {
      /** @type {object[]} */
      const out = [];
      for (const log of stores.logs.values()) {
        if (log.habitId === habitId) {
          out.push(log);
        }
      }
      return out;
    },
    // Phase 04 plan 05 Task 1: all logs for a single date (all habitIds).
    // Mirrors repo.getLogsForDate; real backing index is `date` per D-39 schema.
    async getLogsForDate(date) {
      /** @type {object[]} */
      const out = [];
      for (const log of stores.logs.values()) {
        if (log.date === date) {
          out.push(log);
        }
      }
      return out;
    },
    // Phase 05 plan 02 Task 1: full habit_versions scan for JSON export.
    async getAllHabitVersions() {
      return Array.from(stores.habit_versions.values());
    },
    // Phase 04 plan 05 Task 1: most-recent habit_versions row effectiveFrom <= date.
    // Mirrors repo.getHabitVersionAtDate; real uses IDBKeyRange.bound on compound
    // keypath [habitId, effectiveFrom] per D-39 schema.
    async getHabitVersionAtDate(habitId, date) {
      /** @type {object[]} */
      const candidates = [];
      for (const v of stores.habit_versions.values()) {
        if (v.habitId === habitId && v.effectiveFrom <= date) {
          candidates.push(v);
        }
      }
      if (candidates.length === 0) return undefined;
      // Return the most recent version (largest effectiveFrom <= date).
      candidates.sort((a, b) => a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0);
      return candidates[candidates.length - 1];
    },
    async putEvent(e) { putters.events(e); },
    async getEvent(id) { return stores.events.get(id); },
    // Phase 05 plan 02 Task 1: full events scan for JSON export.
    async getAllEvents() {
      return Array.from(stores.events.values());
    },
    async getMeta(key) { return stores.meta.get(key)?.value; },
    async putMeta(key, value) { putters.meta({ key, value }); },
    // Phase 05 plan 02 Task 1: full meta scan for JSON export.
    async getAllMeta() {
      return Array.from(stores.meta.values());
    },
    async putSetting(s) { putters.settings(s); },
    async getSetting(key) { return stores.settings.get(key); },
    // Phase 05 plan 02 Task 1: full settings scan for JSON export.
    async getAllSettings() {
      return Array.from(stores.settings.values());
    },
    // Phase 05 plan 02 Task 1: full score_snapshots scan for JSON export.
    // Will be empty in P5; populated in P6 when scoring runs.
    async getAllScoreSnapshots() {
      return Array.from(stores.score_snapshots.values());
    },
    // Phase 06 quick-fix analytics-columns-empty: typed get by [habitId, date].
    // Mirrors repo.getSnapshot (A7 contract preserved). Used by the Analytics
    // view instead of repo.runTx so the result is the actual snapshot row,
    // not the raw IDBRequest object that runTx body() returns.
    async getSnapshot(habitId, date) {
      return stores.score_snapshots.get(JSON.stringify([habitId, date]));
    },

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
