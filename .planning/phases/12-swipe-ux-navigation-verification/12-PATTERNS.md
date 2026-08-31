# Phase 12: Swipe UX & Navigation Verification - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `js/domain/logStatus.js` | domain/utility | transform | `js/domain/cadence.js` | exact |
| `tests/unit/logStatus.test.js` | test | transform | `tests/unit/cadence.test.js` | exact |
| `js/views/today.js` | view | event-driven | self (modify `handleSwipeEnd` + `_swipeMarkComplete`) | self |
| `js/views/today/builders.js` | view/builder | transform | self (modify `buildTodayRow`) | self |
| `js/views/history.js` | view | event-driven | `js/views/today.js` swipe pattern | role-match |
| `js/views/history/builders.js` | view/builder | transform | `js/views/today/builders.js` | role-match |

---

## Pattern Assignments

### `js/domain/logStatus.js` (domain, transform)

**Analog:** `js/domain/cadence.js`

**File header pattern** (`cadence.js` lines 1–44):
```js
/**
 * @file Pure cadence resolver for the 5 cadence types (D-48, D-49, D-50, D-51, CADENCE-03).
 * ...
 * Dispatch via the `RESOLVERS` table (Anti-Pattern 4 extended: NO `switch
 * (habit.cadence.type)`).
 * ...
 * Forbidden constructs in this file:
 *   - `switch` statement on `habit.cadence.type` (Anti-Pattern 4)
 *   - `indexedDB.*` / `repo.*` calls — pure module (D-48 / specifics).
 *   - `.innerHTML` family — D-78 grep gate covers this file too.
 */
```

**Dispatch table pattern** (`cadence.js` lines 64–89):
```js
// NO switch statement — use a lookup object (Anti-Pattern 4)
const RESOLVERS = {
  daily: () => true,
  weekly: (h, d, ctx) => { ... },
  'every-n-days': (h, d) => { ... },
};

export function appliesToday(habit, date, ctx) {
  const resolver = RESOLVERS[habit.cadence.type];
  if (!resolver) {
    throw new Error(`cadence: unknown type ${habit.cadence.type}`);
  }
  return resolver(habit, date, ctx);
}
```

**Apply to `logStatus.js`:** Use an object literal `NEXT_STATE` mapping current → next status instead of a `switch`. Export `nextLogState(currentStatus)`. Treat `null` and `undefined` as the same key (coerce: `currentStatus ?? null`).

```js
/** @file Pure log-state cycle function for the 4-state swipe model (D-04, D-05). */

const NEXT_STATE = {
  null: 'completed',
  completed: 'failed',
  failed: 'skipped',
  skipped: null,
};

/**
 * Advance a log status by one step in the cycle: undefined/null → completed → failed → skipped → null.
 *
 * @param {string|null|undefined} currentStatus
 * @returns {string|null}
 */
export function nextLogState(currentStatus) {
  const key = String(currentStatus ?? null);
  return Object.prototype.hasOwnProperty.call(NEXT_STATE, key)
    ? NEXT_STATE[key]
    : null;
}
```

---

### `tests/unit/logStatus.test.js` (test, transform)

**Analog:** `tests/unit/cadence.test.js`

**Imports pattern** (`cadence.test.js` lines 16–20):
```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { appliesToday } from '../../js/domain/cadence.js';
```

**Test structure pattern** (`cadence.test.js` lines 32–53):
```js
describe('appliesToday — daily', () => {
  test('returns true regardless of date', () => {
    const habit = { id: 'h', cadence: { type: 'daily' } };
    assert.equal(appliesToday(habit, '2026-05-28', zeroCtx()), true);
  });
});
```

**Discipline assertion pattern** (`cadence.test.js` — reads source file and asserts no `switch (`):
```js
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// ... later:
const src = readFileSync(`${ROOT}js/domain/cadence.js`, 'utf8');
assert.ok(src.includes('RESOLVERS'), 'cadence.js must use RESOLVERS table');
assert.ok(!src.includes('switch ('), 'cadence.js must not use switch statement');
```

