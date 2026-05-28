---
phase: 03-today-view-settings-v1-first-usable-slice
plan: 02
subsystem: view
tags: [today-view, hash-router, builders, store-hydrate, cadence-filter, a11y, tdd]

# Dependency graph
requires:
  - phase: 03-today-view-settings-v1-first-usable-slice
    plan: 01
    provides: "appliesToday resolver, currentWave catalog, mount() helper, isoWeekStart/End + daysBetween + formatRelative, getAllHabits + getLogsInRange, D-78 grep gate"
provides:
  - "Hash router `mountRoutes({routes, onChange, target})` with allowlist resolution and idempotent re-mount (D-60, D-80, T-03-06 mitigated)"
  - "Pure description-tree builders `buildTodayHeader` / `buildFooterNav` / `buildTodayRow` / `buildTodayList` + `_formatTodayDate` (D-54, D-55, D-56, D-58, D-76, D-79, D-80)"
  - "Expanded store cache: habits + this-week logs + weekStart, with selectors `getCachedHabits` / `getCachedLog` / `getCachedWeekStart` / `getCachedWeekCompletions` (D-52, NFR-01 single bounded read)"
  - "`mountToday(parent)` view mounter — subscribe + render + return unmount; cadence-filtered ordered list with empty/all-done branches"
  - "`mountFooterNav(navEl, activeHash)` footer-nav refresh helper, called by router onChange"
  - "Three-section route panel shell in index.html + CSS framework (`.route-panel`, `.today-row`, ✓ glyph, 44×44 tap targets, aria-current / aria-disabled treatment)"
affects: [03-03 (tap wiring lands on top of existing rows), 03-05 (Settings mounts into the existing settings panel), 04 (history view fills the existing history panel), all future views (mountFooterNav is the canonical aria-current refresher)]

# Tech tracking
tech-stack:
  added:
    - "js/views/today/ (new directory; first subdirectory under js/views/)"
    - "Route-panel shell pattern (`<section data-route=\"x\">` + hidden attr + focus-on-route-change)"
  patterns:
    - "Description-tree → mount() flow now wires its first view (Today)"
    - "Cache-driven render (cadence resolver pulls from `cache.logs` via `getCachedWeekCompletions`, never IDB)"
    - "Idempotent view mounter (Pattern S4) with subscribe-returns-unsubscribe"
    - "Long-press attach re-binding inside route function (h1 is rebuilt every render)"

key-files:
  created:
    - "js/router.js — hash router with allowlist resolution + idempotent re-mount"
    - "js/views/today.js — mountToday + mountFooterNav + clearChildren helper"
    - "js/views/today/builders.js — 4 builders + _formatTodayDate"
    - "tests/unit/router.test.js — 8 router behaviors"
    - "tests/unit/builders.today.test.js — 19 builder behaviors"
    - "tests/unit/store.hydrate.test.js — 8 store-hydrate behaviors"
  modified:
    - "js/state/store.js — configureStore DI + cache.settings + 4 new selectors + _resetStoreForTest"
    - "js/main.js — configureWave + configureStore + bootWaves + mountRoutes with 3 routes; long-press attach moved into #today route fn"
    - "index.html — three <section data-route> panels + empty footer-nav; static header/h1/nav removed"
    - "css/today.css — .route-panel framework + .today-row states + 44px tap targets + aria-current / aria-disabled treatment + .today-empty"
    - "tests/helpers/fake-document.js — new createFakeWindow helper with _listeners introspection"

