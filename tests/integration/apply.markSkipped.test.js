/**
 * @file Integration tests for `apply({type: 'markSkipped'})` end-to-end.
 *
 * Covers:
 *   a) Happy path — writes `{ status: 'skipped', definitionVersion: null }` row.
 *   b) Does NOT update `lastCompletedDate` (D-52 not triggered — skipping is neutral).
 *   c) Inverse shape — `restoreLogRow` with prior state locked at write-time (D-43).
 *   d) Broadcast keys — `{ habitId, date }` keys-only payload (Pitfall 8, T-02-11).
 *   e) Undo round-trip — markSkipped → restoreLogRow restores prior state.
 *   f) Defensive — missing habit row does not block the log write (handler is logs-only).
 *
 * Uses fake-IDB repo + fake BroadcastChannel stubbed onto globalThis.
 * `apply.configure({ repo, broadcast, trackTx })` injects fakes per
 * RESEARCH §Open Question 2 (configure-based DI keeps production code DI-free).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import {
  createFakeBroadcastChannel,
  resetFakeBroadcastChannels,
} from '../helpers/fake-broadcast-channel.js';

/** Fresh import per test so apply.js module-level state is clean. */
async function freshApply() {
  const url = new URL('../../js/state/apply.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/** Strict RFC 4122 v4 UUID matcher. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  resetFakeBroadcastChannels();
});

// ---------------------------------------------------------------------------
// a) Happy path — writes status:'skipped' row
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — happy path: writes status:skipped row', () => {
  test('writes log with status:skipped and definitionVersion:null', async () => {
    const repo = createFakeRepo();
    const broadcasts = [];
    const broadcastSpy = (msg) => broadcasts.push(msg);

    const apply = await freshApply();
    apply.configure({ repo, broadcast: broadcastSpy, trackTx: () => {} });

    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk', lastCompletedDate: null });

    const eventId = await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-08-01' },
    });

    assert.match(eventId, UUID_V4, `eventId should be a v4 UUID; got ${eventId}`);

    const log = repo._stores.logs.get(JSON.stringify(['h1', '2026-08-01']));
    assert.ok(log, 'logs row should exist');
    assert.equal(log.habitId, 'h1');
    assert.equal(log.date, '2026-08-01');
    assert.equal(log.status, 'skipped');
    assert.equal(log.definitionVersion, null, 'definitionVersion must be null');
    assert.equal('completed' in log, false, 'no legacy completed field on the row');
  });
});

// ---------------------------------------------------------------------------
// b) Does NOT update lastCompletedDate (D-52 not triggered)
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — D-52: lastCompletedDate not updated', () => {
  test('habit.lastCompletedDate remains null after markSkipped', async () => {
    const repo = createFakeRepo();

    await repo.putHabit({
      id: 'h1',
      wave: 1,
      status: 'active',
      name: 'Morning walk',
      lastCompletedDate: null,
    });

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-08-01' },
    });

    const habit = await repo.getHabit('h1');
    assert.ok(habit, 'habit row should still exist');
    assert.equal(
      habit.lastCompletedDate,
      null,
      'lastCompletedDate must remain null — D-52 must not fire on markSkipped',
    );
  });
});

// ---------------------------------------------------------------------------
// c) Inverse shape — restoreLogRow with prior state locked at write-time
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — inverse shape (D-43, Pitfall 7)', () => {
  test('event.inverse.type is restoreLogRow; prior is undefined when no prior row', async () => {
    const repo = createFakeRepo();

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    const eventId = await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-08-01' },
    });

    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.inverse.type, 'restoreLogRow');
    assert.equal(evt.inverse.payload.habitId, 'h1');
    assert.equal(evt.inverse.payload.date, '2026-08-01');
    assert.equal(
      evt.inverse.payload.prior,
      undefined,
      'prior must be undefined when no prior row existed',
    );
  });
});

// ---------------------------------------------------------------------------
// d) Broadcast keys — {habitId, date} (Pitfall 8, T-02-11)
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — broadcast ordering and shape (T-02-10, T-02-11)', () => {
  test('broadcast fires once after writes with keys-only payload', async () => {
    const repo = createFakeRepo();
    const broadcasts = [];
    let logsSizeAtBroadcast = -1;
    const broadcastSpy = (msg) => {
      logsSizeAtBroadcast = repo._stores.logs.size;
      broadcasts.push(msg);
    };

    const apply = await freshApply();
    apply.configure({ repo, broadcast: broadcastSpy, trackTx: () => {} });

    await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-08-01' },
    });

    assert.equal(broadcasts.length, 1, 'broadcast must fire exactly once');
    assert.equal(logsSizeAtBroadcast, 1, 'broadcast must fire AFTER the log row is written (Pitfall 2)');

    const msg = broadcasts[0];
    const keys = Object.keys(msg).sort();
    assert.deepEqual(
      keys,
      ['at', 'event', 'keys', 'type'],
      `broadcast payload keys must be {type, event, keys, at}; got ${keys.join(',')}`,
    );
    assert.equal(msg.type, 'mutation');
    assert.equal(msg.event, 'markSkipped');
    assert.deepEqual(msg.keys, { habitId: 'h1', date: '2026-08-01' });
    assert.equal(typeof msg.at, 'string');
    assert.equal('value' in msg, false);
    assert.equal('row' in msg, false);
  });
});

