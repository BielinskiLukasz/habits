# Roadmap: Nawyki (Habits)

## Milestones

- ✅ **v1.0 MVP** — Phases 1–6 (shipped 2026-06-30)
- ✅ **v1.1 Scheduled Habits** — Phases 7–9 (shipped 2026-08-27)
- 🔄 **v1.2 UX & i18n Quality Gate** — Phases 10–13 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–6) — SHIPPED 2026-06-30</summary>

- [x] Phase 1: PWA Shell & Tooling Hygiene (5/5 plans) — completed 2026-05-26
- [x] Phase 2: Storage Foundation (The Spine) (6/6 plans) — completed 2026-05-27
- [x] Phase 3: Today View & Settings v1 (7/7 plans) — completed 2026-05-29
- [x] Phase 4: Domain Model (11/11 plans) — completed 2026-06-05
- [x] Phase 5: Backup & Restore (6/6 plans) — completed 2026-06-06
- [x] Phase 6: Desktop Analytics & Scoring Trio (8/8 plans) — completed 2026-06-30

→ Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Scheduled Habits (Phases 7–9) — SHIPPED 2026-08-27</summary>

- [x] Phase 7: Scheduled Status Foundation (3/3 plans) — completed 2026-07-01
- [x] Phase 8: Today & Catalog — Upcoming Section (4/4 plans) — completed 2026-07-29
- [x] Phase 9: Desktop Waveboard (2/2 plans) — completed 2026-08-26

→ Full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 UX & i18n Quality Gate (Phases 10–13)

- [x] **Phase 10: i18n Tests & Verification** — completed 2026-08-31
- [x] **Phase 11: 4-State Log Model Tests** - Unit tests for log status domain logic and export round-trip verification
- [ ] **Phase 12: Swipe UX & Navigation Verification** - Verify swipe interactions, footer nav, and sidebar persistence
- [ ] **Phase 13: Code Review & Documentation** - Confirm pattern compliance and document new architecture decisions

---

## Phase Details

### Phase 10: i18n Tests & Verification

**Goal**: i18n module is fully tested and all views consistently use the translation system
**Depends on**: Nothing (retroactive quality gate over existing code)
**Requirements**: I18N-01, I18N-02, I18N-03
**Success Criteria** (what must be TRUE):

  1. Unit tests pass for locale lookup, missing-key fallback, and t() with variable interpolation
  2. A code scan finds zero hardcoded UI strings — every view builder and event handler calls t()
  3. Changing the language preference, reloading the page, and switching shells all display the correct language

**Plans**: 4/4 plans executed
Plans:
**Wave 1**

- [x] 10-01-PLAN.md — i18n unit test expansion (I18N-01)
- [x] 10-02-PLAN.md — locale key expansion + catalog.js fix (I18N-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-03-PLAN.md — fix remaining view hardcoded strings (I18N-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-04-PLAN.md — integration verification + @file documentation (I18N-03)

**Cross-cutting constraints:**

- node --test tests/ exits 0 after all modifications

**UI hint**: yes

### Phase 11: 4-State Log Model Tests

**Goal**: 4-state log status domain logic is test-covered and data round-trips are verified correct
**Depends on**: Phase 10
**Requirements**: LOG4-01, LOG4-04
**Success Criteria** (what must be TRUE):

  1. Unit tests cover all state transitions (completed/failed/skipped/undefined), persistence paths, and invalid-input handling
  2. A JSON export-then-import cycle preserves all 4 log states without data loss or state coercion
  3. CSV export cells show correct values: numeric/1/0 for applicable days and `x` for non-applicable days across all 4 states

**Plans**: 3/3 plans executed
Plans:
**Wave 1**

- [x] 11-01-PLAN.md — fix 4-state status model inconsistency (clears 29 failing tests)
- [x] 11-02-PLAN.md — add markSkipped integration tests + CSV skipped→x coverage

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-03-PLAN.md — JSON round-trip for all 4 log states

**Cross-cutting constraints:**

- node --test tests/ exits 0 after all modifications

**UI hint**: no

### Phase 12: Swipe UX & Navigation Verification

**Goal**: All interaction surfaces (swipe cycling, footer nav, sidebar) work correctly and consistently
**Depends on**: Phase 11
**Requirements**: LOG4-02, LOG4-03, UX-01, UX-02
**Success Criteria** (what must be TRUE):

  1. Swiping on Today view cycles states in the correct order (completed → failed → skipped → undefined → completed) with a distinct visual indicator for each state
  2. Swiping on History screen uses the same gestures and produces the same state progression as Today view
  3. Analytics footer nav is visible and functional on mobile; settings panel no longer contains a duplicate desktop analytics link
  4. Desktop sidebar collapse state persists across hash-route navigation within the same session

**Plans**: TBD
**UI hint**: yes

### Phase 13: Code Review & Documentation

**Goal**: New code meets all project quality patterns and architectural decisions are recorded
**Depends on**: Phase 12
**Requirements**: QA-01, QA-02
**Success Criteria** (what must be TRUE):

  1. Code review confirms no switch on log status or cadence types, no .innerHTML, JSDoc @file headers present on new modules, no indexedDB.* calls outside js/db/idb.js
  2. PROJECT.md documents the rationale and design of the 4-state log status model and i18n architecture (locale dict shape, no Intl framework, t() signature)

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. i18n Tests & Verification | 4/4 | Complete | 2026-08-31 |
| 11. 4-State Log Model Tests | 3/3 | Complete | 2026-08-31 |
| 12. Swipe UX & Navigation Verification | 0/? | Not started | - |
| 13. Code Review & Documentation | 0/? | Not started | - |

---

## Backlog

See [BACKLOG.md](BACKLOG.md) for captured ideas and issues.
