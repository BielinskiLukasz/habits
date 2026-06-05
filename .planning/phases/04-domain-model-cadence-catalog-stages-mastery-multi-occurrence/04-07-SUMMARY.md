---
phase: "04"
plan: "07"
subsystem: mastery-settings
tags: [settings, mastery, apply-handlers, D-86, SETTINGS-01]
dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04]
  provides: [setMasteryThreshold, setMasteryWindow, buildMasteryCard, mountSettings-mastery-card]
  affects: [js/state/apply.js, js/state/apply/setMasteryThreshold.js, js/state/apply/setMasteryWindow.js, js/state/store.js, js/views/settings.js, js/views/settings/builders.js, css/settings.css]
tech_stack:
  added: []
  patterns: [self-inverting apply handler (D-75), pure description-tree builder (D-26 Tier 1), change-listener wiring after mount, getCachedSettings() store accessor]
key_files:
  created:
    - js/state/apply/setMasteryThreshold.js
    - js/state/apply/setMasteryWindow.js
    - tests/integration/apply.setMasteryThreshold.test.js
    - tests/integration/settings.masterySettings.test.js
  modified:
    - js/state/apply.js
    - js/state/store.js
    - js/views/settings.js
    - js/views/settings/builders.js
    - css/settings.css
    - tests/unit/builders.settings.test.js
    - tests/integration/settings.mount.test.js
decisions:
  - wireMasteryInputs() adds change listeners after mount — mount.js only wires click via data-action; number inputs fire change events, so a post-mount step wires them manually
  - getCachedSettings() added to store.js alongside getCachedWeekStart() for the mastery card's read path; hydrate() extended to load masteryThreshold + masteryWindow
  - settings.mount.test.js updated from 5-cards to 6-cards assertion — Mastery appended after About per SETTINGS-01
metrics:
  duration_minutes: 35
  completed_date: "2026-06-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 7
  new_tests: 25
---

# Phase 04 Plan 07: Mastery Settings Apply Handlers + Settings Card Summary

Adds two self-inverting apply handlers (`setMasteryThreshold`, `setMasteryWindow`) and extends the Settings view with a new "Mastery" card exposing configurable global threshold % and rolling window days. Implements SETTINGS-01 and the configurable defaults for MASTERY-01.

## What Was Built

**`js/state/apply/setMasteryThreshold.js`** — handler for global mastery threshold % setting. Follows the exact `setSetting` self-inverting pattern (D-75): reads prior value, writes `{key:'masteryThreshold', value}`, returns inverse. `broadcastKeys` returns `{key:'masteryThreshold'}` only (Pitfall 8 compliance).

**`js/state/apply/setMasteryWindow.js`** — identical pattern for `{key:'masteryWindow'}`.

**`js/state/apply.js`** — HANDLERS table extended with `setMasteryThreshold` and `setMasteryWindow`.

**`js/state/store.js`** — `hydrate()` extended to pre-load `masteryThreshold` and `masteryWindow` from the settings store; new `getCachedSettings()` accessor returns all cached settings as a plain object for the mastery card's initial render.

**`js/views/settings/builders.js`** — new `buildMasteryCard({masteryThreshold, masteryWindow})` pure builder returns a description tree with `data-card="mastery"` and two `<input type="number">` elements (`data-key="masteryThreshold"` min=1 max=100, `data-key="masteryWindow"` min=1 max=365). Defaults to 90 and 70 when inputs are null/undefined.

**`js/views/settings.js`** — `mountSettings()` mounts the mastery card after the About card; `buildActions()` gains `setMasteryThreshold` and `setMasteryWindow` action closures; new `wireMasteryInputs()` helper wires `change` event listeners on the number inputs after mount (mount.js only wires click via `data-action`).

**`css/settings.css`** — `.mastery-row` and `.mastery-input-group` styles for the two-column label + input layout.

## Test Results

Before plan: 161 integration tests passing (3 pre-existing stubs failing from other plans).
After plan: 179 integration tests passing (same 3 stubs still failing — unrelated).

New tests:
- `tests/integration/apply.setMasteryThreshold.test.js` — 11 tests (writes, inverse, undo, broadcast keys-only, HANDLERS registration)
- `tests/integration/settings.masterySettings.test.js` — 7 tests (card rendered, inputs present, defaults 90/70, change events dispatch correct apply types)
- `tests/unit/builders.settings.test.js` — 5 new tests (buildMasteryCard unit coverage + updated a11y baseline to include Mastery card)

Total new tests: 23 (18 integration + 5 unit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] settings.mount.test.js expected 5 cards but got 6**

- **Found during:** Task 2 GREEN verification
- **Issue:** `tests/integration/settings.mount.test.js` had `assert.equal(cards.length, 5, '5 settings cards rendered')` and `['Storage','Schedule','Install','Data','About']` — this fails now that Mastery is the 6th card.
- **Fix:** Updated assertion to expect 6 cards and `['Storage','Schedule','Install','Data','About','Mastery']`. Test description updated to note Phase 04-07 extension.
- **Files modified:** `tests/integration/settings.mount.test.js`
- **Commit:** d0d1026

**2. [Rule 2 - Missing coverage] builders.settings.test.js a11y test excluded buildMasteryCard**

- **Found during:** Post-task review of unit test coverage
- **Issue:** The existing `Settings builders — A11y baseline (D-79)` test validated aria-labelledby for 5 cards but didn't include the new 6th card.
- **Fix:** Extended the a11y test + added a dedicated `buildMasteryCard` describe block with 5 tests.
- **Files modified:** `tests/unit/builders.settings.test.js`
- **Commit:** a3d2c9c

### Architecture Notes

**wireMasteryInputs() pattern:** `mount.js` only wires `data-action` attributes as `click` listeners. Number inputs fire `change` events (not `click`) when the user modifies the value and leaves the field. Rather than modifying mount.js (which would affect all consumers), `wireMasteryInputs()` is a focused post-mount step that walks the mastery card by `data-key` attribute and adds `change` listeners. This follows the Pattern S5 precedent (post-mount async state loaders) and keeps mount.js's single-responsibility intact.

**getCachedSettings() vs getCachedWeekStart():** Rather than adding individual `getCachedMasteryThreshold()` / `getCachedMasteryWindow()` selectors, `getCachedSettings()` returns all settings as a plain object. This avoids a proliferation of per-key getters as the settings surface grows in Phase 5+.

## Known Stubs

None — all mastery card values are wired to real apply handlers and read from the settings store.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what the plan's `<threat_model>` covers. The mastery card renders values into `input.value` attributes (not innerHTML — D-78 compliant). HTML min/max attributes on the inputs satisfy T-04-07 (invalid range tampering mitigation).

## Self-Check: PASSED

- `js/state/apply/setMasteryThreshold.js` — FOUND
- `js/state/apply/setMasteryWindow.js` — FOUND
- `tests/integration/apply.setMasteryThreshold.test.js` — FOUND
- `tests/integration/settings.masterySettings.test.js` — FOUND
- Commits fd753a2, 21f5a2f, dc3bef9, d0d1026, a3d2c9c — all in git log
- 179/182 integration tests pass (3 failures are pre-existing stubs from other plans)
