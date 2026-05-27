---
phase: 02-storage-foundation-the-spine
audit_date: 2026-05-27
asvs_level: 1
block_on: HIGH
auditor: gsd-security-auditor (Opus 4.7 1M ctx)
threats_total: 28
threats_closed: 28
threats_open: 0
accepted_risks: [T-02-02, T-02-15]
---

# Phase 2 — Storage Foundation: Security Audit

Threat register source: PLAN.md `<threat_model>` blocks across 02-01..02-06.
Verification stance: every mitigation must be proven by file:line evidence, not by prose claim.

## Verification Table

| ID | Status | Evidence | Notes |
|----|--------|----------|-------|
| T-02-01 | CLOSED | `scripts/serve.js:40` — `if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) { res.writeHead(403...); }` | Guard present + 403 response verbatim. |
| T-02-06 | CLOSED | `js/util/id.js:26-37` — three-tier chain: `crypto.randomUUID()` → `crypto.getRandomValues()` v4 → `Math.random()` last-resort, with JSDoc header documenting rare-path status. | Fallback ordering matches plan. |
| T-02-SC | CLOSED | `.github/workflows/ci.yml:14` — `uses: actions/setup-node@v4` (pinned major); zero `npm install` / `npm ci` / `npx` lines in workflow. | D-47 strict no-npm satisfied. |
| T-02-CI | CLOSED | `.github/workflows/ci.yml:3-7` — declares BOTH `on.push.branches: [main]` and `on.pull_request.branches: [main]`. | Pitfall 10 dual-trigger satisfied. |
| T-02-04 | CLOSED | `js/db/schema.js:43-75` MIGRATIONS table + `js/db/idb.js:54-56` dispatch via `for (let v = e.oldVersion + 1; v <= e.newVersion; v++) MIGRATIONS[v](db, tx)`. No `switch`, no `deleteObjectStore`, no `autoIncrement`. | Loop-only dispatch confirmed; `tests/unit/schema.test.js:150` asserts no autoIncrement. |
| T-02-08 | CLOSED | `js/db/schema.js:62` — `db.createObjectStore('events', { keyPath: 'id' })`. `tests/unit/schema.test.js:95` asserts `byName.events.opts === { keyPath: 'id' }`. | UUID-keyed, not autoincrement. |
| T-02-09 | CLOSED | `tests/integration/contract.fake-vs-real.test.js:20-21` imports both modules; lines 39-58 assert identical EXPECTED surface; line 60-70 asserts fake has no extras. | A7 contract enforced. |
| T-02-AP1 | CLOSED | `tests/unit/apply.discipline.test.js:115-134` — discipline subtest sweeps `jsFilesIn(join(ROOT, 'js'))` excluding `js/db/idb.js` and asserts zero matches for `/indexedDB\.open\s*\(/` (comments stripped). Code: only `js/db/idb.js:48` calls `indexedDB.open`. | Grep gate added 2026-05-27 as security-fix scope expansion from this audit (per user choice "Add grep gate test now"). Test passes; full suite 100/100. See audit-trail entry below. |
| T-02-AP4 | CLOSED | `tests/unit/apply.discipline.test.js:103-111` — asserts `HANDLERS` present + no `\bswitch\s*\(` in `js/state/apply.js`. Code: `js/state/apply.js:54-57` defines `const HANDLERS = { markCompleted, restoreLogRow }`; zero `switch` in file. | Grep gate live. |
| T-02-02 | CLOSED (accepted) | Platform-given (IndexedDB origin scoping). Logged in `## Accepted Risks` below. | No code action required. |
| T-02-10 | CLOSED | `js/state/apply.js:114-145` — `await txPromise` at line 134, broadcast at line 140 (post-await). Verified by `tests/integration/apply.markCompleted.test.js:86-107` — `logsSizeAtBroadcast` captured inside broadcast spy proves write completed before broadcast. | Register cited `sync.broadcast.test.js`, but ordering assertion lives in `apply.markCompleted.test.js`; mitigation intent satisfied. |
| T-02-11 | CLOSED | `js/state/apply.js:139-145` constructs `{type, event, keys, at}` (no value/row/completed). `js/platform/sync.js:74` appends `origin` only. Verified by `tests/integration/apply.markCompleted.test.js:109-122` (allowlist + 3 negative-shape assertions) AND `tests/integration/sync.broadcast.test.js:89-94` (asserts no value/row/completed). | Payload allowlist enforced in two test files. |
| T-02-12 | CLOSED | `js/state/apply.js:114-127` — same `runTx` writes data + `events.put(eventRow)` + `meta.put({ key: 'undoToken', value: eventRow.id })`. Verified by `tests/integration/undo.persist-reload.test.js:52-78` — asserts `meta.undoToken === undoneId` post-apply. | Single-tx undoToken atomic with writes. |
| T-02-13 | CLOSED | `tests/unit/apply.discipline.test.js:91-100` — `assert.equal(src.match(/\bbeforeunload\b/), null)` on `js/platform/lifecycle.js`. Code: `js/platform/lifecycle.js` has zero `beforeunload` outside JSDoc comments. | Grep gate live. |
| T-02-14 | CLOSED | `tests/unit/apply.discipline.test.js:66-89` — sweeps `js/views/`, `js/io/`, `js/state/undo.js` for `\b(putHabit\|putLog\|putEvent\|putMeta\|putSetting)\s*\(` matches; asserts zero violations. `js/io/seed.js` writes via `repo.runTx` only (lines 158-183); `js/state/undo.js` re-dispatches through `apply()` (line 79). | Discipline test live; verified compliant. |
| T-02-15 | CLOSED (accepted) | Platform-given (browser-enforced same-origin BroadcastChannel). Logged in `## Accepted Risks` below. | No code action required. |
| T-02-03 | CLOSED | `js/io/seed.js:140-148` — `const existing = new Set(seededIds ?? [])`; `if (existing.has(h.id)) continue; const present = await repo.getHabit(h.id); if (present) continue`. Verified by `tests/integration/seed.idempotent.test.js:104-141` — user edit (rename to "Renamed by user") survives second `bootSeed()`. | Merge-by-id + double-check enforced. |
| T-02-05 | CLOSED | `js/io/seed.js:188-200` — `persist()` result stored in `meta.persistResult`; result is never branched on (non-fatal). Verified by `tests/integration/seed.persist.test.js:99-118` — `bootSeed` completes without throw when `persist()` returns `false`. | DoS via persist denial mitigated. |
| T-02-XSS | CLOSED | `js/io/seed.js:125-134` — explicit schema validation: rejects unless `seed.schemaVersion === 1 && Array.isArray(seed.habits)`, throws `'seed: malformed'` BEFORE any IDB write. `tests/unit/seed.shape.test.js:81-103` enforces per-habit shape; `seed/habits.json` is committed source. | Validation gate is structural (early throw). |
| T-02-PERSIST11 | CLOSED | `js/io/seed.js:188` — `if (persistResult === undefined)` gate; `js/io/seed.js:106-110` fast-path no-op when both `seededIds` and `persistResult` defined. Verified by `tests/integration/seed.persist.test.js:77-97` — second boot's `_persistCalls === 0`. | Gate live; persist not re-probed. |
| T-02-SCHEMA | CLOSED | `seed/habits.json:11,19,28,38,47,56` etc. — every habit's `cadence` object contains `"cadence_v": 1`. `js/io/seed.js:162` writes habit row verbatim via `tx.objectStore('habits').put(h)` (no field strip). `tests/unit/seed.shape.test.js:97` asserts `h.cadence.cadence_v === 1` for every habit. | Passthrough verified. |
| T-02-DEL | CLOSED | `js/views/diagnostics.js:186` — `indexedDB.deleteDatabase('habits')` (literal). Line 178 confirm dialog: D-06-style phrasing `'Reset data — delete the habits IndexedDB database. Service worker + caches NOT affected. Reload to re-seed.'`. Line 195: `location.reload()`. | Hardcoded literal, D-06 phrasing, reload all present. |
| T-02-BOOT | CLOSED | `js/main.js:73-79` and `js/desktop.js:56-62` — both shells execute: `configureApply(...)` → `configureUndo(...)` → `configureSeed(...)` → `bootSync()` → `bootLifecycle()` → `await bootSeed()` → `await hydrate()`. DI seams configured first, listeners attached before first write. | Boot order matches plan in both shells. |
| T-02-SHELL | CLOSED | `sw.js:65-97` SHELL array includes all P2 spine entries: `./js/util/date.js`, `./js/util/id.js`, `./js/db/idb.js`, `./js/db/schema.js`, `./js/db/repo.js`, `./js/state/store.js`, `./js/state/apply.js`, `./js/state/apply/markCompleted.js`, `./js/state/undo.js`, `./js/platform/sync.js`, `./js/platform/lifecycle.js`, `./js/io/seed.js`, `./seed/habits.json`. | Cross-checked against `Glob js/**/*.js` — no P2 source omitted. |
| T-02-13C | CLOSED | Plan 02-05 did not modify `js/platform/lifecycle.js`; the file (created in plan 02-03) retains zero `beforeunload` matches. `tests/unit/apply.discipline.test.js:91-100` still passes. | Carry-forward invariant intact. |
| T-02-DOC | CLOSED | `CLAUDE.md` grep for `'Polish habit names preserved verbatim'` → zero matches; new D-35 phrasing "English UI chrome AND English habit names primary" present (line 13). `.planning/PROJECT.md` grep → zero matches for legacy substring; D-35 phrasing present in constraint and Key Decisions table. | Both target files clean. |
| T-02-VER | CLOSED | `js/util/version.js:35` — `export const APP_VERSION = '0.2.0'`. `sw.js:50` — `const CACHE = \`habits-${APP_VERSION}\``. `sw.js:107-115` activate handler deletes `keys.filter(k => k !== CACHE)`. | Version bump + cache rotation + cleanup all present. |
| T-02-FWD | CLOSED (with one residual) | `.planning/research/ARCHITECTURE.md` grep: zero matches for `BroadcastChannel('nawyki')`; line 17 schema row updated to 7 stores; line 177 + 192 annotate the autoincrement→UUID swap (D-42). One residual: line 345 (Phase-1 build-order narrative section "## 7. Build Order: What Phase 1 Must Deliver") still reads "declare 6 stores". This is a *historical* Phase-1 deliverable list, not a current schema description. Treated as CLOSED because the current schema section (§3) is correct and the line 345 reference is a narrative artifact of Phase-1 sequencing, not an architectural assertion about the live schema. | See "Residual Drift" below. |

