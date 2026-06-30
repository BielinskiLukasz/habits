# Phase 3: Today View & Settings v1 (First Usable Slice) - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 23 (11 new code files + 5 new tests + 7 modifications)
**Analogs found:** 21 / 23 (2 NEW with partial role-only matches)

## File Classification

### New files (P3)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `js/router.js` | controller | event-driven (hashchange) | `js/main.js` (boot sequence) + `js/views/diagnostics.js` (`?debug=1` URL trigger) | partial — NEW seam, no exact analog |
| `js/views/today.js` | view (mount + subscribe) | request-response + pub-sub | `js/views/diagnostics.js` (mount pattern) + `js/state/store.js` (subscribe shape) | role-match (mount), missing subscribe analog |
| `js/views/settings.js` | view (mount + subscribe) | request-response + pub-sub | `js/views/diagnostics.js` (mount + Reset-data handler) | role-match |
| `js/domain/cadence.js` | utility (pure resolver) | transform | `js/util/date.js` (pure module shape + JSDoc + DST-aware) | partial — pure-module shape match, NEW domain |
| `js/domain/wave.js` | utility (boot-time loaded lookup) | batch (load-once + lookup) | `js/io/seed.js` (boot-time JSON fetch + in-memory cache) | role-match |
| `js/util/mount.js` | utility (DOM construction) | transform (desc → DOM) | `js/views/diagnostics.js` `appendRow()` (textContent/setAttribute discipline) | partial — extracts existing inline pattern |
| `js/state/apply/markUncompleted.js` | service (mutation handler) | event-driven (chokepoint write) | `js/state/apply/markCompleted.js` | **exact** — direct sibling |
| `js/state/apply/setSetting.js` | service (mutation handler) | event-driven (chokepoint write) | `js/state/apply/markCompleted.js` | role-match — different store but same handler contract |
| `css/settings.css` | config (style sheet) | n/a | `css/today.css` (`@layer view` + token references) | exact |
| `seed/waves.json` | config (data fixture) | n/a | `seed/habits.json` | role-match |
| `tests/unit/cadence.test.js` | test | n/a | `tests/unit/date.test.js` (pure-fn fixture-driven Node tests) | **exact** — DST/leap-day fixture style |
| `tests/unit/builders.test.js` | test | n/a | `tests/unit/seed.shape.test.js` (per-shape `describe`/`test` blocks) | role-match |
| `tests/unit/discipline.xss.test.js` | test | n/a | `tests/unit/apply.discipline.test.js` (grep-based file walker) | **exact** — same `readStripped` + `jsFilesIn` template |
| `tests/integration/today.test.js` | test (fake-IDB) | n/a | `tests/integration/apply.markCompleted.test.js` + `tests/integration/undo.persist-reload.test.js` | role-match — first integration test mounting a view |

### Modified files (P3)

| Modified File | Modification Role | Closest Existing Pattern Within The File | Notes |
|---------------|-------------------|------------------------------------------|-------|
| `index.html` | template (add panels + nav anchors) | Existing `.today-header` / `.today-list` / `.today-footer-nav` block | Add a `<section data-route="settings">` sibling + flip `<span>` → `<a href="#X">` |
| `js/main.js` | boot config (add router + mounts) | Existing P2 wiring block (lines 70-79) | Append `mountRoutes(...)` + `mountToday(...)` + `mountSettings(...)` after `await hydrate()` |
| `js/state/apply.js` | dispatch table (add 2 HANDLERS entries) | Existing `HANDLERS` object (lines 54-57) | Add `markUncompleted` + `setSetting` imports + table rows |
| `js/views/toast.js` | extension (`{autoDismissMs}` + `showErrorToast`) | Existing `showUpdateToast()` | Preserve no-auto-dismiss for update toast; add new functions |
| `js/util/date.js` | extension (4 new helpers) | Existing `daysFrom()` (uses `parseLocalYMD`/`formatLocalYMD`) | Add `isoWeekStart`, `isoWeekEnd`, `daysBetween`, `formatRelative` |
| `js/io/seed.js` | extension (load waves) — or sibling `bootWaves` | Existing `bootSeed()` fast-path no-op + fetch + diff | Sibling export preferred for separation of concerns |
| `js/db/schema.js` | comment only (document new `lastCompletedDate` field on `habits`) | Existing v1 schema in `MIGRATIONS[1]` (lines 44-74) | IDB stores are schemaless inside the store — no migration; comment habit row shape |
| `css/main.css` | one-line `@import` addition | Existing `@import url("./today.css") layer(view);` | Add `@import url("./settings.css") layer(view);` |
| `sw.js` | extend `SHELL` precache list | Existing `SHELL` array (lines 65-97) | Append 9 entries (8 JS + 1 CSS); `seed/waves.json` NOT in SHELL (SWR per D-81) |
| `js/util/version.js` | bump `APP_VERSION` to `0.3.0` | Existing `export const APP_VERSION = '0.2.0'` (line 35) | One-character edit on phase close |

