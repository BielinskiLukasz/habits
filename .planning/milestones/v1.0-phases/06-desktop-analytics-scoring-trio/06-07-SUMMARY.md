---
phase: "06"
plan: "07"
subsystem: planning-view
tags: [planning, desktop, tdd, builders, d121, future-habits, 12-week-grid]
dependency_graph:
  requires: [js/desktop.js (06-04), css/desktop.css (06-04), js/util/date.js (03-01)]
  provides: [buildPlanningHeader, buildPlanningRows, buildPlanningEmpty, mountPlanning, desktop.html#planning real render]
  affects: [js/desktop.js, js/views/desktop/planning.js]
tech_stack:
  added: []
  patterns: [pure-builder description trees (D-26 Tier 1), idempotent mount guard (D-115), store.subscribe reactive re-render, ISO week math inline (D-121 view independence), forward 12-week window, wave grouping with only-scheduled-waves filter]
key_files:
  created:
    - js/views/desktop/planning.js
    - tests/unit/views/desktop/planning.builders.test.js
  modified:
    - js/desktop.js
decisions:
  - D-121: Planning view links each habit to ./index.html#catalog (same tab, no target="_blank")
  - computeNextNWeeks starts 7 days forward (daysFrom(today, 7)) so current week is excluded — only future weeks shown
  - ISO week helpers inlined in planning.js — intentional duplication from waveboard.js to keep views independent (D-121)
  - waveGroups pre-filtered: only waves with habits whose startDate falls within the 12-week window are rendered
  - store DI accepts { subscribe } partial object — same pattern as analytics.js (06-05) and waveboard.js (06-06)
  - buildPlanningRows places link in the week cell where startDate matches, not in the habit name cell
metrics:
  duration: "~18 min"
  completed: "2026-06-30"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  tests_added: 14
---

# Phase 06 Plan 07: Planning View Summary

**One-liner:** Pure `buildPlanningHeader` + `buildPlanningRows` + `buildPlanningEmpty` builders producing a forward-looking 12-week ISO-week grid of future habits with `./index.html#catalog` links, plus `mountPlanning` live DOM mount, wired into `desktop.js` replacing the planning stub.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | 2040bdc | 14 failing tests for planning view builders — RED confirmed (ERR_MODULE_NOT_FOUND) |
| T2 GREEN | feat | 502f8ce | Implement planning.js with builders and mountPlanning; all 14 tests pass |
| T3 | feat | dc89790 | Wire mountPlanning into desktop.js, replacing planning stub |

## What Was Built

### js/views/desktop/planning.js (new file)

**ISO week helpers (internal, not exported — D-121 view independence):**
- `getISOWeek(dateYMD)` — ISO 8601 week number + year from YYYY-MM-DD (Thursday-anchor algorithm, same as waveboard.js)
- `isoWeekKey(dateYMD)` — "YYYY-Www" format (zero-padded)
- `computeNextNWeeks(n, fromYMD)` — N future weeks starting from `daysFrom(today, 7)` (skips current week), returns `[{key, label}]`

**`buildPlanningHeader({ weeks })`:**
- Returns `{ tag: 'tr', children: [labelTh, ...weekThs] }`
- labelTh: `<th>Wave / Habit</th>` (first column)
- weekThs: one `<th>` per future week with "W27", "W28" etc. labels

**`buildPlanningRows({ waveGroups, weeks })`:**
- Returns `Array<element>` (array of `<tr>` descriptions)
- Wave header rows: `<tr class="analytics-wave-header"><td colspan={N+1}>{waveName}</td></tr>`
- Habit rows: one row per habit (not one row per wave)
  - First cell: `<td>` with habit name text
  - Week cells: `<td><a href="./index.html#catalog">{habit.name}</a></td>` when startDate's ISO week matches, `<td text="">` otherwise

**`buildPlanningEmpty()`:**
- Returns `<div class="planning-empty">` with `<h2>No upcoming habit starts</h2>` + `<p>` containing catalog link
- Catalog link: `<a href="./index.html#catalog">Catalog view</a>`

**`mountPlanning(parent, { repo, store })`:**
- Idempotency guard: `parent.dataset.mounted === 'planning'`
- Data fetch: `repo.getAllHabits()` → filter to `startDate > todayYMD && status !== 'archived'`
- Computes 12 future weeks starting from next week (current week excluded)
- Wave grouping: only waves with habits whose startDate falls in the 12-week window
- Falls back to `buildPlanningEmpty()` when no future habits OR no habits in window
- Subscribes to `store.subscribe()` for reactivity (new habits in Catalog)

### js/desktop.js (modified)

- Added `import { mountPlanning } from './views/desktop/planning.js'`
- Updated P6 imports comment to include D-121
- `'#planning'` route: `mountPlanning(planningPanel, { repo, store: { subscribe } })` replaces `mountStub(planningPanel, 'Planning')` — planning stub removed

### tests/unit/views/desktop/planning.builders.test.js (new file)

14 tests in 3 describe blocks:

**`buildPlanningHeader` tests (4 tests):**
- Returns `<tr>` element tree
- First column header has text "Wave / Habit"
- N+1 columns for N weeks
- Week labels "W27", "W28" from weeks array

**`buildPlanningRows` tests (6 tests):**
- Returns an array
- Wave group row has class "analytics-wave-header"
- Habit cell contains `<a>` element with href starting with "./index.html"
- href attribute is exactly "./index.html#catalog"
- Empty week cell is `<td>` with empty text when no habits scheduled
- Wave header count matches input waveGroups (no empty wave sections)

**`buildPlanningEmpty` tests (4 tests):**
- Heading "No upcoming habit starts" present
- Contains link to "./index.html#catalog"
- Link text is "Catalog view"
- Root element has class "planning-empty"

## Deviations from Plan

None — plan executed exactly as written.

### Minor Adaptations

**1. [Adaptation] store DI as partial { subscribe } object**
- **Found during:** T3 wiring
- **Issue:** Plan spec says `mountPlanning(panel, { repo, store })` but desktop.js imports individual functions from store.js, not a full store namespace object
- **Fix:** Passed `{ subscribe }` as the store argument (same pattern as analytics.js in 06-05 and waveboard.js in 06-06). `mountPlanning` only calls `store.subscribe(...)` so this minimal interface is sufficient
- **Files modified:** js/desktop.js

## Known Stubs

None. The planning view is fully implemented:
- `buildPlanningHeader`, `buildPlanningRows`, `buildPlanningEmpty` are complete pure builders
- `mountPlanning` reads real IDB data (habits + filter logic)
- `desktop.js` planning route calls the real mount (stub removed)
- Reactive updates via `store.subscribe` are wired

## Threat Flags

None. Changes are:
- Pure builder functions (no DOM, no network)
- DOM construction via `mount()` helper (D-78 compliant — no innerHTML in executable code)
- IDB reads only via `repo.getAllHabits()` (no writes in planning view)
- No new network calls or auth paths

## TDD Gate Compliance

- RED gate: `test(06-07)` commit `2040bdc` — ERR_MODULE_NOT_FOUND (planning.js didn't exist); all 14 tests fail (RED confirmed)
- GREEN gate: `feat(06-07)` commit `502f8ce` — 14/14 planning builder tests passing + full suite 797/799 (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check

### Files created exist:
- js/views/desktop/planning.js — FOUND (buildPlanningHeader, buildPlanningRows, buildPlanningEmpty, mountPlanning exported)
- tests/unit/views/desktop/planning.builders.test.js — FOUND (14 tests, 3 describe blocks)

### Files modified exist:
- js/desktop.js — FOUND (mountPlanning import added, planning route wired, planning stub removed)

### Commits exist:
- 2040bdc — FOUND (test(06-07): failing tests for planning view builders)
- 502f8ce — FOUND (feat(06-07): planning view builders and mountPlanning)
- dc89790 — FOUND (feat(06-07): wire mountPlanning into desktop.js)

### Tests pass:
- `node --test tests/unit/views/desktop/planning.builders.test.js` → 14/14 pass
- Full suite: 797/799 pass (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check: PASSED
