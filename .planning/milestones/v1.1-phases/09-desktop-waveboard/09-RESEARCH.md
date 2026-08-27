# Phase 9: Desktop Waveboard — Research

**Researched:** 2026-08-25
**Domain:** Vanilla ES-module desktop view extension (wave accordion + health badge + promote action)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wave Planning section at top of Waveboard panel; existing 12-week S1 heat-map stays below.
- **D-02:** Wave Planning section is a separate DOM element from the heat-map container. Not a table — accordion/card list layout.
- **D-03:** Wave row header shows: wave name + startDate (ISO YYYY-MM-DD) + counts ("N active · N scheduled") + health badge.
- **D-04:** Wave `startDate` comes from `getAllWaves()` in `js/domain/wave.js` (already called at boot).
- **D-05:** Health badge = worst S1 status across active habits in that wave for the current ISO week. Uses existing `worstStatus()` from `waveboard.js`. CSS modifier slugs: healthy/watch/atrisk/failing.
- **D-06:** Waves with zero active habits show an "Upcoming" label badge (neutral gray) instead of a health badge.
- **D-07:** Habit list is collapsible per wave, collapsed by default. Chevron icon (▶/▼) indicates state.
- **D-08:** Entire wave header row is clickable to toggle collapse. Promote button is inside the expanded list — no conflict.
- **D-09:** Habit rows inside expanded wave show: name + status label + stage + cadence summary.
- **D-10:** Habits grouped: active/mastered first, then "Scheduled" sub-header, then scheduled habits with individual startDate.
- **D-11:** Archived habits not shown in Wave Planning section.
- **D-12:** Scheduled habits include a "Promote to active" button — reusing `promoteHabit.js`.
- **D-13:** Promote is a direct action — no confirmation dialog.
- **D-14:** After promoting, Wave Planning section re-renders immediately via `store.subscribe` + `{type: 'habit:put', habitId}` BroadcastChannel pattern.

### Claude's Discretion

None recorded — all implementation decisions were locked in discussion.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAVE-01 | Desktop Waveboard shows each wave with its planned startDate | `getAllWaves()` returns `[{number, name, startDate, theme}]`; data available at boot |
| WAVE-02 | Each wave row shows counts: active habits vs scheduled habits | `getCachedHabits()` returns all habits; filter by `h.wave` and `h.status` |
| WAVE-03 | Scheduled habits are listed per wave with their startDate in the Waveboard | Habit rows in expanded list show `habit.startDate`; Promote button wired to `promoteHabit.js` |
| WAVE-04 | Active habits are listed per wave with their current status (active/mastered) | Status label from `habit.status`; stage from `habit.stage`; cadence summary derived from `habit.cadence` |
</phase_requirements>

---

## Summary

Phase 9 inserts a **Wave Planning accordion section** above the existing 12-week S1 heat-map in
`js/views/desktop/waveboard.js`. All infrastructure it needs already exists: wave data is in
`getAllWaves()`, habit data is in `getCachedHabits()`, the promote handler is `promoteHabit.js`,
score snapshots for health badges come from the same `repo.getSnapshotsInRange()` call already in
`mountWaveboard`, and reactivity is provided by `store.subscribe`. The builder pattern (`mount()`)
and DOM discipline (no `.innerHTML`, `[hidden]` for collapse) are established project conventions.

The section can be implemented entirely as new code inside `waveboard.js` — no new entry points,
no new DI configure calls, no new IDB stores. The only file that must be created is
`css/desktop.css` additions (new `.waveplanning-*` classes appended to the existing
`@layer desktop-scoring` block per the UI-SPEC). The JavaScript additions all live in
`waveboard.js` and potentially a new companion file
`js/views/desktop/wavePlanning.js` if the builder function is extracted for clarity.

**Primary recommendation:** Add `buildWavePlanningSection()` as a pure builder in a new
`js/views/desktop/wavePlanning.js` module. Wire it inside `mountWaveboard()` before the existing
`waveboardContainer` creation. Subscribe to the same `store.subscribe` the heat-map already uses.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wave metadata (name, startDate, theme) | In-memory module (`wave.js`) | — | Already loaded at boot via `bootWaves()`; no IDB needed |
| Habit catalog + status filter | In-memory cache (`store.js`) | IDB via `repo.getAllHabits()` in `refresh()` | `getCachedHabits()` is synchronous for initial render; `refresh()` re-reads on subscribe trigger |
| Health badge data | IDB `score_snapshots` | In-memory accumulation | `repo.getSnapshotsInRange()` already called in `mountWaveboard`; reuse same fetch |
| DOM construction | `mount()` from `util/mount.js` | — | Enforced by D-78; no `.innerHTML` |
| Accordion state (expand/collapse) | DOM attributes (`aria-expanded`, `[hidden]`) | — | No JS state variable needed; DOM is the source of truth |
| Promote action | `apply({ type: 'promoteHabit', payload: { habitId } })` | `promoteHabit.js` handler | Already built in Phase 8; no modification needed |
| Reactivity after promote | `store.subscribe(fn)` | BroadcastChannel `habits` | Standard pattern; fn triggers full section re-render |
| Expanded-state preservation on re-render | Caller saves/restores `aria-expanded` | — | Read from DOM before `mount()`; restore after |

