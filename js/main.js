/**
 * @file Mobile shell entry point (D-02, D-20, DATA-03/04/07/08, SEED-01..05,
 * D-60 router, D-79 focus-on-route-change).
 *
 * Boot sequence for `index.html`:
 *
 *   P1 wiring (lands first — never blocks on async):
 *     1. Register the service worker via the protocol-guarded helper. On file://
 *        this silently no-ops (PWA-04 + NFR-09 + T-01-FileSafe).
 *     2. Mount the diagnostics panel if `?debug=1` is present (D-02 — desktop /
 *        DevTools workflow, bookmarkable affordance).
 *
 *   P2 spine wiring (lands second — DATA-03/04/07/08, SEED-01..05):
 *     3. configureApply({repo, broadcast, trackTx}) — bind the chokepoint.
 *     4. configureUndo({repo}) — bind the persistent-undo seam.
 *     5. configureSeed({repo, storage: navigator.storage, fetch}) — bind the
 *        first-run seed loader's DI seams.
 *     6. configureWave({fetch}) + configureStore({repo}) — bind the new P3
 *        DI seams for the wave catalog + cache hydrate.
 *     7. bootSync() — open the BroadcastChannel('habits').
 *     8. bootLifecycle() — register visibilitychange+pagehide flush.
 *     9. await bootSeed() — first-run idempotent seed + persist() + D-45 defaults.
 *    10. await hydrate() — pre-warm cache with this-week logs + habits + weekStart.
 *    11. await bootWaves() — load wave catalog for header rendering.
 *    12. mountRoutes(...) — install the hash router with three routes
 *        (#today / #settings / #history) + focus-on-route-change (D-79).
 *
 * The long-press diagnostics attach (D-02) lives INSIDE the `#today` route
 * function so it re-binds to the h1 every time Today mounts (the h1 is part
 * of the buildTodayHeader description tree now, NOT a static element in
 * index.html). This keeps the long-press affordance functional even when
 * the user navigates away to Settings and back.
 *
 * Order rationale (T-02-BOOT): configure DI seams first; attach platform
 * listeners; THEN bootSeed (the first write); THEN hydrate. Top-level await
 * is fine here — index.html uses <script type="module"> and top-level await
 * is Baseline Widely Available since 2022 (N1 — no IIFE wrapper needed).
 *
 * Each P2/P3 await is wrapped in try/catch so a single failure does not
 * abort the rest of the boot; diagnostics must still render.
 *
 * No fetch() calls outside of bootSeed / bootWaves (NFR-04 / T-01-NoNet — the
 * only fetches are `./seed/habits.json` and `./seed/waves.json`, both
 * committed-source seed fixtures). All imports are `./` relative (D-19).
 */

import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics, attachLongPress } from './views/diagnostics.js';

// P2 spine imports (DATA-03/04/07/08, SEED-01..05). All relative per D-19.
import * as repo from './db/repo.js';
import { configure as configureApply } from './state/apply.js';
import { configureUndo } from './state/undo.js';
import { configureSeed, bootSeed } from './io/seed.js';
import { hydrate, configureStore } from './state/store.js';
import { bootSync, broadcast } from './platform/sync.js';
import { bootLifecycle, trackTx } from './platform/lifecycle.js';

// P3 router + Today view wiring (D-60, CORE-01..06).
import { mountRoutes } from './router.js';
import { mountToday, mountFooterNav } from './views/today.js';
import { configureWave, bootWaves } from './domain/wave.js';

registerServiceWorker();

// ?debug=1 trigger (D-02). Bookmark-friendly: `index.html?debug=1` always
// mounts the diagnostics panel on top of whatever the page would otherwise
// render. This is the desktop/DevTools workflow.
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();

// P2 spine boot — DATA-03/04/07/08, SEED-01..05. Configure DI seams first;
// attach platform listeners; then bootSeed (first write); then hydrate.
// Top-level await is fine here — index.html uses type=module and top-level
// await is Baseline Widely Available since 2022 (N1).
configureApply({ repo, broadcast, trackTx });
configureUndo({ repo });
configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
configureWave({ fetch: globalThis.fetch });
configureStore({ repo });
bootSync();
bootLifecycle();
try { await bootSeed(); } catch (_e) { /* swallow — diagnostics surfaces persistence state separately in P3 */ }
try { await hydrate(); } catch (_e) { /* swallow */ }
try { await bootWaves(); } catch (_e) { /* swallow — wave display degrades to empty wave slot */ }

// P3 router + view wiring (D-60, D-79, D-80).
const todayPanel = document.querySelector('section[data-route="today"]');
const settingsPanel = document.querySelector('section[data-route="settings"]');
const historyPanel = document.querySelector('section[data-route="history"]');
const footerNavEl = document.querySelector('nav.today-footer-nav');

/**
 * Show one route panel and hide the others. Uses the `hidden` HTML attribute
 * rather than a CSS-class toggle so the panels stay accessible to keyboard
 * navigation by default (browsers treat `hidden` as removed from the a11y
 * tree).
 *
 * @param {Element} panel
 */
function show(panel) {
  for (const p of [todayPanel, settingsPanel, historyPanel]) {
    if (p === panel) p.hidden = false; else p.hidden = true;
  }
}

/**
 * Move keyboard focus to the panel's h1 on route change (D-79). The h1
 * receives `tabindex="-1"` so it can accept programmatic focus without
 * appearing in the tab order.
 *
 * @param {Element} panel
 */
function focusH1(panel) {
  const h1 = panel.querySelector('h1');
  if (h1) {
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: true });
  }
}

mountRoutes({
  routes: {
    '#today': () => {
      mountToday(todayPanel);
      // Re-bind the long-press diagnostics trigger to the freshly-rendered
      // h1[data-app-title]. The h1 lives inside the Today description tree
      // (built by buildTodayHeader), so this must run AFTER mountToday.
      const titleEl = todayPanel.querySelector('[data-app-title]');
      if (titleEl) attachLongPress(titleEl, mountDiagnostics);
      show(todayPanel);
      focusH1(todayPanel);
    },
    '#settings': () => {
      // Settings view ships in Slice 4 (plan 03-05). For now, show the empty
      // panel so the route is reachable + the focus management is exercised.
      show(settingsPanel);
      focusH1(settingsPanel);
    },
    '#history': () => {
      // D-80: visible-but-disabled history tab. The panel itself renders a
      // placeholder so deep-linking to `#history` lands on something useful.
      if (!historyPanel.firstChild) {
        const h1 = document.createElement('h1');
        h1.textContent = 'History';
        historyPanel.appendChild(h1);
        const p = document.createElement('p');
        p.textContent = 'History view ships in Phase 4.';
        historyPanel.appendChild(p);
      }
      show(historyPanel);
      focusH1(historyPanel);
    },
  },
  onChange: (hash) => {
    mountFooterNav(footerNavEl, hash);
  },
});
