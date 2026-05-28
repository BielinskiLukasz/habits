---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 03 plan 03-06 complete — Phase 3 shippable; SW SHELL extended with 11 P3 files, APP_VERSION 0.2.0 → 0.3.0, README + VERSIONING release notes; 279 tests green; ready for /gsd-verify-work 3
last_updated: "2026-05-28T14:00:00Z"
last_activity: 2026-05-28 -- Plan 03-06 complete (SHELL coverage regression guard + APP_VERSION bump + docs; Phase 3 closeout)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 13
  completed_plans: 12
  percent: 46
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.
**Current focus:** Phase 03 — today-view-settings-v1-first-usable-slice

## Current Position

Phase: 03 (today-view-settings-v1-first-usable-slice) — EXECUTING (closeout shipped — ready for UAT)
Previous: Phase 02 (storage-foundation-the-spine) — COMPLETE + VERIFIED (10/10 UAT pass, 2026-05-27)
Plan: 6 of 6 — ALL P3 plans shipped; awaiting `/gsd-verify-work 3` UAT
Status: Phase 3 implementation complete; closeout done; APP_VERSION = 0.3.0
Last activity: 2026-05-28 -- Plan 03-06 complete (SHELL coverage regression guard + APP_VERSION bump + docs; Phase 3 closeout)

Progress: [████████████████████░░░░░░░░░░] 46% (12 of 26 phase+plan slots; Phase 3 plans 1+2+3+4+5+6 of 6 shipped)

## Resume Instructions

**Plan 03-06 shipped** — Phase 3 is shippable end-to-end:

- `sw.js` SHELL extended by 11 P3 files per D-81: `./js/router.js`, `./js/views/today.js`, `./js/views/today/builders.js`, `./js/views/settings.js`, `./js/views/settings/builders.js`, `./js/domain/cadence.js`, `./js/domain/wave.js`, `./js/util/mount.js`, `./js/state/apply/markUncompleted.js`, `./js/state/apply/setSetting.js`, `./css/settings.css`. `seed/waves.json` stays out of SHELL (SWR exception).
- `APP_VERSION` bumped `0.2.0` → `0.3.0` in `js/util/version.js` (D-28 MINOR-on-phase-completion). Cache auto-derives to `habits-0.3.0`; activate handler deletes the prior cache; existing D-08 update-toast fires for users still on 0.2.0.
- `tests/integration/sw.shell.test.js` — 4 regression-guard tests: P2 baseline preserved, P3 required present, `seed/waves.json` NOT in SHELL (SWR exception), every SHELL entry resolves to a real file on disk (T-03-41).
- `README.md` — new "Version history" section listing v0.1.0 / v0.2.0 / v0.3.0 with one-line summaries.
- `VERSIONING.md` — new "Release history" section with v0.3.0 entry (what shipped + bump rationale + cache invalidation + D-decision range D-48..D-81); back-filled v0.1.0 and v0.2.0 entries.
- 275 → 279 tests green (+4 new SHELL coverage tests).

All 17 in-scope P3 requirements (CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07) are functionally complete.

Next steps in order:

1. `/gsd-verify-work 3` — UAT against the 5 ROADMAP Phase 3 success criteria. Open `node scripts/serve.js` + `http://localhost:8080/`; verify tap → toast → undo → settings flow end-to-end.
2. After UAT signs off: begin Phase 4 planning (Domain Model: cadence engine full surface, catalog CRUD, stages, mastery, multi-occurrence logging, history navigation, wave aggregates).

Open follow-up (docs drift, non-blocking):

- PHASE-COMPLETION.md DATA-03 row says `meta.seedLoadedAt`; actual gate is `meta.seededIds` + `meta.persistResult` per `js/io/seed.js:108`. Logged in `02-UAT.md` Docs Drift section.

### What's done so far (this session)

