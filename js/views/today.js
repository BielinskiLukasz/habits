/**
 * @file Today view mounter — subscribe + render + return unmount
 * (CORE-01..06, D-52, D-53, D-71, D-73, D-79).
 *
 * Wires the pure description builders (`js/views/today/builders.js`) into
 * real DOM via `mount()` (D-77). `mountToday(parent)` performs the initial
 * render, subscribes to the store's chokepoint notify for re-renders on
 * any (same-tab or cross-tab) mutation, and returns an `unmount()` closure
 * that drops the subscription + clears the parent.
 *
 * Re-render flow:
 *   - `render()` clears the parent and rebuilds the header + list + (no
 *     footer-nav — the footer is a top-level sibling of the route panels,
 *     mounted separately by `mountFooterNav` from `js/main.js`).
 *   - Cadence filtering happens in-render: every active habit runs through
 *     `appliesToday(h, today, ctx)` (D-48..D-51) with `ctx.weekStart` /
 *     `ctx.weekCompletions` bound to the store selectors.
 *   - Completed habits sort LAST per D-54 (muted treatment).
 *   - Three list branches per D-58: empty / all-done / normal.
 *
 * Tap wiring (Phase 03 plan 03, D-53, NFR-02):
 *   - `markComplete` / `markUncomplete` closures are passed to `mount()`'s
 *     `actions` map. When the user taps a row, the corresponding closure:
 *       1. Captures the row's prior `aria-pressed` / `className` /
 *          `data-action` (closure-bound, NOT global) for the revert path.
 *       2. Calls `optimisticFlip(rowEl, 'completed'|'uncompleted')` —
 *          mutates the DOM SYNCHRONOUSLY so the user sees the flip in one
 *          animation frame (NFR-02 <100 ms).
 *       3. `await apply({type: 'markCompleted'|'markUncompleted',
 *          payload: {habitId, date}})`. The chokepoint writes the log row
 *          + D-52 invariant inside one tx, then `notify({event, keys})`
 *          re-hydrates the cache and fans out to subscribers — our
 *          `store.subscribe(render)` closure re-renders against canonical
 *          state.
 *       4. On `apply()` reject → `revertRow(rowEl, priorState)` synchronously
 *          restores the prior DOM (the next `store.subscribe` re-render
 *          rebuilds the row from cache, but revertRow is the immediate
 *          rollback) AND `showErrorToast("Couldn't mark — try again")` is
 *          rendered as user-visible feedback (D-53 + D-73). The 03-03
 *          console.warn placeholder is GONE.
 *       5. On `apply()` resolve → look up the cached habit's `.name`
 *          (post-notify, so the read is canonical per Pitfall 2) and
 *          render `showUndoToast({message: "Marked <name> complete",
 *          undoFn: () => undo()})` (UNDO-01, UNDO-02, D-71).
 *
 * Polish-toggle (`togglePolish`) tap wiring also lands in a future slice —
 * builders emit the `data-action` attribute but the action map omits it
 * here (mount() simply doesn't wire the listener when the closure is
 * absent).
 *
 * `clearChildren` loops `removeChild` instead of `parent.innerHTML = ''`
 * to honor D-78 (the discipline grep gate). The same loop is the only safe
 * way to drop everything when the parent has accumulated event listeners
 * on its children.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Mutating builders' return values — they're pure descriptions.
 *   - Direct DOM construction outside the `mount()` helper.
 */

import {
  buildTodayHeader,
  buildTodayList,
  buildTodayRow,
  buildFooterNav,
  buildNumericRow,
  buildSlotRow,
} from './today/builders.js';
import { mount } from '../util/mount.js';
import { currentWave } from '../domain/wave.js';
import { appliesToday } from '../domain/cadence.js';
import { todayLocal } from '../util/date.js';
import { apply } from '../state/apply.js';
import { undo } from '../state/undo.js';
import { showUndoToast, showErrorToast } from './toast.js';
import {
  subscribe,
  getCachedHabits,
  getCachedLog,
  getCachedWeekStart,
  getCachedWeekCompletions,
} from '../state/store.js';

/** Singleton unsubscribe handle — second mountToday call returns existing unmount. */
let _unsub = null;

/**
 * Clear every child of `parent` without using `.innerHTML = ''` (D-78).
 *
 * @param {object} parent
 * @returns {void}
 */
function clearChildren(parent) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
}

/**
 * Capture the prior state of a row before the optimistic flip. Used by
 * `revertRow` on `apply()` reject (D-53).
 *
 * @param {object} rowEl
 * @returns {{ className: string, ariaPressed: string|null, dataAction: string|null }}
 */
function captureRowPriorState(rowEl) {
  const tapBtn = rowEl.querySelector('.today-row-tap');
  return {
    className: rowEl.className,
    ariaPressed: tapBtn ? tapBtn.getAttribute('aria-pressed') : null,
    dataAction: tapBtn ? tapBtn.getAttribute('data-action') : null,
  };
}

