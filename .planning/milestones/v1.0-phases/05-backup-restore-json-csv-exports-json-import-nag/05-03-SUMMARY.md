---
phase: 05-backup-restore-json-csv-exports-json-import-nag
plan: "03"
subsystem: io/import
tags: [tdd, import, merge-by-id, schema-validation, atomicity]
dependency_graph:
  requires:
    - js/db/schema.js       # DB_VERSION constant for schema validation
    - js/db/repo.js         # repo.runTx() for atomic multi-store merge
    - tests/helpers/fake-idb.js  # createFakeRepo() for unit tests
  provides:
    - js/io/import.js       # mergeImportedStores + configureImport
    - tests/unit/import.test.js  # 18 unit tests for merge and validation logic
  affects:
    - js/views/settings.js  # Plan 05-05 will wire file-upload UI here
tech_stack:
  added: []
  patterns:
    - configure-based DI (same pattern as js/io/seed.js: module-level mutables + configureXxx function)
    - repo.runTx() for atomic multi-store write (same pattern as seed.js bootSeed)
    - broadcast-after-commit (D-100 / Pitfall 3: postMessage fired only after tx resolves)
key_files:
  created:
    - path: js/io/import.js
      description: JSON import module — mergeImportedStores() + configureImport() DI hook
    - path: tests/unit/import.test.js
      description: 18 unit tests covering merge-by-id, schema validation, atomicity, broadcast
  modified: []
decisions:
  - "mergeImportedStores uses repo.runTx() over all 7 stores in one call — atomicity is
     the contract; partial imports on mid-tx error are impossible"
  - "configureImport checks hasOwnProperty('broadcast') so a test can explicitly reset
     the broadcast to null without re-injecting the repo"
  - "Missing schemaVersion defaults to 1 (not current DB_VERSION) — the assumption is
     that very old exports predate the field and were written when the schema was v1"
  - "REFACTOR commit skipped — implementation is clean and single-responsibility; no
     further extraction improves readability"
metrics:
  duration_min: 7
  completed_date: "2026-06-06"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
  tests_added: 18
  tests_total_before: 647
  tests_total_after: 647
  tdd_gate_compliant: true
---

# Phase 5 Plan 3: JSON Import Merge-by-ID Summary

JSON import with merge-by-id semantics via `mergeImportedStores()` and `configureImport()` DI hook; schema version validation (D-99) rejects imports from newer app versions; all 7 IDB stores merged atomically via `repo.runTx()`.

## What Was Built

`js/io/import.js` — the restore module for Plan 05-03:

- `configureImport({repo, broadcast})` — dependency injection following the `seed.js` pattern; `broadcast` is optional (Plan 05-05 wires the real BroadcastChannel).
- `mergeImportedStores(imported)` — validates structural integrity (must be object with `habits` array), checks `schemaVersion` against `DB_VERSION` (D-99), then merges all 7 stores in a single `repo.runTx()` call (D-98). After the transaction commits, calls `broadcast.postMessage({type: 'import:done'})` if configured (D-100).

`tests/unit/import.test.js` — 18 unit tests covering:

- Merge-by-id: collision overwrites (Tests 1, 6, 7), local-only records preserved (Tests 2, 2b)
- Schema validation: newer version rejected (Test 3), older/equal accepted (Tests 4, 5, 10)
- Invalid payload: null, non-object, missing `habits` array (Tests 9, 9b, 9c)
- All 7 stores merged: habits, habit_versions, logs, events, settings, meta, score_snapshots (Test 8)
- Empty/missing store keys in payload: no error (Tests 8b, 8c)
- Broadcast after tx: postMessage fired (Test broadcast), absent broadcast no-throw (Test broadcast-absent)
- DI injection: configureImport does not throw (Test 11)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `90856ea` — `test(05-03): add failing JSON import merge and validation tests` | PASS |
| GREEN | `9fb50a0` — `feat(05-03): implement mergeImportedStores and configureImport` | PASS |
| REFACTOR | skipped — no meaningful refactoring identified | N/A |

## Requirements Satisfied

- **IMPORT-01**: `mergeImportedStores()` is the domain function; Plan 05-05 will wire the file-upload UI that calls it.
- **IMPORT-02**: Merge-by-id semantics — `tx.put()` upsert on collision; no `delete()` calls; local-only records preserved.
- **IMPORT-03**: Schema version validation — rejects imports with `schemaVersion > DB_VERSION` with message `"This backup was created with a newer version of the app..."`.

## Threat Model Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-05-05 (Tampering — imported JSON structure) | mitigate | Structural validation before any IDB write; schema version check (D-99) |
| T-05-06 (Info Disclosure — merge restores deleted data) | accept | Restored data is user's own backup content (D-98 semantics) |
| T-05-07 (DoS — very large import) | accept | No size limit in P5 per threat model disposition |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `mergeImportedStores()` is complete domain logic. The UI wiring (file picker, action closure, feedback toast) and real BroadcastChannel injection are Plan 05-05 responsibilities, not stubs in this module.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns beyond what the plan's threat model covers.

## Self-Check: PASSED

- `js/io/import.js` — FOUND (`9fb50a0`)
- `tests/unit/import.test.js` — FOUND (`90856ea`)
- RED commit `90856ea` — FOUND in git log
- GREEN commit `9fb50a0` — FOUND in git log
- 18/18 tests pass (`node --test tests/unit/import.test.js`)
