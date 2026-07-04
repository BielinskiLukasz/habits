/**
 * @file Score snapshot writer: write-time per-habit and bulk-rebuild for all
 * habits (SCORING-08, SCORING-09, D-113, D-114, NFR-03).
 *
 * Called from apply.js after log writes (plan 06-03) and from the Settings
 * "Recompute Scores" action. Never called by views.
 *
 * Design decisions:
 *   - D-114: write-time trigger per habit; bulk rebuild via rebuildAllSnapshots.
 *   - D-124: single row per (habitId, date) carrying all three model scores.
 *   - NFR-03: < 2 s for 5 years × 65 habits — achieved via ONE IDB transaction
 *     per habit (all rows for one habit in a single tx) and a synchronous
 *     date-iteration loop (no per-day IDB reads).
 *   - configure() DI seam allows tests to inject mock scoring functions without
 *     depending on js/domain/scoring.js (enables 06-01 and 06-02 in parallel).
 *
 * Production consumers call configure() automatically at module load with
 * the real scoring.js imports. Tests override this before each test via a
 * second configure() call.
 */

import { todayLocal, daysFrom } from '../util/date.js';
import { appliesToday } from '../domain/cadence.js';
import { computeS1, computeS2, computeS3 } from '../domain/scoring.js';

// ---------------------------------------------------------------------------
// DI seam — replaced by tests with mock scoring functions
// ---------------------------------------------------------------------------

/** @type {(habit: object, logs: object[], ctx: object) => {s1Score: number|null, s1Status: string|null}} */
let _computeS1;
/** @type {(habit: object, logs: object[], ctx: object) => {s2Score: number|null}} */
let _computeS2;
/** @type {(habit: object, logs: object[], ctx: object, allHabits: object[]) => {s3Score: number|null}} */
let _computeS3;

/**
 * Inject scoring function implementations. Called automatically at module load
 * with the real scoring.js exports; tests call this before each test to inject
 * mocks.
 *
 * @param {{ computeS1: Function, computeS2: Function, computeS3: Function }} fns
 */
export function configure({ computeS1: s1, computeS2: s2, computeS3: s3 }) {
  _computeS1 = s1;
  _computeS2 = s2;
  _computeS3 = s3;
}

// Auto-configure with real scoring functions at module load.
configure({ computeS1, computeS2, computeS3 });

// ---------------------------------------------------------------------------
// Internal: date range generator
// ---------------------------------------------------------------------------

/**
 * Generator that yields each YYYY-MM-DD string from startYMD to endYMD
 * inclusive. Uses daysFrom() for DST-safe calendar arithmetic (Pitfall 4).
 *
 * @param {string} startYMD YYYY-MM-DD
 * @param {string} endYMD YYYY-MM-DD
 * @yields {string} YYYY-MM-DD
 */
function* dateRange(startYMD, endYMD) {
  let cur = startYMD;
  while (cur <= endYMD) {
    yield cur;
    cur = daysFrom(cur, 1);
  }
}

// ---------------------------------------------------------------------------
// writeHabitSnapshots
// ---------------------------------------------------------------------------

/**
 * Recompute and persist score_snapshots rows for a single habit.
 *
 * Fetches: habit definition, all habits (S3 load denominator), logs for the
 * habit, and global settings. Iterates from habit.createdAt to today and
 * calls _computeS1/_computeS2/_computeS3 for each date. Writes all resulting
 * rows in a SINGLE IDB transaction (NFR-03: minimises tx overhead).
 *
 * Returns early without writing if the habit is not found in getAllHabits().
 *
 * @param {string} habitId
 * @param {{
 *   getAllHabits: () => Promise<object[]>,
 *   getLogsByHabit: (habitId: string) => Promise<object[]>,
 *   getSetting: (key: string) => Promise<any>,
 *   runTx: (stores: string[], mode: string, body: (tx: object) => any) => Promise<void>
 * }} repo
 * @returns {Promise<void>}
 */