/**
 * Mutate a row's DOM synchronously to reflect the post-tap state, BEFORE
 * `apply()` resolves (NFR-02 <100 ms; D-53).
 *
 * - `'completed'` → add `today-row--completed` class, set `aria-pressed=true`,
 *   set `data-action="markUncomplete"`.
 * - `'uncompleted'` → remove the class, set `aria-pressed=false`, set
 *   `data-action="markComplete"`.
 *
 * The glyph + strikethrough DOM structure is NOT precisely tracked here —
 * `store.subscribe(render)` will rebuild the row from canonical state after
 * `notify()` fires. The aria + class + data-action changes are what carry
 * the visible state until then.
 *
 * @param {object} rowEl
 * @param {'completed'|'uncompleted'} to
 * @returns {void}
 */
function optimisticFlip(rowEl, to) {
  const tapBtn = rowEl.querySelector('.today-row-tap');
  if (!tapBtn) return;
  if (to === 'completed') {
    rowEl.classList.add('today-row--completed');
    tapBtn.setAttribute('aria-pressed', 'true');
    tapBtn.setAttribute('data-action', 'markUncomplete');
  } else {
    rowEl.classList.remove('today-row--completed');
    tapBtn.setAttribute('aria-pressed', 'false');
    tapBtn.setAttribute('data-action', 'markComplete');
  }
}

/**
 * Restore the row to its prior state after `apply()` rejects (D-53). The
 * subsequent `store.subscribe(render)` re-render — which has no fresh
 * mutation to react to in this error path — does NOT fire on its own, so
 * `revertRow` is the only thing that returns the DOM to a sane state.
 *
 * @param {object} rowEl
 * @param {{ className: string, ariaPressed: string|null, dataAction: string|null }} priorState
 * @returns {void}
 */
function revertRow(rowEl, priorState) {
  rowEl.className = priorState.className;
  const tapBtn = rowEl.querySelector('.today-row-tap');
  if (!tapBtn) return;
  if (priorState.ariaPressed !== null) {
    tapBtn.setAttribute('aria-pressed', priorState.ariaPressed);
  }
  if (priorState.dataAction !== null) {
    tapBtn.setAttribute('data-action', priorState.dataAction);
  }
}

/**
 * `markComplete` tap closure — the row's data-action="markComplete" → click
 * listener that mount() wires onto the tap button.
 *
 * Synchronous portion (NFR-02): capture prior + optimisticFlip BEFORE the
 * first `await`. The async portion (await apply) dispatches through the
 * chokepoint; on reject we revertRow.
 *
 * @param {object} evt — fake/real click event carrying `currentTarget`
 * @returns {Promise<void>}
 */
async function handleMarkCompleteTap(evt) {
  const tapBtn = evt.currentTarget;
  const rowEl = tapBtn.closest('.today-row');
  if (!rowEl) return;
  const habitId = tapBtn.getAttribute('data-habit-id');
  const date = todayLocal();
  const priorState = captureRowPriorState(rowEl);
  optimisticFlip(rowEl, 'completed');
  try {
    await apply({ type: 'markCompleted', payload: { habitId, date } });
    // D-71: read habit.name from the post-notify cache (canonical post-write
    // state per Pitfall 2) and render the verb+habit Undo toast. Graceful
    // fallback to '(habit)' when the row was archived cross-tab mid-tap.
    const habitName = getCachedHabits().find((h) => h.id === habitId)?.name ?? '(habit)';
    showUndoToast({
      message: `Marked ${habitName} complete`,
      undoFn: () => undo(),
    });
  } catch (_err) {
    // D-53 + D-73: user-visible error feedback on apply() reject.
    revertRow(rowEl, priorState);
    showErrorToast("Couldn't mark — try again");
  }
}

/**
 * `markUncomplete` tap closure — symmetric inverse of handleMarkCompleteTap.
 *
 * @param {object} evt
 * @returns {Promise<void>}
 */
async function handleMarkUncompleteTap(evt) {
  const tapBtn = evt.currentTarget;
  const rowEl = tapBtn.closest('.today-row');
  if (!rowEl) return;
  const habitId = tapBtn.getAttribute('data-habit-id');
  const date = todayLocal();
  const priorState = captureRowPriorState(rowEl);
  optimisticFlip(rowEl, 'uncompleted');
  try {
    await apply({ type: 'markUncompleted', payload: { habitId, date } });
    // D-71: verb+habit Undo toast (mirrors markComplete branch).
    const habitName = getCachedHabits().find((h) => h.id === habitId)?.name ?? '(habit)';
    showUndoToast({
      message: `Marked ${habitName} uncomplete`,
      undoFn: () => undo(),
    });
  } catch (_err) {
    // D-53 + D-73: user-visible error feedback on apply() reject.
    revertRow(rowEl, priorState);
    showErrorToast("Couldn't mark — try again");
  }
}

