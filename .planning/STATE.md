---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-05T12:52:03.290Z"
last_activity: 2026-06-05
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 25
  completed_plans: 24
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.
**Current focus:** Phase 04 — domain-model-cadence-catalog-stages-mastery-multi-occurrence

## Current Position

Phase: 5
Previous: Phase 02 (storage-foundation-the-spine) — COMPLETE + VERIFIED (10/10 UAT pass, 2026-05-27)
Plan: Not started
Status: Executing Phase 04
Last activity: 2026-06-05

Progress: [██████████████████████░░░░░░░░] 54% (All Phase 3 complete: 6/6 plans shipped + UAT verified; Phase 4 ready to plan)

## Temp Branch Work Available

⚠️ **Note (2026-06-05):** A `temp` branch exists (commit `c449c5b`) containing Phase 4 implementation work (3500+ insertions across mastery, stage, waveAggregates, date utilities, and 40+ tests). 

**For execute-phase:** The executor should read the temp branch code via `git show temp:js/domain/mastery.js` etc., understand the logic and design decisions, and reuse it while creating fresh Phase 4 commits. This gives clean commit history without re-implementing from scratch.

**See:** `.planning/TEMP-BRANCH-REFERENCE.md` (module inventory + executor instructions) and `.planning/TEMP-BRANCH-USAGE-GUIDE.md` (integration options).

## Resume Instructions

**Phase 3 complete & UAT verified (2026-05-29)**

All 7 Phase 3 plans shipped and verified:

- Plans 03-01 through 03-06: Core implementation (cadence, today view, tap-to-log, toast, settings).
- Plan 03-07: Gap closure (5 gaps closed: Data card label fix + completed-today retention + diagnostics live values + h1 padding + Reset/Undo visual separation).
- UAT: 19 tests run, 15 passed, 2 issues found + fixed (via 03-07), 2 deferred to next-phase device session.
- Test suite: **91 tests passing** (includes 2 new gap-fix coverage tests).

### Phase 3 Completion Summary

- `sw.js` SHELL extended by 11 P3 files per D-81: `./js/router.js`, `./js/views/today.js`, `./js/views/today/builders.js`, `./js/views/settings.js`, `./js/views/settings/builders.js`, `./js/domain/cadence.js`, `./js/domain/wave.js`, `./js/util/mount.js`, `./js/state/apply/markUncompleted.js`, `./js/state/apply/setSetting.js`, `./css/settings.css`.
- `APP_VERSION` bumped `0.2.0` → `0.3.0` in `js/util/version.js` (D-28 MINOR-on-phase-completion).
- **UAT Gap Closure (03-07):**
  - Gap 1 (MAJOR): Data card label now correctly reflects setSetting events ("changed key to value" instead of "marked habit complete")
  - Gap 2 (cosmetic): Reset data button now visually separated from Undo button via border-top + padding
  - Gap 3 (minor): Diagnostics panel now shows live Schema version + Persistence values (no longer "n/a (P2)")
  - Gap 4 (cosmetic): Settings h1 now has left padding to align with card content below
  - Gap 5 (MAJOR): Habits completed today now remain visible on Today list until midnight (OR-clause in applicable filter)
- All 17 in-scope P3 requirements (CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07) are functionally complete.

### Deferred Phase 3 UAT Items (→ Phase 4 UAT session)

Device-on-hand tests (require physical hardware or specialized tools):

- **T16 / NFR-01** — Cold-paint < 300 ms on mid-range mobile device (PWA install required)
- **T17 / NFR-02** — First-tap latency < 100 ms on real touch device
- **T18 / NFR-07 (SR axis)** — Screen-reader test with NVDA/VoiceOver/TalkBack (visual + keyboard halves already passed)
- **T19 Part B** — Offline reload (network disabled) — verify Today mounts from cached SHELL

### Next Steps

1. Begin Phase 4 planning (Domain Model: catalog CRUD, stages, mastery, multi-occurrence logging, history navigation, wave aggregates)
2. Schedule Phase 4 UAT session with physical device on-hand for NFR tests + screen-reader pass

Open follow-ups (non-blocking):

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
| P3-7 | 03-07 | ✓ Complete | UAT gap closure: `js/views/settings.js` (buildDataCardFromState 4-branch on eventRow.type — setSetting path) + `js/views/today.js` (applicable OR-clause retains habits completed today) + `js/views/diagnostics.js` (live DB_VERSION + navigator.storage.persisted()) + `css/settings.css` (h1 padding + Reset/Undo border separator) + 2 new integration tests (settings.dataCard + today.completedToday); 279 → 281 tests green |

Test suite: **281/281 green**.

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
| 04 | 11 | - | - |

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
| Phase 3 UAT | **T16 / NFR-01** — Cold-paint < 300 ms (perceived) — Requires PWA installed on a real mid-range mobile device. Structural enabler verified (single bounded read, no spinners, synchronous render path). | Awaiting device session | 2026-05-29 (Phase 03 UAT, test 16) |
| Phase 3 UAT | **T17 / NFR-02** — First-tap latency < 100 ms (perceived) — Requires a real touch device. Structural enabler verified (optimisticFlip synchronous before await apply). | Awaiting device session | 2026-05-29 (Phase 03 UAT, test 17) |
| Phase 3 UAT | **T18 / NFR-07 (SR axis)** — Screen-reader accessibility — Visual cues + keyboard nav verified ✓. Need NVDA / VoiceOver / TalkBack to confirm completed rows announce "pressed" and active footer link announces "current page". Edge "Read aloud this page" is TTS (wrong tool). Recommend NVDA pass on Windows. | Awaiting SR tools | 2026-05-29 (Phase 03 UAT, test 18) |
| Phase 3 UAT | **T19 Part B** — Offline reload with network disabled — Part A (v0.2.0 → v0.3.0 update toast + cache invalidation) verified ✓. Part B (network disabled → reload still mounts Today from cached SHELL) deferred to device session. | Awaiting device session | 2026-05-29 (Phase 03 UAT, test 19) |
| Browser support | Chromium-family browsers (Chrome / Edge / Brave) refuse to load ES module scripts from `file://` — `'file:' URLs are treated as unique security origins`. Firefox + Safari work fine on `file://`. Workarounds: serve via `node scripts/serve.js` or GitHub Pages (both already supported). **Possible future investigation:** an optional single-file inline-bundled `index.html` for Chromium file:// users, IF the constraint becomes painful. Currently it isn't — local dev uses the node server, distribution uses GitHub Pages. CLAUDE.md's stack section already states this limitation. | Documented | 2026-05-27 (Phase 02 plan 05 smoke item 8) |

## Session Continuity

Last session: 2026-06-03T22:03:33.147Z
Current session: 2026-05-29T19:47:00Z (Phase 3 UAT verification)

**Phase 3 Complete:**

- All 7 plans executed (03-01 through 03-07)
- UAT completed: 19 tests, 15 passed, 2 issues found + closed via 03-07, 2 tests deferred (device-on-hand)
- 5 Phase 3 UAT gaps discovered and verified closed via test suite (91 tests passing)
- Phase 3 status: **COMPLETE + VERIFIED**
- Current HEAD: `5d8b977` (test(03): verify Phase 3 UAT gaps closed and verified)

**Ready for:** Phase 4 planning (Domain Model: catalog CRUD, stages, mastery, multi-occurrence logging, history navigation, wave aggregates)

Resume file: .planning/phases/04-domain-model-cadence-catalog-stages-mastery-multi-occurrence/04-CONTEXT.md
