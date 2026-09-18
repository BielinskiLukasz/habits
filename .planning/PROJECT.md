# Nawyki — Personal Habit Tracker

## What This Is

A personal, offline-first habit-tracking web app that formalizes the existing "Nawyki" system (47-week 2026 wave plan, ~65 habits across 10 themed waves) into a long-term, multi-year tool. Built as a static multi-file HTML/JS/CSS app — same minimalist spirit as `mindful-breathing` (no backend, no framework, no build tool) — but with richer client-side state in IndexedDB.

Intended for a single user (the author) on personal devices: mobile-first for daily check-in, desktop-first for analytics and planning.

## Core Value

**Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.**

Everything else — scoring, ranking, dashboards — can fail. Daily check-in and the underlying habit model cannot.

## Requirements

### Validated

<!-- v1.2 UX & i18n Quality Gate — Phases 10–11 validated so far -->

- ✓ I18N-01 — Retroactive tests for i18n module (locale lookup, fallback, t() coverage) — Phase 10 — v1.2
- ✓ I18N-02 — All views use t() with no hardcoded UI strings remaining — Phase 10 — v1.2
- ✓ I18N-03 — Language preference persists across reload and shell switch — Phase 10 — v1.2
- ✓ LOG4-01 — Unit tests for 4-state log status model (completed/failed/skipped/undefined) — Phase 11 — v1.2
- ✓ LOG4-04 — JSON export/import round-trips all 4 log states without data loss; CSV export emits correct cell values for all 4 states — Phase 11 — v1.2
- ✓ LOG4-05 — CSV export emits correct cell values for all 4 states (`x` for skipped, `1` for completed, `0` for failed/undefined-applicable) — Phase 11 — v1.2
- ✓ LOG4-02 — Swipe UX on Today view correctly cycles all 4 states (Fail button now dispatches markFailed, not the row-deleting markUncompleted) — Phase 13.1 — v1.2
- ✓ LOG4-03 — History screen swipe UX matches Today's 4-state interaction model (same fix) — Phase 13.1 — v1.2

<!-- v1.1 Scheduled Habits — Phases 7–9 (shipped 2026-08-27) -->

- ✓ SCHED-01 — New `scheduled` status (4th, alongside active/mastered/archived) for future-start habits — Phase 7 — v1.1
- ✓ SCHED-02 — Scheduled habits hidden from Today view and active Catalog list — Phase 7 (impl) / Phase 8 (CAT-01 verification test) — v1.1
- ✓ SCHED-03 — Catalog shows scheduled habits in a dedicated "Upcoming" section — Phase 8 — v1.1
- ✓ SCHED-04 — Desktop Waveboard surfaces scheduled habits per wave with their startDate — Phase 9 — v1.1
- ✓ SCHED-05 — Auto-transition: `scheduled` → `active` when startDate is reached (on app boot) — Phase 7 — v1.1
- ✓ SCHED-06 — Manual promote-to-active action available from the Upcoming section — Phase 8 — v1.1
- ✓ SCHED-07 — Converter (`scripts/convert-nawyki.js`) sets `status: 'scheduled'` for habits with `startDate > today` — Phase 7 — v1.1

<!-- Shipped and confirmed valuable — v1.0 (2026-06-30) -->