---

## Standard Stack

### Core

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|-------------|
| Vanilla ES modules | ES2023 | All logic | Project constraint; zero-build |
| `js/util/mount.js` `mount()` | project | DOM construction | Only sanctioned DOM builder; D-78 compliance |
| `js/domain/wave.js` `getAllWaves()` | project | Wave catalog | Already loaded at boot; no fetch needed |
| `js/state/store.js` `getCachedHabits()` | project | Habit data | Synchronous; avoids redundant IDB read |
| `js/state/store.js` `subscribe()` | project | Reactivity | Established pattern in `mountWaveboard` |
| `js/state/apply.js` `apply()` | project | Promote mutation | Chokepoint; enforces invariants |
| `js/state/apply/promoteHabit.js` | project | Promote handler | Phase 8 deliverable; no changes needed |
| CSS `@layer desktop-scoring` in `css/desktop.css` | project | Wave Planning styles | Append to existing block; no new layer |

### Supporting

| Technology | Purpose | When to Use |
|------------|---------|-------------|
| `repo.getSnapshotsInRange(startDate, endDate)` | Health badge data | Called inside `refresh()` (already in `mountWaveboard`) |
| `worstStatus(a, b)` from `waveboard.js` | Aggregate worst S1 per wave | Re-exported or called directly from Wave Planning builder |
| `statusSlug(status)` from `waveboard.js` | Map S1 status string → CSS slug | Used for `.waveplanning-badge--{slug}` class |
| `last12Weeks(today)` + `isoWeekKey(date)` from `waveboard.js` | Identify current-week snapshot rows | Extract current week key for health badge computation |
| `todayLocal()` from `js/util/date.js` | Current date | Already imported in `waveboard.js` |

### No New Dependencies

This phase installs no npm packages, no CDN dependencies, and introduces no new external tools.
The constraint is absolute per CLAUDE.md.

---

## Package Legitimacy Audit

Not applicable — no external packages are installed in this phase. The project constraint
(no npm, no CDN) makes this section N/A.

---

## Architecture Patterns

### System Architecture Diagram

```
desktop.html
    |
    v
js/desktop.js (boot: bootWaves, hydrate, mountRoutes)
    |
    +-- #waveboard route --> mountWaveboard(waveboardPanel, { repo, store })
                                |
                                +-- [NEW] mountWavePlanning(parent, { repo, store })
                                |       |
                                |       +-- getAllWaves()        [wave.js — in-memory]
                                |       +-- getCachedHabits()   [store.js — in-memory]
                                |       +-- repo.getSnapshotsInRange()  [IDB score_snapshots]
                                |       +-- buildWavePlanningSection()  --> mount() --> DOM
                                |       +-- store.subscribe(refresh)
                                |       |
                                |       +-- user clicks "Promote to active"
                                |               |
                                |               v
                                |           apply({ type: 'promoteHabit', payload: { habitId } })
                                |               |
                                |               v
                                |           promoteHabit.js handler writes IDB
                                |               |
                                |               v
                                |           BroadcastChannel {type:'habit:put', habitId}
                                |               |
                                |               v
                                |           store.subscribe callback fires
                                |               |
                                |               v
                                |           re-render Wave Planning section
                                |
                                +-- [EXISTING] waveboardContainer (12-week S1 heat-map)
                                        |
                                        +-- repo.getAllHabits()
                                        +-- repo.getSnapshotsInRange()
                                        +-- buildWaveboardHeader / buildWaveboardRows / mount()
                                        +-- store.subscribe(refresh)
```

### Recommended Project Structure

```
js/views/desktop/
├── waveboard.js          # MODIFY — add mountWavePlanning call before waveboardContainer
├── wavePlanning.js       # CREATE — buildWavePlanningSection() pure builder + mountWavePlanning()
analytics.js              # unchanged
planning.js               # unchanged

css/
├── desktop.css           # MODIFY — append .waveplanning-* classes to @layer desktop-scoring

tests/unit/
├── wavePlanning.test.js  # CREATE — unit tests for buildWavePlanningSection()
```

