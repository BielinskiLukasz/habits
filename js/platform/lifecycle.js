/**
 * @file Lifecycle flush hook — visibilitychange + pagehide (DATA-08, Pitfall 8).
 *
 * Wires the only two lifecycle signals MDN recommends for "page is about to be
 * unloaded, persist now": `visibilitychange` (state === 'hidden') and
 * `pagehide`. These fire reliably on mobile (PWA backgrounded, app-switcher,
 * browser-tab swap); the legacy `beforeunload` event does NOT fire reliably
 * on iOS Safari + Android Chrome and is **explicitly forbidden** by D-08 /
 * Pitfall 8 / MDN ("Beware of unload" — https://developer.mozilla.org/en-US/
 * docs/Web/API/Window/beforeunload_event#usage_notes).
 *
 * Locked decisions implemented here:
 *   - DATA-08: only `visibilitychange === 'hidden'` and `pagehide` flush.
 *   - Pitfall 8 (RESEARCH): NEVER `beforeunload`. Grep-banned; the discipline
 *     test in `tests/unit/apply.discipline.test.js` enforces zero matches.
 *   - Idempotent re-entry guard (02-PATTERNS.md §Idempotent re-entry guard):
 *     a second `bootLifecycle()` call is a no-op.
 *
 * Dependency-injection design (Pitfall 9 / D-25):
 *   - `bootLifecycle(doc, win)` accepts the document + window targets so the
 *     unit test can pass `createFakeDocument()` + a tiny fake window. In
 *     production both default to `globalThis.document` / `globalThis.window`.
 *
 * Critical invariants:
 *   - `_flush()` awaits the in-flight tx chain so apply.js's `runTx` promise
 *     completes before the page is suspended.
 *   - `trackTx(promise)` adds the supplied promise to the chain via `.then(()
 *     => promise.catch(() => {}))` so a rejected tx does not break the chain.
 *
 * Forbidden constructs in this file:
 *   - The literal token `beforeunload` (Pitfall 8 / MDN). Grep-verified.
 *   - Top-level reference to `document` or `window` (Pitfall 9 — Node-import
 *     must not throw). Globals are read lazily via the DI defaults.
 */

/** @type {Promise<unknown>} */
let inFlightTxPromise = Promise.resolve();

/** Singleton-guard so a second bootLifecycle() call does not double-register. */
let initialized = false;

/**
 * Track an in-flight tx so the lifecycle flush can await it. Chains via
 * `.catch(() => {})` so a rejected tx does not poison subsequent flushes.
 *
 * @param {Promise<unknown>} promise
 * @returns {void}
 */
export function trackTx(promise) {
  inFlightTxPromise = inFlightTxPromise.then(() => promise.catch(() => {}));
}

/**
 * Await all in-flight tx promises. Exported with an underscore prefix to
 * signal "internal — only the unit test imports this directly"; the
 * production listeners invoke it via the event handlers below.
 *
 * @returns {Promise<void>}
 */
export async function _flush() {
  await inFlightTxPromise;
}

/**
 * Register the visibilitychange + pagehide listeners on the supplied doc/win.
 * Idempotent: a second call is a no-op (singleton-guard).
 *
 * @param {{ visibilityState?: string, addEventListener: (t: string, fn: (e: { type: string }) => void) => void }} [doc]
 * @param {{ addEventListener: (t: string, fn: (e: { type: string }) => void) => void }} [win]
 * @returns {void}
 */
export function bootLifecycle(doc = globalThis.document, win = globalThis.window) {
  if (initialized) return;
  initialized = true;

  // Graceful degrade: if no doc/win available (some test contexts), do
  // nothing rather than throw. Mirrors sw-register.js defense-in-depth.
  if (!doc || typeof doc.addEventListener !== 'function') return;
  if (!win || typeof win.addEventListener !== 'function') return;

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') _flush();
  });
  win.addEventListener('pagehide', () => { _flush(); });
}
