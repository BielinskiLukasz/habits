# Habits — Personal Habit Tracker

A personal, offline-first habit-tracking web app that formalizes the existing "Nawyki" system (47-week 2026 wave plan, ~65 habits across 10 themed waves) into a long-term, multi-year tool. Vanilla multi-file static — mobile-first daily check-in, desktop-first analytics — data lives in IndexedDB (Phase 2+) and never leaves the device.

Phase 1 ships only the chassis: a versioned-cache service worker, a maskable-icon-equipped Web App Manifest, two HTML shells (mobile + desktop stub), a Cascade-Layers CSS scaffold, and a hidden diagnostics panel with a Reset-shell escape hatch. No data, no IDB, no Today UI yet — those land from Phase 2 onward.

## Run modes

The same bytes work in three places. Every path in `index.html`, `desktop.html`, `manifest.json`, and `sw.js` is relative (`./...`, never `/...`) so no environment configuration is needed (NFR-12).

### Open directly (file://)

Double-click `index.html`. The empty Today scaffold renders **layout-only** — useful for CSS / HTML iteration without a server.

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

Push to `main`. GitHub Pages serves the chassis at:

```
https://bielinskilukasz.github.io/habits/
```

**The URL must end with a trailing slash (`/habits/`), not `/habits`.** Without the trailing slash the browser does not resolve `./sw.js` against the `/habits/` directory and the service-worker scope collapses — the `.planning/research/PITFALLS.md` writeup of GitHub Pages sub-path breakage covers the failure mode. GitHub Pages itself adds the slash automatically when the link points to a directory; only typed/copied URLs need explicit care.

The relative-paths rule (D-19) is the only thing that lets the chassis deploy under any sub-path. Do not introduce absolute-path `href`s, `src`s, or `import` specifiers anywhere in the shell files.

## Bumping the version

`APP_VERSION` is the single source of truth for the cache name (`habits-${APP_VERSION}`) and the diagnostics panel's "App version" row. The value follows [Semantic Versioning 2.0.0](https://semver.org/) — see [`VERSIONING.md`](./VERSIONING.md) for the full policy.

**Current phase: Initial Development (`0.y.z`)** — per SemVer §4, anything may change while the v1.0 milestone (Phases 1-6) is being built. Quick reference:

- **PATCH** (`0.1.0` → `0.1.1`) — bug fix, refactor, or shell-asset-only change (CSS tweak, icon adjustment, HTML copy fix).
- **MINOR** (`0.1.0` → `0.2.0`) — phase completion, breaking change, or new feature. MINOR absorbs breaking changes during `0.y.z`.
- **MAJOR** — stays at `0` until the v1.0 milestone seal after Phase 6.

After v1.0 ships, standard SemVer rules apply (MAJOR for breaking, MINOR for additive, PATCH for fixes). See `VERSIONING.md` for the full phase → version mapping.

To ship a shell update:

- Edit `js/util/version.js` and change `export const APP_VERSION = '0.1.0'` to the new value (e.g. `'0.1.1'`). Both the window context and the module service worker (registered by `js/platform/sw-register.js` with `{ type: 'module' }`) import the same file — one edit, one file (D-12).
- Commit and push. The GitHub Pages build serves the new bytes.
- Per D-10, only bump when **shell assets** change: `index.html`, `desktop.html`, `manifest.json`, `sw.js`, `icon.svg`, anything under `css/`. Pure JS-module changes do NOT require a version bump — `sw.js` routes `/js/` URLs through stale-while-revalidate (D-11), so module updates propagate within one reload without invalidating the cache.
- On the user's next page load, `sw.js`'s `activate` handler deletes every cache whose name is not the current `habits-${APP_VERSION}`, then `clients.claim()` takes over. Because `hadController` was true going into the new SW, `controllerchange` fires and the toast "New version ready — Reload" appears. The user clicks Reload at their leisure — there is no auto-reload (D-08/D-09).

## Diagnostics & recovery

### Reaching the diagnostics panel

Two triggers (D-02) — both mount the same panel:

- Append `?debug=1` to any URL. Example: `http://localhost:8000/?debug=1` or `https://bielinskilukasz.github.io/habits/?debug=1`. Reading is via `new URLSearchParams(location.search)`.
- Long-press the "Habits" title for ~1.5 s. Works on touch (phone) and mouse (desktop) from a single Pointer Events code path. Movement greater than ~10 px cancels the press (Pitfall 7 — does not fire during a normal scroll).

The panel renders six rows: app version, schema version (`n/a (P2)` until IDB ships), service-worker state (`unsupported` / `controlled` / `registered, not yet controlled`), cache name (the first `habits-` prefixed entry from `caches.keys()` or `none`), install state (`standalone` when launched as an installed PWA, `browser` otherwise, via `matchMedia('(display-mode: standalone)')`), and persistence state (`n/a (P2)` until `navigator.storage.persist()` lands in Phase 2). Three buttons follow: Reset shell, Reset data (disabled placeholder, tooltip `available in P2` per D-05), Check for update (forces `registration.update()` and reports outcome).

### Reset shell

When a bad deploy traps the page on stale assets (Pitfall 1), click Reset shell. The confirm dialog reads exactly:

```
Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install.
```

On OK the handler awaits `registration.unregister()`, awaits `Promise.all(caches.keys().map(caches.delete))`, then calls `location.reload()`. Per-step errors are swallowed because fresh-install recovery must not be blocked by a partial failure. This is the escape hatch — even if the rest of the UI is broken, the diagnostics panel can be reached via `?debug=1` and Reset shell from there.

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

## Manual smoke-test checklist

There is no automated test runner in Phase 1 — PROJECT.md forbids npm/build tooling. The hands-on verification surface lives in the planning artifacts:

- `.planning/phases/01-pwa-shell-tooling-hygiene/01-RESEARCH.md` §"Validation Architecture" → "Manual Smoke-Test Checklist" — the 14-item canonical checklist.
- `.planning/phases/01-pwa-shell-tooling-hygiene/01-VALIDATION.md` §"Manual-Only Verifications" — the per-requirement table mapping each behavior to a DevTools / device action.
- `.planning/phases/01-pwa-shell-tooling-hygiene/01-SKELETON.md` §"What the Skeleton Proves End-to-End" — the seven local steps plus the device-install phase-gate.

Run the checklist on the developer machine after every shell-asset change, and on a real device (Android Chrome / iOS Safari / desktop Chrome or Edge) at every phase boundary.

## Constraints

- **Tech stack:** Vanilla HTML + ES modules + CSS. No framework, no bundler, no npm, no CDN.
- **Source layout:** Multi-file, not a single `index.html`. ES modules with `./` relative imports.
- **Storage:** IndexedDB for primary data (Phase 2+) plus JSON export/import for backup (Phase 5). `localStorage` reserved for tiny UI preferences only.
- **Hosting:** Static — must work via `file://` and over HTTP(S) (GitHub Pages-compatible). Service-worker registration is silent-fail-safe so `file://` keeps working.
- **Offline:** Must function fully offline once installed (PWA).
- **UI language:** English chrome; Polish habit names preserved verbatim (user data).
- **Layout split:** Mobile and desktop are truly different layouts (not one responsive layout) — mobile = check-in, desktop = analytics/planning.
- **History integrity:** Habit-definition edits never rewrite historical logs; habit identity is preserved across edits.
- **Privacy:** No telemetry, no analytics, no network calls except what the user explicitly triggers (export/import). Personal data; single-user app.
