---
phase: 03-today-view-settings-v1-first-usable-slice
plan: 06
subsystem: closeout
tags: [sw-shell, app-version, semver, docs, regression-guard]

# Dependency graph
requires:
  - phase: 03-today-view-settings-v1-first-usable-slice
    plan: 05
    provides: "Settings v1 + setSetting chokepoint + all P3 application code shipped — closeout has all 11 P3 shell files on disk to add to SHELL"
provides:
  - "`sw.js` SHELL list extended by 11 P3 files (D-81): `./js/router.js`, `./js/views/today.js`, `./js/views/today/builders.js`, `./js/views/settings.js`, `./js/views/settings/builders.js`, `./js/domain/cadence.js`, `./js/domain/wave.js`, `./js/util/mount.js`, `./js/state/apply/markUncompleted.js`, `./js/state/apply/setSetting.js`, `./css/settings.css`. `seed/waves.json` stays out of SHELL (SWR exception)."
  - "`APP_VERSION` bumped `0.2.0` → `0.3.0` in `js/util/version.js` (D-28 MINOR-on-phase-completion). Cache name auto-derives to `habits-0.3.0`; existing activate handler deletes the prior `habits-0.2.0` cache; existing D-08 update-toast fires for users still on 0.2.0."
  - "`tests/integration/sw.shell.test.js` — 4 tests acting as a regression guard: P2 baseline still present, P3 required all present, `seed/waves.json` NOT in SHELL, every SHELL entry resolves to a real file on disk (T-03-41)."
  - "`README.md` 'Version history' section listing v0.1.0 / v0.2.0 / v0.3.0 with one-line summaries."
  - "`VERSIONING.md` 'Release history' section with v0.3.0 entry (what shipped + bump rationale + cache invalidation + D-decision range D-48..D-81); back-filled v0.1.0 and v0.2.0 entries for continuity."
