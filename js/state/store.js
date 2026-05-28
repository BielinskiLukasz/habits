/**
 * @file In-memory cache + subscribe/notify (Open Question 4 — minimal in P2,
 * expanded in P3 plan 02 Task 3 for Today's hydrate path — D-52, NFR-01;
 * extended in P3 plan 03 Task 2 with notify-driven cache refresh — D-72,
 * Pitfall 2).
 *
 * The state-cache half of the controller chokepoint (`js/state/apply.js`).
 * P2 shipped a deliberately small surface: a pub-sub set + an idempotent
 * `hydrate()` that pre-warmed an empty cache. P3 plan 02 expands the cache
 * to carry the three slices Today needs at cold-paint:
 *
 *   cache.habits   — Map<habitId, habit>           (full active catalog)
 *   cache.logs     — Map<"habitId::date", log>     (THIS WEEK's logs only)
 *   cache.settings — Map<key, value>               (weekStart and friends)
 *
 * Why "this week's logs only" in the cache (NFR-01 budget): every cadence
 * branch the Today view needs answers from a 7-day window — daily reads the
 * current day, weekly counts within the current ISO week, every-N-days
 * reads the denormalized `habit.lastCompletedDate` on the habit row
 * directly (D-52). A single bounded `repo.getLogsInRange(weekStart, weekEnd)`
 * pre-warms the cache for the whole render path.
 *
 * P3 plan 03 Task 2 — notify-driven cache refresh (Pitfall 2):
 *
 *   `notify({event, keys})` now `await refreshHydratedKeys(keys)` BEFORE
 *   fanning out to subscribers. Subscribers therefore observe the post-write
 *   cache state, not the pre-tap snapshot. Without this, a `store.subscribe(render)`
 *   would re-render the pre-tap state and the optimistic flip would briefly
 *   disagree with the cache.
 *
 *   `refreshHydratedKeys(keys)`:
 *     - `keys.habitId` present                 → re-read habit row
 *     - `keys.habitId` AND `keys.date` present → re-read log row (and delete
 *                                                 cache entry when row is
 *                                                 gone — handles restoreLogRow
 *                                                 deletes)
 *     - `keys.key` present                     → re-read settings value
 *                                                 (Slice 4 will use this)
 *
 * Configure-based DI (RESEARCH §Open Question 2):
 *   `configureStore({repo})` injects the repo handle. Production calls this
 *   once at boot in `js/main.js`; tests inject `createFakeRepo()`.
 *
 * Locked decisions implemented here:
 *   - Open Question 4 (RESEARCH): minimum surface for P3; views select via
 *     `getCachedHabits` / `getCachedLog` / `getCachedWeekStart` /
 *     `getCachedWeekCompletions` rather than reach into the Maps directly.
 *   - Idempotent re-entry guard (Pattern S4): `hydrate()` short-circuits on
 *     second call.
 *   - Subscribe-returns-unsubscribe (toast.js / sw-register.js-style closure).
 *   - D-72: notify-driven refresh keeps Today + Settings + cross-tab in sync.
 *
 * Forbidden constructs in this file:
 *   - Direct `indexedDB.*` reference (Anti-Pattern 1 — only js/db/idb.js).
 *   - Calls to `js/db/repo.js` write helpers (DATA-04 — only apply.js writes).
 *     Reads are fine; hydrate() walks `getAllHabits` / `getLogsInRange` /
 *     `getSetting`; refreshHydratedKeys() walks `getHabit` / `getLog` /
 *     `getSetting`.
 *   - `.innerHTML` family — D-78 grep gate.
 */

import { todayLocal, isoWeekStart, isoWeekEnd } from '../util/date.js';

/** @type {{ habits: Map<string, object>, logs: Map<string, object>, settings: Map<string, *> }} */
const cache = {
  habits: new Map(),
  logs: new Map(),
  settings: new Map(),
};

/** @type {Set<(slice: { event: string, keys: object }) => void>} */
const subs = new Set();

