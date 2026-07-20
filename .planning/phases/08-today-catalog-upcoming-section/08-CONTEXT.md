# Phase 8: Today & Catalog — Upcoming Section - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers UI changes to Today and Catalog that surface the `scheduled` status introduced in Phase 7. Today view already filters to `status === 'active'` (CAT-01 is verified, not built). The main work is: splitting the Catalog list into active/mastered/archived vs. scheduled habits, adding an "Upcoming" section below the active list with simplified list items, and implementing a direct "Promote to active" action.

**Requirements covered:** CAT-01 (verify), CAT-02, CAT-03, CAT-04, SCHED-04

</domain>

<decisions>
## Implementation Decisions

### Upcoming list item design (CAT-04, SCHED-04)
- **D-01:** Upcoming list items are **simplified rows**: name + ISO startDate + wave badge + Promote button. No stage info, mastery badge, or archive button — the habit hasn't started yet.
- **D-02:** startDate is displayed in **ISO format (YYYY-MM-DD)**, consistent with internal data storage and the History view date picker convention.
- **D-03:** Each Upcoming item includes an **Edit button** (reusing the existing edit panel from `catalog.js`) so the user can adjust startDate, cadence, or stages before the habit goes live.
- **D-04:** No Archive button on Upcoming items. Keeps the UI focused on the promote flow; archiving a scheduled habit is an edge case handled via Edit if needed.

### Promote action UX (SCHED-04)
- **D-05:** Promote action is **direct — no confirmation dialog**. Consistent with Archive and Restore actions in the active list, which also have no confirmation step.
- **D-06:** After promoting, the habit **appears on Today's check-in immediately** within the same session if it is applicable for today's cadence. Today re-renders on the `habit:put` broadcast.
- **D-07:** The promote action emits a **BroadcastChannel `{type: 'habit:put', habitId}` message** on the `'habits'` channel, matching the established cross-tab sync pattern (D-30, Phase 2).
- **D-08:** Promote logic lives in a new apply handler: **`js/state/apply/promoteHabit.js`** — consistent with `createHabit.js`, `editHabit.js`, `archiveHabit.js` in the same directory. Handler writes `status: 'active'` to IDB and emits the BroadcastChannel message.
- **D-09:** After promote, **catalog re-renders the full list immediately** — the promoted habit disappears from Upcoming and appears in the active section. Same re-render path as edit and archive.

### Upcoming section visibility
- **D-10:** The Upcoming section is **hidden when empty** — not rendered at all if there are no scheduled habits. Keeps the catalog clean on most days.
- **D-11:** Upcoming list items are sorted **ascending by startDate** (soonest first). The habit starting next is most actionable.
- **D-12:** Section heading text: **"Upcoming"**. Short, matches the section name used throughout ROADMAP.md and REQUIREMENTS.md.

### Catalog split implementation (CAT-02, CAT-03)
- **D-13:** Upcoming section is integrated as a **single-page layout**: active list renders first, Upcoming section appended below with the "Upcoming" heading as a visual separator. No tabs, no separate route. One scroll.
- **D-14:** The active Catalog list uses an **explicit status filter**: `h.status !== 'scheduled'` (equivalently: active, mastered, archived only). CAT-02 compliance is explicit in the filter, not dependent on sort order.
- **D-15:** A new builder function **`buildUpcomingListItem(habit)`** is added to `js/views/catalog/builders.js` — consistent with the existing `buildHabitListItem()` and `buildCatalogHeader()` in that file.
- **D-16:** The Upcoming section uses a **separate DOM element**: `<ul class="catalog-upcoming-list">` with its own CSS class, distinct from `<ul class="catalog-habit-list">` for the active list. Allows independent styling.

### CAT-01 verification
- **D-17:** `js/views/today.js` line 391 already filters `getCachedHabits().filter((h) => h.status === 'active')`. No code change needed for CAT-01 — a test or manual verification is sufficient to confirm it works with the `scheduled` status from Phase 7.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §"Phase 8: Today & Catalog — Upcoming Section" — goal, success criteria, requirements list
- `.planning/REQUIREMENTS.md` — CAT-01, CAT-02, CAT-03, CAT-04, SCHED-04 full requirement text

