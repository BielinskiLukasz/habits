---
phase: 09-desktop-waveboard
reviewed: 2026-08-26T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - js/views/desktop/wavePlanning.js
  - js/views/desktop/waveboard.js
  - css/desktop.css
  - js/io/seed.js
  - tests/unit/wavePlanning.test.js
  - tests/integration/seed.idempotent.test.js
findings:
  critical: 0
  warning: 10
  info: 4
  total: 14
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-08-26
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 9 delivered the Wave Planning accordion section (`wavePlanning.js`), wired it into `waveboard.js` via `mountWavePlanning`, added CSS classes, and closed a seed migration gap for the `wave` field on existing databases. The pure builder pattern is sound, the D-78 / anti-pattern 4 discipline holds, and the migration logic is functionally correct. However, ten warnings were found across correctness, HTML validity, and code quality: one circular module dependency, one wave-name resolution dead-code path in the heatmap, stale migration flags causing wasted IDB transactions on first boot, and several smaller issues documented below.

---

## Warnings

### WR-01: Circular ES module dependency between waveboard.js and wavePlanning.js

**File:** `js/views/desktop/waveboard.js:34` and `js/views/desktop/wavePlanning.js:15`
**Issue:** `waveboard.js` imports `mountWavePlanning` from `wavePlanning.js`, and `wavePlanning.js` imports `worstStatus`, `statusSlug`, `isoWeekKey` from `waveboard.js`. This is a direct circular dependency. ES modules handle it via live bindings, and this specific cycle does not crash because the imported symbols from `waveboard.js` are only used inside function bodies of `wavePlanning.js` (never at module init time). However, the cycle is fragile: any future module-level use of those imports in `wavePlanning.js` will observe `undefined` at init time, causing a silent malfunction or a `TypeError`.

The three shared utilities (`worstStatus`, `statusSlug`, `isoWeekKey`) are pure functions with no dependency on `waveboard.js`-specific state. They belong in a shared utility module.

**Fix:** Extract `worstStatus`, `statusSlug`, and `isoWeekKey` to `js/views/desktop/waveStatus.js` (or `js/domain/waveStatus.js`). Import from there in both `waveboard.js` and `wavePlanning.js`, eliminating the cycle.

---

### WR-02: Wave name lookup in `buildHabitsByWave` always falls through to generic fallback

**File:** `js/views/desktop/waveboard.js:384-387`
**Issue:** The wave-name resolution guard checks `store.cache.waves` — a property that does not exist in the documented store API. CLAUDE.md defines `store.cache` as containing only `habits`, `logs`, and `settings` slices. There is no `waves` slice. The condition is therefore always `false`, so every wave header in the Score Matrix table reads "Wave 1", "Wave 2", etc. — never the actual wave name (e.g., "Morning rituals", "Focus").

Compare with `wavePlanning.js` which correctly calls `getAllWaves()` and receives properly named waves.

```js
// Current (always falls through):
const waveName =
  (store && store.cache && store.cache.waves && store.cache.waves.get)
    ? (store.cache.waves.get(waveNum)?.name ?? `Wave ${waveNum}`)
    : `Wave ${waveNum}`;

// Fix — match the pattern used in wavePlanning.js:
import { getAllWaves } from '../../domain/wave.js';
// ...inside buildHabitsByWave or refresh(), build a lookup map once:
const waveNameMap = new Map(getAllWaves().map(w => [w.number, w.name]));
const waveName = waveNameMap.get(waveNum) ?? `Wave ${waveNum}`;
```

---

### WR-03: `<h3>` as a direct child of `<ul>` is invalid HTML

**File:** `js/views/desktop/wavePlanning.js:153`
**Issue:** `buildHabitList` pushes an `h3` node into the children array of a `ul` element:

```js
children.push({ tag: 'h3', attrs: { class: 'waveplanning-scheduled-heading' }, text: 'Scheduled' });
```

The HTML spec requires `ul` to contain only `li`, `script`, or `template` elements as direct children. Browsers parse this with error recovery but the resulting DOM is non-conforming. Screen readers expose `ul > h3` inconsistently across AT implementations, and validators will flag it.

**Fix:** Wrap the heading and scheduled rows in a `li` containing a nested group (or use a `<div>` separator outside the `ul` / restructure as two separate lists):

```js
// Option A — render as a separate sibling section, not inside the ul:
return {
  tag: 'div',
  attrs: { class: 'waveplanning-habit-list-wrapper', id: `wave-${wave.number}-list`, hidden: '' },
  children: [
    { tag: 'ul', attrs: { class: 'waveplanning-habit-list' }, children: activeHabits.map(buildActiveHabitRow) },
    ...(scheduledHabits.length > 0 ? [
      { tag: 'h3', attrs: { class: 'waveplanning-scheduled-heading' }, text: 'Scheduled' },
      { tag: 'ul', attrs: { class: 'waveplanning-habit-list' }, children: scheduledHabits.map(buildScheduledHabitRow) },
    ] : []),
  ],
};
```

