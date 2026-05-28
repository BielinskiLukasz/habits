---
phase: 03-today-view-settings-v1-first-usable-slice
verified: 2026-05-28T12:27:56Z
status: human_needed
score: 5/5 must-haves verified (structural); 1 deferred to P5; 4 require human UAT
overrides_applied: 0
re_verification: null
deferred:
  - truth: "SETTINGS-04: 'last-backup timestamp' field on Storage card"
    addressed_in: "Phase 5"
    evidence: "Phase 5 success criterion #5: 'Settings shows \"Last backup: N days ago\" and a nag appears weekly to remind the user to export' (ROADMAP.md L131). Phase 3 ships persistence-status half of SETTINGS-04; the last-backup half lands with the JSON export functionality in P5."
human_verification:
  - test: "Cold-paint timing on a real mid-range Android device with 1 year of seed data (NFR-01)"
    expected: "Today view first paint < 300 ms after the user taps the PWA tile"
    why_human: "Requires a physical device, a real cold-process start, and a stopwatch / DevTools Performance trace. The structural enablers (single bounded getLogsInRange + getAllHabits, no spinners, synchronous render) are verified — but the measured time is a human-instrumented number, not a static-analysis output."
  - test: "First-tap latency on a real mobile device (NFR-02)"
    expected: "Visible row state change within 100 ms of finger contact"
    why_human: "Although the optimisticFlip path is structurally synchronous (capture + flip BEFORE await apply), the observable latency including touch dispatch, paint, and the input-to-pixel pipeline is only measurable on hardware."
  - test: "Visual + screen-reader pass on Today + Settings — no color-only state encoding (NFR-07)"
    expected: "Every state change pairs a non-color cue (✓ glyph, strikethrough, aria-pressed / aria-current / aria-disabled). VoiceOver / NVDA / TalkBack reads each row's completed state aloud."
    why_human: "Color contrast + screen-reader behavior is the canonical human-only check; grep confirms aria-* + glyph + opacity are present, but the user experience is human-verifiable only."
  - test: "Manual smoke per 03-02 SUMMARY 'Manual smoke instructions' + 03-06 SUMMARY 'post-ship verification'"
    expected: "Both checklists pass on Firefox (file://) and on a served origin (node scripts/serve.js → http://localhost:8080/)."
    why_human: "Steps such as 'long-press the Habits title to open diagnostics' and 'simulate offline reload and confirm Today still mounts' depend on real browser behavior the verifier cannot script."
---

# Phase 3: Today View & Settings v1 (First Usable Slice) — Verification Report

