/**
 * @file JSON import — merge-by-id restore with schema version validation
 * (IMPORT-01, IMPORT-02, IMPORT-03, D-98, D-99, D-100).
 *
 * Mirrors the `js/io/seed.js` DI pattern: `configureImport({repo, broadcast})`
 * injects dependencies; production boot wires the real repo and a real
 * BroadcastChannel; tests inject fakes.
 *
 * Merge semantics (D-98):
 *   - For every store, imported rows are written via `tx.objectStore(s).put()`.
 *   - IDB `put()` is an upsert — overwrites an existing row with the same
 *     primary key, inserts if absent. Local-only rows (not present in the
 *     import) are NEVER deleted.
 *   - All 7 stores are merged in a single `repo.runTx()` call for atomicity
 *     (no partial imports on error).
 *
 * Schema version validation (D-99):
 *   - `imported.schemaVersion` is compared to `DB_VERSION` from schema.js.
 *   - If the imported version is GREATER than the current app version, the
 *     import is rejected with a clear error message.
 *   - Missing `schemaVersion` defaults to 1 (backward-compatible assumption
 *     for very old exports that predate the field).
 *
 * Broadcast (D-100):
 *   - After the transaction commits, if a `broadcast` object was injected,
 *     `broadcast.postMessage({type: 'import:done'})` is sent to notify other
 *     tabs to reload. This happens AFTER the tx — never before (Pitfall 3 /
 *     anti-pattern: broadcasting while tx is still pending lets a receiving
 *     tab read stale state).
 *
 * Threat model:
 *   - T-05-05 (Tampering): `schemaVersion` checked before any IDB write.
 *     Malformed payload validated (must be object with `habits` array).
 *   - T-05-06 (Info Disclosure): accepted — restored data is user's own content.
 *
 * Forbidden constructs in this file:
 *   - Direct `js/db/repo.js` per-store write helpers (`putHabit`, `putLog`,
 *     etc.) — write ONLY via `repo.runTx()` (discipline: same chokepoint as
 *     `js/io/seed.js`).
 *   - Broadcast before tx commit — broadcast is the last statement.
 */

import { DB_VERSION } from '../db/schema.js';

/** @type {object|null} */
let _repo = null;

/**
 * Optional BroadcastChannel-shaped object — must expose `postMessage(msg)`.
 * If null/undefined, no broadcast is sent after import (safe default; the
 * UI plan (05-05) wires a real channel).
 *
 * @type {{postMessage: (msg: object) => void}|null}
 */
let _broadcast = null;

/**
 * Ordered list of all 7 IDB store names. Must match `js/db/schema.js`
 * `MIGRATIONS[1]` declaration order; the tx body iterates in this order.
 *
 * @type {string[]}
 */
const STORE_NAMES = [
  'habits',
  'habit_versions',
  'logs',
  'events',
  'settings',
  'meta',
  'score_snapshots',
];

/**
 * Inject dependencies. Truthy fields overwrite the module-level mutables so
 * a test can inject only `broadcast` without re-injecting `repo`.
 *
 * @param {{
 *   repo?: object,
 *   broadcast?: {postMessage: (msg: object) => void}
 * }} deps
 * @returns {void}
 */
export function configureImport(deps) {
  if (deps.repo) _repo = deps.repo;
  if (Object.prototype.hasOwnProperty.call(deps, 'broadcast')) {
    _broadcast = deps.broadcast ?? null;
  }
  console.log('[import] configureImport called — _repo set:', !!_repo);
}

/**
 * Merge an imported JSON backup into local IDB using merge-by-id semantics
 * (D-98). Overwrites colliding rows; never deletes local-only records. All
 * 7 stores are merged in a single atomic transaction.
 *
 * @param {object} imported - Parsed JSON object from an exported backup file.
 *   Expected shape: `{schemaVersion?: number, habits: [...], logs: [...], ...}`
 * @throws {Error} If `imported` is not a valid backup (null, non-object, or
 *   missing `habits` array).
 * @throws {Error} If `imported.schemaVersion > DB_VERSION` (D-99 — backup was
 *   created by a newer app version; user must update the app first).
 * @returns {Promise<void>}
 */
export async function mergeImportedStores(imported) {
  // Structural validation (T-05-05): reject malformed payloads before any IDB write.
  if (!imported || typeof imported !== 'object' || !Array.isArray(imported.habits)) {
    throw new Error(
      'Invalid import file: not a valid backup (expected an object with a "habits" array)',
    );
  }

  // D-99: Schema version check. Default to 1 when the field is absent (older
  // exports that predate the schemaVersion field are assumed to be v1).
  const importedVersion = imported.schemaVersion ?? 1;
  if (importedVersion > DB_VERSION) {
    throw new Error(
      `This backup was created with a newer version of the app (version ${importedVersion}). ` +
        'Please update the app before importing.',
    );
  }

  const repo = _repo;
  console.log('[import] mergeImportedStores called — _repo:', !!repo);
  if (!repo) {
    throw new Error('import: configureImport({repo}) not called');
  }

  // Merge all 7 stores atomically (D-98 merge-by-id via IDB put upsert).
  // Stores absent from the import payload are treated as empty (no writes).
  await repo.runTx(STORE_NAMES, 'readwrite', async (tx) => {
    for (const storeName of STORE_NAMES) {
      const importedRows = imported[storeName] ?? [];
      for (const row of importedRows) {
        // IDB put() overwrites on key collision; inserts if absent.
        // No delete() calls — local-only records are preserved (D-98).
        tx.objectStore(storeName).put(row);
      }
    }
  });

  // D-100: Broadcast reload signal AFTER tx commits (Pitfall 3 guard).
  if (_broadcast) {
    _broadcast.postMessage({ type: 'import:done' });
  }
}
