# Phase 6: Desktop Analytics & Scoring Trio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 06-desktop-analytics-scoring-trio
**Areas discussed:** Scoring formulas (S1/S2/S3), Desktop navigation structure, Wave-board visualization, Planning view scope

---

## Scoring formulas (S1/S2/S3)

### S1 bucket thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold-relative: Watch = 70%, At-risk = 50%, Failing < 50% | Fixed absolute thresholds. Simple, readable. | ✓ |
| Percent-of-threshold: Watch = 0.85×, At-risk = 0.65× | Scales with global threshold. More complex. | |
| You decide | Claude picks defaults. | |

**User's choice:** Fixed absolute thresholds — Healthy ≥ global threshold (90% default), Watch 70–89%, At-risk 50–69%, Failing < 50%.

---

### S2 day-weighting formula

| Option | Description | Selected |
|--------|-------------|----------|
| 21-day half-life; stage = linear boost (1.0×/1.25×/1.5×) | Smooth 3-week recency. Linear stage multiplier. | |
| 14-day half-life; no stage weighting | Sharper recency, simpler. | |
| You decide | Claude picks formula and documents it. | ✓ |

**User's choice:** Delegated to Claude. Decision: 21-day half-life with linear stage multiplier (etap 1 = 1.0×, etap 2 = 1.25×, etap 3 = 1.5×).

---

### S3 load-adjusted formula

| Option | Description | Selected |
|--------|-------------|----------|
| S3 = completed / load-adjusted-denominator; mastered = 0.3× credit | Mastered habits auto-contribute 0.3 to numerator on applicable days. | ✓ |
| S3 = (completed + 0.3 × mastered_count) / total_applicable | Explicit additive formula. | |
| You decide | Claude uses recommended formula. | |

**User's choice:** S3 = (completed / load-adjusted-denominator) with mastered habits counted as always-completed at 0.3×, normalized to [0, 1].

---

### Snapshot write trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Write-time + Recompute: on log write + Settings action | Always current; Recompute handles bulk algorithm changes. | ✓ |
| On-demand only: Recompute is the only trigger | Simpler write path; stale analytics between runs. | |
| Lazy: write on first read if missing/stale | Complex read path. | |

**User's choice:** Write-time (on every log write, recompute affected habit's rolling-window snapshot across all 3 models) + "Recompute scores" Settings action for bulk re-run.

---

### Score output shape

| Option | Description | Selected |
|--------|-------------|----------|
| All 3 produce per-habit + wave aggregate | Consistent output shape for all 3 models. | ✓ |
| S1 = per-habit only; S2/S3 = wave aggregate only | Different mental models per model. | |

**User's choice:** All 3 models produce both per-habit scores AND wave-level aggregates.

---

## Desktop navigation structure

### Navigation pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + hash-routed panels | Reuses router.js pattern. `<section data-route>` panels. | ✓ |
| Top tab bar | Diverges from mobile pattern; simpler CSS. | |
| Single scrollable page | No routing needed; very long page. | |

**User's choice:** Sidebar with hash-routed panels (#analytics, #waveboard, #planning).

---

### Analytics view layout

| Option | Description | Selected |
|--------|-------------|----------|
| Waves first: wave cards with expandable habit rows | Wave-centric; matches the user's existing mental model. | |
| Habits first: flat list grouped by wave | Every habit visible immediately; good for cross-wave scanning. | ✓ |
| You decide | Wave-centric expandable rows. | |

**User's choice:** Flat list of all habits grouped by wave. Wave name as group header row.

---

### Per-habit columns in Analytics

| Column | Selected |
|--------|----------|
| Current stage (e.g., Etap 2) | ✓ |
| Rolling % + S1 status badge | ✓ |
| Mastery status badge | ✓ |
| S2/S3 numeric score (active model) | ✓ |

**User's choice:** All four columns.

---

### Model switch UX

| Option | Description | Selected |
|--------|-------------|----------|
| Reactive update (no reload) | store.notify() → desktop views re-render. | ✓ |
| Reload on switch | Explicitly forbidden by SCORING-03. | |

**User's choice:** Reactive update (SCORING-03 requirement confirmed).

---

## Wave-board visualization

### Primary structure

| Option | Description | Selected |
|--------|-------------|----------|
| Habit rows × time columns (heat-map grid) | X-axis = time, Y-axis = habits. Like GitHub contributions. | ✓ |
| Wave-centric status board | One card per wave, no time axis. | |
| Gantt-style bars by stage | Habit timelines, colored by stage. No completion data. | |

**User's choice:** Heat-map grid — habit rows × week columns.

---

### Time unit and default window

| Option | Description | Selected |
|--------|-------------|----------|
| Week columns, last 12 weeks (scrollable) | 780 cells on screen; manageable. | ✓ |
| Day columns, last 30 days | 1950 cells; denser, harder to read. | |
| Month columns, full year | Too coarse for daily tracking. | |

**User's choice:** Week columns, last 12 weeks by default, scrollable to full history.

---

### Cell color encoding

| Option | Description | Selected |
|--------|-------------|----------|
| S1 status colors (green/yellow/orange/red) | Consistent with Analytics view; model-tied. | ✓ |
| Completion rate gradient (continuous 0–100%) | Model-agnostic; more granular. | |
| You decide | S1 status colors. | |

**User's choice:** S1 status colors — Healthy = green, Watch = yellow, At-risk = orange, Failing = red, N/A = grey.

---

### Archived habits

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden by default, toggle to show | Cleaner board; toggle reveals greyed-out rows. | ✓ |
| Always shown, greyed out | Full history always visible; more visual noise. | |

**User's choice:** Hidden by default. "Show archived" toggle reveals greyed-out rows.

---

## Planning view scope

### Primary job of Planning view

| Option | Description | Selected |
|--------|-------------|----------|
| Wave-capacity calendar (forward-looking, read-only) | Shows which habits start each week; Catalog handles CRUD. | ✓ |
| Habit scheduling form (desktop-optimized Catalog) | Redundant with Catalog; just a wider form. | |
| You decide | Wave-capacity calendar. | |

**User's choice:** Wave-capacity calendar — forward-looking week grid showing when each wave starts and which habits begin each week. Read-only; click through to Catalog to edit.

---

### Planning view editability

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only: click to open Catalog | Simple; Catalog already handles edits. | ✓ |
| Editable: drag habit to reschedule | Significant implementation cost; drag-and-drop. | |

**User's choice:** Read-only.

---

### Planning view default window

| Option | Description | Selected |
|--------|-------------|----------|
| Next 12 weeks (3 months), scrollable | Consistent with wave-board window. | ✓ |
| Full remaining wave timeline (through week 47) | Dense; 30+ weeks at once. | |
| Next 4 weeks, scrollable | Too narrow for 2-month planning. | |

**User's choice:** Next 12 weeks by default, scrollable forward.

---

## Claude's Discretion

- **S2 formula details** — user delegated. Claude will use 21-day half-life + linear stage multiplier (etap 1 = 1.0×, etap 2 = 1.25×, etap 3 = 1.5×). Researcher can propose alternatives.
- **S2 wave-level aggregation** — simple mean of per-habit S2 scores. Researcher may propose weighted mean.

## Deferred Ideas

- Drag-and-drop habit rescheduling in Planning view — significant implementation cost; Catalog handles edits
- S2/S3 score display on wave-board cells (beyond Analytics view) — deferred to post-v1
- Analytics chart/trend views (line charts of rolling % over time) — post-v1
- Habit correlation analysis (ANA-02) — explicitly post-v1 per REQUIREMENTS.md
