---
phase: 1
slug: pwa-shell-tooling-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None automated.** PROJECT.md forbids npm/build tooling — Phase 1 verification is **manual + browser DevTools-driven smoke testing**. |
| **Config file** | n/a |
| **Quick run command** | `python -m http.server 8000` (any static server) + checklist items 1, 8, 9, 11 from research |
| **Full suite command** | Same server + full 14-item Manual Smoke-Test Checklist from `01-RESEARCH.md` §"Validation Architecture" |
| **Estimated runtime** | ~30 s quick · ~15 min full · 1 hands-on device session for PWA-05 (3 platforms) |

---

## Sampling Rate

- **After every task commit:** Manual quick checks — `file://` open + `?debug=1` mounts diagnostics (items 1, 11). ~30 s.
- **After every plan wave:** Full 14-item checklist if PWA shell changed; static-analysis greps (NFR-04 / NFR-11 / NFR-12) on every wave.
- **Before `/gsd-verify-work`:** All 14 checklist items green, including device-install tests for PWA-05.
- **Max feedback latency:** ~30 s for the per-commit subset.

---

## Per-Task Verification Map

> The planner will fill the Task ID column once PLAN.md files are generated. Until then, each requirement is mapped to its expected verification flavor. The plan-checker will refuse to pass plans where a task without an automated verify has no upstream Wave 0 dependency or manual entry below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PWA-01 | T-01-V14 | Manifest scope/start_url/icons valid; same-origin only | static + manual | `node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"` + DevTools → Application → Manifest | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-02 | T-01-CacheScope | SW registered, cache `habits-0.1.0` populated, same-origin only | manual (DevTools) | DevTools → Application → Service Workers / Cache Storage | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-03 | T-01-StaleCache | `skipWaiting()` + `clients.claim()` + activate-cleanup deletes prior `habits-X.Y.Z` | manual | Bump `APP_VERSION` → reload → DevTools shows old cache deleted, new active | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-04 | T-01-FileSafe | `file://` open: console clean, `navigator.serviceWorker.controller` null | manual | Double-click `index.html`, open DevTools, inspect console + `navigator.serviceWorker` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-05 (Android) | — | Installable from Android Chrome | manual on device | Open URL on Android Chrome → Install prompt or Add to Home Screen | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-05 (iOS) | — | Installable from iOS Safari | manual on device | iOS Safari → Share → Add to Home Screen → launch standalone | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-05 (desktop) | — | Installable from desktop Chrome/Edge | manual on device | URL bar install icon → install → standalone window | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-06 | T-01-OfflineFail | Fully offline reload still renders | manual | Install → DevTools Offline → reload | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SETTINGS-07 | T-01-ResetSurface | "Reset shell" unregisters SW + clears caches + reloads to clean state | manual | Diagnostics → Reset shell → confirm → reload | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NFR-04 | T-01-NoNet | Zero outbound requests once installed | static + manual | `grep -rE 'fetch\(\s*['\''"]https?:' js/ ` → empty + DevTools Network = 0 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NFR-09 | T-01-FileSafe | Loads on `file://` | manual | `open index.html` (or Windows `start index.html`) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NFR-11 | — | No build artifacts; plain static files | static | `ls habits/` shows no `node_modules/`, `package.json`, `dist/`, `build/` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NFR-12 | — | All paths relative; GH Pages sub-path works | static + deploy | `grep -nE '"\s*/[a-z]' index.html desktop.html manifest.json sw.js` → empty + deploy under `/habits/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

P1 deliberately ships **no test framework** — PROJECT.md forbids npm/build tooling. Wave 0 instead consists of the manual-verification scaffolding:

- [ ] **`01-RESEARCH.md` §"Manual Smoke-Test Checklist"** — the 14-item canonical checklist is the test suite (already produced by research; no extra file).
- [ ] **Static-analysis greps documented in `README.md`** — codify the NFR-04 / NFR-11 / NFR-12 grep patterns so reviewers can re-run them.
- [ ] **Diagnostics panel itself is W0-equivalent** — the panel is the in-app DevTools surrogate (shows SW state, cache name, install state). Without it, none of the PWA-02..04 / SETTINGS-07 manual checks have a UI to drive them.

*If none: "Existing infrastructure covers all phase requirements."* — N/A, see above.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `file://` open with silent SW no-op | PWA-04, NFR-09 | No automation can drive a `file://` page reliably across OSes without a build step | Double-click `index.html`. Open DevTools console. Confirm zero errors and `navigator.serviceWorker.controller === null`. |
| Install prompt on Android Chrome | PWA-05 | Real-device behavior; emulators do not faithfully mirror Chrome install eligibility heuristics | Deploy → open URL on Android Chrome → wait for Install prompt OR Settings → Add to Home Screen. Launch from home icon: no URL bar. |
| Add to Home Screen on iOS Safari | PWA-05 | Requires real iOS; Simulator does not surface Share → Add to Home Screen identically | Open URL on iOS Safari → Share → Add to Home Screen → confirm. Tap home-screen icon: launches standalone, no Safari chrome. |
| Install on desktop Chrome / Edge | PWA-05 | URL-bar install affordance only appears with a real PWA-eligible page over HTTPS | Open URL on desktop Chrome → URL bar shows install icon → install → standalone window opens. |
| Cache version bump produces update toast (not auto-reload) | PWA-03 | Two-page-load sequence with developer-driven version bump in between | Bump `APP_VERSION` to `'0.1.1'` in `js/util/version.js` → redeploy locally → reload first time (new SW installs) → reload second time (controllerchange fires → toast appears). Click "Reload" — page picks up new shell, old `habits-0.1.0` cache deleted. |
| Reset shell action recovers a bricked SW | SETTINGS-07 | Verifies the recovery path itself, which by definition cannot be automated by the broken thing | Long-press app title 1.5 s (OR open `?debug=1`) → diagnostics → "Reset shell" → confirm → page reloads to clean state. DevTools confirms SW unregistered + caches cleared on entry, then re-registered on reload. |
| Long-press does NOT fire on scroll | D-02 / SETTINGS-07 (UX) | Gesture interaction; static analysis cannot prove pointer-cancellation logic works on real touch input | On phone: tap title and immediately drag-scroll downward. Diagnostics panel should NOT mount. |
| Update toast does NOT fire on first install | D-08 | `controllerchange` semantics — only meaningful via the actual install flow | Clear all site data → fresh install → SW activates → confirm NO toast appears. |
| `display-mode: standalone` detection accurate | PWA-05 / D-03 | Browsers differ in when `matchMedia('(display-mode: standalone)')` returns true | Open installed PWA: diagnostics shows "Install state: standalone". Open same URL in browser tab: diagnostics shows "Install state: browser". |
| GitHub Pages sub-path deploy works | NFR-12 | Relative-path correctness is only provable against a real sub-path host | Deploy to `https://bielinskilukasz.github.io/habits/`. Open URL. Confirm SW registers under `/habits/` scope (DevTools), install works, offline reload works. |

---

## Validation Sign-Off

- [ ] All tasks have manual verify entries OR static-grep automated commands (no `<automated>` watch-mode flags — see PROJECT.md no-tooling constraint)
- [ ] Sampling continuity: every task touches at least one of the 14 manual-checklist items OR a static-analysis grep
- [ ] Wave 0 covers all MISSING references — RESEARCH.md checklist + diagnostics panel are the in-place test surface
- [ ] No watch-mode flags (none possible — no test runner)
- [ ] Feedback latency < 30 s for per-commit subset
- [ ] `nyquist_compliant: true` set in frontmatter after the planner maps each task to a checklist item

**Approval:** pending
