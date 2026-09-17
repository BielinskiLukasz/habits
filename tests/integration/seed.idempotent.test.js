/**
 * @file Integration tests for `bootSeed()` idempotency (SEED-03, SEED-04, D-33, D-45).
 *
 * Covers five invariants:
 *
 *   1. **First-run inserts 0 habits + 0 events + meta + D-45 settings.**
 *      `seed/habits.json`'s `habits` array is now `[]` (history-seed-null-startdate
 *      scope expansion, 2026-09-17 — the 8 placeholder demo habits were
 *      removed; see `DEMO_HABIT_IDS`/`demoHabitsRemoved` below). The seed
 *      loader still writes everything in a single tx — any new habits (none,
 *      on the current fixture), one `seed:createHabit` event per habit, the
 *      `meta.seededIds` array (now `[]`), and `defaultThreshold = 0.9` +
 *      `defaultWindowDays = 70` + `schemaVersion = 1` (D-45 mastery defaults) —
 *      independent of habit count.
 *
 *   2. **Second run is a no-op (SEED-03, T-02-03 data-trust invariant).**
 *      User edits to a previously-seeded habit MUST survive future
 *      `bootSeed()` calls. Verified with a synthetic already-seeded fixture
 *      (decoupled from the now-empty on-disk `seed/habits.json`, mirroring
 *      the fixture-agnostic style used by the `demoHabitsRemoved` migration
 *      tests below) — a habit is registered in `meta.seededIds` + renamed,
 *      then `bootSeed()` must not clobber it.
 *
 *   3. **No duplicate events on second run.** `events` table count stays
 *      unchanged — `seededIds` short-circuits re-insertion (Pitfall 5).
 *
 *   4. **Every seeded habit gets exactly one `seed:createHabit` event** —
 *      group by `payload.habitId` and assert each appears once with the
 *      correct type (SEED-04).
 *
 *   5. **First-run writes one `habit_versions` row per seeded habit (NFR-10,
 *      UAT-11 fix).** The version row captures the original definition so that
 *      `getHabitVersionAtDate` can resolve the correct name for any past date
 *      before a user edit. Without this row, editing a seeded habit causes all
 *      historical logs to show the new (post-edit) name, violating the
 *      "History integrity" hard constraint.
 *
 *   6. **First-run stamps `createdAt` on every seeded habit, and a one-time
 *      `createdAtBackfilled` migration repairs already-seeded installs
 *      (history-seed-null-startdate, 2026-09-17).** `seed/habits.json` never
 *      carries `createdAt` (a static fixture can't know its per-install seed
 *      date) and all 8 seed habits have `startDate: null`, so without a real
 *      `createdAt`, `js/domain/cadence.js`'s existence guard was a permanent
 *      no-op for them — they showed as applicable on any date, including ones
 *      before the app existed. The migration backfills from each habit's
 *      `seed:createHabit` event `at` timestamp.
 *
 * Uses the fake-IDB repo and a `configureSeed({ repo, storage, fetch })` DI
 * seam matching `apply.configure()` (RESEARCH §Open Question 2).
 *
 * The `fetch` stub reads `seed/habits.json` from disk so we exercise the
 * real fixture and the parse path together.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { createFakeStorage } from '../helpers/fake-storage.js';
import { todayLocal } from '../../js/util/date.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEED_PATH = join(ROOT, 'seed', 'habits.json');

/** Fresh `seed.js` module per test so module-level state is clean. */
async function freshSeed() {
  const url = new URL('../../js/io/seed.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/**
 * Build a fetch stub that returns `seed/habits.json` from disk for the
 * canonical URL and throws for everything else.
 *
 * @returns {(url: string) => Promise<{ json: () => Promise<object> }>}
 */
function makeFetchStub() {
  return async function fetchStub(url) {
    if (url !== './seed/habits.json') {
      throw new Error(`fetch stub: unexpected URL ${url}`);
    }
    const body = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
    return {
      async json() { return body; },
    };
  };
}

describe('bootSeed: first-run inserts 0 habits + 0 events + meta + settings (D-45)', () => {
  test('writes 0 habits, 0 events, meta.seededIds, and 3 D-45 settings rows', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    assert.equal(repo._stores.habits.size, 0, 'expected 0 habits inserted on first boot (empty seed fixture)');
    assert.equal(repo._stores.events.size, 0, 'expected 0 seed:createHabit events (empty seed fixture)');

    const seededIdsRow = repo._stores.meta.get('seededIds');
    assert.ok(seededIdsRow, 'meta.seededIds row must be written');
    assert.ok(Array.isArray(seededIdsRow.value), 'meta.seededIds.value must be an array');
    assert.equal(seededIdsRow.value.length, 0, 'meta.seededIds must be an empty array (empty seed fixture)');

    // Each seeded id matches an inserted habit.
    for (const id of seededIdsRow.value) {
      assert.ok(repo._stores.habits.get(id), `habit ${id} listed in seededIds must exist in habits store`);
    }

    // D-45 settings defaults.
    const defaultThreshold = repo._stores.settings.get('defaultThreshold');
    assert.ok(defaultThreshold, 'settings.defaultThreshold row must be written (D-45)');
    assert.equal(defaultThreshold.value, 0.9, 'D-45: defaultThreshold value must be 0.9');

    const defaultWindowDays = repo._stores.settings.get('defaultWindowDays');
    assert.ok(defaultWindowDays, 'settings.defaultWindowDays row must be written (D-45)');
    assert.equal(defaultWindowDays.value, 70, 'D-45: defaultWindowDays value must be 70');

    const schemaVersion = repo._stores.settings.get('schemaVersion');
    assert.ok(schemaVersion, 'settings.schemaVersion row must be written (D-45)');
    assert.equal(schemaVersion.value, 1, 'D-45: schemaVersion value must be 1');
  });
});

describe('bootSeed: second run is a no-op (SEED-03, T-02-03 data-trust invariant)', () => {
  test('user edits to a previously-seeded habit survive a second bootSeed() call', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();

    // Simulate an install that was already fully seeded + migrated, decoupled
    // from the now-empty on-disk seed/habits.json (history-seed-null-startdate
    // scope expansion) — mirrors the fixture-agnostic style used by the
    // demoHabitsRemoved migration tests below. This is the general SEED-03
    // scenario bootSeed() must still honor regardless of what (if anything)
    // seed/habits.json currently contains: never clobber a user's in-place
    // edit to a habit id it once seeded.
    const editedId = '015105be-fc0b-45b6-b939-4e8d395fcf13';
    await repo.putMeta('seededIds', [editedId]);
    await repo.putMeta('persistResult', true);
    await repo.putMeta('habitVersionsSeeded', true);
    await repo.putMeta('waveFieldSeeded', true);
    await repo.putMeta('waveFieldV2', true);
    await repo.putMeta('createdAtBackfilled', true);
    await repo.putMeta('demoHabitsRemoved', true);
    await repo.putHabit({
      id: editedId, name: 'Renamed by user', status: 'active',
      cadence: { cadence_v: 1, type: 'daily' }, createdAt: '2026-01-01', startDate: null,
    });

    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });

    const eventsBefore = repo._stores.events.size;

    // bootSeed() must short-circuit entirely (all flags true) — must NOT
    // fetch, must NOT clobber the renamed habit, must NOT insert duplicates.
    await seedMod.bootSeed();

    assert.equal(repo._stores.habits.size, 1, 'no duplicate habits after boot');
    const stillRenamed = repo._stores.habits.get(editedId);
    assert.ok(stillRenamed, 'renamed habit must still exist');
    assert.equal(
      stillRenamed.name,
      'Renamed by user',
      'T-02-03: user edit must survive — seed must NOT clobber renamed habit',
    );

    assert.equal(
      repo._stores.events.size,
      eventsBefore,
      'no extra seed:createHabit events (fast-path short-circuit on all-flags-true)',
    );
  });
});

