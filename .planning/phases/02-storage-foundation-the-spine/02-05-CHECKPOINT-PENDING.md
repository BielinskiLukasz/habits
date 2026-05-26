---
plan: 02-05
status: smoke_fix_applied_reverify_needed
type: checkpoint
paused_at: "2026-05-26T13:50:00Z"
implementation_merged: e7c619ddad52b81c071dff9dd0ca16878e6a4dc0
smoke_round_1: "2026-05-26 — FAILED at item 1 (schema.js createIndex chain — real IDB rejected)"
smoke_fix_applied: "schema.js + tests/unit/schema.test.js — fluent chain broken into per-store assignments; mock made real-IDB-faithful"
---

# Plan 02-05 — Smoke Round 1 Failed, Fix Applied, Re-verify Needed

## Round 1 outcome (2026-05-26)

**Item 1 — Cold boot, real IDB persistence: FAILED.**

Console:
```
Uncaught TypeError: db.createObjectStore(...).createIndex(...).createIndex is not a function
    at 1 (schema.js:47:8)
    at req.onupgradeneeded (idb.js:55:22)
Uncaught (in promise) AbortError: Version change transaction was aborted in upgradeneeded event handler.
```

Items 2 + 3 surfaced the same root cause cascading (no IDB → `persisted()` returned false; cross-tab smoke crashed inside `markCompleted` because `getLog` couldn't open the DB). User stopped the checklist at item 3.

## Root cause

`IDBObjectStore.createIndex()` returns an `IDBIndex`, NOT the parent store, so the fluent chain
`db.createObjectStore(...).createIndex('wave', 'wave').createIndex('status', 'status')` always
throws against real IDB on the second `.createIndex` call. The `habits`, `logs`, `events`, and
`score_snapshots` stores were all written with this broken pattern.

The Node-side unit test (`tests/unit/schema.test.js`) used a mock whose `createIndex` returned
`fakeStore` — letting the chain pass tests cleanly. This is exactly the Pitfall 9 (fake/real
divergence) failure mode acknowledged in `tests/helpers/fake-idb.js`: "real-IDB durability is
verified manually via tests-browser.html (D-26)". The manual checklist is the only thing that
could have caught this; it did.

## Fix applied

- `js/db/schema.js` — broke the fluent chain in all four multi-index stores. Each store is now
  assigned to a `const` and `createIndex` is called on the store reference directly. Header
  comment notes the IDBIndex-vs-IDBObjectStore return-type pitfall.
- `tests/unit/schema.test.js` — `mockDb.createObjectStore(...).createIndex(...)` now returns an
  IDBIndex-shaped object (`name`, `keyPath`, `multiEntry`, `unique`) with **no** `createIndex`
  method. Mirrors real IDB so any future fluent-chain regression fails loudly in unit tests.
- `node --test` — **99/99 green** post-fix.

No schema-shape changes (same 7 stores, same indexes, same keypaths, DB_VERSION still `1`).
This is purely a call-sequence repair; no migration needed.

## Re-verify path

Re-run the 8-item smoke checklist below from item 1. If item 1 passes (7 stores, 8 habits, 8
events, persisted defaults all visible in DevTools → Application → IndexedDB), continue to
items 2–8. If item 1 fails again, capture the new console output and report back.

Plan 02-05 still cannot close until the full 8-item checklist is recorded ✓; only then can the
SUMMARY.md be written and CHECKPOINT-PENDING.md deleted.

## Status

## Status

Tasks 1–3 (implementation) complete and merged to main:

| Task | Commit | What it did |
| ---- | ------ | ----------- |
| 1 | `6735c79` | Wire Reset-data button in `js/views/diagnostics.js` (D-44) |
| 2 | `024876d` | Wire P2 spine boot into `js/main.js` + `js/desktop.js` (DATA-03/04/07/08) |
| 3 | `d088519` | Extend `sw.js` SHELL with P2 spine + `seed/habits.json` (Pitfall 8a) |

Automated checks **all pass** at HEAD `e7c619d`:
- `node --test` — **99 / 99 green** (no regressions)
- Reset-data grep gates — PASS (D-44 confirm copy verbatim, button no longer disabled)
- `main.js` + `desktop.js` boot wiring grep gates — PASS (no IIFE, top-level await, configure/boot order locked)
- `sw.js` SHELL extension grep gate — PASS (13 new entries, `./seed/habits.json` present)
- `beforeunload` grep over `js/**` (comment-stripped) — 0 violations
- `APP_VERSION` unchanged at `'0.1.0'` (plan 02-06 owns the bump)

**Pending:** Task 4 = manual browser smoke checklist (8 items). Task 5 = full-suite final + SUMMARY.md write.

## Manual Browser Smoke Checklist (Task 4)

Per `02-VALIDATION.md` §Manual Browser Smoke Checklist — cannot be automated.

### Setup

```
node --test          # confirm 99/99 still green
node scripts/serve.js
```

Open `http://localhost:8080/` in Chrome or Edge.

### Items (record ✓/✗ + notes)

**1. Cold boot, real IDB persistence:**
- First load → seed runs. DevTools → Application → IndexedDB → `habits` v1.
- Verify 7 stores exist: `habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`.
- Verify `habits` has 8 rows. `events` has 8 rows of `type: 'seed:createHabit'`. `meta.seededIds` has 8 UUIDs.
- Verify `settings.defaultThreshold = 0.9`, `settings.defaultWindowDays = 70`, `settings.schemaVersion = 1`.
- Close tab. Reopen. Verify rows persist (no duplicates).

**2. `navigator.storage.persist()` actually fires:**
- DevTools open BEFORE first load. Console: `await navigator.storage.persisted()` returns `true` (Firefox) OR `false` (Chrome may decline silently; both acceptable per Pitfall 3).
- Verify `meta.persistResult` exists in IDB after first load.
- Reload — `persist()` is NOT called again.

**3. Real BroadcastChannel between two tabs:**
- Open `http://localhost:8080/` in two tabs (A + B). In Tab B console:
  ```js
  (await import('./js/platform/sync.js')).onMessage(d => console.log('B got:', d));
  ```
- In Tab A console:
  ```js
  const seeded = (await (await fetch('./seed/habits.json')).json()).habits[0].id;
  (await import('./js/state/apply.js')).apply({type: 'markCompleted', payload: {habitId: seeded, date: '2026-05-26'}});
  ```
- Tab B logs `{type: 'mutation', event: 'markCompleted', keys: {habitId, date: '2026-05-26'}, at, origin}`. Tab A's own listener (if subscribed) MUST NOT fire (origin filter).

**4. Real `visibilitychange` flush:**
- In Tab A: `console.time` / `console.timeEnd` around an apply, then switch tab quickly, wait 5s, return. Verify the new log row is in IDB.
- Grep `js/platform/lifecycle.js` for `beforeunload` — must be 0 occurrences in code (JSDoc OK).

**5. Undo across reload:**
- Tab A: `apply(markCompleted ...)`. Verify log row exists.
- Reload. Inspect `meta.undoToken` — has a value.
- Console: `(await import('./js/state/undo.js')).undo()`.
- Verify the log row is reverted.

**6. Reset-data button:**
- Open `http://localhost:8080/?debug=1`. Click "Reset data".
- Confirm dialog reads VERBATIM:
  > `Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.`
- Click OK → page reloads → `habits` IDB deleted then re-seeded (8 rows again).
- Click "Reset data" again, then Cancel → IDB unchanged, no reload.

**7. Cross-shell:**
- Open `http://localhost:8080/desktop.html`. Verify diagnostics panel still works (`?debug=1`). Verify IDB shared with mobile shell.

**8. `file://` graceful:**
- Open `index.html` directly via `file://`. Page loads. SW does NOT register (silent). `bootSeed()` still runs. IDB works.
- `crypto.randomUUID()` works (or fallback per Pitfall 13).

## Resume Instructions (tomorrow)

1. Run the 8-item checklist above. Record ✓/✗ + notes.
2. Re-invoke `/gsd-execute-phase 2`.
3. The orchestrator's safe-resume gate will detect plan 02-05 has commits (`02-05`) on `main` but no `02-05-SUMMARY.md`. It will offer recovery options:
   - **close out manually** ← pick this. Write `02-05-SUMMARY.md` (template in `$HOME/.claude/get-shit-done/templates/summary.md`) recording the smoke checklist outcomes, then delete this CHECKPOINT-PENDING.md file.
   - Or if anything failed: report which item, the orchestrator will spawn a fix plan.
4. After SUMMARY.md is committed, the orchestrator advances to Wave 6 (plan 02-06: version bump + doc reversals).

## Why we stopped here

User requested pause — manual smoke checklist requires a real browser session (~10–15 min). Implementation commits are merged and tests green, so resume is just verification + SUMMARY.md.