---

## Pattern Assignments

### `js/state/apply/markUncompleted.js` (service, event-driven) — DIRECT sibling

**Analog:** `js/state/apply/markCompleted.js`

**JSDoc + handler contract** (lines 1-31, 33-52):
```javascript
/**
 * @file Per-event handlers for `markCompleted` and its inverse `restoreLogRow`
 * (D-34 — the one round-trip event P2 ships; D-43 — undo seam via prior-row capture).
 *
 * Each handler returns the canonical handler-contract shape:
 *   `{ storeNames, writes, inverse }`
 */

export async function handleMarkCompleted(event, repo) {
  const { habitId, date } = event.payload;
  const prior = await repo.getLog(habitId, date); // undefined when no prior row exists
  const next = { habitId, date, completed: true, definitionVersion: null };
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

**`markUncompleted` MUST follow this exact shape** — copy verbatim, change:
- `completed: true` → `completed: false`
- Add **a second write** to recompute `habit.lastCompletedDate` invariant (D-52). Within the same tx, read all logs for `habitId`, find max date where `completed: true`, set `habit.lastCompletedDate = thatDate ?? null`. `storeNames` grows to `['logs', 'habits']`.
- Inverse stays `restoreLogRow` (the existing P2 handler — already in this same file).
- Add `.broadcastKeys` identical to `markCompleted`'s.

---

### `js/state/apply/setSetting.js` (service, event-driven) — role-match sibling

**Analog:** `js/state/apply/markCompleted.js` (handler contract)

**Pattern to follow** (handler contract from analog lines 42-57):
```javascript
export async function handleSetSetting(event, repo) {
  const { key, value } = event.payload;
  const prior = await repo.getSetting(key); // undefined when no prior row
  return {
    storeNames: ['settings'],
    writes: [{ store: 'settings', value: { key, value } }],
    inverse: { type: 'setSetting', payload: { key, value: prior?.value } },
  };
}

handleSetSetting.broadcastKeys = (event) => ({ key: event.payload.key });
```

Note: inverse is `setSetting` itself (self-inverting given the prior value). When `prior?.value` is `undefined` (first write of this key), undo would re-write `{ key, value: undefined }` — acceptable for D-75 since undo of the first-ever `weekStart` change reverts to default-driven hydration.

---

### `js/state/apply.js` (modification — extend HANDLERS table)

**Existing pattern** (lines 40-57):
```javascript
import { newId } from '../util/id.js';
import {
  handleMarkCompleted,
  handleRestoreLogRow,
} from './apply/markCompleted.js';
import { notify } from './store.js';

const HANDLERS = {
  markCompleted: handleMarkCompleted,
  restoreLogRow: handleRestoreLogRow,
};
```

**P3 edit shape:**
```javascript
import { handleMarkUncompleted } from './apply/markUncompleted.js';
import { handleSetSetting } from './apply/setSetting.js';

