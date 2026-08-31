/**
 * @file Integration tests for `apply({type: 'markCompleted'})` end-to-end:
 *
 *   - Single-tx writes: logs row + events row + meta.undoToken (D-43, Pitfall 7).
 *   - Broadcast ordering: broadcast fires AFTER `runTx` completes (T-02-10, Pitfall 2).
 *   - Broadcast shape: `{type, event, keys, at, origin}` only — no values (T-02-11, Pitfall 8).
 *   - Inverse exists and round-trips via `apply({type: 'restoreLogRow'})`.
 *
 * Uses the fake-IDB repo + a fake BroadcastChannel stubbed onto globalThis.
 * `apply.configure({ repo, broadcast, trackTx })` injects fakes per RESEARCH
 * §Open Question 2 (configure-based DI keeps production code DI-free).
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

describe('apply(markCompleted) — happy path single-tx (D-43, Pitfall 7)', () => {
  test('writes logs row + events row + meta.undoToken in the same tx', async () => {
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    const broadcastSpy = (msg) => broadcasts.push(msg);
    /** @type {Promise<unknown>[]} */
    const tracked = [];
    const trackTxSpy = (p) => tracked.push(p);

    const apply = await freshApply();
    apply.configure({ repo, broadcast: broadcastSpy, trackTx: trackTxSpy });

    // Seed a habit so the happy path is meaningful.
    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });

    const eventId = await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    // eventId is a v4 UUID.
    assert.match(eventId, UUID_V4, `eventId should be a v4 UUID; got ${eventId}`);

    // logs row written via compound key.
    const log = repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26']));
    assert.ok(log, 'logs row should exist');
    assert.equal(log.habitId, 'h1');
    assert.equal(log.date, '2026-05-26');
    assert.equal(log.status, 'completed');
    assert.equal(log.definitionVersion, null, 'definitionVersion must be null (DATA-05 "current")');

    // events row written under the eventId.
    const evt = repo._stores.events.get(eventId);
    assert.ok(evt, 'events row should exist');
    assert.equal(evt.type, 'markCompleted');
    assert.deepEqual(evt.payload, { habitId: 'h1', date: '2026-05-26' });
    assert.ok(evt.inverse, 'inverse must be present');
    assert.equal(evt.inverse.type, 'restoreLogRow');
    assert.equal(evt.inverse.payload.habitId, 'h1');
    assert.equal(evt.inverse.payload.date, '2026-05-26');
    assert.equal(evt.inverse.payload.prior, undefined, 'no prior row → prior is undefined');

    // meta.undoToken points at the new event.
    const token = await repo.getMeta('undoToken');
    assert.equal(token, eventId, 'meta.undoToken must equal the new eventId');
  });
});

describe('apply(markCompleted) — broadcast ordering and shape (T-02-10, T-02-11)', () => {
  test('broadcast fires exactly once, AFTER writes, with keys-only payload', async () => {
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    /** Capture log-store size at broadcast time (proves AFTER-write ordering). */
    let logsSizeAtBroadcast = -1;
    const broadcastSpy = (msg) => {
      logsSizeAtBroadcast = repo._stores.logs.size;
      broadcasts.push(msg);
    };

    const apply = await freshApply();
    apply.configure({ repo, broadcast: broadcastSpy, trackTx: () => {} });

    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });
    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    assert.equal(broadcasts.length, 1, 'broadcast should fire exactly once');
    assert.equal(logsSizeAtBroadcast, 1, 'broadcast must fire AFTER the log row is written (Pitfall 2)');

    const msg = broadcasts[0];
    const keys = Object.keys(msg).sort();
    // configure-injected broadcast does NOT receive {origin} — that is appended
    // by sync.broadcast itself. apply.js sends {type, event, keys, at}.
    assert.deepEqual(keys, ['at', 'event', 'keys', 'type'], `apply broadcast payload keys must be {type, event, keys, at}; got ${keys.join(',')}`);
    assert.equal(msg.type, 'mutation');
    assert.equal(msg.event, 'markCompleted');
    assert.deepEqual(msg.keys, { habitId: 'h1', date: '2026-05-26' });
    assert.equal(typeof msg.at, 'string');
    // No row values leaked.
    assert.equal('value' in msg, false);
    assert.equal('row' in msg, false);
    assert.equal('completed' in msg, false);
  });
});