**Phase Goal:** Deliver the friction-free daily check-in that is the product's literal core value, against seed data.
**Verified:** 2026-05-28T12:27:56Z at HEAD `e8fc35c`
**Status:** human_needed — all structural truths VERIFIED; 4 items require user-side UAT
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Phase 3 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User opens `index.html` on mobile and the Today view renders synchronously with today's date, current wave context, and today's binary habits in under 300 ms cold paint | ✓ VERIFIED (structural) | `js/main.js` L86–87 awaits `hydrate()` (single bounded `getLogsInRange(weekStart, weekEnd)` + `getAllHabits()`) then `bootWaves()` then `mountRoutes(...)` synchronously into `#today`. `js/views/today/builders.js` `_formatTodayDate` produces `'Wed 27 May'`; `buildTodayHeader` renders `'Wave 4'` from `currentWave(todayLocal())` (Wave 4 startDate 2026-04-27 ≤ 2026-05-28 < Wave 5). Tests: `tests/integration/today.tap.test.js`, `tests/unit/builders.today.test.js` (19 cases), `tests/unit/store.hydrate.test.js` (single-bounded-read assertion). **NFR-01 numeric measurement (< 300 ms) is human UAT (item 1).** |
| 2 | User marks a binary habit complete with a single tap and sees the row update in under 100 ms | ✓ VERIFIED (structural) | `js/views/today.js` L181–198 (`handleMarkCompleteTap`): captures priorState → `optimisticFlip` runs SYNCHRONOUSLY (sets aria-pressed/class/data-action/glyph) → THEN `await apply({type:'markCompleted', payload:{habitId, date}})`. On reject: `revertRow(rowEl, priorState)` + `showErrorToast`. Tests: `tests/integration/today.tap.test.js` (4 tests: optimistic flip, unmark, revertRow on reject, post-notify reconcile). **NFR-02 measured-latency confirmation is human UAT (item 2).** |
| 3 | User unmarks a previously-completed binary habit with a single tap from the same row | ✓ VERIFIED | `js/state/apply/markUncompleted.js` exports `handleMarkUncompleted` (D-74: writes `{completed:false, definitionVersion:null}`, NEVER delete; preserves audit trail). HANDLERS table in `js/state/apply.js` L90+ registers `markUncompleted: handleMarkUncompleted`. `js/views/today.js` L202–227 (`handleMarkUncompleteTap`) is the symmetric inverse of the mark-complete path. `_recomputeLastCompletedDate` (D-52 invariant) imported by both mark and unmark + restoreLogRow. Tests: `tests/integration/apply.markUncompleted.test.js` (5 tests), `tests/integration/apply.lastCompletedDate.test.js` (7 tests for the D-52 invariant). |
| 4 | User undoes the last mark/unmark from a toast OR Settings shortcut; undo still works after a full page reload (persisted via `meta.undoToken`) | ✓ VERIFIED | Toast surface: `js/views/toast.js` L180 `showUndoToast({message, undoFn, autoDismissMs=5000})` (D-69/D-70/D-71); wired from `js/views/today.js` L190–192, 219–222 → `undoFn: () => undo()`. Settings surface: `js/views/settings.js` L349–355 `undoLastAction: async () => { await undo(); ... }`; `buildDataCard` renders the button enabled only when `hasUndoToken=true` (read from `repo.getMeta('undoToken')`). Persistence: `js/state/apply.js` L145 writes `meta.undoToken = eventRow.id` in the SAME tx as the logs write (D-43); `js/state/undo.js` L74 reads it back. Tests: `tests/integration/toast.undo.test.js`, `tests/integration/today.undo.test.js` (3 tests), `tests/integration/settings.mount.test.js` (Undo disabled-when-empty + D-67 confirm). |
| 5 | User opens Settings and sees persistence status (Persistent: yes/no), app + schema versions, and platform-detected install instructions | ✓ VERIFIED (with documented deviation) | `js/views/settings.js` `mountSettings` composes 5 cards in locked D-61 order. (a) Storage card (`buildStorageCard`): renders `<dt>Persistent</dt><dd>yes/no/loading…</dd>` + estimate row. Mounter at L150–185 calls `navigator.storage.persisted()` + `.estimate()` and mutates `dd.textContent` post-Promise (Pattern S5). (b) About card (`buildAboutCard` L338): renders `appVersion` (`'0.3.0'` from `js/util/version.js`), `schemaVersion`, `cacheName`, `swState`. (c) Install card (`buildInstallCard` L199): three labeled subsections (iOS Safari / Android Chrome / Desktop browsers). **DEVIATION (user-approved):** Install card does NOT JS-detect platform — it shows all three. Documented in `03-DISCUSSION-LOG.md` Q3: user explicitly chose "Show all three labeled, no detection." See WARNING below. Tests: `tests/unit/builders.settings.test.js` (15), `tests/integration/settings.mount.test.js` (4), `tests/integration/settings.dataCard.test.js` (1). |

