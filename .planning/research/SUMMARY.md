# Project Research Summary

**Project:** Nawyki (Habits) — personal multi-year habit tracker PWA
**Domain:** Personal, offline-first habit tracker (single-user, multi-year)
**Researched:** 2026-05-26
**Confidence:** HIGH

---

## TL;DR

A vanilla multi-file static PWA (`index.html` + `desktop.html`, no framework, no build) backed by raw IndexedDB through an ~80-line hand-written wrapper, organized as `db -> state(apply+store+undo) -> router -> views`, with scoring persisted as snapshots and history protected by versioned habit definitions. Mobile is a single-tap Today check-in; desktop is a wave-board / analytics surface. Two v1-gating decisions remain: **(1)** the user must pick a scoring model (S1 Rolling Threshold Health / S2 Day-Weighted Wave Score / S3 Load-Adjusted Capacity Score), and **(2)** STACK.md and PITFALLS.md disagree on the CSV delimiter — `,` (locked in STACK.md) vs `;` (recommended in PITFALLS.md for Polish Windows Excel). Everything else is HIGH-confidence and the build-order spine is ready to roadmap.

---

## Stack at a Glance (Locked)

- **Shell:** Plain HTML5, **two top-level shells** — `index.html` (mobile, Today) + `desktop.html` (desktop, Analytics). Not responsive; deliberately different DOMs.
- **JS:** ES2023 native modules with `./` relative imports. No bundler. No npm. No CDN.
- **Storage:** Raw IndexedDB + hand-written ~80-line promise wrapper (`db/idb.js`). **No** `idb-keyval`, **no** `idb`, **no** Dexie.
- **Persistence trigger:** `visibilitychange -> hidden` (NOT `beforeunload`).
- **Cross-tab sync:** `BroadcastChannel('nawyki')`.
- **PWA:** `manifest.json` + `sw.js` registered with silent `.catch()` guarded by `location.protocol.startsWith('http')` so `file://` still works.
- **SW strategy:** Cache-first, versioned cache name (`habits-X.Y.Z`), `skipWaiting()` + `clients.claim()`.
- **CSS:** Cascade Layers (`@layer reset, tokens, base, layout, components, view, utilities;`) + Custom Properties + `@import url(...) layer(...)`. No preprocessor.
- **Scoring storage:** Persisted in a dedicated `score_snapshots` IDB store (write-time recompute via `state/apply.js`, never on-render).
- **Export — JSON:** Full-fidelity backup of every IDB store; `Blob` + anchor download.
- **Export — CSV:** **One** wide habit × day matrix; cells `1` / `0` / `x` (applicable+done / applicable+missed / not-applicable). BOM-prefixed UTF-8, CRLF.
- **Import — JSON only, merge-by-id semantics** (overwrite-on-collision, never delete local-only records). CSV is read-only.
- **What we will NOT use:** React/Vue/Svelte/Lit/Alpine/htmx; webpack/Vite/esbuild/Rollup; npm/pnpm/yarn; any CDN; Tailwind/Sass/PostCSS; Dexie/idb-keyval/idb; File System Access API; Notifications/Push (v1); `localStorage` for habit data; `Date.toISOString()` for date keys.

---

## Feature Ladder

### Table Stakes (v1 must ship — 8)

| # | Feature | Surface |
|---|---------|---------|
| T1 | Today view (single-tap mark complete) | Mobile |
| T2 | Habit catalog CRUD | Desktop |
| T3 | Cadence engine (daily / DOW / every-N-days) | Both |
| T4 | History view + edit prior days | Both |
| T5 | Offline PWA (installable, works offline) | Mobile |
| T6 | IndexedDB + JSON export/import | Both |
| T7 | Stages (etap 1 -> 2 -> 3 with progressive targets) | Both |
| T8 | Multi-occurrence logging (numeric +1 AND slot-checklist) | Mobile |

### Differentiators (anti-Habitica, anti-Streaks posture — 7)