const HANDLERS = {
  markCompleted: handleMarkCompleted,
  restoreLogRow: handleRestoreLogRow,
  markUncompleted: handleMarkUncompleted,
  setSetting: handleSetSetting,
};
```

No other change in `apply.js`. Discipline test `tests/unit/apply.discipline.test.js` (lines 105-115) verifies the `HANDLERS` literal and absence of `switch (` — extension keeps that invariant.

---

### `js/router.js` (controller, event-driven) — NEW seam

**Analog (partial):** `js/main.js` lines 53-67 (URL/event trigger that mounts a panel), `js/views/diagnostics.js` lines 26-28 (panelEl singleton-guard)

**Pattern to apply** (composed from main.js + diagnostics.js):
```javascript
/**
 * @file Hash router for #today / #settings / #history (D-60, D-80).
 * Module-load is pure; `mountRoutes({routes, onChange})` registers the
 * hashchange listener and dispatches the initial route. SW silent-fail
 * (PWA-04) means router still works on file://.
 */

const ROUTES = ['#today', '#settings', '#history'];

export function mountRoutes({ routes, onChange }) {
  function resolve() {
    const hash = location.hash || '#today';
    const target = routes[hash] ? hash : '#today';
    onChange(target);
  }
  window.addEventListener('hashchange', resolve);
  resolve(); // initial dispatch
}
```

Same defensive style as `js/platform/sync.js` (graceful-no-op when `BroadcastChannel` is missing) and `js/platform/lifecycle.js` (DI-friendly defaults for `globalThis.document`/`window`).

---

### `js/views/today.js` (view, mount + subscribe) — role-match analog

**Analog:** `js/views/diagnostics.js` (mount/idempotent guard) + `js/state/store.js` (subscribe shape)

**Mount + idempotent guard pattern** (`diagnostics.js` lines 26-28, 90-94):
```javascript
// Single-panel guard — a second mountDiagnostics() call while the panel is
// already mounted is a no-op.
let panelEl = null;

export function mountDiagnostics() {
  if (panelEl) return;
  panelEl = document.createElement('section');
  panelEl.className = 'panel diagnostics-panel';
  panelEl.setAttribute('aria-label', 'Diagnostics');
  // ...
}
```

**Subscribe + return unsubscribe pattern** (`store.js` lines 52-55):
```javascript
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
```

**P3 `mountToday` composes both:**
```javascript
export function mountToday(parent, { repo, store, vibrate = () => {} }) {
  if (mounted) return unmount;
  // ...render header, list, footer-nav via buildTodayHeader/buildTodayList/buildTodayRow + mount() helper
  const unsub = store.subscribe(rerender);
  return function unmount() {
    unsub();
    parent.innerHTML = ''; // FORBIDDEN per D-78 — instead loop removeChild or use mount() cleanup
  };
}
```

**Critical:** Builders return descriptions; `mount(desc, parent, {actions})` walks them and attaches `data-action` listeners. NO `.innerHTML`, NO `.insertAdjacentHTML` (D-78 grep test in `tests/unit/discipline.xss.test.js`).

---

### `js/views/settings.js` (view, mount + subscribe) — role-match analog

**Analog:** `js/views/diagnostics.js` (Reset-data handler shape — line 173-198):
```javascript
const resetDataBtn = document.createElement('button');
resetDataBtn.className = 'diagnostics-action';
resetDataBtn.textContent = 'Reset data';
resetDataBtn.addEventListener('click', async () => {
  // Verbatim D-06-style phrasing for the data-reset variant.
  const confirmed = confirm('Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.');
  if (!confirmed) return;
  try {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('habits');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  } catch (_e) { /* swallow */ }
  location.reload();
});
```

**P3 Settings Data-card Reset-data button:** copy the handler verbatim, swap the confirm string per **D-67** to:
```
'This will delete all your habits and history. Cannot be undone. Continue?'
```

**Storage card async-load pattern** (lifted from `diagnostics.js` lines 113-124):
```javascript
const cacheDd = appendRow(dl, 'Cache name', 'loading…');
if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
  caches.keys().then(keys => {
    const match = keys.find(k => /^habits-/.test(k));
    cacheDd.textContent = match || 'none';
  }).catch(() => { cacheDd.textContent = 'none'; });
}
```

Apply the same "loading… → fill" pattern to:
- `navigator.storage.persisted()` (Storage card status)
- `navigator.storage.estimate()` (Storage card "Using X MB of ~Y MB")
- `caches.keys()` (About card cache name — already in diagnostics)

---

### `js/domain/cadence.js` (utility, transform) — partial pure-module match

**Analog:** `js/util/date.js` (pure module shape + DST-aware via `parseLocalYMD`/`setDate`)

**File header + pure-function pattern** (`date.js` lines 1-24):
```javascript
/**
 * @file Local-time YYYY-MM-DD utilities (DATA-06, Anti-Pattern 3, Pitfall 4).
 *
 * NEVER use UTC-flavored Date APIs here — they silently corrupt late-night
 * check-ins... All arithmetic constructs via `new Date(y, m-1, d)` and steps
 * via `setDate(d.getDate() + n)` so DST + leap days are honored by the local
 * calendar.
 *
 * Forbidden constructs in this file: the ISO-string formatter on Date, the
 * UTC constructor, any universal-time accessor...
 */
