/**
 * @file DB_VERSION + MIGRATIONS dispatch table (DATA-02, Pitfall 10, D-39, D-42).
 *
 * v1 schema is the LOCKED layout for the remainder of the project. The seven
 * stores below MUST be considered append-only after this commit — any future
 * schema change ships as a NEW MIGRATIONS[N] entry that ADDS object stores or
 * indexes; existing stores / indexes are never removed or renamed. Doing
 * otherwise would silently lose user data on the next browser open
 * (`onupgradeneeded` runs once per version bump).
 *
 * Locked decisions implemented here:
 *   - DATA-02: v1 schema declared in one place, dispatched per Pitfall 10.
 *   - DATA-05: `logs` rows carry `definitionVersion` (null = "current") — the
 *     compound keyPath `[habitId, date]` + `habit_versions` store key the
 *     version-aware history rendering that ships in P3+.
 *   - D-30: DB name is 'habits' (see `js/db/idb.js`).
 *   - D-39: `score_snapshots` is declared empty in v1, so P6 starts writing
 *     to it without needing a v2 migration (Pitfall 6).
 *   - D-42: `events` store keyed by UUID (`{ keyPath: 'id' }`), NOT
 *     autoincrement — cross-device import safety + consistency with
 *     `habits` / `habit_versions`.
 *
 * Dispatch pattern (Pitfall 10): the consumer in `js/db/idb.js` walks the
 * table with an explicit `for (let v = oldVersion + 1; v <= newVersion; v++)
 * MIGRATIONS[v](db, tx)` loop — NEVER a `switch` with fallthrough. The loop
 * is the only contract that guarantees a v0 → vN browser runs every migration
 * exactly once, in order.
 *
 * Forbidden constructs in this file:
 *   - `switch` statements (use the dispatch loop in idb.js)
 *   - `deleteObjectStore` / `deleteIndex` (additive-only)
 *   - `autoIncrement: true` (D-42 — UUIDs only)
 */

/** @type {number} */
export const DB_VERSION = 1;

/**
 * IDB migrations dispatch table — one entry per version bump.
 *
 * @type {Record<number, (db: IDBDatabase, tx: IDBTransaction | null) => void>}
 */
export const MIGRATIONS = {
  1: (db, _tx) => {
    // IDBObjectStore.createIndex() returns the IDBIndex (NOT the parent store),
    // so multi-index stores cannot use a fluent chain — capture the store and
    // call createIndex on it directly. Caught during Phase 2 Wave 5 human-verify
    // when the Node-side fake-IDB mock incorrectly returned the store from
    // createIndex, masking the failure (Pitfall 9 — fake/real divergence).
    const habits = db.createObjectStore('habits', { keyPath: 'id' });
    habits.createIndex('wave', 'wave');
    habits.createIndex('status', 'status');

    const habitVersions = db.createObjectStore('habit_versions', { keyPath: ['habitId', 'effectiveFrom'] });
    habitVersions.createIndex('habitId', 'habitId');

    const logs = db.createObjectStore('logs', { keyPath: ['habitId', 'date'] });
    logs.createIndex('date', 'date');
    logs.createIndex('habitId', 'habitId');

    // D-42 — UUID, not autoincrement.
    const events = db.createObjectStore('events', { keyPath: 'id' });
    events.createIndex('at', 'at');
    events.createIndex('type', 'type');
    events.createIndex('habitId', 'habitId');

    db.createObjectStore('settings', { keyPath: 'key' });
    db.createObjectStore('meta', { keyPath: 'key' });

    // D-39 — declared empty so P6 starts writing without a v2 migration.
    const snapshots = db.createObjectStore('score_snapshots', { keyPath: ['habitId', 'date'] });
    snapshots.createIndex('date', 'date');
    snapshots.createIndex('habitId', 'habitId');
  },
};
