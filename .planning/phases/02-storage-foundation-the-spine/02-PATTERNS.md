# Phase 2: Storage Foundation (The Spine) - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 28 (new) + 4 (modified) = 32
**Analogs found:** 24 in-repo / 4 sibling-repo / 4 no-analog

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/util/date.js` | utility | pure-transform | `js/util/version.js` | role-match (pure util shape) |
| `js/util/id.js` | utility | pure-transform | `js/util/version.js` | role-match (pure util shape) |
| `js/db/idb.js` | adapter (storage) | request-response (IDB) | none in-repo | RESEARCH §Code Examples + MDN pattern |
| `js/db/schema.js` | config (DDL) | migration dispatch | `js/util/version.js` (const-export shape) | role-match (const-export) |
| `js/db/repo.js` | facade (typed CRUD) | request-response | none in-repo | RESEARCH §Code Examples + ARCHITECTURE §3 |
| `js/state/store.js` | state (cache + pub-sub) | event-driven | none in-repo (subscribe/notify shape) | partial — `toast.js` shows singleton-guard pattern |
| `js/state/apply.js` | controller (mutator chokepoint) | command/CQRS | none in-repo | RESEARCH §Pattern 4 (sketch) |
| `js/state/apply/markCompleted.js` | handler (per-event) | request-response | none in-repo | RESEARCH §Pattern 4 (sketch) |
| `js/state/undo.js` | service (state) | request-response | none in-repo | ARCHITECTURE §6 + RESEARCH §D-43 |
| `js/platform/sync.js` | platform (pub-sub adapter) | event-driven (pub-sub) | `js/platform/sw-register.js` | role-match (platform adapter w/ feature-detect) |
| `js/platform/lifecycle.js` | platform (event hook) | event-driven | `js/platform/sw-register.js` | role-match (event listener attach) |
| `js/io/seed.js` | service (bootstrap) | batch + file-I/O (fetch) | none in-repo | role-match (idempotent boot step) |
| `seed/habits.json` | data (static fixture) | n/a | none in-repo | no analog |
| `scripts/serve.js` | tooling (node http) | request-response | `../sleep-tracker/scripts/serve.js` | **exact** (verbatim shape) |
| `.github/workflows/ci.yml` | tooling (CI) | n/a | `../sleep-tracker/.github/workflows/ci.yml` | role-match (different deps stack) |
| `tests/helpers/fake-idb.js` | test fake | request-response | none in-repo | role-match — sleep-tracker `storage-memory` |
| `tests/helpers/fake-broadcast-channel.js` | test fake | event-driven | none in-repo | no analog |
| `tests/helpers/fake-storage.js` | test fake | request-response | none in-repo | no analog |
| `tests/helpers/fake-document.js` | test fake | event-driven | none in-repo | no analog |
| `tests/unit/date.test.js` | test (pure) | n/a | `../sleep-tracker/tests/unit/time.test.js` | **exact** (DST + format/parse tests) |
| `tests/unit/id.test.js` | test (pure) | n/a | `../sleep-tracker/tests/unit/time.test.js` | role-match (node:test + assert/strict) |
| `tests/unit/schema.test.js` | test (config) | n/a | `../sleep-tracker/tests/unit/time.test.js` | role-match |
| `tests/unit/lifecycle.test.js` | test (event hook) | n/a | `../sleep-tracker/tests/unit/time.test.js` | role-match |
| `tests/unit/seed.shape.test.js` | test (config + grep) | n/a | `../sleep-tracker/tests/unit/time.test.js` | role-match |
| `tests/unit/apply.discipline.test.js` | test (grep) | n/a | `../sleep-tracker/tests/unit/time.test.js` | role-match |
| `tests/integration/repo.roundtrip.test.js` | test (integration) | n/a | `../sleep-tracker/tests/integration/event-log.test.js` | **exact** (factory + fake-storage composition) |
| `tests/integration/apply.markCompleted.test.js` | test (integration) | n/a | `../sleep-tracker/tests/integration/event-log.test.js` | role-match |
| `tests/integration/undo.persist-reload.test.js` | test (integration) | n/a | `../sleep-tracker/tests/integration/event-log.test.js` | role-match |
| `tests/integration/seed.idempotent.test.js` | test (integration) | n/a | `../sleep-tracker/tests/integration/event-log.test.js` | role-match |
| `tests/integration/seed.persist.test.js` | test (integration) | n/a | `../sleep-tracker/tests/integration/event-log.test.js` | role-match |
| `tests/integration/sync.broadcast.test.js` | test (integration) | n/a | `../sleep-tracker/tests/integration/event-log.test.js` | role-match |
| `js/views/diagnostics.js` (modified) | view (button wiring) | event-driven | `js/views/diagnostics.js` § "Reset shell" handler | **exact** (same file, parallel handler) |
| `sw.js` (potentially modified — planner-pick per Pitfall 8) | service-worker (SHELL list) | n/a | `sw.js` SHELL array (existing) | **exact** (append entries) |
| `js/main.js` (modified) | entry point | startup wiring | `js/main.js` (existing) | **exact** (append boot calls) |
| `js/desktop.js` (modified) | entry point | startup wiring | `js/main.js` | role-match (parallel boot) |
| `CLAUDE.md` (modified) | docs | n/a | n/a | doc-only edit (D-30 + D-35) |
| `README.md` (modified) | docs | n/a | n/a | doc-only edit (D-46 swap python http.server line) |
| `.planning/PROJECT.md` (modified) | docs | n/a | n/a | doc-only edit (D-35 reversal) |
| `js/util/version.js` (modified) | const-export | n/a | self | **exact** — bump value to `'0.2.0'` at phase end |
| `.planning/research/ARCHITECTURE.md` (modified) | docs | n/a | n/a | forward-edits per D-30, D-39, D-42 |

## Pattern Assignments

### `js/util/date.js` (utility, pure-transform)

**Analog:** `js/util/version.js` (file-header shape + JSDoc @type tags + multi-line rationale).

**File-header pattern** (`js/util/version.js` lines 1-32):

```javascript
/**
 * @file Single source of truth for app version (D-12).
 *
 * Format: Semantic Versioning 2.0.0 — https://semver.org/
 * ...
 * See VERSIONING.md at the project root for the full policy.
 */
