/**
 * @file Integration tests for `apply({type: 'setSetting'})` (D-75).
 *
 * The `setSetting` handler routes Settings writes through the chokepoint so
 * `weekStart` (and any future settings writes) get the same atomicity,
 * cross-tab broadcast, lifecycle flush, and undo semantics as data mutations.
 *
 * Contract covered:
 *
 *   1. Write semantics — the settings row `{key, value}` is put into the
 *      `settings` store via the chokepoint (no direct repo.putSetting).
 *   2. Inverse capture — `inverse.payload.value` equals the prior row's value
 *      at write-time (or `undefined` when the key was never written).
 *   3. Undo round-trip — `undo()` writes a new settings row carrying the prior
 *      value, restoring the original setting.
 *   4. Broadcast shape — the envelope's `keys` is `{key}` only; the value is
 *      NEVER on the wire (Pitfall 8 — peer tabs re-read from IDB).
 *   5. HANDLERS table — `js/state/apply.js` source contains the literal
 *      `setSetting: handleSetSetting` entry (Anti-Pattern 4 — no switch).
 *
 * Pattern S7 paired-cache-bust: apply.js + undo.js share the same query
 * tag so undo.js's static `import { apply }` resolves to the same module
 * instance the test inspects.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Pattern S7 paired-cache-bust — apply.js + undo.js share the SAME query tag
 * so undo.js's static `import { apply }` resolves to the same module instance
 * the test inspects.
 */
async function freshApplyAndUndo() {
  const applyUrl = new URL('../../js/state/apply.js', import.meta.url);
  const undoUrl = new URL('../../js/state/undo.js', import.meta.url);
  const tag = `?t=${Date.now()}-${Math.random()}`;
  applyUrl.search = tag;
  undoUrl.search = tag;
  const [applyMod, undoMod] = await Promise.all([
    import(applyUrl.href),
    import(undoUrl.href),
  ]);
  return { applyMod, undoMod };
}

describe('apply(setSetting) — writes settings row through chokepoint (D-75)', () => {
  test('writes {key, value} to the settings store', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await applyMod.apply({
      type: 'setSetting',
      payload: { key: 'weekStart', value: 'sun' },
    });
    assert.match(eventId, UUID_V4);

    const row = repo._stores.settings.get('weekStart');
    assert.ok(row, 'settings row exists');
    assert.deepEqual(row, { key: 'weekStart', value: 'sun' });
  });
});

describe('apply(setSetting) — captures prior value in inverse (D-43)', () => {
  test('inverse payload.value equals the prior settings row value', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Pre-seed `weekStart` to 'mon'.
    await repo.putSetting({ key: 'weekStart', value: 'mon' });

    const eventId = await applyMod.apply({
      type: 'setSetting',
      payload: { key: 'weekStart', value: 'sun' },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'event row exists');
    assert.equal(evt.type, 'setSetting');
    assert.equal(evt.inverse.type, 'setSetting');
    assert.equal(evt.inverse.payload.key, 'weekStart');
    assert.equal(evt.inverse.payload.value, 'mon', 'inverse value = prior value');
  });

  test('first-ever write captures undefined in inverse payload value', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // No pre-seed.
    const eventId = await applyMod.apply({
      type: 'setSetting',
      payload: { key: 'weekStart', value: 'sun' },
    });
    const evt = repo._stores.events.get(eventId);
    assert.equal(evt.inverse.payload.key, 'weekStart');
    assert.equal(
      evt.inverse.payload.value,
      undefined,
      'no prior row → inverse value is undefined',
    );
  });
});

describe('apply(setSetting) — undo round-trip restores prior value', () => {
  test('undo() after setSetting writes a new row with the prior value', async () => {
    const repo = createFakeRepo();
    const { applyMod, undoMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    undoMod.configureUndo({ repo, apply: applyMod.apply });

    // Pre-seed 'mon'.
    await repo.putSetting({ key: 'weekStart', value: 'mon' });

    await applyMod.apply({
      type: 'setSetting',
      payload: { key: 'weekStart', value: 'sun' },
    });
    assert.equal(repo._stores.settings.get('weekStart').value, 'sun');

    const undoneId = await undoMod.undo();
    assert.match(undoneId, UUID_V4);
    assert.equal(
      repo._stores.settings.get('weekStart').value,
      'mon',
      'undo restored prior value',
    );
  });
});

describe('apply(setSetting) — broadcast envelope contains key only (Pitfall 8)', () => {
  test('keys is {key} — value is NEVER on the wire', async () => {
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({
      repo,
      broadcast: (msg) => broadcasts.push(msg),
      trackTx: () => {},
    });

    await applyMod.apply({
      type: 'setSetting',
      payload: { key: 'weekStart', value: 'sun' },
    });

    assert.equal(broadcasts.length, 1);
    const msg = broadcasts[0];
    assert.equal(msg.type, 'mutation');
    assert.equal(msg.event, 'setSetting');
    assert.deepEqual(msg.keys, { key: 'weekStart' }, 'keys is {key} only');
    // Value MUST NOT leak into the envelope.
    assert.equal('value' in msg.keys, false, 'value not in keys');
    assert.equal('value' in msg, false, 'value not on envelope');
    assert.equal(typeof msg.at, 'string');
  });
});

describe('apply.js — HANDLERS table includes setSetting (Anti-Pattern 4)', () => {
  test('source contains literal `setSetting: handleSetSetting`', () => {
    const path = fileURLToPath(new URL('../../js/state/apply.js', import.meta.url));
    const src = readFileSync(path, 'utf8');
    assert.ok(
      src.includes('setSetting: handleSetSetting'),
      'apply.js HANDLERS table must register setSetting → handleSetSetting',
    );
  });
});