describe('bootSeed: SEED-04 — every seeded habit gets exactly one seed:createHabit event', () => {
  test('group events by payload.habitId; each id appears exactly once with type=seed:createHabit', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    /** @type {Map<string, object[]>} */
    const byHabitId = new Map();
    for (const evt of repo._stores.events.values()) {
      const hid = evt.payload && evt.payload.habitId;
      assert.ok(hid, `every event must carry payload.habitId; got ${JSON.stringify(evt)}`);
      const arr = byHabitId.get(hid) ?? [];
      arr.push(evt);
      byHabitId.set(hid, arr);
    }

    assert.equal(byHabitId.size, 0, 'expected zero event-groups (empty seed fixture — 0 habits seeded)');

    for (const [hid, evts] of byHabitId.entries()) {
      assert.equal(evts.length, 1, `habit ${hid}: expected exactly one seed:createHabit event; got ${evts.length}`);
      const evt = evts[0];
      assert.equal(evt.type, 'seed:createHabit', `event for habit ${hid} must have type=seed:createHabit`);
      assert.equal(typeof evt.id, 'string', `event for habit ${hid} must have an id (UUID)`);
      assert.equal(typeof evt.at, 'string', `event for habit ${hid} must have an at (ISO timestamp)`);
      assert.equal(evt.inverse, null, `seed events are non-undoable: inverse must be null (literal)`);
    }
  });
});

