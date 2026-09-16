/**
 * @file Unit tests for writeHabitSnapshots and rebuildAllSnapshots
 * (SCORING-08, SCORING-09, SETTINGS-06, NFR-03, D-114).
 *
 * Uses a fake repo (object with getAll/getLogsByHabit/getSetting/runTx stubs)
 * and mocked scoring functions injected via the configure() DI seam.
 *
 * Tests do NOT depend on js/domain/scoring.js being correct — scoring
 * functions are mocked to return fixed values so 06-01 and 06-02 can be
 * implemented and tested in parallel.
 *
 * Coverage:
 *   writeHabitSnapshots:
 *     - writes a score_snapshots row for each date in [createdAt, today]
 *     - row shape: {habitId, date, s1Score, s1Status, s2Score, s3Score, scoreVersion: 1}
 *     - grace-period dates → all scores null in written row
 *     - uses exactly ONE runTx call per habit invocation
 *     - scoreVersion is always 1 (SCORING-09)
 *
 *   rebuildAllSnapshots:
 *     - calls writeHabitSnapshots for each habit from getAllHabits
 *     - onProgress(done, total) invoked once per habit with (index+1, total)
 *     - does not throw when getAllHabits returns empty array
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  configure,
  writeHabitSnapshots,
  rebuildAllSnapshots,
} from '../../../js/io/scoreSnapshots.js';
import { isoWeekStart, isoWeekEnd, getMonthStart, getMonthEnd } from '../../../js/util/date.js';

// ---------------------------------------------------------------------------
// Fake scoring functions — mocked S1/S2/S3 that return deterministic values.
// These are injected via configure() so tests are independent of scoring.js.
// ---------------------------------------------------------------------------

const FIXED_S1 = { s1Score: 80, s1Status: 'Watch' };
const FIXED_S2 = { s2Score: 0.75 };
const FIXED_S3 = { s3Score: 0.6 };

/** Mock computeS1 returning FIXED_S1 always. */
const mockComputeS1 = (_habit, _logs, _ctx) => FIXED_S1;
/** Mock computeS2 returning FIXED_S2 always. */
const mockComputeS2 = (_habit, _logs, _ctx) => FIXED_S2;
/** Mock computeS3 returning FIXED_S3 always. */
const mockComputeS3 = (_habit, _logs, _ctx, _allHabits) => FIXED_S3;

/** Mock computeS1 that returns null scores (grace period simulation). */
const mockGraceS1 = (_habit, _logs, _ctx) => ({ s1Score: null, s1Status: null });
const mockGraceS2 = (_habit, _logs, _ctx) => ({ s2Score: null });
const mockGraceS3 = (_habit, _logs, _ctx, _allHabits) => ({ s3Score: null });

// ---------------------------------------------------------------------------
// Fake repo builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal fake repo for scoreSnapshots tests.
 * Tracks runTx call count and captured snapshot rows.
 *
 * @param {{ habits?: object[], logsByHabit?: object[], settings?: Record<string, any> }} opts
 * @returns {{ fakeRepo: object, captured: { snapshots: object[], runTxCallCount: number } }}
 */
