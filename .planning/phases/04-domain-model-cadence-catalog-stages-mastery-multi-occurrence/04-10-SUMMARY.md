---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: 10
subsystem: seed-data, service-worker, versioning
tags: [closeout, seed-enrichment, sw-shell, version-bump, tdd]
dependency_graph:
  requires: [04-07, 04-08, 04-09]
  provides: [P4-seed-v2, sw-shell-P4-locked, v0.4.0]
  affects: [seed/habits.json, sw.js, tests/integration/sw.shell.test.js, js/util/version.js, VERSIONING.md, README.md]
tech_stack:
  added: []
  patterns: [RED-GREEN-TDD, sw-shell-locked-list, seedVersion-bump]
key_files:
  created: []
  modified:
    - seed/habits.json
    - sw.js
    - tests/integration/sw.shell.test.js
    - tests/unit/seed.shape.test.js
    - js/util/version.js
    - VERSIONING.md
    - README.md
decisions:
  - "logShape renamed to targetType in seed/habits.json (consistent with application code which already uses targetType)"
  - "seedVersion bumped 1→2 (new installs only; merge-by-id loader does not overwrite existing IDB data)"
  - "P4_REQUIRED list is hard-coded per the locked D-81 decision (same discipline as P3_REQUIRED)"
  - "APP_VERSION bumped 0.3.0→0.4.0 per D-28 MINOR on phase completion"
metrics:
  duration_seconds: 506
  completed_date: "2026-06-05"
  tasks_completed: 2
  files_changed: 7
  commits: 4
---

# Phase 4 Plan 10: Phase 4 Closeout Summary

**One-liner:** Phase 4 closeout: seed.json enriched with P4 fields (targetType, stages, stageStartedAt, masteryOverrides), SW SHELL extended with 17 new P4 assets, P4_REQUIRED locked list added to sw.shell.test.js, APP_VERSION bumped to 0.4.0.

## What Was Built

### Task 1: seed/habits.json P4 Enrichment

All 8 seed habits updated with:
- `targetType` (renamed from `logShape`) — values: `binary`, `numeric`, `slot-checklist`
- `stages: []` — empty array for all habits except "Morning walk"
- `currentStageIndex: 0` — starting stage pointer
- `stageStartedAt: null` — no active stage clock yet
- `masteryThresholdOverride: null` — use global defaults
- `masteryWindowOverride: null` — use global defaults
- `startDate: null` — no future scheduling on seed habits

"Morning walk" gets a 3-stage array for P4 UAT validation:
```json
[
  {"label":"Stage 1","target":1,"allowManual":true,"advanceAfterDays":30},
  {"label":"Stage 2","target":1,"allowManual":true,"advanceAfterDays":30},
  {"label":"Stage 3","target":1,"allowManual":true}
]
```

`seedVersion` bumped from 1 to 2. The merge-by-id loader in `js/io/seed.js` does not overwrite existing IDB records, so this bump only affects fresh installs.

### Task 2: SW SHELL P4 Extension + Shell Test P4_REQUIRED + Version Bump

17 new P4 files added to `sw.js` SHELL:
- Views: `catalog.js`, `catalog/builders.js`, `history.js`, `history/builders.js`
- Apply handlers: `createHabit.js`, `editHabit.js`, `archiveHabit.js`, `advanceStage.js`, `logNumeric.js`, `logSlot.js`, `setMasteryThreshold.js`, `setMasteryWindow.js`
- Domain: `mastery.js`, `stage.js`, `waveAggregates.js`
- CSS: `catalog.css`, `history.css`

`P4_REQUIRED` const and test added to `tests/integration/sw.shell.test.js`, with the same locked-list discipline as `P3_REQUIRED` (D-81 decision).

`APP_VERSION` bumped `0.3.0` → `0.4.0` in `js/util/version.js`.

`VERSIONING.md` updated with v0.4.0 release entry (D-83..D-90 feature summary).

`README.md` Version history section updated with v0.4.0 line.

## TDD Gate Compliance

### Task 1 (seed enrichment)
- RED commit `21e6742`: Updated `seed.shape.test.js` to check `targetType` instead of `logShape`, added P4 field assertions, updated `seedVersion` expectation to 2 — 10 tests failing
- GREEN commit `9f4111f`: Updated `seed/habits.json` with all P4 fields — 15/15 tests passing

### Task 2 (sw.js + version)
- RED commit `ce3fe5b`: Added `P4_REQUIRED` list and test to `sw.shell.test.js` — 1 test failing
- GREEN commit `c8105b8`: Extended sw.js SHELL, bumped APP_VERSION, updated VERSIONING.md and README.md — 5/5 tests passing

## Deviations from Plan

None — plan executed exactly as written.

One minor clarification: the plan's Task 1 `<done>` criteria listed "Seed shape test still passes" — this required updating `seed.shape.test.js` alongside the seed (since the test previously checked `h.logShape`, which would have become undefined after the rename). The test update was the RED phase of the TDD cycle; not a deviation but expected TDD process.

## Acceptance Criteria Verification

- [x] `npm test -- tests/unit/seed.shape.test.js` green after seed enrichment (15/15 pass)
- [x] `npm test -- tests/integration/sw.shell.test.js` green with P4_REQUIRED tests passing (5/5 pass)
- [x] Full suite: 600/602 passing (2 pre-existing planned stubs; no regression)
- [x] `seed/habits.json` has `seedVersion: 2`; all habits have `targetType` (not `logShape`); `stages` array present; "Morning walk" has 3 stage objects
- [x] `js/util/version.js` APP_VERSION === '0.4.0'
- [x] `VERSIONING.md` has v0.4.0 entry
- [x] sw.js SHELL contains `'./js/views/catalog.js'` and `'./css/catalog.css'`

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `21e6742` | test | RED: add failing tests for P4 seed enrichment |
| `9f4111f` | feat | GREEN: enrich seed/habits.json with P4 fields |
| `ce3fe5b` | test | RED: add failing P4_REQUIRED list to sw.shell.test.js |
| `c8105b8` | feat | GREEN: extend sw.js SHELL + bump to v0.4.0 |

## Known Stubs

None introduced by this plan. The 2 pre-existing stub test failures (`wave-aggregates.test.js` and `mastery-cadence.test.js`) were created by earlier plans and remain as planned placeholders for integration test flesh-out.

## Threat Flags

None. The sw.js SHELL extension is a pure addition (no new network endpoints or trust boundaries introduced). The seed `seedVersion` bump follows the documented merge-by-id semantics (T-04-10b accepted in the plan's threat model).

## Self-Check: PASSED

- `seed/habits.json` exists with `seedVersion: 2` and `targetType` fields on all 8 habits
- `sw.js` contains `'./css/catalog.css'` and all 17 P4 SHELL entries
- `tests/integration/sw.shell.test.js` contains `P4_REQUIRED` array and passing test
- `js/util/version.js` has `APP_VERSION = '0.4.0'`
- `VERSIONING.md` has v0.4.0 section
- `README.md` has v0.4.0 in Version history
- All 4 commits exist: `21e6742`, `9f4111f`, `ce3fe5b`, `c8105b8`
