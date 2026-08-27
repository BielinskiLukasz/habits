/**
 * @file Pure history view builders (HISTORY-01..06, D-90). No DOM ops.
 *
 * Every builder returns `{tag, attrs?, text?, children?}` — the same shape
 * the `mount()` helper (D-77) consumes. NO DOM access; that lives in
 * `js/views/history.js`. Splitting the two halves keeps the builders
 * trivially unit-testable in Node (Pattern S8) and pushes the XSS-safe DOM
 * construction discipline (D-78 grep gate) to a single seam.
 *
 * Slot name and habit name rendering use `text:` nodes (NEVER .innerHTML)
 * to guard against T-04-09c XSS in user-supplied slot labels.
 *
 * Forbidden constructs in this file:
 *   - Any DOM access (createElement, document.*, etc.) — builders are pure.
 *   - `.innerHTML` family — D-78 grep gate.
 */

/**
 * Build the History view header: date stepper with ← → navigation buttons,
 * a formatted date display, and a collapsible calendar picker.
 *
 * The caller passes `selectedDate` as the display string (already formatted,
 * e.g., "Wed 4 Jun 2026") or a raw YYYY-MM-DD. The builder renders it verbatim.
 *
 * T-04-09b: future navigation is prevented by setting `disabled` on the next
 * button when `canGoForward === false`.
 *
 * @param {string} selectedDate — display string or YYYY-MM-DD
 * @param {boolean} canGoForward — false when selectedDate is today (prevents future nav)
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildHistoryHeader(selectedDate, canGoForward) {
  /** @type {Record<string, string>} */
  const nextAttrs = {
    class: 'stepper-btn stepper-btn--next',
    'data-action': 'next-day',
    'aria-label': 'Next day',
  };
  if (!canGoForward) {
    // T-04-09b: disabled prevents navigating to future dates
    nextAttrs['disabled'] = '';
  }

  return {
    tag: 'header',
    attrs: { class: 'history-header' },
    children: [
      {
        tag: 'button',
        attrs: {
          class: 'stepper-btn stepper-btn--prev',
          'data-action': 'prev-day',
          'aria-label': 'Previous day',
        },
        text: '←',
      },
      {
        tag: 'span',
        attrs: { class: 'history-date' },
        text: selectedDate,
      },
      {
        tag: 'button',
        attrs: nextAttrs,
        text: '→',
      },
      {
        tag: 'button',
        attrs: {
          class: 'stepper-btn stepper-btn--calendar',
          'data-action': 'toggle-calendar',
          'aria-expanded': 'false',
        },
        text: 'Jump to date ▼',
      },
      {
        tag: 'div',
        attrs: { class: 'history-calendar', hidden: '' },
        children: [
          {
            tag: 'input',
            attrs: {
              type: 'date',
              id: 'history-date-picker',
              name: 'history-date-picker',
              'data-action': 'pick-date',
            },
          },
        ],
      },
    ],
  };
}

/**
 * Build a single past-day habit row for the History view.
 *
 * HISTORY-06: uses `version.name` (the definition effective at the log date)
 * rather than `habit.name` for historical accuracy. This prevents retrospective
 * renaming from changing how historical logs appear.
 *
 * T-04-09c: slot names and habit names are rendered via `text:` (textContent),
 * never innerHTML, so user-supplied strings cannot inject markup.
 *
 * @param {{ id: string, name: string, wave?: number }} habit — current habit row
 * @param {{ completed?: boolean, count?: number, slots?: Array<{name: string, checked: boolean}> } | null} log — log row for this date, or null
 * @param {{ name: string, targetType?: 'binary'|'numeric'|'slot-checklist', target?: number }} version — habit_versions entry effective on the selected date
 * @param {string} [date] — selected date YYYY-MM-DD (for data-date attribute)
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildHistoryHabitRow(habit, log, version, date = '') {
  const targetType = version.targetType ?? 'binary';
  const displayName = version.name ?? habit.name;

  // Compute completion display text for the status indicator.
  let statusText;
  if (log === null || log === undefined) {
    statusText = '–';
  } else if (targetType === 'numeric') {
    const count = log.count ?? 0;
    const target = version.target ?? 0;
    statusText = `${count} / ${target}`;
  } else if (targetType === 'slot-checklist') {
    const slots = log.slots ?? [];
    const checked = slots.filter((s) => s.checked).length;
    const total = version.target ?? slots.length;
    statusText = `${checked} / ${total} slots`;
  } else {
    // binary
    statusText = log.completed === true ? '✓' : '–';
  }

  /** @type {Record<string, string>} */
  const toggleAttrs = {
    class: 'history-toggle-btn',
    'data-action': 'toggle-log',
    'data-habit-id': habit.id,
  };
  if (date) {
    toggleAttrs['data-date'] = date;
  }

  return {
    tag: 'li',
    attrs: { class: 'history-habit-row' },
    children: [
      {
        tag: 'span',
        attrs: { class: 'history-habit-name' },
        text: displayName,
      },
      {
        tag: 'span',
        attrs: { class: 'history-habit-status' },
        text: statusText,
      },
      {
        tag: 'button',
        attrs: toggleAttrs,
        text: 'Toggle',
      },
    ],
  };
}

/**
 * Build a read-only history row for numeric/slot habits.
 * Shows the habit name and count/slot display without a toggle button.
 *
 * @param {{ id: string, name: string, wave?: number }} habit — current habit row
 * @param {{ completed?: boolean, count?: number, slots?: Array<{name: string, checked: boolean}> } | null} log — log row for this date, or null
 * @param {{ name: string, targetType?: 'binary'|'numeric'|'slot-checklist', target?: number }} version — habit_versions entry effective on the selected date
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildHistoryReadOnly(habit, log, version) {
  const targetType = version.targetType ?? 'binary';
  const displayName = version.name ?? habit.name;

  // Compute completion display text for the status indicator.
  let statusText;
  if (log === null || log === undefined) {
    statusText = '–';
  } else if (targetType === 'numeric') {
    const count = log.count ?? 0;
    const target = version.target ?? 0;
    statusText = `${count} / ${target}`;
  } else if (targetType === 'slot-checklist') {
    const slots = log.slots ?? [];
    const checked = slots.filter((s) => s.checked).length;
    const total = version.target ?? slots.length;
    statusText = `${checked} / ${total} slots`;
  } else {
    // binary
    statusText = log.completed === true ? '✓' : '–';
  }

  return {
    tag: 'li',
    attrs: { class: 'history-habit-row history-habit-row--read-only' },
    children: [
      {
        tag: 'span',
        attrs: { class: 'history-habit-name' },
        text: displayName,
      },
      {
        tag: 'span',
        attrs: { class: 'history-habit-status' },
        text: statusText,
      },
    ],
  };
}

/**
 * Build the bulk action bar for the History view: a single "Mark all
 * not-completed" button (HISTORY-04) that writes completed:false for all
 * applicable but un-logged habits on the selected date.
 *
 * NFR-06: button is styled at 44×44px via the CSS touch-target rule.
 *
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildBulkActionBar() {
  return {
    tag: 'div',
    attrs: { class: 'bulk-action-bar' },
    children: [
      {
        tag: 'button',
        attrs: {
          class: 'bulk-action-btn',
          'data-action': 'bulk-mark-uncompleted',
        },
        text: 'Mark all not-completed',
      },
    ],
  };
}
