# Phase 3: Today View & Settings v1 (First Usable Slice) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 3 — Today View & Settings v1 (First Usable Slice)
**Areas discussed:** Cadence filtering scope, Today row interaction model, Settings shell + Today↔Settings navigation, Undo surface + behavior, Pure-view-builders + testing (D-26 Tier 1), Accessibility specifics (NFR-06 / NFR-07), History tab placeholder behavior in P3, SW SHELL precache strategy for new P3 files, Reset-data confirm copy, Toast XSS safety with Polish content, Cross-tab Settings refresh

---

## Cadence filtering scope

### Q1: How should Today filter the seed in Phase 3, given the cadence engine officially lands in P4?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal in-P3 resolver (all 4 types) | Ship `js/domain/cadence.js` covering daily / weekly / every-n-days / day-of-week-subset. P4 extends. CORE-04 fully met. | ✓ |
| Daily-only filter in P3 | Only `cadence.type === 'daily'` renders. CORE-04 partially met; mapping for CORE-04 in REQUIREMENTS.md would be revised. | |
| No filter — all binary habits | Show every binary habit regardless of cadence. CORE-04 deferred to P4. Smallest P3 code surface. | |

**User's choice:** Minimal in-P3 resolver covering all 4 types.

---

### Q2: How should the weekly cadence resolver express "applies today?"

| Option | Description | Selected |
|--------|-------------|----------|
| Pure: any day of the week | Weekly habits render every day; completed state is independent of cadence-applicability. | |
| Log-aware: hide if completed this week | Resolver takes `(habit, date, ctx)` with log access; hides weekly habits already completed in the current ISO week. | ✓ |
| Pure: only on Monday | Weekly habits appear only on Monday (week-start). | |

**User's choice:** Log-aware — hide if completed this week.

---

### Q3: What anchor date does every-N-days count from?

| Option | Description | Selected |
|--------|-------------|----------|
| habit.startDate (new field) | Add optional `startDate` field; default to creation date. | |
| Last completed log + N days | Resolver counts from the most recent `completed:true` log, fallback to creation date if none. | ✓ |
| ISO epoch anchor | Project-wide epoch (e.g. 2026-01-01); every-2 = even day-of-year. | |

**User's choice:** Last completed log + N days, fallback to creation date.

---

### Q4: What does the Today render path read from IDB on cold-paint (NFR-01)?

| Option | Description | Selected |
|--------|-------------|----------|
| One bounded read: last 14 days of logs + all habits | Cache `logs` as Map keyed by `${habitId}|${date}`. | |
| Bounded read + denormalized `habit.lastCompletedDate` | Inline the latest-completed date on the habit row; apply.js maintains it. | ✓ |
| Materialized view in `score_snapshots` | Repurpose the P6-reserved snapshots store. | |

**User's choice:** Bounded read + denormalized `habit.lastCompletedDate`.

---

### Q5: ISO week vs locale week for the weekly resolver?

| Option | Description | Selected |
|--------|-------------|----------|
| ISO 8601 — Monday start | Fixed Mon-Sun week; `util/date.js` exposes ISO week helpers. | |
| Locale-aware via `Intl.Locale.getWeekInfo()` | Browser-locale-driven. | |
| User-configurable in Settings | `settings.weekStart = 'mon'|'sun'`, default `'mon'`. | ✓ |

**User's choice:** Configurable in Settings.

---

### Q6: Default + UI surface for `settings.weekStart` in P3?

| Option | Description | Selected |
|--------|-------------|----------|
| Default 'mon', UI toggle in Settings v1 | First-run defaults grow by one row; Mon/Sun radio in Settings. | ✓ |
| Default 'mon', no UI in P3 | Storage only; setting hidden from UI in P3. | |
| Default 'mon', hardcoded | No settings row at all (conflicts with Q5 answer). | |

**User's choice:** Default 'mon' with UI toggle.

---

## Today row interaction model

### Q1: Tap target shape and optimistic-vs-await?

| Option | Description | Selected |
|--------|-------------|----------|
| Whole row tappable; optimistic flip + apply() | Immediate DOM flip; fire apply() without awaiting render; subscribe reconciles. revert+toast on apply() error. | ✓ |
| Whole row; await apply(); subscribe re-renders | Single source of truth; IDB write in visible path; tighter against NFR-02 budget. | |
| Checkbox affordance; await + render | Visible checkbox; await apply(); re-render. Adds visual noise. | |

