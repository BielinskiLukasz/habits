# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Serve the app locally (Node 20+ required; no npm install needed)
node scripts/serve.js
# Open http://localhost:8080/   or   PORT=9000 node scripts/serve.js

# Run all tests (Node built-in test runner, no npm install)
node --test tests/

# Run a single test file
node --test tests/unit/cadence.test.js

# Run tests matching a name pattern
node --test --test-name-pattern="cadence"
```

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Nawyki — Personal Habit Tracker**

A personal, offline-first habit-tracking web app that formalizes the existing "Nawyki" system (47-week 2026 wave plan, ~65 habits across 10 themed waves) into a long-term, multi-year tool. Built as a static multi-file HTML/JS/CSS app — same minimalist spirit as `mindful-breathing` (no backend, no framework, no build tool) — but with richer client-side state in IndexedDB.

Intended for a single user (the author) on personal devices: mobile-first for daily check-in, desktop-first for analytics and planning.

**Core Value:** **Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.**

Everything else — scoring, ranking, dashboards — can fail. Daily check-in and the underlying habit model cannot.

### Constraints

- **Tech stack**: Vanilla HTML + ES modules + CSS. No framework, no bundler, no npm. Browser-native APIs only. — *Deliberate constraint mirroring `mindful-breathing`; the author values zero-dependency longevity.*
- **Source layout**: Multi-file (not single index.html). — *User preference; the app is too large for one file but should still ship as plain static assets.*
- **Storage**: IndexedDB for primary data + JSON export/import for backup. — *Years of daily logs would strain localStorage; IndexedDB capacity is the safer floor. Cloud sync is a future option, not v1.*
- **Hosting**: Static — must work via `file://` and over HTTP(S) (GitHub Pages-compatible). Service worker registration should be silent-fail-safe so `file://` keeps working. — *Same model as `mindful-breathing`.*
- **Offline**: Must function fully offline (PWA). — *Daily check-in cannot depend on connectivity.*
- **UI language**: English UI chrome AND English habit names primary; Polish original optionally preserved as a per-habit `name_pl` field (D-35 + D-40, locked Phase 2). — *D-35 reverses the prior Polish-names-as-user-data constraint: every user-facing string — UI chrome AND habit names — is English by default. The `habits` IDB store carries an optional `name_pl` string field (D-40), so the seed loader writes both for source-derived habits, e.g. `{name: "Morning walk", name_pl: "Spacer rano"}`; user-created habits default `name_pl: null`. The quick-check surface for `name_pl` on Today / catalog (always-visible muted secondary line vs long-press reveal vs ⓘ icon vs hover tooltip) is a P3 UI-SPEC decision, not a P2 storage decision.*
- **Layout split**: Mobile and desktop are truly different layouts (not one responsive layout), because they serve different jobs — mobile = check-in, desktop = analytics/planning. — *Confirmed during questioning.*
- **History integrity**: Habit-definition edits never rewrite historical logs; the habit identity is preserved across edits. — *Confirmed during questioning. Critical to data trustworthiness.*
- **Privacy**: No telemetry, no analytics, no network calls except what the user explicitly triggers (export/import). — *Personal data; single-user app.*

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Markup** | Plain HTML5, one `index.html` shell + one auxiliary `desktop.html` | Static, GitHub-Pages-hostable, file://-friendly |
| **JS module system** | Native `<script type="module">` + relative `./` ES imports | Browsers support this natively; works on file:// in Firefox and Safari, fully on HTTP(S) everywhere |
| **JS language** | ES2023 (matches `mindful-breathing` badge); avoid stage-2 proposals | Universally available in 2026 evergreen browsers |
| **Storage** | Raw IndexedDB wrapped by a hand-written ~80-line promise helper (`db/idb.js`) | No npm; full control of schema/transactions; right-sized for ~65 habits × 365×N days |
| **Cross-tab sync** | `BroadcastChannel('habits')` | Native, Baseline Widely Available; simpler than `storage` events (D-30, locked Phase 2 — aligns with manifest name + cache prefix + IDB DB name) |
| **Persistence trigger** | `visibilitychange` → `hidden` (NOT `beforeunload`) | Only reliable hook on mobile / when PWA is backgrounded |
| **Export — JSON** | Full-fidelity backup of every IDB store, `Blob` + anchor download | Round-trippable; works on file:// |
| **Export — CSV** | Single wide matrix: rows = habits, columns = days, cells = `1` / `0` / `x` | Locked: human-readable in Excel, no separate file per entity |
| **Import** | JSON only, **merge-by-id** semantics | Locked: existing records updated in place, new records added, untouched records preserved |
| **PWA shell** | `manifest.json` + `sw.js` registered with silent `.catch()` (same pattern as `mindful-breathing`) | Service worker silent-fails on file:// so direct-open still works |
| **SW strategy** | Cache-first for app shell; `/js/` through stale-while-revalidate | Single-user offline-first; no remote data |
| **CSS architecture** | Cascade Layers (`@layer`) + CSS Custom Properties + per-component files joined with `@import url(...) layer(...)` | Native, build-free, deterministic specificity |
| **Layout split (mobile vs desktop)** | Two separate top-level HTML entry points (`index.html` + `desktop.html`) | Mobile = check-in, desktop = analytics — different DOM, not just a wide responsive layout |
| **Scoring snapshots** | Persisted in a dedicated `score_snapshots` IDB store, written on every log change for the affected date(s) | Locked: snapshots are first-class data, not recomputed on every render |
| **Mobile UX extras** | Vibration API, Touch pointer events | Native; mirrors `mindful-breathing` patterns |
| **No dev tooling** | No npm, no Prettier-via-node, no TypeScript, no JSDoc compiler step | Constraint; zero-build longevity |

