---
phase: 02-storage-foundation-the-spine
plan: 04
subsystem: seed
tags: [seed, first-run, persist, idempotent, di, tdd, data-01, data-03, seed-01, seed-02, seed-03, seed-04, seed-05, d-32, d-33, d-41, d-45]

# Dependency graph
requires:
  - phase: 02-storage-foundation-the-spine
    plan: 03
    provides: "js/db/repo.js typed facade (DATA-01) + fake-IDB A7 tx-shape (W1 fix) + js/state/apply.js single-mutator chokepoint (which seed.js intentionally bypasses for the bulk seed-tx, per the discipline-test exception for js/io/ writing via runTx)"
  - phase: 02-storage-foundation-the-spine
    plan: 01
    provides: "tests/helpers/fake-idb.js + fake-storage.js (DATA-03 spy) + js/util/id.js (D-42)"
provides:
  - "seed/habits.json — bundled 8-habit D-32 coverage fixture (SEED-01, SEED-02, D-31, D-32, D-40). Locked v4 UUIDs — never regenerate (D-33 merge-by-id depends on stable ids)."
  - "js/io/seed.js — idempotent first-run seed loader + navigator.storage.persist() + D-45 settings defaults. configureSeed({repo, storage, fetch}) DI symmetric with apply.configure (RESEARCH §Open Question 2)."
  - "tests/unit/seed.shape.test.js — 14 assertions covering top-level wrapped-object shape, D-32 distribution matrix, RFC 4122 v4 UUID validation, name_pl D-40 surface, cadence_v:1 (Pitfall 12), and SEED-05 no-xlsx grep gate (with JSDoc-stripped match, mirroring apply.discipline.test.js)."
  - "tests/integration/seed.idempotent.test.js — 3 suites × 3 tests covering first-run insert, second-run no-op (T-02-03 data-trust invariant), and SEED-04 one-event-per-habit grouping."
  - "tests/integration/seed.persist.test.js — 3 suites × 3 tests covering DATA-03 single-call invariant, Pitfall-11 re-probe gate, and Pitfall-3 non-fatal false outcome."
affects: [02-05, 02-06, all later phases that rely on seeded habits being present at boot]

# Tech tracking
tech-stack:
  added:
    - "Configurable DI for IO modules (seed.js follows apply.js's configure-based pattern — RESEARCH §Open Question 2)"
    - "Schema-validated seed-fixture format (top-level wrapped object {schemaVersion, seedVersion, habits[]})"
  patterns:
    - "Idempotent boot step via meta.<flag> gate (Pitfall 5 + Pitfall 11)"
    - "Fast-path no-op when both gates are present (steady-state every-boot path)"
    - "Schema validation BEFORE first IDB write (T-02-XSS — reject malformed seed at parse boundary)"
    - "Comment-stripped grep tests (lift apply.discipline.test.js's readStripped pattern for SEED-05)"

key-files:
  created:
    - "seed/habits.json"
    - "js/io/seed.js"
    - "tests/unit/seed.shape.test.js"
    - "tests/integration/seed.idempotent.test.js"
    - "tests/integration/seed.persist.test.js"
  modified: []

key-decisions:
  - "Seed v4 UUIDs locked permanently in commit e7f71ae. Per D-33, merge-by-id requires stable identifiers — once committed, never regenerate. Any future regeneration breaks idempotency across user devices that already imported the existing seed."
  - "When seededIds is undefined we always write the seed tx, even if toInsert.length === 0. The tx is idempotent (put overwrites with identical values) but unconditionally writes meta.seededIds + the three D-45 settings rows. This simplifies the control flow and means D-45 defaults are guaranteed present after first run regardless of whether any habits were genuinely new."
  - "SEED-05 grep test strips JSDoc/line comments before matching, mirroring apply.discipline.test.js's readStripped convention. This is the established codebase pattern: forbidden tokens are banned in CODE but documented in JSDoc 'Forbidden constructs in this file' headers (see js/db/idb.js, js/db/repo.js). Without comment-stripping, seed.js's own self-documenting JSDoc would trigger a false-positive."
  - "configureSeed accepts EITHER ({fetch}) explicitly OR falls back to globalThis.fetch — same pattern apply.js uses for repo/broadcast. This keeps production code DI-free (configure once at boot, then call bootSeed normally) while preserving Node test-ability."

