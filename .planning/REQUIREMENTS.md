# Requirements: Nawyki

**Defined:** 2026-05-26
**Core Value:** Daily check-in must be friction-free, and the system's existing model (waves, stages, multi-occurrence, threshold-based graduation) must be honored exactly as the user already practices it.

## v1 Requirements

Requirements for initial release. Each maps to exactly one roadmap phase (see Traceability).

### CORE — Today view (mobile primary)

- [x] **CORE-01**: User can open `index.html` on mobile and see today's scheduled habits without delay (cold paint < 300 ms)
- [x] **CORE-02**: User can mark a habit complete with a single tap (binary habits)
- [x] **CORE-03**: User can unmark a previously-completed habit with a single tap
- [x] **CORE-04**: User can see, on Today, only the habits whose cadence rules say they apply today
- [x] **CORE-05**: User sees today's date and current wave context displayed on Today
- [x] **CORE-06**: Today view renders synchronously from a cached snapshot (no spinner-blocked first paint)

### CATALOG — Habit definitions (desktop primary)

- [x] **CATALOG-01**: User can create a new habit with: name, wave, cadence rule, target type (binary / numeric / slot-checklist), stage definitions
- [x] **CATALOG-02**: User can edit an existing habit's definition (name, target, cadence, stages)
- [x] **CATALOG-03**: Editing a habit creates a new `habit_versions` entry; the prior version remains accessible to historical log evaluation
- [x] **CATALOG-04**: User can view the full edit history of any habit (when it changed, what changed)
- [x] **CATALOG-05**: User can archive a habit (stops appearing on Today; history preserved)
- [x] **CATALOG-06**: User can restore an archived habit
- [x] **CATALOG-07**: User can plan a new habit with a future `startDate` (e.g., "starts in 3 weeks") — habit only appears on Today from `startDate` forward

### CADENCE — Schedule rules

- [x] **CADENCE-01**: User can set a habit to daily cadence
- [x] **CADENCE-02**: User can set a habit to weekly cadence (1 occurrence required per week)
- [x] **CADENCE-03**: User can set a habit to monthly cadence
- [x] **CADENCE-04**: User can set a habit to "every N days" cadence (e.g., "Prysznic co 2 dni")
- [x] **CADENCE-05**: User can restrict a habit to specific days of the week (Mon-Fri, weekends-only, single day, arbitrary subset)
- [x] **CADENCE-06**: Cadence engine correctly identifies "is this habit applicable today?" given any combination of rules
- [x] **CADENCE-07**: Cadence engine handles DST transitions, leap days, and month-end edge cases correctly

### STAGE — Progressive targets

- [x] **STAGE-01**: A habit can declare ordered stages (etap 1, etap 2, etap 3), each with its own target value
- [x] **STAGE-02**: User can view the current stage of any habit
- [x] **STAGE-03**: Stage advancement supports a "manual button" trigger (user presses "Advance stage" when ready)
- [x] **STAGE-04**: Stage advancement supports a "scheduled by week" trigger (auto-advance when calendar week N reached)
- [x] **STAGE-05**: Stage advancement supports an "after N days at current stage" trigger (user-defined N per habit)
- [x] **STAGE-06**: A single habit can compose multiple stage triggers — any one firing advances the stage
- [x] **STAGE-07**: Manual stage demotion is supported (user can step back to a prior stage)

### MASTERY — Threshold-based graduation