describe('bootSeed: NFR-10 — each seeded habit gets an initial habit_versions row (UAT-11 fix)', () => {
  test('first-run writes one habit_versions row per seeded habit with name + effectiveFrom', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    // Every seeded habit must have at least one habit_versions row so that
    // getHabitVersionAtDate returns the original name for dates before any edit,
    // honoring the "History integrity" hard constraint (NFR-10, UAT test 11).
    const seededIdsRow = repo._stores.meta.get('seededIds');
    assert.ok(seededIdsRow && Array.isArray(seededIdsRow.value), 'meta.seededIds must be written');

    for (const id of seededIdsRow.value) {
      const version = await repo.getHabitVersionAtDate(id, '9999-12-31');
      assert.ok(version, `habit ${id}: must have a habit_versions row after seeding (NFR-10)`);
      assert.equal(version.habitId, id, `habit_versions row must carry habitId = ${id}`);
      assert.ok(typeof version.name === 'string' && version.name.length > 0,
        `habit_versions row for ${id} must carry a non-empty name`);
      assert.ok(typeof version.effectiveFrom === 'string',
        `habit_versions row for ${id} must carry an effectiveFrom date string`);

      // The initial version's name must match the habit's current name
      // (before any user edit the names should be identical).
      const habit = await repo.getHabit(id);
      assert.equal(version.name, habit.name,
        `habit_versions initial name must equal habit name for ${id} (no edit yet)`);
    }
  });

  test('one-time migration: existing seeded habits with no habit_versions rows get backfilled on next boot', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    // First boot: seed habits + events + meta (simulates the pre-fix state by
    // manually removing all habit_versions rows afterward).
    await seedMod.bootSeed();
    repo._stores.habit_versions.clear();
    // Also clear habitVersionsSeeded so the migration re-runs on next boot.
    repo._stores.meta.delete('habitVersionsSeeded');

    // Re-run bootSeed (simulates next app open after deploying the fix to an
    // existing database that has seededIds + persistResult but no habit_versions).
    const seedMod2 = await freshSeed();
    seedMod2.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });
    await seedMod2.bootSeed();

    const seededIdsRow = repo._stores.meta.get('seededIds');
    for (const id of seededIdsRow.value) {
      const version = await repo.getHabitVersionAtDate(id, '9999-12-31');
      assert.ok(version, `habit ${id}: migration must write a habit_versions row for existing seeded habits`);
      assert.equal(version.habitId, id, `migrated version must carry habitId = ${id}`);
    }

    // Migration gate is now set so the next boot is fast-path again.
    const gate = await repo.getMeta('habitVersionsSeeded');
    assert.ok(gate, 'meta.habitVersionsSeeded must be set after migration runs');
  });
});

