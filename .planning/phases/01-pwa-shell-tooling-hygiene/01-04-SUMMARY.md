---
phase: 01-pwa-shell-tooling-hygiene
plan: 04
subsystem: walking-skeleton-wiring
tags:
  - sw-registration
  - file-safe
  - controllerchange
  - had-controller
  - html-shells
  - vertical-slice
dependency_graph:
  requires:
    - js/util/version.js (Plan 01-01 — re-exported into runtime via main.js → diagnostics.js)
    - css/main.css (Plan 01-01 — linked from both HTML shells)
    - manifest.json (Plan 01-01 — linked from both HTML shells)
    - icon.svg (Plan 01-01 — linked from both HTML shells)
    - sw.js (Plan 01-02 — registered by sw-register.js; its SHELL array references all 17 files now present on disk)
    - js/views/toast.js (Plan 01-03 — showUpdateToast imported by sw-register.js)
    - js/views/diagnostics.js (Plan 01-03 — mountDiagnostics + attachLongPress imported by main.js and desktop.js)
  provides:
    - js/platform/sw-register.js (exports registerServiceWorker — single integration point for navigator.serviceWorker per D-20)
    - js/main.js (mobile shell entry point — wires SW register + both D-02 diagnostics triggers)
    - js/desktop.js (desktop stub entry point — wires SW register + ?debug=1 only)
    - index.html (mobile shell with empty Today scaffold per D-01 + [data-app-title] long-press anchor)
    - desktop.html (desktop stub with "Switch to mobile" link per D-04)
    - Runnable Walking Skeleton (SKELETON.md steps 1–7 now executable on the developer machine)
  affects:
    - Plan 05 (validation gates run against these five files; PWA-04 / NFR-09 / NFR-12 demonstrable from this wiring)
    - Phase 2+ (mobile entry point becomes the boot site for IDB/state/router wiring)
tech_stack:
  added:
    - HTML5 shell (two entry points: index.html mobile, desktop.html desktop stub)
    - ES module entry points (<script type="module">) with './' relative imports
    - Service Worker registration call (deferred to window.load; behind protocol guard)
    - controllerchange listener with hadController capture (real-update vs first-install discrimination)
    - iOS Safari standalone meta trio (apple-mobile-web-app-capable/status-bar-style/title)
  patterns:
    - Three-layer SW registration defense (feature detect + protocol guard + silent catch)
    - Single integration point for navigator.serviceWorker (D-20 — all SW touches live in sw-register.js)
    - First-install vs real-update discrimination via pre-registration controller capture (Pitfall 6)
    - Dual diagnostics trigger surface (URL ?debug=1 + long-press on [data-app-title]) — mobile only
    - HTML shell symmetry — same head shape on both shells so installability paths exist for both (D-04)
    - Relative-only paths in HTML, JS imports, and HTML link/src attributes (D-19, NFR-12)
key_files:
  created:
    - js/platform/sw-register.js
    - js/main.js
    - js/desktop.js
    - index.html
    - desktop.html
  modified: []
decisions:
  - "All paths use './...' relative form per D-19 — verified by NFR-12 grep gate returning empty"
  - "Long-press anchor selector is `[data-app-title]` — applied to <h1> in index.html (mobile); absent from desktop.html (D-04)"
  - "sw-register.js captures `const hadController = !!navigator.serviceWorker.controller` BEFORE the load-deferred register() call — Pitfall 6 fix"
  - "Both HTML shells link the iOS Safari standalone meta trio (capable/status-bar-style/title) — installability is identical for both (D-04 + Pattern D)"
  - "Footer-nav stub uses non-clickable <span> elements (today/history/settings) — per CONTEXT §Specific Ideas they are placeholders, not anchors; wiring lands in later phases"
  - "Walking Skeleton runtime checkpoint (Task 5) is end-user verification — deferred to the orchestrator/user for steps 1–7 execution; this executor's responsibility ends at the static gates"
metrics:
  duration_minutes: ~10
  tasks_completed: 4
  files_created: 5
  files_modified: 0
  commits: 4
  completed_date: 2026-05-26
---

# Phase 1 Plan 4: Walking-Skeleton Wiring Summary

