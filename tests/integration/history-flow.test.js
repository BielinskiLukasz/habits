/**
 * @file End-to-end history navigation flow integration test (HISTORY-01..06).
 *
 * Tests the history flow using the fake repo + apply.js chokepoint:
 *   - Past-day log reads via getLogsForDate + getHabitVersionAtDate (NFR-10)
 *   - Version-aware history: logs interpret against the historical definition
 *   - Toggle-log mutations (markCompleted / markUncompleted on past days)
 *   - bulk-mark-uncompleted (HISTORY-04)
 *
 * These tests exercise the data layer (repo + apply) rather than the DOM mounter,
 * consistent with the D-25 integration-test pattern using fake-idb.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { configure as configureApply, apply } from '../../js/state/apply.js';

/** Reset apply DI before each test to avoid bleed. */
let repo;
beforeEach(() => {
  repo = createFakeRepo();
  configureApply({
    repo,
    broadcast: () => {},
    trackTx: () => {},
    notify: async () => {},
  });
});

describe('History flow — version-aware log reading (NFR-10, HISTORY-06)', () => {
  it('getLogsForDate returns all logs for the given date across habitIds', async () => {
    // Seed two habits + logs on the same date
    await repo.putHabit({ id: 'h1', name: 'Walk', status: 'active', cadence: { type: 'daily' } });
    await repo.putHabit({ id: 'h2', name: 'Water', status: 'active', cadence: { type: 'daily' } });
    await repo.putLog({ habitId: 'h1', date: '2026-06-01', completed: true });
    await repo.putLog({ habitId: 'h2', date: '2026-06-01', completed: false });
    await repo.putLog({ habitId: 'h1', date: '2026-06-02', completed: true });

    const logs = await repo.getLogsForDate('2026-06-01');
    assert.equal(logs.length, 2, '2 logs on 2026-06-01');
    assert.ok(logs.some((l) => l.habitId === 'h1'), 'h1 log present');
    assert.ok(logs.some((l) => l.habitId === 'h2'), 'h2 log present');
    // Should NOT include h1 log from 2026-06-02
    assert.ok(logs.every((l) => l.date === '2026-06-01'), 'only 2026-06-01 logs');
  });

  it('getHabitVersionAtDate returns the version effective on the selected date', async () => {
    await repo.putHabit({ id: 'h1', name: 'Walk v2', status: 'active' });
    // Seed two versions: v1 effective 2026-01-01, v2 effective 2026-05-01
    await repo.putLog({ habitId: 'h1', date: '2026-06-01', completed: true });
    // Manually put habit_versions using runTx pattern
    await repo.runTx(['habit_versions'], 'readwrite', (tx) => {
      tx.objectStore('habit_versions').put({
        habitId: 'h1',
        effectiveFrom: '2026-01-01',
        name: 'Walk v1',
        cadence: { type: 'daily' },
        targetType: 'binary',
      });
      tx.objectStore('habit_versions').put({
        habitId: 'h1',
        effectiveFrom: '2026-05-01',
        name: 'Walk v2',
        cadence: { type: 'daily' },
        targetType: 'binary',
      });
    });

    // Selected date 2026-03-15 → should get v1 (effective 2026-01-01)
    const v1 = await repo.getHabitVersionAtDate('h1', '2026-03-15');
    assert.ok(v1, 'version found for 2026-03-15');
    assert.equal(v1.name, 'Walk v1', 'returns v1 for date before 2026-05-01');

    // Selected date 2026-06-01 → should get v2 (effective 2026-05-01)
    const v2 = await repo.getHabitVersionAtDate('h1', '2026-06-01');
    assert.ok(v2, 'version found for 2026-06-01');
    assert.equal(v2.name, 'Walk v2', 'returns v2 for date on/after 2026-05-01');
  });

  it('getHabitVersionAtDate returns undefined when no version exists for that habitId', async () => {
    const v = await repo.getHabitVersionAtDate('nonexistent-id', '2026-06-01');
    assert.equal(v, undefined, 'undefined for unknown habitId');
  });

  it('getHabitVersionAtDate returns undefined when date precedes all versions', async () => {
    await repo.runTx(['habit_versions'], 'readwrite', (tx) => {
      tx.objectStore('habit_versions').put({
        habitId: 'h1',
        effectiveFrom: '2026-05-01',
        name: 'Walk',
        cadence: { type: 'daily' },
      });
    });
    const v = await repo.getHabitVersionAtDate('h1', '2026-01-01');
    assert.equal(v, undefined, 'undefined when date precedes earliest version');
  });
});

