# Versioning Policy

Nawyki uses [Semantic Versioning 2.0.0](https://semver.org/) for `APP_VERSION` (the value in `js/util/version.js`).

Format: `MAJOR.MINOR.PATCH` (with optional `-prerelease` and/or `+build` suffixes).

The SW cache name derives directly: `` `habits-${APP_VERSION}` `` (no `v` literal prefix).

## Current Phase: Initial Development (`0.y.z`)

Per **SemVer §4**: *Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public API SHOULD NOT be considered stable.*

While the v1.0 milestone (Phases 1-6) is being built, the version stays in the `0.y.z` range. **Breaking changes during this phase do NOT trigger a MAJOR bump** — they bump MINOR instead.

| Change type during `0.y.z` | Example bump | When |
|---|---|---|
| Bug fix, internal refactor, shell-asset-only change (CSS tweak, copy fix, icon adjustment) | `0.1.0` → `0.1.1` | Most commits during a phase |
| New feature, breaking change to IDB schema or app data shape, anything user-visible that changes behavior | `0.1.0` → `0.2.0` | End of each Phase (1 → 2 → 3 → ...) OR mid-phase when introducing a substantial new capability |

**Mapping to roadmap:**

| When | Bump to |
|---|---|
| **Now (Phase 1 complete)** | `0.1.0` |
| Phase 2 complete (Storage Foundation) | `0.2.0` |
| Phase 3 complete (Today View & Settings) | `0.3.0` |
| Phase 4 complete (Domain Model) | `0.4.0` |
| Phase 5 complete (Backup & Restore) | `0.5.0` |
| Phase 6 complete (Desktop Analytics & Scoring) | `0.6.0` |
| **v1.0 milestone seal (after Phase 6 verified + UAT signed off)** | `1.0.0` |

Patch bumps (`0.1.0` → `0.1.1`) land for any shell-asset-only change between phases.

## Release history

### v0.5.0 — Desktop Analytics & Scoring Trio (Phase 6)

Released: 2026-06-29

#### Added
- Desktop analytics shell (`desktop.html`) with sidebar navigation and three hash-routed panels
- Analytics view: per-habit stats grouped by wave with S1 status badges and active model score column
- Wave-board: 12-week heat-map grid (habit x ISO week) with S1 status color coding
- Planning view: forward-looking 12-week grid of future habits, links to Catalog
- Three scoring models: S1 (Rolling Threshold Health), S2 (Day-Weighted), S3 (Load-Adjusted Capacity)
- `score_snapshots` IDB store now populated on every log write and on bulk recompute
- Settings: Scoring Model selector (S1/S2/S3 radio buttons) and "Recompute Scores" action
- "Open desktop analytics" link in Settings (DESKTOP-01 — never auto-redirects by viewport)
- Scoring status CSS tokens: `--color-score-healthy`, `--color-score-watch`, `--color-score-atrisk`, `--color-score-failing`, `--color-score-na`

#### Fixed
- `router.js` `mountRoutes` now accepts `defaultRoute` parameter (backward-compatible default `'#today'`)

### v0.4.0 — Phase 4 closeout (2026-06-05)

- **What shipped:** Full habit lifecycle domain model. Catalog CRUD (create, edit, archive, restore, future-schedule habits with versioned `habit_versions` entries); stage progression with manual button and auto-advance triggers (after-N-days, composable OR logic); mastery threshold evaluation with global defaults (90% / 70 days) and per-habit overrides; multi-occurrence logging (numeric +1 counter with `logNumeric`, slot-checklist with `logSlot`); history navigation (past-day lookup, mark not-completed on historical days, bulk uncomplete); wave aggregate metrics (completion %, status counts, longest streak, at-risk indicator). Settings panel extended with mastery threshold and window fields (SETTINGS-01, D-86). `seed/habits.json` enriched with `targetType`, `stages`, `currentStageIndex`, `stageStartedAt`, `masteryThresholdOverride`, `masteryWindowOverride`, `startDate` (seedVersion bumped to 2).
- **Bump rationale:** MINOR per SemVer §4 (phase completion, substantial new domain capability — catalog, stages, mastery, multi-occurrence, history, wave aggregates).
- **Cache invalidation:** `habits-0.4.0` replaces `habits-0.3.0`. The SW activate handler (D-10) deletes the prior cache; the P1 update-toast (D-08, no-auto-dismiss) fires for users still on `0.3.0`.
- **D-decisions delivered in P4:** D-82..D-90 (see `.planning/phases/04-domain-model-cadence-catalog-stages-mastery-multi-occurrence/04-CONTEXT.md`). SW SHELL extended by 17 new P4 entries.

### v0.3.0 — Phase 3 closeout (2026-05-28)

- **What shipped:** First user-visible surfaces. `index.html#today` renders cadence-filtered habits; tap toggles complete/uncomplete with optimistic flip; toast offers single-step Undo with a 5s auto-dismiss (D-69) that hover-pauses (D-69); `index.html#settings` lands the v1 panel (Storage / Schedule / Install / Data / About per D-61), and the second Undo surface lives in the Data card per D-65/D-72. Reset-data uses the Settings-flavored confirm per D-67; the diagnostics surface's D-06 verbatim text is unchanged.
- **Bump rationale:** MINOR per SemVer §4 (the project is still in initial-development `0.y.z` per `js/util/version.js`'s file header). New user-facing surface on top of the Phase 2 storage spine.
- **Cache invalidation:** `habits-0.3.0` replaces `habits-0.2.0`. The SW activate handler (D-10) deletes the prior cache via the `/^habits-/` regex; the P1 update-toast (D-08, no-auto-dismiss) fires for users still on `0.2.0`.
- **D-decisions delivered in P3:** D-48..D-81 (see `.planning/phases/03-today-view-settings-v1-first-usable-slice/03-CONTEXT.md`).

### v0.2.0 — Phase 2 closeout (2026-05-27)

- **What shipped:** Storage spine. Raw IndexedDB with 7 stores (`habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`); single-mutator `apply()` chokepoint with `markCompleted` handler; `meta.undoToken` persistent undo; `BroadcastChannel('habits')` cross-tab sync; `visibilitychange` lifecycle flush; idempotent seed loader for `seed/habits.json`; `navigator.storage.persist()` on first write; D-44 Reset-data wired into diagnostics.
- **Bump rationale:** MINOR per SemVer §4 (phase completion, additive storage surface).

### v0.1.0 — Phase 1 closeout (2026-05-26)

- **What shipped:** PWA chassis. Versioned-cache module service worker (`habits-${APP_VERSION}`, cache-first SHELL + SWR for `/js/`); Web App Manifest with maskable icon; two HTML shells (`index.html`, `desktop.html`); Cascade-Layers CSS scaffold; diagnostics panel reachable via `?debug=1` or long-press, with Reset-shell escape hatch.
- **Bump rationale:** Initial development baseline.

## After v1.0 (`1.y.z` and beyond)

Once `1.0.0` ships, the public API and storage shape are considered stable. Standard SemVer rules apply:

| Change type | Example bump | Trigger |
|---|---|---|
| **PATCH** | `1.0.0` → `1.0.1` | Backwards-compatible bug fix; shell-asset-only change (CSS, copy, icon) |
| **MINOR** | `1.0.1` → `1.1.0` | Backwards-compatible feature addition; new optional capability |
| **MAJOR** | `1.1.0` → `2.0.0` | **Incompatible** API change OR breaking storage-shape migration (`schemaVersion` changes against existing user data) |

Every `schemaVersion` migration after v1.0 → MAJOR bump. The cache name change wipes the SW cache; the schema migration handles the data.

## How a bump works

1. Edit `js/util/version.js`, change `APP_VERSION` literal.
2. Commit. (Optional: tag the commit `git tag v0.1.1`.)
3. Push to `main`. GitHub Pages serves the new bytes.
4. On the user's next page load, `sw.js` `activate` handler deletes every cache whose name is not the current `` `habits-${APP_VERSION}` ``, then `clients.claim()` takes over.
5. Because `hadController` was true going into the new SW, `controllerchange` fires and the toast "New version ready — Reload" appears. The user clicks Reload at their leisure — no auto-reload (D-08 / D-09).

See also:
- `README.md` § "Bumping the version" — quick reference
- `.planning/PROJECT.md` Key Decisions — D-28 (versioning) + D-10/D-12 (cache derivation)
- `js/util/version.js` — the single source of truth

## Why not just start at 1.0.0?

Calling code `1.0.0` while still in active development implies the public API is locked. Anyone reading the version (or running automation that compares versions) would assume backwards-compatibility guarantees that don't yet exist. The `0.y.z` range is the SemVer-blessed signal for "this is not stable yet — anything may change."