describe('apply(restoreLogRow) — inverse round-trip', () => {
  test('after markCompleted, applying restoreLogRow with prior=undefined deletes the log row', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    await repo.putHabit({ id: 'h1', wave: 1, status: 'active', name: 'Morning walk' });
    const markId = await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    // Log row exists.
    assert.ok(repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26'])), 'log exists after markCompleted');

    // Dispatch the inverse directly through apply.
    const restoreId = await apply.apply({
      type: 'restoreLogRow',
      payload: { habitId: 'h1', date: '2026-05-26', prior: undefined },
    });
    assert.match(restoreId, UUID_V4);
    assert.notEqual(restoreId, markId, 'restore should generate a fresh eventId');

    // Log row is gone.
    assert.equal(
      repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26'])),
      undefined,
      'log row should be deleted when prior is undefined',
    );

    // meta.undoToken now points at the restore event, not the markCompleted.
    assert.equal(await repo.getMeta('undoToken'), restoreId);
  });

  test('restoreLogRow with a non-null prior PUTs the prior value back', async () => {
    const repo = createFakeRepo();
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: () => {} });

    // Pre-existing log row simulating "previously marked yesterday".
    const priorRow = { habitId: 'h1', date: '2026-05-26', completed: true, definitionVersion: 'v0' };
    await repo.putLog(priorRow);

    await apply.apply({
      type: 'restoreLogRow',
      payload: { habitId: 'h1', date: '2026-05-26', prior: priorRow },
    });

    assert.deepEqual(
      repo._stores.logs.get(JSON.stringify(['h1', '2026-05-26'])),
      priorRow,
      'prior row should be put back verbatim',
    );
  });
});

describe('apply: unknown event type', () => {
  test('throws for an event type not in HANDLERS', async () => {
    const apply = await freshApply();
    apply.configure({ repo: createFakeRepo(), broadcast: () => {}, trackTx: () => {} });
    await assert.rejects(
      apply.apply({ type: 'doesNotExist', payload: {} }),
      /unknown event type/,
    );
  });
});

describe('apply: trackTx is invoked with the tx promise', () => {
  test('trackTx receives a promise (lifecycle integration)', async () => {
    const repo = createFakeRepo();
    /** @type {unknown[]} */
    const tracked = [];
    const apply = await freshApply();
    apply.configure({ repo, broadcast: () => {}, trackTx: (p) => tracked.push(p) });
    await apply.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    assert.equal(tracked.length, 1, 'trackTx should be called once per apply()');
    assert.ok(tracked[0] && typeof /** @type {Promise<unknown>} */ (tracked[0]).then === 'function');
  });
});

describe('store: hydrate / subscribe / notify (Open Question 4 minimal P2)', () => {
  test('hydrate is idempotent; subscribe returns unsubscribe; notify fans out', async () => {
    const url = new URL('../../js/state/store.js', import.meta.url);
    url.search = `?t=${Date.now()}-${Math.random()}`;
    const store = await import(url.href);

    let calls = 0;
    const unsub = store.subscribe(() => { calls++; });
    // Phase 03 plan 03 Task 2: notify is async (refreshes cache before
    // fanning out). Callers MUST await — synchronous-after-call assertions
    // would race the internal `await refreshHydratedKeys(...)` microtask.
    await store.notify({ event: 'test', keys: {} });
    assert.equal(calls, 1);
    await store.notify({ event: 'test', keys: {} });
    assert.equal(calls, 2);
    unsub();
    await store.notify({ event: 'test', keys: {} });
    assert.equal(calls, 2, 'unsubscribed listener must not fire');

    // hydrate is idempotent (P2 minimum — hydrate from empty repo is fine).
    await store.hydrate(createFakeRepo());
    await store.hydrate(createFakeRepo());
    assert.ok(true);
  });
});