**User's choice:** Optimistic flip + apply + subscribe reconcile (recommended).
**Notes:** User asked which is more user-friendly between Options 1 and 2. Recommended Option 1 based on instant tap-to-visual response across all device classes; rollback path is small and bounded. Subscribe path still serves cross-tab broadcasts uniformly.

---

### Q2: Completed visual treatment + Polish name_pl surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Checkmark + opacity + always-visible muted Polish line | Two-line row; Polish always visible. | |
| Filled background + strikethrough + long-press Polish reveal | Single-line; gesture reveal. | |
| ✓ + strikethrough + ⓘ tooltip-on-tap for Polish | Single-line; discoverable ⓘ button reveals Polish. | ✓ |

**User's choice:** ⓘ tooltip on tap (Option 3).
**Notes:** User framed Polish as "for when user forgot what this habit is" — i.e., a discreet rescue, not a primary surface. Discoverability of ⓘ icon + iOS long-press text-callout quirk argued against long-press. ⓘ click must stopPropagation so row's mark-complete handler doesn't also fire.

---

### Q3: Today header content (CORE-05)?

| Option | Description | Selected |
|--------|-------------|----------|
| `Wed 27 May` + `Wave 4` (single active wave) | Short date + single highest-current wave. | ✓ |
| Date with year + all running waves | Denser. | |
| ISO date + `Week 22 of 47` | Programmer-style. | |

**User's choice:** Short date + single active wave.

---

### Q4: Where does the wave→start-week mapping live in P3?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline map in `js/domain/wave.js` | Hardcoded constants. | |
| Extend seed: `seed/waves.json` | Waves as first-class seed data. | ✓ |
| Defer wave context to P4 | Leave header slot empty. | |

**User's choice:** Extend seed with `seed/waves.json`.

---

### Q5: How are waves stored at runtime?

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only — fetch at boot, cache in `js/domain/wave.js` | No IDB persistence in P3. P4 promotes to IDB. | ✓ |
| Store in `meta.waves = [...]` | Reuse existing meta store. | |
| Bump DB_VERSION to 2; add `waves` store | First real migration. | |

**User's choice:** In-memory only.

---

### Q6: Empty state behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Two distinct states | "No habits scheduled today" vs "All done today — see you tomorrow" + counter. | ✓ |
| Always render the list | No empty state copy; visual state communicates done-ness. | |
| Daily summary counter at top | Header gains a "0 / 8 done today" counter. | |

**User's choice:** Two distinct states.

---

### Q7: Vibration on tap?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 10ms haptic | Reinforces instant response. | |
| No — keep mobile silent | Avoids iOS/Android inconsistency. | ✓ |
| Only on errors | Haptic as "something went wrong" signal. | |

**User's choice:** No vibration.

---

## Settings shell + Today↔Settings navigation

### Q1: Shell + navigation pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Single index.html, hash routing | New `js/router.js` listens to `hashchange`; toggles panels. | ✓ |
| Single index.html, button show/hide | No URL; just hidden flag toggle. | |
| Separate `settings.html` shell | Full page navigation; SW SHELL grows. | |

**User's choice:** Hash routing via `js/router.js`.

---

### Q2: Settings panel structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list of cards, top-down by importance | Storage → Schedule → Install → Data → About. | ✓ |
| Collapsible accordion sections | Same content, collapse state to manage. | |
| Sub-tabs within Settings | Two-level navigation. | |

**User's choice:** Flat cards.
**Notes:** User asked to note collapsible/tabs as a future-release idea when Settings grows.

---

### Q3: PWA-07 install-help platform detection?

| Option | Description | Selected |
|--------|-------------|----------|
| Feature-test first, UA as fallback | Detect standalone + `BeforeInstallPromptEvent`; UA branch for iOS. | |
| UA-only switch | UA sniffing. | |
| Show all three labeled (iOS / Android / Desktop) | No detection logic; user picks. | ✓ |

**User's choice:** Show all three labeled, no detection.

---

### Q4: SETTINGS-04 persistence card?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: status + retry button + storage estimate | Live persisted() + Request button + estimate(). | ✓ |
| Status + retry button only | No estimate. | |
| Status + estimate only | No retry button. | |

