/**
 * @file Desktop stub entry point (D-04, D-20, DATA-03/04/07/08, SEED-01..05).
 *
 * Boot sequence for `desktop.html`:
 *
 *   P1 wiring:
 *     1. Register the service worker via the protocol-guarded helper. Same code
 *        path as the mobile shell — both installability paths exist for both
 *        shells from day one (D-04).
 *     2. Mount the diagnostics panel if `?debug=1` is present (D-02).
 *
 *   P2 spine wiring (DESKTOP-02 — both shells share the spine):
 *     3. configureApply({repo, broadcast, trackTx})
 *     4. configureUndo({repo})
 *     5. configureSeed({repo, storage: navigator.storage, fetch})
 *     6. bootSync()
 *     7. bootLifecycle()
 *     8. await bootSeed()
 *     9. await hydrate()
 *
 * Order rationale (T-02-BOOT): same as `main.js` — configure DI seams first,
 * platform listeners next, then bootSeed (first write), then hydrate. Top-level
 * await is fine — desktop.html uses <script type="module"> and top-level await
 * is Baseline Widely Available since 2022 (N1).
 *
 * No long-press attach here — D-04 says the desktop stub is minimal; there is
 * no app title to long-press in the "Switch to mobile" body.
 *
 * No fetch() calls outside of bootSeed (NFR-04 / T-01-NoNet). All imports are
 * `./` relative (D-19).
 */

import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics } from './views/diagnostics.js';

// P2 spine imports (DATA-03/04/07/08, SEED-01..05, DESKTOP-02). All relative per D-19.
import * as repo from './db/repo.js';
import { configure as configureApply } from './state/apply.js';
import { configureUndo } from './state/undo.js';
import { configureSeed, bootSeed } from './io/seed.js';
import { hydrate } from './state/store.js';
import { bootSync, broadcast } from './platform/sync.js';
import { bootLifecycle, trackTx } from './platform/lifecycle.js';

registerServiceWorker();

// ?debug=1 trigger (D-02). Same surface as the mobile shell so the developer
// workflow is identical regardless of which HTML they have open.
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();

// P2 spine boot — DATA-03/04/07/08, SEED-01..05. Configure DI seams first;
// attach platform listeners; then bootSeed (first write); then hydrate.
// Top-level await is fine here — desktop.html uses type=module and top-level
// await is Baseline Widely Available since 2022 (N1).
configureApply({ repo, broadcast, trackTx });
configureUndo({ repo });
configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
bootSync();
bootLifecycle();
try { await bootSeed(); } catch (_e) { /* swallow — diagnostics surfaces persistence state separately in P3 */ }
try { await hydrate(); } catch (_e) { /* swallow */ }
