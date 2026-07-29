---
status: diagnosed
phase: 08-today-catalog-upcoming-section
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Catalog Active List Excludes Scheduled Habits
expected: Open the Catalog page. Scheduled habits are absent from the main active list — only habits with status active, mastered, or archived appear in that list.
result: pass

### 2. Upcoming Section Appears with "Upcoming" Heading
expected: When at least one habit has status "scheduled", the Catalog page shows an "Upcoming" section below the active list, with an h2 heading that reads exactly "Upcoming".
result: pass

### 3. Upcoming Section Hidden When No Scheduled Habits
expected: When no habits have status "scheduled", the Upcoming section and its heading are completely absent from the Catalog page (no empty section, no orphaned heading).
result: pass

### 4. Upcoming Items Show Name, Wave, Start Date, Edit & Promote Buttons
expected: Each item in the Upcoming section displays: the habit name, a Wave badge, an ISO start date (format YYYY-MM-DD), an Edit button, and a Promote button. There is no mastery badge, no stage info, and no Archive button on these items.
result: issue
reported: "There are point dots and buttons are huge, more width than active habits"
severity: cosmetic

### 5. Upcoming Items Sorted Chronologically (Soonest First)
expected: When multiple habits are in the Upcoming section, they appear in ascending order by start date — the habit with the earliest start date is listed first.
result: pass

### 6. Promote Button Moves Habit from Upcoming to Active List
expected: Clicking the Promote button on an Upcoming item immediately removes it from the Upcoming section and adds it to the active habits list — without a page reload. If the Upcoming section had only that one item, the section and heading disappear.
result: pass

### 7. Today View Does Not Show Scheduled Habits
expected: Open the Today check-in view (mobile). Habits with status "scheduled" do not appear in the daily check-in list — only active (and mastered) habits are shown.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-08-4
  truth: "Upcoming items render with consistent styling — no bullet dots, buttons sized to match active list"
  status: failed
  reason: "User reported: There are point dots and buttons are huge, more width than active habits"
  severity: cosmetic
  test: 4
  root_cause: "Two missing CSS rules in css/catalog.css — .catalog-upcoming-list has no list-style: none (causing bullet dots), and .catalog-upcoming-item has no display: flex layout (causing buttons to expand full width instead of constrained)"
  artifacts:
    - path: "css/catalog.css"
      issue: "Missing .catalog-upcoming-list rule (list-style: none) and .catalog-upcoming-item rule (display: flex + padding)"
  missing:
    - "Add .catalog-upcoming-list { list-style: none; margin: 0; padding: var(--space-2) 0; }"
    - "Add .catalog-upcoming-item { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border, #e5e7eb); transition: opacity 0.2s ease; }"
