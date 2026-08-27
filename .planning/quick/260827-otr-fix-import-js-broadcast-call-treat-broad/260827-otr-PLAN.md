---
phase: quick
plan: 260827-otr
type: execute
wave: 1
depends_on: []
files_modified:
  - js/io/import.js
autonomous: true
requirements:
  - IMPORT-BROADCAST-FIX
must_haves:
  truths:
    - import.js calls _broadcast as a function, matching the apply.js pattern
    - configureImport accepts broadcast as a callable, not a BroadcastChannel object
    - All JSDoc type annotations in import.js reflect the function shape
  artifacts:
    - js/io/import.js (updated)
  key_links:
    - import.js _broadcast call matches how sync.js exports broadcast
---

<objective>
Fix import.js so it treats the injected `broadcast` dependency as a plain callable
function — the shape that `sync.js` actually exports and `main.js` passes — instead
of treating it as a BroadcastChannel object with `.postMessage()`.

Purpose: Align import.js with the established pattern in apply.js and prevent the
`TypeError: _broadcast.postMessage is not a function` runtime error that fires on
every JSON import.

Output: js/io/import.js with corrected call site and matching JSDoc types.
</objective>

<execution_context>
@C:/my-code/vibe-coding/habits/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/habits/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/habits/.planning/STATE.md
@C:/my-code/vibe-coding/habits/js/io/import.js
@C:/my-code/vibe-coding/habits/js/state/apply.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix broadcast call site and JSDoc types in import.js</name>
  <files>js/io/import.js</files>
  <action>
    Make four targeted changes in js/io/import.js — all are type/call-shape
    corrections, no logic change:

    1. File-header JSDoc (lines 6-7 region, the sentence about "production boot
       wires ... a real BroadcastChannel"): update to say "production boot wires
       the real repo and the real broadcast function from js/platform/sync.js".

    2. File-header JSDoc (lines 25-30 region, the Broadcast D-100 paragraph):
       change `broadcast.postMessage({type: 'import:done'})` to
       `broadcast({type: 'import:done'})` in the prose, and update the description
       to say "if a `broadcast` function was injected" (not "if a `broadcast`
       object was injected").

    3. The `_broadcast` module-level variable JSDoc block (lines 48-55): change
       the `@type` from `{postMessage: (msg: object) => void}|null` to
       `((msg: object) => void)|null`. Update the prose description from
       "Optional BroadcastChannel-shaped object — must expose `postMessage(msg)`"
       to "Optional broadcast callable — called with a plain message object.
       If null/undefined, no broadcast is sent after import."

    4. The `configureImport` JSDoc (lines 74-81 region): change the `broadcast?`
       param type annotation from `{postMessage: (msg: object) => void}` to
       `(msg: object) => void`.

    5. The call site at line 141: change
         `_broadcast.postMessage({ type: 'import:done' });`
       to
         `_broadcast({ type: 'import:done' });`

    Do NOT touch any other logic, store list, validation code, or transaction body.
    The default value of `_broadcast` stays `null` (import.js uses a null-guard
    `if (_broadcast)` before calling, unlike apply.js which uses a no-op default —
    both patterns are correct; keep the null-guard as-is).
  </action>
  <verify>
    <automated>node --test tests/unit/ 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `_broadcast.postMessage` no longer appears anywhere in js/io/import.js
    - All four JSDoc annotations reflect the function shape
    - Full unit test suite passes with no new failures
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| import.js → sync.js | broadcast dep is a function reference, not a channel object |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-otr-01 | Tampering | _broadcast null-guard | low | accept | Existing `if (_broadcast)` guard already prevents null-dereference; no change needed |
</threat_model>

<verification>
- grep -n "postMessage" js/io/import.js → zero matches
- node --test tests/unit/ → all pass
</verification>

<success_criteria>
JSON import completes without throwing `TypeError: _broadcast.postMessage is not a
function`. The `import:done` BroadcastChannel message reaches other tabs correctly.
</success_criteria>

<output>
Create `.planning/quick/260827-otr-fix-import-js-broadcast-call-treat-broad/260827-otr-SUMMARY.md` when done
</output>
