/**
 * @file Hand-written ~80-line promise wrapper around IndexedDB. The ONLY
 * module that calls `indexedDB` directly (D-30, ARCHITECTURE §3, STACK.md
 * §IndexedDB Approach, Anti-Pattern 1).
 *
 * Locked decisions implemented here:
 *   - D-30: DB_NAME = 'habits' (namespace-aligned with the cache prefix +
 *           BroadcastChannel name + manifest name).
 *   - D-39: `score_snapshots` is one of the seven v1 stores (declared by
 *           `js/db/schema.js`); this file never touches store names directly.
 *   - D-42: `events` store keyed by UUID — same `put`/`get` helpers here
 *           cover both UUID-keyed and compound-keyed stores.
 *
 * Critical invariant (Pitfall 1 + MDN IDBTransaction): NEVER `await` an
 * unrelated async API inside a tx body — IDB auto-commits on idle tick. The
 * wrong `await` mid-tx (e.g. `await fetch(...)`, `await sleep(...)`) kills
 * the transaction. Inside a `runTx` body, only sequence IDB ops (or `await
 * promisify(req)` for the same tx); chain anything else AFTER `await done(tx)`.
 *
 * Critical invariant (Pitfall 2 + ARCH §6): callers MUST `await runTx(...)`
 * (which awaits `done(tx)`) THEN broadcast. Broadcasting before the tx
 * completes lets the receiving tab re-read stale state.
 *
 * Note: this file holds no per-op cursor helper because P2 callers never need
 * cursors; `indexGetAll` covers the bulk-by-index use cases (logs by date,
 * events by `at` range, snapshots by date). If P3+ adds a streaming use case,
 * add a `cursor()` helper here — keep the indexedDB surface confined to this
 * module.
 *
 * Forbidden constructs in this file:
 *   - Calling `tx.commit()` (use `await done(tx)`; manual commits skip durability).
 *   - `await fetch(...)` / `await setTimeout(...)` inside a `runTx` body example.
 *   - `console.log` of habit content (Security V7 — content stays out of logs).
 */

import { DB_VERSION, MIGRATIONS } from './schema.js';

const DB_NAME = 'habits';

/**
 * Open the habits IndexedDB at the current DB_VERSION. Resolves once the
 * onsuccess handler fires (i.e. after any onupgradeneeded has completed).
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = /** @type {IDBDatabase} */ (e.target.result);
      const tx = e.target.transaction;
      // Pitfall 10: explicit loop, NOT a switch — guarantees a fresh install
      // (oldVersion === 0) walks every migration in order.
      for (let v = e.oldVersion + 1; v <= e.newVersion; v++) {
        MIGRATIONS[v](db, tx);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Wrap an IDBRequest as a Promise resolving with `req.result` on success.
 *
 * @param {IDBRequest} req
 * @returns {Promise<*>}
 */
export function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Source of truth for "data durable" — resolves only after the tx commits.
 * Pitfall 2: always `await done(tx)` before broadcasting / notifying.
 *
 * @param {IDBTransaction} tx
 * @returns {Promise<void>}
 */
export function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('tx aborted'));
  });
}

/**
 * Open a transaction over `stores` in `mode`, run `body(tx)`, and await
 * commit. The body is responsible for sequencing ops; do NOT `await`
 * anything unrelated inside (Pitfall 1).
 *
 * @template T
 * @param {IDBDatabase} db
 * @param {string[]} stores
 * @param {'readonly'|'readwrite'} mode
 * @param {(tx: IDBTransaction) => Promise<T>|T} body
 * @returns {Promise<T>}
 */
export async function runTx(db, stores, mode, body) {
  const tx = db.transaction(stores, mode);
  const result = await body(tx);
  await done(tx);
  return result;
}

/**
 * Read a single row by key from `store` in a fresh readonly tx.
 *
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {IDBValidKey} key
 * @returns {Promise<object|undefined>}
 */
export function get(db, store, key) {
  const tx = db.transaction(store, 'readonly');
  return promisify(tx.objectStore(store).get(key));
}

/**
 * Read every row in `store` in a fresh readonly tx.
 *
 * @param {IDBDatabase} db
 * @param {string} store
 * @returns {Promise<object[]>}
 */
export function getAll(db, store) {
  const tx = db.transaction(store, 'readonly');
  return promisify(tx.objectStore(store).getAll());
}

/**
 * Put a single row into `store` in a fresh readwrite tx; awaits commit.
 *
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {object} value
 * @returns {Promise<void>}
 */
export async function put(db, store, value) {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
}

/**
 * Delete a single row by key from `store` in a fresh readwrite tx; awaits commit.
 *
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
export async function del(db, store, key) {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

/**
 * Read every row matching `query` on the named index in a fresh readonly tx.
 * `query` may be a key, an `IDBKeyRange`, or `null` (read all).
 *
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {string} indexName
 * @param {IDBValidKey|IDBKeyRange|null} [query]
 * @returns {Promise<object[]>}
 */
export function indexGetAll(db, store, indexName, query) {
  const tx = db.transaction(store, 'readonly');
  const idx = tx.objectStore(store).index(indexName);
  return promisify(query == null ? idx.getAll() : idx.getAll(query));
}
