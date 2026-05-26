/**
 * @file Integration tests for `js/state/undo.js` — persistent undo via
 * `meta.undoToken` (D-43, UNDO-02).
 *
 * Three concerns covered:
 *
 *   1. Round-trip: `apply(markCompleted)` → `undo()` deletes the log row,
 *      dispatching the inverse through `apply()` so a NEW undoToken is
 *      written for the restore event.
 *   2. Survives simulated reload: a fresh module instance reading the SAME
 *      fake repo's `meta.undoToken` is sufficient — no in-memory stack
 *      needed (Assumption A9 confirmed).
 *   3. Graceful no-op: returns `null` when no undoToken exists OR when the
 *      undoToken is explicitly null (a non-undoable event in P3+).
 *
 * Fakes: createFakeRepo + a no-op broadcast + a no-op trackTx. Both apply.js
 * and undo.js take their repo via configure({...}) per Open Question 2.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fresh import of both modules so apply.js and undo.js module-level state
 * starts clean per test. They share their repo via shared configure().
 */
async function freshApplyAndUndo() {
  const applyUrl = new URL('../../js/state/apply.js', import.meta.url);
  const undoUrl = new URL('../../js/state/undo.js', import.meta.url);
  const tag = `?t=${Date.now()}-${Math.random()}`;
  applyUrl.search = tag;
  // undo.js imports apply.js — we need them to share the SAME apply module
  // instance, so import undo.js with a matching cache-bust query and let
  // Node resolve them as a pair. We append the same tag to undo.js so its
  // dependency resolution still picks up the cache-busted apply.js URL —
  // BUT node ESM resolves relative imports by their original specifier, so
  // a fresh undo.js (cache-busted) will static-import the cached apply.js
  // unless we bust both URLs with the SAME query (Node treats identical
  // query strings as the same module).
  undoUrl.search = tag;
  const [applyMod, undoMod] = await Promise.all([
    import(applyUrl.href),
    import(undoUrl.href),
  ]);
  return { applyMod, undoMod };
}

describe('undo: round-trip via meta.undoToken (D-43, UNDO-02)', () => {
  test('apply(markCompleted) → undo() removes log row + updates undoToken', async () => {
    const repo = createFakeRepo();
    const { applyMod, undoMod } = await freshApplyAndUndo();
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    undoMod.configureUndo({ repo, apply: applyMod.apply });

    const markId = await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    assert.ok(repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26'])), 'log exists post-mark');

    const undoneId = await undoMod.undo();
    assert.match(undoneId, UUID_V4, 'undo should return the new restore eventId');
    assert.notEqual(undoneId, markId);

    // Log row removed (prior was undefined → restoreLogRow → delete).
    assert.equal(
      repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26'])),
      undefined,
    );

    // meta.undoToken now points at the restore event, not the original mark.
    const token = await repo.getMeta('undoToken');
    assert.equal(token, undoneId);
  });
});

describe('undo: survives simulated reload (UNDO-02, Assumption A9)', () => {
  test('a fresh undo module reading the SAME fake repo undoes correctly', async () => {
    const repo = createFakeRepo();

    // First "session" — write the data.
    {
      const { applyMod } = await freshApplyAndUndo();
      applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
      await applyMod.apply({
        type: 'markCompleted',
        payload: { habitId: 'h2', date: '2026-05-26' },
      });
    }
    // Confirm meta.undoToken persisted in the shared repo.
    const tokenAfterWrite = await repo.getMeta('undoToken');
    assert.match(tokenAfterWrite, UUID_V4, 'undoToken should be persisted');

    // Second "session" — simulate reload: fresh module instances, SAME repo.
    {
      const { applyMod, undoMod } = await freshApplyAndUndo();
      applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
      undoMod.configureUndo({ repo, apply: applyMod.apply });
      const undoneId = await undoMod.undo();
      assert.match(undoneId, UUID_V4);
      // The log row must be gone now.
      assert.equal(
        repo._stores.logs.get(JSON.stringify(['h2', '2026-05-26'])),
        undefined,
      );
    }
  });
});

describe('undo: returns null when no token / null token', () => {
  test('fresh repo with no writes → undo() returns null', async () => {
    const repo = createFakeRepo();
    const { undoMod } = await freshApplyAndUndo();
    undoMod.configureUndo({ repo });
    const result = await undoMod.undo();
    assert.equal(result, null);
  });

  test('explicit meta.undoToken = null → undo() returns null', async () => {
    const repo = createFakeRepo();
    await repo.putMeta('undoToken', null);
    const { undoMod } = await freshApplyAndUndo();
    undoMod.configureUndo({ repo });
    const result = await undoMod.undo();
    assert.equal(result, null);
  });

  test('undoToken points at a missing event → undo() returns null', async () => {
    const repo = createFakeRepo();
    // Token pointing to an event row that does not exist (synthetic edge case).
    await repo.putMeta('undoToken', '00000000-0000-4000-8000-000000000000');
    const { undoMod } = await freshApplyAndUndo();
    undoMod.configureUndo({ repo });
    const result = await undoMod.undo();
    assert.equal(result, null);
  });

  test('event exists but has no inverse → undo() returns null', async () => {
    const repo = createFakeRepo();
    const evtId = '11111111-1111-4111-8111-111111111111';
    await repo.putEvent({ id: evtId, at: '2026-05-26T00:00:00.000Z', type: 'noopEvent', payload: {}, inverse: null });
    await repo.putMeta('undoToken', evtId);
    const { undoMod } = await freshApplyAndUndo();
    undoMod.configureUndo({ repo });
    const result = await undoMod.undo();
    assert.equal(result, null);
  });
});

describe('undo: contract requires configureUndo', () => {
  test('calling undo() before configureUndo throws', async () => {
    const { undoMod } = await freshApplyAndUndo();
    await assert.rejects(undoMod.undo(), /configureUndo/);
  });
});
