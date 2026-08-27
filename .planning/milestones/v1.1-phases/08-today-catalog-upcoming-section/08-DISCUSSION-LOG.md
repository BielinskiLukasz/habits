# Phase 8: Today & Catalog — Upcoming Section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 8-Today & Catalog — Upcoming Section
**Areas discussed:** Upcoming list item design, Promote action UX, Upcoming section visibility, Catalog split implementation

---

## Upcoming list item design

| Option | Description | Selected |
|--------|-------------|----------|
| Simplified: name + date + wave | Just the essentials: habit name, startDate, wave badge, Promote button. No stage info or mastery badge. | ✓ |
| Full: reuse buildHabitListItem | Same rich row as active habits — all fields and buttons. Adds promote button. | |
| Minimal: name + promote button only | Stripped down, date/wave in tooltip. | |

**User's choice:** Simplified row

---

| Option | Description | Selected |
|--------|-------------|----------|
| ISO date: 2026-01-05 | Matches internal format; consistent with History date picker. | ✓ |
| Human-readable: Jan 5, 2026 | More readable at a glance. | |
| Relative: "in 3 weeks" | Most scannable but changes daily. | |

**User's choice:** ISO date (YYYY-MM-DD)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include Edit button | Allows adjusting startDate/cadence/stage before habit goes live. | ✓ |
| No — Promote only | Simpler; user promotes first then edits. | |
| You decide | Claude picks. | |

**User's choice:** Include Edit button

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — Archive not needed for Upcoming | Keeps UI focused on promote flow. | ✓ |
| Yes — include Archive button | Consistent with active list. | |

**User's choice:** No archive button on Upcoming items

---

## Promote action UX

| Option | Description | Selected |
|--------|-------------|----------|
| Direct promote — no confirmation | Single tap, consistent with Archive/Restore. | ✓ |
| Confirmation dialog | Safer against accidental taps. | |
| Undo toast | No dialog, brief undo option. | |

**User's choice:** Direct promote, no confirmation

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show on Today immediately | Today re-renders on habit:put broadcast; habit appears if applicable for today. | ✓ |
| No — appears on Today only after next boot | Simpler; doesn't re-query Today. | |

**User's choice:** Show on Today immediately

---

| Option | Description | Selected |
|--------|-------------|----------|
| BroadcastChannel habit:put message | Matches D-30 cross-tab sync pattern. | ✓ |
| Direct store cache invalidation + re-render | Simpler for single-tab; bypasses BC pattern. | |
| You decide | Claude picks. | |

**User's choice:** BroadcastChannel `{type: 'habit:put', habitId}`

---

| Option | Description | Selected |
|--------|-------------|----------|
| New apply handler: promoteHabit.js | Consistent with createHabit.js, editHabit.js, archiveHabit.js pattern. Testable. | ✓ |
| Inline in catalog.js event handler | Less code, breaks apply/ pattern. | |

**User's choice:** New `js/state/apply/promoteHabit.js`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — catalog re-renders the full list immediately | Promoted habit disappears from Upcoming, appears in active section. | ✓ |
| Yes — but only remove from Upcoming | Active list updates on next navigation. | |

**User's choice:** Full catalog re-render immediately

---

## Upcoming section visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when empty | Don't render section at all if no scheduled habits. | ✓ |
| Always visible with empty state text | Shows "No upcoming habits" when empty. | |
| You decide | Claude picks. | |

**User's choice:** Hidden when empty

---

| Option | Description | Selected |
|--------|-------------|----------|
| Ascending by startDate (soonest first) | Most relevant habit first. Matches ROADMAP spec "sorted by startDate". | ✓ |
| By wave, then startDate within wave | More structured grouping. | |

**User's choice:** Ascending by startDate

---

| Option | Description | Selected |
|--------|-------------|----------|
| "Upcoming" | Short, matches requirements terminology. | ✓ |
| "Scheduled habits" | More explicit about status. | |
| "Starting soon" | Friendlier but less precise. | |

**User's choice:** "Upcoming"

---

## Catalog split implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page: active list + Upcoming section below | Everything on one scroll, Upcoming section hidden when empty, no new nav pattern. | ✓ |
| Tabs: Active \| Upcoming | Clean separation, new nav pattern not present elsewhere. | |

**User's choice:** Single-page layout
**Notes:** User asked which generates best UX. Claude explained single-page wins because the Upcoming pool shrinks over the year as waves activate, making both lists simultaneously large an unlikely state. User confirmed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit filter: status !== 'scheduled' | Active list filter is explicit in code; CAT-02 compliance unambiguous. | ✓ |
| Yes, but let archived stay in the active list too | Active/mastered/archived (everything except scheduled). | |

**User's choice:** Explicit filter excluding scheduled from active list

---

| Option | Description | Selected |
|--------|-------------|----------|
| New builder in catalog/builders.js: buildUpcomingListItem() | Consistent with existing buildHabitListItem(), buildCatalogHeader(). | ✓ |
| Inline HTML construction in catalog.js | Less indirection, mixes construction into orchestration. | |

**User's choice:** New `buildUpcomingListItem()` in `catalog/builders.js`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate element: `<ul class="catalog-upcoming-list">` | Independent CSS targeting, easier to style differently. | ✓ |
| Reuse `<ul class="catalog-habit-list">` | One consistent list style. | |

**User's choice:** Separate `catalog-upcoming-list` CSS class

---

## Claude's Discretion

None — user made explicit choices for all decisions.

## Deferred Ideas

None — discussion stayed within phase scope.
