# Phase 9: Desktop Waveboard - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 4 (2 create, 2 modify)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/views/desktop/wavePlanning.js` | view builder + mount | request-response (read IDB + render) | `js/views/desktop/waveboard.js` | exact |
| `tests/unit/wavePlanning.test.js` | test | — | `tests/unit/builders.catalog.test.js` + `tests/unit/mount.test.js` | exact |
| `js/views/desktop/waveboard.js` (modify) | view — export helpers | — | self | exact |
| `css/desktop.css` (modify) | style | — | `css/desktop.css` existing `@layer desktop-scoring` block | exact |

---

## Pattern Assignments

### `js/views/desktop/wavePlanning.js` (view builder + mount)

**Analog:** `js/views/desktop/waveboard.js`

**File-level JSDoc header pattern** (waveboard.js lines 1–30):
```javascript
/**
 * @file Wave Planning accordion section (WAVE-01, WAVE-02, WAVE-03, WAVE-04).
 * Renders per-wave rows with startDate, active/scheduled counts, health badge,
 * and collapsible habit lists with a Promote action for scheduled habits.
 *
 * D-26 Tier 1 / Pattern S8: `buildWavePlanningSection` is a pure function.
 * `mountWavePlanning` wires it into real DOM via `mount()` from `js/util/mount.js`.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write` (D-78).
 *   - Direct `indexedDB.*` calls — use repo facade only (Anti-Pattern 1).
 *   - `switch` on cadence or event type — use dispatch tables (Anti-Pattern 4).
 */
```

**Imports pattern** (waveboard.js lines 32–33):
```javascript
import { mount } from '../../util/mount.js';
import { todayLocal } from '../../util/date.js';
import { getAllWaves } from '../../domain/wave.js';
import { getCachedHabits } from '../../state/store.js';
import { apply } from '../../state/apply.js';
// worstStatus and statusSlug will be exported from waveboard.js (see Modify section)
import { worstStatus, statusSlug } from './waveboard.js';
```

**Pure builder function pattern** (waveboard.js lines 187–203 — `buildWaveboardHeader`):
```javascript
/**
 * Build the Wave Planning section description tree.
 *
 * @param {{ waves: object[], habits: object[], snapshotsByWeek: Map<string, Map<string, string>> }} args
 *   - waves: from getAllWaves()
 *   - habits: from getCachedHabits(), pre-filtered (no archived)
 *   - snapshotsByWeek: Map<habitId, Map<isoWeekKey, s1Status>> for current week
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildWavePlanningSection({ waves, habits, currentWeekKey, snapshotsByWeek }) {
  const waveItems = waves.map(wave => buildWaveItem(wave, habits, currentWeekKey, snapshotsByWeek));
  return {
    tag: 'section',
    attrs: { class: 'waveplanning', 'aria-label': 'Wave Planning' },
    children: [
      { tag: 'h2', attrs: { class: 'waveplanning-title' }, text: 'Wave Planning' },
      ...waveItems,
    ],
  };
}
```

**Wave item builder — header button + collapsible list** (derived from D-07/D-08/D-09 + mount.js pattern):
```javascript
function buildWaveItem(wave, habits, currentWeekKey, snapshotsByWeek) {
  const waveHabits = habits.filter(h => h.wave === wave.number);
  const activeHabits = waveHabits.filter(h => h.status === 'active' || h.status === 'mastered');
  const scheduledHabits = waveHabits.filter(h => h.status === 'scheduled');

  // Health badge (D-05/D-06)
  const badgeDesc = buildHealthBadge(wave.number, activeHabits, currentWeekKey, snapshotsByWeek);

  const listId = `waveplanning-list-wave-${wave.number}`;
  return {
    tag: 'div',
    attrs: { class: 'waveplanning-wave' },
    children: [
      {
        tag: 'button',
        attrs: {
          class: 'waveplanning-wave-header',
          'aria-expanded': 'false',
          'aria-controls': listId,
          'data-wave-number': String(wave.number),
        },
        children: [
          { tag: 'span', attrs: { class: 'waveplanning-chevron', 'aria-hidden': 'true' }, text: '▶' },
          { tag: 'span', attrs: { class: 'waveplanning-wave-name' }, text: `Wave ${wave.number} — ${wave.name}` },
          { tag: 'span', attrs: { class: 'waveplanning-wave-startdate' }, text: wave.startDate },
          { tag: 'span', attrs: { class: 'waveplanning-wave-counts' }, text: `${activeHabits.length} active · ${scheduledHabits.length} scheduled` },
          badgeDesc,
        ],
      },
      buildHabitList(listId, activeHabits, scheduledHabits),
    ],
  };
}
```

**[hidden] collapsible list pattern** (D-07 + UI-SPEC DOM contract):
```javascript
function buildHabitList(listId, activeHabits, scheduledHabits) {
  // hidden attribute — browser-native display:none; no CSS class needed
  const children = [
    ...activeHabits.map(h => buildActiveHabitRow(h)),
  ];
  if (scheduledHabits.length > 0) {
    children.push({ tag: 'li', attrs: { class: 'waveplanning-scheduled-heading' }, text: 'Scheduled' });
    children.push(...scheduledHabits.map(h => buildScheduledHabitRow(h)));
  }
  return {
    tag: 'ul',
    attrs: { id: listId, class: 'waveplanning-habit-list', hidden: '' },
    children,
  };
}
```

**Health badge builder pattern** (D-05/D-06 — uses `worstStatus` + `statusSlug`):
```javascript
function buildHealthBadge(waveNumber, activeHabits, currentWeekKey, snapshotsByWeek) {
  const activeOnly = activeHabits.filter(h => h.status === 'active');
  if (activeOnly.length === 0) {
    return { tag: 'span', attrs: { class: 'waveplanning-badge waveplanning-badge--upcoming' }, text: 'Upcoming' };
  }
  let worst = null;
  for (const h of activeOnly) {
    const weekMap = snapshotsByWeek.get(h.id);
    const s1 = weekMap?.get(currentWeekKey) ?? null;
    worst = worstStatus(worst, s1);
  }
  const slug = statusSlug(worst);
  return { tag: 'span', attrs: { class: `waveplanning-badge waveplanning-badge--${slug}` }, text: worst ?? 'No data' };
}
```

**Cadence summary — dispatch table (no switch), Anti-Pattern 4** (from RESEARCH.md + cadence.js convention):
```javascript
const DOW_LABEL = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

/**
 * Compact cadence label for display in Wave Planning habit rows.
 * @param {{ type: string, n?: number, days?: string[] }|undefined} cadence
 * @returns {string}
 */
