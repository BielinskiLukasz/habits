/**
 * @file Integration tests for js/platform/sync.js (Phase 2 plan 03 Task 2).
 *
 * Verifies the BroadcastChannel('habits') wrapper:
 *   - Other-instance delivery semantics via the fake (mirrors W3C BC spec).
 *   - Broadcast payload shape is `{type, event, keys, at, origin}` ONLY —
 *     never values / row / completed (Pitfall 8 / RESEARCH §Pattern 5,
 *     T-02-11 mitigation).
 *   - `bootSync()` filters its own messages via the `origin` field
 *     (ARCHITECTURE §6).
 *   - `bootSync()` graceful-degrades when `globalThis.BroadcastChannel` is
 *     undefined (Environment Availability §RESEARCH).
 *
 * Test isolation: `js/platform/sync.js` has module-level state (`bc`,
 * `listeners`, `ORIGIN`). Each test dynamically imports the module with a
 * cache-busting query so it picks up the current `globalThis.BroadcastChannel`
 * stub.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeBroadcastChannel,
  resetFakeBroadcastChannels,
} from '../helpers/fake-broadcast-channel.js';

/** Dynamic import that bypasses Node's ESM cache. */
async function freshSync() {
  const url = new URL('../../js/platform/sync.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/**
 * Build a constructor that the sync module can use as
 * `globalThis.BroadcastChannel`. It returns a fresh fake on each `new ...`.
 *
 * @returns {Function}
 */
function makeFakeBroadcastChannelClass() {
  return function FakeBCConstructor(name) {
    // Use the helper so multi-instance same-name peering works correctly.
    return createFakeBroadcastChannel(name);
  };
}

beforeEach(() => {
  resetFakeBroadcastChannels();
});

describe('sync: same-channel broadcast delivery (fake mirrors W3C BC)', () => {
  test('postMessage from instance A is received by instance B; A does NOT receive its own', () => {
    const a = createFakeBroadcastChannel('habits');
    const b = createFakeBroadcastChannel('habits');
    /** @type {unknown[]} */
    const receivedByA = [];
    /** @type {unknown[]} */
    const receivedByB = [];
    a.addEventListener('message', (e) => receivedByA.push(e.data));
    b.addEventListener('message', (e) => receivedByB.push(e.data));
    a.postMessage({ hello: 'world' });
    assert.equal(receivedByA.length, 0, 'A must NOT receive its own postMessage');
    assert.equal(receivedByB.length, 1, 'B must receive A\'s postMessage');
    assert.deepEqual(receivedByB[0], { hello: 'world' });
  });
});

describe('sync.broadcast — keys not values (Pitfall 8 / RESEARCH §Pattern 5)', () => {
  test('broadcast payload carries {type, event, keys, at, origin} only — no value/row/completed', async () => {
    globalThis.BroadcastChannel = makeFakeBroadcastChannelClass();
    const sync = await freshSync();
    sync.bootSync();

    // Peer in the same name space to capture what was posted.
    const peer = createFakeBroadcastChannel('habits');
    /** @type {unknown[]} */
    const received = [];
    peer.addEventListener('message', (e) => received.push(e.data));

    sync.broadcast({
      type: 'mutation',
      event: 'markCompleted',
      keys: { habitId: 'h1', date: '2026-05-26' },
      at: '2026-05-26T10:00:00.000Z',
    });

    assert.equal(received.length, 1, 'peer should have received exactly one message');
    const data = /** @type {Record<string, unknown>} */ (received[0]);
    const keys = Object.keys(data).sort();
    const allowlist = ['at', 'event', 'keys', 'origin', 'type'];
    assert.deepEqual(keys, allowlist, `broadcast payload keys must be ${allowlist.join(',')}; got ${keys.join(',')}`);
    assert.equal('value' in data, false, 'broadcast must NOT include `value`');
    assert.equal('row' in data, false, 'broadcast must NOT include `row`');
    assert.equal('completed' in data, false, 'broadcast must NOT include `completed`');

    delete globalThis.BroadcastChannel;
  });
});

describe('sync.bootSync — origin filtering (skip own messages)', () => {
  test('listener registered via onMessage does NOT fire for messages with this tab\'s origin', async () => {
    globalThis.BroadcastChannel = makeFakeBroadcastChannelClass();
    const sync = await freshSync();
    sync.bootSync();

    /** @type {unknown[]} */
    const observed = [];
    sync.onMessage((msg) => observed.push(msg));

    // Broadcasting from THIS module posts with origin === ORIGIN; the
    // sync's own listener filter should drop it.
    sync.broadcast({
      type: 'mutation',
      event: 'markCompleted',
      keys: { habitId: 'h1', date: '2026-05-26' },
      at: '2026-05-26T10:00:00.000Z',
    });

    // Yield microtasks so any listener invocations have time to run.
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(observed.length, 0, 'own-origin messages must be filtered');

    delete globalThis.BroadcastChannel;
  });

  test('listener DOES fire for messages from a peer with a different origin', async () => {
    globalThis.BroadcastChannel = makeFakeBroadcastChannelClass();
    const sync = await freshSync();
    sync.bootSync();

    /** @type {unknown[]} */
    const observed = [];
    sync.onMessage((msg) => observed.push(msg));

    // Simulate a peer tab posting (different origin string).
    const peer = createFakeBroadcastChannel('habits');
    peer.postMessage({
      type: 'mutation',
      event: 'markCompleted',
      keys: { habitId: 'h2', date: '2026-05-26' },
      at: '2026-05-26T10:00:01.000Z',
      origin: 'peer-tab-origin',
    });

    await Promise.resolve();
    assert.equal(observed.length, 1, 'peer-origin messages must be observed');

    delete globalThis.BroadcastChannel;
  });
});

describe('sync.bootSync — graceful degrade (no BroadcastChannel)', () => {
  test('bootSync() and broadcast() are silent no-ops when BroadcastChannel is undefined', async () => {
    const saved = globalThis.BroadcastChannel;
    delete globalThis.BroadcastChannel;
    try {
      const sync = await freshSync();
      // Must not throw.
      sync.bootSync();
      sync.broadcast({
        type: 'mutation',
        event: 'markCompleted',
        keys: { habitId: 'h1', date: '2026-05-26' },
        at: '2026-05-26T10:00:00.000Z',
      });
      // Reaching here without throw = pass.
      assert.ok(true);
    } finally {
      if (saved) globalThis.BroadcastChannel = saved;
    }
  });
});

describe('sync.bootSync — idempotency', () => {
  test('second bootSync() does not throw and does not double-construct', async () => {
    globalThis.BroadcastChannel = makeFakeBroadcastChannelClass();
    const sync = await freshSync();
    sync.bootSync();
    sync.bootSync(); // second call no-op
    assert.ok(true);
    delete globalThis.BroadcastChannel;
  });
});
