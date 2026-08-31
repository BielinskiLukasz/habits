---
phase: 10-i18n-tests-verification
plan: "01"
subsystem: tests/i18n
status: complete
tags: [i18n, unit-tests, tdd, coverage]
completed: "2026-08-31"
duration_seconds: 463

dependency_graph:
  requires: []
  provides:
    - i18n-unit-test-full-coverage
  affects:
    - tests/unit/i18n.test.js

tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle for retroactive test coverage
    - globalThis.document monkey-patch with immediate cleanup for DOM guard tests
    - afterEach(_resetLangForTest) for order-independent locale state

key_files:
  modified:
    - tests/unit/i18n.test.js

decisions:
  - Retroactive TDD: RED commit added 8 tests referencing un-imported displayName/applyStaticTranslations; GREEN commit added imports to pass all 17 tests
  - Inline fake document in applyStaticTranslations test (not from tests/helpers/fake-document.js) — helpers file provides visibilitychange/window fakes, not querySelectorAll

metrics:
  duration_seconds: 463
  completed: "2026-08-31"
  tasks: 2
  commits: 2

actuals:
  tokens: 4500
  tasks: 2
  commits: 2

requirements:
  - I18N-01
---

# Phase 10 Plan 01: i18n Test Coverage Expansion Summary

Expanded `tests/unit/i18n.test.js` from 9 tests to 17 tests, adding full public-API coverage for `displayName()` (en/pl locale branches + null fallback), `applyStaticTranslations()` (DOM-present and DOM-absent paths), and `setLang()` valid locale cases, satisfying I18N-01.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify existing i18n test baseline passes | (no commit — read-only) | tests/unit/i18n.test.js (read) |
| 2 RED | Add failing tests for displayName, applyStaticTranslations, setLang valid cases | 7e955cd | tests/unit/i18n.test.js |
| 2 GREEN | Add displayName and applyStaticTranslations to i18n test imports | 4b24911 | tests/unit/i18n.test.js |

## Verification Results

```
node --test tests/unit/i18n.test.js
✓ 17 tests, 0 failures
```

Coverage added:
- `setLang('pl')` → getLang() returns 'pl'
- `setLang('en')` → getLang() returns 'en'
- `displayName({name:'Walk', name_pl:'Spacer'})` at lang=en → 'Walk'
- `displayName({name:'Walk', name_pl:'Spacer'})` at lang=pl → 'Spacer'
- `displayName({name:'Walk', name_pl:null})` at lang=pl → 'Walk' (null fallback)
- `displayName({name:'Walk'})` at lang=pl → 'Walk' (undefined fallback)
- `applyStaticTranslations()` — no throw when `globalThis.document` is undefined
- `applyStaticTranslations()` — sets `textContent` via `t()` when document fake is wired

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: commit `7e955cd` — `test(10-01): add failing tests for displayName, applyStaticTranslations, setLang valid cases`
- GREEN gate: commit `4b24911` — `feat(10-01): add displayName and applyStaticTranslations to i18n test imports`
- Both gates present; TDD cycle complete.

## Out-of-Scope Observations

Pre-existing test failures in the full suite (29 of 900 tests) were observed in unrelated modules: `markCompleted`, `logNumeric`, `logSlot`, `apply()` integration tests, and `exportCSV`. These failures predate this plan and are out of scope per the deviation scope boundary rule. They are noted here for visibility.

## Known Stubs

None.

## Threat Flags

None. Test file only — no production code paths modified.

## Self-Check

- [x] `tests/unit/i18n.test.js` exists and is modified
- [x] Commit `7e955cd` exists (RED)
- [x] Commit `4b24911` exists (GREEN)
- [x] `node --test tests/unit/i18n.test.js` exits 0 with 17 passing tests
- [x] `grep -c "displayName"` returns 7 (>= 2)
- [x] `grep -c "applyStaticTranslations"` returns 6 (>= 2)

## Self-Check: PASSED
