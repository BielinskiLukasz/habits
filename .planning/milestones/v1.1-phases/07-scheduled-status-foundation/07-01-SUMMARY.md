---
phase: 07-scheduled-status-foundation
plan: "01"
subsystem: domain
tags: [scheduled, tdd, migration, promotion, domain-service]
status: complete

dependency_graph:
  requires: []
  provides:
    - js/domain/scheduled.js
    - configureScheduled
    - bootScheduled
  affects:
    - js/main.js (Phase 7 plan 03 — shell wiring)
    - js/desktop.js (Phase 7 plan 03 — shell wiring)

tech_stack:
  added: []
  patterns:
    - Configure-based DI (truthy-field overwrite from seed.js)
    - Meta one-time guard (scheduledMigrationV1 key)
    - repo.runTx atomic writes (bypass apply.js for system-driven boot writes)
    - TDD RED→GREEN cycle (node:test)

key_files:
  created:
    - js/domain/scheduled.js
    - tests/unit/scheduled.test.js
  modified: []

decisions:
  - "runMigration writes meta guard atomically in the same tx as habit status changes (T-07-01 mitigated)"
  - "runPromotion returns early when no habits to promote (avoids empty runTx call)"
  - "No refactor commit needed — implementation follows established patterns directly"

metrics:
  duration: "~7 minutes"
  completed: 2026-07-01
  tasks: 2
  files: 2
---

# Phase 07 Plan 01: Scheduled Domain Service Summary

**One-liner:** `scheduled.js` domain service with one-time DATA-03 migration and every-boot SCHED-03 promotion passes, guarded by `scheduledMigrationV1` meta key.

## What Was Built

Created `js/domain/scheduled.js` — a new domain service that gives the app first-class understanding of the `scheduled` status. The module provides:

- `configureScheduled({repo})` — DI injection following the seed.js truthy-field-overwrite pattern.
- `bootScheduled()` — public entry point called by both shells on every app boot; throws descriptively if called before `configureScheduled`.
- `runMigration()` (internal) — one-time DATA-03 pass that finds `status:'active'` habits with `startDate > today` and rewrites them to `status:'scheduled'`. The `scheduledMigrationV1` meta key is written atomically in the same `runTx` call so a crash cannot leave data partially migrated.
- `runPromotion()` (internal) — every-boot SCHED-03 pass that finds `status:'scheduled'` habits with `startDate <= today` and promotes them to `status:'active'`.

Created `tests/unit/scheduled.test.js` with 11 tests covering all specified behaviors.

## TDD Cycle

**RED commit (`c5cbe16`):** 11 failing tests — `scheduled.js` did not yet exist; all tests failed with `ERR_MODULE_NOT_FOUND`.

**GREEN commit (`75fdb89`):** All 11 tests pass. Full suite (519 tests): 517 pass, 2 fail — the 2 failures are pre-existing in `import.test.js` (broadcast test) and were present before this plan ran.

No REFACTOR commit — the implementation follows established patterns directly with no cleanup needed.

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `js/domain/scheduled.js` exists with JSDoc file header (D-27) | PASS |
| Exports `configureScheduled` and `bootScheduled` as named exports | PASS |
| `tests/unit/scheduled.test.js` — all 11 tests pass | PASS |
| No regressions in full suite | PASS (pre-existing 2 failures unchanged) |
| `runMigration()` uses `scheduledMigrationV1` meta key as one-time guard | PASS |
| `runPromotion()` promotes only habits with `startDate <= todayLocal()` | PASS |
| All writes use `_repo.runTx` — no direct putHabit calls outside transactions | PASS |

## Deviations from Plan

None — plan executed exactly as written. Followed `js/domain/wave.js` + `js/io/seed.js` patterns as prescribed.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. Mitigations T-07-01 and T-07-02 from the plan's threat model were implemented as designed.

## Self-Check: PASSED

- `js/domain/scheduled.js` — FOUND
- `tests/unit/scheduled.test.js` — FOUND
- RED commit `c5cbe16` — FOUND in git log
- GREEN commit `75fdb89` — FOUND in git log
- 11/11 tests passing in `node --test tests/unit/scheduled.test.js`
