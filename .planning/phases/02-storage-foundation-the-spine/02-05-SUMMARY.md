---
phase: 02-storage-foundation-the-spine
plan: 05
subsystem: boot-wiring + reset-data + sw-shell + manual-smoke
tags: [boot, reset-data, sw-shell, broadcast, lifecycle, checkpoint, smoke, data-04, data-07, data-08, d-06, d-44, pitfall-8a]

# Dependency graph
requires:
  - phase: 02-storage-foundation-the-spine
    plan: 04
    provides: "js/io/seed.js bootSeed() + configureSeed DI seam + seed/habits.json + D-45 settings defaults"
  - phase: 02-storage-foundation-the-spine
    plan: 03
    provides: "js/state/apply.js configure DI + js/state/undo.js configureUndo + js/state/store.js hydrate + js/platform/sync.js bootSync/broadcast + js/platform/lifecycle.js bootLifecycle/trackTx"
  - phase: 01-pwa-shell-tooling-hygiene
    plan: 01
    provides: "js/views/diagnostics.js placeholder + js/platform/sw-register.js protocol guard"
provides:
  - "js/views/diagnostics.js — Reset-data button is functional (D-44): D-06-style confirm with verbatim copy → indexedDB.deleteDatabase('habits') → location.reload() on OK; no-op on Cancel."
  - "js/main.js — mobile shell boots the P2 spine in the locked order: configureApply → configureUndo → configureSeed → bootSync → bootLifecycle → await bootSeed → await hydrate. Each await is try/catched so a single failure does not block diagnostics from rendering."
  - "js/desktop.js — desktop shell uses the same boot sequence as main.js so IDB + cross-tab + lifecycle wiring is shared."
  - "sw.js — SHELL list extended with every P2 module + './seed/habits.json' (Pitfall 8a). First-run-offline now actually has the seed fixture to fetch."
  - "Manual browser smoke checklist (8 items) walked over two rounds. Round 1 caught the schema.js createIndex-chain bug at item 1; round 2 (post-fix) cleared items 1-7 and confirmed item 8 hits a Chromium browser-policy limitation."
affects: [02-06, all P3+ plans that depend on the boot spine being wired]

# Tech tracking
tech-stack:
  added:
    - "First-run real-browser execution path (boot → seed → persist → IDB ready). Phase 1 ended with no IDB at all; Phase 2 plan 05 is the first plan whose code observably writes to a user-visible IndexedDB."
  patterns:
    - "Top-level `await` in module entry points (N1 — Baseline since 2022, no IIFE wrapper needed). main.js and desktop.js both use it for bootSeed and hydrate."
    - "Try/catch around each P2 await in the boot sequence — diagnostics surface is the recovery affordance, never silenced by a single boot failure."
    - "sw.js SHELL extended additively — never remove an entry, mirroring D-39's schema additive-only discipline."

key-files:
  created:
    - ".planning/phases/02-storage-foundation-the-spine/02-05-CHECKPOINT-PENDING.md (since deleted post-smoke)"
  modified:
    - "js/views/diagnostics.js (Reset-data wired — D-44)"
    - "js/main.js (P2 spine boot)"
    - "js/desktop.js (P2 spine boot)"
    - "sw.js (SHELL list extended)"
    - "js/db/schema.js (smoke-round-1 fix — createIndex chain broken)"
    - "tests/unit/schema.test.js (mock made IDBIndex-faithful so the regression fails loudly)"

