---
phase: 01-pwa-shell-tooling-hygiene
plan: 01
subsystem: pwa-scaffolding
tags:
  - pwa
  - manifest
  - css-cascade-layers
  - icon-maskable
  - version-constant
dependency_graph:
  requires: []
  provides:
    - APP_VERSION constant (sourced by Plan 02 sw.js and Plan 03 diagnostics)
    - css/main.css composer (linked by Plan 04 index.html + desktop.html)
    - tokens vocabulary (consumed by every later CSS file)
    - manifest.json (linked by Plan 04 HTML shells; activates PWA install)
    - icon.svg (referenced by manifest.json and the apple-touch-icon link)
  affects:
    - Plan 02 (sw.js importScripts target and cache name)
    - Plan 03 (diagnostics surface + toast use components.css primitives)
    - Plan 04 (HTML shells link css/main.css and manifest.json)
    - Plan 05 (validation grep gates check the locked palette + V14 rules)
tech_stack:
  added:
    - CSS Cascade Layers (@layer + @import url() layer())
    - CSS Custom Properties (token set on :root)
    - Web App Manifest (W3C spec)
    - Maskable SVG icon (Android adaptive-icon protocol)
  patterns:
    - Single-source-of-truth version constant (D-12 dual-use ES module + self.APP_VERSION)
    - Locked palette tokens shared between manifest and CSS
    - Maskable-pure icon (no rx; OS supplies corner mask)
    - Relative-only paths (NFR-12; GH Pages sub-path safe)
key_files:
  created:
    - js/util/version.js
    - icon.svg
    - css/main.css
    - css/tokens.css
    - css/reset.css
    - css/base.css
    - css/components.css
    - css/today.css
    - manifest.json
  modified: []
decisions:
  - "APP_VERSION starts at '0.1.0'; bump per D-10 (only on shell-asset changes)"
  - "Palette locked at #0f0f10 (bg) / #f5a623 (accent) per D-16; identical strings in manifest and tokens.css"
  - "Cascade Layer order: reset, tokens, base, layout, components, view, utilities (layout + utilities ship empty in P1)"
  - "Icon = amber dot on near-black, circle r=160 at (256,256) inside 80% safe-zone r=205; no rx on background rect"
  - "Manifest declares 11 fields; scope+start_url='./' defends against GH Pages sub-path drift (T-01-V14 mitigation)"
metrics:
  duration_minutes: ~10
  tasks_completed: 3
  files_created: 9
  files_modified: 0
  commits: 3
  completed_date: 2026-05-26
---

# Phase 1 Plan 1: PWA Scaffolding & Token Set Summary

**One-liner:** Static scaffolding — APP_VERSION constant, maskable SVG icon, Web App Manifest, and Cascade-Layers CSS composer with locked amber-on-near-black token palette — that every other Phase 1 plan inherits without renegotiation.

## What Shipped

Three atomic commits added nine new files at the project root and under `css/` + `js/util/`. No HTML or runtime JavaScript yet — that lands in Plan 04. No build artifacts, no dependencies, no off-origin URLs.

### Task 1 — APP_VERSION + icon.svg (commit `e32803c`)

| File | Purpose |
| --- | --- |
| `js/util/version.js` | Single source of truth for `APP_VERSION = '0.1.0'` (D-12). Exports as ES module **and** assigns `self.APP_VERSION = APP_VERSION` so the classic-SW context (Plan 02) can read it via `importScripts`. Bumping the version is exactly one edit, in exactly one file. |
| `icon.svg` | Maskable placeholder per D-17/D-18: `viewBox="0 0 512 512"`, full-canvas background rect `fill="#0f0f10"` (no `rx` — the OS supplies the corner mask via maskable-icon protocol), centered glyph `<circle cx="256" cy="256" r="160" fill="#f5a623"/>` sitting comfortably inside the 80% safe-zone radius of 205 (Pitfall 5 mitigated). |

### Task 2 — CSS Cascade Layers composer + tokens (commit `6f354c7`)

