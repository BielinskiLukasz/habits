/**
 * @file History view mounter (HISTORY-01..06, D-90). Version-aware log evaluation
 * via getHabitVersionAtDate.
 *
 * Wires the pure description builders (`js/views/history/builders.js`) into
 * real DOM via `mount()` (D-77). `mountHistory(parent, {repo, store})` renders
 * the history view for the selected date, wires prev/next day navigation,
 * calendar picker, log toggle, and bulk uncomplete.
 *
 * Version-aware evaluation (NFR-10 / T-04-09):
 *   For each habit, `getHabitVersionAtDate(habitId, selectedDate)` returns the
 *   `habit_versions` row that was effective on the selected date. The cadence
 *   resolver (`appliesToday`) uses `version.cadence` — NOT the current habit row —
 *   so past applicability is evaluated correctly even if the habit was edited.
 *
 * T-04-09b — Future navigation guard:
 *   The `next-day` action is only honoured when `selectedDate < todayLocal()`.
 *   The header builder also sets `disabled` on the next button when at today.
 *
 * T-04-09c — XSS guard:
 *   All slot names and habit names flow through builders which use `text:`
 *   (textContent). This file wires actions but never constructs DOM directly.
 *   `.innerHTML` is forbidden (D-78 grep gate).
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Mutating builders' return values — they're pure descriptions.
 */

import { buildHistoryHeader, buildHistoryHabitRow, buildHistoryReadOnly, buildBulkActionBar } from './history/builders.js';
import { apply } from '../state/apply.js';
import { nextLogState } from '../domain/logStatus.js';
import { undo } from '../state/undo.js';
import { mount } from '../util/mount.js';
import { appliesToday } from '../domain/cadence.js';
import { todayLocal, daysFrom, formatLocalYMD, parseLocalYMD } from '../util/date.js';
import { t, getLang } from '../i18n/index.js';
import { showUndoToast, showErrorToast } from './toast.js';
import { getCachedHabits } from '../state/store.js';

/**
 * Clear every child of `parent` without using `.innerHTML = ''` (D-78).
 *
 * @param {object} parent
 * @returns {void}
 */
function clearChildren(parent) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
}

/** @type {Element|null} Currently-open swipe actions panel row (one at a time). */
let _openSwipeRow = null;

/** @type {Element|null} Row currently being swiped (pointer captured). */
let _swipeEl = null;

/** @type {number} clientX where the active swipe started. */
let _swipeStartX = 0;

/**
 * Collapse any open swipe actions panel and clear the tracking ref.
 *
 * @returns {void}
 */
function _closeOpenHistorySwipeRow() {
  if (!_openSwipeRow) return;
  const slide = _openSwipeRow.querySelector('.history-row__slide');
  if (slide) slide.style.transform = '';
  _openSwipeRow.classList.remove('history-habit-row--swipe-open');
  _openSwipeRow = null;
}

/**
 * Format a YYYY-MM-DD as a short display string (e.g. "Wed 4 Jun 2026").
 *
 * @param {string} ymd YYYY-MM-DD
 * @returns {string}
 */
