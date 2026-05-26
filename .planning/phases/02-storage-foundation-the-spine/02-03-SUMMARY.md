---
phase: 02-storage-foundation-the-spine
plan: 03
subsystem: state
tags: [state, mutator, chokepoint, undo, broadcast, lifecycle, tdd, data-04, data-07, data-08, d-30, d-34, d-43, undo-02]

# Dependency graph
requires:
  - phase: 02-storage-foundation-the-spine
    plan: 02
    provides: "js/db/repo.js typed facade (DATA-01), fake-IDB A7 tx-shape, js/util/id.js (D-42), js/util/date.js (DATA-06)"
provides:
  - "js/state/apply.js — THE single-mutator chokepoint (DATA-04). Every write to logs/events/meta/etc. flows here. HANDLERS dispatch table (no switch — Anti-Pattern 4). configure({repo, broadcast, trackTx}) DI per RESEARCH Open Question 2."
  - "js/state/apply/markCompleted.js — handler-contract {storeNames, writes, inverse} + broadcastKeys static method. Pattern locked: P3+ events plug in by adding a file + registering in HANDLERS map (no apply.js edits needed)."
  - "js/state/undo.js — persistent single-step undo via meta.undoToken (D-43, UNDO-02). Re-enters apply() so the inverse ALSO updates undoToken + broadcasts + flushes."
  - "js/platform/sync.js — BroadcastChannel('habits') wrapper (D-30). Keys-only payload (Pitfall 8). Origin filter drops own messages (ARCHITECTURE §6). Graceful degrade when BC unavailable."
  - "js/platform/lifecycle.js — visibilitychange + pagehide flush. NEVER beforeunload (DATA-08, Pitfall 8, MDN). DI-friendly (doc, win args) per Pitfall 9."
  - "js/state/store.js — minimal in-memory cache + subscribe/notify (Open Question 4 — P3+ expands)."
  - "tests/unit/apply.discipline.test.js — grep-based discipline gate (T-02-13, T-02-14). Three invariants: no put* outside apply*, no beforeunload, no switch in apply.js."
  - "tests/unit/lifecycle.test.js, tests/integration/sync.broadcast.test.js, tests/integration/apply.markCompleted.test.js, tests/integration/undo.persist-reload.test.js — full coverage of T-02-10, T-02-11, T-02-12, T-02-13, T-02-14."
affects: [02-04, 02-05, 02-06, all later phases that mutate IDB through apply()]

# Tech tracking
tech-stack:
  added:
    - "Configure-based DI pattern for testability (RESEARCH §Open Question 2)"
    - "ES module cache-busting via query-string for per-test fresh module instances"
    - "Handler-contract {storeNames, writes, inverse} + broadcastKeys for per-event modules"
  patterns:
    - "Single-mutator chokepoint with HANDLERS dispatch table (Anti-Pattern 4)"
    - "Broadcast AFTER tx commit; keys NOT values (Pitfall 2 + 8)"
    - "Persistent undo via meta.undoToken in same tx (D-43, Pitfall 7)"
    - "Origin-filtered same-channel BroadcastChannel (ARCHITECTURE §6, T-02-15 accept)"
    - "Idempotent re-entry guard (singleton) — bootSync, bootLifecycle, hydrate"
    - "Test-helper DI: cache-busted module imports + matching `apply` injected via configureUndo to keep import graph coherent"

key-files:
  created:
    - "js/state/store.js"
    - "js/state/apply.js"
    - "js/state/apply/markCompleted.js"
    - "js/state/undo.js"
    - "js/platform/sync.js"
    - "js/platform/lifecycle.js"
    - "tests/unit/apply.discipline.test.js"
    - "tests/unit/lifecycle.test.js"
    - "tests/integration/apply.markCompleted.test.js"
    - "tests/integration/undo.persist-reload.test.js"
    - "tests/integration/sync.broadcast.test.js"
  modified: []

key-decisions:
  - "configureUndo accepts an optional `apply` parameter for tests (D-1, Plan 03). The cache-bust pattern used in undo.persist-reload.test.js forks the ES module graph: cache-busted undo.js statically imports a fresh apply.js (different from the one the test configured). Passing `apply: applyMod.apply` through configureUndo restores the binding without changing production semantics (production omits the field; the static-import default applies). Symmetric with the existing apply.configure() DI per RESEARCH §Open Question 2."
  - "store.js exports `_cache()` for diagnostics/test access (not in must_haves but useful — kept underscore-prefixed to signal it's not part of the public surface)."
  - "apply.js does NOT statically import `js/platform/sync.js` or `js/db/repo.js` — both flow through configure() per RESEARCH §Open Question 2. This keeps the module Node-importable for the discipline test (which reads apply.js as a file via fs.readFileSync) and avoids hard dependencies that would break the cache-bust pattern in apply.markCompleted.test.js."
  - "trackTx is called BEFORE the local `await` so the lifecycle flush handler observes the in-flight chain even if the awaiting caller (apply()) hasn't yet yielded. Per RESEARCH §Pattern 6: `inFlightTxPromise = inFlightTxPromise.then(() => promise.catch(() => {}))` — rejected tx swallowed so a single bad tx doesn't poison subsequent flushes."

