---
status: complete
phase: 02-storage-foundation-the-spine
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md]
started: 2026-05-27T09:26:36Z
updated: 2026-05-27T10:00:00Z
framing: standard
mvp_mode_in_roadmap: true
mvp_mode_applied: false
mvp_skip_reason: "Phase 2 is pure storage infrastructure (no UI flow); ROADMAP goal is not in User Story format. User chose standard infrastructure UAT framing."
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any local dev server. Delete the `habits` IndexedDB database from DevTools → Application → IndexedDB. Start fresh with `node scripts/serve.js` and open `http://localhost:8080/`. The page loads without console errors, the seed runs once, and DevTools → Application → IndexedDB → `habits` v1 shows 7 stores (habits, logs, events, habit_versions, history_edits, settings, score_snapshots, meta) with 8 habits + 8 events rows.
result: pass

### 2. Seed loads exactly once (SEED-01..05 + DATA-01)
expected: After cold start (test 1), reload the page (Ctrl+R). The seed must NOT duplicate: `habits` store still shows 8 rows (not 16), and `events` store still shows 8 rows (not 16). `meta.seedLoadedAt` is unchanged from first run.
result: pass
note: |
  User confirmed: habits=8, events=8 after reload (idempotent — DATA-01 + SEED-03 verified).
  Test expectation was wrong about meta key name. The actual idempotency gate is
  `meta.seededIds` + `meta.persistResult` (verified in `js/io/seed.js:108`),
  NOT `meta.seedLoadedAt`. PHASE-COMPLETION.md DATA-03 row carries the stale name.
  Logged as a minor docs gap (no code defect).

### 3. Persistence across full browser restart (DATA-01)
expected: |
  Open Diagnostics (long-press the app-title OR `?debug=1`). Mark one habit complete via the console — apply is an ES module export, not a global, so use a dynamic import:
    `(await import('./js/state/apply.js')).apply({type: 'markCompleted', payload: {habitId: '<id>', date: '2026-05-27'}});`
  Verify the new `logs` row appears in DevTools → IDB → `logs`. Close the browser completely (all windows). Reopen and navigate to the app. The `logs` row from before the restart is still present.
result: pass
note: |
  Initial attempt failed: user typed `apply({...})` literally — UAT instruction error,
  apply is not a console global. Corrected to dynamic-import form
  `(await import('./js/state/apply.js')).apply({type:'markCompleted', payload:{habitId, date}})`
  per 02-05-PLAN.md line 262. Re-run passed: log row survived full browser restart.

### 4. navigator.storage.persist() observable (DATA-03)
expected: After cold start (test 1) on a fresh profile, DevTools → Application → Storage → Storage shows the origin as "Persisted: yes" (or the Diagnostics panel `Persisted:` row shows `yes`/`no` depending on the browser prompt outcome). `meta.persistResult` row in IDB carries the outcome and is NOT re-written on subsequent reloads (Pitfall 11 gate).
result: pass
note: |
  User tested on Edge (Chromium-family). Results:
    - `await navigator.storage.persisted()` → false
    - `meta.persistResult` row value → false
    - Reload → still false, no new write
  All three are correct: persist() fired, outcome captured, Pitfall 11 gate works. False on Chromium is acceptable per Pitfall 3 (engagement-metrics default — non-fatal).
  Initial confusion: "Persisted: yes" label not visible in Edge DevTools → Application → Storage panel. The authoritative checks are the console call + the `meta.persistResult` row.

### 5. Cross-tab BroadcastChannel sync (DATA-07)
expected: Open the app in two tabs (Tab A and Tab B), both pointing at `http://localhost:8080/`. In Tab B's console: `(await import('./js/platform/sync.js')).onMessage(d => console.log('B got:', d));`. In Tab A, dispatch apply(markCompleted) via dynamic import. Tab B logs `{type:'mutation', event, keys, at, origin}` — keys only (no value bleed) — and Tab A's own broadcast is filtered by the `origin` token.
result: pass

