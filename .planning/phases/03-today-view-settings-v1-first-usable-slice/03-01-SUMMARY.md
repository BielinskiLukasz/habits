---
phase: 03-today-view-settings-v1-first-usable-slice
plan: 01
subsystem: domain
tags: [cadence, wave, dom-construction, xss-discipline, date-utils, repo, idb-range, tdd]

# Dependency graph
requires:
  - phase: 02-storage-foundation-the-spine
    provides: "repo.js facade (D-30), idb.js getAll + indexGetAll helpers, schema.js logs.date index (D-39), util/date.js DST-safe local-calendar helpers, fake-idb A7 surface, tests/helpers/fake-document.js shape, util/id.js, JSDoc D-27 convention"
provides:
  - "Pure cadence resolver `appliesToday(habit, date, ctx)` covering all 4 cadence shapes in seed/habits.json (daily, weekly, every-n-days, day-of-week-subset) — D-48/D-49/D-50/D-51"
  - "In-memory wave catalog with `currentWave(date)` returning the highest-numbered wave whose startDate <= date (D-56, D-57); `seed/waves.json` 10-entry catalog pinned so Wave 4 is current on 2026-05-28 per <specifics>"
  - "Single trusted DOM-construction helper `mount(desc, parent, actions)` (D-77) — textContent + setAttribute only; D-78 grep gate locks zero `.innerHTML` family across all of `js/`"
  - "Four new pure date helpers: isoWeekStart, isoWeekEnd, daysBetween (Math.round — DST-safe), formatRelative — consumed by cadence resolver + Settings undo preview (D-71)"
  - "Two new bounded-read repo methods: getAllHabits + getLogsInRange — enable Slice 2's single cold-paint read per NFR-01 (D-52)"
  - "A7 contract preserved: fake-idb mirrors the new repo surface; contract.fake-vs-real.test.js EXPECTED list extended"
affects: [03-02 (Today view consumes all of the above), 03-03 (mark/unmark uses mount + cadence), 03-04 (undo toast uses formatRelative), 03-05 (Settings cards use mount + currentWave), 04 (cadence engine extends domain/cadence.js)]

# Tech tracking
tech-stack:
  added:
    - "js/domain/ (new directory holding the pure-resolver layer separate from views/state)"
  patterns:
    - "RESOLVERS-table dispatch (Anti-Pattern 4 extended to cadence — no `switch (habit.cadence.type)`)"
    - "Description-tree DOM construction: builders return `{tag, attrs?, text?, children?}`, mounter walks them via parent.ownerDocument"
    - "Defensive-copy invariant for in-memory catalogs (getAllWaves returns [..._waves]; T-03-02)"
    - "configureWave({fetch}) DI mirroring js/io/seed.js (RESEARCH §Open Question 2)"
    - "Grep-gate discipline test for HTML-injection sinks (Pattern S6 → D-78)"

key-files:
  created:
    - "js/domain/cadence.js — pure 4-cadence resolver (D-48/D-49/D-50/D-51)"
    - "js/domain/wave.js — in-memory wave catalog + currentWave (D-56/D-57)"
    - "js/util/mount.js — single trusted DOM-construction helper (D-77)"
    - "seed/waves.json — 10-wave catalog (Wave 4 current as of 2026-05-28)"
    - "tests/unit/cadence.test.js — 22 cadence behaviors + RESOLVERS discipline assertion"
    - "tests/unit/wave.test.js — 13 shape + currentWave + getWave/getAllWaves + malformed-input cases"
    - "tests/unit/mount.test.js — 10 mount behaviors via hand-rolled fake DOM"
    - "tests/unit/date.weekly.test.js — 22 ISO-week + relative-time fixtures"
    - "tests/unit/discipline.xss.test.js — D-78 grep gate (.innerHTML/.outerHTML/.insertAdjacentHTML/document.write)"
    - "tests/integration/repo.range.test.js — getAllHabits + getLogsInRange via fake-IDB"
  modified:
    - "js/util/date.js — added isoWeekStart, isoWeekEnd, daysBetween, formatRelative + extended file header"
    - "js/db/repo.js — added getAllHabits + getLogsInRange + extended idb.js imports (getAll, indexGetAll)"
    - "tests/helpers/fake-idb.js — added matching getAllHabits + getLogsInRange (A7 contract)"
    - "tests/integration/contract.fake-vs-real.test.js — EXPECTED list extended by both names"