patterns-established:
  - "Per-event handlers return {storeNames, writes, inverse} with optional `{op: 'delete', store, key}` write shape — apply.js loops through writes dispatching put vs delete based on `w.op`. P3+ events follow the same contract."
  - "Test files dynamically import modules with `?t=<rand>` query strings to bypass Node ESM cache. When a cache-busted module must compose with another (undo→apply), inject the companion module's exports via configure (not via fresh static imports — those would fork the graph)."
  - "Discipline tests strip JSDoc + line comments before grepping for forbidden tokens. This lets file headers EXPLAIN the negative space (e.g. 'this file must NOT contain beforeunload') while the actual code passes the grep check."

requirements-completed: [DATA-04, DATA-07, DATA-08]

# Metrics
duration: ~10m
completed: 2026-05-26
---

# Phase 2 Plan 03: State Spine (apply.js + undo.js + sync.js + lifecycle.js + store.js) Summary

**The single-mutator chokepoint, persistent undo via meta.undoToken, cross-tab broadcast with keys-only payloads, and visibilitychange-only lifecycle flush — all under TDD RED→GREEN discipline. Structural invariants (no god switch, no beforeunload, no direct repo writes outside apply.js) enforced by the discipline grep test.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 5 (4 TDD RED→GREEN behavior-adding + 1 full-suite verification)
- **Files created:** 11 (6 production modules + 5 test files)
- **Files modified:** 0 (after RED→GREEN sequence for undo)

## Accomplishments

- **`js/state/apply.js`** — single-mutator chokepoint per DATA-04. HANDLERS table dispatches to per-event modules (no switch statement per Anti-Pattern 4). Single tx writes data + events row + meta.undoToken (D-43, Pitfall 7). Broadcasts AFTER `await runTx(...)` (Pitfall 2, T-02-10). Payload allowlist `{type, event, keys, at}` (Pitfall 8, T-02-11). Configure-based DI: `configure({repo, broadcast, trackTx})` per RESEARCH §Open Question 2.
- **`js/state/apply/markCompleted.js`** — handler-contract `{storeNames, writes, inverse}` + `broadcastKeys` static method. Ships TWO handlers: `handleMarkCompleted` (D-34) and `handleRestoreLogRow` (its inverse). Inverse uses `{op: 'delete', store, key}` writes when prior is null/undefined; otherwise puts prior verbatim. DATA-05 honored (`definitionVersion: null` = "current" on every new log).
- **`js/state/undo.js`** — persistent single-step undo via `meta.undoToken` (D-43, UNDO-02). Re-enters `apply()` so the inverse ALSO updates undoToken + broadcasts + flushes. Graceful null on no token / missing event / event lacks inverse. configureUndo({repo, apply?}) DI.
- **`js/platform/sync.js`** — BroadcastChannel('habits') wrapper (D-30). ORIGIN per-module-load. bootSync() idempotent + graceful degrade. broadcast() appends {origin}; payload allowlist `{type, event, keys, at, origin}`. onMessage(fn) returns unsubscribe. Origin filter drops own writes (ARCHITECTURE §6).
- **`js/platform/lifecycle.js`** — visibilitychange + pagehide listeners. NEVER beforeunload (DATA-08, Pitfall 8). DI-friendly (doc, win args default to globals). Idempotent singleton-guard. trackTx + _flush chain for in-flight tx await.
- **`js/state/store.js`** — minimal P2 surface: hydrate(repo) idempotent, subscribe(fn) returns unsubscribe, notify(slice) fans out. P3+ expands cache shape per ARCHITECTURE §2 once views read it.
- **`tests/unit/apply.discipline.test.js`** — 3 grep invariants enforced: (1) no put* repo helpers outside `apply*.js` (T-02-14), (2) zero `beforeunload` matches in lifecycle.js code (T-02-13), (3) apply.js contains `HANDLERS` and no `switch (` (Anti-Pattern 4). Strips JSDoc + line comments before matching.
- **`tests/unit/lifecycle.test.js`** — 5 assertions: visibilitychange registration, pagehide registration, zero beforeunload, trackTx + _flush ordering, idempotency.
- **`tests/integration/sync.broadcast.test.js`** — 6 assertions: BC fake mirrors W3C (own-skip), payload allowlist, origin filter (own + peer cases), graceful degrade when BC undefined, bootSync idempotency.
- **`tests/integration/apply.markCompleted.test.js`** — 10 assertions: happy-path single tx, broadcast ordering + shape, restoreLogRow with prior=undefined (delete) + with prior=row (put back), unknown event throws, trackTx invoked, store hydrate/subscribe/notify minimal surface.
- **`tests/integration/undo.persist-reload.test.js`** — 7 assertions: round-trip undo, simulated reload (UNDO-02 + A9), 4 null-path cases, configureUndo contract.

