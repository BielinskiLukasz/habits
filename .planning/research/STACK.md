# Technology Stack

**Project:** Nawyki (Habits) — personal multi-year habit tracker PWA
**Researched:** 2026-05-26
**Mode:** Ecosystem (stack dimension only)
**Overall confidence:** HIGH

> Constraints are pre-locked: vanilla HTML + ES modules + CSS, no framework, no bundler, no npm, no CDN, browser-native APIs only. This document does NOT survey frameworks — it prescribes the build-free patterns that fit those constraints and explains every choice.

---

## TL;DR — The Stack in One Page

| Layer | Choice | Rationale |
|---|---|---|
| **Markup** | Plain HTML5, one `index.html` shell + one auxiliary `desktop.html` | Static, GitHub-Pages-hostable, file://-friendly |
| **JS module system** | Native `<script type="module">` + relative `./` ES imports | Browsers support this natively; works on file:// in Firefox and Safari, fully on HTTP(S) everywhere |
| **JS language** | ES2023 (matches `mindful-breathing` badge); avoid stage-2 proposals | Universally available in 2026 evergreen browsers |
| **Storage** | Raw IndexedDB wrapped by a hand-written ~80-line promise helper (`db/idb.js`) | No npm; full control of schema/transactions; right-sized for ~65 habits × 365×N days |
| **Cross-tab sync** | `BroadcastChannel('nawyki')` | Native, Baseline Widely Available; simpler than `storage` events |
| **Persistence trigger** | `visibilitychange` → `hidden` (NOT `beforeunload`) | Only reliable hook on mobile / when PWA is backgrounded |
| **Export — JSON** | Full-fidelity backup of every IDB store, `Blob` + anchor download | Round-trippable; works on file:// |
| **Export — CSV** | Single wide matrix: rows = habits, columns = days, cells = `1` / `0` / `x` | Locked: human-readable in Excel, no separate file per entity |
| **Import** | JSON only, **merge-by-id** semantics | Locked: existing records updated in place, new records added, untouched records preserved |
| **PWA shell** | `manifest.json` + `sw.js` registered with silent `.catch()` (same pattern as `mindful-breathing`) | Service worker silent-fails on file:// so direct-open still works |
| **SW strategy** | Cache-first for app shell; no special handling for exports (they never hit fetch) | Single-user offline-first; no remote data |
| **CSS architecture** | Cascade Layers (`@layer`) + CSS Custom Properties + per-component files joined with `@import url(...) layer(...)` | Native, build-free, deterministic specificity |
| **Layout split (mobile vs desktop)** | Two separate top-level HTML entry points (`index.html` + `desktop.html`) | Mobile = check-in, desktop = analytics — different DOM, not just a wide responsive layout |
| **Scoring snapshots** | Persisted in a dedicated `score_snapshots` IDB store, written on every log change for the affected date(s) | Locked: snapshots are first-class data, not recomputed on every render |
| **Mobile UX extras** | Vibration API, Touch pointer events | Native; mirrors `mindful-breathing` patterns |
| **No dev tooling** | No npm, no Prettier-via-node, no TypeScript, no JSDoc compiler step | Constraint; zero-build longevity |

---

## Recommended Stack

### Core Runtime

| Technology | Version | Purpose | Why |
|---|---|---|---|
| HTML5 | living standard | Document structure, shell pages | Universally supported, no transpilation |
| CSS3 (Baseline 2024+) | living standard | Styling, layout, layered cascade | `@layer`, container queries, `:has()`, custom properties all Baseline Widely Available |
| JavaScript (ES2023, native modules) | ES2023 | All logic | Match `mindful-breathing` badge; no transpile step |
| Web App Manifest | W3C Manifest spec | Installability metadata | Required for "Add to Home Screen" + standalone display |
| Service Worker API | W3C SW spec | Offline cache | Required for offline PWA on HTTP(S); silent-failed on file:// |

### Storage

