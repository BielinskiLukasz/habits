/**
 * @file Unit tests for seed/waves.json + js/domain/wave.js (D-56, D-57).
 *
 * Three responsibilities:
 *   1. Shape contract on the seed file (schemaVersion === 1, 10 waves
 *      numbered 0..9, every entry has number/name/startDate).
 *   2. `currentWave(date)` — D-56 highest-numbered wave whose startDate <= date.
 *      Pinned to <specifics>: `currentWave('2026-05-28')` returns Wave 4.
 *   3. `getWave` / `getAllWaves` defensive copy invariant.
 *   4. Malformed-input rejection (schemaVersion mismatch, non-array waves).
 *
 * `bootWaves` takes a fetch-shaped function (configureWave({fetch: ...})),
 * mirroring the seed loader's DI pattern (RESEARCH §Open Question 2).
 *
 * Pattern S8 (D-26 Tier 1) — pure-function fixture tests in Node, no DOM.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  configureWave,
  bootWaves,
  currentWave,
  getWave,
  getAllWaves,
  _resetWavesForTest,
} from '../../js/domain/wave.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WAVES_PATH = `${ROOT}seed/waves.json`;

/**
 * Build a fake fetch returning the provided JSON payload.
 *
 * @param {object} payload
 */
function fakeFetchFor(payload) {
  return async (_url) => ({
    async json() { return payload; },
  });
}

/**
 * Build a fake fetch that reads the actual seed/waves.json from disk so the
 * file-shape tests + currentWave tests share fixture data.
 */
function realSeedFetch() {
  return async (_url) => {
    const text = await readFile(WAVES_PATH, 'utf8');
    return { async json() { return JSON.parse(text); } };
  };
}

beforeEach(() => {
  _resetWavesForTest();
  // Drop any prior configureWave injection.
  configureWave({ fetch: null });
});

describe('seed/waves.json shape', () => {
  test('parses as {schemaVersion: 1, seedVersion: 1, waves: [...]} with 10 entries', async () => {
    const text = await readFile(WAVES_PATH, 'utf8');
    const data = JSON.parse(text);
    assert.equal(data.schemaVersion, 1);
    assert.equal(data.seedVersion, 1);
    assert.ok(Array.isArray(data.waves));
    assert.equal(data.waves.length, 10);
  });

  test('every wave has number (0..9), name "Wave N", and YYYY-MM-DD startDate', async () => {
    const text = await readFile(WAVES_PATH, 'utf8');
    const data = JSON.parse(text);
    const expectedNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const seenNumbers = data.waves.map((w) => w.number).sort((a, b) => a - b);
    assert.deepEqual(seenNumbers, expectedNumbers);
    for (const w of data.waves) {
      assert.equal(w.name, `Wave ${w.number}`);
      assert.match(w.startDate, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('Wave 4 startDate is on/before 2026-05-28 AND Wave 5 startDate is strictly after', async () => {
    const text = await readFile(WAVES_PATH, 'utf8');
    const data = JSON.parse(text);
    const w4 = data.waves.find((w) => w.number === 4);
    const w5 = data.waves.find((w) => w.number === 5);
    assert.ok(w4.startDate <= '2026-05-28', `Wave 4 startDate ${w4.startDate} must be <= 2026-05-28`);
    assert.ok(w5.startDate > '2026-05-28', `Wave 5 startDate ${w5.startDate} must be > 2026-05-28`);
  });
});

describe('currentWave', () => {
  test('returns Wave 4 for 2026-05-28 (per <specifics>)', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    const cw = currentWave('2026-05-28');
    assert.ok(cw, 'currentWave returned null');
    assert.equal(cw.number, 4);
  });

  test('returns null for a date before Wave 0 starts', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    // Wave 0 starts 2025-12-29; the day before is 2025-12-28.
    assert.equal(currentWave('2025-12-28'), null);
  });

  test('returns Wave 0 on the exact Wave 0 startDate (2025-12-29)', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    const cw = currentWave('2025-12-29');
    assert.ok(cw, 'currentWave returned null');
    assert.equal(cw.number, 0);
  });

  test('returns Wave 9 for a date on/after Wave 9 startDate', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    // Wave 9 starts 2026-12-28; pick that exact date.
    const cw = currentWave('2026-12-28');
    assert.ok(cw, 'currentWave returned null');
    assert.equal(cw.number, 9);
  });

  test('returns the highest-numbered qualifying wave on a synthetic fixture', async () => {
    const payload = {
      schemaVersion: 1,
      seedVersion: 1,
      waves: [
        { number: 0, name: 'Wave 0', startDate: '2026-01-01' },
        { number: 1, name: 'Wave 1', startDate: '2026-02-01' },
        { number: 2, name: 'Wave 2', startDate: '2026-03-01' },
      ],
    };
    configureWave({ fetch: fakeFetchFor(payload) });
    await bootWaves();
    assert.equal(currentWave('2026-02-15').number, 1);
    assert.equal(currentWave('2026-03-01').number, 2);
    assert.equal(currentWave('2026-04-01').number, 2);
    assert.equal(currentWave('2025-12-31'), null);
  });
});

describe('getWave / getAllWaves', () => {
  test('getWave(4) returns the Wave 4 object', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    const w = getWave(4);
    assert.ok(w);
    assert.equal(w.number, 4);
  });

  test('getWave(99) returns null', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    assert.equal(getWave(99), null);
  });

  test('getAllWaves() returns a defensive copy — mutations do not leak', async () => {
    configureWave({ fetch: realSeedFetch() });
    await bootWaves();
    const a = getAllWaves();
    assert.equal(a.length, 10);
    a.push({ number: 999, name: 'fake', startDate: '2099-01-01' });
    const b = getAllWaves();
    assert.equal(b.length, 10, 'getAllWaves must not return the internal array');
  });
});

describe('malformed input', () => {
  test('throws "wave: malformed" for schemaVersion mismatch', async () => {
    configureWave({ fetch: fakeFetchFor({ schemaVersion: 2, waves: [] }) });
    await assert.rejects(bootWaves(), /wave: malformed/);
  });

  test('throws "wave: malformed" when waves is not an array', async () => {
    configureWave({
      fetch: fakeFetchFor({ schemaVersion: 1, waves: 'not-an-array' }),
    });
    await assert.rejects(bootWaves(), /wave: malformed/);
  });
});