key-decisions:
  - "configureWave({fetch}) treats the `fetch` key as present-overrides-with-value (including null) so tests can reset injection between cases; matches the configureSeed pattern but with explicit hasOwnProperty handling for test ergonomics."
  - "Wave 4 startDate set to 2026-04-27 (NOT the Pattern document's illustrative 2026-01-26). The Pattern's example would have made Wave 9 current on 2026-05-28, contradicting <specifics> line 201 'Wave 4 is current as of 2026-05-28'. Picked 7-week spacing anchored at Wave 0 = 2025-12-29 so the catalog spans late 2025 through end-of-2026 with Wave 4 dominating late-April through mid-June."
  - "daysBetween uses Math.round explicitly (not Math.floor) — the file header now bans Math.floor inside daysBetween. A 1-hour DST gain/loss in the ms delta would silently underflow to N-1 with floor, corrupting every-n-days math."
  - "appliesToday's every-n-days branch returns true when BOTH lastCompletedDate AND createdAt are absent — safe default 'never hide for missing anchor' rather than 'never show for missing anchor'."
  - "mount() resolves its document via parent.ownerDocument, NOT a configureMount({document}) seam. Keeps mount a pure function of the parent and lets tests inject a fake DOM by giving the parent a fake ownerDocument."

patterns-established:
  - "Pattern: pure-domain modules under js/domain/ — no IDB / repo calls, take all facts via function arguments (cadence) or boot-time fetch (wave). Foundation for the future scoring engine (P6) and full cadence engine (P4)."
  - "Pattern: RESOLVERS-table dispatch for any type-discriminated logic. Anti-Pattern 4 originally applied to apply.js's HANDLERS; this plan extends it to cadence and locks it via tests/unit/cadence.test.js's discipline assertion."
  - "Pattern: D-78 grep gate as a zero-cost defense-in-depth for D-77's mount() helper. Belt-and-suspenders: discipline test catches bypasses, helper makes the safe path the easy path."
  - "Pattern: bounded-range repo reads (`getLogsInRange`) via the existing `date` index — never a full-table scan from view code."

requirements-completed: [CORE-04, CORE-05]

# Metrics
duration: 33m
completed: 2026-05-28
---

# Phase 3 Plan 01: Cadence + Wave Foundations Summary

**Pure-domain Slice 2 prerequisites — cadence resolver (4 types), wave catalog (10 entries, Wave 4 current today), mount() helper with D-78 grep-gate, 4 new date helpers, 2 new bounded-read repo methods; 74 new tests, A7 contract preserved.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-05-28T08:42:54Z
- **Completed:** 2026-05-28T09:15:28Z
- **Tasks:** 5 (all TDD: RED → GREEN per task = 10 atomic commits)
- **Files modified:** 12 (7 new code/data files + 5 new tests; 5 existing files extended)

## Accomplishments

- `js/domain/cadence.js` — pure 4-type resolver dispatching via RESOLVERS (no `switch`); all cadence shapes in `seed/habits.json` covered (daily, weekly, every-n-days, day-of-week-subset) including DST + leap-day fixtures.
- `js/domain/wave.js` + `seed/waves.json` — 10-entry wave catalog loaded in-memory at boot; `currentWave('2026-05-28')` returns Wave 4 per `<specifics>`; defensive-copy invariant on `getAllWaves`.
- `js/util/mount.js` — single trusted DOM-construction helper using `parent.ownerDocument.createElement` + `textContent` + `setAttribute`; `data-action` attrs wire click listeners via the `actions` map.
- `tests/unit/discipline.xss.test.js` — D-78 grep gate forbidding `.innerHTML / .outerHTML / .insertAdjacentHTML / document.write` across every `.js` under `js/`; empty allowlist.
- `js/util/date.js` extended with `isoWeekStart`, `isoWeekEnd`, `daysBetween` (Math.round — DST-safe), `formatRelative`.
- `js/db/repo.js` extended with `getAllHabits` + `getLogsInRange`; fake-idb mirrors the new surface so A7 contract test stays green.
- Test count: **100 → 174** (+74 new tests). Full suite green at every commit.

