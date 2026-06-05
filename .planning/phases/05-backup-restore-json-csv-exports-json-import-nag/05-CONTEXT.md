# Phase 5: Backup & Restore (JSON + CSV Exports, JSON Import, Nag) - Context

**Gathered:** 2026-06-05  
**Status:** Ready for planning

<domain>
## Phase Boundary

Make catastrophic IndexedDB loss recoverable and provide CSV exports for external analysis in Polish Windows Excel. Introduce three export/import flows (JSON full-fidelity, CSV habit × day matrix, JSON import with merge-by-id semantics) plus a weekly backup nag ("Last backup: N days ago") in Settings.

**ROADMAP goal:** *"Make catastrophic IndexedDB loss recoverable and give the user the CSV they actually paste into Polish Windows Excel."*

The 13 requirements in scope (EXPORT-01..08, IMPORT-01..05, SETTINGS-03) are pinned by REQUIREMENTS.md. P5 ships the durability and analytics-export surfaces that complete the v1 feature set (P6 adds desktop analytics and scoring models, built on top of these P5 exports).

**Explicitly NOT in P5:**
- Desktop analytics views — P6
- Scoring models S1/S2/S3 — P6
- Multi-device cloud sync — deferred post-v1
- Batch/scheduled exports — deferred

</domain>

<decisions>

## Locked Requirements

**Requirements in scope (from REQUIREMENTS.md):**

- **EXPORT-01..08** — JSON full-fidelity backup, CSV habit × day matrix, date-range export, Polish Windows Excel rendering, multi-occurrence encoding, backup nag
- **IMPORT-01..05** — JSON merge-by-id restore, schemaVersion validation, reload broadcast, no CSV import
- **SETTINGS-03** — Export/import/CSV triggers wired into Settings Data card

## Carried-Forward Decisions

**From Phase 1–4 (locked, non-negotiable):**
- D-27: JSDoc file headers and exported APIs; inline `//` only for "why" notes
- D-28: APP_VERSION follows SemVer 2.0.0; cache name `habits-${APP_VERSION}`
- D-29: Module service worker with ES `import`; cache prefix `habits-`
- D-30: Namespace `habits` everywhere (manifest, IDB DB name, BroadcastChannel, CSV export prefix)
- D-35: English UI + English habit names primary; optional Polish in `name_pl`
- D-39: 7 IDB stores including `score_snapshots`
- D-40: `habits` store carries optional `name_pl` field
- D-42: `events` store uses UUID keyPath
- D-44: Reset-data wired into Settings
- D-48..D-51: Cadence engine (daily, weekly, monthly, every-N-days, day-of-week)
- D-52: `habits` schema denormalized `lastCompletedDate`
- D-74: `markUncompleted` handler
- D-75: `setSetting` handler, self-inverting for undo
- **History integrity rule** — Habit-definition edits never rewrite historical logs; logs always reference the `habit_versions` entry effective at log time
- **Single mutator chokepoint** — All mutations flow through `js/state/apply.js` with deterministic undo via `meta.undoToken`
- **Data persistence** — IndexedDB with BroadcastChannel cross-tab sync and `visibilitychange → hidden` flush

## Implementation Decisions

### JSON Export (EXPORT-01, EXPORT-02)