function cadenceSummary(cadence) {
  if (!cadence) return 'Daily';
  const TYPE_LABEL = {
    daily:                () => 'Daily',
    weekly:               () => 'Weekly',
    monthly:              () => 'Monthly',
    'every-n-days':       (c) => `Every ${c.n} days`,
    'day-of-week-subset': (c) => (c.days ?? []).map(d => DOW_LABEL[d] ?? d).join('/'),
  };
  const fn = TYPE_LABEL[cadence.type];
  return fn ? fn(cadence) : cadence.type;
}
```

**Mount function pattern** (waveboard.js lines 326–491 — idempotency guard + subscribe once + async refresh):
```javascript
/**
 * Mount the Wave Planning accordion section into `parent`.
 * Idempotency guard via parent.dataset.mounted (D-115 pattern).
 *
 * @param {Element} parent
 * @param {{ repo: object, store: object }} deps
 */
export function mountWavePlanning(parent, { repo, store }) {
  if (parent.dataset.wavePlanningMounted) return;
  parent.dataset.wavePlanningMounted = 'true';

  // Container — delegated listeners attached here once, survive re-renders
  const container = parent.ownerDocument.createElement('div');
  container.setAttribute('class', 'waveplanning-wrapper');
  parent.appendChild(container);

  // Accordion toggle — ONE delegated listener on container (Pitfall 1)
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button.waveplanning-wave-header');
    if (!btn) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const listId = btn.getAttribute('aria-controls');
    const list = container.ownerDocument.getElementById(listId);
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (list) {
      if (expanded) list.setAttribute('hidden', '');
      else list.removeAttribute('hidden');
    }
  });

  // Promote button — ONE delegated listener on container (Pitfall 1)
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.waveplanning-promote-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const habitId = btn.dataset.habitId;
    try {
      await apply({ type: 'promoteHabit', payload: { habitId } });
    } catch (_e) {
      btn.disabled = false;
      // UI-SPEC E5: show transient inline error near button
    }
  });

  /** Save aria-expanded state before re-render (Pitfall 4) */
  function saveExpandedState() {
    const state = new Map();
    for (const btn of container.querySelectorAll('button.waveplanning-wave-header')) {
      state.set(btn.dataset.waveNumber, btn.getAttribute('aria-expanded') === 'true');
    }
    return state;
  }

  /** Restore aria-expanded state after re-render (Pitfall 4) */
  function restoreExpandedState(state) {
    for (const btn of container.querySelectorAll('button.waveplanning-wave-header')) {
      const wasExpanded = state.get(btn.dataset.waveNumber) ?? false;
      btn.setAttribute('aria-expanded', wasExpanded ? 'true' : 'false');
      const listId = btn.getAttribute('aria-controls');
      const list = container.ownerDocument.getElementById(listId);
      if (list) {
        if (wasExpanded) list.removeAttribute('hidden');
        else list.setAttribute('hidden', '');
      }
    }
  }

  /** clearChildren — D-78, copied from waveboard.js line 389 */
  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /** Fetch data and re-render section (Pitfall 2: await snapshots before build) */
  async function rerenderSection() {
    const expandedState = saveExpandedState();
    clearChildren(container);

    const today = todayLocal();
    const waves = getAllWaves();
    const allHabits = getCachedHabits().filter(h => h.status !== 'archived'); // D-11

    // Fetch current-week snapshots (reuse getSnapshotsInRange, filter to current week)
    let snapshotRows = [];
    try {
      snapshotRows = await repo.getSnapshotsInRange(today, today); // narrow to current week as needed
    } catch (_e) { /* non-fatal */ }

    // Build snapshotsByWeek: Map<habitId, Map<isoWeekKey, s1Status>>
    const snapshotsByWeek = new Map();
    for (const row of snapshotRows) {
      if (!row.habitId || !row.date || !row.s1Status) continue;
      if (!snapshotsByWeek.has(row.habitId)) snapshotsByWeek.set(row.habitId, new Map());
      snapshotsByWeek.get(row.habitId).set(isoWeekKey(row.date), row.s1Status);
    }

    const currentWeekKey = isoWeekKey(today);
    const desc = buildWavePlanningSection({ waves, habits: allHabits, currentWeekKey, snapshotsByWeek });
    mount(desc, container);
    restoreExpandedState(expandedState);
  }

  // Subscribe ONCE — never re-subscribe on re-render (Anti-Pattern warning in RESEARCH.md)
  store.subscribe(async () => { await rerenderSection(); });

  // Initial render
  rerenderSection();
}
```

---

### `js/views/desktop/waveboard.js` (modify — export two helpers)

**Change required:** Add `export` keyword to `worstStatus` (line 156) and `statusSlug` (line 167).

**Before** (lines 156, 167):
```javascript
function worstStatus(a, b) { ... }
function statusSlug(status) { ... }
```

**After:**
```javascript
export function worstStatus(a, b) { ... }
export function statusSlug(status) { ... }
```

**Also:** Call `mountWavePlanning(parent, { repo, store })` inside `mountWaveboard` before `waveboardContainer` is created (line 347), so Wave Planning appears above the heat-map (D-01).

---

### `css/desktop.css` (modify — append to `@layer desktop-scoring`)

**Analog:** existing `@layer desktop-scoring` block (lines 86–180).

**Pattern to follow** (existing score-badge + waveboard-cell classes, lines 88–116):
```css
/* existing pattern to mimic: */
.score-badge--healthy  { background: var(--color-score-healthy); }
.waveboard-cell--healthy  { background: var(--color-score-healthy); color: #fff; }
```

**New classes to append inside `@layer desktop-scoring`:**
```css
/* Wave Planning accordion — appended to @layer desktop-scoring */
.waveplanning-wrapper {
  margin-bottom: var(--space-5);
}
.waveplanning-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-3);
}
.waveplanning-wave {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-bottom: var(--space-2);
}
.waveplanning-wave-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-raised);
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: var(--text-md);
}
.waveplanning-chevron {
  transition: transform 0.15s ease;
  flex-shrink: 0;
}
.waveplanning-wave-header[aria-expanded="true"] .waveplanning-chevron {
  transform: rotate(90deg);
}
/* Health badges — reuse color token semantics from waveboard-cell--{slug} */
.waveplanning-badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: 4px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: #fff;
  margin-left: auto;
  flex-shrink: 0;
}
.waveplanning-badge--healthy  { background: var(--color-score-healthy); }
.waveplanning-badge--watch    { background: var(--color-score-watch); }
.waveplanning-badge--atrisk   { background: var(--color-score-atrisk); }
.waveplanning-badge--failing  { background: var(--color-score-failing); }
.waveplanning-badge--upcoming { background: var(--color-score-na); }
/* Habit list inside accordion */
.waveplanning-habit-list {
  list-style: none;
  margin: 0;
  padding: 0 var(--space-4) var(--space-3);
}
.waveplanning-habit-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-md);
}
.waveplanning-scheduled-heading {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-fg-muted);
  padding: var(--space-2) 0 var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.waveplanning-promote-btn {
  margin-left: auto;
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent);
  background: transparent;
  cursor: pointer;
}
.waveplanning-promote-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### `tests/unit/wavePlanning.test.js` (test)

