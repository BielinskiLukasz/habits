---
status: complete
phase: 03-today-view-settings-v1-first-usable-slice
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-SUMMARY.md
  - 03-04-SUMMARY.md
  - 03-05-SUMMARY.md
  - 03-06-SUMMARY.md
started: 2026-05-28T19:47:31Z
updated: 2026-05-29T08:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Close all open tabs. Open `index.html` in Firefox via `file://` (or `node scripts/serve.js` + `http://localhost:8080/` in Chromium). Today mounts immediately with the seed's 8 habits visible (after cadence filtering); no spinner, no blank panel, no console errors during boot.
result: pass
notes: User initially observed 7 of 8 habits visible — clarified that "Strength training (M/W/F)" is correctly cadence-excluded on Thursday 2026-05-28. Confirmed expected behavior.

### 2. Today header shows date and wave
expected: Today view header renders today's date in `'Wed 28 May'` short format and the wave label `'Wave 4'` (Wave 4 startDate is 2026-04-27, so 2026-05-28 falls inside it).
result: pass

### 3. Today list is filtered by cadence rules
expected: From the 8 seeded habits, daily habits show every day, weekly habits appear until completed within the current ISO week, and every-N-days habits appear when the anchor (`lastCompletedDate` or `createdAt`) is at least N days old. Completed rows sort to the bottom.
result: pass

### 4. Tap to mark a habit complete
expected: Tap an uncompleted habit row. The row instantly shows the ✓ glyph, strikethrough on the name, and 0.55 opacity. `aria-pressed` flips to `true`. The flip happens before any network/DB latency (optimistic).
result: pass

### 5. Tap to unmark a completed habit
expected: Tap a completed habit row. The row reverts: ✓ glyph removed, strikethrough cleared, opacity restored. `aria-pressed` flips back to `false`. Symmetric inverse of marking.
result: pass

### 6. Undo toast appears and restores prior state
expected: After marking or unmarking, an Undo toast appears at the bottom of the screen with a 5-second auto-dismiss. Clicking Undo restores the row's previous state (mark-undo = unmark; unmark-undo = remark).
result: pass

### 7. Undo persists across a full page reload
expected: Mark a habit. Reload the page (Ctrl+R / Cmd+R). Open Settings → Data card. The "Undo last action" button is ENABLED and shows the most recent event with a relative timestamp. Clicking it reverts the mark.
result: issue
reported: "yes but I still see description of last action and undo last action in settings. I think it shouldn't be visible/clickable after I press undo (I cannot undo it multiple times). Also undo last action and reset data are so close to each other, i think it should be different."
severity: major
notes: Core flow works (button enabled after reload, click reverts the mark — confirmed by 'yes'). Two follow-on findings: (1) after pressing Undo, the Data card still shows 'Last: marked Drink water (1.5L) complete · just now' and the Undo button stays enabled — user reads single-step undo as 'should hide after use'; current design replaces token with inverse event id but visible label appears stale or never refreshed. (2) Undo and destructive Reset data buttons render too close together — visual proximity is a footgun.

### 8. Hash routing and deep-link fallback
expected: `index.html#settings` deep-links to the Settings panel. `index.html#history` deep-links to the History placeholder. `index.html#unknown` falls back to Today (allowlist resolution). Footer-nav `aria-current="page"` follows the active route.
result: pass

### 9. History link disabled in footer nav
expected: The `history` link in the footer-nav is visually muted (opacity 0.4) and not clickable from within the app (`aria-disabled="true"`). It only opens via direct URL.
result: pass

### 10. Long-press diagnostics on the title
expected: Press and hold the `Habits` title for ~1.5 seconds. A diagnostics panel opens (seed counts, cache snapshot, etc.). Works across route round-trips (re-binds on every Today mount).
result: issue
reported: "Diagnostics panel opens correctly (gesture works), but two fields show stale 'n/a (P2)' placeholders that should now have real values: 'Schema version' (live since P2 via db/idb.js schema constant) and 'Persistence' (live since P3 via navigator.storage.persisted())."
severity: minor
notes: User confirmed gesture + panel mount works. Filed as minor follow-up at user's request — diagnostics panel was authored in P1 and not updated when P2/P3 added the underlying data sources.

### 11. Settings shows 5 cards in locked D-61 order
expected: Settings panel displays exactly 5 cards top-to-bottom: Storage, Schedule, Install, Data, About.
result: pass