key-decisions:
  - "mountToday is idempotent-by-rerender: second call without unmount re-renders into the (possibly different) parent without registering a duplicate store subscription. This matches the rest of the codebase's Pattern-S4 guard and avoids a footgun where two #today route invocations would double-subscribe."
  - "mountFooterNav writes the aria-label onto the existing <nav> element rather than wrapping it in another <nav>. The builder returns a <nav> description (consistent for Tier 1 testing), but the mounter peels off the outer tag to avoid nav-inside-nav semantics. Alternative was renaming the builder to return a fragment-style shape, which would have made the unit test more abstract; the current shape keeps both halves readable."
  - "Long-press attach for the diagnostics title moves INSIDE the #today route function. The h1 is now part of the buildTodayHeader description tree, so it does not exist at module-load time. Re-attaching on every #today route fire is cheap (~25 lines of listener registration) and keeps the gesture functional across route round-trips."
  - "Three-section panel shell uses HTML `hidden` attribute (NOT a CSS-class toggle). Browsers treat `hidden` as removed from the accessibility tree, which matches the D-79 intent that hidden routes are not keyboard-reachable. CSS `.route-panel[hidden] { display: none; }` is purely defensive."
  - "buildTodayList's empty-state branching keys off `habits.length === 0` + `allCompleted` to disambiguate the two empty states (D-58). The all-done counter renders `${totalApplicable} of ${totalApplicable}` rather than reading a separate `completed` count — totalApplicable is the only number the caller needs to pass."

patterns-established:
  - "Pattern: view mounter contract — `mount<View>(parent) → unmount()` with idempotent re-entry guard + store.subscribe inside. Settings will follow this in Slice 4."
  - "Pattern: route panel shell — `<section data-route=\"x\">` + `hidden` toggle + focus-on-route-change. Future views (history, catalog, desktop) inherit."
  - "Pattern: builder returns a complete description, including the outer tag. Mounters can either pass it whole to `mount()` (Today panel) or peel-and-mount-children when the outer element pre-exists (footer-nav)."

requirements-completed: [CORE-01, CORE-04, CORE-05, CORE-06]

# Metrics
duration: 22m
completed: 2026-05-28
---

# Phase 3 Plan 02: Today View First Render Summary

**The Today view renders.** Hash router (`#today` / `#settings` / `#history`), 4 pure description-tree builders, expanded store cache with cadence-context selectors, `mountToday` view mounter wired to `apply.js`'s notify chokepoint, and a three-section route panel shell. Read-only — tap wiring lands in Slice 3.

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-28T09:24:46Z
- **Completed:** 2026-05-28T09:46:38Z
- **Tasks:** 4 (2 TDD → 4 atomic commits, 2 auto → 2 atomic commits = 6 task commits)
- **Files modified:** 9 (3 new code files + 3 new test files + 4 modified)

## Test Counts

- **Before this plan:** 174 / 174 green at HEAD `c2ee840`
- **After this plan:** 209 / 209 green at HEAD `0c70e5b` (+35 new tests)
  - +8 router tests
  - +19 builder tests
  - +8 store-hydrate tests

## Accomplishments

- `js/router.js` — Hash router with allowlist resolution (`routes[hash] ? hash : '#today'`) so spoofed URLs cannot navigate to unsanctioned panels (T-03-06 mitigated). Idempotent re-mount via `_mounted` flag. `file://`-safe (uses `hashchange`, never `history.pushState`).
- `js/views/today/builders.js` — Five exports: `_formatTodayDate`, `buildTodayHeader`, `buildFooterNav`, `buildTodayRow`, `buildTodayList`. All pure functions returning `{tag, attrs?, text?, children?}` descriptions. Locale-deterministic date format via fixed `WEEKDAY_SHORT` / `MONTH_SHORT` arrays (no `Intl`).
- `js/views/today.js` — `mountToday(parent)` performs cadence-filtered render, subscribes to `store.notify`, returns `unmount()` closure. Completed habits sort last (D-54). Three empty-state branches per D-58. `mountFooterNav(navEl, hash)` refreshes the aria-current attribute on route changes.
- `js/state/store.js` — Cache expanded with `cache.settings` Map + 4 new selectors (`getCachedHabits`, `getCachedLog`, `getCachedWeekStart`, `getCachedWeekCompletions`). `configureStore({repo})` DI seam. `hydrate()` reads weekStart, this-week logs (`getLogsInRange`), and the full habit catalog — a single bounded read (NFR-01).
- `index.html` — Three `<section data-route>` panels + empty footer-nav. Static `<header>` / `<h1>` / `<nav>` markup removed; rebuilt by `buildTodayHeader` on every Today mount.
- `js/main.js` — Boot order extended: `configureWave({fetch})` + `configureStore({repo})` before `bootSeed()`, `await bootWaves()` after hydrate, `mountRoutes(...)` with three route functions. Long-press attach moved INSIDE the `#today` route fn so it re-binds to each freshly-rendered h1.
- `css/today.css` — `.route-panel` + `[hidden]` framework, `.today-row` / `.today-row--completed` states, `.today-row-tap` (44×44 px tap targets — NFR-06), `.today-row-glyph` (✓), `.today-row-info` (ⓘ, 44px min), `.today-empty` / `.today-counter` (D-58), `[aria-current="page"]` boldface (D-79), `[aria-disabled="true"]` muted+pointer-events:none (D-80).
- `tests/helpers/fake-document.js` extended with `createFakeWindow({hash})` exposing `_listeners` introspection so router idempotency can be asserted in Node.

