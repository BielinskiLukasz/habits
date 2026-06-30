---
status: testing
phase: 06-desktop-analytics-scoring-trio
scope: full-app
source: [01..06 all SUMMARY.md files — comprehensive cross-phase verification]
started: 2026-06-30T17:00:00Z
updated: 2026-06-30T17:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Run `node scripts/serve.js` and open http://localhost:8080/ in a browser.
  The mobile Today view loads without any JS errors in the console.
  Today's date is displayed and your habits are listed.
  Then open http://localhost:8080/desktop.html — the desktop analytics shell
  loads with a sidebar and the Analytics panel visible. No JS errors.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Run `node scripts/serve.js` and open http://localhost:8080/. Mobile Today view loads without JS errors, today's date is displayed, habits are listed. Then open http://localhost:8080/desktop.html — desktop analytics shell loads with sidebar and Analytics panel visible. No JS errors in either.
result: [pending]

### 2. Today View — Habit List
expected: The Today view (index.html) shows your habits for today. Not all ~65 habits appear — only those whose cadence makes them applicable today (e.g. a Monday-only habit does not appear on other days, every-2-days habits only on their slot days). Today's date and wave context are shown at the top.
result: [pending]

### 3. Mark Habit Complete
expected: Tap any binary habit row once. The row updates immediately (< 100 ms) to show it's completed — either a checkmark, strikethrough, or visual change. An undo toast appears at the bottom of the screen with the habit name and a short countdown before it dismisses.
result: [pending]

### 4. Unmark a Completed Habit
expected: Tap a completed habit row again. It toggles back to incomplete immediately. Another undo toast appears.
result: [pending]

### 5. Undo via Toast
expected: Mark a habit, then tap the Undo action in the toast before it dismisses (5 seconds). The habit returns to its prior state. The undo still works after a full page reload (the pending undo token is persisted across refreshes).
result: [pending]

### 6. Settings — Core Cards
expected: Navigate to Settings (bottom nav or sidebar). The Settings page shows at minimum these cards: Storage (with persistence status yes/no), Schedule (week start), Install (platform-specific instructions), Data (version number, reset option), About. All cards render without errors.
result: [pending]

### 7. Settings — Scoring Model Card
expected: In Settings, a "Scoring Model" card is visible with three radio buttons: S1 — Rolling Threshold, S2 — Day-Weighted, S3 — Load-Adjusted. The currently active model is checked. Selecting a different one and navigating away then back to Settings should preserve the choice.
result: [pending]

### 8. Settings — Recompute Scores Button
expected: In Settings → Data card, a "Recompute Scores" button is visible. Clicking it disables the button with a loading label (e.g. "Recomputing…"). After it finishes, a success toast appears and the button re-enables. No error messages.
result: [pending]

### 9. Catalog View — Habit List
expected: Navigate to Catalog (mobile bottom nav). All ~65 habits are listed, grouped by wave (Fala 0 → Fala 9). Each habit shows its name, stage (etap1/2/3), and status (active/mastered/archived). The list is scrollable and rendered without errors.
result: [pending]

### 10. Catalog — Create New Habit
expected: In Catalog, tap "Add habit" or equivalent. Fill in a name, pick a wave, set a cadence. Save it. The new habit appears in the catalog immediately, in the correct wave group. The Today view should show it if it applies today.
result: [pending]

### 11. Catalog — Edit Habit
expected: Tap to edit an existing habit. Change its name or description. Save. The catalog shows the updated name. Navigate to History and check a past day — the old logs still show the original name/state (edit is versioned, history is untouched).
result: [pending]

### 12. Catalog — Archive and Restore
expected: Archive a habit from the catalog. It disappears from the active list (and from Today). Tap "Show archived" or equivalent. The archived habit is visible. Tap Restore. The habit returns to active status and reappears on Today (if applicable today).
result: [pending]

