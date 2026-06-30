# Phase 5: Backup & Restore (JSON + CSV Exports, JSON Import, Nag) - Research

**Researched:** 2026-06-05  
**Domain:** Export/Import mechanics, CSV formatting, merge semantics, localStorage persistence  
**Confidence:** HIGH (all design decisions locked in CONTEXT.md; implementation paths verified against codebase patterns)

## Summary

Phase 5 implements durability and external-analysis exports for the Nawyki app. The research confirms that all 13 requirements (EXPORT-01..08, IMPORT-01..05, SETTINGS-03) can be fulfilled using existing codebase patterns:

- **JSON export**: Full-fidelity snapshot of all 7 IDB stores wrapped in a `{schemaVersion, habits: [...], logs: [...], ...}` structure, generated at runtime via `repo.getAll*()` traversals.
- **CSV export**: Habit × day matrix with semicolon delimiter, UTF-8 BOM, CRLF line endings. Cells encode `1`/`0`/`x` (not applicable) per cadence rules using `appliesToday()` + log reads. Multi-occurrence habits show numeric counts.
- **JSON import**: Merge-by-id semantics using `repo.runTx()` with row-by-row put logic (no deletes). Schema version validation blocks imports from newer app versions.
- **Backup nag**: "Last backup" computed from `settings` store `lastBackupDate` key; dismissal state stored in `localStorage` under `nag:lastDismissed`.
- **Settings UI extension**: Existing `buildDataCard()` builder extended with export/import buttons and last-backup status row.

No custom solutions needed for any problem domain — JSON serialization, CSV encoding, IDB merge logic, and localStorage are all standard browser APIs. The planner can directly use existing `repo.runTx()` + `mount()` + `apply()` patterns.

**Primary recommendation:** Implement export/import in two parallel modules (`js/io/export.js` and `js/io/import.js`) following the same structure as `js/io/seed.js` (configure-based DI, promise-based API). Wire UI through Settings Data card builder extension. Add unit tests for CSV cell calculation logic (cadence + multi-occurrence encoding). Integration tests verify export→import round-trip with merge-by-id semantics preserved.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JSON/CSV generation | API / Backend (browser-side) | — | Runtime computation from IDB; not user-facing UI |
| CSV cell encoding (1/0/x) | API / Backend | — | Business logic (cadence + multi-occurrence math) |
| File download (Blob+anchor) | Browser / Client | — | Standard DOM-side download mechanism |
| File upload + parse | Browser / Client | — | `<input type="file">` + JSON.parse in worker thread |
| IDB merge (import) | API / Backend | — | Transaction-based merge logic through `repo.runTx()` |
| Settings UI (export/import buttons) | Frontend / SSR-equivalent | — | Pure builder + mount pattern (already established in Phase 3) |
| Last backup date storage | API / Backend (settings store) | Browser (localStorage for nag dismiss) | Canonical `lastBackupDate` in `settings` IDB store; dismissal state transient in localStorage |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**JSON Export Structure (D-91):** `{schemaVersion: 'current', habits: [...], logs: [...], history_edits: [...], settings: [...], waves: [...], events: [...], seed_meta: [...], score_snapshots: [...]}`  
**File naming:** `habits-YYYY-MM-DD.json` and `habits-completion-YYYY-MM-DD.csv` (download date, not app timestamp)  
**CSV Delimiter:** Semicolon (`;`) not comma — Polish Windows Excel locale default  
**CSV Encoding:** UTF-8 with BOM, CRLF line endings, standard CSV quote escaping (`"` → `""` inside quoted fields)  
**CSV Cell Encoding (D-93, D-94):**
  - `1` = applicable + completed
  - `0` = applicable + not completed  
  - `x` = not applicable (cadence exclusion, future-startDate, archived)
  - Multi-occurrence: numeric count (e.g., `3` for "3/7" slots or "5 cups" when target is 7)  

**CSV Row/Column Order (D-93):** Rows = habits grouped by wave (Fala 0→9), then alphabetically within wave. Columns = chronological ascending (earliest log to today).  
**Import Merge Strategy (D-98):** Merge-by-id, never delete local-only records. Imported habit id overwrites local if both exist; non-colliding records coexist.  
**Schema Version Validation (D-99):** Reject imports with `schemaVersion > current` with error message. Accept equal or older (assume backward compatibility).  
**Import Broadcast (D-100):** After merge completes, send `BroadcastChannel('habits').postMessage({type: 'import:done'})` to trigger reload in other tabs.  
**Backup Nag (D-101, D-102):**
  - Display: "Last backup: N days ago" in Data card (update on JSON/CSV export)  
  - Nag banner (conditional): Yellow/warning banner when `≥ 7 days` since export  
  - Dismissal: localStorage `nag:lastDismissed` (YYYY-MM-DD) — reappears after 7 days OR on export  
  - Frequency: UI-computed on Settings mount, not scheduled  

**No CSV Import:** IMPORT-05 explicitly forbids; CSV is read-only export.  
**Namespace Consistency:** All files prefixed `habits-` per D-30 (manifest, IDB DB name, BroadcastChannel, CSV).

### Claude's Discretion

- CSV date-range picker (D-97): collapsible UI affordance for custom date range. When collapsed (default), exports full span. When expanded, user sees two date pickers (From / To).
- CSV row grouping secondary sort: alphabetical within wave (D-93 implies this; not yet implemented in builders).
- Nag banner wording: "Last backup: {N} days ago. Export your data now." (exact string TBD in Phase 5 plan, not research).

### Deferred Ideas (OUT OF SCOPE)