**Analog:** `tests/unit/builders.catalog.test.js` (pure-builder object-shape tests, no DOM/jsdom).

**File-level JSDoc + imports pattern** (builders.catalog.test.js lines 1–28):
```javascript
/**
 * @file Unit tests for js/views/desktop/wavePlanning.js — pure builder
 * `buildWavePlanningSection` (WAVE-01, WAVE-02, WAVE-03, WAVE-04).
 *
 * Builders are pure functions returning description trees. NO DOM polyfill needed.
 * Pattern S8 (D-26 Tier 1) — fixture-based tests on object shapes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildWavePlanningSection } from '../../js/views/desktop/wavePlanning.js';
```

**Tree traversal helpers pattern** (builders.catalog.test.js lines 30–59):
```javascript
/** Recursively find all nodes matching a predicate in a description tree. */
function findAll(desc, pred) {
  if (!desc || typeof desc === 'string') return [];
  const results = [];
  if (pred(desc)) results.push(desc);
  for (const child of desc.children ?? []) {
    results.push(...findAll(child, pred));
  }
  return results;
}
function findFirst(desc, pred) { return findAll(desc, pred)[0]; }
function allText(desc) {
  if (typeof desc === 'string') return [desc];
  const results = [];
  if (desc.text !== undefined) results.push(String(desc.text));
  for (const child of desc.children ?? []) results.push(...allText(child));
  return results;
}
```

