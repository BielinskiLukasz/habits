# Phase 7: Scheduled Status Foundation - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the data layer for `scheduled` as a first-class habit status — stored correctly on create, auto-promoted to `active` on boot when startDate arrives, migrated from existing IDB data, and output correctly by the seed converter. No UI changes; phases 8 and 9 consume this foundation.

**Requirements covered:** SCHED-01, SCHED-02, SCHED-03, DATA-01, DATA-02, DATA-03

</domain>

<decisions>
## Implementation Decisions

### createHabit status logic (SCHED-01, SCHED-02)
- **D-01:** The `createHabit` handler auto-derives status from startDate: `status = startDate > todayLocal() ? 'scheduled' : 'active'`. No `status` field in the event payload — domain rule lives in one place, callers cannot accidentally create a future-start habit as `active`.
- **D-02:** When `startDate` is `null` or not provided (defaults to `todayLocal()`), status is always `'active'` — null/today means start now.
- **D-03:** Seed habits with future `startDate` (waves 5–9) will be seeded as `'scheduled'` automatically via the same handler logic. This is intentional — they are genuinely not active yet.
- **D-04:** Clean division of responsibilities: seed creates habits with the correct initial status (once); the promotion pass handles `scheduled → active` transitions (every boot). The seed does NOT re-promote on subsequent runs.

### DATA-03 migration strategy — legacy reclassification
- **D-05:** The reclassification pass (existing `status: 'active'` habits with `startDate > today`) is a **one-time operation**, tracked via a `meta` key (`scheduledMigrationV1: true`). Mirrors the `seededIds` pattern in `seed.js`. On subsequent boots, the meta key is checked first and the pass is skipped.
- **D-06:** Two separate functions in the same boot module (`js/domain/scheduled.js`): `runMigration()` (one-time, DATA-03) and `runPromotion()` (every boot, SCHED-03). Both called by `bootScheduled()`. Clear separation — easy to test individually.
- **D-07:** Both `runMigration()` and `runPromotion()` write directly via `repo.runTx()`, bypassing `apply.js`. These are system-driven passes that run before UI mounts; they are not user actions. No `events` store rows needed.

### Auto-promotion placement in boot (SCHED-03)
- **D-08:** `bootScheduled()` is called after `bootSeed()` and **before** `hydrate()` in both `main.js` and `desktop.js`. This ensures `hydrate()` pre-warms the in-memory cache with the final, correct statuses from IDB.
- **D-09:** The module lives at `js/domain/scheduled.js` — this is domain logic (status transition rules), consistent with `mastery.js`, `stage.js`, and `wave.js` in the same directory.
- **D-10:** Dependency injection via `configureScheduled({repo})`, called in the P2 boot wiring block. Matches the established pattern for all other modules in `main.js` (`configureApply`, `configureSeed`, `configureWave`, etc.). Tests inject fakes via the same hook.
- **D-11:** Both `main.js` (mobile shell) and `desktop.js` (desktop shell) call `bootScheduled()`. The desktop shell may be the first tab the user opens; it must also see correct statuses.

### Post-import promotion timing (DATA-02)
- **D-12:** `mergeImportedStores` is already correct for DATA-02 — raw `put()` upsert preserves whatever `status` is in the imported JSON, including `'scheduled'`. No changes needed to the import module for Phase 7.
- **D-13:** After import, the importing tab does NOT call the promotion pass inline. If imported habits have `startDate <= today` and `status: 'scheduled'`, they will be promoted on the next boot (or when any tab reloads via the `import:done` broadcast). This is acceptable for Phase 7 — the UI for scheduled habits doesn't exist until Phase 8, so stale in-memory state has no user-visible effect.
- **D-14:** `convert-nawyki.js` (DATA-01) fix is a simple 1-line change: compare each habit's `startDate` against `new Date().toISOString().slice(0, 10)` at run time, and set `status: 'scheduled'` if it's in the future.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §"Phase 7: Scheduled Status Foundation" — goal, success criteria, requirements list
- `.planning/REQUIREMENTS.md` — SCHED-01/02/03, DATA-01/02/03 full requirement text

