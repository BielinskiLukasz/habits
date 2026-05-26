# Phase 1: PWA Shell & Tooling Hygiene - Research

**Researched:** 2026-05-26
**Domain:** Static PWA chassis (manifest + service worker + shell HTML/CSS + diagnostics) for a vanilla, no-build, file://-safe, GitHub-Pages-hostable habit tracker
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visible Phase-1 UI**

- **D-01 — Empty Today shell scaffold:** `index.html` renders the eventual mobile chrome (header with today's date + current wave context, empty habit list area, footer nav stub with `today · history · settings` labels). Phase 3 fills the data; Phase 1 just proves the chrome and the SW are alive.
- **D-02 — Diagnostics panel access via TWO triggers:** `?debug=1` query param **AND** long-press (~1.5s) on the app title. Query param is for desktop/devtools workflows; long-press is for the installed phone. Both reach the same panel.
- **D-03 — Diagnostics panel contents:** app version, schema version, SW state (registered / controlled / none) + current cache name, install state (`display-mode: standalone` detection), persistence status (deferred to P2 when IDB exists — render as "n/a (P2)" in P1), "Reset shell" button, "Reset data" button (placeholder + tooltip "wired in P2"), "Check for update" button (forces `registration.update()` and reports outcome).
- **D-04 — `desktop.html` ships as a minimal "Switch to mobile" stub in P1.** It exists so installability paths exist for both shells from day one, but the analytics layout proper is P6. Same `<meta>`s, same manifest link, same `sw-register.js` call.

**Reset-app behavior**

- **D-05 — Two distinct reset buttons (not one nuclear button):**
  - **Reset shell** = `registration.unregister()` + `caches.keys().forEach(caches.delete)` + `location.reload()`. Wired and functional in P1.
  - **Reset data** = deletes the `nawyki` IndexedDB database. Placeholder button in P1 with tooltip "available in P2"; wiring lands when IDB ships.
- **D-06 — Each reset has its own confirm dialog** (single confirmation, not multi-step). Phrasing: "Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install." / (P2:) "Reset data — delete all habits, logs, and history. The app shell is NOT affected. This cannot be undone unless you have a JSON backup."
- **D-07 — `Reset-app surface` was not picked as an explicit discussion area** — captured by default as part of the diagnostics-panel decision above. Open to revisit during planning if the planner sees a cleaner placement.

**Service worker update propagation**

- **D-08 — Toast "New version ready — Reload" on `controllerchange`.** Non-blocking; the user can keep tapping the current page until they reload. Toast persists (does not auto-dismiss) until the user reloads or explicitly closes it. Toast is a primitive shared with the rest of the app (the same toast component will later host Undo notifications).
- **D-09 — `skipWaiting()` is unconditional** in `sw.activate`. Combined with `clients.claim()`, this means new SWs take over immediately. The user's protection against a mid-tap reload is "we never auto-reload — only show the toast." (Auto-reload-on-activate was explicitly rejected.)
- **D-10 — Cache name bumps ONLY on shell-asset changes** (`index.html`, `desktop.html`, `manifest.json`, `sw.js`, `icon.svg`, anything under `css/`). Pure JS module changes do NOT bump the cache.
- **D-11 — JS modules use a non-cache-first strategy** to honor D-10 while still meeting NFR-04 (fully offline). Likely candidate: **stale-while-revalidate** for `js/**` (serve cached, refresh in background) **or** network-first-with-cache-fallback. **Researcher must validate** which pattern actually delivers fresh modules within one reload while never breaking offline. Whichever pattern wins must be documented in `sw.js` itself.
- **D-12 — One source of truth for the version constant.** A single `APP_VERSION` (e.g., in `js/util/version.js`) is referenced by `sw.js` (for the cache name when D-10 says to bump) AND by the diagnostics panel. Bumping the version is one edit, in one file.

**Manifest visuals & icon**

- **D-13 — App name = "Habits"** (English). `name: "Habits"`, `short_name: "Habits"`.
- **D-14 — Manifest description:** "Personal multi-year habit tracker." (Planner can wordsmith; not load-bearing.)
- **D-15 — `lang: "en"`** explicitly in the manifest. `scope: "./"` and `start_url: "./"` are explicit.
- **D-16 — Palette (dark + warm accent):**
  - `background_color: "#0f0f10"` (near-black, slightly warmer than mindful-breathing's pure `#111111`)
  - `theme_color: "#f5a623"` (amber)
  - These are also defined as CSS tokens in `css/tokens.css` (`--color-bg`, `--color-accent`) so the diagnostics page, the eventual Today view, and the manifest stay in lockstep.
- **D-17 — Icon = placeholder for P1.** Amber filled dot (or a centered amber square) on the dark background in `icon.svg`. Maskable-safe (centered glyph with safe-zone padding). **Redo during the P3 UI design phase.**
- **D-18 — Icon manifest entry:** `{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }`.

**Hosting + path strategy**

- **D-19 — All paths in HTML, manifest, and sw.js are relative** (`./`, never `/`).
- **D-20 — `sw.js` registration is guarded** by `location.protocol.startsWith('http')` plus a silent `.catch()` — matches `../mindful-breathing/index.html`'s pattern. `file://` opens never call `navigator.serviceWorker.register()`.

### Claude's Discretion

- **CSS tokens & layer setup:** the cascade-layer composer (`css/main.css` with `@import url(...) layer(...)`) is locked by STACK.md; the specific layer names and token list at P1 are planner-pick. Token names should match the eventual UI-SPEC vocabulary so P3 doesn't have to rename them.
- **Toast component skeleton:** D-08 mentions the toast is a shared primitive. Planner picks the minimal CSS + JS shape (probably `<div class="toast" role="status">`). No design decision here — just keep it accessible.
- **`APP_VERSION` location:** D-12 says one source of truth. Planner picks the file (`js/util/version.js` is a reasonable default; could also be `js/version.js` at the top of `js/`).
- **Diagnostics panel layout:** the contents are pinned in D-03; the visual layout is open. Default to a vertical key/value list.
- **HTTPS deploy target for installability testing:** PROJECT.md says GitHub Pages. Planner confirms whether it's `bielinskilukasz.github.io/habits/` or another path during the planning step. The phase-1 implementation must work under any sub-path because all paths are relative (D-19).

### Deferred Ideas (OUT OF SCOPE)

- Real icon design (amber 'H' letter mark, checkmark glyph, or wave/Fala shape) — redo during P3.
- Reset-app surface as a dedicated panel — captured by D-03/D-05 (lives in diagnostics).
- Install panel content (iOS Share / Android Install / desktop URL-bar icon) — assigned to PWA-07 / Phase 3.
- `navigator.storage.persist()` call — first IDB write is the trigger; lives in P2.
- CSS token list and full Cascade Layers composer — minimum needed for P1; richer set arrives in P3 UI-SPEC.
- Toast auto-dismiss / styling refinements — appears, persists until reload-or-close, no animations beyond a fade-in.
- `desktop.html` analytics view — stub only in P1; full layout is P6.
- Cache-busting query strings on JS module imports — alternative to the strategy in D-11; planner picks per this research.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PWA-01 | App ships `manifest.json` with name, icons, start_url, scope, display: standalone | §"manifest.json shape" + §"Maskable icon safe-zone" |
| PWA-02 | Service worker registered with cache-first strategy + versioned cache (`habits-X.Y.Z`) | §"sw.js core skeleton" + §"D-11 resolution" |
| PWA-03 | SW uses `skipWaiting()` + `clients.claim()` | §"sw.js core skeleton" + §"Update propagation" |
| PWA-04 | SW registration silently fails on `file://` | §"sw-register.js shape" |
| PWA-05 | Installable on Android Chrome, iOS Safari, desktop Chrome/Edge | §"Manifest installability checklist" + §"Validation Architecture" |
| PWA-06 | Functions fully offline once installed | §"D-11 resolution" + §"What gets pre-cached" |
| SETTINGS-07 | "Reset app" debug action that clears IDB data | §"Reset behavior in P1 vs P2" (P1 ships placeholder; P2 wires data deletion) |
| NFR-04 | App functions fully offline (no network calls except export/import) | §"D-11 resolution" — both candidate strategies meet this |
| NFR-09 | App loads/functions on `file://` | §"sw-register.js shape" + §"file:// landmines" |
| NFR-11 | Plain static files; no build step | §"Tooling Hygiene checklist" |
| NFR-12 | All paths relative; works on GitHub Pages sub-path | §"GitHub Pages sub-path validation" |

</phase_requirements>

## Summary

Phase 1 ships a single, deterministic PWA chassis: a versioned cache-first service worker, a maskable-icon-equipped Web App Manifest, two minimal HTML shells (mobile + desktop), a Cascade-Layers CSS scaffold, and a hidden diagnostics panel that gives the user (developer) a reset-shell escape hatch and a controllerchange-driven update toast. Nothing else — no IDB, no data, no cadence, no Today data.

The technical heart is **three load-bearing patterns** mirrored from `mindful-breathing` and extended:
1. **SW registration guarded** by `location.protocol.startsWith('http')` + silent `.catch()` so `file://` opens never call `navigator.serviceWorker.register()`.
2. **Versioned cache name** (`habits-0.1.0`, `habits-0.1.1`, …) where `activate` deletes everything that isn't the current name, combined with `skipWaiting()` + `clients.claim()`.
3. **All paths relative (`./`)** in HTML, manifest, and sw.js so the same bytes deploy under `file://`, `https://bielinskilukasz.github.io/habits/`, or any other sub-path with zero config.

**The seven open questions in CONTEXT.md resolve as:**

1. **JS module caching strategy (D-11):** **Stale-while-revalidate** for `js/**` (not network-first). Reasons in §"D-11 resolution" below.
2. **APP_VERSION import into sw.js (D-12):** **Classic service worker + `importScripts('./js/util/version.js')`**. Module SWs are not yet broadly Baseline on Safari/Firefox; the silent-fail penalty is unacceptable.
3. **CSS Cascade Layers minimum viable set:** `@layer reset, tokens, base, layout, components, view, utilities;` with `tokens.css` declaring colors (bg/fg/accent/muted), spacing scale (--space-1..6), type scale, radii, and `prefers-color-scheme` already wired so P3 doesn't have to rename anything.
4. **Long-press detection:** Pointer Events (`pointerdown`/`pointerup`/`pointercancel`/`pointermove`) with a 1500 ms `setTimeout`, cancelled by any of the three terminator events OR by a `pointermove` exceeding ~10 px (movement threshold). Works on touch + mouse from one code path.
5. **Update toast on `controllerchange`:** Listen to `controllerchange` on `navigator.serviceWorker`; show the toast only if `navigator.serviceWorker.controller` was already non-null before the event (i.e., this is a *replacement* SW, not the first-ever install). Toast does NOT trigger `location.reload()` automatically (D-08).
6. **GitHub Pages sub-path validation:** Relative paths (`./sw.js`, `"start_url": "./"`, `"scope": "./"`) work perfectly under any sub-path. Only landmine: the URL must have a trailing slash (`/habits/`, not `/habits`) for the SW scope to resolve to the directory. Document this in the deploy README, but no code change needed.
7. **Maskable SVG icon safe-zone:** 80% safe-zone centered in the icon. For a 512×512 SVG, the meaningful glyph sits inside a 410×410 box centered at (256,256). The outer ~10% padding can be cropped by any Android adaptive-icon mask.

**Primary recommendation:** Ship the chassis exactly as `mindful-breathing` shipped, extend with versioned cache cleanup + diagnostics + update toast + long-press + stale-while-revalidate for `js/**`. Total budget: ~250–300 lines across `sw.js`, `sw-register.js`, `diagnostics.js`, `toast.js`, `version.js`, `tokens.css`, `main.css`, two HTML shells, one SVG.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App shell HTML rendering | Browser (static HTML) | — | No SSR; no API; everything is a static file served directly. |
| Service worker lifecycle | Browser (Service Worker thread) | — | The whole point of a SW is browser-side caching. |
| Cache strategy decisions | Browser (Service Worker thread) | — | All decisions made in `sw.js`. |
| Update toast UI | Browser (main thread) | Service Worker thread (sends `controllerchange`) | Main thread renders DOM; SW thread fires the lifecycle event. |
| Diagnostics panel UI | Browser (main thread) | — | Read-only inspection of `navigator.serviceWorker`, `caches.keys()`, `matchMedia`, `APP_VERSION`. |
| Reset shell action | Browser (main thread) | Service Worker thread (target of `unregister()`) | Main thread orchestrates; SW thread is the unregistered target. |
| App icon rasterization | Browser (OS install pipeline) | — | OS (Android adaptive icons, iOS Home Screen) consumes manifest icons. |
| Static asset hosting | CDN / Static (GitHub Pages) | — | No backend; GH Pages serves the bytes. |
| Long-press detection | Browser (main thread) | — | Pure DOM event listener. |
| `?debug=1` parameter detection | Browser (main thread) | — | `URLSearchParams(location.search)`. |
| File:// safe-fail | Browser (main thread, before SW registration) | — | `location.protocol` guard. |

**Note:** All capabilities live in the browser. There is no API tier, no database tier, no edge function. This is the simplest possible client-only app — a deliberate constraint that justifies the lean phase-1 scope.

## Standard Stack

### Core (Browser-Native APIs Only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Service Worker API | W3C SW spec (living standard) | Offline cache, update propagation | [VERIFIED: MDN] Browser-native; Baseline Widely Available except `type: "module"` SW which is not Safari-Baseline yet. |
| Web App Manifest | W3C Manifest spec (living standard) | Installability, icons, start_url | [VERIFIED: MDN] Required for "Add to Home Screen" on iOS Safari and Android Chrome. |
| Cache API | living spec | The actual cache the SW reads/writes | [VERIFIED: MDN] Companion to Service Worker; same support matrix. |
| `matchMedia('(display-mode: standalone)')` | living spec | Detect "installed PWA" vs "browser tab" | [VERIFIED: MDN] Stable across all PWA-capable browsers; documented at web.dev/learn/pwa/detection. |
| Pointer Events API | W3C PEP 2 (living standard) | Long-press detection on title element | [VERIFIED: MDN] Unified touch + mouse + pen; Baseline Widely Available. |
| CSS Cascade Layers (`@layer`) | CSS Cascade Level 5 | Multi-file CSS without bundler | [VERIFIED: MDN] Baseline Widely Available since March 2022. |
| CSS Custom Properties | CSS Variables Level 1 | Tokens shared between manifest values and CSS | [VERIFIED: MDN] Baseline; universal. |
| URLSearchParams | living spec | Parse `?debug=1` | [VERIFIED: MDN] Universal. |

### Supporting (Reference Patterns, Not Libraries)

| Pattern | Source | Purpose |
|---------|--------|---------|
| `mindful-breathing/sw.js` | [VERIFIED: directly inspected] | The proven 8-line cache-first skeleton this phase extends. |
| `mindful-breathing/manifest.json` | [VERIFIED: directly inspected] | Maskable-SVG-icon + dark splash pattern; palette swap only. |
| `mindful-breathing/index.html` lines 1898–1903 | [VERIFIED: directly inspected] | `if ("serviceWorker" in navigator) { window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {})); }` — almost lift-and-shift. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Rejected Because |
|------------|-----------|----------|------------------|
| Classic SW + `importScripts` | Module SW (`type: 'module'` registration + `import` statements in sw.js) | [CITED: web.dev/articles/es-modules-in-sw] More ergonomic; lets you share modules between window context and SW context. | [CITED: github.com/w3c/ServiceWorker/issues/1582, bugzilla.mozilla.org/show_bug.cgi?id=1360870] Firefox implementation is incomplete; current stable Firefox + Safari "download and attempt to execute the ES module flavor of service worker, and only raise an exception when there's a syntax error due to the usage of ES module imports." Silent-fail is unacceptable for an offline-first app. **Use classic SW + `importScripts('./js/util/version.js')` instead.** |
| Stale-while-revalidate for `js/**` | Network-first with cache fallback | [CITED: web.dev/articles/stale-while-revalidate] Network-first guarantees freshness on reload when online; SWR serves stale on first reload, fresh on second. | Network-first **delays first paint when network is slow but available** (latency-killer on phones). SWR is faster + still updates within one reload cycle. NFR-04 (fully offline) is satisfied by both; the tiebreaker is paint speed. **Use stale-while-revalidate.** |
| Stale-while-revalidate for `js/**` | Cache-first only + cache-busting query strings (`./js/main.js?v=APP_VERSION`) | Bumps load on every release without bumping cache name. | Violates D-10 spirit (which says JS changes do NOT bump the cache key — but in this alternative, each module import gets a unique URL on each version, defeating the cache for unchanged files). Worse: requires touching every `import` site whenever APP_VERSION changes. **Rejected.** |
| Hash router for diagnostics | Plain DOM swap on `?debug=1` detection | Hash router (`#debug`) would be reachable via long-press too. | Hash router is a P2+ concern (it's part of the spine in ARCHITECTURE.md "router → today view"). In P1, the diagnostics panel is reached by `URLSearchParams` query check OR long-press handler — both call the same `mountDiagnostics()` function. **No router needed in P1.** |
| Workbox (vendored) | StaleWhileRevalidate class | Battle-tested. | [CITED: PROJECT.md constraint] No npm, no CDN, no vendoring. The cache-first SW is ~25 hand-written lines; SWR adds ~10 more. Workbox is wholesale unnecessary at this scale. |

**Version verification:** All "libraries" here are browser-native APIs, not npm packages. No `npm view` applicable. The only "version" question is whether `@layer` and `BroadcastChannel` are Baseline — both have been Baseline Widely Available since 2022 [VERIFIED: MDN].

## Package Legitimacy Audit

> **N/A for this phase.** Phase 1 installs zero packages. The constraint locked in PROJECT.md is "no npm, no CDN, no bundler, no vendoring." Every byte ships hand-written and committed to the repo. The slopcheck protocol does not apply because no external dependency is recommended.

| Package | Registry | Disposition |
|---------|----------|-------------|
| *(none)* | — | — |

## Architecture Patterns

### System Architecture Diagram

```
                              ┌─────────────────────────────────────────────────┐
                              │              GitHub Pages (or file://)          │
                              │              static asset host                  │
                              └─────────────────────────────────────────────────┘
                                                  │
                                                  │ HTTP(S) on http(s)://…/habits/
                                                  │ or file:// on direct open
                                                  ▼
                              ┌─────────────────────────────────────────────────┐
                              │            Browser main thread                  │
                              │                                                 │
                              │  index.html / desktop.html                      │
                              │     │                                           │
                              │     ▼                                           │
                              │  <link rel="stylesheet" href="./css/main.css">  │
                              │     │ (Cascade Layers @import chain)            │
                              │     ▼                                           │
                              │  <script type="module" src="./js/main.js">      │
                              │     │                                           │
                              │     ▼                                           │
                              │  main.js boots:                                 │
                              │     ├─ import { APP_VERSION } from version.js   │
                              │     ├─ checkDebugParam()  ───┐                  │
                              │     ├─ attachLongPress()  ───┤──> diagnostics.js│
                              │     ├─ swRegister()  ─────┐  │                  │
                              │     └─ wireUpdateToast()  │  │                  │
                              │                          │  │                  │
                              └──────────────────────────┼──┼──────────────────┘
                                                         │  │
                                                         │  │ (events: pointerdown,
                                                         │  │  ?debug=1 detect)
                                                         │  │
                                       location.protocol │  │
                                       startsWith('http')│  │
                                       guard +           │  │
                                       silent .catch()   │  │
                                                         │  │
                              ┌──────────────────────────▼──┼──────────────────┐
                              │     Service Worker thread (separate)            │
                              │                                                 │
                              │  sw.js (classic, importScripts version.js)      │
                              │     ├─ install → caches.open(`habits-${V}`)    │
                              │     │           → addAll(SHELL_ASSETS)          │
                              │     │           → skipWaiting()                 │
                              │     │                                           │
                              │     ├─ activate → delete non-current caches     │
                              │     │           → clients.claim()               │
                              │     │                                           │
                              │     └─ fetch:                                   │
                              │         ├─ shell asset (HTML/CSS/icon/manifest) │
                              │         │   → cache-first                      │
                              │         └─ js/**/*.js                           │
                              │             → stale-while-revalidate            │
                              │                                                 │
                              │  On new SW activation:                          │
                              │   navigator.serviceWorker.controller swaps      │
                              │     │                                           │
                              │     ▼                                           │
                              │   main thread receives 'controllerchange'       │
                              │     │                                           │
                              │     ▼                                           │
                              │   toast.show("New version ready — Reload")      │
                              └─────────────────────────────────────────────────┘
```

**Data flow narrative:**
1. User hits the deployed URL (or opens index.html via file://).
2. Browser fetches HTML, then CSS via `<link>`, then JS via `<script type="module">`.
3. JS entry point reads `APP_VERSION`, decides whether to mount diagnostics, registers SW (only if http(s)).
4. SW thread, on install, pre-caches the shell asset list under `habits-${APP_VERSION}`.
5. On activate, SW deletes any cache whose name isn't the current one, then claims clients.
6. On subsequent loads, fetch handler answers from cache (shell) or stale-while-revalidate (js/**).
7. When a new SW activates while the page is open, `controllerchange` fires → main thread renders the update toast.
8. User taps title for 1.5 s OR loads `?debug=1` → diagnostics panel mounts in place of the empty Today shell.

### Recommended Project Structure (P1 slice)

```
habits/
├── index.html                  # Mobile shell — empty Today scaffold + diagnostics anchor
├── desktop.html                # Desktop stub — "Switch to mobile" link (D-04)
├── manifest.json               # Web App Manifest
├── sw.js                       # Classic SW + importScripts('./js/util/version.js')
├── icon.svg                    # Maskable SVG (amber dot on near-black, 80% safe-zone)
│
├── css/
│   ├── main.css                # @layer composer + @import chain
│   ├── tokens.css              # CSS custom properties (colors, spacing, type, radii)
│   ├── reset.css               # Minimal modern reset
│   ├── base.css                # html/body/typography defaults
│   ├── components.css          # toast, button, panel (the few primitives P1 needs)
│   └── today.css               # Mobile-specific shell layout (header, list, footer nav)
│
├── js/
│   ├── main.js                 # Mobile entry — wires everything
│   ├── desktop.js              # Desktop entry — same SW register, redirect to index.html
│   │
│   ├── util/
│   │   └── version.js          # export const APP_VERSION = '0.1.0'; also self-runnable via importScripts
│   │
│   ├── platform/
│   │   └── sw-register.js      # The protocol-guard + silent-catch registration
│   │
│   └── views/
│       ├── diagnostics.js      # Mount/unmount diagnostics; reset-shell handler
│       └── toast.js            # Toast primitive (shared with later phases)
│
└── (no seed/, no db/, no domain/, no state/, no router/, no io/ — those start at P2+)
```

### Pattern 1: `sw.js` core skeleton

**What:** Classic service worker with versioned cache name (sourced from `version.js` via `importScripts`), pre-caching the shell asset list on install, deleting stale caches on activate, and using **two different fetch strategies** based on URL.

**When to use:** This *is* the phase-1 deliverable.

**Source:** Extends [VERIFIED: `../mindful-breathing/sw.js` directly inspected] with versioned cache + activate cleanup + skipWaiting + clients.claim + stale-while-revalidate branch.

```js
// sw.js — classic service worker, file://-safe via sw-register.js guard
importScripts('./js/util/version.js');
// version.js sets self.APP_VERSION when run via importScripts (see version.js note below)

const CACHE = `habits-${self.APP_VERSION}`;
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
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Strategy router:
//   - Shell assets (the SHELL[] manifest): cache-first.
//   - Anything under /js/ (other than the pinned shell entries): stale-while-revalidate.
//   - Anything else (currently nothing): network passthrough.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Same-origin only; cross-origin we don't intercept.
  if (url.origin !== self.location.origin) return;

  // js/** — stale-while-revalidate
  if (url.pathname.includes('/js/')) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  // Default: cache-first (shell)
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
  }).catch(() => cached); // offline → fall back to cached
  return cached || networkPromise;
}
```

### Pattern 2: `version.js` (dual-use module + importScripts target)

**What:** A file that works both as a standard ES module (when imported via `<script type="module">`) and as an `importScripts` target (when loaded into a classic service worker).

**The trick:** the same source declares `self.APP_VERSION` so it survives `importScripts`, and uses `export` so it's importable from `main.js` and `diagnostics.js`.

```js
// js/util/version.js
// Single source of truth for app version (D-12).
// Bump this string to force a new SW cache (per D-10: only on shell-asset change).
export const APP_VERSION = '0.1.0';

// Make the constant available to the service worker context, which loads this file
// via importScripts (where ES `export` is ignored, but `self.X = ...` works).
self.APP_VERSION = APP_VERSION;
```

**Why this works:**
- In the window context, `<script type="module">` parses `export const APP_VERSION = '0.1.0'`. The `self.APP_VERSION = APP_VERSION` line is a harmless side-effect on `window`.
- In the SW context, `importScripts` evaluates as a classic script. The `export` token is a SyntaxError in classic scripts — **so this must be done carefully**. Two valid approaches:
  - **Approach A (recommended):** Two files. `js/util/version.js` is the module-form (with `export`); `js/util/version.sw.js` is the SW-form (`self.APP_VERSION = '0.1.0'`). Both contain the same string literal; the planner adds a comment to the top of one explaining that bumping the constant requires changing both. **Risk: two-file drift.**
  - **Approach B:** Single file, no `export` line. Module form imports it via `import './version.js'` (side-effect import) and reads `self.APP_VERSION` or `window.APP_VERSION`. **Risk: relies on side-effect imports and globals, slightly less clean.**
  - **Approach C:** Single file via a wrapper. `js/util/version.js` has only `self.APP_VERSION = '0.1.0';`. The module-form is `js/util/version-module.js` which re-exports: `import './version.js'; export const APP_VERSION = self.APP_VERSION;`. Single source of truth, no drift, slightly more files.

**Recommendation:** **Approach B for v1** — simplest, single file, no drift, one global. The "global pollution" complaint is fully defensible at this scale (one constant). Migrate to Approach C if future SW imports grow.

### Pattern 3: `sw-register.js` (file://-safe registration + update wiring)

**What:** Encapsulates the SW registration including the protocol guard, silent catch, and update-toast wiring.

```js
// js/platform/sw-register.js
import { showUpdateToast } from '../views/toast.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return; // file:// silent skip

  // Remember whether there was already a controller before registration.
  // If there was, a future controllerchange is a real UPDATE event.
  // If there wasn't, it's the first-ever install — no toast.
  const hadController = !!navigator.serviceWorker.controller;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* silent */ });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install; don't toast
    showUpdateToast();
  });
}
```

**Note on `hadController`:** This is the canonical "real update vs first install" pattern. Without it, every first-ever install triggers an unwanted "New version ready" toast. [CITED: web.dev "Handling service worker updates"]

### Pattern 4: Long-press detection (Pointer Events, 1.5 s, movement-cancelled)

**What:** Attach a single Pointer Events listener to the app title element; trigger after 1500 ms of held press without significant movement.

```js
// js/views/diagnostics.js (excerpt)
const LONG_PRESS_MS = 1500;
const MOVE_TOLERANCE_PX = 10;

