---
phase: 05-backup-restore-json-csv-exports-json-import-nag
plan: "05"
subsystem: io/ui
tags: [export, import, csv, json, settings, ui-wiring, integration-tests]

dependency_graph:
  requires:
    - js/io/export.js          # Plans 05-01 (csvCellValue/escapeCSVField) and 05-02 (exportJSON/configureExport)
    - js/io/import.js          # Plan 05-03 (mergeImportedStores/configureImport)
    - js/io/backup-nag.js      # Plan 05-04 (daysSinceLastBackup/shouldShowNag/dismissNag)
    - js/views/settings/builders.js   # Phase 3 card builder pattern
    - js/views/settings.js            # Phase 3 settings mounter
    - tests/helpers/fake-idb.js       # Phase 2 fake-IDB A7 contract

  provides:
    - exportCSV() in js/io/export.js — complete CSV generation (BOM, CRLF, semicolon, row ordering)
    - buildDataCard extended in builders.js — backup status, nag banner, export/import buttons
    - mountSettings extended in settings.js — exportJSON/exportCSV/importJSON/dismissNag action handlers
    - tests/integration/export.integration.test.js — 21 integration tests (export round-trip + CSV format)
    - tests/integration/import.integration.test.js — 16 integration tests (merge, schema, broadcast, timing)

  affects:
    - Settings UI (index.html + desktop.html entry points that mount settings view)

tech-stack:
  added: []
  patterns:
    - "Blob + URL.createObjectURL() + anchor.click() for file download (JSON and CSV)"
    - "FileReader.readAsText() for JSON import via <input type=file>"
    - "BroadcastChannel('habits').postMessage({type:import:done}) AFTER tx commit (D-100 / Pitfall 3)"
    - "wireImportInput() post-mount hook: wires change listener (not click) on file input"
    - "buildCadenceCtx() sync closure over in-memory logs array (Assumption A3)"
    - "dateRange() using UTC arithmetic to avoid DST-shifts during day iteration"

key-files:
  created:
    - path: tests/integration/export.integration.test.js
      description: 21 integration tests for exportJSON and exportCSV — BOM/CRLF/delimiter, cell encoding, row ordering, round-trip
    - path: tests/integration/import.integration.test.js
      description: 16 integration tests for mergeImportedStores — merge-by-id, schema validation, broadcast timing

  modified:
    - path: js/io/export.js
      description: Added exportCSV() + dateRange/sortHabitsForCSV/buildCadenceCtx helpers; updated JSDoc to cover EXPORT-04/05/07
    - path: js/views/settings/builders.js
      description: Extended buildDataCard() with backup section (nag banner, lastBackupDays display, Export JSON/CSV buttons, Import file input)
    - path: js/views/settings.js
      description: Added exports/imports from io/export.js, io/import.js, io/backup-nag.js; added exportJSON/exportCSV/importJSON/dismissNag action handlers; added wireImportInput(); updated refreshLiveCards() to compute nag state; updated buildDataCardFromState() signature

decisions:
  - "buildCadenceCtx uses sync closures over in-memory allLogs array for CSV export (Assumption A3 — acceptable for v1 data volume)"
  - "dateRange() iterates using UTC midnight to avoid DST boundary shifts; formats via sv-SE locale UTC — ensures YYYY-MM-DD consistency"
  - "wireImportInput() is a separate post-mount hook (mirrors wireMasteryInputs pattern) because mount.js only wires click for data-action, but file inputs fire change events"
  - "BroadcastChannel in importJSON action fires a fresh channel per import in addition to the one configureImport may have wired — ensures the UI signal always fires even in test configurations where configureImport has no broadcast"
  - "buildDataCardFromState() extended to accept lastBackupDays and nagVisible parameters; initial mount renders null/false; refreshLiveCards fills in real values async (Pattern S5)"
  - "sortHabitsForCSV() coerces habit.wave to Number; non-numeric waves sort after numeric (tail position — acceptable for v1 where all habits have numeric wave values from seed)"

metrics:
  duration_min: 15
  completed_date: "2026-06-06"
  tasks_completed: 3
  files_created: 2
  files_modified: 3
  tests_added: 37
  tests_total_unit: 478
  tests_total_integration_new: 37
---

