/**
 * @file Module service worker for Habits (file://-safe via sw-register.js guard).
 *
 * Why MODULE service worker (`type: "module"`):
 *   The original Phase 1 plan chose a classic SW + `importScripts('./js/util/version.js')`
 *   to share the version constant with the window context. That approach was
 *   based on stale 2023 research suggesting module SWs were not yet Baseline
 *   on Firefox/Safari. In practice the classic path was broken — classic-script
 *   parsers hard-error on `export const`, so `importScripts(version.js)` threw
 *   `SyntaxError: Unexpected token 'export'`, the install handler rejected, and
 *   the SW never reached `activated`. Module SWs have been Baseline since
 *   Firefox 114 (Jun 2023) and Safari 16 (Sep 2022); in 2026 every target
 *   browser supports them. The module form lets `sw.js` and the window context
 *   share `js/util/version.js` verbatim — single source of truth (D-12).
 *
 * Locked decisions implemented here:
 *   - D-09: `skipWaiting()` + `clients.claim()` are unconditional; new SWs
 *           take over immediately. The user-facing "New version ready" toast
 *           lives in sw-register.js (controllerchange listener); the SW
 *           never auto-reloads.
 *   - D-10: Cache name `habits-${APP_VERSION}`. Activate handler deletes
 *           every cache whose name is not the current one. Bumping
 *           APP_VERSION in js/util/version.js is the only operation needed
 *           to invalidate.
 *   - D-11: Strategy router — cache-first for the shell asset list (HTML,
 *           CSS, manifest, icon, pinned JS entry points) and
 *           stale-while-revalidate for everything under /js/. SWR honors
 *           D-10 (JS module changes do NOT need a cache-name bump because
 *           SWR refreshes on every fetch) while still satisfying NFR-04
 *           (fully offline on cache fallback).
 *   - D-12: Single source of truth for the version constant. Imported from
 *           `js/util/version.js` as an ES module (same as the window context).
 *   - D-19: Every URL in this file is relative (`./…`); no absolute paths
 *           and no off-origin URLs (NFR-12 + T-01-NoNet).
 *
 * Threat mitigations landed here:
 *   - T-01-CacheScope: `fetch` handler early-returns when
 *     `url.origin !== self.location.origin`. Cross-origin requests are never
 *     intercepted, never cached, never produce opaque responses.
 *   - T-01-StaleCache: Versioned cache name + activate cleanup.
 *   - T-01-OfflineFail: `staleWhileRevalidate` catches network errors and
 *     falls back to the cached copy. Cache-first branch never depends on the
 *     network when the cache is populated.
 *   - T-01-NoNet: Zero off-origin URLs in this file. The only network
 *     destinations are same-origin GETs derived from `e.request.url`.
 */

import { APP_VERSION } from './js/util/version.js';

const CACHE = `habits-${APP_VERSION}`;

