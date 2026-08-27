---
phase: 08
plan: 04
subsystem: catalog-css
tags: [css, upcoming-section, visual-consistency, gap-closure]
dependency:
  requires: [08-03]
  provides: [08-04]
  affects: [catalog-ui]
tech_stack:
  added: []
  patterns: [cascade-layers, css-custom-properties]
key_files:
  created: []
  modified: [css/catalog.css]
decisions:
  - "Gap G-08-4 closed by adding two CSS rules to style the Upcoming section"
  - ".catalog-upcoming-list uses same list-reset pattern as .catalog-habit-list"
  - ".catalog-upcoming-item uses same flex layout as .catalog-habit-row for button alignment"
metrics:
  duration_minutes: 2
  completed_date: "2026-07-29"
  tasks_completed: 1
  files_modified: 1
  commits: 1
status: complete
---

# Phase 08 Plan 04: Upcoming Section CSS Rules Summary

**Objective:** Close gap G-08-4 by adding missing CSS rules for Upcoming section visual consistency (removes bullet dots, aligns buttons with active rows).

## Completed Tasks

| # | Name | Status | Commit | Files |
|---|------|--------|--------|-------|
| 1 | Add CSS rules for .catalog-upcoming-list and .catalog-upcoming-item | ✓ | 3ce7ed7 | css/catalog.css |

## Requirement Traceability

| ID | Title | Status |
|----|-------|--------|
| CAT-04 | CSS rules for Upcoming section styling | ✓ COMPLETE |

## Implementation Details

### Task 1: CSS Rule Addition

**What was built:**
- `.catalog-upcoming-list` rule (list-style removal, vertical padding)
- `.catalog-upcoming-item` rule (flex layout for Edit/Promote buttons, consistent spacing)

**How it works:**
- `.catalog-upcoming-list` inherits the same list-reset pattern as `.catalog-habit-list` (no bullets, zero margins, consistent padding)
- `.catalog-upcoming-item` mirrors `.catalog-habit-row` structure: `display: flex`, `align-items: flex-start`, gap for button spacing, border-bottom for visual separation
- Both rules remain inside the `@layer view { }` block, maintaining cascade-layer specificity discipline
- CSS custom properties (--space-2, --space-3, --space-4, --color-border) ensure consistency with design tokens

**Verification:**
- ✓ grep confirms both `.catalog-upcoming-list` and `.catalog-upcoming-item` rules present in css/catalog.css
- ✓ All six properties of `.catalog-upcoming-item` correctly specified
- ✓ All four properties of `.catalog-upcoming-list` correctly specified
- ✓ Rules placed after their active-list analogs (`.catalog-habit-list`, `.catalog-habit-row`)
- ✓ No CSS syntax errors; file remains valid

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Surface

No security surface introduced (CSS-only styling changes).

## Gap Closure Status

- **G-08-4:** "Add CSS rules for Upcoming section" — **CLOSED**

## Next Steps

- Plan 08-04 complete
- Ready for Phase 08 final verification (all 7 UAT tests should pass with no cosmetic issues)
- Next phase: Phase 09 (Desktop Waveboard)
