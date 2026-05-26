# Phase 2: Storage Foundation (The Spine) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 2-Storage Foundation (The Spine)
**Areas discussed:** Internal namespace, Seed scope, apply() event surface, Test + CI surface, Polish/English language flip (mid-discussion pivot), events PK shape, Undo P2 vs P3, Reset-data button wiring, First-run settings defaults, Dev server (scripts/serve.js), Test invocation (npm vs node --test)

---

## Internal namespace (nawyki vs habits)

| Option | Description | Selected |
|--------|-------------|----------|
| Align to 'habits' | DB name 'habits', BroadcastChannel('habits'). Matches cache prefix (D-29), manifest name='Habits' (D-13), repo name. ARCHITECTURE.md + Phase 1 D-05 strings updated. One consistent identifier. | ✓ |
| Keep 'nawyki' for data namespaces | Honor original system brand. App chrome stays 'Habits', cache 'habits-', but data-layer uses 'nawyki'. Slight asymmetry. | |
| Hybrid: DB='habits', channel='nawyki' | Inconsistency without payoff. Flagged as worst-of-both. | |

**User's choice:** Align to 'habits' (Recommended)
**Notes:** Captured as D-30. ARCHITECTURE.md `BroadcastChannel('nawyki')` and Phase 1 D-05's dialog string both need a forward-edit during P2 planning.

---

## Seed scope for P2

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stub: 5-10 habits | 8-habit slice covering every cadence × log-shape. Full 65-habit curation deferred. Unblocks spine fast. | ✓ |
| Full ~65-habit curation in P2 | Hand-curate every habit from Nawyki v1.xlsx + Nawyki-fale.txt now. Higher time cost; risk seed work drags spine. | |
| Tiered: 5-10 in main plan, full 65 in dedicated follow-up plan in P2 | Both ship within P2 but separated. | |

**User's choice:** Minimal stub (Recommended)
**Notes:** Captured as D-31. Follow-up curation lands in a P2 follow-up plan OR P3 prep — exact timing planner's call.

### Stub shape follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Coverage-first | 8 habits, one of every shape (binary daily/weekly/everyN/dayOfWeek, numeric counter, anonymous slot-checklist, labeled slot-checklist). | ✓ |
| Real-but-thin: 8-10 actual habits from Fala 1+2 | Honors user data verbatim, may not exercise every shape. | |
| Synthetic placeholders | Bad UX, against project spirit. | |

**User's choice:** Coverage-first (Recommended)
**Notes:** Captured as D-32. Concrete name suggestions surfaced in CONTEXT.md `<specifics>` — final naming is planner's call.

### Seed idempotency follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Merge-by-id, never overwrite | Stable UUIDs; loader inserts only ids not already in IDB. Existing rows never touched. Enrichment-friendly. | ✓ |
| Load-once-ever, ignore future seed changes | meta.seedLoadedAt set once; subsequent boots ignore the file. Simpler but breaks the full-65 follow-up. | |
| Seed version key | Track seed file version in meta; re-merge on version bump. Tiny extra moving part. | |

**User's choice:** Merge-by-id (Recommended)
**Notes:** Captured as D-33. meta.seededIds optimization noted.

---

## apply() event surface in P2

| Option | Description | Selected |
|--------|-------------|----------|
| One round-trip: markCompleted + inverse | apply.js core + one event handler + inverse. Exercises every seam (broadcast, flush, persist, undo). P3 adds the rest. | ✓ |
| Both directions: mark + unmark | Smallest fully usable binary-toggle primitive. P3 inherits a complete flow. ~30 LOC more. | |
| Pure infrastructure: zero concrete events | apply.js / sync.js as machinery only. Cleanest separation but fragile. | |

**User's choice:** One round-trip (Recommended)
**Notes:** Captured as D-34.

---

## Polish→English language flip (mid-discussion pivot)

User raised mid-Area-3 — wants English habit names instead of Polish-from-xlsx verbatim. This reverses a previously-locked PROJECT.md / CLAUDE.md constraint.

### Scope of the flip

| Option | Description | Selected |
|--------|-------------|----------|
| Habit names only; keep 'Fala 0..9' | Less churn; preserves source-system identity. | |
| All user-facing strings English (habits + waves) | Waves rename 'Fala 0..9' → 'Wave 0..9'. Fully English app. | ✓ |
| Habit names English now; revisit wave labels later | Defer wave-label question to P4. | |

**User's choice:** All user-facing strings English (habits + waves)
**Notes:** Captured as D-35. PROJECT.md + CLAUDE.md need editing during P2.

### CSV setup post-flip

