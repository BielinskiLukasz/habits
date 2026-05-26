/**
 * @file BroadcastChannel('habits') wrapper for cross-tab sync (DATA-07, D-30).
 *
 * Single integration point with the BroadcastChannel platform API. Per
 * ARCHITECTURE §6 and RESEARCH §Pattern 5 + Pitfall 8 the only thing posted
 * over the channel is `{type, event, keys, at, origin}` — IDs only, never row
 * values. Receivers re-read from IDB so cache windows are not corrupted by
 * out-of-date stale-value broadcasts (T-02-11 mitigation).
 *
 * Locked decisions implemented here:
 *   - DATA-07: cross-tab pub-sub via BroadcastChannel (not the storage event).
 *   - D-30: channel name is `'habits'`, namespace-aligned with DB_NAME +
 *           cache prefix + manifest name.
 *   - Pitfall 8: payload carries keys, not values; receivers re-read.
 *   - ARCHITECTURE §6: `origin` field filters this tab's own broadcasts so
 *     the round-trip does not echo into our own subscribers (T-02-15 accept).
 *
 * Defense-in-depth (mirrors `js/platform/sw-register.js`):
 *   - Feature-detect `typeof globalThis.BroadcastChannel === 'undefined'` →
 *     `bootSync()` returns silently; `broadcast()` becomes a no-op.
 *   - Idempotent re-entry guard: a second `bootSync()` is a no-op.
 *
 * Forbidden constructs in this file:
 *   - Static `import { BroadcastChannel }` (Pitfall 9: tests stub via
 *     `globalThis.BroadcastChannel`; static import would bind at module-load).
 */

/** @type {string} D-30 — namespace-aligned with DB_NAME + cache prefix + manifest name. */
const CHANNEL = 'habits';

/**
 * Per-tab origin id. Generated at module-load (lazy: the test cache-busts the
 * module, so each fresh import yields a fresh ORIGIN — matching real-tab
 * semantics where every new tab is a new session).
 *
 * @type {string}
 */
const ORIGIN = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
  ? globalThis.crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** @type {object|null} Active BroadcastChannel handle (null = not booted / degraded). */
let bc = null;

/** @type {Set<(data: unknown) => void>} */
const listeners = new Set();

/**
 * Open the BroadcastChannel and start listening. Graceful no-op when the API
 * is unavailable (Safari `file://` legacy, very old browsers). Idempotent.
 *
 * @returns {void}
 */
export function bootSync() {
  if (bc) return; // idempotent
  if (typeof globalThis.BroadcastChannel === 'undefined') return; // graceful degrade
  bc = new globalThis.BroadcastChannel(CHANNEL);
  bc.addEventListener('message', (e) => {
    // Origin filter — drop our own writes (ARCHITECTURE §6).
    if (e && e.data && e.data.origin === ORIGIN) return;
    for (const fn of listeners) fn(e.data);
  });
}

/**
 * Post a mutation envelope to peer tabs. Keys-only by Pitfall 8 — callers MUST
 * NOT include row values. The `origin` field is appended automatically.
 *
 * @param {{ type: string, event: string, keys: object, at: string }} msg
 * @returns {void}
 */
export function broadcast(msg) {
  if (!bc) return; // graceful degrade (bootSync not called or BC unavailable)
  bc.postMessage({ ...msg, origin: ORIGIN });
}

/**
 * Register a listener for peer-tab messages. Returns an unsubscribe closure.
 *
 * @param {(data: unknown) => void} fn
 * @returns {() => void}
 */
export function onMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