| Technology | Version | Purpose | Why |
|---|---|---|---|
| IndexedDB | living spec | Primary persistence (habits, logs, settings, history edits, score snapshots) | Gigabytes of quota, indexed queries, transactional. Matches the "years of daily logs" requirement. |
| `localStorage` | living spec | A tiny "ui preferences" slot only (e.g. last-viewed date, theme) | Synchronous, trivial; do NOT use for habit data |
| BroadcastChannel | living spec | Cross-tab invalidation so two open tabs don't desync | Native and tiny; no library |

### Browser APIs Used Directly

| API | Use in Nawyki | Notes |
|---|---|---|
| IndexedDB | Habit catalog, daily logs, edit history, settings, score snapshots | Wrap manually; see `db/idb.js` pattern below |
| Service Worker | Offline app shell | Same silent-`.catch()` pattern as `mindful-breathing/sw.js` |
| Web App Manifest | Install + standalone display | `manifest.json` with maskable SVG icon |
| BroadcastChannel | Cross-tab data sync after write | Single channel `'nawyki'` |
| Page Visibility (`visibilitychange`) | Flush pending writes when PWA is backgrounded | Reliable on mobile; `beforeunload` is NOT |
| File / Blob / URL | Export download (JSON + CSV) and import upload | Universal, file://-safe |
| `<input type="file">` | Import JSON | Native picker; no File System Access API required |
| Vibration API | Optional check-in tap feedback (mobile) | Same pattern as `mindful-breathing` |
| Wake Lock | NOT used (v1) | No long-running session in habit tracker |
| Notifications / Push | NOT used (v1) | Explicit constraint: no reminders in v1 |
| File System Access API | NOT used (v1) | Not available on file://; the Blob+anchor pattern works everywhere |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| (none) | — | — | Constraint: no npm, no CDN |

**This is load-bearing: there is no `node_modules`, no `package.json`, no CDN `<script src="https://…">`. Every line of JS in the project is hand-written and committed.**

---

## Recommended File / Directory Layout

A `mindful-breathing`-shaped layout, scaled up for multi-file:

```
habits/
├── index.html                  # Mobile-first daily check-in shell (Today view)
├── desktop.html                # Desktop-first analytics/planning shell
├── manifest.json               # Web App Manifest (one, shared)
├── sw.js                       # Service worker (one, shared)
├── icon.svg                    # Maskable SVG icon (one, shared)
│
├── css/
│   ├── main.css                # @layer reset, tokens, base, layout, components, utilities;
│   │                           # @import url("./tokens.css") layer(tokens); etc.
│   ├── tokens.css              # CSS custom properties (colors, spacing, type scale)
│   ├── reset.css               # Modern minimal reset
│   ├── base.css                # html/body/typography defaults
│   ├── components.css          # buttons, cards, chips, modal, list rows
│   ├── today.css               # Mobile check-in-specific (loaded only by index.html)
│   └── desktop.css             # Desktop analytics-specific (loaded only by desktop.html)
│
├── js/
│   ├── main.js                 # Entry for index.html — wires Today view
│   ├── desktop.js              # Entry for desktop.html — wires analytics
│   │
│   ├── db/
│   │   ├── idb.js              # Hand-written ~80-line promise wrapper around IndexedDB
│   │   ├── schema.js           # Schema version + onupgradeneeded migrations
│   │   └── repo.js             # Domain repository: habits, logs, settings, history, snapshots
│   │
│   ├── domain/                 # Pure logic, no DOM
│   │   ├── cadence.js          # Day-of-week / every-N-days resolution (also: is-this-habit-applicable-on-this-day → drives CSV "x" cells)
│   │   ├── stage.js            # Stage advancement rules
│   │   ├── threshold.js        # 90%/70-day rolling-window mastery check
│   │   ├── scoring.js          # Scoring model (v1 pick from research) — pure compute
│   │   └── wave.js             # Wave aggregates
│   │
│   ├── views/                  # DOM rendering, one module per view
│   │   ├── today.js
│   │   ├── history.js
│   │   ├── catalog.js
│   │   ├── analytics.js
│   │   └── wave.js
│   │
│   ├── io/
│   │   ├── export-json.js      # Build full-store JSON dump, trigger download
│   │   ├── export-csv.js       # Build habit×day matrix CSV (1 / 0 / x), trigger download
│   │   ├── import-json.js      # Read File, validate, merge-by-id into IDB
│   │   └── seed.js             # Load bundled hand-curated seed JSON
│   │
│   ├── platform/
│   │   ├── sync.js             # BroadcastChannel wrapper
│   │   ├── lifecycle.js        # visibilitychange flush hook
│   │   ├── sw-register.js      # Service-worker registration with silent .catch()
│   │   └── feature.js          # Tiny feature-detection helpers
│   │
│   └── util/
│       ├── date.js             # ISO-date utilities (local time, no tz drift)
│       └── id.js               # crypto.randomUUID() wrapper with file:// fallback
│
└── seed/
    └── nawyki-v1.seed.json     # Hand-curated bundled seed (read-only)
```

