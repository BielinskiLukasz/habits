---
phase: "06"
plan: "03"
subsystem: settings-scoring
tags: [scoring, settings, tdd, di-seam, builders, apply]
dependency_graph:
  requires: [js/io/scoreSnapshots.js (06-02), js/domain/scoring.js (06-01), js/state/apply.js]
  provides: [buildScoringModelCard, buildDataCard.isRecomputing, apply.onLogWrite, settings.recomputeScores, settings.scoringModelCard]
  affects: [js/views/settings.js, js/views/settings/builders.js, js/state/apply.js, js/main.js, js/desktop.js, js/views/toast.js]
tech_stack:
  added: []
  patterns: [onLogWrite DI seam in apply.js, scoring model radio group pattern, isRecomputing loading state, showSuccessToast 4s auto-dismiss]
key_files:
  created: []
  modified:
    - js/views/settings/builders.js
    - js/state/apply.js
    - js/views/settings.js
    - js/main.js
    - js/desktop.js
    - js/views/toast.js
    - tests/unit/builders.settings.test.js
    - tests/integration/settings.mount.test.js
decisions:
  - D-122: buildScoringModelCard radio group pattern mirrors buildScheduleCard (name="scoringModel", data-action="setScoringModel")
  - D-123: Recompute button sits in settings-data-recompute div BEFORE Undo section; isRecomputing toggles text and disabled attr
  - onLogWrite DI seam non-fatal: snapshot failure must never block the mutation (try/catch swallows)
  - showSuccessToast added to toast.js following showErrorToast pattern (4s auto-dismiss, success variant)
  - settings.mount.test.js card count updated 6->7 (Scoring Model card addition)
metrics:
  duration: "~11 min"
  completed: "2026-06-29"
  tasks_completed: 2
  files_created: 0
  files_modified: 8
  tests_added: 10
---

# Phase 06 Plan 03: Snapshot Write-Time Trigger + Settings Model Selector + Recompute Action Summary

**One-liner:** `apply.js` onLogWrite DI seam fires `writeHabitSnapshots` on every log-mutating event, plus S1/S2/S3 Scoring Model radio card and "Recompute Scores" button wired into Settings with loading state and success toast.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| T1 RED | test | 0afab4d | Failing tests for buildScoringModelCard and Recompute button (10 new test cases, RED confirmed via SyntaxError: export not provided) |
| T2 GREEN | feat | 93752d7 | Implement builders, apply.js DI seam, settings.js wiring; all 30 builders tests pass + full suite 753/755 |

## What Was Built

### js/views/settings/builders.js

**`buildScoringModelCard({ scoringModel = 'S1' })`** — New exported builder:
- Returns `<section class="settings-card" aria-labelledby="settings-scoring-model-h2">`
- `<h2>Scoring Model</h2>` with matching id
- `<fieldset class="settings-radio-group">` with `<legend>Scoring model</legend>` and 3 radio labels
- Radio values: `S1`, `S2`, `S3` with labels "S1 — Rolling Threshold", "S2 — Day-Weighted", "S3 — Load-Adjusted"
- Active radio carries `checked: ''`; all three carry `data-action="setScoringModel"`

**`buildDataCard` extension** — Added `isRecomputing = false` parameter:
- New `settings-data-recompute` div block BEFORE the Undo section
- Button `data-action="recomputeScores"`, `aria-label="Recompute Scores"`
- When `isRecomputing: false` → text "Recompute Scores", no disabled attr
- When `isRecomputing: true` → text "Recomputing…", `disabled: ''` attr

### js/state/apply.js

**`_onLogWrite` DI seam** (SCORING-03):
- Module-level `let _onLogWrite = async (_habitId) => {};` — no-op default
- `configure(deps)` now accepts `onLogWrite` field
- After `await _notify(...)`, if `keys && keys.habitId`, calls `await _onLogWrite(keys.habitId)` inside try/catch (non-fatal — snapshot failure never blocks mutation)
- Fires for: `markCompleted`, `markUncompleted`, `restoreLogRow`, `logNumeric`, `logSlot`

### js/views/toast.js

**`showSuccessToast(message)`** — New exported function:
- 4s auto-dismiss via `_showToast({ message, autoDismissMs: 4000, variant: 'success' })`
- Follows same pattern as `showErrorToast`

### js/views/settings.js

**Scoring Model card mounted** after Mastery card:
- Reads `cachedSettings.scoringModel ?? 'S1'` at mount
- `wireScoringModelCard(cardEl, actions)` helper wires `change` listeners on all `[data-action="setScoringModel"]` radios
- `refreshLiveCards()` refreshes card[6] (Scoring Model) on `store.notify()` — re-reads `cachedSettings.scoringModel`

**`setScoringModel` action** (D-122):
- Reads radio value from `evt.currentTarget.value ?? evt.target.value`
- Validates against `['S1', 'S2', 'S3']`
- Dispatches `apply({ type: 'setSetting', payload: { key: 'scoringModel', value } })`

