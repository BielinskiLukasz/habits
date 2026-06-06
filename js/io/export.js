/**
 * @file CSV cell encoding and field escaping for the habit×day export matrix.
 *
 * Implements EXPORT-03 (habit × day matrix with 1/0/x cells) and EXPORT-06
 * (multi-occurrence habits show numeric counts). This module contains the
 * pure encoding logic — no file I/O, no IDB reads, no DOM interaction.
 * Integration with full CSV generation (repo reads, file download) is wired
 * in Plan 02 (05-02).
 *
 * Decisions honoured:
 *   - D-93: cell encoding — 1 (applicable + completed), 0 (applicable +
 *     not completed), x (not applicable: cadence exclusion, future startDate,
 *     archived status).
 *   - D-94: multi-occurrence habits show the raw numeric count (not 1/0).
 *   - T-05-01 (threat): escapeCSVField quotes any field containing `;`, `"`,
 *     `\r`, `\n`, or leading/trailing whitespace per RFC 4180.
 *   - Pitfall 1 (05-RESEARCH): archived habits return 'x' via status check.
 *   - Pitfall 2 (05-RESEARCH): partial numeric/slot counts output raw number,
 *     not '1'.
 *
 * Cadence applicability is evaluated by importing `appliesToday` from
 * js/domain/cadence.js. The caller is responsible for providing a cadence
 * context (`ctx`) whose `weekCompletions` and `monthCompletions` closures
 * read from the same in-memory logs array (sync, closure-based).
 *
 * CSV delimiter is `;` (semicolon) — Polish Windows Excel default (D-93,
 * locked Phase 5 decision). The BOM prefix (`﻿`) and CRLF line endings
 * for the full CSV file are applied in Plan 02 at file assembly time, not
 * here.
 */

import { appliesToday } from '../domain/cadence.js';

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

  // Binary habit: log.completed is boolean.
  return log.completed === true ? '1' : '0';
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