| Option | Description | Selected |
|--------|-------------|----------|
| Keep BOM + ; + CRLF | Robust to future diacritic-bearing user content + Polish Windows Excel double-click compat. | ✓ |
| Switch to ',' delimiter | Less locale-specific. Polish Excel double-click handling weaker. | |
| Defer to P5 | CSV is P5 anyway; re-decide later. | |

**User's choice:** Keep it (Recommended)
**Notes:** Captured as D-36. EXPORT-04/05 unchanged.

### Dual-name shape (Polish stored alongside English)

User raised follow-up: "maybe habit should have polish name also with english name. What do you think?"

| Option | Description | Selected |
|--------|-------------|----------|
| Primary name=EN, optional name_pl, no UI toggle in P2 | habits store gains nullable name_pl. Seed sets both. Every UI render uses 'name'. Data-only in P2; future phases surface it. | (chose Other, then narrowed) |
| Primary name=EN, optional name_pl, show inline 'name (name_pl)' on Today + Catalog | Always-visible inline. May add noise. | |
| Aliases array (more general) | habits.aliases: string[]. Overengineered. | |
| Skip dual-storage; English-only | Drop Polish entirely. | |

**User's choice (free-text):** "I looking something that store polish name so when I dont remember what english name means I can quickly check that"
**Notes:** Reflected back: data shape lands in P2 (`name_pl` optional field), quick-check surface design lands in P3 UI-SPEC. User confirmed.

### Confirmation of P2/P3 split

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — store in P2, design surface in P3 | habits.name_pl nullable. Seed populates it. P3 owns the surface design (recommendation: muted secondary line on Today). | ✓ |
| Yes, plus pre-commit to a specific surface now | Lock the affordance now. Risk: pre-deciding UI before designing Today. | |
| Change mind — skip name_pl entirely | Revert. | |

**User's choice:** Yes — store in P2, design surface in P3 (Recommended)
**Notes:** Captured as D-40.

---

## Test + CI surface

| Option | Description | Selected |
|--------|-------------|----------|
| Full spine: date + idb + schema + repo + apply + sync | Every spine module tests-first. Highest confidence. | ✓ |
| Pure logic only: date + apply event handlers | idb/repo/schema via tests-browser.html manual only. | |
| Full + integration end-to-end | Above + a golden-path test exercising every seam. Highest cost. | |

**User's choice:** Full spine (Recommended)
**Notes:** Captured as D-37. Also includes lifecycle.js and seed.js. tdd_mode=true is active.

### CI timing follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Land in P2 plan 1 | First plan ships ci.yml + placeholder passing test. Green-CI gate from day one. | ✓ |
| Land at end of P2 | Build tests first, add CI once they're green locally. | |
| Defer CI to P3 | Honor-system TDD for all of P2. | |

**User's choice:** Land in P2 plan 1 (Recommended)
**Notes:** Captured as D-38.

### score_snapshots store follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Declare in v1 schema now | Empty until P6. Honors Pitfall 10 "migrations only add". Locks shape early. | ✓ |
| Defer to a P6 migration (v1 → v2) | Tight v1 schema; real migration code at P6. | |
| Declare with intentionally-loose shape | Worst of both worlds. | |

**User's choice:** Declare in v1 schema now (Recommended)
**Notes:** Captured as D-39. Risk noted: if P6 needs a different shape, v2 migration ships then.

---

## events store PK shape

| Option | Description | Selected |
|--------|-------------|----------|
| UUID | Consistent with all other entities. Cross-device import-safe. | ✓ |
| Autoincrement integer | ARCHITECTURE.md's original sketch. Tiny rows but renumbers on cross-device import. | |
| Composite: { at, uuid } | Hybrid. Overengineered vs UUID + index on 'at'. | |

**User's choice:** UUID (Recommended)
**Notes:** Captured as D-42. ARCHITECTURE.md sketch needs forward-edit.

---

## Undo infrastructure in P2 vs P3

| Option | Description | Selected |
|--------|-------------|----------|
| Full undo seam: inverse + undoToken + undo() | Tested round-trip in P2; P3 just wires the button. | ✓ |
| Inverse payload only, defer undo() to P3 | Data structure proven; actual undo() in P3. Risk: P3 discovers wrong inverse shape. | |
| Nothing in P2; everything in P3 | apply.js without inverse writes. Retrofit pain. | |

**User's choice:** Full undo seam (Recommended)
**Notes:** Captured as D-43. UNDO-02 (survives reload) fully demonstrable in P2 even without UI.

---