### Pattern 1: Builder Pattern (D-26 / Pattern S8)

**What:** Pure functions build description-tree objects; `mount()` converts them to DOM.
**When to use:** All DOM construction in view files.

```javascript
// Source: js/util/mount.js + js/views/desktop/waveboard.js (codebase pattern)
/** @file wavePlanning.js */

/**
 * Build the Wave Planning section description tree.
 *
 * @param {{ waves: object[], habits: object[], snapshotsByHabitId: Map<string, string> }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildWavePlanningSection({ waves, habits, snapshotsByHabitId }) {
  const waveItems = waves.map(wave => buildWaveItem(wave, habits, snapshotsByHabitId));
  return {
    tag: 'section',
    attrs: { class: 'waveplanning' },
    children: [
      { tag: 'h2', attrs: { class: 'waveplanning-title' }, text: 'Wave Planning' },
      ...waveItems,
    ],
  };
}
```

[VERIFIED: codebase] — pattern directly observed in `waveboard.js` `buildWaveboardHeader()` and `buildWaveboardRows()`.

### Pattern 2: Collapse / Accordion via `[hidden]` + `aria-expanded`

**What:** The wave header is a `<button>` element. Clicking flips `aria-expanded` and toggles the
`[hidden]` attribute on the sibling `<ul>`. No custom CSS class is needed for the hidden state —
the `[hidden]` attribute is honoured natively by browsers as `display: none`.

**When to use:** Any expand/collapse in this codebase. Follows D-78 (no `.innerHTML`) and uses
the same pattern as the existing desktop panel hide/show in `desktop.js`.

```javascript
// Source: pattern derived from js/desktop.js show() function + UI-SPEC DOM Contract
// Event delegation on the section container avoids per-button listener leaks on re-render.
function wireAccordion(sectionEl) {
  sectionEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button.waveplanning-wave-header');
    if (!btn) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const listId = btn.getAttribute('aria-controls');
    const list = sectionEl.ownerDocument.getElementById(listId);
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (list) {
      if (expanded) list.setAttribute('hidden', '');
      else list.removeAttribute('hidden');
    }
  });
}
```

[VERIFIED: codebase] — `[hidden]` attribute pattern observed in `desktop.js` panel toggle (`panel.hidden = false`). Event delegation pattern inferred from project D-78 constraint plus the mount.js `data-action` pattern.

**No existing collapse component** — this pattern must be implemented from scratch for Phase 9. [VERIFIED: codebase] — no collapse/accordion code found in any existing view file.

### Pattern 3: Expanded-State Preservation on Re-render

**What:** Before clearing and re-rendering the section, read `aria-expanded` from each wave
header and store it; after `mount()` rebuilds the DOM, restore each header's `aria-expanded` and
the `[hidden]` state on its corresponding `<ul>`.

**When to use:** Any stateful re-render where the user may have expanded rows.

```javascript
// Source: UI-SPEC Interaction Contract — "Expanded-state preservation" section
function saveExpandedState(sectionEl) {
  const state = new Map();
  for (const btn of sectionEl.querySelectorAll('button.waveplanning-wave-header')) {
    const waveN = btn.dataset.waveNumber;
    state.set(waveN, btn.getAttribute('aria-expanded') === 'true');
  }
  return state;
}

function restoreExpandedState(sectionEl, state) {
  for (const btn of sectionEl.querySelectorAll('button.waveplanning-wave-header')) {
    const waveN = btn.dataset.waveNumber;
    const wasExpanded = state.get(waveN) ?? false;
    btn.setAttribute('aria-expanded', wasExpanded ? 'true' : 'false');
    const listId = btn.getAttribute('aria-controls');
    const list = sectionEl.ownerDocument.getElementById(listId);
    if (list) {
      if (wasExpanded) list.removeAttribute('hidden');
      else list.setAttribute('hidden', '');
    }
  }
}
```

[ASSUMED] — pattern derived from UI-SPEC; no existing equivalent in codebase.

### Pattern 4: Promote Button with In-flight Guard

**What:** Set `button.disabled = true` immediately on click; re-render removes the button
automatically when the habit moves from scheduled to active. Use event delegation — not per-button
`addEventListener` — to avoid listener accumulation across re-renders.

```javascript
// Source: pattern derived from UI-SPEC Interaction Contract + promoteHabit.js
sectionEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.waveplanning-promote-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const habitId = btn.dataset.habitId;
  try {
    await apply({ type: 'promoteHabit', payload: { habitId } });
  } catch (_e) {
    // UI-SPEC E5: show transient inline error near button on failure
    btn.disabled = false;
    showInlineError(btn, 'Promote failed');
  }
});
```

