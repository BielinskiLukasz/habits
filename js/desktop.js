/**
 * @file Desktop entry point — P2 spine boot + P6 route dispatch (D-04, D-20,
 * DATA-03/04/07/08, SEED-01..05, DESKTOP-02, D-115).
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
 *     3. configureApply({repo, broadcast, trackTx, onLogWrite})
 *     4. configureUndo({repo})
 *     5. configureSeed({repo, storage: navigator.storage, fetch})
 *     6. bootSync()
 *     7. bootLifecycle()
 *     8. await bootSeed()
 *     9. await bootScheduled() — migrate active+future habits to scheduled (one-time,
 *        DATA-03) and promote scheduled habits whose startDate <= today (every boot,
 *        SCHED-03). Must run before hydrate() so cache sees final correct statuses.
 *    10. await hydrate()
 *
 *   P6 desktop wiring (D-115 — sidebar + hash-routed panels):
 *    10. configureWave({fetch}) + configureStore({repo})
 *    11. await bootWaves()
 *    12. mountRoutes({routes, onChange, defaultRoute: '#analytics'})
 *
 * Order rationale (T-02-BOOT): same as `main.js` — configure DI seams first,
 * platform listeners next, then bootSeed (first write), then hydrate. Top-level
 * await is fine — desktop.html uses <script type="module"> and top-level await
 * is Baseline Widely Available since 2022 (N1).
 *
 * Stub view mounts: Plans 06-05, 06-06, 06-07 replace the stub content with
 * real mountAnalytics / mountWaveboard / mountPlanning imports.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Direct `window.*` references outside of `mountRoutes` target (DI pattern).
 */

import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics } from './views/diagnostics.js';

// P2 spine imports (DATA-03/04/07/08, SEED-01..05, DESKTOP-02). All relative per D-19.
import * as repo from './db/repo.js';
import { configure as configureApply } from './state/apply.js';
import { writeHabitSnapshots, rebuildAllSnapshots } from './io/scoreSnapshots.js';
import { configureUndo } from './state/undo.js';
import { configureSeed, bootSeed } from './io/seed.js';
import { hydrate, configureStore, subscribe, notify, getCachedWeekStart, getCachedSettings, getCachedHabits } from './state/store.js';
import { bootSync, broadcast, onMessage } from './platform/sync.js';
import { bootLifecycle, trackTx } from './platform/lifecycle.js';
import { configureExport } from './io/export.js';
import { configureImport } from './io/import.js';
import { configureBackupNag } from './io/backup-nag.js';
import { configurePromoteHabit } from './state/apply/promoteHabit.js';

// P6 desktop imports (D-115, D-117, D-118, D-121).
import { mountRoutes } from './router.js';
import { configureWave, bootWaves } from './domain/wave.js';
import { configureScheduled, bootScheduled } from './domain/scheduled.js';
import { mountAnalytics } from './views/desktop/analytics.js';
import { mountWaveboard } from './views/desktop/waveboard.js';
import { mountPlanning } from './views/desktop/planning.js';
import { mountSettings } from './views/settings.js';

registerServiceWorker();

// ?debug=1 trigger (D-02). Same surface as the mobile shell so the developer
// workflow is identical regardless of which HTML they have open.
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();

// P2 spine boot — DATA-03/04/07/08, SEED-01..05. Configure DI seams first;
// attach platform listeners; then bootSeed (first write); then hydrate.
// Top-level await is fine here — desktop.html uses type=module and top-level
// await is Baseline Widely Available since 2022 (N1).
configureApply({
  repo,
  broadcast,
  trackTx,
  onLogWrite: async (habitId) => {
    try { await writeHabitSnapshots(habitId, repo); } catch (_e) {}
  },
});
configureUndo({ repo });
configureScheduled({ repo });
configurePromoteHabit({ repo });
configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
configureExport({ repo });
configureImport({ repo, broadcast });
configureBackupNag({ repo });
bootSync();
bootLifecycle();
try { await bootSeed(); } catch (_e) { /* swallow — diagnostics surfaces persistence state separately in P3 */ }
try { await bootScheduled(); } catch (_e) { /* swallow — promotion/migration non-critical on failure */ }
try { await hydrate(); } catch (_e) { /* swallow */ }

