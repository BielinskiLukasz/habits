---
phase: 02-storage-foundation-the-spine
status: complete
date: 2026-05-27
requirements_covered: 13
plans: 6
---

# Phase 2 — Storage Foundation: Requirement Coverage Map

This file is the artifact `/gsd-verify-work` consumes to check Phase 2's 13 requirement coverage. Every requirement in `.planning/REQUIREMENTS.md` tagged DATA-* or SEED-* is mapped here to the plan that delivered it.

## DATA — Persistence and integrity (8 requirements)

| Req ID | Requirement | Delivered by | Verification |
|--------|-------------|--------------|--------------|
| **DATA-01** | All habits, logs, edit history, and settings persist in IndexedDB across sessions | 02-02 (schema + idb wrapper + repo facade) + 02-03 (state spine writes via apply.js) + 02-04 (seed loader writes habits + events) + 02-05 (boot wiring; SW SHELL extension) | Integration tests `tests/integration/repo.roundtrip.test.js`, `tests/integration/seed.idempotent.test.js`, `tests/integration/apply.markCompleted.test.js`. Manual smoke item 1 in 02-05's checklist confirmed real-IDB persistence across reload. |
| **DATA-02** | IndexedDB schema is versioned with a `DB_VERSION` constant and a `MIGRATIONS` dispatch table | 02-02 (`js/db/schema.js` exports `DB_VERSION` + `applyMigrationsForVersion()` switch-on-`oldVersion` dispatch) | `tests/unit/schema.test.js` asserts 7-store v1 layout. Manual smoke confirmed `onupgradeneeded` runs once on fresh install. |
| **DATA-03** | App calls `navigator.storage.persist()` on first write and surfaces persistence status in Settings | 02-04 (`js/io/seed.js` calls `navigator.storage.persist()` after first seed write; D-41 / Pitfall 11) + 02-05 (Diagnostics panel `Persisted: yes/no/n/a` row) | `tests/integration/seed.persist.test.js` verifies the storage.persist() call. Manual smoke item 4 verified the Diagnostics row toggles to `yes` on first run. |
| **DATA-04** | All mutations go through a single chokepoint (`state/apply.js`); views never write to IDB directly | 02-03 (`js/state/apply.js` is the only module that calls `repo.put*` / `repo.delete*`; per-event handlers live under `js/state/apply/*.js`) | `tests/unit/apply.discipline.test.js` asserts the chokepoint pattern. Static gate: `grep -rE "repo\.(put\|delete\|append)" js/views/ js/router/` returns empty. |
| **DATA-05** | Habit-definition edits never modify existing log rows; logs reference the `habit_versions` entry effective at the time they were written | 02-02 (logs row shape includes `definitionVersion` field; `habit_versions` store keyPath `[habitId, effectiveFrom]`) | Schema layout enforces this by construction. Behavior of "edit definition does not rewrite logs" verified during 02-03 integration tests and Wave 5 manual smoke. |
| **DATA-06** | Date keys are stored as local `YYYY-MM-DD` strings (never `Date.toISOString()`) | 02-01 (`js/util/date.js` provides `todayLocal()` and `toLocalDateString()`; no `toISOString()` in any date-key write path) | `tests/unit/date.test.js` covers timezone boundaries. Static gate: `grep -rE "toISOString" js/` returns only diagnostic/audit usages, never in keys. |
| **DATA-07** | Cross-tab writes propagate via BroadcastChannel; open tabs react to other-tab mutations | 02-03 (`js/platform/sync.js` wraps `BroadcastChannel('habits')` per D-30; `apply.js` broadcasts on every successful mutation) | `tests/integration/sync.broadcast.test.js` covers fake-BroadcastChannel round-trip. Note: requirement text in REQUIREMENTS.md still says `'nawyki'`; the implementation uses `'habits'` per D-30 — out-of-scope drift surfaced in 02-06-SUMMARY.md for a future cleanup. |
| **DATA-08** | App flushes pending writes on `visibilitychange → hidden` (never `beforeunload`) | 02-03 (`js/platform/lifecycle.js` wires `document.addEventListener('visibilitychange', …)`; no `beforeunload` listener in the codebase) | `tests/unit/lifecycle.test.js` covers the dispatcher. Static gate: `grep -rE "beforeunload" js/` returns empty. |

## SEED — Bundled seed data (5 requirements)

