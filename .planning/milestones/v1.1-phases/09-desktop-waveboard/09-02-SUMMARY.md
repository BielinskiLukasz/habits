---
plan: 09-02
status: complete
completed_at: 2026-08-25T00:00:00Z
commits:
  - 24142e8 feat(09-02): wire mountWavePlanning into desktop waveboard shell
  - 5833e8a style(09-02): add waveplanning CSS classes to desktop.css
---

# Summary

## Task 1 — Wire mountWavePlanning into desktop waveboard shell

Added `mountWavePlanning(parent, { repo, store })` as a second named export to
`js/views/desktop/wavePlanning.js`. The function:

- Uses an idempotency guard via `parent.dataset.wavePlanningMounted`
- Attaches delegated accordion click listener once (no re-attach per rerender)
- Attaches delegated promote listener once with error recovery UI
- Saves/restores per-wave expanded state across rerenders (no flicker)
- Calls `repo.getSnapshotsInRange` for last 7 days and builds `snapshotsByWeek`
- Subscribes to `store.subscribe` for reactive re-renders on data changes
- Fires initial `rerenderSection()` fire-and-forget

Added imports to `wavePlanning.js`:
- `isoWeekKey` added to the existing `waveboard.js` import
- `apply` from `../../state/apply.js`
- `getCachedHabits` from `../../state/store.js`
- `getAllWaves` from `../../domain/wave.js`
- `todayLocal` from `../../util/date.js`
- `mount` from `../../util/mount.js`

Wired into `js/views/desktop/waveboard.js`:
- Added `import { mountWavePlanning } from './wavePlanning.js'`
- Added `mountWavePlanning(parent, { repo, store })` call immediately after the
  waveboard idempotency guard (before toggleLabel creation)

## Task 2 — CSS waveplanning-* classes

Appended 36 `.waveplanning-*` class rules inside the `@layer desktop-scoring`
block in `css/desktop.css`. Covers accordion layout, wave header, chevron,
badge variants (healthy/watch/atrisk/failing/na/upcoming), habit rows,
scheduled rows, promote button states (hover, focus-visible, disabled),
heatmap separator, and error span.

## Verification

- `grep -c 'mountWavePlanning' js/views/desktop/waveboard.js` → 2 (import + call)
- `grep -c 'store\.subscribe' js/views/desktop/wavePlanning.js` → 1
- discipline.xss test: PASS (innerHTML only in JSDoc comment, stripped by test)
- `grep -c '\.waveplanning-' css/desktop.css` → 35 (exceeds minimum 20)
- All unit tests: 7 wavePlanning + 1 discipline = 8 passing, 0 failures
