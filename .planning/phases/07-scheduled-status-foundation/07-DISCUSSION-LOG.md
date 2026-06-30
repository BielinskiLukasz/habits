# Phase 7: Scheduled Status Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 7-Scheduled Status Foundation
**Areas discussed:** createHabit status logic, DATA-03 migration strategy, Auto-promotion placement in boot, Post-import promotion timing

---

## createHabit status logic

| Option | Description | Selected |
|--------|-------------|----------|
| Handler auto-derives it | `status = startDate > today ? 'scheduled' : 'active'`. No status field in event payload. | ✓ |
| Caller passes it explicitly | Callers decide; every caller must apply the same logic. | |
| Handler derives but accepts override | Auto-derives by default, accepts explicit override. | |

**User's choice:** Handler auto-derives status from startDate.
**Notes:** Null/no startDate always yields `'active'`. Seed habits with future startDate correctly become `'scheduled'`. Clean division: seed creates with correct initial status; promotion pass handles scheduled→active transitions on every boot.

---

## DATA-03 migration strategy

| Option | Description | Selected |
|--------|-------------|----------|
| One-time, tracked in meta | Write `scheduledMigrationV1: true` after running. Skip on subsequent boots. | ✓ |
| Idempotent every boot | Query and reclassify every boot; no meta key needed. | |

**User's choice:** One-time, tracked in meta.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate functions in same boot module | `runMigration()` + `runPromotion()` called by `bootScheduled()`. | ✓ |
| Single function handles both | One pass: legacy reclassification + ongoing promotion. | |

**User's choice:** Separate functions — `runMigration()` (one-time) and `runPromotion()` (every boot).

| Option | Description | Selected |
|--------|-------------|----------|
| Direct repo.runTx — bypass apply.js | System-driven migration, no events rows needed. | ✓ |
| Through apply.js (dispatch editHabit events) | Creates audit trail but pollutes events store. | |

**User's choice:** Direct `repo.runTx` for both `runMigration` and `runPromotion`.
**Notes:** Both are system-driven passes that run before UI mounts; not user actions.

---

## Auto-promotion placement in boot

| Option | Description | Selected |
|--------|-------------|----------|
| After bootSeed(), before hydrate() | Hydrate gets correct statuses from IDB. | ✓ |
| After hydrate(), before mountRoutes() | Cache warms with stale statuses; needs extra invalidation. | |
| Inside bootSeed() as final step | Couples migration/promotion to seed module. | |

**User's choice:** After `bootSeed()`, before `hydrate()`.

| Option | Description | Selected |
|--------|-------------|----------|
| js/domain/scheduled.js | Domain logic; consistent with mastery.js, stage.js, wave.js. | ✓ |
| js/io/scheduled.js | I/O framing; but logic is domain-level. | |
| js/state/bootScheduled.js | Inconsistent with existing state/ subdirectory structure. | |

**User's choice:** `js/domain/scheduled.js`.

| Option | Description | Selected |
|--------|-------------|----------|
| DI pattern — configureScheduled({repo}) | Matches all other modules in main.js boot wiring. | ✓ |
| Direct parameter: bootScheduled(repo) | Simpler but breaks consistency and testability. | |

**User's choice:** DI pattern — `configureScheduled({repo})`.

| Option | Description | Selected |
|--------|-------------|----------|
| Both shells call bootScheduled() | Desktop may be open at boot; needs consistent statuses. | ✓ |
| Only main.js (mobile) | Desktop shell skips for now. | |
| Only main.js now; desktop.js in Phase 9 | Defer desktop wiring to Phase 9. | |

**User's choice:** Both `main.js` and `desktop.js` call `bootScheduled()`.

---

## Post-import promotion timing

| Option | Description | Selected |
|--------|-------------|----------|
| Acceptable — Phase 7 is foundation only | Promotion happens on next boot; UI for scheduled habits not until Phase 8. | ✓ |
| No — call promotion pass inline after mergeImportedStores | Adds coupling between import flow and scheduled domain. | |

**User's choice:** Acceptable for Phase 7 — keep scope tight.

| Option | Description | Selected |
|--------|-------------|----------|
| Already satisfied — raw put() preserves status | No changes needed to mergeImportedStores for Phase 7. | ✓ |
| Add validation: reject/normalize malformed scheduled habits | Adds complexity. | |

**User's choice:** DATA-02 is already satisfied by existing raw `put()` upsert.

| Option | Description | Selected |
|--------|-------------|----------|
| Simple date comparison against run date | DATA-01 is a 1-liner fix in the converter. | ✓ |
| There's a nuance I want to discuss | — | |

**User's choice:** Simple date comparison — `startDate > new Date().toISOString().slice(0,10)`.

---

## Claude's Discretion

- Meta key name: `scheduledMigrationV1` (follows versioned naming convention in the codebase)
- `bootScheduled()` runs `runMigration()` first, then `runPromotion()` — order matters since migration may create new `'scheduled'` rows that promotion then catches

## Deferred Ideas

None — discussion stayed within phase scope.
