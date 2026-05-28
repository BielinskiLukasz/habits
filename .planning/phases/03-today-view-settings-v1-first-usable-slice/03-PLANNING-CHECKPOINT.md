# Phase 3 Planning — Tomorrow Restart

**Paused:** 2026-05-28
**Reason:** Planner ran out of session time after writing 03-03-PLAN.md; 03-04 / 03-05 / 03-06 still to write.

---

## What is already on disk (DO NOT TOUCH)

- `03-01-PLAN.md` — Wave 1, pure-domain foundations (cadence, wave catalog, repo reads, `mount()`, date utils, D-78 XSS grep gate)
- `03-02-PLAN.md` — Wave 2, Today view renders **read-only** (router, panel, builders, wire-up). Taps NOT wired here.
- `03-03-PLAN.md` — Wave 3, **tap-to-log slice**. Covers CORE-02, CORE-03, LOG-01, NFR-02.
  - Includes `markUncompleted` handler, D-52 `lastCompletedDate` invariant, store re-hydrate on `notify`, Today row tap wiring with optimistic flip + revertRow.

`03-CONTEXT.md` and `03-PATTERNS.md` are unchanged.

## What is still to plan (3 plans)

| Plan | Wave | depends_on | Scope | REQ-IDs |
|------|------|------------|-------|---------|
| **03-04-PLAN.md** | 4 | `[03-03]` | Undo toast surface — extend `js/views/toast.js` with `{autoDismissMs}`, `showUndoToast`, `showErrorToast` (preserve `showUpdateToast` D-08 no-auto-dismiss). Wire from `today.js` mark/unmark success path with D-71 verb+habit-name copy. Swap 03-03's `console.warn` placeholder for `showErrorToast('Couldn\'t mark — try again')`. | UNDO-01, UNDO-02, UNDO-03 |
| **03-05-PLAN.md** | 5 | `[03-03]` | Settings v1 panel — new `js/state/apply/setSetting.js` (D-75) + register in apply.js HANDLERS, new `js/views/settings.js` + `js/views/settings/builders.js` (5 cards: Storage / Schedule / Install / Data / About per D-61..D-66), new `css/settings.css` + `@import` line in `css/main.css`, wire into `js/main.js` router map. Data card subscribes to `store.notify()` per D-72. Settings-flavored Reset-data confirm per D-67 (NOT D-06 diagnostics text). | SETTINGS-04, SETTINGS-05, PWA-07, UNDO-01 (2nd surface) |
| **03-06-PLAN.md** | 6 | `[03-05]` | SW SHELL update (grow by 9 entries per D-81) + bump `APP_VERSION` `'0.2.0'` → `'0.3.0'` per D-28 + History tab disabled-anchor (D-80) + README / VERSIONING.md touch. | (closeout — must_haves only) |

**Full requirement coverage when all 6 plans land:** CORE-01..06, LOG-01, UNDO-01..03, SETTINGS-04, SETTINGS-05, PWA-07, NFR-01, NFR-02, NFR-06, NFR-07 — all 17.

## Decisions already made in this session

- **Strategy:** add more plans (preserve 03-01 / 03-02 verbatim) — chosen via AskUserQuestion.
- **Nyquist gate:** "Continue anyway" — no VALIDATION.md required for this run (same state as when 03-01 / 03-02 were planned). You will be asked again tomorrow; answer the same way.
- **MVP_MODE = true** (vertical slices, not horizontal layers). WALKING_SKELETON = false (phase 3, not 1).
- **TDD_MODE = true** — handler / invariant / toast-behavior / setSetting tasks get `type: tdd`; UI mount / CSS / glue tasks stay `type: execute`.
- **No commits yet** — ROADMAP annotate + `docs(03): create phase plan` commit happens after 03-04 / 03-05 / 03-06 land and pass the plan-checker.

## Tomorrow — exact restart sequence

1. `/clear` (start a fresh context).
2. Run:
   ```
   /gsd-plan-phase 3 --skip-research --skip-ui
   ```
3. When asked "Phase 3 already has 3 plans — how should I proceed?" → choose **Add more plans**.
4. When asked the Nyquist gate question → choose **Continue anyway**.
5. The planner will pick up at 03-04 / 03-05 / 03-06 per the table above. The scope, REQ-IDs, depends_on, and Wave numbers are all locked here — paste the table into the planner prompt if needed.
6. After all three plans land, the workflow auto-runs:
   - plan-checker
   - Requirements Coverage Gate
   - Decision Coverage Gate
   - ROADMAP wave-dependency annotation (step 13c)
   - `docs(03): create phase plan` commit (step 13d, `commit_docs: true`)
   - Post-Planning Gap Analysis (step 13e)
   - Auto-advance to `/gsd-execute-phase 3` is enabled by config (`auto_advance: true`) — **stop and review the plan set before letting it auto-advance** if you want to inspect 03-04..06 first.

## If something is off

- If 03-03 looks wrong on review tomorrow, delete it and re-run — the planner will rewrite it as part of additive mode.
- If you want to bypass the per-question prompts entirely, append `--auto` to the command in step 2 — but this will also chain into execute-phase without pause. Only do that if you trust the plan set sight unseen.

## Reference

- Locked decisions: `03-CONTEXT.md` (D-48..D-81)
- Patterns map: `03-PATTERNS.md`
- Discussion log: `03-DISCUSSION-LOG.md`
- Project rules: `CLAUDE.md` (no-npm/no-bundler/no-CDN, JSDoc D-27, two-tier UI testing D-26, anti-stack list)
