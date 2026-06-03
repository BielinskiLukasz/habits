# Phase 4: Domain Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 04-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 4 — Domain Model (Cadence, Catalog, Stages, Mastery, Multi-occurrence, History, Waves)
**Areas discussed:** Catalog CRUD & Habit Editing, Stage Model & Advancement Triggers, Mastery Visualization & Threshold Settings, Multi-Occurrence Logging & History Navigation

---

## Catalog CRUD & Habit Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Separate `#catalog` route | Like Today and Settings, a distinct view with its own layout. Desktop-optimized, full CRUD surface. | ✓ |
| Embedded in Settings | Add Catalog as a card or section within the existing Settings panel (similar to how Data/About live there). | |
| Quick-add modal from Today | Create button launches a floating modal/popup; edit is via long-press on a habit row or a context menu. | |

**User's choice:** Separate `#catalog` route (D-82)

**Notes:** User confirmed this is best for mobile because:
- Daily check-in stays friction-free (Today remains minimal)
- Full editing (stages, cadence rules, thresholds) has room without cramping mobile
- One tap from Settings/header to access Catalog

---

## Stage Model & Advancement Triggers

| Aspect | Decision |
|--------|----------|
| Stage definition | Flexible stage table (1-N rows; each row = label + target value) |
| Advancement triggers | Four types, composable (OR logic): manual button, scheduled by week, after-N-days (unconditional), after-N-days with C% completion |

**User's choice:** Flexible stages (D-83); all four advancement trigger types including C% completion variant (D-84)

**Notes:** User added a nuance I didn't initially offer: "Auto-advance after N days with C% completion" — automatically advances when user has been in the stage for N days **AND** completion is ≥ C%. This prevents auto-advance if the user is slipping.

---

## Mastery Visualization & Threshold Settings

| Option | Description | Selected |
|--------|-------------|----------|
| Muted row + badge (visible, tappable) | Habit stays on list, text is muted (opacity 0.5), with a 'Mastered' badge. User can still tap to log. | ✓ |
| Separate 'Mastered' section below active habits | Today list splits: Active on top, Mastered below in a collapsed/expandable section. | |
| Hidden by default (reveal toggle) | Mastered habits are hidden by default; a 'Show completed habits' toggle reveals them. | |

**User's choice:** Muted row + badge, always visible (D-85)

**Rationale:** User confirmed that if mastered habits are hidden, the user won't realize when they've slipped below the threshold. Visibility is essential to keep the habit alive.

| Aspect | Decision | Location |
|--------|----------|----------|
| Global mastery threshold (%) and window (days) | Settings panel (SETTINGS-01) | Settings |
| Per-habit threshold override | Optional "Custom mastery" checkbox + fields in Catalog edit | Catalog |

**User's choice:** Both global (Settings) and per-habit override (Catalog) (D-86, D-87)

---

## Multi-Occurrence Logging & History Navigation

### Numeric +1 Counter UX

| Option | Description | Selected |
|--------|-------------|----------|
| Tap to increment, long-press to clear | Single tap increments counter. Long-press resets to 0. | |
| Plus/minus buttons on the row | Row has +/- buttons next to the counter. User taps + to increment, - to decrement. | ✓ |
| Tap row opens numeric input modal | Tap habit → small modal with a number field. User types exact count and saves. | |

**User's choice:** Plus/minus buttons (D-88)

**Rationale:** User confirmed +/- buttons are the best balance for mobile:
- Fast but safe (prevents accidental overshooting, unlike single-tap increment)
- Visual confirmation of the + button (clear what's happening)
- Familiar gesture on touch (2 taps to increment by 2)

### Slot-Checklist UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline slot toggles on the row | Row shows 7 small checkboxes. Tap any to toggle. "X / Y meals" progress displayed on the row. | |
| Tap row to open a slot-edit panel | Tap habit → side panel or modal opens with all slots as toggles. Keeps Today row minimal. | |
| Expandable row (disclosure pattern) | Row has a disclosure arrow. Tap arrow → row expands to show all slots. Tap again to collapse. | ✓ |

**User's choice:** Expandable disclosure pattern (D-89)

**Rationale:** Best balance for mobile:
- Today stays compact by default ("3 / 7 meals ▼")
- Expands in one tap for detailed logging
- No modal friction
- Familiar W3C disclosure pattern

### History Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar widget (click date) | Full calendar grid. User clicks a date → History shows that day's habits. | |
| Date stepper (← / → arrows + text field) | Shows current date with previous/next day arrows. Optional text field to jump to a specific date. | Partial ✓ |
| Date-range slider or picker | Select a date from a timeline or range input. Shows habits from that date onward. | Partial ✓ |

**User's choice:** Hybrid approach (D-90)

**Rationale:** User explicitly wanted a combination:
- **Default:** Date stepper with ← → arrows (fastest for adjacent days, keyboard + touch friendly)
- **Optional:** "Jump to date" toggle that reveals calendar widget and/or date-range picker (collapsed by default to keep History view clean)

**Notes:** User clarified that Shift+click for date-range selection wouldn't work on mobile. Instead, use explicit tap-friendly UI: two date pickers ("From date" and "To date") that appear when "Jump to date" is expanded.

---

## Claude's Discretion

None — user provided explicit direction on all four gray areas.

---

## Deferred Ideas

- Wave model as first-class IDB store + v1→v2 migration (promote to P4 UAT or later if user-extensibility needed)
- Detailed mastery analytics and dashboard (P6 feature)
- Habit templating, bulk operations, per-log annotations (future phases)

---

*Discussion log recorded: 2026-06-04*