## Task Commits

Each TDD task produced one RED commit + one GREEN commit; each auto task produced one feat commit:

1. **Task 1 (TDD): Hash router** — `63a5b47` (test) → `2c7a1ec` (feat)
2. **Task 2 (TDD): Today builders** — `06bd1e3` (test) → `eb2a6b0` (feat)
3. **Task 3 (auto): Expand store cache** — `a7b0952` (feat including 8 tests)
4. **Task 4 (auto): mountToday + router wiring + index.html + CSS** — `0c70e5b` (feat)

## Files Created/Modified

**Created (6):**

- `js/router.js` — 88 lines, exports `mountRoutes` + `_resetRouterForTest`
- `js/views/today.js` — 175 lines, exports `mountToday` + `mountFooterNav` + `_resetTodayForTest`
- `js/views/today/builders.js` — 230 lines, exports `_formatTodayDate`, `buildTodayHeader`, `buildFooterNav`, `buildTodayRow`, `buildTodayList`
- `tests/unit/router.test.js` — 8 tests across 3 describes
- `tests/unit/builders.today.test.js` — 19 tests across 6 describes
- `tests/unit/store.hydrate.test.js` — 8 tests across 2 describes

**Modified (5):**

- `js/state/store.js` — added `configureStore`, `cache.settings`, 4 selectors, `_resetStoreForTest`, extended file header
- `js/main.js` — added P3 router + view + waveboot wiring; reorganized boot order; moved long-press attach inside route fn
- `index.html` — replaced static header/list/nav with three `<section data-route>` panels + empty footer-nav
- `css/today.css` — added route-panel framework, today-row states, tap-target sizing, aria-current/aria-disabled treatment, empty-state styling
- `tests/helpers/fake-document.js` — added `createFakeWindow` helper with `_listeners` introspection

## New exports surfaced (10 total)