describe('bootSeed: wave field backfill (G-09-2/4/5 — 2026-08-25)', () => {
  test('first-run inserts habits that already carry the wave field', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    for (const h of repo._stores.habits.values()) {
      assert.equal(typeof h.wave, 'number', `habit ${h.id}: wave must be a number after first boot`);
    }
    const gate = await repo.getMeta('waveFieldSeeded');
    assert.ok(gate, 'meta.waveFieldSeeded must be set after first boot');
  });

  test('migration: existing habits missing wave field get backfilled on next boot', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    // First boot — habits inserted with wave field.
    await seedMod.bootSeed();

    // Simulate pre-P9 state: strip wave from all habits, clear migration gate.
    for (const [id, h] of repo._stores.habits.entries()) {
      const { wave: _w, ...rest } = h;
      repo._stores.habits.set(id, rest);
    }
    repo._stores.meta.delete('waveFieldSeeded');

    // Re-run (simulates next app open after deploying the fix).
    const seedMod2 = await freshSeed();
    seedMod2.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });
    await seedMod2.bootSeed();

    // All seeded habits must now carry the wave field.
    const seededIdsRow = repo._stores.meta.get('seededIds');
    for (const id of seededIdsRow.value) {
      const h = await repo.getHabit(id);
      assert.ok(h, `habit ${id} must still exist after migration`);
      assert.equal(typeof h.wave, 'number', `habit ${id}: wave must be a number after migration`);
    }

    // Gate is set so the next boot short-circuits.
    const gate = await repo.getMeta('waveFieldSeeded');
    assert.ok(gate, 'meta.waveFieldSeeded must be set after migration runs');
  });
});

describe('bootSeed: createdAt forward-fix + backfill migration (history-seed-null-startdate, 2026-09-17)', () => {
  test('first-run stamps createdAt = todayLocal() on every seeded habit', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    const today = todayLocal();
    for (const h of repo._stores.habits.values()) {
      assert.equal(h.createdAt, today,
        `habit ${h.id}: createdAt must be stamped to todayLocal() on first-run insert (got ${h.createdAt})`);
    }
    const gate = await repo.getMeta('createdAtBackfilled');
    assert.ok(gate, 'meta.createdAtBackfilled must be set after first boot (nothing left to backfill)');
  });

  test('cadence.js existence guard now blocks a freshly-seeded habit on a date before it existed', async () => {
    // End-to-end regression check for the originally-reported History-view bug:
    // once seed.js stamps createdAt, appliesToday() must actually use it.
    const { appliesToday } = await import('../../js/domain/cadence.js');
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    const zeroCtx = { weekStart: 'mon', weekCompletions: () => 0, monthCompletions: () => 0 };
    for (const h of repo._stores.habits.values()) {
      assert.equal(
        appliesToday(h, '2025-12-10', zeroCtx),
        false,
        `habit ${h.id}: must NOT be applicable on 2025-12-10 (predates seeding on ${h.createdAt})`,
      );
    }
  });

  test('migration backfills createdAt for an already-seeded install (pre-fix state) from the seed:createHabit event timestamp', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    // First boot with the fix already deployed — habits get createdAt + the
    // migration gate is set to true.
    await seedMod.bootSeed();

    // Simulate the PRE-FIX state: strip createdAt from every habit (as if
    // seeded before this fix shipped) and clear the migration gate so it
    // re-runs on next boot. The seed:createHabit events (with their original
    // `at` timestamps) are left untouched — that's the migration's data source.
    const knownEventAtByHabitId = new Map();
    for (const evt of repo._stores.events.values()) {
      if (evt.type === 'seed:createHabit') knownEventAtByHabitId.set(evt.payload.habitId, evt.at);
    }
    for (const [id, h] of repo._stores.habits.entries()) {
      const { createdAt: _c, ...rest } = h;
      repo._stores.habits.set(id, rest);
    }
    repo._stores.meta.delete('createdAtBackfilled');

    // Re-run bootSeed (simulates next app open after deploying the fix to an
    // existing database).
    const seedMod2 = await freshSeed();
    seedMod2.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });
    await seedMod2.bootSeed();

    for (const [id, expectedAt] of knownEventAtByHabitId.entries()) {
      const habit = await repo.getHabit(id);
      assert.ok(habit, `habit ${id} must still exist after migration`);
      assert.equal(
        habit.createdAt,
        expectedAt.slice(0, 10),
        `habit ${id}: createdAt must be backfilled from its seed:createHabit event 'at' timestamp (YMD)`,
      );
    }

    const gate = await repo.getMeta('createdAtBackfilled');
    assert.ok(gate, 'meta.createdAtBackfilled must be set after migration runs');
  });

  test('migration falls back to startDate ?? todayLocal() when no matching seed:createHabit event exists', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    // Simulate an edge case: a habit missing createdAt with NO corresponding
    // seed:createHabit event (e.g. an out-of-band recovery insert, Pitfall 5).
    // Registered directly into meta.seededIds (decoupled from the now-empty
    // on-disk seed/habits.json — history-seed-null-startdate scope expansion,
    // 2026-09-17) rather than hijacking seededIds[0], which is empty now.
    const anyId = 'ffffffff-1111-4222-8333-444444444444';
    await repo.putHabit({
      id: anyId, name: 'Recovered habit', status: 'active',
      cadence: { cadence_v: 1, type: 'daily' }, createdAt: undefined, startDate: '2026-01-15',
    });
    const seededIdsRow = repo._stores.meta.get('seededIds');
    await repo.putMeta('seededIds', [...seededIdsRow.value, anyId]);
    repo._stores.meta.delete('createdAtBackfilled');

    const seedMod2 = await freshSeed();
    seedMod2.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });
    await seedMod2.bootSeed();

    const habit = await repo.getHabit(anyId);
    assert.equal(habit.createdAt, '2026-01-15', 'must fall back to habit.startDate when no matching event exists');
  });

  test('second run after createdAtBackfilled is set does not touch already-populated createdAt values', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();
    const snapshot = new Map(
      Array.from(repo._stores.habits.entries()).map(([id, h]) => [id, h.createdAt]),
    );

    const seedMod2 = await freshSeed();
    seedMod2.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });
    await seedMod2.bootSeed();

    for (const [id, createdAt] of snapshot.entries()) {
      const habit = await repo.getHabit(id);
      assert.equal(habit.createdAt, createdAt, `habit ${id}: createdAt must be unchanged by a no-op second boot`);
    }
  });
});

