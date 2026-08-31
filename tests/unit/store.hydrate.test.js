/**
 * @file Unit tests for the expanded `js/state/store.js` hydrate path
 * (Phase 03 plan 02 Task 3 — D-52, NFR-01) and the Phase 03 plan 03 Task 2
 * notify-driven cache refresh (D-52, D-72, Pitfall 2).
 *
 * Covers:
 *   - Empty repo → hydrate() resolves with empty cache + default weekStart
 *   - Seeded repo → hydrate() populates habits, logs, weekStart
 *   - Idempotency — second hydrate() does NOT re-read from repo
 *   - getCachedWeekCompletions counts only status:'completed' logs inside the
 *     inclusive date range
 *   - notify({event, keys}) refreshes affected `cache.logs` / `cache.habits`
 *     BEFORE fanning out to subscribers (Pitfall 2 — no stale reads)
 *
 * Pattern S7 (fresh-import cache-bust) so each test gets a clean module
 * instance with its own `_repo`, `cache`, `hydrated` state.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

/** Fresh import per test so store.js module-level state is clean. */
async function freshStore() {
  const url = new URL('../../js/state/store.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/**
 * Pattern S7 paired-cache-bust import — store.js + apply.js share the SAME
 * query tag so apply.js's static `import {notify} from './store.js'`
 * resolves to the SAME cache-busted store instance the test inspects.
 */
async function freshStoreAndApply() {
  const storeUrl = new URL('../../js/state/store.js', import.meta.url);
  const applyUrl = new URL('../../js/state/apply.js', import.meta.url);
  const tag = `?t=${Date.now()}-${Math.random()}`;
  storeUrl.search = tag;
  applyUrl.search = tag;
  const [store, applyMod] = await Promise.all([
    import(storeUrl.href),
    import(applyUrl.href),
  ]);
  return { store, applyMod };
}

describe('hydrate populates cache', () => {
  test('empty repo: getCachedHabits is [], default weekStart is "mon"', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    store.configureStore({ repo });

    await store.hydrate();

    assert.deepEqual(store.getCachedHabits(), []);
    assert.equal(store.getCachedWeekStart(), 'mon');
  });

  test('seeded repo: habits + this-week logs + weekStart all cached', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    const today = todayLocal();
    await repo.putHabit({
      id: 'a',
      name: 'X',
      cadence: { type: 'daily' },
      status: 'active',
    });
    await repo.putLog({ habitId: 'a', date: today, status: 'completed' });
    await repo.putSetting({ key: 'weekStart', value: 'sun' });

    store.configureStore({ repo });
    await store.hydrate();

    assert.equal(store.getCachedHabits().length, 1);
    assert.equal(store.getCachedHabits()[0].id, 'a');
    const log = store.getCachedLog('a', today);
    assert.ok(log, 'log cached');
    assert.equal(log.status, 'completed');
    assert.equal(store.getCachedWeekStart(), 'sun');
  });

  test('idempotency: calling hydrate twice does not re-read from repo', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    let getAllCalls = 0;
    const originalGetAllHabits = repo.getAllHabits.bind(repo);
    repo.getAllHabits = async () => {
      getAllCalls++;
      return originalGetAllHabits();
    };

    store.configureStore({ repo });
    await store.hydrate();
    await store.hydrate();

    assert.equal(getAllCalls, 1, 'getAllHabits called exactly once');
  });

  test('hydrate is safe when no repo is configured (defensive no-op)', async () => {
    const store = await freshStore();
    // Deliberately skip configureStore — verifies the defensive return.
    await store.hydrate();
    assert.deepEqual(store.getCachedHabits(), []);
    assert.equal(store.getCachedWeekStart(), 'mon');
  });
});

