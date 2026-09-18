---
status: resolved
created: 2026-09-18
updated: 2026-09-18T01:00:00Z
slug: s1-weekly-numeric-anomalies
trigger: manual
---

# Debug Session: S1 scores badly wrong (or missing entirely) for weekly / weekday-restricted / numeric-count habits

## Symptom

Comparing the app's Desktop Analytics S1 scores against the user's Excel-computed reference percentages (same 70-day window), most habits show only a small ~1-2pp gap (tracked separately in companion session `s1-systemic-low-bias`), but a distinct subset of habits — all weekly-cadence, `[nd]` (no-data/weekly?) tagged, weekday-restricted (`[pn-pt]`, `[sb]`), or numeric-count habits — show much larger gaps (4-9 percentage points), and three habits show **no S1 score at all** in the app (displayed as `—`) despite the user's Excel reference having a real value for at least one of them.

Expected: app S1 % should match Excel's %, or at minimum every habit with real logged history should show *some* S1 score (not `—`).
Actual: large discrepancies (4-9pp) on the habits below, and total absence of a score for "Woda: wypicie 2 litrów" (Excel: 100.0%).
No errors — purely numeric/missing-data discrepancy.
Location: Desktop Analytics view / `js/domain/scoring.js` `computeS1()`, `js/domain/cadence.js` `appliesToday()` for weekly/weekday-restricted cadence types, and `js/io/scoreSnapshots.js` snapshot write path (for the missing-score cases — no snapshot row may exist at all for "Woda").
Timeline: newly observed now that the prior x-cell bug (`s1-score-wrong-zakupy-piekarni`) is fixed and a clean wave-by-wave comparison against Excel was possible; not previously verified.

## Evidence (app % vs Excel %, diff = excel - app)