// The locked shell asset list (research §Pattern 1).
// All entries are relative-path (`./…`) per D-19.
// The bare `./` entry caches the directory-root response (equivalent to
// index.html on default-document servers).
//
// Phase-1 plans 03 + 04 shipped the original 17 entries (sw-register.js,
// diagnostics.js, toast.js, main.js, desktop.js + the HTML shells).
// Phase-2 plans 04 (seed) + 05 (wiring) appended the storage-spine entries
// below: the new `./js/util/*`, `./js/db/*`, `./js/state/*`, `./js/platform/*`,
// `./js/io/*` modules plus the committed `./seed/habits.json` fixture.
// `./seed/habits.json` MUST be present here because `bootSeed()` fetches it on
// first run — without precaching it, offline first-run fails (RESEARCH Pitfall
// 8 strategy (a) + Assumption A5).
const SHELL = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  './icon.svg',
  './css/main.css',
  './css/tokens.css',
  './css/reset.css',
  './css/base.css',
  './css/components.css',
  './css/today.css',
  './js/main.js',
  './js/desktop.js',
  './js/util/version.js',
  './js/platform/sw-register.js',
  './js/views/diagnostics.js',
  './js/views/toast.js',
  // P2 storage spine — added in phase 02-storage-foundation-the-spine plan 04 (seed) / 05 (wiring).
  './js/util/date.js',
  './js/util/id.js',
  './js/db/idb.js',
  './js/db/schema.js',
  './js/db/repo.js',
  './js/state/store.js',
  './js/state/apply.js',
  './js/state/apply/markCompleted.js',
  './js/state/undo.js',
  './js/platform/sync.js',
  './js/platform/lifecycle.js',
  './js/io/seed.js',
  './seed/habits.json',
  // Phase-3 first-usable-slice — added in 03-today-view-settings-v1.
  // - Router + view + domain + util modules introduced in 03-01..03-03.
  // - Settings panel + builders + setSetting handler introduced in 03-05.
  // - Toast extensions (showUndoToast / showErrorToast) live in js/views/toast.js,
  //   which is already in the P1-locked entries above; no duplicate entry.
  // - seed/waves.json is intentionally NOT here; it is SWR-cached per D-81.
  './js/router.js',
  './js/views/today.js',
  './js/views/today/builders.js',
  './js/views/settings.js',
  './js/views/settings/builders.js',
  './js/domain/cadence.js',
  './js/domain/wave.js',
  './js/util/mount.js',
  './js/state/apply/markUncompleted.js',
  './js/state/apply/setSetting.js',
  './css/settings.css',
  // Phase-4 domain model — added in 04-domain-model-cadence-catalog-stages-mastery.
  // - Catalog view + builders (04-01/04-02), history view + builders (04-05/04-06).
  // - Apply handlers: createHabit, editHabit, archiveHabit (04-01), advanceStage (04-03),
  //   logNumeric, logSlot (04-04), setMasteryThreshold, setMasteryWindow (04-07).
  // - Domain modules: mastery (04-04), stage (04-03), waveAggregates (04-06).
  // - CSS: catalog.css (04-02), history.css (04-05).
  // - seed/waves.json is intentionally NOT here; it is SWR-cached per D-81.
  './js/views/catalog.js',
  './js/views/catalog/builders.js',
  './js/views/history.js',
  './js/views/history/builders.js',
  './js/state/apply/createHabit.js',
  './js/state/apply/editHabit.js',
  './js/state/apply/archiveHabit.js',
  './js/state/apply/advanceStage.js',
  './js/state/apply/logNumeric.js',
  './js/state/apply/logSlot.js',
  './js/state/apply/setMasteryThreshold.js',
  './js/state/apply/setMasteryWindow.js',
  './js/domain/mastery.js',
  './js/domain/stage.js',
  './js/domain/waveAggregates.js',
  './css/catalog.css',
  './css/history.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Strategy router:
//   - non-GET → passthrough (browser handles natively).
//   - cross-origin → passthrough (V14 Configuration; T-01-CacheScope mitigation).
//   - same-origin under /js/ → stale-while-revalidate (D-11).
//   - everything else (shell assets) → cache-first.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Same-origin guard. Cross-origin requests must never enter the cache
  // (opaque responses bloat storage and break offline-detection heuristics).
  if (url.origin !== self.location.origin) return;

  // js/** — stale-while-revalidate so JS module changes propagate within one
  // reload without forcing an APP_VERSION bump (D-10, D-11).
  if (url.pathname.includes('/js/')) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  // Default — cache-first for shell assets.
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

/**
 * Stale-while-revalidate strategy for /js/ requests. Returns the cached copy
 * immediately if present; revalidates from the network in the background and
 * updates the cache. Falls back to the cached copy if the network is offline
 * (NFR-04 / PWA-06).
 *
 * @param {Request} request - Same-origin GET request to handle.
 * @returns {Promise<Response>} The response to serve.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached); // offline → fall back to cached copy (NFR-04 / PWA-06).
  return cached || networkPromise;
}