patterns-established:
  - "Two-phase first-run flow inside bootSeed: phase A writes the seed-tx (habits + events + meta.seededIds + D-45 settings), phase B writes meta.persistResult in a SEPARATE meta-only tx. The split exists because persist() is an async platform call that should NOT live inside the main seed-tx body — IDB auto-commits on idle tick (Pitfall 1), and awaiting an unrelated platform API mid-tx would risk premature commit."
  - "Schema-validation guard at the parse boundary: reject !object || !Array.isArray(habits) || schemaVersion !== 1 BEFORE any IDB write. This is the canonical T-02-XSS mitigation pattern for any future IO module that fetches external JSON."
  - "Defensive double-check in the diff loop: `existing = new Set(seededIds ?? [])` AND `await repo.getHabit(h.id)` (Pitfall 5). The set covers the normal path; the getHabit check catches out-of-band recovery scenarios where a habit row exists without its id in seededIds."

requirements-completed: [DATA-01, DATA-03, SEED-01, SEED-02, SEED-03, SEED-04, SEED-05]

# Metrics
duration: ~15m
completed: 2026-05-26
---

# Phase 2 Plan 04: Seed Loader (idempotent + persist + D-45 defaults) Summary

**Idempotent first-run seed loader (`js/io/seed.js`) + 8-habit D-32 coverage fixture (`seed/habits.json`) + locked v4 UUIDs + `navigator.storage.persist()` exactly-once gate via `meta.persistResult` (Pitfall 11) + D-45 mastery defaults — all under TDD RED → GREEN discipline with the data-trust invariant (T-02-03) integration-tested.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (2 TDD RED → GREEN + 1 full-suite verification)
- **Files created:** 5 (1 production module + 1 fixture + 3 test files)
- **Files modified:** 1 (test fix — see Deviations)

## Accomplishments

- **`seed/habits.json`** — 8-habit D-32 coverage fixture with the wrapped-object top-level shape `{schemaVersion: 1, seedVersion: 1, habits: [...]}` per RESEARCH §Open Question 3 RESOLVED. Spans Wave 1 + 2 + 3. Every habit has an English `name`, Polish `name_pl` (D-40), stable v4 UUID `id`, and `cadence.cadence_v: 1` (Pitfall 12). All 8 ids are locked permanently per D-33.
- **`js/io/seed.js`** — `bootSeed()` lifecycle:
  1. Fast-path no-op via `meta.seededIds` + `meta.persistResult` gates.
  2. Fetch + schema-validate seed file (T-02-XSS).
  3. Diff against `seededIds` + `repo.getHabit(id)` defensive double-check (Pitfall 5).
  4. Single `repo.runTx(['habits', 'events', 'meta', 'settings'], 'readwrite', body)` writes habits + one `seed:createHabit` event per habit (SEED-04, `inverse: null`) + `meta.seededIds` (full list) + D-45 settings (`defaultThreshold = 0.9`, `defaultWindowDays = 70`, `schemaVersion = 1`).
  5. Separate meta-only tx records `meta.persistResult` after the `storage.persist()` call (Pitfall 11 gate; Pitfall 3 non-fatal).

  `configureSeed({ repo, storage, fetch })` DI symmetric with `apply.configure({ repo, broadcast, trackTx })` and `configureUndo({ repo, apply? })`.
- **`tests/unit/seed.shape.test.js`** — 14 assertions across 3 suites: top-level shape (SEED-01), D-32 8-habit coverage matrix (SEED-02, distribution + UUID + name_pl + cadence_v + waves + uniqueness), SEED-05 no-xlsx grep (with JSDoc stripping to allow self-documenting "Forbidden constructs" blocks).
- **`tests/integration/seed.idempotent.test.js`** — 3 tests across 3 suites: first-run insert (8 habits + 8 events + meta + D-45 settings), second-run no-op (T-02-03 data-trust — user edits to seeded rows preserved), SEED-04 one-event-per-habit grouping.
- **`tests/integration/seed.persist.test.js`** — 3 tests across 3 suites: DATA-03 single-call invariant, Pitfall-11 re-probe gate, Pitfall-3 non-fatal `false` outcome.

## The 8 Seed Habits