```

**P3 `cadence.js` header rationale:** Pure module, NO IDB reads (D-49 / `<specifics>`: "The cadence module must NOT read from IDB"). Signature: `appliesToday(habit, date, ctx)` where `ctx = {weekStart, weekCompletions(habitId, weekStart, weekEnd)}`. Dispatch the four cadence types via a `RESOLVERS` table (Anti-Pattern 4 — no `switch (habit.cadence.type)`).

**Skeleton:**
```javascript
/**
 * @file Pure cadence resolver for the 4 cadence types in the seed (D-48).
 * D-49: weekly is log-aware via `ctx.weekCompletions`. D-50: every-n-days
 * anchors on `habit.lastCompletedDate` (the denormalized field, D-52).
 *
 * Forbidden constructs: any indexedDB.* / repo.* call — pure transform only.
 */
const RESOLVERS = {
  daily: (_h, _d, _ctx) => true,
  weekly: (h, d, ctx) => {
    const [start, end] = [isoWeekStart(d, ctx.weekStart), isoWeekEnd(d, ctx.weekStart)];
    return ctx.weekCompletions(h.id, start, end) === 0;
  },
  'every-n-days': (h, d, _ctx) => {
    const last = h.lastCompletedDate ?? h.createdAt;
    return daysBetween(last, d) >= h.cadence.n;
  },
  'day-of-week-subset': (h, d, _ctx) => {
    const dow = ['sun','mon','tue','wed','thu','fri','sat'][parseLocalYMD(d).getDay()];
    return h.cadence.days.includes(dow);
  },
};

export function appliesToday(habit, date, ctx) {
  const resolver = RESOLVERS[habit.cadence.type];
  if (!resolver) throw new Error(`cadence: unknown type ${habit.cadence.type}`);
  return resolver(habit, date, ctx);
}
```

---

### `js/domain/wave.js` (utility, batch load + lookup) — role-match

**Analog:** `js/io/seed.js` (boot-time fetch + diff + in-memory state)

**Fetch + validate pattern** (`seed.js` lines 116-134):
```javascript
let seed = null;
if (seededIds === undefined) {
  if (!fetchFn) {
    throw new Error('seed: no fetch available (configureSeed({fetch}) or globalThis.fetch)');
  }
  const res = await fetchFn('./seed/habits.json');
  seed = await res.json();
  if (
    !seed ||
    typeof seed !== 'object' ||
    !Array.isArray(seed.habits) ||
    seed.schemaVersion !== 1
  ) {
    throw new Error('seed: malformed');
  }
}
```

**P3 `wave.js` skeleton:**
```javascript
/**
 * @file In-memory wave catalog loaded from seed/waves.json (D-57). No IDB
 * persistence in P3 — P4 promotes to an IDB store when WAVE-06 lands.
 */
let _waves = []; // [{number, name, startDate, theme?}]

export async function bootWaves(fetchFn = globalThis.fetch) {
  const res = await fetchFn('./seed/waves.json');
  const data = await res.json();
  if (!data || !Array.isArray(data.waves) || data.schemaVersion !== 1) {
    throw new Error('wave: malformed');
  }
  _waves = data.waves;
}

export function currentWave(date) {
  // Highest wave whose startDate <= date.
  return _waves.filter(w => w.startDate <= date).sort((a, b) => b.number - a.number)[0] ?? null;
}

export function getWave(number) { return _waves.find(w => w.number === number) ?? null; }
export function getAllWaves() { return [..._waves]; }
```

---

### `js/util/mount.js` (utility, DOM construction) — extracts inline pattern

**Analog:** `js/views/diagnostics.js` `appendRow()` (lines 232-244) + the toast builder in `js/views/toast.js` lines 29-59

**Existing pattern** (`diagnostics.js` lines 236-244):
```javascript
function appendRow(dl, label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
  return dd;
}
```

**Toast XSS-safe construction** (`toast.js` lines 29-51):
```javascript
toastEl = document.createElement('div');
toastEl.className = 'toast';
toastEl.setAttribute('role', 'status');
toastEl.setAttribute('aria-live', 'polite');
const msg = document.createElement('span');
msg.className = 'toast-msg';
msg.textContent = 'New version ready';
```

**P3 `mount()` skeleton** (formalizes the discipline both above use inline):
```javascript
/**
 * @file Single trusted DOM-construction helper (D-77). The only place in
 * js/views/ allowed to translate {tag, attrs, children} descriptions into
 * real DOM. D-78 grep test forbids .innerHTML / .outerHTML /
 * .insertAdjacentHTML / document.write outside an empty allowlist.
 */
