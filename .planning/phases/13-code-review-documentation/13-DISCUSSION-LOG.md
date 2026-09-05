# Phase 13: Code Review & Documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 13-Code Review & Documentation
**Areas discussed:** Review coverage, Bug fix scope

---

## Review coverage

| Option | Description | Selected |
|--------|-------------|----------|
| All v1.2-changed files | New files + modified existing files (today.js, history.js, scoreSnapshots.js, waveAggregates.js, import.js). Catches stale-boolean bugs and full impact of v1.2 changes. | ✓ |
| New files only | Only the 15 newly-added .js files. Faster, leaves existing files unreviewed. | |

**User's choice:** All v1.2-changed files

---

| Option | Description | Selected |
|--------|-------------|----------|
| Run /gsd-code-review | Spawns gsd-code-reviewer agent over v1.0..HEAD diff. Produces REVIEW.md with severity-classified findings. | ✓ |
| Manual review tasks | Plan tasks explicitly check each file for each violation type. More prescriptive, less likely to catch unexpected issues. | |

**User's choice:** Run /gsd-code-review

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fix with --fix flag | Run /gsd-code-review --fix to apply fixes immediately after review. Completion = code meets patterns. | ✓ |
| Review only, fix manually | Produce REVIEW.md and decide which findings to act on manually. | |

**User's choice:** Auto-fix with --fix flag

---

## Bug fix scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix bugs first, then review | Dedicated plan to fix all 4 stale callers. Code review runs on clean, already-fixed code. | ✓ |
| Fix bugs as part of code review plan | One plan combining bug fixes + code review + fix findings. Compact but mixes work types. | |

**User's choice:** Fix bugs first (dedicated plan), then review

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fix markSkipped.js:35 in bug-fix plan | Wire _recomputeLastCompletedDate in markSkipped when overwriting a completed log. All 4 deferred bugs in one plan. | ✓ |
| Defer to future quick-fix | It's a UX edge case, not an analytics-breaking bug. Fix the 3 analytics bugs now. | |

**User's choice:** Fix all 4 bugs in one plan

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, TDD — RED tests first | Write failing tests that expose each stale-boolean bug before fixing (D-23). Same pattern as Phase 11. | ✓ |
| Fix only, no new tests | LOG4-01 coverage in Phase 11 is sufficient; new tests are nice-to-have. | |

**User's choice:** TDD mode — RED tests first

---

## Claude's Discretion

- **QA-02 documentation style:** User did not select this gray area for discussion. Claude will follow existing D-xx entry style in PROJECT.md Key Decisions table. D-43 (4-state) exists — enrich it if thin. Add new D-xx entry for i18n (locale dict shape, t() signature, no Intl.*, two locales, locale pref in IDB settings store).
- **Plan structure:** Three-plan sequence — Plan 01 (bug fixes + TDD), Plan 02 (code review --fix), Plan 03 (QA-02 documentation). Plans 02 and 03 can run in parallel after Plan 01.
- **CSS token names, exact D-xx numbers for new decisions:** Left to planner.

## Deferred Ideas

None — discussion stayed within phase scope.
