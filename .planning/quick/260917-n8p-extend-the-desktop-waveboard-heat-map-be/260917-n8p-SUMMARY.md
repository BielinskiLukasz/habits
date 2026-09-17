---
phase: quick-260917-n8p
plan: 01
subsystem: ui
tags: [waveboard, desktop-analytics, css-cascade-layers, idb, indexeddb]

# Dependency graph
requires:
  - phase: 9 (Desktop Waveboard)
    provides: score_snapshots-backed waveboard heat-map with 12-week fixed window
provides:
  - weeksInRange(startYMD, endYMD) week-key builder spanning any date range
  - waveboard heat-map columns spanning full score_snapshots history instead of a fixed 12-week window
  - .waveboard-container horizontal-scroll rule moved into css/desktop.css's desktop-scoring @layer
affects: [desktop-waveboard, desktop-analytics]

# Actuals (#2632)
actuals:
  tokens: 2000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Full-history IDB range query with epoch sentinel ('0000-01-01'), matching js/db/repo.js getLatestSnapshot and js/io/seed.js effectiveFrom fallback conventions"
    - "Derive a UI range from the actual data returned by a single query, rather than querying a range computed ahead of time"

key-files:
  created: []
  modified:
    - js/views/desktop/waveboard.js
    - css/desktop.css
    - tests/unit/views/desktop/waveboard.builders.test.js

key-decisions:
  - "weeksInRange replaces last12Weeks entirely (no dual API) — refresh() is the only caller and both plan and code agree there is no reason to keep the fixed-window helper around"
  - "Fallback to `today` as earliest date when zero snapshot rows exist, so a fresh install still renders exactly the current week (matches prior no-data behavior)"

patterns-established:
  - "Data-fetch-first, range-derived-second: query score_snapshots over the full possible range, then derive the displayed week range from what the query actually returned — avoids a second read path or a stale precomputed range"

requirements-completed:
  - N8P-waveboard-full-history-scroll

coverage:
  - id: D1
    description: "waveboard.js exports weeksInRange(startYMD, endYMD); single-day range returns exactly one week key, year-boundary multi-week range is chronological with no duplicates"
    requirement: "N8P-waveboard-full-history-scroll"
    verification:
      - kind: unit
        ref: "tests/unit/views/desktop/waveboard.builders.test.js#weeksInRange — DESKTOP-04 full-history week-range builder"
        status: pass
    human_judgment: false
  - id: D2
    description: "refresh() derives cachedWeeks from the earliest score_snapshots date returned by a single full-range repo.getSnapshotsInRange(SNAPSHOT_EPOCH, today) query, instead of a fixed 12-week count"
    requirement: "N8P-waveboard-full-history-scroll"
    verification: []
    human_judgment: true
    rationale: "Requires opening desktop.html#waveboard with real multi-week score_snapshots data and visually confirming more than 12 week columns render — not covered by the pure-function unit tests, which only exercise weeksInRange in isolation"
  - id: D3
    description: ".waveboard-container { overflow-x: auto } moved from an inline style in waveboard.js into css/desktop.css's desktop-scoring @layer; grid stays scrollable with the sticky habit-name column fixed on the left"
    requirement: "N8P-waveboard-full-history-scroll"
    verification:
      - kind: unit
        ref: "node --test tests/**/*.test.js (968 tests, no regressions)"
        status: pass
    human_judgment: true
    rationale: "Visual scroll behavior (sticky column staying fixed while grid scrolls horizontally) requires opening desktop.html#waveboard and interacting with the grid — not exercised by the pure-function unit test suite"

duration: 20min
completed: 2026-09-17
status: complete
---

# Quick Task 260917-n8p: Waveboard Full-History Heat-Map Summary

**Desktop waveboard heat-map now renders every ISO week with `score_snapshots` history (not just the last 12), with horizontal scroll moved from an inline style into `css/desktop.css`'s cascade-layer architecture.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-17T15:07:50Z
- **Tasks:** 2
- **Files modified:** 3 (`js/views/desktop/waveboard.js`, `css/desktop.css`, `tests/unit/views/desktop/waveboard.builders.test.js`)