**Test fixture pattern + test structure** (builders.catalog.test.js style):
```javascript
// Minimal fixture data
const WAVES = [
  { number: 1, name: 'Morning rituals', startDate: '2026-01-05', theme: 'morning' },
  { number: 2, name: 'Focus & deep work', startDate: '2026-03-02', theme: 'focus' },
];
const HABITS = [
  { id: 'h1', wave: 1, status: 'active', name: 'Morning walk', stage: 2, cadence: { type: 'daily' } },
  { id: 'h2', wave: 1, status: 'scheduled', name: 'Cold shower', stage: 0, cadence: { type: 'daily' }, startDate: '2026-02-01' },
  { id: 'h3', wave: 1, status: 'archived', name: 'Old habit', stage: 1, cadence: { type: 'daily' } }, // D-11: must not appear
];
const SNAPSHOTS = new Map([['h1', new Map([['2026-W03', 'Healthy']])]]);
const CURRENT_WEEK = '2026-W03';

describe('buildWavePlanningSection — WAVE-01: wave headers with startDate', () => {
  test('renders a wave header for each wave with startDate text', () => {
    const desc = buildWavePlanningSection({ waves: WAVES, habits: HABITS, currentWeekKey: CURRENT_WEEK, snapshotsByWeek: SNAPSHOTS });
    const headers = findAll(desc, n => n.attrs?.class?.includes('waveplanning-wave-header'));
    assert.equal(headers.length, 2);
    const texts = allText(headers[0]).join(' ');
    assert.ok(texts.includes('2026-01-05'), 'startDate present in wave 1 header');
  });
});

describe('buildWavePlanningSection — WAVE-02: counts', () => {
  test('shows "1 active · 1 scheduled" for wave 1', () => {
    const desc = buildWavePlanningSection({ waves: WAVES, habits: HABITS, currentWeekKey: CURRENT_WEEK, snapshotsByWeek: SNAPSHOTS });
    const countNode = findFirst(desc, n => n.attrs?.class === 'waveplanning-wave-counts');
    assert.ok(countNode?.text?.includes('1 active'), 'active count present');
    assert.ok(countNode?.text?.includes('1 scheduled'), 'scheduled count present');
  });
});

describe('buildWavePlanningSection — D-11: archived habits excluded', () => {
  test('archived habit h3 does not appear in description tree', () => {
    const desc = buildWavePlanningSection({ waves: WAVES, habits: HABITS.filter(h => h.status !== 'archived'), currentWeekKey: CURRENT_WEEK, snapshotsByWeek: SNAPSHOTS });
    const texts = allText(desc).join(' ');
    assert.ok(!texts.includes('Old habit'), 'archived habit not rendered');
  });
});
```

