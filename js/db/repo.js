/**
 * @file Typed CRUD facade over `js/db/idb.js` — every store has typed
 * get/put helpers (DATA-01).
 *
 * Locked decisions implemented here:
 *   - DATA-01: each store is reached only through a typed helper here; views
 *     and state modules never call `idb.js` primitives directly.
 *   - DATA-05: `putLog` accepts `definitionVersion` on the log row (null =
 *     "current"); the schema's compound keypath `[habitId, date]` ensures
 *     re-marking the same (habitId, date) overwrites in place.
 *   - D-30: opens via `openDB()` which uses DB_NAME = 'habits'.
 *   - D-42: events are UUID-keyed; `putEvent` / `getEvent` take/return rows
 *     by the `.id` UUID.
 *
 * Anti-Pattern 1 ("Views Calling repo.js Directly"... actually, the inverse:
 * "Views Calling idb.js Directly"): EVERY mutator and read path uses these
 * helpers — `idb.js` is reachable ONLY from this file. The contract test in
 * `tests/integration/contract.fake-vs-real.test.js` enforces the surface
 * matches `tests/helpers/fake-idb.js`; CI fails on drift (A7).
 *
 * Module-load discipline (Pitfall 9): this file is import-safe in Node. NO
 * top-level call to `openDB()` — the DB handle is obtained lazily inside
 * each exported function. `node --test` can `import * as repo from
 * './repo.js'` without triggering `ReferenceError: indexedDB is not
 * defined`; only actually invoking a repo function in Node would fail (and
 * the contract test in Task 4 is the one place that does that — see its
 * note for why it never calls anything).
 *
 * Forbidden constructs in this file:
 *   - Direct `indexedDB.open(...)` / `indexedDB.*` (Anti-Pattern 1; only
 *     `idb.js` calls indexedDB).
 *   - `tx.commit()` (use `await done(tx)` via `runTx` from idb.js).
 *   - Any export name not present in `tests/helpers/fake-idb.js`
 *     (enforced by the A7 contract test).
 */

import {
  openDB,
  runTx as idbRunTx,
  get,
  put,
  getAll,
  indexGetAll,
} from './idb.js';

/**
 * Get a habit by id (UUID).
 *
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
export async function getHabit(id) {
  const db = await openDB();
  return get(db, 'habits', id);
}

/**
 * Put a habit (full row). `h.id` is the UUID keypath.
 *
 * @param {object} h
 * @returns {Promise<void>}
 */
export async function putHabit(h) {
  const db = await openDB();
  await put(db, 'habits', h);
}

/**
 * Get every habit row. Enables Slice 2's Today hydrate path to do a single
 * bounded read on cold-paint per NFR-01 (D-52). Pair with `getLogsInRange`
 * to cover the weekly + every-N-days cadence resolvers.
 *
 * @returns {Promise<object[]>}
 */
export async function getAllHabits() {
  const db = await openDB();
  return getAll(db, 'habits');
}

/**
 * Put a log row. Required: `habitId`, `date` (YYYY-MM-DD, local). Canonical
 * shape carries `definitionVersion` (null = "current") per DATA-05; rows
 * without that field are still accepted (forward-compat).
 *
 * @param {{ habitId: string, date: string, completed?: boolean, definitionVersion?: string|null }} l
 * @returns {Promise<void>}
 */
export async function putLog(l) {
  const db = await openDB();
  await put(db, 'logs', l);
}

/**
 * Get a log row by compound key.
 *
 * @param {string} habitId
 * @param {string} date YYYY-MM-DD, local
 * @returns {Promise<object|undefined>}
 */
export async function getLog(habitId, date) {
  const db = await openDB();
  return get(db, 'logs', [habitId, date]);
}

/**
 * Get every log row whose `date` falls in the inclusive `[startYMD, endYMD]`
 * range, via the existing `date` index on the `logs` store (D-39). Today's
 * hydrate path uses this for the weekly-cadence completion window.
 *
 * @param {string} startYMD YYYY-MM-DD, inclusive
 * @param {string} endYMD YYYY-MM-DD, inclusive
 * @returns {Promise<object[]>}
 */
export async function getLogsInRange(startYMD, endYMD) {
  const db = await openDB();
  return indexGetAll(db, 'logs', 'date', IDBKeyRange.bound(startYMD, endYMD));
}

/**
 * Get every log row for the given `habitId` via the `habitId` index on the
 * `logs` store (D-39). Used by the D-52 invariant recompute in
 * `js/state/apply/markUncompleted.js#_recomputeLastCompletedDate` — given a
 * habit's full log history (plus the about-to-be-written row), the helper
 * finds the max date where `completed === true`.
 *
 * @param {string} habitId
 * @returns {Promise<object[]>}
 */
export async function getLogsByHabit(habitId) {
  const db = await openDB();
  return indexGetAll(db, 'logs', 'habitId', habitId);
}

/**
 * Get every log row whose `date` exactly equals `date` (all habitIds) via the
 * `date` index on the `logs` store (D-39, Phase 04 plan 05). Used by the
 * Today view to bulk-read all completion state for a single calendar day.
 *
 * @param {string} date YYYY-MM-DD, local
 * @returns {Promise<object[]>}
 */
export async function getLogsForDate(date) {
  const db = await openDB();
  return indexGetAll(db, 'logs', 'date', IDBKeyRange.only(date));
}