## Export / Import (Locked Decisions)

### CSV Export — Wide Habit×Day Matrix (Locked)

| habit_name           | wave    | 2025-12-29 | 2025-12-30 | 2025-12-31 | 2026-01-01 | … |
|----------------------|---------|------------|------------|------------|------------|---|
| Spacer rano          | Fala 1  | 1          | 0          | 1          | 1          | … |
| Trening siłowy (pn)  | Fala 3  | x          | 1          | x          | x          | … |
| Bez słodyczy         | Fala 6  | 1          | 1          | 0          | 1          | … |

- `1` — habit was applicable on that day **and** completed.
- `0` — habit was applicable on that day **and** not completed.
- `x` — habit was **not applicable** on that day (cadence excluded it: e.g. a Monday-only habit on a Tuesday, an every-2-days habit on a non-slot day, a weekly habit that was completed on a different day of the same week).
- For numeric habits, use the raw count as the cell value (e.g. `5`, `7`) on applicable days; `0` if zero; `x` if not applicable.
- For slot-checklist habits, use the count of filled slots (`3` of 7 means `3`).
- Cell type stays numeric or `x`. Excel reads it as numbers fine.
- Columns are sorted chronologically ascending.
- Range defaults to the full span from earliest log to today, but should accept an optional date range (out of v1 scope — implement as a parameter for later).
- Rows grouped by wave (Fala 0 → Fala 9), then by habit creation order within wave.
- This matches how the user already thinks about the data in the xlsx.
- Prepend UTF-8 BOM `﻿` so Polish characters render correctly on Windows Excel.
- Use CRLF (`\r\n`) row separators.
- Quote any field containing `,`, `"`, `\r`, `\n`, or leading/trailing whitespace; escape `"` as `""`.
- Comma as the field separator (locale-portable; Excel on Polish Windows handles UTF-8 BOM CSVs with comma separator correctly when opened via "Data → From Text/CSV", or via Paste Special).
- MIME `text/csv;charset=utf-8`.
- Filename: `habits-completion-YYYY-MM-DD.csv` (D-30, locked Phase 2 — `nawyki-` prefix renamed to `habits-` for namespace consistency).

### JSON Import — Merge-by-ID (Locked)