| Wave | Plan | Status | Commits |
|------|------|--------|---------|
| 1 | 02-01 | ✓ Complete | CI workflow + dev server + test fakes + `date.js` + `id.js` (7 commits, merged) |
| 2 | 02-02 | ✓ Complete | `schema.js` (7-store v1) + `idb.js` wrapper + `repo.js` facade + A7 contract test (7 commits, merged) |
| 3 | 02-03 | ✓ Complete | `apply.js` chokepoint + `markCompleted` + `undo.js` + `sync.js` + `lifecycle.js` + `store.js` (9 commits, merged) |
| 4 | 02-04 | ✓ Complete | `seed/habits.json` 8-habit fixture + `js/io/seed.js` idempotent loader + persist() + D-45 defaults (5 commits, merged) |
| 5 | 02-05 | ✓ Complete | Reset-data + boot wiring + sw.js SHELL + smoke (4 implementation commits + 1 smoke-fix commit `389b9d9` + SUMMARY); 7/8 smoke items full PASS + item 8 PASS-with-Chromium-caveat |
| 6 | 02-06 | ✓ Complete | CLAUDE.md / PROJECT.md / README.md doc reversals + ARCHITECTURE.md forward-edits + APP_VERSION 0.1.0 → 0.2.0 + SUMMARY + PHASE-COMPLETION (7 commits, inline on main — worktree agent dropped connection mid-Task-1, see 02-06-SUMMARY.md deviations) |
| P3-1 | 03-01 | ✓ Complete | Pure-domain foundations: `js/domain/cadence.js` + `js/domain/wave.js` + `seed/waves.json` + `js/util/mount.js` + 4 new util/date.js helpers + 2 new repo methods (`getAllHabits` / `getLogsInRange`) + D-78 grep-gate; 10 atomic commits (5 test + 5 feat); 100 → 174 tests green |
| P3-2 | 03-02 | ✓ Complete | Today renders: `js/router.js` + `js/views/today.js` + `js/views/today/builders.js` + expanded `js/state/store.js` cache + `index.html` 3-section shell + `js/main.js` router wiring + `css/today.css` extensions; 6 atomic commits (2 test + 4 feat); 174 → 209 tests green |
| P3-3 | 03-03 | ✓ Complete | Tap-to-log: `js/state/apply/markUncompleted.js` (D-74 handler + D-52 shared invariant) + `js/state/apply/markCompleted.js` rewired + `js/state/apply.js` (HANDLERS + notify DI) + `js/state/store.js` async notify w/ refresh + `js/db/repo.js` getLogsByHabit + `js/views/today.js` tap closures + optimisticFlip + revertRow; 6 atomic commits (3 test + 3 feat); 209 → 232 tests green |
| P3-4 | 03-04 | ✓ Complete | Undo toast surface: `js/views/toast.js` extended (`_showToast` internal helper + `showUndoToast` D-69/D-70/D-71 + `showErrorToast` D-73 + `_resetToastForTest`; `showUpdateToast` STRUCTURALLY preserves D-08 by delegating WITHOUT autoDismissMs) + `js/views/today.js` wires both onto tap success/reject (console.warn placeholder REMOVED) + `tests/integration/today.tap.test.js` Rule 1 fix for ambient globalThis.document + `.remove()` on fake elements; 4 atomic commits (2 test + 2 feat); 232 → 249 tests green |
| P3-5 | 03-05 | ✓ Complete | Settings v1: `js/state/apply/setSetting.js` (D-75 self-inverting chokepoint handler) + `js/state/apply.js` HANDLERS extension + `js/views/settings/builders.js` (5 pure builders) + `js/views/settings.js` (mountSettings composes 5 cards, subscribes to D-72 notify, wires action closures through apply/undo) + `css/settings.css` + `css/main.css` @import + `index.html` h1 slot + `js/main.js` route function; 6 atomic commits (3 test + 3 feat); 249 → 275 tests green |
| P3-6 | 03-06 | ✓ Complete | Phase 3 closeout: `tests/integration/sw.shell.test.js` (D-81 SHELL coverage regression guard — P2 baseline + P3 required + SWR exception + on-disk existence) + `sw.js` SHELL +11 entries + `js/util/version.js` APP_VERSION 0.2.0 → 0.3.0 (D-28) + `README.md` Version history section + `VERSIONING.md` Release history section (v0.3.0 + back-filled v0.1.0/v0.2.0); 3 atomic commits (1 test + 1 feat + 1 docs); 275 → 279 tests green |