/** Singleton-guard so a second hydrate() call is a no-op. */
let hydrated = false;

/** Repo handle injected via configureStore (DI seam, RESEARCH §OQ2). */
let _repo = null;

/**
 * Inject dependencies. `deps.repo` overwrites the module-level handle when
 * present and truthy. Production calls this once at boot; tests call it in
 * `beforeEach` with a fake repo.
 *
 * @param {{ repo?: object }} deps
 * @returns {void}
 */
export function configureStore(deps) {
  if (deps && deps.repo) _repo = deps.repo;
}

/**
 * Pre-warm the in-memory cache. Idempotent — second call is a no-op.
 *
 * Load order:
 *   1. `weekStart` setting (default 'mon' per D-51 / D-45).
 *   2. THIS WEEK's logs via `repo.getLogsInRange(weekStart, weekEnd)`
 *      (bounded read; NFR-01).
 *   3. The full habit catalog via `repo.getAllHabits()`.
 *
 * Defensive: if no repo has been configured yet, return without loading
 * anything. Callers that don't need data (e.g. unit tests of `subscribe`)
 * can skip the configureStore step.
 *
 * Backward-compat: a positional `_legacyRepo` argument is still accepted
 * so P2 callers that did `hydrate(repo)` keep working. The DI-configured
 * repo wins when both are present.
 *
 * @param {object} [_legacyRepo] — backward-compat positional repo
 * @returns {Promise<void>}
 */
export async function hydrate(_legacyRepo) {
  if (hydrated) return;
  hydrated = true;
  const repo = _repo ?? _legacyRepo;
  if (!repo) return;

  const today = todayLocal();

  // 1. Load weekStart (default 'mon' per D-51). Settings rows are stored as
  //    `{key, value}` per repo.putSetting contract.
  const wsRow = await repo.getSetting('weekStart');
  const weekStart = wsRow?.value ?? 'mon';
  cache.settings.set('weekStart', weekStart);

  // 2. Single bounded log read for this ISO week (NFR-01 cold-paint budget).
  const wkStart = isoWeekStart(today, weekStart);
  const wkEnd = isoWeekEnd(today, weekStart);
  const logs = await repo.getLogsInRange(wkStart, wkEnd);
  for (const log of logs) {
    cache.logs.set(`${log.habitId}::${log.date}`, log);
  }

  // 3. Habit catalog. P3 ships ~8 seed habits; long-term ~65. A full scan
  //    of the habits store is well inside NFR-01 budget.
  const habits = await repo.getAllHabits();
  for (const habit of habits) {
    cache.habits.set(habit.id, habit);
  }
}

/**
 * Re-read the rows identified by `keys` from the repo and update the in-
 * process cache accordingly (Pitfall 2 — no stale reads after a chokepoint
 * mutation).
 *
 * `keys` may carry any subset of `{habitId, date, key}` — only the relevant
 * branches fire:
 *
 *   - `habitId` (without `date`)   → refresh `cache.habits` for that id
 *   - `habitId` AND `date`         → refresh both the habit row AND the
 *                                     log row at `(habitId, date)`.
 *                                     Log row absence means delete from cache.
 *   - `key`                        → refresh `cache.settings.get(key)`
 *
 * Defensive when no repo is configured (legacy/test callers) — returns
 * silently.
 *
 * @param {{ habitId?: string, date?: string, key?: string }} keys
 * @returns {Promise<void>}
 */
async function refreshHydratedKeys(keys) {
  if (!_repo) return;
  if (keys.habitId) {
    const habit = await _repo.getHabit(keys.habitId);
    if (habit) cache.habits.set(keys.habitId, habit);
    else cache.habits.delete(keys.habitId);

    if (keys.date) {
      const log = await _repo.getLog(keys.habitId, keys.date);
      const cacheKey = `${keys.habitId}::${keys.date}`;
      if (log) cache.logs.set(cacheKey, log);
      else cache.logs.delete(cacheKey);
    }
  }
  if (keys.key) {
    const row = await _repo.getSetting(keys.key);
    if (row) cache.settings.set(keys.key, row.value);
    else cache.settings.delete(keys.key);
  }
}

