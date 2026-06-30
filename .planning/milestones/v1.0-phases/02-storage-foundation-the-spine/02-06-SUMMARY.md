---
phase: 02-storage-foundation-the-spine
plan: 06
status: complete
date: 2026-05-27
---

# Plan 02-06 Summary — Phase 2 ship signal (APP_VERSION 0.2.0 + doc reversals)

Docs-only + version-bump close-out of Phase 2. After this plan, the cache name resolves to `habits-0.2.0`, every doc reflects the locked Phase 2 decisions (D-28, D-30, D-35, D-39, D-40, D-42, D-46, Pitfall 13), and downstream phases (P3+) inherit a documentation set that matches reality.

## Tasks delivered

| # | Task | Files | Commit |
|---|------|-------|--------|
| 1 | Reverse Polish-names constraint + BroadcastChannel name + node serve recipe in CLAUDE.md (D-30, D-35, D-40, D-46) | `CLAUDE.md` | `15d742a` |
| 2 | Reverse Polish-names constraint in PROJECT.md + log D-30/D-35/D-39/D-40/D-42 | `.planning/PROJECT.md` | `bff3aee` |
| 3 | Replace `python -m http.server` with `node scripts/serve.js` in README (D-46) | `README.md` | `6669116` |
| 4 | Forward-edit ARCHITECTURE.md per D-30/D-39/D-42 + Pitfall 13 | `.planning/research/ARCHITECTURE.md` | `f67a3b5` |
| 5 | Bump `APP_VERSION` 0.1.0 → 0.2.0 (D-28, VERSIONING.md) | `js/util/version.js` | `c314ae2` |
| — | Scope-add: align README.md UI-language Constraint with D-35 (Task 6 grep gate) | `README.md` | `18f5552` |
| 6 | Final `node --test tests/` green check — 99/99 pass | — | (no commit) |

## Before / after excerpts

### CLAUDE.md (Task 1)

- **UI language constraint**
  - Before: `English UI chrome; Polish habit names preserved verbatim (user data).`
  - After: `English UI chrome AND English habit names primary; Polish original optionally preserved as a per-habit `name_pl` field (D-35 + D-40, locked Phase 2).` plus an italicized rationale documenting the `{name, name_pl}` seed-write pattern and the P3 UI-SPEC defer.
- **TL;DR table — Cross-tab sync**
  - Before: `BroadcastChannel('nawyki')`
  - After: `BroadcastChannel('habits')` (D-30 alignment with cache prefix + DB name + manifest name)
- **Browser APIs table — BroadcastChannel row**
  - Before: `Single channel 'nawyki'`
  - After: `Single channel 'habits' (D-30, locked Phase 2)`
- **CSV export filename**
  - Before: `nawyki-completion-YYYY-MM-DD.csv`
  - After: `habits-completion-YYYY-MM-DD.csv (D-30, locked Phase 2 — nawyki- prefix renamed to habits- for namespace consistency)`
- **Installation Option B (local dev)**
  - Before: empty heading (just `# Option B: serve locally if you want to test the service worker`)
  - After: fenced `node scripts/serve.js` block with `PORT=` override note, citing D-46 and D-47 (Node 20+ only)

### .planning/PROJECT.md (Task 2)

- **UI language constraint**: same reversal as CLAUDE.md (line 93).
- **Key Decisions table**: the legacy row `English UI, Polish habit names (data)` replaced with D-35 row; appended five new decisions:
  - D-30 — namespace alignment (`habits` across BroadcastChannel + IDB DB + cache prefix + CSV filename)
  - D-39 — IDB schema v1 carries 7 stores (added `score_snapshots` declared empty / written from P6)
  - D-40 — optional `name_pl` field on habits store
  - D-42 — `events` store keyPath = string UUID via `crypto.randomUUID()` (cross-device import safety)
  - (D-35 captured in the updated row.)

### README.md (Tasks 3 + 6 scope-add)

- **Localhost development**
  - Before: `python -m http.server 8000` → `http://localhost:8000/`
  - After: `node scripts/serve.js` → `http://localhost:8080/` with `PORT=9000 node scripts/serve.js` override note; calls out Node 20+ as the only runtime requirement.