- Posiłek bez mięsa: 7 posiłków: 91 vs 100.0 (+9.0) — numeric weekly-count habit.
- Kontakt z osobą spoza rodziny: 1 kontakt [nd]: 91 vs 100.0 (+9.0) — `[nd]` weekly-ish cadence.
- Sprzątanie biurka: 2 min [pn-pt]: 92 vs 96.0 (+4.0) — weekday-restricted cadence (Mon-Fri only).
- Sprzątanie 1 miejsca: 5 min: 94 vs 96.9 (+2.9) — daily, but notably bigger gap than the ~1-2pp systemic bias seen elsewhere; may be same root cause as this session's bigger anomalies or may belong to the other session — investigate and reclassify if it turns out to be the small systemic bias instead.
- Ograniczenie słodyczy: 1 porcja: 95 vs 100.0 (+5.0) — daily but large gap.
- Przerwa dla siebie: 5 min: 83 vs 86.1 (+3.1) — previously flagged (in the s1-score-wrong-zakupy-piekarni session's broader scan) as having unconverted CSV `'x'` cells like "Zakupy w piekarni" did; check whether the user has already re-imported the regenerated `data/habits-import-2026-09-18.json` (which should already contain the fix for this habit too) — if the gap persists after confirming re-import, it's a distinct bug, not a stale-import artifact.
- Woda: wypicie 2 litrów: **no score shown (—)** in app vs 100.0 in Excel. Check whether: (a) this habit has zero log rows at all in the imported data, (b) it has logs but no `score_snapshots` rows were ever written for it (snapshot write path bug), or (c) it's a numeric-type habit whose S1 computation path errors/short-circuits silently.
- Kreatywność: 5 min: — vs (blank in Excel too) — likely NOT a bug (habit has no history yet in either source); confirm and exclude from findings if so.
- Posiłek dla rodziny: 7 posiłków: — vs (blank in Excel too) — likely NOT a bug for the same reason; confirm and exclude.

## Explicitly OUT of scope for this session (covered by companion session `s1-systemic-low-bias`)

- The small, uniform ~1.0-2.0pp low bias seen across most daily-cadence habits (e.g. Zakupy w piekarni 90 vs 91.8, Rozciąganie 89 vs 90.9, Medytacja 91 vs 92.9, etc.) — that is a separate, already-tracked investigation. Do not attempt to fix the general rolling-window bias here; focus only on the cadence-specific (weekly/`[nd]`/weekday-restricted/numeric) anomalies and the missing-score cases listed above.

## Current Focus

reasoning_checkpoint:
  hypothesis: "`_computeS1Periodic()` in js/domain/scoring.js clamps the LEFT edge of its per-period completion scan to `windowStart` (`effectiveStart = pStart < windowStart ? windowStart : pStart`). For the leading period that straddles the rolling window's start (pStart < windowStart <= pEnd), any completion that actually landed in the invisible slice [pStart, windowStart) is hidden from the scan. Because that leading period is still `elapsed` (pEnd <= evaluationDate), it gets counted as `expected`, and with the completion hidden it also gets wrongly counted as NOT completed — an already-satisfied weekly/monthly period is misclassified as a miss purely because the window boundary bisects it."
  confirming_evidence:
    - "Meatless meal ('Posiłek bez mięsa: 7 posiłków', weekly, binary): direct computeS1() call on the real imported data reproduces the app's 91. Manual period-by-period trace shows the leading ISO week (2026-07-06..2026-07-12) has a real completed log on 2026-07-06 — one day BEFORE windowStart (2026-07-11) — which the clamped scan never sees, so that period counts as a miss (10/11=91) instead of a hit (11/11=100, matching Excel exactly)."
    - "Contact outside family ('Kontakt z osobą spoza rodziny: 1 kontakt [nd]', weekly, binary): identical mechanism — leading week 07-06..07-12 has completions on 07-05 AND 07-06, both before windowStart 07-11, both invisible to the clamped scan. computeS1() gives 91 (10/11); with the full period visible it would be 100 (11/11), matching Excel exactly."
    - "New regression tests written and run RED against current code: 'a completion 2 days before windowStart (same leading period) is not misclassified as a miss' → got 67, expected 100. 'a completion before windowStart in the leading partial month is not misclassified as a miss' (monthly parity) → got 67, expected 100. Both fail with the exact predicted mechanism."
    - "Two regression-safety tests (boundary-neighbor: completion exactly ON windowStart; leading period genuinely never completed) already PASS under current code, confirming the bug is specifically about invisible-before-windowStart completions, not periodic boundary handling in general."
  falsification_test: "If the leading period's completion scan is changed to use the FULL period [pStart, pEnd] (clamped only on the right, to evaluationDate) instead of [effectiveStart=max(pStart,windowStart), effectiveEnd], and the two real habits above still compute to 91 instead of 100, the hypothesis is wrong. (Manually traced by hand — both resolve to 100 with this change; confirmed by the now-failing unit tests before the fix, which is the automated equivalent of this same falsification test.)"
  fix_rationale: "The rolling window's left edge should bound which PERIODS are counted (via `pEnd <= evaluationDate` / `hasCompletion`), not which DAYS are visible when checking a counted period for completion. Scanning the full period for a completion (not clamped to windowStart) directly addresses the root cause — a period is either genuinely completed or not, independent of where the 70-day window happens to cut across it. This is NOT a data/config issue (cadence type, startDate, and log data are all correct for both habits) — it is purely an algorithmic boundary defect in scoring.js, the same file (and même function) that was already touched once before for a *different* boundary bug (s1-weekly-period-premature, the RIGHT/future edge). This is the LEFT/past edge's analogous defect, never previously covered by a test."
  blind_spots: "Have not yet re-run the FULL scoring.js test suite after the fix to confirm zero regressions elsewhere (planned next step, green phase). Have not verified this exact scenario against every weekly/monthly habit in the full dataset — only the 2 flagged in Symptoms; other periodic habits not in the flagged list are assumed unaffected only insofar as their leading period either has no completion in the invisible slice or isn't clipped at all (not exhaustively re-verified against Excel for the full catalog, which is out of this session's scope)."
  candidate_causes:
    - "code: js/domain/scoring.js _computeS1Periodic — left-edge clamp on the completion scan (CONFIRMED — see confirming_evidence)"
    - "data: habit cadence/startDate/log misconfiguration for the two flagged weekly habits — CONSIDERED AND RULED OUT: both habits have correct `cadence.type: 'weekly'`, correct startDate, and their raw log rows are exactly as expected (real completions exist on the dates identified); nothing about the data itself is wrong, only the algorithm's visibility window over it."
  and_gate: "no — the single code defect (left-edge clamp) fully explains and fixes both flagged weekly-cadence anomalies without requiring any other contributing condition. Confirmed by hand-tracing both real habits to exactly Excel's 100.0% with only this one change."

tdd_checkpoint:
  test_file: "tests/unit/scoring.test.js"
  test_name: "describe('computeS1 — weekly cadence leading-window completion visibility (s1-weekly-numeric-anomalies)') + describe('computeS1 — monthly cadence leading-window completion visibility (s1-weekly-numeric-anomalies)') — 4 tests total"
  status: "green"
  failure_output: |
    (historical RED output, prior to fix)
    ✖ a completion 2 days before windowStart (same leading period) is not misclassified as a miss
      AssertionError: Expected 100 ... got 67
    ✖ a completion before windowStart in the leading partial month is not misclassified as a miss
      AssertionError: Expected 100 ... got 67
    (all 4 tests GREEN after fix — see Resolution.verification)

next_action: "DONE — fix applied and verified, session archived. No further action."

## Investigation Findings (Evidence log)

- timestamp: 2026-09-18T00:00:00Z
  checked: data/habits-import-2026-09-18.json habit + log rows for "Posiłek bez mięsa: 7 posiłków" (id 4e3b69aa-...), fed through the real computeS1()/appliesToday() with evaluationDate=2026-09-18, windowDays=70, weekStart=mon.
  found: computeS1() returns 91 — matches the app's displayed score exactly, confirming the reproduction is faithful. Habit is cadence.type='weekly', targetType='binary' (NOT numeric — the "7 posiłków" in the name is a target label, not a numeric-count log; the original symptom's "numeric weekly-count habit" characterization was a misclassification based on the habit's display name).
  implication: numeric-completion-threshold hypothesis is ruled out for this habit — it's pure weekly-periodic scoring, no numeric target logic involved.

- timestamp: 2026-09-18T00:05:00Z
  checked: manual period-by-period trace of _computeS1Periodic's loop for the same habit (11 ISO weeks from windowStart 2026-07-11 to evaluationDate 2026-09-18).
  found: the leading period (2026-07-06..2026-07-12) is clamped to effective range [2026-07-11, 2026-07-12] for the completion scan. A real 'completed' log exists at 2026-07-06 (inside the true period, before windowStart) — invisible to the clamped scan. Period counted as expected+missed. All 10 other periods counted expected+completed. 10/11 = 91%. Removing the left clamp (scanning the full period) makes the leading period count as completed too: 11/11 = 100%, matching Excel exactly.
  implication: root cause is the completion scan's left-edge clamp to windowStart, not a cadence-type or numeric-handling defect.

- timestamp: 2026-09-18T00:10:00Z
  checked: same trace for "Kontakt z osobą spoza rodziny: 1 kontakt [nd]" (id 10c6bca3-..., cadence.type='weekly', targetType='binary').
  found: identical mechanism — leading week 2026-07-06..2026-07-12 has completions on both 07-05 and 07-06 (both before windowStart 2026-07-11), both invisible. computeS1() gives 91 (10/11); full-period visibility gives 100 (11/11), matching Excel exactly. Confirms the defect is NOT specific to one habit's data — it's the shared `_computeS1Periodic` algorithm.
  implication: single code-level root cause explains both flagged weekly-cadence anomalies. `[nd]` in the habit name is cosmetic (a day-of-week annotation for the user's own reference) and has no bearing on cadence.type, which is 'weekly' for both — the "[nd]-tagged cadence" framing in the original symptom is not a distinct cadence mechanism.

- timestamp: 2026-09-18T00:15:00Z
  checked: "Sprzątanie biurka: 2 min [pn-pt]" (id 212e5713-..., cadence.type='daily' — NOT day-of-week-subset despite the "[pn-pt]" Mon-Fri annotation in the name). Ran computeS1() as-is (92) and again with cadence forcibly changed to day-of-week-subset(mon-fri) (still 92, identical) — because every weekend day in this habit's logs already carries status:'skipped', which computeS1's day-loop excludes regardless of cadence type. The weekday/cadence-mismatch hypothesis is therefore falsified by direct experiment.
  found: the actual 4pp gap (92 vs Excel's 96.0) is fully explained by a DIFFERENT, unrelated mechanism: 2026-09-18 (today, the evaluation date itself) is cadence-applicable (a Friday) but has NO log row yet (the user hasn't checked in yet today) — the day-loop counts it as an applicable-but-not-completed day anyway. applicableDayCount=26, completedCount=24 → 24/26=92.3%→92. Excluding today from the denominator (25 applicable) gives 24/25=96%, exactly matching Excel.
  implication: this is the SAME "today counted prematurely, before it has elapsed" mechanism the companion session `s1-systemic-low-bias` is independently investigating (their own hypothesis explicitly names this exact mechanism, and their debug file explicitly places this habit OUT of their scope / into this session's scope). Per the orchestrator's scope_note for this session, fixing the general rolling-window "today" bias is explicitly out of scope here. NOT FIXED in this session — flagged for cross-session awareness only. The apparent "4pp, cadence-specific" magnitude is just the same 1-day error landing on a much smaller denominator (26 applicable days, vs ~70 for a long-lived plain-daily habit) because this habit is short-lived (started 2026-08-10) and weekday-restricted in practice (even though mis-tagged as cadence.type='daily').

- timestamp: 2026-09-18T00:20:00Z
  checked: "Sprzątanie 1 miejsca: 5 min" (id 1d301cb7-..., cadence.type='daily', started 2026-08-17). computeS1() as-is = 94. applicableDayCount=33 (includes today, 2026-09-18, which has NO log). Excluding today: 31/32 = 96.875% ≈ 96.9, matching Excel's 96.9 essentially exactly (integer-rounding vs Excel's 1-decimal display accounts for the entire residual).
  found: identical "today counted prematurely" mechanism as Sprzątanie biurka above — fully explains the "notably bigger gap" the original symptom flagged for reinvestigation.
  implication: reclassified per the debug file's own contingency note ("investigate and reclassify if it turns out to be the small systemic bias instead") — this IS that case. Same cross-session disposition as Sprzątanie biurka: not fixed here, flagged for cross-session awareness (companion session `s1-systemic-low-bias` owns the general "today" mechanism, but their own scope note places these two specific habits' symptom entries into this session — so this session owns the *investigation and disposition* of these two entries, which is now closed as "confirmed same root cause as companion session, no session-local fix applied").

- timestamp: 2026-09-18T00:25:00Z
  checked: "Ograniczenie słodyczy: 1 porcja" (id 7e69b963-..., cadence.type='daily', started 2026-08-31, status='scheduled' but startDate is in the past — daysBetween to today=18, well past both the 7-day grace period and past status-promotion; status field doesn't gate scoring anyway). computeS1() as-is = 95 (18/19 applicable, today's NO-LOG day counted as a miss).
  found: excluding today (2026-09-18, NO-LOG) gives 18/18 = 100.00%, matching Excel's 100.0 exactly.
  implication: identical "today counted prematurely" mechanism, 100% explains the full 5pp gap. Same disposition as the two Sprzątanie habits above — not fixed here (out of scope), cross-session note only.

- timestamp: 2026-09-18T00:30:00Z
  checked: "Przerwa dla siebie: 5 min" (id fe4b4ab1-..., cadence.type='daily', started 2026-03-30 — long-lived, well outside grace period). Previously flagged in the s1-score-wrong-zakupy-piekarni session as possibly having stale unconverted CSV 'x'-cells. computeS1() as-is = 83 (30/36 applicable). Excluding today's NO-LOG day: 30/35 = 85.71% ≈ 86, vs Excel's 86.1 — a residual ~0.4pp gap remains, but that magnitude matches the companion session's documented "small systemic bias" range (their evidence table shows residuals from -0.4 to +1.9pp for habits with no known additional defect).
  found: the data being tested (data/habits-import-2026-09-18.json) is the ALREADY-REGENERATED file per the s1-score-wrong-zakupy-piekarni fix (same filename the KB entry names as containing that fix). applicableDayCount=36 (not the ~60 that an unfixed daily-cadence-cannot-express-off-days habit would show), consistent with the x-cell fix already being present in this data. No large stale-artifact gap remains.
  implication: the previously-suspected stale-import artifact is NOT present in this data (already resolved by the prior session's fix). The residual gap is fully accounted for by (a) the shared "today" mechanism (out of scope, companion session) and (b) the small systemic bias (out of scope, companion session's exact stated territory). No distinct in-scope bug for this habit. Not fixed here.

- timestamp: 2026-09-18T00:35:00Z
  checked: "Woda: wypicie 2 litrów" (id a72a9143-..., cadence.type='daily', status='scheduled', startDate='2026-09-14' — in the PAST relative to today 2026-09-18, so `bootScheduled()`'s runPromotion() would flip it to 'active' on next boot; status doesn't gate scoring regardless). Habit has 4 real 'completed' log rows (2026-09-14..2026-09-17, i.e. 100% completion so far). habit.createdAt is absent from the imported row (not written by the import path), so `writeHabitSnapshots`'s fallback chain uses `habit.startDate` ('2026-09-14') as the effective createdAt for grace-period purposes.
  found: `isInGracePeriod('2026-09-14', '2026-09-18')` → daysBetween=4, `4 < 7` → TRUE. computeS1() returns `{s1Score: null, s1Status: null}` for every day from 2026-09-14 through today — this is the documented, intentional 7-day grace period (SCORING spec: "habits < 7 days old return null scores"), not a snapshot-write-path bug or a numeric-computation short-circuit.
  implication: NOT A BUG. The app is correctly suppressing the score during the mandatory grace period; Excel has no equivalent concept and simply averages available data regardless of habit age, which is why it shows 100.0% while the app correctly shows "—". This will resolve on its own once the habit is ≥7 days old (2026-09-21). No fix applied or needed.

- timestamp: 2026-09-18T00:40:00Z
  checked: "Kreatywność: 5 min" (startDate 2026-09-28, future) and "Posiłek dla rodziny: 7 posiłków" (startDate 2026-09-21, future) — both status='scheduled' with a startDate strictly AFTER today (2026-09-18).
  found: `writeHabitSnapshots`'s `dateRange(startDate, endDate)` generator yields zero iterations when startDate > endDate (today) — no score_snapshots rows are ever written for a not-yet-started habit, so `getLatestSnapshot()` returns nothing and the Analytics view correctly renders "—". Excel is also blank for both (no data exists yet in either source).
  implication: NOT A BUG, confirmed exactly as the debug file's own contingency note predicted ("likely NOT a bug... confirm and exclude"). No fix needed.

## Eliminated

- hypothesis: "numeric-count habits' completion threshold logic in computeS1() treats partial-count days incorrectly, causing the weekly-numeric gaps."
  evidence: "Posiłek bez mięsa" and "Posiłek dla rodziny" (the two habits whose names read as numeric counts, e.g. "7 posiłków") both have `targetType: 'binary'` in the actual habit catalog, not 'numeric'. No numeric-typed habit is among the flagged anomalies at all. The LOG_COMPLETED['numeric'] path in scoring.js was never exercised by any of the flagged habits.
  timestamp: 2026-09-18T00:05:00Z

- hypothesis: "'[nd]'-tagged habits use a distinct cadence mechanism that miscounts the applicable-day denominator."
  evidence: "Kontakt z osobą spoza rodziny... [nd]" has `cadence.type: 'weekly'` — identical to the non-'[nd]' weekly habit "Posiłek bez mięsa". '[nd]' is a cosmetic day-of-week annotation in the Polish name only, with no corresponding field or branch anywhere in cadence.js or scoring.js. Both habits share the exact same root cause (leading-window completion visibility), confirming '[nd]' is not itself a distinct mechanism.
  timestamp: 2026-09-18T00:10:00Z

- hypothesis: "'Sprzątanie biurka: 2 min [pn-pt]' shows a 4pp gap because its cadence.type is wrongly stored as 'daily' instead of 'day-of-week-subset' (Mon-Fri), inflating the applicable-day denominator with weekend days."
  evidence: "Direct experiment: recomputed computeS1() for this habit with cadence forcibly corrected to day-of-week-subset(mon-fri) — result unchanged (92, identical to the as-is 'daily' cadence result). Every weekend day in this habit's actual log data already carries status:'skipped', which computeS1's day-loop excludes regardless of what appliesToday() would say for that day. The cadence-type mismatch (a real, separate data quality issue) has zero effect on this habit's S1 score."
  timestamp: 2026-09-18T00:15:00Z

- hypothesis: "'Woda: wypicie 2 litrów' shows no score due to a score_snapshots write-path bug (rows never written) or a numeric-computation silent short-circuit."
  evidence: "Traced writeHabitSnapshots()'s effectiveCreatedAt fallback chain and computeS1()'s grace-period guard by hand: rows ARE written (dateRange('2026-09-14','2026-09-18') yields 5 iterations), each with s1Score=null because isInGracePeriod('2026-09-14','2026-09-18') evaluates true (4 < 7). This is the intended design (7-day grace period), not a write-path defect. habit.targetType is 'binary', not 'numeric' — the numeric-short-circuit hypothesis doesn't apply to this habit at all."
  timestamp: 2026-09-18T00:35:00Z

## Resolution

root_cause: "js/domain/scoring.js `_computeS1Periodic()` clamped the LEFT edge of its per-period completion-detection scan to `windowStart` (`effectiveStart = pStart < windowStart ? windowStart : pStart`), instead of scanning the full period `[pStart, pEnd]`. For the leading period straddling the rolling window's start, this hid any completion that landed before `windowStart` but within that same period — an already-completed weekly/monthly period was misclassified as a miss purely because the window boundary bisected it. Confirmed as the exact cause of the two genuinely cadence-specific anomalies in scope: 'Posiłek bez mięsa: 7 posiłków' (91→100) and 'Kontakt z osobą spoza rodziny: 1 kontakt [nd]' (91→100)."
fix: "APPLIED/VERIFIED. In `_computeS1Periodic` (js/domain/scoring.js), removed the left-edge clamp on the completion scan: the scan's lower bound is now `pStart` directly (the true, un-clamped period start) instead of `effectiveStart = max(pStart, windowStart)`. The `effectiveStart` variable was removed entirely since it's no longer needed. The right-edge clamp (`effectiveEnd = pEnd > ctx.evaluationDate ? ctx.evaluationDate : pEnd`) is unchanged — a period still cannot be checked for completion past the evaluation date. The window's left edge (`windowStart`) still bounds which PERIODS get iterated (via `periodPtr` starting at `windowStart`); it no longer also clips visibility into a counted period's own completion data. Comments added explaining the boundary-role distinction between period-selection and completion-visibility, and cross-referencing this session."
verification: "4 new regression tests in tests/unit/scoring.test.js: the 2 previously-RED bug-reproducing tests ('a completion 2 days before windowStart (same leading period) is not misclassified as a miss' and 'a completion before windowStart in the leading partial month is not misclassified as a miss') are now GREEN (100 as expected, was 67). The 2 regression-safety tests (boundary-neighbor: completion exactly ON windowStart; leading period genuinely never completed) remain GREEN — no over-correction. All pre-existing tests in the file, including the s1-weekly-period-premature periodic-boundary tests (current open week/month not prematurely counted as a miss), still pass. `node --test tests/unit/scoring.test.js` → 27/27 pass, 0 fail. Full suite `node --test tests/**/*.test.js` (83 test files) → 981/981 pass, 0 fail, zero regressions elsewhere."
files_changed:
  - js/domain/scoring.js (fix: removed left-edge clamp in _computeS1Periodic's completion scan)
  - tests/unit/scoring.test.js (new regression tests added; RED confirmed, now GREEN)

### Non-fix dispositions (documented, no session-local code change)

These four habits' 92-95 vs 96-100 gaps are NOT caused by the left-edge-clamp
defect fixed in this session (that defect only affects `_computeS1Periodic`,
i.e. weekly/monthly-cadence habits; all four of these are `cadence.type:
'daily'`). Their root cause — evaluationDate itself being counted as an
applicable-but-not-yet-completed day in `computeS1`'s plain daily rolling
window — belongs to companion session `s1-systemic-low-bias`, which owns and
is independently fixing that "today" mechanism. No code change was made here
for these four; they are cross-session notes only, confirmed by direct
experiment (see Investigation Findings above) to require no session-local fix.

- "Sprzątanie biurka: 2 min [pn-pt]" (92 vs 96.0) — reclassified: root cause is the shared "today counted as applicable-but-not-yet-completed" mechanism, owned by companion session `s1-systemic-low-bias`. Not fixed here.
- "Sprzątanie 1 miejsca: 5 min" (94 vs 96.9) — reclassified: same mechanism as above, same companion-session ownership. Not fixed here.
- "Ograniczenie słodyczy: 1 porcja" (95 vs 100.0) — reclassified: same mechanism as above, same companion-session ownership. Not fixed here.
- "Przerwa dla siebie: 5 min" (83 vs 86.1) — the previously-suspected stale-import x-cell artifact is confirmed already resolved by the prior `s1-score-wrong-zakupy-piekarni` fix; residual gap fully explained by the shared "today" mechanism (companion-session ownership) plus the small systemic bias (also companion-session territory). Not fixed here.
- "Woda: wypicie 2 litrów" (— vs 100.0) — NOT A BUG. Correct 7-day grace-period suppression (habit effectively 4 days old). Will resolve naturally by 2026-09-21.
- "Kreatywność: 5 min" and "Posiłek dla rodziny: 7 posiłków" (— vs blank) — NOT A BUG. Both future-scheduled (startDate after today); no data exists yet in either source.