- ✓ CORE — Daily check-in view (Today), mobile-first, single-tap mark/unmark, multi-occurrence logging — v1.0
- ✓ CATALOG — Habit CRUD with stages, cadence, day-of-week rules, multi-occurrence targets, per-habit threshold/window overrides — v1.0
- ✓ LOG — Multi-occurrence logging: numeric `+1` counter AND slot-checklist (anonymous or user-labeled slots) — v1.0
- ✓ STAGE — Stage progression: manual button, scheduled by wave week, automatic after N days at current stage (composable) — v1.0
- ✓ MASTERY — Threshold-based "mastered" badge: 90% / 70 days default, globally configurable, per-habit override; mastered habits stay visible on Today, muted — v1.0
- ✓ CADENCE — Day-of-week, "every N days", daily, weekly, monthly cadence engine — v1.0
- ✓ WAVE — Wave/Fala model: habits tagged by wave, aggregate metrics (completion %, status counts, streak, "wave at risk") — v1.0
- ✓ HISTORY — Navigate any past day, mark habits not-completed, bulk-mark uncompleted, single-step undo across reload — v1.0
- ✓ DATA — Habit edits never rewrite history; definition changes apply forward only via `habit_versions` — v1.0
- ✓ SEED — Hand-curated JSON bundled with app, ~65 habits idempotently loaded on first run — v1.0
- ✓ EXPORT/IMPORT — JSON full-fidelity backup/restore (merge-by-id), CSV habit×day matrix for Excel — v1.0
- ✓ PWA — Installable, works fully offline, service worker silent-fails on file:// — v1.0
- ✓ DESKTOP — Separate desktop.html with analytics, wave-board, planning views (not just wider Today) — v1.0
- ✓ SCORING — S1/S2/S3 scoring trio, switchable from Settings, persisted in score_snapshots IDB store — v1.0

### Active

<!-- v1.2 UX & i18n Quality Gate — retroactive validation of quick-task features -->

- [ ] UX-01 — Analytics footer nav visible and functional on mobile and desktop — v1.2
- [ ] UX-02 — Desktop sidebar collapse/expand persists across navigation — v1.2
- [ ] QA-01 — Code review: no switch on log status/cadence types; no innerHTML; JSDoc headers present — v1.2
- [ ] QA-02 — New architectural decisions (4-state model, i18n architecture) documented in PROJECT.md — v1.2

### Out of Scope

<!-- Explicit boundaries. Reasons captured to prevent re-adding. -->

- Reminders / push notifications — explicitly deferred (user prefers no nag); revisit post-v1
- Cloud sync / multi-device — single-device + JSON export-import is enough for v1; design data model so sync is feasible later
- Multi-user / accounts — single user (the author), no sign-in
- In-app xlsx/txt importer — seed data is bundled JSON, the user-facing app doesn't parse spreadsheets
- Bundler / framework / npm dependencies — deliberate constraint, mirrors `mindful-breathing`
- Polish-only UI — UI strings are English; habit names remain Polish (they are user content, not UI)
- English habit translation — habit names are the user's existing Polish identifiers; not translated
- Reminders via email / SMS / OS notifications — see "reminders" above
- Server-side analytics or telemetry — none; the app never phones home
- Direct copy of the xlsx's "WYNIK SKORYGOWANY" scoring — to be rethought in research

## Context

**The existing system (the "v1" being formalized into an app):**

- 47-week timeline starting **29.12.2025**, ending **20.12.2026**.
- ~65 habits organized into 10 themed waves ("Fale"):
  - **Fala 0** — pre-start, weeks 1–8 (foundational mixed)
  - **Fala 1** — Energy & regulation foundations
  - **Fala 2** — Daily rhythm & eating
  - **Fala 3** — Movement & body
  - **Fala 4** — Relationships & emotions (current as of 2026-05-26)
  - **Fala 5** — Order & organization
  - **Fala 6** — Diet & restrictions
  - **Fala 7** — Digital minimalism & hard behaviors
  - **Fala 8** — Hygiene & health
  - **Fala 9** — Development & competencies
- Habits introduce one per week per wave; multiple waves run in parallel.
- The xlsx already tracks: per-habit `Próg uznania za zrealizowany` (threshold), `Ile dni wstecz` (window), per-row stages (`etap 1`, `etap 2`, `etap 3` with progressive targets), day-of-week markers in habit names, rolling-window stats, ranking, tuning comments ("zmniejszono start z 5,5k na 4k").
- The app being built is "Nawyki v2" — the system, made into a sustainable long-term tool.

**Reference project:**

