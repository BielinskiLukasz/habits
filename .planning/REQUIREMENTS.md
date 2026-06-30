# Requirements: Nawyki — Personal Habit Tracker

**Defined:** 2026-06-30
**Milestone:** v1.1 Scheduled Habits
**Core Value:** Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.

## v1.1 Requirements

### Scheduled Status

- [ ] **SCHED-01**: App supports a `scheduled` status for habits (4th status alongside active/mastered/archived)
- [ ] **SCHED-02**: Habits with `startDate > today` created or imported are stored with `status: 'scheduled'`
- [ ] **SCHED-03**: On app boot, habits whose `startDate` has arrived auto-transition from `scheduled` → `active`
- [ ] **SCHED-04**: User can manually promote a scheduled habit to active before its startDate

### Catalog / Upcoming

- [ ] **CAT-01**: Today view never shows scheduled habits (regardless of startDate)
- [ ] **CAT-02**: Active Catalog list excludes scheduled habits
- [ ] **CAT-03**: Catalog has an "Upcoming" section listing all scheduled habits, sorted by startDate
- [ ] **CAT-04**: Each scheduled habit in Upcoming shows its startDate and wave

### Waveboard

- [ ] **WAVE-01**: Desktop Waveboard shows each wave with its planned startDate
- [ ] **WAVE-02**: Each wave row shows counts: active habits vs scheduled habits
- [ ] **WAVE-03**: Scheduled habits are listed per wave with their startDate in the Waveboard
- [ ] **WAVE-04**: Active habits are listed per wave with their current status (active/mastered)

### Data / Migration

- [ ] **DATA-01**: `scripts/convert-nawyki.js` sets `status: 'scheduled'` for habits with `startDate > today`
- [ ] **DATA-02**: JSON import (`mergeImportedStores`) correctly stores `status: 'scheduled'` from imported data
- [ ] **DATA-03**: Existing IDB habits with `status: 'active'` and `startDate > today` are migrated to `scheduled` on boot (one-time pass)

## Future Requirements

### Display / UX

- **UX-01**: Polish habit name (`name_pl`) shown as a secondary line on Today / Catalog
- **UX-02**: Visual progress bars for numeric and slot-checklist habits on Today view

### Wave Management

- **MGMT-01**: User can create a new wave beyond the seed-provided waves
- **MGMT-02**: User can edit wave name, theme, startDate for any wave

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reminders / push notifications | Explicitly deferred (user prefers no nag) |
| Cloud sync / multi-device | Single-device + JSON export-import sufficient for now |
| Full Waveboard analytics | Kept minimal in v1.1 — full analytics is a future milestone |
| Automatic wave startDate computation | Wave dates are source-of-truth in the seed; not auto-derived |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHED-01 | — | Pending |
| SCHED-02 | — | Pending |
| SCHED-03 | — | Pending |
| SCHED-04 | — | Pending |
| CAT-01 | — | Pending |
| CAT-02 | — | Pending |
| CAT-03 | — | Pending |
| CAT-04 | — | Pending |
| WAVE-01 | — | Pending |
| WAVE-02 | — | Pending |
| WAVE-03 | — | Pending |
| WAVE-04 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 15 ⚠️ — will be resolved by roadmapper

---
*Requirements defined: 2026-06-30*
*Last updated: 2026-06-30 — initial definition*
