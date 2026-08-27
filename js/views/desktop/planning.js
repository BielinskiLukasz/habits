/**
 * @file Planning view for desktop shell (DESKTOP-05, DESKTOP-06, D-121).
 * Forward-looking 12-week grid of future habits. Read-only; clicking habits
 * links to index.html#catalog.
 *
 * Data source: `repo.getAllHabits()` filtered to habits whose `startDate` is
 * in the future (> todayYMD) and whose `status !== 'archived'`.
 *
 * Grid structure:
 *   - X-axis: 12 future ISO weeks starting from NEXT week (not current week)
 *   - Y-axis: grouped by wave number (only waves with at least one scheduled habit)
 *   - Cells: contain an <a href="./index.html#catalog"> link when a habit
 *     starts in that week, or empty <td> when not
 *
 * D-121: Each habit-name cell is an anchor linking to ./index.html#catalog.
 * Same tab (no target="_blank") — keeps navigation simple.
 * Only waves that have at least one habit in the 12-week window are rendered.
 *
 * D-26 Tier 1 / Pattern S8: builders are pure functions (no DOM access).
 * `mountPlanning` wires them into real DOM via `mount()` from `js/util/mount.js`.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`
 *     (D-78 grep gate).
 *   - Direct calls to `scoring.js` or raw IDB (use repo facade only).
 */

import { mount } from '../../util/mount.js';
import { todayLocal, daysFrom } from '../../util/date.js';
import { t } from '../../i18n/index.js';

// ---------------------------------------------------------------------------
// ISO week helpers (internal, not exported)
// Intentionally duplicated from waveboard.js to keep views independent (D-121).
// ---------------------------------------------------------------------------

/**
 * Returns ISO week number and year for a YYYY-MM-DD date string.
 * ISO 8601: week starts on Monday; week 1 contains January 4th.
 *
 * @param {string} dateYMD - Date in YYYY-MM-DD format.
 * @returns {{ year: number, week: number }}
 */
