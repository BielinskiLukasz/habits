/**
 * @file Pure description-tree builders for the Today view (D-26 Tier 1,
 * D-54, D-55, D-56, D-58, D-76, D-79, D-80).
 *
 * Every builder returns `{tag, attrs?, text?, children?}` — the same shape
 * the `mount()` helper (D-77) consumes. NO DOM access here; that lives in
 * `js/views/today.js`. Splitting the two halves keeps the builders trivially
 * unit-testable in Node (Pattern S8) and pushes the XSS-safe DOM
 * construction discipline (D-78 grep gate) to a single seam.
 *
 * Date formatting is locale-deterministic via fixed `WEEKDAY_SHORT` /
 * `MONTH_SHORT` arrays — NOT `Intl.DateTimeFormat`. Predictable output
 * across users and a stable test fixture (D-56).
 *
 * Action attributes (`data-action="markComplete"` etc.) flow through to the
 * `mount(desc, parent, actions)` helper, which binds the matching closure
 * from the `actions` map as a click listener. Tap wiring lands in Slice 3;
 * this slice emits the attributes but does NOT wire the closures.
 *
 * Forbidden constructs in this file:
 *   - Any DOM access (createElement, document.*, etc.) — builders are pure.
 *   - `.innerHTML` family — D-78 grep gate.
 */

import { parseLocalYMD } from '../../util/date.js';
import { t, getLang } from '../../i18n/index.js';

/** English short weekday names indexed by `Date#getDay()` (0=Sun). */
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** English short month names indexed by `Date#getMonth()` (0=Jan). */
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Polish short weekday names indexed by `Date#getDay()` (0=Sun). */
const PL_WEEKDAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

/** Polish short month names indexed by `Date#getMonth()` (0=Jan). */
const PL_MONTH_SHORT = [
  'sty', 'lut', 'mar', 'kwi', 'maj', 'cze',
  'lip', 'sie', 'wrz', 'paź', 'lis', 'gru',
];

/**
 * Format a YYYY-MM-DD as `'Wed 27 May'` — short weekday + day-of-month
 * (no zero-padding) + 3-letter month. Locale-deterministic; exposes as
 * `_` so unit tests can assert the format directly (D-56).
 *
 * @param {string} ymd YYYY-MM-DD
 * @returns {string}
 */
export function _formatTodayDate(ymd) {
  const d = parseLocalYMD(ymd);
  const weekdays = getLang() === 'pl' ? PL_WEEKDAY_SHORT : WEEKDAY_SHORT;
  const months = getLang() === 'pl' ? PL_MONTH_SHORT : MONTH_SHORT;
  return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

/**
 * Build the Today header description: `<header class="today-header">` containing
 * the `<h1 data-app-title>Habits</h1>`, a `<span class="today-date">` carrying
 * the formatted date (D-56), and a `<span class="today-wave">` carrying the
 * wave name (or empty when `wave` is null for layout stability).
 *
 * The `data-app-title` attribute on the h1 preserves the long-press
 * diagnostics hook (D-02) so the title remains the gesture target after
 * the header is rebuilt on every Today render.
 *
 * @param {{ date: string, wave: { number: number, name: string, startDate: string, theme?: string } | null }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildTodayHeader({ date, wave }) {
  return {
    tag: 'header',
    attrs: { class: 'today-header' },
    children: [
      { tag: 'h1', attrs: { 'data-app-title': '' }, text: t('today.title') },
      { tag: 'span', attrs: { class: 'today-date' }, text: _formatTodayDate(date) },
      { tag: 'span', attrs: { class: 'today-wave' }, text: wave != null ? t('catalog.wave', { n: wave.number }) : '' },
    ],
  };
}

/**
 * Build the footer-nav description: a `<nav>` with three anchors —
 * `#today`, `#history`, `#settings` (in that visual order).
 *
 * The active link (matching `activeHash`) carries `aria-current="page"`.
 * The history link is ALWAYS visible-but-disabled (D-80) — carries
 * `aria-disabled="true"`, `tabindex="-1"`, and a `title="Coming in Phase 4"`
 * tooltip.
 *
 * @param {{ activeHash: string, linkBase?: string }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildFooterNav({ activeHash, linkBase = '' }) {
  const linkDefs = [
    { href: `${linkBase}#today`, text: t('nav.today') },
    { href: `${linkBase}#history`, text: t('nav.history') },
    { href: `${linkBase}#catalog`, text: t('nav.catalog') },
    { href: `${linkBase}#settings`, text: t('nav.settings') },
    { href: './desktop.html', text: t('nav.analytics') },
  ];

  return {
    tag: 'nav',
    attrs: { class: 'today-footer-nav', 'aria-label': 'Primary navigation' },
    children: linkDefs.map((link) => {
      /** @type {Record<string, string>} */
      const attrs = { href: link.href };
      if (link.href === activeHash) attrs['aria-current'] = 'page';
      if (link.disabled) {
        attrs['aria-disabled'] = 'true';
        attrs['tabindex'] = '-1';
        attrs['title'] = t('today.phaseTooltip');
      }
      return { tag: 'a', attrs, text: link.text };
    }),
  };
}

