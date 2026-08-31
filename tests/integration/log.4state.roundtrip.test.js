/**
 * @file Integration tests for JSON export → import round-trip across all 4
 * log states: completed, failed, skipped, and undefined (no row).
 *
 * Phase 11 success criterion 2: "A JSON export-then-import cycle preserves
 * all 4 log states without data loss or state coercion."
 *
 * Tests verify:
 *   - exportJSON serialises all 3 present log rows (completed/failed/skipped)
 *   - mergeImportedStores upserts all 3 rows into a fresh repo
 *   - Each status value is preserved exactly
 *   - The undefined state (no row for 2026-08-04) is preserved as absence
 *   - Merge-by-id overwrites a colliding log row with the imported status
 *   - Idempotent import: importing twice leaves the same 3 rows, no corruption
 *
 * Log identity key: [habitId, date] (compound key in the logs IDB store).
 *
 * This file uses createFakeRepo from tests/helpers/fake-idb.js (D-25, A7
 * contract). No DOM, no real IDB, no real BroadcastChannel.
 *
 * Cache-busted imports isolate module-level state (configureExport /
 * configureImport mutables) from other integration test files.
 *
 * Framework: node --test (D-23).
 */

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { DB_VERSION } from '../../js/db/schema.js';

// GREEN: imports wired to verify against existing implementation
const { exportJSON, configureExport } = await import(
  `../../js/io/export.js?t=${Date.now()}`
);
const { mergeImportedStores, configureImport } = await import(
  `../../js/io/import.js?t=${Date.now()}`
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal habit row so exportJSON has something in the habits store. */
const HABIT_H1 = {
  id: 'h1',
  name: 'Test habit',
  name_pl: null,
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  startDate: '2026-01-01',
  stages: [],
  lastCompletedDate: null,
};

/** Log rows covering all 3 present states (4th state = absence of a row). */
const LOG_COMPLETED = {
  habitId: 'h1',
  date: '2026-08-01',
  status: 'completed',
  definitionVersion: null,
};

const LOG_FAILED = {
  habitId: 'h1',
  date: '2026-08-02',
  status: 'failed',
  definitionVersion: null,
};

const LOG_SKIPPED = {
  habitId: 'h1',
  date: '2026-08-03',
  status: 'skipped',
  definitionVersion: null,
};

// 2026-08-04 intentionally has NO log row — tests the "undefined" state.

// ---------------------------------------------------------------------------
// Helper: build a seeded source repo
// ---------------------------------------------------------------------------

function buildSourceRepo() {
  const repo = createFakeRepo();
  repo.putHabit(HABIT_H1);
  repo.putLog(LOG_COMPLETED);
  repo.putLog(LOG_FAILED);
  repo.putLog(LOG_SKIPPED);
  return repo;
}

// ---------------------------------------------------------------------------
// Helper: perform a full export → import round-trip
// Returns the fresh target repo after the import.
// ---------------------------------------------------------------------------

async function roundTrip(sourceRepo) {
  // Configure the source repo for export.
  configureExport({ repo: sourceRepo });

  // Export to JSON string (exportJSON returns a string, not a Blob).
  const jsonString = await exportJSON();
  assert.ok(typeof jsonString === 'string', 'exportJSON returns a string');

  // Parse the JSON.
  const parsed = JSON.parse(jsonString);

  // Create a fresh target repo and run the import.
  const targetRepo = createFakeRepo();
  configureImport({ repo: targetRepo, broadcast: null });
  await mergeImportedStores(parsed);

  return { targetRepo, parsed };
}

// ---------------------------------------------------------------------------
// Test: export serialises only the 3 present log rows (not 4)
// ---------------------------------------------------------------------------

describe('exportJSON — 4-state log serialisation', () => {
  let parsed;

  before(async () => {
    const sourceRepo = buildSourceRepo();
    configureExport({ repo: sourceRepo });
    const jsonString = await exportJSON();
    parsed = JSON.parse(jsonString);
  });

  test('exported logs array contains exactly 3 rows (not 4 — undefined = absence)', () => {
    assert.equal(parsed.logs.length, 3, '3 log rows in export (no row for 2026-08-04)');
  });

  test('schemaVersion is embedded in the export', () => {
    assert.ok('schemaVersion' in parsed, 'schemaVersion present');
    assert.equal(parsed.schemaVersion, DB_VERSION);
  });

  test('completed log is present with status "completed"', () => {
    const log = parsed.logs.find((l) => l.habitId === 'h1' && l.date === '2026-08-01');
    assert.ok(log, 'completed log found in export');
    assert.equal(log.status, 'completed', 'status preserved as "completed"');
  });

  test('failed log is present with status "failed"', () => {
    const log = parsed.logs.find((l) => l.habitId === 'h1' && l.date === '2026-08-02');
    assert.ok(log, 'failed log found in export');
    assert.equal(log.status, 'failed', 'status preserved as "failed"');
  });

  test('skipped log is present with status "skipped"', () => {
    const log = parsed.logs.find((l) => l.habitId === 'h1' && l.date === '2026-08-03');
    assert.ok(log, 'skipped log found in export');
    assert.equal(log.status, 'skipped', 'status preserved as "skipped"');
  });

  test('no log row for 2026-08-04 (undefined state = omission)', () => {
    const log = parsed.logs.find((l) => l.habitId === 'h1' && l.date === '2026-08-04');
    assert.equal(log, undefined, 'no row exported for the undefined state date');
  });
});

// ---------------------------------------------------------------------------
// Test: round-trip preserves all 4 log states
// ---------------------------------------------------------------------------

describe('JSON round-trip — all 4 log states preserved', () => {
  let targetRepo;

  before(async () => {
    const sourceRepo = buildSourceRepo();
    ({ targetRepo } = await roundTrip(sourceRepo));
  });

  test('completed state preserved after round-trip', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-01');
    assert.ok(log, 'log row present in target repo');
    assert.equal(log.status, 'completed', 'status is "completed"');
  });

  test('failed state preserved after round-trip', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-02');
    assert.ok(log, 'log row present in target repo');
    assert.equal(log.status, 'failed', 'status is "failed"');
  });

  test('skipped state preserved after round-trip', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-03');
    assert.ok(log, 'log row present in target repo');
    assert.equal(log.status, 'skipped', 'status is "skipped"');
  });

  test('undefined state preserved after round-trip — no row for 2026-08-04', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-04');
    assert.equal(log, undefined, 'no row for undefined-state date after import');
  });

  test('habit row is also imported into target repo', async () => {
    const habit = await targetRepo.getHabit('h1');
    assert.ok(habit, 'habit h1 present in target repo after round-trip');
    assert.equal(habit.name, 'Test habit');
  });
});

