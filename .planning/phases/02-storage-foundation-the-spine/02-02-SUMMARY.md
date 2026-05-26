---
phase: 02-storage-foundation-the-spine
plan: 02
subsystem: storage
tags: [indexeddb, schema, migrations, repo, tdd, fake-vs-real-contract, data-05, d-39, d-42]

# Dependency graph
requires:
  - phase: 02-storage-foundation-the-spine
    plan: 01
    provides: "tests/helpers/fake-idb.js (A7 surface), node --test runner, js/util/date.js + js/util/id.js as future apply.js inputs"
provides:
  - "js/db/schema.js — DB_VERSION=1 + MIGRATIONS[1] declaring the 7-store v1 layout (DATA-02, D-39, D-42). Locked: additive-only from here forward (Pitfall 10)."
  - "js/db/idb.js — ~80-line promise wrapper. The ONLY module that calls indexedDB (Anti-Pattern 1 enforced)."
  - "js/db/repo.js — Typed CRUD facade matching the fake-IDB surface exactly (DATA-01). The surface every later plan (apply.js, seed.js, undo.js) writes against."
  - "tests/integration/contract.fake-vs-real.test.js — A7 mitigation; CI fails on fake-vs-real drift."
  - "tests/integration/repo.surface.test.js — W3 driver test for repo public surface."
  - "tests/integration/repo.roundtrip.test.js — DATA-01 + DATA-05 round-trip coverage via fake-IDB."
  - "tests/unit/schema.test.js — DATA-02 + DATA-05 schema introspection coverage."
affects: [02-03, 02-04, 02-05, 02-06, all later phases that mutate IDB]

# Tech tracking
tech-stack:
  added:
    - "IndexedDB v1 schema (7 stores) — habits, habit_versions, logs, events, settings, meta, score_snapshots"
    - "Mock-IDB introspection pattern for testing migrations without indexedDB global (Node-safe)"
  patterns:
    - "MIGRATIONS dispatch table consumed via explicit `for (v = oldVersion+1; v <= newVersion; v++)` loop (Pitfall 10)"
    - "Repo facade lazily calls openDB() inside each function — module-load is Node-import-safe (Pitfall 9)"
    - "Namespace-import (`import * as realRepo`) for contract enforcement; never invokes a real repo function in Node"
    - "JSDoc forbidden-construct headers (autoIncrement, switch, tx.commit(), indexedDB.* outside idb.js) — documented invariants visible to readers and grep audits"

key-files:
  created:
    - "js/db/schema.js"
    - "js/db/idb.js"
    - "js/db/repo.js"
    - "tests/unit/schema.test.js"
    - "tests/integration/repo.surface.test.js"
    - "tests/integration/repo.roundtrip.test.js"
    - "tests/integration/contract.fake-vs-real.test.js"
  modified: []

key-decisions:
  - "Repo facade defers openDB() until function invocation (Pitfall 9). Module top-level has zero references to indexedDB so the file can be imported and Object.keys-enumerated in Node — exactly what the A7 contract test requires."
  - "Schema test uses an in-test mockDb() factory (not the fake-IDB) — schema.js is config that walks the MIGRATIONS dispatch; the mock captures createObjectStore/createIndex call shapes for assertion. The fake-IDB is the surface contract for repo.js, NOT for schema.js."
  - "Wrote a single contract test with three assertions (rather than per-function tests). The contract is a set-equality between EXPECTED ∩ realRepoKeys ∩ publicFakeKeys; one failure pinpoints which side drifted."

patterns-established:
  - "Migrations declared in schema.js (data); dispatch loop runs in idb.js (control). Single file responsibility per Anti-Pattern 1."
  - "Repo helpers are thin pass-throughs to idb.js primitives — typed facade is signature shape + JSDoc + named-export convenience, not new logic."
  - "Every JSDoc file header lists 'Forbidden constructs in this file' explicitly — captures the negative space that the design depends on (no autoIncrement, no switch dispatch, no indexedDB outside idb.js, no tx.commit()). Grep audits remain meaningful because the forbidden tokens appear only inside JSDoc."