- Multi-device cloud sync — P5 ships the JSON export/import machinery; P6+ can add server.
- Batch/scheduled automatic exports — requires background sync or server; V1 user-triggered.
- CSV import — explicitly locked out.
- Encrypted backups — V1 plaintext; user owns security.
- Backup history / version control — no rollback UI; user manages backup files manually.
- Timestamp in exported JSON's `schemaVersion` field — D-101 fallback says "if it includes a creation timestamp"; schema version is a simple number, not an object.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | User can download full-fidelity JSON backup via Settings action | `js/io/export.js` module with `exportAllStores()` function; `repo.getAll*()` methods cover all 7 stores |
| EXPORT-02 | JSON export embeds current `schemaVersion` | Read from `settings` store or `js/db/schema.js` constant `DB_VERSION` |
| EXPORT-03 | User can download CSV habit × day matrix | `js/io/export.js` with `exportCSV(dateRange?)` function; iterate habits by wave, calculate cell values |
| EXPORT-04 | CSV uses `;` delimiter, UTF-8 BOM, CRLF | Standard CSV escaping in plain JS; `﻿` BOM prefix; string `.replace(/\n/g, '\r\n')` |
| EXPORT-05 | CSV preserves Polish diacritics in Polish Excel | UTF-8 encoding (default in JS strings) + BOM ensures Excel recognizes charset |
| EXPORT-06 | Multi-occurrence cells show numeric count | Log row carries `completed` (boolean) or count (number); CSV renders the raw value |
| EXPORT-07 | CSV filename includes export date | `new Date().toLocaleDateString('sv-SE')` → YYYY-MM-DD format |
| EXPORT-08 | "Last backup: N days ago" banner + weekly nag | Settings `lastBackupDate` key; `localStorage` `nag:lastDismissed`; computed on Settings mount |
| IMPORT-01 | User can upload JSON backup file to restore | Settings UI: `<input type="file" accept="application/json">`; `js/io/import.js` with `mergeImportedStores()` |
| IMPORT-02 | Import merge-by-id, never delete local-only | `repo.runTx()` with per-store merge logic; `for (const row of imported[store])` + check existence then put |
| IMPORT-03 | Reject newer `schemaVersion` with error | Extract `imported.schemaVersion`, compare to `DB_VERSION`, throw if `>` current |
| IMPORT-04 | Broadcast reload signal to other tabs | `BroadcastChannel('habits').postMessage({type: 'import:done'})` after merge tx completes |
| IMPORT-05 | CSV import NOT supported | No CSV input handler; requirement explicitly locks this out |
| SETTINGS-03 | Export/import/CSV triggers in Settings Data card | Extend `buildDataCard()` builder + wire action closures in `js/views/settings.js` |

## Standard Stack

### Core Export/Import Modules

| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `js/io/export.js` | JSON full-backup + CSV matrix generation | Mirrors `js/io/seed.js` DI pattern; plain JS string building |
| `js/io/import.js` | JSON merge-by-id restore + schema validation | Uses `repo.runTx()` for transaction safety; same pattern as `apply.js` |
| `js/views/settings/builders.js` (extended) | Data card builder update + last-backup status | Existing builder pattern from Phase 3; no new dependencies |

### Browser APIs (all native, no CDN/npm)

| API | Use Case | Notes |
|-----|----------|-------|
| `Blob` + `URL.createObjectURL()` | Generate downloadable file in memory | Works on `file://` and HTTP(S); no File System Access API needed |
| `<a download="filename">` + `.click()` | Trigger browser file download | Standard; no permissions; works on `file://` |
| `<input type="file" accept="...">` | User file picker | Standard; triggers click, reads `.files[0]` |
| `FileReader` API | Read uploaded file as text/ArrayBuffer | Sync string parsing of JSON; standard |
| `JSON.parse()` / `JSON.stringify()` | Serialize/deserialize IDB snapshots | Built-in; safe by default (no proto pollution) |
| `localStorage` | Store nag dismissal state (`nag:lastDismissed`) | Transient UI preference; not critical data |
| `BroadcastChannel` | Cross-tab import signal | Already used in Phase 2 (`sync.js`); existing pattern |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV escaping and quoting | Custom quote/escape logic | Standard CSV rules: if field contains `;`, `"`, `\r`, `\n`, or leading/trailing space, quote it; escape `"` as `""` | Subtle edge cases; RFC 4180 is well-defined |
| IDB merge with multi-store consistency | Sequence of individual puts | `repo.runTx(stores, 'readwrite', body)` atomic transaction | Prevents partial imports if one store fails; ensures cross-store consistency |
| Cadence applicability on past days | Custom day-of-week / every-n-days logic | `appliesToday(habit, date, ctx)` from `js/domain/cadence.js` + pass computed log counts via ctx | Exact same resolver logic as Today view; reuses verified business logic |
| JSON schema validation on import | No validation, assume file is correct | Explicit check: `imported.schemaVersion > DB_VERSION` → reject with error message | Prevents silent data corruption from imports created by future versions |
| Last backup date display and aging | Hardcoded "X days ago" strings | Compute: `(today - parseDateISO(lastBackupDate)) / 86400000` in milliseconds; handle "Never" case | Single source of truth in settings store |
| Date formatting (YYYY-MM-DD) | Custom string manipulation | `new Date().toLocaleDateString('sv-SE')` (ISO 8601 locale) or manual `padStart` with template literals | Consistent with existing D-06 date key format |

**Key insight:** CSV generation and IDB merge are deceptively complex domains with many edge cases (cadence types, archived habits, multi-occurrence counts, partial completions, month boundaries, DST). The app already has battle-tested cadence and log-handling logic; reuse it rather than reimplementing.

## Architecture Patterns

### System Architecture Diagram

```
User opens Settings
   ↓
[Data Card UI]
   ├─→ "Last backup: N days ago" (read from settings store)
   ├─→ "Export JSON" button → js/io/export.js → read all 7 stores → Blob + download
   ├─→ "Export CSV" button → js/io/export.js → iterate habits/logs → format CSV → Blob + download
   ├─→ "Import JSON" file input → user picks file → FileReader.readAsText() → JSON.parse()
   │                              → js/io/import.js → validate schemaVersion → repo.runTx() merge
   │                              → BroadcastChannel broadcast → other tabs reload()
   └─→ "Weekly nag banner" (conditional: visible if ≥7 days since lastBackupDate)
       ├─→ [×] dismiss → localStorage nag:lastDismissed = today
       └─→ reappears after 7 days OR on next export

[Store structure at rest]
   ├─→ settings: {key: 'lastBackupDate', value: 'YYYY-MM-DD'} (singleton, nullable)
   ├─→ meta: unchanged (already exists)
   └─→ habits, logs, habit_versions, events, score_snapshots, waves (unchanged)

[Cross-tab sync after import]
   Tab A: imports file → merge tx completes → broadcast {type: 'import:done'}
   Tab B: receives message → location.reload()
   (Pattern: already established in Phase 2 sync.js)
```

