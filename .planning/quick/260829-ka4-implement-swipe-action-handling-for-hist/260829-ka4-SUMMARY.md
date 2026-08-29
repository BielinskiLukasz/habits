---
phase: quick
plan: 260829-ka4
subsystem: history-view
tags: [swipe-ux, 4-state, history]
status: complete

requires: [4-state-log-status]
provides: [history-swipe-ux]
affects: [views/history, views/history/builders, css/history]
---

# Summary: History Screen Swipe UX

## What was done

Added 4-state swipe UX to the History screen matching the Today view:

- **Swipe-right** → marks habit completed (with undo toast)
- **Swipe-left** → reveals Skip / Fail action panel
- **4-state status display** in rows: ✓ completed, ↷ skipped, ✕ failed, – none
- **Row state classes** for visual treatment per status

## Files changed

- `js/views/history/builders.js` — slide/actions structure, 4-state statusText, row state classes
- `js/views/history.js` — swipe state + closure handlers, new actions, fixed toggle-log bug
- `css/history.css` — position:relative/overflow:hidden on row, `.history-row__slide` styles, status modifiers

## Bug fixed

`toggle-log` was checking `currentLog?.completed === true` (boolean field from old model). Fixed to `currentLog?.status === 'completed' || currentLog?.completed === true` to handle both the 4-state model and any legacy logs.

## Pre-existing test failures (unrelated)

`tests/unit/store.hydrate.test.js` has 3 failures testing `completed: boolean` — these predate this change and are caused by the 4-state model migration not yet being reflected in those tests.
