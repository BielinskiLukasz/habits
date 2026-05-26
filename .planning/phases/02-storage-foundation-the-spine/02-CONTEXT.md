# Phase 2: Storage Foundation (The Spine) - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the data backbone that every later phase hangs off — date utilities, raw IndexedDB + 7-store schema with migrations, the single-mutator chokepoint (`state/apply.js`), cross-tab sync (BroadcastChannel), lifecycle flush (`visibilitychange → hidden`), `navigator.storage.persist()` on first write, an idempotent seed loader, and one round-trip event (`markCompleted` + inverse + persistent undo) to prove every seam works end-to-end.

ROADMAP goal: *"Make every catastrophic data-integrity pitfall structurally impossible before any feature ships."*

The 13 requirements in scope (DATA-01..08, SEED-01..05) are pinned by ROADMAP.md — this discussion clarifies **how** to implement them, never **whether** to add new capabilities.

**Explicitly NOT in P2:**
- Today view rendering (UI shell + data binding land in P3)
- Cadence engine, stages, mastery threshold, multi-occurrence logging (P4)
- History navigation, edit history (P4)
- Catalog CRUD (P4)
- Exports / imports / backup nag (P5)
- Scoring models, desktop analytics (P6)
- Settings panel (P3); reset-data button stays in diagnostics in P2, migrates to Settings in P3

</domain>

<decisions>
## Implementation Decisions

### Namespace alignment
- **D-30 — Database name and BroadcastChannel name both `'habits'`.** Matches the SW cache prefix (`habits-` per D-29), the manifest `name: "Habits"` (D-13), and the repo identity. ARCHITECTURE.md's `BroadcastChannel('nawyki')` sketch and Phase 1 D-05's *"delete the nawyki IndexedDB database"* dialog string both get a forward-edit to `'habits'` during P2 planning. One consistent identifier everywhere.

### Seed
- **D-31 — Minimal stub seed in P2 (5-10 habits), full ~65 deferred.** Full hand-curation of the Nawyki v1.xlsx + Nawyki-fale.txt source data is its own body of work; gating the spine on it would drag P2. Full curation lands in a P2 follow-up plan or P3 prep.
- **D-32 — Coverage-first stub: 8 habits across Wave 1-3 exercising every cadence × log-shape combo.**
  - 2× daily binary
  - 1× weekly binary
  - 1× every-2-days binary
  - 1× day-of-week-subset binary (e.g. Mon/Wed/Fri)
  - 1× numeric `+1` counter (target N)
  - 1× slot-checklist with anonymous slots
  - 1× slot-checklist with user-labeled slots
  Spans Wave 1 + Wave 2 + Wave 3 so wave context exists from boot. Habit names are real-but-translated (English primary, Polish stored — see D-40).
- **D-33 — Seed loader uses merge-by-id, never overwrites.** Every seed entry has a stable UUID. On every boot, the loader iterates the seed file and inserts only habits whose `id` is not already in IDB. Existing rows (originally-seeded or user-edited) are never touched. This honors the merge-by-id philosophy CLAUDE.md applies to JSON imports, and lets a richer seed ship later (e.g. the full-65 follow-up plan) without nuking user data. Loader writes a `meta.seededIds` array as an optimization to short-circuit the diff on subsequent boots.

