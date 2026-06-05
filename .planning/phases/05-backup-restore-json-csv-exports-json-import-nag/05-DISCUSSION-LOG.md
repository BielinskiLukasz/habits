# Phase 5: Backup & Restore - Discussion Log

**Date:** 2026-06-05  
**Participants:** User (Lukasz Bielinski), Claude (Haiku 4.5)

---

## Summary

Gathered implementation decisions for Phase 5 (JSON + CSV exports, JSON import, backup nag). All 8 gray areas were discussed and locked. User prioritized non-intrusive backup reminders and emphasized keeping daily check-in friction-free.

---

## Gray Areas Discussed

### 1. CSV Date Range (EXPORT-03, EXPORT-07)

**Question:** Should CSV export include a date-range picker, or always export full span (earliest to today)?

**Options Considered:**
- Always full span (simplest; user filters in Excel)
- Optional date-range picker (v1 scope; power-user feature)
- Both: default full span + optional picker

**Decision:** `Optional date-range picker (v1 scope)` ✓

**Rationale:** User wants to preserve the ability to export custom date ranges without cluttering the default one-click export. Collapsible UI keeps simple case simple while offering power-user control.

**Impact:** CSV export UI must include a collapsible "Custom date range" section with two date pickers (From / To). Default behavior: export all data. When expanded: respect user-selected range.

---

### 2. Backup Nag UI Placement & Behavior (EXPORT-08)

**Question:** Where and how should the weekly backup reminder appear?

**Options Considered:**
- Dismissible banner in Settings Data card (prominent, non-intrusive)
- Toast on app open (catches attention but interrupts daily check-in flow)
- Persistent card in Settings (non-dismissible, always visible)

**Decision:** `Dismissible banner in Settings Data card` ✓

**Rationale:** Respects the core constraint (friction-free daily check-in). User goes to Settings when they're ready to export anyway. Banner is glanceable and dismissible, avoiding nag fatigue.

**Impact:** Add a yellow/warning banner to the Data card (conditional: only appears if ≥ 7 days since last export). Banner text: `"Last backup: {N} days ago. Export your data now."` with a `[×]` dismiss button. Dismissal state persists in localStorage until 7 more days pass or user exports.

---

### 3. Last Backup Timestamp Storage (SETTINGS-03, EXPORT-01)

**Question:** How should `"Last backup: N days ago"` be stored and updated?

**Options Considered:**
- App-tracked in IDB `settings` store (durable, survives resets)
- Derived from file metadata on import (simpler, no extra IDB writes)
- Hybrid: IDB primary + file metadata fallback

**Decision:** `IDB + fallback to file metadata` ✓

**Rationale:** Primary source of truth in IDB (`{key: 'lastBackupDate', value: 'YYYY-MM-DD'}`) ensures robust tracking. Fallback to imported file headers (if they contain timestamps) handles edge cases like fresh installs or reset-app scenarios.

**Impact:** On every export (JSON or CSV), write to IDB. On import, parse the file's `schemaVersion` field for a creation timestamp if available. Display logic: calculate `days = today - lastBackupDate` and show `"N days ago"`.

---

### 4. Multi-Occurrence Habits in CSV (EXPORT-06)

**Question:** How should numeric +1 counter and slot-checklist habits be encoded in CSV cells?

**Options Considered:**
- Numeric count (3, 7, etc.; simple, Excel-friendly)
- Count with target notation (3/7; more context, harder to chart)
- Binary 1/0 (normalized, loses granularity)

**Decision:** `Numeric count (3, 7, etc.)` ✓

**Rationale:** Matches ROADMAP spec ("use the raw count"). Excel-friendly and preserves progress information (e.g., `3` shows the user got 3/7 meals even if not completed). Consistent with the principle that CSV is for analysis, not just completion tracking.

**Impact:** For numeric habits: export the raw count (e.g., `5` for "5 cups water"). For slot-checklist habits: export the number of filled slots (e.g., `3` for "3 / 7 meals"). Partial completion (count < target) still counts as incomplete in mastery math but shows the raw count in CSV.

---

### 5. JSON Export Filename (EXPORT-01, EXPORT-07)

**Question:** What filename pattern should JSON export use?

**Options Considered:**
- `habits-backup-YYYY-MM-DD.json` (mirrors CSV naming)
- `habits-YYYY-MM-DD.json` (shorter, still clear)
- `nawyki-backup-YYYY-MM-DD.json` (uses original Polish name, breaks D-30 namespace)

**Decision:** `habits-YYYY-MM-DD.json` ✓

**Rationale:** Shorter than `-backup-` variant, still unambiguous. Aligns with D-30 namespace decision (all exports use `habits-` prefix). Consistent with CSV naming philosophy (date is export date, not creation date).