export function attachLongPress(el, onLongPress) {
  let timer = null;
  let startX = 0, startY = 0;

  el.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return; // ignore right-click
    startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => { timer = null; onLongPress(); }, LONG_PRESS_MS);
  });

  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointermove', e => {
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (dx*dx + dy*dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancel();
  });
}
```

**Why Pointer Events not Touch Events:** [VERIFIED: MDN Pointer Events] Single code path covers touch (phone), mouse (desktop), pen. Touch Events would force a separate mouse branch.

**Why 10 px movement tolerance:** A finger held on a phone typically jitters 3–8 px; 10 px is the standard threshold to filter jitter without losing real scrolls. [CITED: common HTML5 game UX literature]

### Pattern 5: `?debug=1` detection

```js
// js/main.js (excerpt)
import { mountDiagnostics } from './views/diagnostics.js';
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();
```

### Pattern 6: Toast primitive

```js
// js/views/toast.js
let toastEl = null;

export function showUpdateToast() {
  if (toastEl) return; // already showing
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.innerHTML = `
    <span class="toast-msg">New version ready</span>
    <button class="toast-action">Reload</button>
    <button class="toast-close" aria-label="Dismiss">×</button>
  `;
  toastEl.querySelector('.toast-action').addEventListener('click', () => location.reload());
  toastEl.querySelector('.toast-close').addEventListener('click', () => {
    toastEl.remove(); toastEl = null;
  });
  document.body.appendChild(toastEl);
}
```

**Why no auto-dismiss (D-08):** The toast persists until the user reloads or explicitly closes it. This is the locked decision.

### Anti-Patterns to Avoid

- **Auto-reload in `controllerchange`** — explicitly rejected (D-09). A user mid-tap suddenly reloaded loses context. Toast-and-let-user-decide is the rule.
- **`sw.js` at a path that lives under `/js/`** — would force a `Service-Worker-Allowed` header to broaden scope. Keep `sw.js` at the root (mirrors mindful-breathing) so default scope is `./`.
- **Absolute paths in HTML or manifest** — breaks GitHub Pages sub-paths. Every path must be relative `./…` (D-19).
- **Listening to `beforeinstallprompt` in P1** — Phase 3 owns the install help panel (PWA-07 → Phase 3). P1 only ships the manifest that makes the install possible.
- **Hand-coded `localStorage` writes for `lastVisitedDate` or anything else in P1** — there is no state worth persisting in P1. Save the storage decisions for P2.
- **Caching cross-origin requests** — fetch handler must early-return if `url.origin !== self.location.origin`. Mishandling cross-origin (none expected in P1, but defensive) leads to opaque-response cache bloat.
- **Using `?` cache-busting on JS imports** — defeats both browser HTTP cache and SW cache for unchanged files. D-11 chose stale-while-revalidate specifically to avoid this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting install state | A user-agent sniffer guessing if iOS Safari "added to home screen" | `window.matchMedia('(display-mode: standalone)').matches` | [VERIFIED: MDN, web.dev/learn/pwa/detection] Works across iOS, Android, desktop Chrome/Edge from one expression. UA sniffing is unreliable on iOS. |
| Detecting "real update vs first install" in `controllerchange` | Counting events, sessionStorage hacks | `const hadController = !!navigator.serviceWorker.controller` BEFORE registering | [CITED: web.dev "Handling service worker updates"] This is THE canonical pattern. |
| Long-press on touch + mouse + pen | Two separate listener trees (touchstart/touchend + mousedown/mouseup) | Pointer Events (`pointerdown`/`pointerup`/`pointercancel`/`pointermove`) | [VERIFIED: MDN Pointer Events] Unified API; Baseline Widely Available; one code path. |
| CSS specificity wars in a multi-file CSS app | BEM-only conventions, ID selectors, !important escalation | Cascade Layers (`@layer reset, tokens, base, layout, components, view, utilities;`) | [VERIFIED: MDN, Baseline since March 2022] Deterministic specificity by layer; no preprocessor needed. |
| Polish-character-safe text rendering in the manifest | Hand-escaping unicode in JSON | UTF-8 JSON; modern browsers handle it natively | [VERIFIED: W3C Manifest spec] Manifest is UTF-8 JSON by spec. |
| Versioned cache invalidation | Manual `delete-old-cache.js` deploy script | The `activate` event's `caches.keys().filter(k => k !== CACHE).map(caches.delete)` pattern | [VERIFIED: MDN Service Worker lifecycle] Standard pattern; runs on every SW activation. |
| Asking the browser to refresh the page on update | `location.reload()` inside `controllerchange` | A toast + user-initiated `location.reload()` (D-08) | UX guideline: never reload while user is mid-interaction. |

**Key insight:** The web platform now ships everything Phase 1 needs natively. Every "library" rejected in PROJECT.md (Workbox, register-service-worker, etc.) is a 2018-era helper for a problem that browser-native primitives solve in ≤25 lines.

## Runtime State Inventory

> Phase 1 is a **greenfield** phase — no rename, no refactor, no migration. There is no prior runtime state to inventory.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by repo grep (no IDB usage anywhere yet; P2 introduces it). | None |
| Live service config | None — no external services. | None |
| OS-registered state | None — no PWA installed yet (this phase creates the first installable artifact). | None |
| Secrets/env vars | None — no secrets in a static client app. | None |
| Build artifacts | None — no build step. | None |

**Section retained because the planner template asks for it on rename/refactor/migration phases. For Phase 1 it is empty by design.**

## Common Pitfalls

### Pitfall 1: Service Worker Bricks the App

**What goes wrong:** A bad `sw.js` deploy caches a broken HTML or stale JS. The old SW keeps serving stale assets that reference deleted modules; users get a white screen. [VERIFIED: PITFALLS.md §"Pitfall 2"]

**Why it happens:** No versioned cache name; or `activate` doesn't delete old caches; or no escape hatch.

**How to avoid:**
1. Versioned cache name `habits-${APP_VERSION}` (D-10, D-12).
2. `activate` deletes all caches that aren't the current name.
3. `skipWaiting()` + `clients.claim()` (D-09) so new SW takes over immediately.
4. Diagnostics panel includes a **"Reset shell"** button (D-05) that calls `registration.unregister()` + iterates `caches.keys()` + `location.reload()`.
5. Document `?debug=1` URL on the diagnostics panel itself (so a user staring at a half-broken app can still find the escape).

**Warning signs:** White screen after deploy; DevTools → Application → Service Workers shows old version stuck "waiting" with no replacement activating; offline reload broken.

### Pitfall 2: SW Registration Errors Crash the App on file://

**What goes wrong:** `navigator.serviceWorker.register()` throws on `file://` because service workers require a secure context. Unhandled, this becomes a `unhandledrejection` that bubbles up. Without the silent `.catch()` and protocol guard, the page may still render but with a console error and (worse) skipped subsequent JS.