**One-liner:** Five new files wire Plans 01-01/02/03 into runnable HTML — the file://-safe SW registration module with controllerchange + hadController, two ES-module entry points, and two HTML shells (mobile empty-Today scaffold + desktop "Switch to mobile" stub) — so SKELETON.md steps 1–7 become executable on the developer machine.

## What Shipped

Four atomic commits added five new files. The Walking Skeleton is now structurally complete: every SHELL entry referenced by Plan 01-02's `sw.js` now exists on disk (post-landing smoke check passes — see Issues Encountered below). Plan 04 is the vertical-slice payoff: PWA-04 (silent SW fail on file://), NFR-09 (loads on file://), NFR-12 (relative paths only), and NFR-04 (no network calls in P1) all land their evidence in this plan's files.

### Task 1 — `js/platform/sw-register.js` (commit `beecee0`)

| File | Purpose |
| --- | --- |
| `js/platform/sw-register.js` | 58 lines. The SINGLE integration point that touches `navigator.serviceWorker` (D-20). Exports `registerServiceWorker()`. Imports `showUpdateToast` from `../views/toast.js`. Three-layer defense: feature-detect (`'serviceWorker' in navigator`), protocol guard (`location.protocol.startsWith('http')`), silent `.catch(() => { /* silent */ })`. Captures `const hadController = !!navigator.serviceWorker.controller` BEFORE the load-deferred `register()` call so the subsequent `controllerchange` event can discriminate real updates from first installs (Pitfall 6). The registration is deferred via `window.addEventListener('load', …)` so it does not contend with first paint. The `controllerchange` listener calls `showUpdateToast()` ONLY when `hadController` was true (D-08). Path is `./sw.js` — relative per D-19. |

### Task 2 — `js/main.js` and `js/desktop.js` (commit `25ba61c`)

| File | Purpose |
| --- | --- |
| `js/main.js` | 31 lines. Mobile entry point. Imports `registerServiceWorker` from `./platform/sw-register.js` and `mountDiagnostics + attachLongPress` from `./views/diagnostics.js`. Calls `registerServiceWorker()` synchronously, then reads `?debug=1` via `new URLSearchParams(location.search)` and calls `mountDiagnostics()` if matched, then queries `document.querySelector('[data-app-title]')` and calls `attachLongPress(titleEl, mountDiagnostics)` if the element exists. D-02 dual trigger surface (URL + long-press) wired in one place. Zero `fetch()` calls (NFR-04 / T-01-NoNet). |
| `js/desktop.js` | 22 lines. Desktop stub entry point. Same `registerServiceWorker()` call as the mobile entry (installability paths exist for both shells from day one per D-04). Reads `?debug=1` and calls `mountDiagnostics()` if matched. **No `attachLongPress`** — D-04 says desktop has no long-press surface in P1. Zero `fetch()` calls. |

### Task 3 — `index.html` (commit `abf958c`)

| File | Purpose |
| --- | --- |
| `index.html` | 33 lines. Mobile HTML shell. Valid HTML5 (`<!DOCTYPE html>` + `<html lang="en">`). Head: `<meta charset="UTF-8">`, viewport meta, `<title>Habits</title>`, description meta (`"Personal multi-year habit tracker."`), `theme-color="#f5a623"`, the iOS Safari standalone meta trio (apple-mobile-web-app-capable=yes / apple-mobile-web-app-status-bar-style=black-translucent / apple-mobile-web-app-title=Habits), then four `<link>` tags all using `./` relative form: icon→`./icon.svg`, apple-touch-icon→`./icon.svg`, manifest→`./manifest.json`, stylesheet→`./css/main.css`. Body: `<header class="today-header">` containing `<h1 data-app-title>Habits</h1>` (the long-press anchor from D-02) plus two empty placeholder divs for date and current wave; a `<main>` wrapper with an empty `<ul class="today-list">`; and a `<nav class="today-footer-nav">` with three non-clickable `<span>` labels (`today`, `history`, `settings`) per CONTEXT §Specific Ideas. Final element: `<script type="module" src="./js/main.js"></script>`. |

### Task 4 — `desktop.html` (commit `734c6a8`)

