# Habits — Personal Habit Tracker

![Status](https://img.shields.io/badge/status-v1.0_shipped-brightgreen)
![Version](https://img.shields.io/badge/version-0.5.0-blue)
![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ECMAScript-2023-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

An offline-first personal habit tracker formalizing a 47-week wave plan (~65 habits across 10 themed waves) into a long-term, multi-year tool.

No backend. No dependencies. No build tools. Data lives in IndexedDB and never leaves the device.

**[Open the app →](https://bielinskilukasz.github.io/habits/)**

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Data Management](#data-management)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Browser Compatibility](#browser-compatibility)
- [Versioning](#versioning)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Habits is a static web app — the same minimalist approach as `mindful-breathing` — but with richer client-side state. The system models waves (themed habit groups), stages (progression steps per habit), multi-occurrence logging, and threshold-based graduation, exactly as practiced manually.

**Design principle:** Daily check-in must be friction-free and must honor the existing habit model exactly. Everything else — scoring, analytics, dashboards — can fail without blocking the core loop.

**Core constraints:**

| Constraint | Value |
|---|---|
| Tech stack | Vanilla HTML + ES modules + CSS — no framework, no bundler, no npm |
| Storage | IndexedDB (primary) + JSON export/import (backup) |
| Hosting | Static; works on `file://` and GitHub Pages without configuration |
| Offline | Fully functional once installed (PWA) |
| Privacy | No telemetry, no analytics, no network calls except user-triggered export/import |

---

## Features

### Daily Check-In (Mobile)

- **Cadence-aware list** — shows only habits applicable today (by weekday, every-N-days, weekly, or free cadences)
- **Tap to log** — single tap completes a habit; tap again to uncomplete
- **Multi-occurrence habits** — numeric `+1` counter for repeatable habits (e.g. "drink water"); slot-checklist for bounded sets (e.g. "read 7 pages")
- **Undo toast** — 5 s auto-dismiss with hover-pause; a second undo surface lives in Settings → Data
- **History navigation** — look up and edit any past day without rewriting historical records

### Habit Catalog

- **Full CRUD** — create, edit, archive, restore habits; identity preserved across edits by UUID
- **Wave organization** — 10 themed waves (Fala 0–9); habits grouped and color-coded by wave
- **Stage progression** — manual or auto-advance after N consecutive days; composable OR logic between triggers
- **Mastery evaluation** — rolling threshold model (default 90% in 70 days) with per-habit overrides

### Desktop Analytics

- **Analytics panel** — per-habit stats grouped by wave, S1 status badge, and active model score column
- **Wave-board** — 12-week heat-map grid (habit × ISO week) with S1 status color coding
- **Planning view** — forward-looking 12-week grid of scheduled habits, linked to the catalog
- **Three scoring models** — S1 Rolling Threshold Health, S2 Day-Weighted, S3 Load-Adjusted Capacity

### Infrastructure

- **Installable PWA** — works fully offline once installed; service worker is silent-fail-safe on `file://`
- **Two-shell layout** — `index.html` (mobile check-in) and `desktop.html` (desktop analytics) are separate entry points, not a single responsive layout
- **IndexedDB storage** — 7 stores: `habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`
- **Score snapshots** — precomputed on every log write; views read, they do not recompute
- **Cross-tab sync** — `BroadcastChannel('habits')` keeps two open tabs in sync
- **Diagnostics panel** — reachable via `?debug=1` or long-press the title

---

## Getting Started

### Prerequisites

- **Node 20+** — required only for the local development server. No `npm install` step.
- Any modern evergreen browser (Chrome, Edge, Firefox, Safari).

> **Note:** ES modules on `file://` are blocked by CORS in all Chromium-family browsers. Use `localhost` or the GitHub Pages deploy for full functionality — see [Run Modes](#run-modes) below.

### Run Modes

The same static files work in three environments. Every path in `index.html`, `desktop.html`, `manifest.json`, and `sw.js` is relative (`./…`, never `/…`), so no environment configuration is needed.

#### Option A — Open directly (`file://`)

Double-click `index.html`. The app shell renders (layout and CSS), but JavaScript will not load in Chrome or Edge due to CORS policy on `file://` origins. Use this only for quick visual/HTML checks.

Known limitations under `file://` (browser security, not app bugs):

- ES modules fail — DevTools will show `Access to script … has been blocked by CORS policy`
- `manifest.json` fails to load — install criteria cannot be evaluated
- Service worker silently no-ops — `sw-register.js` guards `register()` behind `location.protocol.startsWith('http')`

#### Option B — Localhost (recommended for development)

```sh
node scripts/serve.js
```

Open `http://localhost:8080/`. Override the port:

```sh
PORT=9000 node scripts/serve.js
```

The service worker registers, the `habits-${APP_VERSION}` cache populates, and the page is fully offline-reloadable. Use this to test service-worker and cache behavior (DevTools → Application → Service Workers / Cache Storage). The browser "Install" affordance is available at `localhost`.

#### Option C — GitHub Pages

Push to `main`. The app is served at:

```
https://bielinskilukasz.github.io/habits/
```

**Important:** The URL must include a trailing slash (`/habits/`, not `/habits`). Without it, the browser cannot resolve `./sw.js` against the `/habits/` directory and the service-worker scope collapses. GitHub Pages adds the slash automatically for directory links; only manually typed or copied URLs need care.

The relative-paths rule is what lets the app deploy under any sub-path. Never introduce absolute-path `href`s, `src`s, or `import` specifiers in the shell files.

---

## Project Structure

```
habits/
├── index.html          # Mobile check-in shell
├── desktop.html        # Desktop analytics shell
├── manifest.json       # Web App Manifest
├── sw.js               # Module service worker (cache-first + SWR)
├── icon.svg            # Maskable app icon
│
├── js/
│   ├── main.js         # Mobile entry point
│   ├── desktop.js      # Desktop entry point
│   ├── router.js       # Hash-based client router
│   ├── cadence.js      # Cadence filtering (shared: Today + CSV export)
│   ├── mastery.js      # Mastery threshold evaluation
│   ├── scoring.js      # Three scoring models (S1/S2/S3)
│   ├── stage.js        # Stage progression logic
│   ├── wave.js         # Wave metadata
│   ├── waveAggregates.js
│   ├── scheduled.js
│   ├── db/             # IndexedDB wrapper (~80-line promise helper)
│   ├── domain/         # Pure domain logic (no DOM dependency)
│   ├── io/             # Export (JSON + CSV) and import
│   ├── platform/       # SW registration, BroadcastChannel, lifecycle flush
│   ├── state/          # Single-mutator apply() chokepoint
│   ├── util/           # version.js and shared helpers
│   └── views/          # DOM-coupled view modules (Today, Catalog, Analytics…)
│
├── css/
│   ├── tokens.css      # Design tokens (custom properties)
│   ├── reset.css
│   ├── base.css
│   ├── main.css        # Mobile layout
│   ├── desktop.css     # Desktop layout
│   ├── components.css
│   ├── catalog.css
│   ├── today.css
│   ├── history.css
│   └── settings.css
│
├── seed/
│   └── habits.json     # Initial habit catalog seed data
│
├── scripts/
│   └── serve.js        # Vanilla-Node zero-dependency dev server (D-46)
│
└── tests/              # Unit tests (no test runner dependency)
```

**Key architectural choices:**

- `js/domain/` contains pure logic with no DOM imports — usable from both shells and testable without a browser.
- `cadence.js` is the single source of truth for "is this habit applicable on this day" — shared by the Today view and CSV export.
- All CSS is loaded via `@import url(…) layer(…)` in the shell files, using Cascade Layers for deterministic specificity without a preprocessor.

---

## Data Management

### JSON Export — Full Backup

Exports every IDB store as a single JSON file. The Blob+anchor download pattern works on `file://` and all browsers without the File System Access API.

Filename format: `habits-backup-YYYY-MM-DD.json`

### JSON Import — Merge by ID

Import merges incoming records with existing data by `id` (UUID). Semantics:

- Existing records with matching IDs are **overwritten** by the imported value.
- New records (IDs not present locally) are **inserted**.
- Local records with IDs not in the import file are **preserved untouched**.

This means an older backup is safe to import — it will not silently delete local-only changes made since the export, but it *will* overwrite any field where the IDs match. The export filename's date makes the ordering explicit.

### CSV Export — Wide Habit × Day Matrix

Produces a single wide matrix: rows = habits, columns = dates, cells = completion state.

| Cell value | Meaning |
|---|---|
| `1` | Habit was applicable on that day and completed |
| `0` | Habit was applicable on that day and not completed |
| `x` | Habit was not applicable on that day (cadence excluded it) |
| `N` (integer) | Numeric habit: raw count on applicable days; `0` if zero |

Additional formatting:
- UTF-8 BOM prepended so Polish characters render correctly on Windows Excel
- CRLF row separators
- Rows grouped by wave (Fala 0 → Fala 9), then by creation order within wave
- Columns sorted chronologically ascending

Filename format: `habits-completion-YYYY-MM-DD.csv`

### Score Snapshots

Scores are precomputed at write time and persisted in the `score_snapshots` IDB store (one row per habit × day). Analytics views read precomputed rows — they never recompute on render.

Recomputation is triggered when:
- A log entry changes
- Any log within the rolling window (default: 70 days) changes
- A habit definition changes (threshold, window, cadence)
- Global settings change → bulk re-run behind a confirmation dialog
- `scoreVersion` bumps → opportunistic re-run or batched "Rebuild snapshots" admin action

---

## Development

### Bumping the Version

`APP_VERSION` in `js/util/version.js` is the single source of truth. It drives the SW cache name (`habits-${APP_VERSION}`) and the diagnostics panel's "App version" row. See [`VERSIONING.md`](./VERSIONING.md) for the full policy.

**When to bump:**

| Change type | Bump |
|---|---|
| Bug fix, CSS tweak, copy fix, icon adjustment | PATCH (`0.5.0` → `0.5.1`) |
| Phase completion, new feature, breaking IDB schema change | MINOR (`0.5.0` → `0.6.0`) |
| Pure JS-module change under `js/` | **No bump required** — `sw.js` routes `/js/` through stale-while-revalidate |

**How to bump:**

1. Edit `js/util/version.js` — change the `APP_VERSION` string.
2. Commit and push to `main`.
3. On the next page load, the SW `activate` handler deletes caches not matching the new name, then `clients.claim()` fires.
4. `controllerchange` triggers a "New version ready — Reload" toast. The user reloads at their leisure — there is no auto-reload.

### Release Quality Gates

Three grep-based checks protect the constraints the project is built on. Run these before every release; each must return empty output.

**NFR-04 — no outbound network calls in shipped JS:**

```sh
grep -rE "fetch\(\s*['\"]https?:" js/
```

**NFR-11 — no build artifacts at the project root:**

```sh
ls -1 | grep -E "^(node_modules|package(-lock)?\.json|dist|build)$"
```

**NFR-12 — no absolute paths in shell files:**

```sh
grep -nE '"\s*/[a-z]' index.html desktop.html manifest.json sw.js
```

Any non-empty output is a release blocker. These gates are also documented in `.planning/phases/01-pwa-shell-tooling-hygiene/01-VALIDATION.md`.

### Design Decisions

| Decision | Rationale |
|---|---|
| No framework, no bundler, no npm | Zero-dependency longevity; every feature uses a browser-native API; Node 20+ is the only requirement for `scripts/serve.js` |
| Two separate HTML shells | `index.html` (check-in) and `desktop.html` (analytics) serve different jobs — different DOM, not a wide responsive layout |
| Raw IndexedDB with an ~80-line wrapper (`db/idb.js`) | Full control of schema, transactions, and indexes without Dexie/idb; gigabytes of quota for years of daily logs |
| Score snapshots as first-class IDB data | Scoring runs at write time; analytics read precomputed rows — no recompute on render, no stale badge flicker |
| Relative paths everywhere | App deploys under any sub-path (`/habits/`, `/`, `file://`) without configuration — every `src`, `href`, and `import` starts with `./` |
| Silent-fail service worker | `sw-register.js` guards `register()` behind `location.protocol.startsWith('http')` — `file://` opens work identically with no console errors |
| `visibilitychange` for pending writes | `beforeunload` / `unload` are unreliable on mobile; `visibilitychange → hidden` is the reliable flush hook |
| `BroadcastChannel('habits')` for cross-tab sync | Native, one-line setup; keeps a mobile Today tab and a desktop analytics tab in sync after any write |

---

## Troubleshooting

### Accessing the Diagnostics Panel

Two triggers open the same panel:

- Append `?debug=1` to any URL — e.g. `http://localhost:8080/?debug=1` or `https://bielinskilukasz.github.io/habits/?debug=1`
- Long-press the "Habits" title for ~1.5 s (works on touch and mouse via Pointer Events; movement >10 px cancels the press)

The panel shows six rows: app version, schema version, service-worker state, cache name, install state, and persistence state. Three action buttons follow: **Reset shell**, **Reset data**, and **Check for update**.

### Reset Shell

Use when a bad deploy traps the page on stale assets. The confirmation dialog reads:

```
Reset shell — unregister service worker and clear all caches.
Logs are NOT affected. Reload to a fresh install.
```

On confirmation, the handler unregisters the service worker, deletes all caches, and reloads the page. Per-step errors are swallowed so that fresh-install recovery is never blocked by a partial failure. Even if the rest of the UI is broken, the diagnostics panel is reachable via `?debug=1`.

### Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Blank page / CORS errors in DevTools | Opened `index.html` via `file://` in Chrome or Edge | Use `node scripts/serve.js` instead |
| Service worker not registering | Running on `file://` | SW only activates on HTTP/HTTPS — use localhost |
| "Install" button not appearing | Running on HTTP (not HTTPS) or `file://` | `localhost` supports install; full cross-device install requires GitHub Pages |
| App showing stale content after update | SW is serving cached assets | Open the diagnostics panel → "Check for update" or "Reset shell" |
| Data missing after import | Import uses merge-by-ID, not clear-and-replace | Local records with IDs not in the import file are preserved; records with matching IDs are overwritten |

---

## Browser Compatibility

| Browser | Desktop | Mobile | Notes |
|---|---|---|---|
| Chrome | ✅ | ✅ | ES modules blocked on `file://` — use localhost |
| Edge | ✅ | ✅ | Same as Chrome |
| Firefox | ✅ | ✅ | ES modules work on `file://` in Firefox |
| Safari | ✅ | ✅ | ES modules work on `file://` in Safari |

All features use [Baseline Widely Available](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility) APIs (IndexedDB, BroadcastChannel, CSS Cascade Layers, `@layer`, Service Workers, Web App Manifest).

---

## Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/). The current version (`0.y.z`) is the initial development range — anything may change. The `APP_VERSION` string in `js/util/version.js` is the single source of truth; it directly derives the SW cache name.

**Release history:**

| Version | Name | Date |
|---|---|---|
| v0.5.0 | Desktop Analytics & Scoring | 2026-06-29 |
| v0.4.0 | Domain Model | 2026-06-05 |
| v0.3.0 | Today View + Settings v1 | 2026-05-28 |
| v0.2.0 | Storage Foundation | 2026-05-27 |
| v0.1.0 | PWA Shell Chassis | 2026-05-26 |

See [`VERSIONING.md`](./VERSIONING.md) for full release notes and the post-v1.0 bump policy.

---

## Contributing

This is a personal single-user project. It is open-source (MIT) so others can learn from or adapt the patterns, but it is not accepting feature contributions that fall outside the author's own wave plan.

Bug reports and discussion are welcome via [GitHub Issues](https://github.com/bielinskilukasz/habits/issues).

If you fork it for your own habit system, the most relevant starting points are:

- `seed/habits.json` — replace with your own habit catalog
- `js/util/version.js` — update `APP_VERSION`
- `manifest.json` — update `name`, `short_name`, `description`

---

## License

MIT — see [LICENSE](./LICENSE).

Copyright © 2026 Łukasz Bieliński