```

**Apply to date.js:**

```javascript
/**
 * @file Local-time YYYY-MM-DD utilities (DATA-06, Anti-Pattern 3, Pitfall 4).
 *
 * The Day-1 module per ARCHITECTURE §7. Every other module that touches a
 * date key (logs keypath, cadence engine, CSV columns) depends on these
 * helpers. NEVER `toISOString()` — that yields UTC and silently corrupts
 * late-night check-ins. All arithmetic constructs via `new Date(y, m-1, d)`
 * and steps via `setDate(d.getDate() + n)` so DST + leap days are honored.
 *
 * Test fixtures locked at three concrete dates (PATTERNS):
 *   - 2026-03-29 — Europe/Warsaw DST spring-forward (02:00 → 03:00 skipped)
 *   - 2026-10-25 — Europe/Warsaw DST fall-back (03:00 → 02:00 repeats)
 *   - 2028-02-29 — leap day
 */
```

**Export pattern (concrete code excerpts — copy from RESEARCH §Code Examples):**

```javascript
/** @returns {string} Today as YYYY-MM-DD in user's local timezone. */
export function todayLocal() { return formatLocalYMD(new Date()); }

/** @param {Date} d @returns {string} */
export function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
```

---

### `js/util/id.js` (utility, pure-transform)

**Analog:** `js/util/version.js` (single-purpose exported function).

**Apply (per RESEARCH Pitfall 13 — defense-in-depth fallback):**

```javascript
/** @file UUID generation for habits, habit_versions, events (D-42). Pitfall 13 fallback for file:// on Safari. */
export function newId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (globalThis.crypto && typeof crypto.getRandomValues === 'function') {
    return uuidV4FromGetRandomValues();
  }
  return uuidV4FromMathRandom();
}
```

---

### `js/db/idb.js` (adapter, request-response)

**Analog:** **None in-repo.** This is the first IDB-touching module in the codebase. Use RESEARCH §Code Examples verbatim (lines 777-835 of 02-RESEARCH.md). Pattern is locked: hand-written ~80-line promise wrapper.

**File-header pattern** (lift JSDoc-header convention from `js/views/diagnostics.js` lines 1-18 + `sw.js` lines 1-46):

```javascript
/**
 * @file Hand-written ~80-line promise wrapper around IndexedDB. The ONLY
 * module that calls `indexedDB` directly (D-30, ARCHITECTURE §3, STACK.md
 * §IndexedDB Approach).
 *
 * Locked decisions implemented here:
 *   - D-30: DB_NAME = 'habits' (namespace-aligned with cache prefix +
 *           BroadcastChannel name + manifest name).
 *   - D-42: events store keyed by UUID, not autoincrement.
 *   - D-39: score_snapshots store declared in v1 (empty until P6).
 *
 * Critical invariant (Pitfall 1 + MDN IDBTransaction): NEVER `await` an
 * unrelated async API inside a tx body — IDB auto-commits on idle tick.
 * Either chain inside `runTx`, or `await tx.done` before yielding.
 */

import { DB_VERSION, MIGRATIONS } from './schema.js';
const DB_NAME = 'habits';
```

**Core API surface** (4 exports — copy shape from RESEARCH lines 786-832):

`openDB()`, `promisify(req)`, `done(tx)`, `runTx(db, stores, mode, body)`, plus per-op helpers `get`, `getAll`, `put`, `del`, `cursor`, `indexGetAll`.

---

### `js/db/schema.js` (config, migration dispatch)

**Analog:** `js/util/version.js` for the const-export + JSDoc-rationale shape.

**Pattern source:** RESEARCH §Pattern 2 (lines 396-432 of 02-RESEARCH.md) — verbatim. **Three locked deltas vs ARCHITECTURE.md**: 7 stores (not 6 — D-39 adds `score_snapshots`), events keyed by UUID (D-42), DB name `'habits'` (D-30).

```javascript
/** @file DB_VERSION + MIGRATIONS dispatch table (DATA-02, Pitfall 10, D-39, D-42). */

export const DB_VERSION = 1;
export const MIGRATIONS = {
  1: (db, _tx) => {
    db.createObjectStore('habits', { keyPath: 'id' })
      .createIndex('wave', 'wave')
      .createIndex('status', 'status');
    db.createObjectStore('habit_versions', { keyPath: ['habitId', 'effectiveFrom'] })
      .createIndex('habitId', 'habitId');
    db.createObjectStore('logs', { keyPath: ['habitId', 'date'] })
      .createIndex('date', 'date')
      .createIndex('habitId', 'habitId');
    db.createObjectStore('events', { keyPath: 'id' })  // UUID per D-42
      .createIndex('at', 'at')
      .createIndex('type', 'type')
      .createIndex('habitId', 'habitId');
    db.createObjectStore('settings', { keyPath: 'key' });
    db.createObjectStore('meta',     { keyPath: 'key' });
    db.createObjectStore('score_snapshots', { keyPath: ['habitId', 'date'] })  // D-39
      .createIndex('date', 'date')
      .createIndex('habitId', 'habitId');
  },
};
```

**Pitfall 10 reminder:** dispatch via loop, NOT switch fallthrough.

---

### `js/db/repo.js` (facade, request-response)

**Analog:** **None in-repo.** Pattern: thin typed wrappers over `idb.js` primitives. Surface MUST match `tests/helpers/fake-idb.js` (Assumption A7 — drift between fake and real is the most likely false-pass mode; mitigate with contract test).

**Suggested export surface (from RESEARCH `tests/helpers/fake-idb.js` sketch lines 859-873):**

```javascript
// Per-store helpers — typed get/put per store
export async function getHabit(id) { /* ... */ }
export async function putHabit(h) { /* ... */ }
export async function putLog(l) { /* ... */ }
export async function getLog(habitId, date) { /* ... */ }
export async function putEvent(e) { /* ... */ }
export async function getEvent(id) { /* ... */ }
export async function getMeta(key) { /* ... */ }
export async function putMeta(key, value) { /* ... */ }
// + getEventsByAt(range), getLogsByDate(ymd), getSetting/putSetting, etc.
```

---

### `js/state/store.js` (state, event-driven pub-sub)

**Analog:** `js/views/toast.js` for the singleton-guard pattern (module-level `let X = null` + idempotent guard).

**`toast.js` singleton-guard pattern** (lines 17-27):

```javascript
let toastEl = null;