## Task Commits

1. **Task 1a (RED):** failing lifecycle test — `b13c093` (test)
1. **Task 1b (GREEN):** js/platform/lifecycle.js — `d2a7a7c` (feat)
2. **Task 2a (RED):** failing sync.broadcast tests — `8106a95` (test)
2. **Task 2b (GREEN):** js/platform/sync.js — `cf7ee58` (feat)
3. **Task 3a (RED):** failing apply.discipline + apply.markCompleted tests — `356a6b4` (test)
3. **Task 3b (GREEN):** state spine (store.js + apply.js + apply/markCompleted.js) — `5bd8f6d` (feat)
4. **Task 4a (RED):** failing undo.persist-reload tests — `a1a1540` (test)
4. **Task 4b (GREEN):** js/state/undo.js (+ test DI fix for cache-bust apply binding) — `9242dc2` (feat)
5. **Task 5:** full-suite verification (79 tests across 12 files, 0 fail) — no commit (verification-only)

## Files Created/Modified

### Created

- `js/state/store.js` — minimal in-memory cache + subscribe/notify (Open Question 4).
- `js/state/apply.js` — single-mutator chokepoint (DATA-04, Anti-Pattern 1+4).
- `js/state/apply/markCompleted.js` — markCompleted + restoreLogRow handlers (D-34, D-43, DATA-05).
- `js/state/undo.js` — persistent single-step undo (D-43, UNDO-02).
- `js/platform/sync.js` — BroadcastChannel('habits') wrapper (DATA-07, D-30, Pitfall 8).
- `js/platform/lifecycle.js` — visibilitychange + pagehide flush (DATA-08, Pitfall 8).
- `tests/unit/apply.discipline.test.js` — grep invariants (T-02-13, T-02-14).
- `tests/unit/lifecycle.test.js` — listener registration + flush ordering + idempotency.
- `tests/integration/sync.broadcast.test.js` — BC semantics + payload allowlist + origin filter.
- `tests/integration/apply.markCompleted.test.js` — apply round-trip + broadcast ordering + inverse.
- `tests/integration/undo.persist-reload.test.js` — round-trip + simulated reload + null paths.

### Modified

None.

## Decisions Made

1. **configureUndo accepts an optional `apply` parameter (test-only DI).** The simulated-reload integration test cache-busts both `apply.js` and `undo.js` via `?t=<rand>` query strings to start each module with fresh state. But undo.js statically imports `./apply.js` — that resolves to a NEW fresh apply (no query) when undo.js is cache-busted. Without DI, undo's static-imported apply would be unconfigured at the time `undo()` calls `_apply(...)`. Fix: `configureUndo({ repo, apply })` accepts the cache-busted apply instance the test wired and stores it as `_apply`. Production code omits the field; the static-import default applies. Symmetric with `apply.configure()` per RESEARCH §Open Question 2; zero impact on the production boot path.

2. **`writes` items support BOTH put and delete operations.** Per the handler-contract spec the inverse of "create a new log row" must be "delete that row" (when no prior row existed). Original RESEARCH sketch only described `{store, value}` (put). Plan 03's behavior contract for `restoreLogRow` requires delete semantics. Resolved by extending the writes array shape to support `{op: 'delete', store, key}` items; apply.js dispatches put vs delete based on `w.op`. The fake-IDB tx-shape from plan 01 Task 2 already exposed `tx.objectStore(name).delete(key)` (A7 contract), so no fake-IDB modifications needed (plan's explicit "do NOT touch fake-IDB" constraint honored).