| # | Feature | Why it matters |
|---|---------|----------------|
| D1 | **Wave/Fala model** + wave aggregates | Honors 47-week wave plan; no competitor has this |
| D2 | **Mastery without hiding** (90% / 70d, configurable + per-habit override; mastered = muted, not archived) | The "keep feeding mastered habits" third path |
| D3 | **Multi-trigger stage advancement** (manual / scheduled-by-week / after-N-days, composable per-habit) | Mirrors real diversity of the existing system |
| D4 | **Definition edits don't rewrite history** (versioned defs; logs reference `definitionVersion`) | Data-trust foundation |
| D5 | **Two-surface design** (mobile check-in vs desktop analytics — distinct DOMs, not responsive) | Two jobs, two layouts |
| D6 | Per-habit edit history + global single-step undo | Recoverability without "are-you-sure" friction |
| D7 | CSV export (flattened, Excel-pasteable) alongside JSON | User actually does ad-hoc Excel analysis |

### Anti-Features (deliberately NOT built — 15)

Most important to call out: **A1 reminders/push**, **A2 cloud sync / multi-device**, **A4 streak-as-primary-metric**, **A5 gamification (XP/levels/avatars)**, **A6 punishment-for-missing**, **A11 direct port of xlsx `WYNIK SKORYGOWANY`**, **A9 any framework/bundler/npm**, **A12 telemetry**. Anti-A (streak shaming) and Anti-B (reminder/gamification creep) are locked by PROJECT.md.

---

## Scoring Decision (CRITICAL — v1-gating)

The xlsx `WYNIK SKORYGOWANY` formula is explicitly NOT being ported. FEATURES.md proposes three deliberately distinct alternatives. **The user must pick one during requirements before the roadmap can commit.**

| Option | Question Answered | Complexity | Risk | Best If User Wants... |
|--------|-------------------|------------|------|-----------------------|
| **S1 — Rolling Threshold Health** (status-oriented) | "Which habits are healthy / watch / at-risk / failing?" | S | Low | Clarity; close match to existing xlsx mental model; cleanest extension of the 90%/70d threshold model |
| **S2 — Day-Weighted Wave Score** (momentum-oriented) | "How am I doing this week / this month? Which waves are slipping?" | M | Med | Momentum dashboard; weekly-review-friendly numbers; native wave-level rollup with stage weighting |
| **S3 — Load-Adjusted Capacity Score** (sustainability-oriented) | "Am I overcommitted? Which habits should I drop, master-and-mute, or postpone?" | L | Med-High | The score itself to reflect the wave system's load-staggering intent; mastered habits earn graduation credit |

**Researcher's leaning (not a verdict):** S1 for v1, with hooks to layer S2 on top in v1.x. Lowest risk; fully consistent with the threshold model already in PROJECT.md; lets the user see real data before deciding whether momentum decay (S2) or load awareness (S3) is wanted.

