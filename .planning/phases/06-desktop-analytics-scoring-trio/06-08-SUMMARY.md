---
phase: "06"
plan: "08"
subsystem: sw-shell-closeout
tags: [sw, shell, d81, version-bump, versioning, tdd-red-green, p6-required]
dependency_graph:
  requires: [sw.js (P4 SHELL), js/util/version.js (D-28), tests/integration/sw.shell.test.js (P4 extended)]
  provides: [P6_REQUIRED test list, 6 P6 SHELL entries, APP_VERSION 0.5.0, VERSIONING.md v0.5.0 entry]
  affects: [sw.js, tests/integration/sw.shell.test.js, js/util/version.js, VERSIONING.md]
tech_stack:
  added: []
  patterns: [TDD RED-GREEN (sw.shell test then SHELL extension), D-81 SHELL coverage guard, D-28 SemVer phase-completion MINOR bump]
key_files:
  created: []
  modified:
    - tests/integration/sw.shell.test.js
    - sw.js
    - js/util/version.js
    - VERSIONING.md
decisions:
  - P6_REQUIRED list is HARD-CODED (same discipline as P3/P4 lists — human slip catching is the value)
  - desktop.html NOT duplicated in P6 entries (already in P2 baseline)
  - APP_VERSION bumped 0.4.0 -> 0.5.0 (Phase 6 milestone MINOR bump per D-28)
  - VERSIONING.md v0.5.0 section prepended (newest-first ordering preserved)
metrics:
  duration: "~7 min"
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 0
  files_modified: 4
  tests_added: 1
status: complete
---

# Phase 06 Plan 08: Phase Closeout — SW Shell, Version Bump, VERSIONING.md Summary

**One-liner:** TDD RED→GREEN P6_REQUIRED guard in sw.shell.test.js + 6 P6 SHELL entries in sw.js + APP_VERSION bump 0.4.0→0.5.0 + VERSIONING.md v0.5.0 release entry.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | 565834a | P6_REQUIRED list + test in sw.shell.test.js — fails RED (6 entries missing from SHELL) |
| T1 GREEN | feat | 83dd9d9 | Add 6 P6 entries to sw.js SHELL — P6_REQUIRED test passes GREEN |
| T2 | docs | 3be69ba | Bump APP_VERSION 0.4.0→0.5.0 in version.js; prepend v0.5.0 entry to VERSIONING.md |

## What Was Built

### tests/integration/sw.shell.test.js (modified)

**Added P6_REQUIRED constant:**
```javascript
const P6_REQUIRED = [
  './css/desktop.css',
  './js/domain/scoring.js',
  './js/io/scoreSnapshots.js',
  './js/views/desktop/analytics.js',
  './js/views/desktop/waveboard.js',
  './js/views/desktop/planning.js',
];
```

**Added 'P6 required entries are all present' test** inside `describe('D-81 SHELL coverage', ...)`:
- Uses same pattern as P3/P4 tests: `filter((e) => !shell.has(e))` → `deepEqual(missing, [])`.
- Error message cites D-81 and lists missing entries to aid diagnosis.

### sw.js (modified)

**Added Phase-6 comment block + 6 SHELL entries after P4 section:**
- `./css/desktop.css`
- `./js/domain/scoring.js`
- `./js/io/scoreSnapshots.js`
- `./js/views/desktop/analytics.js`
- `./js/views/desktop/waveboard.js`
- `./js/views/desktop/planning.js`

`./desktop.html` was NOT added (already in P2 baseline — confirmed by parser and the existing P2 test).

### js/util/version.js (modified)

Single-line change: `APP_VERSION = '0.4.0'` → `APP_VERSION = '0.5.0'`. Cache name changes from `habits-0.4.0` to `habits-0.5.0` on next SW activate cycle.

### VERSIONING.md (modified)

Prepended `## v0.5.0 — Desktop Analytics & Scoring Trio (Phase 6)` section covering:
- Desktop analytics shell with sidebar + hash-routed panels
- Analytics / Wave-board / Planning views
- Three scoring models (S1/S2/S3) + Settings selector
- score_snapshots IDB population
- router.js defaultRoute parameter fix

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All Phase 6 files are real implementations verified by the `every SHELL entry resolves to a real file on disk` test (T-03-41 gate).

## Threat Flags

None. Changes are test-only + SHELL configuration + version string + documentation.

## TDD Gate Compliance

- RED gate: `test(06-08)` commit `565834a` — P6_REQUIRED test fails with all 6 entries missing from SHELL (RED confirmed)
- GREEN gate: `feat(06-08)` commit `83dd9d9` — 6/6 P6_REQUIRED entries in SHELL, all sw.shell tests pass, full suite 798/800

## Self-Check

### Files modified exist:
- tests/integration/sw.shell.test.js — FOUND (P6_REQUIRED + test added)
- sw.js — FOUND (6 P6 entries added to SHELL)
- js/util/version.js — FOUND (APP_VERSION = '0.5.0')
- VERSIONING.md — FOUND (v0.5.0 section prepended)

### Commits exist:
- 565834a — FOUND (test(06-08): P6_REQUIRED list in sw.shell.test.js)
- 83dd9d9 — FOUND (feat(06-08): add P6 files to sw.js SHELL (D-81))
- 3be69ba — FOUND (docs(06-08): APP_VERSION 0.4.0 -> 0.5.0, VERSIONING.md v0.5.0 entry)

### Tests pass:
- `node --test tests/integration/sw.shell.test.js` → 6/6 pass
- Full suite: 798/800 (2 pre-existing stubs from plans 04-02 and 04-04, no regressions)

## Self-Check: PASSED