- `../mindful-breathing` — same author, same delivery model: single-author static web app, vanilla web platform APIs only, PWA, GitHub Pages-hostable, `localStorage` for state. Nawyki diverges only in: (a) IndexedDB instead of localStorage (more data), (b) multi-file source instead of single index.html.

**User identity:**

- Single user (the author). Polish speaker. Habit content is in Polish. UI chrome is English.

## Constraints

- **Tech stack**: Vanilla HTML + ES modules + CSS. No framework, no bundler, no npm. Browser-native APIs only. — *Deliberate constraint mirroring `mindful-breathing`; the author values zero-dependency longevity.*
- **Source layout**: Multi-file (not single index.html). — *User preference; the app is too large for one file but should still ship as plain static assets.*
- **Storage**: IndexedDB for primary data + JSON export/import for backup. — *Years of daily logs would strain localStorage; IndexedDB capacity is the safer floor. Cloud sync is a future option, not v1.*
- **Hosting**: Static — must work via `file://` and over HTTP(S) (GitHub Pages-compatible). Service worker registration should be silent-fail-safe so `file://` keeps working. — *Same model as `mindful-breathing`.*
- **Offline**: Must function fully offline (PWA). — *Daily check-in cannot depend on connectivity.*
- **UI language**: English UI chrome AND English habit names primary; Polish original optionally preserved as a per-habit `name_pl` field (D-35 + D-40, locked Phase 2). — *D-35 reverses the prior Polish-names-as-user-data constraint: every user-facing string — UI chrome AND habit names — is English by default. The `habits` IDB store carries an optional `name_pl` string field (D-40), so the seed loader writes both for source-derived habits, e.g. `{name: "Morning walk", name_pl: "Spacer rano"}`; user-created habits default `name_pl: null`. The quick-check surface for `name_pl` on Today / catalog is a P3 UI-SPEC decision, not a P2 storage decision.*
- **Layout split**: Mobile and desktop are truly different layouts (not one responsive layout), because they serve different jobs — mobile = check-in, desktop = analytics/planning. — *Confirmed during questioning.*
- **History integrity**: Habit-definition edits never rewrite historical logs; the habit identity is preserved across edits. — *Confirmed during questioning. Critical to data trustworthiness.*
- **Privacy**: No telemetry, no analytics, no network calls except what the user explicitly triggers (export/import). — *Personal data; single-user app.*

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla multi-file static app (no build) | Mirrors `mindful-breathing`; zero-dependency longevity | Shipped v1.0 — 52 JS files, 0 npm installs, 0 build steps. Zero dependency rot across 36 days. |
| IndexedDB + JSON export/import (not localStorage, not cloud) | Capacity for years of logs; manual backup is acceptable for a personal tool | Shipped v1.0 — 7 IDB stores, merge-by-id import, JSON+CSV export. |
| D-35: English UI + English habit names primary; optional Polish original as `name_pl` (supersedes original "Polish habit names (data)" framing) | The only spreadsheet column needing translation is `name`; storing both `name` (English) and `name_pl` (Polish) keeps the user's existing identifiers retrievable while letting any future UI surface either | Locked 2026-05-26 (Phase 2) |
| Seed data as bundled hand-curated JSON | Faster v1, no importer code in-app, future-resilient | Shipped v1.0 — `seed/habits.json` with ~65 habits idempotently loaded. |
| Two export formats: JSON (full backup, round-trippable) + CSV (flattened, Excel-pasteable, read-only) | JSON for the app, CSV for the user's Excel-based ad-hoc analysis habits | Shipped v1.0 — UTF-8 BOM + CRLF + semicolon delimiter for Polish Windows Excel. |
| Threshold model: 90% / 70 days, configurable globally + per-habit override | Matches existing xlsx model exactly; allows per-habit tuning that the spreadsheet already required | Shipped v1.0 — `mastery.js` rolling-window evaluation, per-habit override. |
| Graduation: stay on Today, muted/badged (don't hide) | User wants to keep "feeding" mastered habits without pressure | Shipped v1.0 — mastered badge visible on Today, muted visual treatment. |
| Stage advancement: multiple triggers per habit (manual OR scheduled-by-week OR after-N-days), composable | Honors the diversity in the existing system (some habits step up by calendar, some by effort, some on-demand) | Shipped v1.0 — OR-composed trigger evaluation in `stage.js`. |
| Multi-occurrence UX: numeric +1 counter AND slot-checklist (with optional user-defined slot labels), choice per habit | Different habits naturally want different UX (5 things to be grateful for vs 7 meatless meals) | Shipped v1.0 — binary, numeric, slot-checklist all implemented. |
| Mobile-first daily check-in, desktop-first analytics — distinct layouts | Recognizes that the two jobs have different ergonomics | Shipped v1.0 — `index.html` (mobile) + `desktop.html` (analytics), two separate DOM trees. |
| History edits don't overwrite prior state (partial completions persist as "uncompleted but data retained"); per-habit edit history + global undo | History must be trustworthy and recoverable | Shipped v1.0 — `habit_versions` store, single-step undo persists across reload. |
| Scoring model: 3 alternatives → user picks | The xlsx's "WYNIK SKORYGOWANY" is a candidate but not the only good answer; deserves deliberate redesign | Shipped v1.0 — S1 (Rolling Threshold Health), S2 (Day-Weighted Wave Score), S3 (Load-Adjusted Capacity Score); S1 default; Settings toggle. |
| Ongoing tool, multi-year (waves are seed plan, not a hard endpoint) | The 47-week plan is the first wave plan, not the whole product | Confirmed v1.0 — wave model extensible; no hard endpoint in schema. |
| Reminders/notifications OUT of v1 | User explicitly opted out for now; revisit later | Confirmed out of v1 — no notification code shipped. |
| `scheduled` is the 4th habit status (not a boolean or separate flag) | Keeps status a single field throughout IDB, export, and display logic; no dual-state ambiguity | Shipped v1.1 — stored in `habits.status`; 4-value enum: active/mastered/archived/scheduled. |
| Auto-transition fires on boot (not a background timer) | No background timer needed; boot is the natural checkpoint when a new day starts | Shipped v1.1 — `bootScheduled()` runs before `hydrate()` in both shells. |
| One-time migration (active→scheduled) at boot, guarded by `scheduledMigrationV1` meta key | Idempotent — safe to ship to existing data without re-triggering on every boot | Shipped v1.1 — `runMigration()` in `scheduled.js`; meta key prevents replay. |
| Waveboard informational-only in v1.1 (no wave editing) | Minimal scope to ship value without complexity of wave CRUD | Shipped v1.1 — WAVE-01–04 satisfied; wave editing deferred to future milestone. |
| Promote action wired through `apply()` chokepoint (same as all other mutations) | Consistent with Anti-Pattern 1 — no direct IDB writes in views; undo/broadcast/events all free | Shipped v1.1 — `handlePromoteHabit` in `apply/promoteHabit.js`, registered in HANDLERS table. |
| D-23: Unit tests use Node's built-in `node --test` runner; tests live in `tests/` (excluded from SW shell and GH Pages deploy); cover pure-function modules only (domain logic, db migrations, utils); browser-driven integration testing remains manual via DevTools | Zero npm/build dependency matches anti-stack rule; pure ES modules already import-compatible with Node; tests must never reach the browser (no app-shell impact, GH Pages stays vanilla) | Locked 2026-05-26; introduce starting Phase 2 (first phase with testable logic — schema migrations, date utils, cadence engine) |
| D-24: GitHub Actions CI runs `node --test tests/` on push to `main` and on every PR; single `.github/workflows/test.yml`, `actions/setup-node@v4`, no other automation in v1 | Single-source automated regression gate; free for personal/public repos; ~10 s/run; matches D-23 (Node tests only, no browser, no install) | Locked 2026-05-26; ships in Phase 2 alongside the first testable module |
| D-25: Integration tests live in Node alongside unit tests; module composition (seed → schema → repo → derived view-model; JSON export ↔ import round-trip) uses a hand-written ~30-line in-memory fake IDB repo with same surface as the real `js/db/repo.js`. Real-IDB integration testing stays in `tests-browser.html` (manual, excluded from SW SHELL) | Catches cross-module invariants without a DOM polyfill or IDB shim from npm; mirrors the project's "small hand-written wrappers" pattern; keeps CI deterministic | Locked 2026-05-26; Phase 2 (storage spine) is the first consumer |
| D-26: UI / component testing has two tiers — Tier 1: pure view "builder" modules that return descriptions (`{tag, attrs, children}`) are unit-tested in Node; Tier 2: a static `tests-browser.html` harness mounts real components and asserts on DOM/SW state, opened manually before commits. No DOM polyfill. `tests-browser.html` is excluded from `sw.js` SHELL list | TDD on UI structure without dragging in jsdom/Happy DOM; manual browser smoke retains the realism needed for SW/IDB behavior; keeps app-shell footprint untouched | Locked 2026-05-26; introduce starting Phase 3 (Today view) when the first non-trivial UI lands |
| TDD mode: `workflow.tdd_mode = true` from Phase 2 onward; Phase 1 (already committed, pure scaffolding) is exempt by virtue of completion + non-MVP mode | Phase 2+ already marked `**Mode:** mvp` in ROADMAP; MVP+TDD gate becomes blocking — every behavior-adding task must have a preceding RED test commit | Locked 2026-05-26; effective starting `/gsd-plan-phase 2` |
| D-27: JSDoc as the standard for file headers and exported APIs. File-level: `/** @file <summary>. <rationale> */` block at top of every `.js` file. Exported functions: `/** desc @param {Type} name desc @returns {Type} desc */`. Exported constants with non-obvious type: `/** @type {Type} */`. Inline `//` comments still allowed inside function bodies for "why this is non-obvious" notes; banned for one-line restatements of what the next line does | Editor type hints + structured API docs without a TypeScript build step — fits the zero-build constraint exactly; eliminates the current mix of `//`-block headers and `/** */` function docs | Locked 2026-05-26; Phase 1 source files retro-converted in a single `style(01): standardize ...` commit; effective from Phase 2 onward without exception |
| D-28: `APP_VERSION` follows [Semantic Versioning 2.0.0](https://semver.org/). **Starting value `'0.1.0'`** — per SemVer §4, the `0.y.z` range signals "initial development; public API not yet stable" and stays in that range until the v1.0 milestone (Phase 6) is sealed. During `0.y.z`: PATCH (`0.1.0` → `0.1.1`) for bug fixes / shell-asset-only changes; MINOR (`0.1.0` → `0.2.0`) for phase completions, breaking changes, or new features. MAJOR stays at `0` until v1.0 ships. After `1.0.0`: standard MAJOR (breaking) / MINOR (additive) / PATCH (fix) semantics; every `schemaVersion` migration bumps MAJOR. Cache name derives directly: `habits-${APP_VERSION}` (no `v` literal prefix). Full policy in `VERSIONING.md` at the project root | Industry-standard versioning scheme; the `0.y.z` range honestly signals pre-stable; lets future automation reason about version comparison if ever needed; aligns the cache-name format with what `sw.js` literally produces | Locked 2026-05-26 (initial), refined 2026-05-26 to `'0.1.0'` per user preference; Phase 1 source + docs retro-converted from `'v1'`/`nawyki-v1` to `'0.1.0'`/`habits-0.1.0` |
| D-29: Service worker is a **module** service worker (`navigator.serviceWorker.register('./sw.js', { type: 'module' })`); `sw.js` imports `APP_VERSION` via ES module from `js/util/version.js` instead of the classic-SW `importScripts(...)` pattern originally planned. The classic + importScripts plan was broken — `importScripts` evaluates as classic script, where `export const` is a SyntaxError, causing the install handler to reject and the SW to never activate (Phase 1 human-verify gate caught this). Cache name prefix renamed from `nawyki-` to `habits-` (the public-facing app name; D-10 stipulates a versioned cache but never locked the prefix) | Module SWs have been Baseline since Firefox 114 (Jun 2023) and Safari 16 (Sep 2022) — the 2023-era research warning in RESEARCH.md §Pitfall 4 is stale. Module SW preserves D-12 single-source-of-truth verbatim with no two-file drift risk. The `habits-` prefix matches the public-facing project name | Locked 2026-05-26 (during Phase 1 human-verify gate); Phase 1 source updated (sw.js, sw-register.js, version.js, diagnostics.js cache-prefix regex) and 01-02-PLAN.md must_haves / acceptance criteria retro-updated to match; 01-02-SUMMARY.md carries a "Post-execution fix" note explaining the deviation |
| D-30: Namespace alignment — every public-facing namespace (manifest name, SW cache prefix, IDB DB name, `BroadcastChannel` channel name, CSV export filename prefix) uses the single identifier `habits` instead of the legacy `nawyki`; `BroadcastChannel('habits')`, IDB DB `habits`, cache prefix `habits-${APP_VERSION}`, CSV `habits-completion-YYYY-MM-DD.csv` | Single source of truth for the app's public identifier; matches `nawyki-` → `habits-` cache rename from D-29; eliminates cross-file drift between SW, DB, and pub/sub layers | Locked 2026-05-26 (Phase 2); applied across `js/db/schema.js`, `js/platform/sync.js`, `sw.js`, and forward-edits in this PROJECT.md / CLAUDE.md / ARCHITECTURE.md alignment |
| D-39: IndexedDB schema v1 carries **seven** stores, not six — the original ARCHITECTURE list of 6 stores is superseded. v1 stores are `habits`, `habit_versions`, `logs`, `events`, `settings`, `meta`, `score_snapshots`. `score_snapshots` (keyPath `[habitId, date]`, indexes on `date` and `habitId`) is declared empty in v1 and starts being written in Phase 6 when scoring lands | Declaring the snapshots store at v1 means no v2 migration is needed when Phase 6 starts writing rows — the schema is forward-compatible without DB upgrade; matches D-19 "scoring is a snapshotted projection, not a recompute" | Locked 2026-05-26 (Phase 2); shipped in `js/db/schema.js` plan 02-02 |
| D-40: The `habits` store carries an optional `name_pl` string field alongside the primary English `name`. Source-derived habits (from the original 47-week xlsx seed) populate both. User-created habits default `name_pl: null`. No separate `i18n` layer | Minimum-viable bilingual storage that preserves the user's existing Polish identifiers without adding a translation framework or `Intl.LocaleMatcher` dependency; honors the no-npm constraint | Locked 2026-05-26 (Phase 2); shipped in `seed/habits.json` + the schema's habit row shape (plan 02-04) |
| D-42: The `events` store uses a string UUID keyPath (`crypto.randomUUID()`-generated) instead of `autoIncrement: true`. Events still have chronological order via the `at` index on the timestamp column. Cross-device imports merge by UUID without primary-key collision risk | Autoincrement keys collide when merging two export files from different devices (both would start at 1); UUIDs make the JSON-import "merge by id" semantic (D-5) safe for events too, not just habits and logs | Locked 2026-05-26 (Phase 2); shipped in `js/db/schema.js` plan 02-02 |
| D-43: 4-state log model — `logs` store rows carry `status: 'completed'|'failed'|'skipped'`. The fourth state (undefined/not-logged) is represented by the **absence** of a row, not a null status field. `markCompleted` writes `status: 'completed'`; `markUncompleted` writes `status: 'failed'`; `markSkipped` writes `status: 'skipped'` (does not trigger D-52 lastCompletedDate). The legacy `completed: boolean` field is retired. CSV export maps all 4 states to cell values: `'1'` (completed), `'0'` (failed or absent on applicable day), `'x'` (skipped or non-applicable cadence day) | Single field `status` is unambiguous at every call-site; absence-as-undefined keeps IDB free of phantom rows and simplifies query logic (row-absent vs null-status collapse to one check); `markUncompleted` writes `status:'failed'` rather than deleting the row — deletion would break streak continuity and erase the explicit "consciously failed" signal from the log history; undo also becomes simpler with a restore event vs a re-insert; the skipped state allows a distinct "I consciously skipped" signal that maps to `'x'` in CSV without inflating the 0-failure count; backwards-compat: `import.js` normalizes legacy `completed:boolean` fields in v1 backup files (`true`→`'completed'`, `false`→`'failed'`) so old exports remain importable without data loss | Shipped 2026-08-28 (quick-task 260828-o1g); validated Phase 11 (tests + round-trip); stale-caller hotfix in Plan 13-01 (2026-09-08) |
| D-44: EN/PL i18n architecture — locale dictionaries are flat ES module exports (`js/i18n/en.js`, `js/i18n/pl.js`) with no namespace nesting and no `Intl.*` API. The `t(key, subs)` function in `js/i18n/index.js` resolves keys from the active locale dict and substitutes `{name}` single-brace placeholders from the `subs` object; falls back to the `en` dict on missing keys, then to the key itself. Locale preference is stored in `localStorage` under key `'habits-lang'` (the "tiny UI preference" exception to the IDB-first policy — also null-safe in Node test env via a `typeof localStorage` guard). Language change writes to `_lang` + localStorage then calls `location.reload()` | Flat ES-module dicts need no JSON loader, no `Intl.LocaleMatcher`, and no npm package — fits the zero-build no-npm constraint; the full i18n surface is statically analysable by editors. `localStorage` is the project's sanctioned exception for "tiny UI preferences" (CLAUDE.md anti-stack note); the null-safe `_storage` capture pattern means tests and service workers need no localStorage mock. `location.reload()` on language change avoids partial-render state bugs that a live re-render strategy would risk — simpler correctness guarantee for a one-user app | Shipped 2026-08-28 (quick-task 260828-00l); validated Phase 10 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current Milestone: v1.2 UX & i18n Quality Gate

**Goal:** Retroactively validate and harden the 6 quick-task features (i18n, 4-state log model, swipe UX, nav/sidebar) so they meet project quality standards — tests, code review, UX completeness, and decision documentation.

**Target features:**
- EN/PL i18n — language toggle, locale dictionaries, t() wired across all views
- 4-state log status (completed/failed/skipped/undefined) — domain model + swipe UX on Today
- History screen swipe UX — 4-state interaction model
- Analytics footer nav — moved from settings panel
- Desktop sidebar collapse toggle
- Waveboard scores fix + daily snapshot rebuild

---

## Last Shipped: v1.1 Scheduled Habits

**Shipped:** 2026-08-27 · Phases 7–9 · 9 plans · 169 commits · 57 days

**Delivered:**
- `scheduled` as a 4th first-class habit status (alongside active/mastered/archived)
- Auto-transition on boot: `scheduled` → `active` when startDate ≤ today
- One-time migration: existing habits with `status:'active'` and future startDate reclassified
- Catalog Upcoming section: scheduled habits sorted by startDate, each showing wave + startDate
- Manual promote-to-active from Catalog Upcoming and desktop Waveboard
- Desktop Waveboard: per-wave rows showing active/scheduled counts + drillable habit lists with startDates
- Converter (`convert-nawyki.js`) updated to emit `status:'scheduled'` for future-start habits
- JSON import preserves `status:'scheduled'` through mergeImportedStores

---
*Last updated: 2026-08-31 after Phase 11 (4-State Log Model Tests)*
