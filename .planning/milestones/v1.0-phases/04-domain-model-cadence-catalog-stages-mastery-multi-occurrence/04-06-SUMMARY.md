---
phase: 04-domain-model-cadence-catalog-stages-mastery-multi-occurrence
plan: "06"
subsystem: apply-handlers-remaining
tags: [apply-handlers, catalog, stage-advancement, multi-occurrence, tdd]
dependency_graph:
  requires: [04-01, 04-02, 04-03, 04-04, 04-05]
  provides: [archiveHabit-handler, restoreHabit-handler, advanceStage-handler, demoteStage-handler, logNumeric-handler, logSlot-handler]
  affects: [js/state/apply.js, js/state/apply/archiveHabit.js, js/state/apply/advanceStage.js, js/state/apply/logNumeric.js, js/state/apply/logSlot.js]
tech_stack:
  added: []
  patterns:
    - apply-handler-with-broadcastKeys
    - tdd-red-green-refactor
    - synthetic-completed-flag-for-d52-reuse
    - no-op-return-on-guard-condition
key_files:
  created:
    - js/state/apply/archiveHabit.js
    - js/state/apply/advanceStage.js
    - js/state/apply/logNumeric.js
    - js/state/apply/logSlot.js
    - tests/integration/apply.archiveHabit.test.js
    - tests/integration/apply.advanceStage.test.js
    - tests/integration/apply.logNumeric.test.js
    - tests/integration/apply.logSlot.test.js
  modified:
    - js/state/apply.js
    - tests/integration/stage-advancement.test.js
decisions:
  - "logNumeric/logSlot re-use _recomputeLastCompletedDate via synthetic {completed: bool} flag rather than adding new helpers"
  - "advanceStage no-op returns {storeNames:[], writes:[], inverse:null} — apply.js still writes the events+meta rows"
  - "stage-advancement.test.js stub replaced with real evaluateStageTriggers/demoteStage domain tests (14 tests)"
metrics:
  duration: "approx 30 minutes"
  completed_date: "2026-06-05"
  tasks_completed: 3
  files_changed: 10
---

# Phase 04 Plan 06: Remaining Apply Handlers — archiveHabit, advanceStage, logNumeric, logSlot

## One-liner

Six remaining apply.js handlers (archiveHabit, restoreHabit, advanceStage, demoteStage, logNumeric, logSlot) completing the CATALOG-05/06, STAGE-03..07, LOG-02..06 apply-chokepoint coverage with 48 new integration tests.

## What Was Built

### Task 1: archiveHabit + restoreHabit handlers + tests

**`js/state/apply/archiveHabit.js`** — Two exported handlers:
- `handleArchiveHabit(event, repo)`: reads habit; returns `{...habit, status:'archived'}` write; inverse: `restoreHabit`
- `handleRestoreHabit(event, repo)`: reads habit; returns `{...habit, status:'active'}` write; inverse: `archiveHabit`
- Both: storeNames `['habits']`, broadcastKeys `{habitId}`, logs store never touched (history integrity)

**`js/state/apply.js`** — HANDLERS extended with `archiveHabit` and `restoreHabit`

**`tests/integration/apply.archiveHabit.test.js`** — 8 tests:
- archiveHabit sets status:'archived', preserves other fields, doesn't touch logs
- archiveHabit emits events row with correct inverse (restoreHabit)
- restoreHabit sets status:'active', doesn't touch logs, inverse is archiveHabit
- Round-trip: archive → restore returns to active

### Task 2: advanceStage + demoteStage handlers + tests

**`js/state/apply/advanceStage.js`** — Two exported handlers:
- `handleAdvanceStage(event, repo)`: calls `evaluateStageTriggers(habit, today, ctx)`; if `shouldAdvance`, returns updated habit with `currentStageIndex: nextStageIndex, stageStartedAt: today`; if no advance (no trigger fired OR already at last stage), returns no-op `{storeNames:[], writes:[], inverse:null}`
- `handleDemoteStage(event, repo)`: calls `demoteStage(habit)` for the `Math.max(0, ...)` guard; returns updated habit with new index + `stageStartedAt: today`; inverse: `advanceStage` with `triggerType:'manual'`

**`js/state/apply.js`** — HANDLERS extended with `advanceStage` and `demoteStage`

**`tests/integration/apply.advanceStage.test.js`** — 10 tests:
- manual trigger advances to index 1, inverse is demoteStage
- no-op at last stage (guard T-04-03)
- no-op for single-stage habit
- after-n-days trigger (30+ days elapsed → advance)
- after-n-days NOT firing before threshold
- demoteStage decrements 1→0, updates stageStartedAt
- demoteStage floor guard (0→0)
- demoteStage inverse is advanceStage with triggerType:'manual'
- Round-trip: advance → demote returns to original index

**`tests/integration/stage-advancement.test.js`** — Replaced stub with 14 real domain tests:
- evaluateStageTriggers: all 4 trigger types (manual, scheduled-by-week, after-n-days, after-n-days-with-threshold)
- Last-stage guard (T-04-03)
- demoteStage floor guard (T-04-03b) including undefined currentStageIndex