## Task Commits

Each TDD task produced one RED test commit + one GREEN implementation commit:

1. **Task 1: util/date.js helpers** — `413309a` (test) → `6a0e204` (feat)
2. **Task 2: discipline.xss + mount.js** — `b24fd60` (test) → `feb8bac` (feat)
3. **Task 3: domain/cadence.js** — `cf0e165` (test) → `0018117` (feat)
4. **Task 4: seed/waves.json + domain/wave.js** — `b17e0cb` (test) → `11bb3b4` (feat)
5. **Task 5: repo.getAllHabits + getLogsInRange + fake-idb mirror** — `4ed5045` (test) → `7a8053b` (feat)

## Files Created/Modified

**Created (7 code/data + 5 test):**
- `js/domain/cadence.js` — pure 4-cadence-type resolver (`appliesToday`)
- `js/domain/wave.js` — in-memory wave catalog (`bootWaves`, `currentWave`, `getWave`, `getAllWaves`, `configureWave`, `_resetWavesForTest`)
- `js/util/mount.js` — single export `mount(desc, parent, actions)` building DOM via textContent + setAttribute
- `seed/waves.json` — 10 waves (0..9) with startDate spread to honor <specifics>
- `tests/unit/cadence.test.js` — 22 behaviors + RESOLVERS discipline
- `tests/unit/wave.test.js` — 13 cases: shape, currentWave, getWave/getAllWaves, malformed input
- `tests/unit/mount.test.js` — 10 cases via hand-rolled fake DOM
- `tests/unit/date.weekly.test.js` — 22 cases for ISO-week + relative-time helpers
- `tests/unit/discipline.xss.test.js` — D-78 grep gate
- `tests/integration/repo.range.test.js` — 6 cases for getAllHabits + getLogsInRange

**Modified (5):**
- `js/util/date.js` — 4 new exports + extended file header (Math.floor banned in daysBetween)
- `js/db/repo.js` — 2 new exports + extended idb.js imports (getAll, indexGetAll)
- `tests/helpers/fake-idb.js` — 2 new methods + updated surface JSDoc
- `tests/integration/contract.fake-vs-real.test.js` — EXPECTED list extended by `getAllHabits`, `getLogsInRange`

## New exports surfaced (5 total)

| Surface | Export | Source |
|---|---|---|
| `js/db/repo.js` | `getAllHabits()` | new — full habit-store read |
| `js/db/repo.js` | `getLogsInRange(startYMD, endYMD)` | new — bounded log index read |
| `js/util/date.js` | `isoWeekStart`, `isoWeekEnd` | new — Mon/Sun week boundaries, DST-safe |
| `js/util/date.js` | `daysBetween` | new — whole-day count (Math.round) |
| `js/util/date.js` | `formatRelative` | new — "just now / N minutes / N hours / N days ago" |
| `js/util/mount.js` | `mount` | new — single trusted DOM-construction helper |
| `js/domain/cadence.js` | `appliesToday` | new — pure 4-cadence resolver |
| `js/domain/wave.js` | `configureWave`, `bootWaves`, `currentWave`, `getWave`, `getAllWaves`, `_resetWavesForTest` | new — in-memory wave catalog |

## Decisions Made

- **configureWave reset semantics** — used `hasOwnProperty('fetch')` rather than `if (deps.fetch)` so a `configureWave({fetch: null})` call in `beforeEach` clears the prior injection. Necessary for clean test isolation; production code never passes null.
- **Wave 4 startDate = 2026-04-27** — the Pattern document showed an illustrative 1-wave-per-week spacing that would have made Wave 9 current on 2026-05-28, contradicting `<specifics>` line 201. Picked 7-week spacing anchored at Wave 0 = 2025-12-29 so Wave 4 spans late April through mid-June 2026 (the window the user is actually in).
- **`daysBetween` uses Math.round, not Math.floor** — banned `Math.floor` inside `daysBetween` in the file header. A 1-hour DST gain/loss in the ms delta would silently underflow to N-1 with floor.
- **every-n-days safe default** — when both `lastCompletedDate` AND `createdAt` are absent, returns `true`. Preserves "loud failure for unknown cadence type" (T-03-04) while keeping "never hide a habit for missing data" (a known-data error should not also be a silent invisibility error).
- **mount() document seam** — resolves via `parent.ownerDocument` rather than `configureMount({document})`. Keeps mount() a pure function of its parent; tests inject a fake DOM by giving the parent a fake `ownerDocument`.