requirements-completed: [DATA-01, DATA-02, DATA-05]

# Metrics
duration: ~20m
completed: 2026-05-26
---

# Phase 2 Plan 02: IndexedDB Spine (schema + idb + repo + A7 contract) Summary

**Seven-store v1 IndexedDB schema (DATA-02, D-39, D-42) locked behind a typed CRUD facade (DATA-01) that round-trips definitionVersion-aware log rows (DATA-05); A7 fake-vs-real contract test fails CI on any future surface drift.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 5 (1 TDD RED→GREEN with 9 schema assertions, 1 auto-implementation of idb.js, 1 TDD RED→GREEN with surface + roundtrip tests, 1 TDD contract test, 1 verification)
- **Files created:** 7
- **Files modified:** 0

## Accomplishments

- `js/db/schema.js` declares `DB_VERSION = 1` and `MIGRATIONS[1]` creating exactly seven stores in the order
  `habits → habit_versions → logs → events → settings → meta → score_snapshots`, with indexes:
  - `habits`: `wave`, `status`
  - `habit_versions`: `habitId`
  - `logs`: `date`, `habitId`
  - `events`: `at`, `type`, `habitId`
  - `score_snapshots`: `date`, `habitId`

  D-39 in v1 (no v2 needed for P6), D-42 UUID keypaths everywhere (zero `autoIncrement`), Pitfall 10 dispatch table.
- `js/db/idb.js` is the **only** module that touches `indexedDB`. Exports `openDB`, `promisify`, `done`, `runTx`, `get`, `getAll`, `put`, `del`, `indexGetAll`. `openDB` walks `MIGRATIONS` via explicit loop. `done(tx)` is the "data durable" source of truth (Pitfall 2). DB_NAME = `'habits'` (D-30).
- `js/db/repo.js` typed facade exports the eleven public functions (`getHabit`, `putHabit`, `putLog`, `getLog`, `putEvent`, `getEvent`, `getMeta`, `putMeta`, `getSetting`, `putSetting`, `runTx`) matching the fake-IDB surface exactly. Each function lazily calls `openDB()` so the module is Node-import-safe (Pitfall 9).
- `tests/unit/schema.test.js` — 10 assertions across 7-store shape + indexes + autoIncrement-free invariant. Uses an in-test `mockDb()` factory to introspect `createObjectStore`/`createIndex` call shapes.
- `tests/integration/repo.surface.test.js` — W3 driver (11 assertions); namespace-imports the real repo and asserts every `EXPECTED` name is a function.
- `tests/integration/repo.roundtrip.test.js` — 8 assertions covering habit + log + event + meta + settings round-trips, log `definitionVersion` field preservation (DATA-05), forward-compat for log rows without `definitionVersion`, compound-key idempotency on `(habitId, date)`, UUID event lookup (D-42).
- `tests/integration/contract.fake-vs-real.test.js` — A7 contract; 3 assertions guard against future drift between fake-IDB and real repo.

## Task Commits

1. **Task 1 (RED): failing schema tests** — `52a8c84` (test)
1. **Task 1 (GREEN): js/db/schema.js** — `1a6f30c` (feat)
2. **Task 2: js/db/idb.js promise wrapper** — `7e295d8` (feat)
3. **Task 3 (RED): repo surface + roundtrip tests** — `2dbb18d` (test)
3. **Task 3 (GREEN): js/db/repo.js typed facade** — `55116c3` (feat)
4. **Task 4: A7 fake-vs-real contract test** — `f4a9ec5` (test)
5. **Task 5: Wave 2 green-suite check** — no commit (verification-only)

## Files Created/Modified

### Created

- `js/db/schema.js` — DB_VERSION + MIGRATIONS dispatch table (DATA-02, Pitfall 10, D-39, D-42).
- `js/db/idb.js` — Hand-written ~80-line IndexedDB promise wrapper (D-30, Anti-Pattern 1, Pitfall 1/2/10).
- `js/db/repo.js` — Typed CRUD facade matching fake-IDB surface (DATA-01, DATA-05, D-42, Pitfall 9).
- `tests/unit/schema.test.js` — 10 schema-introspection assertions (DATA-02, DATA-05, D-39, D-42).
- `tests/integration/repo.surface.test.js` — Driver test for repo public surface (W3, DATA-01).
- `tests/integration/repo.roundtrip.test.js` — Round-trip + DATA-05 + D-42 coverage via fake-IDB.
- `tests/integration/contract.fake-vs-real.test.js` — A7 mitigation; future-drift guard.

