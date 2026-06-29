# Phase 6 Plan Summary — Desktop Analytics & Scoring Trio

**Phase:** 06-desktop-analytics-scoring-trio
**Plans:** 8 plans in 4 waves
**Status:** Ready to execute

---

## Wave Structure

| Wave | Plans | Parallel? | Blocked on |
|------|-------|-----------|------------|
| 1 | 06-01, 06-02 | Yes (fully parallel) | Phase 5 complete |
| 2 | 06-03, 06-04 | Yes (fully parallel) | 06-01 + 06-02 |
| 3 | 06-05, 06-06, 06-07 | Yes (fully parallel) | 06-03 + 06-04 |
| 4 | 06-08 | — | 06-05 + 06-06 + 06-07 |

---

## Plans Overview

| Plan | Title | Wave | Tasks | Key Files |
|------|-------|------|-------|-----------|
| 06-01 | Pure Scoring Domain | 1 | 2 (TDD) | `js/domain/scoring.js`, `tests/unit/domain/scoring.test.js` |
| 06-02 | Score Snapshot Writer | 1 | 2 (TDD) | `js/io/scoreSnapshots.js`, `tests/unit/io/scoreSnapshots.test.js` |
| 06-03 | Snapshot Trigger + Settings | 2 | 2 (TDD) | `js/state/apply.js`, `js/views/settings/builders.js`, `js/views/settings.js`, `js/main.js` |
| 06-04 | Desktop Shell + Router | 2 | 2 | `desktop.html`, `js/desktop.js`, `js/router.js`, `css/desktop.css`, `css/tokens.css` |
| 06-05 | Analytics View | 3 | 3 | `js/views/desktop/analytics.js`, `js/desktop.js` |
| 06-06 | Wave-board View | 3 | 3 | `js/views/desktop/waveboard.js`, `js/desktop.js` |
| 06-07 | Planning View | 3 | 3 | `js/views/desktop/planning.js`, `js/desktop.js` |
| 06-08 | Phase Closeout | 4 | 2 | `sw.js`, `tests/integration/sw.shell.test.js`, `js/util/version.js`, `VERSIONING.md` |

---

## Critical Design Decisions (Locked)

### score_snapshots Row Shape (resolves D-113 vs schema.js conflict)

The existing `score_snapshots` IDB store has `keyPath: ['habitId', 'date']` (one row per habitId+date pair). D-113 originally described "3 rows per (habit, date)," which conflicts with the compound keyPath. **All P6 plans use a single-row-per-(habitId,date) design** with all three model scores embedded:

```javascript
{
  habitId: string,
  date: string,           // YYYY-MM-DD
  s1Score: number|null,   // 0–100, null during grace period
  s1Status: string|null,  // 'Healthy'|'Watch'|'At-risk'|'Failing'|null
  s2Score: number|null,   // 0–1
  s3Score: number|null,   // 0–1
  scoreVersion: 1,        // always 1 for Phase 6
}
```

No schema migration needed — the existing v1 `score_snapshots` store holds these rows fine.

### router.js defaultRoute Extension

`mountRoutes` gains a `defaultRoute` parameter (default `'#today'`). Mobile behavior is unchanged. Desktop passes `defaultRoute: '#analytics'`. This is the only change to router.js — no new routes are hardcoded in the module itself.

### Wave-board Always Uses S1 Status

Even when S2 or S3 is the active model, the wave-board cells always use S1 status colors (D-118). S2/S3 scores only appear as numeric columns in the Analytics view.

### apply.js onLogWrite DI Seam (avoids circular imports)

Score snapshot writes are triggered after log mutations via a `_onLogWrite` callback injected into `apply.js` via `configure({ ..., onLogWrite })`. This keeps `apply.js` free of direct imports from `scoreSnapshots.js`, preventing circular dependencies.

---

## Source Audit: Coverage Check

| Source | Item | Covered by Plan |
|--------|------|----------------|
| GOAL | Desktop analytics surface with S1/S2/S3 live | 06-01..06-07 |
| SCORING-01 | S1 rolling threshold model | 06-01 |
| SCORING-02 | S1 as default model | 06-03 (Settings card default) |
| SCORING-03 | Model switching without reload | 06-03 + 06-05 (reactive) |
| SCORING-04 | S2 day-weighted model | 06-01 |
| SCORING-05 | S3 load-adjusted model | 06-01 |
| SCORING-06 | All models: cadence-aware denominator | 06-01 (ctx.appliesToday) |
| SCORING-07 | 7-day grace period + 0.3× mastered weighting | 06-01 |
| SCORING-08 | Views read snapshots, never call scoring.js | 06-05, 06-06 (no scoring.js import in views) |
| SCORING-09 | scoreVersion field in rows | 06-02 (scoreVersion: 1 hardcoded) |
| DESKTOP-01 | "Open desktop analytics →" link in Settings | 06-03 |
| DESKTOP-02 | Desktop shares all domain/state/db modules | 06-04 (desktop.js P2 spine) |
| DESKTOP-03 | Analytics view: per-habit stats + wave groups | 06-05 |
| DESKTOP-04 | Wave-board heat-map | 06-06 |
| DESKTOP-05 | Planning view: forward 12-week grid | 06-07 |
| DESKTOP-06 | Planning: click habit → Catalog link | 06-07 |
| DESKTOP-07 | Hash-routed panels (#analytics, #waveboard, #planning) | 06-04 |
| SETTINGS-02 | S1/S2/S3 model selector in Settings | 06-03 |
| SETTINGS-06 | "Recompute Scores" action in Settings | 06-03 |
| NFR-03 | rebuildAllSnapshots < 2s for 5 years × 65 habits | 06-02 (single tx per habit strategy) |
| NFR-05 | Desktop layout works without framework | 06-04 (vanilla CSS cascade layers) |
| NFR-08 | Offline: all new files in SHELL | 06-08 |

All requirements covered. No deferred items slipping into plans.

---

## Next Steps

Execute: `node --test` (verify Phase 5 green baseline), then execute plans in wave order.

Wave 1 plans can be executed in parallel (separate context windows):
- Plan 06-01: scoring domain
- Plan 06-02: snapshot writer

After both complete:
- Plan 06-03 + 06-04 (parallel)

After both complete:
- Plans 06-05, 06-06, 06-07 (parallel)

Final:
- Plan 06-08 (closeout)
