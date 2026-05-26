# Pitfalls Research

**Domain:** Personal, offline-first, multi-year habit-tracker PWA (vanilla HTML/JS/CSS + IndexedDB)
**Researched:** 2026-05-26
**Confidence:** HIGH (well-known web-platform pitfalls + domain-specific habit-tracker traps)

> Each pitfall below is bounded to ~150 words. All 12 explicit concern areas are covered, severity-rated, and phase-mapped. Phase IDs (`P1`–`P9`) refer to the roadmap created downstream of this research; tweak labels when the roadmap names them.

---

## Critical Pitfalls

### Pitfall 1: IndexedDB Data Loss (browser eviction)

**What goes wrong:** IndexedDB is "best-effort" storage by default. Safari evicts IDB after **7 days of no user interaction** with the site (ITP). Chromium evicts under storage pressure or in private/incognito. PWAs not added to the home screen are first to go. Years of personal logs vanish silently.

**Severity:** Catastrophic.

**Warning signs:** `navigator.storage.estimate()` quota close to cap; first launch on a new device shows empty DB; iOS user reopens after vacation and "everything is gone."

**Prevention:**
- Call `navigator.storage.persist()` on first write; show its result in Settings (Persistent: yes/no).
- Surface a "Last backup: N days ago" banner; nag (gently) at 14+ days.
- Auto-trigger JSON export reminder weekly via a stored `lastBackupAt` timestamp.
- Document the iOS 7-day rule in the in-app About panel.
- On `file://`, persistence quota is per-origin-of-file-url — warn the user that file:// is for dev only.

**Phase to address:** P2 (Storage layer) defines persistence call; P3 (Settings) surfaces status; P5 (Export) ties backup nag to lastBackupAt.

---

### Pitfall 2: Service Worker Bricks the App