**Why it happens:** Naive `navigator.serviceWorker.register('./sw.js')` without protocol guard or catch.

**How to avoid:**
- **TWO defenses, both required (D-20):**
  - Guard: `if (!location.protocol.startsWith('http')) return;`
  - Silent catch: `.catch(() => {})`
- Documented in `sw-register.js`. Mirrors `../mindful-breathing/index.html` lines 1898–1903 verbatim.

**Warning signs:** Console error "SecurityError" when opening index.html from disk; subsequent JS doesn't run.

### Pitfall 3: GitHub Pages Sub-Path Breakage

**What goes wrong:** App deploys to `https://bielinskilukasz.github.io/habits/`. HTML uses absolute paths (`/sw.js`, `/manifest.json`). Service worker tries to fetch `https://bielinskilukasz.github.io/sw.js` — 404. PWA install criteria fails.

**Why it happens:** Mixing absolute and relative paths.

**How to avoid:**
- **Every path is relative** (D-19): `./sw.js`, `./manifest.json`, `./icon.svg`, `./css/main.css`, etc.
- Manifest `start_url` and `scope` are `"./"` (D-15).
- The browser resolves `./` against the current document URL, so the same bytes deploy under `file://`, `https://user.github.io/habits/`, or anywhere else.

**One known landmine:** The URL must end with a trailing slash for the SW scope to resolve to the directory. [CITED: gist.github.com/kosamari/7c5d1e8449b2fbc97d372675f16b566e] `https://user.github.io/habits/` (with `/`) works; `https://user.github.io/habits` (without `/`) loses the directory context for `./sw.js` resolution. **Mitigation:** Document in README that the canonical install URL has the trailing slash. GH Pages adds it automatically when the URL points to a directory.

