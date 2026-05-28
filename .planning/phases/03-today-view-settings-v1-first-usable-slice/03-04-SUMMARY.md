---
phase: 03-today-view-settings-v1-first-usable-slice
plan: 04
subsystem: view
tags: [undo-toast, toast-primitive, auto-dismiss, hover-pause, single-toast, error-toast, tdd]

# Dependency graph
requires:
  - phase: 03-today-view-settings-v1-first-usable-slice
    plan: 03
    provides: "Tap-to-log chokepoint path: apply() awaits notify() so today.js can read canonical habit.name from cache post-tap; meta.undoToken populated on every mark/unmark so undo() is wired against the most recent event"
provides:
  - "`showUndoToast({message, undoFn, autoDismissMs=5000})` (D-69, D-70, D-71) — auto-dismissing toast with hover-pause + single-toast invariant; replaces any mounted toast on every new call"
  - "`showErrorToast(message)` (D-73) — 4s error-variant toast (`toast toast--error`); no action button"
  - "`_resetToastForTest()` — module-level state reset for fresh-import tests; mirrors `_resetTodayForTest` / `_resetStoreForTest`"
  - "Today tap success path now renders `showUndoToast` with D-71 verb+habit copy (`Marked <name> complete` / `Marked <name> uncomplete`); habit-name lookup happens AFTER `apply()` resolves so it reads canonical post-notify cache (Pitfall 2 alignment)"
  - "Today tap reject path now renders `showErrorToast(\"Couldn't mark — try again\")` (D-53 + D-73); the 03-03 `console.warn` placeholder is GONE"
  - "`showUpdateToast()` LOCKED D-08 contract regression-guarded: 60s of virtual clock leaves the SW-update toast mounted"
affects: [03-05 (Settings Data card imports showUndoToast/showErrorToast for the second undo surface), 04 (history view + future numeric/slot habits — toast primitive is the only user-feedback surface), all future user-feedback paths in 04+]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-toast-invariant pattern (D-70): one module-level `toastEl` + `dismissTimer`; every new `_showToast` call clears the prior toast and its timer atomically before mounting. Stale toasts never coexist with newer ones."
    - "Internal `_showToast` helper centralizes DOM construction so the three public surfaces (showUpdateToast / showUndoToast / showErrorToast) share XSS-safe createElement + textContent + setAttribute discipline (D-77, D-78)."
    - "Action-button click handler captures the closure BEFORE running `_dismissToast`, so a re-entrant timer tick cannot null out the closure between `_dismissToast` and `fn()`. Promise rejection inside `fn()` is caught and surfaced via `showErrorToast`."
    - "Habit-name lookup AFTER `await apply()` resolves: the post-notify cache is canonical, so a cross-tab name edit between tap and toast render is reflected. Pre-tap lookup would risk showing the OLD name in the Undo toast."
    - "Test-side ambient `globalThis.document` proxy: integration tests that mount a view AND let it call into toast.js stub `globalThis.document` with a getter-proxy that resolves to the per-test fake-document. Toast.js's `document.body.appendChild` then writes into the test's body without a ReferenceError."

key-files:
  created:
    - "tests/unit/toast.test.js — 13 unit tests (D-08 regression + D-69 + D-70 + D-71 + D-73 + XSS-safety grep)"
    - "tests/integration/toast.undo.test.js — 1 integration test: Toast Undo click → undo() → log row reverted"
    - "tests/integration/today.undo.test.js — 3 integration tests: D-71 verb+habit copy on success; Undo click flips row back via store.subscribe; apply() reject surfaces showErrorToast (D-73) and emits no console.warn"
  modified:
    - "js/views/toast.js — added `_showToast` internal helper + `showUndoToast` + `showErrorToast` + `_resetToastForTest`; preserved `showUpdateToast` D-08 no-auto-dismiss; XSS-safe textContent + setAttribute discipline retained"
    - "js/views/today.js — import {showUndoToast, showErrorToast} + {undo}; both tap success paths render showUndoToast with D-71 verb+habit copy; both catch paths replace console.warn with showErrorToast"
    - "tests/integration/today.tap.test.js — Rule 1 fix: 03-03 tap tests broke when 03-04 wired toast into today.js (`document is not defined`). Added beforeEach/afterEach stub of `globalThis.document`, `.remove()` on fake elements, and `toastMod._resetToastForTest()` in `freshAll()`."