/**
 * Build a single Today row description: `<li class="today-row[ today-row--completed|today-row--skipped]">`
 * containing a `.today-row__slide` wrapper (the swipeable content) and a
 * `.today-row__actions` panel (Skip + Fail buttons revealed on swipe-left).
 *
 * Swipe UX (o1g — 4-state log model):
 *   - Swipe right on the slide → commits `markCompleted` (wired in today.js pointer handler).
 *   - Swipe left on the slide → reveals `.today-row__actions` panel.
 *   - Skip button: `data-action="swipeSkip"` → dispatches `markSkipped`.
 *   - Fail button: `data-action="swipeFail"` → dispatches `markUncompleted` (status: 'failed').
 *
 * Inside `.today-row__slide`:
 *   - Uncompleted/failed/skipped: button `aria-pressed="false"`, `data-action="markComplete"`,
 *     `<span class="today-row-name">` with `habit.name`.
 *   - Skipped: name span carries `today-row-name--skipped` (muted italic via CSS).
 *   - Completed: `aria-pressed="true"`, `data-action="markUncomplete"`,
 *     `<span class="today-row-glyph">✓</span>` + `<span class="today-row-name today-row-name--completed">`.
 *
 * The ⓘ disclosure button (D-55, D-79) — `aria-label="Show original Polish name"`,
 * `aria-expanded="false"`, `data-action="togglePolish"` — is omitted entirely
 * when `name_pl` is null/undefined; the slot is not reserved.
 *
 * @param {{ habit: { id: string, name: string, name_pl?: string | null }, status: string | null }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildTodayRow({ habit, status = null }) {
  // Display name: show Polish name when PL lang is active and name_pl exists.
  const displayName = getLang() === 'pl' ? (habit.name_pl ?? habit.name) : habit.name;

  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isSkipped = status === 'skipped';

  /** @type {object[]} */
  const tapChildren = [];
  if (isCompleted) {
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-glyph' },
      text: '✓',
    });
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-name today-row-name--completed' },
      text: displayName,
    });
  } else if (isFailed) {
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-glyph' },
      text: '✕',
    });
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-name today-row-name--failed' },
      text: displayName,
    });
  } else if (isSkipped) {
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-glyph' },
      text: '↷',
    });
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-name today-row-name--skipped' },
      text: displayName,
    });
  } else {
    tapChildren.push({
      tag: 'span',
      attrs: { class: 'today-row-name' },
      text: displayName,
    });
  }

  const tapBtn = {
    tag: 'button',
    attrs: {
      class: 'today-row-tap',
      'aria-pressed': isCompleted ? 'true' : 'false',
      'data-action': isCompleted ? 'markUncomplete' : 'markComplete',
      'data-habit-id': habit.id,
    },
    children: tapChildren,
  };

  /** @type {object[]} */
  const slideChildren = [tapBtn];

  if (habit.name_pl) {
    slideChildren.push({
      tag: 'button',
      attrs: {
        class: 'today-row-info',
        'aria-label': t('today.showPolish'),
        'aria-expanded': 'false',
        'data-action': 'togglePolish',
        'data-habit-id': habit.id,
      },
      text: 'ⓘ',
    });
  }

  const rowClasses = ['today-row'];
  if (isCompleted) rowClasses.push('today-row--completed');
  if (isFailed) rowClasses.push('today-row--failed');
  if (isSkipped) rowClasses.push('today-row--skipped');

  return {
    tag: 'li',
    attrs: { class: rowClasses.join(' ') },
    children: [
      {
        tag: 'div',
        attrs: { class: 'today-row__slide' },
        children: slideChildren,
      },
      {
        tag: 'div',
        attrs: { class: 'today-row__actions' },
        children: [
          {
            tag: 'button',
            attrs: {
              class: 'today-row__action today-row__action--skip',
              'data-action': 'swipeSkip',
              'data-habit-id': habit.id,
            },
            text: t('today.skip'),
          },
          {
            tag: 'button',
            attrs: {
              class: 'today-row__action today-row__action--fail',
              'data-action': 'swipeFail',
              'data-habit-id': habit.id,
            },
            text: t('today.fail'),
          },
        ],
      },
    ],
  };
}

