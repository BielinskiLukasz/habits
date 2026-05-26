---
phase: 01-pwa-shell-tooling-hygiene
type: walking-skeleton
created: 2026-05-26
---

# Phase 1 — Walking Skeleton

> The first deliverable is the chassis itself. There is no UI → API → DB stack to slice horizontally — the slice is "open page on file://, on HTTPS, install, go offline, reload, see same page; bump version, reload, see toast; click Reset shell, see clean recovery." This document is what subsequent phases will build on without renegotiating.

## Phase User Story

**As a** developer (the author of Nawyki), **I want to** open a deployable, file://-safe, versioned-cache PWA chassis, **so that** I can install the empty habit-tracker shell on Android Chrome, iOS Safari, and desktop Chrome/Edge, reload it offline, ship updates without bricking users, and recover from a broken deploy through a Reset-shell button — all before any data, IDB, or domain logic is wired up.

## What the Skeleton Proves End-to-End

The thinnest possible end-to-end story. Each step unlocks the next:

1. **File:// open** — A user opens `index.html` directly from disk. Page renders the empty Today scaffold. Console is clean. No SW registration is attempted.
2. **HTTPS open** — A user opens the same `index.html` via `python -m http.server 8000` at `http://localhost:8000/`. Page renders identically. SW registers. Cache `nawyki-v1` is populated with the shell asset list.
3. **Offline reload** — A user toggles DevTools → Network → Offline and reloads. Page loads from cache. Empty Today scaffold renders identically.
4. **`?debug=1` trigger** — A user navigates to `?debug=1`. The diagnostics panel mounts in place of the empty scaffold, showing app version, schema version (placeholder), SW state, cache name, install state, and persistence state ("n/a (P2)").
5. **Long-press trigger** — A user long-presses the title for 1.5 s. The same diagnostics panel mounts.
6. **Reset shell** — A user clicks "Reset shell" in diagnostics → confirms → SW unregisters + caches clear + page reloads to a fresh install.
7. **Update toast** — A developer bumps `APP_VERSION` to `'v2'` in `js/util/version.js` and redeploys. On the next reload of a still-open tab, `controllerchange` fires → the toast "New version ready — Reload" appears. Clicking Reload activates the new cache `nawyki-v2`; the old `nawyki-v1` is deleted.

Steps 1–7 run on the developer machine. The phase-gate hands-on check adds:

8. **GH Pages install** — Push to GitHub Pages at `https://lukasz-bielinski.github.io/habits/`. Open on desktop Chrome → URL-bar install icon → standalone window. Open on Android Chrome → Install prompt or Add to Home Screen. Open on iOS Safari → Share → Add to Home Screen. Each installed icon launches standalone, no browser chrome. Offline reload still works on each.

## What the Skeleton Deliberately Does NOT Prove

These are out of P1 scope and live in later phases:

- **No habit data, no IDB, no seed** — Phase 2 (Storage Foundation).
- **No real Today view** — Phase 3 ships the data; Phase 1 ships only the empty chrome (header with date + wave placeholders, empty habit list `<ul>`, footer nav stub with `today · history · settings` labels).
- **No real Settings panel** — Phase 3 ships PWA-07 install help + SETTINGS-04/05; Phase 1 ships only the diagnostics escape hatch.
- **No `Reset data` action** — Wired in Phase 2 when IDB exists. Phase 1 ships the button as a placeholder with tooltip "available in P2".
- **No `navigator.storage.persist()` call** — First IDB write is the trigger; lives in Phase 2. Diagnostics renders "Persistence: n/a (P2)" for now.
- **No real icon design** — Placeholder amber dot on near-black per D-17. Redo during Phase 3 UI design phase.
- **No CSV / JSON export, no import** — Phase 5.
- **No scoring** — Phase 6.

## Architectural Decisions Locked by the Skeleton

These decisions will not be renegotiated in subsequent phases:

