---
status: complete
phase: 07-scheduled-status-foundation
scope: foundation-layer (no UI changes; verification via DevTools IDB + CLI)
source: [07-01..03 SUMMARY.md files + VERIFICATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

**UAT COMPLETE — 2026-07-15**

## Tests

### 1. Cold Start Smoke Test
expected: Run `node scripts/serve.js` and open http://localhost:8080/. Mobile Today view loads without JS errors. Open the browser console — no red errors. Then open http://localhost:8080/desktop.html — desktop shell loads with sidebar and Analytics panel. No JS errors. (Phase 7 adds no visible UI, so this is purely a regression check.)
result: ✓ PASSED

### 2. IDB Boot Migration Check
expected: Open http://localhost:8080/ in Chrome, open DevTools → Application → IndexedDB → habits → meta store. Find a row with key `scheduledMigrationV1`. Its value should be `true`. This proves the one-time reclassification pass ran on first boot after Phase 7 deployed.
result: ✓ PASSED

### 3. Create Habit with Future startDate → Stored as Scheduled
expected: Open http://localhost:8080/#catalog. Tap "Add habit". Set the name to "UAT Test Future Habit". In the startDate field, enter a date in the future (e.g. 2027-01-01). Save. Then open DevTools → Application → IndexedDB → habits → habits store. Find the newly created habit. Its `status` field should be `scheduled`, not `active`.
result: ✓ PASSED — UX note: scheduled habits show same label color as active habits (backlog: distinct visual for scheduled status)
notes: Also flagged: no "Back to mobile view" link from desktop shell (backlog: add mobile←→desktop nav cross-link)

### 4. Boot Auto-Promotion — Scheduled Habit Whose Date Has Arrived
expected: Using DevTools console on http://localhost:8080/, manually set a habit's status to `scheduled` with a startDate of yesterday or today. Reload the page. Then check the same habit in IDB → habits store. Its status should now be `active` (the boot promotion pass ran). (To do this: in the DevTools console, find the IDB entry for any habit, note its id, then use: `indexedDB.open('habits-db').onsuccess = e => { const db = e.target.result; const tx = db.transaction('habits','readwrite'); tx.objectStore('habits').get('<your-habit-id>').onsuccess = r => { const h = r.target.result; h.status='scheduled'; h.startDate='2026-07-14'; tx.objectStore('habits').put(h); }; }` — then reload.)
result: ✓ PASSED

### 5. Scheduled Habit with Future Date Stays Scheduled on Boot
expected: Same approach as Test 4, but this time set `startDate` to a far-future date (e.g. `2099-01-01`). Reload the page. The habit's `status` in IDB should still be `scheduled` — the promotion pass must NOT have promoted it.
result: ✓ PASSED

### 6. JSON Export Includes Scheduled Status
expected: In Settings → Data card, tap "Export JSON". Open the downloaded file in a text editor. Find the "UAT Test Future Habit" created in Test 3. Its `status` field should be `"scheduled"` in the exported JSON.
result: ✓ PASSED

### 7. JSON Import Round-Trip Preserves Scheduled Status
expected: Take the JSON backup from Test 6. In Settings → Data, use "Import JSON" to re-import it. After import, open DevTools → IndexedDB → habits → habits store. Find the "UAT Test Future Habit". Its `status` should still be `"scheduled"` — import must not have overwritten it with `"active"`.
result: ✓ PASSED — UX note: no success confirmation shown after import; page silently reloads (backlog: B-017)

### 8. convert-nawyki.js Outputs Scheduled for Future Habits
expected: Run `node scripts/convert-nawyki.js 2>&1 | head -5` (or open the output JSON if it writes a file). Habits in the seed data that have a `startDate` in the future (waves 5–9 typically) should have `"status": "scheduled"` in the output. Habits with past/null startDates should have `"status": "active"`.
result: ✓ PASSED — UX note: bottom nav buttons float up when content is short; should be pinned to viewport bottom (backlog: B-018)

### 9. Today View Shows No Scheduled Habits
expected: The Today check-in (http://localhost:8080/) should NOT show the "UAT Test Future Habit" created in Test 3 (it is scheduled, not active). Scheduled habits must not appear in Today — that's Phase 8 scope, and getting them showing here would be a bug.
result: ✓ PASSED

### 10. Regression — Core Daily Check-In Still Works
expected: Mark any existing binary habit on the Today view as complete. The row updates immediately. An undo toast appears. Tap undo — the habit reverts. This confirms Phase 7 did not break the core check-in path.
result: ✓ PASSED

## Summary

total: 10
passed: 10
failed: 0
issues: 4 UX (backlogged B-015–B-018)
pending: 0
skipped: 0
blocked: 0

## Issues Requiring Fixes

None — all 10 tests passed. Four UX observations captured as backlog items:

- **B-015** — Scheduled habits have no distinct visual treatment (same color as active)
- **B-016** — No "Back to mobile view" link from desktop shell
- **B-017** — No success confirmation toast after JSON import (silent reload)
- **B-018** — Bottom nav floats up on short-content pages (should be pinned to viewport bottom)