**Warning signs:** SW fetches fail with 404 on GH Pages; install criteria fail; manifest doesn't load.

### Pitfall 4: Module Service Worker Silent Failure on Firefox/Safari

**What goes wrong:** Registering with `{ type: 'module' }` works on Chrome but [CITED: github.com/w3c/ServiceWorker/issues/1582, bugzilla.mozilla.org/show_bug.cgi?id=1360870] "current stable versions of Firefox and Safari will download and attempt to execute the ES module flavor of service worker, and only raise an exception when there's a syntax error due to the usage of ES module imports." For an offline-first app, this means the SW silently never activates on a user's Firefox.

**Why it happens:** Using module SWs before they're Baseline.

**How to avoid:** **Use classic SW + `importScripts('./js/util/version.js')`**. Module SWs migrate later, when Firefox catches up.

**Warning signs:** Works in Chrome devtools; broken on Firefox; no obvious error.

### Pitfall 5: Maskable Icon Cropping Eats the Glyph

**What goes wrong:** On Android, the OS applies a circular/squircle/teardrop mask to the icon. If the glyph isn't in the inner 80% safe-zone, parts get cropped.

**Why it happens:** Designing the icon to fill the full 512×512 viewBox.

**How to avoid:**
- [CITED: web.dev/articles/maskable-icon] The icon's meaningful content must fit inside a circle with diameter = 80% of the icon's edge. For a 512×512 viewBox, this is a circle of radius 205 centered at (256, 256).
- **Geometry for the P1 placeholder icon (amber dot on near-black):**
  - viewBox: `0 0 512 512`
  - Background rect: full canvas, `fill="#0f0f10"`, no rounding (the OS supplies the corner radius via mask).
  - Glyph: filled circle, `cx="256" cy="256" r="160"`, `fill="#f5a623"`. r=160 sits comfortably inside the safe-zone radius of 205.
