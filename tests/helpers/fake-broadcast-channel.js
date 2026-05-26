/**
 * @file In-memory BroadcastChannel fake (D-25, DATA-07).
 *
 * Used by `tests/integration/sync.broadcast.test.js` and any downstream test
 * that exercises `js/platform/sync.js`. The native BroadcastChannel cannot
 * run under `node --test` (only in browser contexts), so this fake mirrors
 * its semantics: messages delivered to OTHER channels with the same name,
 * never to the poster's own channel (per the W3C BroadcastChannel spec).
 *
 * Per RESEARCH §Pattern 5 + Pitfall 8: receivers re-read from IDB; the
 * channel itself only carries keys, not values. The fake doesn't enforce
 * that — the test asserts on the shape of `postMessage`'s argument.
 *
 * Module-level registry is reset by `resetFakeBroadcastChannels()` between
 * tests to avoid cross-test leakage.
 */

/** @type {Map<string, Set<FakeBroadcastChannel>>} */
const registry = new Map();

class FakeBroadcastChannel {
  /** @param {string} name */
  constructor(name) {
    this.name = name;
    /** @type {Set<(e: { data: unknown }) => void>} */
    this._listeners = new Set();
    this._closed = false;
    if (!registry.has(name)) registry.set(name, new Set());
    registry.get(name).add(this);
  }

  /**
   * Deliver `data` to every OTHER channel with the same name (skip self).
   * @param {unknown} data
   */
  postMessage(data) {
    if (this._closed) return;
    const peers = registry.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      if (peer._closed) continue;
      // Real BroadcastChannel dispatches `MessageEvent` with `.data`.
      for (const fn of peer._listeners) fn({ data });
    }
  }

  /**
   * @param {'message'} type
   * @param {(e: { data: unknown }) => void} fn
   */
  addEventListener(type, fn) {
    if (type !== 'message') return;
    this._listeners.add(fn);
  }

  /**
   * @param {'message'} type
   * @param {(e: { data: unknown }) => void} fn
   */
  removeEventListener(type, fn) {
    if (type !== 'message') return;
    this._listeners.delete(fn);
  }

  close() {
    this._closed = true;
    this._listeners.clear();
    const peers = registry.get(this.name);
    if (peers) peers.delete(this);
  }
}

/**
 * Construct a fake channel. Multiple channels with the same name communicate
 * with each other (other-instance delivery only — never self).
 *
 * @param {string} name
 * @returns {FakeBroadcastChannel}
 */
export function createFakeBroadcastChannel(name) {
  return new FakeBroadcastChannel(name);
}

/** Clear the module-level registry. Call this in test setup/teardown. */
export function resetFakeBroadcastChannels() {
  registry.clear();
}