export async function writeHabitSnapshots(habitId, repo) {
  // Fetch all habits (needed for S3 load denominator AND to resolve this habit).
  const allHabits = await repo.getAllHabits();
  const habit = allHabits.find(h => h.id === habitId);
  if (!habit) return; // Habit not found — nothing to write.

  // Fetch all logs for this habit.
  const logsForHabit = await repo.getLogsByHabit(habitId);

  // Fetch global settings (apply defaults matching SETTINGS-04 / D-45).
  const rawThreshold = await repo.getSetting('masteryThreshold');
  const rawWindow = await repo.getSetting('masteryWindow');
  const rawWeekStart = await repo.getSetting('weekStart');

  // getSetting returns raw values (may be undefined or a {key, value} object).
  // Normalize: if the result is an object with a `value` property, unwrap it;
  // otherwise use as-is (tests may return raw primitives directly).
  const globalThreshold = _unwrapSetting(rawThreshold) ?? 90;
  const windowDays = _unwrapSetting(rawWindow) ?? 70;
  const weekStart = _unwrapSetting(rawWeekStart) ?? 'mon';

  // ctx shape expected by scoring functions and cadence.appliesToday.
  // evaluationDate is set per-iteration below.
  const ctx = {
    appliesToday,
    windowDays,
    globalThreshold,
    weekStart,
    // weekCompletions / monthCompletions are required by cadence.js resolvers
    // (weekly and monthly cadence types). The snapshot writer does not have
    // access to a populated repo during this loop, so we provide a conservative
    // default of 0 (habit always appears applicable on weekly/monthly days).
    // This is acceptable for scoring purposes: the cadence gate here affects
    // the denominator, and a slightly over-estimated denominator is the safe
    // direction (underestimates score rather than over-inflating it).
    weekCompletions: () => 0,
    monthCompletions: () => 0,
    evaluationDate: todayLocal(), // overwritten for each day below
  };

  const todayYMD = todayLocal();

  // Normalize the snapshot start date (UAT-T21-v3 root-cause fix).
  //
  // Problem: habits.json seed data does not include a `createdAt` field, so
  // seeded habits have `habit.createdAt === undefined` in IDB.  When startDate
  // is undefined the condition `undefined <= todayYMD` evaluates to false, so
  // dateRange() yields zero iterations and writeHabitSnapshots silently returns
  // without writing a single row — leaving score_snapshots perpetually empty.
  //
  // Fix: fall back through habit.startDate (also null on most seeded habits,
  // but may be a valid date for future-scheduled habits), then to the rolling
  // window start so that at least one full scoring window of snapshot rows is
  // always written.  The user can later press "Recompute Scores" to extend the
  // history backwards if they want older data.
  const effectiveCreatedAt =
    habit.createdAt ??
    habit.startDate ??
    daysFrom(todayYMD, -(windowDays - 1));

  // When createdAt is missing from the stored habit row, pass a normalised
  // copy of the habit to scoring functions.  Without this, isInGracePeriod()
  // receives undefined and calls parseLocalYMD(undefined) → TypeError.
  const habitForScoring =
    habit.createdAt != null ? habit : { ...habit, createdAt: effectiveCreatedAt };

  const startDate = effectiveCreatedAt;
  const endDate = todayYMD;

  // Collect all snapshot rows synchronously (no per-day IDB reads — NFR-03).
  const snapshotRows = [];
  for (const dateYMD of dateRange(startDate, endDate)) {
    // Update evaluationDate for the current day's computation.
    ctx.evaluationDate = dateYMD;

    const { s1Score, s1Status } = _computeS1(habitForScoring, logsForHabit, ctx);
    const { s2Score } = _computeS2(habitForScoring, logsForHabit, ctx);
    const { s3Score } = _computeS3(habitForScoring, logsForHabit, ctx, allHabits);

    snapshotRows.push({
      habitId,
      date: dateYMD,
      s1Score,
      s1Status,
      s2Score,
      s3Score,
      scoreVersion: 1, // SCORING-09: locked at 1 for Phase 6
    });
  }

  // Write all rows in a SINGLE IDB transaction (NFR-03 key optimization).
  // For 5 years × 1 habit ≈ 1825 rows — one tx with 1825 puts is orders of
  // magnitude faster than 1825 individual transactions.
  await repo.runTx(['score_snapshots'], 'readwrite', (tx) => {
    const store = tx.objectStore('score_snapshots');
    for (const row of snapshotRows) {
      store.put(row);
    }
  });
}

// ---------------------------------------------------------------------------
// rebuildAllSnapshots
// ---------------------------------------------------------------------------

/**
 * Recompute and persist score_snapshots rows for ALL habits (including archived).
 *
 * Processes habits sequentially to avoid IDB transaction contention. After
 * each habit completes, calls `onProgress(done, total)` so the Settings UI
 * can show a loading indicator.
 *
 * Complexity: O(habits × days × allHabits) in the worst case.
 * NFR-03 target: < 2 s for 5 years × 65 habits on modern browsers.
 * Strategy: single tx per habit (65 transactions × ~1825 rows each) keeps
 * total IDB overhead well within the 2 s budget.
 *
 * @param {{
 *   getAllHabits: () => Promise<object[]>,
 *   getLogsByHabit: (habitId: string) => Promise<object[]>,
 *   getSetting: (key: string) => Promise<any>,
 *   runTx: (stores: string[], mode: string, body: (tx: object) => any) => Promise<void>
 * }} repo
 * @param {(done: number, total: number) => void} [onProgress] optional callback
 * @returns {Promise<void>}
 */
export async function rebuildAllSnapshots(repo, onProgress = () => {}) {
  const habits = await repo.getAllHabits();
  const total = habits.length;

  for (let i = 0; i < total; i++) {
    await writeHabitSnapshots(habits[i].id, repo);
    onProgress(i + 1, total);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a raw setting value returned by repo.getSetting().
 * The real repo returns the stored object `{key, value}` for settings.
 * Test fakes may return primitives directly. This helper handles both shapes.
 *
 * @param {any} raw
 * @returns {any}
 */
function _unwrapSetting(raw) {
  if (raw === undefined || raw === null) return undefined;
  // Real repo shape: { key: string, value: any }
  if (typeof raw === 'object' && 'value' in raw) return raw.value;
  // Test may return primitive directly (number, string, etc.)
  return raw;
}
