# Phase 2: Storage Foundation (The Spine) - Research

**Researched:** 2026-05-26
**Domain:** Personal multi-year habit-tracker — vanilla static PWA, IndexedDB-backed data spine, single-mutator chokepoint, cross-tab sync, idempotent seed
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Namespace alignment**
- **D-30** — Database name and `BroadcastChannel` name both `'habits'`. Matches SW cache prefix (`habits-` per D-29), manifest `name: "Habits"` (D-13), and repo identity. ARCHITECTURE.md's `BroadcastChannel('nawyki')` sketch and Phase 1 D-05's *"delete the nawyki IndexedDB database"* dialog string both get forward-edited to `'habits'` during P2 planning.

**Seed**
- **D-31** — Minimal stub seed in P2 (5-10 habits), full ~65 deferred.
- **D-32** — Coverage-first stub: 8 habits across Wave 1-3 exercising every cadence × log-shape combo:
  - 2× daily binary
  - 1× weekly binary
  - 1× every-2-days binary
  - 1× day-of-week-subset binary (e.g. Mon/Wed/Fri)
  - 1× numeric `+1` counter (target N)
  - 1× slot-checklist with anonymous slots
  - 1× slot-checklist with user-labeled slots
  Spans Wave 1 + Wave 2 + Wave 3. English primary names with Polish stored as `name_pl`.
- **D-33** — Seed loader uses merge-by-id, never overwrites. Stable UUIDs. Writes `meta.seededIds` as an optimization to short-circuit subsequent boots.

**Mutator chokepoint**
- **D-34** — `apply.js` ships with one round-trip event in P2: `markCompleted` + inverse (`restoreLogRow`).

**Language**
- **D-35** — All user-facing strings English (habits + waves). Reverses prior "Polish habit names preserved verbatim" constraint. Habit names: English primary. Wave labels: `"Wave 0..9"` (not `"Fala 0..9"`). PROJECT.md + CLAUDE.md edits land during P2 planning.
- **D-40** — `habits` store carries an optional `name_pl` field (string, nullable). Seed loader writes both for source-derived habits.
- **D-36** — CSV BOM + semicolon + CRLF setup kept (EXPORT-04/05 unchanged) — robustness retained for any future Polish content.

**Testing + CI**
- **D-37** — Full-spine unit tests under D-23..D-26. Every spine module ships with tests written first. Pure logic = `node --test` unit; IDB-touching modules = fake-IDB integration tests per D-25 (~30-line in-memory fake repo with the same surface as `js/db/repo.js`).
- **D-38** — GitHub Actions CI workflow lands in P2 plan 1 (first plan). `.github/workflows/ci.yml` + a placeholder passing test ship before any spine code merges. Green CI is the merge criterion from day one.
- **D-47** — Strict no-npm direction reaffirmed. Canonical invocations: `node --test tests/` for tests, `node scripts/serve.js` for the local dev server. No `package.json`, no `node_modules`, no Playwright.

**Schema**
- **D-39** — `score_snapshots` store declared in v1 schema (P2), empty until P6 starts writing. Avoids a v2 migration purely to introduce the store.

**Undo**
- **D-43** — Full undo seam ships in P2. `apply/markCompleted.js` writes its inverse payload into the `events` row in the same tx. `apply.js` writes `meta.undoToken = <new event id>` in the same tx. `js/state/undo.js` exposes `undo()` that reads `meta.undoToken`, looks up the event, applies the inverse via the same `apply.js` path (so undo also broadcasts and flushes). Survives reload. UNDO-02 fully demonstrable in P2.

**Identity**
- **D-42** — `events` store keyed by UUID (`crypto.randomUUID()`), not autoincrement integer. Consistent with `habits`, `habit_versions`, and the seed-merge pattern. Chronological order preserved via index on `at` (ISO timestamp).

**Reset**
- **D-44** — Reset-data button wired in diagnostics in P2; migrates to Settings in P3. Confirm dialog uses Phase 1 D-06 verbatim phrasing → `indexedDB.deleteDatabase('habits')` → `location.reload()`.

**Persistence prompt**
- **D-41** — `navigator.storage.persist()` fires on the seed-load write, first launch ever. Trade-off acknowledged: prompt may feel pushy, but data-protection win is non-negotiable.

**First-run defaults**
- **D-45** — Settings store gets mastery defaults + `schemaVersion` on first run. Same tx as the seed load writes `settings.defaultThreshold = 0.9`, `settings.defaultWindowDays = 70` (MASTERY-01), and `settings.schemaVersion = 1` (matches `DB_VERSION`).

**Dev tooling**
- **D-46** — Add `scripts/serve.js` in P2 (vanilla Node, zero deps). Pattern lifted from `../sleep-tracker/scripts/serve.js`. Usage: `node scripts/serve.js` → `http://localhost:8080/`. NOT in SW SHELL, NOT in `tests/`. README updated.

### Claude's Discretion

- **`apply.js` sub-module organization** — per-event handler modules vs registry-in-apply.js. Constraint: each handler returns `{ writes, inverse }`, and `apply.js` owns the transaction lifecycle.
- **`id.js` shape** — wrapper around `crypto.randomUUID()`. CONTEXT.md says "no fallback needed"; this RESEARCH refines (see §Standard Stack and Pitfall 13).
- **Hydration window scope on boot** — moot in P2 with no Today view yet. Likely just `logs.where(date = today)` for the seam test.
- **Cross-tab sync message envelope shape** — planner finalizes field names and origin-generation.
- **P2 plan breakdown** — plan count + boundaries is planner discretion.

### Deferred Ideas (OUT OF SCOPE)

- Quick-check surface for `name_pl` on Today / catalog — P3 UI-SPEC decision.
- Settings panel "Show Polish names" toggle — not in v1 unless asked.
- Wave label data model — P4.
- Full ~65-habit seed curation — explicitly deferred (P2 follow-up plan or P3 prep).
- Hydration window scope — P3 sets the real "last N days" window.
- `apply.js` event surface beyond `markCompleted` — P3+ work.
- Toast/button UI for undo — P3.
- Settings panel migration of "Reset data" button — P3.
- `scoringModel`, `theme`, `lastBackupAt`, `lastViewedDate` settings defaults — written by feature phase when first needed.
- Playwright / automated browser e2e tests — explicitly rejected.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | All habits, logs, edit history, and settings persist in IndexedDB across sessions | §Standard Stack (raw IDB wrapper); §Architecture Patterns (7 stores); §Code Examples (idb.js shape) |
| DATA-02 | IndexedDB schema is versioned with a `DB_VERSION` constant and a `MIGRATIONS` dispatch table | §Architecture Patterns (migration pattern); §Pitfall 10 (additive-only); §Code Examples (schema.js dispatch) |
| DATA-03 | App calls `navigator.storage.persist()` on first write and surfaces persistence status in Settings | §Standard Stack (persist timing); §Pitfall 1 (eviction); D-41 locks call site |
| DATA-04 | All mutations go through a single chokepoint (`state/apply.js`); views never write to IDB directly | §Architecture Patterns (single-mutator); §Anti-Patterns 1 + 4; D-34/D-43 |
| DATA-05 | Habit-definition edits never modify existing log rows; logs reference the `habit_versions` entry effective at the time they were written | §Pitfall 3 (versioned defs); §Architecture Patterns (snapshot + event log); not exercised in P2 (no editHabit yet) but schema must support it |
| DATA-06 | Date keys are stored as local `YYYY-MM-DD` strings (never `Date.toISOString()`) | §Standard Stack (`js/util/date.js`); §Pitfall 4 (timezone); §Anti-Pattern 3 |
| DATA-07 | Cross-tab writes propagate via `BroadcastChannel('habits')`; open tabs react to other-tab mutations | §Standard Stack (BroadcastChannel); D-30 channel name; §Pitfall 8 (broadcast keys not values); §Code Examples (sync.js) |
| DATA-08 | App flushes pending writes on `visibilitychange → hidden` (never `beforeunload`) | §Standard Stack (lifecycle hook); §Pitfall 8 (flush after `tx.done`); §Code Examples (lifecycle.js) |
| SEED-01 | App ships a hand-curated `seed/habits.json` parsed from `Nawyki v1.xlsx` + `Nawyki-fale.txt` | D-31 narrows P2 scope to 8-habit stub; full ~65 deferred |
| SEED-02 | Seed includes all ~65 habits with their wave assignment, cadence rules, stage definitions, multi-occurrence config | D-32 reduces P2 to 8 coverage-first habits across Waves 1-3; full ~65 explicitly deferred per D-31 |
| SEED-03 | Seed is loaded idempotently on first run; subsequent loads do not duplicate or overwrite user data | §Architecture Patterns (merge-by-id); D-33 (UUID-keyed merge + `meta.seededIds` optimization) |
| SEED-04 | Seed is loaded into `events` as an initial event (one event per habit creation) so the audit trail is complete | §Architecture Patterns (append-only event log); seed loader writes one `seed:createHabit` event per inserted habit |
| SEED-05 | No xlsx/txt parsing code ships in the user-facing app; seed JSON is the only data source | Confirmed: P2 ships only `seed/habits.json` + a JSON-fetching loader. Xlsx parsing was an offline curation step (deferred). |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

**Forbidden in P2:**
- npm, pnpm, yarn, package.json — `node scripts/serve.js` and `node --test tests/` are the only Node invocations
- Any bundler (Webpack, Vite, esbuild, Rollup, Parcel)
- Any framework (React, Vue, Svelte, Lit, Alpine, htmx)
- Any CDN `<script src="https://…">` — every byte committed
- TypeScript compile step — JSDoc-only typing (D-27)
- Sass / Less / PostCSS — Cascade Layers + custom properties replace these
- `localStorage` for habit data — UI prefs only
- `localForage`, `idb`, `idb-keyval`, `Dexie` — even inlined; hand-write the ~80-line wrapper
- `Date.toISOString()` for date keys (Anti-Pattern 3)
- `beforeunload` for save flushes (use `visibilitychange → hidden`)
- File System Access API for any P2 surface (not relevant here, but locked stance)
- Notification / Push APIs (out of v1 scope)
- `innerHTML` for any user-content rendering — `textContent` only (already enforced in `diagnostics.js` + `toast.js`)
- Any outbound `fetch` to a non-same-origin URL

**Required in P2:**
- File-level JSDoc header `/** @file <summary>. <rationale + D-XX refs> */` on every new `.js` file (D-27)
- JSDoc `@param`/`@returns`/`@type` on every export (D-27)
- All paths relative (`./…`) for GitHub Pages sub-path compat (D-19)
- TDD-blocking gate active (`workflow.tdd_mode = true`) — RED test commit before GREEN implementation
- Green CI is the merge criterion from P2 plan 1 onward (D-38)
- `js/util/version.js` is the SINGLE source of `APP_VERSION` (D-12) — `schemaVersion` is a separate IDB-level concept
- Cache name format `habits-${APP_VERSION}` — bump APP_VERSION to `0.2.0` at P2 completion (D-28, D-29, VERSIONING.md)

