# Architecture Research

**Domain:** Personal multi-year habit tracker — vanilla static PWA, IndexedDB-backed, mobile + desktop layouts
**Researched:** 2026-05-26
**Confidence:** HIGH (extends locked STACK.md decisions; only novelty is the state-management pattern and view routing)

> This document answers seven specific architecture questions. It assumes STACK.md (the file/CSS/IDB/SW choices) is already locked. Where STACK.md and this file disagree, this file refines — it never reopens settled choices.

---

## TL;DR — Seven Answers in One Page

| # | Question | Answer |
|---|---|---|
| 1 | Module layout | Extend STACK.md tree with `js/state/` (store + selectors + undo) and `js/router/` (one file). |
| 2 | State pattern | **Snapshot-of-definitions + append-only log of events** ("event log + materialized views"). Definitions are versioned by `effectiveFrom`; logs reference `habitId + definitionVersion`. |
| 3 | IDB schema | 6 stores: `habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`. Logs keyed `[habitId, date]`; events keyed by autoincrement with index on `at`. |
| 4 | Routing | **Hash router** (`#today`, `#history/2026-05-26`, `#habit/<id>`, etc.) in `js/router/router.js`. ~7 views total across both shells. |
| 5 | Mobile vs desktop split | **Confirmed: two HTML shells** (`index.html` / `desktop.html`). Shared modules live under `js/{db,domain,state,io,platform,util}/`; only `js/views/` and `js/{main,desktop}.js` differ. |
| 6 | Cross-tab + undo | BroadcastChannel `'nawyki'` in `js/platform/sync.js`; undo lives in `js/state/undo.js` as an in-memory stack of inverse-event functions, persisted across reload via a single-slot `undo_token` in `meta`. |
| 7 | Build order | Phase 1 = "**the spine**": IDB wrapper → schema/migrations → state store → router → minimal Today view reading from seed. Everything else is feature work on this spine. |

---

## 1. Module / Folder Layout

Extends STACK.md by adding **`js/state/`** (the snapshot+event store and undo) and **`js/router/`** (the hash router). Everything else inherits from STACK.md verbatim.

```
habits/
├── index.html                  # Mobile shell (Today, History, Habit-detail compact)
├── desktop.html                # Desktop shell (Analytics, Wave board, Catalog, History wide)
├── manifest.json
├── sw.js
├── icon.svg
│
├── css/                        # As in STACK.md
│   ├── main.css                # @layer composer
│   ├── tokens.css
│   ├── reset.css
│   ├── base.css
│   ├── components.css
│   ├── today.css               # Mobile-only (linked from index.html)
│   └── desktop.css             # Desktop-only (linked from desktop.html)
│
├── js/
│   ├── main.js                 # Mobile shell entry: boot → router → today view
│   ├── desktop.js              # Desktop shell entry: boot → router → analytics view
│   │
│   ├── db/                     # IDB plumbing
│   │   ├── idb.js              # ~80-line promise wrapper (STACK.md)
│   │   ├── schema.js           # Stores, indexes, onupgradeneeded
│   │   └── repo.js             # Domain-shaped read/write helpers
│   │
│   ├── state/                  # NEW vs STACK.md — application state lives here
│   │   ├── store.js            # In-memory cache + subscribe(); reads via repo, writes via apply()
│   │   ├── apply.js            # The ONLY mutator. Takes an event, persists it, updates cache, broadcasts.
│   │   ├── selectors.js        # Pure derivations: today's habits, wave aggregates, mastery state
│   │   └── undo.js             # Last-action inverse-event stack + persistence slot
│   │
│   ├── domain/                 # Pure logic, no DOM, no IDB
│   │   ├── cadence.js          # daily / weekly / every-N-days / day-of-week / monthly
│   │   ├── stage.js            # advancement triggers (manual | scheduled | after-N-days, composable)
│   │   ├── threshold.js        # rolling-window mastery check (90% / 70 days, overridable)
│   │   ├── scoring.js          # v1 scoring model (research output)
│   │   ├── wave.js             # wave aggregates (completion %, status counts, longest streak, at-risk)
│   │   └── version.js          # habit-definition versioning helpers (effectiveFrom resolution)
│   │
│   ├── router/                 # NEW vs STACK.md — tiny hash router
│   │   └── router.js           # hashchange → match route → mount view → unmount previous
│   │
│   ├── views/                  # DOM rendering. One module per view; pure render(state)→DOM.
│   │   ├── today.js            # mobile primary
│   │   ├── history.js          # mobile + desktop variants share most logic
│   │   ├── habit-detail.js     # per-habit edit history + edit form
│   │   ├── catalog.js          # CRUD list (desktop-primary, mobile read-only)
│   │   ├── analytics.js        # desktop-only: charts/tables
│   │   ├── wave-board.js       # desktop-only: wave aggregates
│   │   └── settings.js         # both shells: thresholds, export/import
│   │
│   ├── io/                     # As in STACK.md
│   │   ├── export-json.js
│   │   ├── export-csv.js
│   │   ├── import-json.js
│   │   └── seed.js
│   │
│   ├── platform/               # As in STACK.md
│   │   ├── sync.js             # BroadcastChannel('nawyki')
│   │   ├── lifecycle.js        # visibilitychange flush
│   │   ├── sw-register.js
│   │   └── feature.js
│   │
│   └── util/
│       ├── date.js             # ISO local-date utilities (NO timezone drift)
│       ├── id.js               # crypto.randomUUID() with file:// fallback
│       └── csv.js              # CSV row formatter (BOM, CRLF, escaping)
│
└── seed/
    └── nawyki-1.0.0.seed.json
```

