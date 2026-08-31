/**
 * @file Contract test for D-52 — the denormalized `habit.lastCompletedDate`
 * invariant maintained inside the SAME tx as every log write.
 *
 * The invariant under test (the load-bearing data contract of Phase 03):
 *
 *   After any `apply({type: 'markCompleted'|'markUncompleted', payload: {habitId, date}})`,
 *   `habit.lastCompletedDate` equals the YYYY-MM-DD of the most recent
 *   `completed: true` log for that habit, or null when no completed log exists.
 *
 * Failure of this invariant silently corrupts every-N-days cadence math
 * (D-50 — the resolver reads `habit.lastCompletedDate` instead of querying
 * the logs store to honor NFR-01 cold-paint budget).
 *
 * Pattern S7 fresh-import cache-bust.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

async function freshApply() {
  const url = new URL('../../js/state/apply.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

describe('D-52 — habit.lastCompletedDate after markCompleted', () => {
  test('first markCompleted sets lastCompletedDate to that date', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const h = repo._stores.habits.get('h1');
    assert.equal(h.lastCompletedDate, '2026-05-26');
  });

  test('second markCompleted on a later date advances lastCompletedDate to the later date', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-28' },
    });

    const h = repo._stores.habits.get('h1');
    assert.equal(h.lastCompletedDate, '2026-05-28');
  });

  test('out-of-order writes — max date wins, not insertion order', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-25' },
    });
    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const h = repo._stores.habits.get('h1');
    assert.equal(h.lastCompletedDate, '2026-05-26', 'max wins');
  });
});

describe('D-52 — habit.lastCompletedDate after markUncompleted', () => {
  test('uncomplete the most recent → lastCompletedDate falls back to the second-most-recent completed log', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-28' },
    });
    await apply.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-28' },
    });

    const h = repo._stores.habits.get('h1');
    assert.equal(
      h.lastCompletedDate,
      '2026-05-26',
      'lastCompletedDate is the most recent remaining completed log',
    );
  });

  test('uncomplete the last remaining → lastCompletedDate is null', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    await apply.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const h = repo._stores.habits.get('h1');
    assert.equal(h.lastCompletedDate, null);
  });

  test('uncomplete one of two → still has the other completed log as anchor', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-25' },
    });
    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-28' },
    });
    await apply.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-25' },
    });

    const h = repo._stores.habits.get('h1');
    assert.equal(
      h.lastCompletedDate,
      '2026-05-28',
      'unmarking an older log leaves the newer one as the anchor',
    );
  });
});

describe('D-52 — defensive: missing habit row does not throw', () => {
  test('markCompleted against a habit that does NOT exist in the habits store still writes the log row', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });
    // NO putHabit() — synthetic edge case for D-52 fallback.

    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'ghost', date: '2026-05-26' },
    });

    // Log row written.
    const log = repo._stores.logs.get(JSON.stringify(['ghost', '2026-05-26']));
    assert.ok(log, 'log row written even when habit is missing');
    assert.equal(log.status, 'completed');
    // No habit row created.
    assert.equal(repo._stores.habits.get('ghost'), undefined, 'no habit row synthesized');
  });
});