- Test with [CITED: maskable.app] before declaring done. Drop the SVG in; preview circle/square/teardrop/squircle masks.

**Warning signs:** Icon on Android home screen looks cut off; logo hidden behind mask edge; user sees clipped glyph.

### Pitfall 6: Update Toast Shows on First-Ever Install

**What goes wrong:** Without the `hadController` check, every brand-new install (where `navigator.serviceWorker.controller` was null) triggers the "New version ready" toast as soon as the SW finishes installing — confusing the user who just opened the app for the first time.

**How to avoid:** Capture `navigator.serviceWorker.controller` value BEFORE registering (see `sw-register.js` pattern above). [CITED: web.dev "Handling service worker updates"]

**Warning signs:** Brand-new user sees "New version ready" toast on first visit.

### Pitfall 7: Long-Press Triggers During a Normal Tap-and-Scroll

**What goes wrong:** User taps the title element to focus on it, then drags to scroll the page. Without a movement-cancellation rule, the long-press timer fires after 1.5 s even though the user has moved their finger far away.

**How to avoid:** Cancel the timer on `pointermove` if distance from `pointerdown` exceeds ~10 px (see Pattern 4 above).

**Warning signs:** Diagnostics panel pops up unexpectedly when user tries to scroll.

## Code Examples

### Example 1: Complete `manifest.json`

```json
{
  "name": "Habits",
  "short_name": "Habits",
  "description": "Personal multi-year habit tracker.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0f0f10",
  "theme_color": "#f5a623",
  "lang": "en",
  "dir": "ltr",
  "icons": [
    {
      "src": "icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

[CITED: MDN Web App Manifest tutorial — CycleTracker; mindful-breathing/manifest.json directly inspected]

### Example 2: Complete `icon.svg` (placeholder)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f0f10"/>
  <circle cx="256" cy="256" r="160" fill="#f5a623"/>
</svg>
```

**Note:** No `rx` on the background rect. The OS applies the corner mask via maskable-icon protocol. The 160-radius amber circle sits centered in the 205-radius safe zone.

### Example 3: `css/main.css` (Cascade Layers composer)

```css
@layer reset, tokens, base, layout, components, view, utilities;

@import url("./reset.css")      layer(reset);
@import url("./tokens.css")     layer(tokens);
@import url("./base.css")       layer(base);
@import url("./components.css") layer(components);
/* today.css and desktop.css are linked separately per HTML shell so they go in layer(view)
   via their own @layer view { ... } wrapper, OR are imported here conditionally. */
```

[CITED: MDN @layer; Baseline Widely Available]

### Example 4: `css/tokens.css` (minimum viable set)

```css
@layer tokens {
  :root {
    /* Palette — locked in D-16 */
    --color-bg: #0f0f10;
    --color-fg: #f5f5f5;
    --color-fg-muted: rgba(245, 245, 245, 0.55);
    --color-fg-faint: rgba(245, 245, 245, 0.32);
    --color-accent: #f5a623;
    --color-accent-soft: rgba(245, 166, 35, 0.18);
    --color-surface: #18181a;
    --color-border: rgba(255, 255, 255, 0.08);

    /* Spacing scale */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;
    --space-7: 48px;

    /* Type scale */
    --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --text-xs: 11px;
    --text-sm: 13px;
    --text-md: 15px;
    --text-lg: 18px;
    --text-xl: 24px;
    --text-2xl: 32px;

    /* Radii */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;

    /* Z-index layers */
    --z-toast: 1000;
    --z-overlay: 2000;
  }
}
```

**Why these tokens, not fewer:** P3's UI-SPEC will need color/spacing/type/radius vocabulary regardless. Establishing the names now (so P3 doesn't have to rename `--color-bg` to `--bg-primary`) costs nothing and prevents churn.

**Why no light theme yet:** Defer to P3. P1's diagnostics panel is the only UI — dark-only is fine.

### Example 5: Minimal `desktop.html` stub (D-04)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Habits — Desktop (coming soon)</title>
  <meta name="description" content="Personal multi-year habit tracker.">
  <meta name="theme-color" content="#f5a623">
  <link rel="manifest" href="./manifest.json">
  <link rel="apple-touch-icon" href="./icon.svg">
  <link rel="icon" href="./icon.svg">
  <link rel="stylesheet" href="./css/main.css">