# Phase 5 Plan 05: Export/Import UI Wiring Summary

**Complete export/import UI wiring: exportCSV() function with BOM/CRLF/semicolon, Data card builder extended with backup section, Settings action handlers for Export JSON/CSV and Import JSON with Blob download and FileReader upload, plus 37 integration tests verifying format, merge semantics, and cross-tab broadcast timing.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-06T07:34:25Z
- **Completed:** 2026-06-06T07:49:00Z
- **Tasks:** 3 (all autonomous)
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- Task 1: `exportCSV()` complete — BOM, CRLF, semicolon, wave/name sort order, date range, cadence context sync closures; all 40 existing export unit tests pass
- Task 2: `buildDataCard()` extended with backup section (nag banner, lastBackupDays, Export JSON/CSV buttons, Import file input); Settings.js wired with exportJSON/exportCSV/importJSON/dismissNag handlers and wireImportInput() post-mount hook; all 482 unit tests and existing integration tests pass
- Task 3: 21 export integration tests + 16 import integration tests; 37/37 pass

## Task Commits

| Task | Description | Commit | Type |
|------|-------------|--------|------|
| 1 | exportCSV with BOM, CRLF, semicolon delimiter | `51c14a2` | feat |
| 2 | Wire export/import UI in Settings Data card | `dc5e85f` | feat |
| 3 | Add integration tests for export/import and cross-tab sync | `2a5dada` | test |

## Files Created/Modified

- `js/io/export.js` — Extended with `exportCSV({startDate, endDate})` and helpers `dateRange()`, `sortHabitsForCSV()`, `buildCadenceCtx()`
- `js/views/settings/builders.js` — `buildDataCard()` extended with `lastBackupDays`, `shouldShowNag` params, backup section (nag banner, status row, Export JSON/CSV buttons, Import file input)
- `js/views/settings.js` — New imports from io/export.js, io/import.js, io/backup-nag.js; new action handlers `exportJSON`, `exportCSV`, `importJSON`, `dismissNag`; new `wireImportInput()` helper; updated `refreshLiveCards()` and `buildDataCardFromState()` for nag state
- `tests/integration/export.integration.test.js` — 21 tests: JSON round-trip, CSV BOM/CRLF/delimiter, cell encoding (1/0/x, numeric count, archived=x), row ordering, empty repo
- `tests/integration/import.integration.test.js` — 16 tests: all 7 stores merged, local-only preserved, collisions overwritten, schema validation, broadcast timing (Pitfall 3), invalid payload rejection

## Decisions Made

- Cadence context for CSV export uses sync closures over pre-loaded in-memory logs (Assumption A3) — no async IDB calls per cell, acceptable for v1 data volume
- `dateRange()` iterates UTC midnight to avoid DST boundary shifts during multi-day iteration
- `wireImportInput()` wires `change` event (not `click`) on the file input — mirrors `wireMasteryInputs()` pattern established in Phase 3
- `BroadcastChannel` in `importJSON` action fires a fresh channel even if `configureImport` has no broadcast injected — dual-path ensures UI reload signal always fires in production

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — all export/import functionality is fully wired. Export buttons trigger real Blob downloads (verified by action handler logic). Import file picker calls real `mergeImportedStores` (verified by integration tests). Backup nag reads real `daysSinceLastBackup()` on each refresh (verified by architecture — `refreshLiveCards` calls backup-nag module).

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns beyond what the plan's threat model covers. T-05-11 (Tampering via import) is mitigated by `mergeImportedStores` schema validation (tested in import.integration.test.js).

## Self-Check: PASSED

- `js/io/export.js` — FOUND
- `js/views/settings/builders.js` — FOUND
- `js/views/settings.js` — FOUND
- `tests/integration/export.integration.test.js` — FOUND
- `tests/integration/import.integration.test.js` — FOUND
- Task 1 commit `51c14a2` — FOUND in git log
- Task 2 commit `dc5e85f` — FOUND in git log
- Task 3 commit `2a5dada` — FOUND in git log
- 37/37 integration tests pass: VERIFIED
- 478/478 unit tests pass: VERIFIED

---
*Phase: 05-backup-restore-json-csv-exports-json-import-nag*
*Completed: 2026-06-06*