export function showUpdateToast() {
  // Idempotent re-entry guard: if a toast is already mounted, do nothing.
  if (toastEl) return;
  // ... mount
}
```

**Apply to store.js:** module-level state for the cache + subscriber set; `hydrate()` idempotent; `subscribe(fn) → unsubscribe` closure; `notify(slice)` iterates subscribers.

```javascript
/** @file In-memory cache + subscribe/notify (RESEARCH §A9, ARCHITECTURE §2). */

const cache = { habits: new Map(), logs: new Map() };
const subs = new Set();
let hydrated = false;

export async function hydrate() {
  if (hydrated) return;
  // ... read from repo, fill cache
  hydrated = true;
}

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function notify(slice) { for (const fn of subs) fn(slice); }
```

---

### `js/state/apply.js` (controller, command/CQRS chokepoint)

**Analog:** **None in-repo.** Pattern locked by ARCHITECTURE.md Anti-Pattern 4 + RESEARCH §Pattern 4.

**Copy from RESEARCH lines 449-490 verbatim as the structural template**:

```javascript
import { broadcast } from '../platform/sync.js';
import { newId } from '../util/id.js';
import { handleMarkCompleted } from './apply/markCompleted.js';

const HANDLERS = {
  markCompleted: handleMarkCompleted,
};

export async function apply(event) {
  const handler = HANDLERS[event.type];
  if (!handler) throw new Error(`unknown event type: ${event.type}`);

  const { writes, inverse, storeNames } = await handler(event, /* repo */);

  const eventRow = {
    id: newId(),
    at: new Date().toISOString(),  // ISO ts ONLY for events.at (NOT for date keys — DATA-06)
    type: event.type,
    payload: event.payload,
    inverse,
  };

  await runTx([...storeNames, 'events', 'meta'], async (tx) => {
    for (const w of writes) await tx.put(w.store, w.value);
    await tx.put('events', eventRow);
    await tx.put('meta', { key: 'undoToken', value: eventRow.id });
  });

  // CRITICAL ORDER (Pitfall 2): broadcast AFTER tx commit, keys not values.
  broadcast({
    type: 'mutation',
    event: event.type,
    keys: handler.broadcastKeys(event),
    at: eventRow.at,
    origin: ORIGIN,  // session-scoped (planner-pick: crypto.randomUUID() at boot)
  });
  notifySubscribers({ event: event.type, keys: handler.broadcastKeys(event) });

  return eventRow.id;
}
```

**Anti-Patterns enforced** (from ARCHITECTURE.md):
- §Anti-Pattern 1: views never call `repo.js` directly
- §Anti-Pattern 4: per-event handler modules, NOT a giant switch
- §Pitfall 2: `await runTx(...)` THEN `broadcast(...)`, never the reverse
- §Pitfall 7: `meta.undoToken` MUST be written in the same tx as every mutation

---

### `js/state/apply/markCompleted.js` (handler, request-response)

**Analog:** **None in-repo.** The handler-contract is locked by RESEARCH §Pattern 4: each handler returns `{ writes, inverse, storeNames }` and exposes a `broadcastKeys(event)` helper.

**Suggested shape:**

```javascript
/** @file markCompleted handler (D-34, D-43). Inverse = restoreLogRow with `prior`. */

export async function handleMarkCompleted(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date);  // null if no prior row
  const next = { habitId, date, completed: true, definitionVersion: null /* DATA-05 */ };
  return {
    storeNames: ['logs'],
    writes: [{ store: 'logs', value: next }],
    inverse: { type: 'restoreLogRow', payload: { habitId, date, prior } },
  };
}

handleMarkCompleted.broadcastKeys = (event) => ({
  habitId: event.payload.habitId,
  date: event.payload.date,
});
```

---

### `js/state/undo.js` (service, request-response)

**Analog:** **None in-repo.** Pattern from ARCHITECTURE §6 lines 309-323.

```javascript
/** @file Persistent single-step undo via meta.undoToken (D-43, ARCH §6, UNDO-02). */

import { apply } from './apply.js';
import { getMeta, getEvent } from '../db/repo.js';

