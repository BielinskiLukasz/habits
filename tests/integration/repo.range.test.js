/**
 * @file Integration tests for `repo.getAllHabits()` + `repo.getLogsInRange()`
 * via the fake-IDB (D-25, A7 contract).
 *
 * Both methods are new in Phase 03 plan 01 (Task 5). They enable Slice 2's
 * Today hydrate path to do a single bounded read on cold-paint per NFR-01
 * (`repo.getAllHabits()` + `repo.getLogsInRange(today-7, today)` covers the
 * weekly resolver window; every-N reads `lastCompletedDate` directly from
 * the habit row).
 *
 * The fake-IDB MUST expose both methods with the same names so the A7
 * contract test in `tests/integration/contract.fake-vs-real.test.js` keeps
 * passing.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

let fake;
beforeEach(() => {
  fake = createFakeRepo();
});

describe('repo.getAllHabits via fake', () => {
  test('returns [] when the habits store is empty', async () => {
    const out = await fake.getAllHabits();
    assert.deepEqual(out, []);
  });

  test('returns every habit row after two putHabit calls', async () => {
    await fake.putHabit({ id: 'a', name: 'X' });
    await fake.putHabit({ id: 'b', name: 'Y' });
    const out = await fake.getAllHabits();
    assert.equal(out.length, 2);
    const byId = new Map(out.map((h) => [h.id, h]));
    assert.equal(byId.get('a').name, 'X');
    assert.equal(byId.get('b').name, 'Y');
  });
});

describe('repo.getLogsInRange via fake', () => {
  test('returns [] when the logs store is empty', async () => {
    const out = await fake.getLogsInRange('2026-05-20', '2026-05-30');
    assert.deepEqual(out, []);
  });

  test('filters to the inclusive [start, end] window', async () => {
    await fake.putLog({ habitId: 'h1', date: '2026-05-19', completed: true });
    await fake.putLog({ habitId: 'h1', date: '2026-05-25', completed: true });
    await fake.putLog({ habitId: 'h1', date: '2026-05-31', completed: true });
    const out = await fake.getLogsInRange('2026-05-20', '2026-05-30');
    assert.equal(out.length, 1);
    assert.equal(out[0].date, '2026-05-25');
  });

  test('boundary: a single-day range matches the log on that exact day', async () => {
    await fake.putLog({ habitId: 'h1', date: '2026-05-25', completed: true });
    const out = await fake.getLogsInRange('2026-05-25', '2026-05-25');
    assert.equal(out.length, 1);
    assert.equal(out[0].date, '2026-05-25');
  });

  test('returns logs across multiple habits in the window', async () => {
    await fake.putLog({ habitId: 'h1', date: '2026-05-25', completed: true });
    await fake.putLog({ habitId: 'h2', date: '2026-05-26', completed: true });
    await fake.putLog({ habitId: 'h3', date: '2026-05-27', completed: false });
    const out = await fake.getLogsInRange('2026-05-25', '2026-05-27');
    assert.equal(out.length, 3);
    const ids = new Set(out.map((l) => l.habitId));
    assert.ok(ids.has('h1'));
    assert.ok(ids.has('h2'));
    assert.ok(ids.has('h3'));
  });
});
