# Phase 6: Desktop Analytics & Scoring Trio - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the desktop analytics shell (`desktop.html`) with three hash-routed view panels (Analytics, Wave-board, Planning) and implement all three scoring models (S1/S2/S3) with a Settings toggle and score snapshot write/read infrastructure. The `score_snapshots` IDB store exists from Phase 2; Phase 6 fills it with computed values and builds the views that read from it.

**ROADMAP goal:** *"Deliver the desktop analytics surface with all three scoring models live and switchable"*

**Requirements in scope (from REQUIREMENTS.md):**
SCORING-01..09, DESKTOP-01..07, SETTINGS-02, SETTINGS-06, NFR-03, NFR-05, NFR-08

**Explicitly NOT in Phase 6:**
- Multi-device cloud sync — deferred post-v1
- PDF export — deferred post-v1
- Drag-and-drop habit rescheduling in Planning view — deferred
- Per-habit notes/annotations on the wave-board — deferred
- Streak counters as a primary metric — explicitly out of scope (REQUIREMENTS.md)

</domain>

<decisions>

## Carried-Forward Decisions

**From Phases 1–5 (locked, non-negotiable):**
- D-27: JSDoc file headers and exported APIs; inline `//` only for "why" notes
- D-28: APP_VERSION follows SemVer 2.0.0; cache name `habits-${APP_VERSION}`
- D-29: Module service worker with ES `import`; cache prefix `habits-`
- D-30: Namespace `habits` everywhere (manifest, IDB DB name, BroadcastChannel, file prefixes)
- D-35: English UI primary; optional Polish in `name_pl`
- D-39: `score_snapshots` is a first-class IDB store (already in schema)
- DESKTOP-02: Desktop shell shares all `js/{db,state,domain,router,io,platform,util}/` modules with mobile
- No auto-redirect by viewport — "Switch to desktop view" link in Settings only (locked)
- All scoring models: cadence-aware denominator, 7-day grace period, mastered habits = 0.3× weighting (SCORING-07, locked)
- `scoreVersion` field in `score_snapshots` rows (SCORING-09, locked)
- S1 is the default scoring model (SCORING-02, locked)

## Implementation Decisions

### Scoring Models (S1 / S2 / S3)

- **D-110 — S1 bucket thresholds (fixed absolute):**
  - **Healthy** — rolling-window completion % ≥ global mastery threshold (default 90%)
  - **Watch** — 70% ≤ completion% < threshold
  - **At-risk** — 50% ≤ completion% < 70%
  - **Failing** — completion% < 50%
  - The global threshold is the Healthy floor; if the user raises it to 95%, Watch still starts at 70%, not 0.85× 95%.

