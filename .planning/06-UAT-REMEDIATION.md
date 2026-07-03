# Phase 6 UAT Remediation Plan

**Context:** UAT run 2026-07-03, after Phase 7 was already completed. 6 failures found (3 critical). Phase 8 is ready to plan but must not start until critical issues are resolved.

---

## Situation

- `06-UAT.md`: 25 tests, 19 passed, 6 failed — status `failed` (file needs committing)
- Phase 7: fully executed and verified (`07-VERIFICATION.md` passed 2026-07-01)
- Phase 8: ready to plan (`STATE.md status: planning`) — **blocked by critical UAT failures**

---

## Triage

### Critical — Block Phase 8

| Test | Issue | Fix approach |
|------|-------|-------------|
| **#11** | Habit edit overwrites historical log names (hard constraint violation — `CLAUDE.md`: "History integrity cannot be violated") | `/gsd-debug` — architectural; involves `habit_versions` store and log-definition linkage |
| **#21** | Analytics columns empty (Rolling %, Mastery, S2) — Phase 6 goal partially undelivered | `/gsd-quick` — scoring snapshot data not flowing to analytics view |
| **#7**  | Scoring model selection not persisted across navigation | `/gsd-quick` — missing IDB write on model change + restore on Settings load |

### Defer to Phase 8 scope (not blockers)

| Test | Issue |
|------|-------|
| **#14** | Mastery visuals not showing on Today / Catalog |
| **#20** | Settings panel missing from desktop sidebar (only 3 nav items instead of 4) |
| **#23** | Waveboard data not loading + row height sizing issue |
| **#10, #13** | UX issues (form placement, scroll on counter increment, visual inconsistency) |
| **#1**  | Deprecated `apple-mobile-web-app-capable` meta tag |

---

## Execution Order

```
1. git add 06-UAT.md → commit (frontmatter status: testing → failed)

2. /gsd-debug   — Test 11: habit edit rewrites historical names
3. /gsd-quick   — Test 7:  scoring model not persisted
4. /gsd-quick   — Test 21: analytics columns empty

5. Re-test all 3 failing scenarios manually
6. Update 06-UAT.md results → flip status: failed → passed
7. Commit UAT closure

8. /gsd-plan-phase 8  (unblocked)
```

---

## GSD Principle Applied

Phase 6 didn't fully deliver because 3 critical behaviors are broken. These belong to Phase 6's debt — not silently to Phase 8's scope. Fixing them explicitly keeps the plan → verify → UAT chain honest.

The functional/UX issues (#14, #20, #23) are added to Phase 8 scope rather than blocking it, because they don't violate hard constraints and Phase 8 touches those surfaces anyway.

---

_Created: 2026-07-03_