// ---------------------------------------------------------------------------
// history-seed-null-startdate SCOPE EXPANSION (2026-09-17): remove the 8 demo
// habits from seed/habits.json for fresh installs, and migrate them out of
// any already-seeded install's live data. TDD RED phase — none of this is
// implemented yet. `seedMod.DEMO_HABIT_IDS` does not exist yet (undefined),
// and `meta.demoHabitsRemoved` is never written by the current bootSeed().
// These tests build their "already-seeded install" fixtures by hand (NOT via
// the real seed/habits.json fetch stub) so they exercise the migration in
// isolation from whether the on-disk fixture has been emptied yet.
// ---------------------------------------------------------------------------

describe('bootSeed: tolerates an empty seed/habits.json habits array (no-op boot path check)', () => {
  /** Fetch stub returning a synthetic EMPTY seed — does not touch the real disk fixture. */
  function makeEmptySeedFetchStub() {
    return async function fetchStub(url) {
      if (url !== './seed/habits.json') {
        throw new Error(`fetch stub: unexpected URL ${url}`);
      }
      return { async json() { return { schemaVersion: 1, seedVersion: 2, habits: [] }; } };
    };
  }

  test('first boot with an empty habits array inserts 0 habits, 0 events, and completes without throwing', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeEmptySeedFetchStub() });

    await assert.doesNotReject(seedMod.bootSeed());

    assert.equal(repo._stores.habits.size, 0, 'no habits inserted from an empty seed fixture');
    assert.equal(repo._stores.events.size, 0, 'no seed:createHabit events for an empty seed fixture');

    const seededIdsRow = repo._stores.meta.get('seededIds');
    assert.ok(seededIdsRow, 'meta.seededIds must still be written (empty array, not undefined)');
    assert.deepEqual(seededIdsRow.value, [], 'meta.seededIds.value must be an empty array');

    // D-45 settings defaults are independent of habit count.
    assert.ok(repo._stores.settings.get('defaultThreshold'), 'D-45 settings defaults still written');

    // All migration gates must still end up true — nothing left to migrate,
    // but the flags gate future boots from re-doing wasted work.
    for (const flag of ['habitVersionsSeeded', 'waveFieldSeeded', 'waveFieldV2', 'createdAtBackfilled', 'demoHabitsRemoved']) {
      assert.equal(await repo.getMeta(flag), true, `meta.${flag} must be true after boot even with 0 habits`);
    }
  });

  test('second boot with an empty habits array is a pure no-op (fast-path short-circuit)', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeEmptySeedFetchStub() });

    await seedMod.bootSeed();
    await assert.doesNotReject(seedMod.bootSeed());

    assert.equal(repo._stores.habits.size, 0, 'still no habits after a second empty-seed boot');
  });
});