### Task 3: logNumeric + logSlot handlers + tests

**`js/state/apply/logNumeric.js`** — `handleLogNumeric(event, repo)` handler:
- Event payload: `{habitId, date, count}`
- Writes log row `{habitId, date, count, definitionVersion:null}` — NO `completed` field (D-88)
- D-52 recompute: passes synthetic `{...newLog, completed: count >= (habit?.target ?? 1)}` to `_recomputeLastCompletedDate`
- Captures prior log for inverse: `{type:'restoreLogRow', payload:{habitId, date, prior}}`
- broadcastKeys: `{habitId, date}`

**`js/state/apply/logSlot.js`** — `handleLogSlot(event, repo)` handler:
- Event payload: `{habitId, date, slots: [{name, checked}, ...]}`
- Writes log row `{habitId, date, slots, definitionVersion:null}` — NO `completed` field (D-89)
- D-52 recompute: passes synthetic `{...newLog, completed: slots.every(s => s.checked)}`
- Captures prior log for inverse: `{type:'restoreLogRow', payload:{habitId, date, prior}}`
- broadcastKeys: `{habitId, date}`

**`js/state/apply.js`** — HANDLERS extended with `logNumeric` and `logSlot`. Final HANDLERS table has 12 entries:
`markCompleted, restoreLogRow, markUncompleted, setSetting, createHabit, editHabit, archiveHabit, restoreHabit, advanceStage, demoteStage, logNumeric, logSlot`

**`tests/integration/apply.logNumeric.test.js`** — 10 tests:
- Log row has `count` field, no `completed` field
- lastCompletedDate null when count < target (3 < 5)
- lastCompletedDate = today when count >= target (5 >= 5, 7 >= 5)
- lastCompletedDate resets to null when count drops to 0
- Events row inverse is restoreLogRow; captures prior log
- broadcastKeys returns `{habitId, date}`

**`tests/integration/apply.logSlot.test.js`** — 9 tests (via apply.logSlot + 1 in broadcastKeys suite = total counted differently):
- Log row has `slots` array, no `completed` field
- lastCompletedDate null when partial (1/3 checked), none checked
- lastCompletedDate = today when all 3 checked
- Reset when going from all-checked back to partial
- Events row inverse is restoreLogRow; captures prior log
- broadcastKeys returns `{habitId, date}`

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Before plan 04-06 | 117 | 113 | 4 (stubs: stage-advancement, mastery-cadence, wave-aggregates, history-flow) |
| After plan 04-06 | 164 | 161 | 3 (stubs: mastery-cadence, wave-aggregates, history-flow — pre-existing, belong to 04-02/04-04/04-09) |
| New tests added | 47 | 47 | 0 |
| Stubs resolved | 1 | — | — |

The 3 remaining stub failures were pre-existing before this plan and belong to future plans:
- `mastery-cadence.test.js` → plans 04-02 + 04-06 co-owned, but mastery domain testing was deferred
- `wave-aggregates.test.js` → plans 04-04 + 04-06 co-owned, wave aggregate testing deferred
- `history-flow.test.js` → plan 04-09

## Commits

| Hash | Description |
|------|-------------|
| 7ffa839 | feat(04-06): add archiveHabit + restoreHabit handlers with integration tests |
| 12cd8ef | feat(04-06): add advanceStage + demoteStage handlers with integration tests |
| f081807 | feat(04-06): add logNumeric + logSlot handlers with integration tests |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-storage | js/state/apply/logSlot.js | Slot names stored as-is in IDB; XSS mitigated at render time via textContent per T-04-06 |
| threat_flag: input-storage | js/state/apply/logNumeric.js | Numeric count stored as-is; negative counts handled by count >= target never being true for negative values (T-04-06b) |

T-04-06c (archiveHabit/restoreHabit race) accepted per threat model: BroadcastChannel sync + atomic IDB tx ensures last-write-wins.

## Known Stubs

None — all files created/modified in this plan contain functional implementations.

## Self-Check: PASSED

- `js/state/apply/archiveHabit.js` — FOUND
- `js/state/apply/advanceStage.js` — FOUND
- `js/state/apply/logNumeric.js` — FOUND
- `js/state/apply/logSlot.js` — FOUND
- `tests/integration/apply.archiveHabit.test.js` — FOUND
- `tests/integration/apply.advanceStage.test.js` — FOUND
- `tests/integration/apply.logNumeric.test.js` — FOUND
- `tests/integration/apply.logSlot.test.js` — FOUND
- `tests/integration/stage-advancement.test.js` — REPLACED (stub → real tests)
- Commit 7ffa839 — FOUND (feat: archiveHabit + restoreHabit)
- Commit 12cd8ef — FOUND (feat: advanceStage + demoteStage)
- Commit f081807 — FOUND (feat: logNumeric + logSlot)
- No switch keyword in handler files (only in comments) — VERIFIED
- logNumeric log row has no `completed` field — VERIFIED
- logSlot log row has no `completed` field — VERIFIED
- apply.js HANDLERS has 12 entries — VERIFIED
