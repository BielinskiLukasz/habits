---
phase: 03-today-view-settings-v1-first-usable-slice
plan: 05
subsystem: view+state
tags: [settings-v1, set-setting-chokepoint, data-card-live-refresh, reset-d67, week-start-radio, tdd]

# Dependency graph
requires:
  - phase: 03-today-view-settings-v1-first-usable-slice
    plan: 03
    provides: "apply.configure DI seam (notify), markUncompleted handler, notify-driven cache refresh — Settings reuses the chokepoint + the D-72 refresh pipe wholesale"
  - phase: 03-today-view-settings-v1-first-usable-slice
    plan: 04
    provides: "showErrorToast (D-73) — Settings actions surface failures via the toast variant shipped in 03-04"
provides:
  - "`setSetting` chokepoint handler (`js/state/apply/setSetting.js`) — writes a settings row through `apply()`; inverse captures prior value (self-inverting per D-43); `broadcastKeys` returns `{key}` only (Pitfall 8)"
  - "`js/views/settings.js` — `mountSettings(parent, {repo, store})` + `_resetSettingsForTest`. Composes 5 cards (Storage / Schedule / Install / Data / About in D-61 locked order), subscribes to `store.notify` for D-72 live refresh of Schedule + Data cards, wires action closures (requestPersistence / setWeekStart / undoLastAction / resetData) — all writes go through `apply()` (D-75)"
  - "`js/views/settings/builders.js` — 5 pure builders (`buildStorageCard` / `buildScheduleCard` / `buildInstallCard` / `buildDataCard` / `buildAboutCard`) returning `{tag, attrs, children}` description trees; aria-labelledby on every card wrapper paired with an `<h2>` id (D-79)"
  - "`css/settings.css` — flat-card layout with destructive treatment (color + text + button shape, never color alone per NFR-07)"
  - "Reset-data D-67 SETTINGS-flavored confirm prose lives in `js/views/settings.js`; D-06 diagnostics text stays in `js/views/diagnostics.js` (intentionally distinct strings)"
  - "Pattern S5 async-load completed for Storage card (persisted + estimate) and About card (schemaVersion + cacheName + swState) — `'loading…'` initial render then `dd.textContent` mutation post-Promise"
  - "Settings panel mounts inside `<section data-route=\"settings\">` which carries a pre-mounted `<h1 tabindex=\"-1\">Settings</h1>` for router focus per D-79"