Note: the `id` used for `aria-controls` must still point to the correct element, so move the `id` / `hidden` to the wrapper `div`.

---

### WR-04: "N active" count text silently includes mastered habits

**File:** `js/views/desktop/wavePlanning.js:183,186`
**Issue:** `activeHabits` is defined as habits with `status === 'active' || status === 'mastered'`, but the counts label always says "N active":

```js
const activeHabits = waveHabits.filter(h => h.status === 'active' || h.status === 'mastered');
const countsText = `${activeHabits.length} active · ${scheduledHabits.length} scheduled`;
```

A wave with 3 mastered and 1 active habits will display "4 active". This is a user-visible inaccuracy.

**Fix:** Either (a) split the count into active + mastered, or (b) label it "in progress" / "enrolled":

```js
const activeCount = waveHabits.filter(h => h.status === 'active').length;
const masteredCount = waveHabits.filter(h => h.status === 'mastered').length;
const countsText = `${activeCount} active · ${masteredCount} mastered · ${scheduledHabits.length} scheduled`;
```

---

### WR-05: Accordion toggle uses `document.getElementById` instead of `container.ownerDocument`

**File:** `js/views/desktop/wavePlanning.js:285`
**Issue:** The accordion click handler calls `document.getElementById(listId)` — a direct reference to `globalThis.document`. The codebase pattern (established by `mount.js`) uses `parent.ownerDocument` to remain document-agnostic. Using the global `document` directly breaks the pattern that allows `mount` to work in non-global document contexts (unit tests, future SSR, etc.). If `container` is ever mounted into a non-main document, the `getElementById` lookup will silently find nothing or the wrong element.

```js
// Current:
const list = document.getElementById(listId);

// Fix — use the container's owning document:
const list = container.ownerDocument.getElementById(listId);
```

---

### WR-06: Wave header row always rendered in Score Matrix even when all habits are archived

**File:** `js/views/desktop/waveboard.js:233-246`
**Issue:** In `buildWaveboardRows`, each wave group always emits a wave header `tr` row before iterating over habits. When `showArchived = false` and all habits in a wave are archived, no habit rows follow the header, leaving an orphaned wave header with nothing beneath it. Users will see wave names floating with empty bodies.

```js
// Current — header always emitted:
rows.push({ tag: 'tr', attrs: { class: 'analytics-wave-header' }, ... });
for (const habit of waveGroup.habits) {
  if (isArchived && !showArchived) continue;
  // ...
}

// Fix — only emit header if at least one habit will be visible:
const visibleHabits = showArchived
  ? waveGroup.habits
  : waveGroup.habits.filter(h => h.status !== 'archived');
if (visibleHabits.length === 0) continue;
rows.push({ tag: 'tr', attrs: { class: 'analytics-wave-header' }, ... });
for (const habit of visibleHabits) { ... }
```

---

### WR-07: Promote button can accumulate multiple error spans on repeated failures

**File:** `js/views/desktop/wavePlanning.js:303-308`
**Issue:** When the Promote button fails, an error span is inserted after the button and removed after 3 seconds. The button is also re-enabled (`btn.disabled = false`). If the user clicks again before the 3-second timer expires and it fails again, a second error span is inserted adjacent to the first. Multiple overlapping spans are visible briefly.

```js
// Fix — clear any existing error span before inserting a new one:
catch (_err) {
  btn.disabled = false;
  const existing = btn.parentNode.querySelector('.waveplanning-promote-error');
  if (existing) existing.remove();
  const errSpan = document.createElement('span');
  // ...
}
```

---

### WR-08: Stale fast-path variables cause three extra no-op IDB transactions on first boot

**File:** `js/io/seed.js:112-115,227,272,308`
**Issue:** `habitVersionsSeeded`, `waveFieldSeeded`, and `waveFieldV2` are read into local `const` variables at lines 112-115, before the seed transaction runs. The seed transaction writes `habitVersionsSeeded = true` (line 212), but the local variable is still the original value (`undefined`). As a result, on a fresh database the three subsequent `if (!habitVersionsSeeded)`, `if (!waveFieldSeeded)`, and `if (!waveFieldV2)` guards all evaluate to `true` even though the seed tx already set two of the flags. All three migration blocks then run as no-ops (empty `toUpdate` / `habitsToBackfill` arrays), each issuing its own IDB transaction to write the flag it was going to write.

On first boot: 4 IDB transactions fire (seed tx + 3 migration txs) instead of 1.

**Fix:** After the seed transaction completes, re-read or short-circuit migration guards using knowledge that the seed path just ran:

```js
// After the seed `await repo.runTx(...)` block at line 220:
// Skip the migration blocks because the seed tx already wrote all required flags.
// Jump directly to the persist gate.
if (seed) {
  // ... (seed tx)
  // Seed path sets habitVersionsSeeded + waveFieldSeeded + waveFieldV2 in one tx:
  tx.objectStore('meta').put({ key: 'habitVersionsSeeded', value: true });
  tx.objectStore('meta').put({ key: 'waveFieldSeeded', value: true });
  tx.objectStore('meta').put({ key: 'waveFieldV2', value: true });
  // Then skip migration blocks with an early goto / flag:
}
```

