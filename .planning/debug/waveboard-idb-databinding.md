---
status: diagnosed
created: 2026-07-05
updated: 2026-07-05
slug: waveboard-idb-databinding
trigger: manual
goal: find_root_cause_only
---

# Debug Session: Waveboard IDB Query and Data-Binding

## Current Focus

hypothesis: repo.runTx() body in waveboard.js returns a raw IDBRequest (not a Promise),
            causing runTx to return the IDBRequest object instead of the snapshot array.
            for...of on the IDBRequest throws TypeError which is swallowed, leaving
            cachedCellData empty and all cells rendering as "na".
test: code trace confirmed — idb.js runTx does `const result = await body(tx)`;
      IDBRequest is not thenable so await resolves to the IDBRequest object itself
expecting: confirmed root cause
next_action: DONE — return ROOT CAUSE FOUND

## Symptoms

expected: Waveboard view shows 12-week heat-map cells colored by S1 status per habit per week
actual: All waveboard cells show as "na" (not applicable / grey); habit names appear but no color data
errors: No visible JS error (TypeError is swallowed by the outer try-catch in refresh())
reproduction: Open desktop.html, navigate to Wave Board tab
started: Always — feature never worked

## Evidence

- timestamp: 2026-07-05
  checked: js/views/desktop/waveboard.js refresh() function (lines 430-486)
  found: |
    Lines 445-454: repo.runTx() called with body that returns a raw IDBRequest:
      snapshotRows = await repo.runTx(
        ['score_snapshots'],
        'readonly',
        (tx) => tx.objectStore('score_snapshots').index('date').getAll(
          IDBKeyRange.bound(startDate, endDate)
        )
      );
    The body arrow function returns IDBRequest directly — NOT wrapped in promisify().
  implication: runTx will return the IDBRequest object, not the data array.

- timestamp: 2026-07-05
  checked: js/db/idb.js runTx() implementation (lines 103-108)
  found: |
    export async function runTx(db, stores, mode, body) {
      const tx = db.transaction(stores, mode);
      const result = await body(tx);   // IDBRequest is NOT thenable → resolves to IDBRequest
      await done(tx);
      return result;                   // returns the IDBRequest object, not data
    }
    IDBRequest does not implement .then(), so `await IDBRequest` resolves to the
    IDBRequest object itself immediately (JavaScript Promise.resolve behavior).
  implication: snapshotRows = IDBRequest object (not an array).

- timestamp: 2026-07-05
  checked: js/db/repo.js getSnapshot() JSDoc comment (lines 314-322)
  found: |
    "Used by the Analytics view (js/views/desktop/analytics.js) to read
    today's pre-computed scores per habit without going through runTx —
    runTx returns the raw body() return value, which for a bare IDBRequest
    (non-thenable) resolves to the request object rather than its result."
    The repo.js file EXPLICITLY documents this limitation of runTx().
  implication: This is a known pitfall. Analytics view was deliberately designed
    to avoid runTx() for this reason. Waveboard did not follow the same pattern.

- timestamp: 2026-07-05
  checked: js/views/desktop/analytics.js refresh() function (lines 432-466)
  found: |
    Analytics avoids runTx() entirely. For each habit it calls:
      const snap = await repo.getLatestSnapshot(habit.id);
    repo.getLatestSnapshot() uses indexedDB via the properly promisify()-wrapped
    getAll() helper in idb.js — returns a real array.
    Analytics shows data correctly because it uses the repo facade pattern (DATA-01).
  implication: Confirms the problem is specific to waveboard's use of runTx() with
    a body returning a raw IDBRequest.

- timestamp: 2026-07-05
  checked: waveboard.js line 460: for (const row of snapshotRows)
  found: |
    snapshotRows is set to the IDBRequest object. IDBRequest does not implement
    Symbol.iterator, so `for (const row of snapshotRows)` throws:
      TypeError: snapshotRows is not iterable
    This error is caught by the OUTER try-catch (line 481: catch (_e) {}) which
    is commented "Non-fatal — render with whatever we have."
    At this point cachedCellData has been reset to new Map() (line 459) but not
    populated, so the map is empty.
  implication: renderGrid() always runs but with empty cachedCellData → all
    cells → waveboard-cell--na.

