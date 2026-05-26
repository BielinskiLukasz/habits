---
phase: 2
slug: storage-foundation-the-spine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (Node 20+) |
| **Config file** | none — zero-dependency by D-47 / D-23 |
| **Quick run command** | `node --test tests/unit/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

Browser-touching behaviour (real IndexedDB persistence across reload, real `BroadcastChannel` between two tabs, real `visibilitychange → hidden` flush, real `navigator.storage.persist()` prompt) is verified manually via `tests-browser.html` per D-26 — see "Manual-Only Verifications" below.

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/unit/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Filled by planner. Each module classified as one of: **unit** (pure logic, `tests/unit/*.test.js`) · **integration** (fake-IDB roundtrip, `tests/integration/*.test.js`) · **manual** (real-browser only, listed in "Manual-Only Verifications") · **execute** (config/glue, no test).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {filled by planner} | … | … | DATA-XX / SEED-XX | — | — | unit/integration/manual | `node --test tests/{path}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/ci.yml` — runs `node --test tests/` on push/PR (D-38)
- [ ] `tests/` directory with at least one placeholder `*.test.js` so CI is green from the first plan
- [ ] Fake-IDB harness `tests/fakes/fake-idb.js` (~30 lines, same surface as `js/db/repo.js`) — D-25

*No framework install needed — Node 20+ `node --test` is in the runtime.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real IDB persistence across full browser restart | DATA-02 | Fake IDB cannot prove durable disk persistence | Open app on `http://localhost:8080/`, write one log via `apply/markCompleted`, fully restart Chrome, reopen, confirm log row still present in DevTools → Application → IndexedDB → `habits` |
| `navigator.storage.persist()` prompt + result | DATA-03 | Browser-only API; engagement gates differ per browser | First-ever open on a fresh profile triggers prompt during seed-load tx; observe `navigator.storage.persisted()` returns `true` (or recorded "denied" in `meta.persistRequested`) |
| BroadcastChannel between two tabs | DATA-07 | Real cross-tab plumbing not modelable in `node --test` | Open two tabs of the app, mutate `markCompleted` in tab A, confirm tab B's `state/store.js` reflects the new log within ~50ms |
| `visibilitychange → hidden` flush on mobile background | DATA-08 | Mobile lifecycle hook is unreliable to simulate in unit tests | Open PWA on Android Chrome (or DevTools "Hidden" simulation), call `markCompleted`, immediately background the app, foreground after 10s, confirm the write is durable in IDB |
| Reset-data button round-trip | D-44 | UI confirm-dialog + `indexedDB.deleteDatabase('habits')` + reload sequence | Diagnostics → Reset → confirm dialog matches D-06 verbatim → page reloads to empty IDB → seed-load reruns idempotently |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (CI yaml + fake-IDB harness)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
