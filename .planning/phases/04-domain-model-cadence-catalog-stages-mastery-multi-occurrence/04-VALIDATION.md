---
phase: 4
slug: domain-model-cadence-catalog-stages-mastery-multi-occurrence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 4 adds 12 new test files covering 47 requirements (CATALOG, CADENCE, STAGE, MASTERY, LOG, HISTORY, WAVE, SETTINGS, NFR-10).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (per D-23) |
| **Config file** | none — uses Node 18+ native `node --test` |
| **Quick run command** | `npm test -- tests/unit/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~45 seconds (Phase 3: 279 tests green; Phase 4 adds ~180 new tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/unit/{feature-under-test}.test.js` (targeted unit test for changed module)
- **After every plan wave:** Run `npm test` (full suite including integration tests)
- **Before `/gsd-verify-work`:** Full suite must be green (≥459 tests)
- **Max feedback latency:** 90 seconds for full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CATALOG-01..07, CADENCE-01..07 | T-04-01 | Habit creation and edit do not rewrite logs | unit | `npm test -- tests/unit/domain/catalog.test.js` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | STAGE-01..07 | T-04-02 | Stage advancement via OR-composed triggers | unit | `npm test -- tests/unit/domain/stage.test.js` | ✅ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | MASTERY-01..07 | T-04-03 | Mastery threshold with cadence-aware denominator + 7-day grace | unit | `npm test -- tests/unit/domain/mastery.test.js` | ✅ W0 | ⬜ pending |
| 04-04-01 | 04 | 4 | LOG-02..06 | T-04-04 | Multi-occurrence dispatch (binary / numeric / slot) | unit | `npm test -- tests/unit/domain/logging.test.js` | ✅ W0 | ⬜ pending |
| 04-05-01 | 05 | 5 | HISTORY-01..06 | T-04-05 | Version-aware history navigation + uncomplete | unit | `npm test -- tests/unit/domain/history.test.js` | ✅ W0 | ⬜ pending |
| 04-06-01 | 06 | 6 | WAVE-01..06 | T-04-06 | Wave aggregate metrics (completion %, streak, at-risk) | unit | `npm test -- tests/unit/domain/wave.test.js` | ✅ W0 | ⬜ pending |
| 04-07-01 | 07 | 1 | SETTINGS-01, NFR-10 | T-04-07 | Global mastery settings, history integrity invariant | unit | `npm test -- tests/unit/state/apply.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/domain/catalog.test.js` — habit creation, versioning, archive/restore, future scheduling
- [ ] `tests/unit/domain/stage.test.js` — stage transitions, trigger composition (manual, scheduled, after-N-days, after-N-with-C%)
- [ ] `tests/unit/domain/mastery.test.js` — threshold calc, cadence-aware denominator, grace period, per-habit override
- [ ] `tests/unit/domain/logging.test.js` — binary / numeric / slot dispatch, completion detection, partial logs
- [ ] `tests/unit/domain/history.test.js` — date navigation, version-aware log evaluation, bulk uncomplete
- [ ] `tests/unit/domain/wave.test.js` — aggregate computation, status counts, streak, at-risk detection
- [ ] `tests/integration/catalog-flow.test.js` — end-to-end create → edit → log → mastery flow
- [ ] `tests/integration/history-flow.test.js` — end-to-end date nav → uncomplete → re-evaluate
- [ ] `tests/integration/stage-advancement.test.js` — trigger composition at log-write time
- [ ] `tests/integration/habit-versions.test.js` — history integrity: logs survive definition edits intact (NFR-10)
- [ ] `tests/integration/wave-aggregates.test.js` — aggregate computation across habit set
- [ ] `tests/integration/mastery-cadence.test.js` — mastery evaluation with day-of-week / every-N-days cadence

*12 new test files, ~180 tests, covering all 47 Phase 4 requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Catalog UI renders habit list, edit panels slide in/out smoothly | CATALOG-01, CATALOG-02 | UX responsiveness / visual layout hard to assert in unit tests | Open `#catalog` route on mobile; tap a habit → edit panel opens without jank; tap ✓ → updates list in <100ms |
| History date stepper ← → arrows navigate one day at a time | HISTORY-01 | Touch responsiveness + animation frame timing | Open `#history`; tap ← / → arrows; verify date increments/decrements by 1 day, previous logs populate correctly |
| Stage advancement button shows / hides based on enablement | STAGE-01 | Visibility logic coupled to definition state | Create habit with manual stage enabled; verify "Advance stage" button visible on Today; disable in Catalog → button disappears on next load |
| Mastery badge appears / disappears as threshold crosses | MASTERY-01 | Visual state changes depend on threshold evaluation + rendering | Log habits across 70 days; verify badge appears when ≥90% reached; drop below 90% → badge vanishes |

*4 manual UAT items; all critical UX / rendering behaviors. Automation is deferred to P4 UAT session.*

---

## Validation Sign-Off

- [ ] All 7 plans have `<automation>` verify step or Wave 0 test dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all 47 CATALOG / CADENCE / STAGE / MASTERY / LOG / HISTORY / WAVE / SETTINGS / NFR-10 requirements
- [ ] No watch-mode flags in test commands
- [ ] Feedback latency ≤90s (full suite runtime)
- [ ] `nyquist_compliant: true` set in frontmatter (after all Wave 0 tests are green)

**Approval:** pending (awaiting planner completion and Wave 0 test creation)

---

**P4 Testing Strategy Notes:**

1. **TDD mode active** — Each plan's tasks follow RED/GREEN/REFACTOR for domain logic (mastery calc, stage triggers, history evaluation). UI rendering and routing are standard plan tasks.
2. **Fake-IDB pattern** — All unit tests use the same `fakeIdb` and `fakeStore` fixtures from Phase 2; no new fixture infrastructure needed.
3. **Integration test chain** — 6 integration tests build on unit tests, exercising full app flows (create → edit → log → mastery badge → history nav → uncomplete).
4. **Manual UAT** — 4 behaviors require human verification (touch responsiveness, animation smoothness, visual state changes). Scheduled for P4 UAT session after Wave 0 is green.
5. **Cadence-aware tests** — Test matrix includes DST (2026-03-29, 2026-10-25) and leap-day (2028-02-29) edge cases for every-N-days and day-of-week cadence rules.