**What goes wrong:** A bad `sw.js` deploy caches broken assets; users get a permanently white screen because the old SW keeps serving stale HTML that references deleted JS. Or registration succeeds on `file://` (it doesn't, but the error is swallowed wrong) and the page hangs.

**Severity:** High.

**Warning signs:** White screen after deploy; `Application → Service Workers` in DevTools shows old version "waiting"; users report "it loads forever."

**Prevention:**
- Use **versioned cache name** (`nawyki-0.1.0`, bump every release). `activate` deletes non-current caches.
- `skipWaiting()` + `clients.claim()` so new SW takes over immediately.
- Registration guarded by `location.protocol.startsWith('http')` and a silent `.catch()` (matches mindful-breathing).
- Hidden Settings → "Reset app" button that calls `registration.unregister()` and `caches.delete(*)` then reloads.
- Manual smoke-test after every deploy: hard reload, then offline-mode reload, must succeed.

**Phase to address:** P1 (PWA shell) defines pattern; every release phase includes the post-deploy smoke test.

---

### Pitfall 3: Habit-Definition Edits Corrupt Prior Logs

**What goes wrong:** User renames "Spacer 30 min" to "Spacer 45 min", or changes a habit's target from 3 to 5. Naive implementations re-evaluate historical logs against the new definition, retroactively turning completed days into failures (or vice versa). User loses trust in the data.

**Severity:** Catastrophic (data trust is the product's foundation).

**Warning signs:** Yesterday's "100%" becomes "60%" after an edit; logs reference a target that no longer exists in the catalog; "mastery" status flickers across edits.

**Prevention:**
- **Versioned habit definitions:** `habits` store keeps the current row; `habit_versions` store keeps every prior shape with `validFrom`/`validTo` timestamps.
- Each log row stores `habitVersionId` (the version active when the log was written), not just `habitId`.
- Threshold/rolling-window math evaluates each day against the version that was live that day.
- Editing a habit creates a new version; never UPDATE in place except for cosmetic fields (color, sort order).

**Phase to address:** P2 (Schema design) — non-negotiable foundation. Verified in P4 (Catalog edits) acceptance tests.

---

### Pitfall 4: Timezone & Date-Boundary Bugs

**What goes wrong:** Using `new Date().toISOString().slice(0,10)` (UTC) means a 23:30 Warsaw check-in writes to the *next* day. DST transitions skip or duplicate an hour, breaking "every N days" math. Leap day (29 Feb) crashes naive date arithmetic. User travels to a different timezone and yesterday's habits disappear.

**Severity:** High.

**Warning signs:** Late-night check-ins appear on tomorrow's grid; rolling window in March/October is off by one; "every 2 days" drifts after DST; logs from a trip show on wrong day.

**Prevention:**
- **Store dates as local `YYYY-MM-DD` strings** (`util/date.js: todayLocal()`), never as ISO timestamps, never as UTC.
- All date math uses `Date` constructed from `Y, M-1, D` (local) and adds via `setDate(d.getDate() + n)` — these handle DST and leap years correctly.
- Pin "the day" to the user's device local time. Document explicitly that the app is single-device.
- Unit-test the date utility across DST boundaries (2026-03-29, 2026-10-25) and leap day (2028-02-29).

**Phase to address:** P2 (date util is a Day-1 module). Tested in P3 (Today view) and P6 (Analytics rolling windows).

---

### Pitfall 5: Rolling-Window Math Off-by-One

**What goes wrong:** 70-day window can mean "last 70 calendar days including today" (70) or "previous 70 excluding today" (70) or "today + 69 prior" (70) or "all logs where day >= today - 70 days" (71). Sparse data (habit only created 20 days ago) inflates % when divided by 70 vs by 20. Leap day crosses the boundary and shifts results by one. User sees mastery flip on and off arbitrarily.

**Severity:** High (drives the "mastered" badge — central UX signal).

**Warning signs:** Mastery toggles day-to-day without a real status change; % differs from a manual spreadsheet recount; new habits show "0/70" instead of "0/N where N = days since creation."

**Prevention:**
- One canonical function `windowSlice(habitId, anchorDate, windowDays)`; every caller (today view, analytics, scoring) goes through it.
- Spec: window = `[anchorDate - (windowDays - 1) ... anchorDate]` inclusive. Today counts.
- Denominator = `min(windowDays, daysSinceHabitCreated + 1)`, never silently divide by 70 for a 5-day-old habit.
- Sparse days where the habit was not scheduled (cadence said "off") don't count in either numerator or denominator.
- Unit tests covering: brand-new habit, 71-day-old habit, leap-day boundary, DST week, sparse cadence.

**Phase to address:** P2 (`domain/threshold.js`). Locked by tests before P3 ships.

---

### Pitfall 6: Daily Check-in UX Friction

**What goes wrong:** Anything between the user and tapping "done" kills the habit. Login screens, "are you sure?" dialogs, multi-step flows, slow loads, animations that block input, modals that demand input before the daily grid shows. The Today view should render in <300 ms and accept the first tap within 100 ms.

**Severity:** Catastrophic (this is the product's core value).

**Warning signs:** Check-in takes >2 taps for the common case; user opens app and waits for a spinner; modal appears before grid; user starts skipping days because "it's annoying now."

**Prevention:**
- Today view renders synchronously from cached snapshot, then upgrades when IDB resolves. No spinner-blocked first paint.
- Single-tap toggles habit complete/incomplete; single-tap-increments for `+1` counters; single-tap-slot for slot-checklist.
- No confirmation dialogs on the happy path. Mistakes are recoverable via "Undo" (5-second toast).
- No login, no onboarding wall, no welcome modal after first run.
- Mobile Today view fits the active-habits-for-today on screen with no scroll where possible.
- Vibration API for tap feedback (optional, settings-toggled).

**Phase to address:** P3 (Today view) — primary acceptance gate. Re-verified at every release.

---

### Pitfall 7: PWA Install Ergonomics Across Platforms

**What goes wrong:** Each platform installs differently and silently fails differently. iOS Safari has no install prompt — user must use Share → "Add to Home Screen" manually and most users don't know. Android Chrome shows `beforeinstallprompt`; desktop Chrome shows an icon in the URL bar; Firefox desktop doesn't install at all on most builds. The user thinks the app "didn't install" because they were on iOS Safari.

**Severity:** Medium (affects persistence, not function — but persistence is critical for IDB longevity).

**Warning signs:** User reports "no install button"; opened-as-tab usage shows higher IDB eviction; iOS user's data vanishes after the 7-day ITP window because they never added to home screen.

**Prevention:**
- Detect platform; show an in-app **"How to install"** panel with platform-specific instructions (iOS: Share button screenshot; Android: "Tap Install"; desktop: URL-bar icon).
- Listen for `beforeinstallprompt`, store the event, show a custom "Install" button when available.
- After-install detection via `appinstalled` event; track in `settings` store; suppress further install prompts.
- Don't rely on install for correctness — `navigator.storage.persist()` is the real defense.

**Phase to address:** P1 (PWA shell) defines manifest; P3 (Settings panel) houses install guide.

---

### Pitfall 8: Multi-Tab Concurrency

**What goes wrong:** User has Today open on phone and Analytics open on desktop. Both tabs write a log for the same `[habitId, date]` keypair within the same minute. Last-write-wins erases the other's update. Or `BroadcastChannel` fires before the writing transaction commits, and the receiving tab reads stale data.

**Severity:** Medium (rare in a single-user app, but the user explicitly runs mobile-checkin + desktop-analytics simultaneously).

**Warning signs:** Desktop shows yesterday's count; mobile increments to N+1 but desktop says N; refreshing one tab reverts a change made in the other.

**Prevention:**
- Write through a single `repo.put(...)` that uses a `readwrite` transaction over all stores it touches, then `await tx.done` before posting to `BroadcastChannel`.
- BroadcastChannel messages carry the *intent* (`log:put habitId date`), not the new value. Receivers re-read from IDB to get the canonical state.
- For numeric counters, use **upsert with read-modify-write inside the same transaction**, not `currentValue + 1` computed before opening the tx.
- Consider an in-row `updatedAt` and a Lamport-ish `revision` counter for future conflict detection (cheap to add now, costly later).

**Phase to address:** P2 (Repo layer). Verified in P6 (Analytics) where multi-tab is most visible.

---

### Pitfall 9: Performance at Scale (~65 habits × multi-year)

**What goes wrong:** 65 habits × 365 days × 3 years ≈ **71k log rows** by 2029. Naive "load all logs into memory, filter in JS" pattern works at 1k rows and dies at 50k. Today view stalls; analytics dashboard freezes; export takes 10+ seconds.

**Severity:** High (slow personal tool gets abandoned; data is locked-in by then).

**Warning signs:** Today view paint >500 ms after first year; analytics needs a spinner; CSV export blocks UI; phone fan spins on open.

**Prevention:**
- **Index strategy:** `logs` keyed by `[habitId, date]`; indexes on `date` (single-day lookup) and `habitId` (per-habit history). All Today/Analytics queries use indexes, never `getAll()` of the full store.
- Today view loads only `logs where date = today` via the `date` index (~65 rows).
- Rolling-window queries use `IDBKeyRange.bound([habitId, fromDate], [habitId, toDate])` — a single index scan, not a full-store filter.
- Analytics caches monthly aggregates in a separate store (`aggregates_monthly`); recompute only the current month on write.
- Pagination/virtualization on the History view when a habit's log spans >365 entries.
- Performance budget: Today view <300 ms cold open; analytics <800 ms; export <2 s for 100k rows.

**Phase to address:** P2 (indexes baked into schema). Smoke-tested with synthetic 5-year data in P6 (Analytics).

---

### Pitfall 10: Schema Migration Without Tooling

**What goes wrong:** Vanilla-no-framework projects often hand-write schema once and never plan for change. Six months later, adding a field means either: (a) breaking existing users' DBs with crashes on read, (b) silently dropping data, or (c) writing a panic-migration that loses logs. Multi-year personal data makes this catastrophic.

**Severity:** Catastrophic (the data is irreplaceable).

**Warning signs:** "Oh, we'll just add the field" without `version++`; `onupgradeneeded` is empty or hand-edited inconsistently; no record of which version a backup came from; user upgrades the app and crashes on first open.

**Prevention:**
- **Single source of truth:** `js/db/schema.js` exports `DB_VERSION` and `MIGRATIONS = { 1: createV1, 2: addStageHistory, 3: ... }`.
- `onupgradeneeded` runs a dispatch table: for every version from `oldVersion + 1` to `newVersion`, run the migration in order. Never rely on fall-through `case` (fragile); use explicit loop.
- Migrations only **add** stores/indexes/fields. Never rename in place; create a new field, dual-write for one release, then read-only-from-new.
- Every JSON export embeds `schemaVersion`. Import validates and refuses (with a clear message) if export is newer than the running app.
- Pre-migration: open a transaction, copy critical stores to a `backup_pre_v{N}` store; keep for one release.
- Manual smoke test every migration on a copy of real data before shipping.

**Phase to address:** P2 (schema module) defines pattern. Every feature phase that touches storage adds a migration entry.

---

### Pitfall 11: CSV Export Excel-Locale & Polish Diacritics

**What goes wrong:** Polish Windows Excel uses **`;` (semicolon)** as the default CSV delimiter, not `,`. UTF-8 without BOM → Excel reads `ą ć ę ł ń ó ś ź ż` as `Ä… Ä‡ Ä™ Å‚ Å„ Ã³ Å› Å› Å¼` (mojibake). LF-only line endings break older Excel. Fields containing `;` or `\n` collapse columns. The user opens their analytics CSV and sees garbage; they lose trust in the export.

**Severity:** High (CSV export is an explicit feature; this user runs Polish Windows; ad-hoc analysis is part of the workflow).

**Warning signs:** Excel opens CSV with everything in column A; Polish characters render as `Å¼`; Excel shows "?" for diacritics; row counts don't match.

**Prevention:**
- **Prepend UTF-8 BOM** (`﻿`) to every CSV blob. This is the magic that makes Polish Windows Excel auto-detect UTF-8.
- **Use `;` as delimiter** for Excel-compatibility (or offer a settings toggle: `,` vs `;`; default `;` given user locale).
- **CRLF (`\r\n`)** row separators, not LF.
- Quote any field containing the delimiter, `"`, `\r`, or `\n`; escape internal `"` as `""`.
- Test the round-trip: export → open in Polish Excel → confirm `Spacer 30 min, każdego dnia` renders cleanly with diacritics intact and columns aligned.
- MIME `text/csv;charset=utf-8`; filename `nawyki-logs-YYYY-MM-DD.csv`.

**Phase to address:** P5 (Export) — explicit acceptance test on Polish Windows Excel before phase closes.

---

### Pitfall 12: Bad Scoring Model Discourages Use

**What goes wrong:** Scoring that punishes (a) starting late ("only 12% mastery!"), (b) skipped days marked as failures (cadence-aware skips are not failures), (c) recently-added habits dragging the daily score below 50%, (d) mastered habits still counted at 100% so the score becomes stuck — all of these tell the user "you're failing" when they're actually doing fine. User stops checking in.

**Severity:** Catastrophic (user explicitly flagged this for rethink; xlsx "WYNIK SKORYGOWANY" is candidate-not-mandate).

**Warning signs:** User stops opening the app; daily % feels unfair; new habits ruin the score; "good day" produces a bad number; mastered-but-still-feeding habits add no signal.

**Prevention:**
- **Three scoring models surfaced in research, user picks one** (per PROJECT.md decision).
- Candidate principles, regardless of model:
  - Score is calculated **only over habits scheduled for today** (cadence-aware).
  - Mastered habits are scored, but at a reduced weight (e.g. 0.3×) so they neither dominate nor distort.
  - New habits have a grace period (e.g. first 7 days don't count toward rolling stats).
  - Score answers "how am I doing **on what I committed to today**", not "what % of all 65 habits did I touch."
- Show two numbers: today's adherence (% of today's scheduled completed) AND rolling-window adherence (mastery-relevant). Never collapse into one ambiguous number.
- Never use red/danger colors for sub-100% scores. Sub-100% is the normal case.

**Phase to address:** P0 (Scoring research → 3 alternatives → user pick) BEFORE roadmap commits. Implemented in P6 (Analytics).

---

## Anti-Pattern Alerts — Things Commonly Built That This App Shouldn't

### Anti-Pattern A: Streak-Shaming, Streak-Resetting UI

**What other habit apps do:** Big "🔥 47 days" badges that reset to zero on a single missed day. "You broke your streak!" red banners. Push notifications when streak is at risk.

**Why this app rejects it:** This user practices a sustainable multi-year system with rolling-window thresholds (90%/70 days), not all-or-nothing streaks. A single missed day shouldn't wipe the signal. Streak shame demotivates and contradicts the "mastered but still feeding" philosophy where you keep doing the habit without pressure.

**Do instead:** Show rolling-window adherence (`63/70` not `🔥 7`). Frame gaps as "84%" not "streak broken." Allow gaps to be a normal part of long-term practice. Optional: a tiny "longest unbroken run" stat tucked in analytics for curiosity, never on Today.

**Phase to address:** P3 (Today view) UI spec explicitly forbids streak counters on the main grid.

---

### Anti-Pattern B: Reminder Push-Notification Spam & Gamification

**What other habit apps do:** Daily 9pm "Don't forget your habits!" push notifications. Achievement badges ("First 7-day streak!", "Hydration hero!"). XP, levels, leaderboards. Confetti animations.

**Why this app rejects it:** PROJECT.md explicitly defers reminders ("user prefers no nag"). Gamification turns intrinsic motivation into extrinsic, then collapses when novelty fades. This is a personal long-term tool, not an engagement product — there's no business to optimize DAU for. The user is the developer; respect them.

**Do instead:** Quiet competence. The app is there when the user opens it; it doesn't pursue them. No badges, no XP, no confetti. Pride comes from the rolling-window % and the multi-year graph, not from cartoon trophies. Vibration on check-in is fine (tactile confirmation, not reward).

**Phase to address:** P1 (PWA shell) — no Notifications API integration. P3 (Today view) — no badge/XP UI elements. Locked.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Storing dates as `Date.toISOString()` (UTC) | One-liner | Timezone-boundary bugs forever | **Never** |
| Editing habits in-place without versioning | Simpler CRUD | Historical logs lie | **Never** |
| Single `getAll('logs')` then filter in JS | Easy to write | Dies at ~10k rows (~6 months in) | Only for the first phase's seed-data smoke test |
| Hand-edited `onupgradeneeded` without version dispatch table | Quick add | Migration chain becomes spaghetti | **Never** |
| Skipping BOM on CSV | Smaller file | Polish Excel garbles diacritics | **Never** (user is on Polish Windows) |
| `localStorage` for one habit log "just this once" | Quick win | Mixed-storage divergence | **Never** for habit data (UI prefs only) |
| No `navigator.storage.persist()` call | One fewer API | Safari 7-day eviction wipes data | **Never** |
| Inline UI strings in Polish "for now" | Faster v1 | i18n rewrite later | **Never** — UI is locked English |
| One giant `app.js` | Fewer files | Unreadable at 3k+ lines | First-week prototype only |
| Service worker without versioned cache name | One fewer constant | Stale cache bricks users | **Never** |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| IndexedDB on `file://` | Assuming quota is unlimited / shared with HTTPS origin | Each file:// page is its own origin; persistence is fragile; document file:// as dev-only |
| Service Worker on `file://` | Letting registration error bubble up and crash JS | Guard with `location.protocol.startsWith('http')` + silent `.catch()` |
| `BroadcastChannel` between tabs | Posting before the IDB transaction commits | `await tx.done` THEN `channel.postMessage(...)` |
| Web App Manifest | Missing `scope` → user navigates outside, PWA breaks | Set `"scope": "./"` explicitly |
| `navigator.storage.persist()` | Calling on every load | Call once on first write, store result; surface in Settings |
| iOS Safari install | Showing Android install prompt UI to iOS users | Platform-detect; show Share-button instructions for iOS |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| `getAll('logs')` then JS-filter | Today view paint slows over time | Use `IDBKeyRange` + indexes (`date`, `habitId`) | ~5k–10k log rows (~3–6 months) |
| Recomputing analytics from scratch every render | Analytics view stalls | Memoize per-day/per-month aggregates in `aggregates_monthly` store | First year of data |
| Re-rendering full habit grid on every keystroke in catalog edit | Catalog feels laggy | Debounce 200 ms; re-render only the edited row | ~30+ habits (you already have 65) |
| Synchronous JSON.stringify of entire DB for export | UI freezes during export | Yield to event loop with `setTimeout(0)` or chunked stringify; consider Streams | ~50k rows / 2+ years |
| Rebuilding rolling-window % on every tap | Today view tap latency increases | Cache the window slice per habit; invalidate only the affected habit's slice on write | ~6 months of data |
| Loading entire history view at once | History view scroll janks | Virtualize / paginate; load month-at-a-time | Habits with >365 logs (year 2+) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Rendering Polish habit names via `innerHTML` | XSS via crafted habit name in imported JSON | Always use `textContent` for user-supplied strings; never `innerHTML` for habit names or notes |
| Accepting imported JSON without validation | Malformed or malicious JSON crashes app or pollutes DB | Validate `schemaVersion`, required fields, types; refuse and show error rather than partial-import |
| Service worker scope too broad | SW hijacks unrelated paths on GitHub Pages | Manifest `scope: "./"`; SW registered at `./sw.js` |
| Logging sensitive habit names to console in prod | Anyone with devtools sees content | No console.log of habit content in production paths; gate behind `?debug=1` |
| Embedding any telemetry / analytics | Privacy violation (PROJECT.md: never phones home) | Zero outbound `fetch()` calls. Lint or grep gate before each release. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Confirmation dialog on every check-in tap | Friction kills the habit | One-tap toggle; 5-second Undo toast |
| Hiding mastered habits | User loses the "keep feeding it" loop | Show muted, with a small badge; still tappable |
| Showing 0% on a habit created today | Demotivating false signal | Show `0/0` or "new" until day 7+ |
| Red/danger colors for sub-100% days | Frames normal life as failure | Use neutral tones for all completion levels |
| Loading spinner before Today grid | First impression of slowness | Render from cached snapshot synchronously, upgrade in place |
| Modal welcome screen on every install | Annoying after first time | First-run only, stored flag, can't re-trigger accidentally |
| Date picker for going back one day | Three taps where one would do | Day-by-day nav arrows; date picker as secondary |
| Wave-level "at risk" warning that triggers on a single missed day | Anxiety inducement | Threshold over the rolling window, mirroring per-habit mastery logic |

---

## "Looks Done But Isn't" Checklist

- [ ] **Today view:** Renders synchronously from cache? — open with throttled CPU; first paint <300 ms.
- [ ] **Habit edit:** Creates a new version row? — edit a habit, then re-open a 3-month-old date; old logs still evaluate against old definition.
- [ ] **Date handling:** Local TZ? — check in at 23:45, confirm log is on today, not tomorrow UTC.
- [ ] **DST boundary:** Date math correct? — synthetic test on 2026-03-29 (Europe/Warsaw DST start).
- [ ] **Service worker:** Versioned cache + activate cleanup? — deploy v2, hard-reload, no stale v1 assets served.
- [ ] **IDB persistence:** `navigator.storage.persist()` called? — Settings shows "Persistent: yes".
- [ ] **Schema migration:** `DB_VERSION` bumped + migration entry added? — install over a v1 IDB, no crash, no data loss.
- [ ] **CSV export:** BOM + `;` + CRLF + quoted diacritics? — open in Polish Windows Excel, `ą ć ę ł ń ó ś ź ż` render and columns align.
- [ ] **JSON export round-trip:** Import the export → byte-for-byte equal stats? — full fidelity.
- [ ] **Multi-tab:** Two tabs both increment same counter → final value correct? — manual test before P6 ships.
- [ ] **Mastered habits:** Visible but muted on Today? — verify, no hidden state.
- [ ] **No telemetry:** Zero outbound fetches after first SW install? — DevTools Network panel empty during normal use.
- [ ] **No streak counter on Today.** — visual review.
- [ ] **No reminder/push code path exists.** — grep `Notification`, `push`, `subscribe` returns nothing.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| IDB evicted (no recent backup) | **Catastrophic** | If file://: check OS file backups. If browser: data is gone. Restore from most recent JSON export. **Prevention is the only real recovery.** |
| Service worker bricks deployed app | LOW | User opens Settings → "Reset app" (unregisters SW, clears caches, reloads). If that path is broken: DevTools → Application → Unregister SW → hard reload. |
| Bad schema migration corrupts logs | HIGH | Restore from latest JSON export. Pre-migration `backup_pre_v{N}` store (if implemented) restored programmatically. Otherwise: app data is the export. |
| In-place habit edit overwrote logs | HIGH | Restore from JSON export. **Prevention via versioning is the only durable answer.** |
| Timezone bug shifted all logs by one day | MEDIUM | Migration: for affected version range, shift `date` field of all logs by -1 day. Document in migration changelog. |
| CSV import to Excel shows garbage | LOW | Re-export with BOM + `;`; if user already on broken file: re-import original JSON and re-export. |
| Multi-tab write conflict overwrote a check-in | LOW (if noticed) | User re-taps the missing check-in. Long-term: add `updatedAt`/`revision` and a conflict UI in P6+. |
| User loses access to one device (phone broken) | LOW (if backup current) | Restore from JSON export on new device. **Surface backup nag aggressively.** |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| 1. IDB eviction / Safari 7-day rule | P2 (Storage) + P3 (Settings) + P5 (Export) | `navigator.storage.persisted()` reports `true`; lastBackupAt surfaced |
| 2. Service worker bricks | P1 (PWA shell) | Versioned cache name + post-deploy smoke test in every release |
| 3. Habit-definition vs history coupling | P2 (Schema) — non-negotiable | Edit a habit, re-render a 3-month-old day, old logs unchanged |
| 4. Timezone & DST | P2 (`util/date.js`) | Unit tests across DST and leap day boundaries |
| 5. Rolling-window off-by-one | P2 (`domain/threshold.js`) | Spec'd window function with unit tests for sparse / new / old habits |
| 6. Check-in friction | P3 (Today view) — primary gate | First paint <300 ms; one-tap toggle; no modal blockers |
| 7. PWA install ergonomics | P1 (Manifest) + P3 (Install panel) | Platform-detected install help; `appinstalled` event tracked |
| 8. Multi-tab concurrency | P2 (Repo layer) | `await tx.done` before BroadcastChannel; manual two-tab test |
| 9. Performance at scale | P2 (Indexes) + P6 (Aggregate cache) | Synthetic 5-year dataset; Today <300 ms, Analytics <800 ms |
| 10. Schema migration | P2 (`db/schema.js` dispatch table) | Each storage-touching phase adds a migration entry; tested on real data copy |
| 11. CSV Excel-locale + Polish diacritics | P5 (Export) | BOM + `;` + CRLF; round-trip in Polish Windows Excel |
| 12. Bad scoring model | P0 (Scoring research) → user pick → P6 (Analytics) | Three models presented; user choice documented; cadence-aware denominator |
| A. Streak shaming | P3 (Today view) UI spec | Explicit "no streak counter" rule; visual review |
| B. Reminder/gamification creep | P1 + P3 (Manifest + Today UI) | Grep gate: no Notification/push/badge/XP code |

---

## Sources

- MDN — IndexedDB best practices (eviction, persistence): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- MDN — `StorageManager.persist()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- WebKit — Tracking Prevention and the 7-day IDB eviction rule (ITP)
- MDN — Service Worker lifecycle (skipWaiting, clients.claim, cache versioning)
- MDN — `visibilitychange` recommended over `beforeunload`
- MDN — BroadcastChannel API
- MDN — Web App Manifest install (`beforeinstallprompt`, `appinstalled`)
- Microsoft Excel CSV import — UTF-8 BOM and Windows locale-specific delimiter behavior (`;` on Polish/German Windows)
- `mindful-breathing` reference project — `sw.js` silent-fail pattern (directly inspected)
- `.planning/PROJECT.md` — locked constraints, scope boundaries
- `.planning/research/STACK.md` — schema shape, migration pattern, BOM/CRLF CSV decision
- Habit-tracker domain experience: streak-fatigue and gamification fatigue are well-documented anti-patterns in long-term-practice communities; this project's PROJECT.md explicitly mirrors that stance.

---
*Pitfalls research for: Nawyki (Habits) — vanilla multi-file HTML/JS/CSS PWA + IndexedDB, multi-year personal use*
*Researched: 2026-05-26*
