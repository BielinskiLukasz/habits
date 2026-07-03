// tests/integration/contract.fake-vs-real.test.js
// Source: 02-02-PLAN.md §Task 4 + 02-RESEARCH.md §Assumptions Log A7 + §Pitfall 9
//
// A7 contract — `tests/helpers/fake-idb.js` and `js/db/repo.js` MUST expose
// the same set of function names. If repo.js ever drops a method that the
// fake has, OR fake-idb ever adds a non-underscore method that the real
// repo lacks, this test fails in CI. That failure mode is the canonical
// "false-pass" disaster guard for this codebase (integration tests run
// against the fake; the contract test is the only thing tying the fake to
// the real surface).
//
// Pitfall 9: this test imports the real repo.js as a MODULE NAMESPACE
// (`import * as realRepo`) so the file is loaded + Object.keys-enumerable
// without any repo function being called. Calling a real repo function in
// Node would throw `indexedDB is not defined`. The test MUST NOT execute
// any real repo function — only inspect the export surface.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as realRepo from '../../js/db/repo.js';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** The minimum surface every storage facade must provide. */
const EXPECTED = [
  'getHabit',
  'getAllHabits',
  'putHabit',
  'putLog',
  'getLog',
  'getAllLogs',
  'getLogsInRange',
  'getLogsByHabit',
  'getLogsForDate',
  'getAllHabitVersions',
  'getHabitVersionAtDate',
  'putEvent',
  'getEvent',
  'getAllEvents',
  'getMeta',
  'putMeta',
  'getAllMeta',
  'getSetting',
  'putSetting',
  'getAllSettings',
  'getAllScoreSnapshots',
  'getSnapshot',
  'getLatestSnapshot',
  'runTx',
];

describe('contract: tests/helpers/fake-idb.js vs js/db/repo.js', () => {
  test('every EXPECTED name is a function on the real repo', () => {
    const realKeys = new Set(Object.keys(realRepo));
    for (const name of EXPECTED) {
      assert.ok(
        realKeys.has(name) && typeof realRepo[name] === 'function',
        `real repo is missing function '${name}' — A7 contract drift`,
      );
    }
  });

  test('every EXPECTED name is a function on the fake repo', () => {
    const fake = createFakeRepo();
    for (const name of EXPECTED) {
      assert.equal(
        typeof fake[name],
        'function',
        `fake repo is missing function '${name}' — A7 contract drift`,
      );
    }
  });

  test('the fake has NO unexpected non-underscore keys beyond EXPECTED (real MAY add helpers)', () => {
    const fake = createFakeRepo();
    const publicFakeKeys = Object.keys(fake).filter((k) => !k.startsWith('_'));
    const expectedSet = new Set(EXPECTED);
    const extras = publicFakeKeys.filter((k) => !expectedSet.has(k));
    assert.deepEqual(
      extras,
      [],
      `fake-idb.js exposes public keys not in EXPECTED (and therefore not enforced as repo.js exports): ${extras.join(', ')} — either add them to EXPECTED and repo.js, or prefix with '_' to mark them test-only.`,
    );
  });
});
