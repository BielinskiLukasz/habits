/**
 * @file Local-time YYYY-MM-DD utilities (DATA-06, Anti-Pattern 3, Pitfall 4).
 *
 * The Day-1 module per ARCHITECTURE §7. Every other module that touches a
 * date key (logs keypath, cadence engine, CSV columns) depends on these
 * helpers.
 *
 * NEVER use UTC-flavored Date APIs here — they silently corrupt late-night
 * check-ins by writing a row keyed to the next/previous calendar day. All
 * arithmetic constructs via `new Date(y, m-1, d)` and steps via
 * `setDate(d.getDate() + n)` so DST + leap days are honored by the local
 * calendar (Pitfall 4 / MDN "Don't Hand-Roll" row "Date arithmetic across
 * DST").
 *
 * Test fixtures locked at three concrete dates (tests/unit/date.test.js):
 *   - 2026-03-29 — Europe/Warsaw DST spring-forward (02:00 → 03:00 skipped)
 *   - 2026-10-25 — Europe/Warsaw DST fall-back (03:00 → 02:00 repeats)
 *   - 2028-02-29 — leap day
 *
 * Forbidden constructs in this file: the ISO-string formatter on Date, the
 * UTC constructor, any universal-time accessor (year / month / date / hours
 * variants), and millisecond arithmetic of the shape
 * `d.getTime() + n * 86400000` (which drifts on DST).
 */

/**
 * Today's date as YYYY-MM-DD in the user's local timezone.
 *
 * @returns {string}
 */
export function todayLocal() {
  return formatLocalYMD(new Date());
}

/**
 * Format a Date as YYYY-MM-DD using the local calendar (NOT UTC).
 *
 * @param {Date} d
 * @returns {string}
 */
export function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date at local midnight (NOT UTC midnight).
 *
 * @param {string} s — YYYY-MM-DD
 * @returns {Date}
 */
export function parseLocalYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Return the date `n` days before/after a YYYY-MM-DD anchor, as YYYY-MM-DD.
 * Handles DST + leap days correctly via `setDate`, which respects the local
 * calendar (unlike millisecond arithmetic which drifts when an hour is
 * skipped or repeated).
 *
 * @param {string} anchorYMD — YYYY-MM-DD
 * @param {number} n — positive (future) or negative (past)
 * @returns {string}
 */
export function daysFrom(anchorYMD, n) {
  const d = parseLocalYMD(anchorYMD);
  d.setDate(d.getDate() + n);
  return formatLocalYMD(d);
}