| Decision | Locked by | Subsequent phases build on it |
|----------|-----------|-------------------------------|
| Vanilla multi-file static app — no npm, no CDN, no bundler | PROJECT.md + this phase ships zero build artifacts | Every later phase ships plain `.js`/`.css`/`.html`/`.svg` |
| ES modules (`<script type="module">`) with `./` relative imports | This phase | Storage / domain / view modules all use the same |
| Two HTML shells — `index.html` mobile + `desktop.html` desktop | This phase + D-04 | P3 fills mobile body; P6 fills desktop body |
| Single `APP_VERSION` constant in `js/util/version.js` | D-12 + this phase | Bumping the version remains one edit forever |
| Classic SW + `importScripts('./js/util/version.js')` | D-12 + research §Q2 | Module SWs deferred until Firefox catches up |
| Versioned cache name `nawyki-v${APP_VERSION}` + activate cleanup | D-10 + research §Pattern 1 | Every deploy that touches shell assets bumps the version |
| Cache strategy = cache-first for shell, stale-while-revalidate for `/js/**` | D-11 + research §Q1 | New JS modules added in later phases inherit SWR |
| Same-origin-only fetch handler (early-return on cross-origin) | Research §Pattern 1 + V14 Configuration | Future phases never add cross-origin caches |
| `skipWaiting()` + `clients.claim()` + non-auto-reload + update toast | D-09 + research §Pattern 3 | Updates never reload mid-tap; toast component is shared with later Undo notifications |
| Silent-fail SW registration: protocol guard + `.catch(() => {})` | D-20 + research §Pattern 3 | `file://` opens stay safe across the lifetime of the project |
| Cascade Layers + custom-properties CSS architecture | STACK.md + this phase | All later CSS lives in `@layer view { ... }` (or new layers added to the composer) |
| Token vocabulary (`--color-bg`, `--color-accent`, spacing scale, type scale, radii, z-index) | D-16 + research §Example 4 | P3 UI-SPEC inherits names without renaming |
| Two diagnostics triggers (`?debug=1` AND long-press on app title) | D-02 + research §Pattern 4/5 | Diagnostics panel grows new rows in later phases (persistence, IDB size, undo state) |
| Two reset buttons (Reset shell, Reset data) | D-05 + D-06 | P2 wires the Reset data side; the button placeholder waits |
| All paths relative (`./…`) in HTML + manifest + sw.js + module imports | D-19 + NFR-12 | Every later file inherits this rule |
| iOS Safari standalone meta trio (`apple-mobile-web-app-*`) | Pattern D (mindful-breathing analog) | Both shells carry it forever |
| Maskable icon — full canvas background, glyph inside r=205 safe-zone, no `rx` on background rect | D-17 + research §Pitfall 5 | Real icon design in P3 stays maskable |
| GH Pages deploy at `https://lukasz-bielinski.github.io/habits/` (trailing slash) | D-19 + research §Pitfall 3 + §A5 | All later phases hostable under any sub-path with zero env config |

## File Set (Minimum End-to-End Working Slice)

```
habits/
├── index.html                      # Mobile shell — empty Today scaffold + script wiring
├── desktop.html                    # Desktop stub — "Switch to mobile" link (D-04)
├── manifest.json                   # Web App Manifest (PWA-01)
├── sw.js                           # Classic SW + importScripts('./js/util/version.js')
├── icon.svg                        # Maskable SVG (amber dot on near-black, 80% safe-zone)
├── README.md                       # Deploy instructions + static-grep gates + smoke-test checklist
│
├── css/
│   ├── main.css                    # @layer composer + @import chain
│   ├── tokens.css                  # CSS custom properties (colors, spacing, type, radii, z-index)
│   ├── reset.css                   # Modern minimal reset
│   ├── base.css                    # html/body/typography defaults
│   ├── components.css              # toast, button, panel primitives
│   └── today.css                   # Mobile-specific shell layout (header, list, footer-nav stub)
│
└── js/
    ├── main.js                     # Mobile entry — wires SW register + diagnostics triggers
    ├── desktop.js                  # Desktop entry — SW register + ?debug=1
    │
    ├── util/
    │   └── version.js              # APP_VERSION = 'v1' — single source of truth (D-12)
    │
    ├── platform/
    │   └── sw-register.js          # Protocol-guarded + silent-catch registration + controllerchange wiring
    │
    └── views/
        ├── diagnostics.js          # Mount/unmount diagnostics + attachLongPress + Reset-shell handler
        └── toast.js                # Toast primitive (shared with future Undo notifications)
```

**Total:** 16 files (15 source files + 1 README), ~250–300 LOC across JS/CSS, ~80 lines of HTML, ~50 lines of JSON/SVG.

**Excluded by design** (these directories DO NOT exist in P1, established in later phases):
- `seed/` — P2 (bundled habits.json)
- `js/db/` — P2 (IDB wrapper, schema, repo)
- `js/state/` — P2 (single-mutator chokepoint)
- `js/domain/` — P4 (cadence, scoring, mastery)
- `js/io/` — P5 (export/import)
- `js/router/` — P3 (mobile router)

## Manual Smoke-Test Checklist

The 14-item canonical checklist lives in `01-RESEARCH.md` §"Manual Smoke-Test Checklist" and `01-VALIDATION.md` §"Manual-Only Verifications". The skeleton is "accepted" only when items 1–7 pass on the developer machine and items 8–14 (including the three device installs) pass during the phase-gate hands-on session.

Static-analysis gates (run in `README.md`):

- **NFR-04 grep:** `grep -rE 'fetch\(\s*['\''"]https?:' js/` returns empty.
- **NFR-11 ls:** `ls habits/` shows no `node_modules/`, `package.json`, `dist/`, `build/`.
- **NFR-12 grep:** `grep -nE '"\s*/[a-z]' index.html desktop.html manifest.json sw.js` returns empty.

## Pointer

- Manual smoke-test checklist: `.planning/phases/01-pwa-shell-tooling-hygiene/01-RESEARCH.md` §"Validation Architecture" → "Manual Smoke-Test Checklist"
- Per-task verification map: `.planning/phases/01-pwa-shell-tooling-hygiene/01-VALIDATION.md` §"Per-Task Verification Map"
- Architectural reference: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md` §7 "Build Order"
- Threat model + ASVS L1 controls: `.planning/phases/01-pwa-shell-tooling-hygiene/01-RESEARCH.md` §"Security Domain"
