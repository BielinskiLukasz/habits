/**
 * @file Diagnostics panel + long-press attach + Reset-shell handler + Reset-data handler
 * (D-02, D-03, D-05, D-06, D-44).
 *
 * Two exports:
 *   - `attachLongPress(el, onLongPress)` — Pointer Events long-press detector
 *     per RESEARCH.md §Pattern 4 + Pitfall 7. 1500 ms timer with 10 px
 *     movement-cancellation tolerance.
 *   - `mountDiagnostics()` — renders the six-row diagnostics panel and three
 *     action buttons (Reset shell wired, Reset data button wired per D-44 —
 *     deletes IndexedDB 'habits' DB, Check for update wired).
 *
 * Both `textContent` and `setAttribute` are used exclusively for any rendered
 * value (no unsafe-HTML setter). P1 has no user input, but the discipline
 * lands here so P3+ inherits the XSS-safe pattern when the panel renders
 * user-content (V5 partial / V14 partial; mitigates future tampering at this
 * surface per the plan's threat model).
 */

import { APP_VERSION } from '../util/version.js';

// Long-press constants — locked per D-02 + RESEARCH.md §Pattern 4.
const LONG_PRESS_MS = 1500;
const MOVE_TOLERANCE_PX = 10;

// Single-panel guard — a second mountDiagnostics() call while the panel is
// already mounted is a no-op.
let panelEl = null;

/**
 * Attach a long-press detector to `el`. Fires `onLongPress()` after
 * LONG_PRESS_MS of held pointer with movement <= MOVE_TOLERANCE_PX.
 *
 * Cancels the timer on pointerup, pointercancel, pointerleave, OR a
 * pointermove whose squared distance from pointerdown exceeds
 * MOVE_TOLERANCE_PX^2 (Pitfall 7 mitigation: stops the diagnostics popping
 * up unexpectedly when the user starts a normal tap-and-scroll).
 *
 * Ignores non-primary pointer buttons (e.g., right-click on mouse).
 *
 * @param {Element} el - Element to bind the long-press detector to.
 * @param {() => void} onLongPress - Invoked after a successful long-press.
 * @returns {void}
 */
export function attachLongPress(el, onLongPress) {
  let timer = null;
  let startX = 0;
  let startY = 0;

  el.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return; // ignore right-click
    startX = e.clientX;
    startY = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      onLongPress();
    }, LONG_PRESS_MS);
  });

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointermove', e => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) {
      cancel();
    }
  });
}

/**
 * Mount the diagnostics panel onto document.body. Idempotent — re-entrant
 * calls (e.g., long-press AFTER `?debug=1` already mounted) are a no-op.
 *
 * Renders six key/value rows (App version, Schema version, Service worker,
 * Cache name, Install state, Persistence) + three action buttons (Reset
 * shell wired, Reset data disabled placeholder, Check for update wired)
 * per D-03 + D-05.
 *
 * @returns {void}
 */
