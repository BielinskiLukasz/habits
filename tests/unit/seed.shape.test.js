/**
 * @file Seed file shape tests — `seed/habits.json` shape contract (SEED-01, SEED-02, SEED-05).
 *
 * Three discrete responsibilities:
 *
 *   1. **Top-level shape (SEED-01, RESEARCH §Open Question 3 RESOLVED)** —
 *      seed file parses as `{schemaVersion: 1, seedVersion: 2, habits: [...]}`.
 *      The wrapped-object shape is locked so future fields (e.g. `wavesMeta`)
 *      ride on the same top-level without breaking the loader.
 *
 *   2. **Empty habits array (history-seed-null-startdate scope expansion,
 *      2026-09-17)** — `seed/habits.json`'s `habits` array is now `[]`. The
 *      8-habit D-32 placeholder catalog (SEED-02) that used to ship here was
 *      onboarding demo content, not real Nawyki data (none of the 8 IDs
 *      appear in the real Nawyki v1.csv or in `data/habits-import-*.json`),
 *      and it defeated `js/domain/cadence.js`'s existence guard by shipping
 *      with `startDate: null` and no `createdAt`. Removed outright rather
 *      than archived as a fixture — see the resolved debug session
 *      `history-seed-null-startdate` for the full investigation. Fresh
 *      installs now seed 0 demo habits; `js/io/seed.js`'s `demoHabitsRemoved`
 *      migration removes the 8 hardcoded `DEMO_HABIT_IDS` from any install
 *      that auto-seeded them before this change shipped.
 *
 *   3. **No xlsx/txt parsing code in js/ (SEED-05)** — the seed is a static
 *      JSON fixture; the app must NOT ship runtime parsers for the source
 *      spreadsheets (Pitfall 12). Walked recursively over `js/`.
 *
 * Imports: `node:test` + `node:assert/strict` only (D-23/D-25 — no third-party deps).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEED_PATH = join(ROOT, 'seed', 'habits.json');

/**
 * Recursively yield all `.js` files under a directory. Node 20 has no
 * built-in glob, so we walk manually.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function walkDir(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walkDir(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

describe('seed/habits.json — shape (SEED-01, Open Question 3 RESOLVED)', () => {
  test('file loads and parses as JSON', async () => {
    const raw = await readFile(SEED_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(typeof parsed, 'object', 'parsed seed must be an object');
    assert.ok(parsed !== null, 'parsed seed must not be null');
  });

  test('top-level shape is {schemaVersion: 1, seedVersion: 2, habits: [...]}', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    assert.equal(seed.schemaVersion, 1, 'schemaVersion must equal 1');
    assert.equal(seed.seedVersion, 2, 'seedVersion must equal 2 (P4 enrichment bump)');
    assert.ok(Array.isArray(seed.habits), 'seed.habits must be an array');
  });
});

describe('seed: empty habits array (history-seed-null-startdate scope expansion, 2026-09-17)', () => {
  test('seed.habits.length === 0 — demo catalog removed, fresh installs seed 0 habits', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    assert.equal(seed.habits.length, 0, `expected 0 habits (demo catalog removed); got ${seed.habits.length}`);
  });
});

describe('seed: no xlsx/txt parser in js/ (SEED-05)', () => {
  test('zero matches for xlsx|XLSX|SheetJS|exceljs|read_xlsx|parse_xlsx in any js/**/*.js (comments stripped)', () => {
    // Strip block + line comments before matching so JSDoc files that explain
    // the negative-space invariant ("no xlsx parsers allowed") don't trigger
    // a false positive. Same convention as tests/unit/apply.discipline.test.js.
    const forbidden = /xlsx|XLSX|SheetJS|exceljs|read_xlsx|parse_xlsx/;
    const files = walkDir(join(ROOT, 'js'));
    /** @type {string[]} */
    const violations = [];
    for (const path of files) {
      const raw = readFileSync(path, 'utf8');
      const stripped = raw
        .replace(/\/\*[\s\S]*?\*\//g, '') // block + JSDoc comments
        .replace(/^\s*\/\/.*$/gm, '');    // line comments
      const m = stripped.match(forbidden);
      if (m) {
        violations.push(`${path}: matched '${m[0]}'`);
      }
    }
    assert.deepEqual(violations, [], `SEED-05: no xlsx/txt parser allowed in js/. Violations:\n${violations.join('\n')}`);
  });
});