key-decisions:
  - "`_showToast` lives inside `toast.js` as a non-exported internal helper rather than a sibling module. Three public exports (`showUpdateToast` / `showUndoToast` / `showErrorToast`) all delegate to it. Keeping it internal preserves the file's responsibility surface — toast.js owns DOM construction; callers own copy."
  - "`showUpdateToast()` was rewritten to delegate to `_showToast({message, action})` WITHOUT `autoDismissMs`. This preserves D-08 structurally — there is no path through `_showToast` from `showUpdateToast` that passes `autoDismissMs`, so the discipline is structural not just behavioral. The idempotent re-entry guard (`if (toastEl) return;`) is preserved."
  - "Action-button click handler captures the closure into a local `fn` BEFORE calling `_dismissToast()`. Without this capture, a re-entrant timer tick between `_dismissToast` and `fn()` could null out `toastEl` AND the closure, leaving `fn()` unreachable. The capture makes the click handler race-free against the auto-dismiss timer."
  - "Habit-name lookup happens AFTER `await apply()` resolves, NOT before the tap. The post-notify cache is canonical (per 03-03 Pitfall 2 alignment), so a cross-tab habit-rename between the tap and the toast render still renders the latest name. Pre-tap lookup risked stale names."
  - "Graceful cache-miss fallback to `(habit)` when `getCachedHabits().find(...)` returns undefined (e.g. habit was archived cross-tab during the tap). No throw, no error toast — the success toast still shows."
  - "today.tap.test.js needed a beforeEach/afterEach `globalThis.document` stub because the 03-03 tests predated today.js's dependency on toast.js. Cleanest fix: ambient proxy that resolves to the per-test fake-doc body. The alternative (refactor toast.js to accept a `document` argument) would break the production single-import shape used by every other caller."

patterns-established:
  - "Pattern: single-toast invariant via module-level `toastEl` + `dismissTimer` cleared atomically inside `_dismissToast` before the next mount."
  - "Pattern: internal `_show<X>` helper for primitives with multiple public surfaces — keeps DOM-construction discipline localized while letting callers compose copy + options."
  - "Pattern: action-closure capture before dismissal — race-free against timer-driven re-entry."
  - "Pattern: ambient `globalThis.document` proxy in view+toast integration tests — stub once per test, resolve via per-test `setAmbientDoc(fakeDoc)`."

requirements-completed: [UNDO-01, UNDO-02, UNDO-03]

# Metrics
duration: 40m
completed: 2026-05-28
---

# Phase 3 Plan 04: Undo Toast Surface Summary

**Undo toast surface is live on Today.** Every successful `markCompleted` / `markUncompleted` tap from a Today row renders a `showUndoToast` with D-71 verb+habit copy (`Marked <name> complete` / `Marked <name> uncomplete`) and an Undo action that invokes `undo()`. The 5s auto-dismiss with hover-pause works per D-69; the single-toast invariant per D-70 prevents stale toasts from coexisting with newer ones. The 03-03 `console.warn` placeholder is gone — `showErrorToast("Couldn't mark — try again")` is the user-visible feedback on apply() reject (D-53 + D-73). The locked D-08 no-auto-dismiss contract for `showUpdateToast` is regression-guarded by a fake-clock test that ticks 60s of virtual time.

Slice 5 adds the second undo surface (Settings Data card) + the rest of Settings v1.

## Performance

- **Duration:** ~40 min
- **Tasks:** 2 (both TDD: RED → GREEN per task = 4 atomic commits)
- **Files modified:** 5 (2 modified code files + 3 new test files)

## Test Counts

- **Before this plan:** 232 / 232 green at HEAD `f40bfa2`
- **After this plan:** 249 / 249 green at HEAD `0f0b5e6` (+17 new tests)
  - +13 toast unit tests (D-08 regression × 2; showUndoToast × 7; showErrorToast × 3; XSS-grep × 1)
  - +1 toast.undo integration test (Undo click → undo() → log row reverted)
  - +3 today.undo integration tests (D-71 copy; Undo flips row back; D-73 error toast on reject)

## Task Commits

Each TDD task produced one RED commit + one GREEN commit:

1. **Task 1: toast.js extensions** — `53a40b7` (test) → `79cc549` (feat)
2. **Task 2: Today wiring + tap-test fix** — `519e0c1` (test) → `0f0b5e6` (feat)

## Files Created/Modified

**Created (3 test files):**

- `tests/unit/toast.test.js` — 471 lines, 13 tests with `createFakeWindow()` + `installFakeClock()` helpers
- `tests/integration/toast.undo.test.js` — 273 lines, 1 test verifying the Pattern S7 paired-cache-bust round-trip
- `tests/integration/today.undo.test.js` — 479 lines, 3 tests using the un-tagged-modules-plus-reset pattern from 03-03's today.tap.test.js