| File | Purpose |
| --- | --- |
| `desktop.html` | 25 lines. Desktop stub. Same head shape as `index.html` (manifest link, icon, apple-touch-icon, stylesheet, iOS standalone meta trio — D-04 mandates installability parity) EXCEPT the title is `Habits — Desktop (coming soon)` and the script is `./js/desktop.js`. Body: `<main class="stub">` with `<h1>Habits</h1>`, `<p>The desktop analytics layout ships in a later phase.</p>`, and `<p><a href="./index.html">Open the mobile view →</a></p>` (research §Example 5 verbatim). No `data-app-title` attribute (no long-press surface per D-04). |

## Locked Path Conventions

Every `href`, `src`, and ES module import specifier in the five files this plan ships uses the `./` relative form:

| Surface | Examples |
| --- | --- |
| HTML `<link href>` | `./icon.svg`, `./manifest.json`, `./css/main.css` |
| HTML `<script src>` | `./js/main.js`, `./js/desktop.js` |
| HTML `<a href>` | `./index.html` (desktop.html switch link) |
| ES module `import … from` | `./platform/sw-register.js`, `./views/diagnostics.js`, `../views/toast.js` |
| SW registration path | `./sw.js` (in sw-register.js) |

The NFR-12 grep gate (`grep -nE '"\s*/[a-z]' index.html desktop.html`) returns empty against both shells. The T-01-NoNet grep (`grep -E 'https?://' index.html desktop.html js/platform/sw-register.js js/main.js js/desktop.js`) returns empty against all five files.

## Long-Press Anchor Selector

```
[data-app-title]
```

The attribute is applied to `<h1>Habits</h1>` in `index.html` only. `desktop.html` deliberately omits it (D-04 — no long-press surface). `js/main.js` queries the attribute via `document.querySelector('[data-app-title]')` and calls `attachLongPress(titleEl, mountDiagnostics)` only when the element is found (defensive — protects against the selector being absent during future refactors).

## Three-Layer SW Registration Defense

The `registerServiceWorker()` function in `js/platform/sw-register.js` early-returns at three checkpoints before any `register()` call is made. Each layer alone would suffice in some failure modes; together they cover every known file:// landmine:

| Layer | Check | When it fires | Why required |
| --- | --- | --- | --- |
| 1 | `!('serviceWorker' in navigator)` | Old browsers without SW support | Defensive — covers user-agent variation |
| 2 | `!location.protocol.startsWith('http')` | Any `file://` (or `chrome:`, `about:`) opening | **D-20 second defense; the locked discriminator for file://-safe**. SW requires a secure context; `register()` would throw SecurityError. |
| 3 | `.catch(() => { /* silent */ })` on the register call | Anything that slips through 1+2 (network failure, malformed sw.js, etc.) | Last-resort silent catch so the page stays renderable |

PWA-04 + NFR-09 land their evidence at layer 2. T-01-FileSafe is the threat ID this guard mitigates.

## First-Install vs Real-Update Discrimination (Pitfall 6)

`navigator.serviceWorker.controller` is `null` on the first-ever visit (no SW is controlling the page yet); it becomes non-null on subsequent visits once the SW activates. The `controllerchange` event fires whenever the controlling SW changes — including the first-ever install. Without a guard, brand-new users would see an unwanted "New version ready" toast on their first visit.

The fix is to capture `!!navigator.serviceWorker.controller` BEFORE `register()` is called:

```js
const hadController = !!navigator.serviceWorker.controller;
// ... register() later ...
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController) return; // first install — never toast
  showUpdateToast();
});
```

On the first-ever install: `hadController = false`; first `controllerchange` is silent. On a subsequent deploy with APP_VERSION bumped: the user opens the page; `hadController = true`; when the new SW activates and `controllerchange` fires, the toast appears.

## Post-Landing Smoke — sw.js SHELL list

The plan instruction `<post_landing_smoke>` asked the executor to verify that every entry in `sw.js`'s `SHELL` array now exists on disk. Result:

```
SHELL has 17 entries
  OK ./
  OK ./index.html
  OK ./desktop.html
  OK ./manifest.json
  OK ./icon.svg
  OK ./css/main.css
  OK ./css/tokens.css
  OK ./css/reset.css
  OK ./css/base.css
  OK ./css/components.css
  OK ./css/today.css
  OK ./js/main.js
  OK ./js/desktop.js
  OK ./js/util/version.js
  OK ./js/platform/sw-register.js
  OK ./js/views/diagnostics.js
  OK ./js/views/toast.js
All SHELL entries exist on disk
```

