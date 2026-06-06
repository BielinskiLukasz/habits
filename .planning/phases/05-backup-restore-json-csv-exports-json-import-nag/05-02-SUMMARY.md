---
phase: 05-backup-restore-json-csv-exports-json-import-nag
plan: 02
subsystem: io
tags: [json, export, idb, tdd, backup, repo, schema]

requires:
  - phase: 05-backup-restore-json-csv-exports-json-import-nag
    plan: 01
    provides: js/io/export.js (csvCellValue, escapeCSVField) — export.js file already existed; Plan 02 extends it
  - phase: 02-storage-foundation-the-spine
    provides: js/db/schema.js (DB_VERSION), js/db/repo.js (typed CRUD facade), tests/helpers/fake-idb.js (A7 contract fake)

provides:
  - exportJSON() — async function returning a full-fidelity JSON string of all 7 IDB stores with embedded schemaVersion
  - configureExport({repo}) — DI injection hook (mirrors configureSeed pattern) enabling testable, repo-agnostic JSON export
  - getAllLogs/getAllHabitVersions/getAllEvents/getAllSettings/getAllMeta/getAllScoreSnapshots on repo.js (full-store read methods)
  - Matching getAll* methods on fake-idb.js, A7 contract test updated

affects:
  - 05-03 (CSV file assembly — imports csvCellValue/escapeCSVField from same module)
  - 05-04 (JSON import — will import schemaVersion from same schema.js used by exportJSON)
  - 05-05 (Settings wiring — will call configureExport + exportJSON for the JSON export button)

tech-stack:
  added: []
  patterns:
    - "configureExport({repo}) DI seam mirrors configureSeed({repo, storage, fetch}) in js/io/seed.js"
    - "exportJSON parallel reads: Promise.all([repo.getAllHabits(), ..., repo.getAllScoreSnapshots()]) — 7 stores in parallel"
    - "getAll* method group: one method per IDB store for full-scan reads, all following the existing getAllHabits pattern"

key-files:
  created:
    - tests/unit/export.json.test.js
  modified:
    - js/io/export.js
    - js/db/repo.js
    - tests/helpers/fake-idb.js
    - tests/integration/contract.fake-vs-real.test.js

key-decisions:
  - "exportJSON reads all 7 stores in parallel via Promise.all — no ordering dependency between store reads; matches the single-tx read shape the plan suggested."
  - "getAll* methods added to repo.js mirror the existing getAllHabits pattern (openDB + getAll(db, storeName)). No generic getAll(storeName) wrapper needed — explicit per-store methods are clearer and A7-contract-friendly."
  - "A7 contract test EXPECTED list extended with 6 new names (getAllLogs, getAllHabitVersions, getAllEvents, getAllMeta, getAllSettings, getAllScoreSnapshots). All 3 A7 assertions still pass."
  - "JSON key order in exportJSON output is alphabetical (events, habit_versions, habits, logs, meta, score_snapshots, settings) plus schemaVersion at top. Order is cosmetic; JSON.parse is order-insensitive. Documented in JSDoc for determinism."

patterns-established:
  - "Full-store export reads: repo.getAll{StoreName}() pattern — one exported function per store, no generic dispatch. Callers in export.js enumerate all 7 explicitly so it is impossible to silently omit a store."
  - "TDD gate: RED commit before any implementation, GREEN commit only after all tests pass. REFACTOR skipped when code is clean post-GREEN."

requirements-completed: [EXPORT-01, EXPORT-02]

duration: 25min
completed: 2026-06-06
---

# Phase 5 Plan 02: JSON Export Summary

**`exportJSON()` + `configureExport({repo})` implementing EXPORT-01/EXPORT-02 — full-fidelity 7-store JSON snapshot with embedded schemaVersion, DI-injectable for tests, parallel repo reads via Promise.all**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-06T07:10:00Z
- **Completed:** 2026-06-06T07:35:00Z
- **Tasks:** 1 (TDD: RED → GREEN, no refactor needed)
- **Files modified:** 4 (+ 1 created)

## Accomplishments
- TDD RED gate: 11 failing tests covering all 8 required behaviors (configureExport DI, 7 stores present, schemaVersion, round-trip, field preservation, empty stores, error-if-unconfigured)
- TDD GREEN gate: `exportJSON()` and `configureExport()` added to `js/io/export.js`, all 11 tests pass
- Added 6 new `getAll*` methods to `js/db/repo.js` and matching implementations to `tests/helpers/fake-idb.js`
- A7 contract test updated with 6 new method names; all 3 A7 assertions still pass
- Full test suite: 671 tests total (was 660), zero regressions (2 pre-existing Phase 4 stubs unchanged)
- T-05-04 threat mitigated: JSON.stringify is a built-in safe serializer with no .toJSON() overrides

## Task Commits

1. **Task 1 RED: JSON export tests** - `12de57a` (test)
2. **Task 1 GREEN: exportJSON + configureExport + getAll* methods** - `1cfa9c5` (feat)

## Files Created/Modified
- `tests/unit/export.json.test.js` — 11 tests across 6 describe blocks; covers configureExport DI, all 7 stores, schemaVersion, round-trip, field preservation, empty stores, error handling
- `js/io/export.js` — extended with `configureExport({repo})` DI hook and `exportJSON()` async function; imports `DB_VERSION` from `js/db/schema.js`
- `js/db/repo.js` — 6 new `getAll*` functions: `getAllLogs`, `getAllHabitVersions`, `getAllEvents`, `getAllSettings`, `getAllMeta`, `getAllScoreSnapshots`
- `tests/helpers/fake-idb.js` — 6 matching `getAll*` implementations (Array.from(stores.X.values())); JSDoc updated
- `tests/integration/contract.fake-vs-real.test.js` — 6 new names added to EXPECTED list

## Decisions Made
- Used `Promise.all` for parallel reads of all 7 stores — no ordering dependency between IDB store reads, and parallel reads are faster than sequential on the production IDB path.
- Explicit per-store `getAll*` methods on repo rather than a generic `getAll(storeName)` — matches the existing `getAllHabits` pattern, is A7-friendly, and makes it impossible to silently omit a store in `exportJSON`.
- JSON key order alphabetical (cosmetic; JSON.parse is order-insensitive) with `schemaVersion` first for human readability. Documented in JSDoc.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — `exportJSON` and `configureExport` are complete functions. Integration with file download (Blob + anchor trigger) and Settings UI button is intentionally deferred to Plan 05-05 per the phase plan structure.

## Threat Flags

None — T-05-04 (JSON.stringify safety) was the only threat in scope and is mitigated by using the built-in serializer with no custom .toJSON() overrides or revivers.

## TDD Gate Compliance

- RED commit: `12de57a` — `test(05-02): add failing JSON export tests`
- GREEN commit: `1cfa9c5` — `feat(05-02): implement exportJSON and configureExport`
- REFACTOR: skipped — code was clean after GREEN, no refactor needed

## Next Phase Readiness
- `exportJSON()` is ready for file-download integration in Plan 05-05 (Settings button wiring)
- All 7 IDB stores properly serialized; schemaVersion embedded per EXPORT-01/EXPORT-02
- The `getAll*` methods on repo are available for any future bulk-read needs (e.g., analytics in Phase 6)
- No blockers

---
*Phase: 05-backup-restore-json-csv-exports-json-import-nag*
*Completed: 2026-06-06*