## Summary

Phase 2 ships the **data spine** that every later phase hangs off. The work decomposes into ten interlocking modules across five new directories (`js/util/`, `js/db/`, `js/state/`, `js/platform/`, `js/io/`), one new tests tree (`tests/unit/` + `tests/integration/`), one new GitHub Actions workflow (`.github/workflows/ci.yml`), and one new dev-tooling helper (`scripts/serve.js`). Each module has a single responsibility and an enforced seam — `db/idb.js` is the only file that touches `indexedDB`; `db/repo.js` is the only place views (someday) read from; `state/apply.js` is the only place anything writes. The locked decisions (D-30..D-47) pin the namespace (`'habits'`), the schema (7 stores), the seed shape (8 coverage-first habits with English+Polish names, merge-by-id idempotent), the test discipline (TDD-blocking, node --test + ~30-line fake IDB), and the dev-server tooling (vanilla Node `scripts/serve.js`).

The non-negotiable invariants in this phase are: **(1) date keys never touch UTC**, **(2) habit-definition edits never rewrite logs** (enforced by the `habit_versions` + `definitionVersion` schema even though `editHabit` doesn't ship until P3), **(3) all writes broadcast keys not values inside the same tx that wrote them**, **(4) `persist()` fires once on the very first IDB write**, and **(5) the seed loader is idempotent forever** so the full-65 seed can ship later without nuking user data.

**Primary recommendation:** Build the spine in five vertical slices (each one commits independently and leaves the repo green), in this order: (1) CI workflow + scripts/serve.js + tests skeleton + date utils; (2) idb wrapper + schema + repo facade with migrations; (3) state/apply chokepoint + sync + lifecycle + undo + the `markCompleted` round-trip; (4) seed loader + persist() + first-run defaults; (5) diagnostics-panel Reset-data wiring + docs (README, PROJECT.md, CLAUDE.md edits for D-30 + D-35) + APP_VERSION bump to 0.2.0. Each slice is end-to-end testable: by the end of slice 3 you can already run a fake-IDB integration test that proves `apply(markCompleted) → broadcast + undo + flush`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Date arithmetic (`todayLocal`, `daysAgo`, format/parse) | Util | — | Pure functions; no DOM, no IDB, no platform APIs. Day-1 module per ARCHITECTURE §7. |
| UUID generation | Util | — | Pure wrapper around `crypto.randomUUID()`; one fallback path for non-secure contexts. |
| IndexedDB request promisification | DB | — | The only module allowed to touch `indexedDB`. Hides callback/event-based IDB API behind promises. |
| Schema declaration + migrations | DB | — | `DB_VERSION` + `MIGRATIONS` dispatch table; runs in `onupgradeneeded`. Owns the 7-store layout. |
| Typed reads/writes (repo facade) | DB | — | The only place anything else in the app calls `idb.js`. Per-store helpers (`getHabit`, `putLog`, `getEventsByAt`, etc.). |
| Transaction orchestration (apply chokepoint) | State | DB (via repo), Platform (via sync) | The single mutator. Opens the tx that spans `events` + affected stores + `meta`, runs the handler, broadcasts, flushes. |
| Per-event handlers | State | — | Each handler returns `{ writes, inverse }`; `apply.js` opens the tx and executes. P2 ships one (`markCompleted`). |
| Undo seam | State | DB (via repo), State (re-enters apply) | Reads `meta.undoToken`, looks up the event, dispatches the inverse through `apply.js`. Survives reload. |
| In-memory cache + subscribe (`state/store.js`) | State | DB (via repo) | Hydrates from IDB on boot; views (P3+) subscribe; `apply.js` notifies on commit. P2 ships a minimal version sufficient for the round-trip test. |
| Cross-tab message channel | Platform | — | `BroadcastChannel('habits')` wrapper. Called by `apply.js` post-`tx.done`. Broadcasts keys; receivers re-read. |
| Lifecycle flush hook | Platform | State (drains pending) | `visibilitychange === 'hidden'` listener. Awaits any in-flight `apply.js` tx before yielding. |
| Seed loading | IO | DB (via repo), State (records event), Platform (triggers persist) | Reads `seed/habits.json` via `fetch`, merges by id, writes habits + one `seed:createHabit` event each + meta + settings defaults, then calls `navigator.storage.persist()`. All in one logical first-run tx. |
| Local Node dev server | Tooling (outside `js/`) | — | `scripts/serve.js` — `node:http` + `node:fs` + `node:path`, zero deps, path-traversal guarded. Not part of the app shell. |
| CI workflow | Tooling (outside `js/`) | — | `.github/workflows/ci.yml` — runs `node --test tests/` on push/PR. Single workflow file. |
| Test infrastructure | Tests (outside `js/`) | — | `tests/unit/*.test.js` for pure modules; `tests/integration/*.test.js` for fake-IDB roundtrips. ~30-line in-memory fake-IDB repo matches `js/db/repo.js` surface. |
| Reset-data wiring | Views (existing, P1) | DB (deleteDatabase) | `diagnostics.js`'s placeholder button gets a click handler: confirm dialog → `indexedDB.deleteDatabase('habits')` → `location.reload()`. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| IndexedDB (browser-native) | living spec | Primary persistence — 7 object stores | `[VERIFIED: MDN]` Gigabytes of quota, indexed queries, transactional, scoped to origin. The only browser-native primitive that fits "years of daily logs." |
| `BroadcastChannel` (browser-native) | living spec | Cross-tab sync after writes | `[VERIFIED: MDN]` Baseline Widely Available. Single channel `'habits'` (D-30). No `localStorage` writes needed. |
| Page Visibility API (`visibilitychange`) | living spec | Lifecycle flush trigger | `[VERIFIED: MDN]` MDN explicitly recommends over `beforeunload` for state-persistence flushes — `beforeunload` is unreliable on mobile and when PWA is backgrounded. |
| `navigator.storage.persist()` | living spec | Defend against Safari ITP 7-day eviction and Chromium storage-pressure eviction | `[VERIFIED: MDN + web.dev]` Returns Promise<boolean>. Chrome auto-decides silently (no prompt); other browsers may prompt. |
| `crypto.randomUUID()` | living spec | Stable IDs for habits, habit_versions, events, seed entries | `[VERIFIED: MDN]` Available in secure contexts. **`file://` is "potentially trustworthy" per W3C secure-contexts spec — Chrome and Firefox treat it as a secure context; Safari behavior is less consistent — keep a tiny fallback (see Pitfall 13).** |
| Node.js built-in test runner (`node --test`) | Node 20+ | All unit + integration tests | `[VERIFIED: nodejs.org]` Stable since Node 20. Auto-discovers `tests/**/*.test.js`. Zero dependencies. Locked by D-23..D-26. |
| `node:assert/strict` | Node 20+ | Test assertions | `[VERIFIED: nodejs.org]` Built-in. No `chai`, no `expect`. |
| GitHub Actions `actions/setup-node@v4` | v4 | CI runtime provisioning | `[VERIFIED: GitHub marketplace]` Pinned in D-24. Single workflow file `.github/workflows/ci.yml`. |

### Supporting (Hand-Written, In-Repo)

| Module | Lines | Purpose | When to Use |
|--------|-------|---------|-------------|
| `js/util/date.js` | ~80 | Local YYYY-MM-DD utilities; never UTC | Every store key with a date component, every cadence decision, every CSV column |
| `js/util/id.js` | ~10 | `crypto.randomUUID()` wrapper with non-secure-context fallback | Every new habit, habit_version, event |
| `js/db/idb.js` | ~80 | Promise wrapper around IndexedDB | The ONLY module that touches `indexedDB` directly |
| `js/db/schema.js` | ~80 | `DB_VERSION` + `MIGRATIONS` table + `onupgradeneeded` dispatch | Schema setup; never imported by views or state directly (only `idb.js` calls into it on `openDB`) |
| `js/db/repo.js` | ~150 | Typed get/put per store; the facade everything else uses | Anything that needs an IDB read or write goes through here |
| `js/state/store.js` | ~60 | In-memory cache + `subscribe()` | Views subscribe (P3+); P2 ships minimal hydrate-on-boot |
| `js/state/apply.js` | ~80 | Single mutator; opens tx, runs handler, broadcasts, flushes | Every write in the entire app |
| `js/state/apply/markCompleted.js` | ~30 | Per-event handler returning `{ writes, inverse }` | P2's one round-trip event |
| `js/state/undo.js` | ~40 | Reads `meta.undoToken`, dispatches inverse via apply.js | Survives reload (UNDO-02 demonstrable in P2) |
| `js/platform/sync.js` | ~30 | `BroadcastChannel('habits')` wrapper | `apply.js` calls `broadcast(keys)` post-commit |
| `js/platform/lifecycle.js` | ~30 | `visibilitychange === 'hidden'` + `pagehide` flush | Boot wiring in `main.js` |
| `js/io/seed.js` | ~80 | Read `seed/habits.json`, merge-by-id, write meta + settings + persist() | First-run only; idempotent thereafter |
| `scripts/serve.js` | ~58 | Zero-dep static file server for local SW testing | Manual `node scripts/serve.js` (NOT in SW SHELL, NOT in tests) |
| `tests/helpers/fake-idb.js` | ~30 | In-memory fake matching `repo.js` surface (D-25) | All `tests/integration/*.test.js` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Why Rejected |
|------------|-----------|----------|--------------|
| Hand-written `idb.js` | `idb-keyval` (inlined) | Smaller file | Wrong shape — key-value flattens compound-key + indexed queries. Defeats the reason for using IDB. `[CITED: STACK.md Alternatives Considered]` |
| Hand-written `idb.js` | Jake Archibald's `idb` (inlined) | Better ergonomics | Too large to honestly inline as "one file"; carries TypeScript build artifacts; vendoring violates "every line committed and audited." `[CITED: STACK.md]` |
| Hand-written `idb.js` | Dexie.js | Mature API | npm/CDN dependency; explicitly forbidden by D-47 and CLAUDE.md anti-stack. |
| Snapshot + event log | Pure event sourcing | Audit purity | Forces "fold all events from time zero" on every boot — slow with multi-year data, complicates selectors. `[CITED: ARCHITECTURE.md §2]` |
| Snapshot + event log | Pure snapshot, no events | Simpler | Loses per-habit edit history (CATALOG-04) and persistent undo (UNDO-02). Can't satisfy P2 success criteria. |
| `BroadcastChannel('habits')` | `storage` event | Already exists | Would require writing to `localStorage` solely to fire the event — couples cross-tab notification to a storage we deliberately don't use. `[CITED: STACK.md]` |
| `BroadcastChannel('habits')` | Service Worker `postMessage` | One more channel for SW | More plumbing; BC is one line. `[CITED: STACK.md]` |
| `visibilitychange → hidden` | `beforeunload` | Familiar | MDN explicitly recommends against — unreliable on mobile, especially when PWA is backgrounded. `[VERIFIED: MDN]` |
| `events` keyed by UUID | autoincrement integer | Smaller key | Cross-device import would need renumbering; inconsistent with habit/habit_version UUID identity. Locked by D-42. |
| First-run `persist()` on seed write | Delayed until user gesture | `web.dev` best-practice timing | D-41 locks first-write timing for data-protection. Chrome's no-prompt behavior means the trade-off is small in practice. |
| Node `--test` | Vitest / Jest / Mocha | More features | Requires npm + node_modules; D-47 forbids. Node `--test` covers all P2 needs. |

**Installation:**

None. Every module is hand-written and committed. The only runtime is the user's browser; the only test runtime is Node 20+ (no install — assumed present on developer + CI machine).

**Version verification:** [VERIFIED: Node.js official docs, fetched 2026-05-26] — `node --test` is stable since Node 20, auto-discovers `**/*.test.{cjs,mjs,js}` and `tests/**/*.js`. [VERIFIED: GitHub Actions Marketplace] — `actions/setup-node@v4` is current major. [VERIFIED: MDN, fetched 2026-05-26] — IndexedDB, BroadcastChannel, Page Visibility, StorageManager.persist all Baseline Widely Available. `crypto.randomUUID()` requires secure context; W3C secure-contexts spec recommends file:// be treated as potentially trustworthy and Chrome/Firefox follow that recommendation — see Pitfall 13.

## Package Legitimacy Audit

> **N/A — Phase 2 installs zero external packages.** Every dependency is either a browser-native API or hand-written code in this repo. No `package.json`, no `node_modules`, no CDN scripts, no inlined vendor blobs. The only Node-side dependencies are Node 20+ built-ins (`node:test`, `node:assert/strict`, `node:http`, `node:fs`, `node:path`).

No slopcheck run needed — there are no candidate packages to verify. This audit is the verification.

## Architecture Patterns

### System Architecture Diagram

```
                                  ┌─────────────────────────────────┐
                                  │   Browser tab (mobile shell)    │
                                  │                                 │
                                  │   index.html → main.js (boot)   │
                                  │                                 │
                                  └────────────┬────────────────────┘
                                               │
                       ┌───────────────────────┼───────────────────────────┐
                       ▼                       ▼                           ▼
            ┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
            │ platform/        │   │ state/store.js       │   │ platform/lifecycle   │
            │ sw-register.js   │   │ (in-memory cache,    │   │ visibilitychange→    │
            │ (P1, unchanged)  │   │  subscribe API)      │   │ hidden + pagehide    │
            └──────────────────┘   └──────────┬───────────┘   │ → drain in-flight tx │
                                              │                └──────────────────────┘
                                              │ hydrate
                                              ▼
                                  ┌──────────────────────┐
                                  │ db/repo.js  (FACADE) │
                                  │ getHabit, putLog,    │
                                  │ getEventsByAt, etc.  │
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │ db/idb.js (PROMISES) │     ┌──────────────────┐
                                  │ openDB, tx, get,     │◀────│ db/schema.js     │
                                  │ put, cursor, done    │     │ DB_VERSION = 1,  │
                                  └──────────┬───────────┘     │ MIGRATIONS = {1: │
                                             │                 │ createV1Stores}  │
                                             ▼                 └──────────────────┘
                                ┌────────────────────────────┐
                                │   IndexedDB('habits') v1   │
                                │  ┌──────────────────────┐  │
                                │  │ habits      (UUID)   │  │
                                │  │ habit_versions       │  │
                                │  │ logs    [hid,date]   │  │
                                │  │ events      (UUID)   │  │
                                │  │ settings    (key)    │  │
                                │  │ meta        (key)    │  │
                                │  │ score_snapshots      │  │
                                │  │  (empty until P6)    │  │
                                │  └──────────────────────┘  │
                                └────────────────────────────┘

                                  WRITE PATH (every mutation)
                                  ──────────────────────────────
   diagnostics.js / future view ──▶ state/apply.js ──▶ tx[events, affected stores, meta]
                                          │                  │
                                          │                  ├─▶ apply/markCompleted.js → {writes, inverse}
                                          │                  │
                                          │                  ├─▶ writes log row(s) + event row + meta.undoToken
                                          │                  │
                                          │                  └─▶ tx.complete (await `done`)
                                          │
                                          ├─▶ platform/sync.js → BroadcastChannel('habits')
                                          │   {type, event, keys, at, origin}
                                          │
                                          ├─▶ state/store.js notifies subscribers
                                          │
                                          └─▶ state/undo.js (in-mem stack updated; meta.undoToken persists across reload)

                                  SEED + PERSIST (first run only)
                                  ──────────────────────────────
   main.js boot ──▶ io/seed.js
                       │
                       ├─▶ fetch('./seed/habits.json')
                       ├─▶ open tx[habits, events, meta, settings]
                       ├─▶ for each seed habit: if (meta.seededIds has id) skip; else write habit + 'seed:createHabit' event
                       ├─▶ write meta.seededIds = [...]
                       ├─▶ write settings.{defaultThreshold:0.9, defaultWindowDays:70, schemaVersion:1}
                       ├─▶ tx.complete
                       └─▶ navigator.storage.persist()  (fires on first launch ever)

                                  CROSS-TAB SYNC
                                  ──────────────────────────────
   Tab A: apply.js → tx done → broadcast(keys) ────┐
                                                   │
                                                   ▼
                                  BroadcastChannel('habits')
                                                   │
                                                   ▼
   Tab B: sync.js receiver → invalidate cache slice → state/store.js notifies → views (P3+) re-render
```

### Recommended Project Structure

```
habits/
├── index.html                       (P1 — unchanged)
├── desktop.html                     (P1 — unchanged)
├── manifest.json                    (P1 — unchanged)
├── sw.js                            (P1 — SHELL may gain new /js/* entries; planner's call)
├── icon.svg                         (P1 — unchanged)
├── VERSIONING.md                    (P1 — unchanged)
├── README.md                        (P1 — P2 edits: replace python http.server line with `node scripts/serve.js`)
│
├── css/                             (P1 — unchanged in P2)
│
├── js/
│   ├── main.js                      (P1 — P2 adds: import + call hydrateStore(), bootSync(), bootLifecycle(), bootSeed())
│   ├── desktop.js                   (P1 — same wiring as main.js)
│   │
│   ├── util/
│   │   ├── version.js               (P1 — unchanged; bump APP_VERSION to '0.2.0' at phase completion)
│   │   ├── date.js                  (NEW — local YYYY-MM-DD utilities)
│   │   └── id.js                    (NEW — crypto.randomUUID() wrapper + fallback)
│   │
│   ├── db/                          (NEW DIRECTORY)
│   │   ├── idb.js                   (NEW — ~80-line promise wrapper; only file that touches indexedDB)
│   │   ├── schema.js                (NEW — DB_VERSION, MIGRATIONS, createV1Stores)
│   │   └── repo.js                  (NEW — typed get/put per store; facade for everything above)
│   │
│   ├── state/                       (NEW DIRECTORY)
│   │   ├── store.js                 (NEW — in-memory cache + subscribe; hydrate on boot)
│   │   ├── apply.js                 (NEW — single mutator)
│   │   ├── apply/                   (NEW SUBDIR — per-event handlers; planner picks layout)
│   │   │   └── markCompleted.js     (NEW — one round-trip event in P2; returns {writes, inverse})
│   │   └── undo.js                  (NEW — meta.undoToken-backed undo)
│   │
│   ├── platform/
│   │   ├── sw-register.js           (P1 — unchanged)
│   │   ├── sync.js                  (NEW — BroadcastChannel('habits') wrapper)
│   │   └── lifecycle.js             (NEW — visibilitychange → hidden flush hook)
│   │
│   ├── io/                          (NEW DIRECTORY)
│   │   └── seed.js                  (NEW — read seed/habits.json, merge-by-id, settings defaults, persist())
│   │
│   └── views/
│       ├── diagnostics.js           (P1 — P2 edits: wire Reset-data click handler per D-44)
│       └── toast.js                 (P1 — unchanged)
│
├── seed/                            (NEW DIRECTORY)
│   └── habits.json                  (NEW — 8 coverage-first habits per D-32)
│
├── scripts/                         (NEW DIRECTORY)
│   └── serve.js                     (NEW — vanilla Node static server per D-46)
│
├── tests/                           (NEW DIRECTORY)
│   ├── helpers/
│   │   └── fake-idb.js              (NEW — ~30-line in-memory fake matching repo.js surface)
│   ├── unit/
│   │   ├── date.test.js             (NEW — DST 2026-03-29, DST 2026-10-25, leap 2028-02-29)
│   │   ├── id.test.js               (NEW — UUID shape + fallback path)
│   │   └── schema.test.js           (NEW — migrations table dispatch math)
│   └── integration/
│       ├── repo.roundtrip.test.js   (NEW — put + get + index lookups via fake-IDB)
│       ├── apply.markCompleted.test.js (NEW — write → event → broadcast spy → undo round-trip)
│       ├── undo.persist-reload.test.js (NEW — meta.undoToken survives a simulated reload)
│       ├── seed.idempotent.test.js  (NEW — merge-by-id; second boot is no-op)
│       └── sync.broadcast.test.js   (NEW — sync.js posts keys not values)
│
└── .github/
    └── workflows/
        └── ci.yml                   (NEW — runs `node --test tests/` on push/PR)
```

### Pattern 1: Promise-Wrapped IndexedDB

**What:** Hand-written ~80-line wrapper that turns IDB's request-event API into Promises.
**When to use:** Every IDB operation — including `openDB`, individual `get`/`put`/`delete`, cursor scans, index queries, and `await tx.done`.
**Source:** STACK.md §IndexedDB Approach (confirmed); MDN Using IndexedDB.

Critical: **never await an unrelated async API between operations inside a tx — IndexedDB auto-commits as soon as the tx is idle for one tick.** `[VERIFIED: MDN IDBTransaction]` Either keep all operations in the same synchronous-ish chain (using IDB's own queuing), or use `await tx.done` to know the tx has committed before starting any other async work.

### Pattern 2: Schema Migration Dispatch Table

**What:** `js/db/schema.js` exports `DB_VERSION = 1` and `MIGRATIONS = { 1: createV1Stores, 2: addX, ... }`. `onupgradeneeded` runs a loop from `oldVersion + 1` to `newVersion`, calling each migration in order.
**When to use:** Every schema change — without exception.
**Source:** §Pitfall 10 (additive-only); ARCHITECTURE.md §3.

```javascript
// Source: hand-written based on MDN "Using IndexedDB" migration pattern + Pitfall 10
const DB_VERSION = 1;
const MIGRATIONS = {
  1: (db, tx) => {
    db.createObjectStore('habits', { keyPath: 'id' })
      .createIndex('wave', 'wave')
      .createIndex('status', 'status');
    db.createObjectStore('habit_versions', { keyPath: ['habitId', 'effectiveFrom'] })
      .createIndex('habitId', 'habitId');
    db.createObjectStore('logs', { keyPath: ['habitId', 'date'] })
      .createIndex('date', 'date')
      .createIndex('habitId', 'habitId');
    db.createObjectStore('events', { keyPath: 'id' })   // UUID per D-42
      .createIndex('at', 'at')
      .createIndex('type', 'type')
      .createIndex('habitId', 'habitId');
    db.createObjectStore('settings', { keyPath: 'key' });
    db.createObjectStore('meta', { keyPath: 'key' });
    db.createObjectStore('score_snapshots', { keyPath: ['habitId', 'date'] })  // D-39: declared empty
      .createIndex('date', 'date')
      .createIndex('habitId', 'habitId');
  },
};

function onUpgrade(event) {
  const db = event.target.result;
  const tx = event.target.transaction;
  for (let v = event.oldVersion + 1; v <= event.newVersion; v++) {
    MIGRATIONS[v](db, tx);
  }
}
```

### Pattern 3: Snapshot + Append-Only Event Log

**What:** Three persisted shapes — `habits` (current definition), `habit_versions` (every prior snapshot, never deleted), `logs` (each row carries `definitionVersion`), plus `events` (append-only journal with `inverse` payload).
**When to use:** All habit + log persistence. Even though P2 only ships `markCompleted`, the schema must support the editHabit flow that lands in P3+.
**Source:** ARCHITECTURE.md §2; §Pitfall 3 (versioned defs); §DATA-05.

Implementation implication for P2's `markCompleted`: log rows must include `definitionVersion: null` (means "current") so the field exists from row 1 and history-rendering code (P3+) doesn't need a back-migration to interpret pre-P3 rows.

### Pattern 4: Single-Mutator Chokepoint with Per-Event Handlers

**What:** `state/apply.js` is the only mutator. It dispatches to per-event handler modules that return `{ writes, inverse }`. `apply.js` owns the transaction lifecycle (open, run handler, write event row + meta.undoToken, await done, broadcast, notify).
**When to use:** Every mutation, forever.
**Source:** ARCHITECTURE.md §2 + Anti-Pattern 4; D-34/D-43.

```javascript
// Source: hand-written based on ARCHITECTURE.md §2 + Anti-Pattern 4
// js/state/apply.js (sketch — ~80 lines once fully written)
import { broadcast } from '../platform/sync.js';
import { newId } from '../util/id.js';
import { handleMarkCompleted } from './apply/markCompleted.js';

const HANDLERS = {
  markCompleted: handleMarkCompleted,
  // P3 adds: markUncompleted, incrementCount, ...
};

export async function apply(event) {
  const handler = HANDLERS[event.type];
  if (!handler) throw new Error(`unknown event type: ${event.type}`);

  // Handler decides which stores to touch and computes the inverse.
  const { writes, inverse, storeNames } = await handler(event, /* repo */);

  const eventRow = {
    id: newId(),
    at: new Date().toISOString(),
    type: event.type,
    payload: event.payload,
    inverse,
  };

  // Single tx across all affected stores + events + meta.
  await runTx([...storeNames, 'events', 'meta'], async (tx) => {
    for (const w of writes) await tx.put(w.store, w.value);
    await tx.put('events', eventRow);
    await tx.put('meta', { key: 'undoToken', value: eventRow.id });
  });

  // CRITICAL: broadcast AFTER tx commit (Pitfall 8). Broadcast keys, not values.
  broadcast({ type: 'mutation', event: event.type, keys: handler.broadcastKeys(event), at: eventRow.at });

  // Notify in-memory subscribers (P3+ views).
  notifySubscribers({ event: event.type, keys: handler.broadcastKeys(event) });

  return eventRow.id;
}
```

### Pattern 5: Broadcast Keys, Not Values

**What:** `BroadcastChannel` messages carry `{ type, event, keys: {habitId, date, ...}, at, origin }` — never the new field values. Receiving tabs re-read from IDB.
**When to use:** Every cross-tab notification.
**Source:** ARCHITECTURE.md §6; §Pitfall 8; STACK.md.

### Pattern 6: Visibilitychange Flush

**What:** `document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); })`. Also wire `pagehide` for the bfcache case. NEVER `beforeunload`.
**When to use:** Once at boot, in `js/platform/lifecycle.js`.
**Source:** §Pitfall 8; STACK.md; MDN explicitly recommends.

```javascript
// Source: STACK.md §Lifecycle Hook + MDN visibilitychange recommendation
// js/platform/lifecycle.js
let inFlightTxPromise = Promise.resolve();

export function trackTx(promise) {
  inFlightTxPromise = inFlightTxPromise.then(() => promise.catch(() => {}));
}

export function bootLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

async function flush() {
  // idempotent + debounced: awaiting an already-resolved promise is free
  await inFlightTxPromise;
}
```

### Pattern 7: Idempotent Seed via Merge-by-ID

**What:** `io/seed.js` reads `seed/habits.json`, looks at `meta.seededIds`, inserts only habits whose `id` is not already present in IDB. Existing rows (originally seeded or later user-edited) are never touched.
**When to use:** Once at boot (every boot, but a no-op after the first).
**Source:** D-33; ARCHITECTURE.md §2; CLAUDE.md merge-by-id philosophy.

### Anti-Patterns to Avoid

- **Views Calling `repo.js` Directly** — No broadcast, no undo, no cache invalidation. All writes go through `state/apply.js`. P2 has no views that write yet, but the pattern is enforced from day one. `[CITED: ARCHITECTURE.md Anti-Pattern 1]`
- **Mutating Habit Definitions In-Place** — No version snapshot, no event row, no inverse for undo, history rendering breaks. P2 doesn't ship `editHabit`, but the schema enforces this by virtue of `habit_versions` keyed by `[habitId, effectiveFrom]`. `[CITED: ARCHITECTURE.md Anti-Pattern 2]`
- **Storing Dates as `Date` Objects or UTC ISO Strings** — Use `YYYY-MM-DD` local strings from `js/util/date.js`. **The single most common silent-corruption vector in habit trackers.** `[CITED: ARCHITECTURE.md Anti-Pattern 3 + Pitfall 4]`
- **Single Giant `apply()` Switch** — Becomes a god module; per-event tests impossible. Use per-event handler modules returning `{ writes, inverse }`. `[CITED: ARCHITECTURE.md Anti-Pattern 4]`
- **Awaiting an unrelated async API inside a tx** — IndexedDB auto-commits on idle tick. The wrong `await` mid-tx kills the transaction. `[VERIFIED: MDN IDBTransaction]` Either chain inside `runTx`, or `await tx.done` before doing anything else async.
- **Broadcasting before `tx.done`** — Receiving tab re-reads stale state. Always `await tx.done` THEN `broadcast(...)`. `[CITED: Pitfall 8]`
- **Broadcasting values instead of keys** — Receiver might have a different cache window; receiver MUST re-read from IDB to get canonical state. `[CITED: Pitfall 8]`
- **Reusing `meta.undoToken` for non-undoable events** — `meta.undoToken` always points to the last *undoable* event id; if a non-undoable system event ships in P3+ (a hypothetical), it must NOT overwrite `undoToken`. P2's `markCompleted` is undoable, so this is fine for now.
- **`beforeunload` for flushes** — Unreliable on mobile and when PWA backgrounded. Use `visibilitychange → hidden` + `pagehide`. `[VERIFIED: MDN]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom `Math.random` ID generator or counter | `crypto.randomUUID()` from Web Crypto API | Math.random is not cryptographically uniform; collisions over multi-year datasets become non-trivial. `[VERIFIED: MDN]` |
| Date arithmetic across DST | Adding `n * 86400000` ms to a timestamp | `Date` constructor `new Date(y, m-1, d)` + `setDate(d.getDate() + n)` | DST springs/falls back skip/duplicate an hour — millisecond math drifts. `setDate` respects local calendar. `[VERIFIED: MDN]` |
| IndexedDB request promisification | Callback-mapping helpers per call site | Single `promisify(request)` in `idb.js` | One mistake (forgetting `onsuccess` after `onerror`) leaks promises. Centralize. |
| Cross-tab pub/sub | localStorage + `storage` event | `BroadcastChannel('habits')` | `storage` requires writing to localStorage, which we don't want. BC is one line. `[CITED: STACK.md]` |
| Save-on-unload | `beforeunload` listener | `visibilitychange === 'hidden'` + `pagehide` | `beforeunload` is unreliable on mobile and PWAs. `[VERIFIED: MDN]` |
| Manual IDB transaction commits | `tx.commit()` calls everywhere | `await tx.done` (Promise wrapping `oncomplete`) | IDB auto-commits when idle; explicit `commit()` is rarely necessary. `oncomplete` is the source-of-truth for "data is durable." `[VERIFIED: MDN IDBTransaction]` |
| File path serving in `scripts/serve.js` | Naive `req.url`-to-path mapping | `normalize(join(ROOT, urlPath))` with `startsWith(ROOT + sep)` guard | Path traversal (`../../etc/passwd`) is a real category of vulnerability even on `localhost`. Sleep-tracker's `serve.js` already has the guard. `[VERIFIED: sleep-tracker/scripts/serve.js inspected]` |
| Date formatting in CSV columns | `toLocaleDateString()` | `formatLocalYMD(d)` from `util/date.js` | Locale-dependent output (e.g., `26.05.2026` vs `05/26/2026`) breaks the CSV column-sort assumption. ISO local is deterministic. |

**Key insight:** The single biggest hand-rolled trap in this phase is **date arithmetic.** Almost every other module depends on `js/util/date.js` being correct. Tests for it (DST 2026-03-29, DST 2026-10-25, leap 2028-02-29) are not optional — they are load-bearing.

## Runtime State Inventory

> P2 is a greenfield-data phase (no prior IDB data exists; Phase 1 shipped no IndexedDB store) — but it DOES touch a string identifier (`'habits'` vs `'nawyki'`) referenced in Phase 1 docs/diagnostics. Audit included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|-------------------|
| Stored data | **None — verified.** Phase 1 shipped no IndexedDB stores; there is no prior `nawyki` database to migrate. `caches.keys()` in P1 already used the `habits-` prefix (D-29). P2 starts with `indexedDB.open('habits', 1)` for the first time on every user's machine. | None |
| Live service config | **None — verified.** No external service registrations. No notification subscriptions, no third-party SDKs, no remote backends. | None |
| OS-registered state | **None — verified.** No Windows Task Scheduler, no launchd, no systemd unit. The app is a static PWA installed via "Add to Home Screen" / URL-bar icon; those installations carry the manifest `name: "Habits"` from P1, which is already correct. | None — but flag: any user who installed a P1 build with the `nawyki` literal anywhere (unlikely; D-29 renamed to `habits-` before P1 shipped) gets a clean state on first P2 launch because there's no IDB to migrate. |
| Secrets/env vars | **None — verified.** No `.env` file, no secret keys, no env-var-injected names. CI workflow uses only `actions/setup-node@v4`. | None |
| Build artifacts | **None — verified.** No build step exists. No `dist/`, no `node_modules/`, no compiled artifacts. The diagnostics panel's cache-name regex `/^habits-/` (already shipped in P1) will continue to match. | None |
| Docs / planning references to `nawyki` | **Two references found** in CONTEXT.md noting the rename: (1) ARCHITECTURE.md still has `BroadcastChannel('nawyki')` in §6 — D-30 says forward-edit during P2 planning; (2) Phase 1 D-05 dialog string mentioning the "nawyki IndexedDB database" — D-30 says forward-edit during P2 planning (the D-06 confirm copy lives in `diagnostics.js` and references "Reset shell" only, not the data DB by name, so no edit needed in the JS — but the doc still references it). | Forward-edit ARCHITECTURE.md (line ~284 + §6) + 01-CONTEXT.md D-05 description during P2 planning. Doc-only changes, no runtime impact. |

**Canonical question answered:** After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered? **Nothing — verified above.**

## Common Pitfalls

(See also `.planning/research/PITFALLS.md` §Pitfalls 1, 3, 4, 5, 8, 10 — load-bearing for P2.)

### Pitfall 1: Awaiting Unrelated Async API Mid-Transaction

**What goes wrong:** Code inside a `runTx(['logs','events'], async tx => { await fetch('/something'); ... })` callback yields the microtask queue. IndexedDB auto-commits the tx as soon as it's idle for one tick. The next operation throws `TransactionInactiveError`.
**Why it happens:** IDB spec — `tx.complete` fires the moment no requests are pending and no new ones have been scheduled in the next tick.
**How to avoid:** Inside `runTx`, only use `tx.objectStore(...)` operations from `idb.js`. Compute everything else BEFORE opening the tx (read repo state, prepare payloads), then run a pure write sequence.
**Warning signs:** Random `TransactionInactiveError` in dev; works locally, fails on slow networks. `[VERIFIED: MDN IDBTransaction]`

### Pitfall 2: Broadcasting Before tx.done

**What goes wrong:** Other tabs receive the broadcast, re-read IDB before the writing tx has committed, see stale data, and trust their stale read.
**Why it happens:** `tx.objectStore(s).put(v)` resolves when the request is queued, not when the tx commits.
**How to avoid:** `await runTx(...)` returns only after `tx.complete` fires. THEN call `broadcast(...)`. Implement `done(tx)` in `idb.js` as a Promise around `tx.oncomplete` / `tx.onerror`.
**Warning signs:** Multi-tab tests flake; second tab sees old value 1-2% of the time. `[CITED: Pitfall 8]`

### Pitfall 3: First-Run `persist()` Confused for Eviction Test

**What goes wrong:** `navigator.storage.persist()` returns `false` on Chrome on first launch (because Chrome decides via "engagement metrics" — bookmark, installed, etc., none of which apply on a brand-new visit). Code interprets `false` as "user denied" and shows a scary error.
**Why it happens:** Chrome doesn't prompt; it returns `false` silently if engagement metrics don't meet the bar. `[VERIFIED: web.dev Persistent storage]`
**How to avoid:** Treat `persist() === false` on first run as "ok, the request was made — we can retry later or surface it as 'Persistence: not granted' in diagnostics." Do NOT treat it as user denial. After install (`appinstalled` event in P3), retry the call — installed PWAs reliably get persistent storage.
**Warning signs:** Diagnostics shows "Persistence: no" forever even though the app is installed.

### Pitfall 4: Date Boundary Bugs (DST + Leap)

**What goes wrong:** `new Date().toISOString().slice(0,10)` at 23:30 Warsaw time on 2026-03-28 writes a log row keyed `2026-03-29` (UTC) — but the user thinks they did the habit *yesterday*. Worse: on 2026-03-29 (Europe/Warsaw spring-forward DST), `setDate(d.getDate() + 1)` may either land on the correct calendar day or skip an hour silently depending on the time-of-day the calculation runs.
**Why it happens:** `Date` is a wall-clock-shifted UTC under the hood; arithmetic on `.getTime()` (ms epoch) ignores DST.
**How to avoid:** **Three concrete dates in `tests/unit/date.test.js`, not abstract assertions:**
- `2026-03-29` (Europe/Warsaw DST spring-forward — 02:00 → 03:00 disappears)
- `2026-10-25` (Europe/Warsaw DST fall-back — 03:00 → 02:00 repeats)
- `2028-02-29` (leap day — `setMonth(1, 29)` then `setMonth(1, 30)` and verify behavior)

All `util/date.js` functions construct via `new Date(y, m-1, d)` and add via `setDate(d.getDate() + n)`. Format via manual `${y}-${pad(m)}-${pad(d)}` string assembly using `getFullYear`/`getMonth+1`/`getDate` — NEVER `toISOString()`. `[CITED: Pitfall 4]`
**Warning signs:** Late-night check-ins land on tomorrow; "every 2 days" drifts after DST; leap-day arithmetic returns March 1 instead of February 29.

### Pitfall 5: Seed Re-Insertion on Every Boot

**What goes wrong:** Seed loader runs on every boot. Naive implementation: "if `habits` is empty, insert seed." A user who edits all 8 seed habits to be customized → app crashes → user reopens with empty IDB → seed inserts again with NEW UUIDs because the stable seed UUIDs are now considered "not in the DB."
**Why it happens:** The "is store empty?" heuristic is fragile. The check must be per-id, not per-store.
**How to avoid:** D-33 is explicit: per-id merge. The seed loader iterates the seed file and inserts only entries whose `id` is not in `meta.seededIds` AND not in `habits` (defensive double-check). `meta.seededIds` is the fast-path optimization for the common case (already-seeded).
**Warning signs:** Duplicate seed habits with subtle ID differences after a crash-recovery scenario.

### Pitfall 6: Forgetting `score_snapshots` in V1 Schema → V2 Migration

**What goes wrong:** P6 wants to write `score_snapshots`. Existing users' DBs are at v1 (no such store). P6 ships a v2 migration just to add an empty store.
**Why it happens:** Optimizing for "what we need today."
**How to avoid:** D-39 locks this — declare `score_snapshots` in `createV1Stores` now, with the same keypath + indexes the future P6 code will need. Empty store costs nothing. **Schema additions during the same v1 release are free; v2 migrations against real user data are not.**
**Warning signs:** P6 plan says "add a store" instead of "start writing to an existing empty store."

### Pitfall 7: `meta.undoToken` Survives Reload but Inverse Event Doesn't

**What goes wrong:** `apply.js` writes `meta.undoToken = <id>`. User reloads. On boot, `undo.js` reads the token, tries to fetch `events[<id>]`, gets back a stale event whose `inverse` references a row that's been re-overwritten.
**Why it happens:** P2's design is single-step undo (one slot). If the user makes another mutation after the undoable one, the new mutation's event takes over `meta.undoToken`. Old token is gone. So far so good — but if `apply.js` ever forgets to update `meta.undoToken` (or updates it to a non-undoable event id), the slot points at a row that may or may not still describe a valid inverse.
**How to avoid:** Every `apply.js` write MUST update `meta.undoToken` in the same tx — even non-undoable writes (set it to `null`, which `undo.js` reads as "nothing to undo"). For P2, `markCompleted` is undoable and writes the new event id; future non-undoable events (P3+ system mutations) write `null`.
**Warning signs:** Undo button "succeeds" but actually does nothing (silent no-op on stale token).

### Pitfall 8: SHELL List Drift After Adding New `/js/**` Files

**What goes wrong:** P2 adds ~12 new `.js` files under `/js/db/`, `/js/state/`, `/js/io/`, `/js/platform/`. The SW SHELL list in `sw.js` doesn't include them. First offline reload: the cache-first branch misses, falls through to network, network is offline, app fails to boot.
**Why it happens:** D-29's stale-while-revalidate for `/js/**` should catch this — but only if the file was fetched at least once while online. A fresh install over a flaky network might cache the shell but never the new JS modules.
**How to avoid:** Planner picks one of two strategies:
  - **(a) Add every new `.js` file to the SHELL list explicitly** — guarantees offline boot. Costs one PR entry per new file.
  - **(b) Rely on SWR + a "warm the cache" boot-time fetch loop** — `main.js` issues `fetch('./js/db/idb.js')` etc. on first run to seed the SWR cache. Risky during low-connectivity first run.
  
  **Recommendation:** Strategy (a). The SHELL list is small and the cost is one line per file.
**Warning signs:** Offline reload after a fresh deploy shows blank shell + console "import failed."

### Pitfall 9: Tests Importing the Real `js/db/idb.js`

**What goes wrong:** A test in `tests/integration/repo.roundtrip.test.js` imports `js/db/repo.js`, which imports `js/db/idb.js`, which calls `indexedDB.open(...)`. In Node, `indexedDB` doesn't exist. Tests crash on module load — before any assertion runs.
**Why it happens:** ES modules don't have ergonomic mocking without npm tooling.
**How to avoid:** D-25 locks the pattern — `tests/helpers/fake-idb.js` exposes the **same surface** as `js/db/repo.js`. Tests import the fake directly. The real `repo.js` is exercised only in `tests-browser.html` (manual). Alternative (more invasive): factor `repo.js` to accept an `idbAdapter` parameter and inject the fake from tests. **Recommendation: D-25's parallel-implementation approach** — simpler, no production code change.
**Warning signs:** `ReferenceError: indexedDB is not defined` on `node --test`.

### Pitfall 10: CI Workflow Not Running on PR

**What goes wrong:** D-38 says CI runs on push AND PR. A workflow with only `on: push` won't run on a PR from a fork. A workflow with `on: pull_request` but no `branches:` may not run on PRs to the default branch.
**Why it happens:** GitHub Actions trigger semantics are easy to mis-spell.
**How to avoid:** Use both: `on: { push: { branches: [main] }, pull_request: { branches: [main] } }`. Add a smoke "echo test" job in P2 plan 1 that proves the workflow fires on a sample PR before merging real tests.
**Warning signs:** PR shows "no checks have run" — the merge-gate is silently ungated.

### Pitfall 11: `navigator.storage.persist()` Called Multiple Times

**What goes wrong:** Seed loader calls `persist()` on first run. Then on the second run the loader also calls it (because it's not tracking whether it already did). Doesn't crash, but spams the diagnostics console with unnecessary calls.
**Why it happens:** Re-calling is idempotent at the API level but the result is the same every time.
**How to avoid:** Write `meta.persistRequested = true` (or even `meta.persistResult = <boolean>`) on first call. Check it before re-calling.
**Warning signs:** Network panel shows multiple StorageManager probes on every boot.

### Pitfall 12: Seed Habit Cadence Schema Drift vs P4 Cadence Engine

**What goes wrong:** P2 ships seed habits whose `cadence` field uses an ad-hoc shape (e.g., `{type: "weekly"}`). P4 ships the cadence engine with a stricter shape (e.g., `{type: "weekly", week_start: "monday"}`). Seed data fails to parse on P4 first boot.
**Why it happens:** Seed shape is defined before the engine that consumes it.
**How to avoid:** P2 seed shape MUST be conservative and forward-compatible. Use a `version` field on the cadence record (`{cadence_v: 1, type: "weekly"}`) so P4 can dispatch. Better: P2 reviews FEATURES.md + the eventual cadence engine spec from ARCHITECTURE.md and locks the cadence schema **as part of the seed-loader plan**, not as a P4 surprise.
**Warning signs:** P4 plan says "cadence engine breaks on seed data" — that's P2's bug.

### Pitfall 13: `crypto.randomUUID()` on `file://` — Mixed Browser Behavior

**What goes wrong:** CONTEXT.md says "no fallback needed — every target browser exposes `crypto.randomUUID()` on `file://`." This is **mostly true but not universally guaranteed**. The W3C secure-contexts spec recommends treating `file://` as potentially trustworthy, and Chrome + Firefox follow this — `crypto.randomUUID()` works on `file://` for them. **Safari's stance is less consistent across versions** — some versions don't classify `file://` as a secure context, in which case the entire Web Crypto API including `randomUUID()` is unavailable. `[CITED: MDN Crypto/randomUUID; W3C secure-contexts §6.2; bram.us secure-contexts review]`
**Why it happens:** Spec says "SHOULD treat as trustworthy" — not "MUST."
**How to avoid:** `js/util/id.js` is a ~10-line module. Make it bulletproof with a one-line fallback:
```javascript
export function newId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 from crypto.getRandomValues (available without secure context in some browsers)
  // or fall through to Math.random when neither exists (file://-on-old-Safari edge case).
  // This is documented as "rare-path fallback" — production runs are virtually always on the primary path.
  return v4Fallback();
}
```
The fallback adds ~10 lines, no dependencies, no downside. CONTEXT.md's "Claude's Discretion" leeway allows this refinement.
**Warning signs:** Safari user on `file://` opens the app, `crypto.randomUUID is not a function`, app crashes on first seed write.

## Code Examples

### `js/util/date.js` — Local YYYY-MM-DD utilities

```javascript
// Source: hand-written based on Pitfall 4 + Anti-Pattern 3
/** @file Local-time YYYY-MM-DD utilities (DATA-06). Never uses UTC for date keys. */

/** @returns {string} Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayLocal() {
  return formatLocalYMD(new Date());
}

/**
 * Format a Date as YYYY-MM-DD using local calendar (NOT UTC).
 * @param {Date} d
 * @returns {string}
 */
export function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Parse YYYY-MM-DD to a Date at local midnight (NOT UTC midnight).
 * @param {string} s
 * @returns {Date}
 */
export function parseLocalYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);  // local
}