**Shared design constraints (any pick must honor):**
- Cadence-aware denominator (skips that aren't scheduled days don't count).
- New habits in a grace period (first 7 days don't count toward rolling stats).
- Mastered habits weighted but not dominant (e.g. 0.3x) so they neither distort nor disappear.
- Never collapse "today adherence" and "rolling-window adherence" into one ambiguous number.
- No red/danger colors for sub-100%.

---

## Architecture Spine (Phase 1 Build Order)

This is the hard-dependency chain from ARCHITECTURE.md. Each arrow is a real unlock; no step can be skipped without forcing a later rip-out.

```
date -> idb -> schema -> repo -> seed -> store/apply -> sync -> lifecycle -> SW -> router -> today view -> ship
```

**What Phase 1 ships:** the *thinnest possible* Today view rendering seed data, mark/unmark with undo, against a fully wired spine (PWA, BroadcastChannel, visibilitychange flush, hash router, seven-store IDB schema with migration dispatch table).

**What Phase 1 does NOT ship:** cadence engine, stages, threshold/mastery, wave aggregates, history navigation, edit history, exports, desktop shell, analytics, scoring.

**Seven IDB stores** (reconciling ARCHITECTURE.md's 6 + STACK.md's `score_snapshots`):

| Store | Key | Indexes | Purpose |
|---|---|---|---|
| `habits` | `id` (UUID) | `wave`, `status` | Current habit definitions |
| `habit_versions` | `[habitId, effectiveFrom]` | `habitId` | Snapshot history of definitions — never deleted |
| `logs` | `[habitId, date]` | `date`, `habitId` | Daily completion ledger; each row carries `definitionVersion` |
| `events` | autoincrement | `at`, `type`, `habitId` | Append-only journal; powers undo + per-habit history |
| `settings` | `key` | — | User-facing config (round-trips in export) |
| `meta` | `key` | — | Housekeeping (`undoToken`, `seedLoadedAt`) — NOT exported |
| `score_snapshots` | `[habitId, date]` | `date`, `habitId` | Precomputed per-day scoring outputs (write-time, never on-read) |

**State pattern:** Snapshot-of-definitions + append-only event log + materialized in-memory cache. **Single mutator chokepoint:** `state/apply.js`. Views never touch `db/repo.js` directly.

**Routing:** Hash router (`#today`, `#history/:date`, `#habit/:id`, `#catalog`, `#analytics`, `#wave/:n`, `#settings`). Hash chosen over History API for GitHub Pages + `file://` compatibility.

---

## Top Pitfalls (Catastrophic)

The full inventory in PITFALLS.md covers 12 pitfalls + 2 anti-patterns + 8 UX traps. The three catastrophic-severity items the roadmap must structurally defend against:

### 1. IndexedDB Data Loss / Safari 7-Day Eviction (Pitfall 1)
**Why catastrophic:** Multi-year personal data, irreplaceable, no cloud backup. Safari evicts IDB after 7 days of no interaction; Chromium evicts under pressure; non-installed PWAs go first.
**Prevention:** Call `navigator.storage.persist()` on first write; surface "Persistent: yes/no" in Settings; "Last backup: N days ago" banner; weekly JSON-export nag via `lastBackupAt`; document iOS 7-day rule in About panel.
**Phase mapping:** P2 (Storage) defines `persist()` call -> P3 (Settings) surfaces status -> P5 (Export) ties backup nag to `lastBackupAt`.

### 2. Habit-Definition Edits Corrupt Prior Logs (Pitfall 3)
**Why catastrophic:** Data-trust is the product's foundation. Naive in-place edits retroactively turn completed days into failures (or vice versa).
**Prevention:** Versioned habit definitions (`habit_versions` store); each log row stores `definitionVersion`; threshold math evaluates each day against the version live that day; editing creates a new version, never UPDATE in place (except cosmetic).
**Phase mapping:** **P2 (Schema design) — non-negotiable foundation.** Verified in P4 (Catalog edits) acceptance tests.

### 3. Daily Check-in UX Friction (Pitfall 6)
**Why catastrophic:** Friction-free daily check-in is *literally the core value* per PROJECT.md.
**Prevention:** Today renders synchronously from cached snapshot (no spinner-blocked first paint); single-tap toggles; no confirmation dialogs on happy path; 5-second Undo toast for mistakes; no welcome/onboarding wall; performance budget <300 ms cold open, <100 ms first-tap latency.
**Phase mapping:** **P3 (Today view) — primary acceptance gate.** Re-verified at every release.

### Honourable mentions also critical
- **Schema migration without tooling (Pitfall 10):** explicit `DB_VERSION` + `MIGRATIONS` dispatch table; additive-only; every JSON export embeds `schemaVersion`; pre-migration `backup_pre_v{N}` store kept for one release.
- **Bad scoring model (Pitfall 12):** see "Scoring Decision" above — gated by user pick before roadmap commits.

---

## Open Conflicts / Questions

These must be resolved during requirements before the roadmap freezes.

### CSV Delimiter: `,` (STACK.md) vs `;` (PITFALLS.md) — UNRESOLVED

The two research docs encode an explicit disagreement:

| Source | Recommendation | Rationale |
|--------|----------------|-----------|
| **STACK.md** ("Locked decisions") | **comma `,`** | "locale-portable; Excel on Polish Windows handles UTF-8 BOM CSVs with comma separator correctly when opened via Data -> From Text/CSV, or via Paste Special" |
| **PITFALLS.md** (Pitfall 11) | **semicolon `;`** | "Polish Windows Excel uses `;` (semicolon) as the default CSV delimiter, not `,`. Default `;` given user locale. Test the round-trip: export -> open in Polish Excel -> confirm diacritics render cleanly and columns align." |

Both agree on UTF-8 BOM + CRLF + quoting; the only disagreement is the field separator.

**Recommended resolution path for requirements:**
1. **Pragmatic default:** `;` (PITFALLS.md is correct that double-click open on Polish Windows Excel uses `;` and STACK.md's path requires the user to remember "Data -> From Text/CSV" every time, which is friction).
2. **Defensible alternative:** keep `,` but ship a Settings toggle `[ , ] [ ; ]` with `;` as default for `navigator.language === 'pl-*'`. Cheap to implement; future-proofs for non-Polish locales if ever needed.
3. **Empirical test:** export a 5-row sample with diacritics in *both* formats and open them by double-click in the user's actual Polish Windows Excel before locking the decision.

### Scoring Model: S1 vs S2 vs S3 — UNRESOLVED

See "Scoring Decision" section above. User must pick before P6 (Analytics) ships; roadmap can be drafted with the scoring step as a parameter.

### Minor inconsistencies reconciled in this summary

- **Store count:** ARCHITECTURE.md lists 6 stores, STACK.md adds `score_snapshots` as a 7th. -> **Reconciled as 7 stores total; `score_snapshots` is in v1.**
- **`scoreVersion` field:** STACK.md schema includes `scoreVersion` for opportunistic recomputation. ARCHITECTURE.md doesn't mention it because its scope is state pattern, not scoring storage. -> **Both compatible; carry forward `scoreVersion` from STACK.md.**
- **Undo persistence across reload:** ARCHITECTURE.md flags as MEDIUM-confidence; STACK.md doesn't address. -> **Default to in-memory undo + single-slot `meta.undoToken` per ARCHITECTURE.md; verify with user.**

---

## Implications for Roadmap

Based on the unlock chain in ARCHITECTURE.md and the dependency map in FEATURES.md, the roadmap should follow this phase shape. Phase IDs match the `P1`-`P6` labels used in PITFALLS.md's phase mapping.

### P0 — Requirements Resolution (pre-roadmap)
**Rationale:** Two v1-gating decisions block phase planning.
**Delivers:** Scoring model picked (S1/S2/S3); CSV delimiter resolved (`,` vs `;` with optional toggle).
**Output:** REQUIREMENTS.md.

### P1 — PWA Shell + Tooling Hygiene
**Rationale:** SW and manifest patterns must be right from the first deploy or stale-cache bricks become recoverable-but-painful.
**Delivers:** `manifest.json`, `sw.js` with versioned cache + skipWaiting + clients.claim, silent-fail registration, `icon.svg`, hidden "Reset app" debug button.
**Avoids:** Pitfall 2 (SW brick), Pitfall 7 (install ergonomics), Anti-Pattern B (no Notifications code).

### P2 — Storage Foundation (the spine, before any feature)
**Rationale:** Every catastrophic pitfall except check-in friction is prevented here. This is the longest, most schema-sensitive phase.
**Delivers:**
- `js/util/date.js` (local `YYYY-MM-DD`; DST + leap-day tested).
- `js/db/idb.js` (~80-line promise wrapper).
- `js/db/schema.js` (7 stores; `DB_VERSION` + `MIGRATIONS` dispatch table; additive-only).
- `js/db/repo.js` (typed per-store helpers).
- `js/state/{store, apply, selectors, undo}.js` — single mutator chokepoint.
- `js/platform/{sync, lifecycle, sw-register, feature}.js` — BroadcastChannel + visibilitychange flush wired into `apply.js`.
- `js/io/seed.js` (idempotent seed load).
- `js/router/router.js`.
- `navigator.storage.persist()` called on first write.

**Avoids:** Pitfalls 1, 3, 4, 5, 8, 10 (the entire data-integrity surface) + Anti-Pattern 3 (`Date.toISOString()`) + Anti-Pattern 4 (god `apply.js`).

### P3 — Today View + Settings
**Rationale:** The product's core-value job. Must hit <300 ms cold paint, single-tap, undo toast.
**Delivers:** Mobile `index.html` shell, `js/views/today.js`, `js/views/settings.js` (thresholds, export/import controls, persistence status, install help panel), basic single-step undo UI.
**Uses:** Spine from P2; cadence stub (full engine in P4).
**Avoids:** Pitfall 6 (check-in friction) — primary gate. Anti-Pattern A (no streak counters on Today).

### P4 — Cadence + Catalog + Mastery + History
**Rationale:** Bundle the domain-logic phase: cadence (T3), catalog CRUD (T2), threshold/mastery (D2), stages (T7), history navigation (T4), edit history (D6), versioned-edit invariant (D4).
**Delivers:** `domain/{cadence, stage, threshold, version, wave}.js`; `views/{history, habit-detail, catalog}.js`; multi-occurrence UI (numeric + slot-checklist).
**Verifies:** Pitfall 3 (edit a habit -> 3-month-old day still evaluates against old def); Pitfall 5 (rolling-window math unit-tested).

### P5 — Exports + Imports + Backup Nag
**Rationale:** Backup is the only real defense against catastrophic IDB loss (Pitfall 1). Ship before user accumulates real data.
**Delivers:** `io/{export-json, export-csv, import-json}.js`; `util/csv.js` (BOM + CRLF + quoting); `lastBackupAt` banner; weekly backup nag.
**Open:** CSV delimiter — settled in P0.
**Verifies:** Pitfall 11 (Polish Windows Excel round-trip on real device).

### P6 — Desktop Shell + Analytics + Scoring
**Rationale:** Scoring needs real multi-month data to validate; analytics needs the wide-screen real estate. Last because nothing else depends on it.
**Delivers:** `desktop.html` shell, `views/{analytics, wave-board}.js`, `domain/scoring.js` (per S1/S2/S3 pick from P0), `score_snapshots` write-time recompute wired into `apply.js`, wave aggregates, optional "wave at risk" surfacing.
**Verifies:** Pitfall 8 (multi-tab desktop+mobile concurrency), Pitfall 9 (performance at scale with synthetic 5-year dataset).

### Phase Ordering Rationale

- **P0 first** because two v1-gating decisions (scoring + CSV delimiter) cannot defer.
- **P1 before P2** because SW cache strategy must be right *before* the first deploy with real data.
- **P2 before everything visible** because every data-integrity pitfall is structural — retrofitting versioning or migration dispatch after features ship is catastrophically expensive.
- **P3 (Today) before P4 (catalog)** even though Today depends on a cadence stub — because the spine-proves-itself goal demands a visible artifact early, and Today is the highest-value view.
- **P5 (Exports) before P6 (Analytics)** because backup is the only real defense against IDB eviction; user must have export capability before accumulating months of data.
- **P6 last** because scoring is leaf-level (consumes everything, fed by nothing else) and validating it needs real multi-month data.

### Research Flags

Phases likely needing deeper research during planning:
- **P0 — Scoring decision:** the formulas in FEATURES.md are sketches; the picked one needs a precise spec (denominator handling for new habits, stage-weight curve for S2, load-curve calibration for S3) before P6.
- **P6 — Analytics performance at 5+ years:** synthetic dataset generation + index-strategy validation. Pitfall 9 is High-severity but only manifests at scale.

Phases with standard / well-documented patterns (no extra research-phase needed):
- **P1 (PWA shell):** directly mirrors `mindful-breathing`; pattern is proven.
- **P2 (Storage):** MDN IndexedDB + the architecture is locked.
- **P3 (Today):** view module pattern is standard; the perf budget is the only unusual constraint.
- **P5 (Exports):** mechanics are universal browser primitives; only the CSV-delimiter question is live, and that's a P0 resolution.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Constraints pre-locked by PROJECT.md; every choice cited to MDN + `mindful-breathing` reference; no novel tech. |
| Features | HIGH | Most features pre-declared in PROJECT.md Active list; categorization aligns with that surface. Scoring is the only open feature decision, and it's deliberately presented as three alternatives for user pick. |
| Architecture | HIGH | Standard CQRS-lite pattern (snapshot + event log + materialized cache); single novelty (`definitionVersion` on log rows) is the only honest way to honor the locked "edits don't rewrite history" invariant. |
| Pitfalls | HIGH | All 12 are well-known web-platform pitfalls (IDB eviction, SW brick, timezone, schema migration, Polish Excel) plus two domain-specific anti-patterns (streak-shaming, gamification) explicitly locked by PROJECT.md. |

**Overall confidence:** HIGH.

### Gaps to Address During Requirements / Planning

- **Scoring model pick (S1 / S2 / S3)** — v1-gating; resolved in P0 (requirements).
- **CSV delimiter (`,` vs `;` vs locale-toggle)** — v1-gating for P5; resolved in P0 (requirements) by empirical test on user's actual Polish Windows Excel.
- **Undo persistence across reload** — ARCHITECTURE.md flags MEDIUM-confidence; confirm with user whether "undo last action survives a refresh" is actually desired or if memory-only undo is acceptable simplification.
- **Cross-shell navigation default** — auto-redirect mobile <-> desktop based on viewport is rejected as foot-gun; explicit "Switch to desktop view" link in Settings. Confirm UX is acceptable.
- **Empirical performance baselining** — Pitfall 9 prevention strategy is sound but only validates at synthetic 5-year scale (P6). Worth flagging that the actual perf budget (300 / 800 / 2 s) may need tuning.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — locked constraints, scope, key decisions
- `.planning/research/STACK.md` — locked engineering decisions (CSV format, JSON merge semantics, scoring snapshots)
- `.planning/research/FEATURES.md` — feature categorization + three scoring proposals
- `.planning/research/ARCHITECTURE.md` — state pattern, schema, routing, build-order spine
- `.planning/research/PITFALLS.md` — 12 pitfalls + 2 anti-patterns with phase mapping
- `../mindful-breathing` — directly inspected reference project (same delivery model)
- MDN — IndexedDB, BroadcastChannel, Service Workers, Cascade Layers, Visibility API, Web App Manifest, StorageManager.persist

### Secondary (MEDIUM confidence)
- Competitor framing — Habitica, Streaks, Loop Habit Tracker, Way of Life, Productive (feature posture only, not deep-dived)
- CQRS-lite / event-log + materialized-views pattern (widely documented in Redux-toolkit and distributed-systems literature)
- WebKit ITP — Safari's 7-day IDB eviction rule

### Tertiary (LOW confidence)
- BJ Fogg's tiny-habits framing (background only; not cited in formulas)
- Habit-tracker community literature on streak-fatigue and gamification-fatigue (qualitative; informs A4/A5/A6 anti-features)

---

*Research completed: 2026-05-26*
*Ready for roadmap: yes, after P0 (requirements) resolves scoring + CSV delimiter*
