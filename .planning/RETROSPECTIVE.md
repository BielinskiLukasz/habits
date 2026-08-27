# Retrospective: Nawyki v1.0 MVP

**Date:** 2026-06-30
**Milestone:** v1.0
**Timeline:** 2026-05-25 → 2026-06-30 (36 days)
**Commits:** 309

---

## What Went Well

**Architecture decisions held.** The single-mutator chokepoint (`apply.js`) proved its value — no view ever wrote to IDB directly, which made the audit's integration check clean. The versioned-edit invariant (habit edits never touch logs) worked exactly as designed when Phase 4 shipped; zero history corruption.

**TDD paid off.** From Phase 2 onward, the RED→GREEN discipline meant every algorithmic module (cadence, mastery, stage, scoring) had high-confidence test coverage before being wired to UI. The 3 blockers found during the v1.0 audit were wiring gaps, not logic bugs — a sign the logic was correct before integration.

**Phase decomposition was right-sized.** Each phase delivered a user-visible slice: P3 gave a usable check-in, P4 gave the full domain, P5 gave backup/restore, P6 gave analytics. None felt like "plumbing with nothing to show."

**The no-npm constraint didn't hurt.** 309 commits with zero dependency updates, no `node_modules`, no lock file drift. The ~80-line IDB wrapper, ~30-line fake-repo, and ~25-line service worker all fit in one head. Zero friction from the toolchain.

**Score snapshots forward-compatibility worked.** Declaring `score_snapshots` in v1 IDB schema (Phase 2) with no data meant Phase 6 landed without a schema migration. The forward-declaration decision (D-39) prevented an otherwise mandatory `DB_VERSION` bump mid-milestone.

---

## What Could Be Improved

**Integration testing was too shallow.** The 3 integration blockers (DI seams never wired at boot, cross-tab listeners never registered) all passed unit tests because tests inject the seam themselves. A "boot integration test" that exercises the real `main.js` top-to-bottom against a fake DOM would have caught these immediately. Add to v1.1 testing strategy.

**Documentation drift accumulated.** By Phase 6, REQUIREMENTS.md had 11 unchecked boxes for Phase 1 (shipped, just not ticked), ROADMAP.md had a `[ ]` on Phase 3 (complete), and `BroadcastChannel('nawyki')` appeared in REQUIREMENTS while implementation used `'habits'`. Small drifts, but they created audit noise. A post-phase doc-check gate would eliminate this.

**STATE.md grew stale.** By Phase 6, STATE.md still referenced a temp branch (deleted months ago) and Phase 3 completion notes from months earlier. STATE.md should be reset to a "current position only" file at each phase transition, not an accumulating log.

**Phase 5 boot wiring was missed by verification.** The BLOCKER-01 wiring gap (configureExport/Import/BackupNag never called) passed Phase 5 VERIFICATION.md because verification checked code existence and logic — not whether the boot sequence called the seam. A post-phase integration smoke step ("does clicking Export JSON produce a download in the real app?") would catch this in Phase 5, not Phase 6 audit.

---

## Decisions to Carry Forward

**Keep:**
- Single-mutator chokepoint (DATA-04) — non-negotiable for audit clarity
- TDD from first behavior-adding commit onward
- Score snapshots as first-class IDB data (views never recompute)
- Two HTML shells (index.html mobile, desktop.html analytics) — no responsive-only approach
- Module SW with silent `.catch()` on file://

**Add for v1.1+:**
- Boot integration test: exercise real `main.js` against a fake DOM to catch DI seam gaps
- Post-phase doc-tick: automated check that REQUIREMENTS.md checkboxes match VERIFICATION.md status
- Phase 3+ smoke: "click Export → download appears" as a verification gate for io/ modules

**Revisit:**
- STATE.md format — reset at each phase transition rather than accumulating history
- Cross-tab sync completeness — the two-tab scenario needs an E2E test, not just unit tests of the BC wiring

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Timeline | 36 days |
| Commits | 309 |
| JS files | 52 |
| CSS files | 11 |
| Test files | 47 |
| Tests | 756 pass / 2 intentional stubs |
| IDB stores | 7 |
| Requirements | 123/123 shipped |
| Integration blockers found at audit | 3 (all fixed same session) |
| Lines added (est.) | ~12,000 |
| npm installs | 0 |
| Build steps | 0 |

