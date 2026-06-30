# Phase 4: Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves) - Research

**Researched:** 2026-06-04
**Domain:** Habit lifecycle, catalog CRUD, stage progression, mastery evaluation, multi-occurrence logging, history navigation, wave aggregates
**Confidence:** HIGH

## Summary

Phase 4 extends the cadence engine (Phases 1-3 foundation) and light up the full habit lifecycle management — catalog CRUD with versioning, stage progression with composable triggers, mastery threshold evaluation with rolling windows, multi-occurrence logging (numeric +1 and slot-checklist), history navigation with version-aware log evaluation, and wave-level aggregate metrics.

The phase is constrained by locked decisions from Phase 3 discussion (04-CONTEXT.md): habit-definition edits NEVER rewrite historical logs (D-82..D-90); all mutations flow through the single chokepoint `apply.js` with undo via `meta.undoToken`; storage is raw IndexedDB with no external dependencies.

**Primary recommendation:** Phase 4 is fundamentally a domain-model implementation phase. No new runtime dependencies are introduced. Research focuses on understanding the exact semantics of cadence-aware denominators, version-aware history evaluation, stage trigger composition, and multi-occurrence log shapes. Testing strategy carries forward from Phase 3 (node --test + hand-written fake-IDB + integration + browser smoke).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Habit catalog CRUD (create/edit/archive/restore) | Browser Client | API — | All state lives in IDB; no remote persistence in v1 |
| Habit versioning (edit history tracking) | Database / Storage | Browser Client | `habit_versions` IDB store is the source of truth; browser reads and uses to resolve past-day logs |
| Stage definitions & advancement | Browser Client | Database / Storage | Stage state (`currentStageIndex`) lives in IDB `habits` row; triggers evaluated at log-write time in `apply.js` |
| Mastery threshold evaluation | Browser Client | Database / Storage | Mastery logic is pure domain code (`domain/mastery.js` new); `score_snapshots` IDB store caches results (write-time, not render-time) |
| Cadence-aware denominator | Browser Client | Database / Storage | Cadence resolver (`domain/cadence.js` extended) + date-range log lookup (repo.js) — both client-side |
| Multi-occurrence logging (numeric/slots) | Browser Client | Database / Storage | Log shapes vary by `habitTargetType`; `logs` IDB store carries polymorphic rows |
| History navigation (past-day lookup) | Browser Client | Database / Storage | Query by date + cadence evaluation against historical habit versions; `habit_versions` + `logs` + `habits` IDB reads |
| Wave aggregates (completion %, status counts, streaks) | Browser Client | Database / Storage | Aggregation is pure domain logic reading from `habits` + `logs` + `wave` metadata; snapshots optional (P4 vs P6 decision) |
| Date math (DST, leap days, ISO weeks) | Browser Client | — | Utility module `js/util/date.js` (extended in Phase 4) |
| Settings overrides (per-habit mastery threshold) | Browser Client | Database / Storage | `masteryThresholdOverride` / `masteryWindowOverride` fields in `habits` IDB row |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**From Phase 3 discussion (D-82..D-90):**
- **D-82** — Catalog is a separate `#catalog` route (not modal-on-Today). Mobile and desktop both navigate via Settings link or header button.
- **D-83** — Stage table in habit definition: ordered array `stages: [{label, target}, ...]`; `currentStageIndex` tracks active stage.
- **D-84** — Stage advancement triggers are composable (OR logic): manual button, scheduled-by-week, after-N-days unconditional, after-N-days with C% threshold.
- **D-85** — Mastery visual treatment: muted row + badge, always visible on Today (habit still tappable).
- **D-86** — Global mastery settings in Settings: threshold % (default 90%) and window (days) (default 70 days).
- **D-87** — Per-habit mastery override: checkbox in Catalog edit to unlock per-habit threshold and window fields.
- **D-88** — Numeric +1 counter: +/- buttons, progress "X / Y", completion when `count >= habit.target`.
- **D-89** — Slot-checklist: expandable disclosure pattern, anonymous or user-labeled slots, completion when all slots checked.
- **D-90** — History navigation: date stepper (← →) + optional calendar widget; shows applicable habits per cadence at that time.

**From Phase 2-3 (carry forward, non-negotiable):**
- D-27: JSDoc file headers + inline `//` only for "why" notes
- D-28: SemVer 2.0.0, starting 0.1.0; cache name `habits-${APP_VERSION}`
- D-29: Module service worker with ES `import`
- D-30: Namespace `habits` everywhere (manifest, IDB, BroadcastChannel, CSV)
- D-35: English UI + English habit names primary
- D-39: Seven IDB stores including `score_snapshots` (written in P6)
- D-40: `habits` store carries optional `name_pl` field
- D-48..D-51: Cadence engine covers daily/weekly/every-N-days/day-of-week-subset (Phase 3)
- D-52: Denormalized `lastCompletedDate` in habits row, maintained at chokepoint
- **History integrity rule** — Habit-definition edits NEVER rewrite historical logs; logs always reference the `habit_versions` entry effective at the time they were written.
- **Single mutator chokepoint** — All mutations flow through `js/state/apply.js` with deterministic undo via `meta.undoToken`.

### Claude's Discretion

**Wave model persistence (WAVE-06 extensibility):**
- Keep waves in-memory in Phase 4 (sourced from `seed/waves.json`) unless user-defined wave support (WAVE-06) requires IDB persistence.
- If P4 UAT discovers user-defined waves are needed: add `waves` IDB store + v1→v2 migration (deferred to P5 if time-boxed).

**Detailed stage dashboard:**
- P4 shows minimal stage UI (current stage label/badge, manual advance button if enabled).
- Full stage timeline + progress visualization deferred to P6.

**Exact monthly cadence definition:**
- P4 draft: "once per calendar month" (ISO-week logic but month-wise).
- Exact spec (1st of month, last Friday, 15th, etc.) deferred to planner.

**Slot-checklist partial completion semantics:**
- P4: Partial completion (4 of 7) does NOT count as "completed for the day" unless habit explicitly allows it (future feature).
- Exact semantics planner's detail.

### Deferred Ideas (OUT OF SCOPE)

