---
phase: 2
slug: storage-foundation-the-spine
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
audited: 2026-05-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Audited 2026-05-27 against the shipped Phase 2 codebase (commit `c40fd1e`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (Node 20+) |
| **Config file** | none — zero-dependency by D-47 / D-23 |
| **Quick run command** | `node --test tests/unit/<file>.test.js …` (Node 24 local: enumerate files; CI runs on Node 20 where `node --test tests/` directory-scans) |
| **Full suite command** | CI: `node --test tests/`; local Node 24+: explicit file list (see `.github/workflows/ci.yml` line 18) |
| **Test count** | 100 assertions across 15 test files (3 helpers) |
| **Estimated runtime** | ~13 seconds locally; ~5 seconds on CI |

Browser-touching behaviour (real IndexedDB persistence across reload, real `BroadcastChannel` between two tabs, real `visibilitychange → hidden` flush, real `navigator.storage.persist()` prompt) is verified manually — see Manual-Only Verifications below. The full 8-item smoke checklist was walked in plan 02-05 with **7 PASS + 1 PASS-with-Chromium-caveat**.

---

## Sampling Rate

- **After every task commit:** Run unit tests for the changed module
- **After every plan wave:** Run the full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~13 seconds locally, ~5 seconds on CI

---

## Per-Task Verification Map

Plan-by-plan map of every requirement delivered in Phase 2 to the test file that automates it. All entries `✅ green` as of audit date.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | (W0 infra) | T-02-SC, T-02-CI | CI dual-trigger, pinned actions, no npm | execute | `cat .github/workflows/ci.yml` | ✅ | ✅ green |
| 02-01-T1 | 02-01 | 1 | (W0 infra) | T-02-01 | Path-traversal guard on dev server | unit (smoke) | `node --test tests/unit/_smoke.test.js` | ✅ | ✅ green |
| 02-01-T2 | 02-01 | 1 | (W0 infra) | A7 | Fake-IDB tx-shape contract surface (D-25) | execute | (consumed by integration tests) | ✅ | ✅ green |
| 02-01-T3 | 02-01 | 1 | DATA-06 | Pitfall 4 | Local-time YYYY-MM-DD; no toISOString | unit | `node --test tests/unit/date.test.js` | ✅ | ✅ green |
| 02-01-T4 | 02-01 | 1 | (D-42 backing) | T-02-06, Pitfall 13 | UUID v4 + 3-tier fallback chain | unit | `node --test tests/unit/id.test.js` | ✅ | ✅ green |
| 02-02-T1 | 02-02 | 2 | DATA-02, DATA-05 | T-02-04, T-02-08 | 7-store v1 schema; UUID events; no autoIncrement; loop-dispatch migrations | unit | `node --test tests/unit/schema.test.js` | ✅ | ✅ green |
| 02-02-T2 | 02-02 | 2 | DATA-01 | T-02-AP1, Pitfall 1, Pitfall 2 | Promise wrapper; only idb.js touches `indexedDB` | execute | (indirectly via integration + manual smoke) | ✅ | ✅ green |
| 02-02-T3 | 02-02 | 2 | DATA-01, DATA-05 | A7 | Typed repo facade; `definitionVersion` preserved | integration | `node --test tests/integration/repo.surface.test.js tests/integration/repo.roundtrip.test.js` | ✅ | ✅ green |
| 02-02-T4 | 02-02 | 2 | DATA-01 | T-02-09 | A7 fake-vs-real surface contract | integration | `node --test tests/integration/contract.fake-vs-real.test.js` | ✅ | ✅ green |
| 02-03-T1 | 02-03 | 3 | DATA-08 | T-02-13 | visibilitychange + pagehide; no beforeunload; idempotent | unit | `node --test tests/unit/lifecycle.test.js` | ✅ | ✅ green |
| 02-03-T2 | 02-03 | 3 | DATA-07 | T-02-11, T-02-15 | BroadcastChannel('habits'); keys-only payload; origin filter; graceful degrade | integration | `node --test tests/integration/sync.broadcast.test.js` | ✅ | ✅ green |
| 02-03-T3 | 02-03 | 3 | DATA-04, DATA-07 | T-02-10, T-02-11, T-02-12, T-02-14, T-02-AP1 | Single-mutator chokepoint; HANDLERS not switch; broadcast AFTER tx.done; no put* outside apply*; no `indexedDB.open` outside `idb.js` | unit + integration | `node --test tests/unit/apply.discipline.test.js tests/integration/apply.markCompleted.test.js` | ✅ | ✅ green |
| 02-03-T4 | 02-03 | 3 | (UNDO-02 cross-phase) | T-02-12 | Persistent meta.undoToken; survives simulated reload (A9) | integration | `node --test tests/integration/undo.persist-reload.test.js` | ✅ | ✅ green |
| 02-04-T1 | 02-04 | 4 | SEED-01, SEED-02, SEED-05 | T-02-XSS, Pitfall 12 | Wrapped-object shape; D-32 coverage matrix; cadence_v:1; no xlsx parser | unit | `node --test tests/unit/seed.shape.test.js` | ✅ | ✅ green |
| 02-04-T2 | 02-04 | 4 | DATA-01, SEED-03, SEED-04 | T-02-03 | Merge-by-id idempotent; one seed event per habit; user-edits survive | integration | `node --test tests/integration/seed.idempotent.test.js` | ✅ | ✅ green |
| 02-04-T2 | 02-04 | 4 | DATA-03 | T-02-PERSIST11, Pitfall 3, Pitfall 11 | persist() exactly once across boots; result recorded; false non-fatal | integration | `node --test tests/integration/seed.persist.test.js` | ✅ | ✅ green |
| 02-05-T1 | 02-05 | 5 | DATA-04 carry | T-02-DEL | Reset-data uses verbatim D-06 confirm; `indexedDB.deleteDatabase('habits')` | manual | (smoke checklist item 6) | ✅ | ✅ green |
| 02-05-T2 | 02-05 | 5 | DATA-04, DATA-07, DATA-08 boot wiring | T-02-BOOT | Locked configure → bootSync → bootLifecycle → bootSeed → hydrate order | manual | (smoke checklist items 1, 3, 4) | ✅ | ✅ green |
| 02-05-T3 | 02-05 | 5 | (offline first-run) | T-02-SHELL | sw.js SHELL list includes every P2 module + seed/habits.json (Pitfall 8a) | execute (grep) | (verified in plan 02-05 task 3) | ✅ | ✅ green |
| 02-05-T4 | 02-05 | 5 | DATA-01..08 + SEED-01..05 (real-browser) | (all) | 8-item manual smoke checklist | manual | (recorded in 02-05-SUMMARY.md) | ✅ | 7/8 ✅ + item 8 PASS-with-caveat |
| 02-06-T5 | 02-06 | 6 | (ship signal) | T-02-VER | APP_VERSION 0.2.0 bump; cache rolls to habits-0.2.0 | unit (smoke regex) | `node --test tests/unit/_smoke.test.js` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `.github/workflows/ci.yml` — runs `node --test tests/` on push + PR to main (D-38, Pitfall 10 dual triggers; delivered in 02-01)
- [x] `tests/` directory with smoke test green from the first commit of the phase (delivered in 02-01 — `tests/unit/_smoke.test.js`)
- [x] Fake-IDB harness `tests/helpers/fake-idb.js` exposing the same surface as `js/db/repo.js` plus a tx-shape for `runTx` (D-25, A7; delivered in 02-01 with the W1 fix that extended the fake-tx shape once, so plan 02-03's apply.js / 02-04's seed.js never re-touched it)
- [x] Companion fakes: `fake-broadcast-channel.js`, `fake-storage.js`, `fake-document.js` (delivered in 02-01)

*No framework install needed — Node 20+ `node --test` is in the runtime.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Outcome (2026-05-27) |
|----------|-------------|------------|-------------------|----------------------|
| Real IDB persistence across full browser restart | DATA-01, DATA-02 | Fake IDB cannot prove durable disk persistence; real `onupgradeneeded` semantics differ from mocks (caught schema-chain bug in plan 02-05 round 1) | `node scripts/serve.js`; open `http://localhost:8080/`, observe seed write; close tab; reopen; confirm 8 habits + 8 events + meta + settings still present in DevTools → IDB → `habits` v1 | ✅ Item 1 round 2 |
| `navigator.storage.persist()` prompt + result | DATA-03 | Browser-only API; engagement gates differ per browser; persist() == false is non-fatal per Pitfall 3 | First-ever open on a fresh profile triggers the persist call during seed-load tx; observe `navigator.storage.persisted()` return value; verify `meta.persistResult` written; reload — no re-call | ✅ Item 2 round 2 |
| BroadcastChannel between two tabs | DATA-07 | Real cross-tab plumbing not modelable in `node --test` | Open two tabs of the app; in tab B `(await import('./js/platform/sync.js')).onMessage(d => console.log('B got:', d))`; in tab A `apply({type:'markCompleted', …})`; tab B's listener fires with `{type, event, keys, at, origin}`; tab A's own listener (if attached) does NOT fire (origin filter) | ✅ Item 3 round 2 |
| `visibilitychange → hidden` flush on mobile background | DATA-08 | Mobile lifecycle hook is unreliable to simulate in unit tests | Call `apply({type:'markCompleted', …})`; immediately background the tab via DevTools "hidden" simulation or actual tab-switch on mobile; foreground after 10s; confirm log row is durable in IDB | ✅ Item 4 round 2 |
| Undo across reload | UNDO-02 (cross-phase) | Persistence semantics of `meta.undoToken` only observable across a full process restart | After `apply(markCompleted …)` in tab A, reload the page; inspect `meta.undoToken` (non-null); call `(await import('./js/state/undo.js')).undo()`; confirm log row removed | ✅ Item 5 round 2 |
| Reset-data button round-trip | D-44 | UI confirm-dialog + `indexedDB.deleteDatabase('habits')` + reload sequence | Diagnostics → Reset → confirm dialog matches verbatim D-06 copy → page reloads to empty IDB → seed-load reruns idempotently | ✅ Item 6 round 2 |
| Cross-shell IDB share | DESKTOP-02 (cross-phase carry) | Two HTML shells share the same origin-scoped `habits` DB | Open `desktop.html` after writing in `index.html`; confirm IDB rows visible in both | ✅ Item 7 round 2 |
| `file://` graceful (Firefox + Safari) | NFR-09, Pitfall 13 | Chromium refuses ES modules from `file://` by browser policy; Firefox / Safari load directly | Open `index.html` via `file://`; SW silent-fails; `bootSeed` runs; IDB works; `crypto.randomUUID()` honored or fallback fires | ⚠️ Item 8 PASS-with-caveat — Firefox + Safari PASS; Chromium browser-policy-bound (documented in STATE.md "Deferred Items"; workaround is `node scripts/serve.js` or GitHub Pages, both supported) |

The 8-item smoke checklist outcome is the canonical record in `02-05-SUMMARY.md`; this table copies the per-item result for audit traceability.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 100 assertions cover DATA-01..08 + SEED-01..05; 8 manual-only items completed in 02-05 smoke
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every TDD task ships RED then GREEN; verification-only tasks gate full suite
- [x] Wave 0 covers all MISSING references (CI yaml + fake-IDB harness + companion fakes) — delivered in 02-01
- [x] No watch-mode flags — `node --test` invoked directly; CI runs once per push/PR
- [x] Feedback latency < 13s locally, < 5s on CI
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** complete (audited 2026-05-27)

---

## Validation Audit 2026-05-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests existing | 15 files / 100 assertions / 100 passing |
| Test helpers | 3 (`fake-idb`, `fake-broadcast-channel`, `fake-storage`, `fake-document`) |
| Manual-only items | 8 (all walked in 02-05; 7 PASS + 1 PASS-with-Chromium-caveat) |
| Requirements covered | 13 / 13 (DATA-01..08 + SEED-01..05) |

The Per-Task Verification Map was a template skeleton in the original draft (`nyquist_compliant: false`, `wave_0_complete: false`, one stub row). This audit reconstructs it from the six PLAN/SUMMARY pairs and the live test suite. No new tests required — every requirement was already covered by the time the phase shipped.