export async function undo() {
  const token = await getMeta('undoToken');
  if (!token) return null;
  const evt = await getEvent(token);
  if (!evt || !evt.inverse) return null;
  // Dispatch the inverse through the same apply path so it also broadcasts + flushes.
  return apply({ type: evt.inverse.type, payload: evt.inverse.payload });
}
```

---

### `js/platform/sync.js` (platform, event-driven pub-sub)

**Analog:** `js/platform/sw-register.js` (feature-detect + protocol-guard + silent-fail discipline; module is the single integration point for a platform API).

**`sw-register.js` defense-in-depth pattern** (lines 35-63):

```javascript
export function registerServiceWorker() {
  // Defense 1 — feature detect.
  if (!('serviceWorker' in navigator)) return;

  // Defense 2 — protocol guard.
  if (!location.protocol.startsWith('http')) return;

  // Defense 3 — silent .catch().
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => { /* silent */ });
  });

  // Event hook — controllerchange listener.
  navigator.serviceWorker.addEventListener('controllerchange', () => { /* ... */ });
}
```

**Apply to sync.js — feature-detect + safe-degrade (per RESEARCH §Environment Availability "BroadcastChannel ... if BC fails, single-tab still works"):**

```javascript
/** @file BroadcastChannel('habits') wrapper (D-07, D-30, ARCH §6, Pitfall 8). */

const CHANNEL = 'habits';  // D-30 — matches DB name + cache prefix
const ORIGIN = (globalThis.crypto && typeof crypto.randomUUID === 'function')
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let bc = null;
let listeners = new Set();

export function bootSync() {
  if (typeof BroadcastChannel === 'undefined') return;  // graceful degrade
  bc = new BroadcastChannel(CHANNEL);
  bc.addEventListener('message', (e) => {
    if (e.data && e.data.origin === ORIGIN) return;  // skip own writes (ARCH §6)
    for (const fn of listeners) fn(e.data);
  });
}

/** @param {{type, event, keys, at, origin}} msg */
export function broadcast(msg) {
  if (!bc) return;
  bc.postMessage({ ...msg, origin: ORIGIN });
}

export function onMessage(fn) { listeners.add(fn); return () => listeners.delete(fn); }
```

**Message envelope** (ARCHITECTURE.md §6 lines 288-294):

```javascript
{ type: 'mutation',
  event: 'markCompleted' | 'editHabit' | ... ,
  keys: { habitId?, date?, ... },
  at: <ISO ts>,
  origin: <this tab's session id> }
```

---

### `js/platform/lifecycle.js` (platform, event-driven)

**Analog:** `js/views/diagnostics.js` (the `attachLongPress` function lines 45-77 — `addEventListener` plumbing on a passed-in target) for the event-listener-attach pattern. Also `js/platform/sw-register.js` (window-level event listener wiring).

**`diagnostics.js` listener-attach pattern** (lines 45-77):

```javascript
export function attachLongPress(el, onLongPress) {
  let timer = null;
  // ...
  el.addEventListener('pointerdown', e => { /* ... */ });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  // ...
}
```

**Apply to lifecycle.js — copy verbatim from RESEARCH §Pattern 6 (lines 506-524):**

```javascript
/** @file visibilitychange → hidden flush (DATA-08, Pitfall 8, MDN). NEVER beforeunload. */

let inFlightTxPromise = Promise.resolve();

/** Track an in-flight tx so the lifecycle flush can await it. */
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
  await inFlightTxPromise;
}
```

**Forbidden:** `window.addEventListener('beforeunload', ...)` — unreliable on mobile/PWAs (MDN-verified; D-08 / Pitfall 8 reject).

---

### `js/io/seed.js` (service, batch + file-I/O)

**Analog:** **None in-repo.** Combines `fetch('./seed/habits.json')`, IDB write tx, and a one-shot `navigator.storage.persist()` call.

**Pattern (from ARCHITECTURE.md diagram + D-33/D-41/D-45):**

```javascript
/** @file Idempotent seed loader (SEED-01..05, D-31..D-33, D-41, D-45). */

import { runTx, openDB } from '../db/idb.js';
import { newId } from '../util/id.js';

export async function bootSeed() {
  const res = await fetch('./seed/habits.json');     // relative path (D-19)
  const seed = await res.json();                       // { schemaVersion, seedVersion, habits: [...] }
  const db = await openDB();

  // Read meta.seededIds for fast-path no-op (D-33).
  const alreadySeededIds = new Set(/* read meta.seededIds */);
  const toInsert = seed.habits.filter(h => !alreadySeededIds.has(h.id));
  if (toInsert.length === 0) return;  // already seeded; idempotent no-op

  await runTx(db, ['habits', 'events', 'meta', 'settings'], 'readwrite', async (tx) => {
    for (const h of toInsert) {
      tx.objectStore('habits').put(h);
      tx.objectStore('events').put({
        id: newId(),
        at: new Date().toISOString(),
        type: 'seed:createHabit',
        payload: { habitId: h.id },
        inverse: null,
      });
    }
    tx.objectStore('meta').put({ key: 'seededIds', value: seed.habits.map(h => h.id) });
    // D-45 mastery defaults + schemaVersion (only on first run).
    tx.objectStore('settings').put({ key: 'defaultThreshold',  value: 0.9 });
    tx.objectStore('settings').put({ key: 'defaultWindowDays', value: 70 });
    tx.objectStore('settings').put({ key: 'schemaVersion',     value: 1 });
  });

  // D-41: persist() fires once on first ever write. Pitfall 11: gate via meta flag.
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    const granted = await navigator.storage.persist();  // Pitfall 3: false is non-fatal
    // Persist the outcome so subsequent boots don't re-probe (Pitfall 11).
    await runTx(db, ['meta'], 'readwrite', async (tx) => {
      tx.objectStore('meta').put({ key: 'persistResult', value: granted });
    });
  }
}
```

---

### `scripts/serve.js` (tooling, request-response)

**Analog:** **`../sleep-tracker/scripts/serve.js`** — exact match. Lift verbatim with TWO swaps.

**Source file (sleep-tracker), lines 1-58, full content:**

```javascript
// scripts/serve.js
// Tiny zero-dependency static file server for local dev + Playwright webServer.
// Resolves RESEARCH §Environment Availability Assumption A2 — keeps the project
// independent of Python being on PATH. Serves files relative to process.cwd().
//
// Usage: node scripts/serve.js  (then open http://localhost:8080/)

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const PORT = Number(process.env.PORT) || 8080;
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Path traversal guard: resolve relative to ROOT, reject anything outside
  const filePath = normalize(join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`[nightwatch] serving ${ROOT} on http://localhost:${PORT}/`);
});
```

**Two required swaps:**
1. Comment block: replace "Playwright webServer" / "Python on PATH" / "Assumption A2" with Habits' D-46 rationale ("zero-dep alternative to `python -m http.server` for local SW + manual smoke testing").
2. Log line (line 57): swap `[nightwatch]` → `[habits]`.

Path-traversal guard, MIME map, port/env handling: all **verbatim**.

---

### `.github/workflows/ci.yml` (tooling, CI)

**Analog:** `../sleep-tracker/.github/workflows/ci.yml` — role-match but DIFFERENT stack.

**Sleep-tracker's workflow uses npm + Playwright** (lines 27-34):

```yaml
      - name: Install dev dependencies
        run: npm ci
      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium
      - name: Run unit + integration tests (node:test)
        run: node --test
      - name: Run E2E tests (Playwright)
        run: npx playwright test