key-decisions:
  - "Schema.js createIndex chain — broken into per-store const + sequential createIndex calls. Caught by manual smoke (round 1, item 1) because the Node-side mock returned the store from createIndex, masking the real-IDB behavior (Pitfall 9 — fake/real divergence, documented in fake-idb.js header). The mock has been hardened to return an IDBIndex-shaped object with no createIndex method; any future fluent-chain regression now fails loudly in unit tests. No schema-shape changes — same 7 stores, same indexes, DB_VERSION still 1."
  - "Item 8 (file:// graceful) is Firefox-only by browser policy. Chromium-family browsers (Chrome / Edge / Brave) refuse to load ES module scripts from a file:// origin — 'file:' URLs are treated as unique security origins. This is a fixed browser-policy block, not a fix-it-in-our-code defect; CLAUDE.md's stack section already states 'works on file:// in Firefox and Safari, fully on HTTP(S) everywhere'. Recorded as a deferred 'maybe later' item in STATE.md — investigation into a build-free workaround (e.g. an optional single-file inline bundle) can happen in a future release if the constraint becomes painful."
  - "Item 5 (undo across reload) demonstrated the correct path even though the user typed the checklist shorthand `apply(markCompleted ...)` literally and got a SyntaxError. After reload, meta.undoToken was present and undo() reverted the most recent log row — verifying the undo-across-reload contract end-to-end. The checklist now carries the explicit JS expression (same form as item 3) so future smokes don't trip on the shorthand."

patterns-established:
  - "Boot-time DI configure order: configure*({deps}) → bootSync → bootLifecycle → await bootSeed → await hydrate. Configure seams first (no platform calls inside configure), then attach listeners (idempotent), then the first write (seed-tx), then the hydrate cache pre-warm. This ordering is the contract every future shell entry point must follow."
  - "Real-IDB smoke is the only place fake/real divergence (Pitfall 9) is observable in this codebase. Future fake-IDB additions MUST mirror real-IDB return types — not just method names — and the schema.test.js mock is the reference shape."

requirements-completed: [DATA-04, DATA-07, DATA-08]

# Metrics
duration: ~2h (incl. round-1 smoke + schema fix + round-2 smoke)
completed: 2026-05-27
---

# Phase 2 Plan 05: Boot Wiring + Reset-Data + sw.js SHELL + Manual Smoke Summary

**The P2 spine is now wired into both shells (`js/main.js` + `js/desktop.js`) in the locked configure → boot → await-seed → await-hydrate order; the Reset-data button in diagnostics is functional with verbatim D-06 copy; `sw.js` SHELL covers every P2 JS file + `./seed/habits.json`; the 8-item manual browser smoke checklist was walked over two rounds, caught a real-IDB schema bug at item 1 in round 1, and cleared items 1-7 in round 2 with item 8 recorded as a Chromium browser-policy limitation.**

## Performance

- **Duration:** ~2h (implementation tasks 1-3 = ~30m; round-1 smoke + schema-fix + round-2 smoke = ~90m spread across two sessions)
- **Tasks:** 5 (3 implementation, 1 manual-smoke checkpoint walked twice, 1 SUMMARY)
- **Files created:** 0 production / 1 ephemeral (CHECKPOINT-PENDING.md, deleted post-close)
- **Files modified:** 6 (4 production for the original wave + 2 production for the smoke-round-1 fix)

## Accomplishments

### Production wiring (commits `6735c79`, `024876d`, `d088519`, merged `e7c619d`)

- **`js/views/diagnostics.js`** — Reset-data button:
  - Click handler shows `confirm()` with verbatim D-06 copy: `Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.`
  - On OK: `indexedDB.deleteDatabase('habits')` → `location.reload()`.
  - On Cancel: no-op (no IDB delete, no reload).
- **`js/main.js`** — mobile shell boot sequence (8 calls, locked order):
  1. `registerServiceWorker()` — silent-fail on file:// (sw-register protocol guard).
  2. `mountDiagnostics()` if `?debug=1`.
  3. `attachLongPress` on the app-title (long-press → mountDiagnostics).
  4. `configureApply({ repo, broadcast, trackTx })`.
  5. `configureUndo({ repo })`.
  6. `configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch })`.
  7. `bootSync()` — BroadcastChannel('habits') open.
  8. `bootLifecycle()` — visibilitychange + pagehide attached.
  9. `await bootSeed()` — first write, wrapped in try/catch.
  10. `await hydrate()` — cache pre-warm, wrapped in try/catch.
