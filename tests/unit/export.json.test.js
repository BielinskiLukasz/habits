/**
 * @file Unit tests for js/io/export.js — JSON export logic (EXPORT-01, EXPORT-02).
 *
 * Tests cover:
 *   - exportJSON: returns a valid JSON string
 *   - exportJSON: embeds schemaVersion matching DB_VERSION from schema.js
 *   - exportJSON: contains all 7 store arrays (habits, logs, habit_versions,
 *     events, settings, meta, score_snapshots)
 *   - exportJSON: round-trip through JSON.parse produces expected object
 *   - exportJSON: exported habits preserve all fields
 *   - exportJSON: exported logs preserve [habitId, date] compound key structure
 *   - exportJSON: empty stores export as empty arrays, not undefined
 *   - configureExport: allows DI injection for testing
 *
 * Pattern: D-26 Tier 1 — pure function tests, no DOM, no real IDB.
 * Framework: node --test (D-23).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DB_VERSION } from '../../js/db/schema.js';

// Cache-bust the module so each describe block gets a fresh configureExport state.
// This mirrors the pattern used in seed.test.js and apply tests.
const { exportJSON, configureExport } = await import(
  `../../js/io/export.js?t=${Date.now()}`
);

// ---------------------------------------------------------------------------
// Fake repo factory for JSON export tests
// ---------------------------------------------------------------------------

/**
 * Build a minimal in-memory repo with getAll* methods for all 7 stores.
 * Only the read methods required by exportJSON are implemented.
 *
 * @param {object} [seedData] Optional initial data for each store.
 * @returns {object}
 */