### Phase 7 foundation (what Phase 8 builds on)
- `.planning/phases/07-scheduled-status-foundation/07-CONTEXT.md` — decisions D-01 through D-14; `scheduled` status data model, createHabit status derivation, boot promotion logic

### Existing code to modify
- `js/views/catalog.js` — main catalog orchestrator: split `getCachedHabits()` into active and scheduled lists; append Upcoming section; wire promote action handler
- `js/views/catalog/builders.js` — add `buildUpcomingListItem(habit)` for simplified Upcoming rows; existing `buildHabitListItem()` stays unchanged for active list
- `js/views/today.js` line 391 — verify CAT-01: `filter((h) => h.status === 'active')` already excludes scheduled; no code change expected

### New file to create
- `js/state/apply/promoteHabit.js` — new apply handler; writes `status: 'active'` to IDB; emits `{type: 'habit:put', habitId}` on BroadcastChannel `'habits'`

### Established patterns to follow
- `js/state/apply/archiveHabit.js` — mirror for `promoteHabit.js` (same DI pattern, same IDB write + BroadcastChannel emit structure)
- `js/views/catalog/builders.js` `buildHabitListItem()` — reference for what a full list item looks like; Upcoming item is a simplified subset
- `js/domain/scheduled.js` — Phase 7 domain module; `runPromotion()` reference for IDB status write

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/views/catalog/builders.js` `buildHabitListItem()`: existing full row builder — Upcoming item reuses the structural approach (wave badge, name, action buttons) but simplified
- `js/views/catalog/builders.js` `buildCatalogHeader()`: existing header builder — pattern for adding the "Upcoming" section header element
- `js/state/store.js` `getCachedHabits()`: returns all habits from in-memory cache; caller filters by status — use `h.status !== 'scheduled'` for active list and `h.status === 'scheduled'` for Upcoming list
- `js/state/apply/archiveHabit.js`: direct pattern reference for `promoteHabit.js` (IDB write + BroadcastChannel emit)

### Established Patterns
- **BroadcastChannel sync (D-30):** emit `{type: 'habit:put', habitId}` on `'habits'` channel after any habit state change. Today and Catalog listeners re-render on this message.
- **Apply handler DI pattern:** `configureArchiveHabit({repo, channel})` called in P2 boot block; module-level mutables; tests inject fakes. `promoteHabit.js` must match.
- **JSDoc file header (D-27):** every `.js` file starts with `/** @file <one-line summary>. <rationale + cross-references to D-XX decisions> */`. New files must include this.
- **No confirmation dialogs for habit state changes:** Archive and Restore act immediately — no confirm prompt. Promote follows the same convention.

### Integration Points
- `js/views/catalog.js` render function: split all-habits loop into two filtered arrays; render active list with existing logic; conditionally render Upcoming section below
- `js/main.js` P2 boot wiring block: add `configurePromoteHabit({repo, channel})` alongside other configure calls
- `js/desktop.js` P2 boot wiring block: same addition (desktop shell must also support promote if catalog is accessible there)

</code_context>

<specifics>
## Specific Ideas

- The Upcoming section heading can be an `<h2>` or `<section>` with a `.catalog-upcoming-heading` class — visually similar to how the existing catalog header is structured, but inlined within the catalog page rather than at the top.
- `buildUpcomingListItem(habit)` should output: habit name (`<span class="catalog-habit-name">`), wave badge (`<span class="catalog-habit-wave">Wave N</span>`), ISO startDate (`<span class="catalog-upcoming-date">YYYY-MM-DD</span>`), Edit button (reusing `catalog-btn--edit` class/handler), Promote button (`<button class="catalog-btn catalog-btn--promote">Promote</button>`).
- The `promoteHabit` apply handler should be a thin wrapper: `await repo.runTx([['habits', 'readwrite']], (tx) => tx.objectStore('habits').get(habitId).then(h => { h.status = 'active'; return tx.objectStore('habits').put(h); }))`, then `channel.postMessage({type: 'habit:put', habitId})`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 8-Today & Catalog — Upcoming Section*
*Context gathered: 2026-07-20*
