---
phase: 03-today-view-settings-v1-first-usable-slice
plan: 03
subsystem: state+view
tags: [tap-to-log, chokepoint, markUncompleted, lastCompletedDate-invariant, optimistic-flip, notify-refresh, tdd]

# Dependency graph
requires:
  - phase: 03-today-view-settings-v1-first-usable-slice
    plan: 02
    provides: "Today view renders read-only with hash router + builders + store cache + mountToday subscribe loop"
provides:
  - "`markUncompleted` chokepoint handler — writes `{habitId, date, completed: false, definitionVersion: null}` (NOT delete; D-74) + maintains the D-52 invariant in the same tx"
  - "`_recomputeLastCompletedDate({habitId, currentLogRow, repo})` — shared helper imported by `markCompleted`, `markUncompleted`, AND `restoreLogRow` so the D-52 invariant holds across mark/unmark/undo round-trips"
  - "Notify-driven cache refresh in `js/state/store.js` — `notify({event, keys})` is async and re-reads the affected habit + log + setting rows BEFORE fanning out to subscribers (D-72; Pitfall 2)"
  - "`notify` DI seam in `apply.configure({notify})` — production keeps the static import path; tests that cache-bust apply+store separately inject the cache-busted notify so subscribers fan out through the test's store instance (Pitfall 9 variant)"
  - "Today row tap wiring (D-53, NFR-02) — `mountToday` wires `markComplete` / `markUncomplete` closures through `mount(desc, parent, actions)`; synchronous optimistic flip BEFORE await + `revertRow` on apply() reject"
  - "`repo.getLogsByHabit(habitId)` — full per-habit log scan via the `habitId` index (D-39); enables the D-52 recompute"
  - "fake-idb mirror of `getLogsByHabit` — A7 contract preserved; contract.fake-vs-real.test.js EXPECTED list extended"