- [x] **MASTERY-01**: Default mastery threshold is 90% completion over rolling 70 days, configurable globally in Settings
- [x] **MASTERY-02**: Per-habit threshold and window can override the global defaults
- [x] **MASTERY-03**: A habit that meets its threshold over its window is displayed with a "mastered" visual treatment (muted style + badge), still visible on Today
- [x] **MASTERY-04**: A mastered habit that drops below its threshold reverts visual treatment (loses badge); no destructive state change
- [x] **MASTERY-05**: Mastery is evaluated using cadence-aware denominator (non-applicable days don't count)
- [x] **MASTERY-06**: New habits enter a 7-day grace period during which rolling stats are not surfaced
- [x] **MASTERY-07**: Mastery is recomputed write-time (when a log change affects the rolling window), not on every render

### LOG — Multi-occurrence logging

- [x] **LOG-01**: User can configure a habit's logging UX as "binary" (single check)
- [x] **LOG-02**: User can configure a habit's logging UX as "numeric +1 counter" (e.g., "5 things grateful for", "2L water")
- [x] **LOG-03**: User can configure a habit's logging UX as "slot-checklist" (e.g., "7 meatless meals/week")
- [x] **LOG-04**: For slot-checklist habits, user can choose anonymous slots OR user-labeled slots per habit
- [x] **LOG-05**: Multi-occurrence habits show progress toward target (e.g., "3 / 7 meals")
- [x] **LOG-06**: Multi-occurrence habits count as "completed for the period" only when target is reached

### HISTORY — Past-day navigation and edits

- [x] **HISTORY-01**: User can navigate to any past day from a history view
- [x] **HISTORY-02**: User can see, for any past day, the full list of habits that applied that day (per their cadence at that time)
- [x] **HISTORY-03**: User can mark a habit as not-completed on a past day
- [x] **HISTORY-04**: User can bulk-action "mark all not-yet-completed habits as uncompleted" on a given past day
- [x] **HISTORY-05**: Partial multi-occurrence completions are preserved as logged counts; rolling-window math treats "below target" as "not completed for the period"
- [x] **HISTORY-06**: Logs for any past day are interpreted against the `habit_versions` entry that was effective on that day (not the current definition)

### WAVE — Fala model and aggregates

- [x] **WAVE-01**: Each habit belongs to exactly one wave (Fala 0–9 seeded, future waves user-extendable)
- [x] **WAVE-02**: Waves have a name, a date range (start week, end week), and a theme description
- [x] **WAVE-03**: User can view aggregate metrics per wave: completion %, count of habits by status (active / mastered / archived)
- [x] **WAVE-04**: User can view "longest active wave streak" (consecutive days where ≥ X% of the wave's applicable habits were completed)
- [x] **WAVE-05**: User can see a "wave at risk" indicator when a configurable fraction of habits in a wave is slipping
- [x] **WAVE-06**: User can extend the wave model beyond 2026 (define a 2027 wave plan)

### UNDO — Single-step undo

- [x] **UNDO-01**: User can undo the last mutating action (mark complete, mark uncomplete, edit habit, advance stage, …) within one tap from a toast OR from a Settings shortcut
- [x] **UNDO-02**: Undo state persists across page reload (via `meta.undoToken` in IndexedDB)
- [x] **UNDO-03**: Undo is single-step (one action back); deeper history is via per-habit edit history (CATALOG-04) and the events journal

### DATA — Persistence and integrity

- [x] **DATA-01**: All habits, logs, edit history, and settings persist in IndexedDB across sessions
- [x] **DATA-02**: IndexedDB schema is versioned with a `DB_VERSION` constant and a `MIGRATIONS` dispatch table
- [x] **DATA-03**: App calls `navigator.storage.persist()` on first write and surfaces persistence status in Settings
- [x] **DATA-04**: All mutations go through a single chokepoint (`state/apply.js`); views never write to IDB directly
- [x] **DATA-05**: Habit-definition edits never modify existing log rows; logs reference the `habit_versions` entry effective at the time they were written
- [x] **DATA-06**: Date keys are stored as local `YYYY-MM-DD` strings (never `Date.toISOString()`)
- [x] **DATA-07**: Cross-tab writes propagate via `BroadcastChannel('nawyki')`; open tabs react to other-tab mutations
- [x] **DATA-08**: App flushes pending writes on `visibilitychange → hidden` (never `beforeunload`)

### EXPORT — JSON backup + CSV analytics export

- [x] **EXPORT-01**: User can download a full-fidelity JSON backup of every IndexedDB store via a Settings action
- [x] **EXPORT-02**: JSON export embeds the current `schemaVersion`
- [x] **EXPORT-03**: User can download a CSV export of habit × day completion matrix (rows = habits grouped by wave, columns = days, cells = `1`/`0`/`x`)
- [x] **EXPORT-04**: CSV export uses `;` (semicolon) as field separator, UTF-8 with BOM, CRLF line endings
- [x] **EXPORT-05**: CSV export correctly preserves Polish diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż) when opened by double-click in Polish Windows Excel
- [x] **EXPORT-06**: CSV cells encode multi-occurrence habits as their numeric count for the period (not `1`)
- [x] **EXPORT-07**: CSV filename includes the export date (e.g., `nawyki-completion-2026-05-26.csv`)
- [x] **EXPORT-08**: User sees a "Last backup: N days ago" banner; a nag appears weekly to remind user to export

### IMPORT — JSON restore (merge-by-id)

- [x] **IMPORT-01**: User can upload a JSON backup file to restore data
- [x] **IMPORT-02**: Import uses merge-by-id semantics: overwrite-on-collision by primary key, never delete local-only records
- [x] **IMPORT-03**: Import rejects files from a newer `schemaVersion` with a clear error message
- [x] **IMPORT-04**: Import broadcasts a reload signal so other tabs refresh after merge completes
- [x] **IMPORT-05**: CSV import is explicitly NOT supported (read-only export only)

### SCORING — User-selectable scoring model

- [x] **SCORING-01**: User can choose between three scoring models from Settings: S1 (Rolling Threshold Health), S2 (Day-Weighted Wave Score), S3 (Load-Adjusted Capacity Score)
- [x] **SCORING-02**: Default scoring model is S1
- [x] **SCORING-03**: Switching models updates dashboards without requiring a reload
- [x] **SCORING-04**: S1 computes per-habit status: Healthy / Watch / At-risk / Failing based on rolling-window % vs threshold
- [x] **SCORING-05**: S2 computes a momentum score with exponential day-weighting (e.g., 21-day half-life) and stage-difficulty weighting; aggregates to wave level
- [x] **SCORING-06**: S3 computes a load-adjusted score that corrects for the number of habits active each day; mastered habits grant graduation credit
- [x] **SCORING-07**: All scoring models honor: cadence-aware denominator, 7-day new-habit grace period, mastered-habit 0.3× weighting
- [x] **SCORING-08**: Scoring outputs are persisted in `score_snapshots` IDB store; views read snapshots and never call `scoring.js` directly
- [x] **SCORING-09**: Snapshots include a `scoreVersion` field so algorithm changes can be re-run via "Recompute scores" Settings action

### DESKTOP — Analytics surface

- [ ] **DESKTOP-01**: User can open `desktop.html` separately from `index.html`
- [ ] **DESKTOP-02**: Desktop shell shares all `js/{db,state,domain,router,io,platform,util}/` modules with mobile; only entry file and view modules differ
- [ ] **DESKTOP-03**: Desktop shell renders an analytics view: per-habit stats, per-wave aggregates, scoring dashboard
- [x] **DESKTOP-04**: Desktop shell renders a wave-board: timeline of all habits across all waves, with status colors
- [ ] **DESKTOP-05**: Desktop shell renders a planning view: schedule new habits to start in week N
- [ ] **DESKTOP-06**: Settings has an explicit "Switch to desktop view" link (no auto-redirect on viewport)
- [ ] **DESKTOP-07**: Desktop view is usable; not a primary acceptance gate for cold-paint speed (mobile-only constraint)

### PWA — Installable offline app

- [ ] **PWA-01**: App ships a `manifest.json` with name, icons, start_url, scope, display: standalone
- [ ] **PWA-02**: App registers a service worker (`sw.js`) using cache-first strategy with versioned cache name (`habits-X.Y.Z`)
- [ ] **PWA-03**: Service worker uses `skipWaiting()` + `clients.claim()` so updates take effect on next reload
- [ ] **PWA-04**: Service worker registration silently fails (silent `.catch()`) when running over `file://`
- [ ] **PWA-05**: App is installable on Android Chrome, iOS Safari (Add to Home Screen), and desktop Chrome/Edge
- [ ] **PWA-06**: App functions fully offline once installed
- [x] **PWA-07**: Settings includes an install-help panel that platform-detects and shows the right instructions (iOS vs Android vs desktop)

### SEED — Bundled habit data

- [x] **SEED-01**: App ships a hand-curated `seed/habits.json` parsed from `Nawyki v1.xlsx` + `Nawyki-fale.txt`
- [x] **SEED-02**: Seed includes all ~65 habits with their wave assignment, cadence rules, stage definitions, multi-occurrence config
- [x] **SEED-03**: Seed is loaded idempotently on first run; subsequent loads do not duplicate or overwrite user data
- [x] **SEED-04**: Seed is loaded into `events` as an initial event (one event per habit creation) so the audit trail is complete
- [x] **SEED-05**: No xlsx/txt parsing code ships in the user-facing app; seed JSON is the only data source

### SETTINGS — Configuration surface

- [x] **SETTINGS-01**: User can view and edit global mastery threshold (default 90%) and window (default 70 days)
- [x] **SETTINGS-02**: User can choose scoring model (S1 / S2 / S3)
- [x] **SETTINGS-03**: User can trigger JSON export, JSON import, CSV export from Settings
- [x] **SETTINGS-04**: User can see storage persistence status (persistent: yes/no) and last-backup timestamp
- [x] **SETTINGS-05**: User can see app version and schema version in an About panel
- [x] **SETTINGS-06**: User can perform "Recompute scores" action (re-runs scoring across all snapshots)
- [ ] **SETTINGS-07**: User has a "Reset app" debug action that clears all IDB data (with explicit confirmation)

### NFR — Non-functional requirements

- [x] **NFR-01 (Performance)**: Cold paint on Today view < 300 ms on a mid-range Android phone with 1 year of data
- [x] **NFR-02 (Performance)**: First-tap latency on Today view < 100 ms
- [ ] **NFR-03 (Performance)**: Desktop analytics view renders < 2 s with 5 years of synthetic data
- [ ] **NFR-04 (Offline)**: App functions fully offline; no network calls except user-initiated export/import
- [ ] **NFR-05 (Privacy)**: No telemetry, no analytics SDK, no error reporting service; the app never phones home
- [x] **NFR-06 (Accessibility)**: Today view operable with keyboard only on desktop; touch targets ≥ 44×44 px on mobile
- [x] **NFR-07 (Accessibility)**: All interactive elements have accessible names; no color-only state encoding
- [ ] **NFR-08 (Browser support)**: Latest 2 versions of Chrome, Edge, Firefox, Safari (desktop + mobile)
- [ ] **NFR-09 (File-protocol compatibility)**: App loads and functions when opened via `file://` (service worker silent-fail; data persists in IDB scoped to origin)
- [ ] **NFR-10 (Data trust)**: No mutation path can corrupt prior history; every test case verifies historical logs survive edits intact
- [ ] **NFR-11 (Tooling-free)**: App ships as plain static files; no build step required to develop or deploy
- [ ] **NFR-12 (Hostable on GitHub Pages)**: All paths are relative; works under a sub-path (`/nawyki/`)

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### REMINDERS

- **REM-01**: Local notifications when a habit hasn't been logged by 22:00
- **REM-02**: Configurable per-habit reminder times
- **REM-03**: Web Push reminders (requires server, unlikely)

### SYNC

- **SYNC-01**: Cloud sync across multiple devices
- **SYNC-02**: Conflict resolution UI (multi-tab now, multi-device later)

### ANALYTICS

- **ANA-01**: Streak counters as opt-in secondary metric (NOT primary)
- **ANA-02**: Habit correlation analysis ("on days I do X, I'm 30% more likely to do Y")
- **ANA-03**: Wave retrospective view (end-of-wave summary)

### INTL

- **INTL-01**: Polish UI strings (currently English only)

### EXPORT-V2

- **EXPORT-V2-01**: PDF export of a wave or year summary
- **EXPORT-V2-02**: CSV export with configurable delimiter as Settings toggle

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Push notifications / nag emails | User explicitly opted out; respect user attention |
| Cloud sync / multi-device | Single-user, single-device + JSON export-import is sufficient for v1 |
| Multi-user accounts | Personal tool for one user |
| In-app xlsx/txt importer | Seed is bundled JSON; the user-facing app never parses spreadsheets |
| Bundler / framework / npm | Deliberate constraint mirroring `mindful-breathing`; zero-dependency longevity |
| Gamification (XP, levels, avatars, badges-as-rewards) | Philosophy mismatch; rolling-window mastery is the only reward signal |
| Streak counters as primary metric | The 70-day rolling window is the metric; streaks shame the user on a missed day |
| "Are you sure?" confirmation dialogs on the happy path | Friction kills daily check-in; undo toast replaces confirmations |
| Welcome / onboarding wall | Seed data + the user's existing mental model means there's nothing to onboard |
| Direct copy of xlsx `WYNIK SKORYGOWANY` formula | Rethought as S1/S2/S3 — see SCORING |
| Auto-redirect mobile ↔ desktop based on viewport | Foot-gun; user prefers explicit "Switch view" link |
| Server-side analytics or telemetry | No network calls except user-initiated export/import |
| File System Access API for exports | Not supported on `file://`, gaps on Safari; stick with Blob + anchor download |
| CSV import | Read-only export; round-trip is JSON-only |
| Translation of habit names | Habit names are user content (Polish); UI chrome only is English |

## Traceability

Every v1 requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 3 | Complete (03-02) |
| CORE-02 | Phase 3 | Complete (03-03) |
| CORE-03 | Phase 3 | Complete (03-03) |
| CORE-04 | Phase 3 | Complete (03-02) |
| CORE-05 | Phase 3 | Complete (03-02) |
| CORE-06 | Phase 3 | Complete (03-02) |
| CATALOG-01 | Phase 4 | Complete |
| CATALOG-02 | Phase 4 | Complete |
| CATALOG-03 | Phase 4 | Complete |
| CATALOG-04 | Phase 4 | Complete |
| CATALOG-05 | Phase 4 | Complete |
| CATALOG-06 | Phase 4 | Complete |
| CATALOG-07 | Phase 4 | Complete |
| CADENCE-01 | Phase 4 | Complete |
| CADENCE-02 | Phase 4 | Complete |
| CADENCE-03 | Phase 4 | Complete |
| CADENCE-04 | Phase 4 | Complete |
| CADENCE-05 | Phase 4 | Complete |
| CADENCE-06 | Phase 4 | Complete |
| CADENCE-07 | Phase 4 | Complete |
| STAGE-01 | Phase 4 | Complete |
| STAGE-02 | Phase 4 | Complete |
| STAGE-03 | Phase 4 | Complete |
| STAGE-04 | Phase 4 | Complete |
| STAGE-05 | Phase 4 | Complete |
| STAGE-06 | Phase 4 | Complete |
| STAGE-07 | Phase 4 | Complete |
| MASTERY-01 | Phase 4 | Complete |
| MASTERY-02 | Phase 4 | Complete |
| MASTERY-03 | Phase 4 | Complete |
| MASTERY-04 | Phase 4 | Complete |
| MASTERY-05 | Phase 4 | Complete |
| MASTERY-06 | Phase 4 | Complete |
| MASTERY-07 | Phase 4 | Complete |
| LOG-01 | Phase 3 | Complete (03-03) |
| LOG-02 | Phase 4 | Complete |
| LOG-03 | Phase 4 | Complete |
| LOG-04 | Phase 4 | Complete |
| LOG-05 | Phase 4 | Complete |
| LOG-06 | Phase 4 | Complete |
| HISTORY-01 | Phase 4 | Complete |
| HISTORY-02 | Phase 4 | Complete |
| HISTORY-03 | Phase 4 | Complete |
| HISTORY-04 | Phase 4 | Complete |
| HISTORY-05 | Phase 4 | Complete |
| HISTORY-06 | Phase 4 | Complete |
| WAVE-01 | Phase 4 | Complete |
| WAVE-02 | Phase 4 | Complete |
| WAVE-03 | Phase 4 | Complete |
| WAVE-04 | Phase 4 | Complete |
| WAVE-05 | Phase 4 | Complete |
| WAVE-06 | Phase 4 | Complete |
| UNDO-01 | Phase 3 | Complete (03-04) |
| UNDO-02 | Phase 3 | Complete (03-04) |
| UNDO-03 | Phase 3 | Complete (03-04) |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| DATA-04 | Phase 2 | Complete |
| DATA-05 | Phase 2 | Complete |
| DATA-06 | Phase 2 | Complete |
| DATA-07 | Phase 2 | Complete |
| DATA-08 | Phase 2 | Complete |
| EXPORT-01 | Phase 5 | Complete |
| EXPORT-02 | Phase 5 | Complete |
| EXPORT-03 | Phase 5 | Complete |
| EXPORT-04 | Phase 5 | Complete |
| EXPORT-05 | Phase 5 | Complete |
| EXPORT-06 | Phase 5 | Complete |
| EXPORT-07 | Phase 5 | Complete |
| EXPORT-08 | Phase 5 | Complete |
| IMPORT-01 | Phase 5 | Complete |
| IMPORT-02 | Phase 5 | Complete |
| IMPORT-03 | Phase 5 | Complete |
| IMPORT-04 | Phase 5 | Complete |
| IMPORT-05 | Phase 5 | Complete |
| SCORING-01 | Phase 6 | Complete |
| SCORING-02 | Phase 6 | Complete |
| SCORING-03 | Phase 6 | Complete |
| SCORING-04 | Phase 6 | Complete |
| SCORING-05 | Phase 6 | Complete |
| SCORING-06 | Phase 6 | Complete |
| SCORING-07 | Phase 6 | Complete |
| SCORING-08 | Phase 6 | Complete |
| SCORING-09 | Phase 6 | Complete |
| DESKTOP-01 | Phase 6 | Pending |
| DESKTOP-02 | Phase 6 | Pending |
| DESKTOP-03 | Phase 6 | Pending |
| DESKTOP-04 | Phase 6 | Complete |
| DESKTOP-05 | Phase 6 | Pending |
| DESKTOP-06 | Phase 6 | Pending |
| DESKTOP-07 | Phase 6 | Pending |
| PWA-01 | Phase 1 | Pending |
| PWA-02 | Phase 1 | Pending |
| PWA-03 | Phase 1 | Pending |
| PWA-04 | Phase 1 | Pending |
| PWA-05 | Phase 1 | Pending |
| PWA-06 | Phase 1 | Pending |
| PWA-07 | Phase 3 | Complete (03-05) |
| SEED-01 | Phase 2 | Complete |
| SEED-02 | Phase 2 | Complete |
| SEED-03 | Phase 2 | Complete |
| SEED-04 | Phase 2 | Complete |
| SEED-05 | Phase 2 | Complete |
| SETTINGS-01 | Phase 4 | Complete |
| SETTINGS-02 | Phase 6 | Complete |
| SETTINGS-03 | Phase 5 | Complete |
| SETTINGS-04 | Phase 3 | Complete (03-05) |
| SETTINGS-05 | Phase 3 | Complete (03-05) |
| SETTINGS-06 | Phase 6 | Complete |
| SETTINGS-07 | Phase 1 | Pending |
| NFR-01 | Phase 3 | Complete (03-02) |
| NFR-02 | Phase 3 | Complete (03-03) |
| NFR-03 | Phase 6 | Complete |
| NFR-04 | Phase 1 | Pending |
| NFR-05 | Phase 6 | Complete |
| NFR-06 | Phase 3 | Complete (03-02) |
| NFR-07 | Phase 3 | Complete (03-02) |
| NFR-08 | Phase 6 | Complete |
| NFR-09 | Phase 1 | Pending |
| NFR-10 | Phase 4 | Complete |
| NFR-11 | Phase 1 | Pending |
| NFR-12 | Phase 1 | Pending |

**Coverage:**

- v1 requirements: 123 total (CORE 6, CATALOG 7, CADENCE 7, STAGE 7, MASTERY 7, LOG 6, HISTORY 6, WAVE 6, UNDO 3, DATA 8, EXPORT 8, IMPORT 5, SCORING 9, DESKTOP 7, PWA 7, SEED 5, SETTINGS 7, NFR 12)
- Mapped to phases: 123 ✓
- Unmapped: 0 ✓
- Coverage: 100%

**Per-Phase Counts:**

- Phase 1 — PWA Shell & Tooling Hygiene: 11 requirements (PWA-01..06, SETTINGS-07, NFR-04, NFR-09, NFR-11, NFR-12)
- Phase 2 — Storage Foundation: 13 requirements (DATA-01..08, SEED-01..05)
- Phase 3 — Today View & Settings v1: 17 requirements (CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07)
- Phase 4 — Domain Model: 47 requirements (CATALOG-01..07, CADENCE-01..07, STAGE-01..07, MASTERY-01..07, LOG-02..06, HISTORY-01..06, WAVE-01..06, SETTINGS-01, NFR-10)
- Phase 5 — Backup & Restore: 14 requirements (EXPORT-01..08, IMPORT-01..05, SETTINGS-03)
- Phase 6 — Desktop Analytics & Scoring Trio: 21 requirements (SCORING-01..09, DESKTOP-01..07, SETTINGS-02, SETTINGS-06, NFR-03, NFR-05, NFR-08)

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-05-26 after roadmap creation (123 requirements mapped to 6 phases)*