export function mount(desc, parent, actions = {}) {
  if (typeof desc === 'string') {
    parent.appendChild(document.createTextNode(desc));
    return;
  }
  const el = document.createElement(desc.tag);
  for (const [k, v] of Object.entries(desc.attrs ?? {})) {
    if (k === 'data-action') {
      const fn = actions[v];
      if (fn) el.addEventListener('click', fn);
      el.setAttribute(k, v);
    } else {
      el.setAttribute(k, String(v));
    }
  }
  if (desc.text !== undefined) el.textContent = String(desc.text);
  for (const c of desc.children ?? []) mount(c, el, actions);
  parent.appendChild(el);
  return el;
}
```

---

### `js/views/toast.js` (modification — extend with autoDismiss + error variant)

**Existing pattern** (lines 25-62):
```javascript
let toastEl = null;

export function showUpdateToast() {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  // ... message + Reload + close
  document.body.appendChild(toastEl);
}
```

**P3 extension shape:**
```javascript
let dismissTimer = null;

function _showToast({ message, actionLabel, actionFn, autoDismissMs, variant }) {
  if (toastEl) { toastEl.remove(); }  // D-70 — single toast, replace contents
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
  toastEl = document.createElement('div');
  toastEl.className = variant ? `toast toast--${variant}` : 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  // ... build msg + action + close using same textContent discipline
  if (autoDismissMs) {
    dismissTimer = setTimeout(() => { toastEl.remove(); toastEl = null; }, autoDismissMs);
    toastEl.addEventListener('pointerenter', () => clearTimeout(dismissTimer));
    toastEl.addEventListener('pointerleave', () => {
      dismissTimer = setTimeout(() => { toastEl.remove(); toastEl = null; }, autoDismissMs);
    });
  }
  document.body.appendChild(toastEl);
}

export function showUndoToast({ message, undoFn, autoDismissMs = 5000 }) {
  _showToast({ message, actionLabel: 'Undo', actionFn: undoFn, autoDismissMs });
}

export function showErrorToast(message) {
  _showToast({ message, autoDismissMs: 4000, variant: 'error' });
}

// LOCKED — D-08: no autoDismissMs for the update toast.
export function showUpdateToast() { /* unchanged */ }
```

**Critical:** `showUpdateToast()` semantics MUST stay as today (no-auto-dismiss per D-08). Tests for `showUpdateToast` must still pass after extension.

---

### `js/util/date.js` (modification — add 4 helpers)

**Existing pattern** (lines 26-73 — DST-safe via `setDate`):
```javascript
export function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function daysFrom(anchorYMD, n) {
  const d = parseLocalYMD(anchorYMD);
  d.setDate(d.getDate() + n);
  return formatLocalYMD(d);
}
```

**P3 additions (must follow same DST-safe `setDate` discipline):**
```javascript
/**
 * Return YYYY-MM-DD of the week-start day for the ISO week containing `ymd`.
 * @param {string} ymd YYYY-MM-DD
 * @param {'mon'|'sun'} weekStart
 * @returns {string}
 */
export function isoWeekStart(ymd, weekStart) {
  const d = parseLocalYMD(ymd);
  const dow = d.getDay(); // 0=Sun..6=Sat (local calendar)
  const back = weekStart === 'mon' ? (dow === 0 ? 6 : dow - 1) : dow;
  d.setDate(d.getDate() - back);
  return formatLocalYMD(d);
}

export function isoWeekEnd(ymd, weekStart) {
  return daysFrom(isoWeekStart(ymd, weekStart), 6);
}

export function daysBetween(aYMD, bYMD) {
  const a = parseLocalYMD(aYMD);
  const b = parseLocalYMD(bYMD);
  // Whole-day count — both are local midnight so the ms drift is at most
  // 1 hour around DST, hence Math.round (NOT Math.floor).
  return Math.round((b - a) / 86400000);
}

