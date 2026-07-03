# UAT Test 21 — Analytics Columns Empty — Work-in-Progress Handoff

**Date paused:** 2026-07-04
**Status:** Still broken after 2 fix attempts — paused for tomorrow

---

## What Test 21 Checks

Open `desktop.html` → Analytics panel → columns Rolling %, Mastery, S2 score should show per-habit values. Currently all show `—` (empty).

---

## Fix Attempts So Far

### Attempt 1 — commit `9fd5266`
**Theory:** `analytics.js` used `repo.runTx()` with a raw `IDBRequest` — `await IDBRequest` resolved to the request object, not `req.result`, so every lookup returned `undefined`.
**Fix:** Added `repo.getSnapshot(habitId, date)` using proper `promisify()` pattern.
**Result:** Still empty. The promisify fix was correct but the root problem was elsewhere.

### Attempt 2 — commit `2d38c94`
**Theory:** `getSnapshot(habitId, today)` did an exact key lookup. Snapshots are only written on log mutation, so a habit with no log today has no `[habitId, today]` row.
**Fix:** Added `repo.getLatestSnapshot(habitId)` using `IDBKeyRange.bound([habitId, '0000-01-01'], [habitId, '9999-12-31'])` on the compound key; returns last row (most recent date). Analytics now calls `getLatestSnapshot` instead of `getSnapshot`.
**Result:** Still empty. Something else is wrong.

---

## Next Hypotheses to Investigate

1. **Snapshots may not exist at all in IDB** — `scoreSnapshots.js` is only called via the `onLogWrite` DI seam in `apply.js`. If the user's existing data predates Phase 6 (or if `onLogWrite` was never wired in `desktop.js`), the `score_snapshots` store is empty. **Check:** Open DevTools → Application → IndexedDB → `score_snapshots` — is there anything in that store?

2. **`desktop.js` may not trigger `writeHabitSnapshots` correctly** — The `onLogWrite` seam is configured in `main.js` (mobile) and `desktop.js`. Confirm `desktop.js` actually calls `configureApply({ onLogWrite: writeHabitSnapshots })` on boot.

3. **`getLatestSnapshot` returns no results because the IDB range query is wrong** — `IDBKeyRange.bound` on a compound key `[habitId, date]` — verify the index used is the primary keyPath, not a secondary index. If the store has no index on `habitId` alone, the range scan may be scanning nothing.

4. **"Recompute Scores" button path** — Does clicking "Recompute Scores" in Settings populate `score_snapshots`? If yes → snapshots exist but aren't being fetched. If no → snapshots are never written.

---

## How to Resume Tomorrow

### Option A — Keep debugging manually

1. Open `desktop.html` in browser → DevTools → Application → IndexedDB → look at `score_snapshots` store
2. If empty: the write path is broken → investigate `desktop.js` `onLogWrite` wiring
3. If not empty: the read path is broken → inspect `getLatestSnapshot` query in DevTools console

### Option B — Spawn a new debug session (recommended)

```
/gsd-debug — Test 21 analytics columns still empty after 2 fix attempts (commits 9fd5266, 2d38c94). Check: (1) does score_snapshots IDB store actually contain rows? (2) is desktop.js onLogWrite seam wired? (3) is getLatestSnapshot IDBKeyRange.bound correct for compound key?
```

The debugger should start by verifying whether `score_snapshots` has rows at all before assuming the read path is the problem.

---

## Other UAT Items Still Open (deferred, not blockers)

These are non-critical — to be addressed in Phase 8 scope:
- Test 14 — Mastery visuals not showing (badges)
- Test 20 — Settings panel missing from desktop sidebar (only 3 nav items)
- Test 23 — Waveboard data not loading + row height issue
- Tests 10, 13 — UX friction (form placement, scroll on counter)
- Test 1 — Deprecated meta tag

---

## Remediation Plan Reference

`.planning/06-UAT-REMEDIATION.md` — original triage and execution order