- **`js/desktop.js`** — desktop shell uses the same boot sequence so the desktop entry point shares IDB + cross-tab + lifecycle wiring.
- **`sw.js`** — SHELL list extended with every P2 module + `./seed/habits.json`. First-run-offline now has the seed fixture available from cache.

### Smoke round 1 (2026-05-26) — caught a real-IDB schema bug

| Item | Result | Notes |
|------|--------|-------|
| 1 | ✗ FAIL | `Uncaught TypeError: db.createObjectStore(...).createIndex(...).createIndex is not a function at schema.js:47:8` — fluent chain rejected by real IDB. |
| 2 | ✗ FAIL | Cascade — `await navigator.storage.persisted()` returned false because the IDB never opened, so persist() never fired. |
| 3 | ✗ FAIL | Cascade — markCompleted couldn't open the DB; cross-tab test never ran. |
| 4-8 | — | User correctly stopped the checklist at item 3 to triage the root cause. |

### Smoke fix (commit `389b9d9`)

`IDBObjectStore.createIndex()` returns an `IDBIndex`, NOT the parent store, so the fluent `.createIndex(...).createIndex(...)` chain throws against real IDB on the second call. Fix:

- `js/db/schema.js` — fluent chain replaced with per-store assignment. Each multi-index store (`habits`, `logs`, `events`, `score_snapshots`) is now assigned to a `const` and `createIndex` is called on the store reference directly. Header comment explains the IDBIndex-vs-IDBObjectStore return-type pitfall and references the round-1 smoke failure.
- `tests/unit/schema.test.js` — `mockDb.createObjectStore(...).createIndex(...)` now returns an `IDBIndex`-shaped object (`name`, `keyPath`, `multiEntry`, `unique`) with **no** `createIndex` method. Mirrors real IDB so any future fluent-chain regression fails loudly in unit tests.
- `node --test` — **99/99 green** post-fix.

This is exactly the Pitfall 9 (fake/real divergence) failure mode acknowledged in `tests/helpers/fake-idb.js`: "real-IDB durability is verified manually via tests-browser.html (D-26)". The manual checklist is the only thing that could have caught it; it did.

### Smoke round 2 (2026-05-27) — items 1-8 closed

| Item | Result | Notes |
|------|--------|-------|
| 1 | ✓ PASS | 7 stores + 8 habits + 8 events visible in DevTools → Application → IndexedDB → habits v1. |
| 2 | ✓ PASS | `navigator.storage.persist()` outcome recorded in `meta.persistResult`; not re-called on reload (Pitfall 11 gate). |
| 3 | ✓ PASS | BroadcastChannel cross-tab payload `{type, event, keys, at, origin}` — keys only (no value leak), Tab A's own listener filtered by `origin` (T-02-15). |
| 4 | ✓ PASS | `visibilitychange === 'hidden'` flushed the in-flight tx; `beforeunload` grep over `js/platform/lifecycle.js` returns 0 matches. |
| 5 | ✓ PASS | undo across reload — `meta.undoToken` persists; `undo()` after reload reverts the most recent log row. (Note: checklist shorthand `apply(markCompleted ...)` was originally typed literally and threw SyntaxError; the surviving step-4 log row served as the undo target, demonstrating the undo-across-reload contract end-to-end. Checklist updated with the explicit JS expression.) |
| 6 | ✓ PASS | Reset-data button — confirm copy verbatim, OK deletes IDB + reloads + re-seeds 8 rows, Cancel is a no-op. |
| 7 | ✓ PASS | `desktop.html` boots the same spine; diagnostics panel works via `?debug=1`; IDB shared with mobile shell. |
| 8 | ⚠ PASS-with-caveat | Chromium-family browsers (Chrome / Edge / Brave) refuse to load ES module scripts from `file://` — fixed browser policy: `'file:' URLs are treated as unique security origins`. Firefox + Safari load file:// correctly per CLAUDE.md's stack section. Recorded as a deferred 'maybe later' item in STATE.md. |