affects: [03-06 (closeout — sw.js SHELL precache list must add js/views/settings.js + js/views/settings/builders.js + js/state/apply/setSetting.js + css/settings.css per D-81), 04 (history view — same mount + subscribe pattern), all future Settings additions (the buildXCard description-tree pattern is the canonical shape for v1+)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings card composition: builders return a complete `<section class='settings-card'>` description with `aria-labelledby` paired to an `<h2 id='...'>` (D-79). mountSettings walks each desc via `mount()` and stores references for live-refresh card swaps."
    - "Live-refresh via `replaceCardChildren(cardEl, newDesc, actions)` — clears children with a `while (firstChild) removeChild(...)` loop, then re-mounts. NO `.innerHTML` (D-78). Re-applies wrapper attrs defensively in case aria-labelledby changes."
    - "Cache-first habit-name lookup for the Data card preview: read `store.getCachedHabits().find(...)` first (canonical post-notify per Pitfall 2), fall back to `repo.getHabit(habitId)`. Mirrors today.js's post-tap toast composition pattern from 03-04."
    - "D-67/D-06 confirm-string separation: SETTINGS prose lives in `js/views/settings.js` as `RESET_CONFIRM_D67`, diagnostics prose stays inline in `js/views/diagnostics.js`. Both are user-facing strings serving different audiences and are explicitly NOT kept in sync."
    - "Self-inverting setSetting handler: `inverse.type === 'setSetting'` with `payload.value = prior?.value`. Undo of the first-ever weekStart write injects `value: undefined`, which the cache hydrate path treats as 'no override — fall back to default' (acceptable per D-75 + `<specifics>` line 198)."

key-files:
  created:
    - "js/state/apply/setSetting.js — `handleSetSetting` (D-75) + `broadcastKeys` returning `{key}` only (Pitfall 8)"
    - "js/views/settings.js — `mountSettings` + `_resetSettingsForTest`; composes 5 cards, subscribes to store notify, wires action closures through the chokepoint (D-75) and `undo()` (D-65)"
    - "js/views/settings/builders.js — 5 pure builders (Pattern S8); each builder is ~20-40 lines"
    - "css/settings.css — 5-card flat layout + destructive treatment + 44px min-height on radio labels (NFR-06)"
    - "tests/integration/apply.setSetting.test.js — 6 tests (writes-through-chokepoint, inverse capture, first-ever undefined inverse, undo round-trip, broadcast keys-only, HANDLERS table includes setSetting)"
    - "tests/unit/builders.settings.test.js — 15 tests (per-card builder + ARIA + data-action + disabled-state + loading-state + a11y baseline)"
    - "tests/integration/settings.mount.test.js — 4 tests (5 cards in locked order, weekStart radio writes via apply, Undo disabled when token empty, Reset confirm uses D-67 string)"
    - "tests/integration/settings.dataCard.test.js — 1 test (cross-tab broadcast → notify-driven refresh → Data card preview re-renders with verb+habit + button enabled)"
  modified:
    - "js/state/apply.js — `import { handleSetSetting }` + HANDLERS table extended with `setSetting: handleSetSetting`"
    - "js/main.js — `import { mountSettings }` + `import * as store` so the `#settings` route can pass the store handle; route function swaps the empty-panel stub for `mountSettings(settingsPanel, {repo, store})`"
    - "index.html — `<section data-route='settings'>` now carries a pre-mounted `<h1 tabindex='-1'>Settings</h1>` so the router's `focusH1()` has a target before mountSettings finishes"
    - "css/main.css — +1 `@import url(./settings.css) layer(view);` line"

key-decisions:
  - "`setSetting` is self-inverting given the prior value. The inverse handler is `setSetting` itself with `payload.value: prior?.value`. First-ever write captures `undefined` — undo of the first-ever weekStart write writes `{key:'weekStart', value: undefined}` which the cache hydrate path treats as 'no override'. Acceptable per D-75; documented inline."
  - "D-67/D-06 confirm strings are NOT kept in sync — they serve different audiences. SETTINGS prose lives in `js/views/settings.js` near its single use site; diagnostics prose stays inline in `js/views/diagnostics.js`. A planner who wants to refactor either string must NOT propagate the change to the other file."
  - "Storage card's `requestPersistence` button is suppressed when `persisted === 'loading…'` (initial render before the async Promise resolves), not just when `persisted === true`. The mounter re-renders once the persisted Promise resolves and the button appears then if persisted is `false`. Prevents a flash of the button before its initial state is known."
  - "The Data card uses a 2-microtask settle in the cross-tab integration test (`setTimeout 0` twice). The subscriber kicks off an async `readDataCardInputs()` that is fire-and-forget from `notify()`'s perspective; the second microtask lets the inner repo lookups + DOM swap complete before the assertion. Production behavior is unchanged — the user sees the refresh within one animation frame; only the test needs to settle the queue."
  - "Settings mounter uses cache-first habit-name lookup (`store.getCachedHabits().find(...)` first, repo fallback). After the D-72 notify-driven refresh, the cache is canonical, so the read is fast and consistent with today.js's post-tap toast composition pattern from 03-04. Mirrors the same Pitfall 2 alignment."
  - "Reset-data confirm dialog declines on `false` in the test (`globalThis.confirm = () => false`) so the test never reaches `indexedDB.deleteDatabase`. The default `globalThis.indexedDB` stub in the test setup is a defensive measure for any test that does opt into the destructive path (none in this slice; future tests may)."
  - "About card uses `'controlled'` / `'registered'` / `'unsupported'` for SW state (mirrors `js/views/diagnostics.js` but does NOT include 'registered, not yet controlled' — Settings is the user-facing surface, the simpler string is acceptable). Diagnostics keeps the longer string for the DevTools workflow."

patterns-established:
  - "Pattern: 5-card flat Settings layout via composed pure builders — each card is a `<section class='settings-card' aria-labelledby='...'>` wrapping an `<h2>` + body. Future settings additions follow this shape (D-61 + D-79)."
  - "Pattern: `replaceCardChildren(cardEl, newDesc, actions)` for live-refresh card swaps — clearChildren + mount loop, no .innerHTML. Carries forward for any future per-card reactivity."
  - "Pattern: D-67/D-06 string-separation rule — user-facing prose in mounters lives near its use site, not in a shared copy file, even when two surfaces appear superficially similar. Different audiences = different strings."
  - "Pattern: Cache-first read for view-side derived state (habit name in Data card preview). The notify-driven refresh keeps the cache canonical (Pitfall 2); the view reads from there before falling back to repo."

requirements-completed: [SETTINGS-04, SETTINGS-05, PWA-07]

# Metrics
duration: 35m
completed: 2026-05-28
---

# Phase 3 Plan 05: Settings v1 First Usable Slice Summary

**Settings v1 is live with 5 cards + 2nd undo surface + setSetting through the chokepoint.** The user can navigate `#settings`, see persistence/version/cache state, flip the week-start radio (which writes through `apply()` like any other mutation and is therefore undoable), Undo the last action from the Data card (second surface alongside the 03-04 toast), and Reset all data via the D-67 SETTINGS-flavored confirm — distinct from the D-06 diagnostics prose. The Data card subscribes to `store.notify` so a peer-tab mutation re-renders the preview live (D-72). Slice 6 closes the phase: SW SHELL append, APP_VERSION bump 0.2.0 → 0.3.0, docs.

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (all TDD: RED → GREEN per task = 6 atomic commits)
- **Files modified:** 11 (3 new code files + 1 new CSS file + 3 new test files + 4 modified)

## Test Counts

- **Before this plan:** 249 / 249 green at HEAD `c92fad9`
- **After this plan:** 275 / 275 green at HEAD `656114e` (+26 new tests)
  - +6 setSetting integration tests (writes-through-chokepoint, inverse capture, first-ever undefined inverse, undo round-trip, broadcast keys-only, HANDLERS table includes setSetting)
  - +15 Settings builder unit tests (per-card + ARIA + data-action + disabled-state + loading-state + a11y baseline)
  - +4 mountSettings integration tests (locked order, weekStart writes via apply, Undo disabled when token empty, Reset confirm uses D-67)
  - +1 dataCard cross-tab live-refresh integration test (D-72)

## Task Commits

Each TDD task produced one RED commit + one GREEN commit:

1. **Task 1: setSetting handler + HANDLERS** — `092bd8b` (test) → `0cddcb4` (feat)
2. **Task 2: Pure Settings builders** — `89c4ce1` (test) → `f15da20` (feat)
3. **Task 3: mountSettings + router + CSS + index.html** — `4ae6268` (test) → `656114e` (feat)

## Files Created/Modified

**Created (8):**

- `js/state/apply/setSetting.js` — 57 lines, exports `handleSetSetting` + `broadcastKeys`
- `js/views/settings.js` — 360 lines, exports `mountSettings` + `_resetSettingsForTest`
- `js/views/settings/builders.js` — 320 lines, exports 5 pure builders
- `css/settings.css` — 78 lines, 5-card flat layout with destructive treatment
- `tests/integration/apply.setSetting.test.js` — 177 lines, 6 tests
- `tests/unit/builders.settings.test.js` — 365 lines, 15 tests
- `tests/integration/settings.mount.test.js` — 395 lines, 4 tests + fake-doc + ambient-doc proxy
- `tests/integration/settings.dataCard.test.js` — 287 lines, 1 cross-tab refresh test

**Modified (4):**

- `js/state/apply.js` — added `import { handleSetSetting }` + HANDLERS row
- `js/main.js` — added `import { mountSettings }` + `import * as store`; `#settings` route swaps stub for real mount
- `index.html` — `<section data-route='settings'>` gained pre-mounted `<h1 tabindex='-1'>Settings</h1>`
- `css/main.css` — +1 `@import` line for settings.css

## New exports surfaced

| Surface | Export | Source |
|---|---|---|
| `js/state/apply/setSetting.js` | `handleSetSetting` | new — D-75 chokepoint handler |
| `js/views/settings.js` | `mountSettings` | new — composes 5 cards, subscribes to notify |
| `js/views/settings.js` | `_resetSettingsForTest` | new — test-only module-state reset |
| `js/views/settings/builders.js` | `buildStorageCard` | new — D-62 |
| `js/views/settings/builders.js` | `buildScheduleCard` | new — D-63 |
| `js/views/settings/builders.js` | `buildInstallCard` | new — D-64, PWA-07 |
| `js/views/settings/builders.js` | `buildDataCard` | new — D-65 |
| `js/views/settings/builders.js` | `buildAboutCard` | new — D-66 |
| `js/state/apply.js` (HANDLERS) | `setSetting: handleSetSetting` | new — registers the chokepoint dispatch |

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **setSetting is self-inverting via prior value capture.** First-ever write captures `undefined`; undo writes `{value: undefined}`, which the hydrate path treats as "no override" — acceptable per D-75.
- **D-67/D-06 confirm strings stay separate.** Each prose lives near its single use site; planners refactoring one MUST NOT propagate to the other.
- **Storage card's Request persistence button is suppressed during `'loading…'`** — only appears once `persisted === false`. Prevents a button flash before initial state is known.
- **Data card uses cache-first habit-name lookup** (`store.getCachedHabits().find` → repo fallback). Mirrors today.js's post-tap toast composition pattern from 03-04 (Pitfall 2 alignment).
- **The dataCard cross-tab test needs 2 microtask settles** after `store.notify` because the subscriber's `readDataCardInputs` is fire-and-forget from `notify`'s perspective. Production behavior is unchanged.

## Deviations from Plan

The plan executed faithfully with one small Rule 1 adjustment:

1. **2-microtask settle in `tests/integration/settings.dataCard.test.js`** (Rule 1 — fix flaky timing).
   The plan's spec called for asserting Data card refresh after `await store.notify(...)`. The subscriber kicks off an async `readDataCardInputs()` that `notify` does NOT await (subscribers fire synchronously from the `for (const fn of subs)` loop). Without the extra settle, the assertion ran BEFORE the inner repo lookups + DOM swap completed. Fix: two `setTimeout(0)` resolves after the notify call. Production behavior is unchanged — the user sees the refresh within one animation frame; only the test needed to settle the queue. Logged as a key-decision.

No other deviations. All three tasks went RED → GREEN cleanly with no debugger time needed.

## Issues Encountered

- **dataCard subscriber timing.** First GREEN run of `settings.dataCard.test.js` failed: Undo button was still disabled after `await store.notify(...)`. Root cause: my subscriber returns a Promise but `store.notify` doesn't await it (subscriber fan-out is `for (const fn of subs) fn(payload)` — synchronous). The cache refresh is already complete inside notify; only my refreshLiveCards's inner repo reads were pending. Test fix (Rule 1) was sufficient; a deeper architectural change (have notify await each subscriber's returned Promise) would be a P4+ consideration if more views need the same pattern.

No other surprises. RED → GREEN cleanly across all three tasks.

## D-78 Discipline Verification

`tests/unit/discipline.xss.test.js` continues to pass. Every new file under `js/` (`setSetting.js`, `settings.js`, `settings/builders.js`) is free of `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`. The `replaceCardChildren` helper uses `while (firstChild) removeChild(...)` + `mount()` exclusively.

## apply.discipline Verification

`tests/unit/apply.discipline.test.js` continues to pass:
- HANDLERS table includes literal `setSetting: handleSetSetting`
- No `switch (` was introduced in `js/state/apply.js`
- The settings view does NOT call `repo.putSetting` directly — verified by grep (`putSetting` appears only in the JSDoc "Forbidden constructs" comment block, stripped by `readStripped` before the discipline match)

## D-75 Chokepoint Discipline Verification

Confirmed by grep on `js/views/settings.js`:
- `apply\(\{` appears 1 time — inside the `setWeekStart` action closure
- `repo.put*` — only appears in the JSDoc forbidden-constructs comment (stripped)
- No direct `_repo.putSetting` / `_repo.putHabit` calls anywhere

Settings writes flow through the chokepoint per D-75. The `setSetting` event row is in the `events` journal, `meta.undoToken` points at it, and undo() restores the prior value via the same chokepoint path.

## Requirements coverage

Plan frontmatter listed `[SETTINGS-04, SETTINGS-05, PWA-07, UNDO-01]`. Status:

- **SETTINGS-04** (persistence + version status surfaced in Settings) — **complete.** Storage card shows live `navigator.storage.persisted()` + `estimate()` via Pattern S5; About card shows APP_VERSION + Schema version + Cache name + SW state.
- **SETTINGS-05** (data management — Undo + Reset surfaced in Settings) — **complete.** Data card has Undo last action button (disabled when meta.undoToken empty; enabled with D-71 verb+habit preview) + Reset data with D-67 confirm prose.
- **PWA-07** (3 platform install instruction sections) — **complete.** Install card has labeled iOS Safari / Android Chrome / Desktop browsers subsections; no JS platform detection.
- **UNDO-01** (Undo surface) — **2nd surface complete.** The first surface (toast) shipped in 03-04; this slice ships the Data card Undo button.

The 17 requirements in scope for Phase 3 — CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07 — are now functionally implemented except for the closeout NFR / docs items that 03-06 handles.

## Known Stubs

None that block this plan's goal. The Settings panel is fully interactive: every card renders, the radio writes through the chokepoint, the Undo button works, the Reset confirm uses D-67 prose, and the cross-tab refresh fires the Data card preview.

One placeholder documented in code is intentional:
- `loadAboutStateAsync` uses `'registered'` (NOT `'registered, not yet controlled'`) for the SW state. Diagnostics keeps the longer string; Settings is the user-facing surface where the shorter string is sufficient. Logged as a key-decision.

The `BeforeInstallPromptEvent` capture for a programmatic install button stays deferred per `<deferred>` in 03-CONTEXT.md.

## Manual smoke instructions

Open `index.html` in Firefox (or `node scripts/serve.js` + `http://localhost:8080/` for Chromium). Verify:

1. Today panel mounts as the initial route (Phase 03 plans 02..04 still green).
2. Click the `settings` footer link (or navigate to `index.html#settings`) — the Settings panel mounts. Heading shows `Settings`. Five cards in order: Storage / Schedule / Install / Data / About (DevTools → Inspect → confirm 5 `<section class="settings-card">` elements in that order).
3. **Storage card** — shows `Persistent: yes` (or `no`); if `no`, click `Request persistence` and the browser's prompt appears. After granting (or denying), the value refreshes. Estimate line shows `Using X.X MB of ~Y MB`.
4. **Schedule card** — click the `Sunday` radio. The week-start setting flips. Open DevTools → Application → IndexedDB → habits → settings → confirm `{key: 'weekStart', value: 'sun'}` row. Open a second tab to `index.html#settings` → confirm the Sunday radio is also selected (cross-tab refresh via D-72).
5. **Install card** — shows 3 labeled subsections (iOS Safari / Android Chrome / Desktop browsers) with platform-appropriate copy.
6. **Data card** — initially says `Nothing to undo.` and the Undo button is disabled (when no prior action). Tap a habit on Today to create a markCompleted event, return to Settings, and verify the preview reads `Last: marked <habit> complete · <relative-time>` and the Undo button is now enabled. Click Undo — the row reverts on Today.
7. **Reset data** — click the red Reset data button. Confirm dialog reads `This will delete all your habits and history. Cannot be undone. Continue?` (D-67, NOT the D-06 diagnostics prose). Cancel — nothing happens. Accept — IDB database is deleted, page reloads, seed re-seeds.
8. **About card** — shows App version `0.2.0` (will bump to `0.3.0` in 03-06), Schema version `1`, Cache name `habits-0.2.0` (when running over HTTP — `none` on file://), Service worker `controlled` / `registered` / `unsupported`.
9. **Focus management** — navigate via the footer-nav. On hashchange, the new panel's `<h1>` receives keyboard focus (D-79). Visible in DevTools → Accessibility tree.

## Self-Check: PASSED

All claimed files exist and all commit hashes resolve:

- `js/state/apply/setSetting.js` — FOUND
- `js/views/settings.js` — FOUND
- `js/views/settings/builders.js` — FOUND
- `css/settings.css` — FOUND
- `tests/integration/apply.setSetting.test.js` — FOUND (6 tests)
- `tests/unit/builders.settings.test.js` — FOUND (15 tests)
- `tests/integration/settings.mount.test.js` — FOUND (4 tests)
- `tests/integration/settings.dataCard.test.js` — FOUND (1 test)
- Commits `092bd8b`, `0cddcb4`, `89c4ce1`, `f15da20`, `4ae6268`, `656114e` — all in `git log`
- Full suite `node --test "tests/**/*.test.js"` exits 0 with 275 / 275 green at HEAD `656114e`
- D-78 grep gate green: `tests/unit/discipline.xss.test.js` passes
- apply.discipline green: `tests/unit/apply.discipline.test.js` passes
- D-75 chokepoint discipline verified by grep: no `repo.put*` in `js/views/settings.js` outside the JSDoc forbidden-constructs comment

## Next Phase Readiness

Slice 6 (plan 03-06 — closeout) can now build on:

- All 17 P3 requirements in scope are functionally complete except docs / version-bump items.
- `sw.js` SHELL list needs the new files appended per D-81:
  - `js/state/apply/setSetting.js`
  - `js/views/settings.js`
  - `js/views/settings/builders.js`
  - `css/settings.css`
  (Already in SHELL from prior slices: `js/router.js`, `js/views/today.js`, `js/views/today/builders.js`, `js/views/toast.js`, `js/state/apply/markUncompleted.js`, `js/domain/cadence.js`, `js/domain/wave.js`, `js/util/mount.js`.)
- `APP_VERSION` bump 0.2.0 → 0.3.0 in `js/util/version.js` (D-28 MINOR-on-phase-completion convention).
- SW activate handler already deletes prior `habits-*` caches — no changes needed beyond the version bump.
- Docs: SUMMARY review + PHASE-COMPLETION.md write per the closeout plan.

---
*Phase: 03-today-view-settings-v1-first-usable-slice*
*Completed: 2026-05-28*
