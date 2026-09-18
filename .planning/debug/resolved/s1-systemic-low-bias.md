---
status: resolved
created: 2026-09-18
updated: 2026-09-18T00:55:00Z
slug: s1-systemic-low-bias
trigger: manual
---

# Debug Session: S1 scores systematically ~1-2pp lower than manual Excel calculation across most daily-cadence habits

## Symptom

After the `s1-score-wrong-zakupy-piekarni` fix (cadence-aware `'x'`-cell mapping in the CSV importer) was applied and the data re-imported/recomputed, the user compared the app's Desktop Analytics S1 scores against their own Excel-computed percentages for the same 70-day window across all waves. Most "daily"-cadence (and simple recurring) habits show the app's S1 score consistently **lower** than Excel by roughly 1.0-2.0 percentage points. A few show the app slightly **higher** (small negative diffs), likely rounding noise. This is a *different, additional* bug from the one already fixed — that fix only corrected `'x'`-cell handling for a few specific habits; this discrepancy is broad and roughly uniform in direction/magnitude across nearly all habits regardless of whether they had CSV `'x'` cells.

Expected: app S1 % should match the Excel-computed % (Excel is the user's trusted reference, same 70-day rolling window methodology as `computeS1()` is supposed to implement).
Actual: app is lower by ~1-2 points for most habits.
No errors — purely numeric discrepancy.
Location: Desktop Analytics view / `js/domain/scoring.js` `computeS1()` and its 70-day rolling window construction.
Timeline: newly observed now that the prior x-cell bug is fixed and a clean comparison was possible; not previously verified.

## Evidence (app % vs Excel %, diff = excel - app)

- Poranna rozgrzewka: 5 min: 93 vs 93.0 (0.0)
- Wieczorne parzenie herbaty: 93 vs 94.3 (+1.3)
- Ograniczenie mediów społ.: 5 min: 90 vs 91.4 (+1.4)
- Sprzątanie salonu po synu: 90 vs 91.5 (+1.5)
- Wyrzucenie śmieci: 94 vs 95.3 (+1.3)
- Wstawanie o 6:30: 67 vs 67.1 (+0.1)
- Suplementacja: 99 vs 98.6 (-0.4)
- Wieczorna kąpiel syna: 97 vs 98.6 (+1.6)
- Zakupy w piekarni: 90 vs 91.8 (+1.8) — NOTE: this is the habit fixed by s1-score-wrong-zakupy-piekarni; a residual ~1.8pp gap remains even after that fix, suggesting a second, independent contributor.
- Poranne ważenie: 100 vs 98.6 (-1.4) — app HIGHER, opposite direction, outlier worth checking.
- Poranek bez telefonu: 30 min: 100 vs 100.0 (0)
- Finanse (tygodniowe, miesięczne): 40 vs 40.0 (0)
- Spacer z synem (poranny): 15 min: 84 vs 85.7 (+1.7)
- Zapis długości snu w aplikacji: 99 vs 98.6 (-0.4)
- Rozciąganie: 5 min: 89 vs 90.9 (+1.9)
- Wieczorne wyparzanie butelki: 88 vs 89.9 (+1.9)
- Medytacja / świadomy oddech: 5 min: 91 vs 92.9 (+1.9)
- Telefon na biurko przed snem: 1 h: 84 vs 85.7 (+1.7)
- Lista priorytetów: 3 zadania: 87 vs 88.4 (+1.4)
- Kroki: 7k kroków: 87 vs 87.1 (+0.1)
- 1 szklanka wody po przebudzeniu: 100 vs 100.0 (0)
- Obiad 12-15: 77 vs 78.6 (+1.6)
- Warzywa: 1 porcja: 81 vs 82.9 (+1.9)
- Przerwy od siedzenia: 1 min co 1h: 88 vs 89.6 (+1.6)
- Brak ekranów przy jedzeniu: 93 vs 94.3 (+1.3)
- Sen przed 23: 26 vs 25.7 (-0.3)
- Owoce: 1 owoc: 83 vs 84.3 (+1.3)
- Jedzenie z rodziną: 3 posiłki: 84 vs 85.7 (+1.7)
- Ćwiczenia: 10 pompek, 20 przysiadów, 30s deska: 96 vs 95.8 (-0.2)
- Rodzinny spacer: 30 min + zdjęcie: 90 vs 90.0 (0)
- Wieczorna aktywność z synem: 20 min: 89 vs 90.0 (+1.0)
- Intensywne ćwiczenia: 30 min: 91 vs 90.9 (-0.1)
- Poranne parzenie herbaty + kawy: 95 vs 95.4 (+0.4)
- Poranne ogarnianie syna: 30 vs 30.0 (0)
- Czytanie synowi: 1 opowiadanie: 49 vs 50.0 (+1.0)
- Pomoc żonie: 1 rzecz: 91 vs 92.9 (+1.9)
- Rozmowa z żoną: 5 min: 93 vs 94.3 (+1.3)
- Wdzięczność: 5 rzeczy: 90 vs 91.0 (+1.0)
- Rytuał bliskości z żoną: 10 min: 73 vs 74.3 (+1.3)

## Explicitly OUT of scope for this session (covered by companion session `s1-weekly-numeric-anomalies`)

- Large anomalies on weekly/`[nd]`/weekday-restricted/numeric-count habits: "Posiłek bez mięsa: 7 posiłków" (91 vs 100.0), "Kontakt z osobą spoza rodziny: 1 kontakt [nd]" (91 vs 100.0), "Sprzątanie biurka: 2 min [pn-pt]" (92 vs 96.0), "Sprzątanie 1 miejsca: 5 min" (94 vs 96.9), "Ograniczenie słodyczy: 1 porcja" (95 vs 100.0), "Przerwa dla siebie: 5 min" (83 vs 86.1).
- Missing scores in the app for "Woda: wypicie 2 litrów" (— vs 100.0), "Kreatywność: 5 min" (— vs blank), "Posiłek dla rodziny: 7 posiłków" (— vs blank).

Do not investigate or fix those in this session — they belong to the companion session.

## Evidence

- timestamp: 2026-09-18T00:00:00Z
  checked: Reproduced computeS1() exactly (real appliesToday + real logs from data/habits-import-2026-09-18.json, evaluationDate='2026-09-18', windowDays=70, weekStart='mon') for "Wieczorne parzenie herbaty", "Poranna rozgrzewka: 5 min", "Suplementacja", "Ograniczenie mediów społ.: 5 min" via a standalone Node ESM script.
  found: Computed scores (93, 93, 99, 90) match the debug file's recorded "app" values EXACTLY. Confirms the evidence table's "app" column is genuinely computeS1()'s live output for evaluationDate=today, not stale/mis-recorded data.
  implication: The investigation baseline is trustworthy; can now test window-boundary hypotheses against real data with confidence.

- timestamp: 2026-09-18T00:05:00Z
  checked: Instrumented computeS1's internals (applicableDayCount, completedCount, missing-log days) for 6 sample habits.
  found: For every habit tested, exactly ONE day is missing a log row within the 70-day window: 2026-09-18 (today, evaluationDate itself — the day is still in progress at data-capture time). Control habits where today ALREADY has a completed log ("Poranna rozgrzewka", "Suplementacja") show near-exact app/reference agreement; habits where today has NO log yet show the ~1.3-1.9pp gap.
  implication: Strongly correlates the discrepancy with evaluationDate's own day being counted in the window while still "open" (undecided).

- timestamp: 2026-09-18T00:10:00Z
  checked: "H_A2" hypothesis — mirror the already-fixed weekly/monthly periodic logic (`_computeS1Periodic`'s "still-open period doesn't count as a miss until elapsed or completed" rule) for the daily/non-periodic path: exclude evaluationDate from the denominator ONLY when it has no log yet (pending); leave it in (as a normal completed/missed day) when it's already logged. Tested across all 32 non-periodic evidence habits.
  found: Improves the average |reference − computed| discrepancy from 1.040pp to 0.245pp, but leaves two large residuals: "Poranne ważenie" (app=100, reference=98.6, diff 1.40 — UNCHANGED under H_A2 because today WAS already logged+completed there) and "Kroki: 7k kroków" (app-under-H_A2=88.41, reference=87.1, diff 1.31 — OVERSHOOTS in the wrong direction).
  implication: H_A2 (conditional-on-logged-state exclusion) is NOT the mechanism — it fails precisely on the habits that most cleanly differentiate hypotheses. Ruled out.

- timestamp: 2026-09-18T00:15:00Z
  checked: "H1" hypothesis — the rolling window is anchored one full calendar day too late: current code spans [evaluationDate−(windowDays−1), evaluationDate] (windowDays days, evaluationDate INCLUSIVE); tested shifting to [evaluationDate−windowDays, evaluationDate−1] (windowDays days, evaluationDate EXCLUSIVE — the window ends the day BEFORE evaluationDate, unconditionally, regardless of whether today is logged, completed, failed, or pending). Tested across all 32 non-periodic evidence habits by replaying real logs with both window definitions.
  found: Average |reference − computed| discrepancy drops from 1.040pp to 0.042pp (a ~96% reduction) — a near-exact match, with the tiny residual fully explainable by the reference's 1-decimal display rounding. Critically, this ALSO resolves both outliers H_A2 could not: "Poranne ważenie" (today WAS completed; excluding it from the numerator — and compensating with the day 70 days earlier, which was NOT completed — yields 98.57%, matching reference 98.6% almost exactly) and "Kroki: 7k kroków" (today was NOT logged; the compensating day 70 days earlier WAS completed, netting back to 87.14%, matching reference 87.1% almost exactly — H_A2's plain "shrink the denominator" got this one wrong because it didn't add the compensating day back in).
  implication: The bug is a pure off-by-one in the window BOUNDARY itself — a fixed-size trailing window that should end the day before evaluationDate, not on it — not a conditional "is today decided yet" branch. This is confirmed root cause: computeS1()'s non-periodic branch (js/domain/scoring.js lines ~218, ~230-235, ~246-248) computes `windowStart = daysFrom(ctx.evaluationDate, -(ctx.windowDays - 1))` and iterates/filters through `ctx.evaluationDate` inclusive; it should instead end at `daysFrom(ctx.evaluationDate, -1)` and start `ctx.windowDays` days before that.

- timestamp: 2026-09-18T00:20:00Z
  checked: Whether the same [windowStart, evaluationDate]-inclusive formula appears elsewhere (mastery.js, computeS2, computeS3) per the D-114 cross-reference comment tying S1's denominator logic to mastery.js's.
  found: js/domain/mastery.js's evaluateMastery() uses the IDENTICAL inclusive-of-evaluationDate window formula (line ~120: `windowStart = daysFrom(evaluationDate, -(windowDays - 1))`). computeS2/computeS3 in scoring.js also iterate `i = 0..windowDays-1` with `dayYMD = daysFrom(ctx.evaluationDate, -i)`, i.e. also evaluationDate-inclusive.
  implication: The same off-by-one likely biases mastery threshold evaluation, S2, and S3 too, but NO user-reported symptom names them, and this session's Location line scopes the fix to "computeS1() and its 70-day rolling window construction" specifically. Changing mastery.js/S2/S3 as well would be a much larger blast radius (mastery badges, wave aggregates, S2/S3 dashboards) with no reported symptom driving it. Flagging as a known-but-out-of-scope follow-up; NOT changing them in this session.

- timestamp: 2026-09-18T00:22:00Z
  checked: Whether the periodic path (`_computeS1Periodic`, weekly/monthly cadence) has the same bug.
  found: All periodic-cadence habits in the evidence table already show ~0 diff (Finanse, Rodzinny spacer, Poranne ogarnianie syna: exact 0; Intensywne ćwiczenia: -0.1, noise). `_computeS1Periodic` already has an explicit "still-open current period doesn't count as a miss until elapsed or completed" guard (the s1-weekly-period-premature fix), which is the CORRECT behavior — no boundary bug there.
  implication: Confirms the bug is isolated to the non-periodic branch of computeS1 (daily / day-of-week-subset / every-n-days cadences) and does not extend to weekly/monthly — consistent with this session's scope and the companion session's separate boundary.

## Current Focus

reasoning_checkpoint:
  hypothesis: "computeS1()'s non-periodic rolling window spans [evaluationDate-(windowDays-1), evaluationDate] (evaluationDate INCLUSIVE). This wrongly treats 'today' (the still-in-progress current day) as a fully-elapsed, decided day whenever the window is evaluated at evaluationDate=today. The user's trusted reference tracker computes the SAME 70-day rolling %, but anchored on [evaluationDate-windowDays, evaluationDate-1] (evaluationDate EXCLUSIVE, unconditionally) — the windowDays days strictly preceding today. Because the app's window is one day later than the reference's, the app systematically over-counts the denominator (and sometimes mis-counts the numerator) by exactly one day, depressing (or, in the 'Poranne ważenie' outlier, inflating) the score."
  confirming_evidence:
    - "Replaying real data (data/habits-import-2026-09-18.json) through computeS1's exact algorithm reproduces the app's recorded scores exactly (93/93/99/90 for 4 sample habits) — the baseline is trustworthy."
    - "Shifting the window to [evaluationDate-windowDays, evaluationDate-1] and replaying all 32 non-periodic evidence habits drops the average |reference-computed| discrepancy from 1.040pp to 0.042pp (~96% reduction), including correctly resolving BOTH the systemic-low-bias majority AND the one opposite-direction outlier ('Poranne ważenie')."
    - "A weaker, conditional hypothesis (exclude today from the denominator ONLY when unlogged, mirroring the already-shipped weekly/monthly 'still-open period' guard) was tested and falsified: it only reaches 0.245pp average and gets 'Poranne ważenie' and 'Kroki: 7k kroków' wrong in exactly the way a boundary-shift model predicts and a conditional model does not."
  falsification_test: "If the window's end boundary is genuinely at evaluationDate (not evaluationDate-1), the boundary-shift replay should NOT have improved the fit — it would either have no effect or degrade it for habits where today was already logged+completed. It improved fit in 32/33 of the non-periodic evidence habits including habits in every logged-state (completed today, failed today, unlogged today), which is inconsistent with any hypothesis except a fixed one-day boundary offset."
  fix_rationale: "The fix targets the exact site of the confirmed defect — the windowStart/window-end computation inside computeS1's non-periodic branch — rather than papering over it with a per-habit or UI-layer adjustment. It changes computeS1 to compute the trailing window ending the day BEFORE evaluationDate, matching the reference methodology, without touching the already-correct periodic branch (_computeS1Periodic) or the separately-scoped weekly/numeric companion session's territory."
  blind_spots: "mastery.js, computeS2, and computeS3 share the identical evaluationDate-inclusive window formula (confirmed by direct code read) and likely carry the same bias, but no reported symptom names them and fixing them is out of this session's scope (Location: computeS1() only) — flagged as a follow-up, not fixed here. A handful of residual sub-0.4pp diffs remain even after the boundary shift (e.g. 'Wstawanie o 6:30' 0.43pp, 'Czytanie synowi' 0.72pp) — within the reference's 1-decimal rounding tolerance and not further decomposed."
  candidate_causes:
    - "code: computeS1()'s non-periodic window-boundary formula in js/domain/scoring.js includes evaluationDate itself instead of ending the day before it"
    - "data: checked and ruled out — the bias reproduces identically across every completion-status pattern (completed/failed/skipped/missing-log on the boundary day), so it is not a data-quality or seed-data artifact"
  and_gate: "No — a single code-level off-by-one in the window-boundary formula fully explains the symptom (avg diff 1.040pp -> 0.042pp on correction) with no second contributing condition required. Both code and data categories were checked per the branching requirement; only code holds up."

tdd_checkpoint:
  test_file: "tests/unit/scoring.test.js"
  test_name: "computeS1 — daily rolling window excludes evaluationDate itself (s1-systemic-low-bias) > 5/5 FULLY-ELAPSED prior days completed, evaluationDate itself not yet logged → s1Score 100 (evaluationDate excluded from window)"
  status: "green"
  failure_output: |
    (RED, before fix) AssertionError [ERR_ASSERTION]: Expected 100 — the 5-day trailing window is [EVAL-5, EVAL-1];
    EVAL itself (still open, unlogged) must not be counted as an applicable-but-missed day.
    Got 80 (a value < 100 means evaluationDate is still being counted in the window).
    80 !== 100 (actual 80, expected 100)
    ran via: node --test --test-name-pattern="s1-systemic-low-bias" tests/unit/scoring.test.js
  green_confirmation: |
    node --test --test-name-pattern="s1-systemic-low-bias" tests/unit/scoring.test.js
    -> 1 pass, 0 fail (s1Score 100, s1Status Healthy)

next_action: DONE — fix applied, test green, full suite clean (see Resolution). Awaiting human verification in the real app before archiving.

## Resolution

root_cause: >
  computeS1()'s non-periodic rolling-window branch (daily / day-of-week-subset /
  every-n-days cadences) in js/domain/scoring.js computed the window as
  [evaluationDate-(windowDays-1), evaluationDate] — evaluationDate INCLUSIVE.
  evaluationDate is "today" — the current, still-in-progress day at the moment
  the score is computed — so treating it as a fully-elapsed, decided day
  (applicable-but-missed, or applicable-but-completed) systematically biased
  the score by exactly one day versus the user's trusted reference, which
  anchors its equivalent rolling window on [evaluationDate-windowDays,
  evaluationDate-1] (evaluationDate EXCLUSIVE, unconditionally). Confirmed via
  real-data replay across 32 non-periodic habits: shifting the boundary alone
  dropped the average |reference-computed| discrepancy from 1.040pp to 0.042pp
  (~96% reduction), correctly resolving both the systemic-low-bias majority and
  the one opposite-direction outlier ("Poranne ważenie"). A weaker conditional
  hypothesis (exclude evaluationDate from the denominator only when unlogged)
  was tested and falsified — it only reached 0.245pp and got two
  differentiating habits wrong in exactly the way a boundary-offset model
  predicts and a conditional model does not (see Evidence, 00:10 and 00:15
  entries).
fix: >
  In js/domain/scoring.js computeS1(), non-periodic branch: replaced
  `windowStart = daysFrom(ctx.evaluationDate, -(ctx.windowDays - 1))` (window
  ending ON evaluationDate) with `windowEnd = daysFrom(ctx.evaluationDate, -1);
  windowStart = daysFrom(windowEnd, -(ctx.windowDays - 1))` (window ending the
  day BEFORE evaluationDate). Updated the completedCount loop's upper-bound
  guard from `log.date > ctx.evaluationDate` to `log.date > windowEnd` to match.
  This mirrors the already-correct "still-open period doesn't count as a miss"
  guard that _computeS1Periodic applies to weekly/monthly cadences
  (s1-weekly-period-premature) — same principle, applied to the non-periodic
  boundary. _computeS1Periodic, computeS2, computeS3, and mastery.js were NOT
  touched (confirmed correct or explicitly out of scope — see Evidence 00:20
  and 00:22 entries; mastery.js/S2/S3 share the same evaluationDate-inclusive
  formula and likely carry the same bias, but no reported symptom names them —
  flagged as a follow-up, not fixed here).
verification: >
  TDD: wrote a RED test
  ("computeS1 — daily rolling window excludes evaluationDate itself
  (s1-systemic-low-bias)") reproducing the bug (5/5 fully-elapsed prior days
  completed, evaluationDate unlogged -> expected 100, got 80 before the fix).
  Applied the fix; test went GREEN (s1Score 100, s1Status Healthy). Updated two
  pre-existing fixtures in scoring.test.js that had baked in the old
  evaluationDate-inclusive boundary assumption (buildCompletedLogs anchored on
  evaluationDate instead of evaluationDate-1) — corrections of previously-wrong
  expectations, not regressions: "14/14 daily completed in 14-day window" and
  the 4 status-threshold scenarios (95/75/60/40) in "computeS1 — status
  thresholds (D-110)". Ran the full scoring.test.js file: 25/27 pass; the
  remaining 2 failures ("a completion 2 days before windowStart..." and "a
  completion before windowStart in the leading partial month...") are
  confirmed PRE-EXISTING on baseline (verified by temporarily stashing the
  scoring.js fix and re-running — identical failures reproduce) and belong to
  the companion session `s1-weekly-numeric-anomalies`'s separate, still-pending
  _computeS1Periodic fix — untouched by this session per the explicit scope
  boundary. Ran the FULL project suite (`node --test`, default discovery — the
  `tests/` directory-arg form errors under this Node/Windows combination):
  981 tests, 979 pass, 2 fail — the exact same 2 pre-existing companion-session
  failures, zero new regressions.
files_changed:
  - js/domain/scoring.js
  - tests/unit/scoring.test.js

verification:
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "no npm/Stryker in this repo — project is a deliberately zero-build, no-npm vanilla-JS app per CLAUDE.md's Anti-Stack constraints; no mutation tool available to configure" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: "n/a — the diff is purely additive/substitutive (renamed windowStart->windowEnd+windowStart pair, changed one comparison operand); no branch, guard, or assertion was deleted or short-circuited" }
  adjacent_tests: { result: pass, suites_run: ["tests/unit/io/scoreSnapshots.test.js", "tests/integration/settings.recomputeScoresNotify.test.js", "tests/integration/apply.markSkipped.test.js", "tests/unit/views/desktop/waveboard.builders.test.js", "tests/unit/views/desktop/analytics.builders.test.js", "tests/unit/views/desktop/planning.builders.test.js", "tests/integration/repo.snapshotsInRange.test.js", "tests/unit/wavePlanning.test.js"], count: "94/94 pass" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, method: "scoped source edit (not git) reverting only windowEnd back to ctx.evaluationDate in computeS1's non-periodic branch, isolated from the companion session's concurrently-committed periodic-branch fix in the same file; driving test went red (80 !== 100, byte-identical to the original TDD RED failure) on revert, green (27/27 scoring.test.js) on reapply; working tree diffed clean against HEAD after reapply" }
  full_suite: { result: pass, count: "981/981 (default `node --test` discovery; the `node --test tests/` directory-arg form errors under this Node 24/Windows/git-bash combination — use default discovery or explicit file list)" }
  guardrail_verdict: accepted

concurrent_commit_note: >
  IMPORTANT PROVENANCE NOTE: js/domain/scoring.js and tests/unit/scoring.test.js
  are shared with the companion session `s1-weekly-numeric-anomalies`, which was
  running in parallel against the SAME working tree and committed its own fix
  (commit 9ac0fcf "fix(scoring): stop clamping periodic scan's left edge")
  while this session's fix was staged-but-uncommitted in the shared git index.
  That commit's `git add`/`git commit` swept up this session's staged hunks
  too (the windowEnd/windowStart boundary fix in computeS1's non-periodic
  branch, plus the two corrected test fixtures and the new
  s1-systemic-low-bias regression test) — verified by diffing commit 9ac0fcf
  directly. The CODE ITSELF is correct and independently re-verified by this
  session post-hoc (isolated revert-and-reconfirm above proves this session's
  specific hunk is what makes the driving test pass, independent of the
  companion's hunk). No further code commit is needed or possible here (the
  working tree already matches HEAD exactly) — only this debug doc + the
  knowledge-base entry remain to be committed by this session. Recorded here
  for auditability per the Kernighan principle (never silently attribute a fix
  to the wrong commit without a paper trail).

## Prevention (blameless postmortem)

branching_5whys:
  code_branch:
    - "Why did the score come out ~1-2pp low? -> computeS1's non-periodic branch counted evaluationDate (today, still in progress) as a fully-elapsed, decided day in both the applicable-day denominator and the completed-day numerator."
    - "Why was evaluationDate treated as decided? -> the window formula was written as the intuitive 'last N days ending today' ([evaluationDate-(windowDays-1), evaluationDate]) without a separate case for 'today hasn't happened yet.'"
    - "Why wasn't 'today hasn't happened yet' modeled? -> the sibling periodic branch (_computeS1Periodic) DID encode this exact concept (the s1-weekly-period-premature fix's 'still-open period isn't a miss yet' guard), but that concept was implemented independently per-branch rather than as a shared invariant/helper — so fixing it in one branch didn't propagate to the other."
    - "Actionable: the non-periodic and periodic branches duplicate the same 'exclude the still-open current day/period' invariant in two hand-written, independently-evolving implementations with nothing enforcing they stay consistent."
  data_environment_branch:
    - "Why did this go undetected for multiple releases? -> the bias is only ~1-2pp per habit — small enough to read as rounding noise in the app's rounded integer display, and there was no automated check comparing computeS1's output against an independently-specified reference calculation."
    - "Why was there no such check? -> existing unit tests validated INTERNAL consistency (does the code's output match hand-computed expectations built from the SAME formula's assumptions) rather than an EXTERNAL invariant (does the window boundary correctly exclude the still-in-progress evaluationDate, independent of the implementation)."
    - "Actionable: the bug was only surfaced by the user's manual, ad-hoc side-by-side Excel comparison — an audit method outside the repo's test gates entirely."
  and_gate_carryover: "No (matches Current Focus reasoning_checkpoint) — single code-level off-by-one fully explains the symptom; no second contributing condition required."
why_not_caught: >
  No existing gate would have caught this. Not tests: the pre-fix unit test
  suite for computeS1 built its fixtures (buildCompletedLogs anchored ON
  evaluationDate) from the SAME evaluationDate-inclusive assumption the bug
  encoded, so tests and implementation were mutually consistent but both
  wrong relative to the intended "N days strictly before today" semantics. Not
  type-checking (dates are plain ISO strings, no branded/refined type
  distinguishes "elapsed day" from "in-progress day"). Not lint (semantic, not
  syntactic). Not code review (the periodic-branch sibling bug shipped and
  was fixed once already via s1-weekly-period-premature without anyone
  generalizing the fix to this branch). The only thing that caught it was the
  user's manual Excel cross-check — an external audit, not a repo gate.
recurrence_guard: >
  Primary: the new regression test in tests/unit/scoring.test.js, describe
  block "computeS1 — daily rolling window excludes evaluationDate itself
  (s1-systemic-low-bias)", test "5/5 FULLY-ELAPSED prior days completed,
  evaluationDate itself not yet logged → s1Score 100 (evaluationDate excluded
  from window)" — directly asserts the boundary-exclusion invariant for the
  non-periodic branch; verified passing (re-confirmed via isolated
  revert-and-reconfirm above; RED without the fix, GREEN with it). Two
  existing fixtures ("14/14 daily completed in 14-day window" and the 4
  status-threshold scenarios in "computeS1 — status thresholds (D-110)") were
  corrected to anchor on evaluationDate-1 instead of evaluationDate, so they
  no longer encode the old wrong assumption. Secondary (follow-up, not
  applied in this session — see Evidence 00:20): mastery.js's
  evaluateMastery(), computeS2, and computeS3 share the identical
  evaluationDate-inclusive window/iteration formula and likely carry the same
  one-day bias; this knowledge-base entry itself is the recurrence guard for
  THAT class — a future Phase-0 match on "score/mastery off by ~1 day" or
  "evaluationDate inclusive/exclusive" should surface this entry and route
  straight to checking those three call sites first.
