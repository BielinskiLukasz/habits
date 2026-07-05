# UAT Remaining Issues

Phase 06 UAT — issues outstanding after T7, T11, T21 resolved.
Updated: 2026-07-05

## Functional

### T23 — Waveboard data not loading + rows extremely tall
- **Where:** Waveboard panel on `desktop.html`
- **Symptom:** Heat-map grid is empty; row heights are huge (CSS sizing bug)
- **Fix direction:** Debug Waveboard data binding to `score_snapshots`; fix row height CSS
- **Action:** `/gsd-debug` — diagnose Waveboard IDB query + data-binding path; fix CSS row height separately after data is confirmed loading
