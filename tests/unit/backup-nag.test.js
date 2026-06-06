/**
 * @file Unit tests for js/io/backup-nag.js — backup nag calculation and
 * dismissal logic (EXPORT-08).
 *
 * Tests cover:
 *   - daysSinceLastBackup(): null when no lastBackupDate setting
 *   - daysSinceLastBackup(): 0 when lastBackupDate is today
 *   - daysSinceLastBackup(): N when lastBackupDate is N days ago
 *   - daysSinceLastBackup(): exactly 7 when 7 days ago
 *   - shouldShowNag(): false when days is null (never backed up)
 *   - shouldShowNag(): false when days < 7
 *   - shouldShowNag(): true when days >= 7 and not dismissed
 *   - shouldShowNag(): false when days >= 7 but dismissed <= 7 days ago
 *   - shouldShowNag(): true when dismissal was > 7 days ago (reappears)
 *   - dismissNag(): writes YYYY-MM-DD to localStorage under 'nag:lastDismissed'
 *   - dismissNag() followed by shouldShowNag() returns false
 *
 * Pattern: D-26 Tier 1 — pure function tests, no DOM, no real IDB.
 * Framework: node --test (D-23).
 * Date arithmetic uses Math.round (D-101) — same rule as daysBetween in date.js.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysSinceLastBackup,
  shouldShowNag,
  dismissNag,
  configureBackupNag,
} from '../../js/io/backup-nag.js';

// ---------------------------------------------------------------------------
// Fake localStorage
// ---------------------------------------------------------------------------

/**
 * Create an in-memory fake localStorage.
 * @returns {{ getItem: Function, setItem: Function, removeItem: Function, clear: Function }}
 */
function createFakeLocalStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
  };
}

// ---------------------------------------------------------------------------
// Fake repo
// ---------------------------------------------------------------------------

/**
 * Create a fake repo with controllable getSetting for 'lastBackupDate'.
 * @param {string|null} lastBackupDate YYYY-MM-DD or null
 * @returns {object}
 */
function createFakeRepo(lastBackupDate) {
  return {
    async getSetting(key) {
      if (key === 'lastBackupDate') {
        if (lastBackupDate === null) return undefined;
        return { key: 'lastBackupDate', value: lastBackupDate };
      }
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Date helpers for tests
// ---------------------------------------------------------------------------

/**
 * Format a Date as YYYY-MM-DD using local calendar (same as date.js formatLocalYMD).
 * @param {Date} d
 * @returns {string}
 */
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Return the YYYY-MM-DD date N days before today.
 * @param {number} n
 * @returns {string}
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

let fakeLS;

beforeEach(() => {
  fakeLS = createFakeLocalStorage();
});

afterEach(() => {
  // Reset any DI injected into the module
  configureBackupNag({ repo: null, localStorage: null, today: null });
});

// ---------------------------------------------------------------------------
// daysSinceLastBackup tests
// ---------------------------------------------------------------------------

describe('daysSinceLastBackup', () => {
  test('Test 1: returns null when no lastBackupDate setting exists', async () => {
    const repo = createFakeRepo(null);
    configureBackupNag({ repo, localStorage: fakeLS });
    const result = await daysSinceLastBackup();
    assert.strictEqual(result, null);
  });

  test('Test 2: returns 0 when lastBackupDate is today', async () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(todayStr);
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await daysSinceLastBackup();
    assert.strictEqual(result, 0);
  });

  test('Test 3: returns 5 when lastBackupDate is 5 days ago', async () => {
    const fiveDaysAgo = daysAgo(5);
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(fiveDaysAgo);
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await daysSinceLastBackup();
    assert.strictEqual(result, 5);
  });

  test('Test 4: returns 7 when lastBackupDate is exactly 7 days ago', async () => {
    const sevenDaysAgo = daysAgo(7);
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(sevenDaysAgo);
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await daysSinceLastBackup();
    assert.strictEqual(result, 7);
  });
});

// ---------------------------------------------------------------------------
// shouldShowNag tests
// ---------------------------------------------------------------------------

describe('shouldShowNag', () => {
  test('Test 5: returns false when daysSinceLastBackup is null (never exported)', async () => {
    const repo = createFakeRepo(null);
    configureBackupNag({ repo, localStorage: fakeLS });
    const result = await shouldShowNag();
    assert.strictEqual(result, false);
  });

  test('Test 6: returns false when daysSinceLastBackup < 7', async () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(daysAgo(6));
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await shouldShowNag();
    assert.strictEqual(result, false);
  });

  test('Test 7: returns true when daysSinceLastBackup >= 7 AND not dismissed', async () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(daysAgo(7));
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await shouldShowNag();
    assert.strictEqual(result, true);
  });

  test('Test 8: returns false when >= 7 days since backup BUT dismissed <= 7 days ago', async () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(daysAgo(10));
    // Dismissed 3 days ago — should NOT reappear yet
    fakeLS.setItem('nag:lastDismissed', daysAgo(3));
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await shouldShowNag();
    assert.strictEqual(result, false);
  });

  test('Test 9: returns true when dismissal was > 7 days ago (reappears)', async () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(daysAgo(14));
    // Dismissed 8 days ago — should reappear
    fakeLS.setItem('nag:lastDismissed', daysAgo(8));
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    const result = await shouldShowNag();
    assert.strictEqual(result, true);
  });
});

// ---------------------------------------------------------------------------
// dismissNag tests
// ---------------------------------------------------------------------------

describe('dismissNag', () => {
  test('Test 10: dismissNag writes YYYY-MM-DD to localStorage as nag:lastDismissed', () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(null);
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    dismissNag();
    const stored = fakeLS.getItem('nag:lastDismissed');
    assert.strictEqual(stored, todayStr);
  });

  test('Test 11: dismissNag followed by shouldShowNag returns false', async () => {
    const todayStr = daysAgo(0);
    const repo = createFakeRepo(daysAgo(10));
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr });
    // Nag would show without dismissal
    const before = await shouldShowNag();
    assert.strictEqual(before, true, 'nag should show before dismissal');
    // Dismiss it
    dismissNag();
    // Now it should NOT show
    const after = await shouldShowNag();
    assert.strictEqual(after, false, 'nag should not show after same-day dismissal');
  });
});
