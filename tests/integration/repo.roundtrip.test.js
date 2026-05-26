// tests/integration/repo.roundtrip.test.js
// Source: 02-02-PLAN.md §Task 3 + 02-PATTERNS.md §`tests/integration/repo.roundtrip.test.js`
//
// In-memory contract test: every put/get round-trip the typed facade
// promises (DATA-01) holds against the fake-IDB (D-25). Per RESEARCH §Pitfall
// 9 we NEVER import `js/db/repo.js` here — Node has no `indexedDB`. The A7
// contract test (contract.fake-vs-real.test.js) separately asserts that the
// fake and real repo share an identical export-name surface.
//
// Specific behaviors covered:
//   - habit round-trip (id-keyed) + missing-id returns undefined
//   - log round-trip preserves the DATA-05 `definitionVersion` field, and
//     accepts the field's absence too (forward-compat)
//   - log compound-key idempotency: re-marking (habitId, date) overwrites
//   - event round-trip with UUID keypath (D-42)
//   - meta singleton-key shape (returns just the value, not the {key,value} row)
//   - settings singleton-key shape (returns the full {key, value} row)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

/** @returns {ReturnType<typeof createFakeRepo>} */
function makeRepo() {
  return createFakeRepo();
}

describe('repo: habit round-trip', () => {
  test('putHabit then getHabit returns the same value', async () => {
    const repo = makeRepo();
    const habit = { id: 'h1', wave: 1, status: 'active', name: 'Morning walk' };
    await repo.putHabit(habit);
    assert.deepEqual(await repo.getHabit('h1'), habit);
  });

  test('getHabit("nonexistent") returns undefined', async () => {
    const repo = makeRepo();
    assert.equal(await repo.getHabit('nonexistent'), undefined);
  });
});

describe('repo: log round-trip — definitionVersion field (DATA-05)', () => {
  test('canonical shape with definitionVersion: null round-trips', async () => {
    const repo = makeRepo();
    const log = {
      habitId: 'h1',
      date: '2026-05-26',
      completed: true,
      definitionVersion: null,
    };
    await repo.putLog(log);
    const round = await repo.getLog('h1', '2026-05-26');
    assert.deepEqual(round, log);
    assert.ok(
      Object.prototype.hasOwnProperty.call(round, 'definitionVersion'),
      'canonical log row must carry definitionVersion field (DATA-05)',
    );
    assert.equal(round.definitionVersion, null);
  });

  test('log row without definitionVersion is still accepted (forward-compat)', async () => {
    const repo = makeRepo();
    const log = { habitId: 'h2', date: '2026-05-26', completed: true };
    await repo.putLog(log);
    const round = await repo.getLog('h2', '2026-05-26');
    assert.deepEqual(round, log);
  });

  test('re-marking the same (habitId, date) overwrites the same row (compound key idempotency)', async () => {
    const repo = makeRepo();
    await repo.putLog({ habitId: 'h1', date: '2026-05-26', completed: false, definitionVersion: null });
    await repo.putLog({ habitId: 'h1', date: '2026-05-26', completed: true,  definitionVersion: null });
    const round = await repo.getLog('h1', '2026-05-26');
    assert.equal(round.completed, true);
    // sanity: only one row total for that key
    assert.equal(repo._stores.logs.size, 1);
  });
});

describe('repo: event round-trip — UUID key (D-42)', () => {
  test('putEvent then getEvent by UUID returns the same row', async () => {
    const repo = makeRepo();
    const evt = {
      id: 'evt-uuid-1',
      at: '2026-05-26T10:00:00.000Z',
      type: 'markCompleted',
      payload: { habitId: 'h1', date: '2026-05-26' },
      inverse: null,
    };
    await repo.putEvent(evt);
    assert.deepEqual(await repo.getEvent('evt-uuid-1'), evt);
  });
});

describe('repo: meta + settings — singleton-key shape', () => {
  test('putMeta then getMeta returns just the VALUE (not the {key,value} row)', async () => {
    const repo = makeRepo();
    await repo.putMeta('undoToken', 'evt-uuid-1');
    assert.equal(await repo.getMeta('undoToken'), 'evt-uuid-1');
  });

  test('putSetting then getSetting returns the FULL row (D-45 mastery defaults)', async () => {
    const repo = makeRepo();
    const s = { key: 'defaultThreshold', value: 0.9 };
    await repo.putSetting(s);
    assert.deepEqual(await repo.getSetting('defaultThreshold'), s);
  });
});