Test suite: **279/279 green** at HEAD `75a3638`.

Phase 2 inherits the conventions locked during Phase 1:

  - SemVer (D-28) — bump to 0.2.0 when Phase 2 ships (Wave 6 owns this)
  - Module SW (D-29) — already in place; don't touch
  - JSDoc (D-27) — all new files start with /** @file ... */
  - Tests (D-23..D-26) — node --test in CI on Node 20
  - TDD (workflow.tdd_mode=true) — RED→GREEN enforced per behavior-adding task

## Performance Metrics

**Velocity:**

- Total plans completed (since metric tracking began): 6
- Average duration: ~36 min
- Total execution time: ~215 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. PWA Shell & Tooling Hygiene | 5 | — | — |
| 2. Storage Foundation | 0 | — | — |
| 3. Today View & Settings v1 | 6 | 215m | ~36m |
| 4. Domain Model | 0 | — | — |
| 5. Backup & Restore | 0 | — | — |
| 6. Desktop Analytics & Scoring | 0 | — | — |

**Recent Trend:**

- Last plan: 03-06 — 15 min, 3 tasks, 5 files (1 new test + 1 SW edit + 1 version edit + 2 docs), 4 new tests, 3 atomic commits (T1 TDD + T2 GREEN/feat + T3 docs). No deviations.
- Prior plan: 03-05 — 35 min, 3 tasks, 11 files, 26 new tests, 6 atomic commits.
- Prior plan: 03-04 — 40 min, 2 tasks, 5 files, 17 new tests, 4 atomic commits.
- Prior plan: 03-03 — 70 min, 3 tasks, 11 files, 23 new tests, 6 atomic commits (notify DI seam — Pitfall 9 variant)
- Prior plan: 03-02 — 22 min, 4 tasks, 9 files, 35 new tests, 6 atomic commits
- Prior plan: 03-01 — 33 min, 5 tasks, 12 files, 74 new tests, 10 atomic commits
- Trend: TDD per-task (RED → GREEN) holding clean across all 6 phase-3 plans. Closeout (03-06) was the lightest plan of the phase at 15 min.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Locked at roadmap creation:

- Stack: vanilla multi-file HTML/JS/CSS, two HTML shells, raw IndexedDB, no framework/bundler/npm
- 7 IDB stores: habits, habit_versions, logs, events, settings, meta, score_snapshots
- Architecture spine: date → idb → schema → repo → seed → store/apply → sync → lifecycle → SW → router → today view
- Scoring: S1/S2/S3 all three implemented with Settings toggle; S1 default
- CSV delimiter: `;` (semicolon), UTF-8 BOM, CRLF
- Undo persists across reload via `meta.undoToken`
- Mobile↔desktop: explicit Settings link, no auto-redirect
- Definition edits NEVER rewrite history (versioned via `habit_versions`)
- Distinct mobile + desktop DOMs (not responsive)

Locked during Phase 1 execution (2026-05-26):