**Score:** 5/5 structural truths VERIFIED. 4 require human UAT (NFR-01 timing, NFR-02 latency, NFR-07 visual/SR, post-ship smoke).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | SETTINGS-04 "last-backup timestamp" half | Phase 5 | ROADMAP L131: Phase 5 SC #5 — "Settings shows 'Last backup: N days ago' and a nag appears weekly to remind the user to export." The persistence-status half of SETTINGS-04 IS shipped in P3 (Storage card, Persistent: yes/no); the last-backup half intentionally lands with the JSON export feature. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/domain/cadence.js` | Pure 4-cadence resolver (D-48..D-51) | ✓ VERIFIED | 22 cadence behaviors + RESOLVERS discipline (`tests/unit/cadence.test.js`); imported by `js/views/today.js` |
| `js/domain/wave.js` + `seed/waves.json` | 10-wave catalog, Wave 4 current on 2026-05-28 | ✓ VERIFIED | `seed/waves.json` shape test green; Wave 4 startDate `2026-04-27`; `currentWave('2026-05-28')` returns Wave 4 (test in `tests/unit/wave.test.js`) |
| `js/util/mount.js` | Single trusted DOM-construction helper (D-77) | ✓ VERIFIED | 10 mount behaviors (`tests/unit/mount.test.js`); imported by every view module |
| `js/router.js` | Hash router with allowlist resolution (D-60, D-80) | ✓ VERIFIED | 8 router tests; `mountRoutes` called in `js/main.js` L124 with three routes |
| `js/views/today.js` | `mountToday` + `mountFooterNav` + tap closures + optimisticFlip/revertRow | ✓ VERIFIED | Tap closures wired through `mount(desc, parent, actions)`; integration tests in `tests/integration/today.tap.test.js`, `tests/integration/today.undo.test.js` |
| `js/views/today/builders.js` | 4 pure description-tree builders + `_formatTodayDate` | ✓ VERIFIED | 19 builder tests; all builders return `{tag, attrs?, text?, children?}`; consumed by `mountToday` |
| `js/state/apply/markUncompleted.js` | D-74 handler + `_recomputeLastCompletedDate` D-52 invariant | ✓ VERIFIED | Writes `{completed:false, definitionVersion:null}` NEVER delete; `_recomputeLastCompletedDate` shared with markCompleted + restoreLogRow |
| `js/state/apply/setSetting.js` | D-75 self-inverting chokepoint handler | ✓ VERIFIED | 6 setSetting integration tests; HANDLERS table includes `setSetting: handleSetSetting`; `broadcastKeys` returns `{key}` only (Pitfall 8) |
| `js/views/toast.js` (extended) | `showUndoToast` + `showErrorToast` + preserved `showUpdateToast` D-08 contract | ✓ VERIFIED | 13 unit tests; D-08 regression-guarded with 60s fake-clock tick; XSS-safety grep green |
| `js/views/settings.js` + `js/views/settings/builders.js` | 5-card composition in locked D-61 order with notify-driven live refresh | ✓ VERIFIED | 5 builders (`buildStorageCard`, `buildScheduleCard`, `buildInstallCard`, `buildDataCard`, `buildAboutCard`); `mountSettings` wired in `js/main.js` L141 |
| `css/settings.css` | 5-card flat layout, 44px tap targets, destructive treatment | ✓ VERIFIED | `min-height: 44px` on inputs + buttons; `.settings-card--destructive` class; imported via `css/main.css` `@import` |
| `sw.js` SHELL extension (+11 P3 files) | All 11 P3 shell assets precached (D-81) | ✓ VERIFIED | `sw.js` L103–113 contains all 11 expected entries + comment block; `tests/integration/sw.shell.test.js` regression-guards baseline + P3 required + waves.json SWR exception + on-disk existence |
| `js/util/version.js` `APP_VERSION` | Bumped `'0.2.0'` → `'0.3.0'` (D-28 MINOR-on-phase) | ✓ VERIFIED | L35: `export const APP_VERSION = '0.3.0';` |
| `README.md` + `VERSIONING.md` | Version history / Release history sections with v0.3.0 entry | ✓ VERIFIED | `README.md` L120–126 "Version history" section; `VERSIONING.md` L34+ "Release history" + v0.3.0 entry + back-filled v0.1.0/v0.2.0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `js/main.js` | router + Today + Settings + Waves | imports + `mountRoutes` call | ✓ WIRED | `import { mountRoutes }`, `import { mountToday, mountFooterNav }`, `import { mountSettings }`, `import { configureWave, bootWaves }`, `import { hydrate, configureStore }` all present at L55–64; boot order at L75–86; `mountRoutes` invoked at L124 with `#today`, `#history`, `#settings` route fns |
| Today tap | apply.js chokepoint | `await apply({type:'markCompleted'|'markUncompleted', payload})` | ✓ WIRED | `js/views/today.js` L185, L216; mount actions map at L246–247 wires `markComplete: handleMarkCompleteTap`, `markUncomplete: handleMarkUncompleteTap` |
| apply.js | meta.undoToken persistence | Same-tx `tx.objectStore('meta').put({key: 'undoToken', value: eventRow.id})` | ✓ WIRED | `js/state/apply.js` L145; reads via `js/state/undo.js` L74 `_repo.getMeta('undoToken')` |
| Toast Undo button | `undo()` | `undoFn: () => undo()` | ✓ WIRED | `js/views/today.js` L191–192, L220–222; `js/views/toast.js` L180 wires action click |
| Settings Data card Undo | `undo()` | `undoLastAction: async () => { await undo(); ... }` | ✓ WIRED | `js/views/settings.js` L349–355 |
| Settings Schedule radio | apply.js setSetting chokepoint | `apply({type:'setSetting', payload:{key:'weekStart', value}})` | ✓ WIRED | `js/views/settings.js` L380+ change-handler dispatches through apply (D-75 — never direct `repo.putSetting`) |
| sw.js | All 11 P3 shell files | SHELL array entries | ✓ WIRED | `tests/integration/sw.shell.test.js` asserts all 11 entries present + every entry exists on disk |
| Today render | cadence resolver | `appliesToday(habit, today, ctx)` per habit | ✓ WIRED | `js/views/today.js` mountToday loop calls `appliesToday(habit, dateLocal, {today, weekStart, weekCompletions, lastCompletedDate})` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Today list | `habits` | `store.getCachedHabits()` ← `hydrate()` ← `repo.getAllHabits()` ← IDB `habits` store seeded from `seed/habits.json` (8 habits) | ✓ — seed loader writes 8 habits; integration tests verify rows render | ✓ FLOWING |
| Today list | `weekCompletions` | `store.getCachedWeekCompletions()` ← `hydrate()` ← `repo.getLogsInRange(weekStart, weekEnd)` | ✓ — logs are real IDB rows; `apply()` notify-refreshes cache (D-72) | ✓ FLOWING |
| Today header `Wave N` | `currentWave(todayLocal())` | `bootWaves()` ← `fetch('./seed/waves.json')` ← real 10-entry catalog | ✓ — `tests/unit/wave.test.js` confirms Wave 4 returns for 2026-05-28 | ✓ FLOWING |
| Settings Storage card | `persisted`, `estimate` | `navigator.storage.persisted()` / `.estimate()` | ✓ — runtime Promise; fallback to `'loading…'` then `'no'` if not granted | ✓ FLOWING |
| Settings About card | `appVersion`, `schemaVersion`, `cacheName`, `swState` | `APP_VERSION` (`'0.3.0'`), schema constant, derived `habits-0.3.0`, `navigator.serviceWorker.controller` state | ✓ — all four are live module reads | ✓ FLOWING |
| Settings Data card | `lastEvent`, `hasUndoToken`, `relativeTime` | `repo.getMeta('undoToken')` → `repo.getEvent(token)` → habit-name from cache + `formatRelative(now - event.at)` | ✓ — read on initial mount AND on every `store.notify` (D-72 live refresh); test `tests/integration/settings.dataCard.test.js` confirms cross-tab refresh | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `node --test "tests/**/*.test.js"` | `tests 279, pass 279, fail 0, cancelled 0, skipped 0` | ✓ PASS |
| D-78 grep gate green | `node --test tests/unit/discipline.xss.test.js` | `tests 1, pass 1, fail 0` | ✓ PASS |
| D-78 source-grep parity | `Grep "innerHTML\|outerHTML\|insertAdjacentHTML\|document\.write" js/ --type=js` | 19 hits, all inside JSDoc/comments documenting the ban (verified by `-B/-A` context check); zero functional usage | ✓ PASS |
| APP_VERSION = 0.3.0 | `grep "APP_VERSION = '0.3.0'" js/util/version.js` | matches at L35 | ✓ PASS |
| SHELL includes P3 files | `grep "./js/router.js" sw.js` etc. | 11/11 P3 entries present at L103–113 | ✓ PASS |
| README + VERSIONING have v0.3.0 | `grep "v0.3.0" README.md VERSIONING.md` | README L122, VERSIONING L36 | ✓ PASS |

