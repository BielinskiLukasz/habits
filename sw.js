// sw.js — Classic service worker for Nawyki (file://-safe via sw-register.js guard).
//
// Why CLASSIC service worker (not `type: "module"`):
//   Module-form SWs are not yet Baseline on Firefox/Safari (Pitfall 4 in
//   01-RESEARCH.md). Stable Firefox + Safari "download and attempt to execute
//   the ES module flavor of service worker, and only raise an exception when
//   there's a syntax error due to the usage of ES module imports." A silent-
//   failing SW is unacceptable for an offline-first app, so we use the classic
//   form + `importScripts('./js/util/version.js')` to share the version
//   constant with the window context (D-12, research §Q2).
//
// Locked decisions implemented here:
//   - D-09: `skipWaiting()` + `clients.claim()` are unconditional; new SWs
//           take over immediately. The user-facing "New version ready" toast
//           lives in sw-register.js (controllerchange listener); the SW never
//           auto-reloads.
//   - D-10: Cache name `nawyki-${APP_VERSION}`. Activate handler deletes every
//           cache whose name is not the current one. Bumping APP_VERSION in
//           js/util/version.js is the only operation needed to invalidate.
//   - D-11: Strategy router: cache-first for the shell asset list (HTML, CSS,
//           manifest, icon, pinned JS entry points) and stale-while-revalidate
//           for everything under /js/. SWR honors D-10 (JS module changes do
//           NOT need a cache-name bump because SWR refreshes on every fetch)
//           while still satisfying NFR-04 (fully offline on cache fallback).
//   - D-12: Single source of truth for the version constant. `self.APP_VERSION`
//           is set by `importScripts('./js/util/version.js')` below.
//   - D-19: Every URL in this file is relative (`./…`); no absolute paths and
//           no off-origin (h-t-t-p-s) URLs (NFR-12 + T-01-NoNet).
//
// Threat mitigations landed here:
//   - T-01-CacheScope: `fetch` handler early-returns when
//     `url.origin !== self.location.origin`. Cross-origin requests are never
//     intercepted, never cached, never produce opaque responses.
//   - T-01-StaleCache: Versioned cache name + activate cleanup.
//   - T-01-OfflineFail: `staleWhileRevalidate` catches network errors and
//     falls back to the cached copy. Cache-first branch never depends on the
//     network when the cache is populated.
//   - T-01-NoNet: Zero off-origin (h-t-t-p-s) URLs in this file. The only
//     network destinations are same-origin GETs derived from `e.request.url`.

importScripts('./js/util/version.js');

const CACHE = `nawyki-${self.APP_VERSION}`;

// The locked shell asset list (research §Pattern 1).
// All 17 entries are relative-path (`./…`) per D-19.
// The bare `./` entry caches the directory-root response (equivalent to
// index.html on default-document servers).
//
// Note: Plans 03 + 04 ship the remaining JS files referenced here (sw-register.js,
// diagnostics.js, toast.js, main.js, desktop.js) and the HTML shells. Until those
// land, `cache.addAll(SHELL)` will fail because some entries are missing — that
// is the EXPECTED behavior at this point in Phase 1 and is why Plan 04 is the
// runtime-verification gate, not this plan.
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached); // offline → fall back to cached copy (NFR-04 / PWA-06).
  return cached || networkPromise;
}
