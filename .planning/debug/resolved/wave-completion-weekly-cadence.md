---
status: resolved
trigger: "Waveboard completion percentage for wave analytics miscounts weekly-cadence habits. User reports weekly habits show scores like 0/7 or 1/7 on the waveboard, when a weekly habit should only need to be logged once per week (i.e. the denominator/expected-count used for the completion percentage appears to be counting raw days instead of cadence-applicable occurrences)."
created: 2026-09-16T00:00:00Z
updated: 2026-09-16T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status_of_investigation: RESOLVED. Fix applied, guardrail accepted (5-signal check, mutation_check skipped — no tooling), full suite green (953/953), committed. Live-app / browser visual confirmation on desktop.html was NOT performed by the debugger agent (no browser tool available in this session) — recommend a quick visual spot-check of the Wave Board tooltip for a weekly habit as a final sanity check.

reasoning_checkpoint:
  hypothesis: "js/views/desktop/waveboard.js's per-ISO-week tooltip {completed}/{applicable} ratio is built by summing js/io/scoreSnapshots.js's per-day `applicableToday`/`loggedToday` snapshot flags across all 7 calendar days of the week. Those flags are produced by a raw per-day call to cadence.appliesToday(habit, dateYMD, ctx). For weekly cadence, appliesToday answers 'still due this period?' (true every day from the ISO week's start through the day of completion, false after) — a UI-visibility signal, not an occurrence count. Summing it across 7 days yields a denominator ranging 1-7 depending on which weekday the completion landed on (or 7 when never completed that week), instead of the cadence-correct denominator of exactly 1 occurrence per elapsed week."
  confirming_evidence:
    - "Empirical repro (scratchpad/repro-weekly.mjs) using the REAL js/domain/cadence.js appliesToday + a faithful mirror of scoreSnapshots.js's weekCompletions-capped ctx: completed-Monday -> 1/1, completed-Wednesday -> 1/3, completed-Sunday -> 1/7, never-completed -> 0/7. The last two exactly reproduce the user's verbatim report ('0/7 or 1/7')."
    - "js/domain/scoring.js already contains a documented prior fix for the IDENTICAL bug shape in computeS1: `_computeS1Periodic` (comment: 'Using appliesToday-based day-counting for these cadences inflates the denominator... a weekly habit with 1 completion/week gets 10/70 = 14% instead of the correct 10/10 = 100%'). That fix covers s1Score/s1Status only — it does NOT touch the separate loggedToday/applicableToday fields computed a few lines later in scoreSnapshots.js, which feed the waveboard tooltip. This is a parallel, unfixed instance of the exact same class of bug, in the same file, flagged by the same prior author."
    - "grep across js/ confirms `applicableToday`/`loggedToday` are read ONLY by js/views/desktop/waveboard.js's per-week summation (tests aside) — so the fix surface is fully bounded and low-risk."
  falsification_test: "If the denominator were already cadence-aware, completed-Monday/Wednesday/Sunday would all report identical applicable=1 (one expected weekly occurrence) regardless of which weekday the completion landed on. The repro shows applicable varying 1/3/7 — falsifying the 'already correct' null hypothesis and confirming the day-count-inflation hypothesis."
  fix_rationale: "Mirror the already-accepted `_computeS1Periodic` pattern (scoring.js) at the point scoreSnapshots.js computes the tooltip's `applicableToday`/`loggedToday` fields: for weekly/monthly cadence, mark applicable=true on exactly one day per cadence period (the first snapshotted day of that period, i.e. max(periodStart, snapshot-range start) — handles habits created mid-period), and loggedToday=true on that same day iff ANY completed log falls within [periodStart, min(periodEnd, today)]. All other cadence types (daily, day-of-week-subset, every-n-days) are untouched — appliesToday's per-day answer IS a valid per-day occurrence for those, matching computeS1's own scoping decision (`type === 'weekly' || type === 'monthly'`) so the fix is consistent with existing precedent, not a new invented category. This addresses the root cause (wrong denominator granularity) rather than a symptom (e.g. clamping displayed values or hiding the tooltip)."
  blind_spots: "(1) every-n-days cadence has an analogous 'stays applicable until completed' persistence (anchor-based, not calendar-period-based) that could show similar inflation over a rolling window — NOT fixed here, out of scope per the reported symptom (weekly only) and per computeS1's own precedent of leaving every-n-days unfixed; documented in KB for future work. (2) computeS2/computeS3 (js/domain/scoring.js) still use raw per-day appliesToday for ALL cadences including weekly/monthly — those scores (not the waveboard tooltip) may still be subtly affected for S2/S3 views, but that's a pre-existing, separately-scoped issue untouched by this fix and not part of the reported symptom (waveboard, S1-status heat-map). (3) monthly-cadence habits, once fixed, will show data in only 1 of ~4 week-columns per month on the (weekly-bucketed) waveboard grid — this is the correct/intended representation, not a new bug, but is a visible behavior change worth calling out during verification."
  candidate_causes:
    - "code: js/io/scoreSnapshots.js computes applicableToday/loggedToday via a raw per-day appliesToday() call, not period-aware, for weekly/monthly cadence habits (confirmed root cause)"
    - "config/data: N/A — not a settings or seed-data issue; reproduces with any weekly-cadence habit + any single completed log, confirmed independent of masteryThreshold/weekStart/window settings"
  and_gate: "no — single contributing cause (the day-granular applicableToday/loggedToday computation) fully explains the symptom; no second condition needs to co-occur. Confirmed by the repro requiring nothing beyond 'habit.cadence.type === weekly' + one completed log."

