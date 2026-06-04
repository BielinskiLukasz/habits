/**
 * @file Integration tests for `repo.getLogsForDate()` and
 * `repo.getHabitVersionAtDate()` via the fake-IDB (D-25, A7 contract).
 *
 * Both methods are new in Phase 04 plan 05 (Task 1). They enable:
 *   - `getLogsForDate(date)` — returns all log rows whose `date` equals the
 *     given YYYY-MM-DD string (all habitIds).
 *   - `getHabitVersionAtDate(habitId, date)` — returns the habit_versions entry
 *     with the largest effectiveFrom <= date for this habitId, or `undefined`
 *     if none found.
 *
 * The fake-IDB MUST expose both methods so the A7 contract test keeps passing.
 *
 * Habit versions are seeded via `runTx` (the same path apply handlers use) so
 * the test exercises the real write path, not a test-only backdoor.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** Helper: seed a habit_versions row via the fake's runTx (same path apply handlers use). */
async function seedVersion(repo, versionRow) {
  await repo.runTx(['habit_versions'], 'readwrite', (tx) => {
    tx.objectStore('habit_versions').put(versionRow);
  });
}

let fake;
beforeEach(() => {
  fake = createFakeRepo();
});

describe('repo.getLogsForDate via fake', () => {
  test('returns [] when logs store is empty', async () => {
    const out = await fake.getLogsForDate('2026-05-25');
    assert.deepEqual(out, []);
  });

  test('returns all 3 logs on the target date, ignores 2 on other dates', async () => {
    await fake.putLog({ habitId: 'h1', date: '2026-05-25', completed: true });
    await fake.putLog({ habitId: 'h2', date: '2026-05-25', completed: false });
    await fake.putLog({ habitId: 'h3', date: '2026-05-25', completed: true });
    await fake.putLog({ habitId: 'h1', date: '2026-05-24', completed: true });
    await fake.putLog({ habitId: 'h2', date: '2026-05-26', completed: true });

    const out = await fake.getLogsForDate('2026-05-25');
    assert.equal(out.length, 3);
    const ids = new Set(out.map((l) => l.habitId));
    assert.ok(ids.has('h1'));
    assert.ok(ids.has('h2'));
    assert.ok(ids.has('h3'));
  });

  test('exact-match only — a date boundary query returns the one exact-match log', async () => {
    await fake.putLog({ habitId: 'h1', date: '2026-05-24', completed: true });
    await fake.putLog({ habitId: 'h1', date: '2026-05-25', completed: true });
    await fake.putLog({ habitId: 'h1', date: '2026-05-26', completed: true });

    const out = await fake.getLogsForDate('2026-05-25');
    assert.equal(out.length, 1);
    assert.equal(out[0].date, '2026-05-25');
  });
});

describe('repo.getHabitVersionAtDate via fake', () => {
  test('returns undefined when no versions exist for the habitId', async () => {
    const result = await fake.getHabitVersionAtDate('h-none', '2026-03-01');
    assert.equal(result, undefined);
  });

  test('returns the version at 2026-01-01 when queried at 2026-03-01', async () => {
    await seedVersion(fake, { habitId: 'h1', effectiveFrom: '2026-01-01', name: 'Morning walk' });

    const result = await fake.getHabitVersionAtDate('h1', '2026-03-01');
    assert.ok(result, 'should return a version');
    assert.equal(result.effectiveFrom, '2026-01-01');
    assert.equal(result.name, 'Morning walk');
  });

  test('returns the MOST RECENT version (2026-02-01) when two versions exist and queried at 2026-02-15', async () => {
    await seedVersion(fake, { habitId: 'h1', effectiveFrom: '2026-01-01', name: 'Version A' });
    await seedVersion(fake, { habitId: 'h1', effectiveFrom: '2026-02-01', name: 'Version B' });

    const result = await fake.getHabitVersionAtDate('h1', '2026-02-15');
    assert.ok(result, 'should return a version');
    assert.equal(result.effectiveFrom, '2026-02-01');
    assert.equal(result.name, 'Version B');
  });

  test('returns undefined when the only version is AFTER the query date', async () => {
    await seedVersion(fake, { habitId: 'h1', effectiveFrom: '2026-03-01', name: 'Future version' });

    const result = await fake.getHabitVersionAtDate('h1', '2026-02-01');
    assert.equal(result, undefined, 'version not yet effective on 2026-02-01');
  });

  test('effectiveFrom === date boundary: returns the version when effectiveFrom exactly equals query date', async () => {
    await seedVersion(fake, { habitId: 'h1', effectiveFrom: '2026-02-01', name: 'Exact boundary version' });

    const result = await fake.getHabitVersionAtDate('h1', '2026-02-01');
    assert.ok(result, 'should return version when effectiveFrom equals the query date');
    assert.equal(result.effectiveFrom, '2026-02-01');
  });

  test('only returns versions for the correct habitId (not other habits)', async () => {
    await seedVersion(fake, { habitId: 'h1', effectiveFrom: '2026-01-01', name: 'Habit 1 version' });
    await seedVersion(fake, { habitId: 'h2', effectiveFrom: '2026-01-01', name: 'Habit 2 version' });

    const result1 = await fake.getHabitVersionAtDate('h1', '2026-06-01');
    assert.ok(result1);
    assert.equal(result1.name, 'Habit 1 version');

    const result2 = await fake.getHabitVersionAtDate('h2', '2026-06-01');
    assert.ok(result2);
    assert.equal(result2.name, 'Habit 2 version');
  });
});