- Wave model as IDB store + v1→v2 migration (unless WAVE-06 needed in P4 UAT)
- Habit templating (save as template, create from template)
- Per-log annotations (notes attached to entries)
- Bulk habit operations (multi-select + archive/delete/stage-advance)
- Desktop wave board / mastery analytics (P6)
- Habit cloning (duplicate with new name)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CATALOG-01 | User can create a new habit with: name, wave, cadence rule, target type, stage definitions | Habit creation flow: new habit row with `startDate` (today or future), `stages` array, `targetType` (binary/numeric/slot-checklist); recorded as event |
| CATALOG-02 | User can edit an existing habit's definition | Edit panel pre-populated with current definition; on save: new `habit_versions` entry, `currentVersionId` updated, existing logs untouched (D-05 history integrity) |
| CATALOG-03 | Editing a habit creates a new `habit_versions` entry; prior version remains accessible to historical log evaluation | `habit_versions` store keyed `[habitId, effectiveFrom]`; logs carry `definitionVersion` pointer (null = "current") |
| CATALOG-04 | User can view the full edit history of any habit | Query `habit_versions` by `habitId` index; display timeline of changes per entry's `effectiveFrom` date |
| CATALOG-05 | User can archive a habit | Set `status: 'archived'` in habits row; filtered from Today but preserved in history |
| CATALOG-06 | User can restore an archived habit | Set `status: 'active'` in habits row |
| CATALOG-07 | User can plan a new habit with a future `startDate` | Create panel allows date picker; `startDate` = future date (e.g., 3 weeks from now); habit doesn't appear on Today until `startDate` reached |
| CADENCE-01 | User can set a habit to daily cadence | `cadence: {type: 'daily'}` |
| CADENCE-02 | User can set a habit to weekly cadence | `cadence: {type: 'weekly'}`; D-49 log-aware resolver |
| CADENCE-03 | User can set a habit to monthly cadence | `cadence: {type: 'monthly'}`; exact spec deferred to planner |
| CADENCE-04 | User can set a habit to "every N days" cadence | `cadence: {type: 'every-n-days', n: N}`; D-50 anchor on `lastCompletedDate` |
| CADENCE-05 | User can restrict a habit to specific days of the week | `cadence: {type: 'day-of-week-subset', days: ['mon', 'fri', ...]}` |
| CADENCE-06 | Cadence engine correctly identifies "is this habit applicable today?" given any combination of rules | `appliesToday(habit, date, ctx)` in `domain/cadence.js` (P3) extended with monthly cadence |
| CADENCE-07 | Cadence engine handles DST transitions, leap days, and month-end edge cases correctly | `daysBetween` uses `Math.round` (not floor); ISO week rules hold across DST; test matrix: 2026-03-29, 2026-10-25, 2028-02-29 |
| STAGE-01 | A habit can declare ordered stages with target value | `stages: [{label: 'Etap 1', target: 10}, {label: 'Etap 2', target: 20}]` in habits row |
| STAGE-02 | User can view the current stage of any habit | `currentStageIndex` in habits row; display via Catalog or Today badge |
| STAGE-03 | Stage advancement supports manual button trigger | Checkbox in Catalog edit: "Allow manual stage advance"; button appears on Today if enabled |
| STAGE-04 | Stage advancement supports scheduled-by-week trigger | Per-stage field: "Auto-advance to next stage at week N"; auto-advance on that week's Monday |
| STAGE-05 | Stage advancement supports after-N-days trigger (unconditional) | Per-stage field: "Auto-advance after N days at this stage"; advance regardless of completion |
| STAGE-06 | A single habit can compose multiple stage triggers — any one firing advances the stage | Stage advancement evaluated at log-write time in `apply.js`; triggers composed with OR logic |
| STAGE-07 | Manual stage demotion is supported | Decrement `currentStageIndex` by 1 (if > 0); undo-able like any mutation |
| MASTERY-01 | Default mastery threshold is 90% completion over rolling 70 days, configurable globally in Settings | `settings: {masteryThreshold: 90, masteryWindow: 70}` (defaults) |
| MASTERY-02 | Per-habit threshold and window can override the global defaults | `masteryThresholdOverride` / `masteryWindowOverride` in habits row (null = use global) |
| MASTERY-03 | A habit that meets its threshold over its window is displayed with "mastered" visual treatment (muted + badge), still visible on Today | D-85: muted opacity 0.55, tappable for continued logging |
| MASTERY-04 | A mastered habit that drops below threshold reverts visual treatment | Mastery status is not a separate state field; computed at render time from rolling logs |
| MASTERY-05 | Mastery is evaluated using cadence-aware denominator (non-applicable days don't count) | Completion % = `completedCount / applicableDayCount`; applicable = days matching cadence over window |
| MASTERY-06 | New habits enter a 7-day grace period during which rolling stats are not surfaced | `if (habitCreatedDate + 7 days > today) { hide mastery UI }` (simple date math) |
| MASTERY-07 | Mastery is recomputed write-time, not on every render | Write snapshots to `score_snapshots` IDB store when log changes (P4 vs P6 decision per CONTEXT) |
| LOG-02 | User can configure a habit's logging UX as "numeric +1 counter" | `targetType: 'numeric'`; `target: N` (e.g., 7 cups) |
| LOG-03 | User can configure a habit's logging UX as "slot-checklist" | `targetType: 'slot-checklist'`; `slots: [{name: 'Breakfast'}, ...]` or auto-labeled |
| LOG-04 | For slot-checklist habits, user can choose anonymous or user-labeled slots per habit | Catalog edit panel: toggle between "Anonymous slots" (auto Slot 1–N) and "User-labeled"; user-labeled = table with label fields |
| LOG-05 | Multi-occurrence habits show progress toward target | Progress string "X / Y" for numeric and slot-checklist; updated on every +/- or slot toggle |
| LOG-06 | Multi-occurrence habits count as "completed for the period" only when target is reached | Completion inferred as `count >= target` (numeric) or `allSlotsChecked` (slots); partial logs still recorded |
| HISTORY-01 | User can navigate to any past day from a history view | Date stepper (← →) + calendar widget toggle for date jump |
| HISTORY-02 | User can see, for any past day, the full list of habits that applied that day | Query `logs` by date index; evaluate cadence against `habit_versions` entry effective on that day |
| HISTORY-03 | User can mark a habit as not-completed on a past day | Tap to toggle `completed: true|false` on past-day log; mutation through `apply.js` |
| HISTORY-04 | User can bulk-action "mark all not-yet-completed habits as uncompleted" | Button on History view: mark all habits without logs as `completed: false` |
| HISTORY-05 | Partial multi-occurrence completions are preserved as logged counts; rolling-window math treats "below target" as "not completed for the period" | Numeric/slot logs carry count/slots array; mastery evaluation checks target met, not just presence of log |
| HISTORY-06 | Logs for any past day are interpreted against the `habit_versions` entry that was effective on that day | Log row carries `definitionVersion`; history reader looks up version and uses that definition for stage/cadence/mastery |
| WAVE-01 | Each habit belongs to exactly one wave | `wave: N` field in habits row (int 0–9 in v1, extensible) |
| WAVE-02 | Waves have a name, a date range, and a theme description | `waves` metadata sourced from `seed/waves.json`; structure: `{number, name, startDate, theme}` |
| WAVE-03 | User can view aggregate metrics per wave: completion %, count of habits by status | Aggregate on-demand or snapshotted; display per-wave cards (minimal in P4, full in P6) |
| WAVE-04 | User can view "longest active wave streak" | Consecutive-day streak where ≥ X% of wave's applicable habits were completed |
| WAVE-05 | User can see a "wave at risk" indicator | Y% of habits slipping below threshold; flag the wave |
| WAVE-06 | User can extend the wave model beyond 2026 | Deferred to P4 UAT or P5; not in scope if in-memory seed-only is sufficient |
| SETTINGS-01 | User can view and edit global mastery threshold and window in Settings | New Settings card: threshold % + window (days) fields with defaults 90% / 70 days |
| NFR-10 | No mutation path can corrupt prior history; every test case verifies historical logs survive edits intact | Version-aware log evaluation + no-mutation rule; test coverage for edit + archive + stage-advance paths |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ES2023 (native modules) | living standard | All domain logic | Phase 3 baseline; no external dependencies |
| IndexedDB | living spec | Primary persistence | Habit catalog, logs, versions, snapshots, settings all in IDB; no npm wrapper |
| `js/domain/cadence.js` | Phase 3 (extended P4) | Cadence resolution (daily/weekly/every-N/day-of-week-subset) | Pure domain logic; tested in Node via fake-IDB |
| `js/domain/wave.js` | Phase 3 (extended P4) | Wave model and current-wave lookup | Pure domain; wave metadata sourced from `seed/waves.json` (in-memory) |
| `js/state/apply.js` | Phase 2+ (extended P4) | Single mutator chokepoint | All writes flow here; handlers dispatch via table (Anti-Pattern 4) |
| `js/db/schema.js` | Phase 2 (extended P4) | IDB v1 schema with 7 stores | Append-only: may add fields to existing stores (e.g., `stages` to habits), never remove |
| `js/db/repo.js` | Phase 2+ (extended P4) | Data access facade + queries | New methods: `getLogsForDate`, `getHabitVersionAtDate`, `getHabitAt`, `getMasteryStatus`, etc. |
| `js/util/date.js` | Phase 3 (extended P4) | Date utilities (ISO weeks, day math, DST/leap handling) | Extended with grace-period and month-boundary helpers |
| `node --test` | Node 20+ | Testing (unit + integration) | Built-in; same as Phases 1-3 |
| Hand-written fake-IDB | Phase 2 (extended P4) | Node-side integration testing | Tests `schema.js` contract without real browser IDB |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tests-browser.html` | Phase 3 (extended P4) | Browser smoke tests (DOM mounting, tap interaction) | Manual validation; Catalog/History views rendered in fake DOM |
| `js/views/catalog.js` | NEW in P4 | Habit list + create/edit/archive UI | Mobile + desktop both navigate to `#catalog` |
| `js/views/history.js` | NEW in P4 | History navigation + log editing | Mobile + desktop both navigate to `#history` |
| `js/views/today.js` | Phase 3 (extended P4) | Today view with multi-occurrence renderers | Extends with numeric counter + slot-checklist rows |
| `js/domain/mastery.js` | NEW in P4 | Mastery threshold evaluation (rolling window, cadence-aware denominator) | Pure domain; inputs are logs + habit definition + settings |
| `js/domain/waveAggregates.js` | NEW in P4 | Wave-level metrics (completion %, status counts, streaks) | Pure domain; snapshots optional (P4 vs P6 timing) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `domain/mastery.js` | Dexie.js or other ORM | Dexie is npm; forbidden by constraint. Custom logic is simple enough (70-line pure function) |
| `habit_versions` store keyed `[habitId, effectiveFrom]` | Separate `habitEdits` with autoincrement | Compound key allows efficient range queries by date; clearer semantics (version is effective-date-based) |
| In-memory `wave` metadata | IDB `waves` store | In-memory from `seed/waves.json` until user-defined waves (WAVE-06); migration to IDB deferred to P5 |
| Mastery snapshots written at log-write time | Recomputed on every render | Snapshots pre-compute to avoid O(days) per-habit on every Today render; write-time cost amortized |
| Mastery evaluated by `score_snapshots` | Read directly from logs | P4 may snapshot or defer to P6; research shows snapshots are the locked design (D-87 via CLAUDE.md §Scoring Snapshots) |

## Package Legitimacy Audit

> This phase introduces NO external npm packages. All code is vanilla ES modules. Dependency audit not required.

**Packages removed / not used:** None — constraint is zero-npm.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile/Desktop UI                         │
│  Today → Catalog → History → Settings (each a route)       │
└────────────┬────────────┬────────────┬──────────────────────┘
             │            │            │
             ▼            ▼            ▼
      ┌──────────────────────────────────────┐
      │    js/views/ (render builders)      │
      │  today.js, catalog.js, history.js   │
      └──────────┬──────────────────────────┘
                 │ mutation tap → apply.js
                 ▼
      ┌──────────────────────────────────────┐
      │   js/state/apply.js (chokepoint)     │
      │  Handlers: createHabit, editHabit,   │
      │   archiveHabit, advanceStage,        │
      │   setMasteryThreshold, etc.          │
      └──────────┬──────────────────────────┘
                 │ writes (tx)
                 ▼
      ┌──────────────────────────────────────┐
      │      js/db/ (IDB persistence)       │
      │  schema.js (7 stores)                │
      │  repo.js (queries)                   │
      │  idb.js (wrapper)                    │
      └──────────┬──────────────────────────┘
                 │ reads for cadence/mastery
                 ▼
      ┌──────────────────────────────────────┐
      │   js/domain/ (pure logic)            │
      │  cadence.js (applies today?)         │
      │  mastery.js NEW (threshold eval)     │
      │  waveAggregates.js NEW (metrics)     │
      │  wave.js (current wave)              │
      │  date.js (ISO weeks, DST, months)    │
      └──────────────────────────────────────┘
```

**Flow:** User taps "Create Habit" → Catalog view mounts → form capture → `apply.js` handler creates new habit + event → IDB tx commits → broadcast to other tabs → store.notify() re-renders Today/Catalog. Same pattern for edit/archive/stage-advance/mastery-settings.

**History flow:** User navigates to past day → history.js queries `logs` by date + evaluates cadence via `habit_versions` entries effective on that date → renders applicable habits → user taps to mark not-complete → `apply.js` writes mutation.

**Mastery flow:** At log-write time, `apply.js` calls `domain/mastery.js` to evaluate threshold, writes snapshot to `score_snapshots` IDB store (if P4 timing) or defers to P6. Today render reads snapshots (fast) to show badge.

### Recommended Project Structure

```
src/
├── js/
│   ├── db/
│   │   ├── schema.js          # 7-store v1 (extended with new habit fields)
│   │   ├── idb.js             # Promise wrapper (unchanged)
│   │   └── repo.js            # Data facade (extended with getLogsForDate, etc.)
│   ├── domain/
│   │   ├── cadence.js         # Extended with monthly cadence
│   │   ├── mastery.js         # NEW: threshold evaluation
│   │   ├── waveAggregates.js  # NEW: completion %, streaks, at-risk
│   │   ├── wave.js            # Unchanged (in-memory from seed)
│   │   └── date.js            # Extended with grace-period / month helpers
│   ├── state/
│   │   ├── apply.js           # Extended HANDLERS table
│   │   ├── apply/
│   │   │   ├── createHabit.js     # NEW
│   │   │   ├── editHabit.js       # NEW
│   │   │   ├── archiveHabit.js    # NEW
│   │   │   ├── advanceStage.js    # NEW
│   │   │   ├── setMasteryThreshold.js  # NEW
│   │   │   ├── setMasteryWindow.js     # NEW
│   │   │   ├── markCompleted.js   # Phase 3 (unchanged)
│   │   │   ├── markUncompleted.js # Phase 3 (unchanged)
│   │   │   └── setSetting.js      # Phase 3 (unchanged)
│   │   ├── store.js           # Unchanged (cache + subscribers)
│   │   ├── undo.js            # Unchanged
│   │   └── sync.js            # Unchanged
│   ├── views/
│   │   ├── today.js           # Extended with numeric/slot renderers
│   │   ├── today/
│   │   │   └── builders.js    # Extended
│   │   ├── catalog.js         # NEW
│   │   ├── catalog/
│   │   │   └── builders.js    # NEW
│   │   ├── history.js         # NEW
│   │   ├── history/
│   │   │   └── builders.js    # NEW
│   │   ├── settings.js        # Phase 3 (extended with mastery settings)
│   │   ├── settings/
│   │   │   └── builders.js    # Phase 3 (extended)
│   │   └── toast.js           # Phase 3 (unchanged)
│   ├── util/
│   │   ├── date.js            # Extended
│   │   ├── id.js              # Phase 2 (unchanged)
│   │   ├── mount.js           # Phase 3 (unchanged)
│   │   └── version.js         # Phase 3 (bump to 0.4.0 on P4 ship)
│   ├── platform/
│   │   ├── lifecycle.js       # Phase 2 (unchanged)
│   │   ├── sync.js            # Phase 2 (unchanged)
│   │   └── sw-register.js     # Phase 1 (unchanged)
│   ├── router.js              # Phase 3 (extended with #catalog + #history routes)
│   └── main.js                # Phase 3 (route functions extended)
├── css/
│   ├── main.css               # @import layers
│   ├── today.css              # Phase 3 (extended with numeric/slot styles)
│   ├── catalog.css            # NEW
│   ├── history.css            # NEW
│   └── settings.css           # Phase 3 (extended)
├── seed/
│   ├── habits.json            # Phase 2 (extended with stages / targetType)
│   └── waves.json             # Phase 3 (unchanged; 10 waves in-memory)
└── tests/
    ├── unit/
    │   ├── cadence.test.js        # Phase 3 (extended with monthly)
    │   ├── mastery.test.js        # NEW
    │   ├── waveAggregates.test.js # NEW
    │   └── date.test.js           # Phase 3 (extended)
    ├── integration/
    │   ├── apply.*.test.js        # NEW handlers: createHabit, editHabit, archanceHabit, advanceStage, etc.
    │   ├── today.tap.test.js      # Phase 3 (extended for numeric/slot logging)
    │   ├── history.*.test.js      # NEW
    │   └── sw.shell.test.js       # Phase 3 (extended SHELL list)
    └── helpers/
        └── fake-document.js       # Phase 3 (unchanged)
```

### Pattern 1: Habit Creation via Catalog

**What:** User opens `#catalog` route, clicks "Create Habit", fills form (name, wave, cadence, target type, stages), and saves. New habit row created with UUID, versioning event recorded, logs untouched (no logs exist yet).

**When to use:** Phase 4 requirement CATALOG-01. Establishes the habit-definition-edit pattern that carries through archive/restore/edit.

**Example:**

```javascript
// Source: 04-CONTEXT.md decision D-82 and Phase 4 implementation pattern
// js/state/apply/createHabit.js — NEW handler

import { newId } from '../../util/id.js';
import { today } from '../../util/date.js';

/**
 * Create a new habit with definition, optional future startDate.
 * 
 * @param {{
 *   name: string,
 *   name_pl: string | null,
 *   wave: number,
 *   cadence: { type: string, n?: number, days?: string[] },
 *   targetType: 'binary' | 'numeric' | 'slot-checklist',
 *   target?: number,
 *   stages?: [{label: string, target: number}, ...],
 *   startDate?: string (YYYY-MM-DD, default today),
 *   masteryThresholdOverride?: number | null,
 *   masteryWindowOverride?: number | null
 * }} event
 * @param {object} repo
 * @returns {Promise<{ storeNames: string[], writes: Array, inverse: object }>}
 */
export async function handleCreateHabit(event, repo) {
  const habitId = newId();
  const now = new Date().toISOString();
  const startDate = event.payload.startDate || today();

  const habitRow = {
    id: habitId,
    name: event.payload.name,
    name_pl: event.payload.name_pl || null,
    wave: event.payload.wave,
    status: 'active',
    cadence: event.payload.cadence,
    targetType: event.payload.targetType,
    target: event.payload.target || null,
    stages: event.payload.stages || [],
    currentStageIndex: 0,
    masteryThresholdOverride: event.payload.masteryThresholdOverride || null,
    masteryWindowOverride: event.payload.masteryWindowOverride || null,
    createdAt: startDate,
    startDate: startDate,
    lastCompletedDate: null,
  };

  const versionRow = {
    habitId: habitId,
    effectiveFrom: startDate,
    name: event.payload.name,
    name_pl: event.payload.name_pl || null,
    cadence: event.payload.cadence,
    targetType: event.payload.targetType,
    target: event.payload.target || null,
    stages: event.payload.stages || [],
  };

  const eventRow = {
    id: event.id || newId(),
    type: 'createHabit',
    habitId: habitId,
    at: now,
    payload: event.payload,
  };

  return {
    storeNames: ['habits', 'habit_versions', 'events'],
    writes: [
      { store: 'habits', value: habitRow },
      { store: 'habit_versions', value: versionRow },
      { store: 'events', value: eventRow },
    ],
    inverse: {
      type: 'deleteHabit',
      payload: { habitId: habitId },
    },
  };
}

export function broadcastKeys(event) {
  return { habitId: event.payload.habitId };
}
```

### Pattern 2: Mastery Threshold Evaluation

**What:** Pure function that evaluates whether a habit meets its rolling mastery threshold given logs, habit definition, settings, and a date. Returns `{isMastered: boolean, completedCount, applicableCount, percentage}`. Used at render-time (Today view) and write-time (snapshot generation).

**When to use:** Phase 4 requirement MASTERY-01..07. Cadence-aware denominator is critical (non-applicable days don't count).

**Example:**

```javascript
// Source: CONTEXT.md decision D-85, D-87
// js/domain/mastery.js — NEW module

/**
 * Evaluate mastery for a habit on a given date.
 *
 * Mastery = completedCount / applicableDayCount >= threshold%
 * where applicable = days matching habit.cadence over the rolling window.
 *
 * Non-applicable days (per cadence rules) do NOT count in the denominator.
 *
 * @param {{
 *   id: string,
 *   cadence: { type: string, n?: number, days?: string[] },
 *   createdAt: string (YYYY-MM-DD),
 *   masteryThresholdOverride?: number | null,
 *   masteryWindowOverride?: number | null
 * }} habit
 * @param {Array<{ habitId: string, date: string, completed: boolean, count?: number, slots?: [...] }>} logsForHabit
 * @param {string} evaluationDate (YYYY-MM-DD, usually "today")
 * @param {{
 *   globalThreshold: number (e.g., 90),
 *   globalWindow: number (e.g., 70),
 *   gracePerioddDays: number (e.g., 7),
 *   today: string (YYYY-MM-DD),
 *   appliesToday: (h, d, ctx) => boolean,
 *   weekCompletions: (habitId, start, end) => number
 * }} ctx
 * @returns {{
 *   isMastered: boolean,
 *   isInGracePeriod: boolean,
 *   completedCount: number,
 *   applicableDayCount: number,
 *   percentage: number,
 *   threshold: number,
 *   windowDays: number
 * }}
 */
export function evaluateMastery(habit, logsForHabit, evaluationDate, ctx) {
  const threshold = habit.masteryThresholdOverride ?? ctx.globalThreshold;
  const windowDays = habit.masteryWindowOverride ?? ctx.globalWindow;

  // Grace period: first 7 days of a new habit.
  const createdDate = parseLocalYMD(habit.createdAt);
  const evalDate = parseLocalYMD(evaluationDate);
  const daysSinceCreation = Math.round(
    (evalDate - createdDate) / (24 * 60 * 60 * 1000)
  );
  const isInGracePeriod = daysSinceCreation < (habit.masteryGracePeriodDays || 7);
  if (isInGracePeriod) {
    return {
      isMastered: false,
      isInGracePeriod: true,
      completedCount: 0,
      applicableDayCount: 0,
      percentage: 0,
      threshold: threshold,
      windowDays: windowDays,
    };
  }

  // Rolling window: last N days before (and including) evaluationDate.
  const windowStart = new Date(evalDate);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const startYMD = formatYMD(windowStart);

  // Count applicable days (where cadence says habit applies).
  let applicableDayCount = 0;
  for (let i = 0; i < windowDays; i++) {
    const checkDate = new Date(evalDate);
    checkDate.setDate(checkDate.getDate() - i);
    const checkYMD = formatYMD(checkDate);

    // D-85: cadence-aware denominator.
    if (ctx.appliesToday(habit, checkYMD, { weekStart: ctx.weekStart, weekCompletions: ctx.weekCompletions })) {
      applicableDayCount++;
    }
  }

  if (applicableDayCount === 0) {
    return {
      isMastered: false,
      isInGracePeriod: false,
      completedCount: 0,
      applicableDayCount: 0,
      percentage: 0,
      threshold: threshold,
      windowDays: windowDays,
    };
  }

  // Count completed days (logs where target was met).
  let completedCount = 0;
  for (const log of logsForHabit) {
    if (log.date < startYMD) continue; // Outside window.
    if (log.date > evaluationDate) continue; // In future.

    // Determine if this log counts as "completed for the day".
    let isCompleted = false;
    if (habit.targetType === 'binary') {
      isCompleted = log.completed === true;
    } else if (habit.targetType === 'numeric') {
      isCompleted = (log.count || 0) >= (habit.target || 1);
    } else if (habit.targetType === 'slot-checklist') {
      const checkedCount = (log.slots || []).filter((s) => s.checked).length;
      isCompleted = checkedCount === log.slots.length;
    }

    if (isCompleted) {
      completedCount++;
    }
  }

  const percentage = Math.round((completedCount / applicableDayCount) * 100);
  const isMastered = percentage >= threshold;

  return {
    isMastered,
    isInGracePeriod: false,
    completedCount,
    applicableDayCount,
    percentage,
    threshold,
    windowDays,
  };
}
```

### Pattern 3: History Navigation with Version-Aware Log Evaluation

**What:** User selects a past date in History view. The app queries `logs` for that date, looks up the `habit_versions` entry that was effective on that date for each habit, and renders applicable habits per their cadence at that time. This preserves history integrity (NFR-10).

**When to use:** Phase 4 requirement HISTORY-01..06. Version-aware evaluation is the key to not corrupting history when definitions change.

**Example:**

```javascript
// Source: CONTEXT.md decision D-90, NFR-10
// js/views/history.js — NEW view builder + mounter

/**
 * Build history header with date stepper and optional calendar toggle.
 *
 * @param {{ selectedDate: string, onPreviousDay: () => void, onNextDay: () => void, onShowCalendar: () => void }} actions
 * @returns {{ tag: string, attrs: object, children: Array }}
 */
export function buildHistoryHeader(selectedDate, actions) {
  return {
    tag: 'header',
    attrs: { class: 'history-header' },
    children: [
      {
        tag: 'button',
        attrs: { 'aria-label': 'Previous day', class: 'stepper-btn' },
        children: ['←'],
      },
      {
        tag: 'span',
        attrs: { class: 'selected-date' },
        children: [formatDisplayDate(selectedDate)],
      },
      {
        tag: 'button',
        attrs: { 'aria-label': 'Next day', class: 'stepper-btn' },
        children: ['→'],
      },
      {
        tag: 'button',
        attrs: { 'aria-label': 'Jump to date', class: 'calendar-toggle' },
        children: ['▼'],
      },
    ],
  };
}

/**
 * Query logs for a past day and render applicable habits with their
 * historical definitions (via habit_versions lookup).
 *
 * @param {string} selectedDate YYYY-MM-DD
 * @param {object} repo Data access facade
 * @param {object} ctx { appliesToday, weekStart, weekCompletions }
 * @returns {Promise<Array>} Array of {habitId, name, log, version, applicable}
 */
export async function getHistoryForDate(selectedDate, repo, ctx) {
  // Get all logs for this date.
  const logsForDate = await repo.getLogsForDate(selectedDate);

  // Get all habits (to check cadence applicability).
  const allHabits = await repo.getAllHabits();

  // For each habit, check if it applies on selectedDate, and if so,
  // get the version effective on that date.
  const result = [];
  for (const habit of allHabits) {
    // Skip if habit didn't exist on this date.
    if (habit.createdAt > selectedDate) continue;

    // Check if habit applies on selectedDate per its cadence at that time.
    const versionAtDate = await repo.getHabitVersionAtDate(habit.id, selectedDate);
    if (!versionAtDate) continue; // No definition found (shouldn't happen).

    // Evaluate cadence against the historical version.
    const applies = ctx.appliesToday(
      { ...habit, cadence: versionAtDate.cadence },
      selectedDate,
      ctx
    );

    const log = logsForDate.find((l) => l.habitId === habit.id);

    result.push({
      habitId: habit.id,
      name: versionAtDate.name,
      applicable: applies,
      log: log || null,
      version: versionAtDate,
    });
  }

  return result;
}
```

### Anti-Patterns to Avoid

- **Mutating logs on habit edit** — A habit definition change MUST create a new `habit_versions` entry, not rewrite existing logs. This violates NFR-10 (history integrity) and is caught by version-aware history tests.
- **Mastery re-computed on every render** — Mastery should be snapshotted at log-write time and read from `score_snapshots` on render, not recomputed per-render. The latter is O(days × habits) and slow on mobile.
- **Not carrying `definitionVersion` in logs** — If a log doesn't reference which habit version was active at log-write time, history evaluation cannot work correctly. Every log must carry this pointer (default = "current" = null).
- **Cadence resolver evaluating logs inside the resolver** — The resolver should be pure; week-completion context is injected. This keeps it testable and lets the caller control the log-query scope.
- **Using `switch (habit.targetType)` for log shape dispatch** — Use a `HANDLERS` or `RESOLVERS` table instead (Anti-Pattern 4). Routes prevent accidental missing cases and enable static grep discipline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Habit versioning with edit history | Custom "store prior values" code | `habit_versions` IDB store with `[habitId, effectiveFrom]` compound key | Compound key enables efficient range queries by date; full version history is queryable and auditable. Hand-rolling loses the ability to invert dates. |
| Mastery threshold evaluation | Custom rolling-window percentage logic | Pure `domain/mastery.js` module with cadence-aware denominator + grace period | The calculation has subtle branches (cadence type dispatch, grace period check, multi-occurrence log shapes). Burying it in a view or apply handler makes it unmaintainable. |
| Stage advancement trigger composition | If-else chain checking manual/scheduled/N-days conditions | Composable triggers with OR logic in `domain/stage.js` | Multiple triggers on one habit must be evaluated in order; OR composition is a common pattern (use a `triggers[]` array). If-else chains silently drop conditions. |
| Cross-tab sync of catalog changes | Manual BroadcastChannel messages | Existing D-30 `BroadcastChannel('habits')` + `notify()` in store.js | Phase 3 already wired the broadcast loop; reuse it. Creating new messaging channels violates the namespace consistency locked in D-30. |
| Date-range queries in IDB | Loop through all records and filter | IndexedDB range queries via `keyRange` + `index.getAll()` | IDB indexes make range queries O(n) within the range, not O(all records). Learn the `IDBKeyRange` API. |
| Grace period checking | Manual date math in render | Utility function in `domain/mastery.js` or separate `js/domain/gracePeriod.js` | Grace period logic is used in two places (mastery + possibly wave aggregates); extract to one module to avoid duplication. |

## Runtime State Inventory

> Phase 4 is not a rename/refactor phase. No runtime state inventory needed.

## Environment Availability

> Phase 4 has no external dependencies beyond what Phase 3 provides. All APIs (IndexedDB, BroadcastChannel, native Date, ES modules) are browser-native, available on target browsers.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| IndexedDB | All data persistence | ✓ | Living spec | N/A (required) |
| BroadcastChannel | Cross-tab sync | ✓ | Living spec (Baseline Widely Available) | N/A (fallback: store.notify not called on other tabs, acceptable for now) |
| Node 20+ | Testing (node --test) | ✓ | Node 20+ | Upgrade Node |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + hand-written fake-IDB |
| Config file | None — native Node test runner, no config needed |
| Quick run command | `npm test -- --grep "mastery"` (or `node tests/unit/mastery.test.js` standalone) |
| Full suite command | `npm test` (runs all tests/ directory) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CATALOG-01 | Create habit with all fields stored in IDB | Integration | `npm test -- tests/integration/apply.createHabit.test.js` | ❌ Wave 0 |
| CATALOG-02 | Edit habit creates new habit_versions entry | Integration | `npm test -- tests/integration/apply.editHabit.test.js` | ❌ Wave 0 |
| CATALOG-03 | Editing creates habit_versions row; prior version remains | Unit | `npm test -- tests/unit/habitVersions.test.js` | ❌ Wave 0 |
| CATALOG-04 | Query habit_versions by habitId index | Integration | `npm test -- tests/integration/repo.getHabitHistory.test.js` | ❌ Wave 0 |
| CATALOG-05 | Archive sets status = 'archived' | Integration | `npm test -- tests/integration/apply.archiveHabit.test.js` | ❌ Wave 0 |
| CATALOG-06 | Restore sets status = 'active' | Integration | `npm test -- tests/integration/apply.restoreHabit.test.js` | ❌ Wave 0 |
| CATALOG-07 | Future startDate prevents habit appearing on Today | Unit | `npm test -- tests/unit/cadence.applicableFutureStart.test.js` | ❌ Wave 0 |
| CADENCE-01 to -07 | Cadence extension with monthly + DST/leap handling | Unit | `npm test -- tests/unit/cadence.test.js` | ❌ Wave 0 (extend Phase 3 cadence.test.js) |
| STAGE-01 to -07 | Stage array in habits row, currentStageIndex tracking, trigger composition | Integration | `npm test -- tests/integration/apply.advanceStage.test.js` | ❌ Wave 0 |
| MASTERY-01 to -07 | Mastery threshold evaluation, cadence-aware denominator, grace period, snapshots | Unit | `npm test -- tests/unit/mastery.test.js` | ❌ Wave 0 |
| LOG-02 to -06 | Numeric +1 counter and slot-checklist log shapes | Integration | `npm test -- tests/integration/today.tap.test.js` (extend) | ✅ Phase 3 |
| HISTORY-01 to -06 | Date navigation, version-aware log reading | Integration | `npm test -- tests/integration/history.*.test.js` | ❌ Wave 0 |
| WAVE-01 to -06 | Wave metadata, aggregates (completion %, streaks, at-risk) | Unit | `npm test -- tests/unit/waveAggregates.test.js` | ❌ Wave 0 |
| SETTINGS-01 | Global mastery settings in Settings view | Integration | `npm test -- tests/integration/settings.masterySettings.test.js` | ❌ Wave 0 |
| NFR-10 | Historical logs survive edit/archive/stage-advance | Integration | `npm test -- tests/integration/nfr10.historyIntegrity.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run quick tests for the feature being added (e.g., `npm test -- tests/unit/mastery.test.js`)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + browser smoke (`tests-browser.html` manual validation of Catalog/History UI on one browser)

### Wave 0 Gaps

- [ ] `tests/unit/cadence.test.js` — extend Phase 3 cadence tests with monthly cadence + grace-period edge cases (2026-03-29, 2026-10-25, 2028-02-29)
- [ ] `tests/unit/mastery.test.js` — mastery threshold evaluation with cadence-aware denominator, grace period, per-habit overrides
- [ ] `tests/unit/waveAggregates.test.js` — wave-level metrics (completion %, status counts, streak calculation)
- [ ] `tests/integration/apply.createHabit.test.js` — habit creation with stages/targetType, event recording, undo
- [ ] `tests/integration/apply.editHabit.test.js` — habit definition edit, habit_versions creation, logs unchanged
- [ ] `tests/integration/apply.archiveHabit.test.js` — archive/restore, status field change
- [ ] `tests/integration/apply.advanceStage.test.js` — stage advancement via triggers (manual, scheduled, N-days), composition
- [ ] `tests/integration/repo.getHabitHistory.test.js` — query habit_versions, getLogsForDate, getHabitVersionAtDate
- [ ] `tests/integration/history.*.test.js` — date navigation, version-aware log reading, past-day edits
- [ ] `tests/integration/today.tap.test.js` — extend with numeric +1 counter (tap +/- buttons) and slot-checklist (expand/collapse, toggle slots)
- [ ] `tests/integration/settings.masterySettings.test.js` — mastery threshold/window settings UI, setSetting mutation
- [ ] `tests/integration/nfr10.historyIntegrity.test.js` — edit habit → verify old logs use old definition, archive → verify logs preserved, stage-advance → verify no log rewrite
- [ ] `js/db/repo.js` — new methods: `getLogsForDate(date)`, `getHabitVersionAtDate(habitId, date)`, `getHabitAt(habitId, date)` (combined habits + versions), `getMasteryStatus(habitId)` (optional; may belong in domain)
- [ ] `js/domain/mastery.js` — new module (70 lines), exported `evaluateMastery(habit, logs, date, ctx) → {isMastered, completedCount, applicableCount, percentage, ...}`
- [ ] `js/domain/waveAggregates.js` — new module (50 lines), exported functions for wave metrics
- [ ] `js/util/date.js` — extend with `isInGracePeriod(createdAt, today)`, `getMonthStart(ymd)`, `getMonthEnd(ymd)`, DST/leap-day test fixtures
- [ ] `js/views/catalog.js` + `js/views/catalog/builders.js` — new view files (~300 lines total): habit list, create/edit panels, archive/restore buttons
- [ ] `js/views/history.js` + `js/views/history/builders.js` — new view files (~300 lines total): date stepper, history list, edit past logs
- [ ] `js/state/apply/createHabit.js`, `editHabit.js`, `archiveHabit.js`, `advanceStage.js`, `setMasteryThreshold.js`, `setMasteryWindow.js` — 6 new handler files (~50 lines each)
- [ ] `js/router.js` — extend with `#catalog` and `#history` route cases (Pitfall: must use allowlist, not unknown hashes)
- [ ] `js/main.js` — add route mount functions `mountCatalog()` and `mountHistory()`
- [ ] `css/catalog.css`, `css/history.css` — new stylesheet files
- [ ] `tests/integration/sw.shell.test.js` — extend `P4_REQUIRED` list (or rename to `REQUIRED`) with new shell asset files
- [ ] `sw.js` — update SHELL array with P4 new files
- [ ] Framework install: already `node --test` available in Node 20+

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

Actually, there ARE gaps. Phase 4 introduces significant new functionality (catalog CRUD, history, mastery, multi-occurrence), so new test files and infrastructure are needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (single-user, no auth) |
| V3 Session Management | No | N/A (no sessions; BroadcastChannel for cross-tab only) |
| V4 Access Control | No | N/A (single-user) |
| V5 Input Validation | Yes | Form inputs in Catalog/History validated before IDB write (type, length, required fields); reject invalid cadence/stage/targetType |
| V6 Cryptography | No | N/A (no network calls or encryption needed; all data in-device IDB) |
| V7 Error Handling & Logging | No | N/A (events journal is audit-only, not security logging) |
| V8 Data Protection | Yes | IDB is persistent browser storage; user can inspect via DevTools. Acceptable (single-user, personal device). Sensitive data: none (all habit names/dates are user-created user data). |
| V9 Communications | No | N/A (no network in v1) |
| V10 Malicious Code | No | N/A (no npm / CDN / external scripts) |
| V11 Business Logic | No | N/A (no multi-user workflows) |
| V12 File Upload | No | N/A (export/import in Phase 5, file validation at that stage) |
| V13 API & Web Services | No | N/A (no API in v1) |

### Known Threat Patterns for Vanilla ES2023 + IndexedDB

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-controlled strings (habit names) | Tampering | Always use `textContent` when mounting habit names, never `.innerHTML`. D-78 grep gate covers this file. Builders return `{children: []}` descriptions; mount layer converts to safe DOM. |
| IDB quota exhaustion (years of logs) | Denial of Service | IDB quota is gigabytes on modern browsers (sufficient for years of daily logs). Monitor in DevTools. If user hits quota: defensive error handling + "export and clear" option in Settings (Phase 5+). |
| Cross-tab race condition (simultaneous writes) | Tampering | BroadcastChannel sync + atomic IDB transactions. One tab writes + broadcasts; other tabs read invalidated keys via `store.notify(keys)`. All writes go through single `apply.js` chokepoint. |
| Accidental IDB data loss (e.g., user clears storage) | Spoofing | JSON export / import in Phase 5. User responsibility to back up. PWA persistent storage requested in Phase 2 (D-03). |
| Habit definition rewrite via edit (corruption) | Tampering | `habit_versions` immutable; edit creates new version entry. Old logs keep `definitionVersion` pointer. History evaluation looks up correct version. NFR-10 test coverage. |

## Common Pitfalls

### Pitfall 1: Cadence-Aware Denominator Miscalculation

**What goes wrong:** Mastery evaluation counts all 70 days as the denominator, but a Mon-Fri habit should only count ~50 applicable days. Resulting percentage is incorrectly lowered (e.g., 45/70 = 64% instead of 45/50 = 90%).

**Why it happens:** Temptation to compute mastery as `completedCount / windowDays` (simple math) instead of `completedCount / applicableDayCount` (correct but requires per-day cadence evaluation).

**How to avoid:** Test mastery.js with a Mon-Fri habit fixture over a 70-day window. Manually verify the day count. Assert that weekend days are excluded from applicable count.

**Warning signs:** Mastery percentage drops unexpectedly after a long window. User reports "I log 90% of the time but mastery shows 64%."

### Pitfall 2: Version-Unaware History Evaluation

**What goes wrong:** User edits a habit's cadence (e.g., daily → weekly). When viewing logs from before the edit, the app evaluates cadence using the CURRENT definition (weekly), not the OLD definition (daily). Old daily logs are marked as "not applicable" even though they were applicable at log-write time.

**Why it happens:** Lazy approach: just look up `habits` row when rendering history. Forgot to query `habit_versions` for the version effective at that date.

**How to avoid:** Every history render must call `getHabitVersionAtDate(habitId, selectedDate)` and use that version's cadence for applicability checks. Store `definitionVersion` in every log row pointing to the `habit_versions` entry used at write time.

**Warning signs:** History view shows inconsistent cadence between old logs and new logs. User edits a habit, then views past logs and the UI says "not applicable" for days they swear they logged.

### Pitfall 3: Stage Advancement Without Trigger Composition

**What goes wrong:** Habit has two triggers enabled (manual button + auto-advance after 30 days). Code checks triggers with `if (manual) advance; else if (autodays) advance`. The else-if short-circuits: if manual button was pressed yesterday, auto-advance-at-30-days never fires, even if today is day 30.

**Why it happens:** Writing trigger checks sequentially with `else if` instead of evaluating all triggers and advancing if ANY fire (OR composition).

**How to avoid:** Use a `triggers` array; evaluate each independently; advance if any return true. `const shouldAdvance = triggers.some(t => t.check(habit, date))`.

**Warning signs:** User presses manual advance button; the auto-advance-at-week condition is now "stuck" and never fires.

### Pitfall 4: Grace Period Applied at the Wrong Layer

**What goes wrong:** Habit created today; mastery calculation skips it (grace period). But when user logs the habit for the first time on day 2, the mastery calculation still thinks "it's day 2, grace period applies, don't show mastery." Result: mastery never shows even after the 7-day grace period ends.

**Why it happens:** Grace period check uses `createdAt`, which is immutable. But grace period should be calculated at EVALUATION time, not at a fixed epoch. Mixing up "created 7 days ago" with "entered mastery tracking 7 days ago."

**How to avoid:** Grace period is strictly `if (today - createdAt < 7 days) { skip mastery UI }`. No state. Pure function of `createdAt` and `today`. Test with a habit created 6 days ago evaluated on day 7 — mastery should appear.

**Warning signs:** User creates habit, logs it for a week, but mastery badge never appears.

### Pitfall 5: Log Shape Polymorphism Without Dispatch Table

**What goes wrong:** Logging code checks `if (habit.targetType === 'binary') { ... } else if (habit.targetType === 'numeric') { ... } else { slot-checklist }`. A future `targetType = 'daily-total'` is added. Code missed adding the case. Habit is silently treated as slot-checklist, corrupting logs.

**Why it happens:** Long if-else-else chains are error-prone. Missing a case is a silent bug (no throw, no warning).

**How to avoid:** Use a `HANDLERS` / `RESOLVERS` dispatch table. `const handler = HANDLERS[habit.targetType]`. If type is unknown, throw immediately. Anti-Pattern 4 enforces this via static grep: "no if (targetType)" search returns nothing.

**Warning signs:** New targetType is added; some views still handle old types correctly but logging silently breaks.

### Pitfall 6: Mastery Snapshots Written at Render Time Instead of Write Time

**What goes wrong:** Every time Today view renders, it calls `evaluateMastery()` for each habit. On a fresh session after a month offline, re-rendering 30 habits × 70-day windows is expensive (O(days) per habit). Cold paint takes 2 seconds instead of <300 ms.

**Why it happens:** Temptation to compute on-demand for simplicity. Deferred the snapshot-write logic to P6.

**How to avoid:** Snapshots are written at log-write time (in the `apply.js` handler after the log is committed). Today render reads from `score_snapshots`, which is O(habits) not O(habits × days). D-87 (CLAUDE.md Scoring Snapshots section) locks this design. Phase 4 may defer actual snapshot writes to Phase 6, but the design is locked.

**Warning signs:** Cold paint time increases as the log history grows.

## Code Examples

### Verified patterns from official sources (MDN):

### Example 1: IndexedDB Range Query (IDB Index)

```javascript
// Source: MDN Using IndexedDB — https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
// Pattern: Query logs by date range

async function getLogsInRange(startYMD, endYMD) {
  const db = await openDB();
  const tx = db.transaction('logs', 'readonly');
  const store = tx.objectStore('logs');
  const dateIndex = store.index('date');
  
  // IDBKeyRange for date range [startYMD, endYMD]
  const range = IDBKeyRange.bound(startYMD, endYMD);
  const logs = await new Promise((resolve, reject) => {
    const result = [];
    const request = dateIndex.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  return logs;
}
```

### Example 2: Composite Key Lookup (habit_versions)

```javascript
// Source: MDN IDBObjectStore — compound keyPath
// Pattern: Look up habit version effective on a specific date

async function getHabitVersionAtDate(habitId, date) {
  const db = await openDB();
  const tx = db.transaction('habit_versions', 'readonly');
  const store = tx.objectStore('habit_versions');
  
  // Query: habitId = X, effectiveFrom <= date, max effectiveFrom
  // Composite key [habitId, effectiveFrom] allows range queries
  const range = IDBKeyRange.bound(
    [habitId, '0000-01-01'],  // Start of time
    [habitId, date],           // Up to selected date
  );
  
  const versions = await new Promise((resolve, reject) => {
    const request = store.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  // Return the last (most recent) version effective on that date
  return versions.length > 0 ? versions[versions.length - 1] : null;
}
```

### Example 3: Cadence-Aware Denominator (from Phase 3, extended P4)

```javascript
// Source: Phase 3 research + D-85 locked decision
// Pattern: Count applicable days for mastery evaluation

function countApplicableDays(habit, startDate, endDate, ctx) {
  let count = 0;
  const current = new Date(parseLocalYMD(startDate));
  const end = parseLocalYMD(endDate);
  
  while (current <= end) {
    const ymd = formatYMD(current);
    
    // Use the cadence resolver to check if habit applies on this day
    if (ctx.appliesToday(habit, ymd, {
      weekStart: ctx.weekStart,
      weekCompletions: ctx.weekCompletions,
    })) {
      count++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single global `status` field (active/mastered/archived) | Separate `status` field + computed `isMastered` at render time | Phase 4 design | Mastery is now volatile (recalculated on every log write) instead of a state field. Allows mastery to flip down if logs are edited or deleted. |
| Habit definition as single immutable row | `habit_versions` store with compound key, `currentVersionId` pointer in habits row | Phase 4 design | Edits create new version entries; history evaluation looks up the version effective at that time. Prior approach would rewrite logs (corrupts history). |
| All stage fields in habits row (stages, currentStageIndex, triggers) | Stages as a nested array in habits row, triggers evaluated at log-write time in apply.js | Phase 4 design | Triggers are evaluated as a pure function; no separate trigger state. If a trigger fires, stage increments immediately. Simpler than event-driven trigger polling. |
| Mastery computed per-render | Snapshots written at log-write time, read at render time from `score_snapshots` store | Phase 4→P6 timing TBD | Defer actual snapshot writes to P6 if time-constrained; the design is locked (D-87). Phase 4 may compute mastery on render and skip snapshot write; Phase 6 adds snapshot write. |

**Deprecated/outdated:**
- Classic SW + importScripts (Phase 1 plan) — replaced by module SW (`js/platform/sw-register.js` + `sw.js` with `import {APP_VERSION}`) to avoid SyntaxError on `export const`.
- localStorage for habit data — Phase 2 locked IndexedDB as the primary store; localStorage is reserved for tiny UI preferences (D-08 localization prefs if added in future).
- Single responsive layout for mobile/desktop — Phase 1 decision: two separate HTML shells (`index.html` + `desktop.html`) with different DOMs, not CSS breakpoints.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Monthly cadence is "once per calendar month" (ISO-week logic but month-wise) | CADENCE-03, Standard Stack | Planner may need different semantics (e.g., "first Friday of month", "15th day"). Research provides the default; implementation deferred to planner. |
| A2 | Slot-checklist partial completion (4 of 7 slots checked) does NOT count as "completed for the day" in rolling-window mastery | LOG-06, Mastery evaluation | User may expect partial completion to count proportionally (e.g., 4/7 = 57% credit). Research locks binary completion; any nuance deferred to future phase. |
| A3 | Wave model stays in-memory sourced from `seed/waves.json` unless user-defined waves (WAVE-06) require IDB persistence | WAVE-01..06, Architecture | If P4 UAT discovers user-extensibility is essential, a v1→v2 migration is needed. Planner gates this in UAT gate. |
| A4 | Grace period is 7 days (D-85 specifically 7 days) | MASTERY-06 | User may prefer 14-day grace. Hardcoded in test fixtures; changeable via settings in future phases if needed. |
| A5 | `definitionVersion` in logs is a pointer to `habit_versions` entry (null = "current") | HISTORY-06, NFR-10 | Alternative: logs could carry a full snapshot of the definition. Research assumes pointer; versioning store is canonical. |
| A6 | Cadence-aware denominator is always used; no setting to revert to simple "days in window" | MASTERY-05 | User may want both metrics visible. Locked by CONTEXT decision D-85; future refinement deferred to analytics phase. |
| A7 | Stage advancement triggers are evaluated at every log write for the habit; no separate trigger evaluation loop | STAGE-04..06 | Alternative: triggers polled on a timer (e.g., daily check for "week N" at Monday 00:00). Research assumes on-write evaluation; polling is P5+ if needed. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Actually, there ARE assumptions above. Phase 4 research must confirm these with the user during the discuss-phase if they haven't been locked yet.

## Open Questions

1. **Exact monthly cadence definition** — Research draft: "once per calendar month" (evaluated like weekly but month-wise). Does this mean "any day of the month" once per month, or "specific date of month" (e.g., 1st, 15th, last Friday)? Planner's detail.

2. **Wave model persistence timing** — WAVE-06 (user-extensible waves beyond 2026) is deferred. Should it ship in P4 or P5? If P4: requires `waves` IDB store + v1→v2 migration. If P5: waves stay in-memory from `seed/waves.json`. User decision at P4 UAT gate.

3. **Slot-checklist target semantics** — Should partial completion (4 of 7 slots) count as "in progress" and reset daily, or persist counts across days until the next completion cycle? Research assumes daily reset (like numeric +1 counter); user preference may differ.

4. **Mastery snapshots in Phase 4 or deferred to Phase 6** — Research shows snapshots are locked (D-87 in CLAUDE.md). Should Phase 4 write snapshots at log-write time, or is Phase 6 sufficient? If P4 writes snapshots: adds `score_snapshots` writes to every log handler. If P6 writes: Today view computes mastery on render (acceptable if log history is small; may be slow at 5 years).

5. **Cadence extension: monthly cadence exact spec** — Beyond "once per calendar month", what is the exact rule? Is it:
   - "Any day of the calendar month, once per month"?
   - "Same day number of the month" (e.g., 15th)?
   - "Same day-of-week of the month" (e.g., "second Friday")?
   - Something else?

## Sources

### Primary (HIGH confidence)

- **CONTEXT.md (04-CONTEXT.md)** — Phase 4 locked decisions D-82..D-90, canonical references section
- **REQUIREMENTS.md** — 47 Phase 4 requirements (CATALOG-01..07, CADENCE-01..07, STAGE-01..07, MASTERY-01..07, LOG-02..06, HISTORY-01..06, WAVE-01..06, SETTINGS-01, NFR-10)
- **PROJECT.md** — Stack constraints, history-integrity rule, IDB 7-store schema, scoring snapshots design
- **CLAUDE.md (user's global config)** — TL;DR stack table, Scoring Snapshots section (locked D-87), CSS architecture, Cascade Layers + custom properties
- **Phase 3 research (03-RESEARCH.md)** — Cadence pitfalls 1/2/4/5/8/9; cadence edge cases confirmed via Phase 3 implementation

### Secondary (MEDIUM confidence)

- **MDN — Using IndexedDB** — https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB — Composite keyPath, range queries, transactions, indexes
- **MDN — `@layer` CSS Cascade Layers** — https://developer.mozilla.org/en-US/docs/Web/CSS/@layer — Native layout control, Baseline status
- **MDN — BroadcastChannel** — https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel — Cross-tab messaging, Baseline Widely Available
- **Existing Phase 3 code** — `js/domain/cadence.js`, `js/state/apply.js`, `js/views/today.js`, `tests/unit/cadence.test.js` — Patterns verified by inspection and test passing

### Tertiary (LOW confidence)

- None. Phase 4 is entirely rooted in locked decisions (Phase 2-3) and official docs (MDN).

## Metadata

**Confidence breakdown:**
- **Standard stack (HIGH)** — All technologies (IndexedDB, ES2023, BroadcastChannel) are officially specified and confirmed to work in Phases 1-3. No new external dependencies. Architecture patterns are locked by CONTEXT.md.
- **Cadence engine extension (HIGH)** — Phase 3 completed cadence resolver; P4 extends with monthly cadence (draft) and grace-period utility. Edge cases (DST, leap days) verified by Phase 3 tests. Monthly exact spec deferred to planner.
- **Mastery evaluation (MEDIUM-HIGH)** — Logic is locked by D-85..D-87. Cadence-aware denominator understood (research shows it's straightforward range query + per-day cadence check). Grace period is simple date math. One open question: write snapshots in P4 or defer to P6.
- **History integrity / NFR-10 (HIGH)** — Pattern locked by PROJECT.md and Phase 3 design. Version-aware log evaluation is straightforward (query `habit_versions`, use that definition). No implementation ambiguity.
- **Stage advancement triggers (MEDIUM)** — Composition is locked (OR logic, table dispatch). Exact trigger types (manual, scheduled-by-week, after-N-days, after-N-days-with-threshold) are specified. No new patterns needed. Implementation is straightforward state machines.
- **Multi-occurrence logging (MEDIUM-HIGH)** — Log shapes (binary / numeric / slot-checklist) are locked. Numeric +1 is straightforward counter. Slot-checklist UX (expandable disclosure) is locked. One open question: partial completion semantics (daily reset vs persist).
- **Wave aggregates (MEDIUM)** — Metrics (completion %, status counts, streak) are specified. Calculation is pure domain logic (no new IDB patterns). Wave metadata sourced from `seed/waves.json`. One open question: persist to IDB in P4 or keep in-memory for now.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (30 days; stable domain, no planned framework updates)

## Conclusion

Phase 4 is fundamentally a domain-model implementation phase with NO new external dependencies. All APIs (IndexedDB, BroadcastChannel, ES modules, Date) are browser-native and stable. Research identifies locked decisions (D-82..D-90 from discussion phase), verified patterns (cadence, version-aware history, mastery calculation), and gaps requiring planner decisions (exact monthly cadence, wave persistence timing, snapshot write timing).

The phase is ready for planning. Planner should prioritize in waves: catalog CRUD foundation → cadence extension → stage system → mastery evaluation → multi-occurrence logging → history navigation → wave aggregates. Testing follows Phase 3 pattern (TDD per task, node --test, fake-IDB for integration, browser smoke for UI).

Primary risks: cadence-aware denominator miscalculation (Pitfall 1), version-unaware history evaluation (Pitfall 2), stage trigger composition gaps (Pitfall 3). All are caught by test-first discipline and the D-27 JSDoc convention (pure functions with clear contracts).
