/**
 * @file Single-mutator chokepoint for all data writes (DATA-04, ARCHITECTURE §2).
 *
 * Every mutation to `habits`, `logs`, `events`, `meta`, `settings`, etc. flows
 * through `apply(event)` in this file. Views, IO modules, and even `undo.js`
 * dispatch back through here so the four chokepoint invariants are held
 * uniformly:
 *
 *   1. **Single tx per event** — the data writes + the `events` row +
 *      `meta.undoToken` all commit atomically (D-43, Pitfall 7, T-02-12).
 *   2. **Broadcast AFTER tx commit** — `await runTx(...)` THEN `broadcast(...)`.
 *      Reversing the order lets peer tabs read stale state (Pitfall 2, T-02-10).
 *   3. **Keys, not values, on the wire** — `broadcastKeys(event)` returns
 *      ID-only payloads; receivers re-read from IDB (Pitfall 8, T-02-11).
 *   4. **No god switch** — events are dispatched via a `HANDLERS` table that
 *      P3+ extends by adding files in `js/state/apply/` (Anti-Pattern 4).
 *
 * Configure-based DI (RESEARCH §Open Question 2):
 *   - Production boot calls `configure({ repo, broadcast, trackTx })` once.
 *   - Tests call it per-test with fakes.
 *   - This keeps production code DI-free while preserving Node-testability
 *     (no static `import` of repo.js or sync.js — both are platform-API
 *     leaning and the test stubs in via globals/configure).
 *
 * Handler contract (per-event modules in `js/state/apply/`):
 *   - `handle<Event>(event, repo) -> { storeNames, writes, inverse }`
 *   - `handle<Event>.broadcastKeys(event) -> { habitId, date, ... }`
 *
 *   `writes` items are either `{ store, value }` (put) or
 *   `{ op: 'delete', store, key }` (delete).
 *
 * Forbidden constructs in this file:
 *   - `switch (` statement (Anti-Pattern 4 — events dispatch via HANDLERS table).
 *   - Direct calls to `js/db/repo.js` write helpers (DATA-04 — this IS the
 *     write path; repo is reached only via the injected `_repo` handle).
 *   - Static `import` of `js/db/repo.js` or `js/platform/sync.js` (DI keeps
 *     production code testable in Node per Pitfall 9).
 */

import { newId } from '../util/id.js';
import {
  handleMarkCompleted,
  handleRestoreLogRow,
} from './apply/markCompleted.js';
import { handleMarkUncompleted } from './apply/markUncompleted.js';
import { handleSetSetting } from './apply/setSetting.js';
import { notify as defaultNotify } from './store.js';

/**
 * Event-type dispatch table. P3+ events plug in by adding a file in
 * `js/state/apply/` and registering the named handler here. Anti-Pattern 4
 * forbids a `switch (event.type)` statement.
 *
 * @type {Record<string, (event: object, repo: object) => Promise<object>>}
 */
const HANDLERS = {
  markCompleted: handleMarkCompleted,
  restoreLogRow: handleRestoreLogRow,
  markUncompleted: handleMarkUncompleted,
  setSetting: handleSetSetting,
};

/** @type {object|null} */
let _repo = null;

/** @type {(msg: object) => void} */
let _broadcast = () => {};

/** @type {(p: Promise<unknown>) => void} */
let _trackTx = () => {};

/**
 * Notify handle — defaults to the statically-imported `store.notify` so
 * production needs no DI seam beyond `configure({repo, broadcast, trackTx})`.
 * Tests that cache-bust both `apply.js` and `store.js` separately MUST inject
 * the cache-busted `notify` here so apply.js's subscriber fan-out targets
 * the SAME store instance the test inspects (otherwise Node ESM resolves
 * apply.js's static `./store.js` import to the un-tagged store, splitting
 * the cache + subscriber set across two module instances — Pitfall 9
 * variant).
 *
 * @type {(payload: { event?: string, keys?: object }) => Promise<void> | void}
 */
let _notify = defaultNotify;

/**
 * Inject dependencies. Truthy fields overwrite the module-level mutables; this
 * lets a test re-configure only the broadcast spy without re-injecting the
 * repo. Production calls this once at boot (plan 02-05) with the real repo +
 * the real broadcast + the real trackTx.
 *
 * @param {{ repo?: object, broadcast?: (msg: object) => void, trackTx?: (p: Promise<unknown>) => void, notify?: (payload: { event?: string, keys?: object }) => Promise<void>|void }} deps
 * @returns {void}
 */
export function configure(deps) {
  if (deps.repo) _repo = deps.repo;
  if (deps.broadcast) _broadcast = deps.broadcast;
  if (deps.trackTx) _trackTx = deps.trackTx;
  if (deps.notify) _notify = deps.notify;
}

/**
 * The single mutator. Dispatches `event` through `HANDLERS[event.type]`,
 * executes the resulting writes + events row + meta.undoToken in a single
 * tx, then broadcasts the post-commit envelope and notifies in-process
 * subscribers.
 *
 * @param {{ type: string, payload: object }} event
 * @returns {Promise<string>} The new event row's UUID id.
 */
export async function apply(event) {
  if (!_repo) {
    throw new Error('apply: configure({ repo }) must be called before apply()');
  }
  const handler = HANDLERS[event.type];
  if (!handler) {
    throw new Error(`apply: unknown event type: ${event.type}`);
  }

  const { writes, inverse, storeNames } = await handler(event, _repo);

  /** @type {{ id: string, at: string, type: string, payload: object, inverse: object }} */
  const eventRow = {
    id: newId(),
    // events.at uses ISO timestamp — allowed by DATA-06 (only date KEYS like
    // logs.date must use YYYY-MM-DD; events are timestamps, not dates).
    at: new Date().toISOString(),
    type: event.type,
    payload: event.payload,
    inverse,
  };

  const txPromise = _repo.runTx(
    [...storeNames, 'events', 'meta'],
    'readwrite',
    async (tx) => {
      for (const w of writes) {
        if (w.op === 'delete') {
          tx.objectStore(w.store).delete(w.key);
        } else {
          tx.objectStore(w.store).put(w.value);
        }
      }
      tx.objectStore('events').put(eventRow);
      tx.objectStore('meta').put({ key: 'undoToken', value: eventRow.id });
    },
  );

  // Track for lifecycle flush BEFORE we await — the flush handler observes the
  // in-flight chain. We still await locally so the broadcast fires only after
  // the tx is observably committed.
  _trackTx(txPromise);
  await txPromise;

  // CRITICAL ORDER (Pitfall 2, T-02-10): broadcast ONLY after the tx
  // resolves. Payload is keys-only (Pitfall 8, T-02-11) — `origin` is
  // appended by `sync.broadcast` itself.
  const keys = handler.broadcastKeys(event);
  _broadcast({
    type: 'mutation',
    event: event.type,
    keys,
    at: eventRow.at,
  });
  // P3 plan 03 Task 2: notify is now async — it refreshes `store.cache`
  // BEFORE fanning out to subscribers (Pitfall 2, D-72). We await so the
  // caller of `apply()` observes a cache that's already reconciled with
  // the canonical post-tx state. Uses the DI-injected `_notify` so tests
  // that cache-bust apply.js + store.js separately can route through the
  // store instance they actually inspect.
  await _notify({ event: event.type, keys });

  return eventRow.id;
}
