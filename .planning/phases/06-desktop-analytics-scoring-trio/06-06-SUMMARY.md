---
phase: "06"
plan: "06"
subsystem: waveboard-view
tags: [waveboard, desktop, tdd, builders, d118, scoring-snapshots, heat-map, iso-weeks]
dependency_graph:
  requires: [js/io/scoreSnapshots.js (06-02), js/state/apply.js (06-03), js/desktop.js (06-04), css/desktop.css (06-04)]
  provides: [buildWaveboardHeader, buildWaveboardRows, mountWaveboard, desktop.html#waveboard real render]
  affects: [js/desktop.js, js/views/desktop/waveboard.js]
tech_stack:
  added: []
  patterns: [pure-builder description trees (D-26 Tier 1), idempotent mount guard (D-115), store.subscribe reactive re-render, ISO week math inline, worst-status accumulator, sticky column via waveboard-sticky-column class]
key_files:
  created:
    - js/views/desktop/waveboard.js
    - tests/unit/views/desktop/waveboard.builders.test.js
  modified:
    - js/desktop.js
decisions:
  - D-118: Wave-board always uses S1 status regardless of active scoringModel — enforced by architecture; no getSetting('scoringModel') call in waveboard.js
  - ISO week key format "YYYY-Www" (e.g. "2026-W26") used as cellData map keys — zero-padded week number for correct chronological sort
  - isoWeekLabel strips year prefix ("2026-W26" → "W26") for compact grid headers
  - last12Weeks uses Set to deduplicate keys near year boundaries (ISO week math edge case)
  - Archived habits: cells always forced to N/A regardless of data — visual consistency with analytics-row--archived class (0.4 opacity)
  - store DI argument accepts { subscribe } partial object — same pattern as analytics.js (06-05)
  - Worst-status accumulator: STATUS_RANK map with Healthy=1, Watch=2, At-risk=3, Failing=4 for deterministic ordering
metrics:
  duration: "~25 min"
  completed: "2026-06-30"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  tests_added: 12
---

# Phase 06 Plan 06: Wave-Board View Summary

**One-liner:** Pure `buildWaveboardHeader` + `buildWaveboardRows` builders producing a 12-week ISO-week heat-map grid with S1 status coloring and sticky habit-name column, plus `mountWaveboard` live DOM mount with show-archived toggle, wired into `desktop.js` replacing the waveboard stub.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | 847ae4c | 12 failing tests for waveboard builders — RED confirmed (ERR_MODULE_NOT_FOUND) |
| T2 GREEN | feat | 84f1f02 | Implement waveboard.js with builders and mountWaveboard; all 12 tests pass |
| T3 | feat | 921dd52 | Wire mountWaveboard into desktop.js, replacing waveboard stub |

## What Was Built

### js/views/desktop/waveboard.js (new file)

**ISO week helpers (internal, not exported):**
- `getISOWeek(dateYMD)` — ISO 8601 week number + year from YYYY-MM-DD (Thursday-anchor algorithm)
- `isoWeekKey(dateYMD)` — "YYYY-Www" format (zero-padded, e.g. "2026-W26")
- `isoWeekLabel(key)` — "W26" short label for grid headers
- `last12Weeks(todayYMD)` — 12 ISO week keys ending at current week, deduped with Set
- `weekMonday(key)` — YYYY-MM-DD for the Monday of a week key
- `weekDays(key)` — array of 7 dates (Mon–Sun) for a week key

**Status helpers (internal):**
- `STATUS_RANK` — `{ Healthy:1, Watch:2, 'At-risk':3, Failing:4 }` for worst-status comparison
- `worstStatus(a, b)` — returns higher-rank status (worst first)
- `statusSlug(status)` — maps 'At-risk' → 'atrisk' (no hyphen in CSS modifier)

**`buildWaveboardHeader({ weeks })`:**
- Returns `{ tag: 'tr', children: [habitTh, ...weekThs] }`
- habitTh: `<th class="waveboard-sticky-column">Habit</th>`
- weekThs: one `<th>` per week with "W26" style label

**`buildWaveboardRows({ habitsByWave, cellData, weeks, showArchived })`:**
- Returns `Array<element>` (array of `<tr>` descriptions)
- Wave header rows: `<tr class="analytics-wave-header"><td colspan={N+1}>{waveName}</td></tr>`
- Habit rows: sticky name cell + one cell per week
  - Cell class: `waveboard-cell waveboard-cell--{healthy|watch|atrisk|failing|na}`
  - Cell title: `"{status} ({completed}/{applicable} days)"` or `"Not applicable"`
  - Archived habits: all cells forced to N/A, row gets `analytics-row--archived` class
  - `showArchived: false` skips archived habits entirely

**`mountWaveboard(parent, { repo, store })`:**
- Idempotency guard: `parent.dataset.mounted === 'waveboard'`
- "Show archived" toggle checkbox above the grid
- Scrollable container div with `style="overflow-x: auto"` via `setAttribute`
- Data fetch: `repo.getAllHabits()` + `repo.runTx(['score_snapshots'], 'readonly', ...)` date range query
- Accumulates worst S1 status per (habitId, isoWeekKey) from snapshot rows
- D-118: never calls scoring.js, never reads scoringModel setting
- Subscribes to `store.subscribe()` for reactivity on habit definition changes

### js/desktop.js (modified)

- Added `import { mountWaveboard } from './views/desktop/waveboard.js'`
- Updated P6 desktop imports comment to include D-118
- `'#waveboard'` route: `mountWaveboard(waveboardPanel, { repo, store: { subscribe } })` replaces `mountStub(waveboardPanel, 'Wave Board')`

### tests/unit/views/desktop/waveboard.builders.test.js (new file)

12 tests in 2 describe blocks:

**`buildWaveboardHeader` tests (4 tests):**
- Returns `<tr>` element tree
- First column header has text "Habit"
- N+1 columns for N weeks (habit name + week columns)
- Week labels "W26", "W27" for keys "2026-W26", "2026-W27"

**`buildWaveboardRows` tests (8 tests):**
- Returns an array
- Wave header row has class "analytics-wave-header"
- Healthy status cell has class "waveboard-cell--healthy"
- N/A cell has class "waveboard-cell--na" when no data
- Cell title "Healthy (7/7 days)" for 7/7 applicable days
- N/A cell title "Not applicable"
- Archived row class "analytics-row--archived" when showArchived=true
- Archived habit not rendered when showArchived=false

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Minor Adaptations

**1. [Adaptation] store DI as partial { subscribe } object**
- **Found during:** T3 wiring
- **Issue:** Plan spec says `mountWaveboard(panel, { repo, store })` but desktop.js imports individual functions from store.js, not a full store namespace object
- **Fix:** Passed `{ subscribe }` as the store argument (same pattern as analytics.js in 06-05). `mountWaveboard` only calls `store.subscribe(...)` so this minimal interface is sufficient
- **Files modified:** js/desktop.js

## Known Stubs

None. The waveboard view is fully implemented:
- `buildWaveboardHeader` and `buildWaveboardRows` are complete pure builders
- `mountWaveboard` reads real IDB data (score_snapshots range query + habits)
- `desktop.js` waveboard route calls the real mount (stub removed)
- Reactive updates via `store.subscribe` are wired

## Threat Flags

None. Changes are:
- Pure builder functions (no DOM, no network)
- DOM construction via `mount()` helper (D-78 compliant — no innerHTML)
- IDB reads only (no writes in waveboard view)
- No new network calls or auth paths

## TDD Gate Compliance

- RED gate: `test(06-06)` commit `847ae4c` — ERR_MODULE_NOT_FOUND (waveboard.js didn't exist); all 12 tests fail (RED confirmed)
- GREEN gate: `feat(06-06)` commit `84f1f02` — 12/12 waveboard builder tests passing + full suite 783/785 (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check

### Files created exist:
- js/views/desktop/waveboard.js — FOUND (buildWaveboardHeader, buildWaveboardRows, mountWaveboard exported)
- tests/unit/views/desktop/waveboard.builders.test.js — FOUND (12 tests, 2 describe blocks)

### Files modified exist:
- js/desktop.js — FOUND (mountWaveboard import added, waveboard route wired)

### Commits exist:
- 847ae4c — FOUND (test(06-06): failing tests for waveboard builders)
- 84f1f02 — FOUND (feat(06-06): waveboard builders and mountWaveboard)
- 921dd52 — FOUND (feat(06-06): wire mountWaveboard into desktop.js)

### Tests pass:
- `node --test tests/unit/views/desktop/waveboard.builders.test.js` → 12/12 pass
- Full suite: 783/785 pass (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check: PASSED
