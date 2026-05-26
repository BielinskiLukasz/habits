/**
 * @file Mobile shell entry point (D-02, D-20).
 *
 * Boot sequence for `index.html`:
 *   1. Register the service worker via the protocol-guarded helper. On file://
 *      this silently no-ops (PWA-04 + NFR-09 + T-01-FileSafe).
 *   2. Mount the diagnostics panel if `?debug=1` is present (D-02 — desktop /
 *      DevTools workflow, bookmarkable affordance).
 *   3. Attach a long-press detector to the app-title element so the same
 *      diagnostics panel mounts after a 1.5 s hold (D-02 — the installed PWA
 *      on phone, where adding a query param is awkward).
 *
 * No fetch() calls (NFR-04 / T-01-NoNet). All imports are `./` relative (D-19).
 */

import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics, attachLongPress } from './views/diagnostics.js';

registerServiceWorker();

// ?debug=1 trigger (D-02). Bookmark-friendly: `index.html?debug=1` always
// mounts the diagnostics panel on top of whatever the page would otherwise
// render. This is the desktop/DevTools workflow.
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();

// Long-press title trigger (D-02). The app-title element exposes the
// `data-app-title` attribute hook (locked in index.html); the long-press
// detector fires after LONG_PRESS_MS=1500 of held pointer with movement
// tolerance MOVE_TOLERANCE_PX=10 (Pitfall 7 — stops the panel popping up
// during a normal tap-and-scroll).
const titleEl = document.querySelector('[data-app-title]');
if (titleEl) attachLongPress(titleEl, mountDiagnostics);