describe('bootSeed: demoHabitsRemoved migration — removes the 8 hardcoded demo habits from already-seeded installs', () => {
  test('seed.js exports a DEMO_HABIT_IDS constant with exactly the 8 known seed-catalog UUIDs', async () => {
    const seedMod = await freshSeed();
    assert.ok(Array.isArray(seedMod.DEMO_HABIT_IDS), 'seed.js must export DEMO_HABIT_IDS as an array');
    assert.equal(seedMod.DEMO_HABIT_IDS.length, 8, 'exactly 8 known demo habit ids');
    const expected = [
      '015105be-fc0b-45b6-b939-4e8d395fcf13', // Morning walk
      '44403331-dbdf-4992-ac84-944dba8df6f1', // Drink water (1.5L)
      '83c8b7c5-6c2b-4121-9395-2d7c1e0f99a5', // Weekly grocery run
      'b80c7b07-8a37-471b-b9d1-110b6b90011c', // Shower (every 2 days)
      'c1eecb31-3b91-4a80-92e8-68435b5931f4', // Strength training (M/W/F)
      'eeef9945-6c8c-4440-9d93-baf6fd4ee312', // 5 things grateful for
      '45e0f64f-b9c2-46ca-8b21-3ddbc4e9bf07', // 7 meatless meals/week
      '2694072b-dfe0-4cb3-9ba2-b3aad89f85aa', // Daily learning (3 sources)
    ];
    assert.deepEqual([...seedMod.DEMO_HABIT_IDS].sort(), [...expected].sort(),
      'DEMO_HABIT_IDS must match the exact known seed-catalog UUIDs (not derived from the now-empty seed fixture)');
  });

  test('hard-deletes a demo habit id with ZERO logs against it', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();

    const demoId = '015105be-fc0b-45b6-b939-4e8d395fcf13'; // Morning walk
    // Simulate an already-seeded, already-fully-migrated install (pre-dates
    // only the demo-removal migration) — seededIds present means bootSeed()
    // never fetches the seed file at all, so this test is fixture-agnostic.
    await repo.putMeta('seededIds', [demoId]);
    await repo.putMeta('persistResult', true);
    await repo.putMeta('habitVersionsSeeded', true);
    await repo.putMeta('waveFieldSeeded', true);
    await repo.putMeta('waveFieldV2', true);
    await repo.putMeta('createdAtBackfilled', true);
    await repo.putHabit({
      id: demoId, name: 'Morning walk', status: 'active',
      cadence: { cadence_v: 1, type: 'daily' }, createdAt: '2026-01-01', startDate: null,
    });

    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });
    await seedMod.bootSeed();

    assert.equal(await repo.getHabit(demoId), undefined, 'demo habit with zero logs must be hard-deleted');
    assert.equal(await repo.getMeta('demoHabitsRemoved'), true, 'meta.demoHabitsRemoved must be set');
  });

  test('archives (does NOT hard-delete) a demo habit id with real logs against it', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();

    const demoId = '44403331-dbdf-4992-ac84-944dba8df6f1'; // Drink water (1.5L)
    await repo.putMeta('seededIds', [demoId]);
    await repo.putMeta('persistResult', true);
    await repo.putMeta('habitVersionsSeeded', true);
    await repo.putMeta('waveFieldSeeded', true);
    await repo.putMeta('waveFieldV2', true);
    await repo.putMeta('createdAtBackfilled', true);
    await repo.putHabit({
      id: demoId, name: 'Drink water (1.5L)', status: 'active',
      cadence: { cadence_v: 1, type: 'daily' }, createdAt: '2026-01-01', startDate: null,
    });
    await repo.putLog({ habitId: demoId, date: '2026-01-05', completed: true });

    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });
    await seedMod.bootSeed();

    const habit = await repo.getHabit(demoId);
    assert.ok(habit, 'demo habit with real logs must still exist (archived, not hard-deleted)');
    assert.equal(habit.status, 'archived', 'habit must be archived — preserves history-integrity invariant');
    assert.equal(await repo.getMeta('demoHabitsRemoved'), true, 'meta.demoHabitsRemoved must be set');
  });

  test('leaves a non-demo (real/imported) habit completely untouched, even with zero logs', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();

    const realId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'; // not in DEMO_HABIT_IDS
    await repo.putMeta('seededIds', []);
    await repo.putMeta('persistResult', true);
    await repo.putMeta('habitVersionsSeeded', true);
    await repo.putMeta('waveFieldSeeded', true);
    await repo.putMeta('waveFieldV2', true);
    await repo.putMeta('createdAtBackfilled', true);
    await repo.putHabit({
      id: realId, name: 'Real imported habit', status: 'active',
      cadence: { cadence_v: 1, type: 'daily' }, createdAt: '2026-01-01', startDate: '2026-01-01',
    });

    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });
    await seedMod.bootSeed();

    const habit = await repo.getHabit(realId);
    assert.ok(habit, 'non-demo habit must never be touched by the migration');
    assert.equal(habit.status, 'active', 'non-demo habit status must be unchanged');
  });

  test('is a no-op when none of the 8 demo ids exist on this install (never seeded, or previously removed)', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();

    await repo.putMeta('seededIds', []);
    await repo.putMeta('persistResult', true);
    await repo.putMeta('habitVersionsSeeded', true);
    await repo.putMeta('waveFieldSeeded', true);
    await repo.putMeta('waveFieldV2', true);
    await repo.putMeta('createdAtBackfilled', true);

    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });
    await assert.doesNotReject(seedMod.bootSeed());

    assert.equal(await repo.getMeta('demoHabitsRemoved'), true, 'meta.demoHabitsRemoved must be set even with nothing to migrate');
  });

  test('second boot after demoHabitsRemoved is set does not re-process anything (fast-path short-circuit)', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();

    const demoId = '83c8b7c5-6c2b-4121-9395-2d7c1e0f99a5'; // Weekly grocery run
    await repo.putMeta('seededIds', [demoId]);
    await repo.putMeta('persistResult', true);
    await repo.putMeta('habitVersionsSeeded', true);
    await repo.putMeta('waveFieldSeeded', true);
    await repo.putMeta('waveFieldV2', true);
    await repo.putMeta('createdAtBackfilled', true);
    await repo.putHabit({
      id: demoId, name: 'Weekly grocery run', status: 'active',
      cadence: { cadence_v: 1, type: 'weekly' }, createdAt: '2026-01-01', startDate: null,
    });

    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });
    await seedMod.bootSeed(); // migration runs, hard-deletes demoId (0 logs)

    // Manually resurrect the habit to prove a second boot does NOT re-scan it
    // (the fast-path short-circuit on all-flags-true must return before the
    // migration body runs again).
    await repo.putHabit({
      id: demoId, name: 'Weekly grocery run', status: 'active',
      cadence: { cadence_v: 1, type: 'weekly' }, createdAt: '2026-01-01', startDate: null,
    });

    const seedMod2 = await freshSeed();
    seedMod2.configureSeed({ repo, storage: fakeStorage.storage, fetch: async () => { throw new Error('must not fetch'); } });
    await seedMod2.bootSeed();

    const habit = await repo.getHabit(demoId);
    assert.ok(habit, 'resurrected habit must survive a second boot — fast-path must not re-run the migration');
  });
});