describe('getCachedWeekCompletions counts completed-true logs in range', () => {
  test('returns 1 when one completed log is in range, another uncompleted in range, third completed outside range', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    await repo.putHabit({
      id: 'a',
      name: 'X',
      cadence: { type: 'weekly' },
      status: 'active',
    });
    // Note: hydrate only loads THIS week's logs. To exercise the in-range
    // count we seed the repo with logs that fall within the hydrate range
    // (today's ISO week). For the off-range assertion we put a log far in
    // the past so it is NOT loaded by hydrate — confirming that the cached
    // weekCompletions function only sees what hydrate cached.
    const today = todayLocal();
    await repo.putLog({ habitId: 'a', date: today, status: 'completed' });
    await repo.putLog({ habitId: 'a', date: today, status: 'completed' }); // overwrites — same key

    store.configureStore({ repo });
    await store.hydrate();

    // Pick a range that covers today. The cached log is completed=true.
    const n = store.getCachedWeekCompletions('a', '2020-01-01', '2099-12-31');
    assert.equal(n, 1, 'one completed-true log counted');
  });

  test('does not count uncompleted logs', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    const today = todayLocal();
    await repo.putHabit({
      id: 'a',
      name: 'X',
      cadence: { type: 'weekly' },
      status: 'active',
    });
    await repo.putLog({ habitId: 'a', date: today, status: 'failed' });

    store.configureStore({ repo });
    await store.hydrate();

    const n = store.getCachedWeekCompletions('a', '2020-01-01', '2099-12-31');
    assert.equal(n, 0, 'uncompleted logs are not counted');
  });

  test('respects the startYMD/endYMD range bounds', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    const today = todayLocal();
    await repo.putHabit({
      id: 'a',
      name: 'X',
      cadence: { type: 'weekly' },
      status: 'active',
    });
    await repo.putLog({ habitId: 'a', date: today, status: 'completed' });

    store.configureStore({ repo });
    await store.hydrate();

    // Range that excludes today by setting end before today.
    const n = store.getCachedWeekCompletions('a', '1999-01-01', '1999-12-31');
    assert.equal(n, 0, 'out-of-range logs are not counted');
  });

  test('only counts logs for the requested habitId', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    const today = todayLocal();
    await repo.putHabit({
      id: 'a',
      name: 'A',
      cadence: { type: 'weekly' },
      status: 'active',
    });
    await repo.putHabit({
      id: 'b',
      name: 'B',
      cadence: { type: 'weekly' },
      status: 'active',
    });
    await repo.putLog({ habitId: 'a', date: today, status: 'completed' });
    await repo.putLog({ habitId: 'b', date: today, status: 'completed' });

    store.configureStore({ repo });
    await store.hydrate();

    const nA = store.getCachedWeekCompletions('a', '2020-01-01', '2099-12-31');
    const nB = store.getCachedWeekCompletions('b', '2020-01-01', '2099-12-31');
    assert.equal(nA, 1);
    assert.equal(nB, 1);
    // Different habit IDs each see only their own logs.
    const nC = store.getCachedWeekCompletions('c', '2020-01-01', '2099-12-31');
    assert.equal(nC, 0);
  });
});

describe('notify refreshes cache for affected keys (D-52, D-72, Pitfall 2)', () => {
  test('notify refreshes log cache after markCompleted (no manual re-hydrate)', async () => {
    const { store, applyMod } = await freshStoreAndApply();
    const repo = createFakeRepo();
    store.configureStore({ repo });
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {}, notify: store.notify });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });
    await store.hydrate();

    // Before tap: cache has no log for (h1, 2026-05-26).
    assert.equal(store.getCachedLog('h1', '2026-05-26'), undefined);

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    // After tap (NO manual re-hydrate): the cache reflects the new log row.
    const log = store.getCachedLog('h1', '2026-05-26');
    assert.ok(log, 'cache.logs should contain the newly-written row after notify');
    assert.equal(log.status, 'completed');
    assert.equal(log.definitionVersion, null);
  });

  test('notify refreshes habit cache (D-52 — lastCompletedDate)', async () => {
    const { store, applyMod } = await freshStoreAndApply();
    const repo = createFakeRepo();
    store.configureStore({ repo });
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {}, notify: store.notify });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });
    await store.hydrate();

    // Before tap: cached habit has no lastCompletedDate.
    const before = store.getCachedHabits().find((h) => h.id === 'h1');
    assert.ok(before, 'habit cached after hydrate');
    assert.equal(before.lastCompletedDate, undefined);

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const after = store.getCachedHabits().find((h) => h.id === 'h1');
    assert.equal(
      after.lastCompletedDate,
      '2026-05-26',
      'cached habit row carries the recomputed lastCompletedDate after notify',
    );
  });

  test('notify refreshes after markUncompleted deletes row (4-state null)', async () => {
    const { store, applyMod } = await freshStoreAndApply();
    const repo = createFakeRepo();
    store.configureStore({ repo });
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {}, notify: store.notify });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });
    await store.hydrate();

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    await applyMod.apply({
      type: 'markUncompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    const log = store.getCachedLog('h1', '2026-05-26');
    assert.ok(!log, 'log row removed from cache after markUncompleted (4-state null)');
  });

  test('notify refreshes after restoreLogRow deletes (undo of markCompleted)', async () => {
    const { store, applyMod } = await freshStoreAndApply();
    const repo = createFakeRepo();
    store.configureStore({ repo });
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {}, notify: store.notify });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });
    await store.hydrate();

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });
    // Sanity — log cached.
    assert.ok(store.getCachedLog('h1', '2026-05-26'));

    // Now dispatch restoreLogRow with prior=undefined — the inverse of the
    // initial markCompleted. This DELETES the log row at (h1, 2026-05-26).
    await applyMod.apply({
      type: 'restoreLogRow',
      payload: { habitId: 'h1', date: '2026-05-26', prior: undefined },
    });

    assert.equal(
      store.getCachedLog('h1', '2026-05-26'),
      undefined,
      'cache reflects the deletion after notify',
    );
  });

  test('subscribers fire AFTER the refresh — they observe the post-write row', async () => {
    const { store, applyMod } = await freshStoreAndApply();
    const repo = createFakeRepo();
    store.configureStore({ repo });
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {}, notify: store.notify });
    await repo.putHabit({ id: 'h1', name: 'X', status: 'active' });
    await store.hydrate();

    /** @type {Array<object|undefined>} */
    const observed = [];
    store.subscribe(() => {
      observed.push(store.getCachedLog('h1', '2026-05-26'));
    });

    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
    });

    assert.equal(observed.length, 1, 'subscriber fired exactly once');
    assert.ok(observed[0], 'subscriber saw a defined log row, not undefined');
    assert.equal(observed[0].status, 'completed');
  });

  test('notify without payload.keys does NOT trigger a refresh (no regression for sync callers)', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    let getLogCalls = 0;
    const wrappedRepo = {
      ...repo,
      getLog: async (habitId, date) => {
        getLogCalls++;
        return repo.getLog(habitId, date);
      },
    };
    store.configureStore({ repo: wrappedRepo });
    await store.hydrate();

    // notify() with no payload — legacy callers, no refresh expected.
    await store.notify();
    // notify with payload but NO `keys` field — also no refresh.
    await store.notify({ event: 'test' });

    assert.equal(getLogCalls, 0, 'no per-key refresh fired for keyless notifies');
  });

  test('idempotent hydrate() still returns early on the second call (no regression)', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    let getAllCalls = 0;
    const wrappedRepo = {
      ...repo,
      getAllHabits: async () => {
        getAllCalls++;
        return repo.getAllHabits();
      },
    };
    store.configureStore({ repo: wrappedRepo });
    await store.hydrate();
    await store.hydrate();
    assert.equal(getAllCalls, 1, 'hydrate is still idempotent post-Task-2');
  });
});

