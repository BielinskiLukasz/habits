# Code Review — v1.0..HEAD (QA-01)

**Scope:** All files changed since the v1.0 git tag (`git diff v1.0..HEAD --name-only`)
**Reviewer:** gsd-code-review (13-02 Task 1, inline Pattern C)
**Date:** 2026-09-08
**Status:** COMPLETE — all four QA-01 compliance checks PASSED; two informational notes

---

## QA-01 Compliance Checks

### Check 1 — No `switch` on log status or cadence types (Anti-Pattern 4)

**Result: CLEAN ✓**

All `switch (` occurrences in new and modified v1.2 files are inside JSDoc comment blocks documenting Anti-Pattern 4 itself (e.g., `markFailed.js` @file header, `settings.js` @file header). No actual `switch` statement on status or cadence values exists in any reviewed file.

The `logStatus.js` module — the most critical new file for this check — uses the `NEXT_STATE` dispatch table (object lookup) as required:

```js
const NEXT_STATE = { null: 'completed', completed: 'failed', failed: 'skipped', skipped: null };
```

The unit test in `tests/unit/logStatus.test.js` enforces this structurally: it asserts the `NEXT_STATE` identifier is present and no `switch (` keyword appears in the file.

### Check 2 — No `.innerHTML` anywhere (D-78)

**Result: CLEAN ✓**

All `.innerHTML` mentions in the v1.2 diff scope are in JSDoc `@file` headers documenting D-78 (e.g., "`.innerHTML` family — D-78 grep gate"). No actual `.innerHTML =` assignment, `.insertAdjacentHTML()` call, or `.outerHTML =` assignment appears in any reviewed file.

All new view modules (`sidebar.js`, `wavePlanning.js`) and all modified view modules (`today.js`, `history.js`) use `textContent`, `appendChild`, and `removeChild` for DOM manipulation. The `clearChildren` helper in each view file loops `removeChild` explicitly to avoid the `.innerHTML = ''` anti-pattern.

### Check 3 — No `indexedDB.*` calls outside `js/db/idb.js` (Anti-Pattern 1)

**Result: CLEAN ✓** (for v1.2 changes)

`js/views/settings.js:432` contains `globalThis.indexedDB.deleteDatabase('habits')` for the "Reset Data" destructive action. This usage is **pre-existing since v1.0** (confirmed via `git show v1.0:js/views/settings.js | grep -n "indexedDB"` — the line appears at v1.0:421). No new `indexedDB.*` calls were introduced in v1.2.

`js/views/diagnostics.js:192` also has `indexedDB.deleteDatabase('habits')` but this file is not in the v1.0..HEAD diff scope.

The pre-existing usage in `settings.js` is intentional: `IDBFactory.deleteDatabase()` is a database-level operation (not a store CRUD operation) that cannot be routed through `idb.js`'s store-aware wrapper. The `@file` header documents this exception explicitly.

No new violations introduced in v1.2.

### Check 4 — JSDoc `@file` header on every new `.js` file (D-27)

**Result: CLEAN ✓**

All 9 new `.js` files introduced in v1.2 carry a `@file` header:

| File | @file Header |
|------|-------------|
| `js/domain/logStatus.js` | "Pure log-state cycle function for the 4-state swipe model (D-04, D-05)." |
| `js/domain/scheduled.js` | "Scheduled-status boot service — one-time migration pass (DATA-03) and every-boot promotion pass (SCHED-03)." |
| `js/state/apply/markFailed.js` | "Per-event handler for `markFailed` — writes `status:'failed'` for a (habitId, date) pair." |
| `js/state/apply/markSkipped.js` | "Per-event handler for `markSkipped` — writes `status:'skipped'` for a (habitId, date) pair." (updated Plan 13-01) |
| `js/state/apply/promoteHabit.js` | "promoteHabit handler (SCHED-04)." |
| `js/views/desktop/sidebar.js` | ✓ (confirmed earlier grep pass) |
| `js/views/desktop/wavePlanning.js` | ✓ (confirmed earlier grep pass) |
| `js/i18n/index.js` | "i18n module for Nawyki — t(key, subs?), getLang(), setLang(lang)." |
| `js/i18n/en.js` | ✓ (confirmed earlier grep pass) |
| `js/i18n/pl.js` | ✓ (confirmed earlier grep pass) |

All exported functions in reviewed files have JSDoc `@param` / `@returns` annotations consistent with D-27.

---

## Code Quality Findings

### F-01: Informational — i18n uses localStorage, not IDB, for locale preference

**Severity: Informational (not actionable)**

`js/i18n/index.js` stores the locale preference in `localStorage` under key `'habits-lang'`, not in the IDB `settings` store. The `@file` header documents this explicitly and explains the rationale: the null-safe `_storage` pattern makes the module work in Node (tests) and service workers without mocking.

This is acceptable under the CLAUDE.md constraint "Use [localStorage] only for tiny UI preferences if at all." Language selection is a tiny UI preference. The IDB-first policy applies to habit data, not to user preferences of this kind.

**Action: None.** The implementation is intentional and documented. Plan 13-03 should document D-44 with the accurate storage mechanism (`localStorage`, key `'habits-lang'`) rather than IDB.

### F-02: Informational — `t()` uses single-brace `{name}` placeholders, not `{{var}}`

**Severity: Informational (not actionable)**

The `t(key, subs)` function in `js/i18n/index.js` uses single-brace substitution (`result.replace('{' + k + '}', ...)`) rather than double-brace `{{var}}`. This is consistent across all callers and locale strings in `en.js`/`pl.js`.

**Action: None.** The implementation is internally consistent. Plan 13-03 should document D-44 with the accurate placeholder syntax (`{name}` not `{{var}}`).

### F-03: Informational — `promoteHabit.js` co-locates two inverse handlers

**Severity: Informational (not actionable)**

`js/state/apply/promoteHabit.js` exports both `handlePromoteHabit` and `handleDemoteHabit` in one file. Other handler files export one handler each. Co-location of inverse handlers is a reasonable choice (same action domain, single import) and does not violate any documented convention.

**Action: None.**

---

## Summary

| QA-01 Check | Result |
|-------------|--------|
| No `switch` on log status/cadence types (Anti-Pattern 4) | **CLEAN ✓** |
| No `.innerHTML` (D-78) | **CLEAN ✓** |
| No `indexedDB.*` outside `js/db/idb.js` (Anti-Pattern 1) | **CLEAN ✓** (no new violations in v1.2) |
| JSDoc `@file` headers on all new `.js` files (D-27) | **CLEAN ✓** |

**Overall verdict: QA-01 PASSED.** No actionable findings. Three informational notes recorded for plan 13-03 documentation accuracy. Task 2 will commit with the all-clear message.