export function formatRelative(atISO, nowMs = Date.now()) {
  const ms = nowMs - new Date(atISO).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} minutes ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} hours ago`;
  return `${Math.floor(ms / 86_400_000)} days ago`;
}
```

---

### `seed/waves.json` (config) — role-match

**Analog:** `seed/habits.json` (wrapped-object shape with `schemaVersion`/`seedVersion`)

**Existing shape:**
```json
{
  "schemaVersion": 1,
  "seedVersion": 1,
  "habits": [ { "id": "...", "name": "Morning walk", "name_pl": "Spacer rano", "wave": 1, ... } ]
}
```

**P3 `seed/waves.json` shape:**
```json
{
  "schemaVersion": 1,
  "seedVersion": 1,
  "waves": [
    { "number": 0, "name": "Wave 0", "startDate": "2025-12-29", "theme": "pre-start" },
    { "number": 1, "name": "Wave 1", "startDate": "2026-01-05", "theme": "Energy & regulation foundations" },
    { "number": 2, "name": "Wave 2", "startDate": "2026-01-12", "theme": "Daily rhythm & eating" },
    { "number": 3, "name": "Wave 3", "startDate": "2026-01-19", "theme": "Movement & body" },
    { "number": 4, "name": "Wave 4", "startDate": "2026-01-26", "theme": "Relationships & emotions" },
    { "number": 5, "name": "Wave 5", "startDate": "2026-02-02" },
    { "number": 6, "name": "Wave 6", "startDate": "2026-02-09" },
    { "number": 7, "name": "Wave 7", "startDate": "2026-02-16" },
    { "number": 8, "name": "Wave 8", "startDate": "2026-02-23" },
    { "number": 9, "name": "Wave 9", "startDate": "2026-03-02" }
  ]
}
```

Note: planner picks exact startDates per `<specifics>` line 201; the example above honors the constraint that `currentWave('2026-05-28')` returns wave 9 — adjust if PROJECT.md context "Wave 4 is current" must hold (planner reads `Nawyki-fale.txt`).

---

### `css/settings.css` (config) — exact

**Analog:** `css/today.css`

**Existing pattern** (`today.css` lines 15-58):
```css
@layer view {
  .today-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }
  .today-list { /* ... */ }
  .today-footer-nav { position: sticky; bottom: 0; /* ... */ }
}
```

**P3 `css/settings.css` skeleton:**
```css
/* css/settings.css — Settings panel flat-card layout (D-61).
 * Five cards top-down: Storage → Schedule → Install → Data → About.
 * No collapsible/sub-tabs in v1. */
@layer view {
  .settings-panel { padding: var(--space-4); }
  .settings-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .settings-card--destructive { /* red affordance for Reset data */ }
  /* Reuse .panel + .toast existing primitives from components.css */
}
```

Hooked into `css/main.css` with a single new line:
```css
@import url("./settings.css") layer(view);
```

---

## Shared Patterns

### Pattern S1 — JSDoc file headers (D-27)

**Source:** every file in `js/` opens with `/** @file <summary>. <rationale + D-XX cross-refs> */`

**Example** (`js/state/apply/markCompleted.js` lines 1-31):
```javascript
/**
 * @file Per-event handlers for `markCompleted` and its inverse `restoreLogRow`
 * (D-34 — the one round-trip event P2 ships; D-43 — undo seam via prior-row capture).
 *
 * Each handler returns the canonical handler-contract shape:
 *   `{ storeNames, writes, inverse }`
 *
 * Forbidden constructs in this file:
 *   - Direct calls to `js/db/repo.js` write helpers...
 */
```

**Apply to:** every new `.js` file in P3. The "Forbidden constructs" footer is load-bearing — it makes the intent of grep-discipline tests legible.

---

### Pattern S2 — XSS-safe DOM construction

**Source:** `js/views/toast.js` lines 29-59 + `js/views/diagnostics.js` lines 232-244

**Apply to:** every new mounter in `js/views/`. Enforced by:
- `js/util/mount.js` (D-77 — the canonical helper)
- `tests/unit/discipline.xss.test.js` (D-78 — grep gate)