function getISOWeek(dateYMD) {
  const [y, m, d] = dateYMD.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // ISO 8601: week starts Monday; Sunday = day 7 not 0
  const dayOfWeek = date.getDay() || 7;
  // Move to the Thursday of this week (ISO week contains its Thursday)
  date.setDate(date.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { year: date.getFullYear(), week: weekNum };
}

/**
 * Convert a YYYY-MM-DD date to its ISO week key ("YYYY-Www").
 *
 * @param {string} dateYMD
 * @returns {string} e.g. "2026-W27"
 */
function isoWeekKey(dateYMD) {
  const { year, week } = getISOWeek(dateYMD);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Compute the next N ISO week keys starting from the week AFTER `fromYMD`.
 *
 * @param {number} n - Number of weeks to produce.
 * @param {string} fromYMD - Anchor date in YYYY-MM-DD format (today).
 * @returns {Array<{ key: string, label: string }>}
 */
function computeNextNWeeks(n, fromYMD) {
  const weeks = [];
  let cursor = daysFrom(fromYMD, 7); // start from next week
  for (let i = 0; i < n; i++) {
    const key = isoWeekKey(cursor);
    const label = 'W' + key.split('-W')[1];
    if (weeks.length === 0 || weeks[weeks.length - 1].key !== key) {
      weeks.push({ key, label });
    }
    cursor = daysFrom(cursor, 7);
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// buildPlanningHeader
// ---------------------------------------------------------------------------

/**
 * Build the header row for the planning grid.
 *
 * Returns a `<tr>` description with N+1 `<th>` children:
 *   - First column: "Wave / Habit"
 *   - Remaining columns: one per future ISO week with label "W27", "W28", etc.
 *
 * @param {{ weeks: Array<{ key: string, label: string }> }} args
 * @returns {{ tag: string, children: object[] }}
 */
export function buildPlanningHeader({ weeks }) {
  const labelTh = {
    tag: 'th',
    text: t('desktop.planning.waveHabit'),
  };

  const weekThs = weeks.map(w => ({
    tag: 'th',
    text: w.label,
  }));

  return {
    tag: 'tr',
    children: [labelTh, ...weekThs],
  };
}

// ---------------------------------------------------------------------------
// buildPlanningRows
// ---------------------------------------------------------------------------

/**
 * Build all body rows for the planning grid.
 *
 * Returns an array of `<tr>` description objects:
 *   - One wave header row per wave group (full-width, class analytics-wave-header)
 *   - One habit row per habit (one row per habit, not one row per wave)
 *     - First cell: habit name (plain text, not a link — link is in the week cell)
 *     - One cell per week: either an <a href="./index.html#catalog"> link when
 *       habit.startDate falls in that week, or an empty <td>
 *
 * @param {{
 *   waveGroups: Array<{ waveNumber: number, waveName: string, habits: object[] }>,
 *   weeks: Array<{ key: string, label: string }>
 * }} args
 * @returns {object[]}
 */
export function buildPlanningRows({ waveGroups, weeks }) {
  /** @type {object[]} */
  const rows = [];

  for (const waveGroup of waveGroups) {
    // Wave header row — spans all columns (label col + week cols)
    rows.push({
      tag: 'tr',
      attrs: { class: 'analytics-wave-header' },
      children: [
        {
          tag: 'td',
          attrs: { colspan: String(weeks.length + 1) },
          text: waveGroup.waveName,
        },
      ],
    });

    // One row per habit
    for (const habit of waveGroup.habits) {
      // Habit name cell (first column — plain label)
      const nameCell = {
        tag: 'td',
        text: habit.name,
      };

      // One cell per week: link if habit starts in that week, else empty
      const weekCells = weeks.map(w => {
        const habitWeekKey = habit.startDate ? isoWeekKey(habit.startDate) : null;
        if (habitWeekKey === w.key) {
          return {
            tag: 'td',
            children: [
              {
                tag: 'a',
                attrs: { href: './index.html#catalog' },
                text: habit.name,
              },
            ],
          };
        }
        return {
          tag: 'td',
          text: '',
        };
      });

      rows.push({
        tag: 'tr',
        children: [nameCell, ...weekCells],
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// buildPlanningEmpty
// ---------------------------------------------------------------------------

/**
 * Build the empty state description tree for the planning view.
 *
 * Shown when no habits have a `startDate` in the next 12 weeks.
 *
 * @returns {object}
 */
export function buildPlanningEmpty() {
  return {
    tag: 'div',
    attrs: { class: 'planning-empty' },
    children: [
      { tag: 'h2', text: t('desktop.planning.noUpcoming') },
      {
        tag: 'p',
        children: [
          {
            tag: 'span',
            text: t('desktop.planning.scheduleHint'),
          },
          {
            tag: 'a',
            attrs: { href: './index.html#catalog' },
            text: t('desktop.planning.catalogView'),
          },
          {
            tag: 'span',
            text: t('desktop.planning.scheduleHintEnd'),
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// mountPlanning
// ---------------------------------------------------------------------------

/**
 * Mount the Planning view into `parent` and subscribe to store changes.
 *
 * Idempotency guard: if `parent.dataset.mounted === 'planning'`, returns
 * immediately without rebuilding the skeleton (D-115 pattern).
 *
 * Data fetch sequence (D-121):
 *   1. `repo.getAllHabits()` → all habits
 *   2. Filter to: status !== 'archived' AND startDate > todayYMD
 *   3. Compute 12 future ISO weeks (starting from NEXT week after today)
 *   4. If no future habits: render buildPlanningEmpty()
 *   5. Otherwise: group by wave (only waves with ≥1 habit) + render grid
 *
 * Read-only view — no log writes, no score computation.
 * Subscribes to store.subscribe for reactivity (new habits added in Catalog).
 *
 * @param {Element} parent - The panel element to mount into.
 * @param {{ repo: object, store: object }} deps - repo facade + store handle.
 * @returns {void}
 */
export function mountPlanning(parent, { repo, store }) {
  // Idempotency guard — skeleton is built only once (D-115 pattern).
  if (parent.dataset.mounted === 'planning') return;
  parent.dataset.mounted = 'planning';

  // Scrollable container for the grid (or empty state).
  const planningContainer = parent.ownerDocument.createElement('div');
  planningContainer.setAttribute('class', 'planning-container');
  parent.appendChild(planningContainer);

  /** Clear a container element's children safely (D-78 — no innerHTML). */
  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /**
   * Fetch fresh data from IDB and re-render the planning view.
   *
   * @returns {Promise<void>}
   */
  async function refresh() {
    try {
      const allHabits = await repo.getAllHabits();
      const todayYMD = todayLocal();

      // Filter to future habits only (startDate > today AND not archived)
      const futureHabits = allHabits.filter(
        h => h.startDate > todayYMD && h.status !== 'archived'
      );

      // Compute 12 future ISO weeks (starting from NEXT week)
      const weeks = computeNextNWeeks(12, todayYMD);

      clearChildren(planningContainer);

      if (futureHabits.length === 0) {
        // Empty state
        const emptyDesc = buildPlanningEmpty();
        mount(emptyDesc, planningContainer);
        return;
      }

      // Build waveGroups — only waves with at least one scheduled habit in the window
      /** @type {Map<number, { waveNumber: number, waveName: string, habits: object[] }>} */
      const waveMap = new Map();
      const weekKeys = new Set(weeks.map(w => w.key));

      for (const habit of futureHabits) {
        // Only include habits whose startDate falls within the 12-week window
        if (!habit.startDate) continue;
        const habitKey = isoWeekKey(habit.startDate);
        if (!weekKeys.has(habitKey)) continue;

        const waveNum = habit.wave ?? 0;
        if (!waveMap.has(waveNum)) {
          const waveName =
            (store && store.cache && store.cache.waves && store.cache.waves.get)
              ? (store.cache.waves.get(waveNum)?.name ?? `Wave ${waveNum}`)
              : `Wave ${waveNum}`;
          waveMap.set(waveNum, { waveNumber: waveNum, waveName, habits: [] });
        }
        waveMap.get(waveNum).habits.push(habit);
      }

      const waveGroups = Array.from(waveMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([, group]) => group);

      if (waveGroups.length === 0) {
        // No habits fall within the 12-week window (they're in far future)
        const emptyDesc = buildPlanningEmpty();
        mount(emptyDesc, planningContainer);
        return;
      }

      // Render grid
      const headerDesc = buildPlanningHeader({ weeks });
      const bodyRows = buildPlanningRows({ waveGroups, weeks });

      const tableDesc = {
        tag: 'table',
        attrs: { class: 'planning-grid' },
        children: [
          {
            tag: 'thead',
            children: [headerDesc],
          },
          {
            tag: 'tbody',
            children: bodyRows,
          },
        ],
      };

      mount(tableDesc, planningContainer);
    } catch (_e) {
      // Non-fatal — render whatever we have.
    }
  }

  // Subscribe to store notifications for reactive updates (new habits in Catalog).
  store.subscribe(async () => {
    await refresh();
  });

  // Initial render.
  refresh();
}