hypothesis: (superseded by reasoning_checkpoint above — CONFIRMED)
next_action: Implement the fix in js/io/scoreSnapshots.js per fix_rationale, then run full test suite, add regression test, verify, commit.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Any wave with recently-logged habits shows a non-zero completion percentage reflecting actual applicable-day completions. A weekly-cadence habit logged once this week should count as 1/1 (or however many weeks are in the aggregation window), not 1/7 or 0/7.
actual: "something is not correct yet. For example weekly habits on waveboard have 0/7 or 1/7 score but it should be log one per week..." (verbatim user report from UAT Test 1, phase 13)
errors: None reported
reproduction: Open desktop.html Wave Board / Analytics, look at a wave containing a weekly-cadence habit that has been logged recently.
started: Discovered during UAT for Phase 13 (Code Review & Documentation), v1.2 milestone. Phase 13 already fixed several stale `log.completed === true` boolean checks in js/domain/waveAggregates.js (D-43) to use log.status instead — this residual issue may be a related-but-distinct bug: the denominator/expected-occurrences calculation not being cadence-aware.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-16T00:05:00Z
  checked: js/domain/waveAggregates.js `_countForHabit` (uses ctx.appliesToday per log row) and its only callers
  found: `computeWaveAggregates` / `_countForHabit` are exported from js/domain/waveAggregates.js but grep across js/ shows ZERO callers outside test files (tests/unit/waveAggregates.test.js, tests/integration/wave-aggregates.test.js, tests/unit/stale-boolean-bugs.test.js). It is not wired into js/desktop.js, js/views/desktop/waveboard.js, or js/views/desktop/analytics.js.
  implication: computeWaveAggregates is dead code from the user's live-app perspective — fixing it alone would NOT fix what the user sees in the actual Wave Board UI. The live bug must be elsewhere.

- timestamp: 2026-09-16T00:07:00Z
  checked: js/views/desktop/waveboard.js `refresh()` / `buildWaveboardRows` and the cellTitle tooltip text
  found: The waveboard tooltip format is literally `t('desktop.waveboard.cellTitle', { status, completed: weekCell.completed, applicable: weekCell.applicable })` producing "{status} ({completed}/{applicable} days)" — this matches the user's reported "0/7"/"1/7" format exactly. `weekCell.applicable`/`completed` are built by summing, per ISO-week bucket, `row.applicableToday ? 1 : 0` and `row.loggedToday ? 1 : 0` across every score_snapshots row (one per calendar day) whose `date` falls in that week.
  implication: The live "X/7" ratio comes from per-day snapshot flags (score_snapshots.applicableToday/loggedToday) summed across all 7 days of a week, not from any wave-level cadence-aware occurrence count. This is the real code path to investigate.

- timestamp: 2026-09-16T00:10:00Z
  checked: js/io/scoreSnapshots.js `writeHabitSnapshots` — the `weekCompletions` closure and how `applicableToday` is computed per day
  found: For each `dateYMD` in the habit's date range, `ctx.evaluationDate = dateYMD`, then `applicableToday = appliesToday(habitForScoring, dateYMD, ctx)`. `ctx.weekCompletions(habitId, startYMD, endYMD)` caps its scan at `daysFrom(ctx.evaluationDate, -1)` (the day BEFORE the evaluation day) and counts completed logs in `[startYMD, cap]`. This means: for a weekly habit, every day from the ISO week's Monday up through and including the day it gets completed evaluates `appliesToday === true` (because weekCompletions looking backward from that day is still 0 — the completion log itself is excluded by the cap). Every day AFTER the completion day (within the same week) evaluates weekCompletions()===1 (backward scan now includes the completion day) so appliesToday === false.
  implication: For a weekly habit, `applicableToday` is true for every day from week-start through the completion day (inclusive), then false for the rest of the week. Summed across the week this produces `applicable = (0-indexed weekday of completion) + 1`, and `completed = 1` (only the completion day itself has loggedToday=true). E.g. completed Monday → 1/1. Completed Wednesday → 1/3. Completed Sunday (or never completed) → 1/7 or 0/7. This exactly reproduces the reported "0/7 or 1/7" symptom and confirms applicableToday's per-day "show today?" semantics are being misused as a per-day "occurrence" tally for aggregate reporting.