---

*Written: 2026-06-30 at v1.0 milestone completion.*

---

## Milestone: v1.1 — Scheduled Habits

**Shipped:** 2026-08-27
**Phases:** 3 (7–9) | **Plans:** 9 | **Commits:** 169 | **Timeline:** 57 days (2026-07-01 → 2026-08-27)

### What Was Built

- `scheduled.js` domain service: one-time migration (active→scheduled for future startDate) + every-boot promotion (scheduled→active when startDate ≤ today)
- `createHabit` status derivation: lexicographic date comparison sets `'scheduled'` for future startDate
- Boot wiring in both HTML shells; `convert-nawyki.js` updated to emit correct status
- `promoteHabit` handler (TDD RED/GREEN/REFACTOR) — state mutation through apply() chokepoint
- Catalog Upcoming section: `buildUpcomingListItem`, split active/scheduled lists, CSS for consistent layout
- Desktop Waveboard: `buildWavePlanningSection` pure builder (WAVE-01–04), `mountWavePlanning` wiring, promote-from-waveboard, accordion state preservation across re-renders
- One debug cycle (waveboard-idb-databinding): IDBRequest-non-iterable bug fixed via `repo.getSnapshotsInRange()`

### What Worked

**Pattern fidelity was high.** The apply/notify/subscribe chain for `promoteHabit` was dropped in with zero surprises — Phase 7 followed the same DI pattern as all v1.0 handlers. No architectural decisions needed revisiting.

**TDD on the domain layer paid off again.** `scheduled.js` and `promoteHabit.js` were written RED→GREEN→REFACTOR before any wiring — both passed verification cleanly. The one non-TDD piece (waveboard wiring) required a debug cycle to fix a data-binding bug, which was caught by a regression test immediately after.

**Phased scope containment worked.** Phases 7 and 8 were clean (no gaps at UAT). Phase 9 had 3 UAT gaps but all were caught and closed within the same session (wave field backfill, stage label, waveboard data-binding). The milestone audit passed with 0 unresolved gaps.

### What Was Inefficient

**Waveboard data took two passes.** Phase 09 initially used `repo.runTx()` with a body returning a raw `IDBRequest` (not a Promise). The bug was caught during UAT rather than a pre-wire unit test — a waveboard data-query integration test would have caught it before UAT began.

**Wave field missing in imported habits.** Habits loaded from a real IDB (via `convert-nawyki.js` + JSON import) were missing the `wave` field because the field was never backfilled by `seed.js`. This caused 3 UAT gaps that required an additional plan (wave field backfill migration in `seed.js`).

**The 57-day timeline included a ~25-day pause** between Phase 7 completion (2026-07-01) and Phase 8 resumption (2026-07-20+) due to unrelated work. Effective execution time was ~30 days.

### Patterns Established

- `repo.getXxxInRange()` pattern: read all rows in an index range by `[startKey, endKey]` using `indexGetAll` — returns `Promise<object[]>`, safe for `for-of`. Documented in `repo.js` JSDoc, guarded by a regression test.
- Accordion state preservation on store re-render: `rerenderSection()` saves open `<details>` slugs before `replaceChildren()`, restores them after — prevents UX jank on `promoteHabit` feedback.
- `buildUpcomingListItem` pattern: pure builder (no DOM) returning a description object, tested in Node — same shape as `buildHabitRow` and `buildWavePlanningSection`.

### Key Lessons

- **Import data needs field completeness checks.** A seed migration (`seed.js`) should defensively backfill any fields added after initial seed creation — the `wave` field gap would have been caught at seed load time, not UAT.
- **Waveboard (and any complex view) benefits from a data-query integration test** before wiring — the IDBRequest-non-iterable bug would have been caught in ~2 minutes, not during UAT.
- **Phase scope felt right.** 3 phases was the correct granularity: domain service (P7), UI layer (P8), new view (P9). Each phase delivered a testable, verifiable slice with clear success criteria.

### Cost Observations

- Model mix: sonnet-4 throughout (budget profile)
- Sessions: ~8–10 across 3 phases + 1 debug cycle
- Notable: The debug cycle (waveboard-idb-databinding) was the highest-value single intervention — caught a subtle IDBRequest/Promise confusion that would have silently produced empty cells forever.

---

*Written: 2026-08-27 at v1.1 milestone completion.*