| File | Purpose |
| --- | --- |
| `css/main.css` | Composer. Declares layer order `@layer reset, tokens, base, layout, components, view, utilities;` and `@import`s the five sibling files with explicit `layer(...)` clauses. `layout` and `utilities` ship empty in P1; later phases add files at those layers. |
| `css/tokens.css` | Locked palette tokens (`--color-bg: #0f0f10`, `--color-accent: #f5a623`) plus the full spacing/type/radii/z-index token set per RESEARCH.md §Example 4. All names match the eventual P3 UI-SPEC vocabulary so downstream plans never have to rename anything. |
| `css/reset.css` | Minimal modern reset wrapped in `@layer reset`: universal `box-sizing: border-box` + margin-zero on `body, h1..h6, p, ul, ol, figure`. |
| `css/base.css` | `html`/`body` typography defaults via tokens (`background: var(--color-bg)`, `color: var(--color-fg)`, `font-family: var(--font-sans)`) inside `@layer base`. |
| `css/components.css` | Toast/button/panel primitives (`.toast`, `.toast-action`, `.toast-close`, `.panel`) inside `@layer components`. Plan 03's update toast consumes these directly. All values via tokens. |
| `css/today.css` | Empty Today scaffold per D-01: `.today-header`, `.today-list`, `.today-footer-nav` inside `@layer view`. Footer-nav labels are not clickable yet (per CONTEXT §Specific Ideas — placeholders that prove the layout). |

**Zero literal hex codes outside `tokens.css`** — verified by the grep gate in Task 2's automated verify.

### Task 3 — Web App Manifest (commit `4225104`)

| File | Purpose |
| --- | --- |
| `manifest.json` | 11 locked fields per D-13..D-18: `name`/`short_name` = `"Habits"`, `description` = `"Personal multi-year habit tracker."`, `start_url` = `"./"`, `scope` = `"./"`, `display` = `"standalone"`, `background_color` = `"#0f0f10"`, `theme_color` = `"#f5a623"`, `lang` = `"en"`, `dir` = `"ltr"`, plus one `icons[]` entry `{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }`. **Zero off-origin URLs** (V14 Configuration mitigation; the `grep -E 'https?://' manifest.json` gate returns empty). |

## Locked Palette Decision

Per D-16, two strings appear verbatim in **three** places:

| Token | Hex | Where |
| --- | --- | --- |
| `--color-bg` | `#0f0f10` | `css/tokens.css` `:root` + `manifest.json` `background_color` |
| `--color-accent` | `#f5a623` | `css/tokens.css` `:root` + `manifest.json` `theme_color` + `icon.svg` glyph fill |

This guarantees the install splash, the in-app surface, and the OS theme-color meta all match — no drift possible because they all source from the same locked hex codes.

## APP_VERSION Starting Value

```
APP_VERSION = '0.1.0'
```

- Per D-10: bump only on shell-asset changes (`index.html`, `desktop.html`, `manifest.json`, `sw.js`, `icon.svg`, anything under `css/`). Pure JS module changes do NOT bump the cache.
- Plan 02's `sw.js` derives the cache name as `nawyki-${self.APP_VERSION}` → `nawyki-0.1.0` initially.
- Plan 03's diagnostics panel reads the same constant to display the running version.

## Token Vocabulary Available to Downstream Plans

Any later CSS file can reference these via `var(--...)`:

**Palette:** `--color-bg`, `--color-fg`, `--color-fg-muted`, `--color-fg-faint`, `--color-accent`, `--color-accent-soft`, `--color-surface`, `--color-border`

**Spacing:** `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (24px), `--space-6` (32px), `--space-7` (48px)

**Type:** `--font-sans`, `--font-mono`, `--text-xs` (11px), `--text-sm` (13px), `--text-md` (15px), `--text-lg` (18px), `--text-xl` (24px), `--text-2xl` (32px)

**Radii:** `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px)

**Z-index:** `--z-toast` (1000), `--z-overlay` (2000)

## Threat Surface — Mitigations Applied