**Why this shape:**
- Mirrors `mindful-breathing` (`index.html`, `manifest.json`, `sw.js`, `icon.svg` at the root) — same hosting model.
- Splits the two layouts at the HTML level (`index.html` vs `desktop.html`), matching the locked constraint that mobile and desktop are *different* layouts, not one responsive sheet.
- Keeps domain logic free of DOM (`js/domain/`) so the same modules can be imported from both shells and unit-reasoned without a test runner.
- `cadence.js` is shared between Today (deciding which habits to show) and CSV export (deciding which cells are `x`) — a single source of truth.
- All directories are flat and only one level deep where possible — easy to grep, easy to read.

**Confidence: HIGH** (this is a direct extension of the proven `mindful-breathing` pattern; the only novelty is the directory split, which is mandated by file count, not by tooling.)

---

## IndexedDB Approach: Raw + Hand-Written ~80-Line Wrapper

### Decision

**Use raw `indexedDB` with a tiny hand-written promise helper. Do NOT inline `idb-keyval`, do NOT inline `idb`, do NOT use Dexie.**

### Rationale

1. **`idb-keyval` is the wrong shape.** It's optimized for `await set('foo', value)` / `await get('foo')` key-value access. Nawyki has *structured* data (object stores for `habits`, `logs`, `history`, `score_snapshots`, with indexes on `habitId`, `date`, `wave`). Forcing structured data into key-value flattens query power and defeats the reason for using IndexedDB instead of localStorage.
2. **`idb` (Jake Archibald's full wrapper) is too big to inline as "one hand-written file."** It's a 100+ KB source tree with TypeScript and multiple modules. Even if vendored as one minified file (~1–2 KB gzipped), inlining a minified third-party blob violates the spirit of "every line is hand-written and committed."
3. **The constraint says "no npm, no CDN."** Vendoring a dependency by copy-paste is still a dependency you must track, audit, and re-vendor on bug fixes. Hand-writing the ~80-line wrapper costs less than that.
4. **The schema is small and stable.** ~7 object stores, a handful of indexes, and migrations that happen at most once per release. The full power of `idb`'s ergonomics is unnecessary.

### The Hand-Written Wrapper (shape, not code)

`js/db/idb.js` should expose:

```
openDB(name, version, onUpgrade): Promise<IDBDatabase>
tx(db, storeNames, mode): IDBTransaction
promisify(request): Promise<T>           // wrap a single IDBRequest
done(transaction): Promise<void>         // wait for oncomplete
get(db, store, key): Promise<T>
getAll(db, store, query?, count?): Promise<T[]>
put(db, store, value): Promise<IDBValidKey>
del(db, store, key): Promise<void>
cursor(db, store, range, direction, onEach): Promise<void>
indexGetAll(db, store, indexName, query?): Promise<T[]>
```

That's it. ~80 lines including JSDoc. Sits in one file. No build step.

### Schema (illustrative, not exhaustive)

`js/db/schema.js` declares:

- `habits` — keyPath `id`, indexes on `wave`, `status` (active/mastered/archived)
- `logs` — keyPath `[habitId, date]`, indexes on `date` (for "show me everything on day X") and `habitId` (for "show me history of habit Y")
- `history_edits` — keyPath autoincrement, index on `at` (for undo/redo and audit)
- `settings` — keyPath `key` (singleton-ish; thresholds, etc.)
- `seed_meta` — keyPath `key` (records which seed version was loaded)
- **`score_snapshots`** — keyPath `[habitId, date]`, indexes on `date` (daily totals, wave aggregates) and `habitId` (rolling per-habit scores). **One row per (habit, day) carrying the precomputed score values that scoring.js produced.** See "Scoring Snapshots" section below.

### Migration Pattern

`onupgradeneeded` switches on `oldVersion`:

```
switch (event.oldVersion) {
  case 0: createV1Stores(db); // fallthrough — includes score_snapshots
  case 1: addV2Indexes(db);   // fallthrough
  // case 2: addV3FieldDefaults(tx); // future
}
```

Never tear down stores. Never re-key. Migrations only add. (See PITFALLS.md for the rewrite-history trap.)

**Confidence: HIGH** (raw IndexedDB is stable, well-documented on MDN, and a hand-written wrapper is a pattern documented by Jake Archibald himself as the source of `idb`.)

---

## Scoring Snapshots (Locked Decision)

### Decision

**Scoring outputs are persisted in IDB, not recomputed on every render. The `score_snapshots` store is a first-class table.**

### Why

1. **The xlsx-derived scoring model is non-trivial** (rolling 70-day windows, per-habit threshold overrides, wave aggregates). Recomputing the whole space on every Today render is wasteful, especially on mobile.
2. **Snapshots are observable.** They let analytics queries hit a precomputed table instead of re-running the scoring algorithm over years of logs.
3. **Snapshots are debuggable.** You can inspect the row for `(habitId, 2026-05-26)` in DevTools' IndexedDB panel and see exactly what `scoring.js` decided.
4. **Snapshots enable cheap "what changed?" diffs** when the scoring model itself is revised — re-run, write new snapshots, diff against old ones, ship.

### Write Path

Every write to `logs` (or `habits` definition change that affects scoring) triggers, in the same `readwrite` transaction:

1. Update or insert the `logs` row.
2. Recompute the affected `(habitId, date)` snapshot(s) — note: a single log change can affect a *window* of snapshots when the score depends on rolling N-day calculations.
3. Write the recomputed snapshots in the same transaction.
4. Commit. Then broadcast over `BroadcastChannel`.

**This means scoring.js is called from `repo.js` on writes, not from views on reads.** Views read snapshots; they never call `scoring.js`.

### Read Path

- **Today view** reads `score_snapshots` for `[*, today]` to render the mastery badges and per-habit scores.
- **Analytics view** reads `score_snapshots` by `date` range, aggregates in memory, and renders charts.
- **History view** reads snapshots for the selected day.

### Snapshot Schema

```
{
  habitId: string,         // FK to habits.id (also part of keyPath)
  date: 'YYYY-MM-DD',      // local date (also part of keyPath)
  applicable: boolean,     // was this habit "due" on this date per cadence?
  completed: 0 | 1 | number, // raw completion (1, 0, or count for multi-occurrence)
  windowPct: number,       // rolling-window completion % at this point in time
  windowDays: number,      // window size used (for audit)
  threshold: number,       // threshold used (for audit)
  mastered: boolean,       // was the habit mastered as of this date?
  scoreVersion: number,    // bump when scoring.js's algorithm changes — lets re-runs find stale rows
  computedAt: number       // Date.now() of when this row was written
}
```

The `scoreVersion` field is the migration story for scoring algorithm changes: bump it, walk the store, recompute any row with a lower version. No store-level schema migration required.

### Recomputation Triggers

A snapshot row is recomputed when:
- Its `logs` row changes.
- Any `logs` row within the rolling window (default 70 days back) changes.
- The habit's definition changes (threshold, window, cadence).
- The global settings (default threshold / window) change → bulk re-run, gated behind a confirmation.
- `scoreVersion` bumps → opportunistic re-run on next read, or batched "rebuild snapshots" admin action.

**Confidence: HIGH** (this is the standard "denormalized projection" pattern; no novel tech required).

---

## Service Worker Strategy

### Decision

**Cache-first for the entire app shell. Single versioned cache. Silent-fail registration so file:// still works. No special handling for exports because exports are generated client-side (no fetch).**

### Pattern

Copy the structure of `mindful-breathing/sw.js`, expanded for multiple files:

```js
const CACHE = 'nawyki-v1';
const ASSETS = [
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
  './css/desktop.css',
  './js/main.js',
  './js/desktop.js',
  // ... every module file
  './seed/nawyki-v1.seed.json',
];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
);

self.addEventListener('activate', e =>
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })())
);

self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
);
```

### Registration (silent-fail-safe)

In `js/platform/sw-register.js`:

```js
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* silent */ });
}
```

The `location.protocol` check is the explicit guard for file://; the `.catch()` is the silent fail-safe (matches `mindful-breathing`).

### Cache Versioning

Bump `CACHE` on every release. The `activate` handler deletes any cache that isn't the current version, so old assets never linger.

### What Is NOT Cached

- Nothing dynamic — there are no API calls.
- Exports are not network responses; they're client-side blobs and never hit the service worker.

**Confidence: HIGH** (this is exactly the MDN CycleTracker tutorial pattern, hardened with the proven `mindful-breathing` silent-fail trick.)

---

## CSS Architecture

### Decision

**Cascade Layers (`@layer`) + CSS Custom Properties + `@import url(...) layer(...)` to compose multi-file CSS into a single deterministic stylesheet, with no bundler.**

### Pattern

`css/main.css` declares layer order, then imports each file into its layer:

```css
@layer reset, tokens, base, layout, components, view, utilities;

@import url("./reset.css")      layer(reset);
@import url("./tokens.css")     layer(tokens);
@import url("./base.css")       layer(base);
@import url("./components.css") layer(components);
/* today.css or desktop.css linked separately per HTML shell */
```

Each HTML shell:

```html
<link rel="stylesheet" href="./css/main.css">
<link rel="stylesheet" href="./css/today.css"> <!-- or desktop.css -->
```

### Why Cascade Layers

- **Baseline Widely Available since March 2022** — supported in every browser the user runs in 2026.
- **Removes specificity wars** without a preprocessor.
- **No bundler required** — `@import` is the native composer and layers make order deterministic.
- **Multi-file friendly** — each layer is its own file; the order is declared once.

### Why Custom Properties

- Native theming primitive (`--color-fg`, `--space-3`, `--radius-card`).
- Reactive: change `--color-bg` on `:root.dark` and the whole UI flips.
- Visible in DevTools — no preprocessor obscurity.

### Mobile-vs-Desktop Layouts

**Two separate HTML shells.** Locked.
- `index.html` is the mobile check-in.
- `desktop.html` is the analytics view, linked from a "Open desktop view →" affordance on desktop browsers.
- Each shell links its own view-specific CSS and JS entry.
- Honors "truly different layouts" verbatim.

**Confidence: HIGH** (cascade layers are well-documented on MDN with Baseline status; separate HTML pages is the simplest possible "different layout" answer.)

---

## Export / Import (Locked Decisions)

### JSON Export — Full Backup

`js/io/export-json.js` builds a single object containing **every IDB store**:

```json
{
  "schemaVersion": 1,
  "scoreVersion": 1,
  "exportedAt": "2026-05-26T18:00:00.000Z",
  "appVersion": "nawyki-v1",
  "habits": [...],
  "logs": [...],
  "history_edits": [...],
  "settings": [...],
  "score_snapshots": [...],
  "seed_meta": [...]
}
```

Serialized with `JSON.stringify(obj, null, 2)`. Wrapped in `new Blob([...], { type: 'application/json' })`. Anchor with `download = 'nawyki-YYYY-MM-DD.json'`, clicked, URL revoked.

**Round-trippable: importing this JSON exactly reconstructs the state at export time, including snapshots.**

Works on file://. Works in every target browser.

### CSV Export — Wide Habit×Day Matrix (Locked)

**One CSV file, completion-only.** No separate habits-definitions CSV in v1.

Shape:

| habit_name           | wave    | 2025-12-29 | 2025-12-30 | 2025-12-31 | 2026-01-01 | … |
|----------------------|---------|------------|------------|------------|------------|---|
| Spacer rano          | Fala 1  | 1          | 0          | 1          | 1          | … |
| Trening siłowy (pn)  | Fala 3  | x          | 1          | x          | x          | … |
| Bez słodyczy         | Fala 6  | 1          | 1          | 0          | 1          | … |

**Cell semantics (locked):**
- `1` — habit was applicable on that day **and** completed.
- `0` — habit was applicable on that day **and** not completed.
- `x` — habit was **not applicable** on that day (cadence excluded it: e.g. a Monday-only habit on a Tuesday, an every-2-days habit on a non-slot day, a weekly habit that was completed on a different day of the same week).

The "applicable?" decision is computed by `js/domain/cadence.js` — the same module Today uses to decide which habits to render. Single source of truth.

**Special case: weekly habits completed on a different day of the same week.** Per the locked decision, the `x` cell semantics include "habit isn't connected with that day because … it's only for monday or weekly one and completed in different day etc." Implementation: for a weekly habit, mark its "scheduled" day as `1` if completed in that week (any day), `0` if not completed by week-end. All non-scheduled days in the week are `x`. `cadence.js` owns this rule.

**Multi-occurrence habits (numeric +1 or slot checklist):**
- For numeric habits, use the raw count as the cell value (e.g. `5`, `7`) on applicable days; `0` if zero; `x` if not applicable.
- For slot-checklist habits, use the count of filled slots (`3` of 7 means `3`).
- Cell type stays numeric or `x`. Excel reads it as numbers fine.

**Column ordering:**
- Columns are sorted chronologically ascending.
- Range defaults to the full span from earliest log to today, but should accept an optional date range (out of v1 scope — implement as a parameter for later).

**Row ordering:**
- Rows grouped by wave (Fala 0 → Fala 9), then by habit creation order within wave.
- This matches how the user already thinks about the data in the xlsx.

**Excel-pasteability rules (still apply):**
- Prepend UTF-8 BOM `﻿` so Polish characters render correctly on Windows Excel.
- Use CRLF (`\r\n`) row separators.
- Quote any field containing `,`, `"`, `\r`, `\n`, or leading/trailing whitespace; escape `"` as `""`.
- Comma as the field separator (locale-portable; Excel on Polish Windows handles UTF-8 BOM CSVs with comma separator correctly when opened via "Data → From Text/CSV", or via Paste Special).
- MIME `text/csv;charset=utf-8`.
- Filename: `nawyki-completion-YYYY-MM-DD.csv`.

**What CSV is NOT for:** import. CSV is read-only; round-tripping is JSON-only. This is explicit in PROJECT.md and reaffirmed here.

### JSON Import — Merge-by-ID (Locked)

**Merge semantics, not clear-and-replay.**

`js/io/import-json.js`:

1. `<input type="file" accept="application/json,.json">` → `file.text()` → `JSON.parse`.
2. Validate `schemaVersion` ≤ current schema version. Refuse imports from a *newer* schema (would risk silent data loss).
3. Open one `readwrite` transaction over all stores.
4. For each store, for each record in the imported array:
   - **Look up by primary key.**
   - If the record exists: **overwrite** the existing record with the imported one (last-writer-wins on the imported side, because the user explicitly chose to import this file).
   - If the record does not exist: **insert** it.
   - **Never delete** records that exist locally but not in the imported file.
5. After import, **rebuild `score_snapshots`** for all (habitId, date) pairs touched by the merge — but only if `scoreVersion` differs or snapshots weren't included in the import.
6. Commit. Broadcast `{ type: 'import:done' }` on BroadcastChannel so every open tab reloads its in-memory state.

**Key consequences of merge-by-id:**
- The user can export from one device, hand-edit a habit on another, then import the older file — and **the local-only edit survives**.
- A backup file is purely additive in the absence of conflicts; the user can import it confidently after an experimental session without losing the experimental data (though it *will* be overwritten where keys collide — that's the locked tradeoff).
- Habit identity is preserved by `id` (which is a UUID, never derived from the habit name). Renaming a habit on device A and importing a backup that still has the old name **will overwrite the new name** if the `id` matches. This is documented behavior, not a bug — and is why the export filename includes the date.

**Out of scope for v1:** three-way merge, "newer-timestamp-wins" conflict resolution, partial-store import. All can be revisited post-v1 if cloud sync becomes a thing.

### Why NOT File System Access API

- Not available on file://.
- Not supported in Safari (still, as of 2026).
- The Blob+anchor pattern works everywhere and is one fewer code path.

**Confidence: HIGH** (locked decisions encoded; mechanics are universal browser primitives).

---

## Cross-Tab Sync

`js/platform/sync.js` wraps a single `BroadcastChannel('nawyki')`. Every write in `repo.js` posts a small message:

- `{ type: 'log:put', habitId, date }` — log changed; affected snapshots already rewritten.
- `{ type: 'habit:put', habitId }` — habit definition changed.
- `{ type: 'snapshot:rebuild', range }` — bulk snapshot recompute happened.
- `{ type: 'import:done' }` — full reload signal.

Other tabs listen, invalidate the in-memory cache for the affected slice, and re-render.

**Why not `storage` events:** `storage` only fires for `localStorage` (which we are deliberately not using for data). Adding it just for the event would couple cross-tab notification to a storage mechanism we rejected.

**Confidence: HIGH** (BroadcastChannel is Baseline Widely Available).

---

## Lifecycle Hook

`js/platform/lifecycle.js` registers:

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPending();
});
window.addEventListener('pagehide', flushPending);
```

That's the entire flush story. **Do NOT** use `beforeunload` — MDN documents it as unreliable, especially when the PWA is backgrounded on Android.

`flushPending` is idempotent and debounced; calling it twice is safe.

**Confidence: HIGH** (MDN explicitly recommends `visibilitychange` → hidden for state-persistence flushes).

---

## Web App Manifest

Extend the `mindful-breathing` template:

```json
{
  "name": "Nawyki",
  "short_name": "Nawyki",
  "description": "Personal habit tracker — multi-year wave plan.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#111111",
  "theme_color": "#34d399",
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

Notable additions vs the reference:
- `scope` — explicit (defends against accidental navigation outside the app).
- `lang: "en"` — UI is English even though habit data is Polish.
- `description` — populated for the Chrome install dialog.

**Confidence: HIGH** (matches MDN's current minimum-installable recipe).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Storage | Raw IndexedDB + hand-written wrapper | `idb-keyval` (inlined) | Key-value shape is wrong for structured habit/log data with indexes |
| Storage | Raw IndexedDB + hand-written wrapper | `idb` (inlined) | Too large to honestly "inline as one file"; carries TypeScript build artifacts |
| Storage | Raw IndexedDB + hand-written wrapper | Dexie.js | npm/CDN dependency; explicitly forbidden by constraints |
| Storage | Raw IndexedDB + hand-written wrapper | `localStorage` only | Quota and sync-blocking; insufficient for years of daily logs |
| Storage | Raw IndexedDB + hand-written wrapper | OPFS (Origin Private File System) | Not available on file://; overkill; less queryable |
| Scoring | Persisted snapshots in `score_snapshots` | Recompute on every render | Wasteful on mobile; not debuggable in DevTools; no audit trail |
| Scoring | Persisted snapshots in `score_snapshots` | Materialized view via SQL | No SQL in browsers; Web SQL is deprecated |
| CSV export | Single wide habit×day matrix with `1` / `0` / `x` | Two CSVs (habits + logs) | Locked: completion-only matrix is what the user wants in Excel |
| CSV export | Single wide matrix | Long-format CSV (one row per habit×day) | Long-format is harder to scan in Excel; rejected per user preference |
| Import | Merge-by-id | Clear-and-replay (wipe + reload) | Loses local-only edits since last export; rejected per user preference |
| Import | Merge-by-id | Three-way merge with conflict resolution | Out of v1 scope; revisit if cloud sync added |
| Module system | Native ES modules | Bundler (esbuild/Vite) | Forbidden; also unnecessary at this scale |
| Module system | Native ES modules | Import maps | Useful when remapping bare specifiers; we use only `./` relative paths so unneeded |
| CSS | Cascade Layers + `@import` | Sass/PostCSS | Forbidden (build step); cascade layers cover the use case natively |
| CSS | Cascade Layers + `@import` | One giant `style.css` | Hard to maintain at the file count Nawyki will have |
| CSS | Cascade Layers + `@import` | CSS Modules / Shadow DOM scoping | Unneeded; cascade layers + BEM-ish naming is sufficient |
| Cross-tab sync | BroadcastChannel | `storage` event | Requires localStorage writes we don't want |
| Cross-tab sync | BroadcastChannel | Service Worker `postMessage` | More plumbing; BC is one line |
| Export download | Blob + anchor `download` | File System Access API | Not available on file://; Safari support gaps |
| Lifecycle flush | `visibilitychange` → hidden | `beforeunload` | Unreliable on mobile; MDN explicitly advises against |
| Layout split | Two HTML shells | Single responsive layout | Constraint says they are different layouts, not different breakpoints |
| Layout split | Two HTML shells | Client-side router (hash/history) | Adds complexity; two static files is simpler and GitHub-Pages-friendlier |

---

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

---

## Installation

**There is no installation step.** Clone the repo, open `index.html` in a browser, or push to GitHub Pages.

```bash
git clone <repo>
cd habits
# Option A: open directly
start index.html         # Windows
# Option B: serve locally if you want to test the service worker
python -m http.server 8000
# Option C: ship to GitHub Pages — push to main, enable Pages
```

That's it. No `npm install`. No build. No transpile. No watch process.

---

## Confidence Summary

| Decision | Confidence | Source |
|---|---|---|
| Native ES modules with `./` relative imports | HIGH | MDN ES modules; reference project pattern |
| Raw IndexedDB + hand-written wrapper | HIGH | MDN IndexedDB; principle of least dependency |
| `score_snapshots` store + write-time recompute | HIGH | Standard denormalized-projection pattern; locked by user |
| Cache-first SW with silent `.catch()` | HIGH | MDN CycleTracker tutorial + `mindful-breathing/sw.js` directly inspected |
| Cascade Layers + `@import` for CSS | HIGH | MDN `@layer` Baseline status |
| `visibilitychange` → hidden for flushes | HIGH | MDN explicitly recommends over `beforeunload` |
| BroadcastChannel for cross-tab sync | HIGH | MDN; Baseline Widely Available |
| Blob+anchor download for exports | HIGH | Universal pattern; no API gates; works on file:// |
| Two-HTML-shell layout split | HIGH | Constraint-driven, simplest faithful reading; reinforced by locked decision |
| Single wide habit×day CSV with `1`/`0`/`x` | HIGH | Locked by user; mechanics are pure string-building |
| Merge-by-id JSON import | HIGH | Locked by user; pure IDB transactional logic |
| Excel BOM-prefixed CSV | HIGH | Well-known Windows-Excel UTF-8 quirk |
| Web App Manifest minimum | HIGH | MDN current installability checklist |

---

## Sources

- MDN — Using IndexedDB (best practices, version handling, transactions): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- MDN — Service Workers in CycleTracker PWA tutorial (install / activate / fetch cache-first): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/CycleTracker/Service_workers
- MDN — Web App Manifest (minimum installable, icons, display modes): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/CycleTracker/Manifest_file
- MDN — `@layer` (CSS Cascade Layers, Baseline status, `@import` with `layer()`): https://developer.mozilla.org/en-US/docs/Web/CSS/@layer
- MDN — BroadcastChannel (cross-tab messaging, Baseline status): https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN — `visibilitychange` event (recommended over beforeunload for state persistence): https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- MDN — File System Access API (browser support, secure-context-only, file:// restriction): https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- Reference project `mindful-breathing` — `sw.js`, `manifest.json`, README "Design Decisions" section (directly inspected in `../mindful-breathing/`)
- Project context — `.planning/PROJECT.md` (constraints and feature surface)
- User-locked decisions (2026-05-26): single CSV (wide habit×day matrix with `1`/`0`/`x`), JSON import = merge-by-id, scoring snapshots persisted in IDB