**User's choice:** Hybrid (recommended).
**Notes:** User asked which is most user-friendly. Recommended hybrid: Option 1's retry button is the most leveraged UI, Option 3's estimate is reassurance for a multi-year tracker — combine.

---

### Q5: SETTINGS-05 About card content?

| Option | Description | Selected |
|--------|-------------|----------|
| App + schema version only | Minimal. | |
| App + schema + cache name + SW state | Mirrors diagnostics. | ✓ |
| App + schema + repo link | External navigation surface. | |

**User's choice:** Four rows mirroring diagnostics.

---

### Q6: Data card layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Two sub-blocks: Undo + Reset-data (destructive) | Clear separation. | ✓ |
| Three blocks (incl. Reset shell) | Mirror all three diagnostics actions. | |
| Undo only; Reset stays in diagnostics | Reverses D-44. | |

**User's choice:** Two sub-blocks.

---

## Undo surface + behavior

### Q1: Where can the user trigger Undo from?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast (auto-appears after tap) + Settings shortcut (always available) | Both surfaces; UNDO-01 verbatim. | ✓ |
| Settings shortcut only — no toast | Sacrifices daily-friction win. | |
| Toast only — no Settings shortcut | Misses UNDO-01 "OR from Settings". | |

**User's choice:** Both surfaces.

---

### Q2: Toast auto-dismiss behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dismiss after 5 seconds (timer resets on hover/tap) | Standard snackbar pattern. | ✓ |
| No auto-dismiss (matches D-08) | Toast stays put. | |
| Auto-dismiss after 10 seconds | Longer window. | |

**User's choice:** 5 seconds with timer reset. `toast.js` grows `{autoDismissMs}` option; D-08 unchanged for `showUpdateToast`.

---

### Q3: Toast stacking on rapid taps?

| Option | Description | Selected |
|--------|-------------|----------|
| Single toast — replace contents on each new tap | Matches UNDO-03 single-step model. | ✓ |
| Stacked toasts — one per tap | Misleading "Undo" buttons on lower toasts. | |
| Single toast — dismiss-and-skip while showing | Suppresses feedback for taps 2/3/4. | |

**User's choice:** Single toast, replace contents (recommended).
**Notes:** User asked which is most user-friendly. Recommended Option 1: stacking is structurally misleading because `undo()` only ever operates on `meta.undoToken` (the most recent event).

---

### Q4: Toast + Settings preview copy granularity?

| Option | Description | Selected |
|--------|-------------|----------|
| Verb + habit name; Settings adds 'N ago' timestamp | "Marked Drink water complete — Undo · ×" + relative time. | ✓ |
| Generic "Action taken — Undo" | Smaller, less informative. | |
| Habit name only; no verb | Compact. | |

**User's choice:** Verb + habit name + timestamp.

---

### Q5: Undo error paths (null vs throw)?

| Option | Description | Selected |
|--------|-------------|----------|
| Null → silent no-op; throw → error toast | Button already disabled in null case; error toast on throw. | ✓ |
| Null → disabled only; throw → console only | Silent failure. | |
| Null → silent; throw → inline error in Settings card | Only visible in Settings. | |

**User's choice:** Null silent, throw shows toast. Error-toast variant reused by Today row's revertRow path.

---

## Pure-view-builders + testing (D-26 Tier 1)

### Q1: P3's testable surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Builders for everything that takes data | Every render = pure builder + mounter. | ✓ |
| Builders only for data-bearing rows | Settings cards mount directly. | |
| Skip builder split | Trust tests-browser.html. | |

**User's choice:** Builders everywhere (recommended).
**Notes:** User asked which is best programmatically. Recommended Option 1: uniform pattern, D-26 alignment, CI-checkable, composable. Cost (2× lines per render) is small.

---

## Accessibility specifics (NFR-06 / NFR-07)

### Q1: A11y baseline scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard a11y baseline | aria-pressed + aria-current + role=status + focus-on-route-change + no color-only state. | ✓ |
| Minimal — semantic HTML only | Skip aria-* + focus management. | |
| Defer non-touch a11y to later phase | Only enforce touch-target part. | |

**User's choice:** Standard baseline (recommended).
**Notes:** User asked which is best programmatically. Recommended Option 1: platform semantics are the cheapest a11y, compose with the builders (attrs live in `{tag, attrs, children}`), and NFR-06/07 are already mapped to P3.

---

## History tab placeholder behavior in P3

