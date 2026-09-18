---
created: 2026-09-18T13:23:20.047Z
title: Add explicit habit-day status (done/failed/skipped/not tracked)
area: general
severity: major
files:
  - js/domain/cadence.js
  - js/db/schema.js
---

## Problem

Historic days with no log entry currently just show as missing data — there's
no explicit status recorded for why a day has no completion. The user wants
every habit-day to carry one of four explicit statuses:

- **done** — completed
- **failed** — applicable, not completed (counts as a miss)
- **skipped** — user explicitly marked the day as not counted
- **not tracked** — no data / habit wasn't being tracked that day

`skipped` and `not tracked` should be treated identically for scoring/history
purposes (both excluded from counts), while `failed` is distinct and counts
against the habit.

This is conceptually close to the existing CSV export cell semantics
(`1`/`0`/`x` — see CLAUDE.md "CSV Export — Wide Habit×Day Matrix") where `x`
already means "not applicable / not counted." The gap is that today only
`appliesToday()` (`js/domain/cadence.js`) decides applicability at render/export
time — there's no persisted per-day status letting the user retroactively mark
a historic day as skipped vs. not-tracked vs. failed, and history views showing
"missing data" don't offer a way to set one.

## Solution

TBD — likely needs:
- A status concept on `logs` (or derived from `logs` + cadence) distinguishing
  done/failed/skipped/not-tracked, with skipped+not-tracked collapsing to the
  same "not counted" bucket for scoring (`js/domain/scoring.js`) and CSV `x`.
- A UI affordance in History/Today for retroactively setting status on days
  with missing data.
- Should not rewrite historical logs destructively — respect the "History
  integrity" constraint in CLAUDE.md.
