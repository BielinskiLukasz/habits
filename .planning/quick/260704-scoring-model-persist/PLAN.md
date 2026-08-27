---
slug: scoring-model-persist
created: 2026-07-04
status: complete
source: UAT Test 7
---

# Fix: Scoring Model Selection Not Persisted

## Problem

In Settings, the S1/S2/S3 scoring model radio button reverts to S1 after navigating away and back. The selection is not saved to IDB and not restored when the Settings view re-mounts.

## Expected Behavior

1. User selects S2 (or S3) radio button in Settings
2. Navigate to Today view, then back to Settings
3. S2 (or S3) is still checked

## Files to Investigate

- `js/views/settings.js` — where the Settings view mounts and radio handlers are wired
- `js/views/settings/builders.js` — `buildScoringModelCard` builder
- `js/state/apply.js` — `setSetting` action handler

## Tasks

1. Read `js/views/settings.js` — find where scoring model card is mounted and where radio `change` handlers are wired
2. Read `js/state/apply.js` — confirm `setSetting` action persists to IDB
3. Trace: does the radio `change` event dispatch `setSetting`? Does the view read from store on mount?
4. Fix the broken link (either missing dispatch or missing read-on-mount)
5. Add/update test to cover persistence
6. Commit atomically