**Apply to `logStatus.test.js`:** 6 minimum test cases (one per input state for the 4 known states + null + undefined). Add discipline assertion that `logStatus.js` uses `NEXT_STATE` and has no `switch (`.

---

### `js/views/today.js` — `handleSwipeEnd` + `_swipeMarkComplete` modification

**Current pattern to replace** (lines 324–349):
```js
function handleSwipeEnd(evt) {
  if (!_swipeEl) return;
  const dx = evt.clientX - _swipeStartX;
  const slide = _swipeEl.querySelector('.today-row__slide');
  const row = _swipeEl;
  _swipeEl = null;

  if (dx > 60) {
    // Swipe right → mark complete.
    if (slide) slide.style.transform = '';
    const habitId = row.querySelector('[data-habit-id]')?.getAttribute('data-habit-id');
    if (habitId) _swipeMarkComplete(habitId);          // ← replace this
  } else if (dx < -60) { ... }
}
```

**Current `_swipeMarkComplete`** (lines 265–274) — always dispatches `markCompleted`:
```js
async function _swipeMarkComplete(habitId) {
  const date = todayLocal();
  try {
    await apply({ type: 'markCompleted', payload: { habitId, date } });
    ...
  } catch (_err) { showErrorToast(...); }
}
```

**How to read current status** (from `getCachedLog` usage, line 581):
```js
const status = getCachedLog(habitId, date)?.status ?? null;
```

**Replacement pattern** — rename `_swipeMarkComplete` to `_swipeCycleLog`, import `nextLogState`:
```js
import { nextLogState } from '../domain/logStatus.js';

async function _swipeCycleLog(habitId) {
  const date = todayLocal();
  const currentStatus = getCachedLog(habitId, date)?.status ?? null;
  const next = nextLogState(currentStatus);
  const type = next === 'completed' ? 'markCompleted'
              : next === 'failed'    ? 'markFailed'
              : next === 'skipped'   ? 'markSkipped'
              : 'markUncompleted';
  try {
    await apply({ type, payload: { habitId, date } });
    ...
  } catch (_err) { showErrorToast(...); }
}
```

---

### `js/views/today/builders.js` — `buildTodayRow` modification

**Current pattern** (lines 149–213):
```js
export function buildTodayRow({ habit, status = null }) {
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';
  // ... builds tapChildren based on isCompleted / isSkipped

  const rowClasses = ['today-row'];
  if (isCompleted) rowClasses.push('today-row--completed');
  if (isSkipped)   rowClasses.push('today-row--skipped');
}
```

**Extension pattern** — add `isFailed` branch parallel to `isSkipped`:
```js
const isCompleted = status === 'completed';
const isFailed    = status === 'failed';
const isSkipped   = status === 'skipped';

// Glyph mapping — add in tapChildren block:
// isCompleted → glyph '✓'
// isFailed    → glyph '✕'   (NEW — D-03)
// isSkipped   → glyph '↷'   (NEW — D-03)
// none        → no glyph

const rowClasses = ['today-row'];
if (isCompleted) rowClasses.push('today-row--completed');
if (isFailed)    rowClasses.push('today-row--failed');   // NEW
if (isSkipped)   rowClasses.push('today-row--skipped');
```

**CSS tokens to add** in `css/tokens.css` (follow existing pattern, lines 18–65):
```css
/* Existing pattern: */
--color-score-failing: #ef4444;

/* New tokens for failed state row tint (follow same naming convention): */
--color-failed-bg: rgba(239, 68, 68, 0.12);   /* subtle red tint */
```

**CSS rule to add** in `css/today.css` (parallel to `.today-row--completed` at line 64):
```css
/* Failed rows — red tint (D-03). Background tint + glyph, not color-only (NFR-07). */
.today-row--failed {
  background: var(--color-failed-bg);
}
.today-row--failed .today-row-name {
  opacity: 0.75;
}
```

---

### `js/views/history.js` — `handleSwipeEnd` modification