**Code excerpt** (toast.js 36-38):
```javascript
const msg = document.createElement('span');
msg.className = 'toast-msg';
msg.textContent = 'New version ready';  // NEVER .innerHTML
```

---

### Pattern S3 — Configure-based DI (RESEARCH §Open Question 2)

**Source:** `js/state/apply.js` lines 77-81 + `js/state/undo.js` lines 59-62 + `js/io/seed.js` lines 84-88

**Pattern:**
```javascript
let _repo = null;
let _broadcast = () => {};

export function configure(deps) {
  if (deps.repo) _repo = deps.repo;
  if (deps.broadcast) _broadcast = deps.broadcast;
}
```

**Apply to:** any P3 module that needs the repo or platform-API handles. Truthy fields overwrite the module-level mutable; test injects fakes; production calls once at boot in `js/main.js` (lines 73-77).

For P3 specifically: `js/views/today.js` and `js/views/settings.js` receive `{repo, store}` via the `mount<X>(parent, deps)` argument (NOT via module-level `configure`), since views can be mounted/unmounted multiple times. Domain modules (`cadence.js`, `wave.js`) take `ctx` as a function argument — purely functional, no `configure`.

---

### Pattern S4 — Idempotent re-entry guard

**Source:** `js/views/diagnostics.js` line 28 + `js/views/toast.js` line 18 + `js/state/store.js` line 30 + `js/platform/sync.js` line 43

**Pattern:**
```javascript
let panelEl = null;
export function mountX() {
  if (panelEl) return;
  // ...
}
```

**Apply to:** `mountToday`, `mountSettings`, `mountRoutes`, `bootWaves`. Second call must be a no-op or replace cleanly.

---

### Pattern S5 — Async-load placeholder pattern

**Source:** `js/views/diagnostics.js` lines 113-124

**Code excerpt:**
```javascript
const cacheDd = appendRow(dl, 'Cache name', 'loading…');
if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
  caches.keys().then(keys => {
    const match = keys.find(k => /^habits-/.test(k));
    cacheDd.textContent = match || 'none';
  }).catch(() => { cacheDd.textContent = 'none'; });
}
```

**Apply to:** all 3 D-62 async-loaded Storage card values (`persisted()`, `estimate()`, `caches.keys()`). Also About card cache + SW state.

---

### Pattern S6 — Grep-based discipline tests

**Source:** `tests/unit/apply.discipline.test.js` lines 21-67 (stripper + walker)

**Code excerpt:**
```javascript
function readStripped(path) {
  const src = readFileSync(path, 'utf8');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block + JSDoc comments
    .replace(/^\s*\/\/.*$/gm, '');         // line comments
}

function jsFilesIn(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsFilesIn(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}
```

**Apply to:** `tests/unit/discipline.xss.test.js` (D-78). Forbidden tokens: `.innerHTML`, `.outerHTML`, `.insertAdjacentHTML`, `document.write`. Allowlist: empty for `js/` scope; `tests/` excluded.

**Skeleton:**
```javascript
describe('discipline: XSS-safe DOM construction (D-78)', () => {
  test('no .innerHTML / .outerHTML / .insertAdjacentHTML / document.write in js/', () => {
    const forbidden = /\.(innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/;
    const targets = jsFilesIn(join(ROOT, 'js'));
    const violations = [];
    for (const path of targets) {
      const m = readStripped(path).match(forbidden);
      if (m) violations.push(`${path}: matched ${m[0]}`);
    }
    assert.deepEqual(violations, [], `D-78 violations:\n${violations.join('\n')}`);
  });
});
```

---

### Pattern S7 — Fresh-import cache-bust in integration tests

**Source:** `tests/integration/apply.markCompleted.test.js` lines 22-27 + `tests/integration/undo.persist-reload.test.js` lines 30-50

**Code excerpt:**
```javascript
async function freshApply() {
  const url = new URL('../../js/state/apply.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}
```

**Apply to:** `tests/integration/today.test.js` — fresh import of `js/views/today.js`, `js/state/apply.js`, `js/state/store.js`, AND `js/state/undo.js` with the **same** query tag (so they share module instances). Use the `freshApplyAndUndo()` paired-cache-bust trick from `undo.persist-reload.test.js` lines 31-50.

---

### Pattern S8 — Pure-function fixture-driven tests (D-26 Tier 1)