## Accomplishments
- Replaced the fixed `last12Weeks(todayYMD)` helper with an exported `weeksInRange(startYMD, endYMD)` that builds a chronological, deduplicated ISO-week-key array over any date span (single-day range → one week; multi-week year-boundary range → correct ordering, no dupes).
- `refresh()` now issues one `repo.getSnapshotsInRange(SNAPSHOT_EPOCH, today)` query (epoch sentinel `'0000-01-01'`, matching the existing convention in `js/db/repo.js`'s `getLatestSnapshot` and `js/io/seed.js`'s `effectiveFrom` fallback) and derives `cachedWeeks` from the earliest `row.date` actually returned — falling back to `today` when zero snapshots exist, preserving today's no-data behavior.
- Moved the waveboard grid container's horizontal-scroll rule from a JS-set inline style into `.waveboard-container { overflow-x: auto; }` inside `css/desktop.css`'s `desktop-scoring` `@layer`, matching how every other visual rule for this view is expressed.
- The sticky habit-name column (`position: sticky; left: 0`) and D-118's "always S1 status" rule are untouched — confirmed by leaving the cell-coloring/status logic in `refresh()`'s snapshot-processing loop completely unmodified.

## Task Commits

Each task was committed atomically (TDD RED → GREEN for Task 1, then a refactor for Task 2):

1. **Task 1 RED: add failing tests for weeksInRange** - `24d1935` (test)
2. **Task 1 GREEN: waveboard week range spans full history** - `9291c32` (feat)
3. **Task 2: move waveboard scroll into CSS layer** - `6c7d78c` (refactor)

**Plan metadata:** commit pending (docs commit handled separately by the orchestrator per constraints)

## Files Created/Modified
- `js/views/desktop/waveboard.js` — `weeksInRange(startYMD, endYMD)` exported (replaces `last12Weeks`); `SNAPSHOT_EPOCH = '0000-01-01'` constant added; `refresh()` rewritten to query full history first and derive `cachedWeeks` from the result; container element's inline style removed; two JSDoc blocks (file header "Grid structure", `mountWaveboard`'s "Data fetch sequence") updated to describe full-history behavior
- `css/desktop.css` — `.waveboard-container { overflow-x: auto; }` added to the `desktop-scoring` `@layer`, next to `.waveboard-grid` / `.waveboard-sticky-column`
- `tests/unit/views/desktop/waveboard.builders.test.js` — two new unit tests for `weeksInRange` (single-day range, year-boundary multi-week range with no duplicates); imports `weeksInRange` and `isoWeekKey` from `waveboard.js`

## Decisions Made
- No dual API kept for the old fixed-window helper — `weeksInRange` fully replaces `last12Weeks` since `refresh()` was its only caller and the plan called for a clean replacement, not a parallel path.
- Zero-snapshot fallback: when `repo.getSnapshotsInRange` returns no rows, `earliestDate` stays `today`, so `weeksInRange(today, today)` renders exactly the current week — matching the app's existing no-data rendering behavior rather than introducing a new empty-state.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` steps were followed as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The waveboard heat-map is ready for manual verification: opening `desktop.html#waveboard` with more than 12 weeks of `score_snapshots` history should show all weeks as scrollable columns with the habit-name column fixed on the left (D2/D3 above — flagged `human_judgment: true` since this needs a real multi-week dataset and visual/interactive confirmation, not just unit tests).
- No blockers for other in-progress work; this is an isolated view-layer change with no schema or API surface changes.

## Known Stubs

None found — no hardcoded empty values, placeholder text, or unwired data sources introduced by this change.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or schema changes were introduced. Query bounds (`SNAPSHOT_EPOCH`, `today`) are fixed local constants, not user input; the CSS/inline-style move touches only presentation.

---
*Phase: quick-260917-n8p*
*Completed: 2026-09-17*

## Self-Check: PASSED

- FOUND: js/views/desktop/waveboard.js
- FOUND: css/desktop.css
- FOUND: tests/unit/views/desktop/waveboard.builders.test.js
- FOUND commit: 24d1935 (test RED)
- FOUND commit: 9291c32 (feat GREEN)
- FOUND commit: 6c7d78c (refactor Task 2)