All 17 entries present. `cache.addAll(SHELL)` will now succeed at install time on HTTPS. The runtime verification gate (Task 5 checkpoint) is now executable.

## Consolidated Verification (post-Task-4)

Static gates from the plan's `<verification>` section:

1. ✅ `grep -E 'location\.protocol\.startsWith\(.http.\)' js/platform/sw-register.js` — match (line 37).
2. ✅ `grep -E 'hadController' js/platform/sw-register.js` — matches (lines 43, 55).
3. ✅ `grep -E 'data-app-title' index.html` — match (line 19).
4. ✅ `grep -E '<link rel="manifest" href="\./manifest\.json"' index.html desktop.html` — 2 matches (both shells).
5. ✅ `grep -E 'https?://' index.html desktop.html js/platform/sw-register.js js/main.js js/desktop.js` — empty (T-01-NoNet).
6. ✅ `grep -nE '"\s*/[a-z]' index.html desktop.html` — empty (NFR-12).

Per-task automated verifies (all printed `OK`):

7. ✅ Task 1 verify — eleven regex assertions on `sw-register.js` shape.
8. ✅ Task 2 verify — ten regex assertions on `main.js` / `desktop.js`, plus two negative gates (no `attachLongPress` in desktop.js, no `fetch(` in either).
9. ✅ Task 3 verify — eighteen regex assertions on `index.html` shape, plus two negative gates (no absolute paths, no off-origin URLs).
10. ✅ Task 4 verify — eight regex assertions on `desktop.html`, plus three negative gates (no `data-app-title`, no absolute paths, no off-origin URLs).

Runtime gates (deferred to Task 5 checkpoint — see below):

11. ⏳ Open `index.html` via `file://` → empty Today scaffold renders, console clean, `navigator.serviceWorker.controller === null`.
12. ⏳ Open via `http://localhost:8000/` → DevTools → Application → Service Workers shows `sw.js` activated; Cache Storage shows `nawyki-1.0.0` with 17 entries.
13. ⏳ Offline reload → page renders identically.
14. ⏳ `?debug=1` → diagnostics panel mounts with all six rows.
15. ⏳ Long-press app title 1.5 s → diagnostics panel mounts; immediate drag cancels.
16. ⏳ Reset shell → confirm D-06 phrasing → SW unregisters + caches clear + reload.
17. ⏳ Bump APP_VERSION to `'1.0.1'`, redeploy, reload twice → toast "New version ready — Reload" appears; old user (first install) does NOT see toast on initial install.

## Task 5 Checkpoint Outcome

Task 5 in the plan is a `<task type="checkpoint:human-verify" gate="blocking">` that requires manually executing SKELETON.md steps 1–7 on the developer machine. **Per the orchestrator's prompt this executor is sequential on the main working tree and is not the entity that executes runtime smoke tests — the orchestrator/user will run Task 5 separately.** This summary marks Task 5 as ⏳ deferred; the four implementation tasks (1–4) are committed and the static gates that protect Task 5 execution all pass.

## Deviations from Plan

None — plan executed exactly as written. Each file's shape matches the plan's `<action>` block verbatim; each task's automated verify printed `OK` on first run with no edits. No CLAUDE.md rules were violated (no emojis in any committed file; no MD docs created beyond the requested SUMMARY).

## Known Stubs

| Surface | Stub | Resolution phase |
| --- | --- | --- |
| `<header class="today-header">` date placeholder | Empty `<div class="today-date" aria-label="Today's date"></div>` — no content rendered | Phase 3 (Today view ships the date) |
| `<header class="today-header">` wave placeholder | Empty `<div class="today-wave" aria-label="Current wave"></div>` — no content rendered | Phase 3 (Today view ships the current wave) |
| `<ul class="today-list">` | Empty `<ul>` — no list items rendered | Phase 3 (Today view ships habit-card rendering) |
| Footer nav labels | Three non-clickable `<span>` elements (today/history/settings) | Phase 3+ (router lands; spans become navigation triggers) |