```

**Habits MUST NOT use any of those.** Habits' workflow is the **zero-dep node-test-only** shape from RESEARCH §Code Examples (lines 879-898 of 02-RESEARCH.md):

```yaml
# Source: D-38 + D-24 + D-47 (no npm, no Playwright).
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

**Lift from sleep-tracker (only):** the `on:` triggers shape (push + pull_request on main), the `runs-on: ubuntu-latest`. **Reject** any `npm ci`, `playwright`, `npm cache` lines — Habits is strict no-npm (D-47).

**Pitfall 10 (RESEARCH):** include BOTH `on.push.branches` AND `on.pull_request.branches` — a workflow with only one trigger silently ungates merges.

---

### `tests/helpers/fake-idb.js` (test fake, request-response)

**Analog:** Conceptually closest is `sleep-tracker/js/adapters/storage-memory.js` (in-memory backend exposing the same surface as the real adapter) — referenced from sleep-tracker integration tests via `createStorageMemory()`. The same idea applies here.

**Pattern source:** RESEARCH lines 843-874 of 02-RESEARCH.md (verbatim 30-line sketch):

```javascript
/** @file ~30-line in-memory fake matching js/db/repo.js surface (D-25, RESEARCH A7). */

export function createFakeRepo() {
  const stores = {
    habits: new Map(), habit_versions: new Map(), logs: new Map(),
    events: new Map(), settings: new Map(), meta: new Map(),
    score_snapshots: new Map(),
  };
  return {
    async getHabit(id) { return stores.habits.get(id); },
    async putHabit(h)  { stores.habits.set(h.id, h); },
    async putLog(l)    { stores.logs.set(JSON.stringify([l.habitId, l.date]), l); },
    async getLog(habitId, date) { return stores.logs.get(JSON.stringify([habitId, date])); },
    async putEvent(e)  { stores.events.set(e.id, e); },
    async getEvent(id) { return stores.events.get(id); },
    async getMeta(key)        { return stores.meta.get(key)?.value; },
    async putMeta(key, value) { stores.meta.set(key, { key, value }); },
    async runTx(_stores, _mode, body) { return body(); },  // no real isolation
    _stores: stores,  // exposed for test assertions
  };
}
```

**Contract enforcement (A7):** consider a `tests/integration/contract.fake-vs-real.test.js` that imports both `repo.js` and `fake-idb.js` and asserts identical export-name sets.

---

### `tests/unit/date.test.js` (test, pure)

**Analog:** **`../sleep-tracker/tests/unit/time.test.js`** — exact match. Sleep-tracker's time test (47 lines) is the structural template for Habits' date test.

**Sleep-tracker shape (lines 1-46):**

```javascript
// tests/unit/time.test.js
// Source: RESEARCH §Code Examples §Unit test example + 01-PLAN.md §Task 2

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundTo5,
  formatLocalISO,
  parseLocalISO,
} from '../../js/lib/time.js';

describe('roundTo5', () => {
  test('returns a Date instance for any valid Date input', () => {
    const out = roundTo5(new Date(2026, 4, 26, 6, 33));
    assert.ok(out instanceof Date, 'expected Date instance');
    assert.equal(out.getMinutes() % 5, 0, 'expected minutes on a 5-min boundary');
  });
});

describe('formatLocalISO / parseLocalISO', () => {
  test('round-trips "2026-05-26T03:50"', () => {
    const original = '2026-05-26T03:50';
    assert.equal(formatLocalISO(parseLocalISO(original)), original);
  });

  test('throws on date-only "2026-05-26"', () => {
    assert.throws(
      () => parseLocalISO('2026-05-26'),
      /Invalid local ISO timestamp/,
    );
  });
});
```

**Apply to Habits date.test.js — copy structure verbatim, swap fixtures to:**

- `2026-03-29` — Europe/Warsaw DST spring-forward (Pitfall 4)
- `2026-10-25` — Europe/Warsaw DST fall-back (Pitfall 4)
- `2028-02-29` — leap day (Pitfall 4)

**Imports (verbatim):**

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { todayLocal, formatLocalYMD, parseLocalYMD, daysFrom } from '../../js/util/date.js';
```

**Concrete assertion shapes** (specifics §"`utility-date.js` tests must hit DST 2026-03-29..."):

```javascript
describe('daysFrom — DST spring-forward', () => {
  test('2026-03-28 + 1 day === 2026-03-29 (DST jump does not skip a day)', () => {
    assert.equal(daysFrom('2026-03-28', 1), '2026-03-29');
  });
});