/**
 * RENDERERS dispatch table (Pitfall 5 — no if-else chain).
 * Maps `habit.targetType` to the pure builder for that row variant.
 * Binary row builder has a different signature ({habit, completed}) so it is
 * wrapped to match the (habit, log) signature used by the dispatch loop.
 *
 * @type {Record<string, (habit: object, log: object|null) => object>}
 */
const RENDERERS = {
  binary: (habit, log) => buildTodayRow({ habit, completed: log?.completed === true }),
  numeric: buildNumericRow,
  'slot-checklist': buildSlotRow,
};

/**
 * Handle log-increment tap: increment count by 1 and call logNumeric.
 *
 * T-04-09d: decrement uses Math.max(0, count-1) to prevent negative counts.
 *
 * @param {object} evt
 * @returns {Promise<void>}
 */
async function handleLogIncrementTap(evt) {
  const btn = evt.currentTarget;
  const habitId = btn.getAttribute('data-habit-id');
  const date = todayLocal();
  const log = getCachedLog(habitId, date);
  const currentCount = log?.count ?? 0;
  try {
    await apply({ type: 'logNumeric', payload: { habitId, date, count: currentCount + 1 } });
  } catch (_err) {
    showErrorToast("Couldn't update count — try again");
  }
}

/**
 * Handle log-decrement tap: decrement count (floor at 0) and call logNumeric.
 *
 * @param {object} evt
 * @returns {Promise<void>}
 */
async function handleLogDecrementTap(evt) {
  const btn = evt.currentTarget;
  const habitId = btn.getAttribute('data-habit-id');
  const date = todayLocal();
  const log = getCachedLog(habitId, date);
  const currentCount = log?.count ?? 0;
  // T-04-09d: Math.max(0, ...) prevents underflow to negatives
  const newCount = Math.max(0, currentCount - 1);
  try {
    await apply({ type: 'logNumeric', payload: { habitId, date, count: newCount } });
  } catch (_err) {
    showErrorToast("Couldn't update count — try again");
  }
}

/**
 * Handle toggle-slots tap: show/hide the slot-list div inside the row.
 *
 * @param {object} evt
 * @returns {void}
 */
