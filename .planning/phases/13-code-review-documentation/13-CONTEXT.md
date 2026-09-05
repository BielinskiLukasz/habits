# Phase 13: Code Review & Documentation - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 4 stale `log.completed === true` callers that break wave analytics and scoring after the 4-state model migration. Then run a full code review over all v1.2-changed files to confirm pattern compliance (QA-01). Finally, document the 4-state model rationale and i18n architecture in PROJECT.md (QA-02). Phase completes the v1.2 milestone.

</domain>

<decisions>
## Implementation Decisions

### Bug Fix Scope

- **D-01:** Fix all 4 stale-boolean bugs in a **dedicated first plan**, before the code review runs. Sequence: bug-fix plan → code review plan → documentation plan. This ensures the code review validates already-fixed code, not broken code. — **Reversibility:** reversible

- **D-02:** All 4 STATE.md-deferred bugs are in scope — no exceptions:
  - `js/io/scoreSnapshots.js:305` — `_logCompleted` checks `log.completed === true` (stale); replace with `log.status === 'completed'`
  - `js/domain/waveAggregates.js:44,198` — `_countForHabit` and streak walk-back check `log.completed === true`; replace with `log.status === 'completed'`
  - `js/io/import.js:130` — old JSON exports with `completed: boolean` field silently dropped; add normalization: `completed: true` → `status: 'completed'`, `completed: false` → `status: 'failed'`
  - `js/state/apply/markSkipped.js:35` — does not call `_recomputeLastCompletedDate` when overwriting a completed log; wire it in — **Reversibility:** reversible

- **D-03:** TDD mode applies to all bug fixes. For each bug: write a RED failing test first (proving the bug exists), then fix the code (GREEN). Follows the same RED → GREEN cycle as Phase 11. Tests go in `tests/unit/` or `tests/integration/` per the existing pattern (D-23). — **Reversibility:** reversible

### Code Review Coverage

- **D-04:** The `/gsd-code-review` skill is the review mechanism — spawns gsd-code-reviewer agent producing `REVIEW.md`. Run with `--fix` to auto-apply findings. — **Reversibility:** reversible

- **D-05:** Review targets **all v1.2-changed files** (new files AND modified existing files), not new files only. Modified existing files (`today.js`, `history.js`, `scoreSnapshots.js`, `waveAggregates.js`, `import.js`) are included because they carry the most risk — the stale-boolean fixes land there. Review scope = git diff from `v1.0` tag to HEAD. — **Reversibility:** reversible

- **D-06:** QA-01 compliance checks the review must confirm (in addition to any code-quality findings the reviewer surfaces):
  - No `switch` on log status or cadence types (Anti-Pattern 4) — dispatch tables only
  - No `.innerHTML` anywhere (D-78)
  - JSDoc `@file` headers on all new `.js` files (D-27)
  - No `indexedDB.*` calls outside `js/db/idb.js` (Anti-Pattern 1)

### QA-02 Documentation Style

