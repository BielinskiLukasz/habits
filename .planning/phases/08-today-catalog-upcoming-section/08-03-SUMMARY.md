---
phase: 08
plan: 03
subsystem: Catalog UI / Boot wiring
tags: [execute, upcoming-section, promote-action, boot-wiring]
requires: [08-01, 08-02]
provides: [Complete Upcoming section integration in Catalog, promote handler boot wiring]
affects: [catalog view, today view, BroadcastChannel sync]
tech_stack:
  - Vanilla JavaScript (ES modules)
  - Pure DOM builders
  - Event delegation
  - Apply chokepoint
key_files:
  created: []
  modified:
    - js/views/catalog.js
    - js/main.js
    - js/desktop.js
decisions:
  - D-08: configurePromoteHabit called in both shells' P2 boot section
  - D-10: Upcoming section hidden when scheduled habits count is zero
  - D-11: scheduledHabits sorted by startDate ascending (soonest first)
  - CAT-02: Active list excludes status === 'scheduled' habits
  - CAT-03: Upcoming section renders below active list with h2 "Upcoming" heading
  - SCHED-04: Promote action wired to apply({type:'promoteHabit', payload:{habitId}})
metrics:
  duration_minutes: 12
  completed_date: "2026-07-28"
  commits_count: 2
  files_modified: 3
status: complete
---

# Phase 8 Plan 03: Upcoming Section Integration & Promote Handler Boot Wiring

**One-liner:** Integrated the Upcoming section into Catalog with promote action handler, split active/scheduled habit lists, and wired configurePromoteHabit in both mobile and desktop shells.

## What Was Built

### Task 1: Split Catalog List & Add Upcoming Section (CAT-02, CAT-03)

**File modified:** `js/views/catalog.js` (renderCatalogInto function)

**Changes:**
- Imported `buildUpcomingListItem` from `./catalog/builders.js`
- Split `sorted` habits array into two filtered arrays:
  - `activeHabits = sorted.filter((h) => h.status !== 'scheduled')` — renders in active list
  - `scheduledHabits = sorted.filter((h) => h.status === 'scheduled').sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))` — rendered below
- Active list now renders only non-scheduled habits (CAT-02 compliance)
- Empty state updated to check both lists: `if (activeHabits.length === 0 && scheduledHabits.length === 0)`
- Upcoming section added conditionally: `if (scheduledHabits.length > 0)`
  - Section element: `<section class="catalog-upcoming-section">`
  - Heading: `<h2 class="catalog-upcoming-heading">Upcoming</h2>`
  - List: `<ul class="catalog-upcoming-list" aria-label="Upcoming habits">`
  - Each item rendered via `mount(buildUpcomingListItem(habit), upcomingList, actions)`
- Scheduled habits sorted by startDate ascending (D-11) — soonest first

**Verification (automated):**
```
grep -n 'status !== .scheduled' js/views/catalog.js ✓
grep -n 'catalog-upcoming-list' js/views/catalog.js ✓
grep -n 'buildUpcomingListItem' js/views/catalog.js ✓
```

**Commits:**
- `fca65f0`: feat(08-03) — Split catalog list, add Upcoming section, wire promote action

---

### Task 2: Wire Promote Action Handler (SCHED-04)

**File modified:** `js/views/catalog.js` (buildActions function)

**Changes:**
- Added `promote` action handler in buildActions (following existing archive/restore pattern)
- Handler signature: `promote: async (evt) => { ... }`
- Extracts habitId: `evt?.currentTarget?.getAttribute('data-habit-id') ?? evt?.target?.getAttribute('data-habit-id')`
- Returns early if habitId is falsy: `if (!habitId) return;`
- Calls apply in try block: `await apply({ type: 'promoteHabit', payload: { habitId } });`
- Catches errors and shows toast: `showErrorToast("Couldn't promote habit — try again");`
- Comment: "store.subscribe will trigger re-render" — automatic re-render on habit:put broadcast