### 6. visibilitychange → hidden flushes pending writes (DATA-08)
expected: With DevTools open, start a write (markCompleted), and immediately switch to another browser tab so the page becomes hidden. The write completes (lifecycle.js trackTx awaits the in-flight tx on `visibilitychange === 'hidden'`). After returning to the tab, the mutation is persisted in IDB. Static gate: `grep -rE "beforeunload" js/` returns zero matches.
result: pass
note: |
  User confirmed mutation persisted after backgrounding the tab.
  Grep verified: `beforeunload` appears in `js/platform/lifecycle.js` only inside
  JSDoc comments explaining why it's forbidden (D-08, Pitfall 8); no
  `addEventListener('beforeunload', ...)` anywhere in `js/`. Discipline test
  `tests/unit/apply.discipline.test.js` enforces the grep ban.
  (Side note: user typed the grep into the Edge console — it's a shell command,
  not browser JS. Re-ran from the orchestrator.)

### 7. Reset-data button (D-44)
expected: Open Diagnostics. Click "Reset data". A `confirm()` dialog appears with verbatim copy `Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.`. Clicking OK deletes the `habits` IDB, reloads the page, and re-seeds the 8 habits. Clicking Cancel is a no-op (no delete, no reload).
result: pass

### 8. Mutation chokepoint discipline (DATA-04)
expected: `grep -rE "repo\.(put|delete|append)" js/views/ js/router/` returns zero matches. Only `js/state/apply.js` and `js/state/apply/*.js` call repo write methods. The discipline test `tests/unit/apply.discipline.test.js` passes via `node --test`.
result: pass
note: |
  Orchestrator verified:
    - `grep` of `repo\.(put|delete|append)` over `js/views/` and full `js/` → 0 matches.
      (`js/router/` doesn't exist yet — fine for Phase 2.) Actual implementation uses
      `tx.objectStore(...).put(...)` inside apply.js, not `repo.put*`.
    - `node --test tests/unit/apply.discipline.test.js` → 4/4 pass:
      • views/io/undo never write via repo.js directly (T-02-14)
      • lifecycle.js zero `beforeunload` (T-02-13)
      • apply.js dispatches via HANDLERS (no god switch, Anti-Pattern 4)
      • only js/db/idb.js may call `indexedDB.open(` (T-02-AP1)

### 9. Local YYYY-MM-DD date keys (DATA-06)
expected: Inspect a log row in DevTools → IDB → `logs`. The `date` field is the local `YYYY-MM-DD` string (e.g. `2026-05-27`), NOT a `Date.toISOString()` value (no `T`, no `Z`). Static gate: `grep -rE "toISOString" js/` shows only diagnostic/audit usages, never in date-key write paths.
result: pass
note: |
  User confirmed: logs.date field reads as `2026-05-27` (no T, no Z).
  Static gate: `grep toISOString js/` shows 2 matches — both for `events.at`
  (point-in-time timestamps), not date keys. `js/state/apply.js:108` has the
  inline comment "events.at uses ISO timestamp — allowed by DATA-06 (only date
  KEYS like logs.date must use YYYY-MM-DD; events are timestamps, not dates)".

### 10. Full test suite green (regression gate)
expected: Run `node --test` from the project root. Result: 99/99 tests pass across phases 1 and 2 (no failures, no regressions). The discipline grep gate in `tests/unit/apply.discipline.test.js` passes.
result: pass
note: |
  `node --test` → 100/100 pass (49 suites, 14.65s, 0 fail, 0 skipped).
  PHASE-COMPLETION.md said 99/99 — the count grew by 1 after commit e09813b
  added the AP1 grep gate (`indexedDB.open` may only appear in `js/db/idb.js`).
  Not a regression; the +1 is the new discipline test.

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0
docs_drift: 1

## Gaps

## Docs Drift

<!-- Documentation-only mismatches surfaced during UAT. No code defect. -->
<!-- These do NOT block phase completion; they are tracked for a follow-up doc fix. -->
- file: ".planning/phases/02-storage-foundation-the-spine/PHASE-COMPLETION.md"
  row: "DATA-03 Verification column"
  drift: "Says 'runs once per fresh DB, gated via meta.seedLoadedAt' — actual gate is meta.seededIds + meta.persistResult per js/io/seed.js:108."
  severity: minor
  test: 2
  parallel_to: "REQUIREMENTS.md DATA-07 'nawyki' vs implementation 'habits' (already flagged in 02-06-SUMMARY.md as out-of-scope drift)."
