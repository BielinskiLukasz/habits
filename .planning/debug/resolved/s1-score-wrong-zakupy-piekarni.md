---
status: resolved
created: 2026-09-18
updated: 2026-09-18
slug: s1-score-wrong-zakupy-piekarni
trigger: manual
---

# Debug Session: S1 scoring model shows wrong score for "Zakupy w piekarni"

## Symptom

S1 scoring model shows wrong score for habit "Zakupy w piekarni" (data from `data\Nawyki v2.csv`) in the Desktop Analytics view.

- Expected: user completed the habit 45 times in the last 70 days, out of 49 applicable days (completed or failed) in that window. Expected score ~94-95% (45/49 rounded to whole percent... actually 45/49 = 91.8%; user states expected 94-95%, so the exact numerator/denominator the user has in mind should be reconciled with the app's rolling-window definition during investigation).
- Actual: app displays 73%.
- No console/UI errors — purely a wrong displayed number.
- Location: Desktop Analytics view (js/desktop.js + underlying score_snapshots / scoring.js S1 computation).
- Timeline: first time verifying this number against manual counting; no known prior-working baseline for this specific habit/value.
- Reproduction: open desktop analytics view, look at the S1 score for habit "Zakupy w piekarni" (seeded/imported from data\Nawyki v2.csv).

## Current Focus

bug_class: Bohrbug (deterministic — reproduces identically on every S1 recompute for this habit given the same log data)

hypothesis: CONFIRMED — see Resolution.root_cause below.

reasoning_checkpoint:
  hypothesis: "The habit 'Zakupy w piekarni' (Bakery shopping, id acf0a1ac-b622-4f62-a2b0-988cc32074d8) has cadence.type='daily' in the habit catalog, so js/domain/cadence.js appliesToday() returns true for every calendar day including Sundays. The source CSV (data/Nawyki v2.csv) marks Sundays (and one Polish public holiday, 2026-08-15) as 'x' (not applicable — bakery closed), and the converter script (data/convert-csv-to-import-2026-09-18.mjs) maps 'x' unconditionally to 'no log row' rather than checking whether the app's own cadence considers the day applicable. Because appliesToday() says these Sundays ARE applicable but no log row exists for them, js/domain/scoring.js computeS1() counts them as applicable-but-not-completed days, inflating the denominator and deflating the score from ~90% to the observed 73%."
  confirming_evidence:
    - "Reimplemented computeS1's exact rolling-window algorithm (windowDays=70, evaluationDate=2026-09-18, globalThreshold=90) against this habit's real imported logs from data/habits-import-2026-09-18.json: applicableDayCount=60, completedCount=44 -> round(44/60*100)=73 — reproduces the exact displayed 73% bug-for-bug."
    - "Of the 12 dates in that window with no log row at all, 11 are exactly the CSV's 'x' cells (2026-07-12, 07-19, 07-26, 08-02, 08-09, 08-16, 08-23, 08-30, 09-06, 09-13 = Sundays; 08-15 = Polish public holiday Wniebowzięcie NMP, a Saturday) and the 12th is 2026-09-18 = today, not-yet-logged (expected, unrelated to the bug)."
    - "Confirmed via direct CSV inspection (data/Nawyki v2.csv, row for 'Zakupy w piekarni') that every one of those 11 dates has raw cell value 'x', and the habit catalog entry (data/habits-import-2026-09-17.json) has cadence: {type: 'daily'}."
    - "Broader scan: 3 daily-cadence habits in the same dataset have 'x' cells in their CSV history (Zakupy w piekarni: 43 total, Przerwa dla siebie: 5 min: 74 total, Spacer z synem: 1 total) — confirms this is a systemic converter defect, not a one-habit data anomaly."
  falsification_test: "If the 11 missing-log Sundays did NOT align with the CSV's 'x' cells for this habit (e.g. if they were random gaps or 's'-skipped days instead), the cadence-mismatch hypothesis would be refuted. Direct byte-level CSV inspection confirmed 100% alignment — not falsified."
  fix_rationale: "The fix targets the root cause (converter silently drops 'x' cells regardless of whether the habit's own cadence agrees the day is inapplicable) rather than the symptom (this one habit's score). Reusing appliesToday() (the app's single source of truth for applicability, already used symmetrically by the CSV EXPORT path in js/io/export.js) to decide: if appliesToday() agrees the day is not applicable, no row is needed (existing behavior, correct); if appliesToday() would call the day applicable but the CSV author says 'x', emit an explicit status:'skipped' log — the exact mechanism scoring.js already uses to exclude 'the user consciously opted out' days from every model's denominator."
  blind_spots: "Have not verified whether data/habits-import-2026-09-18.json has already been imported into the user's live browser IndexedDB (vs. only generated on disk, per the 260918-kzo quick task's summary note 'ready for the user to load via Settings -> Import when they choose to'). If already imported, the user will need to re-import the regenerated JSON (merge-by-id is additive, safe) and run Settings -> Recompute Scores to see the corrected number. Also have not exhaustively checked every 'weekly'-cadence habit's x-cell handling under S2/S3 (per-day appliesToday-based models) beyond confirming the fix is cadence-agnostic and additive-only."
  candidate_causes:
    - "data: habit catalog assigns cadence.type='daily' to a habit whose real-world applicability has a recurring exception (bakery closed Sundays) that 'daily' cannot express"
    - "code: data/convert-csv-to-import-2026-09-18.mjs unconditionally maps CSV 'x' cells to 'no log row', without checking whether the habit's own cadence (appliesToday) already excludes that day — the actual defect, since the app already has a correct mechanism (status:'skipped') for exactly this case"
  and_gate: "no — the code defect alone fully explains and fixes the symptom without needing the data-side cadence to change. Retagging the habit's cadence type is not required and would not, by itself, be expressible for the one-off 2026-08-15 holiday exception anyway; fixing the converter's 'x'-cell handling (code) is sufficient and generalizes to all 3 affected habits."

tdd_checkpoint:
  test_file: "tests/unit/convert-csv-x-cell-cadence.test.js"
  test_name: "resolveNotApplicableCell: x-cell for a daily-cadence habit becomes a skipped log"
  status: "green"
  failure_output: |
    RED phase (superseded, pre-fix): AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    null !== 'skipped'
    at tests/unit/convert-csv-x-cell-cadence.test.js:51:12
    GREEN phase (post-fix, current): tests/unit/convert-csv-x-cell-cadence.test.js -> 3/3 pass.
    Full suite: node --test "tests/**/*.test.js" -> 976 tests, 976 pass, 0 fail — zero regressions.

next_action: "None — session resolved. Remind the user: the regenerated data/habits-import-2026-09-18.json must be re-imported via Settings -> Import (merge-by-id, additive-safe) and Settings -> Recompute Scores run, for the live app's Desktop Analytics view to reflect the fix — this debug session cannot write to the user's browser IndexedDB directly."

## Evidence

- timestamp: 2026-09-18T00:00:00Z
  checked: "js/domain/scoring.js computeS1() and js/domain/cadence.js appliesToday(), re-implemented by hand against data/habits-import-2026-09-18.json's real logs for habit acf0a1ac-b622-4f62-a2b0-988cc32074d8 (Zakupy w piekarni / Bakery shopping), windowDays=70, evaluationDate=2026-09-18"
  found: "applicableDayCount=60, completedCount=44, round(44/60*100)=73 — matches the app's displayed 73% exactly. Habit's cadence in the catalog is {type:'daily'}, so appliesToday() returns true for every day; 12 window dates have no log row at all, 11 of which are exactly the CSV's 'x' cells (10 Sundays + 1 Polish public holiday Saturday 2026-08-15), the 12th being today (not yet logged, expected)."
  implication: "The S1 denominator is inflated by days the habit's own source data marked 'not applicable' but that the app's cadence model (daily) cannot express as excluded, and for which the importer never wrote a status:'skipped' log to compensate."

- timestamp: 2026-09-18T00:05:00Z
  checked: "data/convert-csv-to-import-2026-09-18.mjs's per-cell mapping branch (line ~197): `else if (val === 'x' || val === 'n' || val === '') { /* no log row */ }`"
  found: "Every 'x'/'n' cell is unconditionally dropped with no row created, regardless of whether the target habit's cadence would otherwise mark the day applicable. No call to js/domain/cadence.js appliesToday() exists anywhere in this script."
  implication: "This is the actual code defect: the importer has no way to distinguish 'x cells the cadence already excludes' (safe to drop) from 'x cells the cadence would call applicable' (must become an explicit skipped log, or the day silently counts as a miss in every scoring model)."

- timestamp: 2026-09-18T00:10:00Z
  checked: "Broader scan across all 66 habits in data/Nawyki v2.csv for cadence.type vs 'x'-cell counts in the 2025-12-29..2026-09-18 window"
  found: "All habits are cadence.type 'daily' (30 habits) or 'weekly' (6 habits) in this catalog. 3 daily-cadence habits carry 'x' cells: Zakupy w piekarni (43 total x-cells across full history, 11 in the 70-day scoring window), Przerwa dla siebie: 5 min (74 total), Spacer z synem (poranny): 15 min (1 total). Weekly-cadence habits' 'x' cells (217 total) don't affect S1 (computeS1 uses _computeS1Periodic for weekly/monthly, which only checks for ANY completion per period, ignoring per-day skip status) but could still marginally affect S2/S3 (which use per-day appliesToday + skip-status directly, even for weekly cadence)."
  implication: "This is a systemic converter defect affecting at least 3 habits' S1 scores (Zakupy w piekarni confirmed with exact number match; the other 2 have the same mechanism and are very likely also under-scored), not an isolated one-habit anomaly. Fix should be cadence-agnostic (driven by appliesToday(), not a hardcoded 'daily' special-case) so it correctly handles all cadence types found in this dataset without needing to enumerate them."

## Resolution

root_cause: "data/convert-csv-to-import-2026-09-18.mjs maps every CSV 'x'/'n' cell to 'no log row' unconditionally, without checking whether the target habit's own cadence (js/domain/cadence.js appliesToday()) considers that day applicable. For habits whose cadence is too coarse to express a real-world exception (e.g. 'daily' cadence for a habit that has a recurring day it cannot occur, like a bakery closed on Sundays), this causes computeS1() (js/domain/scoring.js) to count those days as applicable-but-not-completed instead of excluded, deflating the score. Confirmed exact match: applicableDayCount=60/completedCount=44 -> 73%, identical to the displayed bug for habit 'Zakupy w piekarni'."
fix: "APPLIED. data/convert-csv-to-import-2026-09-18.mjs's resolveNotApplicableCell() now returns `appliesToday(habit, date, cadenceCtx) ? 'skipped' : null;` instead of unconditionally returning null. cadenceCtx.weekCompletions/monthCompletions are closures over the already-accumulated logs array (chronological per-habit iteration guarantees earlier dates are already pushed)."
verification: "GREEN. tests/unit/convert-csv-x-cell-cadence.test.js: 3/3 pass (x-cell for daily-cadence habit -> 'skipped'; x-cell already excluded by cadence -> null; x-cell before habit existed -> null). Full suite: node --test \"tests/**/*.test.js\" -> 976 tests, 976 pass, 0 fail — zero regressions. Regenerated data/habits-import-2026-09-18.json via `node data/convert-csv-to-import-2026-09-18.mjs` (66 habits, 8525 logs: completed=6789, failed=733, skipped=1003, 0 unmatched). Manually recomputed computeS1() (js/domain/scoring.js) against the regenerated logs for habit acf0a1ac-b622-4f62-a2b0-988cc32074d8 (Zakupy w piekarni / Bakery shopping), windowDays=70, evaluationDate=2026-09-18, globalThreshold=90: s1Score=90, s1Status='Healthy' — materially above the buggy 73%, in the user-expected ~90-95% range. The 11 formerly-dropped Sunday/holiday 'x' cells in the scoring window are now explicit status:'skipped' logs correctly excluded from the denominator by computeS1()'s existing skipped-day exclusion path."
files_changed:
  - "data/convert-csv-to-import-2026-09-18.mjs (fix applied: resolveNotApplicableCell delegates to appliesToday()) — gitignored, no git commit possible/expected for this file (matches precedent: quick-260917-g2a, quick-260918-kzo both note 'data/ gitignored, no commits')"
  - "data/habits-import-2026-09-18.json (regenerated with the fix; gitignored, not committed) — must be re-imported by the user via Settings -> Import (merge-by-id, additive-safe) followed by Settings -> Recompute Scores for the live Desktop Analytics view to show the corrected score"
  - "tests/unit/convert-csv-x-cell-cadence.test.js (new regression test, tracked in git, committed)"
oracle_type: "derived — the expected 'skipped' outcome is derived from the app's own documented 4-state log model (status:'skipped' excluded from every scoring denominator) and the CSV export format's own definition of 'x' (data/../CLAUDE.md: 'x = habit was not applicable... cadence excluded it'), not merely 'did not crash'."
