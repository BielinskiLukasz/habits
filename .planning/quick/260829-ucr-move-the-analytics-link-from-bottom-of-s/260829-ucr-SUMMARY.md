---
phase: quick-260829-ucr
plan: 01
subsystem: mobile-nav
tags: [navigation, i18n, footer-nav, settings-cleanup]
status: complete

dependency_graph:
  requires: []
  provides: [UCR-move-analytics-link]
  affects: [js/i18n/en.js, js/i18n/pl.js, js/views/today/builders.js, js/views/settings.js, css/desktop.css]

tech_stack:
  added: []
  patterns: [i18n-key-expansion, footer-nav-extension]

key_files:
  modified:
    - js/i18n/en.js
    - js/i18n/pl.js
    - js/views/today/builders.js
    - js/views/settings.js
    - css/desktop.css
    - tests/unit/builders.today.test.js

decisions:
  - analytics link placed as 5th footer nav item using existing linkDefs pattern; no aria-current needed since href is an absolute path not a hash

metrics:
  duration_minutes: 10
  completed_date: "2026-08-29"
  tasks_completed: 2
  commits: 2

actuals:
  tokens: 4500
  tasks: 2
  commits: 2
---

# Phase quick-260829-ucr Plan 01: Move Analytics Link to Footer Nav Summary

**One-liner:** Analytics link moved from settings panel bottom to fifth footer nav item using nav.analytics i18n keys in EN/PL.

## What Was Built

Added `nav.analytics` i18n keys to both EN (`'analytics'`) and PL (`'analityka'`) dictionaries, appended a fifth `./desktop.html` entry to `buildFooterNav()` linkDefs, and removed the standalone desktop link paragraph block from `mountSettings()` along with its `.settings-desktop-link` CSS rules.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add nav.analytics i18n keys and footer nav link | 464799b | js/i18n/en.js, js/i18n/pl.js, js/views/today/builders.js, tests/unit/builders.today.test.js |
| 2 | Remove settings desktop link from settings.js and desktop.css | c8e51e8 | js/views/settings.js, css/desktop.css |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated builders.today.test.js footer nav assertion from 4 to 5 items**
- **Found during:** Task 1 verification
- **Issue:** Existing test `emits <nav> with aria-label and 4 <a> children in today/history/catalog/settings order` expected exactly 4 children; adding the analytics link broke it.
- **Fix:** Updated test describe name, length assertion (4 → 5), added 5th href assertion for `./desktop.html`, updated text label test to include `'analytics'`, updated file header comment.
- **Files modified:** tests/unit/builders.today.test.js
- **Commit:** 464799b (included in Task 1 commit)

## Verification Results

- All 21 builders.today.test.js tests pass (0 failures).
- All 30 builders.settings.test.js tests pass (0 failures).
- 27 pre-existing test failures in apply/history/export suites are unrelated to this change (confirmed by scope — none touch en.js, pl.js, builders.js, settings.js, or desktop.css).
- `settings-desktop-link` selector absent from both settings.js and desktop.css (grep confirmed).

## Known Stubs

None.

## Threat Flags

None — href value is a hardcoded relative path; no user input crosses any boundary.

## Self-Check: PASSED

- js/i18n/en.js: nav.analytics key present
- js/i18n/pl.js: nav.analytics key present
- js/views/today/builders.js: 5-entry linkDefs with ./desktop.html last
- js/views/settings.js: settings-desktop-link block removed
- css/desktop.css: .settings-desktop-link rules removed
- Commits 464799b and c8e51e8 exist in git log
