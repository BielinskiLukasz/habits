# Phase 12: Swipe UX & Navigation Verification - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix and verify four interaction surfaces: (1) swipe-right cycling through all 4 log states on Today view (LOG4-02), (2) same cycling model applied consistently to History view (LOG4-03), (3) confirm analytics footer nav is visible and functional on both shells with no duplicate link in settings (UX-01), (4) verify desktop sidebar collapse state persists across hash-route navigation within the same session (UX-02). Primary output: code fix for swipe cycling + shared domain function + unit tests + visual verification of nav/sidebar.

</domain>

<decisions>
## Implementation Decisions

### Swipe cycling model (LOG4-02 + LOG4-03)

- **D-01:** Swipe-right on a Today row always cycles forward through all 4 log states: `undefined → completed → failed → skipped → undefined`. Applies to **both** Today and History views. — **Reversibility:** costly — changes the gesture contract users have learned; reverting requires updating both views and the domain function.
- **D-02:** Swipe-left actions panel is **kept** on both Today and History as a shortcut: Skip and Fail buttons let users jump directly to those states without cycling through intermediates. Today already has this panel; History already has `history-swipe-skip` / `history-swipe-fail` wired.
- **D-03:** Visual indicator: **color + glyph** per state. ✓ completed, ✕ failed, ↷ skipped, (blank) undefined. State-specific background tint AND glyph symbol. Existing `today-row--completed` and `today-row--skipped` CSS classes are the starting point; new CSS tokens needed for `failed` row background tint and for the History equivalents (`history-habit-row--failed`, `history-habit-row--skipped`).
- **D-04:** Cycle state logic lives in a **shared pure function** `nextLogState(currentStatus)` in a new file `js/domain/logStatus.js`. Both `views/today.js` and `views/history.js` import it. Single source of truth; testable with Node built-in runner.
- **D-05:** The cycle order is: `null/undefined → 'completed' → 'failed' → 'skipped' → null/undefined`. `null` and `undefined` are treated as equivalent (undefined state); `nextLogState(null)` and `nextLogState(undefined)` both return `'completed'`.

### Unit tests for nextLogState (artifact)

- **D-06:** Create `tests/unit/logStatus.test.js` to cover `nextLogState`. Tests must cover: each of the 4 known input states advancing to the correct next state, plus `null` and `undefined` inputs both returning `'completed'`. 6 test cases minimum. Follows `node:test` + `node:assert/strict` — no test framework.
- **D-07:** [informational] Swipe gesture mechanics (pointer events, dx threshold) are NOT tested in Node runner — no DOM available. Tests cover the pure domain logic only.

### UX-01 — Footer nav analytics link

- **D-08:** Footer nav analytics link keeps its current cross-shell behavior: clicking "Analytics" from mobile (`index.html`) opens `./desktop.html` in the same tab. No change to `buildFooterNav` behavior.
- **D-09:** The "duplicate analytics link in settings" referenced in UX-01 was already removed before Phase 12. Phase 12 confirms via a code scan (grep `settings.js` for any `desktop.html` href) that no duplicate exists. If the scan finds one, remove it; if not, mark UX-01's duplicate sub-requirement as already satisfied.

### UX-02 — Sidebar persistence

- **D-10:** No known bug in sidebar persistence. `mountSidebarToggle` is called once at boot; hash-route navigation does not re-mount the sidebar DOM. Phase 12 verifies by running the app and navigating between routes. If a regression is found during verification, fix it within this phase.

### Claude's Discretion

- Exact CSS token names for the `failed` state tint (e.g., `--color-failed-bg`, `--row-failed-bg`) — follow existing token naming in `css/tokens.css`.
- Whether the new `logStatus.js` file gets an exported `LOG_STATES` constant array (ordered cycle) or keeps the logic purely in `nextLogState` — either is fine as long as the function is the single truth.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — LOG4-02, LOG4-03, UX-01, UX-02 (active section)
- `.planning/ROADMAP.md` §Phase 12 — success criteria and scope

### Core swipe implementation files to modify

