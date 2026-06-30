/**
 * @file Unit tests for js/domain/scheduled.js (SCHED-03, DATA-03, D-05, D-06, D-07, D-10).
 *
 * Tests the configureScheduled / bootScheduled DI contract, the one-time
 * DATA-03 migration pass (runMigration), and the every-boot SCHED-03 auto-
 * promotion pass (runPromotion).
 *
 * Module-level state in scheduled.js leaks across tests. Use a dynamic re-
 * import per test to start clean (Node caches by URL — append a query to
 * bust the module cache).
 *
 * Pattern S8 (D-26 Tier 1) — pure-function fixture tests in Node, no DOM.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

// ---------------------------------------------------------------------------
// Cache-bust helper — returns a fresh module instance each call.
// ---------------------------------------------------------------------------

/** @returns {Promise<{configureScheduled: Function, bootScheduled: Function}>} */
async function freshScheduled() {
  const url = new URL('../../js/domain/scheduled.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

// ---------------------------------------------------------------------------
// DI contract — configureScheduled + bootScheduled
// ---------------------------------------------------------------------------

describe('bootScheduled: DI contract', () => {
  test('throws descriptive error when bootScheduled called without configureScheduled', async () => {
    const { bootScheduled } = await freshScheduled();
    await assert.rejects(
      bootScheduled(),
      /scheduled: configureScheduled\(\{repo\}\) not called/,
    );
  });

  test('resolves without error after configureScheduled({repo}) with a fakeRepo', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    configureScheduled({ repo });
    await assert.doesNotReject(bootScheduled());
  });
});

// ---------------------------------------------------------------------------
// runMigration — one-time DATA-03 reclassification
// ---------------------------------------------------------------------------

describe('runMigration: reclassifies active habits with future startDate', () => {
  test('habit with status:active and startDate > today is reclassified to scheduled', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    await repo.putHabit({ id: 'h1', status: 'active', startDate: '2099-01-01' });
    configureScheduled({ repo });
    await bootScheduled();
    const h1 = await repo.getHabit('h1');
    assert.equal(h1.status, 'scheduled');
  });

  test('habit with status:active and startDate in the past remains active', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    await repo.putHabit({ id: 'h2', status: 'active', startDate: '2025-01-01' });
    configureScheduled({ repo });
    await bootScheduled();
    const h2 = await repo.getHabit('h2');
    assert.equal(h2.status, 'active');
  });

  test('meta key scheduledMigrationV1 is set to true after bootScheduled', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    configureScheduled({ repo });
    await bootScheduled();
    const metaVal = await repo.getMeta('scheduledMigrationV1');
    assert.equal(metaVal, true);
  });

  test('second call to bootScheduled is a no-op (meta guard prevents re-run)', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    // h1 starts as scheduled (migration already ran once conceptually).
    await repo.putHabit({ id: 'h1', status: 'active', startDate: '2099-01-01' });
    configureScheduled({ repo });
    // First boot: h1 → scheduled.
    await bootScheduled();
    const afterFirst = await repo.getHabit('h1');
    assert.equal(afterFirst.status, 'scheduled');
    // Second boot: migration guard should fire; h1 stays scheduled (no reset).
    await bootScheduled();
    const afterSecond = await repo.getHabit('h1');
    assert.equal(afterSecond.status, 'scheduled', 'h1 must remain scheduled on second call');
  });
});

// ---------------------------------------------------------------------------
// runPromotion — every-boot SCHED-03 auto-transition
// ---------------------------------------------------------------------------

describe('runPromotion: promotes scheduled habits whose startDate has passed', () => {
  test('habit with status:scheduled and startDate = today is promoted to active', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await repo.putHabit({ id: 'h3', status: 'scheduled', startDate: todayStr });
    configureScheduled({ repo });
    await bootScheduled();
    const h3 = await repo.getHabit('h3');
    assert.equal(h3.status, 'active');
  });

  test('habit with status:scheduled and startDate in the past is promoted to active', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    await repo.putHabit({ id: 'h3b', status: 'scheduled', startDate: '2025-06-01' });
    configureScheduled({ repo });
    await bootScheduled();
    const h3b = await repo.getHabit('h3b');
    assert.equal(h3b.status, 'active');
  });

  test('habit with status:scheduled and future startDate remains scheduled', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    await repo.putHabit({ id: 'h4', status: 'scheduled', startDate: '2099-12-31' });
    configureScheduled({ repo });
    await bootScheduled();
    const h4 = await repo.getHabit('h4');
    assert.equal(h4.status, 'scheduled');
  });
});

// ---------------------------------------------------------------------------
// Migration + promotion ordering
// ---------------------------------------------------------------------------

describe('runMigration then runPromotion ordering', () => {
  test('habit active+startDate=today stays active: migration skips it, promotion has nothing to promote for it', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // startDate = today means startDate is NOT > today → migration does not reclassify.
    await repo.putHabit({ id: 'h5', status: 'active', startDate: todayStr });
    configureScheduled({ repo });
    await bootScheduled();
    const h5 = await repo.getHabit('h5');
    assert.equal(h5.status, 'active');
  });

  test('habit active+future startDate is reclassified by migration then NOT promoted (future date)', async () => {
    const { configureScheduled, bootScheduled } = await freshScheduled();
    const repo = createFakeRepo();
    // startDate far in future: migration reclassifies to scheduled; promotion leaves it.
    await repo.putHabit({ id: 'h6', status: 'active', startDate: '2099-01-01' });
    configureScheduled({ repo });
    await bootScheduled();
    const h6 = await repo.getHabit('h6');
    assert.equal(h6.status, 'scheduled');
  });
});
