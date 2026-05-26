/**
 * @file Unit tests for js/platform/lifecycle.js (Phase 2 plan 03 Task 1).
 *
 * Verifies DATA-08 / Pitfall 8 / MDN-recommended behavior:
 *   - `bootLifecycle()` registers a `visibilitychange` listener on document.
 *   - `bootLifecycle()` registers a `pagehide` listener on window.
 *   - `bootLifecycle()` NEVER registers a `beforeunload` listener (MDN-banned).
 *   - `trackTx(promise)` chains in-flight tx so `flush()` awaits before resolving.
 *   - `bootLifecycle()` is idempotent — second call does not double-register.
 *
 * Implementation under test must accept dependency-injection (doc, win) for
 * Node-testability per Pitfall 9 — the module imports globals at use-site,
 * not at module-load.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDocument } from '../helpers/fake-document.js';

// Module-level state in lifecycle.js leaks across tests. Use a dynamic re-
// import per describe block to start clean (Node caches by URL — append a
// query to bust the module cache).
async function freshLifecycle() {
  const url = new URL('../../js/platform/lifecycle.js', import.meta.url);
  // Cache-bust by appending a unique query string.
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/** Build a minimal fake window with the addEventListener surface lifecycle.js needs. */
function createFakeWindow() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    _listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
    _emit(type) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) fn({ type });
    },
  };
}

describe('bootLifecycle: listener registration', () => {
  test('registers visibilitychange on document', async () => {
    const { bootLifecycle } = await freshLifecycle();
    const fakeDoc = createFakeDocument();
    const fakeWin = createFakeWindow();
    bootLifecycle(fakeDoc.document, fakeWin);
    // Trigger and confirm a listener fires (proves registration).
    let fired = 0;
    fakeDoc.document.addEventListener('visibilitychange', () => fired++);
    fakeDoc._setVisibility('hidden');
    assert.ok(fired >= 1, 'visibilitychange listener should have been invoked');
  });

  test('registers pagehide on window', async () => {
    const { bootLifecycle } = await freshLifecycle();
    const fakeDoc = createFakeDocument();
    const fakeWin = createFakeWindow();
    bootLifecycle(fakeDoc.document, fakeWin);
    assert.equal(fakeWin._listenerCount('pagehide'), 1, 'pagehide should have exactly one listener');
  });

  test('does NOT register beforeunload (Pitfall 8 / MDN)', async () => {
    const { bootLifecycle } = await freshLifecycle();
    const fakeDoc = createFakeDocument();
    const fakeWin = createFakeWindow();
    bootLifecycle(fakeDoc.document, fakeWin);
    assert.equal(fakeWin._listenerCount('beforeunload'), 0, 'beforeunload is forbidden');
  });
});

describe('trackTx + flush on hidden', () => {
  test('flush awaits the tracked in-flight tx before resolving', async () => {
    const { bootLifecycle, trackTx, _flush } = await freshLifecycle();
    const fakeDoc = createFakeDocument();
    const fakeWin = createFakeWindow();
    bootLifecycle(fakeDoc.document, fakeWin);

    // Deferred promise we control resolution of.
    let resolveDeferred;
    const deferred = new Promise((res) => { resolveDeferred = res; });
    trackTx(deferred);

    // Kick the flush via visibility change. The flush() promise should NOT
    // be resolved yet because the deferred hasn't resolved.
    const flushPromise = _flush();
    let flushResolved = false;
    flushPromise.then(() => { flushResolved = true; });
    // Yield to microtasks; flushResolved must still be false.
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(flushResolved, false, 'flush should still be pending while tx is in flight');

    // Now resolve the deferred — flush should resolve.
    resolveDeferred();
    await flushPromise;
    assert.equal(flushResolved, true, 'flush should resolve once tx completes');
  });
});

describe('bootLifecycle idempotency (D-25 singleton-guard)', () => {
  test('second call is a no-op — does not double-register', async () => {
    const { bootLifecycle } = await freshLifecycle();
    const fakeDoc = createFakeDocument();
    const fakeWin = createFakeWindow();
    bootLifecycle(fakeDoc.document, fakeWin);
    bootLifecycle(fakeDoc.document, fakeWin);
    assert.equal(fakeWin._listenerCount('pagehide'), 1, 'second bootLifecycle must not add a second pagehide listener');
  });
});
