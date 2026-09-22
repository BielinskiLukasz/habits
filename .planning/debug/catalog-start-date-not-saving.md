---
status: awaiting_human_verify
trigger: "Editing a future (\"scheduled\") habit in the Catalog screen — the start date field cannot be edited/changed. Start date input is editable but the change does not persist/save."
created: 2026-09-18
updated: 2026-09-18
---

## Symptoms

- Expected: editing a scheduled habit's start date in the Catalog edit form should save the new date.
- Actual: the start date field is editable, but after saving, the old date is still shown (the edit does not persist).
- Error messages: none reported.
- Timeline: not sure whether this ever worked before.
- Reproduction: open Catalog, edit a habit with status `scheduled` (future `startDate`), change the start date field, save, observe the date reverts / does not change.

## Current Focus

bug_class: Bohrbug (deterministic — reproduces on every editHabit call that includes startDate, not just scheduled habits; only *noticed* on scheduled habits because that's where the stale date has visible consequences)

reasoning_checkpoint:
  hypothesis: "js/state/apply/editHabit.js::handleEditHabit destructures event.payload but omits `startDate` from the destructure list and never assigns it onto habitRow, so `habitRow.startDate` always falls through to `{...priorHabit}`'s original value regardless of what the Catalog edit form submitted."
  confirming_evidence:
    - "Read js/state/apply/editHabit.js lines 51-63: destructured fields are {habitId, name, name_pl, wave, cadence, targetType, target, stages, masteryThresholdOverride, masteryWindowOverride} — startDate is absent from this list."
    - "Read js/state/apply/editHabit.js lines 76-85: habitRow = {...priorHabit} then conditionally overrides only the destructured fields with `if (x !== undefined) habitRow.x = x`. Since `startDate` was never destructured, no such line exists for it — habitRow.startDate is always whatever priorHabit.startDate already was."
    - "Read js/views/catalog.js lines 423-451 ('save-edit' action): payload sent to apply({type:'editHabit'}) DOES include `startDate: fields.startDate || null`, collected live from the `<input data-field=\"startDate\">` in the edit panel (js/views/catalog/builders.js lines 403-419) — so the UI correctly submits the new date, the apply-layer handler is what drops it."
    - "git log -p on js/views/catalog.js shows `startDate: fields.startDate || null` was present in the very first commit that added the 'save-edit' action (feat(04-05)) — this has been broken since the editHabit feature was first built in v1.0 Phase 4, never specific to the later v1.1 scheduled-habits feature."
    - "tests/integration/apply.editHabit.test.js (existing, 4 tests) never asserts on `startDate` after an edit — the gap in test coverage matches the gap in the implementation exactly."
  falsification_test: "Write an integration test: createHabit with startDate=2099-01-01 (status scheduled), then editHabit with startDate=2099-06-15, then repo.getHabit(id).startDate. If the hypothesis is correct, the assertion `startDate === '2099-06-15'` FAILS (still reads '2099-01-01'). Ran this as the TDD red-phase test — see tdd_checkpoint below. Result: test failed exactly as predicted, with the stale original date value, confirming the hypothesis and ruling out UI/collection-layer causes (catalog.js/builders.js were proven correct as part of the evidence trail above, not just assumed)."
  fix_rationale: "The fix adds `startDate` to the destructured payload fields and adds `if (startDate !== undefined) habitRow.startDate = startDate;` alongside the other optional-field overrides — following the exact established pattern already used for every other optional field in this handler (name_pl, wave, cadence, targetType, target, stages, masteryThresholdOverride, masteryWindowOverride). This addresses the root cause (missing field wiring) rather than a symptom — it does not touch the UI layer (already correct) or add any new special-casing."
  blind_spots: "Did not investigate whether editing startDate on an ALREADY-ACTIVE habit to a future date should retroactively flip status back to 'scheduled' (mirroring createHabit.js's `sd > todayLocal() ? 'scheduled' : 'active'` derivation) — this is a separate, broader behavioral question not raised in the bug report, and the existing boot-time runMigration()/runPromotion() passes in js/domain/scheduled.js self-heal status/startDate consistency on next app load regardless, so scope is kept to 'the field persists what the user typed', matching the literal reported symptom. Did not check versionRow — habit_versions rows intentionally omit startDate already (createHabit.js's versionRow has the same exclusion), so no change needed there for consistency."
  candidate_causes:
    - "code: handleEditHabit's payload destructure/override list omits startDate (confirmed — direct read of the file)"
    - "config: none found — no config value gates which fields editHabit persists"
  and_gate: "no — the single code omission in editHabit.js fully and deterministically reproduces the reported symptom; no second condition (environment, data state, timing) is required. Confirmed by reading the complete call path with no conditional branches that would need a second failure to trigger."

hypothesis: "editHabit apply handler silently drops startDate from the payload — confirmed root cause"
test: "TDD red-phase: integration test asserting editHabit updates startDate; expect FAIL before fix"
expecting: "test fails with stale startDate value, proving reproducibility, then fix + re-run to green"
next_action: "Fix applied and guardrail passed (all 5 signals). Awaiting human verification of the real Catalog UI flow: edit a scheduled habit's start date, save, confirm the new date persists and is displayed after reload. On confirmation, archive session to .planning/debug/resolved/ and append knowledge-base entry."

tdd_checkpoint:
  test_file: "tests/integration/apply.editHabit.test.js"
  test_name: "editHabit updates startDate when provided (catalog-start-date-not-saving regression)"
  status: "green"
  prior_status: "red (confirmed 2026-09-18 — failure_output: AssertionError, actual '2099-01-01' expected '2099-06-15')"
  companion_test: "editHabit leaves startDate unchanged when omitted from payload (undefined-safety boundary) — GREEN before AND after fix."
  oracle_type: "derived — asserts against the handler's own documented contract (\"only explicitly-provided fields update the row\"), applied consistently to startDate the same way it already applies to every sibling field."

## Evidence

- timestamp: 2026-09-18T00:00:00Z
  checked: js/views/catalog.js buildActions()['save-edit'] and js/views/catalog/builders.js buildEditPanel()
  found: "The Catalog edit form correctly renders an editable `<input type=\"date\" data-field=\"startDate\">` pre-filled with habit.startDate, and 'save-edit' correctly reads it via collectPanelFields() and includes `startDate: fields.startDate || null` in the editHabit apply payload."
  implication: "UI layer (form rendering + field collection + payload construction) is NOT the defect. Rules out hypotheses about the date input not being wired, mount() not setting the value attribute, or collectPanelFields() misreading date-type inputs."

- timestamp: 2026-09-18T00:05:00Z
  checked: js/state/apply/editHabit.js handleEditHabit()
  found: "Destructured payload fields (line 52-63) omit `startDate`. habitRow is built via `{...priorHabit}` plus explicit `if (field !== undefined) habitRow.field = field` lines for name, name_pl, wave, cadence, targetType, target, stages, masteryThresholdOverride, masteryWindowOverride — startDate has no corresponding line, so it is never overwritten regardless of what the caller sent."
  implication: "This is the root cause: the apply-layer handler silently ignores the startDate field that the UI correctly submits. Every editHabit call effectively re-persists priorHabit.startDate unchanged."

- timestamp: 2026-09-18T00:08:00Z
  checked: tests/integration/apply.editHabit.test.js (all 4 existing tests) and .planning/debug/knowledge-base.md
  found: "No existing test asserts habit.startDate changes after an editHabit call. No knowledge-base entry matches this pattern (closest entries are about habit_versions/history integrity and waveboard IDB iteration, unrelated)."
  implication: "Confirms 'why not caught': the test suite covers editHabit's name/versioning/NFR-10 behavior thoroughly but has a coverage gap specifically for startDate — consistent with a defect that survived since v1.0 Phase 4 undetected."

- timestamp: 2026-09-18T00:10:00Z
  checked: "git log -p -- js/views/catalog.js (feat(04-05) commit, first version of buildActions save-edit)"
  found: "`startDate: fields.startDate || null` was present in the payload from the very first commit implementing the edit panel, i.e. this has always been sent by the UI and always dropped by the handler — not a recent regression."
  implication: "Confirms this is a long-standing Bohrbug (deterministic, always reproduces), not a recent regression or environment-specific issue. Explains why symptom was only reported now: scheduled habits (introduced later in v1.1) are the first case where a stale startDate has an obviously visible, actionable consequence (habit stays in 'Upcoming' with the wrong date, or user expects to reschedule it and can't)."

## Eliminated

- hypothesis: "The date `<input>` field itself is not correctly wired (mount() value attribute, data-field mismatch, or collectPanelFields() misreading type='date' inputs)"
  evidence: "Direct read of js/views/catalog/builders.js buildEditPanel() (lines 403-419) shows correct `data-field=\"startDate\"` attribute and pre-filled value; js/views/catalog.js collectPanelFields() reads `input.value` for any non-checkbox/non-number type, which correctly covers type='date' inputs; 'save-edit' action includes `startDate: fields.startDate || null` in the outgoing payload."
  timestamp: 2026-09-18T00:06:00Z

## Resolution

root_cause: "js/state/apply/editHabit.js::handleEditHabit never destructures or applies the `startDate` field from event.payload, so edits to a habit's start date are silently discarded — the habits row always keeps the pre-edit startDate via the `{...priorHabit}` spread, even though the Catalog UI (js/views/catalog.js + builders.js) correctly collects and submits the new value."
fix: "Added `startDate` to the destructured payload fields in handleEditHabit and added `if (startDate !== undefined) habitRow.startDate = startDate;` immediately after the masteryWindowOverride line, following the established per-field override pattern already used for every sibling optional field. Also added `startDate?: string|null` to the JSDoc payload type. No changes to versionRow/priorVersion (startDate is intentionally excluded from habit_versions rows, matching createHabit.js's existing convention) and no changes to the UI layer (already correct)."
verification:
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker / npm tooling in this zero-dependency project (CLAUDE.md anti-stack forbids npm)", mutant_killed: null }
  no_op_deletion: { result: pass, deletion_justified_by_rca: null, note: "diff is pure addition — 3 insertions (destructure field, conditional override line, JSDoc type line), zero deletions; confirmed via `git diff --stat` showing '3 insertions(+)'" }
  adjacent_tests: { result: pass, suites_run: ["full suite: node --test tests/**/*.test.js — 985 tests, 349 suites, 0 failures"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, note: "git stash push -- js/state/apply/editHabit.js reverted the fix; the regression test failed with actual '2099-01-01' expected '2099-06-15' (bug returned); git stash pop reapplied the fix (3 insertions restored exactly); re-ran tests, all 6 green again." }
  guardrail_verdict: accepted
files_changed:
  - tests/integration/apply.editHabit.test.js (2 new regression tests: startDate persists when provided; startDate preserved when omitted)
  - js/state/apply/editHabit.js (destructure startDate from payload; add conditional override `if (startDate !== undefined) habitRow.startDate = startDate;`; JSDoc payload type updated)
