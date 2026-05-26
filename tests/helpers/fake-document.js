/**
 * @file Fake document emitting `visibilitychange` + `pagehide` (D-25, DATA-08).
 *
 * Used by `tests/unit/lifecycle.test.js` (Phase 2 plan 04) to verify that
 * `js/platform/lifecycle.js` listens for `visibilitychange === 'hidden'` and
 * does NOT register `beforeunload` (per Anti-Pattern + Pitfall 8 / MDN).
 *
 * Mirrors the relevant subset of `document` used by `bootLifecycle()`:
 * `visibilityState`, `addEventListener`, `removeEventListener`,
 * `dispatchEvent`. Helpers `_setVisibility(state)` (mutate + emit) and
 * `_emit(type)` (raw emit) drive the listener registry from tests.
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
