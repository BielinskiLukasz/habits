---
phase: 05-backup-restore-json-csv-exports-json-import-nag
plan: "04"
subsystem: backup-nag
tags: [tdd, backup, nag, localStorage, settings]
dependency_graph:
  requires: []
  provides: [backup-nag-calculation]
  affects: [settings-ui-plan-06]
tech_stack:
  added: []
  patterns: [configure-based-DI, TDD-RED-GREEN-REFACTOR, daysBetween-Math.round]
key_files:
  created:
    - path: js/io/backup-nag.js
      purpose: Exports daysSinceLastBackup, shouldShowNag, dismissNag, configureBackupNag
    - path: tests/unit/backup-nag.test.js
      purpose: 11-test TDD suite covering all edge cases
  modified: []
decisions:
  - key: backup-nag-uses-daysBetween
    summary: backup-nag.js imports daysBetween from js/util/date.js instead of inline Math.round logic; single source of D-101 DST-safety rule
  - key: today-override-in-DI
    summary: configureBackupNag accepts a 'today' string override so tests can fix the current date without time-zone sensitivity
metrics:
  duration_minutes: 4
  completed_date: "2026-06-06"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
  tests_added: 11
  tests_total_after: 11
---

# Phase 5 Plan 4: Backup Nag Calculation Summary

**One-liner:** Backup nag module with `daysSinceLastBackup` (IDB settings → elapsed days using Math.round per D-101), `shouldShowNag` (7-day threshold + 7-day dismissal reappearance per D-102), and `dismissNag` (localStorage write), all wired via configure-based DI.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 (RED) | Add failing backup nag calculation tests | Done | 6d48cfa |
| 1 (GREEN) | Implement daysSinceLastBackup, shouldShowNag, dismissNag | Done | 7363cc7 |
| 1 (REFACTOR) | Consolidate date parsing via shared daysBetween | Done | 78bd6df |

## Verification

`node --test tests/unit/backup-nag.test.js` — 11/11 tests pass.

All acceptance criteria met:

- `tests/unit/backup-nag.test.js` contains 11 test cases (Tests 1-11)
- `js/io/backup-nag.js` exports `daysSinceLastBackup()`, `shouldShowNag()`, `dismissNag()`, and `configureBackupNag(deps)`
- All tests pass (green)
- `daysSinceLastBackup` uses `daysBetween` from `js/util/date.js` (Math.round, D-101 DST-safe)
- `shouldShowNag` correctly implements 7-day threshold and dismissal-reappearance logic
- `dismissNag` writes to localStorage with YYYY-MM-DD format
- Date arithmetic inherits DST safety from `daysBetween` (Math.round rule)

## TDD Gate Compliance

1. RED commit: `6d48cfa` — `test(05-04): add failing backup nag calculation tests`
2. GREEN commit: `7363cc7` — `feat(05-04): implement daysSinceLastBackup, shouldShowNag, dismissNag`
3. REFACTOR commit: `78bd6df` — `refactor(05-04): consolidate date parsing via shared daysBetween`

All three gates present. Gate sequence: RED → GREEN → REFACTOR.

## Deviations from Plan

None — plan executed exactly as written. The REFACTOR phase was performed as described in the plan's action section ("consolidate date parsing").

## Self-Check: PASSED

- `js/io/backup-nag.js` exists: FOUND
- `tests/unit/backup-nag.test.js` exists: FOUND
- RED commit `6d48cfa` exists: FOUND
- GREEN commit `7363cc7` exists: FOUND
- REFACTOR commit `78bd6df` exists: FOUND
- All 11 tests pass: VERIFIED