- **D-111 — S2 formula (Claude's discretion — user delegated):**
  - Exponential day-weighting with a 21-day half-life: `weight(d) = 2^(-d/21)` where `d` = days ago.
  - Each day's contribution = `weight(d) × completed(d)` / `weight(d) × applicable(d)` (cadence-aware).
  - Stage-difficulty multiplier (applied to the numerator only): etap 1 = 1.0×, etap 2 = 1.25×, etap 3 = 1.5×.
  - Per-habit S2 score = weighted sum (0..1). Wave-level S2 = average of its habits' S2 scores.
  - Grace period (7 days): new habits excluded from weighting until grace period elapses.
  - Mastered habits: weighted at 0.3× (applied to both numerator and denominator, keeping the ratio meaningful).

- **D-112 — S3 formula:**
  - `S3(habit, day) = completed(day) / applicable_today_count` where `applicable_today_count` = number of applicable habits on that day (the "load").
  - Mastered habits are counted as always-completed (contribute 0.3 to the numerator automatically) on days when they are applicable.
  - Per-habit S3 score = sum of daily S3 contributions over the rolling window, normalized to [0, 1].
  - Wave-level S3 = average of its habits' per-habit S3 scores.
  - Grace period: same 7-day exclusion as S1/S2.

- **D-113 — Score output shape: all 3 models produce both per-habit and wave-level aggregates.**
  - ~~Every `score_snapshots` row carries: `{habitId, date, model: 'S1'|'S2'|'S3', perHabitScore, s1Status, scoreVersion}` — 3 rows per (habit, date).~~
  - **SUPERSEDED BY D-124 (2026-06-29 — IDB keyPath constraint):** See D-124 for the locked row shape.
  - Wave-level aggregates are computed by reading all per-habit snapshots for habits in that wave and averaging their per-model scores inline (no separate wave-level row needed).

- **D-124 — score_snapshots single-row schema (supersedes D-113's 3-row spec):**
  - `js/db/schema.js` declares `score_snapshots` with `keyPath: ['habitId', 'date']`. This allows exactly **one row per (habitId, date)**. D-113's "3 rows per model" design would require `keyPath: ['habitId', 'date', 'model']` — a v1 schema migration that would break the locked "additive-only" schema invariant (DATA-02).
  - **Locked row shape:** `{habitId, date, s1Score, s1Status, s2Score, s3Score, scoreVersion: 1}` — all three model scores embedded in one row.
  - Views read the appropriate score column (`s1Score`/`s2Score`/`s3Score`) based on `settings.scoringModel`.
  - This is a no-migration design that fits the existing v1 IDB schema exactly.

- **D-114 — Snapshot write trigger:**
  - **Write-time:** On every log write (via `apply.js` chokepoint), recompute snapshots for the affected habit across its rolling window (all 3 models). This keeps snapshots always current.
  - **Bulk recompute:** "Recompute scores" Settings action (SETTINGS-06) re-runs all snapshots for all habits and models. Used after algorithm changes (scoreVersion bump) or Settings changes (global threshold, window).
  - Views NEVER call `scoring.js` at render time — they always read from `score_snapshots` (SCORING-08 requirement).

### Desktop Navigation Structure

- **D-115 — Sidebar + hash-routed panels:**
  - `desktop.html` uses the same `router.js` hash-routing pattern as `index.html`.
  - Three routes: `#analytics`, `#waveboard`, `#planning`. Allowlist in `router.js` extended to include these desktop routes; unknown hashes fall back to `#analytics`.
  - Each route maps to a `<section data-route="analytics|waveboard|planning">` panel in `desktop.html`, shown/hidden via the `hidden` attribute (same pattern as mobile — D-79).
  - Left sidebar with three nav links (desktop layout via CSS; sidebar is a `<nav>` with `<a href="#analytics">` etc.).
  - `desktop.js` dispatches to `mountAnalytics()`, `mountWaveboard()`, `mountPlanning()` — same pattern as `main.js` dispatching to `mountToday()`, `mountCatalog()`, `mountHistory()`, `mountSettings()`.

- **D-116 — Analytics view layout (DESKTOP-03):**
  - Flat list of **all habits grouped by wave** (not expandable wave cards). Wave name renders as a group header row (sticky or visually distinguished).
  - Per-habit row columns (left to right): habit name, current stage (e.g., "Etap 2"), rolling % + S1 status badge (color-coded Healthy/Watch/At-risk/Failing), mastery badge (if mastered), S2 or S3 numeric score (shown only when that model is active in Settings).
  - Scoring dashboard sits above the habit list: summary counts by S1 status across all active habits, active model toggle (S1 / S2 / S3), wave-level score table.

- **D-117 — Reactive model switching (SCORING-03):**
  - Model switch writes to `settings` store via `apply.js` (`setSetting({key: 'scoringModel', value: 'S1'|'S2'|'S3'})`).
  - `store.notify()` fans out to desktop view subscribers → views re-read snapshots for the new model and re-render column data.
  - No page reload. All three model's snapshots are always in IDB; switching just changes which column is displayed.

### Wave-board Visualization (DESKTOP-04)

- **D-118 — Heat-map grid structure:**
  - X-axis = ISO week columns (week number labels, e.g., "W26", "W27"). Default window = last 12 weeks, horizontally scrollable to full history.
  - Y-axis = habit rows, grouped by wave. Wave name as a fixed-left section header row.
  - Cell value = S1 status for that habit over that week (computed from per-habit snapshots for all days in the week).
  - Week-level S1 status = if any day in the week has a snapshot, use the worst-day status. If all days are not applicable = grey ("N/A").

- **D-119 — Cell color encoding:**
  - Healthy = green (CSS custom property `--color-score-healthy`)
  - Watch = yellow (`--color-score-watch`)
  - At-risk = orange (`--color-score-atrisk`)
  - Failing = red (`--color-score-failing`)
  - Not-applicable / no data = grey (`--color-score-na`)
  - Always encode status in both color AND text/title attribute (accessibility — NFR-07).

- **D-120 — Archived habits:** Hidden by default. A "Show archived" toggle (checkbox or button) in the wave-board header reveals archived habits with a greyed-out row style (opacity 0.4).

### Planning View (DESKTOP-05)

- **D-121 — Wave-capacity calendar (read-only):**
  - Forward-looking week grid. Default window = next 12 weeks (consistent with wave-board time window), scrollable further forward.
  - Each column = one future ISO week. Each wave = a section with its start week highlighted.
  - Cells show which habits are scheduled to begin that week (their `startDate` falls within that week).
  - Read-only: clicking a habit row navigates to its Catalog edit form (a link to `index.html#catalog` with the habitId as a query param or hash param). No inline editing or drag-and-drop in P6.
  - Habits already active (startDate in the past) are not shown in the planning view — the Analytics view covers the current state.

### Settings Additions (SETTINGS-02, SETTINGS-06)

- **D-122 — Model selector in Settings:** New Settings card or extension of existing About/Schedule card with a model-selector (three radio buttons or a `<select>`: S1 / S2 / S3). Selecting updates `settings.scoringModel` via `setSetting`. Default: `'S1'`.
- **D-123 — "Recompute scores" action in Settings Data card:** Button that triggers bulk snapshot re-run. With a loading state (button disabled + spinner text "Recomputing…"). On complete: toast confirmation. Slow on first run with years of data — NFR-03 requires < 2s for 5 years of synthetic data on current browsers.

### Claude's Discretion

- **S2 formula details** — user delegated; Claude will use 21-day half-life + linear stage multiplier as specified in D-111. Researcher can propose alternatives; planner locks the exact implementation.
- **S2 wave-level aggregation method** — averaging per-habit S2 scores (simple mean). Researcher may propose weighted mean if some habits are more important, but simple mean is the default.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs and constraints
- `.planning/PROJECT.md` — locked stack constraints, Key Decisions D-01..D-42, history integrity rule
- `.planning/REQUIREMENTS.md` — SCORING-01..09, DESKTOP-01..07, SETTINGS-02, SETTINGS-06, NFR-03, NFR-05, NFR-08 (all in scope for Phase 6)
- `.planning/ROADMAP.md` §"Phase 6" — goal, success criteria, plan count (TBD)
- `.planning/STATE.md` — Phase 5 complete; Phase 6 ready to plan. Blockers/Concerns note: *"scoring formulas in FEATURES.md are sketches; precise spec needs deeper work during Phase 6 planning"* — RESOLVED by this CONTEXT.md.
- `CLAUDE.md` — TL;DR stack table, Technology Stack, No-framework/no-bundler constraints

### Prior phase context
- `.planning/phases/05-backup-restore-json-csv-exports-json-import-nag/05-CONTEXT.md` — D-91..D-103; export/import infrastructure, Settings Data card extension, BroadcastChannel patterns
- `.planning/phases/04-domain-model-cadence-catalog-stages-mastery-multi-occurrence/04-CONTEXT.md` — D-82..D-90; mastery evaluation, cadence-aware denominator, wave aggregates, stage model

### Existing code to read before modifying
- `js/db/schema.js` — `score_snapshots` store definition (keyPath `[habitId, date]`, indexes on `date` and `habitId`)
- `js/domain/waveAggregates.js` — pure wave aggregate computation; comment "Phase 6 will cache this result (T-04-04)" — reuse this for the wave-level aggregation reads
- `js/domain/mastery.js` — mastery threshold evaluation and cadence-aware denominator; scoring modules MUST reuse the same denominator logic (not reimplement it)
- `js/domain/cadence.js` — cadence engine; scoring models use `appliesToday()` for cadence-aware denominator
- `js/state/apply.js` — single mutator chokepoint; model switch + snapshot writes flow through here
- `js/state/store.js` — `store.notify()` + `store.subscribe()` pattern; desktop views subscribe for reactive updates
- `js/router.js` — hash router with allowlist; extend with `#analytics`, `#waveboard`, `#planning`
- `desktop.html` — stub shell with P2 spine boot already wired; replace `<main class="stub">` content
- `js/desktop.js` — stub entry; extend with desktop route dispatch (mirrors `main.js`)
- `js/views/settings/builders.js` — Settings card builders; extend for SETTINGS-02 model selector and SETTINGS-06 Recompute action
- `js/views/settings.js` — Settings mounter; wire new cards + reactive re-render

### External references
- MDN — `IndexedDB` (range queries for `score_snapshots` by date range): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- MDN — CSS `position: sticky` (for wave-board sticky row headers and sidebar): https://developer.mozilla.org/en-US/docs/Web/CSS/position

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets
- **`js/domain/waveAggregates.js`** — Pure function with no IDB reads; already handles streak, atRisk, completion %. Phase 6 calls this from the snapshot writer (not from views). The comment `// snapshot writes in Phase 6 will cache this result (T-04-04)` explicitly anticipates this.
- **`js/domain/mastery.js`** — Rolling-window evaluation with cadence-aware denominator. Scoring modules MUST import and call the same denominator helper, not re-derive it.
- **`js/domain/cadence.js`** — `appliesToday(habit, date, ctx)` is the cadence gate. Scoring models use this to determine which days are applicable for each habit.
- **`js/router.js`** — allowlist hash router. Extend with desktop routes. Desktop's `desktop.js` can call `configureRouter({routes: {...}, defaultRoute: '#analytics'})` if the router is configurable, or copy the pattern.
- **`js/views/settings/builders.js`** — 5 pure builders pattern (Storage, Schedule, Install, Data, About). Phase 6 adds builders for model selector and Recompute action following the same pure-description-tree pattern.
- **`js/state/apply.js`** — `setSetting` handler already handles arbitrary key/value settings. Model selector uses `setSetting({key: 'scoringModel', value: 'S1'})` — no new handler needed.

### Established Patterns
- **JSDoc file headers (D-27)** — Every P6 file opens with `/** @file <summary>. <D-XX rationale> */`.
- **TDD-blocking gate** — RED test commit before every behavior-adding task.
- **Pure-view-builders (D-26)** — `js/domain/scoring.js` (new) is a pure module testable in Node; view modules call it via snapshot reads, never directly.
- **Hash router panel pattern** — `<section data-route="...">` + `hidden` attribute toggle. Mobile already does `#today`, `#settings`, `#catalog`, `#history`; desktop adds `#analytics`, `#waveboard`, `#planning`.
- **store.subscribe() for reactive views** — Desktop view modules subscribe to store changes exactly as `today.js` and `settings.js` do. Model switch → `store.notify()` → desktop views re-render.

### Integration Points
- **New file: `js/domain/scoring.js`** — Pure scoring module (no IDB). Exports `computeS1(habit, logs, ctx)`, `computeS2(habit, logs, ctx)`, `computeS3(habit, logs, allHabits, ctx)`. Called only by the snapshot writer, never by views.
- **New file: `js/io/scoreSnapshots.js`** (or extend `js/db/repo.js`) — Writes computed scores to `score_snapshots` store after log writes; exposes `rebuildAllSnapshots()` for the Settings "Recompute" action.
- **New files: `js/views/desktop/analytics.js`, `js/views/desktop/waveboard.js`, `js/views/desktop/planning.js`** — Desktop-specific view modules. Mirror the `js/views/today.js` pattern: a mount function + builder functions.
- **Extended: `desktop.js`** — Add route dispatch. Replace `<main class="stub">` in `desktop.html` with `<nav>` sidebar + `<section data-route>` panels.
- **Extended: `js/views/settings/builders.js`** — New builders for model selector card and Recompute button.
- **Extended: `sw.js` SHELL** — All new desktop view files (`js/views/desktop/*.js`, `js/domain/scoring.js`, `js/io/scoreSnapshots.js`, `css/desktop.css`, `desktop.html`) must be added to the SHELL array (D-81 pattern). The sw.shell.test.js test will guard this.

</code_context>

<specifics>

## Specific Ideas

- **Wave-board time window consistency:** Both the wave-board and planning view default to a 12-week window. This is intentional — the user sees the same temporal horizon in both backward (wave-board history) and forward (planning) directions.
- **S1 status is the "lingua franca":** Even when S2 or S3 is the active model, the wave-board always uses S1 status colors. S2/S3 scores appear as numeric columns in the Analytics view only. This keeps the wave-board visually consistent regardless of model selection.
- **Planning view links to Catalog:** Clicking a habit in the planning week grid should navigate the user to `index.html#catalog` (or open a new tab with that URL + a habitId param). The desktop planning view is read-only; edits happen on mobile Catalog or via a Catalog-style panel if the desktop shell also mounts the Catalog view.
- **Performance target (NFR-03):** 5 years of synthetic data = ~65 habits × 365×5 = ~118,625 log rows. Snapshot computation is the bottleneck. The researcher should investigate whether `IDBKeyRange` date-range queries on `score_snapshots` by date are fast enough for the wave-board scroll, or whether an in-memory cache of the last N weeks is needed.

</specifics>

<deferred>

## Deferred Ideas

- **Drag-and-drop habit rescheduling** — Editing `startDate` from the Planning view by drag. Significant implementation cost; Catalog handles it cleanly already. Future phase.
- **S2/S3 score display on wave-board cells** — Showing numeric S2/S3 in wave-board tooltip or secondary color. Deferred; wave-board uses S1 status colors only in P6.
- **Multi-year wave planner** — Extending the wave timeline beyond 2026 into 2027+ with user-defined waves (WAVE-06 from Phase 4). Waves are already IDB-persisted from P4; the planning view can show 2027 waves if they exist, but creating them is Catalog CRUD (already shipped).
- **Analytics chart views** — Line charts of rolling % over time per habit or per wave. P6 ships a table; charts are post-v1.
- **Habit correlation analysis** — "On days I do X, I'm 30% more likely to do Y." ANA-02 in REQUIREMENTS.md, explicitly deferred post-v1.

</deferred>

---

*Phase: 6 — Desktop Analytics & Scoring Trio*
*Context gathered: 2026-06-29*
