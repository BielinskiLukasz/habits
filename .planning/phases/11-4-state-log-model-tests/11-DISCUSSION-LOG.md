# Phase 11: 4-State Log Model Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 11-4-State Log Model Tests
**Areas discussed:** Test target & location, Invalid input scope, Export round-trip depth

---

## Test target & location

### Q1: Where should the 4-state log status unit tests live?

| Option | Description | Selected |
|--------|-------------|----------|
| New logStatus.test.js | Dedicated file, mirrors cadence.test.js/scoring.test.js pattern | ✓ |
| Extend apply.discipline.test.js | Co-locate with log-mutation tests | |
| Split across both | Handler behavior in apply.discipline, model tests in logStatus | |

**User's choice:** New logStatus.test.js

---

### Q2: Test handlers directly or create a domain module?

| Option | Description | Selected |
|--------|-------------|----------|
| Test handlers directly — no new module | Import apply handlers directly | ✓ |
| Create js/domain/logStatus.js first | Add VALID_LOG_STATUSES + isValidLogStatus(), then test | |

**User's choice:** Test handlers directly — no new module

---

### Q3: Should logStatus.test.js cover schema v2 migration?

| Option | Description | Selected |
|--------|-------------|----------|
| schema.test.js owns the migration | Migration stays with migration code | ✓ |
| Add migration tests to logStatus.test.js | Consolidate all 4-state tests in one file | |

**User's choice:** schema.test.js owns the migration

---

## Invalid input scope

### Q4: What should "invalid inputs" mean for this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Test edge-case IDB reads, not status strings | No new validation code added | ✓ |
| Add status string validation to handlers | Add guard code + test it | |
| Test what a bad status does today (document behavior) | Assert current permissive behavior | |

**User's choice:** Test edge-case IDB reads — no new validation code

---

### Q5: Which edge cases should the tests cover?

| Option | Description | Selected |
|--------|-------------|----------|
| Undefined prior log (no row) | Fresh write from undefined | ✓ |
| Prior log with same status | Idempotent write behavior | ✓ |
| Missing habitId in habits store | D-52 recompute returns null, habit write skipped | ✓ |

**User's choice:** All three

---

### Q6: Fix stale JSDoc in markUncompleted.js in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the stale JSDoc in this phase | Update @file header + @type annotation | ✓ |
| Out of scope — leave for Phase 13 | Defer to code review phase | |

**User's choice:** Fix in this phase

---

## Export round-trip depth

### Q7: How thorough should the JSON round-trip test be?

| Option | Description | Selected |
|--------|-------------|----------|
| Unit test with fake repo | Fast, matches existing export/import test pattern | ✓ |
| Full integration with fake-IDB | End-to-end but significantly heavier | |
| Extend existing files only | No new test files, add assertions to existing | |

**User's choice:** Unit test with fake repo

---

### Q8: CSV skipped→'x' gap — Phase 11 or Phase 12?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 11 — fix the gap now | Closes LOG4-04 completely | ✓ |
| Phase 12 — defer it | Awkward fit in a UX-focused phase | |

**User's choice:** Phase 11

---

### Q9: Round-trip tests in existing files or new logStatus.roundtrip.test.js?

| Option | Description | Selected |
|--------|-------------|----------|
| Add to existing files | export.json.test.js + import.test.js | ✓ |
| New logStatus.roundtrip.test.js | Consolidate LOG4-04 in one place | |

**User's choice:** Add to existing files

---

### Q10: Scope of import.test.js status assertions?

| Option | Description | Selected |
|--------|-------------|----------|
| Assert all 4 status values survive import | Complete LOG4-04 coverage | ✓ |
| Just completed + failed | Narrower but pragmatic | |

**User's choice:** Assert all 4 status values

---

## Claude's Discretion

None — user made explicit choices in all areas.

## Deferred Ideas

None — discussion stayed within phase scope.
