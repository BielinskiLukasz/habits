---
phase: quick-260918-vtr
plan: 01
subsystem: ui
tags: [today-view, i18n, dead-code-removal, jsdoc]

# Dependency graph
requires:
  - phase: Phase 10 (i18n)
    provides: full EN/PL language toggle (D-35, getLang()-based name_pl display) that made this button redundant
provides:
  - buildTodayRow() emits only the tap button inside .today-row__slide — no ⓘ/today-row-info button
  - No dead code, JSDoc, CSS rule, or i18n key remains for the removed togglePolish/showPolish stub
  - Consolidated regression test asserting the button/action is always absent (name_pl truthy/null/missing)
  - B-002 backlog item closed as moot
affects: [today-view, builders.today.test.js, backlog-hygiene]

# Actuals (#2632)
actuals:
  tokens: 2500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - js/views/today/builders.js
    - js/views/today.js
    - css/today.css
    - js/i18n/en.js
    - js/i18n/pl.js
    - tests/unit/builders.today.test.js
    - .planning/BACKLOG.md

key-decisions:
  - "Removed the never-wired togglePolish/ⓘ button entirely rather than wiring it, since D-35's full EN/PL toggle already covers Polish-name disclosure globally"

patterns-established: []

requirements-completed: [VTR-remove-dead-today-row-info]

coverage:
  - id: D1
    description: "buildTodayRow() no longer constructs a today-row-info button for any habit, including habits with name_pl set"
    requirement: "VTR-remove-dead-today-row-info"
    verification:
      - kind: unit
        ref: "tests/unit/builders.today.test.js#never renders a togglePolish/ⓘ button, even when habit.name_pl is set (removed — superseded by full EN/PL toggle D-35)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No dead code, JSDoc, CSS rule, or i18n key remains anywhere in the codebase for the removed togglePolish/showPolish stub"
    requirement: "VTR-remove-dead-today-row-info"
    verification:
      - kind: unit
        ref: "grep -r 'today-row-info|togglePolish|showPolish' js/ css/ (matches only within the negative-assertion test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "name_pl display logic (D-35) is completely untouched and keeps working"
    requirement: "VTR-remove-dead-today-row-info"
    verification:
      - kind: unit
        ref: "node --test tests/ (full suite, 983 tests, 0 failures — includes i18n/name_pl coverage)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-18
status: complete
---

# Quick Task 260918-vtr: Remove Dead Today-Row-Info Polish Button Summary

**Deleted the never-wired ⓘ (togglePolish) disclosure button — markup, JSDoc, CSS rule, orphaned i18n key, and stale stub comments — since D-35's full EN/PL toggle already covers Polish-name display globally.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `buildTodayRow()` no longer constructs the `.today-row-info` button; the `if (habit.name_pl) {...}` block is gone entirely
- All stale documentation removed: the button's JSDoc paragraph, the orphaned `D-55` file-tag reference (kept `D-79` since it's used elsewhere), the `.today-row-info` CSS rule + comment, the `togglePolish` stub comment in `today.js`'s actions map, and the matching file-header JSDoc paragraph
- Orphaned `today.showPolish` i18n key removed from both `en.js` and `pl.js`
- Consolidated test replaces two prior tests (one asserting presence, one asserting absence) with a single test covering three fixtures (name_pl truthy / null / missing), asserting absence by both class and data-action
- B-002 backlog item ("Polish name button missing for numeric/slot habits") removed as moot — the feature it proposed extending no longer exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove ⓘ button markup, its JSDoc, and its CSS rule** - `eecace7` (refactor)
2. **Task 2: Remove the today.js stub artifacts and the orphaned i18n key** - `c320c93` (refactor)
3. **Task 3: Update builder tests, remove the moot backlog item, run the full suite** - `5d1a5a3` (test)

_Note: no TDD RED/GREEN split — this plan is pure deletion, not behavior-adding._

## Files Created/Modified
- `js/views/today/builders.js` - removed the ⓘ button construction block, its JSDoc paragraph, and the `D-55` file-tag
- `js/views/today.js` - removed the `togglePolish` stub comment (actions map) and its file-header JSDoc paragraph
- `css/today.css` - removed the `.today-row-info` rule and its preceding comment
- `js/i18n/en.js`, `js/i18n/pl.js` - removed the `today.showPolish` key
- `tests/unit/builders.today.test.js` - consolidated the two ⓘ-button tests into one negative-assertion test; updated JSDoc coverage bullets and file-tag list
- `.planning/BACKLOG.md` - removed the B-002 section; updated the "Last updated" line

## Decisions Made
- Removed the never-wired `togglePolish`/ⓘ button entirely rather than wiring it, since D-35's full EN/PL toggle already covers Polish-name disclosure globally across Today, Catalog, and History — the feature this stub anticipated shipped a different way.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. One task-2 edit required re-reading the file to find the exact surrounding text (item 5 of the numbered list sits between the target paragraph and the preceding "console.warn placeholder is GONE." line, which the plan's literal wording didn't account for) — resolved by anchoring the deletion to the correct preceding line while still leaving exactly one blank `*` line, satisfying the plan's stated constraint.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Today view is simpler with one less dead code path; no follow-up work required.
- Full test suite (983 tests) passes with zero failures — no regressions to the live `name_pl` display path (D-35).
- `.planning/BACKLOG.md` B-002 closed; B-001 and B-003 remain adjacent with a single `---` separator.

---
*Phase: quick-260918-vtr*
*Completed: 2026-09-18*

## Self-Check: PASSED

All files created/modified verified present on disk; all three task commits (`eecace7`, `c320c93`, `5d1a5a3`) verified present in git log.