- The user can export from one device, hand-edit a habit on another, then import the older file — and **the local-only edit survives**.
- A backup file is purely additive in the absence of conflicts; the user can import it confidently after an experimental session without losing the experimental data (though it *will* be overwritten where keys collide — that's the locked tradeoff).
- Habit identity is preserved by `id` (which is a UUID, never derived from the habit name). Renaming a habit on device A and importing a backup that still has the old name **will overwrite the new name** if the `id` matches. This is documented behavior, not a bug — and is why the export filename includes the date.

## Cross-Tab Sync

- `{ type: 'log:put', habitId, date }` — log changed; affected snapshots already rewritten.
- `{ type: 'habit:put', habitId }` — habit definition changed.
- `{ type: 'snapshot:rebuild', range }` — bulk snapshot recompute happened.
- `{ type: 'import:done' }` — full reload signal.

## What NOT to Use (Explicit Anti-Stack)

- **React, Vue, Svelte, SolidJS, Lit, Preact, Alpine, htmx** — forbidden by the no-framework constraint.
- **Webpack, Vite, esbuild, Rollup, Parcel, Bun, Turbopack** — forbidden by the no-bundler constraint.
- **npm, pnpm, yarn, bun install, deno install** — forbidden by the no-npm constraint.
- **Any CDN `<script src="https://…">` or `<link href="https://…">`** — forbidden by the no-CDN constraint; also breaks offline.
- **TypeScript compilation step** — would require a build. Use JSDoc type annotations in `.js` files if type hints are wanted; editors will read them.
- **Sass / Less / Stylus / PostCSS** — would require a build. Cascade layers + custom properties replace what these provided.
- **Tailwind / UnoCSS / atomic CSS frameworks** — either CDN (offline-hostile) or build step. Custom properties and a `utilities` layer handle this niche.
- **idb-keyval (any form)** — wrong shape for structured data.
- **Dexie / lovefield / RxDB / PouchDB** — npm dependencies; PouchDB also pulls a sync model we don't want in v1.
- **localForage** — npm dependency; we're committing to writing the ~80-line wrapper ourselves.
- **Workbox / Workbox-window** — npm dependency; the cache-first SW is ~25 lines hand-written.
- **Web SQL** — deprecated by spec, removed from modern browsers.
- **Push API / Notifications API for reminders** — out of scope per PROJECT.md.
- **File System Access API for v1 exports** — not available on file://; not in Safari; the Blob+anchor pattern works everywhere.
- **Wake Lock for v1** — no long-running session; unnecessary surface area.
- **Beforeunload / unload for save flushes** — unreliable; use `visibilitychange` → hidden.
- **`localStorage` for habit data** — quota too small for years of daily logs; synchronous; use only for tiny UI preferences if at all.
- **Service worker on file://** — protocol does not allow registration; the silent `.catch()` is the only correct response.
- **Cookies** — single-user, single-device, no auth, no server; cookies have no role.
- **WebSockets / fetch to any remote** — privacy constraint; the app never phones home.
- **A custom-elements / Web Components layer** — not forbidden, but unnecessary at this scale and adds reasoning load; plain `<div>`+module functions are simpler.
- **CSV as an import format** — CSV is read-only; round-trip is JSON-only.
- **Clear-and-replay JSON import** — would silently delete local edits made since the export; we are merge-by-id instead.
- **Recomputing scores on every read** — scores are snapshotted in `score_snapshots`; views read, they do not compute.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

### Comment Style (D-27, locked 2026-05-26)

JSDoc is the standard for file headers and exported APIs:

- **File-level header** — every `.js` file starts with `/** @file <one-line summary>. <rationale + cross-references to D-XX decisions> */`.
- **Exported functions** — `/** <one-line description> @param {Type} name desc @returns {Type} desc */` above the export.
- **Exported constants with non-obvious type** — `/** @type {Type} */` above the declaration.
- **Inline `//` comments** — still allowed inside function bodies for "why this is non-obvious" notes (a subtle invariant, a workaround for a specific bug, a hidden constraint). NOT for one-line restatements of what the next line does — the code already says that.

JSDoc gives editor type hints + structured API docs without a TypeScript compile step, fitting the zero-build / no-npm constraint.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

### Two Entry Points

The app has two HTML shells that share the same JS spine but serve different purposes:

- `index.html` → `js/main.js` — **mobile check-in shell**. Hash routes: `#today` (default), `#settings`, `#history`, `#catalog`.
- `desktop.html` → `js/desktop.js` — **desktop analytics shell**. Hash routes: `#analytics` (default), `#waveboard`, `#planning`.

Both shells run the same P2 boot sequence: configure DI seams → `bootSync()` → `bootLifecycle()` → `await bootSeed()` → `await bootScheduled()` → `await hydrate()`. The hash router (`js/router.js`) is the same module; routes differ per shell.

### DB Layer (three files, strict boundary)

```
js/db/idb.js     ← ONLY file that calls indexedDB directly. ~80-line promise wrapper.
js/db/repo.js    ← Typed CRUD facade. All stores have get/put helpers here. Anti-Pattern 1: views NEVER import idb.js.
js/db/schema.js  ← DB_VERSION + MIGRATIONS dispatch table. Schema is additive-only (no deleteObjectStore ever).
```

The v1 schema has 7 stores: `habits`, `habit_versions`, `logs`, `events`, `meta`, `settings`, `score_snapshots`.

### Single Mutator Chokepoint

**All writes go through `apply(event)` in `js/state/apply.js`** — views, IO modules, and undo all dispatch through here. The chokepoint enforces four invariants atomically:

1. Data writes + `events` row + `meta.undoToken` commit in a single IDB transaction.
2. `BroadcastChannel` message fires only after the tx resolves (never before).
3. Broadcast payload is keys-only (`{ habitId, date }`) — receivers re-read from IDB.
4. No `switch` statement — events dispatch via a `HANDLERS` table to per-event modules in `js/state/apply/*.js`.

Adding a new mutation type means: create `js/state/apply/myEvent.js` exporting `handleMyEvent` + `handleMyEvent.broadcastKeys`, then register it in the `HANDLERS` table in `apply.js`.

### In-Memory Cache + Pub/Sub (`js/state/store.js`)

`hydrate()` pre-warms three slices at boot:
- `cache.habits` — `Map<habitId, habit>` (full active catalog)
- `cache.logs` — `Map<"habitId::date", log>` (current ISO week only, bounded by NFR-01)
- `cache.settings` — `Map<key, value>` (weekStart, masteryThreshold, masteryWindow, scoringModel)

After every `apply()` call, `notify({event, keys})` refreshes only the affected cache entries from the repo, then fans out to `subscribe(fn)` callbacks. Views subscribe to re-render; they read via `getCachedHabits()` / `getCachedLog()` / `getCachedSettings()` selectors, never via `cache` directly.

### Dependency Injection Pattern

Platform-leaning modules (repo, broadcast, fetch, storage) are never statically imported by domain/IO modules. Instead every module exposes `configure({...})` called once at boot in `main.js`/`desktop.js`:

```js
configureApply({ repo, broadcast, trackTx, onLogWrite });
configureUndo({ repo });
configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
configureStore({ repo });
```

Tests call the same `configure()` with fakes. `_resetXxxForTest()` functions (exported, underscore-prefixed) wipe module-level state between tests.

### Domain Layer (pure functions, no IDB)

`js/domain/` modules contain pure logic with no DOM and no IndexedDB access:

| Module | Responsibility |
|---|---|
| `cadence.js` | `appliesToday(habit, date, ctx)` — 5 cadence types via `RESOLVERS` dispatch table (no `switch`). Shared by Today view and CSV export — single source of truth for "is this habit applicable on this day." |
| `mastery.js` | Mastery threshold evaluation from score snapshots |
| `scoring.js` | S1/S2/S3 scoring model computations |
| `stage.js` | Stage advancement logic |
| `wave.js` | Wave catalog loading and boot |
| `waveAggregates.js` | Per-wave aggregate computations |
| `scheduled.js` | Scheduled habit promotion (`startDate <= today`) on every boot |

### Habit Status Lifecycle

Habits have four statuses: `active` | `mastered` | `archived` | `scheduled`.

- `scheduled` habits have a future `startDate`; they appear in the Catalog "Upcoming" section and are excluded from Today's check-in list.
- `bootScheduled()` (called at boot in both shells) auto-promotes `scheduled` → `active` when `startDate <= today`.
- `seed/habits.json` converter emits `status: 'scheduled'` for any habit whose `startDate` is in the future at seed load time.

### CSS Layer Order

`css/main.css` is the single composer. Layer order (lowest → highest specificity):
```
reset → tokens → base → (layout) → components → view → (utilities)
```
All view-specific styles (`today.css`, `settings.css`, `catalog.css`, `history.css`, `desktop.css`) land in the `view` layer. Tokens (custom properties for palette, spacing, radii, z-indices) live in `css/tokens.css`.

### Score Snapshots Write Path

`js/io/scoreSnapshots.js` is wired as `onLogWrite` in `apply.js`. After every log mutation, it writes one `score_snapshots` row per `(habitId, date)` for the rolling 70-day window. Bulk rebuild is triggered from the Settings "Recompute Scores" action. Views read snapshots; they never recompute.

### Testing Approach

Tests use Node's built-in `node:test` + `node:assert` — no test framework installed. Two tiers:
- `tests/unit/` — pure module tests; no IDB. Module state is reset via `_resetXxxForTest()` exports.
- `tests/integration/` — use `tests/helpers/fake-idb.js` (an in-memory IDB-shaped fake) + `tests/helpers/fake-broadcast-channel.js`. The contract test (`tests/integration/contract.fake-vs-real.test.js`) enforces that the fake's surface matches `repo.js` exactly.

### Hardcoded Prohibitions (enforced by tests/CI)

- No `.innerHTML` anywhere — D-78. Grep gate catches violations.
- No `switch` on event or cadence types — Anti-Pattern 4. Unit tests assert the `RESOLVERS` / `HANDLERS` identifiers exist and no `switch (` appears in those files.
- No `indexedDB.*` outside `js/db/idb.js` — Anti-Pattern 1.
- No `history.pushState` in the router — file://-hostile; hash routing only.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
