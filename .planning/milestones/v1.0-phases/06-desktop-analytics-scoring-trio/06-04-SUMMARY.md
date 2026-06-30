---
phase: "06"
plan: "04"
subsystem: desktop-shell
tags: [desktop, router, css, tdd, hash-routing, scoring-tokens]
dependency_graph:
  requires: [js/router.js (03-02), js/state/store.js, js/domain/wave.js, js/io/scoreSnapshots.js (06-02), js/state/apply.js (06-03)]
  provides: [desktop.html full shell, css/desktop.css layout+scoring, router.js defaultRoute, desktop.js route dispatch]
  affects: [desktop.html, js/router.js, css/tokens.css, js/desktop.js]
tech_stack:
  added: [css/desktop.css]
  patterns: [hash-router defaultRoute param, sidebar+panels shell, stub view mounts, HTML hidden attribute panel toggle]
key_files:
  created:
    - css/desktop.css
  modified:
    - tests/unit/router.test.js
    - js/router.js
    - css/tokens.css
    - desktop.html
    - js/desktop.js
decisions:
  - defaultRoute='#today' default in mountRoutes preserves full backward compat for mobile main.js
  - Stub view mounts are idempotent (data-stub guard) — plans 06-05/06-06/06-07 replace them
  - desktop.js imports configureStore from store.js (already exported); no new export needed
  - css/desktop.css linked only from desktop.html; not from index.html (mobile shell)
  - Score status tokens added to tokens.css so both shells can reference them
metrics:
  duration: "~18 min"
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 1
  files_modified: 5
  tests_added: 2
---

# Phase 06 Plan 04: Desktop Shell — HTML Structure, Router Extension, CSS Layout Summary

**One-liner:** Full `desktop.html` sidebar+panels shell, `css/desktop.css` with desktop-layout and desktop-scoring layers, `router.js` `defaultRoute` parameter with TDD gate, and `desktop.js` route dispatch with idempotent stub view mounts.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | ffcdb5f | 2 new failing tests for mountRoutes defaultRoute parameter — RED confirmed (1 fail: custom defaultRoute resolution) |
| T1 GREEN | feat | 5a30b4d | router.js defaultRoute param, tokens.css score tokens, desktop.html full shell, css/desktop.css new file |
| T2 | feat | e98445f | desktop.js full P6 route dispatch with show/focusH1/updateNav/mountStub helpers |

## What Was Built

### js/router.js

**`defaultRoute` parameter added to `mountRoutes`:**
- Destructured parameter `defaultRoute = '#today'` (backward-compatible default)
- `const raw = win.location.hash || defaultRoute` replaces hardcoded `'#today'`
- `const hash = routes[raw] ? raw : defaultRoute` replaces hardcoded fallback
- Updated JSDoc to document the new optional `@param` field
- Mobile `main.js` does NOT pass `defaultRoute` → behavior unchanged (`'#today'`)
- Desktop `desktop.js` passes `defaultRoute: '#analytics'`

### css/tokens.css

**5 scoring status custom properties added (D-119):**
- `--color-score-healthy: #10b981`
- `--color-score-watch: #f59e0b`
- `--color-score-atrisk: #f97316`
- `--color-score-failing: #ef4444`
- `--color-score-na: #6b7280`

### desktop.html

**Full sidebar+panels shell replacing the `<main class="stub">` stub (D-115):**
- Title updated: "Habits — Desktop Analytics"
- `<link rel="stylesheet" href="./css/desktop.css">` added after `css/main.css`
- `<header class="desktop-header">` with `<h1 class="desktop-title">Habit Analytics</h1>`
- `<div class="desktop-layout">` with `.desktop-sidebar` nav and `.desktop-main`
- Sidebar has 3 `<a href="#...">` links with `data-route-link` attributes
- 3 `<section data-route="...">` panels; analytics is visible, waveboard and planning carry `hidden`
- Each section has pre-placed `<h1 tabindex="-1">` for D-79 focusH1 pattern

### css/desktop.css (new file)

**`@layer desktop-layout`:**
- `.desktop-layout` — flex two-column shell (`height: calc(100vh - 49px)`)
- `.desktop-sidebar` — 200px fixed-width, sticky, overflow-y scroll
- `.desktop-sidebar-link` — min 44px tap target, hover/focus/aria-current styles
- `.desktop-main` — flex-grow scroll area with padding
- `.route-panel` — `display: block`; `.route-panel[hidden]` — `display: none`
- `.desktop-header` / `.desktop-title` — header chrome