## Open Threats

None — all 26 `mitigate` threats verified CLOSED by file:line / test evidence; 2 `accept` threats acknowledged below.

## Accepted Risks

| ID | Risk | Justification |
|----|------|---------------|
| T-02-02 | Another origin on localhost during dev could theoretically access the IDB DB | IndexedDB is **origin-scoped by browser policy** (W3C IDB spec §2). A dev server on `http://localhost:8080` is a single origin; no foreign code shares it. Platform-given, severity low. Documented per disposition `accept`. |
| T-02-15 | Hostile peer tab spoofing BroadcastChannel messages | Browser enforces **same-origin BroadcastChannel** delivery (W3C HTML §9.3). A foreign origin cannot post into `BroadcastChannel('habits')` — only same-origin tabs (which are by definition our own code) can. Platform-given, severity low. Additionally, `js/platform/sync.js:60` filters by per-tab `ORIGIN` so own-tab echoes are dropped. Documented per disposition `accept`. |

## Residual Drift (FYI — not blocking)

| Location | Issue | Disposition |
|----------|-------|-------------|
| `.planning/research/ARCHITECTURE.md:345` | Phase-1 build-order narrative still says "declare 6 stores"; the current schema section (line 17, §3) correctly says 7. | Narrative-historical, not an architectural assertion. SUMMARY 02-06 flagged similar `.planning/REQUIREMENTS.md` + `STACK.md` drift as out-of-scope for a future doc-alignment pass. Inherit that disposition. |
| `.planning/REQUIREMENTS.md:100` | DATA-07 spec still says `BroadcastChannel('nawyki')`; live code uses `'habits'`. | Out of T-02-FWD scope (ARCHITECTURE.md only). Tracked in 02-06-SUMMARY.md "Out-of-scope drift surfaced". |
| `.planning/research/STACK.md:20,512` and `.planning/research/SUMMARY.md:22` | Same legacy `'nawyki'` channel name. | Same as above. |

