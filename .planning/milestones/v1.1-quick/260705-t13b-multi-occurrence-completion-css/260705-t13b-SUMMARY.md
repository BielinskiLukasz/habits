---
status: complete
date: 2026-07-05
---

# Quick Task 260705-t13b: Apply completion CSS class to multi-occurrence rows

## Result

T13b fixed. Completed numeric and slot habits now show the same muted/strikethrough
treatment as binary habits.

## Root Cause

`buildNumericRow` and `buildSlotRow` in `js/views/today/builders.js` emitted only
`habit-row--complete` when complete — a class with no CSS definition in `today.css`.
Only `today-row--completed` carries the `opacity: 0.55` muted treatment; neither
row type applied `today-row-name--completed` (strikethrough) to the name span.

## Changes

**`js/views/today/builders.js`**

- `buildNumericRow` `<li>`: when `isComplete`, class is now
  `today-row today-row--numeric habit-row--complete today-row--completed`
  (`habit-row--complete` kept — used by `history.css` and existing tests)
- `buildNumericRow` name `<span>`: when `isComplete`, class is now
  `today-row-name today-row-name--completed` (strikethrough)
- `buildSlotRow` `<li>`: same additive `today-row--completed` when all slots checked
- `buildSlotRow` name `<span>`: `today-row-name--completed` when all slots checked

**`tests/unit/builders.today.numeric.test.js`**

4 new tests added (TDD: RED commit first, then GREEN):
- Numeric row has `today-row--completed` when complete
- Numeric name span has `today-row-name--completed` when complete
- Slot row has `today-row--completed` when all slots checked
- Slot name span has `today-row-name--completed` when all slots checked

## Test Results

527 tests total — 525 pass, 2 pre-existing failures (import broadcast, unrelated).

## Commits

- `f1f5c2d` — test(260705-t13b): RED — today-row--completed on numeric/slot complete rows
- `bc74db1` — fix(260705-t13b): apply today-row--completed + strikethrough to numeric/slot complete rows (T13b)