/**
 * Build a numeric counter row description for Today: progress display "X / Y"
 * with + (increment) and − (decrement) buttons (D-88, LOG-05).
 *
 * Row carries `habit-row--complete` class when `count >= habit.target`.
 * The decrement handler (wired at mount time) uses `Math.max(0, count-1)`
 * to prevent underflow to negatives (T-04-09d).
 *
 * @param {{ id: string, name: string, target: number }} habit
 * @param {{ count?: number } | null} log — current log row, or null
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildNumericRow(habit, log) {
  const count = log?.count ?? 0;
  const target = habit.target ?? 1;
  const isComplete = count >= target;
  const displayName = getLang() === 'pl' ? (habit.name_pl ?? habit.name) : habit.name;

  return {
    tag: 'li',
    attrs: { class: isComplete ? 'today-row today-row--numeric habit-row--complete today-row--completed' : 'today-row today-row--numeric' },
    children: [
      {
        tag: 'span',
        attrs: { class: isComplete ? 'today-row-name today-row-name--completed' : 'today-row-name' },
        text: displayName,
      },
      {
        tag: 'span',
        attrs: { class: 'today-row-progress', 'data-progress': '' },
        text: `${count} / ${target}`,
      },
      {
        tag: 'button',
        attrs: {
          class: 'today-numeric-btn today-numeric-btn--decrement',
          'data-action': 'log-decrement',
          'data-habit-id': habit.id,
          'aria-label': `Decrease count for ${habit.name}`,
        },
        text: '−',
      },
      {
        tag: 'button',
        attrs: {
          class: 'today-numeric-btn today-numeric-btn--increment',
          'data-action': 'log-increment',
          'data-habit-id': habit.id,
          'aria-label': `Increase count for ${habit.name}`,
        },
        text: '+',
      },
    ],
  };
}

/**
 * Build a slot-checklist row description for Today (D-89, LOG-03).
 *
 * Collapsed state shows "X / Y slots" + a ▼ toggle button. The slot list
 * is a hidden `<div class="slot-list">` with one toggle per slot — revealed
 * via `data-action="toggle-slots"` in the mounter's action map.
 *
 * Row carries `habit-row--complete` class when all slots are checked.
 * Slot names rendered via `text:` (NEVER innerHTML) per T-04-09c XSS guard.
 *
 * @param {{ id: string, name: string, target?: number, slots?: Array<{name: string}> }} habit
 * @param {{ slots?: Array<{name: string, checked: boolean}> } | null} log
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildSlotRow(habit, log) {
  const habitSlots = habit.slots ?? [];
  const logSlots = log?.slots ?? [];
  const total = habit.target ?? habitSlots.length;
  const displayName = getLang() === 'pl' ? (habit.name_pl ?? habit.name) : habit.name;

  // Build effective slot state: merge habit slot definitions with log state.
  // Use logSlots when available; fall back to unchecked for each habit slot.
  const effectiveSlots = habitSlots.map((hSlot, i) => {
    const lSlot = logSlots[i];
    return { name: hSlot.name, checked: lSlot?.checked === true };
  });

  const checkedCount = effectiveSlots.filter((s) => s.checked).length;
  const isComplete = checkedCount >= total && total > 0;

  /** @type {object[]} */
  const slotItems = effectiveSlots.map((slot, i) => ({
    tag: 'label',
    attrs: { class: 'slot-item' },
    children: [
      {
        tag: 'input',
        attrs: {
          type: 'checkbox',
          class: 'slot-toggle',
          'data-action': 'toggle-slot',
          'data-slot-index': String(i),
          'data-habit-id': habit.id,
          ...(slot.checked ? { checked: '' } : {}),
        },
      },
      {
        tag: 'span',
        attrs: { class: 'slot-label' },
        text: slot.name,
      },
    ],
  }));

  return {
    tag: 'li',
    attrs: { class: isComplete ? 'today-row today-row--slot habit-row--complete today-row--completed' : 'today-row today-row--slot' },
    children: [
      {
        tag: 'span',
        attrs: { class: isComplete ? 'today-row-name today-row-name--completed' : 'today-row-name' },
        text: displayName,
      },
      {
        tag: 'span',
        attrs: { class: 'today-row-progress', 'data-progress': '' },
        text: `${checkedCount} / ${total} ${t('today.slots')}`,
      },
      {
        tag: 'button',
        attrs: {
          class: 'today-slot-toggle',
          'data-action': 'toggle-slots',
          'data-habit-id': habit.id,
          'aria-expanded': 'false',
          'aria-label': `Toggle slots for ${habit.name}`,
        },
        text: '▼',
      },
      {
        tag: 'div',
        attrs: { class: 'slot-list', hidden: '' },
        children: slotItems,
      },
    ],
  };
}