**`@layer desktop-scoring`:**
- `.score-badge` and `--healthy/--watch/--atrisk/--failing/--na` modifier classes
- `.waveboard-cell` and modifier classes (40×40 flex cells)
- `.waveboard-grid` / `.waveboard-sticky-column` — heat-map grid scaffolding
- `.analytics-table` — full-width collapsible table with wave-header variant
- `.analytics-row--archived` — 0.4 opacity for archived habits
- `.planning-grid` / `.planning-cell--scheduled` — planning week grid cells
- `.settings-desktop-link` — accent-colored link to Settings (already used in plan 06-03)

### js/desktop.js

**Full P6 route dispatch extending P2 spine boot:**
- New imports: `mountRoutes`, `configureWave`, `bootWaves`, `configureStore`
- `configureWave({ fetch: globalThis.fetch })` + `configureStore({ repo })` called after hydrate
- `await bootWaves()` inside try/catch (non-fatal)
- Panel queries: `analyticsPanel`, `waveboardPanel`, `planningPanel`, `sidebarLinks`
- `show(panel)` — toggles `hidden` on all panels
- `focusH1(panel)` — focuses `h1` inside active panel (D-79)
- `updateNav(hash)` — sets `aria-current="page"` on matching sidebar link
- `mountStub(panel, label)` — idempotent stub mounter (data-stub guard)
- `mountRoutes({ routes: {...}, onChange: updateNav, defaultRoute: '#analytics' })`
- D-78 gate passed: no `innerHTML` in production code

### tests/unit/router.test.js

**2 new test cases in new describe block `mountRoutes — defaultRoute parameter`:**
- Custom `defaultRoute: '#analytics'` falls back for unknown hash (was RED before router.js change)
- No `defaultRoute` param still falls back to `#today` (backward compat regression guard)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following stubs are intentional and tracked:

| Stub | File | Line | Reason |
|------|------|------|--------|
| `mountStub(analyticsPanel, 'Analytics')` | js/desktop.js | analytics route fn | Replaced by `mountAnalytics()` in plan 06-05 |
| `mountStub(waveboardPanel, 'Wave Board')` | js/desktop.js | waveboard route fn | Replaced by `mountWaveboard()` in plan 06-06 |
| `mountStub(planningPanel, 'Planning')` | js/desktop.js | planning route fn | Replaced by `mountPlanning()` in plan 06-07 |

These stubs do not prevent the plan's goal from being achieved — the shell, layout, routing, and CSS are all production-ready. The stub content is replaced incrementally in Wave 3 plans.

## Threat Flags

None. Changes are:
- CSS files and HTML structure (no trust boundaries)
- Router parameter extension (additive, backward-compatible)
- `desktop.js` DOM queries and hash routing (no new network calls or auth paths)
- All DOM construction uses `createElement` + `textContent` + `setAttribute` (D-78 compliant)

## TDD Gate Compliance

- RED gate: `test(06-04)` commit `ffcdb5f` — 1 failing test (custom defaultRoute TypeError — RED confirmed)
- GREEN gate: `feat(06-04)` commit `5a30b4d` — 10/10 router tests passing + full suite 755/757

## Self-Check

### Files created exist:
- css/desktop.css — FOUND (.desktop-sidebar, .waveboard-cell, .analytics-table, .planning-grid)

### Files modified exist:
- tests/unit/router.test.js — FOUND (2 new defaultRoute tests)
- js/router.js — FOUND (defaultRoute param added)
- css/tokens.css — FOUND (--color-score-healthy through --color-score-na)
- desktop.html — FOUND (section data-route="analytics", waveboard hidden, planning hidden, css/desktop.css link)
- js/desktop.js — FOUND (mountRoutes + show + focusH1 + updateNav + mountStub)

### Commits exist:
- ffcdb5f — FOUND (test(06-04): failing tests for mountRoutes defaultRoute parameter)
- 5a30b4d — FOUND (feat(06-04): desktop shell HTML/CSS, router defaultRoute, scoring status tokens)
- e98445f — FOUND (feat(06-04): desktop.js route dispatch with stub view mounts)

### Tests pass:
- `node --test tests/unit/router.test.js` → 10/10 pass
- Full suite: 755/757 pass (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check: PASSED