describe('daysFrom — leap day', () => {
  test('2028-02-28 + 1 day === 2028-02-29', () => {
    assert.equal(daysFrom('2028-02-28', 1), '2028-02-29');
  });
  test('2028-02-29 + 1 day === 2028-03-01', () => {
    assert.equal(daysFrom('2028-02-29', 1), '2028-03-01');
  });
});
```

---

### `tests/integration/repo.roundtrip.test.js` (test, integration)

**Analog:** **`../sleep-tracker/tests/integration/event-log.test.js`** — exact match. Sleep-tracker's integration test (73 lines) is the structural template.

**Sleep-tracker factory pattern (lines 13-27):**

```javascript
import { createEventLog } from '../../js/store/event-log.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';

function makeTestLog({ frozenAt = new Date(2026, 4, 26, 6, 35) } = {}) {
  const storage = createStorageMemory();
  const clock = createClockFixed(frozenAt);
  let nextId = 1;
  const id = () => `e${nextId++}`;
  const log = createEventLog({ storage, clock, id });
  return { log, storage, clock };
}
```

**Sleep-tracker rehydration-after-reload test (lines 56-73):**

```javascript
describe('event-log: persistence / rehydration (D-05 invariant)', () => {
  test('a fresh createEventLog over the SAME storage reads the same event back', () => {
    const { log, storage } = makeTestLog();
    log.addEvent('wake');

    // Simulate reload: construct a brand-new event log over the SAME storage.
    const log2 = createEventLog({
      storage,
      clock: createClockFixed(new Date(2026, 4, 26, 7, 0)),
      id: () => 'unused',
    });

    const events = log2.listEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'wake');
  });
});
```

**Apply to Habits — same factory shape + same "rehydrate over the SAME storage" assertion for `undo.persist-reload.test.js`** (UNDO-02 round-trip).

**For Habits repo.roundtrip.test.js, the composition is:**

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

function makeRepo() {
  return createFakeRepo();
}

describe('repo: put + get round-trip', () => {
  test('putHabit then getHabit returns the same value', async () => {
    const repo = makeRepo();
    const habit = { id: 'h1', wave: 1, status: 'active', name: 'Morning walk' };
    await repo.putHabit(habit);
    assert.deepEqual(await repo.getHabit('h1'), habit);
  });
});
```

---

### `js/views/diagnostics.js` (modified — wire Reset-data button)

**Analog:** The SAME file. **Reset-shell handler** (lines 139-170) is the exact-shape template for the new Reset-data handler.

**Existing Reset-shell pattern (verbatim from `diagnostics.js` lines 139-170):**

```javascript
  // Reset shell — wired (D-05). Verbatim D-06 confirm phrasing.
  const resetShellBtn = document.createElement('button');
  resetShellBtn.className = 'diagnostics-action';
  resetShellBtn.textContent = 'Reset shell';
  resetShellBtn.addEventListener('click', async () => {
    // D-06 confirm copy — VERBATIM, do not edit.
    const confirmed = confirm('Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install.');
    if (!confirmed) return;

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
        }
      } catch (_e) {
        // Swallow — proceed with cache deletion + reload regardless.
      }
    }

    if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (_e) {
        // Swallow — proceed with reload regardless.
      }
    }

    location.reload();
  });
```

**Apply same shape to Reset-data button — REPLACE existing placeholder (lines 172-178):**

```javascript
  // Reset data — wired (D-44). Verbatim D-06-style confirm phrasing for THIS button.
  const resetDataBtn = document.createElement('button');
  resetDataBtn.className = 'diagnostics-action';
  resetDataBtn.textContent = 'Reset data';
  resetDataBtn.addEventListener('click', async () => {
    // Verbatim D-06 phrasing for the data-reset variant (CONTEXT D-44 calls for D-06 style).
    const confirmed = confirm('Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.');
    if (!confirmed) return;

    try {
      // `deleteDatabase` returns a request; await it via a small Promise wrapper.
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('habits');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();  // close other tabs manually; reload still fixes it
      });
    } catch (_e) {
      // Swallow — proceed with reload regardless.
    }

    location.reload();
  });
  actions.appendChild(resetDataBtn);
```

**Discipline retained:** `textContent` only (never `innerHTML`); same swallow-and-reload error handling; same `confirm()` early-return on cancel.

---

### `js/main.js` (modified) and `js/desktop.js` (modified)

**Analog:** The SAME file. Existing append-only boot sequence (lines 16-33 of `main.js`).

**Existing boot pattern (verbatim from `main.js` lines 16-33):**

```javascript
import { registerServiceWorker } from './platform/sw-register.js';
import { mountDiagnostics, attachLongPress } from './views/diagnostics.js';

registerServiceWorker();

const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') mountDiagnostics();

const titleEl = document.querySelector('[data-app-title]');
if (titleEl) attachLongPress(titleEl, mountDiagnostics);
```

**Append-only P2 boot wiring:**

```javascript
import { hydrate } from './state/store.js';
import { bootSync } from './platform/sync.js';
import { bootLifecycle } from './platform/lifecycle.js';
import { bootSeed } from './io/seed.js';

bootSync();              // pre-write subscriber is wired
bootLifecycle();         // visibilitychange + pagehide flush ready
await bootSeed();        // first-run idempotent seed + persist()
await hydrate();         // populate in-memory cache from IDB
```

**Order rationale:** sync + lifecycle before seed so the seed-tx is covered by flush; hydrate after seed so the cache reflects post-seed state.

---

### `sw.js` (optionally modified — RESEARCH Pitfall 8 strategy (a))

**Analog:** The SAME file. SHELL array (lines 62-80) is the append point.

**Existing SHELL pattern:**

```javascript
const SHELL = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  './icon.svg',
  './css/main.css',
  // ... etc
  './js/main.js',
  './js/desktop.js',
  './js/util/version.js',
  './js/platform/sw-register.js',
  './js/views/diagnostics.js',
  './js/views/toast.js',
];
```