- D-23: Unit tests use Node's built-in `node --test`; tests live in `tests/` (excluded from SW shell and GH Pages deploy); pure-function modules only
- D-24: GitHub Actions CI runs `node --test tests/` on push/PR; single workflow file; ships in Phase 2
- D-25: Integration tests in Node via hand-written ~30-line in-memory fake IDB repo (same surface as real `js/db/repo.js`); real-IDB integration stays in `tests-browser.html` (manual)
- D-26: UI testing two-tier — pure view "builders" unit-tested in Node (returning `{tag, attrs, children}` descriptions); browser smoke via `tests-browser.html`; no DOM polyfill; Phase 3 first consumer
- D-27: JSDoc as standard for file headers (`/** @file ... */`) and exported APIs (`@param`/`@returns`/`@type`); inline `//` only for "why" notes; banned for line-by-line restatements
- D-28: `APP_VERSION` follows Semantic Versioning 2.0.0 (https://semver.org/); starting value `'0.1.0'`; cache name format `habits-${APP_VERSION}` (no `v` literal prefix); Phase 1 retro-converted from `'v1'`/`nawyki-v1`
- D-29: Module SW (`register('./sw.js', { type: 'module' })`) + ES `import { APP_VERSION }` — supersedes the original classic-SW + importScripts plan which threw SyntaxError on `export const` (caught by Phase 1 human-verify); cache prefix renamed `nawyki-` → `habits-`
- TDD mode flipped on (`workflow.tdd_mode: true`) — Phase 2+ MVP+TDD gate is blocking

Locked during Phase 3 plan 03-01 execution (2026-05-28):

- Wave 4 startDate fixed at 2026-04-27 in `seed/waves.json` (NOT the Pattern doc's illustrative 2026-01-26) so `currentWave('2026-05-28') === Wave 4` matches `<specifics>` line 201. Seven-week spacing anchored at Wave 0 = 2025-12-29.
- `daysBetween` uses `Math.round`, NEVER `Math.floor` — file header bans Math.floor inside daysBetween. The 1-hour DST gain/loss in the ms delta would silently truncate to N-1 with floor, corrupting every-n-days math.
- `mount(desc, parent, actions)` resolves its document via `parent.ownerDocument`, NOT a `configureMount({document})` seam. Pure function of parent; tests inject a fake DOM via the parent's fake ownerDocument.
- `appliesToday`'s every-n-days branch returns true when BOTH lastCompletedDate AND createdAt are absent — safe default "never hide for missing anchor."
- `configureWave({fetch})` uses `hasOwnProperty('fetch')` (presence-overrides-with-value, including null) so test `beforeEach` can reset the prior fetch injection cleanly.

Locked during Phase 3 plan 03-02 execution (2026-05-28):

- Hash router uses allowlist resolution (`routes[hash] ? hash : '#today'`) so spoofed URLs cannot navigate to unsanctioned panels (T-03-06). Unknown hashes fall back to `#today`. file://-safe: `hashchange` instead of `history.pushState`.
- `mountToday` is idempotent-by-rerender: second call without unmount re-renders against the live parent without registering a duplicate `store.subscribe` listener.
- `mountFooterNav` writes attributes onto the existing `<nav>` element and mounts only the children of the `buildFooterNav` description, avoiding `<nav>` inside `<nav>`. Builders consistently return a complete description for Tier 1 testability; mounters peel when the outer element pre-exists.
- Long-press diagnostics attach lives INSIDE the `#today` route function (NOT at module-load). The h1 is rebuilt by `buildTodayHeader` on every Today mount, so re-binding the long-press detector on every route fire is the correct lifecycle.
- Route panel shell uses HTML `hidden` attribute (NOT a CSS-class toggle). Browsers treat `hidden` as removed from the a11y tree, matching D-79 intent.
- Store cache extension keeps the compound-key string `"habitId::date"` for `cache.logs` (matches the fake-IDB key shape). New `cache.settings` Map carries `weekStart` and friends.
- `createFakeWindow` helper co-located in `tests/helpers/fake-document.js` (NOT a sibling `fake-window.js`). Test-DOM helpers stay in one file.

Locked during Phase 3 plan 03-03 execution (2026-05-28):

- `_recomputeLastCompletedDate({habitId, currentLogRow, repo})` lives in `js/state/apply/markUncompleted.js` (NOT a shared utils file). Both `handleMarkCompleted` and `handleRestoreLogRow` import it from there. Keeps the D-52 invariant near its primary user (the new D-74 handler) instead of creating yet another file. Future scoring-snapshots phase will follow the same `_recompute<Field>` pattern.
- `notify` is now a DI dependency of `apply.configure({})` (default = static `import {notify} from './store.js'`). Solves the Node ESM static-import-doesn't-inherit-query-strings problem (Pitfall 9 variant) — when tests cache-bust apply.js + store.js separately, apply.js's static `import {notify}` binds to a DIFFERENT (untagged) store instance than the test inspects. Production stays DI-free via the default; tests inject the cache-busted notify explicitly.
- `notify` is async — when `payload.keys` is present it `await refreshHydratedKeys(keys)` BEFORE fanning out to subscribers. Apply.js now `await`s notify so callers observe a reconciled cache when `await apply(...)` resolves. The one legacy test path (`apply.markCompleted.test.js` "subscribe fans out") was updated to `await store.notify(...)`.
- `revertRow(rowEl, priorState)` restores className + aria-pressed + data-action only. Does NOT precisely rebuild the ✓ glyph DOM — the next `store.subscribe(render)` re-render rebuilds the row from cache. Slice 3's apply error path uses `console.warn` with a `// 03-04: replace with showErrorToast` TODO; the toast lands in Slice 4.
- Today integration tests use UN-TAGGED modules + `_resetStoreForTest()` / `_resetTodayForTest()` between tests. Cache-busting today.js would still bind to the un-tagged store via Node ESM static-import behavior — resetting state on the un-tagged singletons is the simplest correct approach for view-mount tests.

Locked during Phase 3 plan 03-04 execution (2026-05-28):

- `_showToast` is an internal (non-exported) helper inside `js/views/toast.js`. The three public surfaces (`showUpdateToast` / `showUndoToast` / `showErrorToast`) all delegate to it. XSS-safe DOM construction (`createElement` + `textContent` + `setAttribute`) is localized in one place.
- `showUpdateToast` rewritten to delegate to `_showToast({message, action})` WITHOUT passing `autoDismissMs`. D-08 no-auto-dismiss is STRUCTURALLY guaranteed (no setTimeout is registered on the update path), not just behaviorally. The idempotent re-entry guard `if (toastEl) return;` is preserved.
- Action-button click handler captures the `fn` closure into a local BEFORE calling `_dismissToast()`. Without this capture, a re-entrant timer tick between dismiss and invoke could null out `toastEl` AND the closure, leaving `fn()` unreachable. Capturing makes the handler race-free against the auto-dismiss timer.
- Habit-name lookup happens AFTER `await apply()` resolves, NOT before the tap. The post-notify cache is canonical (per 03-03 Pitfall 2 alignment), so a cross-tab habit-rename between the tap and the toast render still renders the latest name.
- Graceful `(habit)` fallback on `getCachedHabits().find(...)` returning undefined (e.g. habit archived cross-tab during the tap). No throw; the success toast still renders.
- `tests/integration/today.tap.test.js` gained an ambient `globalThis.document` proxy (per-test setter `setAmbientDoc(bundle)`) so toast.js's `document.body.appendChild` can mount into the test's fake-doc body. This pattern carries forward to Settings integration tests in 03-05 — view + toast pairs need it; pure-builder unit tests do not. The alternative (refactor toast.js to accept a `document` argument) would break the production single-import shape used by every other caller.

Locked during Phase 3 plan 03-06 execution (2026-05-28):

- `tests/integration/sw.shell.test.js`'s `P3_REQUIRED` list is HARD-CODED, not auto-derived. The planner explicitly accepts the maintenance burden of extending the list each phase. Auto-derivation from a `git diff` against the prior phase HEAD would lose the value of the test — which is to catch the *human* slip of forgetting to register a file in SHELL. The locked list IS the discipline. P4 closeout MUST add a `P4_REQUIRED` list (or extend `P3_REQUIRED` — naming TBD) when it introduces new shell-asset files.
- The SHELL extraction regex inside `sw.shell.test.js` does NOT support block comments (`/* … */`) inside the SHELL array — only line-style comments. The current `sw.js` SHELL uses only line comments, so this is acceptable. Documented in the parser's JSDoc inside the test file.
- VERSIONING.md gains a centralized "Release history" section in this plan. Prior phases mentioned bumps in their SUMMARY.md and ROADMAP.md but no central release log existed. Back-filled v0.1.0 and v0.2.0 entries at the same time as adding v0.3.0 to keep the timeline coherent.
- README.md's new "Version history" section is intentionally 3 lines + a pointer to VERSIONING.md. Detailed prose lives in VERSIONING.md; README stays a quick reference.

Locked during Phase 3 plan 03-05 execution (2026-05-28):

- `setSetting` is self-inverting given the prior value. The handler returns `inverse: {type:'setSetting', payload:{key, value: prior?.value}}`. First-ever write captures `value: undefined`. Undo of the first-ever weekStart write injects `{key:'weekStart', value: undefined}` which the cache hydrate path treats as "no override — fall back to default". Acceptable per D-75 `<specifics>` line 198; documented inline.
- D-67 and D-06 confirm strings are NOT kept in sync. D-67 SETTINGS prose ("This will delete all your habits and history. Cannot be undone. Continue?") lives in `js/views/settings.js` as `RESET_CONFIRM_D67`. D-06 diagnostics prose ("Reset data — delete the habits IndexedDB database...") stays inline in `js/views/diagnostics.js`. They serve different audiences (user vs DevTools workflow) and a future refactor of either MUST NOT propagate to the other.
- Storage card's `requestPersistence` button is suppressed when `persisted === 'loading…'` (initial render), NOT just when `persisted === true`. The mounter re-renders once the persisted Promise resolves and the button appears then if applicable. Prevents a flash of the button before its initial state is known.
- Settings mounter uses cache-first habit-name lookup for the Data card preview (`store.getCachedHabits().find(...)` then `repo.getHabit` fallback). Mirrors today.js's post-tap toast composition (Pitfall 2 alignment — the notify-driven refresh keeps the cache canonical).
- `replaceCardChildren(cardEl, newDesc, actions)` is the canonical live-refresh path for Settings cards — clearChildren + mount loop, no .innerHTML. Carries forward to any future per-card reactivity.
- The cross-tab refresh integration test needs 2 microtask settles after `store.notify` because the subscriber's `readDataCardInputs` is fire-and-forget from notify's perspective (`for (const fn of subs) fn(payload)` — synchronous). Production behavior is unchanged (the user sees the refresh within one animation frame); only the test needs to settle the queue. A future architectural change (have notify await each subscriber Promise) is a P4+ consideration.
- Settings panel mounts INSIDE `<section data-route="settings">` which carries a pre-mounted `<h1 tabindex="-1">Settings</h1>` for router focus per D-79. The h1 is OWNED by index.html (not the settings.js builder) so the router can `focusH1()` even before mountSettings finishes.
- About card uses `'controlled'` / `'registered'` / `'unsupported'` for SW state. Diagnostics keeps the longer string `'registered, not yet controlled'` for the DevTools workflow; Settings uses the shorter form for the user-facing surface.

### Pending Todos

None yet.

### Blockers/Concerns

None yet. Note for Phase 6: scoring formulas in FEATURES.md are sketches; precise spec (denominator handling, S2 stage-weight curve, S3 load-curve calibration) needs deeper work during Phase 6 planning.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Browser support | Chromium-family browsers (Chrome / Edge / Brave) refuse to load ES module scripts from `file://` — `'file:' URLs are treated as unique security origins`. Firefox + Safari work fine on `file://`. Workarounds: serve via `node scripts/serve.js` or GitHub Pages (both already supported). **Possible future investigation:** an optional single-file inline-bundled `index.html` for Chromium file:// users, IF the constraint becomes painful. Currently it isn't — local dev uses the node server, distribution uses GitHub Pages. CLAUDE.md's stack section already states this limitation. | Documented | 2026-05-27 (Phase 02 plan 05 smoke item 8) |

## Session Continuity

Last session: 2026-05-28T14:00:00Z
Stopped at: Plan 03-06 complete — Phase 3 closeout shipped. SW SHELL list extended with 11 P3 files (D-81); APP_VERSION bumped 0.2.0 → 0.3.0 (D-28); README + VERSIONING.md release notes added; new `tests/integration/sw.shell.test.js` regression-guard test added (4 tests: P2 baseline + P3 required + SWR exception + on-disk existence). 279 tests green at HEAD `75a3638`. All 6 Phase 3 plans complete. Next: `/gsd-verify-work 3` UAT against the 5 ROADMAP Phase 3 success criteria.
Resume file: .planning/phases/03-today-view-settings-v1-first-usable-slice/03-06-SUMMARY.md
