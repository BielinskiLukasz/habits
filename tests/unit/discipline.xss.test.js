/**
 * @file Discipline test — grep-based XSS-safe DOM construction enforcement (D-78).
 *
 * Forbidden constructs in any `.js` file under `js/`:
 *   - `.innerHTML` / `.outerHTML` — HTML-injection sinks
 *   - `.insertAdjacentHTML` — string-parsed-as-HTML sink
 *   - `document.write(...)` — legacy string-write sink
 *
 * Belt-and-suspenders with D-77's `mount()` helper: the discipline test
 * catches bypasses; the helper makes the intended path the easy one.
 *
 * Strips JSDoc + block + line comments before matching so commentary may
 * legitimately reference the forbidden tokens (e.g. this very file header).
 *
 * Allowlist: empty (zero exceptions). If a future feature legitimately needs
 * one of these sinks, append the path here AND record the rationale.
 *
 * Pattern S6 (apply.discipline.test.js template).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Strip block + line comments so commentary may safely reference forbidden tokens.
 *
 * @param {string} path
 * @returns {string}
 */
function readStripped(path) {
  const src = readFileSync(path, 'utf8');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block + JSDoc comments
    .replace(/^\s*\/\/.*$/gm, '');         // line comments
}

/**
 * Recursively collect every `.js` file under `dir`. Returns [] if dir missing.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function jsFilesIn(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...jsFilesIn(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

describe('discipline: XSS-safe DOM construction (D-78)', () => {
  test('no .innerHTML / .outerHTML / .insertAdjacentHTML / document.write in js/', () => {
    const forbidden = /\.(innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/;
    const targets = jsFilesIn(join(ROOT, 'js'));

    /** @type {string[]} */
    const violations = [];
    for (const path of targets) {
      const m = readStripped(path).match(forbidden);
      if (m) violations.push(`${path}: matched ${m[0]}`);
    }
    assert.deepEqual(
      violations,
      [],
      `D-78 violations:\n${violations.join('\n')}`,
    );
  });
});