/**
 * Returns the date N days before/after a YYYY-MM-DD anchor, as YYYY-MM-DD.
 * Handles DST correctly via setDate (which respects the local calendar).
 * @param {string} anchorYMD
 * @param {number} n  positive or negative
 * @returns {string}
 */
export function daysFrom(anchorYMD, n) {
  const d = parseLocalYMD(anchorYMD);
  d.setDate(d.getDate() + n);
  return formatLocalYMD(d);
}
```

### `js/util/id.js` — UUID with safe fallback

```javascript
// Source: hand-written; addresses Pitfall 13
/** @file UUID generation for habits, habit_versions, events (D-42). */

/** @returns {string} A new UUID. Uses crypto.randomUUID when available; falls back for rare contexts. */
export function newId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (globalThis.crypto && typeof crypto.getRandomValues === 'function') {
    return uuidV4FromGetRandomValues();
  }
  // Last-resort fallback (Math.random — collision risk acknowledged; only fires on
  // very old browsers in non-secure contexts).
  return uuidV4FromMathRandom();
}

function uuidV4FromGetRandomValues() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map(b => b.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`;
}

function uuidV4FromMathRandom() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

### `js/db/idb.js` — Promise wrapper sketch

```javascript
// Source: hand-written per STACK.md §IndexedDB Approach
/** @file Hand-written ~80-line promise wrapper around IndexedDB. The ONLY module that calls `indexedDB`. */

import { DB_VERSION, MIGRATIONS } from './schema.js';

const DB_NAME = 'habits';   // D-30

/** @returns {Promise<IDBDatabase>} Resolves with an open DB at DB_VERSION. */
export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;
      for (let v = e.oldVersion + 1; v <= e.newVersion; v++) {
        MIGRATIONS[v](db, tx);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {IDBRequest} req */
export function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {IDBTransaction} tx */
export function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('tx aborted'));
  });
}

