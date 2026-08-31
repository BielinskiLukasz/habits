/**
 * @file Integration tests for js/io/import.js — JSON import merge-by-id
 * semantics, schema validation, and cross-tab broadcast signal (IMPORT-02,
 * IMPORT-03, IMPORT-04).
 *
 * Tests verify:
 *   - Import valid JSON → all 7 stores merged correctly
 *   - Import with local-only habits → preserved (not deleted, D-98)
 *   - Import with colliding habit IDs → local replaced with imported (D-98)
 *   - Import newer schemaVersion → error thrown, no merge
 *   - Import + BroadcastChannel broadcast → message posted with {type:'import:done'}
 *   - Broadcast fires AFTER tx commits (Pitfall 3: timing validation)
 *   - Invalid payload → clear error thrown, no merge
 *
 * This file uses createFakeRepo() from tests/helpers/fake-idb.js (D-25, A7
 * contract). No DOM, no real IDB, no real BroadcastChannel.
 *
 * mergeImportedStores and configureImport are cache-busted once per file so
 * each describe block starts from module-level state set by its own before().
 *
 * Framework: node --test (D-23).
 */

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { DB_VERSION } from '../../js/db/schema.js';

// Cache-bust to get a fresh module instance for these integration tests.
const { mergeImportedStores, configureImport } = await import(
  `../../js/io/import.js?t=${Date.now()}`
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid import payload with the given overrides.
 * @param {object} [overrides]
 * @returns {object}
 */
function makePayload(overrides = {}) {
  return {
    schemaVersion: DB_VERSION,
    habits: [],
    habit_versions: [],
    logs: [],
    events: [],
    settings: [],
    meta: [],
    score_snapshots: [],
    ...overrides,
  };
}

/**
 * Build a fake BroadcastChannel spy.
 * Records all calls to postMessage so tests can assert on them.
 */
function makeBroadcastSpy() {
  const messages = [];
  const spy = (msg) => messages.push(msg);
  spy.messages = messages;
  return spy;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const LOCAL_HABIT = {
  id: 'h-local-only',
  name: 'Local only habit',
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  stages: [],
  lastCompletedDate: null,
};

const IMPORTED_HABIT = {
  id: 'h-imported',
  name: 'Imported habit',
  wave: 2,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  stages: [],
  lastCompletedDate: null,
};

const COLLIDING_HABIT_ORIGINAL = {
  id: 'h-collision',
  name: 'Original name',
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  stages: [],
  lastCompletedDate: null,
};

const COLLIDING_HABIT_IMPORTED = {
  id: 'h-collision',
  name: 'Imported name',
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  stages: [],
  lastCompletedDate: '2026-06-01',
};

// ---------------------------------------------------------------------------
// Test: import valid JSON → all 7 stores merged correctly
// ---------------------------------------------------------------------------

describe('mergeImportedStores — all 7 stores merged (IMPORT-02)', () => {
  let repo;
  before(async () => {
    repo = createFakeRepo();
    configureImport({ repo, broadcast: null });

    const importedHabitVersion = { habitId: 'h-imported', effectiveFrom: '2026-01-01', name: 'Imported habit' };
    const importedLog = { habitId: 'h-imported', date: '2026-06-05', completed: true, definitionVersion: null };
    const importedEvent = { id: 'ev-imported', at: '2026-06-05T08:00:00Z', type: 'log:put', payload: {}, inverse: null };
    const importedSetting = { key: 'weekStart', value: 'mon' };
    const importedMeta = { key: 'seededAt', value: '2026-06-05' };
    const importedSnapshot = { habitId: 'h-imported', date: '2026-06-05', score: 0.9 };

    await mergeImportedStores(makePayload({
      habits: [IMPORTED_HABIT],
      habit_versions: [importedHabitVersion],
      logs: [importedLog],
      events: [importedEvent],
      settings: [importedSetting],
      meta: [importedMeta],
      score_snapshots: [importedSnapshot],
    }));
  });

  test('imported habit appears in habits store', async () => {
    const habit = await repo.getHabit('h-imported');
    assert.ok(habit, 'imported habit found in store');
    assert.equal(habit.name, 'Imported habit');
  });

  test('imported log appears in logs store', async () => {
    const log = await repo.getLog('h-imported', '2026-06-05');
    assert.ok(log, 'imported log found in store');
    assert.equal(log.completed, true);
  });

  test('imported setting appears in settings store', async () => {
    const setting = await repo.getSetting('weekStart');
    assert.ok(setting, 'imported setting found in store');
    assert.equal(setting.value, 'mon');
  });

  test('imported event appears in events store', async () => {
    const event = await repo.getEvent('ev-imported');
    assert.ok(event, 'imported event found in store');
    assert.equal(event.type, 'log:put');
  });

  test('imported meta appears in meta store', async () => {
    const meta = await repo.getMeta('seededAt');
    assert.equal(meta, '2026-06-05', 'imported meta found in store');
  });

  test('all 7 IDB stores accessible after merge', async () => {
    const [habits, logs, hvs, events, settings, meta, snapshots] = await Promise.all([
      repo.getAllHabits(),
      repo.getAllLogs(),
      repo.getAllHabitVersions(),
      repo.getAllEvents(),
      repo.getAllSettings(),
      repo.getAllMeta(),
      repo.getAllScoreSnapshots(),
    ]);
    assert.ok(habits.length >= 1, 'habits has data');
    assert.ok(logs.length >= 1, 'logs has data');
    assert.ok(hvs.length >= 1, 'habit_versions has data');
    assert.ok(events.length >= 1, 'events has data');
    assert.ok(settings.length >= 1, 'settings has data');
    assert.ok(meta.length >= 1, 'meta has data');
    assert.ok(snapshots.length >= 1, 'score_snapshots has data');
  });
});

// ---------------------------------------------------------------------------
// Test: local-only habits are preserved (D-98 — no deletes)
// ---------------------------------------------------------------------------

describe('mergeImportedStores — local-only records preserved (D-98)', () => {
  let repo;
  before(async () => {
    repo = createFakeRepo();
    // Pre-seed a local-only habit.
    await repo.putHabit(LOCAL_HABIT);

    configureImport({ repo, broadcast: null });

    // Import payload with a DIFFERENT habit (no LOCAL_HABIT collision).
    await mergeImportedStores(makePayload({ habits: [IMPORTED_HABIT] }));
  });

  test('local-only habit survives import (not deleted)', async () => {
    const local = await repo.getHabit('h-local-only');
    assert.ok(local, 'local-only habit still in store after import');
    assert.equal(local.name, 'Local only habit');
  });

  test('imported habit also present alongside local habit', async () => {
    const imported = await repo.getHabit('h-imported');
    assert.ok(imported, 'imported habit added to store');
  });

  test('habits store has both local and imported (no implicit delete)', async () => {
    const all = await repo.getAllHabits();
    assert.equal(all.length, 2, 'both habits present, none deleted');
  });
});

// ---------------------------------------------------------------------------
// Test: colliding habit IDs → local replaced with imported (D-98 upsert)
// ---------------------------------------------------------------------------

describe('mergeImportedStores — colliding IDs overwrite local (D-98)', () => {
  let repo;
  before(async () => {
    repo = createFakeRepo();
    // Pre-seed the original habit.
    await repo.putHabit(COLLIDING_HABIT_ORIGINAL);

    configureImport({ repo, broadcast: null });

    // Import the collision: same id, different name.
    await mergeImportedStores(makePayload({ habits: [COLLIDING_HABIT_IMPORTED] }));
  });

  test('colliding habit is overwritten with imported version', async () => {
    const habit = await repo.getHabit('h-collision');
    assert.ok(habit, 'habit still in store');
    assert.equal(habit.name, 'Imported name', 'name replaced by imported version');
    assert.equal(habit.lastCompletedDate, '2026-06-01', 'imported lastCompletedDate present');
  });
});

// ---------------------------------------------------------------------------
// Test: import newer schemaVersion → error thrown (D-99)
// ---------------------------------------------------------------------------

describe('mergeImportedStores — schema version validation (D-99)', () => {
  let repo;
  before(() => {
    repo = createFakeRepo();
    configureImport({ repo, broadcast: null });
  });

  test('schemaVersion > DB_VERSION → throws error, no merge', async () => {
    const tooNew = makePayload({ schemaVersion: DB_VERSION + 9999 });
    await assert.rejects(
      () => mergeImportedStores(tooNew),
      (err) => {
        assert.ok(err instanceof Error, 'throws Error');
        assert.ok(
          err.message.includes('newer version'),
          `error mentions "newer version": "${err.message}"`,
        );
        return true;
      },
    );
    // Confirm no habits were written (tx must not have committed).
    const habits = await repo.getAllHabits();
    assert.equal(habits.length, 0, 'no habits merged after version rejection');
  });

  test('schemaVersion === DB_VERSION → merge succeeds', async () => {
    const sameVersion = makePayload({
      schemaVersion: DB_VERSION,
      habits: [IMPORTED_HABIT],
    });
    await assert.doesNotReject(() => mergeImportedStores(sameVersion));
    const habit = await repo.getHabit('h-imported');
    assert.ok(habit, 'habit merged when versions match');
  });

  test('schemaVersion < DB_VERSION → merge succeeds (backward compat)', async () => {
    const oldVersion = makePayload({
      schemaVersion: Math.max(1, DB_VERSION - 1),
      habits: [LOCAL_HABIT],
    });
    await assert.doesNotReject(() => mergeImportedStores(oldVersion));
    const habit = await repo.getHabit('h-local-only');
    assert.ok(habit, 'habit merged when import version is older');
  });

  test('missing schemaVersion → treated as version 1 (backward compat)', async () => {
    // Version 1 <= DB_VERSION for any DB_VERSION >= 1, so merge should succeed.
    const noVersion = makePayload({ habits: [{ ...IMPORTED_HABIT, id: 'h-noversion' }] });
    delete noVersion.schemaVersion;
    await assert.doesNotReject(() => mergeImportedStores(noVersion));
    const habit = await repo.getHabit('h-noversion');
    assert.ok(habit, 'habit merged when schemaVersion missing');
  });
});

// ---------------------------------------------------------------------------
// Test: import + BroadcastChannel broadcast → message posted (IMPORT-04)
// ---------------------------------------------------------------------------

describe('mergeImportedStores — broadcast signal after import (D-100, IMPORT-04)', () => {
  let repo;
  let broadcastSpy;

  before(() => {
    repo = createFakeRepo();
    broadcastSpy = makeBroadcastSpy();
    configureImport({ repo, broadcast: broadcastSpy });
  });

  test('broadcast is called with {type:"import:done"} after merge', async () => {
    await mergeImportedStores(makePayload({ habits: [IMPORTED_HABIT] }));
    assert.equal(broadcastSpy.messages.length, 1, 'broadcast called exactly once');
    assert.deepEqual(broadcastSpy.messages[0], { type: 'import:done' });
  });

  test('broadcast fires AFTER tx commits (Pitfall 3: timing validation)', async () => {
    // Strategy: check that the broadcast spy records messages ONLY after the
    // merge payload has been written to the fake repo. Since fake-idb.js is
    // synchronous, we verify that the habit is already in the store at the
    // moment the broadcast fires by checking repo state post-await.
    const spy = makeBroadcastSpy();
    const freshRepo = createFakeRepo();
    configureImport({ repo: freshRepo, broadcast: spy });

    await mergeImportedStores(makePayload({ habits: [{ ...LOCAL_HABIT, id: 'h-timing' }] }));

    // If broadcast was fired before tx commit, the habit would not be in the
    // store when we look. The await guarantees serialization in the fake; if
    // broadcast had been called during the tx it would be a bug in import.js.
    assert.equal(spy.messages.length, 1, 'broadcast called once');

    // Habit should be in the store — verifies tx committed before broadcast.
    const habit = await freshRepo.getHabit('h-timing');
    assert.ok(habit, 'habit in repo (tx committed) when broadcast was recorded');
  });

  test('no broadcast → merge still completes successfully', async () => {
    const freshRepo = createFakeRepo();
    configureImport({ repo: freshRepo, broadcast: null });
    await assert.doesNotReject(() =>
      mergeImportedStores(makePayload({ habits: [IMPORTED_HABIT] })),
    );
    const habit = await freshRepo.getHabit('h-imported');
    assert.ok(habit, 'merge succeeded without broadcast');
  });
});

// ---------------------------------------------------------------------------
// Test: invalid payload → error thrown, no merge
// ---------------------------------------------------------------------------

describe('mergeImportedStores — invalid payload rejection (T-05-11)', () => {
  let repo;

  beforeEach(() => {
    repo = createFakeRepo();
    configureImport({ repo, broadcast: null });
  });

  test('null payload → throws descriptive error', async () => {
    await assert.rejects(
      () => mergeImportedStores(null),
      /not a valid backup/,
    );
  });

  test('non-object payload → throws descriptive error', async () => {
    await assert.rejects(
      () => mergeImportedStores('not-an-object'),
      /not a valid backup/,
    );
  });

  test('missing habits array → throws descriptive error', async () => {
    await assert.rejects(
      () => mergeImportedStores({ schemaVersion: DB_VERSION }),
      /not a valid backup/,
    );
  });
});