**Source:** `tests/unit/date.test.js` lines 22-92 (DST + leap-day concrete fixtures)

**Code excerpt:**
```javascript
describe('daysFrom — DST spring-forward (Europe/Warsaw 2026-03-29)', () => {
  test('2026-03-28 + 1 day === 2026-03-29 (DST jump does not skip a day)', () => {
    assert.equal(daysFrom('2026-03-28', 1), '2026-03-29');
  });
  // ...
});
```

**Apply to:** `tests/unit/cadence.test.js` MUST hit:
- 2026-03-29 spring-forward
- 2026-10-25 fall-back
- 2028-02-29 leap day
- Mon-vs-Sun weekStart boundary cases
- Every-N-days with `lastCompletedDate = null` (fallback to `createdAt`)
- Weekly habit hidden after one completion in the same week
- Day-of-week-subset on a Tuesday for a Mon/Wed/Fri habit

`tests/unit/builders.test.js` MUST cover (per D-79):
- `buildTodayRow` emits `<button aria-pressed="...">`
- `buildTodayRow` carries `data-action="markComplete"` / `"markUncomplete"`
- ⓘ button emits `aria-label="Show original Polish name"` + `aria-expanded`
- Footer-nav emits `aria-current="page"` on the active tab
- History tab emits `aria-disabled="true" tabindex="-1"`
- Settings cards each carry an `<h2>` for focus-on-route-change (D-79 bullet 7)

---

### Pattern S9 — Discipline test for handler contract

**Source:** `tests/unit/apply.discipline.test.js` lines 105-115

**Code excerpt:**
```javascript
describe('discipline: apply.js dispatches via HANDLERS (Anti-Pattern 4)', () => {
  test('contains literal `HANDLERS` and contains NO `switch (` statement', () => {
    const src = readStripped(join(ROOT, 'js/state/apply.js'));
    assert.ok(src.includes('HANDLERS'), '`HANDLERS` table must be present');
    assert.equal(src.match(/\bswitch\s*\(/), null, '`switch (` is forbidden in apply.js (Anti-Pattern 4)');
  });
});
```

**Existing invariant for P3:** discipline already covers `apply.js`. P3's `js/domain/cadence.js` should be added to the "no `switch (cadenceType)`" coverage (Anti-Pattern 4 generalizes: any dispatch must be table-driven, not switch-driven).

---

## No Analog Found

| File | Role | Data Flow | Reason | Planner Guidance |
|------|------|-----------|--------|------------------|
| `js/router.js` | controller | event-driven (hashchange) | No router exists yet; the closest analog is the `?debug=1` trigger in `js/main.js` lines 58-59 and the `<a aria-current="page">` ARIA pattern (only MDN reference, no codebase usage yet) | Use **MDN hashchange** reference (canonical_refs line 141); ARIA pattern from canonical_refs line 143. Implementation is small (~30 lines) — see Pattern Assignment skeleton above. Compose `mountRoutes({routes, onChange})` + initial dispatch from `location.hash`. |
| `tests/integration/today.test.js` mount-pattern | test (fake-IDB-backed view mount) | n/a | No existing integration test mounts a `js/views/*` module; all prior integration tests target `apply`/`undo`/`seed`/`repo` directly | Pattern S7 (fresh-import) + Pattern S3 (configure DI with fakeRepo) + a minimal `createFakeDocument()` from `tests/helpers/fake-document.js` (already exists per `Bash` listing — used by `tests/unit/lifecycle.test.js`). Mount the view onto `fakeDoc.document.body`, then assert via the same `_listenerCount` / `_stores` introspection used in lifecycle/apply tests. |

---

## Metadata

**Analog search scope:** `js/`, `css/`, `tests/`, `seed/`, `index.html`, `sw.js`
**Files scanned:** 27 source files + 8 test files
**Pattern extraction date:** 2026-05-28
**Strongest match cluster:** P3's new state-handlers (`markUncompleted.js`, `setSetting.js`) are direct siblings of P2's `markCompleted.js` — copy verbatim, adjust payload shape. This is the lowest-risk slice of P3.
**Weakest match cluster:** `js/router.js` is genuinely new (no codebase analog). Planner falls back to MDN + Pattern S4 (idempotent guard) + Pattern S3 (DI-free, pure module-load). ~30 lines total.
