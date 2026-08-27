---
phase: quick
plan: 260827-otr
subsystem: io/import
tags: [bugfix, broadcast, import, jsdoc]
status: complete

dependency_graph:
  requires: []
  provides: [import.js broadcasts via callable, not postMessage]
  affects: [js/io/import.js]

tech_stack:
  added: []
  patterns: [dependency-injection-callable]

key_files:
  created: []
  modified:
    - js/io/import.js
    - tests/unit/import.test.js

decisions:
  - broadcast dep in import.js is a plain callable matching sync.js export shape

metrics:
  duration: "3 minutes"
  completed: "2026-08-27"
  tasks_completed: 1
  commits: 1
---

# Quick Task 260827-otr: Fix import.js broadcast call — treat broadcast as callable

**One-liner:** Fix `_broadcast.postMessage(...)` → `_broadcast(...)` in import.js so JSON import no longer throws `TypeError: _broadcast.postMessage is not a function`.

## What Was Done

`js/io/import.js` was treating the injected `broadcast` dependency as a BroadcastChannel object (calling `.postMessage()`), but `sync.js` exports and `main.js` passes a plain callable function — the same shape used by `apply.js`.

Five targeted changes were made (no logic change — type/call-shape corrections only):

1. **File-header prose (line 7):** "a real BroadcastChannel" → "the real broadcast function from js/platform/sync.js"
2. **D-100 comment block (lines 25-28):** `broadcast.postMessage(...)` → `broadcast(...)` and "broadcast object" → "broadcast function"
3. **`_broadcast` JSDoc type (line 51):** `{postMessage: (msg: object) => void}|null` → `((msg: object) => void)|null`; updated description from "BroadcastChannel-shaped object" to "Optional broadcast callable"
4. **`configureImport` JSDoc param (line 79):** `broadcast?: {postMessage: ...}` → `broadcast?: (msg: object) => void`
5. **Call site (line 141):** `_broadcast.postMessage({ type: 'import:done' })` → `_broadcast({ type: 'import:done' })`

The test in `tests/unit/import.test.js` was also updated (deviation Rule 1) — the fake `broadcast` was a `{ postMessage(msg) {...} }` object; updated to a plain arrow function to match the corrected shape.

## Verification

- `grep -n "postMessage" js/io/import.js` → zero matches
- `node --test tests/unit/*.test.js` → 546 pass, 0 fail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated import.test.js fake broadcast to match callable shape**
- **Found during:** Task 1 verification
- **Issue:** The existing test injected `{ postMessage(msg) {...} }` which broke after the call-site fix
- **Fix:** Changed fake to a plain arrow function `(msg) => { ... }` matching the new callable contract
- **Files modified:** tests/unit/import.test.js
- **Commit:** 83590a2

## Commits

| Hash | Message |
|------|---------|
| 83590a2 | fix(import): treat broadcast dep as callable, not BroadcastChannel |

## Self-Check

- [x] `js/io/import.js` modified — confirmed via git diff
- [x] `_broadcast.postMessage` not found in import.js — grep returned zero matches
- [x] All 546 unit tests pass
- [x] Commit 83590a2 exists in git log

## Self-Check: PASSED
