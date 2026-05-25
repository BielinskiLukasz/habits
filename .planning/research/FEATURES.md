# Feature Research

**Domain:** Personal habit tracker (offline-first PWA), single-user, formalizing an existing 47-week wave plan
**Researched:** 2026-05-26
**Confidence:** HIGH (most features pre-declared in PROJECT.md; categorization is the work)

---

## Scope of This Document

Most features are already locked in `.planning/PROJECT.md`'s Active section. This file CATEGORIZES them and contributes one focused new piece of analysis: **three alternative scoring/ranking models** the user picks one of in the requirements phase.

Mobile (M) vs Desktop (D) annotations indicate the **primary surface** — both layouts are deliberately distinct (mobile = daily check-in, desktop = analytics/planning), per PROJECT.md's locked architecture.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = the app fails the daily-check-in job-to-be-done.

| # | Feature | Surface | Complexity | Why Expected |
|---|---------|---------|------------|--------------|
| T1 | **Today view** — list of today's due habits, single-tap mark complete | M | M | The literal core loop. If this is friction-ful, the system collapses. |
| T2 | **Habit catalog CRUD** — create / edit / delete / reorder habits | D | M | Long-term tool over multi-year horizon; the user must be able to maintain ~65+ habit definitions without engineering each one as code. |
| T3 | **Cadence engine** — daily, day-of-week (`[pn-pt]`, `[sb]`, `[nd]`), every-N-days (`co 2 dni`) | both | M | The existing system encodes this directly in habit names; without it, "today's habits" is wrong. |
| T4 | **History view + edit prior days** — navigate to any past day, mark/unmark | both | M | Real life means same-day check-in fails sometimes; tracker becomes untrustworthy if you can't backfill. |
| T5 | **Offline operation (PWA)** — install, work without network | M | M | Daily check-in cannot depend on connectivity; expected by anyone who has used Streaks/Loop. |
| T6 | **Local persistence (IndexedDB) + JSON export/import** — data survives, user can back up | both | M | Years of personal data with no cloud sync → backup is non-optional. |
| T7 | **Stages** (etap 1 → etap 2 → etap 3) with progressive targets | both | M | Already in the xlsx model; the user's system is built around progression, not binary done/not-done. |
| T8 | **Multi-occurrence logging** — both `+1` numeric counter AND slot-checklist styles, per-habit choice | M | M | "5 things gratitude" vs "7 meatless meals" — different habits naturally want different counters; the system already differentiates these. |

**Total:** 8 table stakes. All M or M-complexity (no L). All declared in PROJECT.md.

---

### Differentiators (Distinguish This From Habitica/Streaks/Loop/Productive)

What makes this app the user's tool and not a generic tracker.

| # | Feature | Surface | Complexity | Value Proposition |
|---|---------|---------|------------|-------------------|
| D1 | **Wave / Fala model** — habits tagged with a wave; wave-level aggregate metrics (completion %, count by status, longest active streak, "wave at risk") | D | M | The user's 47-week plan introduces habits in coordinated batches. No generic tracker understands "wave 4 is at risk because three of its seven habits are slipping." |
| D2 | **Mastery without hiding** — threshold-based "mastered" badge (90% / 70d, configurable globally + per-habit override); mastered habits stay visible on Today, just muted | M | M | Generic trackers either keep habits forever (no closure) or archive them (no continued reinforcement). The user wants the *third path*: graduate but keep feeding. |
| D3 | **Multi-trigger stage advancement** — each habit declares any combination of: manual button, scheduled by wave-week, automatic after N days at current stage | both | L | Honors the diversity of the existing system: some habits step up by calendar, some by effort, some on-demand. Generic trackers force one progression mode. |
| D4 | **Definition edits don't rewrite history** — habit identity preserved across edits; prior logs stay anchored to their definition-at-the-time | both | M | Trust. The user has tuned thresholds across months ("zmniejszono start z 5,5k na 4k"); a tracker that retroactively repaints history is useless for long-term self-knowledge. |
| D5 | **Two-surface design** — mobile is genuinely a check-in app; desktop is genuinely an analytics dashboard. Not one responsive layout. | both | M | Generic trackers are mobile-only or scale a mobile layout to desktop. This user does daily check-in on phone and weekly review on a real screen — two jobs, two layouts. |
| D6 | **Per-habit edit history + global undo** — every change to definitions and logs is recoverable | D | M | Companion to D4. A tracker for a multi-year personal system has to be forgiving of mistakes without that being a "feature." |
| D7 | **CSV export (flattened, Excel-pasteable)** in addition to JSON | D | S | The user actually does ad-hoc analysis in Excel. JSON is for the app; CSV is for the human. Generic trackers ship one export at best. |

