/**
 * @file Seed file shape tests — `seed/habits.json` shape contract (SEED-01, SEED-02, SEED-05).
 *
 * Three discrete responsibilities:
 *
 *   1. **Top-level shape (SEED-01, RESEARCH §Open Question 3 RESOLVED)** —
 *      seed file parses as `{schemaVersion: 1, seedVersion: 1, habits: [...]}`.
 *      The wrapped-object shape is locked so future fields (e.g. `wavesMeta`)
 *      ride on the same top-level without breaking the loader.
 *
 *   2. **8-habit D-32 coverage matrix (SEED-02, D-32)** — exact distribution
 *      across cadence × log-shape combos. Spans Wave 1 + Wave 2 + Wave 3.
 *      Every habit has a v4 UUID `id`, English `name`, Polish `name_pl` (D-40),
 *      `cadence.cadence_v: 1` (Pitfall 12 — forward-compat versioning).
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

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  test('top-level shape is {schemaVersion: 1, seedVersion: 1, habits: [...]}', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    assert.equal(seed.schemaVersion, 1, 'schemaVersion must equal 1');
    assert.equal(seed.seedVersion, 1, 'seedVersion must equal 1');
    assert.ok(Array.isArray(seed.habits), 'seed.habits must be an array');
  });
});

describe('seed: 8 habits covering D-32 matrix (SEED-02)', () => {
  test('seed.habits.length === 8', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    assert.equal(seed.habits.length, 8, `expected exactly 8 habits, got ${seed.habits.length}`);
  });

  test('every habit has v4 UUID id, name, name_pl, wave 1-3, cadence_v:1, valid logShape', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const validShapes = new Set(['binary', 'numeric', 'slot-checklist']);
    for (const h of seed.habits) {
      assert.match(h.id, UUID_V4, `habit ${h.name}: id must be a v4 UUID; got ${h.id}`);
      assert.equal(typeof h.name, 'string', `habit ${h.id}: name must be a string`);
      assert.ok(h.name.length > 0, `habit ${h.id}: name must be non-empty`);
      const pl = h.name_pl;
      assert.ok(
        pl === null || (typeof pl === 'string' && pl.length > 0),
        `habit ${h.id}: name_pl must be a non-empty string or null (D-40); got ${JSON.stringify(pl)}`,
      );
      assert.equal(typeof h.wave, 'number', `habit ${h.id}: wave must be a number`);
      assert.ok(Number.isInteger(h.wave), `habit ${h.id}: wave must be an integer`);
      assert.ok(h.wave >= 1 && h.wave <= 3, `habit ${h.id}: wave must be in [1, 3] (D-32); got ${h.wave}`);
      assert.ok(h.cadence && typeof h.cadence === 'object', `habit ${h.id}: cadence must be an object`);
      assert.equal(h.cadence.cadence_v, 1, `habit ${h.id}: cadence.cadence_v must be 1 (Pitfall 12)`);
      assert.ok(
        validShapes.has(h.logShape),
        `habit ${h.id}: logShape must be one of binary|numeric|slot-checklist; got ${h.logShape}`,
      );
    }
  });

  test('all habit ids are unique', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const ids = seed.habits.map((h) => h.id);
    const uniq = new Set(ids);
    assert.equal(uniq.size, ids.length, `habit ids must be unique; got ${ids.length} habits but ${uniq.size} unique ids`);
  });

  test('distribution: exactly 2 habits with cadence.type=daily + logShape=binary', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter((h) => h.cadence.type === 'daily' && h.logShape === 'binary');
    assert.equal(matches.length, 2, `D-32: expected 2 daily-binary habits; got ${matches.length}`);
  });

  test('distribution: exactly 1 habit with cadence.type=weekly + logShape=binary', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter((h) => h.cadence.type === 'weekly' && h.logShape === 'binary');
    assert.equal(matches.length, 1, `D-32: expected 1 weekly-binary habit; got ${matches.length}`);
  });

  test('distribution: exactly 1 habit with cadence.type=every-n-days (n=2) + logShape=binary', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter(
      (h) => h.cadence.type === 'every-n-days' && h.cadence.n === 2 && h.logShape === 'binary',
    );
    assert.equal(matches.length, 1, `D-32: expected 1 every-2-days binary habit; got ${matches.length}`);
  });

  test('distribution: exactly 1 habit with cadence.type=day-of-week-subset + logShape=binary', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter(
      (h) => h.cadence.type === 'day-of-week-subset' && h.logShape === 'binary',
    );
    assert.equal(matches.length, 1, `D-32: expected 1 day-of-week-subset binary habit; got ${matches.length}`);
    assert.ok(Array.isArray(matches[0].cadence.days), 'day-of-week-subset must carry a days[] array');
    assert.ok(matches[0].cadence.days.length > 0, 'day-of-week-subset must have at least one day');
  });

  test('distribution: exactly 1 habit with logShape=numeric (carrying target)', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter((h) => h.logShape === 'numeric');
    assert.equal(matches.length, 1, `D-32: expected 1 numeric habit; got ${matches.length}`);
    assert.equal(typeof matches[0].target, 'number', 'numeric habit must carry a `target` field');
    assert.ok(matches[0].target > 0, 'numeric `target` must be > 0');
  });

  test('distribution: exactly 1 habit with logShape=slot-checklist + slots.kind=anonymous', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter(
      (h) => h.logShape === 'slot-checklist' && h.slots && h.slots.kind === 'anonymous',
    );
    assert.equal(matches.length, 1, `D-32: expected 1 anonymous slot-checklist habit; got ${matches.length}`);
    assert.equal(typeof matches[0].slots.count, 'number', 'anonymous slots must carry a `count` field');
  });

  test('distribution: exactly 1 habit with logShape=slot-checklist + slots.kind=labeled', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const matches = seed.habits.filter(
      (h) => h.logShape === 'slot-checklist' && h.slots && h.slots.kind === 'labeled',
    );
    assert.equal(matches.length, 1, `D-32: expected 1 labeled slot-checklist habit; got ${matches.length}`);
    assert.ok(
      Array.isArray(matches[0].slots.labels) && matches[0].slots.labels.length > 0,
      'labeled slots must carry a non-empty labels[] string array',
    );
    for (const lbl of matches[0].slots.labels) {
      assert.equal(typeof lbl, 'string', 'every slot label must be a string');
    }
  });

  test('waves cover {1, 2, 3} — at least one habit per wave (D-32)', async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
    const waves = new Set(seed.habits.map((h) => h.wave));
    assert.ok(waves.has(1), 'D-32: at least one habit must be in Wave 1');
    assert.ok(waves.has(2), 'D-32: at least one habit must be in Wave 2');
    assert.ok(waves.has(3), 'D-32: at least one habit must be in Wave 3');
  });
});

describe('seed: no xlsx/txt parser in js/ (SEED-05)', () => {
  test('zero matches for xlsx|XLSX|SheetJS|exceljs|read_xlsx|parse_xlsx in any js/**/*.js', () => {
    const forbidden = /xlsx|XLSX|SheetJS|exceljs|read_xlsx|parse_xlsx/;
    const files = walkDir(join(ROOT, 'js'));
    /** @type {string[]} */
    const violations = [];
    for (const path of files) {
      const src = readFileSync(path, 'utf8');
      const m = src.match(forbidden);
      if (m) {
        violations.push(`${path}: matched '${m[0]}'`);
      }
    }
    assert.deepEqual(violations, [], `SEED-05: no xlsx/txt parser allowed in js/. Violations:\n${violations.join('\n')}`);
  });
});