### Structure Rationale

- **`js/state/` is the seam between IDB and views.** Views never touch `db/repo.js` directly; they read from `state/store.js` and dispatch to `state/apply.js`. This is the single chokepoint that gives us cross-tab sync, undo, and broadcast-on-write for free.
- **`js/router/` is one file.** Hash routing in vanilla JS is ~60 lines. Splitting it further would be overkill.
- **`js/domain/` stays pure.** Nothing in there imports from `db/`, `views/`, `state/`, or `platform/`. This is the seam that lets cadence, threshold, stage logic be reasoned about in isolation (and trivially "tested" by importing into a scratch HTML page).
- **`js/views/` is shared between shells.** Both `main.js` and `desktop.js` import from `js/views/`. The shell decides which views to register with the router; the view modules don't know which shell mounted them.

---

## 2. State Management Pattern

### The Decision

**Snapshot-of-definitions + append-only event log + materialized in-memory cache.** Not pure event sourcing, not snapshot+diff — a deliberate hybrid that honors the locked constraint "habit-definition edits never rewrite historical logs."

### How It Works

Three persisted shapes:

1. **`habits` store** — current definition of each habit, keyed by stable `id` (UUID). The definition includes: name, wave, cadence rule, stage rules, threshold overrides, occurrence style (binary | numeric | slot-checklist), current stage pointer.
2. **`habit_versions` store** — every prior definition snapshot keyed by `[habitId, effectiveFrom]`. When you edit a habit, the OLD definition is copied here with `effectiveFrom` set to the time of the edit. The current definition in `habits` always reflects "today onward."
3. **`logs` store** — daily completion ledger. Each row is `{habitId, date, state, occurrences?, stageAtTime, thresholdAtTime, definitionVersion}`. The crucial bit: each log row carries the **`definitionVersion`** (an ISO timestamp matching a `habit_versions.effectiveFrom`, or `null` for "current"). This is how history stays intact when definitions change.

Plus the **event log**:

4. **`events` store** — append-only journal of every mutation: `markCompleted`, `markUncompleted`, `incrementCount`, `editHabit`, `advanceStage`, `archiveHabit`, etc. Each event carries `{id, at, type, payload, inverse}`. The `inverse` is a small object describing how to undo this event (e.g. `markCompleted` → `{type: 'restoreLogState', habitId, date, previous: <prior log row or null>}`).

### Read Path