/**
 * Run a sequence of ops inside one tx. Awaits tx.oncomplete before resolving.
 * @template T
 * @param {IDBDatabase} db
 * @param {string[]} stores
 * @param {'readonly'|'readwrite'} mode
 * @param {(tx: IDBTransaction) => Promise<T>|T} body
 * @returns {Promise<T>}
 */
export async function runTx(db, stores, mode, body) {
  const tx = db.transaction(stores, mode);
  const result = await body(tx);
  await done(tx);
  return result;
}

// + get(db, store, key), getAll, put, del, cursor, indexGetAll helpers ...
```

### `tests/helpers/fake-idb.js` — In-memory fake

```javascript
// Source: hand-written per D-25
/** @file ~30-line in-memory fake matching js/db/repo.js surface for tests/integration/*. */

export function createFakeRepo() {
  const stores = {
    habits: new Map(),
    habit_versions: new Map(),
    logs: new Map(),
    events: new Map(),
    settings: new Map(),
    meta: new Map(),
    score_snapshots: new Map(),
  };
  const keyOf = (store, value) => {
    if (store === 'logs' || store === 'habit_versions' || store === 'score_snapshots') {
      return JSON.stringify([value.habitId, value.date ?? value.effectiveFrom]);
    }
    return value.id ?? value.key;
  };
  return {
    async getHabit(id) { return stores.habits.get(id); },
    async putHabit(h) { stores.habits.set(h.id, h); },
    async putLog(l) { stores.logs.set(keyOf('logs', l), l); },
    async getLog(habitId, date) { return stores.logs.get(JSON.stringify([habitId, date])); },
    async putEvent(e) { stores.events.set(e.id, e); },
    async getEvent(id) { return stores.events.get(id); },
    async getMeta(key) { return stores.meta.get(key)?.value; },
    async putMeta(key, value) { stores.meta.set(key, { key, value }); },
    async putSetting(s) { stores.settings.set(s.key, s); },
    async getSetting(key) { return stores.settings.get(key); },
    // Simulate a tx: just run the body (no real isolation needed for unit tests).
    async runTx(stores, mode, body) { return body(); },
    _stores: stores,  // exposed for assertions
  };
}
```

### `.github/workflows/ci.yml` — Test workflow

```yaml
# Source: hand-written per D-38 + D-24
name: ci
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run tests
        run: node --test tests/