3. **Discipline test reads files via `fs.readFileSync` rather than importing them.** This sidesteps the module-load surface (some target files like `js/io/seed.js` don't exist yet — the test gracefully skips them via `existsSync`) AND allows comment-stripping before grep (so JSDoc can document forbidden tokens explicitly without false-positive matches).

4. **trackTx is invoked BEFORE `await txPromise` in apply.js.** The lifecycle flush handler observes `inFlightTxPromise`; if we awaited the tx first and only THEN called trackTx, a `visibilitychange === 'hidden'` event fired during the tx would see an empty flush chain. Inverting the order ensures the flush handler always sees the in-flight tx.

5. **store.js exports `_cache()` as a diagnostic handle.** Not in must_haves but useful for test introspection and the P3+ views. Underscore-prefixed to signal "not part of the public surface" (the diagnostics convention from `js/views/diagnostics.js`).

## Deviations from Plan

None substantive — plan executed in RED→GREEN sequence as specified. Two minor mid-task adjustments handled inline:

**1. [Rule 3 — Blocking] configureUndo needed optional `apply` DI for the cache-bust test pattern**

- **Found during:** Task 4 GREEN run (undo round-trip test failed with "apply: configure({repo}) not called").
- **Issue:** undo.js statically imports `./apply.js`, but the test cache-busts both modules via `?t=<rand>` so a freshly imported undo.js sees a freshly imported apply.js (different instance) — different from the test-configured apply instance.
- **Fix:** Added optional `apply` field to `configureUndo({ repo, apply? })`. Production code does not need this (omits the field; static-import default applies). Symmetric with the existing `apply.configure()` DI pattern.
- **Files modified:** `js/state/undo.js` + `tests/integration/undo.persist-reload.test.js` (passes `applyMod.apply` through for the 2 round-trip tests; the 4 null-path tests omit it).
- **Verification:** 7/7 undo tests pass; the round-trip and simulated-reload both confirm UNDO-02 + A9.
- **Committed in:** `9242dc2` (Task 4 GREEN commit, alongside undo.js).

No architectural changes, no scope creep. The DI change is structurally aligned with the locked Open Question 2 resolution.

## Issues Encountered

- **Node 24 `node --test tests/` directory-arg semantics.** Same issue as plans 01 and 02 (already documented). Local verification uses `node --test` (auto-discover from cwd) which works on Node 20, 22, 24 alike. CI uses Node 20 where `node --test tests/` is valid.
- **ES module cache-bust forking the import graph (resolved via configureUndo DI).** When a test cache-busts a module via `?t=<rand>`, any static imports inside that module re-resolve relative to the new URL — but without the query string, so they hit Node's normal cache. For a single module this is fine. For a module pair (undo→apply) the pair forks. Resolved by passing the test's apply instance through configureUndo.

## User Setup Required

None.

## Threat Surface Scan

No new threat surfaces introduced beyond what the plan's threat model already anticipated. All STRIDE entries (T-02-10 through T-02-15) covered:

- **T-02-10 (out-of-order broadcast):** mitigated by `await runTx(...)` then broadcast; integration test asserts via `logsSizeAtBroadcast` spy.
- **T-02-11 (broadcast leaks values):** mitigated by payload allowlist `{type, event, keys, at}`; integration test asserts `'value' in msg === false`, `'row' in msg === false`, `'completed' in msg === false`.
- **T-02-12 (undo token desync):** mitigated by writing `meta.undoToken = eventRow.id` in the SAME runTx body as the data writes; integration test asserts `meta.undoToken === eventId`.
- **T-02-13 (beforeunload):** mitigated by grep gate in `apply.discipline.test.js`; manually verified zero matches in `js/platform/lifecycle.js` code (post-comment-strip).
- **T-02-14 (views bypass apply.js):** mitigated by grep gate in `apply.discipline.test.js` across `js/views/`, `js/io/`, `js/state/undo.js`.
- **T-02-15 (cross-origin BC tampering):** accepted (browser enforces same-origin BroadcastChannel).

## Manual Verification (carry-forward to plan 02-05)

The plan's `<manual_verification>` block lists two checks that cannot be modeled in `node --test` and are deferred to the phase-gate manual smoke per 02-VALIDATION.md:

1. **Real BroadcastChannel between two tabs.** After plan 02-05 wires `bootSync()` in `main.js`: open two tabs, dispatch `apply({type: 'markCompleted', ...})` in tab A, confirm tab B's `onMessage` listener logs `{type: 'mutation', event: 'markCompleted', keys: {habitId, date}, at, origin}` within ~50ms. Tab A's listener MUST NOT fire (origin filter).

2. **Real visibilitychange flush on mobile.** After plan 02-05: open the PWA in Android Chrome (or DevTools "Hidden" simulation), kick off a slow `apply({type: 'markCompleted', ...})`, immediately background the app, reopen after 10s, confirm the log row is durable.

Both deferred until plan 02-05 wires the boot path.

## TDD Gate Compliance

Plan-level gate sequence verified in git log:

- Task 1 RED commit (`test(02-03): add failing lifecycle.test.js ...`) — `b13c093`
- Task 1 GREEN commit (`feat(02-03): implement js/platform/lifecycle.js ...`) — `d2a7a7c`
- Task 2 RED commit (`test(02-03): add failing sync.broadcast tests ...`) — `8106a95`
- Task 2 GREEN commit (`feat(02-03): implement js/platform/sync.js ...`) — `cf7ee58`
- Task 3 RED commit (`test(02-03): add failing apply.discipline + apply.markCompleted ...`) — `356a6b4`
- Task 3 GREEN commit (`feat(02-03): implement state spine ...`) — `5bd8f6d`
- Task 4 RED commit (`test(02-03): add failing undo.persist-reload tests ...`) — `a1a1540`
- Task 4 GREEN commit (`feat(02-03): implement js/state/undo.js ...`) — `9242dc2`

All four behavior-adding tasks have a `test(...)` commit followed by a `feat(...)` commit. Task 5 is verification-only (no commit).

## Self-Check

- [x] `js/state/store.js` exists; exports `hydrate`, `subscribe`, `notify` (plus diagnostic `_cache`); `hydrate` is idempotent.
- [x] `js/state/apply.js` exists; contains literal `HANDLERS = {` (5 matches including imports); contains NO `switch (` in code (2 matches, both inside JSDoc — discipline test strips comments).
- [x] `js/state/apply.js` exports `apply` and `configure`.
- [x] `js/state/apply/markCompleted.js` exists; exports `handleMarkCompleted` and `handleRestoreLogRow`; both have `broadcastKeys` static method.
- [x] `js/state/undo.js` exists; exports `undo` and `configureUndo`.
- [x] `js/platform/sync.js` exists; contains literal `const CHANNEL = 'habits'`; exports `bootSync`, `broadcast`, `onMessage`.
- [x] `js/platform/lifecycle.js` exists; contains `visibilitychange` (5 occurrences) and `pagehide` (5 occurrences); NEVER contains `beforeunload` in code (4 occurrences, all inside JSDoc — discipline test strips comments).
- [x] `js/platform/lifecycle.js` exports `bootLifecycle`, `trackTx`, `_flush`.
- [x] All five test files exist: `tests/unit/lifecycle.test.js`, `tests/unit/apply.discipline.test.js`, `tests/integration/sync.broadcast.test.js`, `tests/integration/apply.markCompleted.test.js`, `tests/integration/undo.persist-reload.test.js`.
- [x] All eight task commits exist on the `worktree-agent-a2be26f6ea767c84e` branch: `b13c093`, `d2a7a7c`, `8106a95`, `cf7ee58`, `356a6b4`, `5bd8f6d`, `a1a1540`, `9242dc2`.
- [x] Full test suite: `node --test` (auto-discover from cwd) → 79 tests across 12 test files, 0 fail, 0 skip.
- [x] A7 contract test (`tests/integration/contract.fake-vs-real.test.js`) stays green — fake-idb NOT modified in this plan (W1 fix from 02-01 still holds).

## Self-Check: PASSED

All artifacts created, all eight RED→GREEN commit pairs exist on the worktree branch, full test suite green (79/79), zero discipline-test violations, every required cross-reference (DATA-04, DATA-07, DATA-08, D-30, D-34, D-43, UNDO-02, Anti-Pattern 1+4, Pitfall 2+7+8) present in file headers.

## Next Plan Readiness

- `js/state/apply.js` is the locked single-mutator chokepoint. The HANDLERS dispatch table is the extension seam — plan 02-04 (`seed.js`) adds a `seed:createHabit` event type by writing one new file in `js/state/apply/` and registering it in HANDLERS (no apply.js edits needed). Optionally, the seed loader may write directly inside a single `runTx(...)` body for the bulk insert (it's an IO module, not a mutator handler) — the discipline test does NOT flag `js/io/seed.js` writing via runTx, only via the high-level put* helpers.
- `meta.undoToken` is structurally guaranteed to survive reload (UNDO-02 demonstrable end-to-end). Plan 02-05 wires `configure({...})` for both apply and undo at boot.
- Broadcast envelope is locked: `{type, event, keys, at, origin}`. Receivers re-read from IDB.
- Lifecycle flush is wired: `bootLifecycle()` registers visibilitychange + pagehide; `trackTx(p)` chains in-flight tx; manual smoke deferred to plan 02-05's phase-gate.

---
*Phase: 02-storage-foundation-the-spine, Plan: 03*
*Completed: 2026-05-26*