[VERIFIED: codebase] — `apply()` call shape confirmed in `promoteHabit.js`; event delegation pattern confirmed in `mount.js` `data-action` mechanism.

### Anti-Patterns to Avoid

- **Direct `indexedDB.*` call:** All IDB access must go through `repo.js`. Wave Planning reads
  habits from `getCachedHabits()` (synchronous) and snapshots from `repo.getSnapshotsInRange()`
  (async, via the existing `refresh()` closure in `mountWaveboard`). [VERIFIED: codebase]
- **`.innerHTML`:** Absolute prohibition (D-78). All DOM built via `mount()` or explicit
  `createElement`. grep gate enforced in CI. [VERIFIED: codebase]
- **`switch` on event or cadence type:** Use dispatch tables (`HANDLERS`, `RESOLVERS`). Phase 9
  adds no new event types (promote already exists). [VERIFIED: codebase]
- **Per-element `addEventListener` inside a loop:** Attach one delegated listener on the section
  container; check `e.target.closest(selector)` inside. Re-renders do not accumulate listeners.
- **`store.subscribe` inside a render loop:** Subscribe once at mount time, not on every re-render.
  The existing `mountWaveboard` demonstrates this pattern. [VERIFIED: codebase]

---

## Integration Points

All signatures verified directly from source files.

### `mountWaveboard(parent, { repo, store })`

[VERIFIED: codebase — `js/views/desktop/waveboard.js` line 326]

```javascript
export function mountWaveboard(parent, { repo, store }) { ... }
```

- `parent`: `Element` — the `section[data-route="waveboard"]` panel.
- `repo`: the repo facade from `js/db/repo.js`.
- `store`: `{ subscribe }` object (see `desktop.js` line 207).
- Wave Planning section is added inside this function before `waveboardContainer` creation
  (D-01 — planning above heat-map) OR extracted to `mountWavePlanning(parent, { repo, store })`
  called first in `desktop.js`.

### `worstStatus(a, b)`

[VERIFIED: codebase — `js/views/desktop/waveboard.js` line 156]

```javascript
function worstStatus(a, b) {
  return (STATUS_RANK[a] ?? 0) >= (STATUS_RANK[b] ?? 0) ? a : b;
}
```

- Status rank: `{ Healthy: 1, Watch: 2, 'At-risk': 3, Failing: 4 }`.
- Returns the higher-rank (worse) of two S1 status strings.
- Currently unexported. Must be exported or the Wave Planning builder must be co-located in
  `waveboard.js` to share scope.

### `statusSlug(status)`

[VERIFIED: codebase — `js/views/desktop/waveboard.js` line 167]

```javascript
function statusSlug(status) {
  return ({ Healthy: 'healthy', Watch: 'watch', 'At-risk': 'atrisk', Failing: 'failing' })[status] ?? 'na';
}
```

- Maps S1 status string → CSS modifier slug.
- `'At-risk'` → `'atrisk'` (no hyphen in CSS class).
- Returns `'na'` for unknown/null.
- Currently unexported. Same co-location or export note as `worstStatus`.

### `getCachedHabits()`

[VERIFIED: codebase — `js/state/store.js` line 259]

```javascript
export function getCachedHabits() {
  return Array.from(cache.habits.values());
}
```

- Returns a defensive-copy array of all cached habit objects.
- Synchronous — no await needed.
- Returns habits of ALL statuses (active, mastered, scheduled, archived).
- Filter for Wave Planning: exclude `h.status === 'archived'` (D-11).

### `getAllWaves()`

[VERIFIED: codebase — `js/domain/wave.js` line 105]

```javascript
export function getAllWaves() {
  return [..._waves];
}
```

- Returns defensive copy of the 10-wave catalog loaded at boot.
- Each wave: `{ number: number, name: string, startDate: string, theme?: string }`.
- `startDate` format: `YYYY-MM-DD` (e.g. `"2026-06-15"` for Wave 5).

### `subscribe(fn)` from `js/state/store.js`

[VERIFIED: codebase — `js/state/store.js` line 220]

```javascript
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
```

- Returns an unsubscribe closure.
- `fn` is called by `notify(payload)` after every `apply()` write.
- Used in `desktop.js` as `store: { subscribe }`.

### `promoteHabit` event dispatch

[VERIFIED: codebase — `js/state/apply/promoteHabit.js` line 30]

```javascript
// Event shape dispatched to apply():
{ type: 'promoteHabit', payload: { habitId: string } }

// Handler signature:
export async function handlePromoteHabit(event, repo) { ... }

// Broadcast keys:
handlePromoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
```

