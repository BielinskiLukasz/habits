# Requirements: Nawyki — Personal Habit Tracker

**Defined:** 2026-08-31
**Core Value:** Daily check-in must be friction-free, and the system's existing model must be honored exactly as the user already practices it.

## v1.2 Requirements

Retroactive quality validation of 6 quick-task features shipped outside the milestone workflow (2026-08-28–31). Each requirement either adds tests, verifies completeness, or documents decisions for work that already exists in the codebase.

### Internationalisation (EN/PL i18n)

- [x] **I18N-01**: i18n module has unit tests covering locale lookup, missing-key fallback, and t() with interpolation
- [x] **I18N-02**: All view builders and event handlers use t() — zero hardcoded UI strings remain across both shells
- [ ] **I18N-03**: Language preference (setting stored in IDB `settings` store) persists correctly across page reload and between the mobile and desktop shells

### 4-State Log Status

- [ ] **LOG4-01**: Domain logic for 4-state log status (completed/failed/skipped/undefined) has unit tests covering all state transitions, persistence, and invalid inputs
- [ ] **LOG4-02**: Swipe UX on Today view cycles all 4 states in the correct order and shows correct visual indicator for each state
- [ ] **LOG4-03**: History screen swipe UX is consistent with Today's 4-state interaction model — same gestures, same visual states, same result
- [ ] **LOG4-04**: JSON export round-trips all 4 log states without data loss; CSV export emits correct cell values (numerics for applicable days, `x` for non-applicable) regardless of state

### UX Features

- [ ] **UX-01**: Analytics footer nav is visible and functional on both mobile and desktop; settings panel no longer contains a duplicate desktop analytics link
- [ ] **UX-02**: Desktop sidebar collapse/expand state persists across hash-route navigation within the desktop shell session

### Quality Assurance

- [ ] **QA-01**: Code review confirms all new modules follow project patterns — no `switch` on log status or cadence types; no `.innerHTML`; JSDoc `@file` headers present; no `indexedDB.*` calls outside `js/db/idb.js`
- [ ] **QA-02**: PROJECT.md documents new architectural decisions: 4-state log status model rationale and i18n architecture (locale dictionary shape, no Intl framework, t() signature)

## Future Requirements

### Analytics (deferred)

- **ANA-01**: Completion rate analytics distinguish between "failed" and "skipped" states (different intent signals)
- **ANA-02**: Per-habit log state breakdown visible in history view

## Out of Scope

| Feature | Reason |
|---------|--------|
| Polish-only UI | Shipped in v1.1 as out-of-scope; D-35 locks English primary |
| Deep i18n (plurals, date formats, Intl.* API) | Over-engineered for a two-locale personal tool; locale dict + t() is sufficient |
| 5th log state ("partial") | Scope creep; 4-state covers the meaningful distinctions |
| Server-side analytics or telemetry | Privacy constraint; app never phones home |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| I18N-01 | Phase 10 | Complete |
| I18N-02 | Phase 10 | Complete |
| I18N-03 | Phase 10 | Pending |
| LOG4-01 | Phase 11 | Pending |
| LOG4-02 | Phase 12 | Pending |
| LOG4-03 | Phase 12 | Pending |
| LOG4-04 | Phase 11 | Pending |
| UX-01 | Phase 12 | Pending |
| UX-02 | Phase 12 | Pending |
| QA-01 | Phase 13 | Pending |
| QA-02 | Phase 13 | Pending |

**Coverage:**

- v1.2 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-31*
*Last updated: 2026-08-31 after roadmap creation*
