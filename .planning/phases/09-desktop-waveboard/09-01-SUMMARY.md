---
plan: 09-01
status: complete
completed_at: 2026-08-25T00:00:00Z
commits:
  - 2d3db70 test(09-01): add failing WAVE-01 test for buildWavePlanningSection
  - 37dc7a1 feat(09-01): implement buildWavePlanningSection skeleton — WAVE-01 green
  - cd24fcf test(09-01): add WAVE-02/03/04 tests — all pass (full impl in skeleton)
tests_added: 7
---

# Summary

## What was built

**`js/views/desktop/wavePlanning.js`** — new pure builder module exporting
`buildWavePlanningSection({ waves, habits, currentWeekKey, snapshotsByWeek })`.
Returns a `section.waveplanning` description tree covering all four requirements:

- **WAVE-01**: one `div.waveplanning-wave` per wave with `button.waveplanning-wave-header`
  carrying `aria-expanded="false"`, `aria-controls="wave-{N}-list"`,
  `aria-label="Toggle habit list for Wave {N}"`, and `span.waveplanning-wave-date`
  rendering `wave.startDate`.
- **WAVE-02**: `span.waveplanning-wave-counts` with text `"{N} active · {N} scheduled"`
  (active includes mastered; middle dot ·).
- **WAVE-03**: `li.waveplanning-scheduled-row` per scheduled habit with
  `span.waveplanning-scheduled-date` and `button.waveplanning-promote-btn[data-habit-id]`.
- **WAVE-04**: `li.waveplanning-habit-row` per active/mastered habit with
  `span.waveplanning-habit-status`, `span.waveplanning-habit-stage`,
  `span.waveplanning-habit-cadence` (via `cadenceSummary` dispatch table, no switch).

Health badge (D-05/D-06): Upcoming when no `status==='active'` habits exist; No data when
snapshots are absent; otherwise uses `worstStatus` + `statusSlug` + `STATUS_LABEL` map to
produce `At Risk` (not raw `At-risk`).

**`js/views/desktop/waveboard.js`** — added `export` to three previously private helpers:
`isoWeekKey`, `worstStatus`, `statusSlug` so `wavePlanning.js` can import them.

## TDD note

Task 1's GREEN implementation was written comprehensively (full builder, not a minimal
stub). When Task 2's RED tests were added, they passed immediately against the existing
implementation. The commit for Task 2 tests was therefore labelled to reflect this.
All 7 tests are valid and cover the full requirement set.

## Verification

- `node --test tests/unit/wavePlanning.test.js` → 7/7 pass
- `grep -c 'switch(' js/views/desktop/wavePlanning.js` → 0
- `.innerHTML` in source (excluding JSDoc comments) → 0
- Pre-existing test suite failures: 6 (unrelated to this plan — import.js broadcast,
  stub tests for plans 04-02/04-04/04-06)
- No new regressions introduced
