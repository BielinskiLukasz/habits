# Phase 1: PWA Shell & Tooling Hygiene - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the static, file://-safe, versioned-cache PWA chassis that the rest of Nawyki will hang off:

- `index.html` + `desktop.html` shells (both ship in P1; only the mobile shell carries visible content this phase)
- `manifest.json` + maskable SVG icon at the root (mirrors `mindful-breathing` layout)
- `sw.js` registered with silent `.catch()` so `file://` opens stay broken-but-safe
- Versioned cache `nawyki-X.Y.Z` with `skipWaiting()` + `clients.claim()` activation
- A diagnostics + Reset-app surface for debugging deploys across all remaining phases
- A controllerchange-driven update toast so a new deploy never traps a user on stale assets

What this phase does **not** ship: IndexedDB, seed loader, Today view data, Settings panel, cadence, scoring, exports. Those start at P2 and beyond. P1 only proves the chassis works.

The 11 requirements in scope (PWA-01..06, SETTINGS-07, NFR-04, NFR-09, NFR-11, NFR-12) are pinned by ROADMAP.md — this discussion clarifies **how** to implement them, never **whether** to add new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Visible Phase-1 UI

- **D-01 — Empty Today shell scaffold:** `index.html` renders the eventual mobile chrome (header with today's date + current wave context, empty habit list area, footer nav stub with `today · history · settings` labels). Phase 3 fills the data; Phase 1 just proves the chrome and the SW are alive.
- **D-02 — Diagnostics panel access via TWO triggers:** `?debug=1` query param **AND** long-press (~1.5s) on the app title. Query param is for desktop/devtools workflows; long-press is for the installed phone. Both reach the same panel.
- **D-03 — Diagnostics panel contents:** app version, schema version, SW state (registered / controlled / none) + current cache name, install state (`display-mode: standalone` detection), persistence status (deferred to P2 when IDB exists — render as "n/a (P2)" in P1), "Reset shell" button, "Reset data" button (placeholder + tooltip "wired in P2"), "Check for update" button (forces `registration.update()` and reports outcome).
- **D-04 — `desktop.html` ships as a minimal "Switch to mobile" stub in P1.** It exists so installability paths exist for both shells from day one, but the analytics layout proper is P6. Same `<meta>`s, same manifest link, same `sw-register.js` call.

### Reset-app behavior

- **D-05 — Two distinct reset buttons (not one nuclear button):**
  - **Reset shell** = `registration.unregister()` + `caches.keys().forEach(caches.delete)` + `location.reload()`. Wired and functional in P1.
  - **Reset data** = deletes the `nawyki` IndexedDB database. Placeholder button in P1 with tooltip "available in P2"; wiring lands when IDB ships.
- **D-06 — Each reset has its own confirm dialog** (single confirmation, not multi-step). Phrasing: "Reset shell — unregister service worker and clear all caches. Logs are NOT affected. Reload to a fresh install." / (P2:) "Reset data — delete all habits, logs, and history. The app shell is NOT affected. This cannot be undone unless you have a JSON backup."
- **D-07 — `Reset-app surface` was not picked as an explicit discussion area** — captured by default as part of the diagnostics-panel decision above. Open to revisit during planning if the planner sees a cleaner placement.

### Service worker update propagation

- **D-08 — Toast "New version ready — Reload" on `controllerchange`.** Non-blocking; the user can keep tapping the current page until they reload. Toast persists (does not auto-dismiss) until the user reloads or explicitly closes it. Toast is a primitive shared with the rest of the app (the same toast component will later host Undo notifications).
- **D-09 — `skipWaiting()` is unconditional** in `sw.activate`. Combined with `clients.claim()`, this means new SWs take over immediately. The user's protection against a mid-tap reload is "we never auto-reload — only show the toast." (Auto-reload-on-activate was explicitly rejected.)
- **D-10 — Cache name bumps ONLY on shell-asset changes** (`index.html`, `desktop.html`, `manifest.json`, `sw.js`, `icon.svg`, anything under `css/`). Pure JS module changes do NOT bump the cache.
- **D-11 — JS modules use a non-cache-first strategy** to honor D-10 while still meeting NFR-04 (fully offline). Likely candidate: **stale-while-revalidate** for `js/**` (serve cached, refresh in background) **or** network-first-with-cache-fallback. **Researcher must validate** which pattern actually delivers fresh modules within one reload while never breaking offline. Whichever pattern wins must be documented in `sw.js` itself.
- **D-12 — One source of truth for the version constant.** A single `APP_VERSION` (e.g., in `js/util/version.js`) is referenced by `sw.js` (for the cache name when D-10 says to bump) AND by the diagnostics panel. Bumping the version is one edit, in one file.

### Manifest visuals & icon

- **D-13 — App name = "Habits"** (English). `name: "Habits"`, `short_name: "Habits"`. Matches PROJECT.md's UI-chrome-is-English rule. Habit names inside the app stay Polish (user content).
- **D-14 — Manifest description:** "Personal multi-year habit tracker." (Planner can wordsmith; not load-bearing.)
- **D-15 — `lang: "en"`** explicitly in the manifest. `scope: "./"` and `start_url: "./"` are explicit (defends against accidental navigation out of the app).
- **D-16 — Palette (dark + warm accent):**
  - `background_color: "#0f0f10"` (near-black, slightly warmer than mindful-breathing's pure `#111111`)
  - `theme_color: "#f5a623"` (amber)
  - These are also defined as CSS tokens in `css/tokens.css` (`--color-bg`, `--color-accent`) so the diagnostics page, the eventual Today view, and the manifest stay in lockstep.
- **D-17 — Icon = placeholder for P1.** Amber filled dot (or a centered amber square) on the dark background in `icon.svg`. Maskable-safe (centered glyph with safe-zone padding). **Redo during the P3 UI design phase** (Today view UI-SPEC) once the visual identity is fully settled.
- **D-18 — Icon manifest entry:** `{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }` — matches `mindful-breathing/manifest.json`.

### Hosting + path strategy

- **D-19 — All paths in HTML, manifest, and sw.js are relative** (`./`, never `/`). NFR-12 requires GitHub Pages compatibility under a sub-path; the relative-paths rule is the only way to get it right with zero env config.
- **D-20 — `sw.js` registration is guarded** by `location.protocol.startsWith('http')` plus a silent `.catch()` — matches `../mindful-breathing/index.html`'s pattern. `file://` opens never call `navigator.serviceWorker.register()`.

### Claude's Discretion

- **CSS tokens & layer setup:** the cascade-layer composer (`css/main.css` with `@import url(...) layer(...)`) is locked by STACK.md; the specific layer names and token list at P1 are planner-pick. Token names should match the eventual UI-SPEC vocabulary so P3 doesn't have to rename them.
- **Toast component skeleton:** D-08 mentions the toast is a shared primitive. Planner picks the minimal CSS + JS shape (probably `<div class="toast" role="status">`). No design decision here — just keep it accessible.
- **`APP_VERSION` location:** D-12 says one source of truth. Planner picks the file (`js/util/version.js` is a reasonable default; could also be `js/version.js` at the top of `js/`). Doesn't matter for correctness, only for greppability.
- **Diagnostics panel layout:** the contents are pinned in D-03; the visual layout is open. Default to a vertical key/value list (no styling sophistication needed; this is a debug surface).
- **HTTPS deploy target for installability testing:** PROJECT.md says GitHub Pages. Planner confirms whether it's `bielinskilukasz.github.io/habits/` or another path during the planning step. The phase-1 implementation must work under any sub-path because all paths are relative (D-19).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs and constraints
- `.planning/PROJECT.md` — locked stack constraints, UI language rule, privacy rule, file://-safe rule
- `.planning/REQUIREMENTS.md` — the 11 requirements in this phase: PWA-01..06, SETTINGS-07, NFR-04, NFR-09, NFR-11, NFR-12
- `.planning/ROADMAP.md` §"Phase 1" — goal and success criteria (5 acceptance items)

### Research already done
- `.planning/research/STACK.md` — locks the SW pattern (cache-first w/ silent `.catch()`, versioned cache, `skipWaiting()` + `clients.claim()`), the two-HTML-shell layout, the Cascade Layers CSS architecture, the maskable-SVG-icon convention, and the manifest scope rule
- `.planning/research/ARCHITECTURE.md` §7 "Build Order" — the dependency chain (`date → idb → schema → repo → seed → store/apply → sync → lifecycle → SW → router → today view`); P1 only ships **SW + manifest + shell HTML/CSS + icon + diagnostics**, everything else is later phases
- `.planning/research/PITFALLS.md` §"Pitfall 2: Service Worker Bricks the App" — versioned cache name + `activate` deletes non-current caches + silent `.catch()` + Reset-app debug action; **read before writing `sw.js`**
- `.planning/research/PITFALLS.md` §"Pitfall 7: PWA Install Ergonomics" — platform-detection notes (full install panel is P3, but the manifest must already be valid for all three install paths)
- `.planning/research/PITFALLS.md` §"Integration Gotchas" — `scope: "./"`, `location.protocol.startsWith('http')` guard, `navigator.storage.persist()` deferred to P2 (no IDB in P1)
- `.planning/research/FEATURES.md` — feature map (cross-check that P1 doesn't accidentally pull in P2+ features)
- `.planning/research/SUMMARY.md` — top-level research synthesis

### Reference project (directly inspected)
- `../mindful-breathing/sw.js` — the proven 8-line cache-first pattern this phase mirrors (and extends with versioned cache + activate cleanup)
- `../mindful-breathing/manifest.json` — the maskable-SVG-icon + dark splash pattern this phase adapts (palette swap: emerald → amber, near-black slightly warmer)
- `../mindful-breathing/index.html` — the silent-`.catch()` registration pattern; same protocol guard

### Project-level
- `CLAUDE.md` — the consolidated tech-stack TL;DR is in the project root; treat it as a recap, not the source of truth

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`../mindful-breathing/sw.js`** — copy the structural shape (install / activate / fetch), then extend with: versioned cache name from `APP_VERSION`, `activate` event handler that deletes all caches whose name isn't the current one, `skipWaiting()`, `clients.claim()`. Net: ~25 lines.
- **`../mindful-breathing/manifest.json`** — same shape, swap `name`/`short_name`/`description`/`background_color`/`theme_color`/icon source. Same `display: standalone` + `start_url: "./"` + maskable icon.
- **`../mindful-breathing/index.html`** has the `if (location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});` pattern — lift verbatim into `js/platform/sw-register.js`.

### Established Patterns

- **Zero-tooling, file://-safe, multi-file static app.** Every JS file is `<script type="module" src="./js/…">` with relative `./` imports.
- **CSS via Cascade Layers (`@layer`) + custom-properties in `css/tokens.css`** — established in STACK.md; P1 plants the seed.
- **No npm, no CDN, no fetch-to-remote.** Every byte of JS/CSS/icon is committed to this repo.

### Integration Points

- **`js/platform/sw-register.js`** — the only place that touches `navigator.serviceWorker`. Imported by `js/main.js` and `js/desktop.js`. Behind the protocol guard.
- **`js/util/version.js`** (per D-12) — `APP_VERSION` constant. Imported by `sw.js` (yes, SW can import via `importScripts` or as a module-SW with `<script type="module">` registration — researcher confirms which) and by the diagnostics panel.
- **Diagnostics panel** lives at `js/views/diagnostics.js` (consistent with the `js/views/` directory STACK.md mandates). Triggered by the URL detect / long-press detect, replaces the empty-shell body when active.
- **Toast primitive** lives at `js/views/toast.js` (or `js/views/components/toast.js` — planner picks). Shared between SW update notifications now and Undo notifications later.

</code_context>

<specifics>
## Specific Ideas

- **Palette is amber on near-black** (`#f5a623` on `#0f0f10`) — a deliberate divergence from `mindful-breathing`'s emerald-on-black. Habit-tracker identity should feel its own thing, but the dark-with-accent visual language carries over.
- **Diagnostics is bilingual-friendly even though chrome is English:** key labels stay English ("Service worker", "Install state"), but the **values** include any platform-detected strings as-is (e.g., the iOS user-agent gets shown verbatim). No translation layer.
- **`?debug=1` is a permanent affordance, not a hidden Easter egg.** A bookmark like `index.html?debug=1` is a legitimate part of the developer workflow. Long-press is the same surface for installed-PWA-on-phone use.
- **The empty Today scaffold's "footer nav stub"** shows three labels (`today · history · settings`) but they're not clickable yet — they're placeholders that prove the layout, removed/wired in later phases. Don't waste P1 budget on a router or hover states.
- **`mindful-breathing` is the literal pattern reference** for the SW + manifest. When in doubt during planning: open `../mindful-breathing/sw.js`, see how it does it, then extend (don't replace).

</specifics>

<deferred>
## Deferred Ideas

- **Real icon design (amber 'H' letter mark, checkmark glyph, or wave/Fala shape)** — picked "placeholder" for P1; redo during the P3 UI design phase when the Today view's visual identity locks. Icon must remain maskable.
- **Reset-app surface as a discussion area** — not picked as an explicit area; captured by default in D-03/D-05. If during planning a cleaner placement emerges (a tucked-away "About" panel, a keyboard chord, etc.), revisit. The placeholder lives on the diagnostics panel.
- **Install panel content (iOS Share / Android Install / desktop URL-bar icon)** — assigned to PWA-07 / Phase 3 (Settings v1). P1 ships only the manifest that makes those install paths work; no in-app guidance UI yet.
- **`navigator.storage.persist()` call** — first IDB write is the trigger; lives in P2 (Storage Foundation). P1's diagnostics panel renders "Persistence: n/a (P2)" for now.
- **CSS token list and the full Cascade Layers composer** — planner instantiates the minimum needed for the empty scaffold + diagnostics; the rich token set arrives with the P3 UI-SPEC.
- **Toast auto-dismiss / styling refinements** — toast appears, persists until reload-or-close, no animations beyond a fade-in. Sophistication arrives when the toast hosts Undo in P3.
- **`desktop.html` analytics view** — P1 ships only the stub; full analytics surface is P6.
- **Cache-busting query strings on JS module imports** — alternative to the stale-while-revalidate / network-first strategy in D-11. Researcher evaluates; planner picks.

</deferred>

---

*Phase: 1-PWA Shell & Tooling Hygiene*
*Context gathered: 2026-05-26*
