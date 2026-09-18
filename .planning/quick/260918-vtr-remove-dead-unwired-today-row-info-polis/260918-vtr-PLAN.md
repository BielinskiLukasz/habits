---
phase: quick-260918-vtr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - js/views/today/builders.js
  - js/views/today.js
  - css/today.css
  - js/i18n/en.js
  - js/i18n/pl.js
  - tests/unit/builders.today.test.js
  - .planning/BACKLOG.md
autonomous: true
requirements:
  - VTR-remove-dead-today-row-info

estimate:
  tokens: 12000
  raw_tokens: 12000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - Today view never renders a ⓘ / today-row-info button for any habit, including habits with name_pl set
    - No dead code, JSDoc, CSS rule, or i18n key remains anywhere in the codebase for the removed togglePolish/showPolish stub
    - name_pl display logic (getLang() === 'pl' ? habit.name_pl : habit.name, used by Today/Catalog/History per D-35) is completely untouched and keeps working
    - Full test suite passes with no regressions after the removal
  artifacts:
    - js/views/today/builders.js — buildTodayRow() no longer constructs a today-row-info button; its JSDoc no longer documents one
    - js/views/today.js — no togglePolish stub comment or stale future-slice JSDoc paragraph remains
    - css/today.css — .today-row-info rule and its preceding comment are gone
    - js/i18n/en.js, js/i18n/pl.js — today.showPolish key is gone from both
    - tests/unit/builders.today.test.js — asserts the button is absent even when habit.name_pl is truthy; no assertion expects it present
  key_links:
    - buildTodayRow() in builders.js is the sole producer of the today-row-info button — removing it there guarantees the Today view (js/views/today.js renderTodayInto → RENDERERS.binary → buildTodayRow) never emits it, since the actions map in today.js never wired togglePolish to begin with
    - tests/unit/builders.today.test.js must be updated in the same plan or `node --test tests/` fails on stale assertions expecting the removed button
---

<objective>
Remove the dead, never-wired ⓘ (today-row-info) Polish-name disclosure button from the Today view — markup, JSDoc, CSS, the orphaned i18n key, and the stale stub comments that describe it — because Phase 10's full EN/PL language toggle (D-35, `getLang() === 'pl' ? habit.name_pl : habit.name`) already covers this need globally across Today, Catalog, and History, and this leftover Phase-3 stub (D-55/D-79) was never wired to a click handler.

Purpose: Delete dead code and stale documentation before it confuses future maintainers into thinking a disclosure feature exists or is pending; nothing here is user-visible since the button already does nothing when tapped.
Output: `buildTodayRow()` emits a strictly simpler row (tap button only, no info button); no leftover CSS/i18n/JSDoc references; updated test coverage; a moot BACKLOG.md item removed.
</objective>