- timestamp: 2026-07-05
  checked: js/db/repo.js for existing snapshot range query
  found: |
    repo.js has getLogsInRange(startYMD, endYMD) using indexGetAll() — the
    exact same pattern needed for score_snapshots by date range. However,
    no equivalent getSnapshotsInRange() exists. The only score_snapshots
    helpers are getSnapshot(habitId, date) and getLatestSnapshot(habitId).
  implication: Fix requires adding getSnapshotsInRange(startDate, endDate) to
    repo.js (matching getLogsInRange pattern) and updating waveboard.js to use it.

- timestamp: 2026-07-05
  checked: js/db/schema.js score_snapshots store definition
  found: |
    score_snapshots store: keyPath ['habitId', 'date']
    Indexes: 'date' (on field 'date'), 'habitId' (on field 'habitId')
    The 'date' index exists and supports IDBKeyRange.bound(startDate, endDate) queries.
  implication: The schema supports the range query waveboard needs.
    The bug is in the query path (not the schema).

## Eliminated

- hypothesis: score_snapshots store is empty (no data to show)
  evidence: |
    analytics.js shows data correctly using repo.getLatestSnapshot(). If snapshots
    were empty, analytics would also show no scores. The bug is in the waveboard
    query path, not data absence.
  timestamp: 2026-07-05

- hypothesis: The 'date' index on score_snapshots does not exist
  evidence: |
    schema.js line 72-73 explicitly creates the 'date' index on score_snapshots.
    The index exists in the schema.
  timestamp: 2026-07-05

- hypothesis: store.subscribe() is wired incorrectly
  evidence: |
    desktop.js passes { repo, store: { subscribe } } to mountWaveboard.
    store.subscribe is the real subscribe export from store.js — correct.
    The reactivity subscription works; the data fetch is the problem.
  timestamp: 2026-07-05

## Root Cause

**`repo.runTx()` in `waveboard.js` is called with a body that returns a raw `IDBRequest`
instead of a Promise.**

In `idb.js`, `runTx` does `const result = await body(tx)`. When `body(tx)` returns a
raw `IDBRequest` (which is not a thenable — no `.then()` method), JavaScript's `await`
resolves it synchronously to the `IDBRequest` object itself, not the data. The
transaction commits correctly but `result` is the `IDBRequest` object.

`snapshotRows` is therefore set to an `IDBRequest` object. The subsequent
`for (const row of snapshotRows)` throws `TypeError: snapshotRows is not iterable`
because `IDBRequest` does not implement the iterator protocol. This error is swallowed
by the outer `try-catch` in `refresh()`, `cachedCellData` remains empty, and
`renderGrid()` renders all cells as "na".

This pitfall is explicitly documented in `repo.js`'s `getSnapshot()` JSDoc: "runTx
returns the raw body() return value, which for a bare IDBRequest (non-thenable)
resolves to the request object rather than its result." The Analytics view avoids
this pitfall by using `repo.getLatestSnapshot()`. The Waveboard did not follow this
pattern.

## Resolution

root_cause: |
  waveboard.js refresh() calls repo.runTx(['score_snapshots'], 'readonly', body)
  where body returns a raw IDBRequest from .index('date').getAll(range).
  idb.js runTx does `await body(tx)` — IDBRequest is not thenable, so await
  resolves to the IDBRequest object itself. snapshotRows = IDBRequest.
  for...of throws TypeError (IDBRequest not iterable) → caught silently →
  cachedCellData stays empty → all cells render as waveboard-cell--na.
fix: |
  Add repo.getSnapshotsInRange(startDate, endDate) to js/db/repo.js following
  the getLogsInRange() pattern:
    export async function getSnapshotsInRange(startYMD, endYMD) {
      const db = await openDB();
      return indexGetAll(db, 'score_snapshots', 'date', IDBKeyRange.bound(startYMD, endYMD));
    }
  In waveboard.js refresh(), replace the repo.runTx(...) block with:
    snapshotRows = await repo.getSnapshotsInRange(startDate, endDate);
files_changed: [js/db/repo.js, js/views/desktop/waveboard.js]