- `js/views/today.js` — swipe-right handler (`handleSwipeEnd`, `_swipeMarkComplete`) needs replacing with cycle logic; imports `nextLogState`
- `js/views/today/builders.js` — `buildTodayRow` needs updating for failed/skipped glyph + color classes; `buildFooterNav` — verify analytics link present
- `js/views/history.js` — same swipe-right handler change as Today
- `js/views/history/builders.js` — history row builder may need failed/skipped CSS class updates

### New file to create

- `js/domain/logStatus.js` — exports `nextLogState(currentStatus)` pure function (cycle mapping); follows the `js/domain/` pattern (pure logic, no DOM, no IDB)

### New test file to create

- `tests/unit/logStatus.test.js` — unit tests for `nextLogState`, following `node:test` + `node:assert/strict` pattern

### Existing test patterns to follow

- `tests/unit/cadence.test.js` — reference for domain pure-function test structure
- `tests/unit/logStatus.test.js` (new) — 6 test cases minimum

### Sidebar and nav verification

- `js/views/desktop/sidebar.js` — `mountSidebarToggle` (verify persistence logic)
- `js/desktop.js` — sidebar mount point (verify no re-mount on route change)
- `js/views/settings.js` — grep for any `desktop.html` href (should be absent)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`today.js` swipe tracking vars** (`_swipeEl`, `_swipeStartX`, `_openSwipeRow`): Swipe-right handler in `handleSwipeEnd` currently calls `_swipeMarkComplete(habitId)` — replace with `apply({ type: nextEventType, ... })` where the event type comes from `nextLogState(currentStatus)`.
- **`history.js` swipe handlers**: Identical structure to `today.js`; `history-swipe-skip` / `history-swipe-fail` are already wired (no new actions panel needed).
- **CSS classes that exist**: `today-row--completed`, `today-row--skipped`, `history-habit-row--skipped`, `history-habit-row--failed` — start from these; add tint color via tokens.
- **Domain module pattern** (`js/domain/cadence.js`, `js/domain/mastery.js`): `logStatus.js` should follow same shape — `@file` JSDoc header, exported pure functions, no IDB/DOM imports.
- **Test helper** — `binaryHabit()` fixture in `export.csv.test.js`: Not needed for `logStatus.test.js` (no habits — just status strings).

### Established Patterns

- **D-23**: Node built-in `node:test` + `node:assert/strict` — no test framework installed.
- **No `switch` on log status** (Anti-Pattern 4): `nextLogState` must use a lookup table / `Map` or object dispatch, not a `switch` statement. Same constraint as cadence RESOLVERS.
- **No `.innerHTML`** (D-78): All DOM manipulation via `mount()` helpers or direct property assignment.
- **JSDoc `@file` header required** on every new `.js` file (D-27).

### Integration Points

- `nextLogState(currentStatus)` returns the next status string → caller passes it to the apply handler dispatch table (`markCompleted` / `markUncompleted` / `markSkipped`) — OR consider a new `cycleLog` apply event type that accepts `nextStatus` directly.
- Both `today.js` and `history.js` need the current log status to know which state to cycle to — read it from the row's `data-*` attribute or from `getCachedLog()` in the swipe-up handler.

</code_context>

<specifics>
## Specific Ideas

- The cycle order was confirmed explicitly: `undefined → completed → failed → skipped → undefined`. This matches the success criteria wording in ROADMAP.md ("completed → failed → skipped → undefined → completed" read as a loop).
- Color + glyph visual model: ✓ completed, ✕ failed, ↷ skipped, (blank) undefined. Each state must be visually distinguishable without relying on color alone (accessibility).
- Mobile analytics section (in-shell, no desktop.html hop) is captured as a future backlog idea — not in this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Mobile analytics section**: Add an analytics/stats section directly in the mobile shell (`index.html`) so users don't need to navigate to `desktop.html`. Backlog item B-NEW — future milestone.

</deferred>

---

*Phase: 12-Swipe UX & Navigation Verification*
*Context gathered: 2026-08-31*
