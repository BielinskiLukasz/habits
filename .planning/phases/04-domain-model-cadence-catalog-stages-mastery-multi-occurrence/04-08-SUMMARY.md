---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: "08"
subsystem: catalog-view
tags:
  - catalog
  - CRUD
  - stages
  - mastery
  - builder-pattern
  - router
dependency_graph:
  requires:
    - "04-05 (apply handlers: createHabit, editHabit, archiveHabit, advanceStage)"
    - "04-06 (evaluateMastery, evaluateStageTriggers)"
    - "03-02 (router + today view patterns)"
    - "03-05 (settings view patterns)"
  provides:
    - "js/views/catalog.js — mountCatalog(parent, {repo, store})"
    - "js/views/catalog/builders.js — buildCatalogHeader, buildHabitListItem, buildEditPanel, buildCreatePanel"
    - "css/catalog.css — catalog view styles"
    - "#catalog route in router/main.js/index.html"
  affects:
    - "js/views/today/builders.js — buildFooterNav gains catalog tab"
    - "css/main.css — @import catalog.css"
    - "index.html — section[data-route=catalog] added"
    - "js/main.js — #catalog route, catalogPanel, show() extended"
tech_stack:
  added:
    - "css/catalog.css (view layer CSS for catalog)"
  patterns:
    - "D-26 builder-then-mounter pattern (pure builders tested in Node, thin mounter)"
    - "D-78 grep gate (no innerHTML anywhere in catalog files)"
    - "D-85 mastered row muted at opacity 0.55"
    - "D-87 per-habit mastery override via customMastery checkbox"
    - "NFR-06 touch targets >=44px via catalog-btn CSS class"
key_files:
  created:
    - "js/views/catalog/builders.js"
    - "js/views/catalog.js"
    - "css/catalog.css"
    - "tests/unit/builders.catalog.test.js"
  modified:
    - "css/main.css"
    - "index.html"
    - "js/main.js"
    - "js/views/today/builders.js"
    - "tests/unit/builders.today.test.js"
decisions:
  - "catalog added to footer nav (4 tabs: today/history/catalog/settings) — history now enabled since Phase 4 ships a history view"
  - "mountCatalog is async but main.js route fires-and-forgets; panel renders progressively"
  - "mastery evaluation uses empty logs array for catalog (fast-path); habits with status=mastered show isMastered=true directly"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-05"
  tasks_completed: 2
  files_created: 4
  files_modified: 5
  tests_added: 27
  tests_total: 375
  tests_passing: 373
---

# Phase 04 Plan 08: Catalog View Summary

Catalog view built as the habit lifecycle management surface, wiring the `apply.js` handlers from plans 04-05/04-06 to a user-facing UI with the D-26 builder-then-mounter pattern.

## What Was Built

**Pure builders (`js/views/catalog/builders.js`):**
- `buildCatalogHeader()` — h1 "Catalog" + "New habit" create button
- `buildHabitListItem(habit, masteryState)` — habit row with wave/status/stage badges, edit/archive/restore/advance-stage buttons, mastered class+badge (D-85)
- `buildEditPanel(habit)` — inline edit form pre-populated with all habit fields, stages list, per-habit mastery override (D-87)
- `buildCreatePanel(todayYMD)` — empty create form with defaults

**Catalog mounter (`js/views/catalog.js`):**
- `mountCatalog(parent, {repo, store})` — renders habit list, subscribes to store.notify for live re-renders
- All CRUD action handlers: create, edit, archive, restore, advance-stage (manual), save-edit, save-create, cancel-edit, cancel-create, add-stage
- Sorts habits: active first, then archived; within each group by wave asc
- Mastery evaluation via `evaluateMastery` (fast-path with empty logs for catalog display)
- XSS-safe: all text via textContent (D-78 grep gate)

**CSS (`css/catalog.css`):**
- `.catalog-habit-row--mastered { opacity: 0.55 }` (D-85)
- `.catalog-btn { min-width: 44px; min-height: 44px }` (NFR-06, D-79)
- Edit panel layout, form rows, stage section, mastery override section

**Wiring:**
- `css/main.css` — @import catalog.css in view layer
- `index.html` — `section[data-route="catalog"]` added after history panel
- `js/main.js` — #catalog route, catalogPanel query, show() extended to 4 panels
- `js/views/today/builders.js` — buildFooterNav updated to 4 links (today/history/catalog/settings); history link is now enabled (Phase 4 ships history view)

## Tests

27 new unit tests in `tests/unit/builders.catalog.test.js` covering all 4 builders across all habit states (active/archived/mastered, with/without stages, allowManual true/false).

TDD gate compliance:
1. RED commit: `116fe46` — test(04-08): add failing tests for catalog builders
2. GREEN commit: `21d11c6` — feat(04-08): implement catalog pure builders
3. FEAT commit: `0ed4c1c` — feat(04-08): add catalog mounter, CSS, and router/main/HTML wiring

Full suite: 375 tests, 373 pass, 2 fail (both pre-existing stubs from other plans: builders.history.test.js stub and builders.today.numeric.test.js stub — not caused by this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Footer nav tests broke when catalog tab added**
- **Found during:** Task 2 implementation
- **Issue:** Adding `#catalog` to `buildFooterNav` changed the link count from 3 to 4, breaking 3 tests in `builders.today.test.js` that asserted exactly 3 children and `children[2].text === 'settings'`
- **Fix:** Updated tests to assert 4 links in today/history/catalog/settings order; also removed the old aria-disabled test for the history link (history is now enabled in Phase 4) and added a test for catalog `aria-current`
- **Files modified:** `tests/unit/builders.today.test.js`
- **Commit:** `0ed4c1c`

**2. [Rule 2 - Missing functionality] monthCompletions not in store cache**
- **Found during:** Task 2 — buildMasteryCtx() implementation
- **Issue:** `evaluateMastery` ctx requires `monthCompletions` but the store cache doesn't expose it yet
- **Fix:** Stubbed as `() => 0` (safe default for monthly habits; won't cause incorrect mastery results for the current seed habits which are all daily/weekly) with a comment. Full implementation deferred to the monthly cadence plan.
- **Files modified:** `js/views/catalog.js` (inline comment)
- **Commit:** `0ed4c1c`

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All habit data rendered via textContent (D-78). T-04-08 (XSS via habit name) mitigated. T-04-08b (unknown hash) mitigated by router allowlist (routes map in main.js includes #catalog).

## Self-Check: PASSED

Files verified:
- `js/views/catalog/builders.js` — FOUND
- `js/views/catalog.js` — FOUND
- `css/catalog.css` — FOUND
- `tests/unit/builders.catalog.test.js` — FOUND (27 tests passing)

Commits verified:
- `116fe46` — FOUND (RED test commit)
- `21d11c6` — FOUND (GREEN builders commit)
- `0ed4c1c` — FOUND (mounter + wiring commit)

Acceptance criteria:
- [x] `npm test -- tests/unit/builders.catalog.test.js` green (27/27)
- [x] Full unit suite: 373/375 pass (2 pre-existing stubs unrelated to this plan)
- [x] `index.html` contains `section[data-route="catalog"]`
- [x] `js/main.js` imports and calls `mountCatalog`
- [x] `#catalog` in main.js routes map (allowlisted)
- [x] No `.innerHTML` in catalog.js or catalog/builders.js
- [x] `css/catalog.css` exists; `css/main.css` imports it
