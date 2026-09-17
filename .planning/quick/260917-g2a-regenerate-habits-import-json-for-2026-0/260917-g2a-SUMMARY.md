---
phase: quick-260917-g2a
plan: 01
subsystem: data-tooling
tags: [csv-import, data-migration, one-off-script]
status: complete
dependency-graph:
  requires: [data/habits-import-2026-08-27.json, data/Nawyki v1.csv]
  provides: [data/convert-csv-to-import-2026-09-17.mjs, data/habits-import-2026-09-17.json]
  affects: []
tech-stack:
  added: []
  patterns: [absolute-header-index date-column discovery instead of positional offset arithmetic]
key-files:
  created:
    - data/convert-csv-to-import-2026-09-17.mjs
    - data/habits-import-2026-09-17.json
  modified: []
decisions:
  - Reused 08-27 import JSON as habit catalog (already has resolved names/UUIDs/startDate) instead of raw app export
  - Date-column discovery scans the entire header row for date-shaped strings and pairs each with its absolute index, filtered to d <= TODAY, rather than reconstructing offsets from a fixed DATE_START — required because the CSV header now has a stray "x" column at index 8 and a duplicated second date block at indices 379-556
metrics:
  duration: 480
  completed: 2026-09-17
actuals:
  tokens: 3200
  tasks: 2
  commits: 0
---

# Phase quick-260917-g2a Plan 01: Regenerate habits import JSON for 2026-09-17 Summary

New one-off converter script reads the 08-27 habit catalog and re-parses the extended
`Nawyki v1.csv` (now spanning through 2026-09-17) by scanning the entire CSV header row for
date-shaped columns and pairing each with its absolute index — rather than the original
script's fixed-offset arithmetic — because the current CSV inserts a stray `"x"` column and
appends a duplicated, `#REF!`-filled second date block later in the header.

## What Was Built

- `data/convert-csv-to-import-2026-09-17.mjs` — new converter script, structurally identical to
  `data/convert-csv-to-import.mjs` (same CSV parser, `normSkeleton`, and 33-entry `MANUAL_MAP`,
  all reused verbatim) with three deliberate differences: (1) loads
  `data/habits-import-2026-08-27.json` as the habit catalog instead of the raw app export,
  (2) `TODAY = '2026-09-17'`, and (3) date-column discovery scans the full header row for
  `/^\d{4}-\d{2}-\d{2}$/` matches and reads each matched column by its absolute index, filtered
  to `d <= TODAY`, instead of slicing from a fixed `DATE_START` offset.
- `data/habits-import-2026-09-17.json` — generated output: `schemaVersion: 1`, 66 habits (same
  id set as the 08-27 catalog, objects unmodified), 7475 logs spanning 2025-12-30 through
  2026-09-17, empty `habit_versions`/`events`/`settings`/`meta`/`score_snapshots` arrays.

## Verification Results

- `node --check data/convert-csv-to-import-2026-09-17.mjs` — passed, no syntax errors.
- `node data/convert-csv-to-import-2026-09-17.mjs` — stdout: "CSV rows: 66, matched: 66,
  unmatched: 0" and "✓ 66 habits, 7475 logs → data/habits-import-2026-09-17.json".
- Programmatic validation: `{"habits":66,"logs":7475,"min":"2025-12-30","max":"2026-09-17","idSetMatch":true,"ok":true}`.
- Additional checks performed beyond the plan's automated verify: 0 habit-object mismatches
  between the 08-27 catalog and the 09-17 output (byte-identical JSON per habit), 0 logs dated
  after TODAY.
- `git status --porcelain data/convert-csv-to-import.mjs data/habits-import-2026-08-27.json` —
  empty; both historical 08-27 artifacts are untouched.
- No files under `js/`, `css/`, `index.html`, or `desktop.html` were modified.

## Deviations from Plan

None — plan executed exactly as written. The header-layout observations described in the
plan's critical-fix note (stray `"x"` column at index 8, duplicated date block at indices
379-556 spanning back to 2025-12-30 with data cells that are never exactly `'1'`/`'0'`) were
independently confirmed against the actual CSV before writing the script, and matched the
plan's description exactly.

## Commit Note

`data/` is gitignored project-wide (`.gitignore: data/` — personal habit data, matching the
project's no-telemetry/local-only privacy constraint). Both files this plan creates
(`data/convert-csv-to-import-2026-09-17.mjs` and `data/habits-import-2026-09-17.json`) fall
under that ignore rule, so there is nothing to `git add`/commit for either task — attempting to
stage them fails with git's "ignored by .gitignore" error, and per the destructive-git-and-commit
guidance this was not overridden with `git add -f`. No commits were made for this quick task;
both artifacts exist on disk only, which matches how the 08-27 import file was already handled.

## Known Stubs

None.

## Threat Flags

None — this script only reads two local, user-controlled files and writes a new local JSON
file; no new network surface, auth path, or schema change was introduced.

## Self-Check: PASSED

- FOUND: data/convert-csv-to-import-2026-09-17.mjs (8546 bytes)
- FOUND: data/habits-import-2026-09-17.json (1192298 bytes)
- No commits to verify (data/ is gitignored; see Commit Note above)