- **Cache name template**: `habits-0.1.0` → `habits-${APP_VERSION}` (generalized; Task 5 bumps the value to 0.2.0).
- **Constraints — UI language** (scope-add, Task 6 grep gate): legacy `Polish habit names preserved verbatim` line replaced with the D-35 + D-40 phrasing matching CLAUDE.md / PROJECT.md.

### .planning/research/ARCHITECTURE.md (Task 4)

Four targeted forward-edits, each carrying an inline `<!-- Updated 2026-05-26 per Phase 2 D-XX -->` audit note:

- §TL;DR row 3 (IDB schema): `6 stores` → `7 stores` (added `score_snapshots`); `events keyed by autoincrement` → `events keyed by UUID (crypto.randomUUID())` — D-39 + D-42.
- §TL;DR row 6 (Cross-tab + undo): `BroadcastChannel 'nawyki'` → `'habits'` — D-30.
- §1 Module Layout file-tree: `sync.js # BroadcastChannel('nawyki')` → `BroadcastChannel('habits') — D-30 (2026-05-26)`.
- §1 Module Layout file-tree: `id.js # crypto.randomUUID() with file:// fallback` → `crypto.randomUUID() in secure contexts (HTTPS + localhost; usually file:// too); three-tier fallback for Safari-on-file:// edge case per Pitfall 13`.
- §3 IndexedDB Schema (sketch): table extended with the `score_snapshots` row; `events` row keypath updated to UUID; prose under "Notes on key choices" updated to explain the UUID rationale (cross-device JSON-import safety).
- §6 Cross-Tab Sync — Mechanism: `BroadcastChannel('nawyki')` → `BroadcastChannel('habits')`.
- §6 narrative data-flow trace: `broadcast … on 'nawyki'` → `on 'habits' (D-30)`.

### js/util/version.js (Task 5)

```diff
- export const APP_VERSION = '0.1.0';
+ export const APP_VERSION = '0.2.0';
```

Per `VERSIONING.md` mapping row "Phase 2 complete (Storage Foundation) → 0.2.0" and D-28 (SemVer 2.0.0 in the `0.y.z` initial-development range; MINOR for phase completion). The `sw.js` `activate` handler (D-10) deletes the prior `habits-0.1.0` cache automatically; `controllerchange` fires the P1 update toast on next load.

## Test suite

`node --test "tests/**/*.test.js"` → **99 / 99 pass, 0 fail, 0 skip** (~24 s on Node 24.15.0 locally; CI runs Node 20).

Same green count as the post-Wave-5 baseline at HEAD `7c934e3` — confirms zero regression from this plan's edits.

## Pointer to plan 02-05's manual smoke checklist

The Phase-2-final manual browser smoke (the only checkpoint:human-verify in this phase) was executed in plan 02-05. Outcome: **7/8 items full PASS + item 8 PASS-with-Chromium-caveat** (Chromium-family browsers refuse to load ES modules from `file://`; documented in STATE.md "Deferred Items" — workaround is to use `node scripts/serve.js` or GitHub Pages, both already supported). See `02-05-SUMMARY.md` for full smoke evidence.

## Deviations from plan

1. **Execution mode** — Plan envisioned a single gsd-executor worktree agent. The initial Agent dispatch (worktree `agent-a54401517cbb8dfde`) dropped its socket connection at ~365 s with 0 commits + 1 uncommitted partial CLAUDE.md edit. The CLAUDE.md draft was salvageable and matched the plan's Task 1 spec verbatim, so I copied it to main, force-removed the locked worktree + its `worktree-agent-*` branch, and continued the remaining tasks **inline on main** (no further agent dispatch). Branching strategy is `none` and the wave had a single plan, so worktree isolation bought nothing — inline sequential execution is the correct fallback per `execute-phase.md` `<runtime_compatibility>`.

2. **README Constraints scope-add** — Plan Task 3 restricted README edits to the python→node serve swap. The plan's Task 6 verify-grep, however, lists `Polish habit names preserved verbatim` as appearing ONLY in the 3 immutable Phase 2 planning artifacts (02-DISCUSSION-LOG.md, 02-CONTEXT.md, 02-RESEARCH.md). README line 127 had the legacy constraint and would have left the Task 6 grep with one extra match. Treated as a 1-line scope-add (commit `18f5552`); preserves Task 6's stated intent.

