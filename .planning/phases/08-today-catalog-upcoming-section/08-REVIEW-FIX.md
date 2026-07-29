---
phase: 08-today-catalog-upcoming-section
fixed_at: 2026-07-29T12:15:00Z
review_path: C:/my-code/vibe-coding/habits/.planning/phases/08-today-catalog-upcoming-section/08-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-07-29T12:15:00Z
**Source review:** C:/my-code/vibe-coding/habits/.planning/phases/08-today-catalog-upcoming-section/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: mountCatalog does not update _currentParent on idempotent re-entry

**Files modified:** `js/views/catalog.js`
**Commit:** a8a50f3
**Applied fix:** Added `_currentParent = parent;` in the re-entry branch (line 543) to ensure that when `mountCatalog` is called a second time with a different parent element, the subscription callback uses the new parent. Previously, the subscription would continue rendering into the stale parent element, creating a silent desync.

### WR-02: Missing test coverage for handleDemoteHabit (undo handler)

**Files modified:** `tests/state/apply/promoteHabit.test.js`
**Commit:** 2013e8c
**Applied fix:** Added import for `handleDemoteHabit` and created a complete test suite with 6 test cases covering handler contract compliance, status transition (active → scheduled), inverse type and round-trip closure, error handling for missing habits, broadcastKeys function behavior, and property preservation across updates. All tests pass.

---

_Fixed: 2026-07-29T12:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
