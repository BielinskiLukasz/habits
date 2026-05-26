/**
 * @file Desktop stub entry point (D-04, D-20).
 *
 * Boot sequence for `desktop.html`:
 *   1. Register the service worker via the protocol-guarded helper. Same code
 *      path as the mobile shell — both installability paths exist for both
 *      shells from day one (D-04).
 *   2. Mount the diagnostics panel if `?debug=1` is present (D-02).
 *
 * No long-press attach here — D-04 says the desktop stub is minimal; there is
 * no app title to long-press in the "Switch to mobile" body.
 *
 * No fetch() calls (NFR-04 / T-01-NoNet). All imports are `./` relative (D-19).
 */

import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics } from './views/diagnostics.js';

registerServiceWorker();

// ?debug=1 trigger (D-02). Same surface as the mobile shell so the developer
// workflow is identical regardless of which HTML they have open.
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();
