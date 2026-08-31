/**
 * @file Unit tests for js/domain/logStatus.js (D-04, D-05).
 *
 * Covers the nextLogState pure function for the 4-state swipe cycle:
 *   undefined/null → completed → failed → skipped → null
 *
 * Pattern (D-23) — node:test + node:assert/strict, no external framework.
 * Plus a discipline assertion that logStatus.js dispatches via NEXT_STATE
 * (Anti-Pattern 4: no switch statement on status values).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nextLogState } from '../../js/domain/logStatus.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('nextLogState', () => {
  test('null returns "completed"', () => {
    assert.equal(nextLogState(null), 'completed');
  });

  test('undefined returns "completed"', () => {
    assert.equal(nextLogState(undefined), 'completed');
  });

  test('"completed" returns "failed"', () => {
    assert.equal(nextLogState('completed'), 'failed');
  });

  test('"failed" returns "skipped"', () => {
    assert.equal(nextLogState('failed'), 'skipped');
  });

  test('"skipped" returns null', () => {
    assert.equal(nextLogState('skipped'), null);
  });

  test('unknown string input returns null (safe fallback)', () => {
    assert.equal(nextLogState('anything-unknown'), null);
  });
});

describe('logStatus.js discipline', () => {
  test('contains NEXT_STATE and no switch statement', () => {
    const src = readFileSync(`${ROOT}js/domain/logStatus.js`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.ok(src.includes('NEXT_STATE'), 'logStatus.js must use NEXT_STATE dispatch table');
    assert.equal(
      src.match(/\bswitch\s*\(/),
      null,
      '`switch (` is forbidden in logStatus.js (Anti-Pattern 4)',
    );
  });
});