**Append-only P2 candidates (planner picks strategy (a) per RESEARCH A5):**

```javascript
  // P2 storage spine
  './js/util/date.js',
  './js/util/id.js',
  './js/db/idb.js',
  './js/db/schema.js',
  './js/db/repo.js',
  './js/state/store.js',
  './js/state/apply.js',
  './js/state/apply/markCompleted.js',
  './js/state/undo.js',
  './js/platform/sync.js',
  './js/platform/lifecycle.js',
  './js/io/seed.js',
  './seed/habits.json',
```

**SW logic itself: untouched.** `seed/habits.json` should be in SHELL since `bootSeed()` issues a `fetch` for it (offline first-run needs it cached).

---

### `js/util/version.js` (modified — phase-completion bump)

**Analog:** Self. The file is designed for single-line edits. Per VERSIONING.md + D-28:

```javascript
// Before P2 work starts:
export const APP_VERSION = '0.1.0';

// After P2 phase-completion gate (final commit of phase):
export const APP_VERSION = '0.2.0';
```

`0.1.0` → `0.2.0` because P2 ships a new feature surface (storage spine) during initial development per SemVer §4.

---

## Shared Patterns

### JSDoc file headers (D-27)

**Source:** `js/util/version.js` lines 1-32, `js/views/diagnostics.js` lines 1-18, `js/views/toast.js` lines 1-14, `sw.js` lines 1-46.

**Apply to:** **EVERY** new `.js` file in P2 — no exceptions.

**Template:**

```javascript
/**
 * @file <one-line summary>.
 *
 * <Multi-line rationale describing WHY this exists, with cross-references
 * to D-XX decisions, RESEARCH §section, ARCHITECTURE §section, and pitfall
 * numbers it mitigates.>
 *
 * Locked decisions implemented here:
 *   - D-XX: <what>
 *   - D-YY: <what>
 *
 * Critical invariants:
 *   - <invariant 1>
 *   - <invariant 2>
 */
```

**Anti-pattern (banned):** line-by-line `//` restatements of what the next line does. Inline `//` only for non-obvious "why" notes (subtle invariants, workarounds, hidden constraints) — see CLAUDE.md "Comment Style (D-27)".

---

### Relative imports (D-19)

**Source:** Every existing `.js` file. Examples:

```javascript
import { showUpdateToast } from '../views/toast.js';                  // sw-register.js line 28
import { APP_VERSION } from '../util/version.js';                     // diagnostics.js line 20
import { APP_VERSION } from './js/util/version.js';                   // sw.js line 48
import { registerServiceWorker } from './platform/sw-register.js';    // main.js line 16
```

**Apply to:** every new module. **NEVER** bare specifiers (no `import { foo } from 'date'`), **NEVER** absolute paths (no `/js/util/date.js`). GitHub Pages sub-path compatibility (D-19).

---

### Defense-in-depth + silent-degrade for platform APIs

**Source:** `js/platform/sw-register.js` lines 35-63 (verbatim above).

**Apply to:** `js/platform/sync.js` (feature-detect `typeof BroadcastChannel`), `js/platform/lifecycle.js` (degrade gracefully if `document`/`window` missing in some test contexts), `js/io/seed.js` (feature-detect `navigator.storage.persist`).

**Pattern:** `if (!feature) return;` early-return + try/catch + swallow-and-continue. No noisy throws; user-facing surface stays renderable.

---

### Idempotent re-entry guard (singleton)

**Source:** `js/views/toast.js` lines 17-27, `js/views/diagnostics.js` lines 27-28 + 90-92.

**Apply to:** `js/state/store.js` (`hydrate()` runs once), `js/io/seed.js` (`bootSeed()` short-circuits via `meta.seededIds`), `js/platform/sync.js` (`bootSync()` only constructs `BroadcastChannel` once), `js/platform/lifecycle.js` (avoid double-attaching listeners).

**Shape:**

```javascript
let initialized = false;
export function bootX() {
  if (initialized) return;
  initialized = true;
  // ... actual work
}
```

---

### XSS-safe DOM construction (V5)

**Source:** `js/views/toast.js` line 11-14, `js/views/diagnostics.js` lines 217-225 (`appendRow` helper).

**`appendRow` pattern (diagnostics.js):**

```javascript
function appendRow(dl, label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;          // textContent only
  const dd = document.createElement('dd');
  dd.textContent = value;          // textContent only
  dl.appendChild(dt);
  dl.appendChild(dd);
  return dd;
}
```

**Apply to:** the Reset-data confirm dialog (only `confirm()` — no innerHTML), any future P3 view that this PATTERNS.md feeds forward. P2 has no rendering yet; the discipline persists.

---

### Error handling: swallow-and-continue in destructive flows

**Source:** `js/views/diagnostics.js` lines 154-156 + 163-165 (Reset-shell handler).

**Pattern:**

```javascript
try {
  await destructiveOp();
} catch (_e) {
  // Swallow — proceed with reload regardless.
}
```

**Apply to:** the Reset-data handler (per the diagnostics analog above), the seed-loader's `navigator.storage.persist()` call (Pitfall 3 — `false` is non-fatal, treat the same way), the lifecycle `flush()` (Promise chain already swallows via `.catch(() => {})` in RESEARCH §Pattern 6).

**Not for:** the integration tests (they SHOULD assert on errors via `assert.throws`), nor `state/apply.js` (handler errors must propagate — the chokepoint owns transactional integrity).

---

### Test file structure (D-23/24/25/26/37/38)

**Source:** `../sleep-tracker/tests/unit/time.test.js` lines 1-15, `../sleep-tracker/tests/integration/event-log.test.js` lines 1-27.

