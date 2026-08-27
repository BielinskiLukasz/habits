---
phase: 07-scheduled-status-foundation
plan: "03"
subsystem: shell-wiring
tags: [scheduled, boot-sequence, shell, convert-nawyki, import]
status: complete

dependency_graph:
  requires:
    - js/domain/scheduled.js (07-01)
  provides:
    - boot wiring in js/main.js
    - boot wiring in js/desktop.js
    - correct status output in scripts/convert-nawyki.js
  affects:
    - index.html shell boot (bootScheduled fires on every app open)
    - desktop.html shell boot (bootScheduled fires on every app open)

tech_stack:
  added: []
  patterns:
    - Swallowed try/catch for non-critical boot functions (same as bootSeed, hydrate)
    - DI configureScheduled({repo}) alongside other P2 configure calls
    - ISO date string comparison for status derivation (startDate > TODAY)

key_files:
  created: []
  modified:
    - js/main.js
    - js/desktop.js
    - scripts/convert-nawyki.js

decisions:
  - "bootScheduled() positioned after bootSeed() and before hydrate() in both shells so IDB has correct statuses before cache pre-warm (T-07-04 mitigated)"
  - "configureScheduled({repo}) placed after configureUndo({repo}) in the P2 configure block — mirrors existing configure call ordering convention"
  - "js/io/import.js verified DATA-02 compliant via raw IDB put() upsert — no changes needed"
  - "convert-nawyki.js TODAY defined at module top-level (once before main loop) for consistent comparisons across all habits in the same run"
  - "null startDate evaluates null > TODAY as false → status:'active' — correct behavior per D-02 (null startDate means start now)"

metrics:
  duration: "~7 minutes"
  completed: 2026-07-01
  tasks: 2
  files: 3
---

# Phase 07 Plan 03: Shell Wiring and Converter Fix Summary

**One-liner:** Wired `configureScheduled`/`bootScheduled` into both HTML shell boot sequences and fixed `convert-nawyki.js` to emit `status:'scheduled'` for future-startDate habits.

## What Was Built

### Task 1: Wire bootScheduled into main.js and desktop.js

Modified both shell entry points to integrate the `scheduled.js` domain service created in plan 07-01:

**js/main.js** (3 additions + JSDoc update):
1. Import: `import { configureScheduled, bootScheduled } from './domain/scheduled.js';` after the `configureWave/bootWaves` import line
2. Configure: `configureScheduled({ repo });` after `configureUndo({ repo });` in the P2 configure block
3. Boot: `try { await bootScheduled(); } catch (_e) { /* swallow — promotion/migration non-critical on failure */ }` between `bootSeed` and `hydrate`
4. JSDoc: Added step 10 documenting `await bootScheduled()` with DATA-03/SCHED-03 rationale; renumbered subsequent steps

**js/desktop.js** (same 4 changes mirrored):
- Identical import, configure, boot, and JSDoc additions — per D-11 (both shells must wire bootScheduled since either may be the first tab opened)

### Task 2: Fix convert-nawyki.js + verify import.js

**scripts/convert-nawyki.js** (2 changes):
1. Added `const TODAY = new Date().toISOString().slice(0, 10);` immediately after `const ROOT = path.join(__dirname, '..');`
2. Changed `status: 'active',` to `status: startDate > TODAY ? 'scheduled' : 'active',` in the `habits.push()` block

**js/io/import.js** (read-only verification):
- `mergeImportedStores` uses `tx.objectStore(storeName).put(row)` for all 7 stores in a single atomic `repo.runTx()` call
- IDB `put()` is a raw upsert that copies all fields from the imported JSON object including `status`
- A backup containing `status: 'scheduled'` habits will import and preserve that status exactly
- DATA-02 is fully satisfied with no changes required

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `js/main.js` imports `configureScheduled, bootScheduled` from `./domain/scheduled.js` | PASS |
| `js/main.js` calls `configureScheduled({ repo })` in configure block | PASS |
| `js/main.js` calls `await bootScheduled()` in try/catch between bootSeed and hydrate | PASS |
| `js/desktop.js` has all three of the same additions as main.js | PASS |
| `scripts/convert-nawyki.js` contains `const TODAY = new Date().toISOString().slice(0, 10)` | PASS |
| `scripts/convert-nawyki.js` contains `status: startDate > TODAY ? 'scheduled' : 'active'` | PASS |
| `js/io/import.js` is unchanged — DATA-02 verified by reading | PASS |
| Full test suite — no new failures (761 tests, 755 pass, 6 pre-existing failures) | PASS |

## Deviations from Plan

None — plan executed exactly as written. All four changes to each shell file match the prescribed pattern from the 07-PATTERNS.md map.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced.

Threat T-07-04 (boot order violation) mitigated: `bootScheduled()` is placed after `bootSeed()` and before `hydrate()` in both shells, enforced by code placement. JSDoc comment documents the constraint in both files.

## Self-Check: PASSED

- `js/main.js` contains `import { configureScheduled, bootScheduled }` — FOUND
- `js/main.js` contains `configureScheduled({ repo })` — FOUND  
- `js/main.js` contains `await bootScheduled()` in try/catch between bootSeed and hydrate — FOUND
- `js/desktop.js` same three additions — FOUND
- `scripts/convert-nawyki.js` contains `const TODAY = new Date().toISOString().slice(0, 10)` — FOUND
- `scripts/convert-nawyki.js` contains `startDate > TODAY ? 'scheduled' : 'active'` — FOUND
- Task 1 commit `b18d8ee` — FOUND in git log
- Task 2 commit `5bd5abe` — FOUND in git log
- Test suite: 761 tests, 755 pass, 6 fail (all pre-existing) — VERIFIED
