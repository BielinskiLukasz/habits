# Phase 1: PWA Shell & Tooling Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 1-PWA Shell & Tooling Hygiene
**Areas discussed:** Phase-1 visible UI, SW update propagation UX, Manifest visuals & icon

---

## Areas Offered

| Option | Description | Selected |
|--------|-------------|----------|
| Reset-app surface & trigger | Where the hidden debug action lives in P1 (no Settings exists). URL hash / query param / visible button / keyboard chord. | |
| SW update propagation UX | When new sw.js activates: silent / toast / auto-reload. | ✓ |
| Phase-1 visible UI | What index.html shows in P1 before P3 ships the Today view. | ✓ |
| Manifest visuals & icon | name, short_name, theme/background color, icon source. | ✓ |

User skipped "Reset-app surface" — captured by default as part of the diagnostics panel (Reset shell button on the panel, two-button reset semantics).

---

## Phase-1 visible UI

### Question 1: What does index.html actually show?

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnostics page | Single 'Nawyki — chassis' page with SW state, cache version, install state, persistence status, app + schema version, Reset button. | |
| Minimal splash | 'Nawyki — initializing…' on a styled blank page (mindful-breathing-like). Reset on a hidden URL. | |
| Empty shell scaffold | Render the eventual mobile Today layout (header with date / wave placeholder, empty habit list, footer nav stub). Diagnostics behind query param or long-press. | ✓ |

**User's choice:** Empty shell scaffold.
**Notes:** Lets P1 demonstrate the visual chrome that P3 fills in with data. Smoke-test surface still exists (behind the diagnostics trigger).

### Question 2: How do you reach the diagnostics + reset panel?

| Option | Description | Selected |
|--------|-------------|----------|
| ?debug=1 query param | Bookmarkable; no visible affordance. | |
| Long-press app title | Press-and-hold 'Habits' for ~1.5s. Discoverable to author only. | |
| Both: param + long-press | Belt-and-suspenders. ~10 extra lines. | ✓ |
| Hash route #debug | Cleaner with hash router, but router doesn't exist in P1. | |

**User's choice:** Both: param + long-press.
**Notes:** Query param for desktop devtools workflows; long-press for the installed phone.

### Question 3: Reset scope when IDB ships in P2

| Option | Description | Selected |
|--------|-------------|----------|
| Reset wipes everything | One button = nuke from orbit. SW + caches + IDB + reload. Single confirmation. | |
| Two buttons | 'Reset shell' (SW + caches) and 'Reset data' (IDB only). Separate concerns, separate confirmations. | ✓ |
| Reset = nuclear + Settings has separate Recompute | Reset is always nuclear; granular debug actions live elsewhere as their phases ship. | |

**User's choice:** Two buttons.
**Notes:** Phase 1 wires only "Reset shell" (SW + caches). "Reset data" placeholder ships now; wiring lands in P2.

---

## SW update propagation UX

### Question 1: When new sw.js activates, what does an open tab do?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent swap (mindful-breathing style) | New SW takes over; next manual reload picks up new assets. No banner. | |
| Toast 'Updated — Reload' | On controllerchange, show small toast with Reload button. User decides when. Mid-tap-streak protection. ~30 extra lines. | ✓ |
| Auto-reload on activate | Force location.reload() on controllerchange. Always fresh, but loses in-flight UI state. | |
| Manual 'Check for update' only | No automatic skipWaiting. New SW waits in 'installing'; user clicks 'Check for update'. | |

**User's choice:** Toast 'Updated — Reload'.
**Notes:** Non-blocking; the user can keep tapping the current page until they reload. Toast primitive will later host Undo notifications too.

### Question 2: When does nawyki-X.Y.Z actually bump?

| Option | Description | Selected |
|--------|-------------|----------|
| Bump every release | Every commit/tag bumps the constant. Simple, predictable. Cost: must remember. | |
| Bump only when shell assets change | Bump when HTML / CSS / sw.js / icon / manifest changes. Skip bumps for JS module-only changes. | ✓ |
| Tie to a single APP_VERSION constant | One APP_VERSION shared by sw.js + diagnostics + manifest. Derive cache name from it. | |