- Writing `apply({ type: 'promoteHabit', payload: { habitId } })` triggers:
  1. IDB write: `habits` store, `status: 'active'`.
  2. `events` row + `meta.undoToken` in same tx.
  3. BroadcastChannel `{type: 'habit:put', habitId}` after tx.
  4. `store.notify({ keys: { habitId } })` → `store.subscribe` callbacks fire.
- The handler is already registered in `apply.js` HANDLERS table from Phase 8.

### `repo.getSnapshotsInRange(startDate, endDate)`

[VERIFIED: codebase — `js/views/desktop/waveboard.js` line 445, usage confirmed]

```javascript
snapshotRows = await repo.getSnapshotsInRange(startDate, endDate);
// Row shape: { habitId, date, s1Status, applicableToday, loggedToday, ... }
```

- Called inside `mountWaveboard`'s `refresh()` function.
- Returns an array of `score_snapshot` rows for the date range.
- Wave Planning needs only the rows for the current ISO week (not the full 12 weeks).
- **Health badge data race:** snapshot fetch is async; it must be awaited inside `refresh()` before
  calling `buildWavePlanningSection()`. The existing `refresh()` structure already handles this.

---

## File Map

### Files to Create

| File | Purpose |
|------|---------|
| `js/views/desktop/wavePlanning.js` | Pure builder `buildWavePlanningSection()` + mount function `mountWavePlanning()`; JSDoc file header per D-27 |
| `tests/unit/wavePlanning.test.js` | Unit tests for builder: WAVE-01 through WAVE-04 coverage |

### Files to Modify

| File | Change | Rationale |
|------|--------|-----------|
| `js/views/desktop/waveboard.js` | Export `worstStatus` and `statusSlug`; call `mountWavePlanning()` before `waveboardContainer` creation; OR inline Wave Planning builder if co-location is preferred | Both helpers are needed by the new builder |
| `css/desktop.css` | Append `.waveplanning-*` CSS classes to existing `@layer desktop-scoring` block | UI-SPEC defines all 15 new classes; no new layer or token file |

### Files NOT Modified

| File | Reason |
|------|--------|
| `js/desktop.js` | `mountWaveboard()` already wired at `#waveboard` route; no new DI configure call needed if Wave Planning is inside `mountWaveboard` |
| `js/state/apply/promoteHabit.js` | Already complete from Phase 8; no changes |
| `js/state/apply.js` | `promoteHabit` already in HANDLERS table |
| `js/domain/wave.js` | `getAllWaves()` already returns everything needed |
| `js/state/store.js` | `subscribe` and `getCachedHabits` already exported |
| `seed/waves.json` | Wave data is correct; 10 waves with startDates verified |

---

## Collapse / Accordion Pattern

No existing collapse component exists in this codebase. [VERIFIED: codebase — grepped
`js/views/desktop/` for `aria-expanded`, `[hidden]`, and `collapse`; none found in view files
beyond the panel-level `hidden` toggle in `desktop.js`.]

### Approach: `[hidden]` attribute + `aria-expanded` + event delegation

**Why `[hidden]` not a `.hidden` class:**
- `[hidden]` is a native HTML attribute honoured as `display: none` in all browsers.
- No extra CSS rule required.
- Consistent with `desktop.js` panel toggle (`panel.hidden = false/true`). [VERIFIED: codebase]
- UI-SPEC explicitly specifies `[hidden]` attribute. [VERIFIED: codebase — 09-UI-SPEC.md line 239]

**Why event delegation not per-button listeners:**
- `buildWavePlanningSection()` runs on every re-render.
- If listeners were attached inside the builder or `mount()`, each re-render would add new
  listeners to the new DOM, while old listeners on old (detached) DOM would be GC'd.
- A single delegated listener on the section container (attached once at mount time, not on
  re-render) is leak-proof. The `mount()` helper's `data-action` mechanism is per-element, not
  delegated, so accordion toggle and promote click must use manual delegation.

**CSS for chevron rotation:**

```css
/* From UI-SPEC — already in the CSS classes listed above */
.waveplanning-chevron {
  transition: transform 0.15s ease;
}
.waveplanning-wave-header[aria-expanded="true"] .waveplanning-chevron {
  transform: rotate(90deg);
}
```

The chevron character is the Unicode `▶` rendered as text content. CSS rotation replaces `▼`.
No SVG or icon library. [VERIFIED: codebase — UI-SPEC line 165-175]

**Full wiring sequence:**

1. `mountWavePlanning(parent, { repo, store })` runs once (idempotency guard via
   `parent.dataset.mounted` pattern from `mountWaveboard`).
