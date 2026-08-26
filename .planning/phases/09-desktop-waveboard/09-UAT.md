---
status: complete
phase: 09-desktop-waveboard
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md
started: 2026-08-25T00:00:00Z
updated: 2026-08-26T00:00:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Wave Planning section renders on desktop waveboard
expected: Open desktop.html and navigate to #waveboard. A Wave Planning section renders below the main waveboard content, showing one collapsed accordion row per wave.
result: pass

### 2. Wave header shows start date and habit counts
expected: Each wave row header displays the wave's start date (e.g. "2026-01-05") and a count formatted as "{N} active · {N} scheduled" using a middle dot (·) separator, not a dash or slash.
result: issue
reported: "still 0s there. On analytics screen each wave has habits, on waveboard in hm score matrix too, but for wave planning waves are empty"
severity: major

### 3. Accordion expands and collapses
expected: Clicking a wave header expands it to reveal its habits. Clicking the same header again collapses it. The expanded/collapsed state persists across re-renders — no flicker or unexpected collapse when data refreshes.
result: pass

### 4. Active/mastered habits shown in expanded wave
expected: Expanding a wave that has active or mastered habits shows each habit as a row with three pieces of information: its status (active/mastered), its current stage, and its cadence summary (e.g. "daily", "Mon/Thu").
result: issue
reported: "There are no habits. It still not get them correctly"
severity: major

### 5. Scheduled habits with promote button
expected: A wave with scheduled habits (habits whose startDate hasn't passed yet) shows those habits in a separate list with a "Promote" button next to each. Clicking Promote promotes that habit to active.
result: issue
reported: "without habits I cannot see promote button"
severity: major

### 6. Health badge reflects wave status
expected: Each wave header shows a color-coded health badge. Waves with no active habits show "Upcoming". Waves with active habits show one of: Healthy, Watch, At Risk, or Failing — based on the worst habit status in the wave. Color coding is visible (green / amber / red / grey).
result: pass

### 7. Wave planning section visual quality
expected: The accordion has visible chevron indicators that rotate on expand/collapse. Badge colors are distinct (green, amber, red, grey). The promote button shows a visible hover state. Overall styling is cohesive with the rest of the desktop view.
result: pass

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-09-2
  truth: "Wave headers show correct habit counts — N active · N scheduled per wave"
  status: failed
  reason: "User reported: still 0s there. On analytics screen each wave has habits, on waveboard in hm score matrix too, but for wave planning waves are empty"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-09-4
  truth: "Expanded wave shows active/mastered habits with status, stage, and cadence"
  status: failed
  reason: "User reported: There are no habits. It still not get them correctly"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-09-5
  truth: "Scheduled habits appear with a Promote button in expanded wave"
  status: failed
  reason: "User reported: without habits I cannot see promote button"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
