/**
 * @file Integration tests for `bootSeed()` idempotency (SEED-03, SEED-04, D-33, D-45).
 *
 * Covers five invariants:
 *
 *   1. **First-run inserts 8 habits + 8 events + meta + D-45 settings.**
 *      The seed loader writes everything in a single tx — habits, one
 *      `seed:createHabit` event per habit (SEED-04), the `meta.seededIds`
 *      array, and `defaultThreshold = 0.9` + `defaultWindowDays = 70` +
 *      `schemaVersion = 1` (D-45 mastery defaults).
 *
 *   2. **Second run is a no-op (SEED-03, T-02-03 data-trust invariant).**
 *      User edits to seeded rows MUST survive future `bootSeed()` calls.
 *      Verified by editing a habit's name in-place, calling `bootSeed()`
 *      again, and asserting the edit is preserved.
 *
 *   3. **No duplicate events on second run.** `events` table count stays
 *      at 8 — `seededIds` short-circuits re-insertion (Pitfall 5).
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

describe('bootSeed: first-run inserts 8 habits + 8 events + meta + settings (D-45)', () => {
  test('writes all 8 habits, 8 events, meta.seededIds, and 3 D-45 settings rows', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    assert.equal(repo._stores.habits.size, 8, 'expected 8 habits inserted on first boot');
    assert.equal(repo._stores.events.size, 8, 'expected exactly 8 seed:createHabit events (SEED-04)');

    const seededIdsRow = repo._stores.meta.get('seededIds');
    assert.ok(seededIdsRow, 'meta.seededIds row must be written');
    assert.ok(Array.isArray(seededIdsRow.value), 'meta.seededIds.value must be an array');
    assert.equal(seededIdsRow.value.length, 8, 'meta.seededIds must contain 8 UUIDs');

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
  test('user edits to seeded rows survive a second bootSeed() call', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    // First boot — seed gets inserted.
    await seedMod.bootSeed();
    assert.equal(repo._stores.habits.size, 8, 'sanity check: 8 habits after first boot');

    // User edits a seeded habit's name in-place. Pick a known id (Morning walk).
    const editedId = '015105be-fc0b-45b6-b939-4e8d395fcf13';
    const original = repo._stores.habits.get(editedId);
    assert.ok(original, 'sanity check: Morning walk should exist before edit');
    const renamed = { ...original, name: 'Renamed by user' };
    await repo.putHabit(renamed);

    const eventsBefore = repo._stores.events.size;

    // Second boot — must be a no-op for the habits table.
    await seedMod.bootSeed();

    assert.equal(repo._stores.habits.size, 8, 'no duplicate habits after second boot');
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
      'no extra seed:createHabit events on second boot (Pitfall 5 — short-circuit via meta.seededIds)',
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

    assert.equal(byHabitId.size, 8, 'expected one event-group per habit (8 groups)');

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