function buildFakeRepo({ habits = [], logsByHabit = [], settings = {} } = {}) {
  const captured = { snapshots: [], runTxCallCount: 0 };

  const fakeRepo = {
    async getAllHabits() { return habits; },
    async getLogsByHabit(_habitId) { return logsByHabit; },
    async getSetting(key) {
      const val = settings[key];
      // Return the value wrapped in a {value} object to match repo surface,
      // or raw if the test provides raw values.
      return val !== undefined ? val : undefined;
    },
    async runTx(_storeNames, _mode, body) {
      captured.runTxCallCount++;
      const tx = {
        objectStore(name) {
          if (name !== 'score_snapshots') {
            throw new Error(`fake: unexpected store '${name}' — expected score_snapshots`);
          }
          return {
            put(row) { captured.snapshots.push(row); },
          };
        },
      };
      return body(tx);
    },
  };

  return { fakeRepo, captured };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD string N days after a reference date. */
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yr = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

/** Today in YYYY-MM-DD (local). */
function todayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Tests: writeHabitSnapshots
// ---------------------------------------------------------------------------

describe('writeHabitSnapshots', () => {
  beforeEach(() => {
    // Inject mock scoring functions before each test.
    configure({
      computeS1: mockComputeS1,
      computeS2: mockComputeS2,
      computeS3: mockComputeS3,
    });
  });

  test('writes a row for each date from createdAt to today (inclusive)', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -4); // 5 days including today
    const habit = { id: 'h1', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h1', fakeRepo);

    // Should have written 5 rows (createdAt, +1, +2, +3, today)
    assert.strictEqual(captured.snapshots.length, 5);

    // Verify dates are in range [createdAt, today] — all 5 dates present
    const dates = captured.snapshots.map(r => r.date).sort();
    assert.strictEqual(dates[0], createdAt);
    assert.strictEqual(dates[dates.length - 1], today);
  });

  test('every written row has the correct shape', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -9); // 10 days: forces non-grace-period
    const habit = { id: 'h2', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h2', fakeRepo);

    for (const row of captured.snapshots) {
      assert.strictEqual(row.habitId, 'h2');
      assert.ok(typeof row.date === 'string', 'date must be string');
      assert.ok(row.date.match(/^\d{4}-\d{2}-\d{2}$/), 'date must be YYYY-MM-DD');
      assert.strictEqual(row.scoreVersion, 1, 'scoreVersion must be 1 (SCORING-09)');
      // Shape must carry all three model score fields.
      assert.ok('s1Score' in row, 'row must have s1Score');
      assert.ok('s1Status' in row, 'row must have s1Status');
      assert.ok('s2Score' in row, 'row must have s2Score');
      assert.ok('s3Score' in row, 'row must have s3Score');
    }
  });

  test('scoreVersion is always 1 in every written row (SCORING-09)', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -2);
    const habit = { id: 'h3', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h3', fakeRepo);

    for (const row of captured.snapshots) {
      assert.strictEqual(row.scoreVersion, 1);
    }
  });

  test('uses exactly ONE runTx call per writeHabitSnapshots invocation', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -6);
    const habit = { id: 'h4', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h4', fakeRepo);

    assert.strictEqual(
      captured.runTxCallCount,
      1,
      'must use exactly one IDB transaction per habit (NFR-03 perf requirement)'
    );
  });

  test('grace-period dates produce null scores in the written row', async () => {
    configure({
      computeS1: mockGraceS1,
      computeS2: mockGraceS2,
      computeS3: mockGraceS3,
    });

    const today = todayYMD();
    const createdAt = addDays(today, -3); // within 7-day grace for all dates
    const habit = { id: 'h5', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h5', fakeRepo);

    // All rows should have null scores (grace period simulated by mockGrace*)
    assert.ok(captured.snapshots.length > 0, 'must write at least one row');
    for (const row of captured.snapshots) {
      assert.strictEqual(row.s1Score, null);
      assert.strictEqual(row.s1Status, null);
      assert.strictEqual(row.s2Score, null);
      assert.strictEqual(row.s3Score, null);
    }
  });

  // Regression: UAT-T21-v3 — seeded habits lack `createdAt`; dateRange(undefined,
  // today) yields zero rows because `undefined <= dateString` is false.
  test('regression UAT-T21-v3: writes snapshots for habit with no createdAt (uses window fallback)', async () => {
    // Habit with NO createdAt field, startDate=null — mirrors seeded habits.
    const habit = { id: 'h-no-creat', cadence: { type: 'daily' }, startDate: null };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h-no-creat', fakeRepo);

    // Must write at least one snapshot row (the fallback to window-start is used).
    assert.ok(captured.snapshots.length > 0,
      'should write at least one snapshot row even when createdAt is missing');
    assert.ok(captured.snapshots.every(r => r.habitId === 'h-no-creat'),
      'all rows should belong to the correct habitId');
    assert.strictEqual(captured.runTxCallCount, 1,
      'must use exactly one IDB transaction (NFR-03)');
  });

  // Regression: UAT-T21-v3 — habit with createdAt=undefined AND startDate=undefined
  // (completely missing both fields) should still write snapshots via the window fallback.
  test('regression UAT-T21-v3: writes snapshots for habit with no createdAt and no startDate', async () => {
    const habit = { id: 'h-no-dates', cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h-no-dates', fakeRepo);

    assert.ok(captured.snapshots.length > 0,
      'should write snapshots when both createdAt and startDate are absent');
  });

  test('returns early (no rows written) when habit is not found', async () => {
    const today = todayYMD();
    const habit = { id: 'h-other', createdAt: addDays(today, -2), cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    // Request for a habitId not in getAllHabits → should return early without writing
    await writeHabitSnapshots('h-nonexistent', fakeRepo);

    assert.strictEqual(captured.snapshots.length, 0);
    assert.strictEqual(captured.runTxCallCount, 0);
  });

  test('non-grace-period rows carry the mocked S1/S2/S3 values', async () => {
    // Use fixed-value mocks (already configured in beforeEach)
    const today = todayYMD();
    // 10 days back → all dates past grace period (scored by mocks)
    const createdAt = addDays(today, -9);
    const habit = { id: 'h6', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit] });

    await writeHabitSnapshots('h6', fakeRepo);

    // Latest row should carry mock values
    const row = captured.snapshots.find(r => r.date === today);
    assert.ok(row, 'should have a row for today');
    assert.strictEqual(row.s1Score, FIXED_S1.s1Score);
    assert.strictEqual(row.s1Status, FIXED_S1.s1Status);
    assert.strictEqual(row.s2Score, FIXED_S2.s2Score);
    assert.strictEqual(row.s3Score, FIXED_S3.s3Score);
  });
});

