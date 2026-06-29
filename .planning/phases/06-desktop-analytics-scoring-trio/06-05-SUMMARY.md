---
phase: "06"
plan: "05"
subsystem: analytics-view
tags: [analytics, desktop, tdd, builders, d116, scoring-snapshots, wave-aggregates]
dependency_graph:
  requires: [js/io/scoreSnapshots.js (06-02), js/state/apply.js (06-03), js/desktop.js (06-04), css/desktop.css (06-04)]
  provides: [buildAnalyticsHeader, buildAnalyticsTable, mountAnalytics, desktop.html#analytics real render]
  affects: [js/desktop.js, js/views/desktop/analytics.js]
tech_stack:
  added: []
  patterns: [pure-builder description trees (D-26 Tier 1), idempotent mount guard (D-115), store.subscribe reactive re-render (D-117), dynamic import of apply.js for radio action, wave-aggregate inline computation from snapshots]
key_files:
  created:
    - js/views/desktop/analytics.js
    - tests/unit/views/desktop/analytics.builders.test.js
  modified:
    - js/desktop.js
decisions:
  - D-116: Analytics reads only from score_snapshots IDB store (never calls scoring.js) — enforced by architecture; no direct scoring.js import in analytics.js
  - D-117: Reactive model switching via store.subscribe; analytics radio buttons dispatch apply setSetting same path as Settings card
  - Wave aggregate computed inline from snapshot averages (not from waveAggregates.js which operates on raw logs)
  - statusSlug maps At-risk to "atrisk" (no hyphen in CSS class — matching token pattern from tokens.css)
  - Dynamic import of apply.js inside setScoringModel radio action handler to avoid circular dependency at module level
  - store DI argument accepts { subscribe } partial object (not full store namespace) — sufficient for D-117 reactivity
metrics:
  duration: "~20 min"
  completed: "2026-06-30"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  tests_added: 16
---

# Phase 06 Plan 05: Analytics View Summary

**One-liner:** Pure `buildAnalyticsHeader` + `buildAnalyticsTable` builders with wave-aggregate scores from `score_snapshots`, plus `mountAnalytics` live DOM mount with reactive model switching, wired into `desktop.js` replacing the analytics stub.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | 83e930a | 16 failing tests for analytics builders — RED confirmed (ERR_MODULE_NOT_FOUND) |
| T2 GREEN | feat | ad13a05 | Implement analytics.js with builders and mountAnalytics; all 16 tests pass |
| T3 | feat | 5501ec9 | Wire mountAnalytics into desktop.js, replacing analytics stub |

## What Was Built

### js/views/desktop/analytics.js (new file)

**`buildAnalyticsHeader({ statusCounts, scoringModel })`:**
- Returns `{ tag: 'div', attrs: { class: 'analytics-header' }, children: [...] }`
- Status summary: 4 `<span>` elements with classes `analytics-status-count analytics-status-count--<status>` and text `"Status: N"`
- Model selector: `<div class="analytics-model-selector">` with 3 radio `<label>`/`<input>` pairs (name="scoringModel", values S1/S2/S3, data-action="setScoringModel")
- Active model radio carries `checked: ''`; others do not

**`buildAnalyticsTable({ habitsByWave, snapshots, scoringModel, showArchived })`:**
- Returns `{ tag: 'table', attrs: { class: 'analytics-table' }, children: [thead, ...rows] }`
- `thead` columns: Habit / Stage / Rolling % / Mastery / [S2 Score or S3 Score when applicable]
- For each wave: one `<tr class="analytics-wave-header">` + one `<tr>` per (visible) habit
- Wave header spans all columns; contains `<span class="analytics-wave-name">` + `<span class="analytics-wave-agg">`
- Wave aggregate text from `_waveAggText`: `"avg S1: 87%"` (Math.round), `"avg S2: 0.80"` (toFixed(2)), empty string when no snapshots
- Habit rows: name / stage ("Etap N" or "") / rolling% + S1 badge / mastery / optional model score
- S1 badge class: `score-badge score-badge--<slug>` where slug = healthy/watch/atrisk/failing/na
- Archived habits: `analytics-row--archived` class when `showArchived: true`; skipped when `false`

**`_waveAggText(waveGroup, snapshots, scoringModel)` (internal):**
- Filters to non-archived habits in wave; collects s1Score/s2Score/s3Score from snapshots Map
- Returns `""` when no non-null scores; otherwise formatted average string

**`statusSlug(s1Status)` (internal):**
- Maps `'At-risk'` → `'atrisk'` (no hyphen in CSS modifier — matches `tokens.css` naming convention)

**`mountAnalytics(parent, { repo, store })`:**
- Idempotency guard via `parent.dataset.mounted === 'analytics'`
- Creates 3 children: header container, archived toggle label, table container
- "Show archived" checkbox toggles `showArchived` and re-renders table
- `refresh()` async: fetches habits + scoringModel setting + today's snapshots via `repo.runTx(['score_snapshots'], 'readonly', tx => tx.objectStore('score_snapshots').get([id, today]))`
- `store.subscribe(async () => { await refresh(); })` for D-117 reactive model switching
- Dynamic import of apply.js inside setScoringModel radio handler (avoids circular import at module level)

### js/desktop.js (modified)

- Added `import { mountAnalytics } from './views/desktop/analytics.js'`
- Added `subscribe` to `store.js` import destructure
- `'#analytics'` route: `mountAnalytics(analyticsPanel, { repo, store: { subscribe } })` replaces `mountStub(analyticsPanel, 'Analytics')`
- `mountStub` function still present for waveboard and planning routes (replaced in 06-06/06-07)

### tests/unit/views/desktop/analytics.builders.test.js (new file)

16 tests in 2 describe blocks:

**`buildAnalyticsHeader` tests (4 tests):**
- Root tag/class
- Status count spans for all 4 statuses
- 3 radio inputs with name="scoringModel" and S1/S2/S3 values
- Checked radio matches scoringModel param; others unchecked

**`buildAnalyticsTable` tests (12 tests):**
- Table tag/class
- Wave header row count matches wave group count
- Wave name text in header row
- Aggregate S1 score text (avg 95+80=87.5→88%)
- Aggregate S2 score text (avg 0.85+0.75=0.80)
- Empty aggregate when no snapshots
- Habit name in td
- S1 model: no S2/S3 column in thead
- S2 model: "S2 Score" column header
- Archived row class when showArchived=true
- No archived row when showArchived=false
- S1 badge class for Healthy status

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dynamic import for apply.js in setScoringModel handler**
- **Found during:** T2 implementation
- **Issue:** `mountAnalytics` in `analytics.js` calling `apply()` from `js/state/apply.js` would create a circular import chain if imported statically (analytics.js → apply.js → store.js → [possible back-ref]). While not currently circular, the plan spec says "calls `apply({type:'setSetting', ...})` — same path as the Settings card". The Settings card wires actions via the mounter's `actions` map, not directly importing apply.
- **Fix:** Used dynamic `import('../../state/apply.js')` inside the radio change closure — avoids any potential circular dependency and keeps analytics.js free from static apply.js coupling at module load time
- **Files modified:** js/views/desktop/analytics.js
- **Commit:** ad13a05

**2. [Rule 3 - Adaptation] store DI as partial { subscribe } object**
- **Found during:** T3 wiring
- **Issue:** Plan spec says `mountAnalytics(panel, { repo, store })` but desktop.js doesn't export a `store` namespace object — it imports individual functions from store.js
- **Fix:** Passed `{ subscribe }` as the store argument (destructured from store.js import). `mountAnalytics` only calls `store.subscribe(...)` so this minimal interface is sufficient for D-117 reactivity
- **Files modified:** js/desktop.js
- **Commit:** 5501ec9

## Known Stubs

None. The analytics view is fully implemented:
- `buildAnalyticsHeader` and `buildAnalyticsTable` are complete pure builders
- `mountAnalytics` reads real IDB data (score_snapshots + habits + settings)
- `desktop.js` analytics route calls the real mount (stub removed)
- Reactive model switching via `store.subscribe` is wired

Note: The wave aggregate display relies on `store.cache.waves` being populated (from `bootWaves()` in desktop.js). The implementation falls back to `"Wave N"` format when `store.cache.waves` is not available — this is acceptable since `bootWaves()` is called before routing in desktop.js.

## Threat Flags

None. Changes are:
- Pure builder functions (no DOM, no network)
- DOM construction via `mount()` helper (D-78 compliant — no innerHTML)
- IDB reads only (no writes in analytics view)
- Radio action dispatches through existing `apply()` chokepoint (D-75 compliant)
- No new network calls or auth paths

## TDD Gate Compliance

- RED gate: `test(06-05)` commit `83e930a` — ERR_MODULE_NOT_FOUND (analytics.js didn't exist); 1 file fails, 0 tests pass (RED confirmed)
- GREEN gate: `feat(06-05)` commit `ad13a05` — 16/16 analytics builder tests passing + full suite 771/773 (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check

### Files created exist:
- js/views/desktop/analytics.js — FOUND (buildAnalyticsHeader, buildAnalyticsTable, mountAnalytics exported)
- tests/unit/views/desktop/analytics.builders.test.js — FOUND (16 tests, 2 describe blocks)

### Files modified exist:
- js/desktop.js — FOUND (mountAnalytics import added, subscribe import added, analytics route wired)

### Commits exist:
- 83e930a — FOUND (test(06-05): failing tests for analytics view builders)
- ad13a05 — FOUND (feat(06-05): analytics view builders and mountAnalytics)
- 5501ec9 — FOUND (feat(06-05): wire mountAnalytics into desktop.js)

### Tests pass:
- `node --test tests/unit/views/desktop/analytics.builders.test.js` → 16/16 pass
- Full suite: 771/773 pass (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check: PASSED