| Surface | Export | Source |
|---|---|---|
| `js/router.js` | `mountRoutes` | new — hash router with allowlist fallback |
| `js/router.js` | `_resetRouterForTest` | new — test-only module-state reset |
| `js/views/today.js` | `mountToday` | new — view mounter with subscribe + unmount |
| `js/views/today.js` | `mountFooterNav` | new — footer-nav aria-current refresher |
| `js/views/today.js` | `_resetTodayForTest` | new — test-only module-state reset |
| `js/views/today/builders.js` | `_formatTodayDate` | new — `'Wed 27 May'` formatter |
| `js/views/today/builders.js` | `buildTodayHeader` | new — header description |
| `js/views/today/builders.js` | `buildFooterNav` | new — footer-nav description |
| `js/views/today/builders.js` | `buildTodayRow` | new — row description with optional ⓘ |
| `js/views/today/builders.js` | `buildTodayList` | new — list with 3 branches per D-58 |
| `js/state/store.js` | `configureStore` | new — DI seam |
| `js/state/store.js` | `getCachedHabits` | new — defensive copy of cached habits |
| `js/state/store.js` | `getCachedLog` | new — `(habitId, date)` lookup |
| `js/state/store.js` | `getCachedWeekStart` | new — `'mon'`-default selector |
| `js/state/store.js` | `getCachedWeekCompletions` | new — completed-true range count |
| `js/state/store.js` | `_resetStoreForTest` | new — test-only module-state reset |

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **mountToday is idempotent-by-rerender** — second call re-renders against the live parent without re-subscribing.
- **mountFooterNav peels the outer `<nav>` tag** — builders consistently return a complete description (including the outer tag) for Tier 1 testability; the mounter writes attributes onto the existing element and mounts only the children, avoiding `<nav>` inside `<nav>`.
- **Long-press diagnostics trigger lives inside the `#today` route fn** — the h1 is rebuilt by the builder on every render, so the attach must follow each mount. Cheap (~25 lines of listener wiring) and keeps the gesture working across route round-trips.
- **Route panel shell uses HTML `hidden` (not a class toggle)** — `hidden` removes the panel from the a11y tree, which matches D-79 intent that hidden routes are not keyboard-reachable.

## Deviations from Plan

None — plan executed exactly as written.

(Two minor stylistic shapes the plan flagged as planner discretion that I resolved:
1. `createFakeWindow` lives in `tests/helpers/fake-document.js` alongside `createFakeDocument` rather than a sibling `tests/helpers/fake-window.js` — the plan said "or" between the two options. Co-location keeps the test-DOM helpers in one file.
2. `mountFooterNav` re-uses `buildFooterNav` then peels the outer `<nav>` tag at mount time, rather than introducing a fragment-style builder shape. Both worked; the chosen path preserved the symmetry of all builders returning a complete description.)

## Issues Encountered

None. All tests passed RED → GREEN cleanly; no debugging required.

## D-78 Discipline Verification

The discipline test `tests/unit/discipline.xss.test.js` grepped every `.js` file under `js/` for `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write` and found zero violations. The new files (`js/router.js`, `js/views/today.js`, `js/views/today/builders.js`) construct DOM exclusively through `mount()` (the canonical D-77 helper). `clearChildren` in `js/views/today.js` loops `removeChild` rather than `parent.innerHTML = ''`.

## Requirements coverage

Plan frontmatter listed `[CORE-01, CORE-04, CORE-05, CORE-06, NFR-01, NFR-06, NFR-07]`. Status:

- **CORE-01** (mobile Today is the cold-paint landing page) — **complete.** index.html boots straight into the Today route; hash router fallback resolves empty / unknown hashes to `#today`.
- **CORE-04** (cadence rules filter Today) — **complete.** `appliesToday` runs per habit per render against the cached week's logs + weekStart.
- **CORE-05** (today's date + current wave on Today) — **complete.** `buildTodayHeader` renders `'Wed 27 May'` + `'Wave 4'` from `currentWave(todayLocal())`.
- **CORE-06** (no spinner-blocked paint) — **complete.** Render runs synchronously after `await hydrate()` completes; no view-level async dependency in the render path.
- **NFR-01** (<300 ms cold paint with 1 year of data) — **enabled.** `hydrate()` does a single bounded `getLogsInRange(wkStart, wkEnd)` + a single `getAllHabits()` scan. Builders are pure-CPU. Actual cold-paint measurement happens during Slice 5's UAT.
- **NFR-06** (44×44 px tap targets) — **complete in CSS.** `.today-row-tap` and `.today-row-info` both `min-height: 44px` (the info button also `min-width: 44px`).
- **NFR-07** (no color-only state encoding) — **complete.** Completed rows pair the ✓ glyph with strikethrough on the name, opacity 0.55 on the row, AND `aria-pressed="true"` on the button. Active nav link pairs boldface with `aria-current="page"`. Disabled history link pairs opacity 0.4 with `aria-disabled="true"`.

`requirements-completed` frontmatter lists the four CORE items that are now functionally implemented end-to-end. NFR-01 / NFR-06 / NFR-07 are infrastructure enablers — their final UAT verification lands at Phase 03 closeout.

## Known Stubs

The Today rows emit `data-action="markComplete"` / `data-action="markUncomplete"` / `data-action="togglePolish"` attributes, but the `actions` map passed to `mount()` is empty — tap handlers are intentionally NOT wired in this slice. This is documented behavior per the plan's `<objective>` ("Taps are NOT wired in this slice — Today is read-only here") and is the explicit scope of Slice 3 (plan 03-03).

The Settings route shows an empty panel (no h1, no content). This is intentional — Slice 4 (plan 03-05) populates it. The router still hands off to the panel + moves focus, exercising the focus-management code path. Settings deep-link (`index.html#settings`) lands on the empty panel.

The History route renders an h1 + placeholder `<p>` ("History view ships in Phase 4."). The disabled-link semantics in the footer-nav (D-80) prevent normal navigation; deep-linking via URL still works (and renders the placeholder).

None of these stubs prevent the plan's goal. The plan ships **"the Today view renders"**, which is fully done.

## Manual smoke instructions

Open `index.html` in Firefox (or `node scripts/serve.js` + `http://localhost:8080/` for Chromium). Verify:

1. The Today panel mounts as the initial route — header shows `Habits`, today's date in `'Wed 27 May'` format, and the wave label `'Wave 4'`.
2. The seed's 8 habits are filtered by `appliesToday`. Daily habits show every day. Weekly habits show until a `completed:true` log lands within the current ISO week. (No logs yet on first boot, so weekly habits appear.) Every-N-days habits show when the anchor (`lastCompletedDate` or `createdAt`) is at least N days ago.
3. Each row carries `aria-pressed="false"` (use DevTools or the screen-reader inspector to verify). The button's `data-action` attribute is `markComplete`. No taps fire yet — clicking does nothing (Slice 3 wires this).
4. The footer-nav has three links (`today` / `history` / `settings`). The `today` link carries `aria-current="page"` and is boldfaced.
5. `index.html#settings` deep-links to the empty Settings panel (no content yet — Slice 4 fills it).
6. `index.html#history` shows the placeholder panel with `'History view ships in Phase 4.'` The history link in the footer is muted + non-clickable (D-80).
7. `index.html#unknown` falls back to Today (allowlist resolution).
8. Long-press the `Habits` title for 1.5 seconds — diagnostics panel still mounts (the long-press attach re-binds on every Today mount).

## Self-Check: PASSED

All claimed files exist and all commit hashes resolve:

- `js/router.js` — FOUND
- `js/views/today.js` — FOUND
- `js/views/today/builders.js` — FOUND
- `tests/unit/router.test.js` — FOUND
- `tests/unit/builders.today.test.js` — FOUND
- `tests/unit/store.hydrate.test.js` — FOUND
- Commits `63a5b47`, `2c7a1ec`, `06bd1e3`, `eb2a6b0`, `a7b0952`, `0c70e5b` — all in `git log`.

## Next Phase Readiness

Slice 3 (plan 03-03 — tap-to-mark/unmark + persistent undo) can now build on top of:

- `import { mount } from '../util/mount.js'` — the actions map will carry the `markComplete` / `markUncomplete` closures.
- `import { buildTodayRow } from '../views/today/builders.js'` — `data-action` attributes already emitted, no builder change needed.
- `import { apply } from '../state/apply.js'` — `markCompleted` handler exists from P2; `markUncompleted` handler is the new addition (D-74).
- `import { showUndoToast } from '../views/toast.js'` — the toast lives in P3 plan 03-04.

The view subscription path (`store.subscribe(rerender)`) is already wired in `mountToday`, so Slice 3's `apply()` calls will naturally re-render through the chokepoint. No additional store changes needed.

---
*Phase: 03-today-view-settings-v1-first-usable-slice*
*Completed: 2026-05-28*