```

### `scripts/serve.js` — Pattern lifted from sleep-tracker

See `../sleep-tracker/scripts/serve.js` — 58 lines, `node:http` + `node:fs` + `node:path`, path-traversal guard via `filePath.startsWith(ROOT + sep)`, small MIME map covering `.html .css .js .mjs .json .svg .png .ico .txt`. Swap the log line to read `[habits] serving ...` and the script is ready to commit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Classic SW + `importScripts` | Module SW + ES `import` | 2026-05-26 (D-29, P1) | Single source of truth for `APP_VERSION`; classic-SW path was broken (caught in P1 human-verify). P2 inherits the module-SW model unchanged. |
| `BroadcastChannel('nawyki')` (per ARCHITECTURE.md §6) | `BroadcastChannel('habits')` | 2026-05-26 (D-30) | Identifier alignment with manifest + cache prefix. ARCHITECTURE.md gets forward-edited during P2. |
| Events store autoincrement integer key | Events store UUID key | 2026-05-26 (D-42) | Consistent with all other stores; cross-device import safety. Chronological order via index on `at`. |
| `score_snapshots` declared in P6 v2 migration | `score_snapshots` declared empty in v1 (P2) | 2026-05-26 (D-39) | Avoids a v2 migration just to add a store. Empty store costs nothing. |
| Polish habit names as user content | English primary + `name_pl` optional field | 2026-05-26 (D-35 + D-40) | PROJECT.md + CLAUDE.md "Polish habit names preserved verbatim" constraint is reversed during P2. |
| `python -m http.server` for local dev | `node scripts/serve.js` | 2026-05-26 (D-46) | Removes Python-on-PATH assumption. README updated. |
| Manual tests in browser console | `node --test tests/` + `.github/workflows/ci.yml` | 2026-05-26 (D-23..D-38) | TDD-blocking gate; green CI is merge criterion from P2 plan 1. |

**Deprecated / outdated guidance to ignore:**
- ARCHITECTURE.md §6 mentions `BroadcastChannel('nawyki')` — **superseded by D-30** (use `'habits'`).
- ARCHITECTURE.md §3 lists "events autoincrement" — **superseded by D-42** (UUID).
- ARCHITECTURE.md §3 lists 6 stores — **superseded by D-39** (7, including `score_snapshots`).
- ARCHITECTURE.md §1 mentions `js/util/id.js` "with file:// fallback" — **partially refined by CONTEXT.md "Claude's Discretion"**: keep the fallback as defense-in-depth (see Pitfall 13), but the primary path is `crypto.randomUUID()`.
- STACK.md §"Migration Pattern" shows `switch (event.oldVersion) { case 0: ...; case 1: ...; }` fallthrough — **superseded** by the dispatch-table loop pattern (Pitfall 10: "Never rely on fall-through `case`; use explicit loop").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node 20+ is available on developer machines and on `ubuntu-latest` CI runners by default. | §Standard Stack, §CI workflow | LOW — `actions/setup-node@v4` provisions Node 20 explicitly. Local developer can verify with `node --version`. |
| A2 | Chrome and Firefox treat `file://` as a secure context, allowing `crypto.randomUUID()` to work. | §Standard Stack, §Pitfall 13 | LOW — Pitfall 13's fallback covers the Safari-on-file:// edge case. Production deployments are on HTTPS (GitHub Pages), so secure-context is guaranteed there. |
| A3 | `navigator.storage.persist()` returning `false` on first run (Chrome's engagement-metrics gate) is non-fatal — the app continues functioning, persistence is granted later when "Add to Home Screen" / install occurs. | §Standard Stack, §Pitfall 3 | LOW — `[VERIFIED: web.dev]`. Worst case: data eviction risk for users who never install. The "Last backup" nag (P5) mitigates. |
| A4 | The `cadence` schema for seed habits in P2 can be inferred from FEATURES.md + ARCHITECTURE.md before P4 actually builds the cadence engine. | §Pitfall 12 | MEDIUM — if P4 redefines cadence shape, P2 seed habits need a back-migration. Mitigation: seed loader supports per-cadence `cadence_v` field; P4 can dispatch on it. **Planner should explicitly pin the seed cadence shape in the seed-loader plan, not in P4.** |
| A5 | Adding all new `/js/**` files to the SW SHELL list in `sw.js` is preferred over relying on stale-while-revalidate to seed the cache. | §Pitfall 8 | LOW — both work; SHELL listing is one-line-per-file overhead; SWR works if user has ever been online with the new files. |
| A6 | The W3C secure-contexts spec's "file:// SHOULD be trusted" recommendation is honored consistently enough in 2026 evergreen Chrome + Firefox that `crypto.randomUUID()` works on `file://` for those browsers. Safari behavior is the uncertain case. | §Standard Stack, §Pitfall 13 | LOW (with fallback) — Pitfall 13's fallback is the contingency. |
| A7 | `tests/helpers/fake-idb.js` matches the `repo.js` surface exactly. Drift between fake and real is the most likely false-pass test failure mode. | §Code Examples (fake-idb.js) | MEDIUM — mitigate with a "surface contract" test that imports both modules and asserts they export the same function names. Manual smoke via `tests-browser.html` is the safety net. |
| A8 | The 8-habit coverage-first stub seed (D-32) covers enough of the cadence × log-shape space to validate the spine end-to-end. The full ~65 seed can ship later without retroactively requiring a v2 migration. | §User Constraints, §Pitfall 12 | LOW — D-33's merge-by-id semantics make the full seed purely additive. |
| A9 | Persistent undo via `meta.undoToken` is the only undo state needed in P2. No in-memory stack is required for cross-tab survival because every reload re-reads the token. | §Standard Stack, §Pitfall 7 | LOW — P2's success criteria 4 (cross-tab) + UNDO-02 (survives reload) are satisfied by the persistent-only design. P3's UI toast adds the in-memory ergonomics later. |
| A10 | Browser support for the Web Crypto API on `localhost` and `https://` is universal in 2026 evergreen browsers — only `file://` has any uncertainty. | §Standard Stack | LOW — `[VERIFIED: MDN]`. |

**If this table is empty:** N/A — there ARE assumptions. The planner and discuss-phase should review especially A4 (seed cadence schema) and A7 (fake-IDB surface contract) — those are the only assumptions where being wrong costs more than "rare-path fallback code runs."

## Open Questions

1. **Should the planner pre-write the cadence schema for the 8 seed habits, or defer it?**
   - What we know: D-32 specifies the cadence shapes (daily binary × 2, weekly binary, every-2-days binary, day-of-week-subset binary, daily numeric counter, slot-checklist anonymous, slot-checklist user-labeled). P4 builds the cadence engine that interprets this.
   - What's unclear: Whether P2 should ship a stable cadence schema (a `cadence_v: 1` field on each habit record) or leave the cadence shape provisional until P4.
   - Recommendation: **Lock the cadence schema in P2's seed-loader plan.** Use the FEATURES.md descriptions + cross-check with ARCHITECTURE.md's domain notes. Treat the seed as the source of truth for "what shapes the cadence engine must support in P4." If P4 needs to extend the shape, that's an additive (forward-compatible) change.

2. **Should `apply.js` accept an injected `repo` for testability, or rely on the parallel `tests/helpers/fake-idb.js`?**
   - What we know: D-25 locks the fake-IDB-as-parallel-implementation pattern.
   - What's unclear: Whether the same fake-IDB approach extends cleanly to `apply.js` tests, or whether DI is cleaner there.
   - Recommendation: **Stick with D-25's parallel-implementation pattern for the integration tests.** No DI in production code. Tests construct the fake repo, pass it to apply.js explicitly (via a tiny `apply.configure({ repo })` boot step). This keeps production code DI-free while making tests trivial.

3. **What does the seed file's outer shape look like?**
   - What we know: D-31, D-32 specify the contents. D-33 specifies the merge semantics.
   - What's unclear: Whether `seed/habits.json` is a flat array of habits, or a wrapped object `{ schemaVersion: 1, habits: [...] }`.
   - Recommendation: **Wrapped object.** Including `schemaVersion` and `seedVersion` at the top level lets the loader assert compatibility and gives the future full-65 seed a place to put metadata.

4. **Should P2 ship a minimal `state/store.js` (with subscribe API) or defer it to P3?**
   - What we know: P3's Today view will consume it. P2's success criteria don't reference views.
   - What's unclear: Whether the round-trip test in `apply.markCompleted.test.js` benefits from going through `state/store.js` or whether it's cleaner to assert on the IDB outcome directly.
   - Recommendation: **Ship a minimal `state/store.js` in P2** — just `hydrate()` + `subscribe()` + `notify()`. ~60 lines. Means P3 doesn't have to retrofit subscribers into already-shipped `apply.js` mid-feature.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test tests/`, `node scripts/serve.js` | (assumed — confirm at planning time) | ≥ 20 | None — D-47 is strict. Developer installs Node 20 if missing. |
| GitHub Actions runner `ubuntu-latest` | CI workflow | Yes (managed by GitHub) | — | None |
| `actions/setup-node@v4` | CI workflow | Yes (GitHub Marketplace) | v4 | Pin to v4 explicitly; do not use `@main` or floating tags. |
| Web Crypto API (`crypto.randomUUID`) | `js/util/id.js` | Yes on HTTPS + localhost; mostly yes on `file://` (Chrome/Firefox per W3C); Safari-on-file uncertain | living | `js/util/id.js` Pitfall-13 fallback covers all cases. |
| IndexedDB | Every storage feature | Yes on every target browser | living | None — no fallback exists; if IndexedDB is unavailable, the app cannot function. Diagnostics panel should show "IndexedDB: unavailable" gracefully (P2 enhancement). |
| BroadcastChannel | `js/platform/sync.js` | Yes on every target browser (Baseline Widely Available) | living | None needed; cross-tab sync is graceful-degrade-friendly — if BC fails, single-tab still works. |
| `navigator.storage.persist()` | `js/io/seed.js` first-run path | Yes on every target browser | living | Treat `false` as "not granted yet, retry on install" (Pitfall 3). Not a fatal error. |

**Missing dependencies with no fallback:** None blocking. Node 20+ is the only hard requirement on the developer side and on CI.

**Missing dependencies with fallback:** Web Crypto on `file://` (covered by Pitfall 13 fallback).

## Validation Architecture

> Nyquist validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) — Node 20+ |
| Config file | None (auto-discovers `tests/**/*.test.js`) |
| Quick run command | `node --test tests/unit/<file>.test.js` (single file during TDD red→green) |
| Full suite command | `node --test tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Habit + log writes persist across "reload" (fake-IDB session) | integration (fake-IDB) | `node --test tests/integration/repo.roundtrip.test.js` | Wave 0 |
| DATA-02 | `DB_VERSION` + `MIGRATIONS` dispatch table runs each migration in order | unit | `node --test tests/unit/schema.test.js` | Wave 0 |
| DATA-03 | `navigator.storage.persist()` called on first write; not re-called on subsequent boots | integration (fake-IDB + spy on `navigator.storage.persist`) | `node --test tests/integration/seed.persist.test.js` | Wave 0 |
| DATA-04 | Direct repo write outside `state/apply.js` raises a discipline violation (or: assert there's no code path that writes outside apply.js — grep test) | unit + grep | `node --test tests/unit/apply.discipline.test.js` | Wave 0 |
| DATA-05 | Schema includes `habit_versions` store with `[habitId, effectiveFrom]` key + log rows include `definitionVersion` field | unit (schema introspection) + integration (fake-IDB) | `node --test tests/unit/schema.test.js tests/integration/repo.roundtrip.test.js` | Wave 0 |
| DATA-06 | `todayLocal()`, `formatLocalYMD`, `parseLocalYMD`, `daysFrom` return correct strings across DST 2026-03-29, DST 2026-10-25, leap 2028-02-29 | unit | `node --test tests/unit/date.test.js` | Wave 0 |
| DATA-07 | `apply.js` posts to `BroadcastChannel('habits')` after tx.done, with `{keys}` not values; receiver invalidates cache | integration (fake-IDB + fake-BC) | `node --test tests/integration/sync.broadcast.test.js` | Wave 0 |
| DATA-08 | `visibilitychange === 'hidden'` triggers flush; `beforeunload` does NOT | unit (fake-document) | `node --test tests/unit/lifecycle.test.js` | Wave 0 |
| SEED-01 | `seed/habits.json` exists and parses as `{ schemaVersion, seedVersion, habits: [...] }` | unit | `node --test tests/unit/seed.shape.test.js` | Wave 0 |
| SEED-02 | Seed contains 8 habits per D-32 coverage matrix (verify count + every required cadence/log-shape) | unit | `node --test tests/unit/seed.shape.test.js` | Wave 0 |
| SEED-03 | Second seed load (with existing `meta.seededIds`) is a no-op (no duplicates, no overwrites) | integration (fake-IDB) | `node --test tests/integration/seed.idempotent.test.js` | Wave 0 |
| SEED-04 | Each seeded habit produces one `events` row with `type: 'seed:createHabit'` | integration (fake-IDB) | `node --test tests/integration/seed.idempotent.test.js` | Wave 0 |
| SEED-05 | No xlsx/txt parsing code in `js/io/` or anywhere in `js/` | unit (grep test) | `node --test tests/unit/seed.shape.test.js` | Wave 0 |
| UNDO-02 (round-trip demo) | `apply(markCompleted) → undo() → state restored; meta.undoToken survives "reload"` | integration (fake-IDB) | `node --test tests/integration/undo.persist-reload.test.js` | Wave 0 |

### Sampling Rate

- **Per task commit (during TDD red→green):** `node --test tests/unit/<file>.test.js tests/integration/<file>.test.js` for the file under change.
- **Per wave / slice merge:** `node --test tests/` (full suite, both unit + integration trees).
- **Phase gate:** `node --test tests/` green + manual browser smoke (next subsection) passing before `/gsd-verify-work`.

### Wave 0 Gaps

All test files are new in P2. Wave 0 (first plan) instantiates the test infrastructure:

- [ ] `tests/helpers/fake-idb.js` — ~30-line in-memory fake matching `repo.js` surface (D-25)
- [ ] `tests/helpers/fake-broadcast-channel.js` — tiny stub for `tests/integration/sync.broadcast.test.js`
- [ ] `tests/helpers/fake-storage.js` — spies on `navigator.storage.persist` and `navigator.storage.persisted`
- [ ] `tests/helpers/fake-document.js` — emits `visibilitychange` and `pagehide` events
- [ ] `tests/unit/date.test.js` — DST × leap fixtures (covers REQ-DATA-06)
- [ ] `tests/unit/id.test.js` — UUID shape + fallback path
- [ ] `tests/unit/schema.test.js` — covers REQ-DATA-02, REQ-DATA-05
- [ ] `tests/unit/lifecycle.test.js` — covers REQ-DATA-08
- [ ] `tests/unit/seed.shape.test.js` — covers REQ-SEED-01, REQ-SEED-02, REQ-SEED-05
- [ ] `tests/unit/apply.discipline.test.js` — covers REQ-DATA-04
- [ ] `tests/integration/repo.roundtrip.test.js` — covers REQ-DATA-01, REQ-DATA-05
- [ ] `tests/integration/apply.markCompleted.test.js` — round-trip including undo
- [ ] `tests/integration/undo.persist-reload.test.js` — covers UNDO-02 round-trip
- [ ] `tests/integration/seed.idempotent.test.js` — covers REQ-SEED-03, REQ-SEED-04
- [ ] `tests/integration/seed.persist.test.js` — covers REQ-DATA-03
- [ ] `tests/integration/sync.broadcast.test.js` — covers REQ-DATA-07
- [ ] `.github/workflows/ci.yml` — runs `node --test tests/` on push/PR (D-38)
- [ ] (Optional) `tests/integration/contract.fake-vs-real.test.js` — a "surface contract" test asserting `tests/helpers/fake-idb.js` exports match `js/db/repo.js` exports by name (A7 mitigation)

### Manual Browser Smoke Checklist (real-environment validation — `tests-browser.html` per D-26)

Automated tests use fakes. The following must pass in a real browser before the phase gate. These exercise the real `js/db/idb.js`, real `BroadcastChannel`, real `visibilitychange`, and real `navigator.storage.persist()` — none of which run in `node --test`.

- [ ] **Cold boot — real IDB persistence:** Open `http://localhost:8080/` (after `node scripts/serve.js`). Check DevTools → Application → IndexedDB → `habits` v1. Verify all 7 stores exist. Verify `habits` has 8 rows. Verify `events` has 8 rows of `type: 'seed:createHabit'`. Close tab. Reopen. Verify rows persist.
- [ ] **`navigator.storage.persist()` actually fires:** Set a breakpoint on the `persist()` call in `io/seed.js`. First launch — breakpoint hits. Check `await navigator.storage.persisted()` returns `true` (Firefox prompts; Chrome may return `false` if engagement metrics not met — both are acceptable, see Pitfall 3). Reload — `persist()` NOT called again.
- [ ] **Real BroadcastChannel between two tabs:** Open `index.html` in two tabs. In Tab A devtools console: `import('./js/state/apply.js').then(m => m.apply({ type: 'markCompleted', habitId: '<a-seeded-uuid>', date: '2026-05-26' }))`. Tab B's console (if subscribed for testing) logs the `mutation` broadcast. Verify Tab B's IDB shows the same log row after the broadcast.
- [ ] **Real `visibilitychange` flush:** Trigger a slow tx (insert artificial `setTimeout`). Switch to another tab before the tx commits. Verify (via subsequent IDB inspection) that the tx completed. Verify `beforeunload` is NOT subscribed (grep `js/platform/lifecycle.js` for `beforeunload` — should be absent).
- [ ] **Undo across reload:** In Tab A: `apply(markCompleted)`. Reload. Verify `meta.undoToken` present. Run `import('./js/state/undo.js').then(m => m.undo())`. Verify log row reverted.
- [ ] **Reset-data button:** Open diagnostics panel (`?debug=1`). Click "Reset data". Confirm dialog appears with the D-06 verbatim phrasing. Confirm. Verify IDB `habits` database is deleted (DevTools → Application → IndexedDB shows it's gone). Page reloads. Verify fresh seed re-runs.
- [ ] **Cross-shell:** Repeat the seed-persistence check after opening `desktop.html` instead of `index.html`. Both shells should see the same IDB origin.
- [ ] **`file://` graceful:** Open `index.html` directly via `file://`. SW does not register (silent). IDB still works (storage panel shows the db). Crypto.randomUUID works in Chrome/Firefox; if it doesn't (Safari edge case), the Pitfall 13 fallback path is exercised.

## Security Domain

> `workflow.security_enforcement: true` (config.json) — ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no** | Single-user, no auth surface. Privacy constraint: app never phones home. |
| V3 Session Management | **no** | No sessions. State is local IDB; cross-tab via BroadcastChannel within same origin. |
| V4 Access Control | **no** | Single-user, single-origin. The only "access boundary" is the browser origin sandbox itself. |
| V5 Input Validation | yes | Seed JSON validation; future P5 import will need schema validation. P2 specifically: `io/seed.js` validates the seed file's `schemaVersion` ≤ current and rejects malformed entries (no `id`, no `name`, etc.). |
| V6 Cryptography | yes | UUID generation via Web Crypto (`crypto.randomUUID()` / `crypto.getRandomValues()`). NEVER hand-roll RNG for IDs that participate in merge-by-id (collision risk). |
| V7 Error Handling and Logging | yes | No outbound error reporting (NFR-05). All errors stay client-side. Sensitive habit content MUST NOT be `console.log`-ed in production paths (gate behind `?debug=1`). |
| V8 Data Protection | yes | `navigator.storage.persist()` (D-41) is the primary defense against silent eviction. Data stays on-device. No telemetry. |
| V11 Business Logic Validation | partial | Seed loader's idempotency (merge-by-id) is a business-logic invariant — the test suite enforces it. |
| V14 Configuration | yes | SW SHELL list correctness (Pitfall 8). Service worker scope `./` (P1, locked). Same-origin guard in `sw.js` already shipped. No off-origin URLs in any new P2 file (NFR-05). |

### Known Threat Patterns for vanilla-PWA + IndexedDB stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in `scripts/serve.js` (`../../etc/passwd`) | Tampering / Information Disclosure | `filePath.startsWith(ROOT + sep)` guard (verbatim from sleep-tracker's serve.js); reject with 403 |
| Prototype pollution via imported seed JSON | Tampering | `JSON.parse` is safe by default (doesn't construct `__proto__` accessors). Belt-and-braces: schema-validate `seed/habits.json` shape before merging. |
| XSS via habit names rendered with `innerHTML` | Tampering | `textContent` only — P1 already enforced this in `diagnostics.js` and `toast.js`. P2 has no view rendering, but if Reset-data dialog ever renders user content, follow the same pattern. |
| Stale SW serves vulnerable old assets | Tampering | Cache versioning + activate cleanup (D-09, D-10) — already shipped in P1 sw.js. |
| Cross-origin request hijack via SW | Tampering | `sw.js` same-origin guard (`url.origin !== self.location.origin → return`) — already shipped in P1. |
| Information disclosure via `console.log` of habit content | Information Disclosure | Production code paths must not console-log habit content. `?debug=1` gate already exists for diagnostics. |
| Slopped npm dependency | Tampering / Supply chain | **N/A** — zero npm dependencies. The supply-chain attack surface for P2 is exactly: GitHub Actions `actions/setup-node@v4` (pinned to a major version, trusted source). |
| Untrusted JSON import (future P5) | Tampering | Out of scope for P2; documented for P5. |
| Cross-tab message tampering | Spoofing / Tampering | Same-origin BroadcastChannel — only same-origin tabs receive. Browser enforces. No additional defense needed. |
| Storage exhaustion (DOS) | Denial of Service | Single-user app, single-device, no remote input. Not exploitable. |

## Sources

### Primary (HIGH confidence)
- MDN — Using IndexedDB (best practices, transactions, migrations): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- MDN — IDBTransaction (auto-commit semantics, oncomplete event): https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction
- MDN — IDBTransaction: complete event: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event
- MDN — BroadcastChannel API: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN — Document: visibilitychange event (recommended over `beforeunload`): https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- MDN — StorageManager: persist() method: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- MDN — StorageManager: persisted() method: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persisted
- MDN — Crypto: randomUUID() method (secure context requirement): https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
- MDN — Secure Contexts (`file://` per spec is "potentially trustworthy"): https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- Node.js documentation — built-in test runner (auto-discovery, `node --test`): https://nodejs.org/api/test.html
- W3C — Secure Contexts spec §6.2 (file URLs SHOULD be trusted): https://www.w3.org/TR/secure-contexts/
- web.dev — Persistent storage (Chrome's engagement-metrics decision; best-practice timing caveat): https://web.dev/articles/persistent-storage

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` (companion file — already locked decisions inherited)
- `.planning/research/ARCHITECTURE.md` §§1, 2, 3, 6, 7 + Anti-Patterns §§1-5
- `.planning/research/PITFALLS.md` §§1, 3, 4, 5, 8, 10
- `.planning/research/FEATURES.md` (feature map context)
- `.planning/phases/01-pwa-shell-tooling-hygiene/01-CONTEXT.md` — D-01..D-29 carry-forward
- `.planning/phases/02-storage-foundation-the-spine/02-CONTEXT.md` — D-30..D-47 locked decisions
- `../sleep-tracker/scripts/serve.js` (directly inspected — pattern reference for D-46)
- `../mindful-breathing/` (directly inspected — zero-dep longevity reference)
- bram.us — "On Secure Contexts in Firefox" (browser behavior on `file://`): https://www.bram.us/2018/01/18/on-secure-contexts-in-firefox-https-for-local-development-and-a-potential-nice-gesture-by-chrome/

### Tertiary (LOW confidence — flagged for validation if used)
- (none — every claim in this RESEARCH.md is backed by Primary or Secondary)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every API verified against MDN as of 2026-05-26; reference projects directly inspected
- Architecture: HIGH — extends locked ARCHITECTURE.md with the D-30..D-47 refinements; no novel patterns
- Pitfalls: HIGH — all 13 pitfalls cross-verified against PITFALLS.md + MDN; Pitfall 13 (`file://` + `randomUUID`) added based on this session's web research that refined CONTEXT.md's "no fallback needed" note
- Validation Architecture: HIGH — direct mapping of every requirement to a test file; node `--test` API verified against nodejs.org

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — stable browser APIs, stable Node test API, no fast-moving deps in scope)

