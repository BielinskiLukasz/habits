/**
 * @file CSV cell encoding, field escaping, JSON export, and full CSV export
 * for the habit data export flows (EXPORT-01, EXPORT-02, EXPORT-03,
 * EXPORT-04, EXPORT-05, EXPORT-06, EXPORT-07).
 *
 * **CSV encoding (Plan 05-01):** Pure functions for the habit×day matrix.
 * Implements EXPORT-03 (habit × day matrix with 1/0/x cells) and EXPORT-06
 * (multi-occurrence habits show numeric counts). No file I/O, no IDB reads,
 * no DOM interaction. Integration with full CSV generation (repo reads, file
 * download) is wired in a later plan.
 *
 * **JSON export (Plan 05-02):** Full-fidelity snapshot of all 7 IDB stores.
 * Implements EXPORT-01 (full-fidelity backup) and EXPORT-02 (schemaVersion
 * embedding). Reads every row from all stores and returns
 * `JSON.stringify({schemaVersion, habits, logs, habit_versions, events,
 * settings, meta, score_snapshots})`.
 *
 * **CSV export (Plan 05-05):** Full CSV file generation. Implements EXPORT-04
 * (semicolon delimiter, UTF-8 BOM, CRLF), EXPORT-05 (Polish diacritics via
 * BOM), and EXPORT-07 (filename with download date). Reads all habits and
 * logs from repo, sorts habits by wave (numeric) then name (alphabetical),
 * generates all dates in range, builds the header + data rows, prepends the
 * UTF-8 BOM, and joins with CRLF. The cadence context for `csvCellValue` is
 * built as sync closures over the in-memory logs array (Assumption A3).
 *
 * DI pattern (mirrors js/io/seed.js `configureSeed`):
 *   - `configureExport({repo})` injects the repo handle for testing.
 *   - Production boot calls this once with the real repo.
 *   - Tests inject a minimal fake repo with `getAll*` methods.
 *
 * Decisions honoured:
 *   - D-91: JSON structure — flat object with `schemaVersion` at top level;
 *     all 7 stores as arrays under their store name keys.
 *   - D-93: cell encoding — 1/0/x cells for the CSV matrix.
 *   - D-93: CSV row order — habits grouped by wave (numeric ascending), then
 *     alphabetically by name within wave.
 *   - D-94: multi-occurrence habits show the raw numeric count (not 1/0).
 *   - D-95: UTF-8 BOM (`﻿`) prepended to CSV ONLY (not JSON) so Windows
 *     Excel opens Polish diacritics correctly.
 *   - T-05-01 (threat): escapeCSVField quotes any field containing `;`, `"`,
 *     `\r`, `\n`, or leading/trailing whitespace per RFC 4180.
 *   - T-05-04 (threat): JSON.stringify is a safe built-in serializer; no
 *     .toJSON() overrides or custom reviver logic.
 *   - Pitfall 1 (05-RESEARCH): archived habits return 'x' via status check.
 *   - Pitfall 2 (05-RESEARCH): partial numeric/slot counts output raw number,
 *     not '1'.
 *   - Pitfall 4 (05-RESEARCH): CSV iterates over habits store, not logs store,
 *     so orphaned logs (deleted habit) are silently excluded.
 *   - Pitfall 6 (05-RESEARCH): BOM is CSV-only; JSON export does NOT include it.
 *
 * Cadence applicability (CSV path) is evaluated by importing `appliesToday`
 * from js/domain/cadence.js. The cadence context (`ctx`) is built as sync
 * closures over the in-memory logs array (Assumption A3 — load all logs once
 * at the start of exportCSV, then filter in-memory per cell).
 *
 * CSV delimiter is `;` (semicolon) — Polish Windows Excel default (D-93,
 * locked Phase 5 decision).
 */

import { appliesToday } from '../domain/cadence.js';
import { DB_VERSION } from '../db/schema.js';

// ---------------------------------------------------------------------------
// JSON Export — DI state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _repo = null;

/**
 * Inject dependencies for JSON export. Truthy fields overwrite the
 * module-level mutables (mirrors `configureSeed` in js/io/seed.js).
 * Production boot calls this once with the real repo; tests inject a minimal
 * fake repo with `getAll*` read methods.
 *
 * @param {{ repo?: object }} deps
 * @returns {void}
 */
export function configureExport(deps) {
  if (deps.repo) _repo = deps.repo;
}