function handleToggleSlotsTap(evt) {
  const btn = evt.currentTarget;
  const rowEl = btn.closest('.today-row--slot');
  if (!rowEl) return;
  const slotList = rowEl.querySelector('.slot-list');
  if (!slotList) return;
  const isHidden = slotList.hasAttribute('hidden');
  if (isHidden) {
    slotList.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    slotList.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Handle toggle-slot tap: toggle one slot's checked state and call logSlot.
 *
 * @param {object} evt
 * @returns {Promise<void>}
 */
async function handleToggleSlotTap(evt) {
  const input = evt.currentTarget;
  const habitId = input.getAttribute('data-habit-id');
  const slotIndex = Number(input.getAttribute('data-slot-index'));
  const date = todayLocal();
  const log = getCachedLog(habitId, date);
  const habit = getCachedHabits().find((h) => h.id === habitId);
  if (!habit) return;

  // Build the full slots array, toggling the targeted slot.
  const habitSlots = habit.slots ?? [];
  const existingSlots = log?.slots ?? habitSlots.map((s) => ({ name: s.name, checked: false }));
  const newSlots = existingSlots.map((s, i) =>
    i === slotIndex ? { ...s, checked: !s.checked } : s,
  );
  try {
    await apply({ type: 'logSlot', payload: { habitId, date, slots: newSlots } });
  } catch (_err) {
    showErrorToast("Couldn't update slot — try again");
  }
}

/**
 * Render the Today panel into `parent`. Pure-ish: reads cache via store
 * selectors, builds the description tree, and walks it via `mount()` with
 * the tap-action closures bound.
 *
 * Uses the RENDERERS dispatch table to select the correct row builder per
 * `habit.targetType` (binary / numeric / slot-checklist).
 *
 * @param {object} parent
 * @returns {void}
 */
function renderTodayInto(parent) {
  clearChildren(parent);

  const date = todayLocal();
  const wave = currentWave(date);

  /** @type {Record<string, (e: object) => void>} */
  const actions = {
    markComplete: handleMarkCompleteTap,
    markUncomplete: handleMarkUncompleteTap,
    'log-increment': handleLogIncrementTap,
    'log-decrement': handleLogDecrementTap,
    'toggle-slots': handleToggleSlotsTap,
    'toggle-slot': handleToggleSlotTap,
    // togglePolish: bound in a future slice (D-55 inline popover lives there).
  };

  // Header — date + wave.
  mount(buildTodayHeader({ date, wave }), parent, actions);

  // Cadence-filter the active habits.
  const weekStart = getCachedWeekStart();
  const ctx = {
    weekStart,
    weekCompletions: (habitId, s, e) => getCachedWeekCompletions(habitId, s, e),
  };
  const allActive = getCachedHabits().filter((h) => h.status === 'active');
  // Habits completed today remain visible (sorted last per D-54) even when cadence returns false
  // — provides visual confirmation of same-day completions.
  const applicable = allActive.filter(
    (h) => appliesToday(h, date, ctx) || getCachedLog(h.id, date)?.completed === true
  );

  // Pair each applicable habit with its completion state and log, then sort
  // completed rows last (D-54 muted treatment).
  const pairs = applicable.map((habit) => ({
    habit,
    log: getCachedLog(habit.id, date) ?? null,
    completed: getCachedLog(habit.id, date)?.completed === true,
  }));
  // Stable partition: uncompleted first, completed last; preserve order within each group.
  const uncompleted = pairs.filter((p) => !p.completed);
  const completed = pairs.filter((p) => p.completed);
  const ordered = [...uncompleted, ...completed];

  // Decide list shape per D-58.
  if (applicable.length === 0) {
    mount(
      buildTodayList({ habits: [], allCompleted: false, totalApplicable: 0 }),
      parent,
      actions,
    );
  } else if (uncompleted.length === 0) {
    // All applicable habits completed — show done state.
    mount(
      buildTodayList({
        habits: [],
        allCompleted: true,
        totalApplicable: applicable.length,
      }),
      parent,
      actions,
    );
  } else {
    // Render a mixed-type list using the RENDERERS dispatch table.
    // All habits (binary, numeric, slot-checklist) are rendered via RENDERERS.
    const listEl = parent.ownerDocument.createElement('ul');
    listEl.className = 'today-list';
    listEl.setAttribute('aria-label', "Today's habits");
    parent.appendChild(listEl);
    for (const { habit, log } of ordered) {
      const renderer = RENDERERS[habit.targetType] ?? RENDERERS.binary;
      mount(renderer(habit, log), listEl, actions);
    }
  }
}

/**
 * Mount the Today view into `parent`. Subscribes to the store notify
 * channel so any mutation (same-tab or cross-tab) triggers a re-render.
 * Returns an `unmount()` closure that drops the subscription and clears
 * the panel.
 *
 * Idempotent: calling `mountToday` a second time without unmounting first
 * returns the existing unmount closure (no duplicate subscription).
 *
 * @param {object} parent — element to render into (must expose ownerDocument)
 * @returns {() => void} unmount
 */
export function mountToday(parent) {
  if (_unsub) {
    // Already mounted — re-render against the live parent and return the
    // existing unmount. The existing parent is whatever the previous caller
    // passed; we do NOT re-bind. Callers that need to switch parents must
    // call unmount() first.
    renderTodayInto(parent);
    return () => {
      if (_unsub) {
        _unsub();
        _unsub = null;
      }
      clearChildren(parent);
    };
  }

  renderTodayInto(parent);
  _unsub = subscribe(() => renderTodayInto(parent));

  return function unmount() {
    if (_unsub) {
      _unsub();
      _unsub = null;
    }
    clearChildren(parent);
  };
}

/**
 * Mount the footer navigation into `navEl` with the active route hash. Called
 * by the router's `onChange` so the active link's `aria-current="page"`
 * follows the route. Idempotent — clears + rebuilds on every call.
 *
 * @param {object} navEl
 * @param {string} activeHash
 * @returns {void}
 */
export function mountFooterNav(navEl, activeHash) {
  clearChildren(navEl);
  // buildFooterNav returns a <nav> element description; we want its children
  // inside the existing <nav> element instead of nesting nav inside nav.
  const desc = buildFooterNav({ activeHash });
  // Propagate the aria-label onto the existing nav element so screen readers
  // see the same label the builder emits.
  if (desc.attrs && desc.attrs['aria-label']) {
    navEl.setAttribute('aria-label', desc.attrs['aria-label']);
  }
  for (const child of desc.children) {
    mount(child, navEl, {});
  }
}

/**
 * Test-only: clear the module-level subscription handle so fresh-import
 * tests start from a pristine state. Production never calls this.
 *
 * @returns {void}
 */
export function _resetTodayForTest() {
  _unsub = null;
}

/**
 * Test-only handles for the tap helpers. Production NEVER imports these —
 * they're spliced through `mount()` via the actions map.
 *
 * @type {(rowEl: object, priorState: object) => void}
 */
export const _revertRowForTest = revertRow;
/** @type {(rowEl: object, to: 'completed'|'uncompleted') => void} */
export const _optimisticFlipForTest = optimisticFlip;