affects: [04 (Phase 4 must update the P3_REQUIRED list inside sw.shell.test.js when it adds new shell-asset files), 5..6 (same pattern at each phase closeout)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern S6 grep-discipline extension: source-text parsing of `sw.js` to extract the SHELL array as a `Set<string>`. Belt-and-suspenders with manual D-81 review. The locked P3_REQUIRED list inside the test forces the planner's hand on any future omission."
    - "P2 baseline pinning + on-disk existence check (T-03-41): every SHELL entry must exist on disk; an accidental delete of a baseline entry is caught before it ships an offline-boot regression."
    - "SemVer 0.y.z MINOR-on-phase-completion convention (D-28) — three phases in, the pattern holds: P1 → 0.1.0, P2 → 0.2.0, P3 → 0.3.0. The cache invalidation flows automatically because the cache name template `habits-${APP_VERSION}` is unchanged."

key-files:
  created:
    - "tests/integration/sw.shell.test.js — 4 regression-guard tests (P2 baseline + P3 required + SWR exception + file-exists)"
  modified:
    - "sw.js — SHELL array grew by 11 entries with a P3 comment block; install/activate/fetch handlers untouched"
    - "js/util/version.js — APP_VERSION literal `'0.2.0'` → `'0.3.0'`; JSDoc unchanged (still 0.y.z initial development)"
    - "README.md — added 'Version history' section with v0.1.0 / v0.2.0 / v0.3.0 lines (linked to VERSIONING.md)"
    - "VERSIONING.md — added 'Release history' section with v0.3.0 entry + back-filled v0.1.0 and v0.2.0"

key-decisions:
  - "P3_REQUIRED is a HARD-CODED list inside `tests/integration/sw.shell.test.js`, not auto-derived from a `git diff` against P2's HEAD. The planner explicitly accepts the maintenance burden of extending the list each phase, because the failure mode of a forgotten extension is exactly what the test is meant to surface."
  - "Block comments are NOT supported inside the SHELL extraction regex — only line-style comments. The current `sw.js` SHELL uses only line comments, so this is fine. The limitation is documented in the parser's JSDoc."
  - "VERSIONING.md release history is NEW in this plan. Prior phases mentioned bumps in their SUMMARY.md and ROADMAP.md but no central release log existed. Back-filling v0.1.0 and v0.2.0 at the same time as adding v0.3.0 keeps the timeline coherent."
  - "README's new 'Version history' section is 3 lines + a pointer to VERSIONING.md. Detailed prose lives in VERSIONING.md; README stays a quick reference."

patterns-established:
  - "Pattern: phase-closeout test extension — each phase's closeout extends a locked test list (`P{N}_REQUIRED` in the SHELL discipline test) to guard against the next phase forgetting to register new shell-asset files."
  - "Pattern: file-exists existence check for every SHELL entry — catches typos in SHELL before the SW install step 404s offline-first users."

requirements-completed: []

# Metrics
duration: 15m
completed: 2026-05-28
---

# Phase 3 Plan 06: Phase Closeout Summary

**Phase 3 is shippable.** The SW SHELL list now precaches all 11 new P3 shell-asset files (D-81), so offline-first users on `0.2.0` will see the new files atomically on their next SW activation. `APP_VERSION` advanced `0.2.0` → `0.3.0` so the cache name becomes `habits-0.3.0`; the existing activate handler deletes the prior cache, and the existing D-08 no-auto-dismiss update toast fires for any tab still on `0.2.0`. README and VERSIONING.md now carry the v0.3.0 release notes (plus a back-filled history of v0.1.0 and v0.2.0 for the central log). A new integration test guards against future drift — the next phase that introduces a `js/views/`, `js/state/apply/`, or `css/` file MUST extend the locked `P3_REQUIRED` (or `P4_REQUIRED`) list inside `tests/integration/sw.shell.test.js`, or the test goes red.

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (T1 TDD: RED → GREEN = 2 commits; T2: 1 GREEN commit; T3: 1 docs commit)
- **Files modified:** 5 (1 new test + 1 SW edit + 1 version edit + 2 doc edits)

## Test Counts

- **Before this plan:** 275 / 275 green at HEAD `418a880`
- **After this plan:** 279 / 279 green at HEAD `75a3638` (+4 new tests)
  - +4 SHELL coverage tests (P2 baseline preserved, P3 required present, waves.json SWR exception, every SHELL entry exists on disk)

## Task Commits

1. **Task 1: SHELL coverage regression test (TDD)** — `506b4e4` (test, RED on P3 required) → see Task 2 for GREEN transition
2. **Task 2: Extend SHELL + bump APP_VERSION** — `7a6d85d` (feat — both edits in one commit; this is also the GREEN for Task 1)
3. **Task 3: README + VERSIONING release notes** — `75a3638` (docs)

## Files Created/Modified

**Created (1):**

- `tests/integration/sw.shell.test.js` — 165 lines, 4 tests, parses `sw.js` SHELL via source-text regex and asserts against locked baseline + P3 required + SWR exception + on-disk existence

**Modified (4):**

- `sw.js` — SHELL grew by 11 entries with a P3 comment block; no logic changes
- `js/util/version.js` — single-character edit `'0.2.0'` → `'0.3.0'`
- `README.md` — new "Version history" section above Constraints
- `VERSIONING.md` — new "Release history" section between "Mapping to roadmap" and "After v1.0"

## SHELL diff (the 11 P3 entries added)

```diff
   './js/io/seed.js',
   './seed/habits.json',
+  // Phase-3 first-usable-slice — added in 03-today-view-settings-v1.
+  // - Router + view + domain + util modules introduced in 03-01..03-03.
+  // - Settings panel + builders + setSetting handler introduced in 03-05.
+  // - Toast extensions (showUndoToast / showErrorToast) live in js/views/toast.js,
+  //   which is already in the P1-locked entries above; no duplicate entry.
+  // - seed/waves.json is intentionally NOT here; it is SWR-cached per D-81.
+  './js/router.js',
+  './js/views/today.js',
+  './js/views/today/builders.js',
+  './js/views/settings.js',
+  './js/views/settings/builders.js',
+  './js/domain/cadence.js',
+  './js/domain/wave.js',
+  './js/util/mount.js',
+  './js/state/apply/markUncompleted.js',
+  './js/state/apply/setSetting.js',
+  './css/settings.css',
 ];
```

## APP_VERSION transition

| Before | After  |
| ------ | ------ |
| `0.2.0` | `0.3.0` |

Cache name auto-derives: `habits-0.2.0` → `habits-0.3.0`. Existing `sw.js` activate handler deletes any cache name that does not equal the current `CACHE` constant, so the prior cache is cleaned up on the first activation under the new version. The P1-locked D-08 update toast ("New version ready — Reload") fires for any tab still on `0.2.0` because `controllerchange` fires when `clients.claim()` takes over.

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **P3_REQUIRED is hard-coded inside the test, not auto-derived.** The planner explicitly accepts the maintenance burden of extending the locked list each phase. Auto-derivation from a `git diff` against the prior phase HEAD would be fragile (renames, deletes, files moved out of `js/`) and would lose the value of the test — which is to catch the *human* slip of forgetting to register a file. The locked list IS the discipline.
- **Block comments are NOT supported inside the SHELL extraction regex.** The current `sw.js` SHELL uses only line-style comments, so this is fine. The limitation is documented in the parser's JSDoc inside `sw.shell.test.js`.
- **Release history is centralized in VERSIONING.md.** README has a 3-line summary + pointer. This keeps README scannable while letting VERSIONING.md hold the detailed prose (what shipped, bump rationale, cache invalidation, D-decision range).
- **Back-filled v0.1.0 and v0.2.0 entries.** Prior phases mentioned bumps in their SUMMARY.md and ROADMAP.md, but no central release log existed. Back-filling at v0.3.0 keeps the timeline coherent for any reader landing on VERSIONING.md fresh.

## Deviations from Plan

The plan executed faithfully with no deviations. All three tasks went RED/GREEN cleanly:

- Task 1's test had a JSDoc-comment syntax issue (an embedded `*/` escape) that surfaced on first run as a parser error. Fixed before commit (the original RED was the JSDoc parse error; rewrote the JSDoc paragraph to avoid the embedded block-comment characters, then re-ran to confirm the test loaded and produced the *intended* P3-required-missing failure). The committed RED is the intended-failure state, not the parser-error state.
- No code-path deviations. No new files added beyond the planned one. No tests broken.

## Issues Encountered

- **JSDoc parser error in `sw.shell.test.js`** — first draft of the file's JSDoc paragraph included the literal sequence describing a block-comment escape, which Node's ESM parser saw as a stray `*/` terminator followed by raw identifier text. Fixed pre-commit by rewriting the paragraph in prose without the literal escape sequence. No code-change repercussion.

No other surprises. Three tasks; three commits; clean.

## D-78 Discipline Verification

`tests/unit/discipline.xss.test.js` continues to pass. The new `sw.shell.test.js` is a test file (not under `js/`), and its source-text regex never constructs DOM — it reads `sw.js` via `readFileSync` and walks a `Set<string>`. No XSS surface.

## SHELL Coverage Test Self-Verification

The four new tests cover:

1. **P2 baseline preservation** — asserts the 30 P2 entries are still in SHELL. An accidental delete of e.g. `./js/db/repo.js` would go red here before shipping.
2. **P3 required presence** — asserts the 11 P3 entries are in SHELL. This was RED at the end of Task 1 (intentional); Task 2 turned it GREEN.
3. **SWR exception for waves.json** — asserts `./seed/waves.json` is NOT in SHELL. A future planner adding it by mistake would go red here.
4. **On-disk existence** — every SHELL entry must resolve to a real file. Catches typos (`./js/router.js` vs `./js/route.js`) before the SW install step 404s offline-first users.

## Requirements coverage

This plan claims NO new requirement completions. The 17 in-scope P3 requirements were all functionally completed by 03-01..03-05. This plan secures:

- **NFR-06** (PWA cache freshness for the new shell files) — every P3 shell file is precached on install via the extended SHELL list.
- **PWA-07** (install help is offline-available because the install card is part of the SHELL-precached `settings.js`) — `js/views/settings.js` is in SHELL.

## Known Stubs

None.

## Manual smoke instructions (post-ship verification)

After this plan ships to GitHub Pages (or `node scripts/serve.js`):

1. Open the site in a previously-installed tab (still on `0.2.0`). The SW update flow triggers; the D-08 update toast "New version ready — Reload" appears. The toast does NOT auto-dismiss (locked D-08 contract).
2. Click Reload. The page reloads; DevTools → Application → Cache Storage now shows `habits-0.3.0` and NO `habits-0.2.0` (cleaned up by activate handler).
3. DevTools → Application → Service Workers → confirm the active SW is the new one (timestamp updated).
4. DevTools → Network → uncheck "Online" (simulate offline). Reload the page. Today still mounts; navigate to `#settings`; the Settings panel still mounts. All 11 new files are served from cache.
5. Open `index.html` directly via `file://` (Firefox). SW silent-fails per `js/platform/sw-register.js` guard (D-20). Today still mounts (ES modules from `file://` work in Firefox; Chromium blocks them — use `node scripts/serve.js` for Chromium).
6. README and VERSIONING.md both render the v0.3.0 entry on GitHub Pages.

## Self-Check: PASSED

All claimed files exist and all commit hashes resolve:

- `tests/integration/sw.shell.test.js` — FOUND (165 lines, 4 tests)
- `sw.js` — MODIFIED (SHELL grew by 11 entries + comment block)
- `js/util/version.js` — MODIFIED (`'0.2.0'` → `'0.3.0'`)
- `README.md` — MODIFIED (new Version history section)
- `VERSIONING.md` — MODIFIED (new Release history section with v0.3.0/v0.2.0/v0.1.0)
- Commits `506b4e4`, `7a6d85d`, `75a3638` — all in `git log`
- Full suite `node --test "tests/**/*.test.js"` exits 0 with 279 / 279 green
- D-78 grep gate green: `tests/unit/discipline.xss.test.js` passes
- `grep "APP_VERSION = '0.3.0'" js/util/version.js` matches
- `grep "./js/views/settings.js" sw.js` matches
- `grep "v0.3.0" README.md` matches
- `grep "v0.3.0" VERSIONING.md` matches
- `grep "habits-0.3.0" VERSIONING.md` matches

## Phase 3 closeout

**Phase 3 is shippable.** Next: `/gsd-verify-work 3` — UAT confirms tap → toast → undo → settings flow against the 5 ROADMAP success criteria.

---
*Phase: 03-today-view-settings-v1-first-usable-slice*
*Completed: 2026-05-28*
