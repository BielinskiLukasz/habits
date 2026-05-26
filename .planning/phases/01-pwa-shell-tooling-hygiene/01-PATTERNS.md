# Phase 1: PWA Shell & Tooling Hygiene - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 16 new files
**Analogs found:** 16 / 16 (all map to the sibling reference project `../mindful-breathing/`)

## Greenfield Notice

The Habits repo (`C:\Users\lukasz.bielinski\projects\habits\`) currently contains **no source code** — only `CLAUDE.md`, `docs/`, `Nawyki v1.xlsx`, and `Nawyki-fale.txt`. There are no in-repo analogs.

CONTEXT.md (§Reusable Assets) and RESEARCH.md (§Sources, §Pattern 1) both designate the sibling project at `C:\Users\lukasz.bielinski\projects\mindful-breathing\` as the **canonical pattern reference**. Every analog excerpt below is lifted from that directory. The mindful-breathing project ships the proven, file://-safe, zero-build PWA chassis (sw.js: 11 lines; manifest.json: 17 lines; icon.svg: 5 lines; single-file index.html with inline SW registration). Phase 1 mirrors its structural shape and extends with versioned cache cleanup, two-shell layout, Cascade Layers CSS, a diagnostics panel, an update toast, and the controllerchange wiring.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `index.html` | entry-point (HTML shell) | request-response (load → render) | `../mindful-breathing/index.html` (lines 1-14) | role-match (head + meta + manifest link + SW boot) |
| `desktop.html` | entry-point (HTML shell) | request-response (load → render) | `../mindful-breathing/index.html` (lines 1-14) | role-match (same head shape; trivial body) |
| `manifest.json` | config (PWA manifest) | static asset | `../mindful-breathing/manifest.json` | exact (swap name/palette/icon only) |
| `sw.js` | sw (cache lifecycle) | event-driven (install/activate/fetch) | `../mindful-breathing/sw.js` | role-match (extend: versioned cache, activate cleanup, skipWaiting, clients.claim, SWR branch) |
| `icon.svg` | config (PWA icon) | static asset | `../mindful-breathing/icon.svg` | exact (swap palette + glyph; remove `rx`) |
| `css/main.css` | styles (Cascade Layers composer) | static asset | `../mindful-breathing/index.html` `<style>` block (lines 15-870 inline) | partial (mb uses a single inline `<style>`; Nawyki composes multiple files via `@layer` + `@import`) |
| `css/tokens.css` | styles (custom properties) | static asset | `../mindful-breathing/index.html` `:root{…}` (lines 16-22) | role-match (custom properties pattern; Nawyki adds full token set) |
| `css/reset.css` | styles (modern reset) | static asset | no direct analog (mb has minimal body reset only) | no analog → use RESEARCH.md §Example 3 |
| `css/base.css` | styles (typography + body) | static asset | `../mindful-breathing/index.html` `body{}` (lines 24-34) | partial |
| `css/components.css` | styles (toast/button/panel) | static asset | `../mindful-breathing/index.html` `.container/.iconToggle/...` (multiple) | partial — component-naming pattern only |
| `css/today.css` | styles (mobile shell layout) | static asset | none (Today scaffold is new) | no analog → use RESEARCH.md §Walking Skeleton |
| `js/main.js` | module (mobile entry) | request-response (boot) | `../mindful-breathing/index.html` `<script>` block (lines 1040-1903) — esp. SW-register block at 1898-1903 | role-match (entry-point that registers SW + wires events) |
| `js/desktop.js` | module (desktop entry) | request-response (boot) | same as `js/main.js` | role-match (smaller — trivial entry) |
| `js/util/version.js` | module (constant) | static read | none (mb hard-codes `'mb-v1'` inline in sw.js line 1) | no direct analog → use RESEARCH.md §Pattern 2 |
| `js/platform/sw-register.js` | module (SW lifecycle wiring) | event-driven (load, controllerchange) | `../mindful-breathing/index.html` lines 1898-1903 (silent-catch registration) | role-match (lift verbatim; extend with controllerchange + hadController) |
| `js/views/diagnostics.js` | view-component (debug panel) | event-driven (pointerdown, click) | none (mb has no diagnostics panel) | no analog → use RESEARCH.md §Pattern 4 + §Pattern 5 |
| `js/views/toast.js` | view-component (toast primitive) | event-driven (controllerchange → DOM) | none (mb has no toast) | no analog → use RESEARCH.md §Pattern 6 |

## Pattern Assignments

### `sw.js` (sw, event-driven)

**Analog:** `../mindful-breathing/sw.js` (entire file, 11 lines)

**Core pattern** (`../mindful-breathing/sw.js` lines 1-10):
```js
const CACHE = 'mb-v1';
const ASSETS = ['./', './index.html', './icon.svg', './manifest.json'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
);
```

**What Nawyki copies verbatim:**
- The `caches.open(CACHE).then(c => c.addAll(...))` install-time pre-cache pattern (line 5).
- The `caches.match(e.request).then(r => r || fetch(e.request))` cache-first fetch pattern (line 9).
- Relative-only paths in the asset list (`'./'`, `'./index.html'`, etc.) — D-19 alignment.

**What Nawyki adds/changes (per RESEARCH.md §Pattern 1 + D-09, D-10, D-11, D-12):**
1. Pull `CACHE` name from `self.APP_VERSION` via `importScripts('./js/util/version.js')` (line 1).
2. Expand `SHELL` to include all `./css/*.css` and `./js/**/*.js` entries that should be pre-cached.
3. Append `.then(() => self.skipWaiting())` to the install handler (D-09).
4. Add an **`activate` handler** that calls `caches.keys()`, deletes any cache whose name !== current `CACHE`, then awaits `self.clients.claim()`.
5. Add a **strategy router** inside the `fetch` handler: same-origin early-return; `if (url.pathname.includes('/js/')) → staleWhileRevalidate(request)`; default → cache-first.
6. Add a `staleWhileRevalidate(request)` helper that opens the cache, returns `cached || networkPromise`, and `cache.put`s on a successful network response.

---

### `manifest.json` (config, static asset)

**Analog:** `../mindful-breathing/manifest.json` (entire file, 17 lines)

**Full pattern** (`../mindful-breathing/manifest.json` lines 1-17):
```json
{
  "name": "Mindful Breathing",
  "short_name": "Breathing",
  "description": "A distraction-free breathing timer for relaxation, focus, and mindfulness practice.",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#111111",
  "theme_color": "#34d399",
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

**What Nawyki copies verbatim:**
- Top-level shape: `name`, `short_name`, `description`, `start_url`, `display`, `background_color`, `theme_color`, `icons` array.
- `start_url: "./"` (relative — D-15, D-19).
- The single-icon `{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }` shape (D-18).

**What Nawyki changes/adds:**
- `name`: `"Habits"` (D-13).
- `short_name`: `"Habits"` (D-13).
- `description`: `"Personal multi-year habit tracker."` (D-14).
- `background_color`: `"#0f0f10"` (D-16; warmer than mb's `#111111`).
- `theme_color`: `"#f5a623"` (D-16; amber).
- **Add** `"scope": "./"` (D-15; mb omits scope — Nawyki defends sub-path scope explicitly).
- **Add** `"lang": "en"` (D-15).
- **Add** `"dir": "ltr"` (RESEARCH.md §Example 1).

---

### `icon.svg` (config, static asset)

**Analog:** `../mindful-breathing/icon.svg` (entire file, 5 lines)

**Full pattern** (`../mindful-breathing/icon.svg` lines 1-5):
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" fill="#111111"/>
  <circle cx="256" cy="256" r="195" fill="none" stroke="#34d399" stroke-width="28"/>
  <circle cx="256" cy="256" r="95" fill="#34d399" opacity="0.75"/>
</svg>
```

**What Nawyki copies verbatim:**
- 512×512 viewBox.
- Full-canvas background `<rect>` covering 0,0 → 512,512.
- Centered glyph at `cx="256" cy="256"`.

**What Nawyki changes (per D-16, D-17 + RESEARCH.md §Pitfall 5):**
- **Remove `rx="110"`** from the background rect. Maskable icons must NOT pre-round corners — the OS supplies the mask. The mb icon has `rx=110` which is acceptable but suboptimal; Nawyki ships the spec-pure form.
- `fill="#111111"` → `fill="#0f0f10"` (palette swap).
- Replace the two-ring breathing glyph with a single amber filled circle: `<circle cx="256" cy="256" r="160" fill="#f5a623"/>`.
- Drop the second (stroked) circle entirely — placeholder is a solid dot per D-17.
- The r=160 glyph sits inside the 80% safe-zone radius of 205 (RESEARCH.md §Pitfall 5).

**Final form** (per RESEARCH.md §Example 2):
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f0f10"/>
  <circle cx="256" cy="256" r="160" fill="#f5a623"/>
</svg>
```

---

### `index.html` (entry-point, request-response)

**Analog:** `../mindful-breathing/index.html` head section (lines 1-14)

**Head + meta pattern** (`../mindful-breathing/index.html` lines 1-14):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mindful Breathing</title>
  <meta name="description" content="A distraction-free breathing timer for relaxation, focus, and mindfulness practice." />
  <meta name="theme-color" content="#34d399" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Breathing" />
  <link rel="icon" href="data:image/svg+xml,..." />
  <link rel="apple-touch-icon" href="icon.svg" />
  <link rel="manifest" href="manifest.json" />
```

**What Nawyki copies verbatim:**
- `<html lang="en">` (D-15 alignment).
- `<meta charset="UTF-8">` + `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- The full `apple-*` trio for iOS Safari standalone fidelity (RESEARCH.md §State of the Art row 4 — keep both legacy meta and modern manifest).
- `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<link rel="icon">`.

**What Nawyki changes:**
- `<title>`: `Habits`.
- `<meta name="description">`: `Personal multi-year habit tracker.`
- `<meta name="theme-color">`: `#f5a623`.
- `<meta name="apple-mobile-web-app-title">`: `Habits`.
- All paths get a `./` prefix: `./manifest.json`, `./icon.svg` (D-19; mb uses bare `icon.svg` which works but the relative prefix is the locked Nawyki convention).
- Replace the inline `<style>` block (mb lines 15-870) with `<link rel="stylesheet" href="./css/main.css">` — Nawyki separates CSS into the Cascade Layers composer.
- Replace the inline `<script>` block (mb lines 1040-1903) with `<script type="module" src="./js/main.js"></script>` — Nawyki uses ES modules from external files.
- Body holds the **empty Today scaffold** (D-01): a header with the date placeholder + wave context placeholder, an empty habit-list `<ul>`, a footer nav stub with three labels (`today · history · settings`).

---

### `desktop.html` (entry-point, request-response)

**Analog:** `../mindful-breathing/index.html` head section (lines 1-14)

Same head shape as `index.html` (per D-04: "same `<meta>`s, same manifest link, same `sw-register.js` call"). Body is the trivial stub per RESEARCH.md §Example 5:
```html
<body>
  <main class="stub">
    <h1>Habits</h1>
    <p>The desktop analytics layout ships in a later phase.</p>
    <p><a href="./index.html">Open the mobile view →</a></p>
  </main>
  <script type="module" src="./js/desktop.js"></script>
</body>
```

**What Nawyki changes vs `index.html`:**
- `<title>`: `Habits — Desktop (coming soon)`.
- Different module entry: `./js/desktop.js` instead of `./js/main.js`.
- No Today scaffold; just the "Switch to mobile" link.

---

### `js/platform/sw-register.js` (module, event-driven)

**Analog:** `../mindful-breathing/index.html` lines 1898-1903

**Silent-catch registration pattern** (`../mindful-breathing/index.html` lines 1898-1903):
```js
// ====== Service Worker ======
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {})
  );
}
```

**What Nawyki copies verbatim:**
- The feature-detect (`'serviceWorker' in navigator`).
- The `window.addEventListener("load", () => …)` deferral so registration doesn't compete with first paint.
- The `.catch(() => {})` silent-fail — critical for `file://` opens (D-20).

**What Nawyki adds (per D-20 + RESEARCH.md §Pattern 3):**
1. **A second guard** — `location.protocol.startsWith('http')` early-return. mb's feature-detect alone *would* register on file:// if the browser supports SW; the protocol guard stops it.
2. **Wrap registration into an exported `registerServiceWorker()` function** so `js/main.js` and `js/desktop.js` both call it from one source.
3. **Update path to `./sw.js`** (mb uses bare `'sw.js'`; Nawyki standardizes on `./` per D-19).
4. **Capture `const hadController = !!navigator.serviceWorker.controller` BEFORE registering** (RESEARCH.md §Pitfall 6) — distinguishes "real update" from "first install".
5. **Register a `controllerchange` listener** on `navigator.serviceWorker` that calls `showUpdateToast()` only if `hadController` was true (D-08).
6. `import { showUpdateToast } from '../views/toast.js'` at top.

---

### `js/util/version.js` (module, static read)

**No analog in mindful-breathing** — mb hard-codes `'mb-v1'` directly in `sw.js` line 1. Nawyki extracts this into a single source of truth (D-12).

**Pattern source:** RESEARCH.md §Pattern 2, Approach B (recommended).

**Final form:**
```js
// js/util/version.js
// Single source of truth for app version (D-12).
// Bump this string to force a new SW cache (per D-10: only on shell-asset change).
export const APP_VERSION = '0.1.0';

// Make the constant available to the service worker context, which loads this file
// via importScripts (where ES `export` is ignored, but `self.X = ...` works).
self.APP_VERSION = APP_VERSION;
```

**Used by:**
- `sw.js` (via `importScripts('./js/util/version.js')` → reads `self.APP_VERSION`).
- `js/main.js`, `js/desktop.js`, `js/views/diagnostics.js` (via `import { APP_VERSION } from './util/version.js'`).

---

### `js/main.js` (module, request-response)

**Analog:** `../mindful-breathing/index.html` `<script>` block (lines 1040-1903) — specifically the SW-boot section at 1898-1903.

mb is a single-file app, so its `<script>` block is one long IIFE. Nawyki's `main.js` is a thin entry point that delegates to small modules.

**What Nawyki copies in spirit (not verbatim):**
- The "boot at load, register SW" idea. mb does it inline; Nawyki calls `registerServiceWorker()`.

**Final shape** (per RESEARCH.md §Pattern 5 + §Walking Skeleton):
```js
// js/main.js
import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics, attachLongPress } from './views/diagnostics.js';

registerServiceWorker();

// ?debug=1 trigger (D-02)
const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();

// Long-press title trigger (D-02)
const titleEl = document.querySelector('[data-app-title]');
if (titleEl) attachLongPress(titleEl, mountDiagnostics);
```

---

### `js/desktop.js` (module, request-response)

**Analog:** Same as `js/main.js` — but trimmer (no long-press attachment because the desktop stub has no chrome to long-press, per D-04).

**Final shape** (per RESEARCH.md §Example 6):
```js
// js/desktop.js
import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics } from './views/diagnostics.js';

registerServiceWorker();

const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();
```

---

### `js/views/diagnostics.js` (view-component, event-driven)

**No direct analog** — mb has no diagnostics panel.

**Pattern sources:**
- **Long-press detection:** RESEARCH.md §Pattern 4 (Pointer Events + 1500 ms + 10 px movement tolerance).
- **`?debug=1` detection:** RESEARCH.md §Pattern 5.
- **Diagnostics content rows:** D-03 (app version, schema version, SW state, cache name, install state, persistence, reset buttons, check-for-update button).
- **Reset shell handler:** D-05 — `registration.unregister()` + `caches.keys().forEach(caches.delete)` + `location.reload()`.
- **Confirm dialog phrasing:** D-06 verbatim — "Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install."
- **Install-state detection:** `window.matchMedia('(display-mode: standalone)').matches` (RESEARCH.md §Don't Hand-Roll row 1).
- **Reset data placeholder:** D-05 — disabled button with tooltip "available in P2".
- **Persistence row:** D-03 — render "n/a (P2)" since IDB isn't here yet.

**Key long-press excerpt** (RESEARCH.md §Pattern 4, lines 433-456 of RESEARCH.md):
```js
const LONG_PRESS_MS = 1500;
const MOVE_TOLERANCE_PX = 10;

export function attachLongPress(el, onLongPress) {
  let timer = null;
  let startX = 0, startY = 0;

  el.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
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

---

### `js/views/toast.js` (view-component, event-driven)

**No direct analog** — mb has no toast.

**Pattern source:** RESEARCH.md §Pattern 6 (`showUpdateToast()`).

**Key shape** (RESEARCH.md §Pattern 6, lines 476-494 of RESEARCH.md):
```js
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

**Critical decisions to copy:**
- `role="status"` + `aria-live="polite"` — accessibility primitive.
- **No auto-dismiss** — D-08 locked: persists until user reloads or dismisses.
- **Idempotent** — re-entrant calls (e.g., a second `controllerchange` before the first toast is closed) are a no-op (`if (toastEl) return`).
- Shared with future Undo notifications (CONTEXT.md §D-08 + Code Context).

---

### `css/main.css` (styles, static asset)

**Analog:** `../mindful-breathing/index.html` inline `<style>` (lines 15-870) — but only the `:root{...}` custom-properties block (lines 16-22) maps directly.

mb's CSS is **one inline `<style>` block, single specificity hierarchy**. Nawyki's CSS is **multiple files composed by `@layer` + `@import`** because the project is too large for one file (per STACK.md / RESEARCH.md §Code Examples §Example 3).

**mb pattern (custom-properties seed)** (`../mindful-breathing/index.html` lines 16-22):
```css
:root{
  --bg: #111;
  --card: #171717;
  --accent: #9aa0a6;
  --accentSoft: rgba(154,160,166,0.18);
  --text: #fff;
}
```

**Nawyki composer pattern** (RESEARCH.md §Example 3):
```css
@layer reset, tokens, base, layout, components, view, utilities;

@import url("./reset.css")      layer(reset);
@import url("./tokens.css")     layer(tokens);
@import url("./base.css")       layer(base);
@import url("./components.css") layer(components);
@import url("./today.css")      layer(view);
```

**What Nawyki copies from mb:**
- The "custom properties on `:root`" idea (extracted into `tokens.css`).
- The dark-with-accent visual language.

**What Nawyki adds:**
- Cascade Layers declaration line — defines the layer order before any `@import` (deterministic specificity, no `!important` ever needed).
- Per-component file split per RESEARCH.md §Recommended Project Structure.

---

### `css/tokens.css` (styles, static asset)

**Analog:** `../mindful-breathing/index.html` lines 16-22 (the `:root{…}` custom-properties block).

**Pattern source:** RESEARCH.md §Example 4 (full token set).

**What Nawyki copies in spirit:**
- The "single `:root{}` block with all design tokens" pattern.

**What Nawyki adds (per D-16 + RESEARCH.md §Example 4):**
- Locked palette: `--color-bg: #0f0f10`, `--color-accent: #f5a623`, plus `--color-fg`, `--color-fg-muted`, `--color-fg-faint`, `--color-surface`, `--color-border`, `--color-accent-soft`.
- Full spacing scale `--space-1`..`--space-7`.
- Type scale `--text-xs`..`--text-2xl` + `--font-sans`, `--font-mono`.
- Radii `--radius-sm`, `--radius-md`, `--radius-lg`.
- Z-index scale `--z-toast`, `--z-overlay`.
- All wrapped in `@layer tokens { :root { ... } }` so cascade order is explicit.

---

### `css/reset.css`, `css/base.css`, `css/components.css`, `css/today.css` (styles, static asset)

**No direct analog** — mb's inline `<style>` block has these concerns inlined and intermixed; Nawyki splits them.

**Pattern sources:**
- `reset.css`: modern minimal reset (RESEARCH.md §Example 3 implies; standard `*, *::before, *::after { box-sizing: border-box }` + margin zeroing). No mb analog.
- `base.css`: `body{}` defaults (mb lines 24-34 — font, background, color). Nawyki uses tokens instead of literals: `background: var(--color-bg)`, `color: var(--color-fg)`, `font-family: var(--font-sans)`.
- `components.css`: toast + button + panel primitives. mb has `.iconToggle`, `.container`, `.cornerControls` (lines 36-46 + 871-910) — same "small, named, single-responsibility component" naming style but different components.
- `today.css`: header / list / footer-nav-stub mobile layout per D-01. No mb analog (mb has a single centered card; Nawyki has a header/list/footer stack).

---

## Shared Patterns

### Pattern A: Silent-Fail SW Registration (file://-safe)

**Source:** `../mindful-breathing/index.html` lines 1898-1903.
**Extended by:** RESEARCH.md §Pattern 3 (`hadController` + protocol guard).
**Apply to:** `js/platform/sw-register.js` (and only there — D-20 says this is the single integration point).

**Excerpt:**
```js
if (!('serviceWorker' in navigator)) return;
if (!location.protocol.startsWith('http')) return; // file:// silent skip
const hadController = !!navigator.serviceWorker.controller;
window.addEventListener('load', () => {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* silent */ });
});
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController) return; // first install; don't toast
  showUpdateToast();
});
```

**Critical rules baked in:**
- Three layers of defense: feature detect, protocol guard, silent catch.
- `hadController` distinguishes real updates from first installs (RESEARCH.md §Pitfall 6).
- Path is `./sw.js` — never absolute (D-19).

---

### Pattern B: Versioned Cache Name + Activate Cleanup

**Source:** mb has the **cache name** (`'mb-v1'`, sw.js line 1) but NOT the activate-cleanup pattern. Nawyki extends.
**Extended by:** RESEARCH.md §Pattern 1.
**Apply to:** `sw.js`.

**Excerpt:**
```js
const CACHE = `habits-${self.APP_VERSION}`;
// ...
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
```

**Critical rules:**
- Cache name derives from a single `APP_VERSION` constant (D-12). Bumping is one edit.
- Activate cleanup is mandatory — without it, old caches accumulate and stale assets can be served (RESEARCH.md §Pitfall 1).
- `clients.claim()` after cleanup so the new SW controls existing tabs immediately (D-09).

---

### Pattern C: Relative-Only Paths

**Source:** `../mindful-breathing/sw.js` lines 1-2 (`'./'`, `'./index.html'`, etc.), `manifest.json` line 5 (`"start_url": "./"`).
**Apply to:** Every path in every Phase 1 file — HTML `<link href>`, HTML `<script src>`, manifest `src`/`start_url`/`scope`, sw.js asset list, all ES module `import` specifiers.

**Rule (D-19, NFR-12, RESEARCH.md §Pitfall 3):**
- ✅ `./sw.js`, `./manifest.json`, `./icon.svg`, `./css/main.css`, `./js/main.js`, `./js/util/version.js`.
- ❌ `/sw.js`, `/manifest.json`, `https://…`, `sw.js` (bare — works in mb but Nawyki standardizes on `./`).

**Why:** Same bytes deploy under `file://`, `https://bielinskilukasz.github.io/habits/`, or any sub-path with zero env config.

---

### Pattern D: iOS Safari Standalone Meta Trio

**Source:** `../mindful-breathing/index.html` lines 9-11.
**Apply to:** Both `index.html` and `desktop.html` heads.

**Excerpt:**
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Habits" />
```

**Why both this AND the manifest:** RESEARCH.md §State of the Art row 4 — the legacy meta trio is still recommended for iOS safety in 2026 even when a valid `display: standalone` manifest is present.

---

### Pattern E: Single APP_VERSION Source of Truth

**Source:** No mb analog (mb inlines `'mb-v1'`). New for Nawyki (D-12).
**Apply to:** `sw.js` (via `importScripts`) AND `js/views/diagnostics.js` (via `import { APP_VERSION }`).

**Rule:**
- Bumping the version is **one edit, in one file** (`js/util/version.js`).
- `sw.js` reads it via `importScripts('./js/util/version.js')` then `self.APP_VERSION`.
- Diagnostics + main.js read it via `import { APP_VERSION } from './util/version.js'`.

---

### Pattern F: Pointer-Events-Only for Cross-Device Input

**Source:** No mb analog (mb uses simple `click` events).
**Apply to:** `js/views/diagnostics.js` long-press handler (and any future P3 gesture work).
**Excerpt:** See diagnostics section above (RESEARCH.md §Pattern 4).

**Critical:** Never write a touch-events branch and a mouse-events branch. Pointer Events is Baseline (RESEARCH.md §Standard Stack) and covers touch + mouse + pen in one path.

---

### Pattern G: Cascade Layers + Custom Properties

**Source:** `../mindful-breathing/index.html` line 16 (`:root{}` with custom properties). Layers are net-new for Nawyki.
**Apply to:** Every `css/*.css` file.

**Rules:**
- The composer (`css/main.css`) declares layer order **once** with `@layer reset, tokens, base, layout, components, view, utilities;`.
- Every individual layer-file wraps its rules in `@layer <name> { … }` OR is `@import`ed with a `layer(<name>)` clause.
- All color/spacing/type/radius values come from custom properties defined in `tokens.css`. **No literal hex codes outside `tokens.css`.**

---

## No Analog Found

These files have no direct mindful-breathing analog. Planner uses RESEARCH.md patterns instead.

| File | Role | Data Flow | Reason | Pattern Source |
|------|------|-----------|--------|----------------|
| `js/util/version.js` | module | static read | mb inlines its cache string; new convention for Nawyki (D-12) | RESEARCH.md §Pattern 2 (Approach B) |
| `js/views/diagnostics.js` | view-component | event-driven | mb has no debug surface | RESEARCH.md §Pattern 4 + §Pattern 5 + D-03/D-05/D-06 |
| `js/views/toast.js` | view-component | event-driven | mb has no toast | RESEARCH.md §Pattern 6 + D-08 |
| `css/reset.css` | styles | static asset | mb has no separate reset | RESEARCH.md §Recommended Project Structure (modern minimal reset) |
| `css/components.css` | styles | static asset | mb's components are app-specific (.iconToggle, .container); Nawyki needs toast/button/panel primitives | naming pattern from mb; rules per RESEARCH.md §Pattern 6 |
| `css/today.css` | styles | static asset | mb has a single centered card; Nawyki has header/list/footer-nav stack | D-01 (empty Today scaffold shape) |

For all "no analog" files, the **shape of the file** (single-purpose, no IIFE, top-of-file `import`s only, named `export`s) follows the same zero-tooling ES-modules convention proven in mb's inline `<script>` block (just split into separate files).

---

## Metadata

**Analog search scope:** `C:\Users\lukasz.bielinski\projects\mindful-breathing\` (sibling reference project).
**Files scanned:**
- `../mindful-breathing/sw.js` (11 lines, full read)
- `../mindful-breathing/manifest.json` (17 lines, full read)
- `../mindful-breathing/icon.svg` (5 lines, full read)
- `../mindful-breathing/index.html` (1915 lines — head 1-60 read; SW registration lines 1898-1903 read; body opening lines 871-910 read; meta tags greped). Inline `<style>` (lines 15-870) and inline `<script>` (lines 1040-1903) NOT read in full — only the load-bearing pattern locations.
- Habits repo (`C:\Users\lukasz.bielinski\projects\habits\`) confirmed greenfield — only `CLAUDE.md`, `docs/`, `Nawyki v1.xlsx`, `Nawyki-fale.txt`. No source code to analog.

**Pattern extraction date:** 2026-05-26

**Notes for planner:**
- Every Phase 1 file maps to either (a) a mindful-breathing analog or (b) an explicit RESEARCH.md pattern section. There are no orphan files.
- Where mb's pattern and a RESEARCH.md pattern both exist, **prefer the RESEARCH.md version** — it already accounts for the extensions Nawyki needs (versioned cache, controllerchange wiring, layer composer, etc.). mb is the structural baseline; RESEARCH.md is the Nawyki-specific evolution.
- The **load-bearing trio** (Pattern A: silent-fail registration, Pattern B: versioned cache + activate cleanup, Pattern C: relative-only paths) defines whether Phase 1 succeeds or bricks the app. Every plan that touches `sw.js`, `sw-register.js`, or any HTML file must reference these three patterns explicitly.