describe('History flow — past-day log toggle (HISTORY-02, HISTORY-03)', () => {
  it('markCompleted on a past date creates a completed log for that date', async () => {
    await repo.putHabit({ id: 'h1', name: 'Walk', status: 'active', cadence: { type: 'daily' } });

    await apply({ type: 'markCompleted', payload: { habitId: 'h1', date: '2026-05-15' } });

    const log = await repo.getLog('h1', '2026-05-15');
    assert.ok(log, 'log row created');
    assert.equal(log.completed, true, 'completed:true on past date');
  });

  it('markUncompleted on a past completed log sets completed:false', async () => {
    await repo.putHabit({ id: 'h1', name: 'Walk', status: 'active', cadence: { type: 'daily' } });
    await repo.putLog({ habitId: 'h1', date: '2026-05-15', completed: true });

    await apply({ type: 'markUncompleted', payload: { habitId: 'h1', date: '2026-05-15' } });

    const log = await repo.getLog('h1', '2026-05-15');
    assert.ok(log, 'log row still exists');
    assert.equal(log.completed, false, 'completed:false after markUncompleted');
  });

  it('toggle on past date does not affect a different date log', async () => {
    await repo.putHabit({ id: 'h1', name: 'Walk', status: 'active', cadence: { type: 'daily' } });
    await repo.putLog({ habitId: 'h1', date: '2026-05-14', completed: true });
    await repo.putLog({ habitId: 'h1', date: '2026-05-15', completed: false });

    await apply({ type: 'markCompleted', payload: { habitId: 'h1', date: '2026-05-15' } });

    const log14 = await repo.getLog('h1', '2026-05-14');
    const log15 = await repo.getLog('h1', '2026-05-15');
    assert.equal(log14.completed, true, '2026-05-14 log unaffected');
    assert.equal(log15.completed, true, '2026-05-15 log updated');
  });
});

describe('History flow — bulk uncomplete (HISTORY-04)', () => {
  it('bulk-mark-uncompleted via sequential markUncompleted calls sets completed:false for all targeted habits', async () => {
    await repo.putHabit({ id: 'h1', name: 'Walk', status: 'active', cadence: { type: 'daily' } });
    await repo.putHabit({ id: 'h2', name: 'Water', status: 'active', cadence: { type: 'daily' } });
    // h1 has no log (not completed), h2 has no log (not completed)

    // Simulate bulk-mark-uncompleted: call markUncompleted for all applicable habits
    await apply({ type: 'markUncompleted', payload: { habitId: 'h1', date: '2026-05-20' } });
    await apply({ type: 'markUncompleted', payload: { habitId: 'h2', date: '2026-05-20' } });

    const log1 = await repo.getLog('h1', '2026-05-20');
    const log2 = await repo.getLog('h2', '2026-05-20');
    assert.ok(log1, 'h1 log created');
    assert.equal(log1.completed, false, 'h1 completed:false');
    assert.ok(log2, 'h2 log created');
    assert.equal(log2.completed, false, 'h2 completed:false');
  });

  it('bulk-mark-uncompleted skips habits already marked uncompleted (idempotent-ish)', async () => {
    await repo.putHabit({ id: 'h1', name: 'Walk', status: 'active', cadence: { type: 'daily' } });
    await repo.putLog({ habitId: 'h1', date: '2026-05-20', completed: false });

    // Re-applying markUncompleted should not throw
    await apply({ type: 'markUncompleted', payload: { habitId: 'h1', date: '2026-05-20' } });

    const log = await repo.getLog('h1', '2026-05-20');
    assert.equal(log.completed, false, 'still completed:false after idempotent markUncompleted');
  });
});

describe('History flow — numeric / slot logs on past days', () => {
  it('logNumeric on a past date stores count correctly', async () => {
    await repo.putHabit({ id: 'h1', name: 'Water', status: 'active', target: 7, targetType: 'numeric', cadence: { type: 'daily' } });

    await apply({ type: 'logNumeric', payload: { habitId: 'h1', date: '2026-05-10', count: 5 } });

    const log = await repo.getLog('h1', '2026-05-10');
    assert.ok(log, 'log row created');
    assert.equal(log.count, 5, 'count = 5');
    assert.equal(log.completed, undefined, 'no completed field on numeric log');
  });

  it('logSlot on a past date stores slots array correctly', async () => {
    await repo.putHabit({
      id: 'h1', name: 'Meals', status: 'active', target: 3, targetType: 'slot-checklist',
      slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }],
      cadence: { type: 'daily' },
    });

    const slots = [
      { name: 'Breakfast', checked: true },
      { name: 'Lunch', checked: false },
      { name: 'Dinner', checked: false },
    ];
    await apply({ type: 'logSlot', payload: { habitId: 'h1', date: '2026-05-10', slots } });

    const log = await repo.getLog('h1', '2026-05-10');
    assert.ok(log, 'log row created');
    assert.deepEqual(log.slots, slots, 'slots array stored correctly');
    assert.equal(log.completed, undefined, 'no completed field on slot log');
  });
});