## Out-of-scope drift surfaced (NOT fixed by this plan)

The following files still carry `BroadcastChannel('nawyki')` or related legacy identifiers; the plan author limited 02-06's file set to CLAUDE.md / PROJECT.md / README.md / ARCHITECTURE.md / js/util/version.js, so these are deliberately untouched and flagged here for a future doc-alignment pass (or backlog item):

- `.planning/REQUIREMENTS.md` line 100 — `DATA-07` spec text still says `BroadcastChannel('nawyki')`; actual code (in `js/platform/sync.js` per plan 02-03) uses `'habits'`. Requirement-vs-implementation drift.
- `.planning/research/STACK.md` lines 20 + 512 — same legacy channel name.
- `.planning/research/SUMMARY.md` line 22 — same.
- `.planning/phases/01-pwa-shell-tooling-hygiene/*` — multiple `python -m http.server 8000` references in archived 01-* plans, summaries, research; these are research-era artifacts and correctly reflect what Phase 1 specified at the time. Same pattern as `.planning/phases/02-.../02-RESEARCH.md` keeping the legacy phrasing as "the thing being reversed".

## Citations

- **D-28** — SemVer 2.0.0; `APP_VERSION` starts at `'0.1.0'`, MINOR bump on phase completion; cache template `habits-${APP_VERSION}`. `VERSIONING.md` row "Phase 2 complete (Storage Foundation) → 0.2.0".
- **D-30** — Namespace alignment (`habits` across BroadcastChannel + IDB DB + cache prefix + CSV filename + manifest).
- **D-35** — English UI chrome AND English habit names primary; reverses prior "Polish habit names preserved verbatim".
- **D-39** — IDB v1 carries 7 stores including `score_snapshots` (declared empty; written from P6).
- **D-40** — Optional `name_pl` string field on `habits` rows.
- **D-42** — `events` store keypath = string UUID via `crypto.randomUUID()`.
- **D-46** — Local-dev server is `node scripts/serve.js` (zero-npm vanilla Node), supersedes `python -m http.server`.
- **Pitfall 13** — `crypto.randomUUID()` is available in secure contexts (HTTPS + localhost; usually file:// too); the three-tier fallback in `js/util/id.js` is defense-in-depth for the Safari-on-file:// edge case, NOT a primary path.
- **VERSIONING.md** — Full phase→version mapping table at the project root.

## Phase 2 status after this plan

- All 6 plans (02-01..02-06) have SUMMARY.md.
- Phase 2 ROADMAP entry can be marked complete.
- Cache key transitions: users on `habits-0.1.0` get `habits-0.2.0` on next load, P1 update toast fires.
- Docs and code match: 7-store IDB schema, UUID events, `BroadcastChannel('habits')`, English-primary habit names with optional `name_pl`, node-based dev server.
- Test suite: 99/99 green on Node 20 (CI) and Node 24 (local, with `tests/**/*.test.js` glob due to Node 24 dropping the `--test <dir>` form).

## Self-Check: PASSED

- [x] All 6 tasks executed and verified per their `<verify>` blocks.
- [x] Each task committed individually with a conventional-commit prefix.
- [x] SUMMARY.md committed before the plan returns.
- [x] PHASE-COMPLETION.md created and committed alongside SUMMARY.md (see plan `<output>` requirement).
- [x] No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes).
- [x] Final `node --test "tests/**/*.test.js"` exits 0; 99/99 pass.
- [x] APP_VERSION literal === `'0.2.0'`; legacy `'0.1.0'` substring absent from `js/util/version.js`.
- [x] Legacy substrings (`Polish habit names preserved verbatim`, `BroadcastChannel('nawyki')`, `python -m http.server` in user-facing docs) appear only in immutable `.planning/phases/02-.../02-{DISCUSSION-LOG,CONTEXT,RESEARCH}.md` artifacts plus 02-06-PLAN.md itself; drift in other `.planning/` artifacts surfaced above for a future cleanup pass.