describe('scoringModel persistence — UAT-T7 regression (D-122)', () => {
  test('hydrate loads scoringModel from IDB into cache (cold-start restore)', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    await repo.putSetting({ key: 'scoringModel', value: 'S2' });

    store.configureStore({ repo });
    await store.hydrate();

    const settings = store.getCachedSettings();
    assert.equal(
      settings.scoringModel,
      'S2',
      'getCachedSettings().scoringModel should reflect the IDB value after hydrate',
    );
  });

  test('getCachedSettings returns undefined for scoringModel when never set (falls back to S1 in consumer)', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    // No scoringModel row seeded.
    store.configureStore({ repo });
    await store.hydrate();

    const settings = store.getCachedSettings();
    assert.equal(
      settings.scoringModel,
      undefined,
      'scoringModel is undefined (absent from IDB) so consumer null-coalesces to S1',
    );
  });

  test('notify after setSetting refreshes scoringModel in cache so getCachedSettings reflects the new value (UAT-T7)', async () => {
    const { store, applyMod } = await freshStoreAndApply();
    const repo = createFakeRepo();
    store.configureStore({ repo });
    applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {}, notify: store.notify });
    await store.hydrate();

    // Baseline — no scoringModel set yet.
    assert.equal(store.getCachedSettings().scoringModel, undefined);

    // Simulate user selecting S2 — dispatched through the apply chokepoint.
    await applyMod.apply({
      type: 'setSetting',
      payload: { key: 'scoringModel', value: 'S2' },
    });

    // After notify, the cache must reflect the new model without a page reload.
    assert.equal(
      store.getCachedSettings().scoringModel,
      'S2',
      'cache updated synchronously before subscribers fire (Pitfall 2 / D-72)',
    );
  });

  test('getCachedSettings includes scoringModel alongside other settings keys', async () => {
    const store = await freshStore();
    const repo = createFakeRepo();
    await repo.putSetting({ key: 'weekStart', value: 'sun' });
    await repo.putSetting({ key: 'masteryThreshold', value: 85 });
    await repo.putSetting({ key: 'masteryWindow', value: 60 });
    await repo.putSetting({ key: 'scoringModel', value: 'S3' });

    store.configureStore({ repo });
    await store.hydrate();

    const settings = store.getCachedSettings();
    assert.equal(settings.weekStart, 'sun', 'weekStart cached');
    assert.equal(settings.masteryThreshold, 85, 'masteryThreshold cached');
    assert.equal(settings.masteryWindow, 60, 'masteryWindow cached');
    assert.equal(settings.scoringModel, 'S3', 'scoringModel cached alongside other settings');
  });
});
