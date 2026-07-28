# Phase 8: Today & Catalog — Upcoming Section - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 6 (1 new, 5 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/state/apply/promoteHabit.js` | service (apply handler) | CRUD (update) | `js/state/apply/archiveHabit.js` | exact |
| `js/views/catalog.js` | component (view mounter) | request-response | `js/views/catalog.js` (existing) | self-analog |
| `js/views/catalog/builders.js` | utility (DOM builder) | transform | `js/views/catalog/builders.js` (existing) | self-analog |
| `js/views/today.js` | component (view mounter) | request-response | `js/views/today.js` (existing) | self-analog |
| `js/main.js` | config (boot wiring) | initialization | `js/main.js` (existing) | self-analog |
| `js/desktop.js` | config (boot wiring) | initialization | `js/desktop.js` (existing) | self-analog |

## Pattern Assignments

### `js/state/apply/promoteHabit.js` (service, CRUD)

**Analog:** `js/state/apply/archiveHabit.js`

**File Header Pattern** (lines 1–18):
```javascript
/**
 * @file promoteHabit handler (SCHED-04).
 *
 * Handles the promotion of a scheduled habit to active status.
 * This handler only writes to the `habits` store — logs are never touched,
 * preserving full history integrity across the status change.
 *
 * Handler contract (matches archiveHabit.js shape):
 *   - Signature: `handlePromoteHabit(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['habits']` — no log or events writes (apply.js auto-adds events + meta)
 *   - `writes`: single `{store:'habits', value: updatedHabit}` entry
 *   - `inverse`: round-trip event for undo (promoteHabit ↔ demoteHabit)
 *   - `broadcastKeys(event) -> {habitId}`: ID-only broadcast (Pitfall 8)
 *
 * Forbidden constructs:
 *   - Direct calls to js/db/repo.js write helpers
 *   - `switch (` statement (Anti-Pattern 4)
 */
```

**Handler Function Pattern** (lines 20–65):
```javascript
/**
 * `promoteHabit` handler — set habit.status to 'active'.
 *
 * Reads the current habit row for undo capture (Pitfall 7 — prior locked at
 * write-time). Inverse is `demoteHabit` so undo returns to 'scheduled' status.
 *
 * @param {{ type: 'promoteHabit', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handlePromoteHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  const updated = { ...habit, status: 'active' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'demoteHabit', payload: { habitId } },
  };
}

handlePromoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
```

**Why this pattern:** `archiveHabit.js` (lines 30–42) demonstrates the exact structure for habit status mutations: read prior habit for undo, spread the object, update the status field, return storeNames=['habits'] and writes=[{store:'habits', value:updated}], provide a broadcastKeys function. Copy this structure exactly, changing only the status value ('active' instead of 'archived') and inverse type name.

---

### `js/views/catalog.js` (component, request-response)

**Analog:** `js/views/catalog.js` (existing, lines 121–130 for sorting logic; lines 217–258 for rendering layout)

**Sorting Pattern (existing — extend for upcoming)** (lines 121–130):
```javascript
/**
 * Sort habits: active first, then archived; within each group by wave asc,
 * then by id (stable fallback).
 *
 * @param {object[]} habits
 * @returns {object[]}
 */
function sortHabits(habits) {
  return [...habits].sort((a, b) => {
    const aArchived = a.status === 'archived' ? 1 : 0;
    const bArchived = b.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    const waveDiff = (a.wave ?? 0) - (b.wave ?? 0);
    if (waveDiff !== 0) return waveDiff;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}
```

**Render Function Pattern (existing — adapt for split lists)** (lines 217–258):
```javascript
async function renderCatalogInto(parent, deps) {
  const { repo } = deps;
  clearChildren(parent);

  // Load habits from cache first; fall back to repo if cache is cold.
  let habits = getCachedHabits ? getCachedHabits() : [];
  if (!habits.length && repo && typeof repo.getAllHabits === 'function') {
    try {
      habits = await repo.getAllHabits();
    } catch (_e) {
      habits = [];
    }
  }

  const masteryMap = await evaluateMasteryForCatalog(habits, deps);
  const sorted = sortHabits(habits);

  // Build actions map that closures over the live parent + deps.
  const actions = buildActions(parent, deps);

  // Render header.
  mount(buildCatalogHeader(), parent, actions);

  // Render active habit list container — NOW FILTERED TO EXCLUDE SCHEDULED.
  const activeHabits = sorted.filter((h) => h.status !== 'scheduled');
  // ... mount active habit list (existing logic)

  // Render Upcoming section BELOW active list — CONDITIONAL on nonzero scheduled count.
  const scheduledHabits = sorted.filter((h) => h.status === 'scheduled')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  
  if (scheduledHabits.length > 0) {
    // Render Upcoming section heading.
    // Render scheduled habits list using buildUpcomingListItem().
  }
}
```

**Action Handler for Promote** (new handler to add to `buildActions`, following existing `archive`/`restore` pattern at lines 332–356):
```javascript
/**
 * Promote a scheduled habit to active.
 */
promote: async (evt) => {
  const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
    ?? evt?.target?.getAttribute('data-habit-id');
  if (!habitId) return;
  try {
    await apply({ type: 'promoteHabit', payload: { habitId } });
    // store.subscribe will trigger re-render.
  } catch (_e) {
    showErrorToast("Couldn't promote habit — try again");
  }
},
```

**Why this pattern:** The existing `renderCatalogInto` (lines 217–258) shows the pattern for loading habits, filtering, sorting, and mounting DOM. For phase 8, split the `sorted` array into two filtered arrays: one for `status !== 'scheduled'` (active list, render as-is), one for `status === 'scheduled'` (upcoming list, render conditionally below). The promote action (lines 332–356 archive/restore reference) should follow the same try/catch + showErrorToast structure.

---

### `js/views/catalog/builders.js` (utility, transform)

**Analog:** `js/views/catalog/builders.js` (existing, lines 67–179 for `buildHabitListItem`)

**buildUpcomingListItem Pattern** (new function, mirror of `buildHabitListItem` but simplified):
```javascript
/**
 * Build a simplified description for one scheduled habit row in the Upcoming list.
 *
 * Displays: habit name (primary), Wave N badge, ISO startDate, Edit button, Promote button.
 * No stage info, mastery badge, or archive button — the habit hasn't started yet.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   wave: number,
 *   startDate: string,
 * }} habit
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildUpcomingListItem(habit) {
  const children = [];

  // Primary info block: name + wave badge + startDate.
  children.push({
    tag: 'div',
    attrs: { class: 'catalog-habit-info' },
    children: [
      { tag: 'span', attrs: { class: 'catalog-habit-name' }, text: habit.name },
      { tag: 'div', attrs: { class: 'catalog-habit-badges' }, children: [
        { tag: 'span', attrs: { class: 'catalog-habit-wave' }, text: `Wave ${habit.wave}` },
        { tag: 'span', attrs: { class: 'catalog-upcoming-date' }, text: habit.startDate },
      ] },
    ],
  });

  // Action buttons block: Edit + Promote.
  const actionBtns = [];

  // Edit button.
  actionBtns.push({
    tag: 'button',
    attrs: {
      class: 'catalog-btn catalog-btn--edit',
      'data-action': 'edit',
      'data-habit-id': habit.id,
      'aria-label': `Edit ${habit.name}`,
    },
    text: 'Edit',
  });

  // Promote button.
  actionBtns.push({
    tag: 'button',
    attrs: {
      class: 'catalog-btn catalog-btn--promote',
      'data-action': 'promote',
      'data-habit-id': habit.id,
      'aria-label': `Promote ${habit.name} to active`,
    },
    text: 'Promote',
  });

  children.push({
    tag: 'div',
    attrs: { class: 'catalog-habit-actions' },
    children: actionBtns,
  });

  return {
    tag: 'li',
    attrs: {
      class: 'catalog-upcoming-item',
      'data-habit-id': habit.id,
    },
    children,
  };
}
```

**Why this pattern:** `buildHabitListItem` (lines 67–179) demonstrates the pure description builder pattern: return `{tag, attrs, children}`, no DOM access. The Upcoming item is a simplified version: it keeps the name + wave badge + ISO startDate (lines 101–108) but drops stage/mastery/archive logic. Mirror the button structure (lines 115–149) but with only Edit + Promote buttons. Use distinct CSS class `catalog-upcoming-item` (D-16) to allow independent styling.

---

### `js/views/today.js` (component, request-response)

**Verification Location** (line 391):
```javascript
const allActive = getCachedHabits().filter((h) => h.status === 'active');
```

**Why this pattern:** Phase 7 added the `status === 'scheduled'` field. Line 391 already filters for `status === 'active'`, which excludes scheduled habits. CAT-01 (verify) requires no code change — this filter already satisfies the requirement. A test or manual check confirms that scheduled habits do not appear on Today's check-in surface.

---

### `js/main.js` (config, initialization)

**Analog:** `js/main.js` (existing boot section, lines 89–105)

**Configure Boot Pattern** (lines 89–105 as reference; insert `configurePromoteHabit` call after `configureScheduled` at line 98):
```javascript
// P2 spine boot — DATA-03/04/07/08, SEED-01..05.
configureApply({
  repo,
  broadcast,
  trackTx,
  onLogWrite: async (habitId) => {
    try { await writeHabitSnapshots(habitId, repo); } catch (_e) {}
  },
});
configureUndo({ repo });
configureScheduled({ repo });
// ADD THIS LINE after configureScheduled:
// configurePromoteHabit({ repo }); // NEW: D-08 — promote handler DI

configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
configureWave({ fetch: globalThis.fetch });
configureStore({ repo });
configureExport({ repo });
configureImport({ repo, broadcast });
configureBackupNag({ repo });
```

**Import Addition** (top of file, after other state imports):
```javascript
// Add this import alongside other apply handler imports:
import { configurePromoteHabit } from './state/apply/promoteHabit.js';
```

**Why this pattern:** The boot block (lines 89–105) follows the DI pattern: each configure call binds a handler to the repo + other dependencies. `configurePromoteHabit({repo})` mirrors the signature of `configureArchiveHabit` (which is implicitly configured in the same block). Insert it after `configureScheduled` (line 98) so the promote handler is ready before any catalog render.

---

### `js/desktop.js` (config, initialization)

**Analog:** `js/desktop.js` (existing boot section, lines 79–97)

**Configure Boot Pattern** (lines 79–97 as reference; insert `configurePromoteHabit` call after `configureScheduled` at line 88):
```javascript
// P2 spine boot — DATA-03/04/07/08, SEED-01..05. Same as main.js.
configureApply({
  repo,
  broadcast,
  trackTx,
  onLogWrite: async (habitId) => {
    try { await writeHabitSnapshots(habitId, repo); } catch (_e) {}
  },
});
configureUndo({ repo });
configureScheduled({ repo });
// ADD THIS LINE after configureScheduled:
// configurePromoteHabit({ repo }); // NEW: D-08 — promote handler DI

configureSeed({ repo, storage: navigator.storage, fetch: globalThis.fetch });
configureExport({ repo });
configureImport({ repo, broadcast });
configureBackupNag({ repo });
```

**Import Addition** (top of file, after other state imports at line 62):
```javascript
// Add this import alongside other domain/state imports:
import { configurePromoteHabit } from './state/apply/promoteHabit.js';
```

**Why this pattern:** Desktop shell (lines 79–97) mirrors the mobile shell boot block. Add the same `configurePromoteHabit({repo})` call in the same position (after `configureScheduled`) so both shells support the promote action in catalog view (D-08 requires it in both shells).

---

## Shared Patterns

### Error Handling (apply action handlers)
**Source:** `js/state/apply/archiveHabit.js` (lines 30–42)
**Apply to:** `promoteHabit.js`, catalog.js action handlers

All apply handlers follow this pattern:
```javascript
// Read prior state (for undo), mutate, return structured result.
export async function handlePromoteHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  const updated = { ...habit, status: 'active' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'demoteHabit', payload: { habitId } },
  };
}

handlePromoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
```

View-side action handlers wrap apply in try/catch and show error toast:
```javascript
promote: async (evt) => {
  const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
    ?? evt?.target?.getAttribute('data-habit-id');
  if (!habitId) return;
  try {
    await apply({ type: 'promoteHabit', payload: { habitId } });
    // store.subscribe will trigger re-render.
  } catch (_e) {
    showErrorToast("Couldn't promote habit — try again");
  }
},
```

### BroadcastChannel Sync
**Source:** `js/state/apply/archiveHabit.js` (lines 42)
**Apply to:** `promoteHabit.js`, catalog.js

All habit state mutations emit BroadcastChannel messages:
```javascript
handlePromoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
```

This is automatically picked up by `apply.js` and sent as `{type: 'habit:put', habitId}` on the `'habits'` channel, triggering re-renders in other tabs/windows (D-30, D-07).

### DOM Builder Pattern
**Source:** `js/views/catalog/builders.js` (lines 23–40, 67–179)
**Apply to:** `buildUpcomingListItem(habit)` in builders.js

All builders return pure `{tag, attrs?, children?}` descriptions:
- No DOM access inside builders
- Use `text` for text nodes, `children` for element lists
- Use `data-action` and `data-habit-id` attrs for event delegation
- Use CSS classes for styling (no inline styles)

## No Analog Found

None — all files being created/modified have clear analogs in the existing codebase.

## Metadata

**Analog search scope:** `js/state/apply/`, `js/views/`, `js/`
**Files scanned:** 11 files (3 apply handlers, 5 view files, 2 boot files, 1 main entry)
**Pattern extraction date:** 2026-07-28

---

*Phase: 8 - Today & Catalog — Upcoming Section*
*Context received: 2026-07-20*