/**
 * Export all 7 IDB stores as a full-fidelity JSON string (EXPORT-01,
 * EXPORT-02). The returned string embeds `schemaVersion` (matching
 * `DB_VERSION` from `js/db/schema.js`) and one array per store.
 *
 * The repo must expose `getAll*` methods for every store:
 *   `getAllHabits()`, `getAllLogs()`, `getAllHabitVersions()`,
 *   `getAllEvents()`, `getAllSettings()`, `getAllMeta()`,
 *   `getAllScoreSnapshots()`.
 *
 * Empty stores (e.g. `score_snapshots` in P5 before any scoring runs) are
 * exported as `[]` — never `undefined` or `null`.
 *
 * @returns {Promise<string>} A valid JSON string: `{schemaVersion, habits,
 *   logs, habit_versions, events, settings, meta, score_snapshots}`.
 * @throws {Error} If `configureExport({repo})` was not called before invoking.
 */
export async function exportJSON() {
  if (!_repo) {
    throw new Error('export: configureExport({repo}) not called');
  }
  const repo = _repo;

  // Read all 7 stores in parallel for performance — no ordering dependency.
  const [
    habits,
    logs,
    habit_versions,
    events,
    settings,
    meta,
    score_snapshots,
  ] = await Promise.all([
    repo.getAllHabits(),
    repo.getAllLogs(),
    repo.getAllHabitVersions(),
    repo.getAllEvents(),
    repo.getAllSettings(),
    repo.getAllMeta(),
    repo.getAllScoreSnapshots(),
  ]);

  return JSON.stringify({
    schemaVersion: DB_VERSION,
    events,
    habit_versions,
    habits,
    logs,
    meta,
    score_snapshots,
    settings,
  });
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Generate all calendar dates between `startYMD` and `endYMD` inclusive.
 * Both arguments are YYYY-MM-DD strings. Returns an array of YYYY-MM-DD
 * strings in chronological ascending order.
 *
 * Uses `sv-SE` locale for date formatting (ISO 8601 YYYY-MM-DD) — same
 * convention as DATA-06 and Assumption A4.
 *
 * @param {string} startYMD
 * @param {string} endYMD
 * @returns {string[]}
 */
function dateRange(startYMD, endYMD) {
  const dates = [];
  // Use UTC midnight to avoid DST shifts during iteration (the date string
  // itself is local-calendar, but iteration arithmetic is safe in UTC).
  const cursor = new Date(startYMD + 'T00:00:00Z');
  const end = new Date(endYMD + 'T00:00:00Z');
  while (cursor <= end) {
    // Format via sv-SE so we always get YYYY-MM-DD regardless of local timezone.
    dates.push(cursor.toLocaleDateString('sv-SE', { timeZone: 'UTC' }));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Sort habits for CSV export: numerically by wave (ascending), then
 * alphabetically by name within the same wave.
 *
 * `habit.wave` may be a number or a string. We coerce to number for sort;
 * non-numeric waves (e.g. 'custom') sort after numeric waves via `NaN`
 * comparison (they end up at the tail, which is acceptable for v1).
 *
 * @param {object[]} habits
 * @returns {object[]} New sorted array (does not mutate input).
 */
function sortHabitsForCSV(habits) {
  return [...habits].sort((a, b) => {
    const wa = Number(a.wave);
    const wb = Number(b.wave);
    if (!isNaN(wa) && !isNaN(wb) && wa !== wb) return wa - wb;
    if (isNaN(wa) && !isNaN(wb)) return 1;
    if (!isNaN(wa) && isNaN(wb)) return -1;
    // Same numeric wave (or both non-numeric) — sort by name alphabetically.
    return String(a.name ?? '').localeCompare(String(b.name ?? ''));
  });
}

/**
 * Build a sync cadence context from an in-memory logs array (Assumption A3).
 * `weekCompletions` and `monthCompletions` filter the pre-loaded logs array
 * without any async IDB reads — safe for the v1 data volume (~65 habits ×
 * 365 days ≈ 23k log rows max).
 *
 * A log counts as a "completion" when `log.completed === true` (binary),
 * `typeof log.count === 'number' && log.count > 0` (numeric), or
 * `Array.isArray(log.slots) && log.slots.some(s => s.checked)` (slot-checklist).
 * This mirrors how Today view counts completions for cadence resolution.
 *
 * @param {object[]} allLogs All logs from the repo (pre-loaded).
 * @param {string} weekStart 'mon' | 'sun'
 * @returns {{ weekStart: string, weekCompletions: Function, monthCompletions: Function }}
 */
function buildCadenceCtx(allLogs, weekStart) {
  /**
   * @param {object} log
   * @returns {boolean}
   */
  function isCompleted(log) {
    if (Array.isArray(log.slots)) return log.slots.some((s) => s.checked);
    if (typeof log.count === 'number') return log.count > 0;
    return log.status === 'completed';
  }

  return {
    weekStart,
    weekCompletions(habitId, startYMD, endYMD) {
      return allLogs.filter(
        (l) =>
          l.habitId === habitId &&
          l.date >= startYMD &&
          l.date <= endYMD &&
          isCompleted(l),
      ).length;
    },
    monthCompletions(habitId, startYMD, endYMD) {
      return allLogs.filter(
        (l) =>
          l.habitId === habitId &&
          l.date >= startYMD &&
          l.date <= endYMD &&
          isCompleted(l),
      ).length;
    },
  };
}

/**
 * Export all habits as a UTF-8 BOM-prefixed, semicolon-delimited,
 * CRLF-separated CSV string ready for `new Blob([csv], {type:
 * 'text/csv;charset=utf-8'})` download (EXPORT-03, EXPORT-04, EXPORT-05,
 * EXPORT-06, EXPORT-07).
 *
 * The repo must have been configured via `configureExport({repo})`.
 *
 * CSV structure:
 *   - Header row: `habit_name;wave;YYYY-MM-DD;YYYY-MM-DD;...`
 *   - Data rows: one per habit, sorted by wave (numeric asc), then name (alpha).
 *   - Date range: earliest log date to today (YYYY-MM-DD). Overridable via
 *     `dateRangeOpts`. When no logs exist, the range collapses to [today, today].
 *   - Cells: delegated to `csvCellValue()` (1/0/x or numeric count).
 *   - BOM: UTF-8 BOM (`﻿`) prepended to the entire string (D-95).
 *   - Line endings: `\r\n` (CRLF per RFC 4180) (EXPORT-04).
 *
 * @param {{ startDate?: string, endDate?: string }} [dateRangeOpts]
 * @returns {Promise<string>} CSV string with BOM, CRLF, semicolon delimiter.
 * @throws {Error} If `configureExport({repo})` was not called before invoking.
 */
export async function exportCSV({ startDate, endDate } = {}) {
  if (!_repo) {
    throw new Error('export: configureExport({repo}) not called');
  }
  const repo = _repo;

  // Load all data in parallel (Pitfall 4: iterate habits, not logs, to exclude
  // orphaned log rows for habits that no longer exist in the habits store).
  const [allHabits, allLogs, weekStartSetting] = await Promise.all([
    repo.getAllHabits(),
    repo.getAllLogs(),
    repo.getSetting('weekStart'),
  ]);

  const weekStart = weekStartSetting?.value ?? 'mon';

  // Determine date range: earliest log date → today (or custom range).
  const today = new Date().toLocaleDateString('sv-SE');
  let rangeStart = today;
  if (allLogs.length > 0) {
    // Find the minimum date string (YYYY-MM-DD string comparison is safe for ISO dates).
    rangeStart = allLogs.reduce(
      (min, l) => (l.date < min ? l.date : min),
      allLogs[0].date,
    );
  }
  const csvStart = startDate ?? rangeStart;
  const csvEnd = endDate ?? today;

  const dates = dateRange(csvStart, csvEnd);

  // Build cadence context from in-memory logs (Assumption A3: sync, closure-based).
  const cadenceCtx = buildCadenceCtx(allLogs, weekStart);

  // Sort habits by wave (numeric ascending) then name (alphabetical).
  const sortedHabits = sortHabitsForCSV(allHabits);

  // Build CSV lines.
  const lines = [];

  // Header row: habit_name;wave;date1;date2;...
  lines.push(
    ['habit_name', 'wave', ...dates].map(escapeCSVField).join(';'),
  );

  // Data rows — one per habit.
  for (const habit of sortedHabits) {
    const cells = [
      escapeCSVField(habit.name),
      escapeCSVField(String(habit.wave ?? '')),
      ...dates.map((d) => csvCellValue(habit, d, allLogs, cadenceCtx)),
    ];
    lines.push(cells.join(';'));
  }

  // Prepend UTF-8 BOM (D-95) and join lines with CRLF (EXPORT-04).
  // The BOM is ONLY on the CSV — never on JSON (Pitfall 6 / RESEARCH).
  return '﻿' + lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the CSV cell value for a given (habit, date) pair.
 *
 * Return values:
 *   - `'x'`   — not applicable: archived, future-scheduled, or cadence exclusion
 *   - `'1'`   — binary habit: applicable and completed
 *   - `'0'`   — binary habit (or no-log): applicable and not completed
 *   - `'N'`   — numeric habit: raw count string (e.g. '5' for 5/7 cups)
 *   - `'N'`   — slot-checklist habit: count of checked slots (e.g. '3' for 3/7 slots)
 *
 * @param {{ id: string, cadence: object, targetType: 'binary'|'numeric'|'slot-checklist', status: string, startDate?: string|null, target?: number }} habit
 * @param {string} date YYYY-MM-DD (local calendar date)
 * @param {Array<{habitId: string, date: string, completed?: boolean, count?: number, slots?: Array<{name: string, checked: boolean}>}>} logs All in-memory logs (filtered by this function)
 * @param {{ weekStart: 'mon'|'sun', weekCompletions: (habitId: string, start: string, end: string) => number, monthCompletions: (habitId: string, start: string, end: string) => number }} ctx Cadence context with sync closures reading from logs
 * @returns {string} Cell value: '1', '0', 'x', or a numeric count string
 */
export function csvCellValue(habit, date, logs, ctx) {
  // Pitfall 1 (05-RESEARCH): archived habits are never applicable for any date.
  // For Phase 5 MVP: check habit.status === 'archived'. A future phase may add
  // an explicit archivedAt timestamp to return 'x' only for post-archival dates,
  // but for now the status field is sufficient.
  if (habit.status === 'archived') {
    return 'x';
  }

  // CATALOG-07 startDate guard: if habit is not yet started, return 'x'.
  // appliesToday also performs this check, but we short-circuit early for clarity.
  if (habit.startDate && habit.startDate > date) {
    return 'x';
  }

  // Cadence applicability check — delegates to the verified cadence resolver.
  if (!appliesToday(habit, date, ctx)) {
    return 'x';
  }

  // Find the log row for this habit on the requested date.
  const log = logs.find(l => l.habitId === habit.id && l.date === date);

  // No log recorded for this date → not completed (0).
  if (!log) {
    return '0';
  }

  // Multi-occurrence dispatch: slot-checklist uses log.slots array (D-89 shape).
  if (Array.isArray(log.slots)) {
    // Count checked slots — output as string per D-94.
    const checkedCount = log.slots.filter(s => s.checked).length;
    return String(checkedCount);
  }

  // Numeric counter uses log.count (D-88 shape). Pitfall 2: output raw count,
  // never coerce to '1'/'0'.
  if (typeof log.count === 'number') {
    return String(log.count);
  }

  // Binary habit: 4-state model (o1g) — skipped → 'x', completed → '1', failed → '0'.
  if (log.status === 'skipped') return 'x';
  if (log.status === 'completed') return '1';
  return '0';
}

/**
 * Escape a CSV field value per RFC 4180, using `;` as the delimiter.
 *
 * A field must be quoted if it contains:
 *   - `;`  (the delimiter character)
 *   - `"`  (the quote character — also escaped as `""` inside quotes)
 *   - `\r` or `\n` (newlines)
 *   - leading or trailing whitespace
 *
 * If no special characters are present, the field is returned as-is.
 *
 * T-05-01 (threat): This function is the sole escape point for user-supplied
 * habit names and wave labels entering the CSV. All fields must pass through
 * here before being written to a CSV line.
 *
 * @param {string|null|undefined} field Raw field value (will be coerced to string)
 * @returns {string} Safe CSV field, quoted if necessary
 */
export function escapeCSVField(field) {
  // Coerce null/undefined to empty string (defensive — Pitfall 4 / 05-RESEARCH).
  const s = String(field ?? '');

  // Determine if quoting is required.
  const needsQuoting =
    s.includes(';') ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r') ||
    s !== s.trim();

  if (!needsQuoting) {
    return s;
  }

  // RFC 4180: enclose in double-quotes and escape any embedded " as "".
  return '"' + s.replace(/"/g, '""') + '"';
}