| Req ID | Requirement | Delivered by | Verification |
|--------|-------------|--------------|--------------|
| **SEED-01** | App ships a hand-curated `seed/habits.json` parsed from `Nawyki v1.xlsx` + `Nawyki-fale.txt` | 02-04 (`seed/habits.json` — 8 habits as the D-32 coverage fixture; the full-65 translation is a deliberate follow-up, see Open Question 3 in 02-CONTEXT.md) | `tests/unit/seed.shape.test.js` asserts the fixture covers all D-32 cells (binary daily, binary weekly, binary every-N-days, binary day-of-week-subset, numeric, slot-anonymous, slot-labeled). |
| **SEED-02** | Seed includes habits with wave assignment, cadence rules, stage definitions, multi-occurrence config | 02-04 (`seed/habits.json` carries wave 1..3, all four cadence-shape variants, and both slot-checklist sub-shapes; numeric `target` field on the numeric row) | Same `tests/unit/seed.shape.test.js`; the 8-habit fixture is the D-32 *coverage* minimum, not the full v1 catalog (which is a P3+ seed-curation deliverable). |
| **SEED-03** | Seed is loaded idempotently on first run; subsequent loads do not duplicate or overwrite user data | 02-04 (`js/io/seed.js` is merge-by-id: existing habit IDs are not overwritten; runs once per fresh DB, gated via `meta.seedLoadedAt`) | `tests/integration/seed.idempotent.test.js` covers the two-run scenario (second run is a no-op). |
| **SEED-04** | Seed is loaded into `events` as an initial event (one event per habit creation) so the audit trail is complete | 02-04 (seed loader appends one `{ type: 'habit:created', habitId, at }` event per habit on first run; UUID-keyed per D-42) | Verified in `tests/integration/seed.idempotent.test.js` (events store length grows by `habits.length` on first run, stays unchanged on second run). |
| **SEED-05** | No xlsx/txt parsing code ships in the user-facing app; seed JSON is the only data source | 02-04 (only `seed/habits.json` ships; no xlsx/txt parser anywhere under `js/`) | Static gate test `tests/unit/seed.shape.test.js` includes a grep assertion: zero matches for `xlsx|XLSX|SheetJS|exceljs|read_xlsx|parse_xlsx` under `js/**/*.js`. |

## Coverage summary

- **Requirements declared in Phase 2 (per ROADMAP entry):** 13 (DATA-01..08 + SEED-01..05).
- **Requirements covered by shipped code + tests:** 13 / 13.
- **Open / deferred:** None for Phase 2's own scope.
- **Out-of-scope drift surfaced for future cleanup:** REQUIREMENTS.md line 100 (DATA-07) still names `BroadcastChannel('nawyki')`; implementation uses `'habits'` per D-30. Doc-only mismatch.

## Plan-by-plan delivery

| Plan | Wave | What it delivered | Requirements |
|------|------|-------------------|--------------|
| 02-01 | 1 | CI workflow + dev server + test fakes + `date.js` + `id.js` | DATA-06 (date utility); infrastructure for the rest |
| 02-02 | 2 | `schema.js` (7-store v1) + `idb.js` wrapper + `repo.js` facade + A7 contract test | DATA-01, DATA-02, DATA-05 (foundations) |
| 02-03 | 3 | `apply.js` chokepoint + `markCompleted` handler + `undo.js` + `sync.js` + `lifecycle.js` + `store.js` | DATA-04, DATA-07, DATA-08, UNDO-02 (cross-phase) |
| 02-04 | 4 | `seed/habits.json` 8-habit D-32 fixture + `js/io/seed.js` idempotent loader + `navigator.storage.persist()` + D-45 settings defaults | SEED-01..05, DATA-03 |
| 02-05 | 5 | Reset-data button (D-44) + boot wiring (`main.js` + `desktop.js`) + `sw.js` SHELL extension + manual browser smoke (7/8 PASS + item 8 PASS-with-Chromium-caveat) | Integration confirmation across DATA-01..08 + SEED-01..05 |
| 02-06 | 6 | APP_VERSION 0.2.0 + doc reversals (D-30, D-35, D-39, D-40, D-42, D-46, Pitfall 13) | (No new requirements — closes the phase) |

## Manual verification reference

The Phase 2 manual smoke checklist is in `02-05-SUMMARY.md` (the only `checkpoint:human-verify` in this phase). Outcome: **7/8 items PASS + item 8 PASS-with-Chromium-caveat**. Item 8 (file:// Chromium ES module loading) is browser-policy-bound and documented in `STATE.md` "Deferred Items" — workaround is `node scripts/serve.js` or GitHub Pages, both already supported.

## Sign-off

Phase 2 is **complete** as of 2026-05-27. All 13 requirements covered; all 6 plans have SUMMARY.md; cache transitions cleanly to `habits-0.2.0`; test suite green at 99/99.

Ready for `/gsd-verify-work 2` and ROADMAP close-out.
