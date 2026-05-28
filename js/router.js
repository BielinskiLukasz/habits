/**
 * @file Hash router for `#today` / `#settings` / `#history` (D-60, D-80).
 *
 * Why hash routing (not history.pushState):
 *   - `hashchange` works on `file://` — `history.pushState` triggers a
 *     SecurityError under the `file:` protocol on every modern browser.
 *   - SW silent-fail (PWA-04) keeps the rest of the shell functional on
 *     `file://`, so the router is the only piece that needs explicit
 *     hash-only design.
 *
 * Allowlist resolution (Threat T-03-06 mitigation):
 *   The router only invokes route functions for hashes present in the
 *   `routes` map. Any unknown / spoofed hash falls back to `#today` so an
 *   attacker-controllable URL cannot navigate the app to a panel that the
 *   shell has not opted into.
 *
 * Same-hash no-op:
 *   Re-resolving to the current hash is a no-op (the route function does
 *   not re-fire, onChange is not re-called). This matches the browser's
 *   own behavior — `hashchange` does not fire when the new hash matches
 *   the old one — and is verified by tests/unit/router.test.js to defend
 *   against a future change accidentally introducing double-mounts.
 *
 * Idempotent re-entry (Pattern S4):
 *   Module-level `_mounted` flag prevents a second `mountRoutes(...)` call
 *   from registering a duplicate `hashchange` listener. The test
 *   `mountRoutes — idempotent re-mount` enforces this invariant.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Direct `window.*` references — accept the window via `target` so
 *     Node tests can inject a fake (see tests/helpers/fake-document.js
 *     `createFakeWindow`).
 *   - `history.pushState` / `history.replaceState` — file://-hostile.
 */

/** Singleton mount guard — second mountRoutes() call does NOT re-register. */
let _mounted = false;

/** Last resolved hash so same-hash transitions are no-ops. */
let _currentHash = null;

/**
 * Mount the hash router. Resolves the initial route from `target.location.hash`
 * (defaulting to `#today` when missing or unknown), invokes the matched route
 * function + `onChange(hash)`, and registers a `hashchange` listener so future
 * URL changes are dispatched.
 *
 * Calling `mountRoutes` a second time does NOT register a duplicate
 * `hashchange` listener. The second call still triggers an initial dispatch
 * (which is itself a no-op if the resolved hash matches the current one).
 *
 * @param {{
 *   routes: Record<string, () => void>,
 *   onChange: (hash: string) => void,
 *   target?: { location: { hash: string }, addEventListener: (type: string, fn: (e: { type: string }) => void) => void },
 * }} opts
 * @returns {void}
 */
export function mountRoutes({ routes, onChange, target }) {
  const win = target ?? globalThis.window;

  function resolve() {
    const raw = win.location.hash || '#today';
    const hash = routes[raw] ? raw : '#today';
    if (hash === _currentHash) return;
    _currentHash = hash;
    routes[hash]();
    onChange(hash);
  }

  if (!_mounted) {
    win.addEventListener('hashchange', resolve);
    _mounted = true;
  }
  resolve();
}

/**
 * Test-only: clear module-level state so `freshRouter()` in tests starts from
 * a pristine module instance. Production never calls this.
 *
 * @returns {void}
 */
export function _resetRouterForTest() {
  _mounted = false;
  _currentHash = null;
}