// ---------------------------------------------------------------------------
// e) Undo round-trip — markSkipped → restoreLogRow restores prior state
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — undo round-trip via restoreLogRow', () => {
  test('markSkipped then restoreLogRow with prior:completed restores the prior row', async () => {
    const repo = createFakeRepo();

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Seed a prior completed row
    const priorRow = { habitId: 'h1', date: '2026-08-01', status: 'completed', definitionVersion: null };
    await repo.putLog(priorRow);

    // markSkipped overwrites with status:skipped
    await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-08-01' },
    });

    const skippedLog = await repo.getLog('h1', '2026-08-01');
    assert.equal(skippedLog.status, 'skipped', 'log should be skipped after markSkipped');

    // Dispatch the inverse — restoreLogRow with prior row
    const restoreId = await apply.apply({
      type: 'restoreLogRow',
      payload: { habitId: 'h1', date: '2026-08-01', prior: priorRow },
    });
    assert.match(restoreId, UUID_V4);

    const restoredLog = await repo.getLog('h1', '2026-08-01');
    assert.deepEqual(
      restoredLog,
      priorRow,
      'log should be restored to the prior completed row',
    );
  });

  test('markSkipped then restoreLogRow with prior:undefined deletes the log row', async () => {
    const repo = createFakeRepo();

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // No prior row — first write
    await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-08-01' },
    });

    assert.ok(await repo.getLog('h1', '2026-08-01'), 'log should exist after markSkipped');

    await apply.apply({
      type: 'restoreLogRow',
      payload: { habitId: 'h1', date: '2026-08-01', prior: undefined },
    });

    assert.equal(
      await repo.getLog('h1', '2026-08-01'),
      undefined,
      'log row should be deleted when restoreLogRow is called with prior:undefined',
    );
  });
});

// ---------------------------------------------------------------------------
// f) Defensive — missing habit row does not block the log write
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — defensive: no habit row required', () => {
  test('succeeds when habit row does not exist in habits store', async () => {
    const repo = createFakeRepo();

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // No habit seeded — handler only writes to logs
    await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'nonexistent-habit', date: '2026-08-01' },
    });

    const log = await repo.getLog('nonexistent-habit', '2026-08-01');
    assert.ok(log, 'log row should be written even without a habit row');
    assert.equal(log.status, 'skipped');

    // Habits store must remain empty — handler must not touch it
    const habit = await repo.getHabit('nonexistent-habit');
    assert.equal(habit, undefined, 'handler must not create a habit row');
  });
});

// ---------------------------------------------------------------------------
// g) D-52 recompute — markSkipped on a previously-completed log must clear
//    lastCompletedDate (stale-boolean bug fix, QA-01)
// ---------------------------------------------------------------------------
describe('apply(markSkipped) — D-52 recompute when overwriting a completed log', () => {
  test('habit.lastCompletedDate is null after skipping the only completed log (fails before fix)', async () => {
    const repo = createFakeRepo();

    // Seed habit with lastCompletedDate pointing to the date we will skip
    await repo.putHabit({
      id: 'h1',
      wave: 1,
      status: 'active',
      name: 'Morning walk',
      lastCompletedDate: '2026-09-01',
    });

    // Seed the completed log for that date — this is what markSkipped overwrites
    await repo.putLog({
      habitId: 'h1',
      date: '2026-09-01',
      status: 'completed',
      definitionVersion: null,
    });

    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Skipping the only completed log must recompute lastCompletedDate → null
    await apply.apply({
      type: 'markSkipped',
      payload: { habitId: 'h1', date: '2026-09-01' },
    });

    const habit = await repo.getHabit('h1');
    assert.ok(habit, 'habit row must still exist after markSkipped');
    assert.equal(
      habit.lastCompletedDate,
      null,
      `lastCompletedDate should be null after skipping the only completed log but got ` +
        `'${habit.lastCompletedDate}' — handleMarkSkipped does not call _recomputeLastCompletedDate (D-52)`,
    );
  });
});