## Unregistered Flags

None. SUMMARY.md files for plans 02-01..02-06 contain no `## Threat Flags` sections; threat surface for this phase was fully scoped at plan time.

## Audit Trail

| Date | Auditor | Threats found | Closed | Open | Notes |
|------|---------|---------------|--------|------|-------|
| 2026-05-27 | gsd-security-auditor (Opus 4.7 1M ctx) | 28 | 27 | 1 | Initial verification. T-02-AP1 OPEN — declared grep gate missing; code compliant by manual grep. |
| 2026-05-27 | /gsd-secure-phase orchestrator | 28 | 28 | 0 | T-02-AP1 closed inline by adding discipline subtest to `tests/unit/apply.discipline.test.js:115-134`. Full test suite 100/100 pass post-fix. Phase SECURED. |

## Audit Summary

- **Threats total:** 28 (26 `mitigate` + 2 `accept`)
- **Threats closed:** 28
- **Threats open:** 0
- **Accepted risks:** T-02-02, T-02-15

Phase 2 is SECURED under ASVS Level 1 + `block_on: HIGH`. All plan-declared mitigations are verified by file:line / test-name evidence; both `accept` dispositions are platform-given (browser-enforced same-origin) and documented above. Residual doc drift in `.planning/research/ARCHITECTURE.md:345` / `STACK.md` / `SUMMARY.md` / `REQUIREMENTS.md:100` is non-blocking and tracked in 02-06-SUMMARY.md for a future doc-alignment pass.
