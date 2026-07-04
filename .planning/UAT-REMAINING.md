# UAT Remaining Issues

Phase 06 UAT — issues outstanding after T7, T11, T21 resolved.
Updated: 2026-07-05

## Functional

### T14 — Mastery badges not showing
- **Where:** Today view + Catalog
- **Symptom:** No mastery visual treatment (muted appearance, badge) on habits that meet mastery threshold
- **Fix direction:** Check mastery calculation in scoring; ensure UI renders badge when `mastered === true`
- **Action:** `/gsd-debug` — investigate mastery flag propagation from `score_snapshots` to UI badge render in Today + Catalog

### T20 — Settings panel missing from desktop sidebar
- **Where:** `desktop.html` sidebar nav
- **Symptom:** Only 3 items (Analytics, Waveboard, Planning); Settings should be 4th
- **Fix direction:** Add Settings nav item to sidebar; wire panel show/hide
- **Action:** `/gsd-quick` — add Settings nav item to `desktop.html` sidebar and wire show/hide to existing settings panel

### T23 — Waveboard data not loading + rows extremely tall
- **Where:** Waveboard panel on `desktop.html`
- **Symptom:** Heat-map grid is empty; row heights are huge (CSS sizing bug)
- **Fix direction:** Debug Waveboard data binding to `score_snapshots`; fix row height CSS
- **Action:** `/gsd-debug` — diagnose Waveboard IDB query + data-binding path; fix CSS row height separately after data is confirmed loading

## UX

### T10/T11 — Add/Edit form placement causes scroll friction
- **Where:** Catalog (mobile)
- **Symptom:** Form renders below the habit list; user must scroll up to tap Add, then back down to submit
- **Fix direction:** Move form to modal overlay or sticky top panel
- **Action:** `/gsd-quick` — refactor Catalog Add/Edit form into a modal overlay; reuse existing form fields, no logic changes

### T13a — Multi-occurrence "+" click scrolls page
- **Where:** Today view (mobile)
- **Symptom:** Each tap on the counter increment button causes slight page scroll upward
- **Fix direction:** `event.preventDefault()` on the button click handler
- **Action:** `/gsd-quick` — add `event.preventDefault()` to "+" button click handler in Today view *(group with T13b — both are multi-occurrence Today fixes)*

### T13b — Multi-occurrence habit has no strikethrough when complete
- **Where:** Today view
- **Symptom:** Completed multi-occurrence habit shows green counter but no strikethrough/muted treatment; binary habits do get strikethrough
- **Fix direction:** Apply same visual completion class to multi-occurrence rows
- **Action:** `/gsd-quick` — apply completion CSS class to multi-occurrence rows on completion; same fix pass as T13a
