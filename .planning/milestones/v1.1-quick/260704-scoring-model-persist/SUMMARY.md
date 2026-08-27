---
quick_id: 260704-scoring-model-persist
status: complete
date: 2026-07-04
commit: 60e4a73
---

# Quick Task 260704-scoring-model-persist: Summary

## What was done

Fixed scoring model selection (S1/S2/S3 radio buttons in Settings) not persisting across navigation.

Root cause: `store.js` `hydrate()` loaded `habits`, `logs`, and `settings` keys but did not include `scoringModel` in the hydrated settings slice. On Settings re-mount, `getCachedSettings()` returned the default (S1) instead of the persisted value.

Fix: extended `hydrate()` to include `scoringModel` in the settings cache, and added a dedicated `getCachedScoringModel()` selector used by the Settings view on mount.

## Files changed

- `js/state/store.js` — hydrate scoringModel into settings cache
- `tests/unit/store.hydrate.test.js` — tests for scoringModel persistence across navigation

## Commit

`60e4a73` — fix(settings): persist scoring model selection across navigation (UAT-T7)
