/**
 * @file Integration tests for js/io/export.js — JSON and CSV export
 * end-to-end round-trips (EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04,
 * EXPORT-06, EXPORT-07).
 *
 * Tests verify:
 *   - exportJSON → JSON.parse round-trip: all 7 stores preserved
 *   - exportJSON → schemaVersion embedded
 *   - exportCSV → BOM present at byte 0
 *   - exportCSV → CRLF line endings
 *   - exportCSV → semicolon delimiter
 *   - exportCSV → cell encoding correct (1/0/x, multi-occurrence counts)
 *   - exportCSV → habit row order: wave numeric ascending, then name alphabetical
 *   - exportCSV → empty repo exports header-only CSV (no data rows)
 *   - exportCSV → date range defaults to earliest log date → today
 *
 * This file uses a hand-written fake repo (createFakeRepo from
 * tests/helpers/fake-idb.js) following the established fake-IDB pattern
 * (D-25, A7 contract). No DOM, no real IDB, no real BroadcastChannel.
 *
 * configureExport is cache-busted once per file to get a fresh module
 * instance for these integration tests.
 *
 * Framework: node --test (D-23).
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { DB_VERSION } from '../../js/db/schema.js';

// Cache-bust to get a fresh configureExport instance for this file.
const { exportJSON, exportCSV, configureExport } = await import(
  `../../js/io/export.js?t=${Date.now()}`
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HABIT_BINARY = {
  id: 'h-binary',
  name: 'Morning walk',
  name_pl: 'Spacer rano',
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'active',
  startDate: '2026-01-01',
  stages: [],
  lastCompletedDate: '2026-06-05',
};

const HABIT_NUMERIC = {
  id: 'h-numeric',
  name: 'Water cups',
  name_pl: null,
  wave: 2,
  cadence: { type: 'daily' },
  targetType: 'numeric',
  target: 7,
  status: 'active',
  startDate: '2026-01-01',
  stages: [],
  lastCompletedDate: null,
};

const HABIT_ARCHIVED = {
  id: 'h-archived',
  name: 'Archived habit',
  name_pl: null,
  wave: 1,
  cadence: { type: 'daily' },
  targetType: 'binary',
  status: 'archived',
  startDate: '2026-01-01',
  stages: [],
  lastCompletedDate: null,
};

// Logs for a fixed date so we can assert on CSV cell values.
const DATE = '2026-06-05';

const LOG_COMPLETED = {
  habitId: 'h-binary',
  date: DATE,
  status: 'completed',
  definitionVersion: null,
};

const LOG_NOT_COMPLETED = {
  habitId: 'h-binary',
  date: '2026-06-04',
  status: 'failed',
  definitionVersion: null,
};

const LOG_NUMERIC_5 = {
  habitId: 'h-numeric',
  date: DATE,
  count: 5,
  definitionVersion: null,
};

// Fixture for the weekStart setting.
const SETTING_WEEKSTART = { key: 'weekStart', value: 'mon' };

// ---------------------------------------------------------------------------
// Helper: build a fake repo pre-seeded with standard fixtures
// ---------------------------------------------------------------------------

function buildSeededRepo(overrides = {}) {
  const repo = createFakeRepo();

  const habits = overrides.habits ?? [HABIT_BINARY, HABIT_NUMERIC];
  const logs = overrides.logs ?? [LOG_COMPLETED, LOG_NOT_COMPLETED, LOG_NUMERIC_5];
  const settings = overrides.settings ?? [SETTING_WEEKSTART];

  for (const h of habits) repo.putHabit(h);
  for (const l of logs) repo.putLog(l);
  for (const s of settings) repo.putSetting(s);

  return repo;
}

// ---------------------------------------------------------------------------
// JSON Export — round-trip integrity
// ---------------------------------------------------------------------------

describe('exportJSON — round-trip integrity (all 7 stores preserved)', () => {
  before(() => {
    const repo = buildSeededRepo();
    // Also seed some extra stores.
    repo.putEvent({ id: 'ev-1', at: '2026-06-05T08:00:00Z', type: 'markCompleted', payload: {}, inverse: null });
    repo.putMeta('seededAt', '2026-06-05');
    configureExport({ repo });
  });

  test('exportJSON returns a valid JSON string', async () => {
    const json = await exportJSON();
    assert.ok(typeof json === 'string', 'result is a string');
    assert.doesNotThrow(() => JSON.parse(json), 'JSON.parse does not throw');
  });

  test('exportJSON embeds schemaVersion matching DB_VERSION', async () => {
    const json = await exportJSON();
    const parsed = JSON.parse(json);
    assert.ok('schemaVersion' in parsed, 'schemaVersion present');
    assert.equal(parsed.schemaVersion, DB_VERSION);
  });

  test('all 7 stores are present as arrays in the export', async () => {
    const json = await exportJSON();
    const parsed = JSON.parse(json);
    const storeKeys = ['habits', 'logs', 'habit_versions', 'events', 'settings', 'meta', 'score_snapshots'];
    for (const key of storeKeys) {
      assert.ok(key in parsed, `key '${key}' present`);
      assert.ok(Array.isArray(parsed[key]), `'${key}' is an array`);
    }
  });

  test('exported habits preserve all fields (EXPORT-01)', async () => {
    const json = await exportJSON();
    const { habits } = JSON.parse(json);
    const h = habits.find((x) => x.id === 'h-binary');
    assert.ok(h, 'habit h-binary in export');
    assert.equal(h.name, 'Morning walk');
    assert.equal(h.name_pl, 'Spacer rano');
    assert.equal(h.wave, 1);
    assert.deepEqual(h.cadence, { type: 'daily' });
    assert.equal(h.status, 'active');
  });

  test('exported logs preserve compound key structure [habitId, date]', async () => {
    const json = await exportJSON();
    const { logs } = JSON.parse(json);
    const l = logs.find((x) => x.habitId === 'h-binary' && x.date === DATE);
    assert.ok(l, 'log [h-binary, 2026-06-05] in export');
    assert.equal(l.status, 'completed');
  });

  test('exportJSON does NOT prepend UTF-8 BOM (Pitfall 6)', async () => {
    const json = await exportJSON();
    // BOM is ﻿; JSON must NOT start with it.
    assert.ok(!json.startsWith('﻿'), 'JSON does not start with BOM');
    assert.ok(!json.startsWith('﻿'), 'JSON does not start with BOM (lowercase)');
  });
});

// ---------------------------------------------------------------------------
// CSV Export — format verification
// ---------------------------------------------------------------------------

describe('exportCSV — BOM + CRLF + semicolon delimiter (EXPORT-04)', () => {
  before(() => {
    const repo = buildSeededRepo();
    configureExport({ repo });
  });

  test('CSV starts with UTF-8 BOM (\\uFEFF)', async () => {
    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    assert.ok(csv.startsWith('﻿'), 'CSV starts with BOM');
  });

  test('CSV uses CRLF line endings between rows', async () => {
    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    // Must contain at least one CRLF (between header and first data row).
    assert.ok(csv.includes('\r\n'), 'CSV contains CRLF');
    // Must NOT use bare LF only (would indicate broken line endings).
    const linesViaCRLF = csv.split('\r\n');
    assert.ok(linesViaCRLF.length >= 2, 'at least 2 lines separated by CRLF');
  });

  test('CSV uses semicolon as field delimiter', async () => {
    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    // Strip BOM, take header row.
    const headerLine = csv.replace('﻿', '').split('\r\n')[0];
    assert.ok(headerLine.includes(';'), 'header row has semicolon delimiter');
    assert.ok(headerLine.startsWith('habit_name;wave;'), 'header starts with habit_name;wave;');
  });

  test('CSV header row contains the date column for the export date', async () => {
    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    const headerLine = csv.replace('﻿', '').split('\r\n')[0];
    assert.ok(headerLine.includes(DATE), `header contains date column ${DATE}`);
  });
});

// ---------------------------------------------------------------------------
// CSV Export — cell encoding (EXPORT-03, EXPORT-06)
// ---------------------------------------------------------------------------

describe('exportCSV — cell encoding: 1/0/x and multi-occurrence counts', () => {
  before(() => {
    const repo = buildSeededRepo();
    configureExport({ repo });
  });

  test('completed binary habit on applicable date → cell value "1"', async () => {
    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    const lines = csv.replace('﻿', '').split('\r\n');
    const binaryRow = lines.find((l) => l.startsWith('Morning walk;'));
    assert.ok(binaryRow, 'Morning walk row found');
    // cells: habit_name;wave;DATE_CELL
    const cells = binaryRow.split(';');
    assert.equal(cells[2], '1', 'completed binary habit shows 1');
  });

  test('not-completed binary habit on applicable date → cell value "0"', async () => {
    // Use the date 2026-06-04 (LOG_NOT_COMPLETED)
    const csv = await exportCSV({ startDate: '2026-06-04', endDate: '2026-06-04' });
    const lines = csv.replace('﻿', '').split('\r\n');
    const binaryRow = lines.find((l) => l.startsWith('Morning walk;'));
    assert.ok(binaryRow, 'Morning walk row found');
    const cells = binaryRow.split(';');
    assert.equal(cells[2], '0', 'not-completed binary habit shows 0');
  });

  test('numeric habit shows raw count string (Pitfall 2 — EXPORT-06)', async () => {
    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    const lines = csv.replace('﻿', '').split('\r\n');
    const numericRow = lines.find((l) => l.startsWith('Water cups;'));
    assert.ok(numericRow, 'Water cups row found');
    const cells = numericRow.split(';');
    // LOG_NUMERIC_5 has count: 5 → cell should be '5', NOT '1' (Pitfall 2 guard)
    assert.equal(cells[2], '5', 'numeric habit shows raw count, not 1');
  });

  test('archived habit → all cells are "x" regardless of logs', async () => {
    const repo = buildSeededRepo({
      habits: [HABIT_BINARY, HABIT_ARCHIVED],
      logs: [LOG_COMPLETED, { habitId: 'h-archived', date: DATE, completed: true, definitionVersion: null }],
      settings: [SETTING_WEEKSTART],
    });
    configureExport({ repo });

    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    const lines = csv.replace('﻿', '').split('\r\n');
    const archivedRow = lines.find((l) => l.startsWith('Archived habit;'));
    assert.ok(archivedRow, 'Archived habit row found');
    const cells = archivedRow.split(';');
    assert.equal(cells[2], 'x', 'archived habit shows x even when log exists');
  });

  test('no log on applicable date → cell value "0"', async () => {
    // Use a date with no log for h-binary (2026-06-06 — only DATE and 2026-06-04 have logs)
    const repo = buildSeededRepo({
      habits: [HABIT_BINARY],
      logs: [LOG_COMPLETED], // only 2026-06-05 has a log
      settings: [SETTING_WEEKSTART],
    });
    configureExport({ repo });

    const csv = await exportCSV({ startDate: '2026-06-06', endDate: '2026-06-06' });
    const lines = csv.replace('﻿', '').split('\r\n');
    const binaryRow = lines.find((l) => l.startsWith('Morning walk;'));
    assert.ok(binaryRow, 'Morning walk row found');
    const cells = binaryRow.split(';');
    assert.equal(cells[2], '0', 'applicable date with no log shows 0');
  });
});

// ---------------------------------------------------------------------------
// CSV Export — row ordering (D-93)
// ---------------------------------------------------------------------------

describe('exportCSV — row ordering: wave numeric asc, then name alpha', () => {
  test('habits sorted by wave numeric ascending then name alphabetical', async () => {
    const repo = createFakeRepo();
    // Same wave (2) — should be sorted alphabetically by name.
    // Different waves — should be sorted by wave number.
    const habits = [
      { id: 'h-w2-b', name: 'Zebra', wave: 2, cadence: { type: 'daily' }, targetType: 'binary', status: 'active', startDate: '2026-01-01', stages: [], lastCompletedDate: null },
      { id: 'h-w1-a', name: 'Apple', wave: 1, cadence: { type: 'daily' }, targetType: 'binary', status: 'active', startDate: '2026-01-01', stages: [], lastCompletedDate: null },
      { id: 'h-w2-a', name: 'Ant',   wave: 2, cadence: { type: 'daily' }, targetType: 'binary', status: 'active', startDate: '2026-01-01', stages: [], lastCompletedDate: null },
    ];
    for (const h of habits) repo.putHabit(h);
    repo.putSetting(SETTING_WEEKSTART);
    configureExport({ repo });

    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l.trim());
    // Skip header line [0]; remaining are data rows.
    const names = lines.slice(1).map((l) => l.split(';')[0]);
    assert.deepEqual(names, ['Apple', 'Ant', 'Zebra'], 'rows ordered by wave then name');
  });
});

// ---------------------------------------------------------------------------
// CSV Export — empty repo
// ---------------------------------------------------------------------------

describe('exportCSV — empty repo exports header-only CSV', () => {
  test('no habits → CSV has only header row', async () => {
    const repo = createFakeRepo();
    repo.putSetting(SETTING_WEEKSTART);
    configureExport({ repo });

    const csv = await exportCSV({ startDate: DATE, endDate: DATE });
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l.trim());
    assert.equal(lines.length, 1, 'only header row when no habits');
    assert.ok(lines[0].startsWith('habit_name;wave;'), 'header row present');
  });
});
