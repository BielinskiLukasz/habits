/**
 * @file Mobile shell entry point (D-02, D-20, DATA-03/04/07/08, SEED-01..05).
 *
 * Boot sequence for `index.html`:
 *
 *   P1 wiring (lands first — never blocks on async):
 *     1. Register the service worker via the protocol-guarded helper. On file://
 *        this silently no-ops (PWA-04 + NFR-09 + T-01-FileSafe).
 *     2. Mount the diagnostics panel if `?debug=1` is present (D-02 — desktop /
 *        DevTools workflow, bookmarkable affordance).
 *     3. Attach a long-press detector to the app-title element so the same
 *        diagnostics panel mounts after a 1.5 s hold (D-02 — the installed PWA
 *        on phone, where adding a query param is awkward).
 *
 *   P2 spine wiring (lands second — DATA-03/04/07/08, SEED-01..05):
 *     4. configureApply({repo, broadcast, trackTx}) — bind the chokepoint.
 *     5. configureUndo({repo}) — bind the persistent-undo seam.
 *     6. configureSeed({repo, storage: navigator.storage, fetch}) — bind the
 *        first-run seed loader's DI seams.
 *     7. bootSync() — open the BroadcastChannel('habits') so cross-tab
 *        mutations are observable to other tabs. Must precede the first write
 *        (the seed-tx) so the post-commit broadcast (in P3+) reaches peers.
 *     8. bootLifecycle() — register visibilitychange+pagehide flush. Must
 *        precede the first write so seed-tx is awaitable on background.
 *     9. await bootSeed() — first-run idempotent seed + persist() + D-45 defaults.
 *    10. await hydrate() — pre-warm the in-memory cache from IDB (minimal in P2).
 *
 * Order rationale (T-02-BOOT): configure DI seams first; attach platform
 * listeners; THEN bootSeed (the first write); THEN hydrate. Top-level await is
 * fine here — index.html uses <script type="module"> and top-level await is
 * Baseline Widely Available since 2022 (N1 — no IIFE wrapper needed).
 *
 * Each P2 await is wrapped in try/catch so a single failure does not abort the
 * rest of the boot; diagnostics must still render.
 *
 * No fetch() calls outside of bootSeed (NFR-04 / T-01-NoNet — bootSeed's only
 * fetch is `./seed/habits.json`, the committed-source seed fixture). All
 * imports are `./` relative (D-19).
 */

import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics, attachLongPress } from './views/diagnostics.js';

// P2 spine imports (DATA-03/04/07/08, SEED-01..05). All relative per D-19.
import * as repo from './db/repo.js';
import { configure as configureApply } from './state/apply.js';
import { configureUndo } from './state/undo.js';
import { configureSeed, bootSeed } from './io/seed.js';
import { hydrate } from './state/store.js';
import { bootSync, broadcast } from './platform/sync.js';
import { bootLifecycle, trackTx } from './platform/lifecycle.js';

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

// P2 spine boot — DATA-03/04/07/08, SEED-01..05. Configure DI seams first;
// attach platform listeners; then bootSeed (first write); then hydrate.
// Top-level await is fine here — index.html uses type=module and top-level
// await is Baseline Widely Available since 2022 (N1).
configureApply({ repo, broadcast, trackTx });
configureUndo({ repo });
configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
bootSync();
bootLifecycle();
try { await bootSeed(); } catch (_e) { /* swallow — diagnostics surfaces persistence state separately in P3 */ }
try { await hydrate(); } catch (_e) { /* swallow */ }