affects: [03-04 (undo toast surface — apply() is the only producer of meta.undoToken; this slice keeps the contract clean), 03-05 (Settings v1 — same notify-refresh pipe + apply.configure({notify}) seam carry over), 04 (history view + scoring — the D-52 invariant is the load-bearing read path for the every-N-days resolver), all future ChokepointHandler files (the shared _recomputeLastCompletedDate helper pattern: ONE source-of-truth invariant function imported by every handler that mutates logs)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-invariant helper pattern: one `_recompute<Field>` helper in the file most naturally responsible (here: markUncompleted.js), imported by every other handler that mutates the same store. Avoids divergence + makes the invariant grep-discoverable."
    - "Notify-driven cache refresh (Pitfall 2): mutations re-hydrate affected cache keys BEFORE subscribers fire, so `store.subscribe(render)` callbacks always observe canonical post-write state."
    - "Notify DI seam (Pitfall 9 variant): apply.js's `import {notify} from './store.js'` does NOT propagate Node ESM query strings — when tests cache-bust apply.js + store.js separately, apply.js's static import binds to a DIFFERENT store instance than the test inspects. Solved by adding `notify` to apply.configure({...}) DI seam; production stays DI-free via the default static import."
    - "Optimistic-flip-with-revert UX (D-53): mutate aria-pressed + class + data-action SYNCHRONOUSLY in the click handler BEFORE `await apply(...)`; on reject restore prior state from a closure-bound capture. NFR-02 <100 ms trivially met because the visual response is one animation frame."

key-files:
  created:
    - "js/state/apply/markUncompleted.js — `handleMarkUncompleted` + `_recomputeLastCompletedDate` (D-52, D-74)"
    - "tests/integration/apply.markUncompleted.test.js — 5 cases (writes-not-delete, inverse capture, broadcast shape, undo round-trip)"
    - "tests/integration/apply.lastCompletedDate.test.js — 7 cases for the D-52 invariant"
    - "tests/integration/today.tap.test.js — 4 integration tests for the tap wiring + optimistic flip + revertRow + post-render reconcile"
  modified:
    - "js/state/apply.js — HANDLERS table extended with `markUncompleted: handleMarkUncompleted`; `_notify` DI seam added; `await notify(...)` so callers observe a reconciled cache when `await apply(...)` resolves"
    - "js/state/apply/markCompleted.js — `handleMarkCompleted` and `handleRestoreLogRow` rewired through `_recomputeLastCompletedDate` so D-52 invariant holds on the round-trip undo path"
    - "js/state/store.js — `notify(payload)` is async; refreshes affected cache rows BEFORE fanning out; new `_refreshHydratedKeysForTest` export"
    - "js/db/repo.js — `getLogsByHabit(habitId)` via the `habitId` index"
    - "js/views/today.js — tap closures + helpers (captureRowPriorState, optimisticFlip, revertRow); threaded through mount() actions map; `_revertRowForTest` + `_optimisticFlipForTest` exports"
    - "tests/helpers/fake-idb.js — `getLogsByHabit` mirror (A7 contract)"
    - "tests/integration/contract.fake-vs-real.test.js — EXPECTED list extended with `getLogsByHabit`"
    - "tests/integration/apply.markCompleted.test.js — legacy notify test updated to `await store.notify(...)` (notify is async now)"
    - "tests/unit/store.hydrate.test.js — 7 new tests for notify-driven cache refresh; new `freshStoreAndApply()` paired-cache-bust helper"
    - "tests/unit/builders.today.test.js — symmetric `data-habit-id` assertion on the completed-row test (closure-lookup contract)"

key-decisions:
  - "`_recomputeLastCompletedDate` lives in markUncompleted.js (not a shared utils file). Both markCompleted and markUncompleted handlers import it; restoreLogRow imports it too so undo of a markUncompleted correctly advances lastCompletedDate forward. Keeping the helper near its primary user (the new D-74 handler) was clearer than introducing yet another file. Future expansion: when scoring snapshots land in P6, they'll need a similar `_recompute<Field>` helper — same pattern applies."
  - "Added `notify` to apply.configure({}) DI seam to handle the Pitfall 9 ESM cache-bust problem. Node ESM does NOT propagate query strings to static relative imports — when tests cache-bust apply.js + store.js separately, apply.js's `import {notify} from './store.js'` binds to a DIFFERENT (untagged) store instance than the test inspects. Defaulting to the static import preserves production DI-freeness; tests inject the cache-busted notify explicitly."
  - "Today integration test uses UN-TAGGED modules + `_resetStoreForTest()` / `_resetTodayForTest()` between tests. The cache-bust + DI approach (used in apply.markCompleted) would still hit the static-import problem in today.js, so resetting state on the un-tagged singletons is the simplest correct approach for view-mount tests."
  - "Pre-existing markCompleted test was the only legacy regression — it called `store.notify({event, keys: {}})` synchronously then asserted `calls === 1` on the next line. With notify now async, the test was updated to `await store.notify(...)`. Trivial, but it's the only legacy code path that surfaced. All other notify callers are inside `apply.apply()` which already awaits."
  - "Today view's apply error path uses `console.warn` (with a `// 03-04: replace with showErrorToast` TODO comment) instead of the toast. The full `showErrorToast` lands in Slice 4 — Slice 3's revertRow already provides the visible feedback (the row snaps back); the warning is only diagnostic noise."
  - "Today integration test extended to seed TWO habits (`h1`, `h2`) where single-row would have made the all-done branch (D-58) hide the row. Catching this kind of cadence/branch interplay in the integration test was useful — the planner's example used one habit and the test would have given a misleading 'tap works' signal."

patterns-established:
  - "Pattern: shared-invariant `_recompute<Field>` helper — one canonical function per derived denormalized field, imported by every handler that touches the underlying store. Lives next to the most-natural-owner handler, not in a shared utils dump."
  - "Pattern: Notify-driven cache refresh (D-72) — every chokepoint mutation triggers a `refreshHydratedKeys(keys)` BEFORE fanning out. Subscribers always read canonical state. Cross-tab broadcast receivers re-use the same path."
  - "Pattern: Optimistic flip + closure-bound revert. Capture prior DOM state into a `priorState` local INSIDE the click handler (so concurrent taps on different rows don't clobber each other's revert state); call `revertRow(rowEl, priorState)` in the apply catch block."
  - "Pattern: `apply.configure({notify})` DI seam — handles Node ESM's behavior of NOT propagating query strings to static relative imports. Production defaults to the static import (DI-free); tests inject the cache-busted notify."

requirements-completed: [CORE-02, CORE-03, LOG-01, NFR-02]

# Metrics
duration: 70m
completed: 2026-05-28
---

# Phase 3 Plan 03: Tap-to-Log Summary

**Tap-to-log is live.** Today rows now flip synchronously on tap (NFR-02 <100 ms), write the log row through the chokepoint (`markCompleted` / `markUncompleted` — D-74 audit-log preservation), maintain the `habit.lastCompletedDate` invariant (D-52, load-bearing for the every-N-days cadence resolver), and reconcile through `store.subscribe(render)` after `notify()` refreshes the affected cache rows. On apply() reject, `revertRow` restores the prior DOM. Slice 4 will surface the Undo toast after every mark/unmark.

## Performance

- **Duration:** ~70 min
- **Started:** 2026-05-28T10:03:42Z
- **Completed:** 2026-05-28T11:12:47Z
- **Tasks:** 3 (all TDD: RED → GREEN per task = 6 atomic commits)
- **Files modified:** 11 (1 new code file + 3 new test files + 7 modified)

## Test Counts

- **Before this plan:** 209 / 209 green at HEAD `610f22e`
- **After this plan:** 232 / 232 green at HEAD `33835f6` (+23 new tests)
  - +5 markUncompleted integration tests (writes-not-delete, inverse, broadcast, undo round-trip)
  - +7 lastCompletedDate D-52 contract tests (single mark, two marks, out-of-order, unmark most recent, unmark all, unmark middle, missing habit)
  - +7 store.notify refresh tests (logs refresh, habits refresh, markUncompleted refresh, restoreLogRow delete refresh, post-refresh subscribers, no-key no-op, idempotent hydrate)
  - +4 today.tap integration tests (optimistic flip, tap-to-unmark, revertRow on reject, store.subscribe reconcile)

## Accomplishments

- `js/state/apply/markUncompleted.js` — new handler file. Exports `handleMarkUncompleted` (D-74: writes `{completed:false, definitionVersion:null}`, captures prior log row for undo, broadcasts keys-only) AND `_recomputeLastCompletedDate` (D-52 invariant — the shared helper imported by every handler that touches the logs store).
- `js/state/apply.js` HANDLERS table extended; new `notify` DI seam (defaults to static `store.notify`, tests inject the cache-busted version); apply() now `await`s notify so callers observe a reconciled cache.
- `js/state/apply/markCompleted.js` — `handleMarkCompleted` AND `handleRestoreLogRow` rewired through `_recomputeLastCompletedDate` so the D-52 invariant holds on round-trip undo too.
- `js/state/store.js` — `notify(payload)` is async; when `payload.keys` is present it `await refreshHydratedKeys(keys)` BEFORE fanning out to subscribers. Handles habit / log / setting key shapes. Deletes cache entries when the underlying row is gone (covers `restoreLogRow` deletes).
- `js/db/repo.js` — `getLogsByHabit(habitId)` via the existing `habitId` index (D-39); fake-idb mirror added; A7 contract test EXPECTED list extended.
- `js/views/today.js` — tap closures + helpers wire through `mount(desc, parent, actions)`. `captureRowPriorState` + `optimisticFlip` + `revertRow` are pure DOM mutations (no IDB). The closure synchronously flips the row BEFORE awaiting `apply()`. On reject, `revertRow` restores prior state.
- 209 → 232 tests green. Full suite passes; D-78 grep gate + apply.discipline still green.

## Task Commits

Each TDD task produced one RED commit + one GREEN commit:

1. **Task 1: markUncompleted + lastCompletedDate invariant** — `8b42581` (test) → `1479871` (feat)
2. **Task 2: notify-driven cache refresh** — `e9fcda3` (test) → `1c7a5f8` (feat)
3. **Task 3: Today row tap wiring** — `cbfd0a0` (test) → `33835f6` (feat)

## Files Created/Modified

**Created (1 code + 3 test):**

- `js/state/apply/markUncompleted.js` — 109 lines, exports `handleMarkUncompleted` + `_recomputeLastCompletedDate`
- `tests/integration/apply.markUncompleted.test.js` — 5 tests across 4 describes
- `tests/integration/apply.lastCompletedDate.test.js` — 7 tests across 3 describes
- `tests/integration/today.tap.test.js` — 4 tests + `createFakeDocument()` + `collectAllTapButtons` helper

**Modified (7):**

- `js/state/apply.js` — HANDLERS extended; `notify` DI seam; `await notify(...)` post-tx
- `js/state/apply/markCompleted.js` — both handlers rewired through `_recomputeLastCompletedDate`
- `js/state/store.js` — async notify + refreshHydratedKeys; `_refreshHydratedKeysForTest` export
- `js/db/repo.js` — `getLogsByHabit`
- `js/views/today.js` — tap closures + revertRow + optimisticFlip + `_revertRowForTest` + `_optimisticFlipForTest`
- `tests/helpers/fake-idb.js` — `getLogsByHabit` mirror
- `tests/integration/contract.fake-vs-real.test.js` — EXPECTED list extended
- `tests/integration/apply.markCompleted.test.js` — `await store.notify(...)` (legacy)
- `tests/unit/store.hydrate.test.js` — 7 new tests + paired-cache-bust helper
- `tests/unit/builders.today.test.js` — symmetric `data-habit-id` assertion

## New exports surfaced

| Surface | Export | Source |
|---|---|---|
| `js/state/apply/markUncompleted.js` | `handleMarkUncompleted` | new — D-74 handler |
| `js/state/apply/markUncompleted.js` | `_recomputeLastCompletedDate` | new — D-52 shared invariant helper |
| `js/state/store.js` | `_refreshHydratedKeysForTest` | new — direct test access to refreshHydratedKeys |
| `js/db/repo.js` | `getLogsByHabit` | new — per-habit full log scan |
| `js/views/today.js` | `_revertRowForTest` | new — unit-level introspection |
| `js/views/today.js` | `_optimisticFlipForTest` | new — unit-level introspection |
| `tests/helpers/fake-idb.js` | `getLogsByHabit` | new — A7 contract |

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **`_recomputeLastCompletedDate` lives in markUncompleted.js**, imported by markCompleted + restoreLogRow. One source of truth for the D-52 invariant. Future scoring snapshots (P6) will follow the same `_recompute<Field>` pattern.
- **`notify` is now a DI dependency of apply.configure({...})** — solves the Node ESM static-import-doesn't-inherit-query-strings problem (Pitfall 9 variant). Production stays DI-free via the default static import; tests inject the cache-busted notify so subscribers fire on the store instance the test inspects.
- **Today tap closures are module-level functions**, not inline arrow closures recreated on every render. This means a single set of click listeners survives across re-renders (re-render rebuilds the DOM but mount() re-binds the same fn references via `addEventListener`).
- **Slice 3's apply() error path uses `console.warn`** with a `// 03-04: replace with showErrorToast` TODO. revertRow already provides visible feedback (the row snaps back); the warning is diagnostic only. The full `showErrorToast` lands in plan 03-04.
- **Today integration test uses UN-TAGGED modules + module reset** between tests. Cache-busting today.js would still bind to the un-tagged store via Node ESM, so resetting state on the un-tagged singletons is the simplest correct approach for view-mount tests.

## Deviations from Plan

The plan executed faithfully with three minor adjustments documented under decisions, none of them architectural:

1. **Added `notify` to the `apply.configure({})` DI seam** (Rule 3 — fix blocking issue). The plan said apply.js's HANDLERS table is the only change, but the Pitfall 9 ESM static-import behavior bit me in the Task 2 tests — apply.js's `import {notify} from './store.js'` resolved to a different store instance than the test inspected. The cleanest fix is the DI seam with a static-import default. Production unchanged.
2. **Updated the legacy `apply.markCompleted.test.js` "subscribe fans out" test** to `await store.notify(...)` (Rule 1 — fix bug introduced by async notify). One legacy assertion line; trivial change.
3. **Today integration test seeded TWO habits** instead of one in two of the four tests. The plan's example used one habit; with one daily habit getting marked complete, the all-done branch (D-58) hides the row and the test can't find the post-render tap button. Catching this kind of cadence/branch interplay is a small win for the integration test.

## Issues Encountered

- **Node ESM static-import behavior** — confirmed twice during this plan: a cache-busted `apply.js?t=X`'s static `import {notify} from './store.js'` resolves to the UN-tagged `./store.js`, NOT `./store.js?t=X`. This breaks the Pattern S7 paired-cache-bust assumption for any module pair where the relationship is "module A statically imports module B." Worked around in Task 2 via the `apply.configure({notify})` DI seam; in Task 3 via the un-tagged-modules-plus-reset approach.
- No other surprises. All tests passed RED → GREEN cleanly with the diagnostics observation above; no debugger time needed.

## D-78 Discipline Verification

`tests/unit/discipline.xss.test.js` continues to pass — every new and modified `.js` file under `js/` is free of `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`. The new tap DOM mutations (`optimisticFlip`, `revertRow`) all use `setAttribute` / `classList.add` / `classList.remove`. `clearChildren` loops `removeChild` as it has since 03-02.

## apply.discipline Verification

`tests/unit/apply.discipline.test.js` continues to pass. The HANDLERS table includes literal `markUncompleted: handleMarkUncompleted`; no `switch (` was introduced. The new `markUncompleted.js` handler does NOT call any `put*` repo helper (the discipline grep for `js/state/undo.js` + `js/views` + `js/io` excludes `js/state/apply/` — handlers READ via repo but the chokepoint OWNS the writes).

## Requirements coverage

Plan frontmatter listed `[CORE-02, CORE-03, LOG-01, NFR-02]`. Status:

- **CORE-02** (single-tap mark complete with row update under one frame) — **complete.** Optimistic flip runs synchronously BEFORE the `await apply()`; integration test "tap an uncompleted row" verifies the flip is in place at the next microtask tick. Real-world UAT lands at phase closeout.
- **CORE-03** (single-tap unmark from the same row) — **complete.** `markUncompleted` handler ships; symmetric tap closure in today.js; integration test "completed row → tap → flip back" verifies.
- **LOG-01** (binary log shape `{completed: true|false}`) — **complete.** D-74 mandate honored: markUncompleted writes `{completed: false, definitionVersion: null}`, NOT a delete. Audit log preserved.
- **NFR-02** (first-tap latency <100 ms) — **complete by construction.** The optimistic flip mutates aria-pressed + class + data-action SYNCHRONOUSLY in the click handler (zero awaits before the visible update). Real-world wall-clock measurement waits for the phase closeout UAT.

## Known Stubs

None that block this plan's goal. The plan's `<objective>` is met: "User taps a row → row flips on-screen within one animation frame; the underlying IDB log row is `{completed: true|false, definitionVersion: null}`."

Two intentional placeholders documented in code:
- `console.warn('[today] markCompleted failed', err)` with a `// 03-04: replace with showErrorToast` TODO comment in both tap closures. The toast UI lands in plan 03-04.
- `togglePolish` action key is emitted by `buildTodayRow` (for habits with `name_pl`) but the `actions` map in `renderTodayInto` does NOT bind it — clicking the ⓘ button does nothing. The disclosure popover (D-55) lands in a future slice.

Neither stub prevents the daily tap-to-log loop, which is the product's core value.

## Manual smoke instructions

Open `index.html` in Firefox (or `node scripts/serve.js` + `http://localhost:8080/` for Chromium). Verify:

1. Today panel mounts as the initial route — header shows `Habits`, today's date, `Wave 4`.
2. The seed's 8 habits render filtered by `appliesToday`.
3. Tap any row — within one frame the row flips: ✓ glyph + strikethrough + opacity 0.55, `aria-pressed="true"`, button moves to `data-action="markUncomplete"`. The DOM reconciles to the canonical IDB state in the same render (the row stays completed after the tx commits).
4. Tap the same row again — flips back to uncompleted within one frame. The log row in IDB is `{completed: false, definitionVersion: null}` — INSPECT in DevTools → Application → IndexedDB → habits → logs to verify the row exists with `completed: false`. (D-74 — NOT delete.)
5. Tap one habit; open a second tab to `index.html`; the second tab's Today panel reflects the same completed row WITHOUT any reload. (Cross-tab BroadcastChannel + notify-driven re-render.)
6. Tap a row, then in DevTools → Application → IndexedDB → habits → habits → find the habit's row: `lastCompletedDate` field should equal today's YYYY-MM-DD. Tap again to unmark: `lastCompletedDate` should fall back to the most recent remaining completed log OR null when no completed log exists.
7. `index.html#settings` still lands on the empty Settings panel (Slice 4 fills it).
8. `index.html#history` still shows the placeholder.

## Self-Check: PASSED

All claimed files exist and all commit hashes resolve:

- `js/state/apply/markUncompleted.js` — FOUND
- `tests/integration/apply.markUncompleted.test.js` — FOUND
- `tests/integration/apply.lastCompletedDate.test.js` — FOUND
- `tests/integration/today.tap.test.js` — FOUND
- Commits `8b42581`, `1479871`, `e9fcda3`, `1c7a5f8`, `cbfd0a0`, `33835f6` — all in `git log`.
- Full suite `node --test "tests/**/*.test.js"` exits 0 with 232 / 232.

## Next Phase Readiness

Slice 4 (plan 03-04 — undo toast surface) can now build on:

- `apply()` is the sole producer of `meta.undoToken` and emits a clean ordered log of events (`markCompleted` → `markUncompleted` → `restoreLogRow`). Verb + habit-name extraction for the toast copy (D-71) reads `event.payload.habitId` + the cached habit row's `.name`.
- `notify()` already refreshes `cache.habits` so the Settings Data card's live "Last action" preview (D-72) gets a fresh habit row to format with `formatRelative` (added in 03-01).
- Today's tap closure has a placeholder `console.warn` for the error path — Slice 4's `showErrorToast` lands there.

Slice 4 needs only the toast UI (`{autoDismissMs}` extension to `js/views/toast.js` + `showErrorToast` variant + a small `showUndoToast` wrapper that calls `undo()`); the chokepoint + cache + tap flow is now stable.

---
*Phase: 03-today-view-settings-v1-first-usable-slice*
*Completed: 2026-05-28*