**Impact:** JSON export downloads as `habits-YYYY-MM-DD.json` where date is the export date.

---

### 6. CSV Row Ordering Within Waves (EXPORT-03)

**Question:** Within each wave, should habit rows be ordered alphabetically or by creation date?

**Options Considered:**
- Alphabetical by habit name (easy to search, predictable)
- By creation date / order (reflects progression, harder to search)

**Decision:** `Alphabetical by habit name` ✓

**Rationale:** User primarily interacts with habits by name in Excel. Alphabetical ordering makes it easy to find a specific habit in a CSV with 60+ habits. Creation date ordering would be harder to navigate.

**Impact:** CSV rows are grouped by wave (Fala 0 → Fala 9) in numeric order, then within each wave sorted alphabetically by habit name (English name used for sorting).

---

### 7. Habits with Future startDate in CSV (EXPORT-03)

**Question:** How should habits with a future `startDate` (not yet started) appear in the CSV?

**Options Considered:**
- Include with all `x` (not applicable until startDate) — shows full plan
- Exclude entirely — cleaner CSV, less clutter

**Decision:** `Include with all 'x' (not applicable until startDate)` ✓

**Rationale:** User may want to see the full planned habit timeline in Excel, even if the habit hasn't started yet. Provides context for planning and analytics. `x` clearly marks "not applicable yet".

**Impact:** Future-startDate habits appear as rows in the CSV. All columns before the `startDate` show `x`. From `startDate` onward, real completion data appears.

---

### 8. Archived Habits in CSV (EXPORT-03)

**Question:** Should archived habits be included in the CSV export?

**Options Considered:**
- Include with all `x` after archive date (full history, shows when archived)
- Include with all data (archived status not marked, user can filter in Excel)
- Exclude entirely (cleaner, archived = historical)

**Decision:** `Include with all 'x' after archive date` ✓

**Rationale:** Preserves complete historical record. User can see when and how long a habit was active, and can analyze completion patterns even for deprecated habits. `x` after archive date clearly marks "not applicable anymore".

**Impact:** Archived habits appear as rows in the CSV with real data up to the day they were archived, then `x` for all subsequent dates.

---

## Key Themes

1. **Friction-free daily check-in is non-negotiable** — User explicitly chose the Settings banner (not a toast on app open) to protect the daily check-in from interruption. This reinforces the core value stated in PROJECT.md.

2. **Full historical record preferred** — User chose to include future-startDate and archived habits in the CSV (with appropriate `x` marking) rather than exclude them. This suggests a preference for completeness and auditability over simplicity.

3. **Namespace consistency** — All decisions align with D-30 (the `habits-` prefix across manifest, IDB DB name, BroadcastChannel, and now export filenames).

4. **Excel as a first-class analysis tool** — User prioritized Polish Windows Excel rendering (BOM, semicolon delimiter, CRLF, numeric encoding) over internal app dashboards. CSV is the primary analytics export; desktop scoring views (P6) will be secondary.

---

## Blocked / Deferred Items

**CSV date-range UI construction:** Exact HTML/CSS layout of the collapsible date-range picker deferred to planner (whether it's a `<details>` element, inline toggle, separate card, etc.). Functional spec is locked; UI details are implementation choice.

**File upload / import UX:** Exact UI for the JSON import file picker deferred to planner (button + `<input type="file">`, or a dedicated import panel, etc.). Functional spec is locked.

**Nag dismissal UX:** Exact behavior of the dismissal button and localStorage key for tracking dismissal state deferred to planner. Functional spec is locked: dismiss until 7 days pass OR user exports.

---

## Decision Precedents Carried Forward

- **D-30 (Namespace):** All exports use `habits-` prefix, not `nawyki-`.
- **D-35 (English UI primary):** CSV rows use English habit names for alphabetical sorting.
- **D-39 (IDB schema):** All 7 stores are exported in JSON full-fidelity.
- **History integrity rule:** Archived and past-startDate habits are tracked in logs; CSV reflects historical truth.

---

## Next Steps (Planning)

1. **gsd-planner** reads this CONTEXT.md and 05-REQUIREMENTS.md to derive task breakdown
2. Plans will specify:
   - CSV generation logic (grouping, filtering, encoding rules)
   - JSON export/import handler implementation
   - Settings Data card extension (builders + mount wiring)
   - Backup nag state machine (dismissal, localStorage, display logic)
3. Each plan will verify the success criteria from ROADMAP.md:
   - JSON round-trips byte-for-byte
   - CSV renders in Polish Windows Excel
   - Import rejects newer schemaVersion
   - Cross-tab reload on import
   - "Last backup: N days ago" + weekly nag functional