---

## Shared Patterns

### Builder Pattern (D-26 / Pattern S8)
**Source:** `js/views/desktop/waveboard.js` lines 187–299 (`buildWaveboardHeader`, `buildWaveboardRows`)
**Apply to:** `wavePlanning.js` `buildWavePlanningSection` and all sub-builders
```javascript
// Pure function: no DOM access, no side effects, no async
// Returns: { tag, attrs?, text?, children? } description tree
// mount() in mountWavePlanning converts to real DOM
export function buildWavePlanningSection({ waves, habits, currentWeekKey, snapshotsByWeek }) { ... }
```

### No `.innerHTML` (D-78)
**Source:** `js/util/mount.js` lines 47–75 + discipline test
**Apply to:** All DOM construction in `wavePlanning.js`
- All text via `textContent` (through `mount()` `text:` field) or `createTextNode`
- All elements via `mount()` description tree
- `clearChildren` uses `while (el.firstChild) el.removeChild(el.firstChild)` — copied from `waveboard.js` line 389

### Idempotency Guard (D-115)
**Source:** `js/views/desktop/waveboard.js` lines 328–329
```javascript
if (parent.dataset.mounted === 'waveboard') return;
parent.dataset.mounted = 'waveboard';
```
**Apply to:** `mountWavePlanning` — use `parent.dataset.wavePlanningMounted`

### store.subscribe reactivity
**Source:** `js/views/desktop/waveboard.js` lines 484–487
```javascript
store.subscribe(async () => {
  await refresh();
});
refresh(); // initial render
```
**Apply to:** `mountWavePlanning` — subscribe once at mount time, never inside rerenderSection

### clearChildren helper (D-78)
**Source:** `js/views/desktop/waveboard.js` lines 388–390
```javascript
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
```
**Apply to:** `rerenderSection()` in `mountWavePlanning` before rebuilding DOM

### Async refresh with non-fatal IDB error swallow
**Source:** `js/views/desktop/waveboard.js` lines 430–481
```javascript
async function refresh() {
  try {
    // ... await repo calls ...
  } catch (_e) {
    // Non-fatal — render with whatever we have.
  }
  renderGrid();
}
```
**Apply to:** `rerenderSection()` in `mountWavePlanning`

### Promote event shape (already built, no changes)
**Source:** `js/state/apply/promoteHabit.js` line 30
```javascript
await apply({ type: 'promoteHabit', payload: { habitId } });
```
**Apply to:** promote button delegated click handler in `mountWavePlanning`

### CSS token usage
**Source:** `css/desktop.css` lines 88–116
```css
/* Pattern: use --color-score-* tokens for status colors */
.score-badge--healthy { background: var(--color-score-healthy); }
/* Pattern: use --space-* for padding/gap, --text-* for font-size */
```
**Apply to:** all `.waveplanning-*` classes in `css/desktop.css` additions

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Accordion/collapse behavior | interaction pattern | event-driven | No collapse/accordion exists in codebase — implement from scratch per RESEARCH.md Pattern 2 + UI-SPEC DOM contract |
| Expanded-state save/restore | interaction pattern | — | No precedent — implement per RESEARCH.md Pattern 3 |

---

## Metadata

**Analog search scope:** `js/views/desktop/`, `js/util/`, `js/state/apply/`, `tests/unit/`, `css/`
**Files scanned:** 6 (waveboard.js, mount.js, desktop.css, builders.catalog.test.js, mount.test.js, promoteHabit.js)
**Pattern extraction date:** 2026-08-25