| UUID            | Name (English)             | Name (Polish)                  | Wave | Cadence                                            | logShape         | Extras                                        |
|-----------------|----------------------------|--------------------------------|------|----------------------------------------------------|------------------|-----------------------------------------------|
| `015105be-...`  | Morning walk               | Spacer rano                    | 1    | daily                                              | binary           | —                                             |
| `44403331-...`  | Drink water (1.5L)         | Picie wody (1,5L)              | 1    | daily                                              | binary           | —                                             |
| `83c8b7c5-...`  | Weekly grocery run         | Cotygodniowe zakupy            | 2    | weekly                                             | binary           | —                                             |
| `b80c7b07-...`  | Shower (every 2 days)      | Prysznic co 2 dni              | 1    | every-n-days (n=2)                                 | binary           | —                                             |
| `c1eecb31-...`  | Strength training (M/W/F)  | Trening siłowy (pn/śr/pt)      | 3    | day-of-week-subset (`['mon', 'wed', 'fri']`)       | binary           | —                                             |
| `eeef9945-...`  | 5 things grateful for      | 5 rzeczy za które wdzięczny    | 1    | daily                                              | numeric          | `target: 5`                                   |
| `45e0f64f-...`  | 7 meatless meals/week      | 7 posiłków bez mięsa/tydz      | 2    | weekly                                             | slot-checklist   | `slots: {kind: 'anonymous', count: 7}`        |
| `2694072b-...`  | Daily learning (3 sources) | Codzienna nauka (3 źródła)     | 3    | daily                                              | slot-checklist   | `slots: {kind: 'labeled', labels: [...]}`     |

**D-32 distribution verified by `seed.shape.test.js`:**
- 2× daily binary (rows 1, 2)
- 1× weekly binary (row 3)
- 1× every-2-days binary (row 4)
- 1× day-of-week-subset binary (row 5)
- 1× daily numeric with target (row 6)
- 1× anonymous slot-checklist (row 7)
- 1× labeled slot-checklist (row 8)
- Waves: {1, 2, 3} all covered

## bootSeed Lifecycle (fetch → diff → tx → persist → meta.persistResult)