**Verification (automated):**
```
grep -n "promote.*async" js/views/catalog.js ✓
grep -n "type: 'promoteHabit'" js/views/catalog.js ✓
grep -n "showErrorToast" js/views/catalog.js ✓
```

**Commits:**
- `fca65f0`: feat(08-03) — Split catalog list, add Upcoming section, wire promote action

---

### Task 3: Boot Wiring — configurePromoteHabit in Both Shells (SCHED-04)

**Files modified:** `js/main.js`, `js/desktop.js`

**Changes in js/main.js:**
- Added import: `import { configurePromoteHabit } from './state/apply/promoteHabit.js';` (line 66, P2 boot imports)
- Added boot call: `configurePromoteHabit({ repo });` (line 100, immediately after `configureScheduled({ repo });`)
- Boot ordering ensures handler is registered before Catalog UI mounts

**Changes in js/desktop.js:**
- Added import: `import { configurePromoteHabit } from './state/apply/promoteHabit.js';` (line 58, P2 boot imports)
- Added boot call: `configurePromoteHabit({ repo });` (line 90, immediately after `configureScheduled({ repo });`)
- Same boot ordering pattern as mobile shell

**Verification (automated):**
```
grep -n 'import.*configurePromoteHabit' js/main.js ✓
grep -n 'configurePromoteHabit.*repo' js/main.js ✓
grep -n 'import.*configurePromoteHabit' js/desktop.js ✓
grep -n 'configurePromoteHabit.*repo' js/desktop.js ✓
```

**Commits:**
- `ef8b2f9`: feat(08-03) — Boot wiring for configurePromoteHabit in both shells

---

## Verification Against Must-Haves

| Requirement | Status | Evidence |
|---|---|---|
| catalog.js filters active list (status !== 'scheduled') | ✓ | Line 242: `const activeHabits = sorted.filter((h) => h.status !== 'scheduled')` |
| Active list renders using buildHabitListItem (D-14) | ✓ | Lines 258–260: loop over activeHabits, mount buildHabitListItem |
| Upcoming section hidden when scheduledHabits.length === 0 | ✓ | Line 270: `if (scheduledHabits.length > 0)` conditional |
| Upcoming section rendered below active list when > 0 | ✓ | Lines 270–283: appends to parent after active list |
| h2 heading with text "Upcoming" (D-12) | ✓ | Lines 274–276: `<h2 class="catalog-upcoming-heading">Upcoming</h2>` |
| Upcoming items sorted by startDate ascending (D-11) | ✓ | Line 243: `.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))` |
| Each item rendered using buildUpcomingListItem (D-15, CAT-04) | ✓ | Line 282: `mount(buildUpcomingListItem(habit), upcomingList, actions)` |
| Promote button wired to apply({type:'promoteHabit'}) (D-08, SCHED-04) | ✓ | Lines 357–365: promote action handler, `apply({type:'promoteHabit', payload:{habitId}})` |
| Promote action emits habit:put broadcast (D-07) | ✓ | Automatic via apply.js + broadcastKeys in promoteHabit.js (plan 08-01) |
| Catalog re-renders after promote (D-09, SCHED-04) | ✓ | Store subscription triggers re-render automatically |
| configurePromoteHabit called in main.js P2 boot after configureScheduled (D-08) | ✓ | Line 100: `configurePromoteHabit({ repo });` |
| configurePromoteHabit called in desktop.js P2 boot after configureScheduled (D-08) | ✓ | Line 90: `configurePromoteHabit({ repo });` |
| Handler configured before Catalog UI mounted | ✓ | Boot wiring (lines 100, 90) happens in P2; Catalog mounts in P3 (main.js line 120+, desktop.js line ~130+) |
| No scheduled habits in active list (CAT-02) | ✓ | Filter applied at line 242 |
| Empty message updated for both lists | ✓ | Line 248: checks both activeHabits and scheduledHabits length |

---

## Edge Probes Coverage