<execution_context>
@C:/my-code/vibe-coding/habits/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/habits/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/habits/.planning/PROJECT.md
@C:/my-code/vibe-coding/habits/.planning/STATE.md
@C:/my-code/vibe-coding/habits/js/views/today/builders.js
@C:/my-code/vibe-coding/habits/js/views/today.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove ⓘ button markup, its JSDoc, and its CSS rule</name>
  <files>js/views/today/builders.js, css/today.css</files>
  <action>
    In `js/views/today/builders.js`, inside `buildTodayRow()`, delete the entire `if (habit.name_pl) { slideChildren.push({ tag: 'button', attrs: { class: 'today-row-info', ... }, text: 'ⓘ' }); }` block that immediately follows `const slideChildren = [tapBtn];`. After the edit, `slideChildren` must only ever contain `tapBtn` — do not touch `tapBtn`'s construction, the `tapChildren` branches above it (completed/failed/skipped/default glyph+name logic), or anything in `.today-row__actions` (Skip/Fail buttons).

    In the same file, delete the JSDoc paragraph inside `buildTodayRow`'s docstring that documents the removed button: the 3-line paragraph beginning "The ⓘ disclosure button (D-55, D-79) — `aria-label=\"Show original Polish name\"`," and ending "...when `name_pl` is null/undefined; the slot is not reserved." Remove its adjacent blank comment line so exactly one blank `*` line remains between the preceding "Completed: ..." bullet and the `@param` line — do not leave a double blank comment line, and do not touch any other paragraph in that docstring (the "Swipe UX" and "Inside `.today-row__slide`" paragraphs stay exactly as-is).

    Also in this file, drop the now-orphaned `D-55` tag from the `@file` header's decision-tag list at the top of the file (`D-26 Tier 1, D-54, D-55, D-56, D-58, D-76, D-79, D-80` → remove `D-55,` leaving the rest unchanged). Do not remove `D-79` — it is referenced by dozens of other files/features across the codebase (footer nav, settings, catalog, toast) and is not specific to this button.

    In `css/today.css`, delete the `.today-row-info { ... }` rule block together with its preceding comment (`/* ⓘ disclosure button — sits at the row end (D-55). ... */`). It sits between the `.today-row-name--completed` rule and the `/* Empty states (D-58). ... */` comment that precedes `.today-empty`. Leave exactly one blank line between the two rules that remain adjacent after the deletion, matching this file's existing one-blank-line-between-rules convention. Do not touch any other rule in the file.
  </action>
  <verify>
    <automated>! grep -q "today-row-info" js/views/today/builders.js && ! grep -q "D-55" js/views/today/builders.js && ! grep -q "today-row-info" css/today.css && node --check js/views/today/builders.js</automated>
  </verify>
  <done>
    `js/views/today/builders.js` no longer contains the string "today-row-info" or "D-55" anywhere (markup or JSDoc); `css/today.css` no longer defines `.today-row-info`; the file parses without syntax errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove the today.js stub artifacts and the orphaned i18n key</name>
  <files>js/views/today.js, js/i18n/en.js, js/i18n/pl.js</files>
  <action>
    In `js/views/today.js`, delete the inline comment line inside the `actions` map object literal in `renderTodayInto()`: `// togglePolish: bound in a future slice (D-55 inline popover lives there).`. There is no actual handler function or unreachable code tied to this stub beyond the comment itself — the `actions` object simply never had a `togglePolish` key (confirmed: no `handleTogglePolish`-style function exists in this file) — so deleting the comment line is the complete fix here.

    In the same file, delete the file-header JSDoc paragraph that documents the same stub: the paragraph beginning "Polish-toggle (`togglePolish`) tap wiring also lands in a future slice —" and ending "...here (mount() simply doesn't wire the listener when the closure is absent)." plus its trailing blank comment line, so exactly one blank `*` line remains between the preceding numbered list (ending "...console.warn placeholder is GONE.") and the following `clearChildren` paragraph. Do not touch any other paragraph in that file header.

    In `js/i18n/en.js`, delete the `'today.showPolish': 'Show original Polish name',` line from the `EN` object. In `js/i18n/pl.js`, delete the `'today.showPolish': 'Pokaż oryginalną nazwę',` line from the `PL` object. This key has zero remaining references in `js/`, `css/`, or `tests/` once Task 1's edit to `builders.js` (the only call site, `t('today.showPolish')`) is in place — confirmed by grep before starting this task.
  </action>
  <verify>
    <automated>! grep -q "togglePolish" js/views/today.js && ! grep -q "showPolish" js/i18n/en.js && ! grep -q "showPolish" js/i18n/pl.js && node --check js/views/today.js && node --check js/i18n/en.js && node --check js/i18n/pl.js</automated>
  </verify>
  <done>
    `js/views/today.js` contains no occurrence of "togglePolish" anywhere (comment or code); neither `js/i18n/en.js` nor `js/i18n/pl.js` contains a `showPolish` key; all three files parse without syntax errors.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update builder tests, remove the moot backlog item, run the full suite</name>
  <files>tests/unit/builders.today.test.js, .planning/BACKLOG.md</files>
  <action>
    In `tests/unit/builders.today.test.js`, delete the test `'emits ⓘ disclosure button inside slide when habit.name_pl is truthy (D-55, D-79)'` in its entirety — it asserts a feature that no longer exists.

    Replace the remaining test `'omits ⓘ disclosure button when habit.name_pl is null/undefined'` with one consolidated test asserting the button is ALWAYS absent, covering three habit fixtures in one test body: `name_pl` truthy (e.g. `{ id: 'h1', name: 'Drink water', name_pl: 'Picie wody' }`), `name_pl: null`, and `name_pl` entirely absent from the object. For each fixture, call `buildTodayRow({ habit, status: null })`, get the slide via the existing `findSlide()` helper, and assert both that no child has `attrs?.class === 'today-row-info'` and that no child has `attrs?.['data-action'] === 'togglePolish'`. Name the test something like `'never renders a togglePolish/ⓘ button, even when habit.name_pl is set (removed — superseded by full EN/PL toggle D-35)'`. Do not weaken or remove any other test in this `describe` block (the tap-button, actions-panel, and completed-row tests stay exactly as-is).

    Update the file's top `@file` JSDoc: change the coverage bullet `- \`buildTodayRow\`: button + aria-pressed + data-action + ⓘ disclosure (D-54, D-55, D-79)` to drop `+ ⓘ disclosure` and `D-55` (result: `- \`buildTodayRow\`: button + aria-pressed + data-action (D-54, D-79)`), and drop the standalone `D-55` tag from the file's top decision-tag list (`D-26 Tier 1, D-54, D-55, D-56, D-58, D-76, D-79, D-80` → remove `D-55,`). Do not touch any other line in that header.

    In `.planning/BACKLOG.md`, remove the entire `### B-002 · Polish name button (ⓘ) missing for numeric/slot habits` section — from its heading through its trailing `Effort: Low.` line and the `---` separator immediately following it — per this file's own "Removing an item" convention. The feature B-002 proposed extending (the ⓘ button reaching numeric/slot rows too) no longer exists as of this plan, so the item is moot by obsolescence, not shipped. Leave exactly one `---` separator between the preceding B-001 section and the following B-003 section (matching the single-separator pattern used between every other section in the file). Update the "Last updated:" line near the top of the file to reflect today's removal (e.g. `Last updated: 2026-09-18 (removed B-002 — ⓘ Polish-name button deleted via quick task 260918-vtr, moot by obsolescence)`). Leave the "Last assigned ID" line unchanged — no new backlog item is being added.

    Finally, run the full test suite and confirm every test passes with no failures.
  </action>
  <verify>
    <automated>node --test tests/</automated>
  </verify>
  <done>
    `tests/unit/builders.today.test.js` contains no assertion expecting a `today-row-info` element or `togglePolish` action to be present anywhere; one test explicitly confirms the button/action is absent across name_pl truthy/null/missing fixtures; `.planning/BACKLOG.md` no longer contains a B-002 section (B-001 and B-003 remain, separated by exactly one `---`); `node --test tests/` passes with zero failures.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none crossed | Pure removal of already-dead, never-wired UI code, its CSS, its i18n key, stale documentation, and a now-moot backlog entry. No new DOM APIs, no user input path, no data-flow change — `name_pl` display logic (D-35) is untouched. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vtr-01 | Tampering | js/views/today/builders.js, js/views/today.js, css/today.css, js/i18n/en.js, js/i18n/pl.js | low | accept | Deletion-only change to code that was already provably unreachable (no click handler was ever bound to `togglePolish`); verified by grep-based negative checks per task plus a full `node --test tests/` pass confirming zero regressions in the still-live EN/PL name-display path. |
</threat_model>

<verification>
After all three tasks:
- `grep -r "today-row-info\|togglePolish\|showPolish" js/ css/` returns no matches
- `node --test tests/` passes with zero failures
- Opening the Today view (index.html → #today) for a habit with `name_pl` set shows the tap row with no trailing ⓘ icon
- `name_pl` still displays correctly when the language toggle is set to `pl` (Settings → Language), confirming D-35's `getLang()`-based display logic was not touched
- `.planning/BACKLOG.md` no longer lists B-002
</verification>

<success_criteria>
The ⓘ/today-row-info button, its CSS, its i18n key, its JSDoc documentation, and its dead stub comments are fully removed from the codebase; `buildTodayRow()` emits only the tap button inside `.today-row__slide`; all tests (including new/updated coverage in `builders.today.test.js`) pass; the B-002 backlog item is closed as moot.
</success_criteria>

<output>
Create `.planning/quick/260918-vtr-remove-dead-unwired-today-row-info-polis/260918-vtr-SUMMARY.md` when done.
</output>