### Mutator chokepoint
- **D-34 — `apply.js` ships with one round-trip event in P2: `markCompleted` + inverse.** Phase 2 builds the chokepoint but has no Today UI yet (that's P3). To prove the seams work end-to-end — broadcast (DATA-07), visibilitychange flush (DATA-08), persist() (DATA-03), the full apply.js → events → meta.undoToken → broadcast pipeline — we ship one concrete event handler (`apply/markCompleted.js`) with its inverse (`restoreLogRow`). P3 then adds `markUncompleted`, numeric counters, and slot-checklist mutations on top of proven infrastructure.

### Language
- **D-35 — All user-facing strings English (habits + waves).** Reverses the prior PROJECT.md / CLAUDE.md constraint *"Polish habit names preserved verbatim (user data)"*. Habit names: English primary (e.g. `"Morning walk"`, `"Drink water"`, `"Strength training"`). Wave labels: `"Wave 0..9"` (not `"Fala 0..9"`). PROJECT.md + CLAUDE.md get edits during P2 planning to reflect the reversal. The full-65 seed-curation follow-up is responsible for the actual translation.
- **D-40 — `habits` store carries an optional `name_pl` field** (string, nullable). Polish original from the Nawyki sources is preserved as data — the user wants to glance at the Polish when an English name is ambiguous. The seed loader writes both for source-derived habits (`{name: "Morning walk", name_pl: "Spacer rano"}`); user-created habits default `name_pl: null`. Every P2 UI render uses `name`. **The quick-check surface design** (always-visible muted secondary line on Today vs long-press reveal vs ⓘ icon vs hover tooltip) **is a P3 UI-SPEC question, NOT a P2 storage decision.** Opening recommendation for P3 = muted secondary line under the English name on Today + catalog (always visible, low-emphasis, discoverable without remembering a gesture).
- **D-36 — CSV BOM + semicolon + CRLF setup kept** (EXPORT-04/05 unchanged). Even though habit names are English, future user content (slot labels, notes, user-added habits) may contain Polish diacritics. The setup is also robust for Polish Windows Excel double-click compat. Zero-risk choice. P5 honors this.

### Testing + CI
- **D-37 — Full-spine unit tests under D-23..D-26.** Every spine module ships with tests written first (TDD-blocking gate). Modules in scope: `js/util/date.js`, `js/db/idb.js`, `js/db/schema.js`, `js/db/repo.js`, `js/state/store.js`, `js/state/apply.js` (and `apply/markCompleted.js`), `js/state/undo.js`, `js/platform/sync.js`, `js/platform/lifecycle.js`, `js/io/seed.js`. Pure logic = `node --test` unit; IDB-touching modules = fake-IDB integration tests per D-25 (~30-line in-memory fake repo with the same surface as `js/db/repo.js`).
- **D-38 — GitHub Actions CI workflow lands in P2 plan 1 (first plan).** `.github/workflows/ci.yml` + a placeholder passing test ship before any spine code merges. Subsequent plans add real tests under the green-CI gate. Locks "green CI" as the merge criterion from day one of P2 — no stretch of untested merges.
- **D-47 — Strict no-npm direction reaffirmed.** Canonical invocations: `node --test tests/` for tests, `node scripts/serve.js` for the local dev server. No `package.json`, no `node_modules`, no Playwright (D-26 stands: browser smoke via the manual `tests-browser.html`). Sleep-tracker chose differently because it needs Playwright e2e; Habits' zero-dependency longevity (mirroring `mindful-breathing`) is intentional and not being revised. PROJECT.md + CLAUDE.md no-npm/no-bundler/no-framework/no-CDN constraint stands.

### Schema
- **D-39 — `score_snapshots` store declared in v1 schema (P2), empty until P6 starts writing.** Honors Pitfall 10's "migrations only add" principle: declaring the store + its `[habitId, date]` keypath + indexes on `date` and `habitId` now means P6 doesn't need a v2 migration just to introduce the store. Acceptable risk: if P6 reveals a different shape is needed, a real v2 migration ships then.

### Undo
- **D-43 — Full undo seam ships in P2.** `apply/markCompleted.js` writes its inverse payload into the `events` row in the same tx. `apply.js` writes `meta.undoToken = <new event id>` in the same tx. `js/state/undo.js` exposes `undo()` that reads `meta.undoToken`, looks up the event, applies the inverse via the same `apply.js` path (so undo also broadcasts and flushes). Tests cover the round-trip: mark → undo → back to clean, including post-reload (token survives via `meta.undoToken`). UNDO-02 ("survives reload") is fully demonstrable in P2 even though the toast/button surface lands in P3.

### Identity
- **D-42 — `events` store keyed by UUID** (`crypto.randomUUID()`), not autoincrement integer. Consistent with `habits`, `habit_versions`, and the seed-merge pattern. Cross-device import-safety: an exported events journal can be merged into another device's IDB without renumbering. ARCHITECTURE.md's autoincrement sketch gets a forward-edit to UUID during P2 planning. Chronological order is preserved via the index on `at` (ISO timestamp).

### Reset
- **D-44 — Reset-data button wired in diagnostics in P2; migrates to Settings in P3.** Phase 1 D-05 stubbed the button with tooltip *"available in P2"*; P2 now wires it functionally: confirm dialog using D-06 verbatim phrasing → `indexedDB.deleteDatabase('habits')` → `location.reload()`. The diagnostics version stays as a secondary debug surface after P3 unless explicitly removed. P3's SETTINGS-07 surfaces the same action in Settings using the same handler.

### Persistence prompt
- **D-41 — `navigator.storage.persist()` fires on the seed-load write, first launch ever.** The first thing the app does on first run is the idempotent seed load. That tx is the "first write" for DATA-03 purposes; `persist()` is called immediately after the tx commits, before any user interaction. The browser prompt thus appears on first launch — defends iOS 7-day ITP from minute one. Trade-off acknowledged: the prompt fires before the user has "invested" in the app, which may feel pushy, but the data-protection win is non-negotiable for a multi-year tracker.

### First-run defaults
- **D-45 — Settings store gets mastery defaults + schemaVersion on first run.** Same tx as the seed load also writes `settings.defaultThreshold = 0.9`, `settings.defaultWindowDays = 70` (MASTERY-01), and `settings.schemaVersion = 1` (matches `DB_VERSION` for export embedding). Other settings (`scoringModel`, `theme`, `lastBackupAt`, `lastViewedDate`) get written by their feature phase when first needed — no dead data in P2.

### Dev tooling
- **D-46 — Add `scripts/serve.js` in P2** (vanilla Node, zero deps). Pattern lifted from `../sleep-tracker/scripts/serve.js` (~58 lines: `node:http` + `node:fs` + `node:path`, path-traversal guard, small MIME map). Usage: `node scripts/serve.js` → `http://localhost:8080/` (or `PORT=9000 node scripts/serve.js`). NOT in the SW SHELL list (never served via fetch), NOT in `tests/`. README updated to replace the `python -m http.server` line with `node scripts/serve.js`. Useful for local SW testing on `http://` and any future browser-driven smoke tests.

### Claude's Discretion
- **`apply.js` sub-module organization.** ARCHITECTURE.md anti-pattern §4 mandates per-event handler modules rather than a god switch. The exact directory layout — `js/state/apply/markCompleted.js` vs `js/state/apply/handlers/markCompleted.js` vs a registry in `js/state/apply.js` that imports per-event modules — is planner-pick. Constraint: each handler returns `{ writes, inverse }`, and `apply.js` owns the transaction lifecycle.
- **`id.js` shape.** ARCHITECTURE.md mentions `js/util/id.js` with "crypto.randomUUID() with file:// fallback". Modern browsers expose `crypto.randomUUID()` on `file://` too (Chromium / Firefox / Safari all). Planner can keep `id.js` as a thin wrapper that just exports `randomUUID()` from the Web Crypto API; the "fallback" comment in ARCHITECTURE.md is stale and can be dropped.
- **Hydration window scope on boot.** ARCHITECTURE.md suggests "last 90 days" for the initial log hydration. In P2 with no Today view yet, the store has nothing to render — hydration scope is moot. Planner picks a reasonable default (likely just `logs.where(date = today)` for the seam test) and the real windowing decision lands in P3 when Today view exists.
- **Cross-tab sync message envelope shape.** ARCHITECTURE.md sketches `{ type, event, keys, at, origin }`. Planner finalizes field names and origin-generation (e.g. `Math.random().toString(36)` per session, vs `crypto.randomUUID()` on boot stored on `globalThis`).
- **P2 plan breakdown.** ROADMAP says "Plans: TBD" for P2. Plan count + boundaries is planner discretion. A reasonable split could be: (1) CI workflow + scripts/serve.js + tests skeleton, (2) date utilities + idb wrapper, (3) schema + repo + migrations, (4) state/apply + sync + lifecycle + undo, (5) seed loader + persist() + reset-data wiring, (6) docs (README updates, PROJECT.md / CLAUDE.md edits for D-30 + D-35). Or fewer larger plans — planner judges based on commit-atom sizes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs and constraints
- `.planning/PROJECT.md` — locked stack constraints, file://-safe rule, privacy rule. **Note for P2 planning: the "Polish habit names preserved verbatim" constraint is reversed by D-35; PROJECT.md needs editing during P2.**
- `.planning/REQUIREMENTS.md` — the 13 requirements in this phase: DATA-01..08, SEED-01..05
- `.planning/ROADMAP.md` §"Phase 2" — goal and 5 success criteria

### Research already done
- `.planning/research/STACK.md` — locks raw IDB + ~80-line promise wrapper, BroadcastChannel for cross-tab, visibilitychange → hidden for flush, no npm/no bundler/no CDN
- `.planning/research/ARCHITECTURE.md` §1 "Module Layout" — `js/state/`, `js/db/`, `js/platform/`, `js/io/`, `js/util/` directory shape
- `.planning/research/ARCHITECTURE.md` §2 "State Management Pattern" — snapshot-of-definitions + append-only events; logs reference `definitionVersion`; single mutator at `state/apply.js`
- `.planning/research/ARCHITECTURE.md` §3 "IndexedDB Schema" — store keypaths and indexes (with P2 updates: 7 stores not 6, events keyed by UUID per D-42, score_snapshots declared per D-39)
- `.planning/research/ARCHITECTURE.md` §6 "Cross-Tab Sync + Undo" — BroadcastChannel protocol, inverse-event pattern, meta.undoToken persistence. **Note: channel name updated to `'habits'` per D-30.**
- `.planning/research/ARCHITECTURE.md` §7 "Build Order" — the spine dependency chain (`date → idb → schema → repo → seed → store/apply → sync → lifecycle → SW → router → today view`); P2 ships everything except the final two
- `.planning/research/ARCHITECTURE.md` "Anti-Patterns Specific to This Project" §1-§5 — must read before writing any apply.js, repo.js, or date util code
- `.planning/research/PITFALLS.md` §"Pitfall 1: IndexedDB Data Loss" — informs the persist() timing decision (D-41)
- `.planning/research/PITFALLS.md` §"Pitfall 3: Habit-Definition Edits Corrupt Prior Logs" — drives the habit_versions store + definitionVersion field on logs
- `.planning/research/PITFALLS.md` §"Pitfall 4: Timezone & Date-Boundary Bugs" — drives `util/date.js` as the Day-1 module; YYYY-MM-DD local strings, never UTC; DST + leap-day tests mandatory
- `.planning/research/PITFALLS.md` §"Pitfall 5: Rolling-Window Math Off-by-One" — informs `domain/threshold.js` later (P4); not P2 scope but worth knowing the constraint
- `.planning/research/PITFALLS.md` §"Pitfall 8: Multi-Tab Concurrency" — read-modify-write inside a single tx; broadcast intent (keys) not values
- `.planning/research/PITFALLS.md` §"Pitfall 10: Schema Migration Without Tooling" — `DB_VERSION` + `MIGRATIONS` dispatch table; additive-only; never rename; every JSON export embeds `schemaVersion`
- `.planning/research/FEATURES.md` — feature map (cross-check that P2 doesn't accidentally pull in P3+ features)
- `.planning/research/SUMMARY.md` — top-level research synthesis

### Phase 1 prior decisions (carry forward)
- `.planning/phases/01-pwa-shell-tooling-hygiene/01-CONTEXT.md` — D-01..D-20 (Phase 1) and the locked conventions D-23..D-29 (testing, JSDoc, SemVer, module SW, `habits-` cache prefix)
- `VERSIONING.md` (repo root) — SemVer policy (D-28); P2 bumps APP_VERSION to 0.2.0 on phase completion
- `js/util/version.js` — single source of truth for APP_VERSION (D-12); P2 imports it from `sw.js` and the diagnostics panel
- `sw.js` — module SW with stale-while-revalidate for `/js/*` (D-29). Not modified by P2 except to add the new JS files under `/js/db/`, `/js/state/`, `/js/io/`, etc. to the SHELL list if they should be precached (planner-pick — SWR handles them either way).

### Reference projects (directly inspected)
- `../mindful-breathing/` — zero-dependency-longevity sibling project; the spiritual reference for D-47
- `../sleep-tracker/scripts/serve.js` — pattern for D-46 (Habits' `scripts/serve.js`); lift the shape, not the npm wrapping

### Project-level
- `CLAUDE.md` — the consolidated tech-stack TL;DR. **Note: D-35 reverses the "Polish habit names" constraint; CLAUDE.md needs editing during P2.**

### External / web
- MDN — Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- MDN — `navigator.storage.persist()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- MDN — BroadcastChannel: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN — `visibilitychange` event: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- Node.js — built-in test runner: https://nodejs.org/api/test.html

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`js/util/version.js`** — already exports `APP_VERSION` for SemVer/cache-name use (D-12, D-28). P2 reuses verbatim; no edits needed. `schemaVersion` (D-45) is a separate IDB-level concept; doesn't collide.
- **`js/views/toast.js`** — Phase 1 toast primitive; will host Undo notifications when P3 ships the Undo UI. P2 itself doesn't render toasts (no UI mutations from user yet).
- **`js/views/diagnostics.js`** — already has a "Reset data" button stub with tooltip *"available in P2"* (D-05). P2 wires the click handler (per D-44).
- **`../sleep-tracker/scripts/serve.js`** — pattern for D-46. Lift the structural shape (~58 lines, vanilla node:http), keep the path-traversal guard verbatim, swap the log line.

### Established Patterns
- **JSDoc file headers + JSDoc on exports (D-27).** Every new `.js` file in P2 opens with `/** @file <one-line summary>. <rationale + D-XX cross-refs> */`.
- **SemVer 2.0.0 (D-28) + `habits-${APP_VERSION}` cache prefix (D-29).** P2 completion → bump APP_VERSION to `0.2.0`.
- **Module SW + ES `import` of version.js (D-29).** P2 may add new JS files referenced by `sw.js`'s SHELL list (planner picks which to precache); SWR handles uncached `/js/*` automatically.
- **JSDoc `@param`/`@returns`/`@type` on exports.** No TS compile step; type hints live in JSDoc for editor support.
- **TDD-blocking gate (`workflow.tdd_mode = true`).** Tests written before the code they test. CI gates the merge (D-38).

### Integration Points
- **`js/db/`** is new in P2. `js/db/idb.js` is the only module that talks to `indexedDB`; everything else uses `js/db/repo.js`.
- **`js/state/`** is new in P2. `state/apply.js` is the only mutator; `state/store.js` is the only cache reader; views (P3+) only touch `state/`. Never `db/` directly from views.
- **`js/platform/sync.js`** is new in P2. Wraps `BroadcastChannel('habits')`. Called by `state/apply.js` post-tx-commit.
- **`js/platform/lifecycle.js`** is new in P2. Listens for `visibilitychange === 'hidden'`, awaits any pending tx, ensures all writes are durably flushed. Must NOT use `beforeunload`.
- **`js/io/seed.js`** is new in P2. Reads `seed/habits.json`, diffs against `meta.seededIds`, writes new habits via `state/apply.js` (or directly via `repo.js` for the initial bulk insert — planner-pick) inside the same tx that calls `navigator.storage.persist()` and writes the mastery defaults (D-45).
- **`js/util/date.js`** is new in P2. Day-1 module per ARCHITECTURE.md §7. Pure functions: `todayLocal()`, `daysAgo(n)`, `formatLocalYMD(d)`, `parseLocalYMD(s)`, plus arithmetic helpers that handle DST + leap days. No `toISOString()` for date keys.
- **`scripts/serve.js`** is new in P2. Outside `js/`, outside `tests/`, outside the SW SHELL list.
- **`.github/workflows/ci.yml`** is new in P2 plan 1. Runs `node --test tests/` on push/PR.
- **`tests/`** is new in P2. `tests/unit/*.test.js` for pure modules; `tests/integration/*.test.js` for fake-IDB roundtrips (per D-25). The fake IDB is a hand-written ~30-line in-memory repo with the same surface as `js/db/repo.js`.
- **`sw.js`** — P2 does not touch the SW logic. Planner decides whether to add new `/js/*.js` entries to the SHELL list (precache them) or rely on SWR for them — both work.

</code_context>

<specifics>
## Specific Ideas

- **The 8-habit stub seed is a curation deliverable in P2** (D-32). Names are English (D-35), but every habit also carries `name_pl` (D-40). Suggested concrete examples (final naming is planner / seed-plan call):
  - `"Morning walk"` / `"Spacer rano"` — daily binary, Wave 1
  - `"Drink water (1.5L)"` / `"Picie wody (1,5L)"` — daily numeric `+1` counter, target 6 cups, Wave 1
  - `"Strength training (M/W/F)"` / `"Trening siłowy (pn/śr/pt)"` — day-of-week-subset binary, Wave 3
  - `"Weekly grocery run"` / `"Cotygodniowe zakupy"` — weekly binary, Wave 2
  - `"Shower (every 2 days)"` / `"Prysznic co 2 dni"` — every-N-days binary, Wave 1
  - `"5 things grateful for"` / `"5 rzeczy za które wdzięczny"` — daily numeric `+1` counter, target 5, Wave 1
  - `"7 meatless meals/week"` / `"7 posiłków bez mięsa/tydz"` — slot-checklist with anonymous slots, target 7/week, Wave 2
  - `"Daily learning (3 sources)"` / `"Codzienna nauka (3 źródła)"` — slot-checklist with user-labeled slots ("read", "video", "practice"), Wave 3 or similar
- **The data-trust invariant is the load-bearing constraint of this phase.** Every test must be designed to catch "did a write or migration corrupt history?" If a test isn't asking that, it's testing the wrong thing.
- **`utility-date.js` tests must hit DST 2026-03-29 (Europe/Warsaw spring-forward), DST 2026-10-25 (fall-back), and leap day 2028-02-29.** Three concrete dates in the test file, not abstract assertions.
- **`util/id.js` should be a thin wrapper around `crypto.randomUUID()`.** No fallback needed — every target browser exposes it on `file://` too.
- **The Polish-fallback quick-check surface (P3) opening recommendation** = always-visible muted secondary line under the English name on Today + catalog. Discoverable without remembering a gesture; cheap to ignore when not needed; trivial to render. P3 UI-SPEC re-decides.

</specifics>

<deferred>
## Deferred Ideas

- **Quick-check surface for `name_pl` on Today / catalog** — design decision deferred to P3 UI-SPEC. Data shape (`name_pl` field) is locked in P2 (D-40). My opening rec is "always-visible muted secondary line."
- **Settings panel "Show Polish names" toggle** — not in v1 scope unless the user specifically asks. The `name_pl` data is there; surfacing options can land later without a schema change.
- **Wave label data model** — habits reference a wave via a `wave` field (existing per requirements). The full wave-data model (wave names, date ranges, theme descriptions, 2027 extension per WAVE-06) is a P4 concern; P2 just needs habits to store wave references.
- **Full ~65-habit seed curation (translation + curation from Nawyki v1.xlsx / Nawyki-fale.txt)** — explicitly deferred. Land as a P2 follow-up plan or P3 prep. The seed loader supports merge-by-id (D-33) so this is purely additive when it ships.
- **Hydration window scope** — moot in P2 (no view to render). P3 sets the real "last N days" window when Today view exists.
- **`apply.js` event surface beyond `markCompleted`** — `markUncompleted`, numeric counters, slot-checklist mutations all wait for P3 (Today view) and P4 (full domain). The chokepoint + one event in P2 proves the pattern.
- **Toast / button UI for undo** — P3 work. P2 proves the seam programmatically + via test.
- **Settings panel migration of "Reset data" button** — P3 work per D-44. P2 wires it in diagnostics; P3 mirrors it in Settings (same handler).
- **`scoringModel`, `theme`, `lastBackupAt`, `lastViewedDate` settings defaults** — written by their feature phase (P6, P3, P5, P3 respectively) when first needed. Not P2 (D-45).
- **Playwright / automated browser e2e tests** — explicitly rejected (D-47). If the testing surface ever genuinely outgrows the manual `tests-browser.html`, revisit, but the bar for breaking the no-npm seal is high.
- **`apply.js` sub-module directory layout, message-envelope finalization, id.js shape** — planner discretion; tracked in Claude's Discretion above.

</deferred>

---

*Phase: 2-Storage Foundation (The Spine)*
*Context gathered: 2026-05-26*