### Q1: How does the History tab behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible, disabled anchor with "Coming in Phase 4" tooltip | Three-tab footer; signals roadmap. | ✓ |
| Hidden entirely until P4 | Two-tab footer. | |
| Visible link to "Coming soon" placeholder panel | Third panel exists. | |

**User's choice:** Visible-but-disabled with tooltip.

---

## SW SHELL precache strategy

### Q1: What goes in SHELL?

| Option | Description | Selected |
|--------|-------------|----------|
| Add new JS + CSS to SHELL; seed/ via SWR | App-shell precached; data runtime-cached. | ✓ |
| Everything (incl. seed JSON) in SHELL | Maximum predictability; seed edits force SW bump. | |
| Nothing in SHELL — all SWR | Smallest SHELL; offline first-launch risk. | |

**User's choice:** Option 1 (recommended).
**Notes:** User asked which is best programmatically. Recommended Option 1: standard app-shell pattern — JS/CSS = shell, JSON datasets = data. Seed edits don't force SW version bumps.

---

## Reset-data confirm copy

### Q1: Same text or context-aware variant?

| Option | Description | Selected |
|--------|-------------|----------|
| Same verbatim D-06-style text | Single source of truth. | |
| Settings-flavored variant | Plain user-facing prose. | ✓ |
| Same text + typed-confirmation input | Defense in depth. | |

**User's choice:** Settings-flavored variant.
**Notes:** User asked which is best programmatically AND for UX. Programming-best is Option 1 (single string); UX-best is Option 2 (user-facing prose, not debug jargon). Resolution: they're "two distinct strings for two contexts" — not versions of the same string. Both first-class; diagnostics keeps D-06 verbatim.

---

## Toast XSS safety with Polish content

### Q1: Enforcement approach as P3 adds new mount points?

| Option | Description | Selected |
|--------|-------------|----------|
| CI discipline grep test | Same shape as P2's `indexedDB.open` test. | ✓ |
| Code review only | No automated check. | |
| Centralized `mount(desc)` helper using textContent | Safety by construction. | ✓ |

**User's choice:** Both Option 1 and Option 3 (recommended).
**Notes:** User asked which is best programmatically. Recommended both: discipline test is the floor (mechanical safety, CI gate), `mount()` helper is the elegant path (makes intended path easy). They compose: helper makes safe DOM construction the default; grep test catches anyone bypassing it.

---

## Cross-tab Settings refresh

### Q1: Should Settings' Undo card live-update on cross-tab broadcasts?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — subscribe to `store.notify()` | Symmetric with Today panel. | ✓ |
| Refresh only on (re-)mount | Snapshot at navigation. | |
| Don't worry about it in v1 | Stale view acceptable. | |

**User's choice:** Subscribe (recommended on both axes).
**Notes:** User asked for both programmatic and UX perspectives. Both point to Option 1: programming-wise it reuses the established subscribe pattern; UX-wise it prevents the silent-undo-wrong-action bug when peer tabs mutate.

---

## Claude's Discretion

- CSS class names for new components (`.today-row`, `.settings-card`, `.toast--error`, etc.)
- Router internal shape (routes map vs. switch in `router.js`)
- `mount()` event delegation API shape (`{actions: {...}}` vs. global delegated click reading `data-action`)
- Exact prose for the three install-help panels (content scope is locked; copy is planner's call)
- Storage estimate display precision and unit choice ("0.4 MB" vs "443 KB")
- Plan breakdown for P3 — likely splits suggested in CONTEXT.md decision D-Claude's Discretion section; planner judges based on commit-atom sizing

## Deferred Ideas

- Wave model as first-class IDB store + DB_VERSION 1→2 migration (P4)
- Cadence engine full surface — DST/leap-day edges, grace-period overlap, month-end (P4)
- Collapsible / sub-tab Settings layout (post-v1)
- Storage estimate richer view ("Storage breakdown")
- Hash router beyond `#today` / `#settings` / `#history` (P4+)
- `BeforeInstallPromptEvent` capture for programmatic install button (post-v1)
- Toast queue for batched-action feedback (revisit when bulk operations land)
- Per-row long-press context menu from Today (reserve for P4 catalog ops)
- `markUncompleted` with optional `notes`/`reason` field (future enhancement)
- "Are you sure?" dialog when `weekStart` changes mid-week affect already-completed habits (P4 if needed)
