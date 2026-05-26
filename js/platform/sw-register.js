/**
 * @file File://-safe SW registration + update wiring (D-08, D-20).
 *
 * The SINGLE integration point that touches `navigator.serviceWorker` (per
 * D-20). Both `js/main.js` (mobile) and `js/desktop.js` (desktop) call
 * `registerServiceWorker()` from here.
 *
 * THREE LAYERS OF DEFENSE (research §Pattern 3 + §Pitfall 2):
 *   1. Feature-detect — `'serviceWorker' in navigator`. Old browsers without
 *      the API early-return cleanly.
 *   2. Protocol guard — `location.protocol.startsWith('http')`. The locked
 *      D-20 second defense; ensures `register()` is never even attempted on
 *      `file://` (which would throw SecurityError because SW requires a
 *      secure context).
 *   3. Silent catch — `.catch(() => { /* silent *\/ })` on the register call.
 *      Third defense in case any deploy-time/runtime failure slips through;
 *      the page stays renderable.
 *
 * FIRST-INSTALL vs REAL-UPDATE DETECTION (research §Pitfall 6):
 *   `controllerchange` fires on every SW takeover, including the very first
 *   install. Without a guard, brand-new users would see an unwanted
 *   "New version ready" toast on their first visit. The canonical fix is to
 *   capture `!!navigator.serviceWorker.controller` BEFORE registering: if it
 *   was true, this is a *replacement* SW (real update → show toast); if it
 *   was false, this is the first-ever install (no toast).
 */

import { showUpdateToast } from '../views/toast.js';

/**
 * Register the service worker if the runtime supports it, the protocol is
 * http(s), and the SW file is reachable. No-ops silently otherwise.
 * @returns {void}
 */
export function registerServiceWorker() {
  // Defense 1 — feature detect. Old browsers without SW support early-return.
  if (!('serviceWorker' in navigator)) return;

  // Defense 2 — protocol guard (D-20). On `file://`, `navigator.serviceWorker
  // .register()` would throw SecurityError because service workers require a
  // secure context. Silent skip lets `file://` opens stay broken-but-safe.
  if (!location.protocol.startsWith('http')) return;

  // Capture controller presence BEFORE registration (Pitfall 6). If a
  // controller already exists, a subsequent `controllerchange` is a real
  // update (replacement SW); if it does not, the first `controllerchange`
  // is the first-ever install and we must NOT show the update toast.
  const hadController = !!navigator.serviceWorker.controller;

  // Defer the actual registration to `load` so it does not contend with first
  // paint. The `./sw.js` path is relative (D-19); the silent `.catch()` is
  // Defense 3 in case anything still goes wrong at runtime.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* silent */ });
  });

  // Wire D-08 update toast onto controllerchange — only fire on real updates
  // (Pitfall 6 first-install guard).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install — never toast
    showUpdateToast();
  });
}