/**
 * Test-only handle on `refreshHydratedKeys` — exposed under an underscore
 * so test code can drive the refresh directly without going through
 * `notify()`. Production never imports this.
 *
 * @type {(keys: { habitId?: string, date?: string, key?: string }) => Promise<void>}
 */
export const _refreshHydratedKeysForTest = refreshHydratedKeys;

/**
 * Subscribe to mutation notifications. Returns an unsubscribe closure (matches
 * the BroadcastChannel.onMessage shape so the two pubsubs compose cleanly).
 *
 * @param {(slice: { event: string, keys: object }) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/**
 * Fan a notification out to subscribers. Called by `apply.js` after a
 * successful tx + broadcast.
 *
 * When `payload.keys` is present, the affected cache entries are refreshed
 * from the repo BEFORE subscribers fire — subscribers therefore observe the
 * canonical post-write state (Pitfall 2 / D-72). Legacy callers that pass
 * no payload (or a payload without `keys`) skip the refresh and fall straight
 * through to the fan-out.
 *
 * @param {{ event?: string, keys?: object }} [payload]
 * @returns {Promise<void>}
 */
export async function notify(payload) {
  if (payload && payload.keys) {
    await refreshHydratedKeys(payload.keys);
  }
  for (const fn of subs) fn(payload ?? {});
}

/**
 * Test/diagnostics-only handle on the cache. Not part of the public surface
 * (P3 views read via the dedicated `getCached*` selectors).
 *
 * @returns {{ habits: Map<string, object>, logs: Map<string, object>, settings: Map<string, *> }}
 */
export function _cache() { return cache; }

/**
 * Defensive-copy array of cached habits. Mutations to the returned array
 * do NOT leak into module state.
 *
 * @returns {object[]}
 */
export function getCachedHabits() {
  return Array.from(cache.habits.values());
}

/**
 * Get the cached log row for `(habitId, date)`, or undefined when absent.
 * The compound key `"habitId::date"` matches the cache fill in `hydrate()`.
 *
 * @param {string} habitId
 * @param {string} date YYYY-MM-DD
 * @returns {object|undefined}
 */
export function getCachedLog(habitId, date) {
  return cache.logs.get(`${habitId}::${date}`);
}

/**
 * Read the cached `weekStart` setting. Falls back to `'mon'` (D-51 default).
 *
 * @returns {'mon'|'sun'}
 */
export function getCachedWeekStart() {
  return cache.settings.get('weekStart') ?? 'mon';
}

/**
 * Count cached logs for `habitId` with `completed === true` whose `date`
 * falls inside the inclusive `[startYMD, endYMD]` range.
 *
 * This is the function the cadence resolver's `ctx.weekCompletions` is
 * bound to in `mountToday` — driving the weekly-cadence "hide after one
 * completion this week" semantics (D-49).
 *
 * @param {string} habitId
 * @param {string} startYMD YYYY-MM-DD inclusive
 * @param {string} endYMD YYYY-MM-DD inclusive
 * @returns {number}
 */
export function getCachedWeekCompletions(habitId, startYMD, endYMD) {
  let n = 0;
  for (const log of cache.logs.values()) {
    if (
      log.habitId === habitId &&
      log.completed === true &&
      log.date >= startYMD &&
      log.date <= endYMD
    ) {
      n++;
    }
  }
  return n;
}

/**
 * Test-only: wipe the cache + reset injection state so `freshStore()` in
 * tests starts from a pristine module instance. Production never calls this.
 *
 * @returns {void}
 */
export function _resetStoreForTest() {
  cache.habits.clear();
  cache.logs.clear();
  cache.settings.clear();
  hydrated = false;
  _repo = null;
}