**User's choice:** Bump only when shell assets change.
**Notes:** JS modules become runtime-cached, not precached. Triggers a downstream decision: SW must use stale-while-revalidate (or network-first with cache fallback) for JS module requests so module-only changes propagate within one reload without breaking NFR-04 (fully offline). Researcher to validate the exact pattern; planner picks. Implicitly the APP_VERSION constant (third option's mechanic) is still adopted — the diagnostics panel and sw.js share a single version source, just bumped on the user's chosen trigger rather than every release.

---

## Manifest visuals & icon

### Question 1: App name and short_name

| Option | Description | Selected |
|--------|-------------|----------|
| Polish: 'Nawyki' | Matches existing system name and Polish habit content. | |
| Bilingual: 'Nawyki — Habits' | Long form bilingual; tile shows 'Nawyki'. | |
| English: 'Habits' | UI chrome is English per PROJECT.md; manifest belongs to the chrome. | ✓ |
| Polish full, English short | name: 'Nawyki (habit tracker)', short_name: 'Nawyki'. Hybrid. | |

**User's choice:** English: 'Habits'.
**Notes:** Consistent with PROJECT.md constraint that UI chrome is English. Habit names inside the app stay Polish (user content).

### Question 2: Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror mindful-breathing | #111111 / #34d399 (emerald). Visual continuity. | |
| Dark with a warm accent | #0f0f10 / #f5a623 (amber). Habit-tracker vibes; different identity from mindful-breathing. | ✓ |
| Light, paper-like | #fafaf7 / #2b6cb0 (deep blue). Notebook/journal aesthetic. | |
| Defer to UI phase | Placeholder neutrals (#111 / #888) for P1; real palette in P3 UI-SPEC. | |

**User's choice:** Dark with a warm accent (#0f0f10 / #f5a623).
**Notes:** Same dark-with-accent visual language as mindful-breathing but a deliberate identity divergence (emerald → amber).

### Question 3: Icon source

| Option | Description | Selected |
|--------|-------------|----------|
| Letter mark 'H' | Hand-write SVG: amber 'H' on dark. Fast, recognizable, maskable-safe. | |
| Checkmark glyph | Amber checkmark on dark square. Semantically on-brand (marking things done). | |
| Wave / Fala shape | Amber sine-wave or ascending bars — nods to the wave model. | |
| Placeholder, redo in UI phase | Ship a 30-second amber dot on dark square; replace in P3 UI design phase. | ✓ |

**User's choice:** Placeholder, redo in UI phase.
**Notes:** Avoids over-investing in P1 plumbing. Real icon design lands in P3 alongside the Today view UI-SPEC.

---

## Claude's Discretion

- CSS token list and the full Cascade Layers composer (D-decisions instantiate the minimum; rich tokens arrive with P3 UI-SPEC).
- Toast primitive's exact skeleton (`<div class="toast" role="status">` is implied but planner picks the file location).
- `APP_VERSION` file location (`js/util/version.js` is the suggested default).
- Diagnostics panel visual layout (contents are pinned; vertical key/value list is the default).
- HTTPS deploy target sub-path (relative paths work under any sub-path; planner confirms during planning).

## Deferred Ideas

- Real icon design (deferred to P3 UI phase).
- Reset-app surface as its own discussion area (default placement adopted; revisit during planning if a cleaner option emerges).
- Install panel content for iOS / Android / desktop (assigned to PWA-07 / Phase 3).
- `navigator.storage.persist()` call (P2 trigger; P1 renders "Persistence: n/a (P2)").
- Toast auto-dismiss / styling refinements (lives with the Undo phase).
- `desktop.html` analytics view (P6).
- Cache-busting query strings on JS imports as an alternative to D-11's stale-while-revalidate (researcher evaluates).