// ---------------------------------------------------------------------------
// Tests: weekly/monthly cadence tooltip flags (wave-completion-weekly-cadence)
// ---------------------------------------------------------------------------
//
// Regression coverage for the bug where js/views/desktop/waveboard.js's
// {completed}/{applicable} tooltip ratio was built by summing raw per-day
// appliesToday()/loggedToday results across a calendar week. For weekly
// cadence, appliesToday stays true from the week's start through the day of
// completion (D-49 log-aware resolver), so the summed "applicable" count
// varied from 1 to 7 depending on which weekday carried the completion
// (reported as "0/7 or 1/7" for a habit that should always read 1/1 per
// elapsed week). These tests assert the fix: exactly ONE row per cadence
// period carries applicableToday=true, and its loggedToday reflects whether
// ANY day in that period was completed — independent of which weekday.
describe('weekly/monthly cadence tooltip flags (wave-completion-weekly-cadence)', () => {
  beforeEach(() => {
    configure({
      computeS1: mockComputeS1,
      computeS2: mockComputeS2,
      computeS3: mockComputeS3,
    });
  });

  /** Sum applicable/completed exactly like js/views/desktop/waveboard.js does for one ISO week. */
  function sumWeek(snapshots, weekStartYMD, weekEndYMD) {
    let applicable = 0;
    let completed = 0;
    for (const row of snapshots) {
      if (row.date < weekStartYMD || row.date > weekEndYMD) continue;
      if (row.applicableToday) applicable++;
      if (row.loggedToday) completed++;
    }
    return { applicable, completed };
  }

  test('weekly habit completed on the FIRST day of an elapsed week → exactly one applicable row, tooltip reads 1/1', async () => {
    const today = todayYMD();
    // A week solidly in the past (2+ weeks back) so it is fully elapsed.
    const targetWeekMonday = isoWeekStart(addDays(today, -14), 'mon');
    const targetWeekSunday = isoWeekEnd(targetWeekMonday, 'mon');
    const createdAt = addDays(targetWeekMonday, -14); // well before the target week
    const habit = { id: 'w1', createdAt, cadence: { type: 'weekly' } };
    const logs = [{ habitId: 'w1', date: targetWeekMonday, status: 'completed' }];
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: logs });

    await writeHabitSnapshots('w1', fakeRepo);

    const weekRows = captured.snapshots.filter(
      (r) => r.date >= targetWeekMonday && r.date <= targetWeekSunday
    );
    const applicableRows = weekRows.filter((r) => r.applicableToday);
    assert.strictEqual(applicableRows.length, 1, 'exactly one applicable row per elapsed week');
    assert.strictEqual(applicableRows[0].date, targetWeekMonday, 'applicable row is the period anchor (week start)');

    const { applicable, completed } = sumWeek(captured.snapshots, targetWeekMonday, targetWeekSunday);
    assert.strictEqual(applicable, 1);
    assert.strictEqual(completed, 1);
  });

  test('weekly habit completed on the LAST day of an elapsed week → tooltip STILL reads 1/1 (not 1/7)', async () => {
    const today = todayYMD();
    const targetWeekMonday = isoWeekStart(addDays(today, -14), 'mon');
    const targetWeekSunday = isoWeekEnd(targetWeekMonday, 'mon');
    const createdAt = addDays(targetWeekMonday, -14);
    const habit = { id: 'w2', createdAt, cadence: { type: 'weekly' } };
    // Completed on the LAST day of the week — this is the case that used to
    // inflate the denominator to 7 before the fix.
    const logs = [{ habitId: 'w2', date: targetWeekSunday, status: 'completed' }];
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: logs });

    await writeHabitSnapshots('w2', fakeRepo);

    const { applicable, completed } = sumWeek(captured.snapshots, targetWeekMonday, targetWeekSunday);
    assert.strictEqual(applicable, 1, 'applicable must stay 1 regardless of which weekday was completed');
    assert.strictEqual(completed, 1);
  });

  test('weekly habit never completed in an elapsed week → tooltip reads 0/1 (not 0/7)', async () => {
    const today = todayYMD();
    const targetWeekMonday = isoWeekStart(addDays(today, -14), 'mon');
    const targetWeekSunday = isoWeekEnd(targetWeekMonday, 'mon');
    const createdAt = addDays(targetWeekMonday, -14);
    const habit = { id: 'w3', createdAt, cadence: { type: 'weekly' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: [] });

    await writeHabitSnapshots('w3', fakeRepo);

    const { applicable, completed } = sumWeek(captured.snapshots, targetWeekMonday, targetWeekSunday);
    assert.strictEqual(applicable, 1);
    assert.strictEqual(completed, 0);
  });

  test('completion in the FOLLOWING week does not leak into the previous week\'s loggedToday (period boundary)', async () => {
    const today = todayYMD();
    const targetWeekMonday = isoWeekStart(addDays(today, -21), 'mon');
    const targetWeekSunday = isoWeekEnd(targetWeekMonday, 'mon');
    const nextWeekMonday = addDays(targetWeekSunday, 1);
    const createdAt = addDays(targetWeekMonday, -14);
    const habit = { id: 'w4', createdAt, cadence: { type: 'weekly' } };
    // Completed the day immediately AFTER the target week ends.
    const logs = [{ habitId: 'w4', date: nextWeekMonday, status: 'completed' }];
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: logs });

    await writeHabitSnapshots('w4', fakeRepo);

    const targetWeek = sumWeek(captured.snapshots, targetWeekMonday, targetWeekSunday);
    assert.strictEqual(targetWeek.applicable, 1);
    assert.strictEqual(targetWeek.completed, 0, 'the next week\'s completion must not count toward this week');

    const nextWeekSunday = isoWeekEnd(nextWeekMonday, 'mon');
    const nextWeek = sumWeek(captured.snapshots, nextWeekMonday, nextWeekSunday);
    assert.strictEqual(nextWeek.applicable, 1);
    assert.strictEqual(nextWeek.completed, 1);
  });

  test('habit created mid-week: the partial first week\'s applicable row is createdAt, not the preceding Monday', async () => {
    const today = todayYMD();
    const targetWeekMonday = isoWeekStart(addDays(today, -14), 'mon');
    // Habit created on the Wednesday of its first (partial) week.
    const createdAt = addDays(targetWeekMonday, 2);
    const habit = { id: 'w5', createdAt, cadence: { type: 'weekly' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: [] });

    await writeHabitSnapshots('w5', fakeRepo);

    const weekSunday = isoWeekEnd(targetWeekMonday, 'mon');
    const weekRows = captured.snapshots.filter((r) => r.date >= createdAt && r.date <= weekSunday);
    const applicableRows = weekRows.filter((r) => r.applicableToday);
    assert.strictEqual(applicableRows.length, 1, 'partial first week still gets exactly one applicable row');
    assert.strictEqual(applicableRows[0].date, createdAt, 'anchor is createdAt, not the calendar week start');
  });

  test('daily-cadence habit is unaffected — applicableToday remains true every day (fix is periodic-only)', async () => {
    const today = todayYMD();
    const createdAt = addDays(today, -6);
    const habit = { id: 'd1', createdAt, cadence: { type: 'daily' } };
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: [] });

    await writeHabitSnapshots('d1', fakeRepo);

    assert.ok(captured.snapshots.length > 0);
    assert.ok(captured.snapshots.every((r) => r.applicableToday === true),
      'daily cadence must keep one applicable row per calendar day (unchanged by this fix)');
  });

  test('monthly habit completed mid-month → exactly one applicable row for the month, tooltip reads 1/1', async () => {
    const today = todayYMD();
    // A month solidly in the past.
    const referenceDate = addDays(today, -45);
    const monthStart = getMonthStart(referenceDate);
    const monthEnd = getMonthEnd(referenceDate);
    const createdAt = addDays(monthStart, -30);
    const habit = { id: 'm1', createdAt, cadence: { type: 'monthly' } };
    const midMonth = addDays(monthStart, 10);
    const logs = [{ habitId: 'm1', date: midMonth, status: 'completed' }];
    const { fakeRepo, captured } = buildFakeRepo({ habits: [habit], logsByHabit: logs });

    await writeHabitSnapshots('m1', fakeRepo);

    const monthRows = captured.snapshots.filter((r) => r.date >= monthStart && r.date <= monthEnd);
    const applicableRows = monthRows.filter((r) => r.applicableToday);
    assert.strictEqual(applicableRows.length, 1, 'exactly one applicable row per elapsed month');
    assert.strictEqual(applicableRows[0].date, monthStart);
    assert.strictEqual(applicableRows[0].loggedToday, true);
  });
});