### Existing code to modify
- `js/state/apply/createHabit.js` — handler to update: add `status` derivation from `startDate` (currently hardcodes `'active'`)
- `js/io/import.js` (`mergeImportedStores`) — read to confirm DATA-02 is satisfied; no changes expected
- `js/io/seed.js` — read to understand the `meta` guard pattern (`seededIds`, `persistResult`) before implementing `runMigration()` meta key
- `js/db/schema.js` — IDB schema (v1, additive-only); `habits` store has `status` index already; no schema bump needed for Phase 7
- `js/main.js` — boot sequence to modify: add `configureScheduled({repo})` in P2 wiring block; add `await bootScheduled()` after `bootSeed()`, before `hydrate()`
- `js/desktop.js` — same boot sequence modification as `main.js`
- `scripts/convert-nawyki.js` — 1-line fix: `status: startDate > TODAY ? 'scheduled' : 'active'`

### New file to create
- `js/domain/scheduled.js` — new module; exports `configureScheduled({repo})` and `bootScheduled()`; internally `runMigration()` (one-time, DATA-03) and `runPromotion()` (every boot, SCHED-03)

### Established patterns to follow
- `js/db/schema.js` — additive-only IDB schema rule; no migrations needed for a new status value
- `js/io/seed.js` — `meta` store one-time guard pattern (read before writing `runMigration`)
- `js/domain/wave.js` — DI pattern: `configureWave({fetch})` + `bootWaves()` — mirror for `configureScheduled` + `bootScheduled`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/db/schema.js` `MIGRATIONS[1]`: `habits` store already has a `status` index — `runPromotion()` and `runMigration()` can use `repo.runTx` with a cursor over `status = 'scheduled'` / `status = 'active'` index to find affected rows efficiently.
- `js/util/date.js` `todayLocal()`: existing utility returning today's ISO date string — use in `createHabit.js` status derivation and in both `runMigration` / `runPromotion`.
- `js/io/seed.js` meta guard pattern: `tx.objectStore('meta').put({key, value})` / `get` — copy this pattern for the `scheduledMigrationV1` guard in `runMigration`.

### Established Patterns
- **DI pattern**: `configure*({repo, ...})` called in the P2 boot wiring block; module-level mutables; tests inject fakes. All domain/io modules follow this. `js/domain/scheduled.js` must match.
- **Boot sequence order**: configure seams → `bootSync` → `bootLifecycle` → `await bootSeed()` → [new: `await bootScheduled()`] → `await hydrate()` → `await bootWaves()` → `mountRoutes()`.
- **Direct `repo.runTx` for system writes**: `seed.js` writes habits directly via `repo.runTx`, bypassing `apply.js`. `runMigration` and `runPromotion` follow the same pattern.
- **JSDoc file header** (D-27): every `.js` file starts with `/** @file <one-line summary>. <rationale + cross-references to D-XX decisions> */`. The new `scheduled.js` must include this.
- **Additive-only IDB schema**: `DB_VERSION` stays at 1 for Phase 7. No `createObjectStore` or `createIndex` calls needed — `status: 'scheduled'` is just a new string value in the existing `status` field.

### Integration Points
- `js/main.js` lines ~P2 block: add `configureScheduled({repo})` alongside other configure calls; add `await bootScheduled()` after `await bootSeed()`.
- `js/desktop.js` ~P2 block: same two additions.
- `js/state/apply/createHabit.js`: single change — derive `status` from `startDate` comparison instead of hardcoding `'active'`.
- `scripts/convert-nawyki.js` line ~278: change `status: 'active'` to conditional based on `startDate > TODAY`.

</code_context>

<specifics>
## Specific Ideas

- The `meta` key for the one-time migration guard should be named `scheduledMigrationV1` (following the versioned naming convention visible in `schemaVersion`, `seededIds`).
- `runPromotion()` scans `status = 'scheduled'` index and promotes any row where `startDate <= todayLocal()`. One `repo.runTx` call updating all affected rows atomically.
- `runMigration()` scans `status = 'active'` index and reclassifies any row where `startDate > todayLocal()` to `'scheduled'`. One `repo.runTx` call; writes `scheduledMigrationV1: true` to `meta` within the same transaction so the guard is atomic with the data change.
- `bootScheduled()` runs `runMigration()` first, then `runPromotion()`. Order matters: migration may create new `'scheduled'` rows; promotion then promotes any `'scheduled'` rows with past startDates (including any just-reclassified ones).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 7-Scheduled Status Foundation*
*Context gathered: 2026-07-01*
