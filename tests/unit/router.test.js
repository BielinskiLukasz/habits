/**
 * @file Unit tests for js/router.js — the hash router that dispatches
 * `#today` / `#settings` / `#history` route changes (D-60, D-80).
 *
 * Covers:
 *   - Initial route resolution: empty hash → `#today`
 *   - Initial route resolution: unknown hash → `#today` (allowlist fallback)
 *   - Initial route resolution: known hash (e.g. `#settings`) → that hash
 *   - `hashchange` dispatch: setting `location.hash` + firing event invokes
 *     the new route fn AND `onChange(hash)`
 *   - Idempotency: re-calling `mountRoutes` does NOT register a duplicate
 *     `hashchange` listener
 *   - Same-hash no-op: re-resolving to the current hash does NOT re-invoke
 *     the route function
 *
 * Uses `createFakeWindow` from `tests/helpers/fake-document.js` so the test
 * does not depend on `globalThis.window` (Node test environment).
 *
 * Pattern S7 (fresh-import cache-bust) used so the router's module-level
 * `_mounted` / `_currentHash` state is pristine per test.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeWindow } from '../helpers/fake-document.js';

/** Fresh import per test so router.js module-level state is clean. */
async function freshRouter() {
  const url = new URL('../../js/router.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/**
 * Build a route map with spies that record their invocations.
 *
 * @returns {{
 *   routes: Record<string, () => void>,
 *   calls: { today: number, settings: number, history: number },
 * }}
 */
function makeRoutes() {
  const calls = { today: 0, settings: 0, history: 0 };
  const routes = {
    '#today': () => { calls.today++; },
    '#settings': () => { calls.settings++; },
    '#history': () => { calls.history++; },
  };
  return { routes, calls };
}

describe('mountRoutes — initial route resolution', () => {
  test('empty location.hash resolves to "#today" and invokes the today route', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    assert.equal(calls.today, 1, 'today route invoked exactly once');
    assert.equal(calls.settings, 0);
    assert.equal(calls.history, 0);
    assert.deepEqual(changes, ['#today']);
  });

  test('known hash "#settings" invokes the settings route', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '#settings' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    assert.equal(calls.today, 0);
    assert.equal(calls.settings, 1);
    assert.deepEqual(changes, ['#settings']);
  });

  test('unknown hash "#unknown" falls back to "#today" (allowlist resolution)', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '#unknown' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    assert.equal(calls.today, 1);
    assert.deepEqual(changes, ['#today']);
  });

  test('hash "#history" invokes the history route', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '#history' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    assert.equal(calls.history, 1);
    assert.deepEqual(changes, ['#history']);
  });
});

describe('mountRoutes — hashchange dispatch', () => {
  test('hashchange event after initial mount invokes the new route', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    // Initial dispatch invoked today exactly once.
    assert.equal(calls.today, 1);

    // Simulate the user navigating to #settings.
    win.location.hash = '#settings';
    win._dispatch('hashchange');

    assert.equal(calls.settings, 1);
    assert.deepEqual(changes, ['#today', '#settings']);
  });

  test('hashchange to the SAME hash is a no-op (no double-invoke)', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '#today' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    assert.equal(calls.today, 1);

    // Re-fire hashchange with the same hash — must not re-invoke.
    win._dispatch('hashchange');
    assert.equal(calls.today, 1, 'no re-invocation for same hash');
    assert.deepEqual(changes, ['#today'], 'no duplicate onChange');
  });

  test('hashchange to an unknown hash falls back to "#today"', async () => {
    const { mountRoutes } = await freshRouter();
    const win = createFakeWindow({ hash: '#settings' });
    const { routes, calls } = makeRoutes();
    /** @type {string[]} */
    const changes = [];

    mountRoutes({
      routes,
      onChange: (hash) => changes.push(hash),
      target: win,
    });

    assert.equal(calls.settings, 1);

    // User jumps to a garbage hash — router resolves to #today.
    win.location.hash = '#garbage';
    win._dispatch('hashchange');

    assert.equal(calls.today, 1);
    assert.deepEqual(changes, ['#settings', '#today']);
  });
});

describe('mountRoutes — idempotent re-mount (Pattern S4)', () => {
  test('calling mountRoutes twice does NOT register a duplicate hashchange listener', async () => {
    const { mountRoutes, _resetRouterForTest } = await freshRouter();
    const win = createFakeWindow({ hash: '' });
    const { routes } = makeRoutes();

    mountRoutes({ routes, onChange: () => {}, target: win });
    mountRoutes({ routes, onChange: () => {}, target: win });

    const listeners = win._listeners.get('hashchange');
    assert.ok(listeners, 'hashchange listener registered');
    assert.equal(listeners.size, 1, 'exactly one hashchange listener registered');

    // Sanity: the reset helper exists so other tests can wipe state.
    assert.equal(typeof _resetRouterForTest, 'function');
  });
});

describe('mountRoutes — defaultRoute parameter', () => {
  test('custom defaultRoute "#analytics" falls back for unknown hash', async () => {
    const { mountRoutes, _resetRouterForTest } = await freshRouter();
    const fakeWin = createFakeWindow({ hash: '#unknown-panel' });
    const called = {};
    mountRoutes({
      routes: { '#analytics': () => { called.route = '#analytics'; } },
      onChange: () => {},
      target: fakeWin,
      defaultRoute: '#analytics',
    });
    assert.equal(called.route, '#analytics', 'unknown hash resolves to custom defaultRoute');
    _resetRouterForTest();
  });

  test('no defaultRoute param still falls back to #today (backward compat regression guard)', async () => {
    const { mountRoutes, _resetRouterForTest } = await freshRouter();
    const fakeWin = createFakeWindow({ hash: '#unknown-panel' });
    const called = {};
    mountRoutes({
      routes: { '#today': () => { called.route = '#today'; } },
      onChange: () => {},
      target: fakeWin,
      // no defaultRoute — should default to '#today'
    });
    assert.equal(called.route, '#today', 'no defaultRoute param preserves #today fallback');
    _resetRouterForTest();
  });
});
