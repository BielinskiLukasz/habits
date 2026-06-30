# Habits — Personal Habit Tracker

![Status](https://img.shields.io/badge/status-active_development-brightgreen)
![Version](https://img.shields.io/badge/version-0.5.0-blue)
![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ECMAScript-2023-F7DF1E?logo=javascript&logoColor=black)

A personal, offline-first habit-tracking web app formalizing a 47-week wave plan (~65 habits across 10 themed waves) into a long-term, multi-year tool.  
No backend. No dependencies. No build tools. Data lives in IndexedDB and never leaves the device.

> **Actively developed** — Phases 1–6 complete. Working toward v1.0.

**[Open app →](https://bielinskilukasz.github.io/habits/)**

---

## Features

### Daily check-in (mobile)

- **Cadence-aware habit list** — shows only habits applicable today (by weekday, every-N-days, weekly, or free cadences)
- **Tap to log** — single tap completes a habit; tap again to uncomplete
- **Multi-occurrence habits** — numeric `+1` counter for repeatable habits (e.g. "drink water"); slot-checklist for bounded sets (e.g. "read 7 pages")
- **Undo toast** — 5 s auto-dismiss with hover-pause; a second undo surface lives in Settings → Data
- **History navigation** — look up and edit any past day without rewriting historical records

### Habit catalog

- **Full CRUD** — create, edit, archive, restore habits; identity preserved across edits by UUID
- **Wave organization** — 10 themed waves (Fala 0–9); habits grouped and color-coded by wave
- **Stage progression** — manual or auto-advance after N consecutive days; composable OR logic between triggers
- **Mastery evaluation** — rolling threshold model (default 90% in 70 days) with per-habit overrides

### Desktop analytics

- **Analytics panel** — per-habit stats grouped by wave, S1 status badge, and active model score column
- **Wave-board** — 12-week heat-map grid (habit × ISO week) with S1 status color coding
- **Planning view** — forward-looking 12-week grid of scheduled habits, linked to catalog
- **Three scoring models** — S1 Rolling Threshold Health, S2 Day-Weighted, S3 Load-Adjusted Capacity

### Infrastructure

- **Installable PWA** — works fully offline once installed; service worker is silent-fail-safe on `file://`
- **Two-shell layout** — `index.html` (mobile check-in) and `desktop.html` (desktop analytics) are separate entry points, not a single responsive layout
- **IndexedDB storage** — 7 stores: `habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`
- **Score snapshots** — precomputed on every log write; views read, they do not recompute
- **Cross-tab sync** — `BroadcastChannel('habits')` keeps two open tabs in sync
- **Diagnostics panel** — reachable via `?debug=1` or long-press the title; Reset shell + Check for update

---

## Run modes

The same bytes work in three places. Every path in `index.html`, `desktop.html`, `manifest.json`, and `sw.js` is relative (`./...`, never `/...`) so no environment configuration is needed (NFR-12).

### Open directly (file://)

Double-click `index.html`. The Today scaffold renders **layout-only** — useful for CSS / HTML iteration without a server.

**Known limitations under `file://`** (browser security; not bugs in the app):

- ES modules fail to load. Chrome / Edge / Firefox all block `import` from `file://` because `origin: null` triggers CORS, blocking `js/main.js` and its transitive imports. The DevTools console will show `Access to script ... has been blocked by CORS policy`. Use one of the HTTPS modes below to exercise JavaScript.
- `manifest.json` fails to load for the same reason — install criteria can't be checked from `file://`.
- The service worker silently no-ops because `js/platform/sw-register.js` guards `register()` behind `location.protocol.startsWith('http')` (D-20). Service workers require a secure context — `file://` doesn't qualify.

In short: `file://` is for visually checking the static HTML / CSS only. Everything dynamic — SW, manifest install criteria, JS-driven UI, diagnostics panel — requires `localhost` or HTTPS.

### Localhost development

```sh
# Local development server (vanilla Node, zero npm deps — D-46)
node scripts/serve.js
```

Then visit `http://localhost:8080/`. Override the port with `PORT=9000 node scripts/serve.js`. Node 20+ is the only runtime requirement; no `npm install` step.

The service worker registers, the `habits-${APP_VERSION}` cache populates with the SHELL list, and the page is fully offline-reloadable. Use this for service-worker + cache behavior testing (DevTools → Application → Service Workers / Cache Storage). The desktop-Chrome "Install" UI requires HTTPS or `localhost`; on `localhost` the install affordance is available, but real installability + cross-device verification happens against the GitHub Pages deploy below.

### GitHub Pages deploy

Push to `main`. GitHub Pages serves the app at:

```
https://bielinskilukasz.github.io/habits/
```

**The URL must end with a trailing slash (`/habits/`), not `/habits`.** Without the trailing slash the browser does not resolve `./sw.js` against the `/habits/` directory and the service-worker scope collapses. GitHub Pages adds the slash automatically when the link points to a directory; only typed/copied URLs need explicit care.

The relative-paths rule (D-19) is the only thing that lets the app deploy under any sub-path. Do not introduce absolute-path `href`s, `src`s, or `import` specifiers anywhere in the shell files.

---

## Bumping the version

`APP_VERSION` is the single source of truth for the cache name (`habits-${APP_VERSION}`) and the diagnostics panel's "App version" row. The value follows [Semantic Versioning 2.0.0](https://semver.org/) — see [`VERSIONING.md`](./VERSIONING.md) for the full policy.

**Current phase: Initial Development (`0.y.z`)** — per SemVer §4, anything may change while the v1.0 milestone is being built. Quick reference:

- **PATCH** (`0.1.0` → `0.1.1`) — bug fix, refactor, or shell-asset-only change (CSS tweak, icon adjustment, HTML copy fix).
- **MINOR** (`0.1.0` → `0.2.0`) — phase completion, breaking change, or new feature. MINOR absorbs breaking changes during `0.y.z`.
- **MAJOR** — stays at `0` until the v1.0 milestone seal after Phase 6.

To ship a shell update:

- Edit `js/util/version.js` and change `export const APP_VERSION = '0.5.0'` to the new value (e.g. `'0.5.1'`). Both the window context and the module service worker (registered by `js/platform/sw-register.js` with `{ type: 'module' }`) import the same file — one edit, one file (D-12).
- Commit and push. The GitHub Pages build serves the new bytes.
- Per D-10, only bump when **shell assets** change: `index.html`, `desktop.html`, `manifest.json`, `sw.js`, `icon.svg`, anything under `css/`. Pure JS-module changes do NOT require a version bump — `sw.js` routes `/js/` URLs through stale-while-revalidate (D-11), so module updates propagate within one reload without invalidating the cache.
- On the user's next page load, `sw.js`'s `activate` handler deletes every cache whose name is not the current `habits-${APP_VERSION}`, then `clients.claim()` takes over. Because `hadController` was true going into the new SW, `controllerchange` fires and the toast "New version ready — Reload" appears. The user clicks Reload at their leisure — there is no auto-reload (D-08/D-09).

---

## Diagnostics & recovery

### Reaching the diagnostics panel

Two triggers (D-02) — both mount the same panel:

- Append `?debug=1` to any URL. Example: `http://localhost:8080/?debug=1` or `https://bielinskilukasz.github.io/habits/?debug=1`.
- Long-press the "Habits" title for ~1.5 s. Works on touch (phone) and mouse (desktop) from a single Pointer Events code path. Movement greater than ~10 px cancels the press (does not fire during a normal scroll).

The panel renders six rows: app version, schema version, service-worker state, cache name, install state, and persistence state. Three buttons follow: Reset shell, Reset data, Check for update.

### Reset shell

When a bad deploy traps the page on stale assets, click Reset shell. The confirm dialog reads exactly:

```
Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install.
```

On OK the handler awaits `registration.unregister()`, awaits `Promise.all(caches.keys().map(caches.delete))`, then calls `location.reload()`. Per-step errors are swallowed because fresh-install recovery must not be blocked by a partial failure. Even if the rest of the UI is broken, the diagnostics panel can be reached via `?debug=1` and Reset shell from there.

---

## Static gates

Three grep-based gates protect the constraints that the rest of the project assumes. Re-run them on every release; each should return empty.

NFR-04 — no outbound network calls in shipped JS:

```sh
grep -rE "fetch\(\s*['\"]https?:" js/
```

NFR-11 — no build artifacts at the project root:

```sh
ls -1 | grep -E "^(node_modules|package(-lock)?\.json|dist|build)$"
```

NFR-12 — no absolute paths in the shell files (every reference must be `./...`):

```sh
grep -nE '"\s*/[a-z]' index.html desktop.html manifest.json sw.js
```

These gates also appear in `.planning/phases/01-pwa-shell-tooling-hygiene/01-VALIDATION.md`. Treat any non-empty output as a release blocker.

---

## Design decisions

This project is a deliberate exercise in **constraint-driven design**:

- **No framework, no bundler, no npm** — every feature uses a browser-native API. The only runtime requirement is Node 20+ for the local dev server (`scripts/serve.js`); nothing needs installing.
- **Two separate HTML shells** — `index.html` (mobile check-in) and `desktop.html` (desktop analytics) are truly different layouts, not one responsive sheet. They serve different jobs and share domain logic via ES module imports.
- **IndexedDB with a hand-written wrapper** — a ~80-line promise helper (`db/idb.js`) gives full control of schema, transactions, and indexes without pulling in Dexie or idb. Gigabytes of quota for years of daily logs.
- **Score snapshots as first-class data** — `score_snapshots` is a full IDB store. Scoring runs at write time; analytics views just read precomputed rows. No recompute on render, no stale badge flicker.
- **Relative paths everywhere (D-19)** — the app deploys under any sub-path (`/habits/`, `/`, `file://`) without configuration. Every `src`, `href`, and `import` specifier starts with `./`.
- **Silent-fail service worker** — `sw-register.js` guards `register()` behind `location.protocol.startsWith('http')`. Opening `index.html` via `file://` works identically to before; the SW only activates on HTTP/HTTPS.
- **`visibilitychange` for flush** — pending IDB writes are flushed when the page is backgrounded. `beforeunload` / `unload` are unreliable on mobile and not used.
- **`BroadcastChannel('habits')`** — cross-tab invalidation so two open tabs (e.g. mobile Today + desktop analytics) stay in sync after a write.

---

## Browser compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅      | ✅     |
| Edge    | ✅      | ✅     |
| Firefox | ✅      | ✅     |
| Safari  | ✅      | ✅     |

ES modules via `file://` are blocked by browser CORS policy in all Chromium-family browsers (Chrome, Edge). Use `localhost` or GitHub Pages for full functionality.

---

## Version history

- v0.5.0 — Desktop Analytics & Scoring (desktop shell, analytics/wave-board/planning panels, three scoring models, score snapshots populated on log write)
- v0.4.0 — Domain Model (catalog CRUD, stages, mastery, multi-occurrence logging, history navigation, wave aggregates, seed enrichment)
- v0.3.0 — Today view + Settings v1 (first usable slice — tap-to-log, undo toast, week-start toggle, install help, reset-data)
- v0.2.0 — Storage Foundation (raw IDB, 7 stores, single-mutator chokepoint, BroadcastChannel sync, lifecycle flush, idempotent seed)
- v0.1.0 — PWA shell chassis (versioned-cache SW, Web App Manifest, two HTML shells, Cascade-Layers CSS scaffold, diagnostics panel with Reset-shell)

See [`VERSIONING.md`](./VERSIONING.md) § "Release history" for details and bump rationale.

---

## Constraints

- **Tech stack:** Vanilla HTML + ES modules + CSS. No framework, no bundler, no npm, no CDN.
- **Source layout:** Multi-file, not a single `index.html`. ES modules with `./` relative imports.
- **Storage:** IndexedDB for primary data plus JSON export/import for backup. `localStorage` reserved for tiny UI preferences only.
- **Hosting:** Static — must work via `file://` and over HTTP(S) (GitHub Pages-compatible). Service-worker registration is silent-fail-safe so `file://` keeps working.
- **Offline:** Must function fully offline once installed (PWA).
- **UI language:** English UI chrome AND English habit names primary; Polish original optionally preserved as a per-habit `name_pl` field (D-35 + D-40).
- **Layout split:** Mobile and desktop are truly different layouts — mobile = check-in, desktop = analytics/planning.
- **History integrity:** Habit-definition edits never rewrite historical logs; habit identity is preserved across edits by UUID.
- **Privacy:** No telemetry, no analytics, no network calls except what the user explicitly triggers (export/import).
