---
phase: 5
slug: backup-restore-json-csv-exports-json-import-nag
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 5 introduces JSON/CSV export, JSON import merge, and backup nag — all pure logic with unit tests (TDD Wave 1) and integration tests (Wave 2–4).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` |
| **Config file** | none — native Node runner |
| **Quick run command** | `node --test tests/unit/**/*.test.js` |
| **Full suite command** | `node --test tests/**/*.test.js` |
| **Estimated runtime** | ~30 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/unit/**/*.test.js` (quick unit tests only)
- **After every plan wave:** Run `node --test tests/**/*.test.js` (full suite including integration)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | EXPORT-03, EXPORT-06 | CSV cell: 1/0/x encoding, cadence matching | unit | `node --test tests/unit/export.csv.test.js` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | EXPORT-01, EXPORT-02 | JSON: schemaVersion, all 7 stores, round-trip | unit | `node --test tests/unit/export.json.test.js` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | IMPORT-01, IMPORT-02, IMPORT-03 | Import merge-by-id, schema validation, rejection | unit | `node --test tests/unit/import.test.js` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 1 | EXPORT-08 | Nag visibility: daysSince, shouldShow, dismissal | unit | `node --test tests/unit/backup-nag.test.js` | ❌ W0 | ⬜ pending |
| 05-05-01 | 05 | 3 | EXPORT-04, EXPORT-05, EXPORT-07, IMPORT-04, SETTINGS-03 | File I/O: Blob download, file picker, broadcast | integration | `node --test tests/integration/export.integration.test.js` | ❌ W0 | ⬜ pending |
| 05-05-02 | 05 | 3 | (same as 05-05-01) | Settings UI wiring: mount, action closures | integration | `node --test tests/integration/settings.backup-nag.test.js` | ❌ W0 | ⬜ pending |
| 05-06-01 | 06 | 4 | EXPORT-08 | Nag banner UI: conditional display, live refresh | integration | `node --test tests/integration/settings.backup-nag.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/export.csv.test.js` — stubs for CSV cell encoding (EXPORT-03, EXPORT-06)
- [ ] `tests/unit/export.json.test.js` — stubs for JSON export (EXPORT-01, EXPORT-02)
- [ ] `tests/unit/import.test.js` — stubs for JSON import merge (IMPORT-01, IMPORT-02, IMPORT-03)
- [ ] `tests/unit/backup-nag.test.js` — stubs for backup nag calculation (EXPORT-08)
- [ ] `tests/integration/export.integration.test.js` — stubs for file I/O workflows
- [ ] `tests/integration/settings.backup-nag.test.js` — stubs for Settings UI and nag banner
- [ ] `tests/util/fake-idb.js` — hand-written fake IDB store (reuse from Phase 2 if exists)
- [ ] `tests/util/fake-broadcast.js` — hand-written fake BroadcastChannel

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV imports correctly into Polish Windows Excel | EXPORT-03, EXPORT-06, EXPORT-07 | Excel rendering is browser/OS dependent; can't mock Excel's CSV parser | Open exported CSV in Excel on Windows; verify Polish diacritics render, semicolon-delimited columns parse correctly |
| User can select custom date range for CSV export | EXPORT-04 | Date picker UI interaction hard to automate without browser headless testing | Open Settings on desktop, click "Custom date range", select start/end dates, verify CSV header columns match selected range |
| BroadcastChannel cross-tab sync actually works | IMPORT-04 | Requires two browser tabs (not mockable in unit tests) | Open app in two tabs on same device, import JSON in one tab, verify other tab reloads and reflects imported data |

---

## Validation Sign-Off

- [ ] All TDD tasks (Wave 1) have comprehensive unit tests with RED/GREEN/REFACTOR gates
- [ ] All execute tasks (Waves 2–4) have integration tests that verify file I/O and UI wiring
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (all 7 tasks have automated tests)
- [ ] Wave 0 covers all MISSING test files per the 6-file list above
- [ ] No watch-mode flags in test commands (all use `node --test` directly)
- [ ] Feedback latency < 60s (unit: ~10s, integration: ~30–40s each)
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 completion)

**Approval:** pending — awaiting Wave 0 completion and Phase 5 execution

---

## Notes

- **Wave 0 timing:** TDD plans (Wave 1) should create all unit test scaffolding in their RED phase, before implementing production code. Integration test scaffolding (Waves 2–4) follows after Wave 1 completes.
- **Fake IDB strategy:** Reuse `tests/util/fake-idb.js` from Phase 2 if it exists and covers the 7 stores needed for Phase 5. If not, create a minimal hand-written fake that supports `runTx()` and per-store put/get logic.
- **BroadcastChannel mocking:** Use `global.BroadcastChannel = class FakeBroadcast { ... }` in test setup (conftest pattern from Phase 2) to isolate import broadcast from actual cross-tab behavior.
