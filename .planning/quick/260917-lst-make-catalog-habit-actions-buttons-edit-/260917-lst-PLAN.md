---
phase: quick-260917-lst
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - css/catalog.css
  - .planning/BACKLOG.md
autonomous: true
requirements:
  - LST-catalog-actions-row

estimate:
  tokens: 8000
  raw_tokens: 8000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - Catalog habit-actions buttons (Edit, Archive/Restore, Advance stage) render side by side in a single row instead of stacked vertically
    - On narrow viewports where the buttons don't fit one row, they wrap to a second line instead of overflowing or clipping
    - Backlog item B-004 is closed since the exact fix it described is now shipped
  artifacts:
    - css/catalog.css — .catalog-habit-actions rule uses flex-direction: row (not column)
    - .planning/BACKLOG.md — B-004 entry removed, B-003/B-005 sections intact
  key_links:
    - The .catalog-habit-actions div rendered by js/views/catalog/builders.js (buildHabitListItem and buildUpcomingListItem) is styled by the updated css/catalog.css rule — no markup change needed, only the CSS layout direction
---

<objective>
Change the `.catalog-habit-actions` container in the Catalog view from a column (vertically stacked) button layout to a row (horizontal) layout, so Edit / Archive-or-Restore / Advance-stage buttons sit side by side instead of stacking and consuming extra vertical space per habit row.

Purpose: Vertical stacking wastes screen real estate on the primary mobile check-in/catalog surface; side-by-side action buttons is the conventional pattern and matches backlog item B-004 (already captured with this exact fix).
Output: `.catalog-habit-actions` laid out as a wrapping flex row; stale B-004 backlog entry removed since it is now resolved.
</objective>

<execution_context>
@C:/my-code/vibe-coding/habits/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/habits/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/habits/.planning/PROJECT.md
@C:/my-code/vibe-coding/habits/.planning/STATE.md
@C:/my-code/vibe-coding/habits/css/catalog.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Lay out .catalog-habit-actions buttons in a row</name>
  <files>css/catalog.css</files>
  <action>
    In css/catalog.css, locate the `.catalog-habit-actions` rule (currently `display: flex; flex-direction: column; gap: var(--space-1); flex-shrink: 0;`, inside the `@layer view` block, right after `.catalog-habit-badges`/badge rules and before `.catalog-empty`).

    Change `flex-direction: column` to `flex-direction: row`. Add `flex-wrap: wrap` so that if all three possible buttons (Edit, Archive-or-Restore, and the conditional Advance-stage button) do not fit on one line on a narrow viewport, they wrap to a second line instead of overflowing the row horizontally (this is the exact fix noted in .planning/BACKLOG.md B-004's implementation notes). Add `align-items: center` so row-laid-out buttons align vertically centered against each other and against the sibling `.catalog-habit-info` block (the previous column layout relied on default stretch/start behavior, which is not needed once buttons sit side by side).

    Keep `gap: var(--space-1)` and `flex-shrink: 0` unchanged — do not touch any other rule in the file (`.catalog-btn`, `.catalog-btn--archive`, `.catalog-btn--restore`, `.catalog-btn--advance` etc. stay exactly as-is; this is a container-layout-only change, no button-level styling changes). Do not touch js/views/catalog/builders.js — the markup (three `<button class="catalog-btn ...">` children inside one `<div class="catalog-habit-actions">`) is already correct and needs no change, only the CSS direction the container lays them out in.
  </action>
  <verify>
    <automated>awk '/\.catalog-habit-actions \{/,/^  \}/' css/catalog.css | grep -q 'flex-direction: row' && node --test tests/unit/builders.catalog.test.js tests/integration/catalog-flow.test.js</automated>
  </verify>
  <done>
    The `.catalog-habit-actions` rule in css/catalog.css reads `flex-direction: row` (not `column`) and includes `flex-wrap: wrap`. Existing catalog builder and integration tests still pass unmodified, confirming the button markup/behavior is untouched — only the container's layout axis changed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Close resolved backlog item B-004</name>
  <files>.planning/BACKLOG.md</files>
  <action>
    In .planning/BACKLOG.md, remove the entire `### B-004 · Edit and Archive buttons should be in the same row` section — per this file's own "Removing an item" convention (delete the block once its fix ships) — since Task 1 implements exactly the fix its "Implementation notes" describe (`flex-direction: column` → `row` on `.catalog-habit-actions`, plus `flex-wrap: wrap`). Delete from the `### B-004` heading through its trailing `**Implementation notes:** ... Effort: Low.` line and the `---` separator immediately following it, leaving exactly one `---` separator between the preceding B-003 section and the following B-005 section (matching the single-separator pattern used between every other section in the file — do not leave a double `---` or a missing one).

    Update the "Last updated:" line near the top of the file (currently `Last updated: 2026-08-31 (added B-027 — app version display)`) to `Last updated: 2026-09-17 (resolved B-004 — catalog action buttons row layout via quick task 260917-lst)`. Leave the "Last assigned ID" line unchanged — no new backlog item is being added, only an existing one closed.
  </action>
  <verify>
    <automated>! grep -q "B-004" .planning/BACKLOG.md && grep -q "B-005" .planning/BACKLOG.md && grep -q "B-003" .planning/BACKLOG.md</automated>
  </verify>
  <done>
    .planning/BACKLOG.md no longer contains a B-004 section. The B-003 and B-005 sections are both still present and separated by exactly one `---` divider. The file's "Last updated" line reflects today's resolution of B-004.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none crossed | Pure CSS layout-direction change plus a planning-doc edit; no user input, no new DOM APIs, no data flow change |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-lst-01 | Tampering | css/catalog.css | low | accept | Static CSS rule edit only; no user-controlled input reaches this file; verified by existing catalog builder/integration tests passing unchanged |
</threat_model>

<verification>
After both tasks:
- `node --test tests/` passes with no new failures
- Opening the Catalog view (index.html → #catalog) in a browser shows Edit / Archive (or Restore) / Advance-stage buttons for a habit row laid out side by side in one row, wrapping to a second line only if the viewport is too narrow to fit all buttons
- .planning/BACKLOG.md no longer lists B-004
</verification>

<success_criteria>
`.catalog-habit-actions` uses `flex-direction: row` with `flex-wrap: wrap`; catalog buttons render horizontally instead of stacked; all existing tests pass; B-004 backlog entry removed.
</success_criteria>

<output>
Create `.planning/quick/260917-lst-make-catalog-habit-actions-buttons-edit-/260917-lst-SUMMARY.md` when done.
</output>
