/**
 * @file Wave 0 smoke test (D-38).
 *
 * Proves two things on commit 1 of Phase 2:
 *   (1) `node --test tests/` is wired and exits 0.
 *   (2) `js/util/version.js` is resolvable from `tests/` via the canonical
 *       relative import (D-19).
 *
 * The version assertion uses the SemVer 2.0.0 shape from D-28 (`MAJOR.MINOR.PATCH`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../../js/util/version.js';

test('smoke: node --test is wired and APP_VERSION matches SemVer 2.0.0', () => {
  assert.ok(typeof APP_VERSION === 'string', 'APP_VERSION should be a string');
  assert.match(
    APP_VERSION,
    /^\d+\.\d+\.\d+$/,
    `APP_VERSION '${APP_VERSION}' should match MAJOR.MINOR.PATCH per D-28`,
  );
});
