/**
 * @file Unit tests for js/io/import.js — JSON import merge-by-id and schema
 * version validation (IMPORT-01, IMPORT-02, IMPORT-03).
 *
 * Tests cover:
 *   - Merge-by-id: colliding habit overwritten; non-colliding habits preserved
 *   - Merge-by-id: new habit inserted; existing local habits untouched
 *   - Schema validation: schemaVersion > DB_VERSION → throws with D-99 message
 *   - Schema validation: schemaVersion < DB_VERSION → merge proceeds
 *   - Schema validation: schemaVersion === DB_VERSION → merge proceeds
 *   - Log merge by compound key [habitId, date] → colliding logs overwritten
 *   - Settings merge by key → colliding settings overwritten
 *   - All 7 stores merged in single atomic transaction
 *   - Invalid JSON object (non-object or missing habits) → throws error
 *   - Missing schemaVersion → treated as version 1 (backward compat)
 *   - configureImport({repo}) allows DI injection
 *
 * Pattern: D-26 Tier 1 — pure function tests, no DOM, no real IDB.
 * Framework: node --test (D-23).
 * Fake repo: createFakeRepo() from tests/helpers/fake-idb.js (D-25).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mergeImportedStores, configureImport } from '../../js/io/import.js';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { DB_VERSION } from '../../js/db/schema.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal import payload (the parsed JSON structure).
 * @param {object} [overrides]
 * @returns {object}
 */