### 13. Multi-Occurrence Habit Logging
expected: Find a multi-occurrence habit on Today (one with a numeric target like "3 / 7 meals" or slot-checklist). Tap the "+" button to log one occurrence. The count increments (e.g. 1 / 7). Tap again — count goes to 2 / 7. The habit shows as complete only once the target is reached.
result: [pending]

### 14. Mastery Status
expected: A habit that has been consistently completed for a long time shows a "mastered" visual treatment on Today — muted appearance and a mastery badge. The habit is still tappable and markable. In Catalog, mastered habits have a distinct visual state.
result: [pending]

### 15. History View — Past Day
expected: Navigate to History. Go to a past day (e.g. yesterday or a specific date). The habits that applied on that day are listed, with their logged state for that day. You can mark a habit as not-completed for that past day. The change is saved.
result: [pending]

### 16. Export — JSON Backup
expected: In Settings → Data card, tap "Export JSON". A file download starts with a filename like `habits-backup-YYYY-MM-DD.json`. The file is valid JSON containing all your habits, logs, and settings. It includes a `schemaVersion` field.
result: [pending]

### 17. Export — CSV
expected: In Settings → Data card, tap "Export CSV". A file downloads with filename `habits-completion-YYYY-MM-DD.csv`. Opening it in Excel (or a text editor) shows: habit names in rows, dates as columns, cells containing `1` (done), `0` (missed), or `x` (not applicable). Polish characters render correctly (UTF-8 BOM). Rows grouped by wave.
result: [pending]

### 18. Import — JSON Round-Trip
expected: Take the JSON backup you just downloaded. In Settings → Data, tap "Import JSON". Select the file. Import completes without errors and shows a confirmation. Your habits and logs are intact. No data was lost.
result: [pending]

### 19. Backup Nag
expected: In Settings → Data card, a "Last backup" line is visible showing when you last exported (or "Never" if you haven't). If it's been more than 7 days since the last backup, a nag banner appears near the top of Settings prompting you to export. The nag can be dismissed.
result: [pending]

### 20. Desktop Shell Navigation
expected: On desktop.html, the left sidebar shows four navigation items: Analytics, Waveboard, Planning, Settings. Analytics is the default on load. Clicking each nav item shows the corresponding panel on the right. No full page reloads — panels switch in-place.
result: [pending]

### 21. Analytics View — Wave Table
expected: The Analytics panel shows a table with habits grouped by waves. Each row shows habit name, stage, rolling % (or score based on active model), and mastery status. Wave header rows separate the groups. The data is populated with your real habits (no stub/placeholder text).
result: [pending]

### 22. Analytics — Scoring Model Switch
expected: The Analytics panel has a model selector with S1, S2, S3 options. Switching from S1 to S2 updates the score column in the table immediately. Switching to S3 updates again. The selected radio stays checked. No page reload.
result: [pending]

### 23. Waveboard — 12-Week Heat-Map
expected: The Waveboard panel shows a grid: habits in rows, last 12 ISO weeks as column headers (e.g. W19 … W30). Each cell is color-coded by S1 health status (Healthy/Watch/At-risk/Failing). Archived habits show N/A cells (visually dimmed). The habit name column stays fixed when scrolling right.
result: [pending]

### 24. Planning View — Future Grid
expected: The Planning panel shows a forward-looking 12-week grid (starting from next week, not this week). Habits whose start date falls within those weeks appear in the grid with a link. Clicking a habit link navigates to the catalog (./index.html#catalog). If no habits have upcoming start dates, an empty state message is shown.
result: [pending]

### 25. App Version
expected: Somewhere in the UI (Settings → About card, or page footer) the app shows version 0.5.0. Alternatively, check the browser console — `APP_VERSION` or similar should log `0.5.0` on load.
result: [pending]

## Summary

total: 25
passed: 0
issues: 0
pending: 25
skipped: 0
blocked: 0

## Gaps

[none yet]