</head>
<body>
  <main class="stub">
    <h1>Habits</h1>
    <p>The desktop analytics layout ships in a later phase.</p>
    <p><a href="./index.html">Open the mobile view →</a></p>
  </main>
  <script type="module" src="./js/desktop.js"></script>
</body>
</html>
```

### Example 6: `js/desktop.js` (the trivial entry)

```js
// js/desktop.js
import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics } from './views/diagnostics.js';

registerServiceWorker();

const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact for P1 |
|--------------|------------------|--------------|---------------|
| `Date.toISOString()` for dates | Local `YYYY-MM-DD` strings via `util/date.js` | Always — has always been the right answer | P1 doesn't write any dates yet; P2 establishes the pattern. |
| AppCache (`<html manifest>`) | Service Worker + Cache API | 2018 (AppCache deprecated) | We're already on SW. |
| `application/manifest+json` content-type required | Browsers accept any served as JSON if linked via `<link rel="manifest">` | Stabilized ~2020 | Just link with `rel="manifest"`; GH Pages serves correct content-type automatically. |
| `apple-mobile-web-app-capable` meta (legacy iOS PWA hint) | Web App Manifest `display: standalone` (modern, cross-platform) | iOS 11.3 (2018) supports manifest; legacy meta still recommended for iOS safety | **Include both:** `<meta name="apple-mobile-web-app-capable" content="yes">` + manifest `display: standalone`. Matches mindful-breathing/index.html exactly. |
| Classic SW + `importScripts` | Module SW (`type: 'module'`) | Chrome 80 (2020), Safari 16.4 (2023), **Firefox: still in progress** | **Stay classic in P1.** Migrate when Firefox ships module SWs. |
| `beforeunload` for state flush | `visibilitychange` → `hidden` | MDN deprecation note ~2019 | P1 has no state to flush; P2's lifecycle.js gets this right. |
| File System Access API for downloads | Blob + anchor download | Always (file:// + Safari gap) | P1 doesn't export anything; P5's job. |

**Deprecated/outdated to actively avoid:**
- `AppCache` — removed from spec; use Service Worker.
- `localStorage` for "habit data" — quota too small; use IndexedDB (P2).
- Web SQL — removed from modern browsers.
- `beforeunload` — unreliable on mobile; not used.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stale-while-revalidate for `js/**` is the right tradeoff between freshness and offline reliability for D-11. | §"D-11 resolution" / Alternatives | If wrong: a user might run on stale modules for one reload after a deploy. **Mitigation:** the update toast already exists (controllerchange fires when the SW activates after the SW file itself changes), so the user gets a "Reload" prompt that clears the SWR cache via the new cache name. Net: stale modules persist at most until the user accepts the toast. **Risk: LOW.** |
| A2 | Approach B for `version.js` (single file, side-effect import, `self.APP_VERSION` global) is cleaner than Approach A (two files) or Approach C (wrapper file). | §"Pattern 2: version.js" | If wrong: planner picks A or C, both equally correct. **Risk: NONE** — this is a style preference, not a correctness question. |
| A3 | 10 px movement tolerance + 1500 ms long-press is the right calibration for a phone-held-in-hand. | §"Pattern 4: Long-press" | If too short: accidental triggers during normal taps. If too long: user gives up. **Mitigation:** these are constants in one file; the user can tune after first feel. **Risk: LOW** (well within standard mobile UX literature range). |
| A4 | `<meta name="apple-mobile-web-app-capable" content="yes">` is still recommended for iOS Safari 2026 even with a valid manifest. | §"State of the Art" | If unnecessary: harmless meta tag adds 0 KB. If needed and missing: iOS install may show URL bar in standalone mode. **Risk: NEGLIGIBLE** — mindful-breathing/index.html includes it; carry forward. |
| A5 | The GitHub Pages deploy path is `bielinskilukasz.github.io/habits/`. | §"GitHub Pages sub-path validation" | If wrong: still works because all paths are relative (D-19). **Risk: NONE.** |
| A6 | `?debug=1` as the URL parameter name (not `?diagnostics`, not `?dev`). | §"Pattern 5" | Naming choice; no correctness implication. **Risk: NONE.** |
| A7 | Stale-while-revalidate's correctness depends on the SW being the canonical source of cached responses. If the browser HTTP cache holds an older copy, SWR's `fetch(request)` might return that copy. | §"Pattern 1" | **Mitigation:** the SW's network request goes through the HTTP cache, but the browser HTTP cache for served-via-SW resources is typically bypassed. **Risk: LOW** — would manifest as one extra reload to pick up the change; not a correctness bug. |

**If this table is non-empty:** Several entries are intentionally assumptions — the planner and discuss-phase can lock or revise during planning. None are blocking.

## Open Questions

None blocking. The seven CONTEXT.md open research questions are resolved in this document:

1. ✅ **D-11 cache strategy:** Stale-while-revalidate for `js/**`. (See Pattern 1 + Alternatives table.)
2. ✅ **D-12 APP_VERSION import:** Classic SW + `importScripts('./js/util/version.js')`. (See Pattern 2.)
3. ✅ **CSS Cascade Layers minimum viable composer:** `@layer reset, tokens, base, layout, components, view, utilities;` + token list. (See Examples 3-4.)
4. ✅ **Long-press detection:** Pointer Events + 1500 ms + 10 px tolerance. (See Pattern 4.)
5. ✅ **`controllerchange` + update toast:** `hadController` capture before register; toast only when truly an update. (See Pattern 3.)
6. ✅ **GitHub Pages sub-path validation:** Relative paths suffice; trailing-slash convention is the only quirk. (See Pitfall 3.)
7. ✅ **Maskable SVG icon safe-zone:** 80% safe-zone; 512×512 viewBox with glyph in inner 410×410. (See Pitfall 5 + Example 2.)

## Environment Availability

> Phase 1 introduces all of its own external dependencies. The only environmental requirements are:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browser with Service Worker support | PWA-02, PWA-03, PWA-06 | ✓ | All evergreen 2026 browsers | n/a — silent-fail on file:// (D-20) |
| Browser with `matchMedia('(display-mode: …)')` | Diagnostics install-state row (D-03) | ✓ | All PWA-capable browsers (Baseline Widely Available) | Render "unknown" if API missing |
| Browser with Pointer Events | Long-press detection (D-02) | ✓ | Baseline Widely Available | Fall back to `touchstart`/`mousedown` if `PointerEvent` is undefined |
| Browser with CSS Cascade Layers | All UI in P1 (CSS scaffold) | ✓ | Baseline Widely Available since March 2022 | n/a — required by stack lock |
| Local HTTP server for SW testing | Smoke testing PWA-02..06 locally before GH Pages deploy | Unverified — author preference | Any (`python -m http.server`, `npx serve`, etc.) | None needed: GH Pages preview deploy works too |
| GitHub Pages (or equivalent static host) | PWA-05 (installability requires HTTPS) | Unverified — assumed configured | n/a | Could deploy to Netlify/Vercel/Cloudflare Pages; relative paths work everywhere |
| Android Chrome (test device) | PWA-05 acceptance | Unverified — user owns | Latest stable | Skip Android test; ship and verify post-merge |
| iOS Safari (test device) | PWA-05 acceptance | Unverified — user owns | iOS 16+ (for full SW support) | Skip iOS test; ship and verify post-merge |
| Desktop Chrome or Edge | PWA-05 acceptance | ✓ — author's dev machine has both | Latest | n/a |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Test-device coverage may require deferring real-device PWA install verification to a hands-on session post-merge. This is acceptable for an MVP/Walking-Skeleton phase.

## Validation Architecture

> Project config has `nyquist_validation: true`. Section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None automated.** Phase 1 deliberately ships no test runner because PROJECT.md forbids npm/build tooling. Verification is **manual + browser DevTools-driven smoke testing**. |
| Config file | n/a |
| Quick run command | `python -m http.server 8000` (or any static server) — then open `http://localhost:8000/` and run the manual checklist below. |
| Full suite command | Same; `Quick` = subset of `Full` checklist. |

**Justification for manual-only:** PROJECT.md explicitly forbids any tooling that requires `npm` or a build step. Test runners (Vitest, Playwright, etc.) all require npm. The locked constraint outweighs the convenience of automation. Per ARCHITECTURE.md's note on "unit-reasoned without a test runner," domain logic gets reasoned about by import-into-a-scratch-HTML-page. For P1, there is no domain logic — only browser-platform integration. Manual smoke testing is the standard verification model for SW + manifest correctness anyway (you have to actually install on a phone to verify install criteria).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification | File Exists? |
|--------|----------|-----------|--------------|--------------|
| PWA-01 | manifest.json valid (name, icons, start_url, scope, display) | Static analysis | `cat manifest.json` + DevTools → Application → Manifest tab shows no errors | ❌ (created in this phase) |
| PWA-02 | SW registers with cache-first + versioned cache (`habits-X.Y.Z`) | Browser DevTools | Open app over `http://localhost:8000`, DevTools → Application → Service Workers shows registered SW; Application → Cache Storage shows `habits-0.1.0` | ❌ (created in this phase) |
| PWA-03 | `skipWaiting()` + `clients.claim()` | Browser DevTools | Bump APP_VERSION to `v2`, redeploy locally, reload → DevTools shows old `habits-0.1.0` cache deleted, new `habits-0.1.1` active, no "waiting" SW | ❌ |
| PWA-04 | SW silently fails on `file://` | Manual | Open `index.html` directly via `file://`. DevTools console shows NO errors. `navigator.serviceWorker.controller` is null. Page loads cleanly. | ❌ |
| PWA-05 | Installable on Android Chrome | Manual on device | Deploy to GH Pages → open URL on Android Chrome → "Install" prompt appears OR Settings → Add to Home Screen completes; opened from home screen shows no URL bar | ❌ |
| PWA-05 | Installable on iOS Safari | Manual on device | Open URL on iOS Safari → Share → "Add to Home Screen" succeeds; opened icon launches standalone (no Safari chrome) | ❌ |
| PWA-05 | Installable on desktop Chrome/Edge | Manual on device | Open URL on desktop Chrome → URL bar shows install icon → install completes → standalone window opens | ❌ |
| PWA-06 | Functions fully offline once installed | Manual | After install, DevTools → Network → "Offline" → reload → page loads, no errors | ❌ |
| SETTINGS-07 (placeholder in P1) | "Reset shell" button unregisters SW + clears caches + reloads | Manual | Open diagnostics (long-press title OR `?debug=1`) → click "Reset shell" → confirm → page reloads, DevTools shows SW unregistered, cache cleared, then re-registered on reload | ❌ |
| NFR-04 | Fully offline (no network calls except export/import — none in P1) | Manual | Install app, go offline, reload, navigate. DevTools → Network shows zero outbound requests. | ❌ |
| NFR-09 | Loads/functions on `file://` | Manual | `start index.html` (Windows) or `open index.html` → page loads, console clean | ❌ |
| NFR-11 | Plain static files; no build step | Static analysis | `ls habits/` shows no `node_modules/`, no `package.json`, no `dist/`, no `build/`. Just HTML/JS/CSS/JSON/SVG. | ❌ |
| NFR-12 | All paths relative; works on GH Pages sub-path | Static analysis + deploy | `grep -rE '"/[a-z]' index.html desktop.html manifest.json sw.js` returns nothing. Deploy to GH Pages → verify SW registers under sub-path. | ❌ |

### Manual Smoke-Test Checklist (run on every release)

This is the canonical "Looks Done But Isn't" list for Phase 1, derived from PITFALLS.md and the success criteria:

1. **File:// open** — `open index.html` directly. Console clean. No SW registered. Page renders.
2. **HTTPS install (desktop)** — Push to GH Pages. Open in Chrome. Install via URL-bar icon. Standalone window opens.
3. **HTTPS install (Android)** — Open URL on Android Chrome. Install prompt or Add to Home Screen. Launch from home screen icon. Standalone (no URL bar).
4. **HTTPS install (iOS)** — Open URL on iOS Safari. Share → Add to Home Screen. Launch from icon. Standalone (no Safari chrome).
5. **Offline reload (installed)** — From installed PWA: enable airplane mode → reload → page loads, no errors.
6. **Cache version bump** — Bump `APP_VERSION` to `'0.1.1'` in `version.js`. Redeploy. Hard-reload. DevTools → Cache Storage shows OLD `habits-0.1.0` deleted, NEW `habits-0.1.1` active. Update toast fires.
7. **Reset shell** — Long-press title (or `?debug=1`) → diagnostics → "Reset shell" → confirm → reload → DevTools shows SW unregistered, cache cleared, then re-registered.
8. **Long-press doesn't fire on scroll** — Tap title and immediately drag-scroll. Diagnostics should NOT mount.
9. **Update toast doesn't fire on first install** — Clear all site data → fresh install → SW activates → NO toast.
10. **Diagnostics on long-press, mobile** — Hold title for 1.5 s → panel mounts.
11. **Diagnostics on `?debug=1`** — Open `index.html?debug=1` → panel mounts.
12. **`display-mode: standalone` detection** — Open installed PWA → diagnostics shows "Install state: standalone". Open in browser tab → diagnostics shows "Install state: browser".
13. **Polish characters render in fonts** — (UI is English in P1, but verify system fonts handle ą ć ł — manifest description is English so not actually testable here; deferred to P3.)
14. **GitHub Pages sub-path** — Deploy to `https://bielinskilukasz.github.io/habits/`. Open URL. SW registers under `/habits/` scope. Install works. Offline reload works.

### Sampling Rate

- **Per task commit (developer machine):** Items 1, 11 (file:// open + `?debug=1`). 30 seconds. Catches most regressions.
- **Per merge to main:** All 14 items if PWA shell changed. ~15 minutes. Manual.
- **Phase gate (Phase 1 acceptance):** All 14 items, including the three device-install tests (Android + iOS + desktop). One-time hands-on session.

### Wave 0 Gaps

P1 ships every test artifact it needs (which is "none — manual only"). There is no missing test infrastructure for Phase 1.

- ✅ No test framework gap (deliberately none).
- ✅ Manual smoke-test checklist above is the canonical verification surface.
- ⚠️ **Real-device install verification deferred until phase gate** — relies on author having Android + iOS devices accessible. If not available, P1 can ship the chassis with desktop-only verification and the device tests get scheduled post-merge as a follow-up checklist item. This is acceptable for an MVP phase per the project's hands-on-only-when-real workflow.

## Security Domain

> Project config has `security_enforcement: true`, ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no** | Single-user app, no accounts, no auth surface. |
| V3 Session Management | **no** | No sessions; no server. |
| V4 Access Control | **no** | No multi-tenant access; everything is user-local. |
| V5 Input Validation | **partial** | Only input in P1 is `?debug=1` parameter — pure boolean check, no user data flows through it. Also: manifest description is hard-coded, icon path is hard-coded, no user-supplied data exists yet. Full V5 enforcement applies in P5 (JSON import). |
| V6 Cryptography | **no** | Nothing to encrypt; nothing crosses a trust boundary. |
| V7 Errors & Logging | **partial** | The silent `.catch()` on SW registration is INTENTIONAL hiding (file:// safe-fail). Other errors should be logged to console — diagnostics panel surfaces SW error state. |
| V11 Business Logic | **no** | No business logic in P1. |
| V12 File & Resources | **partial** | No file uploads in P1. Icon SVG is internally authored; no SVG injection vector. |
| V13 API & Web Services | **no** | No APIs called from P1. NFR-04 explicitly forbids it. |
| V14 Configuration | **yes** | Manifest config + SW scope must be correct (see Pitfalls). |

### Known Threat Patterns for Static PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service worker scope hijacking | Tampering | Manifest `scope: "./"` + SW registered at root (`./sw.js`) so default scope matches manifest. [VERIFIED: MDN Service Worker scope] |
| Stale cache serves dangerous old code | Tampering | Versioned cache name + `activate` cleanup + update toast (D-08–D-10). |
| SW caches cross-origin opaque responses | Information Disclosure | `fetch` handler early-returns if `url.origin !== self.location.origin`. (See Pattern 1.) |
| Malicious manifest tampering | Tampering | Manifest served from same origin via HTTPS (GH Pages enforces this); no third-party CDN. |
| XSS via long-press title (if title contained user data) | Tampering / XSS | Title is hard-coded in P1. When P3 adds user-content rendering, all user strings must use `textContent`, never `innerHTML`. (See PITFALLS.md security table.) |
| Network call leakage / telemetry | Information Disclosure | Grep gate: `grep -rE 'fetch\(.*://[^./]' js/ → empty`. NFR-05 (P6) makes this an explicit acceptance criterion; P1 must already comply. |
| Service worker remains registered with wrong scope after rename | Tampering | The diagnostics panel's "Reset shell" button is the recovery path. |

**V14 Configuration concrete checks for P1:**
- `manifest.json` does NOT include any URL pointing off-origin.
- `sw.js` does NOT add cross-origin URLs to the cache.
- `sw-register.js` uses `./sw.js`, never `https://…`.
- No `<script src="https://…">` or `<link href="https://…">` in HTML.
- No `eval`, no `new Function`, no `innerHTML` with anything but author-controlled strings.

## Walking Skeleton Notes

> Phase 1 is the first MVP slice of a new project. SKELETON.md will be generated by the planner; this section informs what the Walking Skeleton must prove end-to-end.

### What the Skeleton Must Prove

The thinnest possible end-to-end story:

1. **A user opens `index.html` from disk (`file://`)** → page renders the empty Today scaffold. Console clean. No SW registration attempted.
2. **A user opens the same `index.html` over `http://localhost:8000`** → page renders identically. SW registers. Cache `habits-0.1.0` populates with the shell asset list.
3. **A user goes offline (DevTools → Network → Offline) and reloads** → page loads from cache. Empty Today scaffold renders identically.
4. **A user navigates to `?debug=1`** → diagnostics panel mounts in place of the empty scaffold, showing app version, SW state, cache name, install state.
5. **A user long-presses the title for 1.5 s** → diagnostics panel mounts.
6. **A user clicks "Reset shell" in diagnostics** → confirm dialog → unregister SW + clear caches + reload → fresh install.
7. **A developer bumps `APP_VERSION` to `'0.1.1'` in `version.js` and redeploys** → on next page load (while the old version is still open in a tab), `controllerchange` fires → toast "New version ready — Reload" appears. User clicks Reload → new cache `habits-0.1.1` active, old `habits-0.1.0` deleted.

### What the Skeleton Does NOT Prove (Out of P1 Scope)

- No habit data, no IDB, no seed.
- No real Today view (just the empty chrome).
- No real Settings panel (just the diagnostics escape hatch).
- No real "Reset data" action (placeholder button only).
- No persistence-state surfacing (placeholder "n/a (P2)").
- No install help (deferred to P3 PWA-07).
- No real icon design (placeholder amber dot).

### Smallest End-to-End Deliverable Slice

```
File set (minimum):
  - index.html       (empty Today scaffold + script wiring)
  - desktop.html     (D-04 stub)
  - manifest.json    (PWA-01)
  - sw.js            (PWA-02, PWA-03)
  - icon.svg         (D-17 placeholder, maskable-safe)
  - css/main.css     + tokens.css + reset.css + base.css + components.css + today.css
  - js/main.js
  - js/desktop.js
  - js/util/version.js          (D-12)
  - js/platform/sw-register.js  (D-20, controllerchange wiring)
  - js/views/diagnostics.js     (D-02, D-03, D-05, D-06)
  - js/views/toast.js           (D-08)

Total: ~14 files, ~250–300 LOC.
```

### Walking Skeleton Acceptance Sequence

Run in this order — each step unlocks the next:

1. ✅ `index.html` opens via `file://`, renders, console clean.
2. ✅ `python -m http.server 8000` → `http://localhost:8000/` → page loads, SW registers, `habits-0.1.0` cache populated.
3. ✅ DevTools offline → reload → page still renders.
4. ✅ `?debug=1` → diagnostics mounts with all six rows present.
5. ✅ Long-press title 1.5 s → diagnostics mounts.
6. ✅ "Reset shell" → reload → fresh state.
7. ✅ Bump APP_VERSION → redeploy → update toast appears in the still-open tab.
8. ✅ Push to GH Pages → install on at least desktop Chrome → standalone window opens → offline reload still works.

Steps 1–7 are developer-machine. Step 8 is the phase-gate hands-on check.

## Sources

### Primary (HIGH confidence)

- [VERIFIED: directly inspected] `../mindful-breathing/sw.js` — the 8-line cache-first pattern this phase extends.
- [VERIFIED: directly inspected] `../mindful-breathing/manifest.json` — the maskable-SVG-icon + dark splash pattern.
- [VERIFIED: directly inspected] `../mindful-breathing/index.html` lines 1898–1903 — the silent-`.catch()` registration pattern.
- [VERIFIED: directly inspected] `../mindful-breathing/icon.svg` — the SVG-on-near-black maskable shape.
- [VERIFIED: read] `.planning/PROJECT.md` — locked stack constraints.
- [VERIFIED: read] `.planning/REQUIREMENTS.md` — PWA-01..06, SETTINGS-07, NFR-04, NFR-09, NFR-11, NFR-12.
- [VERIFIED: read] `.planning/ROADMAP.md` §"Phase 1" — goal + success criteria.
- [VERIFIED: read] `.planning/research/STACK.md` — full SW pattern, two-shell layout, Cascade Layers, maskable icon, scope rule.
- [VERIFIED: read] `.planning/research/ARCHITECTURE.md` — §7 build order locks P1 to SW + manifest + shell + diagnostics.
- [VERIFIED: read] `.planning/research/PITFALLS.md` — Pitfall 2 (SW bricks), Pitfall 7 (install ergonomics), Integration Gotchas.
- [VERIFIED: read] `.planning/research/FEATURES.md` — confirms P1 doesn't accidentally pull in P2+ features.
- [VERIFIED: read] `.planning/research/SUMMARY.md` — top-level synthesis.
- [CITED: MDN] [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [CITED: MDN] [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/CycleTracker/Manifest_file)
- [CITED: MDN] [@layer (Cascade Layers, Baseline status)](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CITED: MDN] [`Create a standalone app` — `display-mode: standalone` detection](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app)
- [CITED: MDN] [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [CITED: MDN] [WorkerGlobalScope.importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts)

### Secondary (MEDIUM confidence)

- [CITED: web.dev] [Maskable icons — adaptive icon support in PWAs](https://web.dev/articles/maskable-icon) — 80% safe-zone rule.
- [CITED: web.dev] [ES modules in service workers](https://web.dev/articles/es-modules-in-sw) — Firefox/Safari silent-fail rationale.
- [CITED: web.dev] [Stale-while-revalidate](https://web.dev/articles/stale-while-revalidate) — the SWR pattern rationale.
- [CITED: developer.chrome.com] [Handling service worker updates with immediacy](https://developer.chrome.com/docs/workbox/handling-service-worker-updates) — controllerchange + hadController pattern.
- [CITED: github.com] [w3c/ServiceWorker#1582 — Feature detection for type="module"](https://github.com/w3c/ServiceWorker/issues/1582) — Firefox/Safari module SW gap.
- [CITED: bugzilla.mozilla.org] [Bug 1360870 — Implement "module" service workers](https://bugzilla.mozilla.org/show_bug.cgi?id=1360870) — Firefox implementation status.
- [CITED: gist.github.com] [ServiceWorker for github pages](https://gist.github.com/kosamari/7c5d1e8449b2fbc97d372675f16b566e) — trailing-slash + sub-path scope behavior.
- [CITED: deanhume.com] [Displaying a new-version-available banner](https://deanhume.com/displaying-a-new-version-available-progressive-web-app/) — toast UX pattern.

### Tertiary (LOW confidence — but corroborated)

- [CITED: maskable.app] — interactive maskable-icon previewer for shape testing.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every browser API used is Baseline; every pattern is mirrored from a directly-inspected reference project.
- Architecture: **HIGH** — locked upstream in STACK.md and ARCHITECTURE.md; this phase ships only the chassis, no novel architectural decisions.
- Pitfalls: **HIGH** — pre-mined by PITFALLS.md Pitfall 2 + Pitfall 7; this document refines with concrete recovery paths.
- D-11 resolution (SWR vs network-first): **HIGH** — stale-while-revalidate is the canonical pattern for "fresh enough, offline-resilient" JS module delivery [VERIFIED: web.dev].
- D-12 resolution (importScripts vs module SW): **HIGH** — module SW is not yet broadly supported on Firefox stable [CITED: bugzilla.mozilla.org#1360870]; classic SW is the safe choice.
- Maskable icon math: **HIGH** — 80% safe-zone is the W3C spec [VERIFIED: web.dev].
- Long-press pattern: **MEDIUM-HIGH** — pointer-events approach is well-documented; 10 px tolerance is a calibration choice that may need feel-testing on the user's actual phone.
- GitHub Pages sub-path: **HIGH** — relative paths trivially survive sub-paths; the only landmine is trailing-slash convention.

**Research date:** 2026-05-26
**Valid until:** 2026-08-26 (90 days — stable web-platform APIs, slow-moving)