function formatHistoryDate(ymd) {
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PL_WEEKDAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
  const PL_MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const d = parseLocalYMD(ymd);
  const weekdays = getLang() === 'pl' ? PL_WEEKDAY_SHORT : WEEKDAY_SHORT;
  const months = getLang() === 'pl' ? PL_MONTH_SHORT : MONTH_SHORT;
  return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Mount the History view into `parent`. Renders the date stepper header,
 * applicable habits for the selected date (version-aware), and bulk action bar.
 *
 * This function is called fresh each time `#history` is routed to.
 * Re-render is triggered by action handlers (not a store.subscribe — History
 * is a discrete past-day view, not a live Today-style reactive panel).
 *
 * @param {object} parent — element to render into (must expose ownerDocument)
 * @param {{ repo: object, store: object }} deps
 * @returns {void}
 */
export function mountHistory(parent, { repo, store }) {
  /** @type {string} Module-level selected date (steps on prev/next/pick). */
  let selectedDate = todayLocal();

  /**
   * Pointer-down on the history list: begin swipe gesture tracking.
   *
   * @param {PointerEvent} evt
   * @returns {void}
   */
  function handleSwipeStart(evt) {
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;
    const row = evt.target.closest('.history-habit-row');
    if (!row) { _closeOpenHistorySwipeRow(); return; }
    if (evt.target.closest('.today-row__actions')) return;
    if (_openSwipeRow && _openSwipeRow !== row) _closeOpenHistorySwipeRow();
    _swipeEl = row;
    _swipeStartX = evt.clientX;
    evt.currentTarget.setPointerCapture(evt.pointerId);
  }

  /**
   * Pointer-move: translate the slide div in real time.
   *
   * @param {PointerEvent} evt
   * @returns {void}
   */
  function handleSwipeMove(evt) {
    if (!_swipeEl) return;
    const dx = evt.clientX - _swipeStartX;
    const slide = _swipeEl.querySelector('.history-row__slide');
    if (!slide) return;
    const clamped = Math.max(-120, Math.min(80, dx));
    slide.style.transform = `translateX(${clamped}px)`;
  }

  /**
   * Pointer-up: commit swipe action or snap back.
   *
   * - dx > 60 → swipe-right: mark completed for selectedDate.
   * - dx < -60 → swipe-left: reveal actions panel.
   * - Otherwise → snap back.
   *
   * @param {PointerEvent} evt
   * @returns {void}
   */
  function handleSwipeEnd(evt) {
    if (!_swipeEl) return;
    const dx = evt.clientX - _swipeStartX;
    const slide = _swipeEl.querySelector('.history-row__slide');
    const row = _swipeEl;
    _swipeEl = null;

    if (dx > 60) {
      if (slide) slide.style.transform = '';
      const habitId = row.querySelector('[data-habit-id]')?.getAttribute('data-habit-id');
      if (habitId) {
        // History reads from repo.getLog since cache only holds the current ISO week.
        repo.getLog(habitId, selectedDate)
          .then((log) => {
            const currentStatus = log?.status ?? null;
            const next = nextLogState(currentStatus);
            const type = next === 'completed' ? 'markCompleted'
                       : next === 'failed'    ? 'markFailed'
                       : next === 'skipped'   ? 'markSkipped'
                       : 'markUncompleted';
            return apply({ type, payload: { habitId, date: selectedDate } });
          })
          .then(() => {
            const habitName = getCachedHabits().find((h) => h.id === habitId)?.name ?? '(habit)';
            showUndoToast({ message: t('today.markedComplete', { name: habitName }), undoFn: () => undo() });
            render(selectedDate);
          })
          .catch(() => showErrorToast(t('history.errorMark')));
      }
    } else if (dx < -60) {
      if (slide) slide.style.transform = 'translateX(-120px)';
      row.classList.add('history-habit-row--swipe-open');
      _openSwipeRow = row;
    } else {
      if (slide) slide.style.transform = '';
      if (_openSwipeRow === row) {
        row.classList.remove('history-habit-row--swipe-open');
        _openSwipeRow = null;
      }
    }
  }

  /**
   * Pointer-cancel: abort swipe and snap slide back.
   *
   * @returns {void}
   */
  function handleSwipeCancel() {
    if (!_swipeEl) return;
    const slide = _swipeEl.querySelector('.history-row__slide');
    if (slide) slide.style.transform = '';
    _swipeEl = null;
  }

  /**
   * Async render pass: reads IDB, builds description tree, mounts into parent.
   *
   * @param {string} date YYYY-MM-DD
   * @returns {Promise<void>}
   */
  async function render(date) {
    clearChildren(parent);

    // Reset swipe tracking state — DOM is about to be rebuilt.
    _openSwipeRow = null;
    _swipeEl = null;

    const today = todayLocal();
    const canGoForward = date < today;
    const displayDate = formatHistoryDate(date);

    // Read all logs for the selected date + all habit rows.
    const logsForDate = await repo.getLogsForDate(date);
    const allHabits = await repo.getAllHabits();

    // Build the applicable habit list with version-aware evaluation.
    /** @type {Array<{habit: object, log: object|null, version: object}>} */
    const rows = [];

    const settings = store.getCachedSettings ? store.getCachedSettings() : {};
    const weekStart = settings.weekStart ?? 'mon';

    for (const habit of allHabits) {
      // Skip habits created after the selected date (didn't exist then).
      if (habit.createdAt && habit.createdAt > date) continue;

      // Get the version effective on the selected date (NFR-10 / T-04-09).
      const version = await repo.getHabitVersionAtDate(habit.id, date);
      // If no version record, skip (habit may not have been versioned yet
      // or was created but never edited — fall back to current habit definition).
      const effectiveVersion = version ?? { ...habit, cadence: habit.cadence };

      // Evaluate applicability using the historical cadence.
      const ctx = {
        weekStart,
        // For history view we don't have a week-completions cache for arbitrary dates;
        // use an empty function that returns 0 to avoid blocking on missing data.
        weekCompletions: () => 0,
      };
      const applies = appliesToday(
        { ...habit, cadence: effectiveVersion.cadence ?? habit.cadence },
        date,
        ctx,
      );
      if (!applies) continue;

      const log = logsForDate.find((l) => l.habitId === habit.id) ?? null;
      rows.push({ habit, log, version: effectiveVersion });
    }

    // Build and mount the header.
    const headerDesc = buildHistoryHeader(displayDate, canGoForward);
    const headerEl = mount(headerDesc, parent, {
      'prev-day': () => {
        selectedDate = daysFrom(selectedDate, -1);
        render(selectedDate);
      },
      'next-day': () => {
        // T-04-09b: prevent future navigation
        if (selectedDate < todayLocal()) {
          selectedDate = daysFrom(selectedDate, +1);
          render(selectedDate);
        }
      },
      'toggle-calendar': (evt) => {
        const btn = evt.currentTarget;
        const calDiv = parent.querySelector('.history-calendar');
        if (!calDiv) return;
        const isHidden = calDiv.hasAttribute('hidden');
        if (isHidden) {
          calDiv.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          calDiv.setAttribute('hidden', '');
          btn.setAttribute('aria-expanded', 'false');
        }
      },
      'pick-date': (evt) => {
        const val = evt.currentTarget.value;
        if (val && val <= todayLocal()) {
          selectedDate = val;
          render(selectedDate);
        }
      },
    });

    if (!rows.length) {
      const emptyEl = parent.ownerDocument.createElement('p');
      emptyEl.textContent = t('history.noHabits');
      emptyEl.className = 'history-empty';
      parent.appendChild(emptyEl);
    } else {
      // Build and mount bulk action bar.
      const bulkDesc = buildBulkActionBar();
      mount(bulkDesc, parent, {
        'bulk-mark-uncompleted': async () => {
          // HISTORY-04: mark all applicable-but-uncompleted habits as completed:false.
          // Re-fetch logs to avoid stale closure — `rows` reflects applicability
          // (stable for the same date) but log completion state may have changed
          // since this render pass.
          const freshLogsForBulk = await repo.getLogsForDate(selectedDate);
          const notYetCompleted = rows.filter((r) => {
            const freshLog = freshLogsForBulk.find((l) => l.habitId === r.habit.id) ?? null;
            return freshLog === null || freshLog.completed !== true;
          });
          for (const { habit } of notYetCompleted) {
            try {
              await apply({ type: 'markUncompleted', payload: { habitId: habit.id, date: selectedDate } });
            } catch (_e) {
              // Swallow — re-render will show current state
            }
          }
          render(selectedDate);
        },
      });

      // Mount each applicable habit row.
      const listEl = parent.ownerDocument.createElement('ul');
      listEl.className = 'history-list';
      parent.appendChild(listEl);

      for (const { habit, log, version } of rows) {
        const targetType = version.targetType ?? 'binary';
        // History view: only binary habits support toggle. Numeric/slot are read-only.
        if (targetType !== 'binary') {
          const readOnlyDesc = buildHistoryReadOnly(habit, log, version);
          mount(readOnlyDesc, listEl, {});
          continue;
        }

        const rowDesc = buildHistoryHabitRow(habit, log, version, date);
        mount(rowDesc, listEl, {
          'toggle-log': async (evt) => {
            const btn = evt.currentTarget;
            const habitId = btn.getAttribute('data-habit-id');
            const logDate = btn.getAttribute('data-date') || selectedDate;
            // Re-fetch logs to avoid stale closure — logsForDate was captured at
            // render time and is invalidated by any previous toggle in this session.
            const freshLogs = await repo.getLogsForDate(logDate);
            const currentLog = freshLogs.find((l) => l.habitId === habitId) ?? null;
            try {
              // Check status field (4-state model); fall back to completed boolean for legacy logs.
              const isCompleted = currentLog?.status === 'completed' || currentLog?.completed === true;
              if (isCompleted) {
                await apply({ type: 'markUncompleted', payload: { habitId, date: logDate } });
              } else {
                await apply({ type: 'markCompleted', payload: { habitId, date: logDate } });
              }
            } catch (_e) {
              // Swallow — re-render will show current state
            }
            render(selectedDate);
          },
          'history-swipe-skip': async (evt) => {
            const btn = evt.currentTarget;
            const habitId = btn.getAttribute('data-habit-id');
            const logDate = btn.getAttribute('data-date') || selectedDate;
            _closeOpenHistorySwipeRow();
            try {
              await apply({ type: 'markSkipped', payload: { habitId, date: logDate } });
              const habitName = getCachedHabits().find((h) => h.id === habitId)?.name ?? '(habit)';
              showUndoToast({ message: t('today.skippedToast', { name: habitName }), undoFn: () => undo() });
            } catch (_e) {
              showErrorToast(t('history.errorSkip'));
            }
            render(selectedDate);
          },
          'history-swipe-fail': async (evt) => {
            const btn = evt.currentTarget;
            const habitId = btn.getAttribute('data-habit-id');
            const logDate = btn.getAttribute('data-date') || selectedDate;
            _closeOpenHistorySwipeRow();
            try {
              await apply({ type: 'markUncompleted', payload: { habitId, date: logDate } });
              const habitName = getCachedHabits().find((h) => h.id === habitId)?.name ?? '(habit)';
              showUndoToast({ message: t('today.markedNotDone', { name: habitName }), undoFn: () => undo() });
            } catch (_e) {
              showErrorToast(t('history.errorMark'));
            }
            render(selectedDate);
          },
        });
      }

      // Wire swipe gesture (pointer events, event delegation on listEl).
      listEl.addEventListener('pointerdown', handleSwipeStart);
      listEl.addEventListener('pointermove', handleSwipeMove);
      listEl.addEventListener('pointerup', handleSwipeEnd);
      listEl.addEventListener('pointercancel', handleSwipeCancel);
    }
  }

  // Initial render.
  render(selectedDate);
}