## Why the smoke caught what tests didn't

The unit-test mock in `tests/unit/schema.test.js` originally returned the parent store from `createIndex` to make the fluent chain self-document. That convenience masked the real-IDB contract: `createIndex` returns an `IDBIndex`, not the store. The fake-IDB in `tests/helpers/fake-idb.js` doesn't model the schema-creation path at all — it just sets up Maps in memory — so even integration tests couldn't have caught this.

This is the canonical Pitfall 9 (fake/real divergence) acknowledged in D-26: real-IDB durability is verified manually via tests-browser.html OR the manual smoke checklist. Phase 2 plan 05 is the first plan whose code observably writes to a user-visible IDB, so it's the first plan that could be tested against a real browser — and on the first smoke run, the bug surfaced exactly as predicted by the architecture's risk model.

Hardening: the mock now mirrors the real-IDB return type. Future fluent-chain regressions fail loudly in unit tests. The contract test (`tests/integration/contract.fake-vs-real.test.js`) does NOT cover schema creation (only mutation surface), and that's correct — fake-IDB intentionally doesn't model schema, so the unit test's mock is now the canonical schema-shape contract.

## Deviations from PLAN.md

- **+1 fix commit** beyond the planned 3 implementation commits. Commit `389b9d9` (`fix(02-05): break schema.js createIndex chain`) wasn't in the original plan; it was triggered by smoke round 1 catching the schema bug. The plan's `must_haves.truths[3]` says "a real browser opens index.html, sees the seed run, and shows the 8 habits ... in DevTools" — this MUST-HAVE wasn't satisfiable until the schema fix landed.
- **Item 8 changed from PASS-or-FAIL to PASS-with-caveat.** The original checklist over-promised: it said "Open index.html directly via file://. Page loads. SW does NOT register (silent). bootSeed() still runs. IDB works." with no browser caveat. The reality is browser-policy-bifurcated: Firefox + Safari work, Chromium refuses. The checklist now records this honestly and STATE.md carries the deferred-item entry.

## Open follow-ups

- **STATE.md deferred item:** "Chromium file:// + ES modules — investigate build-free workaround." Pure documentation today; revisit if the Chromium constraint becomes painful in practice (it currently doesn't — `node scripts/serve.js` or GitHub Pages cover every real distribution path).
- **None blocking plan 02-06.** The APP_VERSION bump + doc reversals plan can proceed.

## Files touched (full list)

| File | What changed |
|------|--------------|
| `js/views/diagnostics.js` | Reset-data button wired (D-44) |
| `js/main.js` | P2 spine boot wired (configure → boot → await bootSeed → await hydrate) |
| `js/desktop.js` | Same boot sequence as main.js (shared spine) |
| `sw.js` | SHELL list extended with P2 modules + `./seed/habits.json` (Pitfall 8a) |
| `js/db/schema.js` | createIndex fluent chain broken into per-store assignments (smoke-round-1 fix) |
| `tests/unit/schema.test.js` | Mock made IDBIndex-faithful (real-IDB-shaped, no `.createIndex` on the returned object) |
| `.planning/phases/02-storage-foundation-the-spine/02-05-CHECKPOINT-PENDING.md` | Ephemeral checkpoint — round-1 outcome + fix record + re-verify path; deleted on close |
| `.planning/STATE.md` | Round-1 status → round-2 status → close-out; deferred-items table populated with the Chromium file:// limitation |

## Test suite

`node --test`: **99/99 green** at close-out (commit `389b9d9`). No regressions across phases 1 + 2. The browser smoke is the only thing this commit history cannot fully self-verify; both smoke rounds are recorded here with date stamps.
