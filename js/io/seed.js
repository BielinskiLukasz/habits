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
 *   4. Single tx writes: each new habit (stamped with `createdAt` at insert
 *      time — history-seed-null-startdate, 2026-09-17) + one `seed:createHabit`
 *      event per habit (SEED-04, inverse:null so seed events are non-undoable) +
 *      `meta.seededIds` (full set, not just newly inserted) + D-45 settings
 *      defaults (`defaultThreshold = 0.9`, `defaultWindowDays = 70`,
 *      `schemaVersion = 1`).
 *
 *      `seed/habits.json`'s `habits` array is now empty (history-seed-null-startdate
 *      scope expansion, 2026-09-17 — the 8 placeholder demo habits were never
 *      part of the real Nawyki catalog). Fresh installs seed 0 habits; the
 *      `DEMO_HABIT_IDS` migration below removes the demo habits from any
 *      install that auto-seeded them before this change shipped.
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
import { todayLocal } from '../util/date.js';

/**
 * The 8 hardcoded UUIDs of the placeholder demo habits that used to ship in
 * `seed/habits.json` (history-seed-null-startdate scope expansion, 2026-09-17).
 * None of these appear in the real Nawyki v1.csv or in `data/habits-import-*.json`
 * — they were onboarding placeholder content. Hardcoded here (NOT derived from
 * the seed fixture, which is now empty) so the `demoHabitsRemoved` migration
 * below can still find and remove them from any install that auto-seeded them
 * before this change shipped.
 *
 * @type {string[]}
 */
