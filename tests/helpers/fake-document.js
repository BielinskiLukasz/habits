/**
 * @file Fake document emitting `visibilitychange` + `pagehide` (D-25, DATA-08)
 * + fake window with `hashchange` + `location.hash` (Phase 03 plan 02 Task 1).
 *
 * Used by `tests/unit/lifecycle.test.js` (Phase 2 plan 04) to verify that
 * `js/platform/lifecycle.js` listens for `visibilitychange === 'hidden'` and
 * does NOT register `beforeunload` (per Anti-Pattern + Pitfall 8 / MDN).
 *
 * Used by `tests/unit/router.test.js` (Phase 3 plan 02 Task 1) to verify
 * that `js/router.js` registers a single `hashchange` listener, resolves
 * the initial route from `location.hash`, and dispatches route changes
 * idempotently (D-60, D-80).
 *
 * Mirrors the relevant subset of `document` used by `bootLifecycle()`:
 * `visibilityState`, `addEventListener`, `removeEventListener`,
 * `dispatchEvent`. Helpers `_setVisibility(state)` (mutate + emit) and
 * `_emit(type)` (raw emit) drive the listener registry from tests.
 *
 * `createFakeWindow({hash})` exposes a `_listeners` map so the router test
 * can introspect listener count + dispatch hashchange events synchronously.
 */

/**
 * @param {'visible'|'hidden'} [initialVisibility]
 * @returns {{
 *   document: {
 *     visibilityState: string,
 *     addEventListener: (type: string, fn: (e: { type: string }) => void) => void,
 *     removeEventListener: (type: string, fn: (e: { type: string }) => void) => void,
 *     dispatchEvent: (event: { type: string }) => boolean,
 *   },
 *   _setVisibility: (state: 'visible'|'hidden') => void,
 *   _emit: (type: string) => void,
 * }}
 */
export function createFakeDocument(initialVisibility = 'visible') {
  let visibilityState = initialVisibility;
  /** @type {Map<string, Set<(e: { type: string }) => void>>} */
  const listeners = new Map();

  const document = {
    get visibilityState() { return visibilityState; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (set) {
        for (const fn of set) fn(event);
      }
      return true;
    },
  };

  return {
    document,
    _setVisibility(state) {
      visibilityState = state;
      document.dispatchEvent({ type: 'visibilitychange' });
    },
    _emit(type) {
      document.dispatchEvent({ type });
    },
  };
}

/**
 * Tiny fake window emitting `hashchange` events. Mirrors the subset of
 * `window` consumed by `js/router.js`:
 *   - `location.hash` (read + write)
 *   - `addEventListener(type, fn)` / `removeEventListener(type, fn)`
 *
 * Tests mutate `win.location.hash` directly, then dispatch a fake
 * `hashchange` event via the `_listeners` map. `_listeners.get('hashchange')`
 * is the live Set so tests can assert listener count (idempotency).
 *
 * @param {{ hash?: string }} [opts]
 * @returns {{
 *   location: { hash: string },
 *   addEventListener: (type: string, fn: (e: { type: string }) => void) => void,
 *   removeEventListener: (type: string, fn: (e: { type: string }) => void) => void,
 *   _listeners: Map<string, Set<(e: { type: string }) => void>>,
 *   _dispatch: (type: string) => void,
 * }}
 */
export function createFakeWindow({ hash = '' } = {}) {
  /** @type {Map<string, Set<(e: { type: string }) => void>>} */
  const listeners = new Map();

  const win = {
    location: { hash },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    _listeners: listeners,
    _dispatch(type) {
      const set = listeners.get(type);
      if (set) {
        for (const fn of set) fn({ type });
      }
    },
  };

  return win;
}