**Every new `tests/**/*.test.js` opens with:**

```javascript
// tests/<type>/<name>.test.js
// Source: <RESEARCH §section or PLAN §task reference>
//
// <Behavior covered + req-id mapping>

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { /* exports */ } from '../../js/<path>.js';
```

**No third-party imports anywhere.** Only `node:test`, `node:assert/strict`, and same-repo `../helpers/*` + `../../js/**`.

**Sampling:**
- Per-task TDD: `node --test tests/unit/<one>.test.js`
- Per-slice merge: `node --test tests/`
- Phase gate: `node --test tests/` green + manual `tests-browser.html` smoke (RESEARCH §Manual Browser Smoke Checklist)

---

### CI workflow: dual-trigger (Pitfall 10)

**Source:** RESEARCH §Code Examples lines 879-898; sleep-tracker `ci.yml` lines 11-16 (triggers shape — REJECT the `npm` lines).

**The required `on:` clause for Habits:**

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

**One-trigger workflows silently ungate merges on PRs (Pitfall 10).** Both `push` and `pull_request` to `main` are required.

---

### Cross-tab "broadcast keys, not values" (Pitfall 8 / RESEARCH §Pattern 5)

**Source:** RESEARCH §Pattern 5 + ARCHITECTURE.md §6 lines 286-301.

**Apply to:** `state/apply.js`'s call into `platform/sync.broadcast(...)` — the `keys` field carries only `{habitId, date}` (or whatever the handler's `broadcastKeys(event)` returns), NEVER the new row's values. Receivers re-read from IDB.

**Why:** receivers may have different cache windows; sending values causes drift; receivers must re-read for canonical state.

---

## No Analog Found

These files have no close in-repo or sibling-repo match. The planner pulls patterns from RESEARCH.md §Code Examples and the locked decisions instead.

| File | Role | Reason |
|------|------|--------|
| `js/db/idb.js` | adapter (IDB) | First IDB module in repo. Pattern locked by RESEARCH §Code Examples (lines 777-835) + MDN. |
| `js/db/repo.js` | facade | First storage facade. Surface dictated by `fake-idb.js` contract (A7). |
| `js/state/store.js` | state cache | First state module. Singleton-guard analog (`toast.js`) covers structural shape; subscribe/notify is new. |
| `js/state/apply.js` | mutator chokepoint | First mutator. Locked by ARCHITECTURE §2 + RESEARCH §Pattern 4; no in-repo precedent. |
| `js/state/apply/markCompleted.js` | per-event handler | First handler. Contract `{writes, inverse, storeNames}` is locked, but the per-handler shape is novel. |
| `js/state/undo.js` | persistent undo | First undo module. Pattern from ARCHITECTURE §6 + D-43. |
| `js/io/seed.js` | seed loader | First IO module. Pattern from ARCHITECTURE diagram + D-33/D-41/D-45. |
| `seed/habits.json` | static fixture | First seed file. Shape: `{schemaVersion, seedVersion, habits: [...]}` per RESEARCH Open Question 3 recommendation. |
| `tests/helpers/fake-broadcast-channel.js` | test fake | No existing BC fake. Build minimal: a class with `postMessage(msg)` + `addEventListener('message', fn)` + a module-level registry that delivers messages between fakes. |
| `tests/helpers/fake-storage.js` | test fake | No existing storage fake. Build minimal: `{ storage: { persist: () => Promise<bool>, persisted: () => Promise<bool> } }` + spy counters. |
| `tests/helpers/fake-document.js` | test fake | No existing document fake. Build minimal: `addEventListener` registry + `dispatchEvent('visibilitychange'/'pagehide')` + `visibilityState` getter. |

---

## Metadata

**Analog search scope:**
- `C:\Users\lukasz.bielinski\projects\habits\` (in-repo) — `js/**`, `sw.js`, `index.html`, `desktop.html`
- `C:\Users\lukasz.bielinski\projects\sleep-tracker\` (sibling) — `scripts/serve.js`, `tests/unit/`, `tests/integration/`, `.github/workflows/ci.yml`
- `.planning/research/ARCHITECTURE.md` §§1-7 + Anti-Patterns §§1-5
- `.planning/research/STACK.md` (referenced via CLAUDE.md TL;DR)
- `.planning/phases/02-storage-foundation-the-spine/02-RESEARCH.md` §Code Examples (lines 690-902)

**Files scanned:**
- In-repo `.js` files: 6 (`util/version.js`, `views/diagnostics.js`, `views/toast.js`, `platform/sw-register.js`, `main.js`, `desktop.js`)
- In-repo top-level: `sw.js`, `index.html`, `desktop.html`
- Sibling repo `.js` files: 3 (`scripts/serve.js`, `tests/unit/time.test.js`, `tests/integration/event-log.test.js`)
- Sibling repo CI: `.github/workflows/ci.yml`

**Key patterns identified:**
- JSDoc file headers + JSDoc `@param`/`@returns`/`@type` on exports (D-27) — uniform across every existing module
- Three-layer defense-in-depth for platform APIs (feature-detect + protocol/feature guard + silent `.catch()`) — established in `sw-register.js`, applied to all P2 platform modules
- Idempotent singleton-guard via module-level `let X = null` + early-return — `toast.js` + `diagnostics.js`; applied to `state/store.js`, `platform/sync.js`, `io/seed.js`
- `textContent` + `setAttribute` only for DOM construction — `diagnostics.js` `appendRow` helper is the canonical shape; banned `innerHTML` throughout
- Sleep-tracker's `node:test` + `node:assert/strict` + factory-style test-fixture pattern translates 1:1 to Habits' fake-IDB integration tests (D-25 confirmed by the parallel-implementation success in sleep-tracker)

**Pattern extraction date:** 2026-05-26
