# Phase 9: Desktop Waveboard - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 adds a **Wave Planning section** to the existing desktop Waveboard panel. The existing 12-week S1 heat-map stays intact below; a new planning-level section is inserted above it. The Wave Planning section shows: per-wave startDate, active/scheduled counts, a wave health indicator, and collapsible per-habit lists (name + status + stage + cadence) with a Promote action for scheduled habits.

**Requirements covered:** WAVE-01, WAVE-02, WAVE-03, WAVE-04

</domain>

<decisions>
## Implementation Decisions

### View Structure
- **D-01:** The Waveboard panel has two sections: **Wave Planning at the top**, existing 12-week S1 heat-map below. User sees the planning overview first, then scrolls down to the heat-map.
- **D-02:** The Wave Planning section is a separate DOM element from the heat-map container. Not a table — the wave rows are a custom layout (e.g., accordion/card list).

### Wave Row Header
- **D-03:** Each wave row header shows: **wave name + startDate (ISO YYYY-MM-DD) + counts ("N active · N scheduled") + a health badge**. Example: "Wave 5 — Focus & deep work | 2026-06-15 | 3 active · 2 scheduled [Watch]".
- **D-04:** Wave `startDate` comes from **`getAllWaves()` in `js/domain/wave.js`** (already called at boot in `desktop.js`). Wave data is available from `seed/waves.json` which has `startDate` for all 10 waves.
- **D-05:** Wave **health badge** = worst S1 status across active habits in that wave, for the **current ISO week**. Uses existing `worstStatus()` helper from `waveboard.js`. Format: colored text badge reusing the `waveboard-cell--{slug}` CSS modifier slugs (healthy/watch/atrisk/failing).
- **D-06:** For waves with **zero active habits** (all habits are scheduled, or wave hasn't started), show an **"Upcoming" label badge** instead of a health badge. Neutral/gray styling.

### Habit List (Expand/Collapse)
- **D-07:** Habit list is **collapsible per wave, collapsed by default**. A chevron icon (▶/▼) on the wave header indicates state.
- **D-08:** **Entire wave header row is clickable** to toggle expand/collapse. The Promote button (on scheduled habits inside the expanded list) is inside the list, not in the header row — no accidental toggle conflict.
- **D-09:** Habit rows inside an expanded wave show: **name + status label + stage + cadence summary**.
- **D-10:** Within an expanded wave, habits are **grouped**: active/mastered habits listed first, then a "Scheduled" sub-header, then scheduled habits with their individual startDate (ISO). Mirrors the Phase 8 Catalog Upcoming section pattern.
- **D-11:** **Archived habits are not shown** in the Wave Planning section. The heat-map below has its own "Show archived" toggle.

### Promote Action
- **D-12:** Scheduled habits in the Wave Planning section **include a "Promote to active" button** — reusing the existing `promoteHabit.js` apply handler from Phase 8.
- **D-13:** Promote is a **direct action — no confirmation dialog**. Consistent with Phase 8 Catalog promote and the established Archive/Restore pattern.
- **D-14:** After promoting, the **Wave Planning section re-renders immediately**: promoted habit moves from the "Scheduled" sub-group to the active list, counts update. Uses the existing `BroadcastChannel` `{type: 'habit:put', habitId}` pattern — the section subscribes to store updates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` §"Phase 9: Desktop Waveboard" — goal, success criteria (WAVE-01 through WAVE-04)
- `.planning/REQUIREMENTS.md` — WAVE-01, WAVE-02, WAVE-03, WAVE-04 full requirement text

### Phase 8 foundation (what Phase 9 builds on)
- `.planning/phases/08-today-catalog-upcoming-section/08-CONTEXT.md` — Phase 8 decisions including promoteHabit.js handler, Upcoming section pattern, BroadcastChannel sync

### Existing waveboard code (will be extended)
- `js/views/desktop/waveboard.js` — existing heat-map implementation; `worstStatus()`, `statusSlug()`, `last12Weeks()`, `mountWaveboard()` are all reusable. Wave Planning section is added above `waveboardContainer`.

### Wave data source
- `seed/waves.json` — wave catalog with `number`, `name`, `startDate`, `theme` for all 10 waves (Wave 0 – Wave 9)
- `js/domain/wave.js` — `getAllWaves()` returns the in-memory wave catalog loaded at boot. Use this to get wave `startDate`.

### Promote action (already built in Phase 8)
- `js/state/apply/promoteHabit.js` — existing handler; writes `status: 'active'` to IDB; emits `{type: 'habit:put', habitId}` on BroadcastChannel `'habits'`

### CSS patterns to reuse
- `css/tokens.css` — CSS custom properties for palette, spacing, radii
- `waveboard-cell--{healthy|watch|atrisk|failing}` CSS modifier classes — reuse for health badge styling

### Desktop shell wiring
- `js/desktop.js` — P2 boot block where `configureXxx()` calls live; `mountWaveboard()` wiring at `#waveboard` route

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/views/desktop/waveboard.js` `worstStatus(s1, s2)` — worst S1 status aggregator; reuse for wave health
- `js/views/desktop/waveboard.js` `statusSlug(status)` — maps S1 status string to CSS slug; reuse for health badge class
- `js/views/desktop/waveboard.js` `last12Weeks(today)` + `isoWeekKey(date)` — week utilities; needed to identify "current week" snapshots for health badge
- `js/domain/wave.js` `getAllWaves()` — returns `[{number, name, startDate, theme}]`; call directly in the Wave Planning section builder
- `js/state/store.js` `getCachedHabits()` — returns all habits; filter by `h.wave`, `h.status` to compute counts per wave
- `js/state/apply/promoteHabit.js` — existing promote handler; reuse without modification
- `js/util/mount.js` `mount(desc, container)` — DOM builder from pure description objects (D-26 pattern); use for Wave Planning section too

### Established Patterns
- **Builder pattern (D-26 / Pattern S8):** Pure builder functions produce description objects; `mount()` writes to DOM. Wave Planning section should follow the same pattern: `buildWavePlanningSection(waves, habits, snapshots)` → description tree → `mount()`.
- **D-78:** No `.innerHTML` anywhere. DOM construction through `mount()` or explicit `createElement`.
- **JSDoc file headers (D-27):** New files start with `/** @file <one-line summary>. <rationale + D-XX cross-refs> */`.
- **DI pattern:** `configureXxx({repo, channel})` called in `desktop.js` P2 boot block. If the Wave Planning section needs a configure call, add it there.
- **BroadcastChannel reactivity:** `store.subscribe(fn)` triggers re-render after any `apply()` write. The Wave Planning section should subscribe to `store.subscribe` for live updates on promote.

### Integration Points
- `mountWaveboard(parent, {repo, store})` in `waveboard.js` — Wave Planning section is added inside this function, before the existing `waveboardContainer` creation, OR extracted into a separate `mountWavePlanning(parent, {repo, store})` function called from `desktop.js` before `mountWaveboard`.
- `js/desktop.js` `#waveboard` route handler — mounts the waveboard panel; if Wave Planning is a separate mount function, add the call here.
- `repo.getSnapshotsInRange(startDate, endDate)` — needed to fetch current-week score_snapshots for the health badge. Already called in `mountWaveboard`'s `refresh()`.

</code_context>

<specifics>
## Specific Ideas

- Wave header row layout: `[▶] Wave N — Theme | startDate | N active · N scheduled [Health Badge]`. Clicking the row (or the chevron) toggles the habit list below.
- Health badge styling: reuse `.waveboard-cell--{slug}` classes (or a `.waveboard-badge--{slug}` variant) to get consistent color semantics with the heat-map.
- "Upcoming" badge for future waves: `.waveboard-badge--upcoming` (neutral gray).
- Habit sub-rows: active/mastered first in a plain list, then `<h4 class="waveplanning-scheduled-heading">Scheduled</h4>`, then scheduled habits each showing: name, startDate (ISO), Promote button.
- Cadence display for habit rows: a compact summary like "Daily", "Mon/Wed/Fri", "Every 2 days" — derive from the habit's `cadence` field using the existing cadence model.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-Desktop Waveboard*
*Context gathered: 2026-08-25*