- **D-91 — JSON structure: flat object with `schemaVersion` at top level** — Export format: `{schemaVersion: 'current', habits: [...], logs: [...], history_edits: [...], settings: [...], waves: [...], events: [...], seed_meta: [...], score_snapshots: [...]}`. Each store is an array of its records, maintaining their original IDB structure. `schemaVersion` must be the current app schema version (from `js/db/schema.js`).
- **D-92 — File naming: `habits-YYYY-MM-DD.json`** — Export date is the download date, not the current app timestamp. Filename matches the CSV pattern `habits-completion-YYYY-MM-DD.csv` for namespace consistency (D-30).
- **JSON is always full-fidelity** — No filtering, no summarization. Every store is exported in full. User can import it into a fresh browser or a different device and have bit-for-bit identical state (except timestamps and browser metadata).
- **Export trigger** — "Export JSON" button in Settings Data card (alongside the future CSV export and import buttons). Clicking it downloads the JSON file; no dialog or confirmation needed (it's a read-only export).

### CSV Export (EXPORT-03, EXPORT-04, EXPORT-05, EXPORT-06, EXPORT-07)

- **D-93 — CSV structure: habit × day wide matrix** — Rows = habits grouped by wave (Fala 0 → Fala 9), then alphabetically by habit name within each wave. Columns = days in chronological ascending order (earliest log date to today, or custom range if date picker is used). Cells encode: `1` (applicable + completed), `0` (applicable + not completed), `x` (not applicable per cadence). For multi-occurrence habits (numeric +1 counter and slot-checklist), cells show the numeric count (e.g., `3` for "3 / 7 meals") instead of `1`. Partial counts (e.g., `2` when target is `7`) are still logged.
- **D-94 — Encoding for special cases:**
  - **Future-startDate habits:** Include as rows; show `x` for all days before `startDate`, then real data from `startDate` onward.
  - **Archived habits:** Include as rows; show real completion data up to the day they were archived, then `x` for all dates after archive date.
  - **Multi-occurrence habits:** Show numeric count (target reached = raw count, not yet reached = raw count, e.g., `3` for `3/7` slots or `5` cups when target is `7`). If target not reached, still show count so user can see progress.
- **D-95 — CSV formatting for Polish Windows Excel:**
  - Delimiter: semicolon (`;`), not comma. Polish Windows Excel with locale-aware delimiter detection defaults to semicolon; this ensures correct parsing on double-click.
  - UTF-8 encoding with BOM (`EF BB BF` bytes at start of file). Excel on Polish Windows recognizes the BOM and correctly renders Polish diacritics (ą ć ę ł ń ó ś ź ż).
  - Line endings: CRLF (`\r\n`). Windows standard; Excel expects this.
  - Quoted fields: Any field containing `;`, `"`, `\r`, `\n`, or leading/trailing whitespace must be quoted. Quotes within quoted fields are escaped as `""` (standard CSV escaping).
  - MIME type: `text/csv;charset=utf-8`.
- **D-96 — File naming: `habits-completion-YYYY-MM-DD.csv`** — Locked by REQUIREMENTS.md and user preference. Export date is the download date. Consistent with P4 decision.
- **D-97 — Date-range picker (optional, v1 scope):** A collapsible "Custom date range" section in the Data card (below the "Export CSV" button or as an inline toggle). When collapsed (default), clicking "Export CSV" exports all data from earliest log to today. When expanded, user sees two date pickers (From / To) and can select a specific range. Export respects the selected range. This is a UI affordance only; the underlying export logic must handle arbitrary ranges correctly.
- **CSV trigger** — "Export CSV" button in Settings Data card. Clicking it triggers the export with the selected or default date range. No dialog or confirmation.

### JSON Import (IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04)

- **D-98 — Import merge strategy: merge-by-id, never delete local-only records** — When user uploads a JSON file, the import process reads each store and merges by primary key:
  - `habits` (keyed by `id`): If an imported habit's `id` already exists locally, the local record is completely replaced with the imported one (including definition, stages, metadata). If the imported habit's `id` is new locally, it's inserted. Local-only habits (those not in the import file) are left untouched.
  - `logs` (keyed by `[habitId, date]`): Same merge-by-id behavior. Imported logs overwrite local logs for the same (habitId, date) pair; non-colliding logs from either source coexist.
  - Other stores (`history_edits`, `settings`, `waves`, `events`, `seed_meta`, `score_snapshots`): Same merge-by-id rule applies.
  - **Critical:** If a user has deleted a habit locally, and the import file contains that habit, the habit is restored (because the import's `id` is not found locally, so it's treated as "new"). This is documented behavior (user controls the export frequency and backup dates to avoid unwanted restores).
- **D-99 — Schema version validation** — Before merging, extract the imported file's `schemaVersion` field and compare it to the current app's `schemaVersion` (from `js/db/schema.js`). If imported version is **newer** than the current app, reject the import with a clear error message: `"This backup was created with a newer version of the app (version {imported}). Please update the app before importing."` Do NOT attempt to import. If imported version equals or is older than the current app, proceed with the merge (assume backward compatibility is maintained in P5 and beyond). No schema migration runs during import; the assumption is that all stores in the import are in the current schema shape.
- **D-100 — Lastly, if the import succeeds, broadcast a reload signal** — After the merge completes and is flushed to IDB, send a `BroadcastChannel('habits')` message: `{type: 'import:done'}`. Other open tabs receive this message and call `location.reload()` to refresh their state from the merged IDB. This ensures cross-tab consistency after an import on another device (though P5 is single-device; the pattern is future-proof).
- **Import trigger** — `<input type="file" accept="application/json">` element in Settings Data card. On file selection, the upload process begins immediately (no separate "Import" button). User sees a progress spinner or confirmation toast once the merge completes.

### Backup Nag & "Last Backup" Display (EXPORT-08, SETTINGS-03)

- **D-101 — "Last backup: N days ago" display in Settings Data card** — Add a new row to the Data card (above the Export/Import buttons or integrated with them): `Last backup: {N} days ago` (or "Never" if no backup has been recorded). This is a read-only display row. Update this text whenever:
  - User exports JSON or CSV (write `{key: 'lastBackupDate', value: 'YYYY-MM-DD'}` to IDB settings store). The display immediately re-renders to show "0 days ago" (same day).
  - App boots and checks IDB; if no `lastBackupDate` setting exists, show "Never". If it exists, calculate days since and display.
  - **Fallback:** If the app has been reset or the user is on a new device and imports a backup file for the first time, parse the imported JSON's `schemaVersion` field (if it includes a creation timestamp, though it may not—this is a best-effort fallback). If no timestamp can be extracted, fall back to showing "Never" until the user exports.
- **D-102 — Weekly backup nag: dismissible banner in Settings Data card** — When the user opens Settings and the "Last backup" display shows ≥ 7 days ago (or "Never"), display a **yellow/warning banner** above or below the Data card heading: `"Last backup: {N} days ago. Export your data now."` (exact wording TBD in UI phase). The banner includes a dismissible `[×]` button. When dismissed, the banner does not reappear until either:
  - The user exports (resetting the counter to 0 days), or
  - 7 more days pass (resets the dismissal state).
  - Dismissal state is stored in localStorage (UI preference, not critical data—survives resets OK) under a key like `'nag:lastDismissed'` with value `'YYYY-MM-DD'`.
- **Nag frequency:** "Weekly" means the nag appears if ≥ 7 days have passed since the last export. It's not a scheduled notification; it's a UI state computed on Settings mount.

### Settings Data Card Extension

- **D-103 — Data card layout (SETTINGS-03 implementation)** — Extend the existing Data card (currently has Undo + Reset buttons) to also include:
  1. "Last backup: N days ago" status row (read-only display or clickable link to export)
  2. "Export JSON" button
  3. "Export CSV" button (with optional collapsible date-range picker below it)
  4. "Import JSON" file input (or button that opens a file picker)
  5. Weekly nag banner (conditional: only appears if ≥ 7 days since last export)
  6. Existing Undo + Reset sections (preserved)
  - Order TBD in UI phase, but "Last backup" status should be prominent and the nag banner should be near the top.

## Carried-Forward Design Constraints

- **No network calls** — All export/import is client-side. Blob download and File picker only.
- **No build-time processing** — JSON and CSV are generated at runtime; no pre-computed exports.
- **Undo-aware** — Export/import are not undoable mutations (they don't go through `apply.js` or write to `events`). They are utility actions, like "Reset data".
- **Cross-tab broadcast after import** — Already specified in D-100. Ensures multi-tab consistency.
- **No CSV import** — IMPORT-05 explicitly locks this out. CSV is read-only export for Excel analysis.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs and constraints
- `.planning/PROJECT.md` — locked stack constraints, Key Decisions D-01..D-42, history integrity rule
- `.planning/REQUIREMENTS.md` — 13 requirements in scope for Phase 5 (EXPORT-01..08, IMPORT-01..05, SETTINGS-03)
- `.planning/ROADMAP.md` §"Phase 5" — goal and success criteria
- `.planning/STATE.md` — Phase 4 complete; Phase 5 ready to plan
- `CLAUDE.md` — TL;DR stack table, Technology Stack section, No-framework/no-bundler/no-npm constraints

### Prior phase context
- `.planning/phases/04-domain-model-cadence-catalog-stages-mastery-multi-occurrence/04-CONTEXT.md` — Decisions D-82..D-90; data model, history integrity, cadence engine
- `.planning/phases/03-today-view-settings-v1-first-usable-slice/03-CONTEXT.md` — Settings infrastructure (D-61..D-67); Data card builder (D-65)
- `.planning/phases/02-storage-foundation-the-spine/02-CONTEXT.md` — IDB schema, BroadcastChannel (D-30), lifecycle flush (D-31), repo interface

### Codebase patterns
- `js/views/settings/builders.js` — Current Data card builder (Pattern S8, D-27, D-78); can be extended with export/import sections
- `js/views/settings.js` — Data card mount and action wiring; future import/export action closures will be added here
- `js/io/seed.js` — Existing import/merge pattern (merge-by-id for seed); can be adapted for user-uploaded JSON imports
- `js/db/idb.js` — Promise-based IDB wrapper; export/import will use `db.getAllStores()` and `db.mergeStore()` helpers
- `js/state/apply.js` — Single mutator chokepoint; export/import do NOT go through here (utility actions, not undoable)

</canonical_refs>

<deferred_ideas>

### Backup & Restore Features Deferred to Post-v1

- **Multi-device cloud sync** — User can export from Device A and import on Device B, but no automatic sync. P5 ships the machinery; P6+ can add a server backend.
- **Batch/scheduled exports** — Automatic daily or weekly exports. Deferred; requires either server (out of scope) or service worker background sync (advanced). V1 user triggers export manually via Settings.
- **CSV import** — Explicitly locked out (IMPORT-05). CSV is for external analysis only.
- **Encrypted backups** — No encryption in v1. Backups are plaintext JSON; user responsibility to store securely.
- **Backup history / version control** — User can keep multiple backup files on their device, but the app doesn't track which backups have been imported or offer a "rollback to date X" UI. That's P6+.

</deferred_ideas>

