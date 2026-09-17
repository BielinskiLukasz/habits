/**
 * @file Integration tests for `bootSeed()` + `navigator.storage.persist()`
 * (DATA-03, D-41, Pitfall 3, Pitfall 11).
 *
 * Three invariants:
 *
 *   1. **First boot calls `persist()` exactly once (DATA-03, D-41).**
 *      The seed-load tx is the "first write" per DATA-03; `persist()` fires
 *      immediately afterward. `meta.persistResult` records the outcome so
 *      diagnostics can surface persistence status.
 *
 *   2. **Second boot does NOT re-call `persist()` (Pitfall 11).**
 *      Without the gate, each boot probes `navigator.storage.persist()` —
 *      that fires the browser prompt every launch (UX disaster). `meta.persistResult`
 *      being present is the gate that suppresses the re-probe.
 *
 *   3. **`persist()` returning false is NON-fatal (Pitfall 3).**
 *      Chrome treats first-launch sites with no engagement as `false`
 *      regardless of user input; treating false as denial would crash the
 *      boot path. `bootSeed()` must complete without throwing and record
 *      `meta.persistResult = false`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { createFakeStorage } from '../helpers/fake-storage.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEED_PATH = join(ROOT, 'seed', 'habits.json');

/** Fresh `seed.js` module per test so module-level state is clean. */
async function freshSeed() {
  const url = new URL('../../js/io/seed.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/**
 * Build a fetch stub that returns `seed/habits.json` from disk for the
 * canonical URL and throws for everything else.
 *
 * @returns {(url: string) => Promise<{ json: () => Promise<object> }>}
 */
function makeFetchStub() {
  return async function fetchStub(url) {
    if (url !== './seed/habits.json') {
      throw new Error(`fetch stub: unexpected URL ${url}`);
    }
    const body = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
    return {
      async json() { return body; },
    };
  };
}

describe('bootSeed: navigator.storage.persist() called exactly once on first run (DATA-03)', () => {
  test('first boot triggers persist() and records meta.persistResult', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage(); // persistResult: true by default
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();

    assert.equal(fakeStorage._persistCalls, 1, 'persist() must be called exactly once on first boot');

    const persistRow = repo._stores.meta.get('persistResult');
    assert.ok(persistRow, 'meta.persistResult must be written after the persist() call (Pitfall 11)');
    assert.equal(persistRow.value, true, 'persistResult.value must record the true returned by storage.persist()');
  });
});

describe('bootSeed: second run does NOT re-call persist (Pitfall 11, T-02-PERSIST11)', () => {
  test('after first boot writes meta.persistResult, a second boot skips persist()', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage();
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    await seedMod.bootSeed();
    assert.equal(fakeStorage._persistCalls, 1, 'sanity check: first boot calls persist once');

    // Reset spy counter; second boot must NOT call again.
    fakeStorage._persistCalls = 0;
    await seedMod.bootSeed();

    assert.equal(
      fakeStorage._persistCalls,
      0,
      'Pitfall 11: second boot must NOT call persist() — meta.persistResult is the gate',
    );
  });
});

describe('bootSeed: persist() returning false is non-fatal (Pitfall 3)', () => {
  test('bootSeed completes without throwing and records meta.persistResult = false', async () => {
    const repo = createFakeRepo();
    const fakeStorage = createFakeStorage({ persistResult: false });
    const seedMod = await freshSeed();
    seedMod.configureSeed({ repo, storage: fakeStorage.storage, fetch: makeFetchStub() });

    // Must NOT throw — Pitfall 3 says false is the Chrome engagement-metrics
    // default, not user-denial. Treating false as fatal would crash boot.
    await seedMod.bootSeed();

    assert.equal(fakeStorage._persistCalls, 1, 'persist() still called once even when result is false');

    const persistRow = repo._stores.meta.get('persistResult');
    assert.ok(persistRow, 'meta.persistResult must be written even when persist() returns false');
    assert.equal(persistRow.value, false, 'persistResult.value must record the false outcome');

    // Sanity: the seed itself still completed (0 habits — empty seed fixture,
    // history-seed-null-startdate scope expansion, 2026-09-17).
    assert.equal(repo._stores.habits.size, 0, 'seed insertion is independent of persist() outcome');
  });
});