These are **intentional placeholders documented by D-01 and CONTEXT §Specific Ideas** ("they're not clickable yet — they're placeholders that prove the layout, removed/wired in later phases"). They are not bugs and do not block the Walking Skeleton acceptance — the empty scaffold IS the deliverable for P1.

## Issues Encountered

None. The plan's `<post_landing_smoke>` instructed the executor to flag any mismatch between `sw.js`'s SHELL asset list and the files now on disk; the verification above (17/17 entries present) confirms perfect alignment. No SHELL entries are orphaned; no expected file is missing.

## Threat Flags

None. No new attack surface introduced beyond what the plan's `<threat_model>` already enumerates. All five threats (T-01-FileSafe, T-01-StaleCache, T-01-V14 manifest scope, T-01-NoNet, T-01-ResetSurface) have their mitigations either landed in this plan (T-01-FileSafe via the protocol guard in sw-register.js; T-01-NoNet via zero off-origin URLs across all five files; T-01-V14 via the NFR-12 grep gate) or referenced from prior plans (T-01-StaleCache + T-01-ResetSurface from Plans 02 and 03 respectively).

## Commits

| # | Hash | Subject |
| --- | --- | --- |
| 1 | `beecee0` | `feat(01-04): add file-safe SW registration with controllerchange wiring` |
| 2 | `25ba61c` | `feat(01-04): add mobile and desktop entry points` |
| 3 | `abf958c` | `feat(01-04): add mobile HTML shell with empty Today scaffold` |
| 4 | `734c6a8` | `feat(01-04): add desktop stub with Switch-to-mobile link` |

## Self-Check: PASSED

- ✅ `js/platform/sw-register.js` exists; imports `showUpdateToast` from `../views/toast.js`; exports `registerServiceWorker`; contains feature-detect, protocol guard (`location.protocol.startsWith('http')`), `hadController` capture before register(), load-deferred `navigator.serviceWorker.register('./sw.js').catch(() => { /* silent */ })`, and `controllerchange` listener with `if (!hadController) return` first-install guard before `showUpdateToast()`.
- ✅ `js/main.js` exists; imports `registerServiceWorker` from `./platform/sw-register.js` and `mountDiagnostics + attachLongPress` from `./views/diagnostics.js`; calls `registerServiceWorker()`; reads `?debug=1` via `new URLSearchParams(location.search)`; queries `[data-app-title]` and calls `attachLongPress(titleEl, mountDiagnostics)`.
- ✅ `js/desktop.js` exists; imports `registerServiceWorker` and `mountDiagnostics` only; calls `registerServiceWorker()`; reads `?debug=1`; contains NO `attachLongPress` and NO `fetch(` (D-04 + T-01-NoNet).
- ✅ `index.html` exists; valid HTML5 with `<html lang="en">`; iOS Safari standalone meta trio present (capable/status-bar-style/title); four `<link>` tags all `./` relative; `<h1 data-app-title>Habits</h1>`; empty `<ul class="today-list">`; footer-nav with three non-anchor `<span>` labels (today/history/settings); single `<script type="module" src="./js/main.js">`.
- ✅ `desktop.html` exists; same head shape as `index.html` (manifest, icon, apple-touch-icon, stylesheet, iOS meta trio); title is `Habits — Desktop (coming soon)`; body has `<main class="stub">` with h1 + intro paragraph + switch-to-mobile link (`./index.html`); single `<script type="module" src="./js/desktop.js">`; no `data-app-title` attribute.
- ✅ All four task commits exist in `git log --oneline` (`beecee0`, `25ba61c`, `abf958c`, `734c6a8`).
- ✅ All 17 SHELL entries in `sw.js` now exist on disk (post-landing smoke check).
- ✅ Raw `grep -E 'https?://'` returns empty across all five files in this plan.
- ✅ NFR-12 grep (`"\s*/[a-z]`) returns empty against both HTML shells.
- ✅ No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or any file outside the five locked artifacts.
- ✅ The pre-existing untracked `.planning/phases/01-pwa-shell-tooling-hygiene/01-PATTERNS.md` was not touched.
- ✅ No build artifacts (`node_modules/`, `package.json`, `dist/`, `build/`) created.