### Probe Execution

No formal probe scripts declared for this phase. The SHELL coverage integration test (`tests/integration/sw.shell.test.js`) plays the role of a probe-style regression guard and is exercised in the full test run above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CORE-01 | 03-02 | Open `index.html` on mobile, see today's habits without delay | ✓ SATISFIED | `js/main.js` boots straight into `#today`; allowlist fallback for spoofed hashes (`js/router.js`); cold-paint numeric measurement is human UAT (NFR-01) |
| CORE-02 | 03-03 | Mark habit complete with a single tap (binary) | ✓ SATISFIED | `js/views/today.js` L181 `handleMarkCompleteTap` → `apply({type:'markCompleted'})`; tests in `tests/integration/today.tap.test.js` |
| CORE-03 | 03-03 | Unmark previously-completed habit with a single tap | ✓ SATISFIED | `js/views/today.js` L213 `handleMarkUncompleteTap`; `markUncompleted` handler + tests |
| CORE-04 | 03-01, 03-02 | Today filters by cadence rules | ✓ SATISFIED | `js/domain/cadence.js` `appliesToday` (4 cadence types); `mountToday` calls it per habit (`js/views/today.js`); 22 cadence tests |
| CORE-05 | 03-01, 03-02 | Today shows today's date + current wave | ✓ SATISFIED | `buildTodayHeader` renders `_formatTodayDate(today)` + `currentWave(today).name` |
| CORE-06 | 03-02 | Synchronous render, no spinner-blocked paint | ✓ SATISFIED | `mountToday` is fully synchronous after `hydrate()` resolves; cache-first; no view-level async dependency |
| LOG-01 | 03-03 | Binary single-check logging UX | ✓ SATISFIED | One tap = one `markCompleted`/`markUncompleted` apply; row data-action toggles inline (`buildTodayRow`) |
| UNDO-01 | 03-04, 03-05 | Undo last mutating action within one tap from toast OR Settings | ✓ SATISFIED | Toast Undo button (`showUndoToast` undoFn) + Settings Data card Undo button (`undoLastAction`); both call `undo()` |
| UNDO-02 | 03-04 | Undo persists across page reload via `meta.undoToken` | ✓ SATISFIED | `apply.js` L145 same-tx write; `undo.js` L74 reads back from IDB on every undo() call; test in `tests/integration/toast.undo.test.js` |
| UNDO-03 | 03-04 | Undo is single-step | ✓ SATISFIED | `undo()` reads single token; after undo the token is replaced by the inverse event's id, never queued |
| SETTINGS-04 | 03-05 | Persistence status + last-backup timestamp | ⚠ PARTIAL (persistence ✓, last-backup deferred) | Storage card renders Persistent yes/no/loading… + estimate. Last-backup timestamp DEFERRED to Phase 5 (ROADMAP P5 SC #5). Not a Phase 3 gap. |
| SETTINGS-05 | 03-05 | App version + schema version in About | ✓ SATISFIED | `buildAboutCard` renders 4 rows (appVersion, schemaVersion, cacheName, swState) |
| PWA-07 | 03-05 | Install help that platform-detects | ⚠ PARTIAL (user-approved deviation) | Install card shows ALL three (iOS Safari / Android Chrome / Desktop browsers) instead of UA-detecting one. Documented in `03-DISCUSSION-LOG.md` Q3 — explicit user choice. See WARNING. |
| NFR-01 | 03-02 | Cold paint < 300 ms with 1 year of data | ⚠ STRUCTURAL ONLY | Single bounded `getLogsInRange` + `getAllHabits` confirmed; numeric measurement is human UAT item 1 |
| NFR-02 | 03-03 | First-tap latency < 100 ms | ⚠ STRUCTURAL ONLY | Optimistic flip is synchronous BEFORE await; measured-latency confirmation is human UAT item 2 |
| NFR-06 | 03-02 | Tap targets ≥ 44×44 px on mobile | ✓ SATISFIED | `css/today.css` `.today-row-tap` + `.today-row-info` both `min-height: 44px`; `css/settings.css` radio labels + buttons `min-height: 44px`. Desktop keyboard-only operability is human UAT (subset of item 3). |
| NFR-07 | 03-02 | No color-only state encoding; accessible names | ⚠ STRUCTURAL ONLY | aria-pressed + ✓ glyph + strikethrough + opacity 0.55 on completed rows; aria-current on nav; aria-disabled on history link. Visual/SR pass is human UAT item 3. |

### Orphaned requirements

None — all 17 P3-scope requirements (CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07) appear in at least one P3 plan's frontmatter and have implementation evidence in the codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `js/views/today.js` | (legacy) | "03-04: replace with showErrorToast" TODO | None — already replaced | The 03-03 placeholder `console.warn` was REMOVED in 03-04 (verified — no `console.warn` for tap-reject path remains; `showErrorToast` is wired in both reject branches). |
| All P3 source files | — | Debt markers (TBD / FIXME / XXX / HACK / PLACEHOLDER) | None | Grep across `js/` returns zero unreferenced debt markers in P3-modified files. Comment-only `.innerHTML` mentions are JSDoc documenting the D-78 ban, not usage. |
| All P3 builders | — | Empty-array / null props flowing to UI | None | `buildTodayList` keys off `habits.length === 0` + `allCompleted` for empty-state copy (D-58); no hardcoded `=[]` flowing to UI. Settings cards default `'loading…'` → mutated post-Promise (Pattern S5). |

### Human Verification Required

#### 1. Cold-paint timing (NFR-01)

**Test:** On a mid-range Android device with the PWA installed and at least one week of seed data loaded, force-quit the app, then tap the home-screen tile and start a stopwatch (or use Chrome DevTools Performance recording from a connected laptop).
**Expected:** First Today paint < 300 ms.
**Why human:** Cold-process timing on real hardware. Structural enablers verified (single bounded read; no spinners; synchronous render path).

#### 2. First-tap latency (NFR-02)

**Test:** On a real touch device, tap a not-yet-completed habit row and observe the row state change.
**Expected:** Visible flip (✓ glyph + strikethrough + opacity) within 100 ms of finger contact.
**Why human:** Although the optimistic flip is structurally synchronous before `await apply()`, the perceived latency including touch dispatch + paint is only measurable on hardware.

#### 3. Visual + screen-reader accessibility pass (NFR-07, NFR-06 keyboard-only subset)

**Test:** Open Today and Settings with VoiceOver / NVDA / TalkBack. Verify that completed rows are announced as "pressed" and that the active footer-nav link is announced as "current". Tab through Settings with the keyboard only and confirm every interactive control is reachable.
**Expected:** Non-color cues (✓ glyph, strikethrough, aria-pressed / aria-current / aria-disabled) pair every state change; screen reader correctly announces completed-vs-incomplete rows; keyboard tab order is sensible.
**Why human:** Screen-reader behavior and visual contrast are not statically gepable beyond attribute presence.

#### 4. Post-ship manual smoke (03-02 + 03-06 SUMMARYs)

**Test:** Run the combined smoke checklist from `03-02-SUMMARY.md` "Manual smoke instructions" (8 steps) and `03-06-SUMMARY.md` "Manual smoke instructions (post-ship verification)" (6 steps) on (a) Firefox via `file://`, (b) Chromium via `node scripts/serve.js → http://localhost:8080/`, and (c) the deployed GitHub Pages origin.
**Expected:** Today mounts, hash router fallback works, Settings deep-link works, `#unknown` falls back to Today, long-press diagnostics works, SW update flow on existing 0.2.0 tabs shows D-08 update toast, new cache `habits-0.3.0` activates and old `habits-0.2.0` is deleted, offline reload still serves Today.
**Why human:** Multiple steps depend on real browser SW lifecycle + offline simulation + multi-tab interaction.

### WARNINGS (non-blocking deviations from locked requirement language)

#### WARNING 1: PWA-07 install card does NOT auto-detect platform

**Locked requirement (REQUIREMENTS.md L152):** "Settings includes an install-help panel that **platform-detects** and shows the right instructions (iOS vs Android vs desktop)."
**ROADMAP P3 SC #5:** "**platform-detected** install instructions (iOS Share / Android Install / desktop URL-bar icon)."
**Implementation:** `js/views/settings/builders.js` L199 `buildInstallCard` shows ALL THREE labeled subsections; no `navigator.userAgent` or feature-test branching.
**User decision (`03-DISCUSSION-LOG.md` Q3):** User explicitly chose "Show all three labeled, no detection" over "Feature-test first, UA as fallback" and "UA-only switch."
**Verdict:** Documented user override. Mark as PASSED with a deviation note rather than FAILED. To formalize, the user may add an override to this VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "PWA-07: Settings includes an install-help panel that platform-detects and shows the right instructions (iOS vs Android vs desktop)"
    reason: "User explicitly chose 'Show all three labeled, no detection' in 03-DISCUSSION-LOG.md Q3 (Settings v1 install card). All three instruction sets render simultaneously with H3 anchors per platform."
    accepted_by: "lukasz.bielinski"
    accepted_at: "2026-05-28T12:27:56Z"
```

#### WARNING 2: SETTINGS-04 missing the "last-backup timestamp" half

**Locked requirement:** "User can see storage persistence status (persistent: yes/no) **and last-backup timestamp**."
**Implementation:** Storage card shows persistence + estimate. No last-backup field.
**Disposition:** DEFERRED to Phase 5 — ROADMAP P5 SC #5 explicitly covers "Settings shows 'Last backup: N days ago' and a nag appears weekly." The backup feature itself ships in P5, so the timestamp field is correctly scheduled there.
**Verdict:** Not a Phase 3 gap. Recorded in the `deferred:` section of frontmatter.

## Gaps Summary

**Status:** human_needed (not gaps_found, not passed).

- All 17 in-scope requirements have implementation evidence and corresponding tests in the green 279/279 suite.
- All 5 ROADMAP Phase 3 success criteria are structurally satisfied — the artifacts exist, the wiring is complete end-to-end, and data flows through real IDB stores + real DOM mounters.
- 4 truths cannot be closed by static analysis alone and need human UAT (cold-paint timing, first-tap latency, visual/SR accessibility pass, post-ship smoke checklist).
- 1 truth (SETTINGS-04 last-backup half) is correctly deferred to Phase 5.
- 1 truth (PWA-07 platform detection) is a documented user-approved deviation; the verifier recommends formalizing the override in frontmatter.

**No code-level gaps blocking phase completion.** The phase is ready for human UAT; on UAT pass, status can be advanced to `passed` (with the override applied for PWA-07).

---

*Verified: 2026-05-28T12:27:56Z*
*Verifier: Claude (gsd-verifier)*
*HEAD: `e8fc35c`*
*Test suite: 279/279 green*