Alternatively, after the seed tx resolves, skip the migration `if` blocks with a local `seededThisRun` flag.

---

### WR-09: Redundant double fetch of `habits.json` in combined V1+V2 migration scenario

**File:** `js/io/seed.js:276-279,310-313`
**Issue:** When a user's database has `seededIds` set but neither `waveFieldSeeded` nor `waveFieldV2` (the real migration path for users upgrading from pre-P9 builds), `seed` is `null` at line 275 (the initial-fetch path was skipped). The V1 migration fetches `habits.json` into `seedForWave` (line 277-279). The V2 migration then checks `seedForWaveV2 = seed` — which is still `null` (the module-level variable, not `seedForWave`) — and fetches `habits.json` again (line 311-313). This is two network round-trips for the same file.

**Fix:** After the V1 migration fetch, share the result with V2:

```js
// V1 migration (around line 273):
let seedForWave = seed;
if (!seedForWave && fetchFn) {
  const res = await fetchFn('./seed/habits.json');
  seedForWave = await res.json();
  seed = seedForWave; // propagate so V2 migration reuses it
}
```

---

### WR-10: Fire-and-forget async callbacks swallow errors silently

**File:** `js/views/desktop/wavePlanning.js:373-375` and `js/views/desktop/waveboard.js:494-499`
**Issue:** Initial renders and store subscription callbacks fire async functions without attaching `.catch()`:

```js
// wavePlanning.js line 373-375:
store.subscribe(async () => { await rerenderSection(); });
rerenderSection(); // fire-and-forget initial render

// waveboard.js line 494-499:
store.subscribe(async () => { await refresh(); });
refresh();
```

If `rerenderSection()` or `refresh()` throw (e.g., the repo fails in an unexpected way after the internal try-catch), the rejection is unhandled. Node.js will print a warning; browsers will silently swallow it. The view will remain blank with no feedback.

**Fix:** Attach a `.catch()` on each fire-and-forget call:

```js
rerenderSection().catch(err => console.error('[wavePlanning] render failed:', err));
```

---

## Info

### IN-01: Test fixture uses `stage: 2` (scalar) instead of `stages`/`currentStageIndex` (array+index)

**File:** `tests/unit/wavePlanning.test.js:49`
**Issue:** The `ALL_HABITS` fixture for `h1` uses `stage: 2`, but `buildActiveHabitRow` reads `habit.stages ?? []` and `habit.currentStageIndex ?? 0`. The fixture field `stage` is ignored; the stage label column in the description tree will always render as `''` in these tests. The stage rendering path is never actually exercised with real data.

**Fix:** Update the fixture to match the real habit shape:

```js
{ id: 'h1', wave: 1, status: 'active',
  stages: [{ label: 'Foundation' }, { label: 'Habit' }, { label: 'Mastered' }],
  currentStageIndex: 2,
  name: 'Morning walk', cadence: { type: 'daily' } },
```

Add an assertion that `stageLabel.text === 'Mastered'` to cover the stage rendering path.

---

### IN-02: Integration tests hardcode `8` as the expected habit count

**File:** `tests/integration/seed.idempotent.test.js:83-84,89,120,133`
**Issue:** The test asserts `repo._stores.habits.size === 8` and `repo._stores.events.size === 8`. This number is derived by inspecting the seed fixture, not declared as a constant. If `seed/habits.json` gains or loses a habit, the test fails with a confusing numeric mismatch.

**Fix:** Derive the expected count dynamically from the fixture or declare a named constant:

```js
const SEED_HABIT_COUNT = JSON.parse(readFileSync(SEED_PATH, 'utf8')).habits.length;
assert.equal(repo._stores.habits.size, SEED_HABIT_COUNT, ...);
```

---

### IN-03: Hardcoded UUID in second-run no-op test

**File:** `tests/integration/seed.idempotent.test.js:122`
**Issue:** `const editedId = '015105be-fc0b-45b6-b939-4e8d395fcf13';` — this UUID is expected to be the "Morning walk" habit. If that habit is ever removed or its UUID changes in the seed file, the test silently picks an `undefined` original and the assertion at line 126 fails with a confusing error.

**Fix:** Pick the ID dynamically from the seed data or from the stored `seededIds` meta row:

```js
const seededIds = repo._stores.meta.get('seededIds').value;
const editedId = seededIds[0]; // deterministic: first inserted habit
```

---

### IN-04: No integration test for the `waveFieldV2` migration path

**File:** `tests/integration/seed.idempotent.test.js`
**Issue:** There is a test for the `waveFieldSeeded` V1 migration (lines 263-296) but no corresponding test for the `waveFieldV2` migration scenario. The V2 migration (all habits, not just seeded IDs) is the critical path for users whose databases were repaired by an import that pre-dates P9. Coverage gap: the V2 migration block in `seed.js:308-334` is only reached on first boot (where it is a no-op), never in a realistic "missing-wave-on-imported-habits" scenario.

---

_Reviewed: 2026-08-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
