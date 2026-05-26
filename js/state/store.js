/**
 * @file In-memory cache + subscribe/notify (Open Question 4 — minimal in P2).
 *
 * The state-cache half of the controller chokepoint (`js/state/apply.js`).
 * P2 ships a deliberately small surface: a pub-sub set + an idempotent
 * `hydrate()` that pre-warms an empty cache. P3+ expands `cache` with the
 * "last N days of logs" window per ARCHITECTURE §2 once views start reading
 * it.
 *
 * Locked decisions implemented here:
 *   - Open Question 4 (RESEARCH): ship the smallest viable store; views in
 *     P3 will demand the per-slice shape.
 *   - Idempotent re-entry guard (02-PATTERNS.md): `hydrate()` short-circuits
 *     on second call.
 *   - Subscribe-returns-unsubscribe (toast.js / sw-register.js-style closure).
 *
 * Forbidden constructs in this file:
 *   - Direct `indexedDB.*` reference (Anti-Pattern 1 — only js/db/idb.js).
 *   - Calls to `js/db/repo.js` write helpers (DATA-04 — only apply.js writes).
 *     Reads are fine; we call `getHabit`/`getLog` etc. when P3 wires them.
 */

/** @type {{ habits: Map<string, object>, logs: Map<string, object> }} */
const cache = { habits: new Map(), logs: new Map() };

/** @type {Set<(slice: { event: string, keys: object }) => void>} */
const subs = new Set();

/** Singleton-guard so a second hydrate() call is a no-op. */
let hydrated = false;

/**
 * Pre-warm the in-memory cache. P2 minimum — hydrating from an empty repo is
 * a valid path (the cache stays empty until P3 wires reads). Idempotent.
 *
 * @param {object} [_repo] Repo handle (unused in P2; reserved for P3+).
 * @returns {Promise<void>}
 */
export async function hydrate(_repo) {
  if (hydrated) return;
  hydrated = true;
  // P3+: walk repo.getAllHabits(), repo.getLogsInRange(...) and populate cache.
}

/**
 * Subscribe to mutation notifications. Returns an unsubscribe closure (matches
 * the BroadcastChannel.onMessage shape so the two pubsubs compose cleanly).
 *
 * @param {(slice: { event: string, keys: object }) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/**
 * Fan a notification out to subscribers. Called by `apply.js` after a
 * successful tx + broadcast.
 *
 * @param {{ event: string, keys: object }} slice
 * @returns {void}
 */
export function notify(slice) {
  for (const fn of subs) fn(slice);
}

/**
 * Test/diagnostics-only handle on the cache. Not part of the public surface
 * (P3 views read via dedicated selectors).
 *
 * @returns {{ habits: Map<string, object>, logs: Map<string, object> }}
 */
export function _cache() { return cache; }
