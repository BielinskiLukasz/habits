---
phase: 05-backup-restore-json-csv-exports-json-import-nag
plan: "06"
subsystem: settings-ui/backup-nag
tags: [nag-banner, localStorage, css, integration-tests, settings, EXPORT-08]

dependency_graph:
  requires:
    - js/io/backup-nag.js          # Plan 05-04: daysSinceLastBackup / shouldShowNag / dismissNag
    - js/views/settings/builders.js # Plan 05-05: buildDataCard with nag banner
    - js/views/settings.js          # Plan 05-05: dismissNag action handler + refreshLiveCards
  provides:
    - css/settings.css (.nag-banner styles) — EXPORT-08 warning banner visual treatment
    - tests/integration/settings.backup-nag.test.js — 8 integration tests covering nag lifecycle
    - settings.js resetData clears nag:lastDismissed (Pitfall 5 fix)
  affects:
    - Settings UI — Data card backup section (nag banner now styled)

tech_stack:
  added: []
  patterns:
    - "CSS @layer view: .nag-banner + .nag-banner__dismiss with CSS custom properties"
    - "Integration tests: fake-repo + fake-localStorage + fake-DOM + configureBackupNag DI"
    - "store.notify() to drive reactive re-render and assert post-refresh DOM state"

key_files:
  created:
    - path: tests/integration/settings.backup-nag.test.js
      purpose: 8 integration tests covering nag visibility, dismiss, export-clears-nag, reset-clears-dismissal, persistence
  modified:
    - path: css/settings.css
      purpose: Added .nag-banner and .nag-banner__dismiss styles with warning amber color scheme
    - path: js/views/settings.js
      purpose: resetData now clears nag:lastDismissed from localStorage (Pitfall 5 fix)

decisions:
  - key: resetData-clears-nag-localStorage
    summary: resetData action calls localStorage.removeItem('nag:lastDismissed') before IDB delete so nag resets along with all user data (Pitfall 5 from RESEARCH)
  - key: nag-banner-css-custom-properties
    summary: .nag-banner uses --color-warning / --color-warning-border / --color-warning-text custom properties with #fff3cd / #ffc107 / #664d00 fallbacks for full light/dark theming
  - key: builders-and-settings-wiring-from-plan-05
    summary: Task 1 (builder) and Task 2 (settings wiring) were already fully implemented in Plan 05-05; Plan 06 adds CSS + integration tests + the missing Pitfall 5 fix

metrics:
  duration_minutes: 25
  completed_date: "2026-06-06"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  tests_added: 8
  tests_total_after: 714
---

# Phase 5 Plan 06: Backup Nag Banner UI Summary

**One-liner:** Nag banner CSS styling (.nag-banner + .nag-banner__dismiss with amber warning colors and dismiss button), 8 integration tests for full nag lifecycle, and Pitfall 5 fix (resetData now clears nag:lastDismissed from localStorage).

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Extend Data card builder with nag banner | Done (Plan 05-05) | `dc5e85f` (prior plan) |
| 2 | Wire nag logic + fix resetData Pitfall 5 | Done | `1ab5f98` |
| 3 | Style nag banner + add integration tests | Done | `2c13e52` |

## Verification

`node --test tests/integration/settings.backup-nag.test.js` — 8/8 tests pass.
Full suite: 714 pass, 2 fail (pre-existing Phase 4 placeholder stubs — unchanged).

All EXPORT-08 acceptance criteria met:

- Nag banner displays when last backup >= 7 days ago and not dismissed: YES (Test 2)
- Nag banner disappears when dismissed via × button: YES (Test 5)
- Nag banner reappears after 7 days of dismissal: YES (Test 4)
- Nag banner disappears immediately after export (lastBackupDate reset): YES (Test 6)
- Nag dismissal state persists across page reload: YES (Test 8)
- Reset-data clears nag:lastDismissed from localStorage: YES (Test 7)

## Files Created/Modified

- `css/settings.css` — Added `.nag-banner` (amber warning background, left border accent) and `.nag-banner__dismiss` (dismiss button with hover/focus states). NFR-07 compliant: color paired with text affordance.
- `js/views/settings.js` — `resetData` action now calls `localStorage.removeItem('nag:lastDismissed')` before IDB delete (Pitfall 5 fix from RESEARCH.md).
- `tests/integration/settings.backup-nag.test.js` — 8 integration tests: nag visibility logic (4), dismiss button (1), export-clears-nag (1), reset-clears-dismissal (1), localStorage persistence (1).

## Deviations from Plan

**[Rule 2 - Missing critical functionality] Tasks 1 & 2 already implemented in Plan 05-05**

- **Found during:** Initial file inspection
- **Issue:** Plan 05-05 had already implemented the `buildDataCard` nag banner (Task 1) and the `dismissNag` action handler + `refreshLiveCards` nag computation (Task 2). Plan 05-06's Task 1 and most of Task 2 were pre-done.
- **Fix:** Identified the missing piece (resetData not clearing `nag:lastDismissed`) and added it as the Task 2 commit. Proceeded to Task 3 (CSS + tests) as planned.
- **Files modified:** `js/views/settings.js`
- **Commit:** `1ab5f98`

## Self-Check: PASSED

- `js/views/settings/builders.js` exists: FOUND
- `js/views/settings.js` exists: FOUND (with Pitfall 5 fix)
- `css/settings.css` contains `.nag-banner`: FOUND (5 occurrences)
- `tests/integration/settings.backup-nag.test.js` exists: FOUND
- Commit `1ab5f98` (resetData fix): FOUND in git log
- Commit `2c13e52` (CSS + tests): FOUND in git log
- 8/8 integration tests pass: VERIFIED
- Full suite 714 pass (8 new tests added): VERIFIED
