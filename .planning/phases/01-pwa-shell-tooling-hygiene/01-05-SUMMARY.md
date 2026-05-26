---
phase: 01-pwa-shell-tooling-hygiene
plan: 05
subsystem: readme-and-phase-gate
tags:
  - readme
  - deploy
  - gh-pages
  - static-gates
  - device-install
  - phase-gate
dependency_graph:
  requires:
    - All chassis files shipped in Plans 01-01 through 01-04 (index.html, desktop.html, manifest.json, sw.js, icon.svg, css/*, js/util/version.js, js/platform/sw-register.js, js/views/diagnostics.js, js/views/toast.js, js/main.js, js/desktop.js)
    - .planning/phases/01-pwa-shell-tooling-hygiene/01-RESEARCH.md (§Pitfall 3 trailing-slash convention; §Validation Architecture manual smoke-test checklist; §Security Domain V14 static-grep gates)
    - .planning/phases/01-pwa-shell-tooling-hygiene/01-VALIDATION.md (per-task manual verification map; sampling rate)
    - .planning/phases/01-pwa-shell-tooling-hygiene/01-CONTEXT.md decisions D-02, D-05, D-06, D-10, D-12, D-19
  provides:
    - README.md (developer-facing entry point — install modes, version-bump procedure, diagnostics + Reset-shell recovery, three static-grep gates, pointers to smoke-test checklists, locked constraint list)
    - The phase-gate verification surface (hands-on device installs + GH Pages sub-path deploy) — surfaced as a checkpoint:human-verify response to the orchestrator
  affects:
    - Phase 2+ (the README's APP_VERSION bump procedure, static-grep gates, and Reset-shell escape hatch are the contract subsequent phases inherit without renegotiation)
    - Walking Skeleton acceptance (steps 1-7 from 01-SKELETON.md remain deferred to the human verifier per Plan 01-04 Task 5; this plan re-surfaces them alongside the device-install items)
tech_stack:
  added:
    - Markdown documentation (README.md at project root)
  patterns:
    - Single-source-of-truth deployment doc (README is the contract between codebase and future developer/the same author later)
    - Copy-pasteable static-grep gates with one-line rationale per gate
    - Verbatim quoting of D-06 Reset-shell confirm copy (matches js/views/diagnostics.js exactly so a search across the repo finds both occurrences)
    - Relative-link pointers from README to .planning artifacts (no hard-coded paths outside the repo)
key_files:
  created:
    - README.md
  modified: []
decisions:
  - "README structure: seven sections in the order specified by the plan (What this is, Run modes, Bumping the version, Diagnostics & recovery, Static gates, Manual smoke-test checklist, Constraints)"
  - "Trailing-slash convention documented prominently in the GitHub Pages subsection — both the canonical URL `https://lukasz-bielinski.github.io/habits/` and the failure mode (no trailing slash → SW scope misresolves) are called out per Pitfall 3"
  - "Three static gates shipped as fenced shell-command blocks with `sh` syntax hint (not raw shell-prompt prose) so they are copy-paste-safe on Windows + POSIX"
  - "D-06 Reset-shell confirm copy quoted verbatim inside a fenced block so a future grep across the repo (e.g., 'Reset shell — unregister') finds it in both the implementation (js/views/diagnostics.js) and the docs (README.md)"
  - "Manual smoke-test checklist deliberately points to the three planning artifacts (RESEARCH.md, VALIDATION.md, SKELETON.md) rather than re-stating their content — single source of truth"
  - "Phase 1 has no test-runner — README does NOT fabricate a `node --test tests/` reference even though PROJECT.md D-23..D-26 lock that command for Phase 2+. Tests live at Phase 2+; mentioning them here would mislead a reader of the Phase 1 chassis"
  - "Task 2 phase-gate device verification is surfaced as a checkpoint:human-verify response to the orchestrator — not executed by this sequential executor (per the prompt's split between autonomous README authoring and human-verify gate)"
metrics:
  duration_minutes: ~10
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  commits: 1
  completed_date: 2026-05-26
---

# Phase 1 Plan 5: README + Phase-Gate Summary

**One-liner:** README.md ships the deploy/recovery/version-bump documentation for the Phase 1 chassis (three run modes including the GH Pages trailing-slash gotcha, the three static-grep NFR gates as copy-pasteable shell commands, the diagnostics + Reset-shell recovery paths with D-06 verbatim, the APP_VERSION bump procedure, and pointers to the planning-artifact smoke-test checklists); the device-install + GH Pages sub-path phase-gate is surfaced as a checkpoint:human-verify response for the orchestrator/user to drive.

## What Shipped

One atomic commit added one new file at the project root: `README.md`. No source code, no config, no build artifacts — pure developer-facing documentation that ties together the chassis Plans 01-01 through 01-04 already landed.

### Task 1 — README.md (commit `fd1ea0a`)

| File | Purpose |
| --- | --- |
| `README.md` | 109 lines. Seven sections in the order required by the plan: (1) **What this is** — one-paragraph project description from PROJECT.md; (2) **Run modes** — three subsections for `file://`, localhost (`python -m http.server 8000`), GitHub Pages (`https://lukasz-bielinski.github.io/habits/` with the trailing-slash warning); (3) **Bumping the version** — the D-10 + D-12 procedure (one edit in `js/util/version.js`, then redeploy) and the controllerchange + toast user-side flow; (4) **Diagnostics & recovery** — the two D-02 triggers (`?debug=1` and long-press) plus the verbatim D-06 Reset-shell confirm string inside a fenced block; (5) **Static gates** — three fenced shell-command blocks for NFR-04, NFR-11, NFR-12 with a one-line rationale each; (6) **Manual smoke-test checklist** — relative pointers to `01-RESEARCH.md`, `01-VALIDATION.md`, `01-SKELETON.md` inside the `.planning/` tree; (7) **Constraints** — the nine-bullet list from PROJECT.md §Constraints (vanilla stack, multi-file, IDB-primary in P2+, static + file://-safe, fully offline, EN chrome / PL data, distinct mobile vs desktop, history integrity, privacy-first). |

## Locked Sections + Phrasings

| Section | Lock | Verification |
| --- | --- | --- |
| Run modes — file:// | `js/platform/sw-register.js` guards register() behind `location.protocol.startsWith('http')` + silent `.catch(() => {})` — copied verbatim as the explanation in README | grep "file:\/\/" README.md → 2 matches |
| Run modes — localhost | Canonical command is `python -m http.server 8000` matching VALIDATION.md and PROJECT.md install instructions | grep "python -m http.server 8000" README.md → 1 match |
| Run modes — GitHub Pages | Canonical URL `https://lukasz-bielinski.github.io/habits/` documented with the trailing-slash failure mode (Pitfall 3) | grep "lukasz-bielinski.github.io/habits/" README.md → 2 matches |
| Bumping the version | `js/util/version.js` referenced; APP_VERSION constant called out; D-10 rule (shell-asset-only bumps) documented; D-11 SWR-for-/js/ rationale included | grep "APP_VERSION" README.md → 3 matches |
| Reset shell confirm | D-06 phrasing inside a fenced block: `Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install.` Em-dash matches `js/views/diagnostics.js` source | grep "Reset shell — unregister service worker" README.md → 1 match |
| Static gates | Three fenced shell-command blocks (`grep -rE`, `ls \| grep`, `grep -nE`) with one-line rationale each | grep "grep" README.md → matches three commands |
| Manual smoke-test pointers | `.planning/phases/01-pwa-shell-tooling-hygiene/01-VALIDATION.md` and `01-RESEARCH.md` and `01-SKELETON.md` all referenced by relative path | grep "01-VALIDATION.md" README.md → 2 matches; grep "01-RESEARCH.md" README.md → 2 matches |

## Consolidated Verification

Plan automated verify (run in Task 1):

```
node -e "..."
```

Output: `OK lines=110`. All 19 regex assertions passed (h1 title, Run modes section, file:// mention, localhost command, GH Pages URL, trailing-slash convention, Version bump section, version.js reference, APP_VERSION constant, Diagnostics section, ?debug=1 trigger, long-press trigger, D-06 verbatim phrasing, Static gates section, NFR-04 grep, NFR-12 grep, pointer to VALIDATION.md, pointer to RESEARCH.md, Constraints section). The 60-line minimum is exceeded with a count of 110.

Re-run of the three static-grep gates from the plan's `<verification>` section after README landed (none of these touch README's body — they verify the rest of the repo hasn't regressed):

| Gate | Command | Result |
| --- | --- | --- |
| NFR-04 | `grep -rE "fetch\(\s*['\"]https?:" js/` | empty (no off-origin fetch anywhere in `js/`) |
| NFR-11 | `ls -1 \| grep -E "^(node_modules\|package(-lock)?\.json\|dist\|build)$"` | empty (no build artifacts at project root) |
| NFR-12 | `grep -nE '"\s*/[a-z]' index.html desktop.html manifest.json sw.js` | empty (no absolute paths in shell files) |

README content gates from the plan's `<verification>` section:

| Gate | Output |
| --- | --- |
| `grep -c "lukasz-bielinski\.github\.io/habits/" README.md` | 2 matches |
| `grep -c "Reset shell — unregister service worker" README.md` | 1 match (verbatim D-06) |
| `grep -c "APP_VERSION" README.md` | 3 matches |
| `grep -c "?debug=1" README.md` | 2 matches |
| `grep -c "01-VALIDATION.md" README.md` | 2 matches |

## Deviations from Plan

None. The README ships its full intended content with the seven sections in the specified order; the D-06 quote is verbatim; all three NFR gates appear as copy-pasteable fenced blocks; pointers to `01-VALIDATION.md`, `01-RESEARCH.md`, and `01-SKELETON.md` are all present. No `node --test tests/` reference was invented despite the Phase 2+ test command being locked in PROJECT.md D-23..D-26 — Phase 1 has no `tests/` directory yet, and fabricating one in the README would mislead a reader of the chassis (per the executor prompt's `<no_unauthorized_deviations>` clause).

Task 2 (the `checkpoint:human-verify` device-install + GH Pages sub-path verification) is NOT executed by this sequential executor. Per the prompt, the autonomous portion ends with the README commit; the human verification is surfaced as a structured checkpoint response to the orchestrator/user. The items below in "Awaiting Human Verification" enumerate exactly what the user must drive on real hardware.

## Awaiting Human Verification

Phase 1 is not yet "complete" — three classes of verification require physical devices and/or a live deploy, and they are the contract that closes PWA-05, PWA-06, and NFR-12 against real-world conditions.

### Walking Skeleton steps 1-7 (deferred from Plan 01-04 Task 5)

Run on the developer machine, in order:

1. **File:// open** — Double-click `index.html`. Empty Today scaffold renders. DevTools console clean. `navigator.serviceWorker.controller === null`.
2. **HTTPS open via localhost** — `python -m http.server 8000` then visit `http://localhost:8000/`. Empty Today scaffold renders identically. DevTools → Application → Service Workers shows `sw.js` activated. Cache Storage shows `nawyki-v1` populated with all 17 SHELL entries.
3. **Offline reload** — DevTools → Network → Offline → reload. Page renders from cache identically.
4. **`?debug=1` trigger** — Navigate to `http://localhost:8000/?debug=1`. Diagnostics panel mounts with all six rows (App version=v1, Schema version=n/a (P2), Service worker=controlled, Cache name=nawyki-v1, Install state=browser, Persistence=n/a (P2)).
5. **Long-press trigger** — On the page (not in debug mode), long-press the "Habits" title for ~1.5 s. Diagnostics panel mounts. Then refresh, tap the title and immediately drag-scroll — diagnostics should NOT mount (Pitfall 7).
6. **Reset shell** — Diagnostics → click "Reset shell" → confirm dialog shows the verbatim D-06 string → click OK → SW unregisters + caches clear + page reloads to a fresh install.
7. **Update toast** — Bump `APP_VERSION` to `'v2'` in `js/util/version.js`. Reload. The toast "New version ready — Reload" appears (because `hadController` was true going into the new SW; first-install never sees the toast — Pitfall 6). Click Reload. New cache `nawyki-v2` is now active; old `nawyki-v1` deleted. Restore `APP_VERSION` to `'v1'` for subsequent testing.

### PWA-05: Installability on at least one target platform

At least one of the following MUST pass; the others are best-effort and may be deferred with reason:

- **Desktop Chrome / Edge** (MANDATORY per plan acceptance) — Open `https://lukasz-bielinski.github.io/habits/` → URL-bar install icon appears → click → "Install Habits?" prompt → click Install → standalone window opens (no URL bar, no tabs). In DevTools console of the standalone window: `navigator.serviceWorker.controller` returns a SW reference; `window.matchMedia('(display-mode: standalone)').matches` returns `true`; `?debug=1` shows Install state row as "standalone".
- **Android Chrome** (best-effort) — Visit the GH Pages URL on Android Chrome → Install prompt OR menu → "Install app" / "Add to Home Screen" → confirm. Tap home-screen icon → app launches standalone (no URL bar). Long-press the "Habits" title for ~1.5 s → diagnostics panel mounts (verifies long-press on real touch hardware).
- **iOS Safari** (best-effort) — Visit the GH Pages URL on iOS Safari → Share → "Add to Home Screen" → confirm name "Habits" → Add. Tap home-screen icon → app launches standalone (no Safari chrome). Hold the "Habits" title for ~1.5 s → diagnostics panel mounts.

### PWA-06: Offline-after-install behavior

For each platform where install succeeded, verify offline reload:

- **Desktop Chrome / Edge** — In the standalone window, DevTools → Network → Offline → reload. Page renders.
- **Android Chrome** — Enable airplane mode (or disable Wi-Fi + mobile data). Close and re-open the app from the home screen. Page renders.
- **iOS Safari** — Enable airplane mode. Close and re-open the app from the home screen. Page renders.

### NFR-12: GitHub Pages sub-path deploy works

After pushing `main` to GH Pages and waiting for the build to complete:

- Open `https://lukasz-bielinski.github.io/habits/` (note the trailing slash). DevTools → Application → Service Workers: scope shows `https://lukasz-bielinski.github.io/habits/` (sub-path correctly resolved, not the origin root). Cache Storage: `nawyki-v1` populated with all 17 SHELL entries, all under `/habits/` prefix.
- Local re-run: `grep -nE '"\s*/[a-z]' index.html desktop.html manifest.json sw.js` returns empty (no absolute-path landmines snuck in).

### Acceptance threshold

Per the plan's Task 2 resume-signal: **desktop Chrome install + offline reload + GH Pages sub-path deploy MUST pass.** Android + iOS are best-effort — if either platform is unavailable, document which platform succeeded and treat the missing one as a deferred follow-up.

## Known Stubs

None for this plan — README ships its full intended P1 content. The known stubs from earlier plans (Schema version / Persistence rendering `n/a (P2)`, Reset data button `disabled` with `title="available in P2"`, empty Today scaffold placeholders) are documented in this plan's README under "Diagnostics & recovery" as intentional P1 behavior and pointed at the Phase 2 resolution.

## Threat Flags

None. No new attack surface introduced beyond what the plan's `<threat_model>` already enumerates. The README documents existing mitigations:

- T-01-V14 (documentation, GH Pages trailing slash): README §Run modes / GitHub Pages calls out the trailing-slash failure mode prominently.
- T-01-StaleCache (procedure): README §Bumping the version codifies the single-edit procedure in `js/util/version.js` plus the D-10 shell-asset-only bump rule.
- T-01-ResetSurface (discoverability): README §Diagnostics & recovery documents both triggers AND the verbatim D-06 phrasing.
- T-01-NoNet (audit gate): README §Static gates includes the NFR-04 grep as a copy-pasteable shell command.
- T-01-V14 (real-device PWA-05): Surfaced in §Awaiting Human Verification — the phase-gate verifies the manifest's `scope: "./"`, relative icon path, and `display: standalone` actually produce a standalone install on each target OS.

## Commits

| # | Hash | Subject |
| --- | --- | --- |
| 1 | `fd1ea0a` | `docs(01-05): add README documenting chassis + install modes + grep gates` |

## Self-Check: PASSED

- ✅ `README.md` exists at the project root.
- ✅ `git log --oneline` shows commit `fd1ea0a` with the `docs(01-05): add README documenting chassis + install modes + grep gates` subject.
- ✅ Plan's automated verify (`node -e "..."`) printed `OK lines=110` (≥60-line floor).
- ✅ All seven required sections present in order: `# Habits`, `## Run modes`, `## Bumping the version`, `## Diagnostics & recovery`, `## Static gates`, `## Manual smoke-test checklist`, `## Constraints`.
- ✅ GitHub Pages URL `https://lukasz-bielinski.github.io/habits/` mentioned with trailing-slash failure mode (Pitfall 3).
- ✅ D-06 Reset-shell confirm string is verbatim, inside a fenced block.
- ✅ Three static-grep gates present as fenced `sh` blocks (NFR-04, NFR-11, NFR-12).
- ✅ Pointers to `01-VALIDATION.md`, `01-RESEARCH.md`, `01-SKELETON.md` all present with relative paths.
- ✅ APP_VERSION bump procedure documented with reference to `js/util/version.js`, D-10, D-11, and the controllerchange+toast flow.
- ✅ Both diagnostics triggers (`?debug=1` AND long-press) documented per D-02.
- ✅ Re-run of NFR-04 / NFR-11 / NFR-12 static gates on the repo all return empty (no regressions).
- ✅ No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or `.planning/REQUIREMENTS.md` — per the executor prompt's locked artifacts list.
- ✅ Pre-existing untracked `.planning/phases/01-pwa-shell-tooling-hygiene/01-PATTERNS.md` was not touched.
- ✅ No build artifacts (`node_modules/`, `package.json`, `dist/`, `build/`) created.
- ✅ No `node --test tests/` references fabricated (Phase 1 has no `tests/`; P2+ test command is locked in PROJECT.md D-23..D-26 but does not belong in the Phase 1 chassis README).
- ✅ Task 2 (`checkpoint:human-verify` device-install + GH Pages phase-gate) is surfaced as a structured checkpoint response to the orchestrator/user, NOT executed by this sequential executor (per `<execution_steps>` step 5).
