/**
 * @file Today view mounter — subscribe + render + return unmount
 * (CORE-01..06, D-52, D-53, D-79).
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
 * Tap wiring (markComplete / markUncomplete / togglePolish) is intentionally
 * NOT wired in Slice 2 — `data-action` attributes are emitted by builders
 * and the `mount()` actions map is empty here. Slice 3 (plan 03-03) binds
 * the closures.
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
  buildFooterNav,
} from './today/builders.js';
import { mount } from '../util/mount.js';
import { currentWave } from '../domain/wave.js';
import { appliesToday } from '../domain/cadence.js';
import { todayLocal } from '../util/date.js';
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
 * Render the Today panel into `parent`. Pure-ish: reads cache via store
 * selectors, builds the description tree, and walks it via `mount()`.
 *
 * @param {object} parent
 * @returns {void}
 */
function renderTodayInto(parent) {
  clearChildren(parent);

  const date = todayLocal();
  const wave = currentWave(date);

  // Header — date + wave.
  mount(buildTodayHeader({ date, wave }), parent, {});

  // Cadence-filter the active habits.
  const weekStart = getCachedWeekStart();
  const ctx = {
    weekStart,
    weekCompletions: (habitId, s, e) => getCachedWeekCompletions(habitId, s, e),
  };
  const allActive = getCachedHabits().filter((h) => h.status === 'active');
  const applicable = allActive.filter((h) => appliesToday(h, date, ctx));

  // Pair each applicable habit with its completion state, then sort completed
  // rows last (D-54 muted treatment).
  const pairs = applicable.map((habit) => ({
    habit,
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
      {},
    );
  } else if (uncompleted.length === 0) {
    mount(
      buildTodayList({
        habits: [],
        allCompleted: true,
        totalApplicable: applicable.length,
      }),
      parent,
      {},
    );
  } else {
    mount(buildTodayList({ habits: ordered }), parent, {});
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