function makeImportPayload(overrides = {}) {
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
 * Build a minimal habit fixture.
 * @param {string} id
 * @param {object} [overrides]
 * @returns {object}
 */
function makeHabit(id, overrides = {}) {
  return {
    id,
    name: `Habit ${id}`,
    wave: 1,
    status: 'active',
    cadence: { type: 'daily' },
    ...overrides,
  };
}

/**
 * Build a minimal log fixture.
 * @param {string} habitId
 * @param {string} date
 * @param {object} [overrides]
 * @returns {object}
 */
function makeLog(habitId, date, overrides = {}) {
  return { habitId, date, completed: true, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('configureImport', () => {
  test('Test 11: configureImport({repo}) allows DI injection', async () => {
    const repo = createFakeRepo();
    // Should not throw; after injection, mergeImportedStores should use the repo
    assert.doesNotThrow(() => configureImport({ repo }));
  });
});

describe('mergeImportedStores — schema validation', () => {
  let repo;

  beforeEach(() => {
    repo = createFakeRepo();
    configureImport({ repo });
  });

  test('Test 3: schemaVersion > DB_VERSION → throws with D-99 error message', async () => {
    const imported = makeImportPayload({ schemaVersion: DB_VERSION + 1 });
    await assert.rejects(
      () => mergeImportedStores(imported),
      (err) => {
        assert.ok(
          err.message.includes('newer version'),
          `Expected "newer version" in error message, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  test('Test 4: schemaVersion < DB_VERSION → merge proceeds (backward compat)', async () => {
    // Only applies if DB_VERSION > 1; otherwise same as Test 5
    const schemaVersion = DB_VERSION > 1 ? DB_VERSION - 1 : 1;
    const imported = makeImportPayload({ schemaVersion, habits: [makeHabit('h-back')] });
    // Should not throw
    await assert.doesNotReject(() => mergeImportedStores(imported));
    const h = await repo.getHabit('h-back');
    assert.ok(h, 'Habit from backward-compat import should be stored');
  });

  test('Test 5: schemaVersion === DB_VERSION → merge proceeds', async () => {
    const imported = makeImportPayload({
      schemaVersion: DB_VERSION,
      habits: [makeHabit('h-same')],
    });
    await assert.doesNotReject(() => mergeImportedStores(imported));
    const h = await repo.getHabit('h-same');
    assert.ok(h, 'Habit from same-version import should be stored');
  });

  test('Test 10: schemaVersion missing → treated as version 1 (backward compat)', async () => {
    const imported = makeImportPayload();
    delete imported.schemaVersion; // simulate missing field
    // DB_VERSION is currently 1, so version 1 (default) should not throw
    // If DB_VERSION were > 1, this would still be OK (older = backward compat)
    await assert.doesNotReject(() => mergeImportedStores(imported));
  });

  test('Test 9: null import → throws "Invalid import file" error', async () => {
    await assert.rejects(
      () => mergeImportedStores(null),
      (err) => {
        assert.ok(
          err.message.includes('Invalid import file'),
          `Expected "Invalid import file" in error, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  test('Test 9b: non-object import → throws "Invalid import file" error', async () => {
    await assert.rejects(
      () => mergeImportedStores('not-an-object'),
      (err) => {
        assert.ok(
          err.message.includes('Invalid import file'),
          `Expected "Invalid import file" in error, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  test('Test 9c: import without habits array → throws "Invalid import file" error', async () => {
    await assert.rejects(
      () => mergeImportedStores({ schemaVersion: DB_VERSION }),
      (err) => {
        assert.ok(
          err.message.includes('Invalid import file'),
          `Expected "Invalid import file" in error, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});

describe('mergeImportedStores — merge-by-id semantics', () => {
  let repo;

  beforeEach(() => {
    repo = createFakeRepo();
    configureImport({ repo });
  });

  test('Test 1: colliding habit ID → local habit is completely replaced (overwritten)', async () => {
    // Pre-populate local repo with a habit
    await repo.putHabit(makeHabit('h1', { name: 'Original name' }));

    const imported = makeImportPayload({
      habits: [makeHabit('h1', { name: 'Imported name' })],
    });

    await mergeImportedStores(imported);

    const h = await repo.getHabit('h1');
    assert.equal(h.name, 'Imported name', 'Imported habit should overwrite local');
  });

  test('Test 2: new habit ID → new habit inserted, local habits untouched', async () => {
    await repo.putHabit(makeHabit('h-local', { name: 'Local only' }));

    const imported = makeImportPayload({
      habits: [makeHabit('h-new', { name: 'Brand new' })],
    });

    await mergeImportedStores(imported);

    // New habit inserted
    const hNew = await repo.getHabit('h-new');
    assert.ok(hNew, 'Imported habit should be inserted');
    assert.equal(hNew.name, 'Brand new');

    // Local-only habit untouched
    const hLocal = await repo.getHabit('h-local');
    assert.ok(hLocal, 'Local-only habit should remain');
    assert.equal(hLocal.name, 'Local only');
  });

  test('Test 6: log merge by [habitId, date] compound key → colliding logs overwritten', async () => {
    // Pre-populate a log
    await repo.putLog(makeLog('h1', '2026-01-01', { completed: false, notes: 'old' }));

    const imported = makeImportPayload({
      logs: [makeLog('h1', '2026-01-01', { completed: true, notes: 'imported' })],
    });

    await mergeImportedStores(imported);

    const log = await repo.getLog('h1', '2026-01-01');
    assert.ok(log, 'Log should exist after import');
    // After normalization (D-43): legacy completed:boolean → status:string
    assert.equal(log.status, 'completed', 'Imported log should overwrite local (status field from normalized row)');
    assert.equal(log.notes, 'imported', 'Imported log fields should overwrite local');
  });

  test('Test 7: settings merge by key → colliding settings overwritten', async () => {
    // Pre-populate a setting
    await repo.putSetting({ key: 'lastBackupDate', value: '2026-01-01' });

    const imported = makeImportPayload({
      settings: [{ key: 'lastBackupDate', value: '2026-06-01' }],
    });

    await mergeImportedStores(imported);

    const setting = await repo.getSetting('lastBackupDate');
    assert.ok(setting, 'Setting should exist after import');
    assert.equal(setting.value, '2026-06-01', 'Imported setting should overwrite local');
  });

  test('Test 2b: local-only settings not deleted after import of different keys', async () => {
    await repo.putSetting({ key: 'weekStart', value: 'mon' });

    const imported = makeImportPayload({
      settings: [{ key: 'lastBackupDate', value: '2026-06-01' }],
    });

    await mergeImportedStores(imported);

    // Local-only setting should still exist
    const weekStart = await repo.getSetting('weekStart');
    assert.ok(weekStart, 'Local-only setting should remain after import');
    assert.equal(weekStart.value, 'mon');
  });
});

describe('mergeImportedStores — all 7 stores', () => {
  let repo;

  beforeEach(() => {
    repo = createFakeRepo();
    configureImport({ repo });
  });

  test('Test 8: all 7 stores merged in single atomic transaction', async () => {
    const habitId = 'h-all';
    const imported = makeImportPayload({
      habits: [makeHabit(habitId)],
      habit_versions: [{ habitId, effectiveFrom: '2026-01-01', name: 'v1' }],
      logs: [makeLog(habitId, '2026-01-01')],
      events: [{ id: 'evt-1', type: 'test', at: '2026-01-01T00:00:00Z', habitId }],
      settings: [{ key: 'defaultThreshold', value: 0.9 }],
      meta: [{ key: 'seededIds', value: [habitId] }],
      score_snapshots: [{ habitId, date: '2026-01-01', score: 0.5 }],
    });

    await mergeImportedStores(imported);

    // Verify all 7 stores received data
    const h = await repo.getHabit(habitId);
    assert.ok(h, 'habits store: habit should be present');

    const hv = await repo.getHabitVersionAtDate(habitId, '2026-01-01');
    assert.ok(hv, 'habit_versions store: version should be present');

    const log = await repo.getLog(habitId, '2026-01-01');
    assert.ok(log, 'logs store: log should be present');

    const evt = await repo.getEvent('evt-1');
    assert.ok(evt, 'events store: event should be present');

    const threshold = await repo.getSetting('defaultThreshold');
    assert.ok(threshold, 'settings store: defaultThreshold should be present');

    const seededIds = await repo.getMeta('seededIds');
    assert.deepEqual(seededIds, [habitId], 'meta store: seededIds should be present');

    // score_snapshots: check via internal _stores
    const snapshotKey = JSON.stringify([habitId, '2026-01-01']);
    const snapshot = repo._stores.score_snapshots.get(snapshotKey);
    assert.ok(snapshot, 'score_snapshots store: snapshot should be present');
  });

  test('Test 8b: empty stores in import payload produce no errors', async () => {
    const imported = makeImportPayload(); // all arrays empty
    await assert.doesNotReject(() => mergeImportedStores(imported));
  });

  test('Test 8c: missing store keys in import treated as empty (no throw)', async () => {
    // Import payload that only has habits (other store keys absent)
    const imported = {
      schemaVersion: DB_VERSION,
      habits: [makeHabit('h-partial')],
      // no logs, settings, etc.
    };
    await assert.doesNotReject(() => mergeImportedStores(imported));
    const h = await repo.getHabit('h-partial');
    assert.ok(h, 'Partial import should still insert habits');
  });
});

describe('mergeImportedStores — broadcast', () => {
  test('Test broadcast: configureImport with broadcast calls broadcast fn after tx', async () => {
    const repo = createFakeRepo();
    let broadcastCalled = false;
    const fakeBroadcast = (msg) => {
      broadcastCalled = true;
      assert.deepEqual(msg, { type: 'import:done' });
    };

    configureImport({ repo, broadcast: fakeBroadcast });

    const imported = makeImportPayload({ habits: [makeHabit('h-bc')] });
    await mergeImportedStores(imported);

    assert.ok(broadcastCalled, 'broadcast should be called with {type: "import:done"}');

    // Reset: reconfigure without broadcast for subsequent tests
    configureImport({ repo: createFakeRepo() });
  });

  test('Test broadcast-absent: no broadcast configured → no error thrown', async () => {
    const repo = createFakeRepo();
    configureImport({ repo }); // no broadcast
    const imported = makeImportPayload({ habits: [makeHabit('h-no-bc')] });
    await assert.doesNotReject(() => mergeImportedStores(imported));
  });
});
