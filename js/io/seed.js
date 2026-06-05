/**
 * @file Idempotent first-run seed loader + `navigator.storage.persist()` +
 * D-45 settings defaults (SEED-01..05, D-31, D-32, D-33, D-41, D-45).
 *
 * Lifecycle on every boot:
 *
 *   1. Fast-path no-op: if both `meta.seededIds` AND `meta.persistResult`
 *      already exist, return early. This is the steady-state path on every
 *      boot after the first.
 *
 *   2. Otherwise fetch `./seed/habits.json` via the configured fetch
 *      (defaults to `globalThis.fetch` in production). Validate the
 *      wrapped-object shape `{schemaVersion: 1, seedVersion: 1, habits: [...]}`
 *      per RESEARCH §Open Question 3 RESOLVED.
 *
 *   3. Diff against the previously-seeded set (`meta.seededIds`) and the
 *      defensive double-check against `repo.getHabit(id)` — never insert
 *      a habit whose id is already present in either source (Pitfall 5).
 *      User edits to seeded rows are preserved (D-33 / T-02-03 — the
 *      data-trust invariant of this phase).
 *
 *   4. Single tx writes: each new habit + one `seed:createHabit` event per
 *      habit (SEED-04, inverse:null so seed events are non-undoable) +
 *      `meta.seededIds` (full set, not just newly inserted) + D-45 settings
 *      defaults (`defaultThreshold = 0.9`, `defaultWindowDays = 70`,
 *      `schemaVersion = 1`).
 *
 *   5. After the tx commits, if `meta.persistResult` is still undefined,
 *      call `navigator.storage.persist()` once and record the outcome in
 *      a second meta-only tx (Pitfall 11 — gate via the flag). The result
 *      itself is non-fatal regardless of value (Pitfall 3 — Chrome's
 *      engagement-metrics default is `false`).
 *
 * Configure-based DI (RESEARCH §Open Question 2):
 *   - `configureSeed({ repo, storage, fetch })` injects the repo handle,
 *     the `navigator.storage`-shaped object, and the fetch function.
 *   - Production omits any field to fall back to `globalThis.navigator.storage`
 *     / `globalThis.fetch`. Tests inject fakes.
 *   - Symmetric with `apply.configure({ repo, broadcast, trackTx })` and
 *     `configureUndo({ repo, apply? })`.
 *
 * Threat-model dispositions implemented here:
 *   - T-02-03 (data-trust): merge-by-id diff in step 3 — never overwrites
 *     existing rows.
 *   - T-02-XSS (seed-injection): schema-validates `seed.habits` is an
 *     array and `seed.schemaVersion === 1`. JSON.parse is safe against
 *     prototype pollution by default.
 *   - T-02-PERSIST11 (persist re-probe): gated by `meta.persistResult`.
 *   - T-02-SCHEMA (cadence drift): handled at the seed-fixture level via
 *     `cadence_v: 1` (Pitfall 12); the loader copies the field verbatim
 *     into IDB so future cadence engines can dispatch on the version.
 *
 * Forbidden constructs in this file:
 *   - Direct `js/db/repo.js` write helpers (`putHabit`, `putLog`,
 *     `putEvent`, `putMeta`, `putSetting`) — discipline test (T-02-14)
 *     forbids them in `js/io/`. We write via `repo.runTx(...)` instead,
 *     which is the chokepoint-compatible path.
 *   - xlsx / SheetJS / exceljs / parse_xlsx — SEED-05 grep gate.
 */

import { newId } from '../util/id.js';
import { normalizeSlotsToArray } from '../util/slots.js';

/** @type {object|null} */
let _repo = null;

/** @type {{persist?: () => Promise<boolean>, persisted?: () => Promise<boolean>}|null} */
let _storage = null;

/** @type {((url: string) => Promise<{json: () => Promise<object>}>)|null} */
let _fetch = null;

/**
 * Inject dependencies. Truthy fields overwrite the module-level mutables; this
 * lets a test inject only `storage` without re-injecting repo. Production boot
 * (plan 02-05) calls this once with the real repo + the real `navigator.storage`.
 *
 * @param {{
 *   repo?: object,
 *   storage?: {persist?: () => Promise<boolean>, persisted?: () => Promise<boolean>},
 *   fetch?: (url: string) => Promise<{json: () => Promise<object>}>
 * }} deps
 * @returns {void}
 */