/**
 * Get the most recent `habit_versions` row for `habitId` whose `effectiveFrom`
 * is <= `date` (Phase 04 plan 05, NFR-10). Uses the compound keypath
 * `[habitId, effectiveFrom]` on the `habit_versions` store (D-39) with an
 * `IDBKeyRange.bound` from `[habitId, '0000-01-01']` to `[habitId, date]` so
 * all versions in the store are lexicographically bounded by habitId first.
 * Returns the LAST entry (largest effectiveFrom in the range) or `undefined`.
 *
 * @param {string} habitId
 * @param {string} date YYYY-MM-DD, inclusive upper bound
 * @returns {Promise<object|undefined>}
 */
export async function getHabitVersionAtDate(habitId, date) {
  const db = await openDB();
  const range = IDBKeyRange.bound([habitId, '0000-01-01'], [habitId, date]);
  const results = await getAll(db, 'habit_versions', range);
  return results.length > 0 ? results[results.length - 1] : undefined;
}

/**
 * Put an event row. `e.id` is the UUID keypath (D-42) — caller MUST set it
 * (via `newId()` from `js/util/id.js`) before calling.
 *
 * @param {object} e
 * @returns {Promise<void>}
 */
export async function putEvent(e) {
  const db = await openDB();
  await put(db, 'events', e);
}

/**
 * Get an event row by UUID.
 *
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
export async function getEvent(id) {
  const db = await openDB();
  return get(db, 'events', id);
}

/**
 * Get a meta value by key. Returns just the VALUE field of the
 * `{ key, value }` row (matches the fake-IDB signature so callers behave
 * identically against fake AND real).
 *
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function getMeta(key) {
  const db = await openDB();
  const row = await get(db, 'meta', key);
  return row?.value;
}

/**
 * Put a meta entry `{ key, value }`. Accepts key + value as separate args
 * (matches the fake-IDB signature).
 *
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function putMeta(key, value) {
  const db = await openDB();
  await put(db, 'meta', { key, value });
}

/**
 * Get a settings row by key. Returns the FULL row (e.g.
 * `{ key: 'defaultThreshold', value: 0.9 }`) — settings rows may carry
 * additional fields beyond `value` over time, so callers receive the row.
 *
 * @param {string} key
 * @returns {Promise<object|undefined>}
 */
export async function getSetting(key) {
  const db = await openDB();
  return get(db, 'settings', key);
}

/**
 * Put a settings row. `s.key` is the keypath.
 *
 * @param {{ key: string, value: * }} s
 * @returns {Promise<void>}
 */
export async function putSetting(s) {
  const db = await openDB();
  await put(db, 'settings', s);
}

/**
 * Get every log row. Used by `js/io/export.js#exportJSON` to dump the full
 * logs store into the JSON backup (EXPORT-01, Plan 05-02).
 *
 * @returns {Promise<object[]>}
 */
export async function getAllLogs() {
  const db = await openDB();
  return getAll(db, 'logs');
}

/**
 * Get every `habit_versions` row. Used by `js/io/export.js#exportJSON`
 * (EXPORT-01, Plan 05-02).
 *
 * @returns {Promise<object[]>}
 */
export async function getAllHabitVersions() {
  const db = await openDB();
  return getAll(db, 'habit_versions');
}

/**
 * Get every event row. Used by `js/io/export.js#exportJSON` (EXPORT-01,
 * Plan 05-02).
 *
 * @returns {Promise<object[]>}
 */
export async function getAllEvents() {
  const db = await openDB();
  return getAll(db, 'events');
}

/**
 * Get every settings row. Used by `js/io/export.js#exportJSON` (EXPORT-01,
 * Plan 05-02).
 *
 * @returns {Promise<object[]>}
 */
export async function getAllSettings() {
  const db = await openDB();
  return getAll(db, 'settings');
}

/**
 * Get every meta row. Used by `js/io/export.js#exportJSON` (EXPORT-01,
 * Plan 05-02).
 *
 * @returns {Promise<object[]>}
 */
export async function getAllMeta() {
  const db = await openDB();
  return getAll(db, 'meta');
}

/**
 * Get every `score_snapshots` row. Used by `js/io/export.js#exportJSON`
 * (EXPORT-01, Plan 05-02). Will be empty in P5 since scoring runs in P6.
 *
 * @returns {Promise<object[]>}
 */
export async function getAllScoreSnapshots() {
  const db = await openDB();
  return getAll(db, 'score_snapshots');
}

/**
 * Get a single score_snapshots row by compound key [habitId, date].
 * Returns `undefined` when no snapshot exists for that (habitId, date) pair.
 *
 * Used by the Analytics view (js/views/desktop/analytics.js) to read
 * today's pre-computed scores per habit without going through runTx —
 * runTx returns the raw body() return value, which for a bare IDBRequest
 * (non-thenable) resolves to the request object rather than its result.
 *
 * @param {string} habitId
 * @param {string} date YYYY-MM-DD, local
 * @returns {Promise<object|undefined>}
 */
export async function getSnapshot(habitId, date) {
  const db = await openDB();
  return get(db, 'score_snapshots', [habitId, date]);
}

/**
 * Multi-store readwrite tx — entry point for `apply.js` / `seed.js` /
 * `undo.js`. The `body` receives the raw IDBTransaction; callers compose
 * `tx.objectStore(name).put(row)` etc. and trust the wrapper to `await
 * done(tx)` before resolving.
 *
 * @template T
 * @param {string[]} stores
 * @param {'readonly'|'readwrite'} mode
 * @param {(tx: IDBTransaction) => Promise<T>|T} body
 * @returns {Promise<T>}
 */
export async function runTx(stores, mode, body) {
  const db = await openDB();
  return idbRunTx(db, stores, mode, body);
}
