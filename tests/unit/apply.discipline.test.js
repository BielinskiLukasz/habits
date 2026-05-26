/**
 * @file Discipline tests — grep-based structural enforcement (T-02-13/T-02-14).
 *
 * Enforces three Anti-Pattern invariants that the whole P2+ architecture
 * depends on:
 *   1. Views, IO modules, and undo.js NEVER call `js/db/repo.js` write
 *      helpers directly. Only `js/state/apply.js` and its `apply/*.js`
 *      handlers may write (DATA-04, ARCHITECTURE §Anti-Pattern 1).
 *   2. `js/platform/lifecycle.js` MUST NOT contain the `beforeunload` token
 *      in code (Pitfall 8, MDN, T-02-13).
 *   3. `js/state/apply.js` dispatches via a `HANDLERS` table and contains
 *      no `switch (` statement (ARCHITECTURE §Anti-Pattern 4 — no god switch).
 *
 * Strips JSDoc + block + line comments before matching so the forbidden
 * tokens are allowed in commentary explaining the negative-space invariants.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Read a file and return source with all block-comments (/* ... *\/) and
 * line-comments (// ...) stripped. Imperfect for edge cases (e.g. comment
 * markers inside string literals) — but the negative-space we are guarding
 * here only ever appears in actual identifiers / event-type strings, not in
 * arbitrary string literals.
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
 * Recursively collect all `.js` files under a directory (returns absolute
 * paths). Returns [] if the dir does not exist.
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

describe('discipline: views/io/undo never write via repo.js directly (Anti-Pattern 1, T-02-14)', () => {
  test('no put* repo helpers called outside js/state/apply*.js', () => {
    const forbidden = /\b(putHabit|putLog|putEvent|putMeta|putSetting)\s*\(/;

    // Sweep js/views/ + js/io/ + js/state/undo.js (if it exists).
    const targets = [
      ...jsFilesIn(join(ROOT, 'js/views')),
      ...jsFilesIn(join(ROOT, 'js/io')),
    ];
    const undoPath = join(ROOT, 'js/state/undo.js');
    if (existsSync(undoPath)) targets.push(undoPath);

    /** @type {string[]} */
    const violations = [];
    for (const path of targets) {
      const src = readStripped(path);
      const m = src.match(forbidden);
      if (m) {
        violations.push(`${path}: matched ${m[0]}`);
      }
    }
    assert.deepEqual(violations, [], `repo.js write helpers found outside apply.js:\n${violations.join('\n')}`);
  });
});

describe('discipline: lifecycle.js MUST NOT use beforeunload (Pitfall 8, T-02-13)', () => {
  test('zero matches for `beforeunload` in code (comments stripped)', () => {
    const path = join(ROOT, 'js/platform/lifecycle.js');
    if (!existsSync(path)) {
      assert.fail('js/platform/lifecycle.js does not exist yet');
    }
    const src = readStripped(path);
    assert.equal(src.match(/\bbeforeunload\b/), null, '`beforeunload` must not appear in code');
  });
});

describe('discipline: apply.js dispatches via HANDLERS (Anti-Pattern 4)', () => {
  test('contains literal `HANDLERS` and contains NO `switch (` statement', () => {
    const path = join(ROOT, 'js/state/apply.js');
    if (!existsSync(path)) {
      assert.fail('js/state/apply.js does not exist yet');
    }
    const src = readStripped(path);
    assert.ok(src.includes('HANDLERS'), '`HANDLERS` table must be present');
    assert.equal(src.match(/\bswitch\s*\(/), null, '`switch (` is forbidden in apply.js (Anti-Pattern 4 — no god switch)');
  });
});