export function mountDiagnostics() {
  // Idempotent mount guard.
  if (panelEl) return;

  panelEl = document.createElement('section');
  panelEl.className = 'panel diagnostics-panel';
  panelEl.setAttribute('aria-label', 'Diagnostics');

  const heading = document.createElement('h2');
  heading.textContent = 'Diagnostics';
  panelEl.appendChild(heading);

  const dl = document.createElement('dl');

  // Row 1 — App version (from APP_VERSION).
  appendRow(dl, 'App version', APP_VERSION);

  // Row 2 — Schema version (D-03: deferred to P2; IDB lands then).
  appendRow(dl, 'Schema version', 'n/a (P2)');

  // Row 3 — Service worker state.
  appendRow(dl, 'Service worker', computeSwState());

  // Row 4 — Cache name. Synchronously render placeholder, then async-update.
  const cacheDd = appendRow(dl, 'Cache name', 'loading…');
  if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
    caches.keys().then(keys => {
      const match = keys.find(k => /^habits-/.test(k));
      cacheDd.textContent = match || 'none';
    }).catch(() => {
      cacheDd.textContent = 'none';
    });
  } else {
    cacheDd.textContent = 'none';
  }

  // Row 5 — Install state via display-mode media query.
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  appendRow(dl, 'Install state', isStandalone ? 'standalone' : 'browser');

  // Row 6 — Persistence (D-03: deferred to P2; navigator.storage.persist lands then).
  appendRow(dl, 'Persistence', 'n/a (P2)');

  panelEl.appendChild(dl);

  // Action buttons (D-03 + D-05).
  const actions = document.createElement('div');
  actions.className = 'diagnostics-actions';

  // Reset shell — wired (D-05). Verbatim D-06 confirm phrasing.
  const resetShellBtn = document.createElement('button');
  resetShellBtn.className = 'diagnostics-action';
  resetShellBtn.textContent = 'Reset shell';
  resetShellBtn.addEventListener('click', async () => {
    // D-06 confirm copy — VERBATIM, do not edit.
    const confirmed = confirm('Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install.');
    if (!confirmed) return;

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
        }
      } catch (_e) {
        // Swallow — proceed with cache deletion + reload regardless.
      }
    }

    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (_e) {
        // Swallow — proceed with reload regardless.
      }
    }

    location.reload();
  });
  actions.appendChild(resetShellBtn);

  // Reset data — wired (D-44). Verbatim D-06-style confirm phrasing for THIS button.
  const resetDataBtn = document.createElement('button');
  resetDataBtn.className = 'diagnostics-action';
  resetDataBtn.textContent = 'Reset data';
  resetDataBtn.addEventListener('click', async () => {
    // Verbatim D-06-style phrasing for the data-reset variant (D-44 calls for D-06 style).
    const confirmed = confirm('Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.');
    if (!confirmed) return;

    try {
      // `deleteDatabase` returns a request; await it via a small Promise wrapper.
      // onblocked also resolves — close other tabs manually; the eventual reload
      // (after the user closes them) still re-seeds.
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('habits');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });
    } catch (_e) {
      // Swallow — proceed with reload regardless.
    }

    location.reload();
  });
  actions.appendChild(resetDataBtn);

  // Check for update — wired (D-03). Forces registration.update().
  const checkUpdateBtn = document.createElement('button');
  checkUpdateBtn.className = 'diagnostics-action';
  checkUpdateBtn.textContent = 'Check for update';
  checkUpdateBtn.addEventListener('click', async () => {
    const originalLabel = 'Check for update';
    checkUpdateBtn.textContent = 'Checking…';
    if (!('serviceWorker' in navigator)) {
      checkUpdateBtn.textContent = 'No SW';
      setTimeout(() => { checkUpdateBtn.textContent = originalLabel; }, 2000);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        checkUpdateBtn.textContent = 'Done';
      } else {
        checkUpdateBtn.textContent = 'No SW';
      }
    } catch (_e) {
      checkUpdateBtn.textContent = 'No SW';
    }
    setTimeout(() => { checkUpdateBtn.textContent = originalLabel; }, 2000);
  });
  actions.appendChild(checkUpdateBtn);

  panelEl.appendChild(actions);

  document.body.appendChild(panelEl);
}

/**
 * Build a <dt>label</dt><dd>value</dd> pair into `dl` using textContent only.
 * Returns the <dd> element so the caller can update its textContent later
 * (used by the async cache-name lookup).
 */
function appendRow(dl, label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
  return dd;
}

/**
 * Compute the human-readable SW state string for the diagnostics panel.
 * "unsupported" if the API is missing; "controlled" if a controller exists;
 * otherwise "registered, not yet controlled" or "none" based on whether a
 * registration is present (rendered async — initial value is the synchronous
 * best-effort answer based on `navigator.serviceWorker.controller`).
 */
function computeSwState() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (navigator.serviceWorker.controller) return 'controlled';
  return 'registered, not yet controlled';
}
