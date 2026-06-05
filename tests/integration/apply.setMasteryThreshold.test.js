/**
 * @file Integration tests for `apply({type: 'setMasteryThreshold'})` and
 * `apply({type: 'setMasteryWindow'})` (SETTINGS-01, MASTERY-01, D-86).
 *
 * Both handlers follow the same self-inverting pattern as `setSetting` (D-75).
 *
 * Contract covered:
 *
 *   1. setMasteryThreshold — writes {key:'masteryThreshold', value:N} to the
 *      settings store via the chokepoint (no direct repo.putSetting).
 *   2. setMasteryWindow — writes {key:'masteryWindow', value:N} to the
 *      settings store via the chokepoint.
 *   3. Inverse capture — `inverse.payload.value` equals the prior row's value
 *      at write-time (or `undefined` when the key was never written).
 *   4. Undo round-trip — `undo()` writes a new settings row with the prior
 *      value, restoring the original setting.
 *   5. HANDLERS table — `js/state/apply.js` source contains the literal
 *      `setMasteryThreshold: handleSetMasteryThreshold` and
 *      `setMasteryWindow: handleSetMasteryWindow` entries.
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

// ─── setMasteryThreshold ───────────────────────────────────────────────────

describe('apply(setMasteryThreshold) — writes settings row through chokepoint', () => {
  test('writes {key:"masteryThreshold", value:85} to the settings store', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await applyMod.apply({
      type: 'setMasteryThreshold',
      payload: { value: 85 },
    });
    assert.match(eventId, UUID_V4);

    const row = repo._stores.settings.get('masteryThreshold');
    assert.ok(row, 'settings row exists');
    assert.deepEqual(row, { key: 'masteryThreshold', value: 85 });
  });
});

describe('apply(setMasteryThreshold) — captures prior value in inverse', () => {
  test('inverse payload.value equals the prior settings row value', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Pre-seed masteryThreshold to 90.
    await repo.putSetting({ key: 'masteryThreshold', value: 90 });

    const eventId = await applyMod.apply({
      type: 'setMasteryThreshold',
      payload: { value: 85 },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'event row exists');
    assert.equal(evt.type, 'setMasteryThreshold');
    assert.equal(evt.inverse.type, 'setMasteryThreshold');
    assert.equal(evt.inverse.payload.value, 90, 'inverse value = prior value');
  });

  test('first-ever write captures undefined in inverse payload value', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // No pre-seed.
    const eventId = await applyMod.apply({
      type: 'setMasteryThreshold',
      payload: { value: 85 },
    });
    const evt = repo._stores.events.get(eventId);
    assert.equal(
      evt.inverse.payload.value,
      undefined,
      'no prior row → inverse value is undefined',
    );
  });
});

describe('apply(setMasteryThreshold) — undo round-trip restores prior value', () => {
  test('undo() after setMasteryThreshold writes a new row with the prior value', async () => {
    const repo = createFakeRepo();
    const { applyMod, undoMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    undoMod.configureUndo({ repo, apply: applyMod.apply });

    // Pre-seed 90.
    await repo.putSetting({ key: 'masteryThreshold', value: 90 });

    await applyMod.apply({
      type: 'setMasteryThreshold',
      payload: { value: 85 },
    });
    assert.equal(repo._stores.settings.get('masteryThreshold').value, 85);

    const undoneId = await undoMod.undo();
    assert.match(undoneId, UUID_V4);
    assert.equal(
      repo._stores.settings.get('masteryThreshold').value,
      90,
      'undo restored prior value',
    );
  });
});

describe('apply(setMasteryThreshold) — broadcast envelope contains key only (Pitfall 8)', () => {
  test('keys is {key:"masteryThreshold"} — value is NEVER on the wire', async () => {
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
      type: 'setMasteryThreshold',
      payload: { value: 85 },
    });

    assert.equal(broadcasts.length, 1);
    const msg = broadcasts[0];
    assert.equal(msg.event, 'setMasteryThreshold');
    assert.deepEqual(msg.keys, { key: 'masteryThreshold' }, 'keys is {key} only');
    assert.equal('value' in msg.keys, false, 'value not in keys');
  });
});

// ─── setMasteryWindow ─────────────────────────────────────────────────────

describe('apply(setMasteryWindow) — writes settings row through chokepoint', () => {
  test('writes {key:"masteryWindow", value:60} to the settings store', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await applyMod.apply({
      type: 'setMasteryWindow',
      payload: { value: 60 },
    });
    assert.match(eventId, UUID_V4);

    const row = repo._stores.settings.get('masteryWindow');
    assert.ok(row, 'settings row exists');
    assert.deepEqual(row, { key: 'masteryWindow', value: 60 });
  });
});

describe('apply(setMasteryWindow) — captures prior value in inverse', () => {
  test('inverse payload.value equals the prior settings row value', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Pre-seed masteryWindow to 70.
    await repo.putSetting({ key: 'masteryWindow', value: 70 });

    const eventId = await applyMod.apply({
      type: 'setMasteryWindow',
      payload: { value: 60 },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'event row exists');
    assert.equal(evt.type, 'setMasteryWindow');
    assert.equal(evt.inverse.type, 'setMasteryWindow');
    assert.equal(evt.inverse.payload.value, 70, 'inverse value = prior value');
  });

  test('first-ever write captures undefined in inverse payload value', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await applyMod.apply({
      type: 'setMasteryWindow',
      payload: { value: 60 },
    });
    const evt = repo._stores.events.get(eventId);
    assert.equal(
      evt.inverse.payload.value,
      undefined,
      'no prior row → inverse value is undefined',
    );
  });
});

describe('apply(setMasteryWindow) — undo round-trip restores prior value', () => {
  test('undo() after setMasteryWindow writes a new row with the prior value', async () => {
    const repo = createFakeRepo();
    const { applyMod, undoMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    undoMod.configureUndo({ repo, apply: applyMod.apply });

    // Pre-seed 70.
    await repo.putSetting({ key: 'masteryWindow', value: 70 });

    await applyMod.apply({
      type: 'setMasteryWindow',
      payload: { value: 60 },
    });
    assert.equal(repo._stores.settings.get('masteryWindow').value, 60);

    const undoneId = await undoMod.undo();
    assert.match(undoneId, UUID_V4);
    assert.equal(
      repo._stores.settings.get('masteryWindow').value,
      70,
      'undo restored prior value',
    );
  });
});

// ─── HANDLERS table registration ─────────────────────────────────────────

describe('apply.js — HANDLERS table includes setMasteryThreshold and setMasteryWindow (Anti-Pattern 4)', () => {
  test('source contains literal `setMasteryThreshold: handleSetMasteryThreshold`', () => {
    const path = fileURLToPath(new URL('../../js/state/apply.js', import.meta.url));
    const src = readFileSync(path, 'utf8');
    assert.ok(
      src.includes('setMasteryThreshold: handleSetMasteryThreshold'),
      'apply.js HANDLERS table must register setMasteryThreshold',
    );
  });

  test('source contains literal `setMasteryWindow: handleSetMasteryWindow`', () => {
    const path = fileURLToPath(new URL('../../js/state/apply.js', import.meta.url));
    const src = readFileSync(path, 'utf8');
    assert.ok(
      src.includes('setMasteryWindow: handleSetMasteryWindow'),
      'apply.js HANDLERS table must register setMasteryWindow',
    );
  });
});
