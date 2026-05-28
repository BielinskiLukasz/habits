/**
 * @file Pure cadence resolver for the 4 cadence types in the seed (D-48,
 * D-49, D-50, D-51).
 *
 * Signature: `appliesToday(habit, date, ctx)` where
 *   - `habit` is an IDB row (`{id, cadence, lastCompletedDate?, createdAt?}`)
 *   - `date` is YYYY-MM-DD (local calendar)
 *   - `ctx = {weekStart: 'mon'|'sun', weekCompletions: (habitId, startYMD, endYMD) => number}`
 *
 * Dispatch via the `RESOLVERS` table (Anti-Pattern 4 extended: NO `switch
 * (habit.cadence.type)`). Each resolver is a pure function — no IDB / repo
 * reads (the caller hydrates and passes facts in via `ctx`). The discipline
 * test in tests/unit/cadence.test.js enforces both:
 *   - the `RESOLVERS` identifier exists in the source
 *   - no `switch (` keyword anywhere in this file
 *
 * Resolver semantics:
 *   - daily: always true (D-48). Ignores ctx entirely.
 *   - weekly (D-49): log-aware. The habit hides for the rest of the week as
 *     soon as ANY completed log lands within the current ISO week. Resolver
 *     queries `ctx.weekCompletions(habitId, isoWeekStart, isoWeekEnd) === 0`.
 *   - every-n-days (D-50): anchor on `habit.lastCompletedDate`, falling back
 *     to `habit.createdAt`. If both anchors are absent, returns true (safe
 *     default — never hide a habit because of missing data). The threshold
 *     is `daysBetween(anchor, date) >= cadence.n`.
 *   - day-of-week-subset: `cadence.days` is an array of lowercase 3-letter
 *     day codes ('sun'|'mon'|...). Uses LOCAL `getDay()` (NOT UTC).
 *
 * Unknown cadence type → throws `Error('cadence: unknown type <X>')` so a
 * mis-loaded fixture is a loud failure on first render, not a silent
 * "habit never shows on Today" (Threat T-03-04 — accept, loud failure).
 *
 * Forbidden constructs in this file:
 *   - `switch` statement on `habit.cadence.type` (Anti-Pattern 4)
 *   - `indexedDB.*` / `repo.*` calls — pure module (D-48 / specifics).
 *   - `.innerHTML` family — D-78 grep gate covers this file too.
 */

import {
  parseLocalYMD,
  isoWeekStart,
  isoWeekEnd,
  daysBetween,
} from '../util/date.js';

/** Lowercase 3-letter day codes matching the LOCAL `Date#getDay()` index. */
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Dispatch table — one entry per cadence type. Each entry is a pure function
 * receiving `(habit, date, ctx)` and returning a boolean.
 *
 * @type {Record<string, (h: object, d: string, ctx: { weekStart: 'mon'|'sun', weekCompletions: (id: string, s: string, e: string) => number }) => boolean>}
 */
const RESOLVERS = {
  daily: () => true,

  weekly: (h, d, ctx) => {
    const start = isoWeekStart(d, ctx.weekStart);
    const end = isoWeekEnd(d, ctx.weekStart);
    return ctx.weekCompletions(h.id, start, end) === 0;
  },

  'every-n-days': (h, d) => {
    const anchor = h.lastCompletedDate ?? h.createdAt;
    if (!anchor) return true; // Safe default when no anchor yet.
    return daysBetween(anchor, d) >= h.cadence.n;
  },

  'day-of-week-subset': (h, d) => {
    const code = DOW[parseLocalYMD(d).getDay()];
    return h.cadence.days.includes(code);
  },
};

/**
 * Whether a habit applies on the given local calendar day.
 *
 * @param {{ id: string, cadence: { type: string, n?: number, days?: string[] }, lastCompletedDate?: string|null, createdAt?: string }} habit
 * @param {string} date YYYY-MM-DD (local)
 * @param {{ weekStart: 'mon'|'sun', weekCompletions: (habitId: string, startYMD: string, endYMD: string) => number }} ctx
 * @returns {boolean}
 */
export function appliesToday(habit, date, ctx) {
  const resolver = RESOLVERS[habit.cadence.type];
  if (!resolver) {
    throw new Error(`cadence: unknown type ${habit.cadence.type}`);
  }
  return resolver(habit, date, ctx);
}