**`recomputeScores` action** (D-123, SETTINGS-06):
- Sets Data card to `isRecomputing: true` state
- Calls `await rebuildAllSnapshots(repo)`
- Shows `showSuccessToast('Snapshots recomputed. All scores updated.')`
- Notifies store subscribers (triggers desktop view refresh)
- Restores Data card via `refreshLiveCards()` after completion

**Desktop analytics link** (D-115, DESKTOP-01):
- `<p class="settings-desktop-link"><a href="./desktop.html">Open desktop analytics →</a></p>`
- Appended after all cards inside the panel wrapper

### js/main.js + js/desktop.js

Both entry points now pass `onLogWrite` to `configureApply`:
```javascript
onLogWrite: async (habitId) => {
  try { await writeHabitSnapshots(habitId, repo); } catch (_e) {}
}
```

### tests/unit/builders.settings.test.js

10 new test cases in 2 new describe blocks:

**`buildScoringModelCard` tests (6 tests):**
- Section wrapper class + h2 text
- Fieldset with 3 named radios
- Correct radio checked per param
- All radios carry data-action
- Radio values are S1/S2/S3
- aria-labelledby chain

**`buildDataCard isRecomputing` tests (4 tests):**
- isRecomputing=false: text + no disabled
- isRecomputing=true: text + disabled
- data-action + aria-label present
- Default (omitted) behaves as false

### tests/integration/settings.mount.test.js (Rule 1 auto-fix)

Updated card count assertion from 6 to 7 and title list to include 'Scoring Model'.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] settings.mount.test.js card count out of sync**
- **Found during:** T2 GREEN full suite run
- **Issue:** Test asserted `cards.length === 6` and exact title array; adding Scoring Model card (7th) caused assertion failure
- **Fix:** Updated assertion to `7` and titles array to include `'Scoring Model'`
- **Files modified:** tests/integration/settings.mount.test.js
- **Commit:** 93752d7

**2. [Rule 2 - Missing functionality] showSuccessToast not in toast.js**
- **Found during:** T2 GREEN implementation
- **Issue:** Plan referenced `showSuccessToast` but it didn't exist in toast.js; only `showErrorToast`, `showUndoToast`, `showUpdateToast` existed
- **Fix:** Added `showSuccessToast(message)` to toast.js following `showErrorToast` pattern (4s auto-dismiss, `variant: 'success'`)
- **Files modified:** js/views/toast.js
- **Commit:** 93752d7

**3. [Rule 3 - Path deviation] Test file path**
- **Found during:** T1 RED setup
- **Issue:** Plan specified `tests/unit/views/settings.builders.test.js` (new file) but existing tests live at `tests/unit/builders.settings.test.js`
- **Fix:** Added new test cases to the existing file rather than creating a new path that would orphan the existing tests
- **Impact:** Zero behavioral difference; avoids duplication of imports and helpers
- **Commit:** 0afab4d

## Known Stubs

None. All wiring is complete:
- `buildScoringModelCard` fully implemented and exported
- `buildDataCard.isRecomputing` fully implemented
- `apply.js` `onLogWrite` DI seam fires and is wired in both entry points
- Settings `recomputeScores` action calls real `rebuildAllSnapshots`
- Desktop link renders with correct href

## Threat Flags

None. Changes are:
- Pure builder functions (no DOM, no network)
- DI seam extension in apply.js (no new stores or trust boundaries)
- Settings action dispatches through existing `apply()` chokepoint (D-75 compliant)
- `rebuildAllSnapshots` writes only to `score_snapshots` IDB store (same boundary as 06-02)

## TDD Gate Compliance

- RED gate: `test(06-03)` commit `0afab4d` — SyntaxError ERR_ASSERTION on missing `buildScoringModelCard` export (RED confirmed)
- GREEN gate: `feat(06-03)` commit `93752d7` — 30/30 builders tests passing + 753/755 full suite (2 pre-existing stubs)

## Self-Check

### Files modified exist:
- js/views/settings/builders.js — FOUND (buildScoringModelCard exported, isRecomputing param added)
- js/state/apply.js — FOUND (_onLogWrite DI seam added)
- js/views/settings.js — FOUND (Scoring Model card + Recompute action + desktop link)
- js/main.js — FOUND (onLogWrite wired)
- js/desktop.js — FOUND (onLogWrite wired)
- js/views/toast.js — FOUND (showSuccessToast added)
- tests/unit/builders.settings.test.js — FOUND (10 new tests)
- tests/integration/settings.mount.test.js — FOUND (card count 6->7)

### Commits exist:
- 0afab4d — FOUND (test(06-03): failing tests for buildScoringModelCard and Recompute button)
- 93752d7 — FOUND (feat(06-03): scoring model card, recompute action, apply.js onLogWrite DI seam)

### Tests pass:
- `node --test tests/unit/builders.settings.test.js` → 30/30 pass
- Full suite: 753/755 pass (2 pre-existing stubs from plans 04-02 and 04-04)

## Self-Check: PASSED