| Threat ID | Disposition | Implementation |
| --- | --- | --- |
| T-01-V14 (manifest tampering) | mitigated | `scope: "./"`, `start_url: "./"`, no off-origin URLs; V14 grep gate (`grep -E 'https?://' manifest.json`) returns empty. |
| T-01-StaleCache (version drift) | partially mitigated | Single APP_VERSION source of truth ships in this plan. Cache-name derivation + activate cleanup land in Plan 02. |
| T-01-NoNet (no exfiltration surface) | mitigated | Zero `fetch()`, zero `https://`, zero `<link rel="preconnect">`. All scaffolding files are pure static assets. |
| T-01-V14 (icon path) | accepted | Single same-origin SVG reference; risk LOW (no externally-influenced path). |

## Consolidated Verification (post-Task-3)

1. ✅ **Parseability:** `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"` exits 0.
2. ✅ **Token integrity:** `--color-bg: #0f0f10` and `--color-accent: #f5a623` both present in `css/tokens.css`.
3. ✅ **Layer composer ready:** `@layer reset, tokens, base, layout, components, view, utilities;` present in `css/main.css`.
4. ✅ **Maskable safe-zone:** `cx="256" cy="256" r="160"` matches in `icon.svg`; no `rx=` on background rect.
5. ✅ **Version source-of-truth:** Both `export const APP_VERSION = '0.1.0'` and `self.APP_VERSION = APP_VERSION` present in `js/util/version.js`.
6. ✅ **V14 Configuration:** `grep -E 'https?://' manifest.json` returns no matches.
7. ✅ **NFR-12 (relative paths):** `grep -nE '"\s*/[a-z]' manifest.json` returns empty.
8. ✅ **NFR-11 (no build):** No `node_modules/`, `package.json`, `dist/`, or `build/` created.

## Deviations from Plan

None — plan executed exactly as written.

The verify regexes for Task 1 explicitly require BOTH `export const APP_VERSION = '0.1.0'` AND `self.APP_VERSION = APP_VERSION` in the same file. This corresponds to a hybrid of RESEARCH.md's Approach B (single-file) with the explicit `export` line — chosen because the plan's `<behavior>`, `<action>`, `<verify>`, and `<acceptance_criteria>` blocks all explicitly require both lines coexisting. The classic-SW `importScripts` evaluator in Plan 02 will need to handle the `export` token (either by using `type: "module"` SW registration or by sourcing version via a wrapper file) — Plan 02's design decision, flagged here for that planner.

## Known Stubs

None. Every file created in this plan ships its full intended P1 content; no placeholders rendered to UI (no UI exists yet — Plan 04 ships HTML).

## Threat Flags

None. No new attack surface introduced beyond what the plan's `<threat_model>` already enumerates.

## Commits

| # | Hash | Subject |
| --- | --- | --- |
| 1 | `e32803c` | `feat(01-01): add APP_VERSION constant and maskable placeholder icon` |
| 2 | `6f354c7` | `feat(01-01): add CSS Cascade Layers composer and token set` |
| 3 | `4225104` | `feat(01-01): add Web App Manifest with maskable icon entry` |

## Self-Check: PASSED

- ✅ `js/util/version.js` exists; contains `export const APP_VERSION = '0.1.0'` AND `self.APP_VERSION = APP_VERSION`.
- ✅ `icon.svg` exists; `viewBox="0 0 512 512"`, no `rx=`, contains `<circle cx="256" cy="256" r="160" fill="#f5a623"/>`.
- ✅ `manifest.json` exists; parses as valid JSON; 11 locked fields match.
- ✅ `css/main.css` exists; declares `@layer reset, tokens, base, layout, components, view, utilities;`.
- ✅ `css/tokens.css` exists; declares `--color-bg: #0f0f10` and `--color-accent: #f5a623` and full token set.
- ✅ `css/reset.css`, `css/base.css`, `css/components.css`, `css/today.css` all exist with layer-wrapped rules.
- ✅ All three task commits exist in `git log` (e32803c, 6f354c7, 4225104).
- ✅ No off-origin URLs in any file shipped by this plan.
- ✅ No build artifacts (`node_modules/`, `package.json`, `dist/`, `build/`) created.