export const DEMO_HABIT_IDS = [
  '015105be-fc0b-45b6-b939-4e8d395fcf13', // Morning walk
  '44403331-dbdf-4992-ac84-944dba8df6f1', // Drink water (1.5L)
  '83c8b7c5-6c2b-4121-9395-2d7c1e0f99a5', // Weekly grocery run
  'b80c7b07-8a37-471b-b9d1-110b6b90011c', // Shower (every 2 days)
  'c1eecb31-3b91-4a80-92e8-68435b5931f4', // Strength training (M/W/F)
  'eeef9945-6c8c-4440-9d93-baf6fd4ee312', // 5 things grateful for
  '45e0f64f-b9c2-46ca-8b21-3ddbc4e9bf07', // 7 meatless meals/week
  '2694072b-dfe0-4cb3-9ba2-b3aad89f85aa', // Daily learning (3 sources)
];

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
  // All seven flags must be present to short-circuit: habitVersionsSeeded guards
  // the habit_versions backfill (2026-07-03); waveFieldSeeded guards the v1
  // wave backfill (seededIds-only, 2026-08-25); waveFieldV2 guards the v2
  // wave backfill (all habits, 2026-08-26 — fixes imported habits missed by v1);
  // createdAtBackfilled guards the createdAt backfill (2026-09-17 —
  // history-seed-null-startdate: seed habits had no createdAt, defeating the
  // cadence.js existence guard's createdAt fallback for already-seeded installs);
  // demoHabitsRemoved guards the demo-habit removal migration (2026-09-17 —
  // history-seed-null-startdate scope expansion: removes the 8 hardcoded
  // DEMO_HABIT_IDS from already-seeded installs).
  const seededIds = await repo.getMeta('seededIds');
  const persistResult = await repo.getMeta('persistResult');
  const habitVersionsSeeded = await repo.getMeta('habitVersionsSeeded');
  const waveFieldSeeded = await repo.getMeta('waveFieldSeeded');
  const waveFieldV2 = await repo.getMeta('waveFieldV2');
  const createdAtBackfilled = await repo.getMeta('createdAtBackfilled');
  const demoHabitsRemoved = await repo.getMeta('demoHabitsRemoved');
  if (seededIds !== undefined && persistResult !== undefined && habitVersionsSeeded && waveFieldSeeded && waveFieldV2 && createdAtBackfilled && demoHabitsRemoved) {
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
      ['habits', 'habit_versions', 'events', 'meta', 'settings'],
      'readwrite',
      async (tx) => {
        for (const h of toInsert) {
          // Forward-fix (history-seed-null-startdate): stamp createdAt at
          // insert time. seed/habits.json never carries createdAt (a static
          // on-disk fixture can't know its future per-install seed date), and
          // without it js/domain/cadence.js's existence guard is a permanent
          // no-op for these habits (startDate is also null). Mirrors
          // js/state/apply/createHabit.js's contract: every habit row gets a
          // real createdAt.
          tx.objectStore('habits').put({ ...h, slots: normalizeSlotsToArray(h.slots), createdAt: h.createdAt ?? todayLocal() });

          // Write initial habit_versions row so getHabitVersionAtDate can
          // resolve the original name for any date >= effectiveFrom (NFR-10,
          // HISTORY integrity). Without this row, editing a seeded habit
          // produces a version row dated today (effectiveFrom = editDate),
          // leaving pre-edit history with no matching version → fallback to
          // the current (new) name instead of the original.
          //
          // effectiveFrom sentinel: use the habit's explicit startDate if set
          // (scheduled/future habits); otherwise use '0000-01-01'. The
          // sentinel ensures this initial row's compound key [habitId,
          // '0000-01-01'] is ALWAYS different from any future edit row
          // [habitId, editDate], so the edit put() never overwrites the
          // original-name row even when the user edits on the same calendar
          // day as seeding.
          const effectiveFrom = h.startDate ?? '0000-01-01';
          tx.objectStore('habit_versions').put({
            habitId: h.id,
            effectiveFrom,
            name: h.name,
            name_pl: h.name_pl ?? null,
            cadence: h.cadence,
            targetType: h.targetType ?? 'binary',
            target: h.target ?? null,
            stages: h.stages ?? [],
          });

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
        // Mark habit_versions backfill as done for this install path.
        tx.objectStore('meta').put({ key: 'habitVersionsSeeded', value: true });

        // D-45 settings defaults (separate put calls — settings rows are
        // {key, value} per store keypath).
        tx.objectStore('settings').put({ key: 'defaultThreshold', value: 0.9 });
        tx.objectStore('settings').put({ key: 'defaultWindowDays', value: 70 });
        tx.objectStore('settings').put({ key: 'schemaVersion', value: 1 });
      },
    );
  }

  // One-time backfill migration for existing seeded databases that pre-date
  // habit_versions row creation in seed.js (UAT remediation 2026-07-03).
  // habitVersionsSeeded is read at the top (fast-path guard); if falsy here,
  // the migration has not yet run for this database.
  if (!habitVersionsSeeded) {
    const existingSeededIds = await repo.getMeta('seededIds') ?? [];
    /** @type {object[]} */
    const habitsToBackfill = [];
    for (const id of existingSeededIds) {
      // Check whether any habit_versions row exists for this habit.
      // getHabitVersionAtDate with a far-future date returns the most recent
      // version if any exist; returns undefined when none exist.
      const existingVersion = await repo.getHabitVersionAtDate(id, '9999-12-31');
      if (!existingVersion) {
        const habit = await repo.getHabit(id);
        if (habit) habitsToBackfill.push(habit);
      }
    }

    await repo.runTx(
      ['habit_versions', 'meta'],
      'readwrite',
      async (tx) => {
        for (const habit of habitsToBackfill) {
          // Use the habit's explicit startDate/createdAt if present; fall back
          // to '0000-01-01' so this row's key predates all possible log dates.
          // The sentinel date also prevents a future edit (effectiveFrom=editDate)
          // from overwriting this row via the compound key [habitId, effectiveFrom].
          const effectiveFrom = habit.startDate ?? habit.createdAt ?? '0000-01-01';
          tx.objectStore('habit_versions').put({
            habitId: habit.id,
            effectiveFrom,
            name: habit.name,
            name_pl: habit.name_pl ?? null,
            cadence: habit.cadence,
            targetType: habit.targetType ?? 'binary',
            target: habit.target ?? null,
            stages: habit.stages ?? [],
          });
        }
        tx.objectStore('meta').put({ key: 'habitVersionsSeeded', value: true });
      },
    );
  }

  // One-time backfill: wave field missing from IDB for habits seeded before
  // wave was added to habits.json (UAT G-09-2/4/5 — 2026-08-25).
  // waveFieldSeeded is read at the top (fast-path guard); if falsy, the
  // migration has not yet run for this database.
  if (!waveFieldSeeded) {
    // seed may already be loaded above (first-run path). For existing databases
    // where seededIds was present, seed is null — fetch it now to get id→wave.
    let seedForWave = seed;
    if (!seedForWave && fetchFn) {
      const res = await fetchFn('./seed/habits.json');
      seedForWave = await res.json();
    }
    /** @type {object[]} */
    const toUpdate = [];
    if (seedForWave && Array.isArray(seedForWave.habits)) {
      /** @type {Map<string, number>} */
      const waveById = new Map(seedForWave.habits.map((h) => [h.id, h.wave]));
      const allSeededIds = await repo.getMeta('seededIds') ?? [];
      for (const id of allSeededIds) {
        const waveNum = waveById.get(id);
        if (waveNum === undefined) continue;
        const habit = await repo.getHabit(id);
        if (habit && (habit.wave === undefined || habit.wave === null)) {
          toUpdate.push({ ...habit, wave: waveNum });
        }
      }
    }
    await repo.runTx(['habits', 'meta'], 'readwrite', async (tx) => {
      for (const h of toUpdate) {
        tx.objectStore('habits').put(h);
      }
      tx.objectStore('meta').put({ key: 'waveFieldSeeded', value: true });
    });
  }

  // V2 wave-field backfill: scans ALL habits (not just seededIds) so imported
  // habits that were restored from a pre-wave JSON backup also get their wave
  // field set. The v1 backfill only covered seededIds, leaving imported habits
  // with wave === undefined — causing wave planning to show 0 counts while
  // the heatmap still worked (it falls back to wave ?? 0).
  if (!waveFieldV2) {
    let seedForWaveV2 = seed;
    if (!seedForWaveV2 && fetchFn) {
      const res = await fetchFn('./seed/habits.json');
      seedForWaveV2 = await res.json();
    }
    /** @type {object[]} */
    const toUpdateV2 = [];
    if (seedForWaveV2 && Array.isArray(seedForWaveV2.habits)) {
      /** @type {Map<string, number>} */
      const waveByIdV2 = new Map(seedForWaveV2.habits.map((h) => [h.id, h.wave]));
      const allHabitsForWave = await repo.getAllHabits();
      for (const habit of allHabitsForWave) {
        const waveNum = waveByIdV2.get(habit.id);
        if (waveNum === undefined) continue;
        if (habit.wave === undefined || habit.wave === null) {
          toUpdateV2.push({ ...habit, wave: waveNum });
        }
      }
    }
    await repo.runTx(['habits', 'meta'], 'readwrite', async (tx) => {
      for (const h of toUpdateV2) {
        tx.objectStore('habits').put(h);
      }
      tx.objectStore('meta').put({ key: 'waveFieldV2', value: true });
    });
  }

  // One-time backfill: createdAt missing on already-seeded habits (2026-09-17
  // — history-seed-null-startdate). Pre-fix installs have seed-catalog habits
  // with no createdAt field at all, defeating js/domain/cadence.js's
  // existence-guard createdAt fallback (they also have startDate: null, so
  // the guard was a permanent no-op for them). Source of truth is the
  // per-habit seed:createHabit event's `at` timestamp (the historically
  // accurate seed moment) converted to a YMD via UTC slice(0,10), matching
  // the precedent in js/views/desktop/wavePlanning.js. Falls back to
  // habit.startDate ?? todayLocal() when no matching event is found
  // (Pitfall 5 defensive-insert edge case, or a habit that predates the
  // seed:createHabit event write itself).
  if (!createdAtBackfilled) {
    const seededIdsForBackfill = await repo.getMeta('seededIds') ?? [];
    const allEvents = await repo.getAllEvents();
    /** @type {Map<string, string>} */
    const seedEventAtByHabitId = new Map();
    for (const evt of allEvents) {
      if (evt.type === 'seed:createHabit' && evt.payload && evt.payload.habitId) {
        if (!seedEventAtByHabitId.has(evt.payload.habitId)) {
          seedEventAtByHabitId.set(evt.payload.habitId, evt.at);
        }
      }
    }

    /** @type {object[]} */
    const toBackfillCreatedAt = [];
    for (const id of seededIdsForBackfill) {
      const habit = await repo.getHabit(id);
      if (!habit || habit.createdAt) continue;
      const eventAt = seedEventAtByHabitId.get(id);
      const createdAt = eventAt ? eventAt.slice(0, 10) : (habit.startDate ?? todayLocal());
      toBackfillCreatedAt.push({ ...habit, createdAt });
    }

    await repo.runTx(['habits', 'meta'], 'readwrite', async (tx) => {
      for (const h of toBackfillCreatedAt) {
        tx.objectStore('habits').put(h);
      }
      tx.objectStore('meta').put({ key: 'createdAtBackfilled', value: true });
    });
  }

  // One-time migration: remove the 8 hardcoded DEMO_HABIT_IDS placeholder
  // habits from any install that auto-seeded them before this change shipped
  // (2026-09-17 — history-seed-null-startdate scope expansion). Per id:
  // hard-delete when zero real logs exist against it (nothing to preserve);
  // archive (reusing the same transform as
  // js/state/apply/archiveHabit.js#handleArchiveHabit) when real logs exist,
  // so the "habit identity preserved across edits" / history-integrity
  // invariant holds for a user who toggled a demo habit during testing.
  // Non-demo habits (any id not in DEMO_HABIT_IDS) are never inspected or
  // touched by this loop.
  if (!demoHabitsRemoved) {
    /** @type {string[]} */
    const toHardDelete = [];
    /** @type {object[]} */
    const toArchive = [];
    for (const id of DEMO_HABIT_IDS) {
      const habit = await repo.getHabit(id);
      if (!habit) continue;
      const logs = await repo.getLogsByHabit(id);
      if (logs.length === 0) {
        toHardDelete.push(id);
      } else {
        toArchive.push({ ...habit, status: 'archived' });
      }
    }

    await repo.runTx(['habits', 'meta'], 'readwrite', async (tx) => {
      for (const id of toHardDelete) {
        tx.objectStore('habits').delete(id);
      }
      for (const h of toArchive) {
        tx.objectStore('habits').put(h);
      }
      tx.objectStore('meta').put({ key: 'demoHabitsRemoved', value: true });
    });
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