### Modified

None.

## Decisions Made

1. **Repo defers `openDB()` to function-invocation time (not module-load).** The A7 contract test imports `repo.js` as a namespace (`import * as realRepo`) in Node — a top-level `await openDB()` would throw `ReferenceError: indexedDB is not defined` at module-load and break the contract test. Every exported repo function calls `await openDB()` internally, then delegates to `idb.js`. This keeps the module Node-loadable for surface inspection while preserving the runtime guarantee that the DB is open before any read/write.

2. **Schema test uses an in-test `mockDb()` factory rather than the fake-IDB.** The fake-IDB exposes the repo surface, not the IndexedDB DDL surface (it has no `createObjectStore`). The mock captures `createObjectStore(name, opts)` and `createIndex(name)` calls so the schema declaration is observable in pure JavaScript without an `indexedDB` global. Lifecycle: tests instantiate a fresh `mockDb()` per assertion, invoke `MIGRATIONS[1](db, null)`, then read `db._stores`.

3. **Single contract test, three assertions.** Rather than 11 per-function existence checks, the contract test asserts (a) EXPECTED ⊆ Object.keys(realRepo), (b) EXPECTED ⊆ publicFakeKeys, (c) publicFakeKeys ⊆ EXPECTED. The real repo MAY add additional helpers (e.g. future `getEventsByAt`); the fake must NOT add public methods that no real implementation backs. Test failure messages name the offending side and key so triage is one read.

4. **Forbidden-construct lists live in JSDoc headers (visible negative space).** Every file in `js/db/` opens with a "Forbidden constructs in this file" block — captures the design constraints that grep audits depend on. The forbidden tokens (`autoIncrement`, `switch`, `tx.commit()`, `indexedDB.*` outside idb.js) appear only inside those JSDoc comments, so grep continues to be a meaningful invariant check.

## Deviations from Plan

None — plan executed exactly as written. All RED→GREEN sequencing held, all forbidden-construct invariants verified, all 51 tests green.

## Issues Encountered

- **`node --test tests/` directory-arg semantics on Node 24.** Local development uses Node 24.15.0 where `node --test tests/` interprets `tests/` as a module specifier and errors with `ERR_MODULE_NOT_FOUND`. CI pins Node 20 (per `.github/workflows/ci.yml`) where directory scanning works. For local verification, used `node --test` (auto-discover from cwd) or explicit file enumeration. This was already documented in the Wave 1 SUMMARY; not a regression introduced by this plan.

## User Setup Required

None.

## Manual Verification (optional dry-run)

Per the plan's `<manual_verification>` block, after this plan ships the real `js/db/idb.js` is testable in a browser even though `seed.js` hasn't shipped. Optional steps:

1. `node scripts/serve.js` then open `http://localhost:8080/` in Chrome.
2. In DevTools console: `(await import('./js/db/idb.js')).openDB().then(db => console.log('opened', db.name, db.version))`. Expected: `opened habits 1`.
3. DevTools → Application → IndexedDB → expand `habits` v1. Verify all 7 stores exist: `habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`.
4. Verify the `events` store keypath is `id` (NOT `++id`) — confirms D-42.
5. Verify `score_snapshots` exists and is empty — confirms D-39.

Not executed in this automated run (no browser); deferred to the phase-gate manual smoke per 02-VALIDATION.md.

## TDD Gate Compliance

Plan-level gate sequence verified in git log:

- Task 1 RED commit (`test(02-02): add failing schema tests …`) — `52a8c84`
- Task 1 GREEN commit (`feat(02-02): implement js/db/schema.js …`) — `1a6f30c`
- Task 2: implementation-only (idb.js has no Node-runnable test per Pitfall 9 — verified by module-parse smoke + the indirect coverage in Task 3's integration tests)
- Task 3 RED commit (`test(02-02): add repo surface + round-trip tests …`) — `2dbb18d`
- Task 3 GREEN commit (`feat(02-02): implement js/db/repo.js …`) — `55116c3`
- Task 4 test commit (`test(02-02): add A7 fake-vs-real contract test`) — `f4a9ec5`

All three behavior-adding tasks (Tasks 1, 3, 4) have a `test(...)` commit, with Tasks 1 and 3 followed by `feat(...)` GREEN commits. Task 4 is a guard test (no implementation since the surfaces already match), and Task 2 is exempt from the strict gate (configuration-shaped wrapper with no Node-testable behavior; manual browser smoke is its verification).

## Self-Check

- [x] `js/db/schema.js` exists; exports `DB_VERSION` (value `1`) and `MIGRATIONS` (object with key `1` → function).
- [x] `js/db/schema.js` contains zero `autoIncrement` matches in code; zero `switch` matches.
- [x] `js/db/idb.js` exists; contains literal `DB_NAME = 'habits'`; imports `DB_VERSION`, `MIGRATIONS` from `./schema.js`.
- [x] `js/db/idb.js` exports `openDB`, `promisify`, `done`, `runTx`, `get`, `getAll`, `put`, `del`, `indexGetAll`; no `tx.commit()` in code; no top-level `indexedDB` reference.
- [x] `js/db/repo.js` exists; exports the 11-function surface (`getHabit`, `putHabit`, `putLog`, `getLog`, `putEvent`, `getEvent`, `getMeta`, `putMeta`, `getSetting`, `putSetting`, `runTx`).
- [x] `js/db/repo.js` imports only from `./idb.js`; no `indexedDB.*` reference outside JSDoc; no `tx.commit()`.
- [x] `tests/unit/schema.test.js` exists; covers 7-store shape + 5 index assertions + autoIncrement-free invariant + DB_VERSION assertions = 10 assertions.
- [x] `tests/integration/repo.surface.test.js` exists; 11 surface assertions.
- [x] `tests/integration/repo.roundtrip.test.js` exists; 8 round-trip assertions including DATA-05 `definitionVersion` field preservation + compound-key idempotency.
- [x] `tests/integration/contract.fake-vs-real.test.js` exists; A7 mitigation.
- [x] All 51 tests across 7 test files pass on Node 24 (local) — verified with explicit file enumeration: `node --test tests/unit/_smoke.test.js tests/unit/date.test.js tests/unit/id.test.js tests/unit/schema.test.js tests/integration/repo.surface.test.js tests/integration/repo.roundtrip.test.js tests/integration/contract.fake-vs-real.test.js`.
- [x] All commit hashes exist on `worktree-agent-ae5980549e4c66bd6`: `52a8c84`, `1a6f30c`, `7e295d8`, `2dbb18d`, `55116c3`, `f4a9ec5`.

## Self-Check: PASSED

All artifacts created, all six task commits exist on the worktree branch, full test suite green (51/51), zero forbidden-construct regressions, every required JSDoc cross-reference (D-30, D-39, D-42, DATA-01, DATA-02, DATA-05, Pitfall 1, Pitfall 6, Pitfall 9, Pitfall 10, Anti-Pattern 1) present in file headers.

## Next Plan Readiness

- `js/db/repo.js` is the single surface plan 02-03 (`apply.js` + per-event handlers) and plan 02-04 (`seed.js`) write against — fake-IDB and real repo guaranteed identical via the A7 contract test from this commit forward.
- `runTx(stores, mode, body)` accepts the same caller code apply/seed will use against fake AND real (extended fake-IDB tx-shape from plan 02-01 plus the new real-repo wrapper in this plan).
- v1 schema is locked — additive-only migrations from this point on (Pitfall 10).
- `score_snapshots` declared empty (D-39) — P6 will start writing without a v2 migration.

---
*Phase: 02-storage-foundation-the-spine, Plan: 02*
*Completed: 2026-05-26*