// Boot-time snapshot bootstrap (UAT-T21-v3): if score_snapshots has never
// been populated, rebuild all snapshots in the background so the Analytics
// view shows data on first open without requiring a manual log write or a
// "Recompute Scores" click.  The meta flag 'snapshotsBootstrapped' prevents
// this from re-running on every subsequent boot.  Fire-and-forget so the
// shell routes immediately while the rebuild proceeds asynchronously.
repo.getMeta('snapshotsBootstrapped').then(flag => {
  if (!flag) {
    rebuildAllSnapshots(repo)
      .then(() => Promise.all([
        repo.putMeta('snapshotsBootstrapped', true),
        notify({ event: 'snapshot:rebuild' }),
      ]))
      .catch(() => {});
  }
}).catch(() => {});
// Cross-tab sync: re-render when another tab mutates or completes a JSON import (DATA-07).
onMessage(async (msg) => {
  if (msg.type === 'import:done') { location.reload(); return; }
  if (msg.type === 'mutation' && msg.keys) {
    try { await notify({ event: msg.event, keys: msg.keys }); } catch (_e) {}
  }
});

// P6 desktop wiring — configure wave module and store for desktop views.
configureWave({ fetch: globalThis.fetch });
configureStore({ repo });
try { await bootWaves(); } catch (_e) { /* swallow — wave data non-critical for shell render */ }

// Panel element queries (D-115 — each section carries data-route attribute).
const analyticsPanel = document.querySelector('section[data-route="analytics"]');
const waveboardPanel = document.querySelector('section[data-route="waveboard"]');
const planningPanel  = document.querySelector('section[data-route="planning"]');
const settingsPanel  = document.querySelector('section[data-route="settings"]');
const sidebarLinks   = document.querySelectorAll('.desktop-sidebar-link[data-route-link]');

/**
 * Show one panel and hide the rest. Toggles the HTML `hidden` attribute
 * per the D-79 / D-115 route panel pattern.
 *
 * @param {Element} panel - The panel element to make visible.
 * @returns {void}
 */
function show(panel) {
  for (const p of [analyticsPanel, waveboardPanel, planningPanel, settingsPanel]) {
    if (p === panel) p.hidden = false; else p.hidden = true;
  }
}

/**
 * Focus the pre-placed h1 inside a route panel so keyboard / screen-reader
 * users land at a meaningful heading after navigation (D-79).
 *
 * @param {Element} panel - The panel whose h1 to focus.
 * @returns {void}
 */
function focusH1(panel) {
  const h1 = panel.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

/**
 * Update aria-current="page" on the sidebar nav links to reflect the active
 * route hash. Called by mountRoutes onChange on every route change.
 *
 * @param {string} hash - The currently active route hash (e.g. '#analytics').
 * @returns {void}
 */
function updateNav(hash) {
  for (const link of sidebarLinks) {
    const routeKey = `#${link.dataset.routeLink}`;
    if (routeKey === hash) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

/**
 * Mount stub content into a panel. Idempotent — only appends the stub
 * paragraph on the first call per panel. Plans 06-05/06-06/06-07 replace
 * these stubs with real view mounts (mountAnalytics / mountWaveboard /
 * mountPlanning).
 *
 * @param {Element} panel - The panel to stub.
 * @param {string} label - Human-readable label for the stub text.
 * @returns {void}
 */
function mountStub(panel, label) {
  if (panel.querySelector('[data-stub]')) return; // idempotent
  const p = document.createElement('p');
  p.setAttribute('data-stub', '');
  p.textContent = `${label} — loading…`;
  panel.appendChild(p);
}

// Wire hash router with desktop-specific defaultRoute (D-115).
// Mobile main.js does NOT pass defaultRoute so it defaults to '#today' (backward compat).
mountRoutes({
  routes: {
    '#analytics': () => {
      mountAnalytics(analyticsPanel, { repo, store: { subscribe } });
      show(analyticsPanel);
      focusH1(analyticsPanel);
    },
    '#waveboard': () => {
      mountWaveboard(waveboardPanel, { repo, store: { subscribe } });
      show(waveboardPanel);
      focusH1(waveboardPanel);
    },
    '#planning': () => {
      mountPlanning(planningPanel, { repo, store: { subscribe } });
      show(planningPanel);
      focusH1(planningPanel);
    },
    '#settings': () => {
      mountSettings(settingsPanel, { repo, store: { subscribe, getCachedWeekStart, getCachedSettings, getCachedHabits } });
      show(settingsPanel);
      focusH1(settingsPanel);
    },
  },
  onChange: (hash) => { updateNav(hash); },
  defaultRoute: '#analytics',
});
