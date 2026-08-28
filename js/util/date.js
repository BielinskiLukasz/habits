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
 * Test fixtures locked at three concrete dates (tests/unit/date.test.js +
 * tests/unit/date.weekly.test.js):
 *   - 2026-03-29 — Europe/Warsaw DST spring-forward (02:00 → 03:00 skipped)
 *   - 2026-10-25 — Europe/Warsaw DST fall-back (03:00 → 02:00 repeats)
 *   - 2028-02-29 — leap day
 *
 * Phase 03 plan 01 (Task 1) adds four helpers consumed by `js/domain/cadence.js`
 * (D-48, D-49) and the Settings "last action" preview (D-71):
 *   - isoWeekStart(ymd, weekStart) / isoWeekEnd(ymd, weekStart) — Mon-vs-Sun
 *     week boundary computation in local calendar (D-51 weekStart setting).
 *   - daysBetween(a, b) — whole-day count using Math.round so the 1-hour DST
 *     gain/loss in the ms delta never silently truncates to N-1. Math.floor
 *     is FORBIDDEN here (it underflows e.g. 1.95 → 1 across DST).
 *   - formatRelative(at, now) — "just now" / "N minutes ago" / "N hours ago" /
 *     "N days ago" for the Settings Data card undo preview (D-71).
 *
 * Forbidden constructs in this file: the ISO-string formatter on Date, the
 * UTC constructor, any universal-time accessor (year / month / date / hours
 * variants), and millisecond arithmetic of the shape
 * `d.getTime() + n * 86400000` (which drifts on DST). Math.floor is forbidden
 * inside `daysBetween`'s whole-day computation (use Math.round).
 */

import { t } from '../i18n/index.js';

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

/**
 * Return YYYY-MM-DD of the week-start day for the ISO week containing `ymd`.
 * `weekStart === 'mon'` returns Monday; `weekStart === 'sun'` returns Sunday.
 * Local-calendar arithmetic via `setDate` — DST-safe (Pitfall 4).
 *
 * @param {string} ymd YYYY-MM-DD
 * @param {'mon'|'sun'} weekStart
 * @returns {string}
 */
export function isoWeekStart(ymd, weekStart) {
  const d = parseLocalYMD(ymd);
  const dow = d.getDay(); // 0=Sun..6=Sat (local calendar)
  // For 'mon': Sunday rolls back 6 (to previous Monday); otherwise dow - 1.
  // For 'sun': roll back `dow` days (Sun is dow=0 → no roll).
  const back = weekStart === 'mon' ? (dow === 0 ? 6 : dow - 1) : dow;
  d.setDate(d.getDate() - back);
  return formatLocalYMD(d);
}

/**
 * Return YYYY-MM-DD of the week-end day for the ISO week containing `ymd`.
 * 6 calendar days after `isoWeekStart`.
 *
 * @param {string} ymd YYYY-MM-DD
 * @param {'mon'|'sun'} weekStart
 * @returns {string}
 */
export function isoWeekEnd(ymd, weekStart) {
  return daysFrom(isoWeekStart(ymd, weekStart), 6);
}

/**
 * Whole-day count between two YYYY-MM-DD dates (b - a). Uses Math.round (NOT
 * Math.floor) so the ms delta across a DST transition — which is off by up to
 * 1 hour — does not silently truncate to N-1.
 *
 * @param {string} aYMD YYYY-MM-DD
 * @param {string} bYMD YYYY-MM-DD
 * @returns {number} integer days from a to b (negative when b precedes a)
 */
export function daysBetween(aYMD, bYMD) {
  const a = parseLocalYMD(aYMD);
  const b = parseLocalYMD(bYMD);
  return Math.round((b - a) / 86400000);
}

/**
 * Format an ISO timestamp (or millisecond epoch) relative to `nowMs`:
 *   < 1 min        → 'just now'
 *   < 1 hour       → 'N minutes ago'
 *   < 1 day        → 'N hours ago'
 *   otherwise      → 'N days ago'
 *
 * Floor-based bucket sizing inside each branch is intentional — relative time
 * is a display string, not an arithmetic input. (The Math.floor ban is scoped
 * to daysBetween only.)
 *
 * @param {string|number} atISO ISO-8601 timestamp string OR ms-epoch number
 * @param {number} [nowMs] override now() for tests; defaults to Date.now()
 * @returns {string}
 */
export function formatRelative(atISO, nowMs = Date.now()) {
  const atMs = typeof atISO === 'number' ? atISO : new Date(atISO).getTime();
  const ms = nowMs - atMs;
  if (ms < 60_000) return t('util.justNow');
  if (ms < 3_600_000) { const n = Math.floor(ms / 60_000); return t(n === 1 ? 'util.minuteAgo' : 'util.minutesAgo', { n }); }
  if (ms < 86_400_000) { const n = Math.floor(ms / 3_600_000); return t(n === 1 ? 'util.hourAgo' : 'util.hoursAgo', { n }); }
  const n = Math.floor(ms / 86_400_000); return t(n === 1 ? 'util.dayAgo' : 'util.daysAgo', { n });
}

/**
 * Check if a habit is within its grace period (first N days after creation).
 * Returns true if days between createdAt and today is strictly less than graceDays.
 *
 * @param {string} createdAtYMD YYYY-MM-DD
 * @param {string} todayYMD YYYY-MM-DD
 * @param {number} [graceDays] days (defaults to 7)
 * @returns {boolean}
 */
export function isInGracePeriod(createdAtYMD, todayYMD, graceDays = 7) {
  return daysBetween(createdAtYMD, todayYMD) < graceDays;
}

/**
 * Return the first day of the month containing `ymd`, as YYYY-MM-DD.
 * Uses local-calendar constructor `new Date(y, m-1, 1)` — DST-safe.
 *
 * @param {string} ymd YYYY-MM-DD
 * @returns {string}
 */
export function getMonthStart(ymd) {
  const [y, m] = ymd.split('-').map(Number);
  return formatLocalYMD(new Date(y, m - 1, 1));
}

/**
 * Return the last day of the month containing `ymd`, as YYYY-MM-DD.
 * Uses the idiom `new Date(y, m, 0)` (day 0 of next month = last day of current month).
 * Handles leap days correctly — DST-safe.
 *
 * @param {string} ymd YYYY-MM-DD
 * @returns {string}
 */
export function getMonthEnd(ymd) {
  const [y, m] = ymd.split('-').map(Number);
  return formatLocalYMD(new Date(y, m, 0));
}
