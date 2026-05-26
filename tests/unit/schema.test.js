// tests/unit/schema.test.js
// Source: 02-02-PLAN.md §Task 1 + 02-RESEARCH.md §Pattern 2 + 02-PATTERNS.md §`js/db/schema.js`
//
// Covers DATA-02 (v1 schema = 7 stores) and DATA-05 (definitionVersion-aware
// log shape via the `logs` keypath + indexes). Asserts D-39 (score_snapshots
// in v1, no v2 needed for P6) and D-42 (events keyed by UUID, not autoincrement).
// Walks the MIGRATIONS dispatch table with a small mock IDB-style `db` so the
// schema declaration is testable in Node without an `indexedDB` global
// (Pitfall 9).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DB_VERSION, MIGRATIONS } from '../../js/db/schema.js';

/**
 * Mock IDB-style `db` that captures `createObjectStore`/`createIndex` calls.
 *
 * Each `createObjectStore` returns a mock store. `store.createIndex(name, path)`
 * returns an IDBIndex-shaped object — NOT the parent store — exactly like real
 * IndexedDB does. This matters: previous versions of this mock returned the
 * store, which let a fluent `.createIndex().createIndex()` chain pass tests
 * even though the second call throws against real IDB ("createIndex is not a
 * function on IDBIndex"). That divergence (Pitfall 9 — fake/real divergence)
 * shipped a broken schema in Phase 2 Wave 5. Mock fidelity is the contract.
 *
 * @returns {{ createObjectStore: (name: string, opts: object) => object, _stores: Array<{name: string, opts: object, indexes: string[]}> }}
 */
function mockDb() {
  const stores = [];
  return {
    createObjectStore(name, opts) {
      const indexes = [];
      const storeRec = { name, opts, indexes };
      stores.push(storeRec);
      return {
        createIndex(iname, keyPath, options) {
          indexes.push(iname);
          // IDBIndex-shaped: name + keyPath + multiEntry/unique flags. NO
          // createIndex method here — mirrors the real-IDB return type so
          // `.createIndex().createIndex()` chains fail loudly in tests.
          return {
            name: iname,
            keyPath,
            multiEntry: !!(options && options.multiEntry),
            unique: !!(options && options.unique),
          };
        },
      };
    },
    _stores: stores,
  };
}

describe('DB_VERSION', () => {
  test('is the number 1 (v1 schema is locked)', () => {
    assert.equal(DB_VERSION, 1);
    assert.equal(typeof DB_VERSION, 'number');
  });
});

describe('MIGRATIONS', () => {
  test('is an object with key "1" mapping to a function', () => {
    assert.equal(typeof MIGRATIONS, 'object');
    assert.notEqual(MIGRATIONS, null);
    assert.equal(typeof MIGRATIONS[1], 'function');
  });

  test('contains exactly key "1" at this point in time', () => {
    assert.deepEqual(Object.keys(MIGRATIONS), ['1']);
  });

  test('MIGRATIONS[1] creates exactly 7 stores with the locked (name, options) shapes', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);

    const byName = Object.fromEntries(db._stores.map((s) => [s.name, s]));
    const names = db._stores.map((s) => s.name);

    assert.equal(db._stores.length, 7, `expected 7 stores, got ${db._stores.length}: ${names.join(', ')}`);

    // habits — keyPath 'id', UUID per D-42
    assert.ok(byName.habits, 'habits store missing');
    assert.deepEqual(byName.habits.opts, { keyPath: 'id' });

    // habit_versions — compound key [habitId, effectiveFrom]
    assert.ok(byName.habit_versions, 'habit_versions store missing');
    assert.deepEqual(byName.habit_versions.opts, { keyPath: ['habitId', 'effectiveFrom'] });

    // logs — compound key [habitId, date]
    assert.ok(byName.logs, 'logs store missing');
    assert.deepEqual(byName.logs.opts, { keyPath: ['habitId', 'date'] });

    // events — UUID per D-42 (NOT autoincrement)
    assert.ok(byName.events, 'events store missing');
    assert.deepEqual(byName.events.opts, { keyPath: 'id' });

    // settings — singleton 'key'
    assert.ok(byName.settings, 'settings store missing');
    assert.deepEqual(byName.settings.opts, { keyPath: 'key' });

    // meta — singleton 'key'
    assert.ok(byName.meta, 'meta store missing');
    assert.deepEqual(byName.meta.opts, { keyPath: 'key' });

    // score_snapshots — D-39: declared empty in v1 so P6 needs no v2 migration
    assert.ok(byName.score_snapshots, 'score_snapshots store missing');
    assert.deepEqual(byName.score_snapshots.opts, { keyPath: ['habitId', 'date'] });
  });

  test('habits has exactly the indexes wave + status', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);
    const habits = db._stores.find((s) => s.name === 'habits');
    assert.ok(habits);
    assert.deepEqual(habits.indexes.slice().sort(), ['status', 'wave']);
  });

  test('habit_versions has the habitId index', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);
    const hv = db._stores.find((s) => s.name === 'habit_versions');
    assert.ok(hv);
    assert.ok(hv.indexes.includes('habitId'), `expected habitId index, got: ${hv.indexes.join(', ')}`);
  });

  test('logs has indexes date + habitId', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);
    const logs = db._stores.find((s) => s.name === 'logs');
    assert.ok(logs);
    assert.deepEqual(logs.indexes.slice().sort(), ['date', 'habitId']);
  });

  test('events has indexes at + type + habitId', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);
    const events = db._stores.find((s) => s.name === 'events');
    assert.ok(events);
    assert.deepEqual(events.indexes.slice().sort(), ['at', 'habitId', 'type']);
  });

  test('score_snapshots has indexes date + habitId (D-39 ready for P6)', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);
    const snaps = db._stores.find((s) => s.name === 'score_snapshots');
    assert.ok(snaps);
    assert.deepEqual(snaps.indexes.slice().sort(), ['date', 'habitId']);
  });

  test('no store uses autoIncrement (D-42 — events are UUID-keyed)', () => {
    const db = mockDb();
    MIGRATIONS[1](db, null);
    for (const s of db._stores) {
      assert.ok(
        !('autoIncrement' in s.opts) || s.opts.autoIncrement !== true,
        `store ${s.name} must not use autoIncrement`,
      );
    }
  });
});
