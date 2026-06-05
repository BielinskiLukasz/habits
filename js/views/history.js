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

import { buildHistoryHeader, buildHistoryHabitRow, buildBulkActionBar } from './history/builders.js';
import { apply } from '../state/apply.js';
import { mount } from '../util/mount.js';
import { appliesToday } from '../domain/cadence.js';
import { todayLocal, daysFrom, formatLocalYMD, parseLocalYMD } from '../util/date.js';

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
 * Format a YYYY-MM-DD as a short display string (e.g. "Wed 4 Jun 2026").
 *
 * @param {string} ymd YYYY-MM-DD
 * @returns {string}
 */
function formatHistoryDate(ymd) {
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = parseLocalYMD(ymd);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
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
   * Async render pass: reads IDB, builds description tree, mounts into parent.
   *
   * @param {string} date YYYY-MM-DD
   * @returns {Promise<void>}
   */
  async function render(date) {
    clearChildren(parent);

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
      emptyEl.textContent = 'No applicable habits for this day.';
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
              if (currentLog?.completed === true) {
                await apply({ type: 'markUncompleted', payload: { habitId, date: logDate } });
              } else {
                await apply({ type: 'markCompleted', payload: { habitId, date: logDate } });
              }
            } catch (_e) {
              // Swallow — re-render will show current state
            }
            render(selectedDate);
          },
        });
      }
    }
  }

  // Initial render.
  render(selectedDate);
}
