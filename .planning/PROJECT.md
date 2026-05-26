# Nawyki — Personal Habit Tracker

## What This Is

A personal, offline-first habit-tracking web app that formalizes the existing "Nawyki" system (47-week 2026 wave plan, ~65 habits across 10 themed waves) into a long-term, multi-year tool. Built as a static multi-file HTML/JS/CSS app — same minimalist spirit as `mindful-breathing` (no backend, no framework, no build tool) — but with richer client-side state in IndexedDB.

Intended for a single user (the author) on personal devices: mobile-first for daily check-in, desktop-first for analytics and planning.

## Core Value

**Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.**

Everything else — scoring, ranking, dashboards — can fail. Daily check-in and the underlying habit model cannot.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- v1 hypotheses. Refined further in REQUIREMENTS.md. -->

- [ ] Daily check-in view (Today) — mobile-first, mark/unmark habits, log counts
- [ ] Habit catalog — CRUD with stages, cadence, day-of-week rules, multi-occurrence targets, per-habit threshold/window overrides
- [ ] Multi-occurrence logging — both `+1` numeric and slot-checklist styles (slots can be user-labeled or anonymous, per habit)
- [ ] Stage progression — each habit may declare any combination of advancement triggers: manual button, scheduled by wave week, automatic after N days at current stage
- [ ] Threshold-based "mastered" badge — per-habit % threshold over rolling N-day window, defaults 90% / 70 days, both configurable globally and overridable per habit; mastered habits stay visible on Today, just muted
- [ ] Day-of-week and "every N days" cadence engine (`[nd]`, `[sb]`, `[pn-pt]`, "co 2 dni"…)
- [ ] Wave/Fala model — habits tagged with a wave; waves have aggregate metrics (completion %, count by status, longest active streak, "wave at risk")
- [ ] History — navigate any past day, mark habits as not-completed; bulk "mark all not-yet-completed as uncompleted" on a given day; per-habit edit history; undo last action
- [ ] Habit edits don't rewrite history — definition changes apply forward only; the habit identity is preserved
- [ ] Seeded data — hand-curated JSON bundled with the app, parsed once from `Nawyki v1.xlsx` + `Nawyki-fale.txt`
- [ ] JSON export/import — manual backup/restore from IndexedDB (full fidelity, round-trippable)
- [ ] CSV export — flattened table-shaped export of logs and habit definitions, so the data can be pasted into Excel for ad-hoc analysis (read-only; not used for import)
- [ ] PWA — installable, works offline
- [ ] Desktop analytics layout — separate, richer layouts for stats/planning views (not just a wider Today)
- [ ] Scoring model — research phase to propose 2-3 alternatives, user picks one for v1

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
- **UI language**: English UI chrome; Polish habit names preserved verbatim (user data). — *Confirmed during questioning.*
- **Layout split**: Mobile and desktop are truly different layouts (not one responsive layout), because they serve different jobs — mobile = check-in, desktop = analytics/planning. — *Confirmed during questioning.*
- **History integrity**: Habit-definition edits never rewrite historical logs; the habit identity is preserved across edits. — *Confirmed during questioning. Critical to data trustworthiness.*
- **Privacy**: No telemetry, no analytics, no network calls except what the user explicitly triggers (export/import). — *Personal data; single-user app.*

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla multi-file static app (no build) | Mirrors `mindful-breathing`; zero-dependency longevity | — Pending |
| IndexedDB + JSON export/import (not localStorage, not cloud) | Capacity for years of logs; manual backup is acceptable for a personal tool | — Pending |
| English UI, Polish habit names (data) | UI cleanliness without translating user content; no i18n layer | — Pending |
| Seed data as bundled hand-curated JSON | Faster v1, no importer code in-app, future-resilient | — Pending |
| Two export formats: JSON (full backup, round-trippable) + CSV (flattened, Excel-pasteable, read-only) | JSON for the app, CSV for the user's Excel-based ad-hoc analysis habits | — Pending |
| Threshold model: 90% / 70 days, configurable globally + per-habit override | Matches existing xlsx model exactly; allows per-habit tuning that the spreadsheet already required | — Pending |
| Graduation: stay on Today, muted/badged (don't hide) | User wants to keep "feeding" mastered habits without pressure | — Pending |
| Stage advancement: multiple triggers per habit (manual OR scheduled-by-week OR after-N-days), composable | Honors the diversity in the existing system (some habits step up by calendar, some by effort, some on-demand) | — Pending |
| Multi-occurrence UX: numeric +1 counter AND slot-checklist (with optional user-defined slot labels), choice per habit | Different habits naturally want different UX (5 things to be grateful for vs 7 meatless meals) | — Pending |
| Mobile-first daily check-in, desktop-first analytics — distinct layouts | Recognizes that the two jobs have different ergonomics | — Pending |
| History edits don't overwrite prior state (partial completions persist as "uncompleted but data retained"); per-habit edit history + global undo | History must be trustworthy and recoverable | — Pending |
| Scoring model deferred to research (3 alternatives → user picks) | The xlsx's "WYNIK SKORYGOWANY" is a candidate but not the only good answer; this deserves a deliberate redesign | — Pending |
| Ongoing tool, multi-year (waves are seed plan, not a hard endpoint) | The 47-week plan is the first wave plan, not the whole product | — Pending |
| Reminders/notifications OUT of v1 | User explicitly opted out for now; revisit later | — Pending |
| D-23: Unit tests use Node's built-in `node --test` runner; tests live in `tests/` (excluded from SW shell and GH Pages deploy); cover pure-function modules only (domain logic, db migrations, utils); browser-driven integration testing remains manual via DevTools | Zero npm/build dependency matches anti-stack rule; pure ES modules already import-compatible with Node; tests must never reach the browser (no app-shell impact, GH Pages stays vanilla) | Locked 2026-05-26; introduce starting Phase 2 (first phase with testable logic — schema migrations, date utils, cadence engine) |
| D-24: GitHub Actions CI runs `node --test tests/` on push to `main` and on every PR; single `.github/workflows/test.yml`, `actions/setup-node@v4`, no other automation in v1 | Single-source automated regression gate; free for personal/public repos; ~10 s/run; matches D-23 (Node tests only, no browser, no install) | Locked 2026-05-26; ships in Phase 2 alongside the first testable module |
| D-25: Integration tests live in Node alongside unit tests; module composition (seed → schema → repo → derived view-model; JSON export ↔ import round-trip) uses a hand-written ~30-line in-memory fake IDB repo with same surface as the real `js/db/repo.js`. Real-IDB integration testing stays in `tests-browser.html` (manual, excluded from SW SHELL) | Catches cross-module invariants without a DOM polyfill or IDB shim from npm; mirrors the project's "small hand-written wrappers" pattern; keeps CI deterministic | Locked 2026-05-26; Phase 2 (storage spine) is the first consumer |
| D-26: UI / component testing has two tiers — Tier 1: pure view "builder" modules that return descriptions (`{tag, attrs, children}`) are unit-tested in Node; Tier 2: a static `tests-browser.html` harness mounts real components and asserts on DOM/SW state, opened manually before commits. No DOM polyfill. `tests-browser.html` is excluded from `sw.js` SHELL list | TDD on UI structure without dragging in jsdom/Happy DOM; manual browser smoke retains the realism needed for SW/IDB behavior; keeps app-shell footprint untouched | Locked 2026-05-26; introduce starting Phase 3 (Today view) when the first non-trivial UI lands |
| TDD mode: `workflow.tdd_mode = true` from Phase 2 onward; Phase 1 (already committed, pure scaffolding) is exempt by virtue of completion + non-MVP mode | Phase 2+ already marked `**Mode:** mvp` in ROADMAP; MVP+TDD gate becomes blocking — every behavior-adding task must have a preceding RED test commit | Locked 2026-05-26; effective starting `/gsd-plan-phase 2` |

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

---
*Last updated: 2026-05-26 after initialization*
