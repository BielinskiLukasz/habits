---
phase: 10-i18n-tests-verification
plan: "04"
subsystem: tests/i18n
tags: [i18n, unit-tests, persistence, structural-assertions, locale-parity, I18N-03]
status: complete
completed: "2026-08-31"
duration_seconds: 543

dependency_graph:
  requires: [10-01-SUMMARY.md, 10-03-SUMMARY.md]
  provides:
    - i18n-persistence-test-coverage
    - i18n-cross-shell-documentation
  affects:
    - tests/unit/i18n.persistence.test.js
    - js/i18n/index.js

tech_stack:
  added: []
  patterns:
    - fs.readFileSync structural assertions for Node-only test environments
    - dynamic import inside async test bodies for locale parity checks
    - afterEach(_resetLangForTest) for order-independent locale state

key_files:
  created:
    - tests/unit/i18n.persistence.test.js
  modified:
    - js/i18n/index.js

decisions:
  - Structural assertions use fs.readFileSync + source.includes() rather than
    importing the live module — avoids Node localStorage absence at module-init
  - Locale parity uses dynamic import inside async it() bodies to load EN/PL
    objects without affecting module-level state
  - "Cross-shell" capitalized in @file header to match JSDoc sentence-start
    convention; grep -i used to verify case-insensitively

metrics:
  duration_seconds: 543
  completed: "2026-08-31"
  tasks: 2
  commits: 2

estimate:
  tokens: 60000
  tasks: 2

actuals:
  tokens: 5000
  tasks: 2
  commits: 2

requirements:
  - I18N-03
---

# Phase 10 Plan 04: i18n Persistence & Cross-Shell Verification (I18N-03) Summary

**One-liner:** Added 10-test persistence suite (setLang round-trip, structural habits-lang/setItem assertions, cross-shell shell adoption, en.js/pl.js parity) and updated i18n/index.js @file header with explicit cross-shell localStorage guarantee per I18N-03 and D-35.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Write i18n.persistence.test.js — setLang round-trip, structural assertions, locale parity | ab011c5 | tests/unit/i18n.persistence.test.js |
| 2 | Update @file header in i18n/index.js to document cross-shell localStorage guarantee | 8784a10 | js/i18n/index.js |

## Verification Results

```
node --test tests/unit/i18n.persistence.test.js
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

Coverage added by `tests/unit/i18n.persistence.test.js`:
- `_resetLangForTest('en') + setLang('pl')` → getLang() returns 'pl'
- `_resetLangForTest('en') + setLang('en')` → getLang() returns 'en'
- `_resetLangForTest('pl') + setLang('en')` → getLang() returns 'en' (switching back)
- js/i18n/index.js contains storage key 'habits-lang' (structural assertion)
- js/i18n/index.js contains setItem call (structural assertion)
- js/main.js imports and calls applyStaticTranslations from ./i18n/index.js
- js/desktop.js imports and calls applyStaticTranslations from ./i18n/index.js
- en.js and pl.js have the same number of keys
- every key in en.js exists in pl.js (no EN-only orphans)
- every key in pl.js exists in en.js (no PL-only orphans)

Full unit suite: 576 tests, 573 pass, 3 fail (3 pre-existing store.hydrate failures, unrelated to i18n — documented in 10-01-SUMMARY.md).

## Acceptance Criteria Met

- `node --test tests/unit/i18n.persistence.test.js` exits 0: YES
- Test count >= 10: YES (exactly 10)
- `grep -ic "cross-shell" js/i18n/index.js` >= 1: YES (1)
- `grep -c "I18N-03" js/i18n/index.js` >= 1: YES (3)
- No production code lines modified in Task 2 (only @file comment): YES

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Task 1 creates a test-only file; Task 2 modifies only a JSDoc comment block. Consistent with T-10-08 accepted disposition (fs.readFileSync reads only app JS source, no secrets).

## Known Stubs

None.

## Self-Check: PASSED

- tests/unit/i18n.persistence.test.js exists: FOUND
- js/i18n/index.js modified (21 lines added, 0 code lines changed): FOUND
- Commit ab011c5 (i18n.persistence.test.js): FOUND
- Commit 8784a10 (i18n/index.js @file header): FOUND
- node --test tests/unit/i18n.persistence.test.js: 10/10 pass
- "Cross-shell" present in js/i18n/index.js: FOUND (line 11)
- "I18N-03" present in js/i18n/index.js: FOUND (3 occurrences)