```
┌─── boot ───────────────────────────────────────────────────────────────┐
│                                                                        │
│  1. seededIds = await repo.getMeta('seededIds')                        │
│  2. persistResult = await repo.getMeta('persistResult')                │
│  3. if (seededIds !== undefined && persistResult !== undefined) {      │
│       return; // fast-path no-op (steady state)                        │
│     }                                                                  │
│                                                                        │
│  4. if (seededIds === undefined) {                                     │
│       seed = await (fetchFn('./seed/habits.json')).json();             │
│       validate(seed); // T-02-XSS — reject malformed shape             │
│                                                                        │
│       toInsert = seed.habits.filter(h =>                               │
│         !existing.has(h.id) && !await repo.getHabit(h.id));            │
│                                                                        │
│       await repo.runTx(['habits','events','meta','settings'], 'rw',    │
│         async (tx) => {                                                │
│           for (h of toInsert) {                                        │
│             tx.objectStore('habits').put(h);                           │
│             tx.objectStore('events').put({                             │
│               id: newId(),                                             │
│               at: new Date().toISOString(),                            │
│               type: 'seed:createHabit',                                │
│               payload: { habitId: h.id },                              │
│               inverse: null,                                           │
│             });                                                        │
│           }                                                            │
│           tx.objectStore('meta').put({                                 │
│             key: 'seededIds',                                          │
│             value: seed.habits.map(h => h.id),                         │
│           });                                                          │
│           tx.objectStore('settings').put({key:'defaultThreshold',v:0.9});│
│           tx.objectStore('settings').put({key:'defaultWindowDays',v:70});│
│           tx.objectStore('settings').put({key:'schemaVersion',v:1});   │
│         });                                                            │
│     }                                                                  │
│                                                                        │
│  5. if (persistResult === undefined) {                                 │
│       granted = false;                                                 │
│       if (storage?.persist) {                                          │
│         granted = await storage.persist(); // Pitfall 3 non-fatal      │
│       }                                                                │
│       await repo.runTx(['meta'], 'rw', async (tx) => {                 │
│         tx.objectStore('meta').put({                                   │
│           key: 'persistResult', value: granted,                        │
│         });                                                            │
│       });                                                              │
│     }                                                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Why two separate transactions?** Pitfall 1: IDB auto-commits on idle tick. Awaiting an unrelated async platform call (`storage.persist()`) inside the main seed-tx body would risk the tx committing prematurely or the persist call being mis-attributed to the tx lifetime. The two-tx split keeps each tx body self-contained and synchronous-after-open.

## The DI Seam (`configureSeed`)

Symmetric with the existing P2 DI seams:

| Module           | Configure call                                       | Production injection (plan 02-05)            |
|------------------|------------------------------------------------------|----------------------------------------------|
| `js/state/apply.js`     | `configure({ repo, broadcast, trackTx })`     | Real `repo` + `sync.broadcast` + `trackTx`    |
| `js/state/undo.js`      | `configureUndo({ repo, apply? })`             | Real `repo` (apply field omitted; default applies) |
| `js/io/seed.js` (new)   | `configureSeed({ repo, storage, fetch })`     | Real `repo` + `navigator.storage` (default via global) + `globalThis.fetch` (default via global) |

The pattern is locked across all three modules:
- **Truthy-field overwrite** (`if (deps.X) _X = deps.X`) — lets tests inject only a subset and re-configure incrementally without re-injecting unchanged dependencies.
- **Fallback to `globalThis`** — `storage` falls back to `navigator.storage` and `fetch` falls back to `globalThis.fetch`, so production code can boot with only the `repo` configured (matching how Phase 1's `sw-register.js` reads `navigator.*` directly).
- **No top-level static import of `repo.js`** — seed.js never imports `js/db/repo.js`. The repo handle arrives via configure, identical to apply.js. This keeps the module Node-import-safe (Pitfall 9).

## Test Counts

- `tests/unit/seed.shape.test.js`: **14 assertions** across 3 suites
  - Shape (top-level wrapped object): 2 tests
  - D-32 distribution + UUID + name_pl + cadence_v + waves + uniqueness: 11 tests
  - SEED-05 no-xlsx grep (with comment stripping): 1 test
- `tests/integration/seed.idempotent.test.js`: **3 tests** across 3 suites (first-run insert, second-run no-op T-02-03, SEED-04 one-event-per-habit)
- `tests/integration/seed.persist.test.js`: **3 tests** across 3 suites (single-call DATA-03, Pitfall-11 re-probe gate, Pitfall-3 non-fatal false)

**Total Plan 04 contribution:** +20 tests (14 + 3 + 3). Full suite: **99 tests, 0 fail, 0 skip** (was 79 pre-Wave-4 baseline).

## Task Commits

1. **Task 1 RED:** `c54605a` — `test(02-04-01): add failing seed.shape.test.js`
1. **Task 1 GREEN:** `e7f71ae` — `feat(02-04-01): seed/habits.json — 8-habit D-32 coverage fixture`
2. **Task 2 RED:** `d767cdd` — `test(02-04-02): add failing seed.idempotent + seed.persist tests`
2. **Task 2 GREEN:** `6322a1d` — `feat(02-04-02): js/io/seed.js — idempotent seed loader + persist + D-45`
3. **Task 3:** full-suite verification (99 tests, 0 fail) — no commit (verification-only)

## Files Created/Modified

### Created

- `seed/habits.json` — 8-habit D-32 coverage fixture with locked v4 UUIDs (D-32, D-35, D-40, Pitfall 12).
- `js/io/seed.js` — idempotent seed loader with `configureSeed({ repo, storage, fetch })` DI (SEED-01..05, D-31..D-33, D-41, D-45).
- `tests/unit/seed.shape.test.js` — 14 assertions: SEED-01 shape, SEED-02 D-32 distribution, SEED-05 no-xlsx grep.
- `tests/integration/seed.idempotent.test.js` — SEED-03 / SEED-04 / T-02-03 data-trust coverage.
- `tests/integration/seed.persist.test.js` — DATA-03 / D-41 / Pitfall 3 / Pitfall 11 coverage.

### Modified

- `tests/unit/seed.shape.test.js` — SEED-05 grep strips JSDoc + line comments before matching, mirroring `apply.discipline.test.js`'s `readStripped` convention. Edit was a Rule-3 inline fix during Task 2 GREEN (see Deviations below). Net change: same file the RED commit introduced; the change was bundled into Task 2's GREEN commit.

## Decisions Made

1. **Seed v4 UUIDs locked permanently in `seed/habits.json`.** Per D-33, merge-by-id requires stable identifiers — once committed, never regenerate. The 8 UUIDs in `seed/habits.json` are the canonical identity of the eight seed habits across all user devices. Renaming a habit on device A and importing a backup from device B (with the same name but a different UUID) would create two habits, not one — UUID is the merge key. The same constraint applies in reverse: regenerating any UUID after first ship would break idempotency for every user who has already booted the app.

2. **Always write the seed-tx when `seededIds` is undefined, even if `toInsert.length === 0`.** Originally considered skipping the tx when no new habits were genuinely needed. Rejected: the tx is idempotent (put overwrites with identical values), and writing `meta.seededIds` + the three D-45 settings rows unconditionally simplifies the control flow. It also means D-45 defaults are guaranteed to be present after first run, regardless of whether any habits were genuinely new — this is important because future tests for the threshold engine (P4) can rely on the defaults existing once `bootSeed()` has completed.

3. **Two-transaction first-run flow.** The seed-tx and the meta.persistResult-tx are separate. Originally considered including the `persist()` call inside the main tx body. Rejected per Pitfall 1: IDB auto-commits on idle tick, and `storage.persist()` is an async platform call that may yield to the event loop in ways IDB does not tolerate inside a tx body. The two-tx split keeps each tx self-contained.

4. **SEED-05 grep strips comments.** Originally written without comment-stripping (matched the literal source). Failed during Task 2 GREEN because `seed.js`'s JSDoc explicitly says *"Forbidden constructs in this file: xlsx / SheetJS / exceljs / parse_xlsx — SEED-05 grep gate"* — exactly the forbidden tokens. This is the established codebase convention: `js/db/idb.js`, `js/db/repo.js`, `js/state/apply.js`, `js/state/undo.js` all carry "Forbidden constructs in this file" JSDoc headers that mention their banned tokens. The fix lifts the `readStripped` pattern from `apply.discipline.test.js` so the negative-space documentation continues to work as the codebase's standard pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] SEED-05 grep test does not strip comments, causing false-positive on `js/io/seed.js`'s self-documenting JSDoc**

- **Found during:** Task 2 GREEN (running full test suite after committing `js/io/seed.js`).
- **Issue:** `tests/unit/seed.shape.test.js`'s SEED-05 assertion matched the literal source `js/io/seed.js`, which contains the forbidden tokens inside its "Forbidden constructs in this file" JSDoc block (the project-wide convention for documenting negative-space invariants).
- **Fix:** Lift `apply.discipline.test.js`'s `readStripped` convention — strip block + line comments before matching. The forbidden tokens remain banned in CODE; they are explicitly permitted in JSDoc per the established codebase pattern (`js/db/idb.js`, `js/db/repo.js`, `js/state/apply.js`, `js/state/undo.js` all use the same convention).
- **Files modified:** `tests/unit/seed.shape.test.js` (one test body).
- **Verification:** Full suite 99 tests, 0 fail; the discipline test continues to pass (it already strips comments); the new SEED-05 grep walks every `.js` file under `js/` and finds zero violations.
- **Committed in:** `6322a1d` (Task 2 GREEN commit, alongside `js/io/seed.js` — both were needed to land a green Task 2).

**Total deviations:** 1 auto-fixed (Rule 3 blocking).

## Issues Encountered

- **`node --test tests/` directory-arg semantics on Node 24.** Same documented issue from plans 02-01 / 02-02 / 02-03. Local verification used `node --test` (auto-discover from cwd) plus explicit file enumeration for per-task checks. CI runs Node 20 where `node --test tests/` is valid.

## User Setup Required

None — no external service configuration, no manual file placement, no environment variables. The seed file is committed source and the loader reads it via the configured fetch (defaulting to `globalThis.fetch` in production).

## Threat Surface Scan

All threat-model entries from `02-04-PLAN.md` are mitigated:

| Threat ID         | Status     | Where mitigated                                                                 |
|-------------------|------------|---------------------------------------------------------------------------------|
| T-02-03           | mitigated  | seed.js step 4 — diff against `existing = new Set(seededIds ?? [])` + `repo.getHabit(h.id)` defensive double-check. Verified by `seed.idempotent.test.js`'s second-boot-after-edit test (the renamed habit's name is preserved verbatim). |
| T-02-05           | mitigated  | seed.js step 5 — `granted` value recorded in `meta.persistResult`. Diagnostics panel (plan 02-05) will surface the value. Pitfall 3 — `false` is non-fatal, verified by `seed.persist.test.js`'s third case. |
| T-02-XSS          | mitigated  | seed.js step 4 — schema validation rejects `!object || !Array.isArray(habits) || schemaVersion !== 1` BEFORE any IDB write. JSON.parse is safe against prototype pollution by default (V8/SpiderMonkey/JSC). |
| T-02-PERSIST11    | mitigated  | seed.js step 5 — `persistResult === undefined` gate. Verified by `seed.persist.test.js`'s second-boot test (`_persistCalls` remains 0 after reset). |
| T-02-SCHEMA       | mitigated  | seed.js step 4 inserts habits verbatim, preserving the `cadence.cadence_v: 1` field that P4's cadence engine will dispatch on. |

No new threat surfaces introduced. The seed module's only external touchpoints are the fetch read (committed source) and the persist call (recorded outcome only).

## Manual Verification (carry-forward to plan 02-05)

Plan 02-04 has no manual verification step (per `<manual_verification>` in 02-04-PLAN.md — the seed loader cannot be exercised end-to-end without main.js / desktop.js wiring + the sw.js SHELL extension, which all land in plan 02-05). The full manual browser smoke checklist (~8 items, including first-run prompt, second-boot no-op, reset-data button) runs in plan 02-05's checkpoint after the boot wiring ships.

## TDD Gate Compliance

Plan-level gate sequence verified in git log:

- Task 1 RED commit (`test(02-04-01): add failing seed.shape.test.js`) — `c54605a`
- Task 1 GREEN commit (`feat(02-04-01): seed/habits.json — 8-habit D-32 coverage fixture`) — `e7f71ae`
- Task 2 RED commit (`test(02-04-02): add failing seed.idempotent + seed.persist tests`) — `d767cdd`
- Task 2 GREEN commit (`feat(02-04-02): js/io/seed.js — idempotent seed loader + persist + D-45`) — `6322a1d`

Both behavior-adding tasks have a `test(...)` commit followed by a `feat(...)` commit. Task 3 is verification-only (no commit).

## Self-Check

- [x] `seed/habits.json` exists and parses with the correct top-level shape (`{schemaVersion:1, seedVersion:1, habits:[8]}`).
- [x] `js/io/seed.js` exists; exports `bootSeed` and `configureSeed`.
- [x] `tests/unit/seed.shape.test.js` exists; 14 assertions; SEED-05 grep walks `js/**/*.js`.
- [x] `tests/integration/seed.idempotent.test.js` exists; 3 tests; covers T-02-03 data-trust invariant.
- [x] `tests/integration/seed.persist.test.js` exists; 3 tests; covers DATA-03 + Pitfall 11 + Pitfall 3.
- [x] All four task commits exist on `worktree-agent-a3178b2a32abab3c4`: `c54605a`, `e7f71ae`, `d767cdd`, `6322a1d`.
- [x] Full test suite: `node --test` (auto-discover from cwd) → 99 tests across 15 test files, 0 fail, 0 skip.
- [x] Zero npm artifacts in repo root (no `package.json`, no `node_modules`, no `package-lock.json`).
- [x] A7 contract test (`tests/integration/contract.fake-vs-real.test.js`) stays green — fake-IDB NOT modified in this plan.
- [x] Discipline test (`tests/unit/apply.discipline.test.js`) stays green — `js/io/seed.js` writes via `repo.runTx(...)`, not direct `put*` helpers (the discipline test sweeps `js/io/` for put helpers; zero violations).

## Self-Check: PASSED

All artifacts created, all four RED → GREEN commit pairs exist on the worktree branch, full test suite green (99/99), zero discipline-test violations, every required cross-reference (DATA-01, DATA-03, SEED-01..05, D-32, D-33, D-41, D-45, Pitfall 3, Pitfall 5, Pitfall 11, Pitfall 12, T-02-03, T-02-XSS, T-02-PERSIST11) present in file headers.

## Next Plan Readiness

- `bootSeed()` is the locked first-run entry point. Plan 02-05 will call `configureSeed({repo, storage, fetch})` once at boot (alongside `apply.configure(...)` and `configureUndo(...)`), then invoke `await bootSeed()` from `js/main.js` and `js/desktop.js`.
- The seed file is committed source — `seed/habits.json` must be added to the SW SHELL precache list in plan 02-05 (per 02-PATTERNS.md §`sw.js` — `'./seed/habits.json'` line) so the first-run fetch succeeds when offline.
- The D-45 settings defaults are guaranteed present after `bootSeed()` completes — Plan 02-06 (or any future P4 work) can rely on `repo.getSetting('defaultThreshold')` returning `{key, value: 0.9}` and `repo.getSetting('defaultWindowDays')` returning `{key, value: 70}` without a null-fallback.
- The 8 seed habits cover the D-32 cadence × log-shape matrix end-to-end — P4's cadence engine will have real fixtures to drive against on first boot.
- `meta.persistResult` is recorded once and surfaceable in the diagnostics panel — plan 02-05 will read it to display "storage persisted: yes/no".

---
*Phase: 02-storage-foundation-the-spine, Plan: 04*
*Completed: 2026-05-26*
