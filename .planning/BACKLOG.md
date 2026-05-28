# Backlog

Ideas captured during phase work for consideration in future milestones. Not commitments.

---

## Post-v1 explorations

### Install card: predict-and-override platform switch

**Source:** UAT Phase 3 Test 14 (2026-05-28, lukasz.bielinski).

**Idea:** Replace the current "show all three labeled subsections" Install card with a predicted-platform-first card (e.g. show iOS instructions on Safari/iOS UA) + an override control to flip to Android Chrome / Desktop browsers.

**Current (locked, D-61 + 03-DISCUSSION-LOG.md Q3):** All three subsections render simultaneously with no detection. User explicitly chose this over "Feature-test first, UA as fallback" or "UA-only switch" during Phase 2 questioning.

**When to revisit:** If Install help grows so long it becomes hard to scan, or if there's evidence users scroll past the wrong-platform sections. For v1 there's no signal in either direction.

**Cost of switching:**
- Add UA detection (`navigator.userAgent`) or persistent platform setting in IDB.
- Add a 3-segment toggle / radio for override.
- New IDB key for the override (or live in `settings` store).
- Risk: detection drift (every new device/browser breaks the guess).

**Cost of staying:** A few extra inches of vertical scroll on the Install card — only encountered when consulting install help, which is once-per-device.

**Disposition:** Park for post-v1. Revisit if a user complaint or instrumentation signal surfaces.