2. Create a `<div class="waveplanning-wrapper">` container and `appendChild` to `parent`.
3. Attach ONE delegated click listener on the container (accordion toggle + promote action).
4. `store.subscribe(async () => { await rerenderSection(); })`.
5. `await rerenderSection()` (initial render).

**`rerenderSection()` sequence:**

1. Save expanded state: `Map<waveNumber, boolean>` from current DOM.
2. Clear children of the section `<div>` (using `clearChildren()` — the existing `waveboard.js`
   helper: `while (el.firstChild) el.removeChild(el.firstChild)`). [VERIFIED: codebase]
3. Fetch fresh data: `getAllWaves()` + `getCachedHabits()` + `await repo.getSnapshotsInRange(...)`.
4. Call `buildWavePlanningSection(...)` → description tree.
5. `mount(desc, sectionContainer)`.
6. Restore expanded state.

---

## Cadence Summary

The `buildWavePlanningSection()` builder needs to show a compact cadence summary string for each
habit in the expanded list (D-09: "name + status label + stage + cadence summary").

### Cadence object shape

[VERIFIED: codebase — `js/domain/cadence.js` lines 64-89]

```javascript
// habit.cadence shapes:
{ type: 'daily' }
{ type: 'weekly' }
{ type: 'every-n-days', n: number }
{ type: 'day-of-week-subset', days: string[] }  // days: ['mon','wed','fri']
{ type: 'monthly' }
```

### Derivation — pure function, no `appliesToday` call needed

The Wave Planning section does not need to call `appliesToday()` — it only needs a human-readable
label for display. A simple pure formatter suffices:

```javascript
// Source: cadence shapes from js/domain/cadence.js RESOLVERS dispatch table
const DOW_LABEL = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed',
  thu: 'Thu', fri: 'Fri', sat: 'Sat',
};

/**
 * Compact cadence label for display in Wave Planning habit rows.
 *
 * @param {{ type: string, n?: number, days?: string[] }|undefined} cadence
 * @returns {string}
 */
function cadenceSummary(cadence) {
  if (!cadence) return 'Daily';
  const TYPE_LABEL = {
    daily:              () => 'Daily',
    weekly:             () => 'Weekly',
    monthly:            () => 'Monthly',
    'every-n-days':     (c) => `Every ${c.n} days`,
    'day-of-week-subset': (c) => (c.days ?? []).map(d => DOW_LABEL[d] ?? d).join('/'),
  };
  const fn = TYPE_LABEL[cadence.type];
  return fn ? fn(cadence) : cadence.type;
}
```

- No `switch` statement — dispatch table (Anti-Pattern 4 compliance). [VERIFIED: codebase —
  convention enforced in `cadence.js` and checked by discipline test]
- Returns `"Daily"`, `"Weekly"`, `"Monthly"`, `"Every 3 days"`, `"Mon/Wed/Fri"` etc.
- Fallback: returns raw `cadence.type` string for unknown types (defensive, not a throw).

---

## Common Pitfalls

### Pitfall 1: Event Listener Accumulation on Re-render

**What goes wrong:** If accordion toggle listeners or promote button listeners are attached inside
`buildWavePlanningSection()` or via `mount()` per-element, every `store.subscribe` re-render adds
fresh listeners to the new DOM. Old DOM is GC'd, so this is not a classic leak — but listeners
fire multiple times if the same section container element is reused without clearing.

**Why it happens:** `mount()` supports `data-action` listeners, but those are wired to individual
elements which are destroyed and recreated on each render. If the container is kept and children
cleared+rebuilt, any listener attached to the container survives. If listeners are accidentally
re-attached to the container on each re-render, they multiply.

**How to avoid:** Attach delegated listeners (accordion toggle, promote click) ONCE to the
section wrapper div immediately after creation, before the first render. Never re-attach in
`rerenderSection()`. [ASSUMED — derived from JavaScript event delegation best practice]

**Warning signs:** Promote fires twice on first click after the second re-render.

### Pitfall 2: Health Badge Data Race

**What goes wrong:** `getCachedHabits()` is synchronous; `repo.getSnapshotsInRange()` is async.
If `buildWavePlanningSection()` is called before the snapshot await resolves, health badges show
`na` even when snapshot data exists.

**Why it happens:** The builder is a pure synchronous function — it cannot await IDB reads. The
mount function must fetch all async data first, then pass pre-computed results to the builder.

**How to avoid:** In `rerenderSection()`, always `await repo.getSnapshotsInRange(...)` before
calling `buildWavePlanningSection()`. The existing `mountWaveboard.refresh()` pattern does this
correctly — Wave Planning should follow the same structure. [VERIFIED: codebase — `waveboard.js`
lines 430-482]

