---
status: testing
phase: 09-desktop-waveboard
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md
started: 2026-08-25T00:00:00Z
updated: 2026-08-25T00:00:00Z
---

## Current Test

number: 1
name: Wave Planning section renders on desktop waveboard
expected: |
  Open desktop.html (or navigate to http://localhost:8080/desktop.html#waveboard).
  Below the main waveboard content, a Wave Planning section renders.
  It shows a list of accordion rows — one per wave. Each row is collapsed by default.
awaiting: user response

## Tests

### 1. Wave Planning section renders on desktop waveboard
expected: Open desktop.html and navigate to #waveboard. A Wave Planning section renders below the main waveboard content, showing one collapsed accordion row per wave.
result: [pending]

### 2. Wave header shows start date and habit counts
expected: Each wave row header displays the wave's start date (e.g. "2026-01-05") and a count formatted as "{N} active · {N} scheduled" using a middle dot (·) separator, not a dash or slash.
result: [pending]

### 3. Accordion expands and collapses
expected: Clicking a wave header expands it to reveal its habits. Clicking the same header again collapses it. The expanded/collapsed state persists across re-renders — no flicker or unexpected collapse when data refreshes.
result: [pending]

### 4. Active/mastered habits shown in expanded wave
expected: Expanding a wave that has active or mastered habits shows each habit as a row with three pieces of information: its status (active/mastered), its current stage, and its cadence summary (e.g. "daily", "Mon/Thu").
result: [pending]

### 5. Scheduled habits with promote button
expected: A wave with scheduled habits (habits whose startDate hasn't passed yet) shows those habits in a separate list with a "Promote" button next to each. Clicking Promote promotes that habit to active.
result: [pending]

### 6. Health badge reflects wave status
expected: Each wave header shows a color-coded health badge. Waves with no active habits show "Upcoming". Waves with active habits show one of: Healthy, Watch, At Risk, or Failing — based on the worst habit status in the wave. Color coding is visible (green / amber / red / grey).
result: [pending]

### 7. Wave planning section visual quality
expected: The accordion has visible chevron indicators that rotate on expand/collapse. Badge colors are distinct (green, amber, red, grey). The promote button shows a visible hover state. Overall styling is cohesive with the rest of the desktop view.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
