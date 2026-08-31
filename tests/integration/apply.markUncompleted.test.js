/**
 * @file Integration tests for `apply({type: 'markUncompleted'})` (D-74).
 *
 * Covers the four contract points the chokepoint must hold:
 *
 *   1. Write semantics — markUncompleted writes `{completed: false,
 *      definitionVersion: null}`, NOT a delete (D-74 — keep audit log).
 *   2. Inverse capture — `restoreLogRow` payload's `prior` field equals the
 *      log row that existed at write-time (or undefined when no row existed).
 *   3. Broadcast shape — keys-only payload `{habitId, date}` (Pitfall 8).
 *   4. Undo round-trip — `undo()` restores the prior log row verbatim.
 *
 * Pattern S7 paired-cache-bust: `freshApplyAndUndo()` imports apply.js +
 * undo.js with the same query tag so they share module instances.
 *
 * Uses createFakeRepo() for in-process IDB.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Pattern S7 paired-cache-bust import — apply.js + undo.js share the SAME
 * query tag so undo.js's static `import { apply }` resolves to the same
 * cache-busted module instance apply.js itself runs in.
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

describe('apply(markUncompleted) — writes {completed: false} (NOT delete) (D-74)', () => {
  test('after markCompleted → markUncompleted, the log row is {completed: false, definitionVersion: null}', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    // Seed a habit so D-52 invariant can write a habit row.
    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    await applyMod.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const log = repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26']));
    assert.ok(log, 'log row must EXIST after markUncompleted — NOT delete (D-74)');
    assert.equal(log.habitId, 'h1');
    assert.equal(log.date, '2026-05-26');
    assert.equal(log.status, 'failed');
    assert.equal(log.definitionVersion, null, 'definitionVersion must be null (DATA-05 "current")');
  });
});

describe('apply(markUncompleted) — captures prior log row in inverse (D-43)', () => {
  test('inverse payload.prior equals the most recent log row at write-time', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    const uncompleteId = await applyMod.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const evt = repo._stores.events.get(uncompleteId);
    assert.ok(evt, 'event row exists');
    assert.equal(evt.type, 'markUncompleted');
    assert.equal(evt.inverse.type, 'restoreLogRow');
    assert.equal(evt.inverse.payload.habitId, 'h1');
    assert.equal(evt.inverse.payload.date, '2026-05-26');
    assert.deepEqual(
      evt.inverse.payload.prior,
      { habitId: 'h1', date: '2026-05-26', status: 'completed', definitionVersion: null },
      'prior should equal the log row written by the preceding markCompleted',
    );
  });

  test('first-time markUncompleted (no prior log) captures prior=undefined', async () => {
    const repo = createFakeRepo();
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });

    const uncompleteId = await applyMod.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    const evt = repo._stores.events.get(uncompleteId);
    assert.equal(evt.inverse.payload.prior, undefined, 'no prior row → prior is undefined');
  });
});

describe('apply(markUncompleted) — broadcast shape (Pitfall 8)', () => {
  test('broadcast envelope is {type:"mutation", event:"markUncompleted", keys:{habitId, date}, at}', async () => {
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    const { applyMod } = await freshApplyAndUndo();
    applyMod.configure({
      repo,
      broadcast: (msg) => broadcasts.push(msg),
      trackTx: () => {},
    });
    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });

    await applyMod.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    assert.equal(broadcasts.length, 1);
    const msg = broadcasts[0];
    assert.equal(msg.type, 'mutation');
    assert.equal(msg.event, 'markUncompleted');
    assert.deepEqual(msg.keys, { habitId: 'h1', date: '2026-05-26' });
    assert.equal(typeof msg.at, 'string');
    // No row values leaked.
    assert.equal('value' in msg, false);
    assert.equal('completed' in msg, false);
  });
});

describe('apply(markUncompleted) — undo round-trip via restoreLogRow', () => {
  test('markCompleted → markUncompleted → undo() restores prior completed:true row', async () => {
    const repo = createFakeRepo();
    const { applyMod, undoMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    undoMod.configureUndo({ repo, apply: applyMod.apply });
    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    await applyMod.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    const undoneId = await undoMod.undo();
    assert.match(undoneId, UUID_V4);

    // Log row was restored to the prior {completed: true} state.
    const log = repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26']));
    assert.deepEqual(
      log,
      { habitId: 'h1', date: '2026-05-26', status: 'completed', definitionVersion: null },
      'undo of markUncompleted restores the prior completed:true row',
    );
  });
});