**Warning signs:** Health badges all show "No data" immediately after mount even with logs.

### Pitfall 3: `worstStatus` / `statusSlug` Not Exported

**What goes wrong:** Wave Planning builder in `wavePlanning.js` needs `worstStatus()` and
`statusSlug()`, but both are currently unexported private functions in `waveboard.js`.

**How to avoid:** Either (a) export both from `waveboard.js` and import them in `wavePlanning.js`,
or (b) implement the builder as part of `waveboard.js` in shared scope. Option (a) is cleaner for
separation. [VERIFIED: codebase — both functions are `function` declarations without `export`
keyword in `waveboard.js` lines 156, 167]

**Warning signs:** `ReferenceError: worstStatus is not defined` at runtime.

### Pitfall 4: Re-render Collapses All Expanded Waves

**What goes wrong:** After a promote action, `rerenderSection()` clears and rebuilds the DOM. If
expanded state is not saved and restored, all waves snap back to collapsed.

**How to avoid:** Save `Map<waveNumber, boolean>` from `aria-expanded` attributes before
`clearChildren()`; restore after `mount()`. Use `data-wave-number` attribute on each header
button as the key. [ASSUMED — UI-SPEC explicitly specifies this; no existing pattern in codebase]

**Warning signs:** User-expanded wave collapses immediately after clicking "Promote to active".

### Pitfall 5: Archived Habits Included in Counts or Lists

**What goes wrong:** `getCachedHabits()` returns habits of all statuses including `archived`. If
the filter is missing, archived habits appear in the Wave Planning section counts and lists.

**How to avoid:** When building per-wave habit lists, filter with `h.status !== 'archived'`
before partitioning into active/mastered vs scheduled groups (D-11). [VERIFIED: codebase —
D-11 explicit in CONTEXT.md; `getCachedHabits()` returns all statuses per `store.js`]

### Pitfall 6: Health Badge for "active" count vs. "Upcoming" badge logic

**What goes wrong:** D-05 says health badge = worst S1 status of *active* habits. D-06 says
waves with zero active habits show "Upcoming" badge. If the zero-active check is done on the
full habit list (including mastered), waves with only mastered habits show "Upcoming" incorrectly.

**How to avoid:** "Active" in D-05/D-06 means `status === 'active'` only (not mastered). Check
`waveHabits.filter(h => h.status === 'active').length === 0` for the "Upcoming" path.
Copywriting contract clarifies: count string "N active" includes both active AND mastered;
health badge logic uses only `status === 'active'`. [VERIFIED: codebase — UI-SPEC line 428-430
and D-05/D-06 in CONTEXT.md]

---

## Validation Architecture

Tests use Node's built-in `node:test` + `node:assert` — no framework. [VERIFIED: codebase —
CLAUDE.md Architecture §Testing Approach]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` + `node:assert` |
| Config file | none (no config file; direct `node --test` invocation) |
| Quick run command | `node --test tests/unit/wavePlanning.test.js` |
| Full suite command | `node --test tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVE-01 | `buildWavePlanningSection` renders 10 wave headers each with `startDate` text | unit | `node --test tests/unit/wavePlanning.test.js` | No — Wave 0 task |
| WAVE-02 | Count text shows "N active · N scheduled" based on habit status | unit | `node --test tests/unit/wavePlanning.test.js` | No — Wave 0 task |
| WAVE-03 | Scheduled habits appear in expanded list with `habit.startDate` + Promote button | unit | `node --test tests/unit/wavePlanning.test.js` | No — Wave 0 task |
| WAVE-04 | Active/mastered habits appear in expanded list with status label, stage, cadence | unit | `node --test tests/unit/wavePlanning.test.js` | No — Wave 0 task |

### Sampling Rate

- **Per task commit:** `node --test tests/unit/wavePlanning.test.js`
- **Per wave merge:** `node --test tests/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/wavePlanning.test.js` — covers WAVE-01, WAVE-02, WAVE-03, WAVE-04 using the
  existing fake-document pattern from `tests/unit/mount.test.js`

No test framework install needed — `node:test` is built into Node 20+. [VERIFIED: codebase —
CLAUDE.md Commands section]

---

## Security Domain

This phase contains no authentication, no network calls, no user-generated HTML injection risk
(all DOM built via `mount()` / `createElement` + `textContent`), and no new IDB stores.

The only mutation is `promoteHabit`, which writes to an existing IDB store via the established
`apply()` chokepoint. No new security surface is introduced.