// ---------------------------------------------------------------------------
// Tests: rebuildAllSnapshots
// ---------------------------------------------------------------------------

describe('rebuildAllSnapshots', () => {
  beforeEach(() => {
    configure({
      computeS1: mockComputeS1,
      computeS2: mockComputeS2,
      computeS3: mockComputeS3,
    });
  });

  test('does not throw when getAllHabits returns an empty array', async () => {
    const { fakeRepo } = buildFakeRepo({ habits: [] });
    // Must not throw
    await assert.doesNotReject(
      () => rebuildAllSnapshots(fakeRepo),
      'rebuildAllSnapshots should handle empty habits list gracefully'
    );
  });

  test('calls writeHabitSnapshots for each habit (writes rows for each)', async () => {
    const today = todayYMD();
    const habits = [
      { id: 'ha', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
      { id: 'hb', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
      { id: 'hc', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
    ];
    const { fakeRepo, captured } = buildFakeRepo({ habits });

    await rebuildAllSnapshots(fakeRepo);

    // Each habit should have contributed runTx calls
    assert.strictEqual(captured.runTxCallCount, habits.length,
      'should have exactly one runTx per habit'
    );

    // Verify all three habitIds appear in written snapshots
    const writtenHabitIds = new Set(captured.snapshots.map(r => r.habitId));
    for (const h of habits) {
      assert.ok(writtenHabitIds.has(h.id), `expected rows for habitId ${h.id}`);
    }
  });

  test('onProgress callback invoked once per habit with (done, total) args', async () => {
    const today = todayYMD();
    const habits = [
      { id: 'p1', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
      { id: 'p2', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
    ];
    const { fakeRepo } = buildFakeRepo({ habits });

    const progressCalls = [];
    await rebuildAllSnapshots(fakeRepo, (done, total) => {
      progressCalls.push({ done, total });
    });

    // Should be called once per habit
    assert.strictEqual(progressCalls.length, habits.length);
    // First call: done=1, total=2
    assert.strictEqual(progressCalls[0].done, 1);
    assert.strictEqual(progressCalls[0].total, 2);
    // Second call: done=2, total=2
    assert.strictEqual(progressCalls[1].done, 2);
    assert.strictEqual(progressCalls[1].total, 2);
  });

  test('onProgress is optional (no default arg error with 1 argument)', async () => {
    const today = todayYMD();
    const habits = [
      { id: 'q1', createdAt: addDays(today, -1), cadence: { type: 'daily' } },
    ];
    const { fakeRepo } = buildFakeRepo({ habits });

    // Call with only one argument — onProgress defaults to no-op
    await assert.doesNotReject(() => rebuildAllSnapshots(fakeRepo));
  });
});
