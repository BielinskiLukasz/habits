// tests/integration/repo.surface.test.js
// Source: 02-02-PLAN.md §Task 3 (W3 driver)
//
// Driver test that naturally fails at module-resolve time until
// `js/db/repo.js` exists. Asserts the public function surface of the real
// repo module matches the expected typed-facade signature (DATA-01).
//
// This test deliberately uses a NAMESPACE import (`import * as repo`), NOT
// individual named imports. Per RESEARCH §Pitfall 9 the repo module must be
// importable in Node — it must NOT touch `indexedDB` at module top-level
// (lazy via internal `openDB()` calls only). Importing it here proves that
// discipline holds; calling any function would throw `indexedDB is not
// defined` in Node and is therefore forbidden in this test.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as repo from '../../js/db/repo.js';

const EXPECTED = [
  'getHabit',
  'putHabit',
  'putLog',
  'getLog',
  'putEvent',
  'getEvent',
  'getMeta',
  'putMeta',
  'getSetting',
  'putSetting',
  'runTx',
];

describe('repo surface — public exports (DATA-01)', () => {
  for (const name of EXPECTED) {
    test(`repo.${name} is an exported function`, () => {
      assert.equal(
        typeof repo[name],
        'function',
        `expected repo.${name} to be a function, got ${typeof repo[name]}`,
      );
    });
  }
});