**Total:** 7 differentiators. None depend on cloud, social, or AI. All emerge directly from honoring the user's existing system.

---

### Anti-Features (Deliberately NOT Built)

Includes PROJECT.md's "Out of Scope" plus competitor-inspired features that *don't fit this user*.

| # | Anti-Feature | Why Requested / Why Competitors Have It | Why Wrong For This User | Alternative |
|----|--------------|------------------------------------------|--------------------------|-------------|
| A1 | **Push reminders / notifications** | Streaks, Productive, Habitica all nag | User explicitly opts out of nag; daily ritual is intrinsically motivated | Calendar / habit-stacked cues (out-of-app) |
| A2 | **Cloud sync / multi-device** | Productive, Habitica | Single-device use; sync adds backend, accounts, conflict resolution | JSON export/import is sufficient backup; data model is sync-ready for later |
| A3 | **Multi-user / accounts / social** | Habitica's whole model | User is the sole user; social adds zero value to a private practice | None — single-user only |
| A4 | **Streak counters as primary metric** | Streaks app's entire identity; nearly all trackers | "Streak-as-shame" — one missed day erases months of progress and creates avoidance behavior; misaligns with the user's threshold model (90%/70d, *not* 100% forever) | Rolling-window % (threshold mastery model); streak data can still be *visible* but is not the score |
| A5 | **Gamification (XP, levels, avatars, party quests)** | Habitica's core mechanic | The user's system *is* the meaning; bolting on fake game mechanics insults the actual reward (waves graduating to mastery) | Wave/stage progression is already the game, anchored in real life |
| A6 | **Punishment for missing (HP loss, broken streaks, red flags)** | Habitica, Streaks | Shame loops cause abandonment; user's threshold model explicitly allows 10% miss rate as healthy | Muted/at-risk *signaling*, not punishment |
| A7 | **In-app reminders to "improve" / coaching / AI suggestions** | Productive, newer trackers | The user has a fully specified system. The app is a recorder, not a coach. | Plain trust in user's plan |
| A8 | **In-app xlsx/txt importer** | None really — but tempting | Seed data is one-shot and hand-curated; importer code is a maintenance hazard for a single user | Bundled JSON seed, regenerated offline if needed |
| A9 | **Framework / bundler / npm dependencies** | Every modern tracker | Deliberate longevity constraint; mirrors `mindful-breathing`; zero-dependency apps survive decades | Vanilla ES modules, multi-file static |
| A10 | **Polish UI localization** | Implied by Polish habit names | UI chrome stays English; habit names are user data, not UI strings — no i18n layer needed | English UI + Polish data; clean separation |
| A11 | **Direct port of xlsx's "WYNIK SKORYGOWANY" formula** | Path of least resistance | The xlsx scoring was a working draft, not a designed system; deserves a deliberate rethink | See Scoring Model Alternatives below |
| A12 | **Server-side analytics / telemetry** | Standard SaaS practice | Personal data, single user, privacy-by-design | None; app never phones home |
| A13 | **Polished onboarding flow** | Every consumer app | User IS the author; onboarding is git clone + seed JSON | Seed data + a short README in the repo |
| A14 | **Mood / journal / freeform notes** | Way of Life, Daylio | Scope creep; not in the existing system; would dilute the daily-check-in focus | Defer to v2+ if ever requested |
| A15 | **"Replace habit" vs "edit habit" distinction** | Some trackers force this to preserve history | Already solved by D4 (edits don't rewrite history); two-concept UI would confuse for zero benefit | Single Edit action, never destructive |

**Key insight:** Categories A4, A5, A6 collectively define the *anti-Habitica* posture. This app is not a game; it is a long-term mirror.

---

## Scoring / Ranking Model Alternatives

**Context:** The xlsx column `WYNIK SKORYGOWANY` exists but is explicitly listed as "to be rethought in research" in PROJECT.md's Out of Scope. The user wants to pick from a small set of distinct alternatives in the requirements phase.

**Design requirements for ANY scoring model the user picks:**
- Must work with the threshold/mastery model (90%/70d default), not against it
- Must not reward streak-perfection (anti-A4, anti-A6)
- Must produce a per-habit score AND something rankable (which habits to look at first)
- Must be computable from raw logs without server help
- Must be explainable in one sentence to the user (it's HIS scoring system; he must understand it without a manual)

Below are three deliberately distinct options. They are not on a spectrum — they answer different questions.

---

### Option S1: **Rolling Threshold Health** (status-oriented)

**Question it answers:** "Which habits are currently healthy vs at-risk vs failing?"

**Formula sketch:**
```
score_pct(habit, today) = completed_days(habit, [today-N+1 .. today]) / eligible_days(habit, [today-N+1 .. today])

where N = habit.window_days (default 70)
      eligible_days respects cadence (every-2-days habit gets ~35 eligible days in 70)

status =
  >= habit.threshold (default 0.90) AND has stayed there >= 14 days  → MASTERED
  >= habit.threshold                                                  → HEALTHY
  >= 0.70                                                             → WATCH
  >= 0.50                                                             → AT_RISK
  <  0.50                                                             → FAILING

rank_value = (habit.threshold - score_pct), descending  → at-risk habits surface first
```

**Incentivizes:** Sustained, threshold-meeting behavior. Recovery (failing → healthy) is fully possible — there is no permanent penalty.

**Punishes:** Nothing intrinsically. Below-threshold = visible status change, not score deletion.

**Complexity:** S. Direct extension of the threshold model already in PROJECT.md (T7-adjacent).

**Fit for this user:** HIGH. It IS the xlsx model, cleaned up. Same mental model the user already operates with. Risk: may feel "too simple" — but simplicity is a feature for a long-term tool.

**Drawback:** No single number across all habits. Need a separate "overall" rollup (e.g., share of habits in HEALTHY/MASTERED) for a dashboard headline.

---

### Option S2: **Day-Weighted Wave Score** (momentum-oriented)

**Question it answers:** "How am I doing *this week / this month*, and which waves are slipping?"

**Formula sketch:**
```
For each completed log at day d (0 = today, 1 = yesterday, ...):
  weight(d) = 0.5 ^ (d / half_life_days)        # default half_life = 21 days

habit_score = sum( weight(d) for each completed day d in window ) / sum( weight(d) for each eligible day d in window )

wave_score = mean( habit_score ) for habits in wave, weighted by stage
             (stage-2 habits count 1.5x, stage-3 count 2x — harder targets matter more)

overall_score = mean(wave_score) across active waves
```

**Incentivizes:** Recent consistency. A bad month two years ago does not drag down today's number; a bad *week* is felt.

**Punishes:** Recent slippage. Old slippage decays away naturally.

**Complexity:** M. Exponential decay is one-liner; stage weighting needs a small lookup. Explaining "exponential decay" to future-self may need a tooltip ("recent days count more, older days fade").

**Fit for this user:** MEDIUM-HIGH. Matches the user's actual review rhythm (weekly/monthly looks at the desktop dashboard). Wave-level rollup is native, which honors the wave architecture (D1). Mild risk: half-life is a magic number that may need tuning.

**Drawback:** Mastered habits with old-but-perfect records don't get celebrated; they just blend in.

---

### Option S3: **Load-Adjusted Capacity Score** (sustainability-oriented)

**Question it answers:** "Am I taking on too much? Which habits should I drop, master-and-mute, or postpone?"

**Formula sketch:**
```
active_load(today) = count of non-mastered habits eligible on `today`

per_habit_completion(habit, today) = completed / eligible over window N
expected_completion(today) = f(active_load) — empirical curve
                             (e.g., baseline 90% at load ≤ 8 habits/day,
                              degrading to 60% at load ≥ 20 habits/day)

habit_score = per_habit_completion / expected_completion
              capped at 1.5 (over-performing under heavy load = bonus, not infinity)

graduation_credit: each MASTERED habit adds +0.05 multiplier to overall_score
                   (max +0.50, i.e., 10 mastered habits)

overall_score = mean(habit_score across active habits) * (1 + graduation_credit)
```

**Incentivizes:** Right-sizing the active set. Mastering and muting frees capacity; over-loading is visibly penalized via the curve.

**Punishes:** Carrying too many active habits at once — the user sees their score sag *because of overcommitment*, not because of weakness.

**Complexity:** L. Requires defining the `expected_completion(load)` curve (probably 2-3 points the user picks: easy / typical / overloaded). Needs careful UI to explain "your score went down because you added 3 new habits this wave, not because you failed."

**Fit for this user:** MEDIUM. Powerful match for the wave model (waves explicitly stagger habit introduction — load-awareness is literally what waves are for). Risk: most novel of the three; hardest to explain; most degrees of freedom to tune.

**Drawback:** Sensitive to the load curve. Wrong curve → wrong signal. Needs the user to commit to a calibration.

---

### Scoring Comparison Matrix

| Model | Answers | Complexity | Risk | Best If User Wants... |
|-------|---------|------------|------|------------------------|
| **S1 Rolling Threshold Health** | "Which habits need attention?" | S | Low | Clarity + close match to existing xlsx mental model |
| **S2 Day-Weighted Wave Score** | "How am I doing recently?" | M | Med | A momentum dashboard; weekly-review-friendly numbers |
| **S3 Load-Adjusted Capacity Score** | "Am I overcommitted?" | L | Med-High | The score itself to actively reflect the wave system's load-staggering intent |

**Researcher's leaning (not a verdict — user picks):** S1 for v1, with hooks to layer S2 on top later. Reasoning: S1 is the lowest-risk path to a working dashboard, fully consistent with the threshold model the user already trusts, and doesn't foreclose adding S2 or S3 elements as additional views in v2. The user gets to see their actual data before deciding whether they want momentum decay (S2) or load-awareness (S3) added.

---

## Feature Dependencies

```
T6 (storage / export)
   └── T1 (Today view)
   └── T7 (stages)         ──┐
   └── T8 (multi-occurrence)─┤
   └── T4 (history)         ─┤
                              ├── D2 (mastery / threshold)
                              ├── D3 (multi-trigger advancement)
                              ├── D4 (edits don't rewrite)
                              └── Scoring model (any of S1/S2/S3)
T3 (cadence)
   └── T1 (Today)             ─── computes "eligible today"
   └── D1 (waves)             ─── waves group habits with cadence rules
   └── Scoring model          ─── eligible_days denominator

T7 (stages) ──enhances──> D2 (mastery — per-stage thresholds possible)
T7 (stages) ──enhances──> Scoring S2 (stage weighting)
T7 (stages) ──enhances──> Scoring S3 (active_load uses non-mastered)

D5 (two layouts) ──conflicts──> "Just make desktop = wider mobile"
                                (must be designed as two views, not one responsive)
```

### Key Dependency Notes

- **Everything depends on T6 (storage).** First phase work, no exceptions.
- **Cadence (T3) is the silent backbone.** Used by Today, by waves, by every scoring formula's denominator. Get it wrong and every metric is wrong.
- **Scoring is leaf-level.** It consumes everything but nothing consumes it (except the dashboard). It can be swapped, re-implemented, or A/B'd between v1 and v2 without breaking core flows.
- **Mastery (D2) and history-integrity (D4) are coupled.** Mastery requires that historical records remain correct under definition edits; D4 makes that possible.

---

## MVP Definition

### Launch With (v1)

The minimum that delivers the daily-check-in promise.

- [ ] T1 Today view
- [ ] T2 Habit catalog CRUD
- [ ] T3 Cadence engine
- [ ] T4 History view + edit prior days
- [ ] T5 PWA offline
- [ ] T6 IndexedDB + JSON export/import + CSV export (T6 + D7)
- [ ] T7 Stages
- [ ] T8 Multi-occurrence logging
- [ ] D1 Wave model + basic wave metrics
- [ ] D2 Mastery threshold (defaults 90%/70d, configurable + per-habit override)
- [ ] D4 Edits don't rewrite history + per-habit edit history + global undo (D4 + D6)
- [ ] D5 Distinct mobile/desktop layouts
- [ ] Scoring: **one of S1/S2/S3** (user picks in requirements phase)

### Add After Validation (v1.x)

- [ ] D3 Multi-trigger stage advancement — start with manual + scheduled-by-week; auto-after-N-days can land in v1.1 if it slips
- [ ] Wave-at-risk surfacing (visual signal on desktop)
- [ ] Second scoring model as an alternate view (if S1 shipped first, layer S2)

### Future Consideration (v2+)

- [ ] Cloud sync (design data model now to keep this feasible)
- [ ] Reminders (revisit only if user changes mind)
- [ ] Mood / journal / freeform notes (only if user requests)
- [ ] Multi-year retrospective views (after Wave 9 graduates, late 2026)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| T1 Today view | HIGH | MEDIUM | P1 |
| T2 Habit catalog CRUD | HIGH | MEDIUM | P1 |
| T3 Cadence engine | HIGH | MEDIUM | P1 |
| T4 History edit | HIGH | MEDIUM | P1 |
| T5 PWA offline | HIGH | MEDIUM | P1 |
| T6 Storage + JSON export | HIGH | MEDIUM | P1 |
| T7 Stages | HIGH | MEDIUM | P1 |
| T8 Multi-occurrence | HIGH | MEDIUM | P1 |
| D1 Wave model | HIGH | MEDIUM | P1 |
| D2 Mastery (threshold) | HIGH | MEDIUM | P1 |
| D4 History-integrity edits | HIGH | MEDIUM | P1 |
| D5 Two-surface layouts | HIGH | MEDIUM | P1 |
| D7 CSV export | MEDIUM | LOW | P1 |
| Scoring (any of S1/S2/S3) | HIGH | LOW-HIGH (varies) | P1 |
| D3 Multi-trigger advancement | MEDIUM | HIGH | P2 |
| D6 Per-habit edit history (full) | MEDIUM | MEDIUM | P2 |
| Wave-at-risk surfacing | MEDIUM | LOW | P2 |
| Second scoring model | LOW | depends | P3 |
| Cloud sync | LOW (today) | HIGH | P3 |

---

## Competitor Framing (Reference Only)

| Feature | Habitica | Streaks | Loop Habit Tracker | This App |
|---------|----------|---------|--------------------|---------|
| Primary metric | XP / HP | Streak length | Score (decay-weighted %) | Threshold mastery (S1) or one of S2/S3 |
| Failure handling | HP loss, party penalty | Streak resets to 0 | Score decays | Status changes (HEALTHY → WATCH → AT_RISK); no destruction |
| Social | Core feature | None | None | Not built (A3) |
| Cloud sync | Required | Yes | Optional | Not built (A2) |
| Reminders | Yes | Yes | Yes | Not built (A1) |
| Stages / progressive targets | No | No | No (binary) | Native (T7) |
| Wave / batch model | No | No | No | Native (D1) |
| Mastery without hiding | No (archive only) | No (just stops) | No | Native (D2) |
| History-integrity on edit | No (edits change history) | No | Partial | Native (D4) |
| Offline | Limited | Yes | Yes | Yes (T5) |

**Competitive posture summary:** This app rejects the gamification axis entirely (anti-Habitica) and the streak-fetish axis (anti-Streaks). It is closest in spirit to Loop Habit Tracker — also offline, also score-based, also no nag — but adds the structural concepts (waves, stages, multi-trigger advancement, mastery-but-keep-visible) that come from the user's own system.

---

## Sources

- `.planning/PROJECT.md` (HIGH — primary source; the user's locked mental model)
- `Nawyki-fale.txt` (HIGH — wave structure and 47-week timeline)
- Habitica, Streaks, Loop Habit Tracker, Way of Life, Productive (MEDIUM — competitor framing only, per milestone_context; not deep-dived)
- BJ Fogg's tiny-habits framing and threshold-not-streak design literature (LOW — background only; not cited in formulas)

---

*Feature research for: personal habit-tracker app (offline-first PWA, single-user)*
*Researched: 2026-05-26*