// ---------------------------------------------------------------------------
// Test: merge-by-id overwrites a colliding log row (documented D-98 behaviour)
// ---------------------------------------------------------------------------

describe('JSON round-trip — merge-by-id collision overwrites local row', () => {
  let targetRepo;

  before(async () => {
    const sourceRepo = buildSourceRepo();
    const { parsed } = await roundTrip(sourceRepo);

    // Rebuild target repo with a PRE-SEEDED "completed" row for 2026-08-03
    // (the same date that has "skipped" in the export).
    targetRepo = createFakeRepo();
    await targetRepo.putLog({
      habitId: 'h1',
      date: '2026-08-03',
      status: 'completed',
      definitionVersion: null,
    });

    // Import the JSON — the "skipped" row should overwrite "completed".
    configureImport({ repo: targetRepo, broadcast: null });
    await mergeImportedStores(parsed);
  });

  test('imported "skipped" row overwrites pre-existing "completed" row (D-98 upsert)', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-03');
    assert.ok(log, 'log row still present after import');
    assert.equal(log.status, 'skipped', 'imported status "skipped" overwrote local "completed"');
  });
});

// ---------------------------------------------------------------------------
// Test: import is idempotent for non-colliding keys
// ---------------------------------------------------------------------------

describe('JSON round-trip — import idempotency', () => {
  let targetRepo;
  let parsedExport;

  before(async () => {
    const sourceRepo = buildSourceRepo();
    const result = await roundTrip(sourceRepo);
    targetRepo = result.targetRepo;
    parsedExport = result.parsed;

    // Import the SAME JSON a second time into the same target repo.
    configureImport({ repo: targetRepo, broadcast: null });
    await mergeImportedStores(parsedExport);
  });

  test('after two imports, exactly 3 log rows present (no duplication)', async () => {
    const allLogs = await targetRepo.getAllLogs();
    assert.equal(allLogs.length, 3, '3 log rows — no duplicates after idempotent import');
  });

  test('completed status unchanged after second import', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-01');
    assert.equal(log?.status, 'completed', 'status unchanged after re-import');
  });

  test('failed status unchanged after second import', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-02');
    assert.equal(log?.status, 'failed', 'status unchanged after re-import');
  });

  test('skipped status unchanged after second import', async () => {
    const log = await targetRepo.getLog('h1', '2026-08-03');
    assert.equal(log?.status, 'skipped', 'status unchanged after re-import');
  });
});