- timestamp: 2026-09-16T00:15:00Z
  checked: Empirical reproduction — simulated writeHabitSnapshots's day-loop + waveboard.js's weekly aggregation using the real js/domain/cadence.js appliesToday, for a weekly habit completed on Sunday of a Mon-start ISO week
  found: applicable=7, completed=1 → tooltip would read "(1/7 days)" for that week. When completed on Monday of the week, applicable=1, completed=1 → "(1/1 days)". Confirms the ratio is a function of WHICH DAY within the week the user happened to log, not the count of weekly occurrences (which is always exactly 1 per elapsed week).
  implication: Root cause confirmed — score_snapshots.applicableToday (as consumed by waveboard.js's per-day summation) is not a valid representation of "expected occurrences" for non-daily cadences. It answers a different question (UI-visibility for Today view) than the one the waveboard aggregation needs (how many independent cadence periods elapsed, and how many were satisfied).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "js/io/scoreSnapshots.js computed the score_snapshots.applicableToday/loggedToday fields (consumed by js/views/desktop/waveboard.js's per-ISO-week tooltip summation) via a raw per-day call to cadence.appliesToday(). For weekly/monthly cadence, appliesToday's semantics are 'still due this period' (true on every day from the period's start through the day of completion, false afterward) — a UI-visibility signal, not an occurrence count. Summing it across 7 calendar days (or ~30 for monthly) therefore yielded a denominator ranging 1-7 depending on which weekday the habit was completed (or 7/0 when never completed that week), instead of the cadence-correct 'one occurrence per elapsed period' denominator. Note: js/domain/waveAggregates.js's computeWaveAggregates (initially suspected per the task's project_context hints) is confirmed dead code with zero callers outside tests — it is NOT reachable from the live Wave Board UI and was not the source of the observed bug."
fix: "Added _snapshotApplicability(habit, dateYMD, weekStart, rangeStartYMD, todayYMD, logsForHabit, ctx, logForDate) to js/io/scoreSnapshots.js, mirroring the already-accepted _computeS1Periodic pattern in js/domain/scoring.js. For weekly/monthly cadence, exactly one day per cadence period is marked applicableToday=true (the period's start date, clamped forward to the snapshot range's start so habits created mid-period still get exactly one applicable day for their partial first period), carrying loggedToday=true iff any completed log falls within [periodStart, min(periodEnd, today)]. All non-periodic cadences (daily, day-of-week-subset, every-n-days) are unchanged, delegating straight to the existing appliesToday() call — matching computeS1's own scoping decision (type === 'weekly' || type === 'monthly') so the fix reuses an established categorization rather than inventing a new one."
verification: |
  target_test: { result: pass }
  mutation_check: { result: skipped, reason: "no Stryker / npm tooling in this project (zero-build, no-npm constraint per CLAUDE.md) — no mutation tool available" }
  no_op_deletion: { result: pass, evidence: "git diff --stat js/io/scoreSnapshots.js: 81 insertions(+), 3 deletions(-) — net-additive new helper function + call-site swap, not a deletion/no-op patch" }
  adjacent_tests: { result: pass, suites_run: "full project suite via node --test across tests/unit, tests/unit/io, tests/unit/views/desktop, tests/integration, tests/state/apply — 953/953 passing (876 pre-existing + 20 new tests in the driving test file), zero regressions" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, evidence: "git stash push -- js/io/scoreSnapshots.js (kept the new test file) -> 4 of the 7 new tests failed with actual values matching the bug shape exactly (7 instead of 1 for weekly-completed-Sunday and completion-boundary cases, 5 for mid-week-created habit, 11 for monthly) -> git stash pop -> all 20 tests pass again" }
  guardrail_verdict: accepted
files_changed:
  - js/io/scoreSnapshots.js
  - tests/unit/io/scoreSnapshots.test.js