export function configureSeed(deps) {
  if (deps.repo) _repo = deps.repo;
  if (deps.storage) _storage = deps.storage;
  if (deps.fetch) _fetch = deps.fetch;
}

/**
 * Run the idempotent seed-loader on the configured repo. Safe to invoke on
 * every boot — short-circuits via `meta.seededIds` + `meta.persistResult`
 * after the first run.
 *
 * @returns {Promise<void>}
 */
export async function bootSeed() {
  if (!_repo) {
    throw new Error('seed: configureSeed({repo}) not called');
  }
  const repo = _repo;
  const storage = _storage ?? (globalThis.navigator && globalThis.navigator.storage) ?? null;
  const fetchFn = _fetch ?? globalThis.fetch ?? null;

  // Fast-path no-op (steady-state on every boot after the first).
  const seededIds = await repo.getMeta('seededIds');
  const persistResult = await repo.getMeta('persistResult');
  if (seededIds !== undefined && persistResult !== undefined) {
    return;
  }

  // Only fetch the seed file if we still need it (seededIds missing or
  // partially populated). When ONLY persistResult is missing we still need
  // the seed file? No — if seededIds is present we can skip the seed-tx and
  // jump straight to persist().
  /** @type {object|null} */
  let seed = null;
  if (seededIds === undefined) {
    if (!fetchFn) {
      throw new Error('seed: no fetch available (configureSeed({fetch}) or globalThis.fetch)');
    }
    const res = await fetchFn('./seed/habits.json');
    seed = await res.json();

    // Schema validation (T-02-XSS — reject malformed seed before any IDB write).
    if (
      !seed ||
      typeof seed !== 'object' ||
      !Array.isArray(seed.habits) ||
      seed.schemaVersion !== 1
    ) {
      throw new Error('seed: malformed');
    }
  }

  if (seed) {
    // Diff against the existing seededIds set + defensive double-check via
    // repo.getHabit(id) per Pitfall 5 (a habit might exist from an out-of-band
    // recovery flow).
    const existing = new Set(seededIds ?? []);
    /** @type {object[]} */
    const toInsert = [];
    for (const h of seed.habits) {
      if (existing.has(h.id)) continue;
      const present = await repo.getHabit(h.id);
      if (present) continue;
      toInsert.push(h);
    }

    // Even when toInsert is empty (e.g. seededIds was an empty array on disk),
    // we still write the seed tx to record seededIds + the D-45 settings
    // defaults that match this code path's first-run guarantee. The tx is
    // idempotent — re-writing seededIds with the same array, and re-writing
    // the three D-45 settings rows with the same values, is a structurally
    // safe no-op in IDB (put overwrites).
    const seededList = seed.habits.map((h) => h.id);

    await repo.runTx(
      ['habits', 'events', 'meta', 'settings'],
      'readwrite',
      async (tx) => {
        for (const h of toInsert) {
          tx.objectStore('habits').put({ ...h, slots: normalizeSlotsToArray(h.slots) });
          tx.objectStore('events').put({
            id: newId(),
            // events.at uses ISO timestamp (DATA-06 only constrains date KEYS
            // like logs.date; events are point-in-time, not date-keyed).
            at: new Date().toISOString(),
            type: 'seed:createHabit',
            payload: { habitId: h.id },
            inverse: null,
          });
        }
        // Full list (not just newly inserted) so subsequent boots short-circuit.
        tx.objectStore('meta').put({ key: 'seededIds', value: seededList });

        // D-45 settings defaults (separate put calls — settings rows are
        // {key, value} per store keypath).
        tx.objectStore('settings').put({ key: 'defaultThreshold', value: 0.9 });
        tx.objectStore('settings').put({ key: 'defaultWindowDays', value: 70 });
        tx.objectStore('settings').put({ key: 'schemaVersion', value: 1 });
      },
    );
  }

  // Persist gate (Pitfall 11). Only fire when meta.persistResult is still
  // undefined — every subsequent boot sees the flag and skips the re-probe.
  if (persistResult === undefined) {
    /** @type {boolean} */
    let granted = false;
    if (storage && typeof storage.persist === 'function') {
      // Pitfall 3: false is non-fatal regardless of cause (Chrome
      // engagement-metrics default vs Safari prompt denial). The diagnostics
      // panel surfaces the value but we never branch on it here.
      granted = await storage.persist();
    }
    await repo.runTx(['meta'], 'readwrite', async (tx) => {
      tx.objectStore('meta').put({ key: 'persistResult', value: granted });
    });
  }
}