## Deviations from Plan

None - plan executed exactly as written.

(The only minor textual addition was the `hasOwnProperty('fetch')` reset path in `configureWave`, which the plan explicitly listed as "planner's call" / Claude's discretion under the configure-DI pattern. Documented under Decisions Made.)

## Issues Encountered

- **Node 24 vs CI Node 20 invocation difference** — `node --test tests/` resolves the directory under Node 20 (CI) but Node 24 treats the bare directory as a missing CommonJS module. Worked around by running `node --test "tests/**/*.test.js"` locally; CI invocation remains unchanged in `.github/workflows/ci.yml`. Not a code change; just a local-dev observation worth recording so a future agent knows why their local run might shape differently from CI.

## Requirements coverage

Plan frontmatter listed `[CORE-04, CORE-05, NFR-01, NFR-07]`. Status after this plan:

- **CORE-04** (cadence rules filter Today) — **foundation complete.** `appliesToday()` covers all 4 cadence types in `seed/habits.json`; end-user verification waits for Slice 2 (`/03-02`) when Today actually calls it.
- **CORE-05** (today's date + current wave on Today) — **foundation complete.** `currentWave(date)` ready; end-user verification waits for Slice 2.
- **NFR-01** (<300 ms cold paint with 1 year of data) — **enabling pieces in place.** `getAllHabits` + `getLogsInRange(today-7, today)` give Slice 2 a single bounded read; actual cold-paint measurement happens after Slice 2 ships.
- **NFR-07** (no color-only state encoding; accessible names) — **infrastructure in place.** `mount()` passes `aria-*` attributes verbatim via `setAttribute`; D-78 grep gate prevents HTML-injection sinks. Concrete a11y assertions land in Slice 2's builder tests.

`requirements-completed` frontmatter lists only `[CORE-04, CORE-05]` — the two that are now functionally implemented at the resolver / data-model level. NFR-01 and NFR-07 are enablers, not deliverables of this plan.

## Known Stubs

None - this plan ships pure-domain modules with no UI surface. No empty `=[]` / `=null` flowing to UI, no "TODO"s, no "coming soon" placeholders.

## Self-Check: PASSED

All claimed files exist and all commit hashes resolve:

- `js/domain/cadence.js` — FOUND
- `js/domain/wave.js` — FOUND
- `js/util/mount.js` — FOUND
- `seed/waves.json` — FOUND
- `tests/unit/cadence.test.js` — FOUND
- `tests/unit/wave.test.js` — FOUND
- `tests/unit/mount.test.js` — FOUND
- `tests/unit/date.weekly.test.js` — FOUND
- `tests/unit/discipline.xss.test.js` — FOUND
- `tests/integration/repo.range.test.js` — FOUND
- Commits `413309a`, `6a0e204`, `b24fd60`, `feb8bac`, `cf0e165`, `0018117`, `b17e0cb`, `11bb3b4`, `4ed5045`, `7a8053b` — all in `git log`.

## Next Phase Readiness

Slice 2 (Today renders, plan `03-02`) can now read the codebase without further dependency-discovery scavenger hunts:

- `import { appliesToday } from '../domain/cadence.js'` — already exists, tested across all 4 cadence types.
- `import { currentWave } from '../domain/wave.js'` — already exists, returns Wave 4 today.
- `import { mount } from '../util/mount.js'` — already exists, ready for `buildTodayHeader`/`buildTodayList`/`buildTodayRow`.
- `import { getAllHabits, getLogsInRange } from '../db/repo.js'` — already exists, fake-IDB-tested.
- `import { isoWeekStart, isoWeekEnd, formatRelative } from '../util/date.js'` — already exists, DST-safe.

Slice 2 needs only to wire these into a view module + router + the existing `apply.js` chokepoint; no further foundation gaps remain.

---
*Phase: 03-today-view-settings-v1-first-usable-slice*
*Completed: 2026-05-28*