## Reset-data button wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Wire in diagnostics now, move to Settings in P3 | P2 wires the existing button functionally. P3 mirrors to Settings. | ✓ |
| Wire in P2, keep in diagnostics permanently | "Destructive ops are debug-only" stance. But SETTINGS-07 explicitly requires it in Settings. | |
| Wait for P3 Settings, leave diagnostics stub disabled | Updated tooltip; all work lands in P3. | |

**User's choice:** Wire in diagnostics now, move to Settings in P3 (Recommended)
**Notes:** Captured as D-44. D-06 verbatim confirm phrasing preserved.

---

## First-run defaults in settings store

| Option | Description | Selected |
|--------|-------------|----------|
| Mastery defaults only | settings.defaultThreshold=0.9, defaultWindowDays=70, schemaVersion=1. Other settings on demand. | ✓ |
| Everything we know we'll need eventually | scoringModel, theme, lastBackupAt also seeded. Dead data until features ship. | |
| Nothing in P2; settings stay empty | Each feature writes its own defaults. Boilerplate. | |

**User's choice:** Mastery defaults only (Recommended)
**Notes:** Captured as D-45.

---

## Persistence prompt timing

| Option | Description | Selected |
|--------|-------------|----------|
| On seed-load write, first launch ever | Prompt appears immediately. Defends iOS ITP from minute one. | ✓ |
| On first user-triggered mutation (first tap) | User has skin in the game. Data unprotected until then. | |
| On install (appinstalled event) only | Most defensive prompt timing, least defensive data. | |

**User's choice:** On seed-load write (Recommended)
**Notes:** Captured as D-41.

---

## Dev server (`scripts/serve.js`)

User raised: "could we create scripts/serve.js like in ../sleep-tracker? So I will run js only, not some npx serve command."

Inspected `../sleep-tracker/scripts/serve.js` — ~58 lines of vanilla `node:http` + `node:fs` + `node:path`, zero deps.

**User's request:** Lift the pattern into Habits.
**Captured as:** D-46. Replaces `python -m http.server` line in README. Outside `js/`, `tests/`, and SW SHELL list.

---

## Test invocation (npm vs node --test)

User raised: "in sleep-tracker is some tests concept, run as npm test. Will we do the same or something else in future?"

Inspected sleep-tracker's `package.json` — uses `npm test` because Playwright requires npm. Habits' locked decisions D-23..D-26 + PROJECT.md no-npm constraint explicitly forbid this path.

User then asked: "Why you recommended 1 here and in sleep tracker we go to different direction?"

Honest answer surfaced: the two projects have different locked constraints. Sleep-tracker accepted the longevity tax for browser automation (Playwright); Habits explicitly chose zero-dependency longevity mirroring `mindful-breathing`. Recommendation aligned with what user previously locked, but explicitly offered the option to revise.

| Option | Description | Selected |
|--------|-------------|----------|
| Stay strict: node --test tests/ | Zero package.json. CI runs node --test directly. tests-browser.html for browser smoke. | ✓ |
| Minimal package.json, scripts only, NO deps | `npm test` ergonomics with no actual deps. Slippery slope. | |
| Full sleep-tracker pattern (package.json + Playwright) | Soften D-26 + PROJECT.md. Adds automated browser e2e. Big philosophy shift. | |

**User's choice:** Stay strict (Recommended)
**Notes:** Captured as D-47. Sleep-tracker divergence is intentional; PROJECT.md no-npm stands.

---

## Claude's Discretion

The user explicitly left these to planner / Claude judgment (captured in CONTEXT.md `<decisions>` "Claude's Discretion"):

- `apply.js` sub-module directory layout (`apply/markCompleted.js` vs registry vs handlers/ subdir)
- `id.js` shape (recommendation: thin wrapper, no file:// fallback needed in 2026 browsers)
- Hydration window scope on boot (moot in P2 with no view)
- Cross-tab sync message envelope finalization (field names, origin generation)
- P2 plan breakdown — count and boundaries (one big plan vs ~6 smaller plans)

## Deferred Ideas

(Mirrors CONTEXT.md `<deferred>` for audit completeness)

- Quick-check surface design for `name_pl` (P3 UI-SPEC)
- Optional Settings toggle "Show Polish names" (v1 unscoped; data is there)
- Wave label data model (P4)
- Full ~65-habit seed curation (P2 follow-up plan or P3 prep)
- Hydration window scope (P3 when Today exists)
- Additional `apply.js` event handlers — markUncompleted, numeric counters, slot-checklist (P3+P4)
- Toast / button UI for undo (P3)
- Migration of Reset-data button to Settings panel (P3 per D-44)
- Non-mastery settings defaults (their feature phases)
- Playwright / automated browser e2e (explicitly rejected per D-47)