/**
 * Build the Today list description. Three branches per D-58:
 *
 *   1. Zero applicable habits → `<div class="today-empty">No habits scheduled today.</div>`
 *   2. All applicable habits completed → `<div class="today-empty today-empty--done">`
 *      with "All done today — see you tomorrow." + "N of N" counter.
 *   3. Otherwise → `<ul class="today-list" aria-label="Today's habits">` with one
 *      `buildTodayRow` per habit.
 *
 * `habits` for the list branch is `Array<{habit, status}>` where `status` is
 * `'completed'|'failed'|'skipped'|null`. The empty / all-done branches use
 * `totalApplicable` for the counter copy.
 *
 * @param {{ habits: Array<{habit: object, status: string|null}>, allCompleted?: boolean, totalApplicable?: number }} args
 * @returns {{ tag: string, attrs: object, text?: string, children?: object[] }}
 */
export function buildTodayList({ habits, allCompleted = false, totalApplicable = 0 }) {
  if (habits.length === 0 && !allCompleted) {
    return {
      tag: 'div',
      attrs: { class: 'today-empty' },
      text: t('today.empty'),
    };
  }
  if (habits.length === 0 && allCompleted) {
    return {
      tag: 'div',
      attrs: { class: 'today-empty today-empty--done' },
      children: [
        { tag: 'p', text: t('today.allDone') },
        {
          tag: 'p',
          attrs: { class: 'today-counter' },
          text: t('today.count', { done: totalApplicable, total: totalApplicable }),
        },
      ],
    };
  }
  return {
    tag: 'ul',
    attrs: { class: 'today-list', 'aria-label': "Today's habits" },
    children: habits.map(({ habit, status }) => buildTodayRow({ habit, status })),
  };
}