- **D-07:** (Claude's discretion) Add a new decision entry to the PROJECT.md Key Decisions table for i18n architecture (following the existing D-xx style used for D-43 through D-43). D-43 covers the 4-state model — review whether it needs more rationale; if thin, expand it in-place. For i18n: the entry must cover: locale dictionary shape (flat key→string, no namespace nesting), `t(key, vars)` signature (var interpolation via `{{var}}`), no `Intl.*` framework, two locales (en/pl), locale pref persisted in IDB `settings` store. Assign the next available D-xx number.

### Plan Structure

- **D-08:** (Claude's discretion) Three-plan structure:
  - **Plan 13-01** (Wave 1): TDD RED tests + fix 4 stale-boolean callers
  - **Plan 13-02** (Wave 2, parallel pair): `/gsd-code-review --fix` over v1.0..HEAD diff
  - **Plan 13-03** (Wave 2, parallel pair): PROJECT.md QA-02 documentation update (blocked only on having a working codebase, not on Plan 02's review)
  Plans 02 and 03 can run in parallel once Plan 01 completes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/ROADMAP.md` §Phase 13 — goal, success criteria, requirements QA-01 and QA-02
- `.planning/REQUIREMENTS.md` — QA-01 and QA-02 definitions (active section)

### Bug Fix Targets (all 4 must be fixed)

- `js/io/scoreSnapshots.js` line 305 — `_logCompleted` stale boolean check
- `js/domain/waveAggregates.js` lines 44, 198 — `_countForHabit` and streak walk-back stale boolean check
- `js/io/import.js` line 130 — no normalization for old `completed: boolean` field in imported JSON
- `js/state/apply/markSkipped.js` line 35 — missing `_recomputeLastCompletedDate` call when overwriting a completed log

### Files in Scope for Code Review (QA-01)

**New modules added in v1.2:**
- `js/domain/logStatus.js` — 4-state cycle function; `@file` header and no-switch already confirmed by grep
- `js/domain/scheduled.js` — auto-transition on boot
- `js/state/apply/markFailed.js`, `js/state/apply/markSkipped.js`, `js/state/apply/promoteHabit.js`
- `js/views/desktop/sidebar.js`, `js/views/desktop/wavePlanning.js`
- `js/i18n/index.js`, `js/i18n/en.js`, `js/i18n/pl.js`

**Modified existing files in v1.2:**
- `js/views/today.js`, `js/views/history.js` — swipe-right cycle changes
- `js/io/scoreSnapshots.js`, `js/domain/waveAggregates.js` — stale-boolean bugs (fixed in Plan 01)
- `js/io/import.js` — stale-boolean normalization (fixed in Plan 01)

### Architecture Documentation Target

- `.planning/PROJECT.md` — Key Decisions section; D-43 (4-state model), plus new i18n decision entry. QA-02 update target.

### Pattern References

- `.planning/STATE.md` — "Concerns (Phase 13 targets)" section for the exact bug locations
- `js/db/idb.js` — the only file permitted to call `indexedDB.*` (Anti-Pattern 1 boundary)
- `tests/unit/cadence.test.js` — reference for domain pure-function test structure (TDD RED tests follow this pattern)
- `tests/unit/logStatus.test.js` — existing 4-state test file; new tests may extend or colocate

</canonical_refs>

<code_context>
## Existing Code Insights

### Bug Context

- `waveAggregates.js` lines 44 and 198 confirmed by grep to still use `log.completed === true`. Wave analytics (completion %, "at risk" calculation, streak walk-back) silently return 0 for any log written with the 4-state model.
- `scoreSnapshots.js` — scoring pipeline affected; snap scores for post-migration logs will be wrong.
- `import.js` — backwards-compatibility gap: any JSON backup file created before the 4-state migration (pre-2026-08-28) that is imported now will silently drop log states (the old `completed: boolean` field is not read).
- `markSkipped.js` — `_recomputeLastCompletedDate` is present in `markCompleted` and `markUncompleted` handlers but was omitted from the skipped path.

### Code Review Starting Points

- `logStatus.js` — already has JSDoc `@file` header + NEXT_STATE table (no switch); confirmed clean.
- `today.js` and `history.js` — `@file` comments warn about `.innerHTML` prohibition; swipe handler changes are the main review surface.
- i18n files — locale dict is a flat ES module export; `t()` in `index.js` does var interpolation.

### Established Patterns

- **TDD (D-23):** Node built-in `node:test` + `node:assert/strict` — no test framework. RED commit references the expected behavior (test fails); GREEN adds the fix.
- **No switch on status/cadence (Anti-Pattern 4):** Dispatch via lookup object/Map — same constraint as `nextLogState` in `logStatus.js`.
- **No `.innerHTML` (D-78):** Grep gate is enforced by CI.
- **JSDoc `@file` (D-27):** Every new `.js` file must open with `/** @file <summary>. <rationale> */`.

### Integration Points

- `_recomputeLastCompletedDate` — helper in `js/state/apply/` that updates the habit's `lastCompletedDate` field; already called by `markCompleted` and `markUncompleted`; needs to be called from `markSkipped` when it overwrites a completed log.
- `mergeImportedStores` in `import.js` — the normalization for `completed: boolean` → `status: string` needs to happen here before rows are written to IDB.

</code_context>

<specifics>
## Specific Ideas

- The `import.js` normalization should be backwards-compatible: if a row already has `status` set (new format), leave it alone. Only rows with `completed: boolean` and no `status` field need migration. This makes the fix safe for mixed-format backup files.
- For the TDD RED tests for `waveAggregates.js`: create a fixture log row with `{status: 'completed'}` (no `completed` boolean) and assert that the wave completion count is > 0 after the fix.
- D-43 in PROJECT.md already captures the 4-state model at a high level; the QA-02 update should enrich the existing entry with: the "absence = undefined" design rationale (keeps IDB free of phantom rows), the `markUncompleted → status:'failed'` (not deletion) choice, and the CSV mapping table.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-Code Review & Documentation*
*Context gathered: 2026-09-05*