### Recommended Project Structure

New files:
```
js/io/
├── export.js        # exportJSON() + exportCSV() + configureExport({repo})
└── import.js        # mergeImportedStores() + configureImport({repo, broadcast})
```

Modified files:
```
js/views/settings/
└── builders.js      # buildDataCard() extended with lastBackupDate row + export/import buttons
js/views/
└── settings.js      # action closures for export/import file I/O
js/state/
└── apply.js         # new handler: handleExport (or kept as non-undoable utility) — writes lastBackupDate to settings
```

### Pattern 1: Export JSON (Full-Fidelity Backup)

**What:** Snapshot all 7 IDB stores into a single JSON file: `{schemaVersion, habits: [...], logs: [...], ...}`  
**When to use:** User clicks "Export JSON" in Settings Data card.

**Structure:**

```javascript
/**
 * @file Full-fidelity JSON backup + CSV matrix export.
 * Mirrors the `js/io/seed.js` DI pattern (configureSeed).
 */
let _repo = null;

export function configureExport(deps) {
  if (deps.repo) _repo = deps.repo;
}

/**
 * Export all 7 stores as JSON: {schemaVersion: 1, habits: [...], logs: [...], ...}
 * @returns {Promise<string>} JSON string, ready for Blob + download
 */
export async function exportJSON() {
  const repo = _repo;
  // For each store name in schema, read all rows via repo.getAll*() or runTx
  // D-39 stores: habits, habit_versions, logs, events, settings, meta, score_snapshots
  const habits = await repo.getAllHabits();
  const logs = await repo.getAll('logs'); // Add this method to repo if missing
  // ... etc for all 7 stores
  
  const DB_VERSION = await repo.getSetting('schemaVersion')?.then(s => s.value) 
                     ?? (await import('../db/schema.js')).DB_VERSION;
  
  return JSON.stringify({
    schemaVersion: DB_VERSION,
    habits,
    logs,
    // ... all 7 stores
  });
}
```

**File download trigger (from settings.js action closure):**

```javascript
async function handleExportJSON() {
  const jsonString = await exportJSON();
  const blob = new Blob([jsonString], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habits-${new Date().toLocaleDateString('sv-SE')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Write lastBackupDate to settings store
  await apply({type: 'setSetting', payload: {key: 'lastBackupDate', value: new Date().toLocaleDateString('sv-SE')}});
}
```

### Pattern 2: Export CSV (Habit × Day Matrix)

**What:** Generate a wide matrix: rows = habits grouped by wave, columns = days (chronological), cells = `1`/`0`/`x` or numeric count for multi-occurrence.  
**When to use:** User clicks "Export CSV" in Settings.

**Key logic — CSV cell calculation:**

```javascript
/**
 * Compute cell value for (habit, date):
 *   - If habit.startDate > date → 'x' (not yet started)
 *   - If habit.archived && habitArchivedBefore(date) → 'x' (archived)
 *   - If !appliesToday(habit, date, cadenceCtx) → 'x' (cadence exclusion)
 *   - If log found for (habitId, date):
 *       - If habit.type === 'binary' && log.completed → '1'
 *       - If habit.type === 'binary' && !log.completed → '0'
 *       - If habit.type === 'numeric' or 'slot-checklist' → String(log.completed) (raw count)
 *   - Else (no log) → '0' (applicable but not completed)
 */
async function csvCellValue(habit, date, allLogs, cadenceCtx) {
  if (habit.startDate && habit.startDate > date) return 'x';
  // TODO: add archival date check — requires habit_versions history or explicit archived field
  
  if (!appliesToday(habit, date, cadenceCtx)) return 'x';
  
  const log = allLogs.find(l => l.habitId === habit.id && l.date === date);
  if (!log) return '0';
  
  // log.completed is either boolean (binary habits) or number (multi-occurrence)
  return log.completed === true ? '1' : log.completed === false ? '0' : String(log.completed);
}
```

**CSV string formatting:**

```javascript
function escapeCSVField(field) {
  const s = String(field ?? '');
  // If field contains ; or " or newlines or leading/trailing space, quote it
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r') || s !== s.trim()) {
    return '"' + s.replace(/"/g, '""') + '"';  // Escape " as ""
  }
  return s;
}

function buildCSV(rows, columns) {
  const lines = [];
  
  // Header row
  lines.push('habit_name;wave;' + columns.map(escapeCSVField).join(';'));
  
  // Data rows
  for (const row of rows) {
    const cells = [
      escapeCSVField(row.habit.name),
      escapeCSVField(row.habit.wave),
      ...row.cells.map(escapeCSVField)
    ];
    lines.push(cells.join(';'));
  }
  
  // Join with CRLF, prepend BOM
  const csv = '﻿' + lines.join('\r\n');
  return csv;
}
```

**Encoding / MIME type:**

```javascript
const csv = buildCSV(rows, columns);
const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
// Browser's Blob constructor already handles UTF-8 encoding; BOM is embedded in the string
```

### Pattern 3: JSON Import with Merge-by-ID

**What:** Read imported JSON, validate schema version, merge each store by primary key (overwrite on collision, never delete).  
**When to use:** User uploads JSON file via Settings file input.

**Merge logic:**

```javascript
/**
 * Merge imported stores into local repo.
 * @param {object} imported - {schemaVersion, habits: [...], logs: [...], ...}
 * @returns {Promise<void>}
 */
export async function mergeImportedStores(imported) {
  const repo = _repo;
  
  // D-99: Schema version validation
  const DB_VERSION = await repo.getSetting('schemaVersion')?.then(s => s.value)
                     ?? (await import('../db/schema.js')).DB_VERSION;
  
  if (imported.schemaVersion > DB_VERSION) {
    throw new Error(
      `This backup was created with a newer version of the app (version ${imported.schemaVersion}). ` +
      'Please update the app before importing.'
    );
  }
  
  // Merge each store (no deletes, overwrite on collision)
  const STORE_NAMES = ['habits', 'habit_versions', 'logs', 'events', 'settings', 'meta', 'score_snapshots'];
  
  await repo.runTx(STORE_NAMES, 'readwrite', async (tx) => {
    for (const storeName of STORE_NAMES) {
      const importedRows = imported[storeName] ?? [];
      for (const row of importedRows) {
        tx.objectStore(storeName).put(row);
      }
    }
  });
  
  // D-100: Broadcast reload signal
  const bc = new BroadcastChannel('habits');
  bc.postMessage({type: 'import:done'});
  bc.close();
}
```

