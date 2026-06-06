/**
 * @file Backup nag computation — "last backup: N days ago" and dismissal
 * logic (EXPORT-08, D-101, D-102).
 *
 * Provides three exported functions consumed by the Settings UI (Plan 06):
 *   - `daysSinceLastBackup()` — reads 'lastBackupDate' from the settings
 *     store and computes elapsed days using Math.round (D-101; same rule as
 *     daysBetween in js/util/date.js: Math.floor is FORBIDDEN here because
 *     a 1-hour DST gain/loss silently truncates N.95 → N-1 with floor).
 *   - `shouldShowNag()` — returns true when days >= 7 AND either no
 *     dismissal on record OR the last dismissal was > 7 days ago.
 *   - `dismissNag()` — writes today's YYYY-MM-DD to localStorage under the
 *     key 'nag:lastDismissed'.
 *
 * Configure-based DI (mirrors js/io/seed.js pattern):
 *   - `configureBackupNag({ repo, localStorage, today })` — inject a fake
 *     repo, fake localStorage, and a fixed today string for deterministic
 *     tests. Passing `null` for any field resets it to the production default.
 *   - Production: call with `{ repo }` only; `localStorage` falls back to
 *     `globalThis.localStorage`; `today` falls back to computed local date.
 *
 * Date formatting: uses `formatLocalYMD` + `daysBetween` helpers from
 * `js/util/date.js` so every YYYY-MM-DD string is local-calendar based and
 * day-delta arithmetic uses Math.round (DATA-06, D-06, D-101 / Anti-Pattern 3).
 * The `sv-SE` locale trick is equivalent but the explicit helpers keep the
 * derivation visible, testable, and in a single place.
 *
 * Pitfall 5 (from RESEARCH): 'nag:lastDismissed' in localStorage is NOT
 * cleared by "Reset data" (which only clears IDB). The Settings reset handler
 * (Plan 06) MUST call `localStorage.removeItem('nag:lastDismissed')` after
 * wiping IDB so the nag resets when user's data does.
 *
 * Cross-references:
 *   - D-101: Math.round for day-delta to survive DST edge cases
 *   - D-102: nag appears when >= 7 days; reappears 7 days after dismissal
 *   - EXPORT-08: "Last backup: N days ago" display + dismissible banner
 */

import { formatLocalYMD, daysBetween } from '../util/date.js';

// ---------------------------------------------------------------------------
// DI state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _repo = null;

/** @type {{ getItem: Function, setItem: Function }|null} */
let _localStorage = null;

/** @type {string|null} Fixed today override for tests; null = compute at call time */
let _todayOverride = null;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Inject dependencies for testing. Pass `null` for any field to reset it to
 * the production default (globalThis.localStorage / computed today).
 *
 * @param {{ repo?: object|null, localStorage?: object|null, today?: string|null }} deps
 */
export function configureBackupNag({ repo = undefined, localStorage = undefined, today = undefined } = {}) {
  if (repo !== undefined) _repo = repo;
  if (localStorage !== undefined) _localStorage = localStorage;
  if (today !== undefined) _todayOverride = today;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return today's date as YYYY-MM-DD using local calendar. Uses the injected
 * override (for tests) or `formatLocalYMD(new Date())` in production.
 *
 * @returns {string}
 */
function getToday() {
  return _todayOverride ?? formatLocalYMD(new Date());
}

/**
 * Return the active localStorage reference (injected fake or globalThis).
 *
 * @returns {{ getItem: Function, setItem: Function }}
 */
function getLocalStorage() {
  return _localStorage ?? globalThis.localStorage;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the number of whole days elapsed since the last backup, or `null`
 * if no backup date is recorded.
 *
 * Reads the 'lastBackupDate' row from the settings IDB store via the injected
 * (or production) repo. Returns `null` if the setting is absent or its value
 * is falsy. Returns `Math.max(0, days)` to guard against clock skew or
 * future-dated backup records.
 *
 * @returns {Promise<number|null>}
 */
export async function daysSinceLastBackup() {
  if (!_repo) return null;

  const row = await _repo.getSetting('lastBackupDate');
  const lastDate = row?.value;

  if (!lastDate) return null;

  const today = getToday();
  const days = daysBetween(lastDate, today);
  return Math.max(0, days);
}

/**
 * Return `true` if the backup nag banner should be displayed.
 *
 * Conditions (both must be true):
 *   1. `daysSinceLastBackup()` returns a number >= 7
 *   2. Either no dismissal on record, OR the last dismissal was more than
 *      7 days ago (so the nag reappears weekly per D-102).
 *
 * @returns {Promise<boolean>}
 */
export async function shouldShowNag() {
  const days = await daysSinceLastBackup();

  // Never backed up, or backed up recently
  if (days === null || days < 7) return false;

  const ls = getLocalStorage();
  const lastDismissed = ls.getItem('nag:lastDismissed');

  // No prior dismissal — show the nag
  if (!lastDismissed) return true;

  // Dismissed recently — only reappear after another 7 days (D-102)
  const today = getToday();
  const daysSinceDismissal = daysBetween(lastDismissed, today);
  return daysSinceDismissal >= 7;
}

/**
 * Record today as the nag dismissal date in localStorage.
 *
 * Writes `YYYY-MM-DD` (local calendar) to the `'nag:lastDismissed'` key.
 * The Settings UI should call this when the user clicks the dismiss (×) button
 * on the nag banner.
 *
 * NOTE: This does NOT automatically re-render the Settings card. The caller
 * is responsible for triggering a card refresh (e.g. via `store.notify`).
 */
export function dismissNag() {
  const ls = getLocalStorage();
  ls.setItem('nag:lastDismissed', getToday());
}