### 12. Settings Storage card shows persistence status
expected: Storage card shows a `<dt>Persistent</dt><dd>` row that initially reads `loading…` and then resolves to `yes` or `no`. Below it: storage quota estimate (used / total).
result: pass
notes: Confirmed values — `Persistent: no` (browser did not grant persist on file://) + `Storage: Using 0.3 MB of ~10738 MB`. Side-finding logged separately as a cosmetic gap: Settings h1 has no left padding/margin while Today header h1 has 16px padding.

### 13. Settings About card shows v0.3.0
expected: About card lists four rows: appVersion = `0.3.0`, schemaVersion (numeric), cacheName = `habits-0.3.0`, swState = `activated` / `controlled` / `unregistered` depending on context.
result: pass
notes: Confirmed values — App version 0.3.0, Schema version 1, Cache name habits-0.3.0, Service worker controlled.

### 14. Settings Install card shows all three platforms
expected: Install card has three labeled subsections — iOS Safari, Android Chrome, Desktop browsers — all visible simultaneously with concrete instructions for each. No platform auto-detection (user-approved deviation, see 03-DISCUSSION-LOG.md Q3).
result: pass
notes: All three subsections render with H3 headings (iOS Safari, Android Chrome, Desktop browsers) and concrete instructions. Matches D-61 + 03-DISCUSSION-LOG Q3 locked decision.

### 15. Settings Schedule card week-start radio works
expected: Schedule card shows two radio options (`Monday` / `Sunday`). Selecting one persists through apply's `setSetting` chokepoint and is reflected on next reload.
result: pass
notes: Radio toggles correctly, persists, and Undo flips it back (D-75 self-inverting setSetting confirmed). Same Data card label staleness observed as in Test 7 — label still reads "Last: marked (habit) complete" after a setSetting action; folded into the test-7 gap rather than a new gap.

### 16. Cold-paint < 300 ms (NFR-01) — perceived
expected: On a mid-range mobile device, force-quit the PWA and re-open from the home-screen tile. First Today paint feels under 300 ms — instant from tap to visible content.
result: skipped
reason: Requires PWA installed on a real mobile device — deferred to a later device-on-hand session. Structural enablers already verified (single bounded read; no spinners; synchronous render path — see 03-VERIFICATION.md NFR-01).

### 17. First-tap latency < 100 ms (NFR-02) — perceived
expected: On a real touch device, tap an uncompleted row. The visible flip (✓ glyph + strikethrough + opacity) happens within 100 ms of finger contact — feels instant, no perceived lag.
result: skipped
reason: Requires a real touch device — deferred to a later device-on-hand session. Structural enabler already verified (optimisticFlip is synchronous before await apply — see 03-VERIFICATION.md NFR-02).

### 18. Visual + screen-reader accessibility pass (NFR-07)
expected: Every state change pairs a non-color cue: ✓ glyph + strikethrough + aria-pressed on rows, boldface + aria-current on active nav, opacity 0.4 + aria-disabled on history link. With VoiceOver / NVDA / TalkBack, completed rows are announced as "pressed"; active footer link is announced as "current". Keyboard tab order through Settings is sensible.
result: pass
partial: screen-reader-axis
reason: Visual non-color cues confirmed ✓. Keyboard tab order through Settings sensible ✓. Screen-reader axis NOT actually tested — user tried Edge 'Read aloud this page' which is TTS (reads visible text), not a screen reader (Edge Read Aloud does not consume aria-pressed / aria-current / aria-disabled). A real SR test with NVDA / VoiceOver / TalkBack is still needed to fully close NFR-07. Structural attributes already verified present in 03-VERIFICATION.md.
follow_up: "Run NVDA (free, Windows) on Today and Settings; confirm completed rows announce 'pressed' and active footer link announces 'current page'."

### 19. SW update toast on 0.2.0 → 0.3.0 + offline reload
expected: With a tab still on v0.2.0 cached, deploy / load v0.3.0 → the D-08 update toast appears (no auto-dismiss) prompting reload. After update, the `habits-0.3.0` cache is active and `habits-0.2.0` is deleted. With network disabled, reload still mounts the Today view (offline SHELL coverage).
result: pass
partial: offline-reload-axis
reason: Part A confirmed — D-08 update toast appeared on v0.2.0 tab and reload activated habits-0.3.0 with habits-0.2.0 deletion. Part B (offline reload via DevTools Offline / network disconnect) deferred to next-phase UAT pass alongside other deferred items (tests 16, 17, 18-SR).
follow_up: "Re-run Part B (network disabled → reload still mounts Today) in the next-phase device/SR UAT session."

## Summary

total: 19
passed: 15
issues: 2
pending: 0
skipped: 2
blocked: 0
gaps_logged: 5
follow_ups: 3   # 18 (NFR-07 SR), 19 (Part B offline reload), 16+17 (NFR-01/02 device-on-hand) — all deferred to next-phase UAT session by user request

## Gaps

- truth: "Settings Data card 'Last: ...' label reflects the actual event type (mark / unmark / setSetting / undo) and refreshes after the user acts; the Undo button shows the new top event after an undo lands."
  status: failed
  reason: "User reported on test 7: 'I still see description of last action and undo last action in settings. I think it shouldn't be visible/clickable after I press undo (I cannot undo it multiple times).' Reproduced again on test 15: 'something strange happening with last action log. Now it's display Last: marked (habit) complete · just now and undo revert settings (when I click it multiple times it switch between monday and sunday).' Symptoms: (a) the human-readable 'Last: marked X complete' template is rendered for setSetting events too, so the label is wrong after a Schedule radio change; (b) after pressing Undo, the label does not visibly update to point at the new top (inverse) event."
  severity: major
  test: 7
  also_seen_in_test: 15
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Destructive 'Reset data' button is visually separated from the routine 'Undo last action' button so the user cannot mistakenly tap one for the other."
  status: failed
  reason: "User reported: 'undo last action and reset data are so close to each other, i think it should be different.' DOM shows .settings-data-undo and .settings-card--destructive blocks rendered adjacently inside the same Data card with no spacer or visual demarcation."
  severity: cosmetic
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Diagnostics panel surfaces live values for fields whose data source exists, including Schema version (live since P2) and Persistence (live since P3)."
  status: failed
  reason: "User observed two stale 'n/a (P2)' placeholders in the diagnostics panel for fields whose backing data sources have shipped: Schema version (db/idb.js schema constant added P2) and Persistence (navigator.storage.persisted() consumed by Settings since P3). Panel DOM: `<dt>Schema version</dt><dd>n/a (P2)</dd>` and `<dt>Persistence</dt><dd>n/a (P2)</dd>`."
  severity: minor
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Route panel headers share consistent horizontal padding so the h1 visually aligns across Today, Settings, and History."
  status: failed
  reason: "User reported: 'When I switch to settings instead of Habits (today) I lost left title margin.' Today h1 sits inside `.today-header` with 16px padding; Settings h1 (`<h1 tabindex=\"-1\">Settings</h1>`) renders with 0 padding/margin, so the title flush-lefts against the viewport edge."
  severity: cosmetic
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Habits completed today remain visible on the Today list (sorted to the bottom with the ✓ glyph) for the rest of the calendar day, regardless of cadence type, so the user can see what they've already done today."
  status: failed
  reason: "User reported: 'when I set as complete habits like morning walk or drink water it appears as complete with tick. But if I complete 7 meatless meals, weekly grocery run or shower then it disappears.' Verified against seed: Morning walk + Drink water are `daily binary` (stay visible because cadence still applies tomorrow). Weekly grocery run is `weekly binary`, Shower is `every-n-days n=2 binary`, 7 meatless meals is `weekly slot-checklist` — all three return false from `appliesToday` after their completion is recorded for the current ISO week / N-day window, so the row falls out of the list immediately. Spec-correct per cadence.js but the UX is jarring: same-day completion drops the visual confirmation. Expectation: filter `appliesToday(today) || completedToday(habit)` instead of just `appliesToday(today)`, so completed-today rows persist on Today until midnight."
  severity: major
  test: 15
  root_cause: ""
  artifacts:
    - path: "js/views/today.js"
      issue: "mountToday filter passes habits through appliesToday only; no OR-completed-today clause"
    - path: "js/domain/cadence.js"
      issue: "appliesToday() is the canonical filter — may need a sibling helper or a flag on appliesToday"
  missing:
    - "Add 'completed today' fallback to the Today filter so weekly + every-n-days + slot-checklist rows persist on the same calendar day they were completed"
    - "Confirm sort-completed-last (D-54) still applies to the fallback set"
  debug_session: ""