D-78 (no `.innerHTML`) is the primary XSS control. It applies to this phase. [VERIFIED: codebase]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — single user, no auth |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a — single user |
| V5 Input Validation | yes (display only) | `textContent` not `innerHTML`; `mount()` enforces this |
| V6 Cryptography | no | n/a |

---

## Open Questions

1. **Co-location vs. separate file for builder**
   - What we know: the builder is a pure function with no DOM access. `waveboard.js` already
     houses the heat-map builder. Both share `worstStatus` and `statusSlug`.
   - What's unclear: whether to co-locate in `waveboard.js` (avoids export changes, more code in
     one file) or extract to `wavePlanning.js` (cleaner separation, requires exporting helpers).
   - Recommendation: extract to `wavePlanning.js` and export `worstStatus` + `statusSlug` from
     `waveboard.js`. Keeps file size manageable and is consistent with the project's flat
     one-responsibility-per-file convention.

2. **Snapshot fetch scope for health badge**
   - What we know: `mountWaveboard.refresh()` already fetches `last12Weeks` of snapshots. The
     health badge only needs the current week.
   - What's unclear: whether to reuse the full 12-week snapshot fetch or add a narrower query.
   - Recommendation: reuse the same `repo.getSnapshotsInRange(startDate, endDate)` call; filter
     to current-week rows in the health-badge computation by comparing `isoWeekKey(row.date)` to
     the current week key. Avoids a second IDB transaction.

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `js/views/desktop/waveboard.js` — `mountWaveboard`, `worstStatus`,
  `statusSlug`, `last12Weeks`, `isoWeekKey`, `clearChildren`, `refresh` patterns
- [VERIFIED: codebase] `js/domain/wave.js` — `getAllWaves()`, `bootWaves()`, wave schema
- [VERIFIED: codebase] `js/state/store.js` — `getCachedHabits()`, `subscribe()`, `notify()`
- [VERIFIED: codebase] `js/state/apply/promoteHabit.js` — event shape, handler signature,
  `broadcastKeys`
- [VERIFIED: codebase] `js/util/mount.js` — `mount()` signature, `data-action` delegation
- [VERIFIED: codebase] `js/desktop.js` — boot sequence, `mountWaveboard` wiring, `store` shape
- [VERIFIED: codebase] `js/domain/cadence.js` — `RESOLVERS` dispatch table, cadence type shapes
- [VERIFIED: codebase] `seed/waves.json` — 10 waves with numbers, names, startDates, themes
- [VERIFIED: codebase] `.planning/REQUIREMENTS.md` — WAVE-01 through WAVE-04 requirement text
- [VERIFIED: codebase] `.planning/phases/09-desktop-waveboard/09-CONTEXT.md` — D-01 through D-14
- [VERIFIED: codebase] `.planning/phases/09-desktop-waveboard/09-UI-SPEC.md` — DOM contract,
  CSS classes, interaction contract, copywriting contract

### Secondary (MEDIUM confidence)

None — all findings are codebase-verified.

### Tertiary (LOW confidence / ASSUMED)

- [ASSUMED] `wavePlanning.js` as a separate file (viable but not yet decided; planner may choose
  co-location in `waveboard.js`)
- [ASSUMED] Expanded-state save/restore implementation detail (UI-SPEC specifies behaviour but
  not exact implementation)
- [ASSUMED] `cadenceSummary()` formatter (cadence shapes verified; formatter itself is new code)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Builder extracted to `wavePlanning.js`; `worstStatus` + `statusSlug` exported from `waveboard.js` | File Map / Open Questions | Low — planner can co-locate in `waveboard.js` instead; logic unchanged |
| A2 | Expanded-state preservation uses `data-wave-number` attribute on header buttons as key | Collapse Pattern | Low — any unique key per wave works; wave number is the natural candidate |
| A3 | `cadenceSummary()` uses a `TYPE_LABEL` dispatch table (no switch) to format cadence | Cadence Summary | None — convention is clear from cadence.js; dispatch table is mandatory |
| A4 | Snapshot fetch for health badge reuses the same 12-week `getSnapshotsInRange()` call | Integration Points / Open Questions | Low — a narrower query would also work; reuse avoids a second IDB transaction |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project files, verified in codebase
- Architecture: HIGH — patterns verified directly in `waveboard.js`, `store.js`, `promoteHabit.js`
- Pitfalls: HIGH (listener accumulation, data race) / MEDIUM (assumed patterns not yet in code)
- Cadence summary: HIGH — cadence shapes verified; formatter is new but trivially derived

**Research date:** 2026-08-25
**Valid until:** indefinite — pure codebase research; no external dependencies to go stale