**Current pattern** (`history.js` lines 147–177) — identical structure to `today.js`:
```js
function handleSwipeEnd(evt) {
  if (!_swipeEl) return;
  const dx = evt.clientX - _swipeStartX;
  const slide = _swipeEl.querySelector('.history-row__slide');
  const row = _swipeEl;
  _swipeEl = null;

  if (dx > 60) {
    if (slide) slide.style.transform = '';
    const habitId = row.querySelector('[data-habit-id]')?.getAttribute('data-habit-id');
    if (habitId) {
      apply({ type: 'markCompleted', payload: { habitId, date: selectedDate } })  // ← replace
        .then(() => { ... render(selectedDate); })
        .catch(() => showErrorToast(...));
    }
  } else if (dx < -60) { ... }
}
```

**Replacement** — same cycle logic as `today.js` but reads log from repo (not cache) because history renders arbitrary dates:
```js
import { nextLogState } from '../domain/logStatus.js';

// In handleSwipeEnd, dx > 60 branch:
if (habitId) {
  // History reads from repo.getLog(habitId, selectedDate) since cache only holds current week.
  repo.getLog(habitId, selectedDate)
    .then((log) => {
      const currentStatus = log?.status ?? null;
      const next = nextLogState(currentStatus);
      const type = next === 'completed' ? 'markCompleted'
                 : next === 'failed'    ? 'markFailed'
                 : next === 'skipped'   ? 'markSkipped'
                 : 'markUncompleted';
      return apply({ type, payload: { habitId, date: selectedDate } });
    })
    .then(() => { ... render(selectedDate); })
    .catch(() => showErrorToast(...));
}
```

---

### `js/views/history/builders.js` — `buildHistoryHabitRow` modification

**Existing CSS classes** (`css/history.css` lines 117–131):
```css
.history-habit-row--completed { opacity: 0.55; }
.history-habit-row--skipped .history-habit-name { opacity: 0.6; font-style: italic; }
.history-habit-row--failed .history-habit-name { opacity: 0.7; }
```

The `--failed` CSS class already exists. The builder just needs to apply it and add the `✕` glyph, mirroring the `--skipped` treatment. No new CSS needed for history — the class is already defined.

---

## Shared Patterns

### No `switch` on status/event type (Anti-Pattern 4)
**Source:** `js/domain/cadence.js` — `RESOLVERS` dispatch table
**Apply to:** `js/domain/logStatus.js`
Use an object literal for the cycle map. The discipline test in `logStatus.test.js` must assert `src.includes('NEXT_STATE')` and `!src.includes('switch (')`.

### JSDoc `@file` header (D-27)
**Source:** `js/domain/cadence.js` line 1
**Apply to:** `js/domain/logStatus.js`
Every new `.js` file starts with `/** @file <one-line summary>. <D-XX references> */`.

### `node:test` + `node:assert/strict` test structure (D-23)
**Source:** `tests/unit/cadence.test.js` lines 16–20
**Apply to:** `tests/unit/logStatus.test.js`
```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
```
No external test framework. Use `describe` + `test` blocks. No DOM, no IDB.

### `getCachedLog` for current-week status reads
**Source:** `js/views/today.js` line 581
**Apply to:** `today.js` swipe handler (current week only)
```js
const status = getCachedLog(habitId, date)?.status ?? null;
```
For history view (arbitrary past dates), read from `repo.getLog()` instead since the cache only holds the current ISO week.

### CSS token naming convention
**Source:** `css/tokens.css` lines 61–65
```css
--color-score-healthy: #10b981;
--color-score-watch: #f59e0b;
--color-score-atrisk: #f97316;
--color-score-failing: #ef4444;
```
New `failed` state token follows the same `--color-<semantic>-<modifier>` pattern: `--color-failed-bg`.

---

## No Analog Found

All files have close analogs. No entries.

---

## Metadata

**Analog search scope:** `js/domain/`, `js/views/`, `tests/unit/`, `css/`
**Files scanned:** cadence.js, cadence.test.js, today.js, today/builders.js, history.js, history/builders.js, tokens.css, today.css, history.css
**Pattern extraction date:** 2026-08-31
