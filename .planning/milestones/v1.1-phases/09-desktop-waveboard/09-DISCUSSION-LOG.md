# Phase 9: Desktop Waveboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 9-Desktop Waveboard
**Areas discussed:** View structure, Habit list visibility, Promote action in Waveboard, Wave header enrichment

---

## View Structure

### Q1: How should planning-level info coexist with the heat-map?

| Option | Description | Selected |
|--------|-------------|----------|
| Wave Planning section above heat-map | New section at top, heat-map stays below. Two distinct sections, one panel. | ✓ |
| Replace heat-map with planning table | Waveboard becomes wave-first planning table; heat-map moves elsewhere. | |
| Enrich existing heat-map rows | Wave headers gain startDate + counts inline; no structural change. | |

**User's choice:** Wave Planning section above heat-map

### Q2: What goes in the wave row header?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + startDate + counts | Concise, covers WAVE-01 and WAVE-02. | |
| Name + startDate + counts + wave health indicator | Same plus visual health indicator for active habits. | ✓ |
| Name + startDate only, counts in expanded list | Minimalist header; counts only visible after expanding. | |

**User's choice:** Name + startDate + counts + wave health indicator

### Q3: Where does the wave health indicator come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Worst S1 status across active habits (this wave) | Reuses worstStatus() from waveboard.js. | ✓ |
| Average S1 status across active habits | More nuanced but requires new formula. | |
| You decide | Claude picks the implementation. | |

**User's choice:** Worst S1 status (recommended)

### Q4: Where does Wave Planning appear relative to the heat-map?

| Option | Description | Selected |
|--------|-------------|----------|
| Top of waveboard panel, heat-map scrolls below | User sees planning overview first. | ✓ |
| Separate sub-tab or toggle | Two modes; extra click to switch. | |
| Heat-map stays at top, planning appended below | Existing behavior preserved; planning is secondary. | |

**User's choice:** Top of panel, heat-map below

---

## Habit List Visibility

### Q1: Always expanded or collapsible?

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible, collapsed by default | Clean overview, user expands waves of interest. | ✓ |
| Always expanded | All habits visible immediately; longer scroll. | |
| Collapsible, expanded by default | Starts open; can be collapsed. | |

**User's choice:** Collapsible, collapsed by default

### Q2: What does each habit row show?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + status-specific detail | Scheduled: startDate. Active/mastered: status label. Minimal. | |
| Name + status + stage + cadence | Richer rows with more planning context. | ✓ |
| Name + status only | Simplest: just name and status badge. | |

**User's choice:** Name + status + stage + cadence

### Q3: How are scheduled vs active/mastered habits distinguished?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped: active/mastered first, then Scheduled sub-header | Mirrors Phase 8 Catalog Upcoming pattern. | ✓ |
| Mixed, sorted by status (scheduled last) | One list, status badge distinguishes them. | |
| Separate tabs within each wave panel | Maximum clarity, high complexity. | |

**User's choice:** Grouped with Scheduled sub-header

### Q4: Show archived habits?

| Option | Description | Selected |
|--------|-------------|----------|
| No — active, mastered, scheduled only | Planning view is forward-looking. | ✓ |
| Yes, with visual distinction | Grayed out at end of each wave list. | |
| You decide | Claude picks. | |

**User's choice:** No archived habits in planning view

---

## Promote Action in Waveboard

### Q1: Include Promote button on scheduled habits?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include promote button | Reuse promoteHabit.js handler from Phase 8. | ✓ |
| No — view only, promote from Catalog | Simpler waveboard, requires context-switching. | |
| Yes, but link to Catalog instead | Navigate to Catalog's Promote button; not one-click. | |

**User's choice:** Yes — include promote button

### Q2: After promoting, what happens to the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Wave Planning section re-renders immediately | Habit moves from Scheduled to active list; counts update. | ✓ |
| Full waveboard refresh (both sections) | Both sections re-render; heat-map refresh is slow. | |
| You decide | Claude picks lightest re-render path. | |

**User's choice:** Wave Planning section re-renders immediately

### Q3: Confirmation dialog for Promote?

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation — direct action | Consistent with Catalog promote and Archive/Restore pattern. | ✓ |
| Yes — one-click confirmation | Adds friction; prevents accidental early activation. | |

**User's choice:** No confirmation — direct action

---

## Wave Header Enrichment

### Q1: Visual format for wave health indicator?

| Option | Description | Selected |
|--------|-------------|----------|
| Colored status badge (text + background) | Reuses waveboard-cell CSS modifier slugs. | ✓ |
| Colored dot only | Minimal; requires hover for accessibility. | |
| No indicator — counts serve as proxy | Simpler header row. | |

**User's choice:** Colored status badge

### Q2: What time window for the health indicator?

| Option | Description | Selected |
|--------|-------------|----------|
| Current week's worst S1 status | Timely; consistent with heat-map's most recent column. | ✓ |
| Rolling 4-week window worst S1 | Wider look-back; less volatile. | |
| You decide | Claude picks simplest computation from score_snapshots. | |

**User's choice:** Current week

### Q3: For waves with no active habits, what shows?

| Option | Description | Selected |
|--------|-------------|----------|
| No badge — health indicator omitted | Clean; no badge for future waves. | |
| 'Upcoming' label badge | Neutral gray badge; symmetric header across all waves. | ✓ |
| You decide | Claude picks. | |

**User's choice:** 'Upcoming' label badge

### Q4: Entire header row clickable or separate expand button?

| Option | Description | Selected |
|--------|-------------|----------|
| Entire header row clickable | Large click target; chevron indicates state. Standard accordion. | ✓ |
| Separate expand button on the right | Smaller target but no ambiguity with promote button (which is inside the list, not the header). | |
| You decide | Claude picks the pattern that avoids accidental toggle. | |

**User's choice:** Entire header row clickable

---

## Claude's Discretion

None — user made explicit decisions in all areas.

## Deferred Ideas

None — discussion stayed within phase scope.