`state/store.js` keeps an **in-memory cache** (Map by id for habits, Map by `[habitId,date]` for logs in the currently visible window). On boot, the cache is hydrated from IDB. Views subscribe; selectors in `state/selectors.js` derive what they need (today's list, wave aggregates, mastery state) from the cache + domain modules.

### Write Path

Every mutation goes through `state/apply.js`:

```
apply(event):
  1. Compute the new IDB state (which stores, which keys, which inverse-event)
  2. Open a single transaction across all affected stores + events store
  3. Write the data row(s) AND the event row in the same tx (atomic)
  4. Update in-memory cache
  5. Push event onto undo stack
  6. Broadcast {type, keys} on the BroadcastChannel
  7. Notify subscribers
```

If the tx fails, nothing was applied — the cache is not mutated, the event is not enqueued, no broadcast fires. This is the only place that mutates state.

### Why This Pattern (and not pure event sourcing)

- **Pure event sourcing** would force "fold all events from time zero to derive current state on every boot." That's slow with multi-year data and makes selectors complicated.
- **Pure snapshot+overwrite** would lose the "history of edits" requirement (per-habit edit history is a stated feature).
- **Snapshot + event log** gives both: the snapshot answers "what is the state right now" in O(1) IDB reads; the event log answers "how did we get here," powers undo, and feeds the per-habit edit history view.

### Why Logs Reference `definitionVersion`

The locked constraint says: **definition edits don't rewrite logs.** When a log row says "you did 3 of 5 meatless meals on 2026-04-12 at stage 2 with threshold 90% over 70 days," that interpretation must stay stable even if you later edit the habit to "5 of 7 meals at stage 3 with threshold 80%." Embedding the `definitionVersion` pointer in each log row means: rendering history navigates to `habit_versions[habitId, definitionVersion]` to interpret the row in its original frame. The current `habits` definition is only used for "today" and "future."

### Implementation Implication

`state/apply.js` for `editHabit`:
1. Copy current `habits[id]` row into `habit_versions` with `effectiveFrom = now`.
2. Write the new definition into `habits[id]`.
3. Append `editHabit` event with inverse pointing to the just-archived version.
4. **Crucially: do NOT touch any rows in `logs`.** Old logs continue to reference the older `definitionVersion`.

**Confidence: HIGH.** This is the standard CQRS-lite pattern for personal apps with audit requirements. The novelty here is making `definitionVersion` a first-class field on log rows — but it's the only honest way to honor the constraint.

---

## 3. IndexedDB Schema (sketch)

Six object stores. Names, key paths, and indexes:

| Store | Key Path | Indexes | Purpose |
|---|---|---|---|
| `habits` | `id` (UUID) | `wave`, `status` (active/mastered/archived) | Current definition per habit |
| `habit_versions` | `[habitId, effectiveFrom]` (effectiveFrom = ISO ts) | `habitId` | Snapshot history of definitions; never deleted |
| `logs` | `[habitId, date]` (date = `YYYY-MM-DD`) | `date` (for "everything on day X"), `habitId` (for "history of habit Y") | Daily completion ledger |
| `events` | autoincrement `id` | `at` (ISO ts), `type`, `habitId` (when applicable) | Append-only mutation log; powers undo + per-habit edit history |
| `settings` | `key` (string) | — | Singleton-style: `defaultThreshold`, `defaultWindowDays`, theme, last viewed date, seed version, schema version |
| `meta` | `key` (string) | — | `undoToken` (last-undoable event id), `seedLoadedAt`, anything else housekeeping |

**Notes on key choices:**

- `logs` uses a **compound key `[habitId, date]`** so writes are idempotent (re-marking today's habit overwrites the same row; no duplicates). Compound key + `date` index gives us both "habit's history" and "everything done on day X" in one store.
- `events` autoincrements because event order matters and we never delete. Index on `at` is for chronological scans (undo and per-habit history).
- `habit_versions` uses `[habitId, effectiveFrom]` so the natural query "give me the definition of habit X that was in effect on date D" is a bound cursor scan.
- `settings` and `meta` are separated because `settings` is user-facing config (export/import should round-trip it) and `meta` is housekeeping (export should NOT include it).

**Schema migrations:** `onupgradeneeded` switches on `oldVersion`, additive only. Never tear down a store, never rekey. See STACK.md "Migration Pattern" for the switch-fallthrough template.

**Confidence: HIGH.** The compound-key pattern for `logs` is standard for time-series-per-entity workloads in IDB.

---

## 4. View Routing

### Decision

**Hash router** (`#today`, `#history/2026-05-26`, `#habit/<id>`, `#catalog`, `#analytics`, `#wave/<n>`, `#settings`).

### Why Hash (not History API)

- **GitHub Pages compatibility** — the History API requires server-side rewrite rules so deep links resolve to `index.html`. GitHub Pages doesn't offer that without a hack (404-rewrite). Hash routing needs zero server cooperation.
- **`file://` compatibility** — opening `index.html#today` from disk works; pushState on `file://` is broken in some browsers.
- **Simplicity** — `window.addEventListener('hashchange', ...)` plus a string match is ~60 lines total. The History API requires `popstate` + `pushState` + intercepted clicks + base-path handling.

### Implementation

`js/router/router.js`:

```
register(pattern, mountFn, unmountFn)
navigate(hash)               // sets location.hash, fires hashchange
init()                       // wires hashchange + initial route
```

Each shell registers ONLY the routes it serves:

- **`main.js` (mobile shell)** registers: `#today` (default), `#history/:date`, `#habit/:id`, `#catalog` (read-only on mobile), `#settings`.
- **`desktop.js` (desktop shell)** registers: `#analytics` (default), `#wave-board`, `#wave/:n`, `#catalog` (full CRUD), `#history/:date`, `#habit/:id`, `#settings`.

If a user lands on a route the shell doesn't know (e.g. `desktop.html#today`), the router redirects to the shell's default route.

### View Count

**7 distinct views total**, some appearing in both shells:

| View | Mobile | Desktop | Notes |
|---|:---:|:---:|---|
| Today | primary | — | mobile-only; daily check-in |
| History (day) | yes | yes | mobile = single-column day; desktop = matrix view of N days |
| Habit detail / edit history | yes | yes | per-habit timeline + edit form |
| Catalog | read-only | full CRUD | CRUD ergonomics need real estate |
| Analytics | — | primary | desktop-only; charts/tables |
| Wave board | — | yes | desktop-only; wave aggregates grid |
| Settings | yes | yes | thresholds, export/import |

**Confidence: HIGH.** Hash routing on GitHub Pages is the standard pattern for static SPAs.

---

## 5. Mobile-vs-Desktop Split Mechanic

### Confirmed: Two HTML Shells (STACK.md Strategy A)

The two-shell approach from STACK.md is the right call. Both shells share virtually all JavaScript (everything under `js/db/`, `js/state/`, `js/domain/`, `js/router/`, `js/views/`, `js/io/`, `js/platform/`, `js/util/`). They differ only in:

1. **HTML markup** — different top-level structure (mobile has a sticky bottom action bar; desktop has a left nav rail and multi-pane grid).
2. **Entry module** — `main.js` vs `desktop.js`. Each:
   - Boots the same `state/store.js`, `platform/sync.js`, `platform/lifecycle.js`, `platform/sw-register.js`.
   - Registers a DIFFERENT subset of routes with the router.
   - Mounts a different default view.
3. **Linked CSS** — `today.css` (mobile) vs `desktop.css` (desktop), in addition to the shared `main.css` import chain.

### Cross-Shell Navigation

A small affordance: on the mobile shell, a "Desktop view" link in Settings points to `desktop.html`. On the desktop shell, a "Mobile view" link points to `index.html`. The user picks; there's no auto-redirect based on viewport (auto-redirect causes lock-out scenarios on tablets and is a known foot-gun).

### Why Not One Shell with Responsive Layouts

The PROJECT.md constraint says "mobile and desktop are truly different layouts (not one responsive layout), because they serve different jobs." A single responsive layout would force every view to be a single DOM that works at both sizes — which is exactly what we are choosing not to do. The two-shell approach lets the desktop Today-equivalent be a completely different view (in fact, desktop doesn't have a Today view at all; it has Analytics).

### Shared Module Organization (Recap)

```
js/main.js  ──┐
              ├──> imports: db/, state/, domain/, router/, views/, io/, platform/, util/
js/desktop.js ┘
```

There are **no shell-specific modules outside the entry files and the views actually used.** Every other module is shell-agnostic. A view module like `js/views/today.js` is imported by `main.js` only; `js/views/analytics.js` is imported by `desktop.js` only; shared views (history, habit-detail, settings, catalog) are imported by both.

**Confidence: HIGH** for the two-shell decision (constraint-driven). **MEDIUM** for the exact route-per-shell split — this is a v1 best guess that may shift as views are built.

---

## 6. Cross-Tab Sync + Undo

### Cross-Tab Sync

**Mechanism:** `BroadcastChannel('nawyki')`. **Module:** `js/platform/sync.js`.

**Protocol:** Every successful `state/apply.js` write broadcasts a small message:

```
{ type: 'mutation',
  event: 'markCompleted' | 'editHabit' | ... ,
  keys: { habitId?, date?, ... },
  at: <ISO ts>,
  origin: <this tab's session id> }
```

Other tabs listen in `js/platform/sync.js`. On message:
1. Skip if `origin` is this tab's own session id (the writer already updated locally).
2. Invalidate the relevant slice of the in-memory cache in `state/store.js` (re-read from IDB).
3. Notify subscribers so views re-render.

**Why not full state in the message:** The receiving tab might not have the same window of `logs` cached. Sending only "what changed by key" forces a fresh IDB read on the receiver, which is the source of truth.

**Why BroadcastChannel (not `storage` event):** STACK.md already settled this: we deliberately don't write habit data to `localStorage`, and BroadcastChannel is the native primitive for what we actually need.

### Undo (Single-Step Global)

**Module:** `js/state/undo.js`.

**Mechanism:** A bounded stack (size 1 for v1; size N is a trivial future enhancement) of **inverse events**. When `state/apply.js` writes an event, it includes an `inverse` payload describing how to undo it:

| Event | Inverse |
|---|---|
| `markCompleted(habitId, date)` | `restoreLogRow(habitId, date, prior)` where prior is the log row (or null) at the moment of the write |
| `incrementCount(habitId, date, +1)` | `incrementCount(habitId, date, -1)` (or `restoreLogRow` if going from 1→0) |
| `editHabit(habitId, newDef)` | `restoreHabitDef(habitId, oldDef, removeVersion: <effectiveFrom>)` — restores the prior definition AND deletes the version snapshot just appended |
| `advanceStage(habitId, newStage)` | `restoreStage(habitId, oldStage)` |
| `archiveHabit(habitId)` | `unarchiveHabit(habitId)` |

The undo stack is **in-memory** for live operation, but the **most recent undoable event's id** is persisted in `meta.undoToken` (single slot) so undo survives reload. On boot, if `meta.undoToken` exists, `state/undo.js` rehydrates the inverse by reading the event row from the `events` store (which contains the inverse payload).

**Why undo lives in `state/`, not `views/`:** Undo is a state-level concern (it touches multiple stores in a single tx and re-broadcasts the inverse mutation). A UI button just calls `state/undo.undo()`.

**Cross-tab undo:** Undo itself broadcasts a `mutation` message like any other write, so two open tabs stay in sync. We do NOT try to share the undo stack across tabs — only the most recent undoable action (read from `meta.undoToken` on demand) is shared.

**Confidence: HIGH** for the BroadcastChannel mechanism (Baseline). **MEDIUM** for the persistence-across-reload undo — it's a small extra pattern; verify with the user that "undo last action survives a refresh" is actually desired (otherwise, simplify by making undo memory-only).

---

## 7. Build Order: What Phase 1 Must Deliver

### Phase 1 = "The Spine"

Phase 1 ships **infrastructure with the thinnest possible feature on top** to prove the spine works. No habit features beyond "mark/unmark today" against seed data.

**Deliverable chain (each step unlocks the next):**

1. **`js/util/date.js`** — ISO local-date helpers. Unlocks: everything else (every store key uses local dates).
2. **`js/db/idb.js`** — promise wrapper. Unlocks: schema, repo.
3. **`js/db/schema.js`** — declare 6 stores + indexes + initial migration. Unlocks: any IDB read/write.
4. **`js/db/repo.js`** — typed get/put per store. Unlocks: state store.
5. **`js/io/seed.js`** — load `seed/nawyki-1.0.0.seed.json` into `habits` on first boot (idempotent via `meta.seedLoadedAt`). Unlocks: anything to render.
6. **`js/state/store.js` + `state/apply.js`** — in-memory cache hydrated from IDB; `apply()` is the only mutator. Unlocks: views, undo, broadcast.
7. **`js/platform/sync.js`** — BroadcastChannel wrapper, wired into `apply.js`. Unlocks: multi-tab safety from day one (don't bolt this on later).
8. **`js/platform/lifecycle.js`** — `visibilitychange` flush hook. Unlocks: durability on mobile.
9. **`js/platform/sw-register.js` + `sw.js` + `manifest.json` + `icon.svg`** — PWA shell. Unlocks: offline + installability.
10. **`js/router/router.js`** — hash router. Unlocks: navigable views.
11. **`js/views/today.js` (minimal)** — render seed habits for today, mark/unmark, undo. Unlocks: visible proof the spine works.
12. **`index.html` shell** + `css/main.css` + linked layers — ties it all together.

**What is NOT in Phase 1:** cadence engine, stage progression, threshold/mastery, wave aggregates, history navigation, edit history, exports, desktop shell, analytics. Those are Phase 2+.

### Why This Order

- **Date utilities first** because every key path uses `YYYY-MM-DD` strings, and getting timezone-correct local dates wrong is the #1 way to corrupt a habit tracker silently.
- **IDB layer before state layer** so the state store has somewhere to hydrate from.
- **Seed loader before any view** so the very first render has real data to draw, not a empty-state shrug that requires CRUD plumbing to populate.
- **Apply() before any view writes anything** so we never end up with a view module that talks directly to repo.js and bypasses the broadcast/undo seams.
- **BroadcastChannel and `visibilitychange` in Phase 1, not "later"** because retrofitting them after multiple views are calling repo.js directly is painful. Establish the chokepoint early.
- **Service worker before any feature ships** so caching strategy is correct from the first deploy (a wrong cache-versioning approach is annoying to recover from once users have stale SWs installed).
- **Router before the second view** so adding views (Phase 2) is "register a route + mount fn," not "rip out a hardcoded `view.innerHTML = ...` switch."
- **Today view as the proof-of-life** because it's the highest-value view and the spine has to support it to be worth anything.

### Unlocks Chain (one-liner)

`date → idb → schema → repo → seed → store/apply → sync → lifecycle → SW → router → today view → ship`

Each arrow is a hard dependency. None of those steps can be skipped without leaving a hole the next step would re-open.

### Phase 2+ Preview (not part of this question, just to frame Phase 1)

- Phase 2: cadence engine + history view + per-habit detail (read-only edit history).
- Phase 3: threshold/mastery + stage progression + habit catalog CRUD.
- Phase 4: desktop shell + analytics + wave board.
- Phase 5: exports (JSON + CSV) + import.
- Phase 6: scoring model + polish.

**Confidence: HIGH** for the spine ordering. The "what unlocks what" chain is hard-dependency-driven, not preference-driven.

---

## Anti-Patterns Specific to This Project

### Anti-Pattern 1: Views Calling `repo.js` Directly

**What people do:** A view module imports `db/repo.js` and writes a log row, bypassing `state/apply.js`.
**Why it's wrong:** No broadcast (other tabs desync). No undo (stack is wrong). No cache invalidation (the same tab desyncs from itself).
**Do this instead:** All writes go through `state/apply.js`. Views only read from `state/store.js` and dispatch by calling `apply(event)`.

### Anti-Pattern 2: Mutating Habit Definitions In-Place

**What people do:** `habits[id].threshold = 0.85` then `repo.put('habits', habits[id])`.
**Why it's wrong:** No version snapshot, no event row, no inverse for undo, history rendering breaks because old logs reference the now-changed definition.
**Do this instead:** Dispatch `editHabit(id, newDef)`; `apply.js` snapshots the old def into `habit_versions` first.

### Anti-Pattern 3: Storing Dates as `Date` Objects or UTC ISO Strings

**What people do:** `new Date().toISOString()` in a log row.
**Why it's wrong:** ISO timestamps include time + UTC offset. Two writes 30 minutes apart on either side of midnight UTC end up on the "wrong" day for the user. Multi-year habit tracking is critically sensitive to this.
**Do this instead:** `YYYY-MM-DD` strings derived from `js/util/date.js` using the user's **local** calendar date. Never store `Date` instances in IDB; never use `toISOString()` for date keys.

### Anti-Pattern 4: Single Giant `apply()` Switch

**What people do:** One mega-function in `apply.js` with 20 case branches.
**Why it's wrong:** Becomes a god module; testing individual events is impossible without spinning up the whole store.
**Do this instead:** `apply.js` dispatches to per-event handler modules (`apply/markCompleted.js`, `apply/editHabit.js`, etc.) that each return `{ writes, inverse }`. The core of `apply.js` just opens the tx and runs whatever the handler returned.

### Anti-Pattern 5: Letting the Router Render

**What people do:** Router does `viewEl.innerHTML = '<div>Today</div>'` directly on route change.
**Why it's wrong:** Couples routing to rendering. View modules can't be tested or reused. Cleanup (event listeners, subscriptions) gets dropped on the floor.
**Do this instead:** Router calls `view.mount(rootEl, params)` and `view.unmount()`. View modules own their DOM lifecycle, including unsubscribing from `state/store.js` on unmount.

---

## Data Flow

### Read Flow (rendering Today)

```
User loads index.html
    ↓
main.js boots → state/store.js.hydrate() → reads from db/repo.js
    ↓
router.init() → matches '#today' → mounts views/today.js
    ↓
today.js subscribes to store → calls selectors.todayList(state)
    ↓
selectors.todayList uses domain/cadence.js + domain/threshold.js to filter
    ↓
today.js renders DOM
```

### Write Flow (marking a habit complete)

```
User taps habit row
    ↓
views/today.js calls state/apply.js with { type: 'markCompleted', habitId, date }
    ↓
apply.js: open tx on [logs, events, meta]
         → write log row { habitId, date, state: 'done', definitionVersion: null, ... }
         → append event row with inverse = { type: 'restoreLogRow', prior: <prior log or null> }
         → update meta.undoToken = <new event id>
    ↓
apply.js: update in-memory cache in store.js
    ↓
apply.js: broadcast { type: 'mutation', event: 'markCompleted', keys: { habitId, date } } on 'nawyki'
    ↓
apply.js: push inverse onto state/undo.js stack
    ↓
store.js notifies subscribers → today.js re-renders the row
    ↓
(Other tab's sync.js receives broadcast → invalidates its cache slice → its today.js re-renders)
```

### Edit Flow (changing a habit definition)

```
User saves habit edit
    ↓
views/catalog.js (or habit-detail.js) calls state/apply.js with { type: 'editHabit', habitId, newDef }
    ↓
apply.js: open tx on [habits, habit_versions, events]
         → copy current habits[id] into habit_versions[habitId, effectiveFrom=now]
         → overwrite habits[id] with newDef
         → append event row with inverse = { type: 'restoreHabitDef', oldDef, removeVersion: effectiveFrom }
         → NO writes to logs (the invariant)
    ↓
broadcast { type: 'mutation', event: 'editHabit', keys: { habitId } }
    ↓
History view, when rendering an old log row, looks up habit_versions[habitId, log.definitionVersion]
to display the row with its ORIGINAL framing (name at the time, threshold at the time, etc.)
```

This is the central invariant the architecture protects: **logs are interpreted by the definition that was in effect when they were written, not by the current definition.**

---

## Scaling Considerations

This is a **single-user** app. The relevant axes aren't user count — they're data volume over years and view-rendering speed at maximum data.

| Axis | At 1 year (~365 days × 65 habits = ~24k log rows) | At 5 years (~120k log rows) | At 10 years (~240k log rows) |
|---|---|---|---|
| Boot hydration | Hydrate ONLY the visible date window (e.g. last 90 days). Read more on demand. | Same. | Same. Plus: consider an archive flag on logs older than N years if scans get noticeable. |
| History scrolling | Range query on `logs.date` index for the visible week. | Same. | Same. |
| Analytics aggregates | Compute on demand from the index; cache results in memory per session. | Same. Consider memoizing the most expensive aggregates (longest streak per wave) across sessions in `meta`. | Same. May want pre-computed rollup tables (a `daily_summary` store) — DEFER to a future phase. |
| Export | JSON export of full DB at 10 years is still well under 100 MB; Blob construction is fine. | Fine. | Fine. |

**The honest answer:** at the scales relevant to this project, IndexedDB is comfortably over-provisioned. Don't pre-optimize. The first thing to actually break (if anything) will be naively reading all logs into memory at boot — which is why hydration is **windowed by visible date range**, not "load everything."

---

## Sources

- STACK.md (companion file in this directory) — already-locked technology decisions; this document inherits and refines.
- PROJECT.md — constraints and feature surface.
- MDN — IndexedDB key paths and compound keys: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology
- MDN — BroadcastChannel API: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN — Hash-based vs History API routing trade-offs: https://developer.mozilla.org/en-US/docs/Web/API/History_API
- CQRS-lite / event log + materialized views — common pattern for personal apps with audit + undo requirements (no single canonical source; pattern is widely documented in distributed-systems and Redux-toolkit literature).

---
*Architecture research for: personal vanilla-PWA habit tracker (Nawyki v2)*
*Researched: 2026-05-26*