function buildFakeRepo(seedData = {}) {
  const stores = {
    habits:          seedData.habits          ?? [],
    logs:            seedData.logs            ?? [],
    habit_versions:  seedData.habit_versions  ?? [],
    events:          seedData.events          ?? [],
    settings:        seedData.settings        ?? [],
    meta:            seedData.meta            ?? [],
    score_snapshots: seedData.score_snapshots ?? [],
  };

  return {
    async getAllHabits()          { return [...stores.habits]; },
    async getAllLogs()            { return [...stores.logs]; },
    async getAllHabitVersions()   { return [...stores.habit_versions]; },
    async getAllEvents()          { return [...stores.events]; },
    async getAllSettings()        { return [...stores.settings]; },
    async getAllMeta()            { return [...stores.meta]; },
    async getAllScoreSnapshots()  { return [...stores.score_snapshots]; },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HABIT_1 = {
  id: 'h-uuid-1',
  name: 'Morning walk',
  name_pl: 'Spacer rano',
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  stages: [{ threshold: 0.9, windowDays: 70 }],
  lastCompletedDate: '2026-06-05',
};

const HABIT_2 = {
  id: 'h-uuid-2',
  name: 'Water cups',
  name_pl: null,
  wave: 2,
  cadence: { type: 'daily' },
  targetType: 'numeric',
  target: 7,
  status: 'active',
  stages: [],
  lastCompletedDate: null,
};

const LOG_1 = {
  habitId: 'h-uuid-1',
  date: '2026-06-05',
  completed: true,
  definitionVersion: null,
};

const LOG_2 = {
  habitId: 'h-uuid-2',
  date: '2026-06-05',
  count: 5,
  definitionVersion: null,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('exportJSON — configureExport DI', () => {
  test('Test 8: configureExport({repo}) allows DI injection for testing', async () => {
    const repo = buildFakeRepo({ habits: [HABIT_1] });
    configureExport({ repo });

    const json = await exportJSON();
    assert.ok(typeof json === 'string', 'exportJSON returns a string');

    const parsed = JSON.parse(json);
    assert.equal(parsed.habits.length, 1, 'Injected repo data appears in export');
  });
});

describe('exportJSON — JSON structure validity', () => {
  beforeEach(() => {
    configureExport({ repo: buildFakeRepo({ habits: [HABIT_1, HABIT_2], logs: [LOG_1, LOG_2] }) });
  });

  test('Test 1: returns JSON string with habits array of length 2', async () => {
    const json = await exportJSON();
    assert.ok(typeof json === 'string', 'result is a string');
    const parsed = JSON.parse(json);
    assert.ok(Array.isArray(parsed.habits), 'habits is an array');
    assert.equal(parsed.habits.length, 2, 'habits array has 2 elements');
  });

  test('Test 2: JSON embeds schemaVersion field matching DB_VERSION', async () => {
    const json = await exportJSON();
    const parsed = JSON.parse(json);
    assert.ok('schemaVersion' in parsed, 'schemaVersion key present at top level');
    assert.equal(parsed.schemaVersion, DB_VERSION, 'schemaVersion matches DB_VERSION');
  });

  test('Test 3: JSON contains all 7 store arrays', async () => {
    const json = await exportJSON();
    const parsed = JSON.parse(json);
    const requiredKeys = ['habits', 'logs', 'habit_versions', 'events', 'settings', 'meta', 'score_snapshots'];
    for (const key of requiredKeys) {
      assert.ok(key in parsed, `top-level key '${key}' present`);
      assert.ok(Array.isArray(parsed[key]), `'${key}' is an array`);
    }
  });

  test('Test 4: JSON.parse(exportJSON()) produces object with schemaVersion + 7 store keys', async () => {
    const json = await exportJSON();
    // Must parse without throwing
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(json); }, 'JSON.parse does not throw');
    assert.ok(typeof parsed === 'object' && parsed !== null, 'parsed result is an object');
    assert.ok('schemaVersion' in parsed, 'schemaVersion present');
    assert.equal(Object.keys(parsed).length, 8, 'exactly 8 top-level keys (schemaVersion + 7 stores)');
  });
});

describe('exportJSON — field preservation', () => {
  beforeEach(() => {
    configureExport({ repo: buildFakeRepo({ habits: [HABIT_1, HABIT_2], logs: [LOG_1, LOG_2] }) });
  });

  test('Test 5: exported habits preserve all fields (id, name, wave, cadence, stages, status, etc.)', async () => {
    const json = await exportJSON();
    const { habits } = JSON.parse(json);
    const h1 = habits.find((h) => h.id === 'h-uuid-1');
    assert.ok(h1, 'habit h-uuid-1 found in export');
    assert.equal(h1.name, 'Morning walk');
    assert.equal(h1.name_pl, 'Spacer rano');
    assert.equal(h1.wave, 1);
    assert.deepEqual(h1.cadence, { type: 'daily' });
    assert.equal(h1.targetType, 'binary');
    assert.equal(h1.status, 'active');
    assert.ok(Array.isArray(h1.stages), 'stages preserved as array');
    assert.equal(h1.lastCompletedDate, '2026-06-05');
  });

  test('Test 6: exported logs preserve [habitId, date] compound key structure', async () => {
    const json = await exportJSON();
    const { logs } = JSON.parse(json);
    const l1 = logs.find((l) => l.habitId === 'h-uuid-1' && l.date === '2026-06-05');
    assert.ok(l1, 'log [h-uuid-1, 2026-06-05] found in export');
    assert.equal(l1.habitId, 'h-uuid-1');
    assert.equal(l1.date, '2026-06-05');
    assert.equal(l1.completed, true);
    assert.equal(l1.definitionVersion, null);
  });
});

describe('exportJSON — empty store handling', () => {
  test('Test 7: empty stores export as empty arrays, not undefined or null', async () => {
    // score_snapshots is empty by default in P5 (populated in P6)
    configureExport({ repo: buildFakeRepo({ habits: [HABIT_1] }) });
    const json = await exportJSON();
    const parsed = JSON.parse(json);

    const emptyStores = ['logs', 'habit_versions', 'events', 'settings', 'meta', 'score_snapshots'];
    for (const key of emptyStores) {
      assert.ok(Array.isArray(parsed[key]), `'${key}' is an array`);
      assert.equal(parsed[key].length, 0, `'${key}' is empty array (not undefined/null)`);
    }
  });

  test('All 7 stores as empty arrays when repo has no data', async () => {
    configureExport({ repo: buildFakeRepo() });
    const json = await exportJSON();
    const parsed = JSON.parse(json);
    const storeKeys = ['habits', 'logs', 'habit_versions', 'events', 'settings', 'meta', 'score_snapshots'];
    for (const key of storeKeys) {
      assert.ok(Array.isArray(parsed[key]), `'${key}' is an array`);
      assert.equal(parsed[key].length, 0);
    }
    // schemaVersion still embedded
    assert.equal(parsed.schemaVersion, DB_VERSION);
  });
});

describe('exportJSON — round-trip fidelity', () => {
  test('JSON round-trip: JSON.parse(exportJSON()) preserves all store data intact', async () => {
    const habitVersionRow = {
      habitId: 'h-uuid-1',
      effectiveFrom: '2026-01-01',
      name: 'Morning walk',
    };
    const eventRow = {
      id: 'ev-uuid-1',
      at: '2026-06-05T08:00:00.000Z',
      type: 'log:put',
      payload: { habitId: 'h-uuid-1', date: '2026-06-05' },
      inverse: null,
    };
    const settingRow = { key: 'defaultThreshold', value: 0.9 };
    const metaRow = { key: 'seededIds', value: ['h-uuid-1'] };
    const snapshotRow = {
      habitId: 'h-uuid-1',
      date: '2026-06-05',
      score: 0.85,
    };

    configureExport({
      repo: buildFakeRepo({
        habits:          [HABIT_1],
        logs:            [LOG_1],
        habit_versions:  [habitVersionRow],
        events:          [eventRow],
        settings:        [settingRow],
        meta:            [metaRow],
        score_snapshots: [snapshotRow],
      }),
    });

    const json = await exportJSON();
    const parsed = JSON.parse(json);

    // schemaVersion
    assert.equal(parsed.schemaVersion, DB_VERSION);

    // habits
    assert.equal(parsed.habits.length, 1);
    assert.deepEqual(parsed.habits[0], HABIT_1);

    // logs
    assert.equal(parsed.logs.length, 1);
    assert.deepEqual(parsed.logs[0], LOG_1);

    // habit_versions
    assert.equal(parsed.habit_versions.length, 1);
    assert.deepEqual(parsed.habit_versions[0], habitVersionRow);

    // events
    assert.equal(parsed.events.length, 1);
    assert.deepEqual(parsed.events[0], eventRow);

    // settings
    assert.equal(parsed.settings.length, 1);
    assert.deepEqual(parsed.settings[0], settingRow);

    // meta
    assert.equal(parsed.meta.length, 1);
    assert.deepEqual(parsed.meta[0], metaRow);

    // score_snapshots
    assert.equal(parsed.score_snapshots.length, 1);
    assert.deepEqual(parsed.score_snapshots[0], snapshotRow);
  });
});

describe('exportJSON — error handling', () => {
  test('throws if configureExport({repo}) was not called', async () => {
    // Re-import a fresh module instance (cache-busted) to test unconfigured state.
    const { exportJSON: freshExportJSON, configureExport: freshConfigure } = await import(
      `../../js/io/export.js?t=${Date.now() + 1}`
    );
    // Confirm unconfigured state throws
    await assert.rejects(
      () => freshExportJSON(),
      (err) => {
        assert.ok(err instanceof Error, 'throws an Error');
        assert.ok(
          err.message.includes('configureExport'),
          `error message mentions configureExport: "${err.message}"`,
        );
        return true;
      },
    );
    // Suppress unused variable warning — freshConfigure is confirmed available
    void freshConfigure;
  });
});