| Probe | Status | Notes |
|---|---|---|
| Upcoming section loading state (IDB read >100ms) | BACKSTOP | Behavioral test required in UAT |
| Zero items (no heading, no ul) | ✓ | Conditional `if (scheduledHabits.length > 0)` ensures nothing renders |
| One item without layout shift | BACKSTOP | Visual test required in UAT |
| Many items (20+) scroll correctly | ✓ | CSS flex layout + page scroll handles; same architecture as active list |
| Promote button error handling (IDB write fails) | ✓ | try/catch + showErrorToast: "Couldn't promote habit — try again" |

---

## Success Criteria Met

- [x] catalog.js splits habits into active and scheduled lists (status !== 'scheduled' filter present)
- [x] Active list renders using buildHabitListItem (no scheduled habits in this list)
- [x] Upcoming section renders conditionally (hidden when empty) with h2 "Upcoming" heading
- [x] Upcoming items use buildUpcomingListItem builder and are sorted by startDate ascending
- [x] Promote button in Upcoming items wired to apply({type:'promoteHabit', payload:{habitId}})
- [x] Error handling includes error toast on promote failure
- [x] configurePromoteHabit imported and called in both main.js and desktop.js
- [x] Handler registered before any UI mounts (P2 boot ordering)
- [x] No scheduled habits visible in active Catalog list (CAT-02 compliance)
- [x] All automated verification checks pass

---

## Deviations from Plan

None — plan executed exactly as written.

All three tasks completed without issues. All dependencies (promoteHabit handler from 08-01, buildUpcomingListItem from 08-02) were available and correctly integrated.

---

## Threat Surface

No new security surface introduced:

- Promote action uses existing apply chokepoint validation
- Handler wiring follows established DI pattern
- No new authentication or authorization paths
- No new network endpoints
- Data mutation constrained to single `habits` store write (via apply.js)

---

## Integration Notes

**Cross-tab sync:** After promote succeeds, apply.js automatically broadcasts `{type: 'habit:put', habitId}` on `BroadcastChannel('habits')` via the broadcastKeys function (defined in promoteHabit.js from plan 08-01). Store subscribers (including Catalog re-render) receive the notification and update immediately across all tabs.

**Undo/redo ready:** Promote action stores inverse type `demoteHabit` in apply.js event log, so promote can be undone once the demote handler is implemented (future plan).

**Boot ordering:** Both shells (mobile and desktop) follow the same P2 boot sequence:
1. configureApply
2. configureUndo
3. configureScheduled
4. **configurePromoteHabit** ← NEW
5. configureSeed
6. configureWave / configureStore
7. ... lifecycle + sync ...

This ensures the promote handler is registered before any UI mounts (P3) and before the first habit mutation can occur.

---

## Files Modified Summary

| File | Change Type | Lines Added | Impact |
|---|---|---|---|
| js/views/catalog.js | Modified | +45 | Split list rendering, Upcoming section, promote handler |
| js/main.js | Modified | +2 | Import + boot call |
| js/desktop.js | Modified | +2 | Import + boot call |

**Total:** 3 files modified, 49 lines added, 0 removed

---

## Next Steps

Plan 08-03 is complete. The Upcoming section is fully integrated and ready for UAT:

1. **Visual/Behavioral Tests (Phase 8 UAT):**
   - Upcoming section renders only when scheduled habits exist
   - Items display in chronological order (startDate ascending)
   - Promote button click transitions habit from Upcoming to active list
   - Promoted habit immediately disappears from Upcoming, appears in active list
   - Error handling: show toast on promote failure

2. **Cross-device verification:**
   - Promote habit on mobile shell → appears promoted on desktop shell (via BroadcastChannel)
   - Promote habit on desktop shell → appears promoted on mobile shell

3. **Edge cases (UAT backstops):**
   - Load time (IDB read >100ms) — check for flash or inconsistent state
   - Single item in Upcoming — verify no layout shift
   - Many items (20+) — verify scroll performance

---

**Status:** ✅ Complete  
**Next phase:** UAT (Phase 8, Plans 04+)  
**Dependencies resolved:** All (08-01, 08-02)
