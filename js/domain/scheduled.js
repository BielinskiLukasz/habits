/**
 * @file Scheduled-status boot service — one-time migration pass (DATA-03) and
 * every-boot promotion pass (SCHED-03). configureScheduled({repo}) injects the
 * repo handle; bootScheduled() runs runMigration() then runPromotion() on every
 * app boot. Both passes use repo.runTx directly (not apply.js) — system-driven
 * writes that run before UI mounts (D-07). The meta key 'scheduledMigrationV1'
 * guards runMigration() against re-running (D-05, D-06).
 *
 * Configure-based DI:
 *   - `configureScheduled({repo})` injects the repo handle; production passes
 *     the real repo once at boot. Tests inject fakes via the same hook.
 *
 * Forbidden constructs in this file:
 *   - Direct `js/db/repo.js` write helpers — all writes go through `repo.runTx`.
 *   - `.innerHTML` family — D-78 grep gate covers this file too.
 */

import { todayLocal } from '../util/date.js';

/** @type {object|null} */
let _repo = null;

/**
 * Inject dependencies. Truthy-field overwrite pattern from seed.js: only
 * the keys present AND truthy overwrite the module-level mutables. This lets
 * a test inject only `repo` without affecting other fields.
 *
 * @param {{ repo?: object }} deps
 * @returns {void}
 */
export function configureScheduled(deps) {
  if (deps.repo) _repo = deps.repo;
}

/**
 * Run migration + promotion on every boot. Calls runMigration() (one-time
 * DATA-03 reclassification) then runPromotion() (every-boot SCHED-03 auto-
 * transition). Safe to call repeatedly — runMigration is guarded by a meta
 * key; runPromotion is naturally idempotent.
 *
 * @returns {Promise<void>}
 */
export async function bootScheduled() {
  if (!_repo) {
    throw new Error('scheduled: configureScheduled({repo}) not called');
  }
  await runMigration();
  await runPromotion();
}

/**
 * One-time DATA-03 reclassification pass. Finds habits with
 * `status === 'active'` and `startDate > todayLocal()` and rewrites them to
 * `status === 'scheduled'` in a single atomic transaction that also sets the
 * `scheduledMigrationV1` meta key. Subsequent boots skip this function
 * entirely via the meta guard (D-05, D-06).
 *
 * @returns {Promise<void>}
 */
async function runMigration() {
  // Fast-path: meta key present → migration already ran.
  const migrationDone = await _repo.getMeta('scheduledMigrationV1');
  if (migrationDone !== undefined) return;

  const habits = await _repo.getAllHabits();
  const today = todayLocal();
  const toReclassify = habits.filter(
    (h) => h.status === 'active' && h.startDate > today,
  );

  // Write the meta guard and any reclassified habits atomically in one tx
  // so a crash mid-run cannot leave the meta key set with habits still
  // showing 'active', or vice-versa (T-07-01).
  await _repo.runTx(['habits', 'meta'], 'readwrite', (tx) => {
    for (const h of toReclassify) {
      tx.objectStore('habits').put({ ...h, status: 'scheduled' });
    }
    tx.objectStore('meta').put({ key: 'scheduledMigrationV1', value: true });
  });
}

/**
 * Every-boot SCHED-03 auto-transition pass. Finds habits with
 * `status === 'scheduled'` and `startDate <= todayLocal()` and rewrites them
 * to `status === 'active'`. Naturally idempotent — habits already active are
 * never touched.
 *
 * @returns {Promise<void>}
 */
async function runPromotion() {
  const habits = await _repo.getAllHabits();
  const today = todayLocal();
  const toPromote = habits.filter(
    (h) => h.status === 'scheduled' && h.startDate <= today,
  );

  if (toPromote.length === 0) return;

  await _repo.runTx(['habits'], 'readwrite', (tx) => {
    for (const h of toPromote) {
      tx.objectStore('habits').put({ ...h, status: 'active' });
    }
  });
}