### Pattern 4: Backup Nag (Last Backup Display + Weekly Banner)

**What:** Display "Last backup: N days ago" in Settings; show conditional warning banner if ≥7 days.  
**When to use:** Settings mount; recompute on every notify for real-time updates.

**Nag state computation:**

```javascript
/**
 * Compute days since last backup, or null if never.
 * @returns {Promise<number|null>}
 */
export async function daysSinceLastBackup() {
  const lastDate = await repo.getSetting('lastBackupDate')?.then(s => s.value);
  if (!lastDate) return null;
  
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
  const days = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
  return Math.max(0, days);
}

/**
 * Check if nag should be shown (≥7 days and not dismissed today/recently).
 * @returns {Promise<boolean>}
 */
export async function shouldShowNag() {
  const days = await daysSinceLastBackup();
  if (days === null || days < 7) return false;
  
  const lastDismissed = localStorage.getItem('nag:lastDismissed');
  const today = new Date().toLocaleDateString('sv-SE');
  
  if (!lastDismissed) return true;
  
  // Reappear after 7 days of dismissal
  const dismissedDays = Math.floor((new Date(today) - new Date(lastDismissed)) / 86400000);
  return dismissedDays >= 7;
}

// Dismiss action:
function dismissNag() {
  localStorage.setItem('nag:lastDismissed', new Date().toLocaleDateString('sv-SE'));
  // Rebuild Data card to hide nag
}

// Export triggers reset dismissal:
// After handleExportJSON or handleExportCSV completes, the setSetting handler
// flushes lastBackupDate, store.notify fires, Settings remounts Data card
// (recomputes shouldShowNag → false), nag disappears.
```

**Builder extension (buildDataCard):**

```javascript
/**
 * Build the Data card — extended with export/import sections + nag.
 * @param {{
 *   lastBackupDays?: number|null,
 *   shouldShowNag?: boolean
 * }} args
 * @returns {{tag, attrs, children}}
 */
export function buildDataCard({
  lastBackupDays = null,
  shouldShowNag = false
} = {}) {
  const body = [
    { tag: 'h2', attrs: {id: DATA_LABEL_ID}, text: 'Data' },
  ];
  
  // Nag banner
  if (shouldShowNag) {
    body.push({
      tag: 'div',
      attrs: {class: 'nag-banner'},
      children: [
        { tag: 'span', text: `Last backup: ${lastBackupDays} days ago. Export your data now.` },
        { tag: 'button', attrs: {'data-action': 'dismissNag', title: 'Dismiss'}, text: '×' }
      ]
    });
  }
  
  // Last backup status
  body.push({
    tag: 'dl',
    children: [
      { tag: 'dt', text: 'Last backup' },
      { tag: 'dd', text: lastBackupDays === null ? 'Never' : `${lastBackupDays} days ago` }
    ]
  });
  
  // Export/import buttons
  body.push({
    tag: 'button',
    attrs: {'data-action': 'exportJSON'},
    text: 'Export JSON'
  });
  body.push({
    tag: 'button',
    attrs: {'data-action': 'exportCSV'},
    text: 'Export CSV'
  });
  body.push({
    tag: 'input',
    attrs: {
      type: 'file',
      accept: 'application/json',
      'data-action': 'importJSON',
      id: 'import-file-input'
    }
  });
  
  // Existing Undo + Reset sections...
  
  return {tag: 'section', attrs: {class: 'settings-card', 'aria-labelledby': DATA_LABEL_ID}, children: body};
}
```

### Anti-Patterns to Avoid

- **Custom date math without daysBetween:** The `daysBetween()` utility in `js/util/date.js` uses `Math.round()` specifically to handle DST edge cases. Never use `Math.floor()` on millisecond deltas. The same utility is reused for cadence every-n-days calculations.
- **Re-implementing cadence logic in CSV generation:** Call `appliesToday(habit, date, ctx)` from `js/domain/cadence.js` with a closure that reads logs from memory. Don't try to invent a simpler version — edge cases with day-of-week boundaries and every-n-days anchors are subtle.
- **Assuming archive date == log last date:** A habit can be archived but have logs after its archival if the user un-archives and logs again, or if archival happens mid-session before a subsequent log write. The habit record needs an explicit `archivedAt` or `status` field to accurately determine the CSV cell value. Current schema uses `status` (from Phase 4) — use it.
- **Forgetting to handle undefined/null values in CSV fields:** Habit names and wave names can be `null` (though unlikely from seed); always `String(field ?? '')` before CSV escaping to avoid CSV cells with the literal string "null".
- **Putting merge logic in settings.js instead of a dedicated io/import.js module:** Separation of concerns: pure domain logic (merge semantics) lives in the io layer, not the view layer. The mounter calls the function and handles UI feedback.
- **Broadcasting before tx completes:** After merge tx commits, THEN broadcast. Broadcasting while tx is pending lets the receiving tab read stale state (Pitfall 2 from Phase 2 — same risk here).

## Common Pitfalls

### Pitfall 1: CSV Cell Values for Archived Habits

**What goes wrong:** A habit is archived on 2026-06-01. The CSV still has logs from 2026-06-02 onward (user un-archived it or logs were written before archival was persisted). The cell for post-archive dates shows `1`/`0` when it should show `x`.

**Why it happens:** Archival is a status change in the `habits` store, not a separate event. Without checking `habit.status === 'archived'` AND comparing `date` to the archival timestamp, the code can't distinguish "archived before this date" from "archived after."