**Modified (3):**

- `js/views/toast.js` — extended with `_showToast` + `showUndoToast` + `showErrorToast` + `_resetToastForTest`; `showUpdateToast` rewritten to delegate to `_showToast` WITHOUT `autoDismissMs` (D-08 structural guarantee)
- `js/views/today.js` — imports `showUndoToast` + `showErrorToast` + `undo`; both tap handlers render the appropriate toast on success/reject; `console.warn` placeholder removed
- `tests/integration/today.tap.test.js` — Rule 1 fix for ambient `globalThis.document` + `.remove()` on fake elements + `toastMod._resetToastForTest()` in `freshAll()`; all 4 pre-existing tests still green

## New exports surfaced

| Surface | Export | Source |
|---|---|---|
| `js/views/toast.js` | `showUndoToast` | new — D-69 + D-70 + D-71 |
| `js/views/toast.js` | `showErrorToast` | new — D-73 |
| `js/views/toast.js` | `_resetToastForTest` | new — test-only module reset |
| `js/views/toast.js` | `showUpdateToast` | UNCHANGED contract — D-08 LOCKED |

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **`_showToast` is internal, three public surfaces compose copy + options.** Caller doesn't see the helper; XSS-safe DOM construction is localized.
- **`showUpdateToast` rewritten to delegate** but explicitly does NOT pass `autoDismissMs`. D-08 is structurally guaranteed (not just behaviorally) by the absence of that argument on the update path.
- **Action-click closure captured BEFORE `_dismissToast`** so re-entrant timer tick can't null out the closure between dismiss and invoke.
- **Habit-name lookup happens after `await apply()` resolves** so the toast renders against canonical post-notify cache (Pitfall 2 alignment).
- **Graceful `(habit)` fallback** on cache miss — no throw if the habit was archived cross-tab during the tap.
- **Tests stub `globalThis.document` ambient proxy** so toast.js can run inside view tests without polyfill or DI seam. The proxy resolves to the per-test fake-doc body via `setAmbientDoc(bundle)`.

## Deviations from Plan

The plan executed faithfully with one minor adjustment:

1. **Rule 1 — fix broken pre-existing tests.** The 03-03 `tests/integration/today.tap.test.js` predated today.js's dependency on toast.js. After 03-04's GREEN landed, today.tap tests crashed with `ReferenceError: document is not defined` (toast.js's `document.body.appendChild` couldn't find a global document). Fixed by:
   - Adding `beforeEach`/`afterEach` that stub `globalThis.document` with a getter-proxy resolving to the per-test fake-doc body.
   - Adding `.remove()` to today.tap.test.js's fake makeElement (toast.js's `_dismissToast` calls `toastEl.remove()`).
   - Adding `toastMod._resetToastForTest()` to `freshAll()` so the module-level `toastEl` singleton doesn't leak between tests.

   All 4 pre-existing 03-03 today.tap tests stay green; the fix is co-located in that test file.

No other deviations. Plan executed as written; both tasks went RED → GREEN cleanly.

## Issues Encountered

- **`globalThis.document` ambient stub.** First green run of `tests/integration/today.tap.test.js` (pre-existing 03-03 tests) crashed because today.js's new `showUndoToast`/`showErrorToast` calls reached `document.body` via the global. Fixed in-test (Rule 1) with the ambient proxy pattern documented above. Future tests that mount a view+toast pair should follow the same pattern.

- **Toast singleton leakage between tests.** Without `toastMod._resetToastForTest()` in `freshAll()`, a prior test's mounted toast (`toastEl` non-null) would cause `_dismissToast` in the next test to call `.remove()` on a stale fake element from an already-discarded fake-doc. Calling `_resetToastForTest()` in every test setup (mirrors `_resetTodayForTest` / `_resetStoreForTest`) fixed it. Logged as a pattern.

No other surprises. All tests passed RED → GREEN cleanly.

## D-78 Discipline Verification

`tests/unit/discipline.xss.test.js` continues to pass. Every new and modified `.js` file under `js/` is free of `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`. The new `_showToast` helper uses `document.createElement` + `textContent` + `setAttribute` exclusively. The `tests/unit/toast.test.js` file includes its own belt-and-suspenders grep against `js/views/toast.js`.

## D-08 Regression Verification

Two dedicated tests in `tests/unit/toast.test.js`:

1. **"mounted toast survives 60 seconds of virtual time"** — calls `showUpdateToast()`, ticks the fake clock by 60_000 ms, asserts `document.body.firstChild` still references the toast. STRUCTURAL guarantee: `showUpdateToast` delegates to `_showToast` WITHOUT passing `autoDismissMs`, so no `setTimeout` is registered.
2. **"second showUpdateToast() call is a no-op (idempotent guard preserved)"** — asserts the existing P1 guard `if (toastEl) return;` survives the refactor.

## Requirements coverage

Plan frontmatter listed `[UNDO-01, UNDO-02, UNDO-03]`. Status:

- **UNDO-01** (Undo toast surface) — **complete.** `showUndoToast` ships; every Today tap success renders it; auto-dismiss + hover-pause + single-toast invariant work per D-69 / D-70.
- **UNDO-02** (Single-step undo wired to `meta.undoToken`) — **complete.** Toast's Undo button closure is `() => undo()`; `undo()` always operates on `meta.undoToken` (the most recent event); inverse `restoreLogRow` lands in the same chokepoint and the row flips back via the existing `store.subscribe()` re-render path.
- **UNDO-03** (Single-step model — most-recent action only) — **complete by construction.** D-70 single-toast invariant guarantees only one undo offer is on screen at a time; `undo()` returning `null` is silent per D-73 (the toast's action-click swallows it and renders no error).

## Known Stubs

None. The Today undo loop is end-to-end functional: tap → toast → Undo → row flips back.

One follow-on placeholder documented in 03-03 stays open (it lands in 03-05):

- **Settings Data card "Undo last action" button (D-65)** — second undo surface; lands in plan 03-05 alongside the rest of Settings v1.

## Manual smoke instructions

Open `index.html` in Firefox (or `node scripts/serve.js` + `http://localhost:8080/` for Chromium). Verify:

1. Today panel mounts; seed habits render filtered by `appliesToday`.
2. Tap any uncompleted row → row flips synchronously (NFR-02) AND a toast appears at the bottom of the viewport with text "Marked <habit name> complete" + an Undo button + a × dismiss button.
3. Wait 5 seconds without moving the cursor → toast auto-dismisses.
4. Tap another row, then hover the cursor over the toast within 5s → timer pauses (toast stays mounted for as long as you hover). Move the cursor off → fresh 5s countdown begins.
5. Tap a row, then tap another row before the first toast dismisses → only one toast is on screen; its message reflects the most recent action.
6. Tap a row, then click Undo on the toast → row flips back to uncompleted; the IDB log row in DevTools → Application → IndexedDB → habits → logs goes back to its prior state (deleted if there was no prior row, or `{completed: !current.completed}` if there was one).
7. Tap a completed row → toast says "Marked <habit> uncomplete"; Undo restores `completed: true`.
8. (Optional, advanced) Force an `apply()` reject by temporarily breaking the repo runTx and tap a row → error toast appears with "Couldn't mark — try again" and the row reverts. No `console.warn` is emitted (open DevTools console — empty).

## Self-Check: PASSED

All claimed files exist and all commit hashes resolve:

- `tests/unit/toast.test.js` — FOUND (471 lines, 13 tests)
- `tests/integration/toast.undo.test.js` — FOUND (1 test)
- `tests/integration/today.undo.test.js` — FOUND (3 tests)
- `js/views/toast.js` — MODIFIED (190 insertions, 36 deletions)
- `js/views/today.js` — MODIFIED (imports + tap handlers + JSDoc)
- `tests/integration/today.tap.test.js` — MODIFIED (Rule 1 ambient-doc stub)
- Commits `53a40b7`, `79cc549`, `519e0c1`, `0f0b5e6` — all in `git log`
- Full suite `node --test "tests/**/*.test.js"` exits 0 with 249 / 249
- D-78 grep gate green: `tests/unit/discipline.xss.test.js` passes

## Next Phase Readiness

Slice 5 (plan 03-05 — Settings v1) can now build on:

- `showUndoToast` + `showErrorToast` are stable public exports of `js/views/toast.js`. Settings Data card's "Undo last action" button can import `showUndoToast` (or `showErrorToast` on undo()-throw) directly.
- `_resetToastForTest()` is wired so Settings integration tests can adopt the same paired-cache-bust + ambient-doc pattern.
- `undo()` returning `null` is a known-silent path — Settings disables its button on `meta.undoToken === ''` rather than relying on toast-driven feedback for the no-op case.

---
*Phase: 03-today-view-settings-v1-first-usable-slice*
*Completed: 2026-05-28*