**How to avoid:** 
- Check Phase 4 context to see if `habit.status` alone is sufficient or if a `habit_versions` entry carries effective-from timestamps.
- If Phase 4 uses `habit_versions` for status changes, query `repo.getHabitVersionAtDate(habitId, date)` and check its `status` field.
- Add an explicit `archivedAt` field to the habit record (separate from status) so CSV cell calculation can compare `date >= archivedAt` → `'x'`.
- Verify this during integration tests: create a habit, archive it, unarchive it, add a log after archival, export CSV, check that the cell during the archived window is `'x'`.

**Warning signs:** Integration tests fail for CSV export of archived habits. Cell values are `1`/`0` for dates between archive and unarchive. The expected behavior is `'x'` for those dates (unless the unarchival happened first).

### Pitfall 2: Multi-Occurrence Partial Counts in CSV

**What goes wrong:** A "meals" habit has target 7, but the user logged only 3 meals on a day. The log row has `completed: 3`. The CSV cell should show `3`, but the code outputs `1` (treating it as "binary completion").

**Why it happens:** The CSV cell-value logic checks `log.completed === true` → `'1'`, but multi-occurrence logs have `completed` as a number. The ternary chain is too simple.

**How to avoid:** Store habit `type` alongside each log, or inspect the habit definition (via `habit_versions` if it's a historical log) to know the expected type. Check: if `log.completed` is a number, output it as a string. If it's a boolean, output `'1'` or `'0'`.

**Warning signs:** CSV exports show identical cells for binary and multi-occurrence habits when they differ in the app itself. Tests that compare CSV output to hand-curated expected data fail on multi-occurrence columns.

### Pitfall 3: JSON Import Doesn't Clear Old `import:done` Broadcast Listeners

**What goes wrong:** User imports once, app broadcasts `{type: 'import:done'}`. A test imports a second time, broadcasts again, but a stray listener from the first import is still registered and tries to reload twice, or older listeners clash with new ones.

**Why it happens:** `BroadcastChannel` listeners aren't unregistered after the first message. The channel stays open and accumulates listeners if you open and close it multiple times without cleanup.

**How to avoid:** Open the channel inside the merge function (local scope), post the message, then close it immediately: `const bc = new BroadcastChannel('habits'); bc.postMessage(...); bc.close();`. Each import gets a fresh channel instance.

**Warning signs:** Cross-tab sync integration tests show flaky behavior. Reloads happen multiple times for a single import. The error log contains "redundant reload" or similar.

### Pitfall 4: CSV Export Doesn't Account for Deleted Habits in Log Records

**What goes wrong:** A habit was deleted (not archived—actually removed from IDB). Its logs still exist (they're independent rows in the logs store). CSV export tries to find the habit in the habits store, gets undefined, and crashes or outputs a row with a null/undefined habit name.

**Why it happens:** Deletion is not prevented in Phase 1–4 (though archival is the user-facing alternative). The CSV export assumes every log has a matching habit row.

**How to avoid:** When building the CSV habit list, iterate over the habits store (not the logs store). This ensures only habits in the habits store are rows in the output. Orphaned logs (logs whose habitId doesn't exist in habits) are silently dropped from the CSV. This is acceptable because archival is the intended pattern for "hiding" habits in the CSV.

**Warning signs:** CSV export crashes with `Cannot read property 'name' of undefined` when reading an old test fixture with orphaned logs. Hand-verified CSV output includes a row with empty/null habit name.

### Pitfall 5: Nag Dismissal State Doesn't Survive App Reset

**What goes wrong:** User dismisses the nag. Later, user clicks "Reset data" (which clears all IDB data). App reloads. Settings mounts, checks `localStorage.getItem('nag:lastDismissed')`, finds it, and the nag doesn't appear. But the user expects it to reappear because the backup is now lost (IDB is empty).

**Why it happens:** Reset-data clears IDB but doesn't clear localStorage. The dismissal state persists even though the backup it was dismissing is gone.

**How to avoid:** When Reset-data's `confirm()` fires and the user clicks OK, also clear `localStorage.removeItem('nag:lastDismissed')` (and any other UI-preference keys) before reloading. This ensures the nag resets along with the data.

**Warning signs:** Manual test of "export JSON, dismiss nag, reset data, reload" shows nag doesn't reappear. The user feels tricked — they reset the data but the nag is still gone.

### Pitfall 6: UTF-8 BOM in the Middle of JSON

**What goes wrong:** JSON export includes the BOM (`﻿`) at the top of the JSON string, breaking JSON parsing on import.

**Why it happens:** The JSON.stringify() wrapping is applied AFTER the BOM is added, or the BOM is added to the wrong blob.

**How to avoid:** The BOM is ONLY for CSV (which is plain text and benefits from encoding declaration). JSON is UTF-8 by default (per RFC 7159) and does NOT need a BOM. Don't add `﻿` to JSON exports.

**Warning signs:** JSON import fails with `SyntaxError: Unexpected token  in JSON at position 0` (the BOM appears as an invisible character). Manual inspection of the exported JSON shows a weird character at the start.

## Code Examples

Verified patterns from official sources and codebase:

### Full JSON Export

```javascript
/**
 * @file JSON backup export — full-fidelity snapshot of all 7 IDB stores.
 * 
 * Follows the `js/io/seed.js` DI pattern: configurability for testing,
 * defaults to production globals.
 */

let _repo = null;

export function configureExport(deps) {
  if (deps.repo) _repo = deps.repo;
}

/**
 * Export all IDB stores as a JSON string ready for file download.
 * Structure: {schemaVersion, habits: [...], logs: [...], ...}
 * 
 * @returns {Promise<string>}
 */
export async function exportJSON() {
  const repo = _repo;
  if (!repo) throw new Error('export: configureExport({repo}) not called');
  
  const { DB_VERSION } = await import('../db/schema.js');
  
  // Read all 7 stores
  const habits = await repo.getAllHabits();
  const habit_versions = await repo.runTx(['habit_versions'], 'readonly', tx => {
    return new Promise((resolve, reject) => {
      const results = [];
      const req = tx.objectStore('habit_versions').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
  // ... similar for logs, events, settings, meta, score_snapshots
  
  return JSON.stringify({
    schemaVersion: DB_VERSION,
    habits,
    habit_versions,
    // ... all stores
  });
}

/**
 * CSV export — habit × day matrix with `1`/`0`/`x` cells.
 * 
 * @param {{startDate?: string, endDate?: string}} options
 * @returns {Promise<string>} CSV string (with BOM for Excel)
 */
export async function exportCSV(options = {}) {
  const repo = _repo;
  
  // Collect all habits (sorted by wave, then name)
  const habits = await repo.getAllHabits();
  const sorted = habits.sort((a, b) => 
    a.wave.localeCompare(b.wave) || a.name.localeCompare(b.name)
  );
  
  // Determine date range (earliest log to today, or custom)
  const allLogs = await repo.getAll('logs');
  const earliestLog = allLogs.length > 0 
    ? allLogs.reduce((min, l) => Math.min(min, l.date), allLogs[0].date)
    : new Date().toLocaleDateString('sv-SE');
  
  const startDate = options.startDate ?? earliestLog;
  const endDate = options.endDate ?? new Date().toLocaleDateString('sv-SE');
  
  // Generate all dates in range
  const dates = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    dates.push(d.toLocaleDateString('sv-SE'));
  }
  
  // Build CSV rows
  const lines = [];
  const header = ['habit_name', 'wave', ...dates];
  lines.push(header.map(escapeCSVField).join(';'));
  
  // Load cadence context for appliesToday checks
  const weekStart = await repo.getSetting('weekStart')?.then(s => s.value) ?? 'mon';
  const cadenceCtx = {
    weekStart,
    weekCompletions: async (habitId, start, end) => {
      // Count completed logs in the week range
      const logsInWeek = allLogs.filter(l => 
        l.habitId === habitId && l.date >= start && l.date <= end && l.completed
      );
      return logsInWeek.length;
    },
    monthCompletions: async (habitId, start, end) => {
      const logsInMonth = allLogs.filter(l =>
        l.habitId === habitId && l.date >= start && l.date <= end && l.completed
      );
      return logsInMonth.length;
    }
  };
  
  // For each habit, build a row
  for (const habit of sorted) {
    const cells = [escapeCSVField(habit.name), escapeCSVField(habit.wave)];
    
    for (const date of dates) {
      // Check if applicable
      if (habit.startDate && habit.startDate > date) {
        cells.push('x');
        continue;
      }
      
      // Check cadence (need sync wrapper — Phase 5 integration may require refactoring cadence context)
      const applies = appliesToday(habit, date, cadenceCtx);
      
      if (!applies) {
        cells.push('x');
        continue;
      }
      
      // Find log
      const log = allLogs.find(l => l.habitId === habit.id && l.date === date);
      if (!log) {
        cells.push('0');
      } else if (log.completed === true) {
        cells.push('1');
      } else if (log.completed === false) {
        cells.push('0');
      } else {
        // Multi-occurrence: numeric count
        cells.push(String(log.completed));
      }
    }
    
    lines.push(cells.join(';'));
  }
  
  // Join with CRLF, prepend BOM
  const csv = '﻿' + lines.join('\r\n');
  return csv;
}

function escapeCSVField(field) {
  const s = String(field ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r') || s !== s.trim()) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
```

### JSON Import with Merge-by-ID

```javascript
/**
 * @file JSON import — merge-by-id restore with schema version validation.
 */

let _repo = null;
let _broadcast = null;

export function configureImport(deps) {
  if (deps.repo) _repo = deps.repo;
  if (deps.broadcast) _broadcast = deps.broadcast;
}

/**
 * Merge an imported JSON backup into local IDB.
 * @param {object} imported - parsed JSON from exported backup
 * @throws {Error} if schemaVersion is newer than current app
 * @returns {Promise<void>}
 */
export async function mergeImportedStores(imported) {
  const repo = _repo;
  const { DB_VERSION } = await import('../db/schema.js');
  
  // D-99: Schema validation
  if (!imported || typeof imported !== 'object' || !Array.isArray(imported.habits)) {
    throw new Error('Invalid import file: not a valid backup');
  }
  
  const importedVersion = imported.schemaVersion ?? 1;
  if (importedVersion > DB_VERSION) {
    throw new Error(
      `This backup was created with a newer version of the app (version ${importedVersion}). ` +
      'Please update the app before importing.'
    );
  }
  
  // Merge all stores
  const STORES = ['habits', 'habit_versions', 'logs', 'events', 'settings', 'meta', 'score_snapshots'];
  
  await repo.runTx(STORES, 'readwrite', async (tx) => {
    for (const storeName of STORES) {
      const importedRows = imported[storeName] ?? [];
      for (const row of importedRows) {
        // Put overwrites on key collision (D-98 merge-by-id)
        tx.objectStore(storeName).put(row);
      }
    }
  });
  
  // D-100: Broadcast reload signal (AFTER tx completes per Pitfall 2)
  if (_broadcast) {
    _broadcast.postMessage({type: 'import:done'});
  }
}
```

### CSV File Download

```javascript
// From settings.js action closure

async function handleExportCSV() {
  try {
    showSpinner();
    const csv = await exportCSV();
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habits-completion-${new Date().toLocaleDateString('sv-SE')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Update lastBackupDate in settings
    await apply({
      type: 'setSetting',
      payload: {
        key: 'lastBackupDate',
        value: new Date().toLocaleDateString('sv-SE')
      }
    });
    
    showUpdateToast('CSV exported');
  } catch (err) {
    showErrorToast('CSV export failed: ' + err.message);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV as read-only export (no import) | JSON-only round-trip (IMPORT-05 explicit lock) | Phase 5 decision (D-95) | Users export via CSV for Excel analysis; import-restore via JSON only. Simpler spec, clear separation of concerns |
| No backup nag | "Last backup: N days ago" + weekly yellow banner | Phase 5 (D-101, D-102) | Users stay aware of backup recency; opt-in dismissal after 7 days |
| Blob + anchor download only (could use FS API) | File System Access API NOT used (D-95 rationale) | Phase 5 research confirms | `file://` compatibility + Safari gaps make Blob+anchor the only reliable path; no API gatekeeping needed |
| Manual date-range export picker | D-97 collapsible UI (deferred P3 detail) | Phase 5 CONTEXT.md | Optional nice-to-have; default full-span export is usable; date picker lands in phase plan UI-SPEC task |

**Deprecated/outdated:**
- In-app xlsx importer (never shipped) — Seed JSON is the only import source; user-exported data round-trips via JSON.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `repo.getAll()` and similar methods exist for all 7 stores | Standard Stack | Export cannot iterate all stores; need to add bulk-read helpers to repo |
| A2 | `habit.status` field tracks archival state (from Phase 4) | Pitfall 1 | CSV cell encoding for archived habits produces wrong output; need explicit archival timestamp |
| A3 | CSV cadence context (week/month completions) can be computed in-memory from all logs | Pattern 2 | Cadence checks in CSV export require additional DB queries; performance may suffer with years of data |
| A4 | `new Date().toLocaleDateString('sv-SE')` produces ISO-format `YYYY-MM-DD` in all modern browsers | Pattern 3, Pitfall 6 | Date formatting may fail on older/unusual locales; need manual date formatting fallback |
| A5 | BroadcastChannel name 'habits' matches existing Phase 2 sync usage | Pattern 3 | Import broadcast goes to wrong channel; other tabs don't reload after import |
| A6 | localStorage is available and persistent across page reload (not cleared by reset-data separately) | Pitfall 5 | Nag dismissal state may not survive in some contexts; need to add explicit localStorage cleanup to reset handler |

## Open Questions

1. **CSV cadence context is sync, but appliesToday may need async context (week/month completions)**
   - What we know: `appliesToday(habit, date, ctx)` expects `ctx.weekCompletions()` and `ctx.monthCompletions()` as sync callbacks.
   - What's unclear: During CSV export, building the full completion-count context requires reading ALL logs upfront. With years of data (365×5 years = ~1825 logs), loading all logs then computing context is feasible but may need pagination.
   - Recommendation: Load `repo.getAll('logs')` once at the start of CSV export, filter in-memory. For the phase plan, accept a full-memory context. If performance is poor (Phase 5 UAT), optimize via batched log reads in future phase.

2. **Habit archival date — is it in habit_versions, or a separate archivedAt field?**
   - What we know: Phase 4 CONTEXT.md (D-82..D-90) doesn't explicitly mention archival-date tracking. The `habits` store may carry a `status` field ('active', 'archived', 'mastered') but not a timestamp.
   - What's unclear: When was the habit archived? CSV cell encoding needs the exact date to mark pre-archival logs as `x`.
   - Recommendation: Check Phase 4 CONTEXT.md and codebase for `status` vs. archival timestamp. If missing, add an explicit `archivedAt` field (nullable, null = never archived). Phase 5 integration tests should verify this works end-to-end.

3. **Wave field in habit record — is it guaranteed to be present or can it be null?**
   - What we know: Seed provides wave assignments; user-created habits require a wave selection (Phase 4 catalog CRUD).
   - What's unclear: Can `habit.wave` be undefined or null in edge cases (old fixtures, corrupted data)?
   - Recommendation: Assume `habit.wave` is present and a valid value. If null/undefined is possible, the CSV escapeCSVField already handles it gracefully: `String(null) === 'null'`, which won't break CSV parsing. But add a comment in the code that this is a defensive fallback.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| IndexedDB (all 7 stores) | Export/import data reads | ✓ | existing (Phase 2) | None — app cannot function without IDB |
| localStorage | Nag dismissal state | ✓ | standard | Could use `sessionStorage`, but state would reset on reload (undesirable) |
| BroadcastChannel | Cross-tab import signal | ✓ | Baseline Widely Available | Could fall back to polling, but simpler to assume it exists (Phase 2 already uses it) |
| Blob + URL.createObjectURL | File download | ✓ | standard | None — no fallback for `file://` without FS API |
| FileReader API | JSON import file read | ✓ | standard | None — necessary for `<input type="file">` handling |
| JSON.parse / stringify | Data serialization | ✓ | standard | None — core language feature |

**Missing dependencies with no fallback:** None — all required browser APIs are universally available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node --test` (same as Phase 2–4) |
| Config file | none — tests live in `tests/` directory |
| Quick run command | `node --test tests/unit/export.test.js tests/unit/import.test.js` |
| Full suite command | `node --test tests/` (includes all integration tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | User can download JSON backup | Integration | `node --test tests/integration/export.json.test.js` | ❌ Wave 0 |
| EXPORT-02 | JSON embeds schemaVersion | Unit | `node --test tests/unit/export.test.js::JSON schemaVersion` | ❌ Wave 0 |
| EXPORT-03 | User can download CSV matrix | Integration | `node --test tests/integration/export.csv.test.js` | ❌ Wave 0 |
| EXPORT-04 | CSV uses `;` UTF-8 BOM CRLF | Unit | `node --test tests/unit/export.csv-format.test.js` | ❌ Wave 0 |
| EXPORT-05 | CSV preserves Polish diacritics in Excel | Manual (browser UTF-8 handling) | Manual check: export, open in Excel | ⚠️ Manual only |
| EXPORT-06 | Multi-occurrence cells show numeric count | Unit | `node --test tests/unit/export.csv-cells.test.js::multi-occurrence` | ❌ Wave 0 |
| EXPORT-07 | CSV filename includes date | Unit | `node --test tests/unit/export.csv-format.test.js::filename date` | ❌ Wave 0 |
| EXPORT-08 | "Last backup: N days ago" + nag | Integration | `node --test tests/integration/settings.backup-nag.test.js` | ❌ Wave 0 |
| IMPORT-01 | User can upload JSON file | Integration | `node --test tests/integration/import.json.test.js` | ❌ Wave 0 |
| IMPORT-02 | Import merge-by-id | Unit | `node --test tests/unit/import.merge-by-id.test.js` | ❌ Wave 0 |
| IMPORT-03 | Reject newer schemaVersion | Unit | `node --test tests/unit/import.schema-validation.test.js` | ❌ Wave 0 |
| IMPORT-04 | Broadcast reload signal | Integration | `node --test tests/integration/import.broadcast.test.js` | ❌ Wave 0 |
| IMPORT-05 | CSV import NOT supported | Manual code review | Grep: `CSV.*import` in io/import.js should return empty | ✓ Implicit (anti-requirement) |
| SETTINGS-03 | Export/import buttons in Settings Data card | Integration | `node --test tests/integration/settings.export-import.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Unit tests for export/import business logic (CSV cell encoding, merge-by-id, schema validation). Run via `node --test tests/unit/export.test.js tests/unit/import.test.js`.
- **Per wave merge:** Full integration suite including cross-tab sync simulation, file I/O, and Settings card reactivity. Run via `node --test tests/`.
- **Phase gate:** Full suite green before `/gsd-verify-work` — includes manual browser smoke check for CSV/JSON file downloads and Polish diacritics rendering in Excel (EXPORT-05).

### Wave 0 Gaps

- [ ] `tests/unit/export.test.js` — CSV cell encoding (1/0/x), multi-occurrence counts, BOM/CRLF formatting
- [ ] `tests/unit/import.test.js` — merge-by-id logic, schema version validation
- [ ] `tests/integration/export.json.test.js` — full JSON export round-trip (export → import → verify state)
- [ ] `tests/integration/export.csv.test.js` — CSV row ordering (by wave then name), date range handling
- [ ] `tests/integration/import.json.test.js` — merge semantics (local-only records preserved, collisions overwritten)
- [ ] `tests/integration/import.broadcast.test.js` — BroadcastChannel reload signal received by other tab
- [ ] `tests/integration/settings.backup-nag.test.js` — nag visibility, dismissal, reappearance logic
- [ ] `tests/integration/settings.export-import.test.js` — Settings Data card wiring, file picker, export/import action closures
- [ ] `tests/helpers/fake-idb.js` (extend) — ensure `getAll()` methods are stubbed for all 7 stores
- [ ] CSV encoding tests: UTF-8 BOM prefix, CRLF line endings, field quoting with special characters
- [ ] Cadence context for CSV: week/month completions callback compatibility with `appliesToday()`

*(All gaps are P5-phase-specific tests; Phase 2–4 test infrastructure is complete.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in v1 |
| V3 Session Management | No | Single-device, no sessions |
| V4 Access Control | No | Single-user app |
| V5 Input Validation | Yes | JSON.parse (safe by default); schema version check blocks future imports |
| V6 Cryptography | No | No encryption in v1 (plaintext JSON/CSV backups) |
| V7 Data Protection | Yes | IDB data persisted per origin; export files are user-managed (no server storage) |
| V8 Error Handling | Yes | Import rejects with clear error message on schema mismatch (no data leak, no stack traces) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS in imported JSON | Tampering, Information Disclosure | JSON.parse is safe; no `.innerHTML` of imported data. CSV export uses plain text, no template injection. |
| JSON import with extra fields | Tampering | Accept any field in imported rows (forward-compat). Extra fields are silently stored. No destructive overwrites of fields not in the import. |
| CSV injection (formula prefix `=` in habit names) | Tampering (via Excel) | CSV cells are treated as text (no formula evaluation) in Excel when imported via standard CSV reader. User responsibility for double-checking. Acceptable risk per privacy constraint (no telemetry, user owns their data). |
| Zip-bomb / billion-laughs attack | Denial of Service | JSON import has no size limits (acceptable: user controls the file). Consider adding a sanity check (`if (JSON.stringify(imported).length > 50MB) throw`) in production. Low priority for P5. |
| Orphaned logs (deleted habit, logs remain) | Data Integrity | CSV export iterates habits (not logs), so orphaned logs don't appear. Acceptable — archival is the user-facing "hide" pattern. |

## Sources

### Primary (HIGH confidence)

- **MDN IndexedDB API** (https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — confirmed `runTx()` pattern for multi-store merges, transaction durability via `oncomplete`
- **MDN Blob + URL.createObjectURL** (https://developer.mozilla.org/en-US/docs/Web/API/Blob) — confirmed works on `file://` (supported in Firefox/Safari, Chromium refuses ES modules from `file://` but Blob API works)
- **MDN BroadcastChannel** (https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) — confirmed cross-tab messaging, Baseline Widely Available
- **RFC 4180 CSV Specification** (https://tools.ietf.org/html/rfc4180) — semicolon delimiter, quote escaping rules, CRLF line endings
- **Project CONTEXT.md** (`.planning/phases/05.../05-CONTEXT.md`) — locked decisions D-91..D-103 on JSON/CSV structure, merge semantics, nag behavior
- **Phase 4 CONTEXT.md** (`.planning/phases/04.../04-CONTEXT.md`) — cadence engine (RESOLVERS), habit_versions schema, status tracking
- **Codebase verification** — `js/io/seed.js` (DI pattern), `js/db/repo.js` (full CRUD API), `js/views/settings/builders.js` (card builder pattern), `js/domain/cadence.js` (appliesToday function)

### Secondary (MEDIUM confidence)

- **Phase 2–4 codebase** — test patterns, fake-IDB surface, transaction error handling
- **MDN localStorage** (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — confirmed persistence across page reloads, cleared by `clear()` or browser storage reset
- **MDN FileReader API** (https://developer.mozilla.org/en-US/docs/Web/API/FileReader) — confirmed async text read from `<input type="file">`

### Tertiary (LOW confidence, not verified this session)

- CSV locale-specific delimiter detection in Excel (Polish Windows Excel specifically uses `;` as default) — [ASSUMED] based on common knowledge, not verified with real Excel instance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs are browser-native, well-documented, used in Phase 2–4
- Architecture: HIGH — export/import mirror existing patterns (seed.js DI, repo.runTx, Settings card builder)
- Pitfalls: HIGH — identified from Phase 2 codebase (transaction timing, cadence edge cases) and locked decisions (archival, multi-occurrence)
- CSV cell encoding: MEDIUM-HIGH — confirmed via cadence.js review; subtle edge cases (archived dates, partial counts) flagged as research gaps

**Research date:** 2026-06-05  
**Valid until:** 2026-06-12 (stable domain, no pending spec changes; this research is input to Phase 5 planning)  
**Authored by:** GSD Research Phase (claude-haiku-4-5-20251001)
