/**
 * @file Wave-board heat-map view (DESKTOP-04, D-118, D-119, D-120).
 * Always uses S1 status regardless of active scoring model.
 * Reads from score_snapshots — never calls scoring.js.
 *
 * Exports:
 *   - `buildWaveboardHeader` — pure description tree for the header row
 *   - `buildWaveboardRows`   — pure description tree array for body rows
 *   - `mountWaveboard`       — live DOM mount; subscribes to store; reads IDB
 *
 * D-118: The wave-board always shows S1 status. The active scoringModel
 * setting has no effect on cell coloring. This is intentional — the heat-map
 * surface communicates longitudinal S1 status trends across weeks, not the
 * currently selected scoring model's values.
 *
 * D-26 Tier 1 / Pattern S8: builders are pure functions (no DOM access).
 * `mountWaveboard` wires them into real DOM via `mount()` from `js/util/mount.js`.
 *
 * Grid structure:
 *   - Leftmost column: habit names (sticky: position sticky; left: 0)
 *   - Week columns: one per ISO week from the earliest week with any
 *     score_snapshots data through the current week, with "W26" style labels
 *   - Wave header rows: full-width spanning all columns (colspan td); label
 *     text lives in an inner `<span class="wave-header-label">`, which is
 *     the actual `position: sticky` target — a colspan'd td has no "room"
 *     for sticky to move it (see css/desktop.css and the
 *     waveboard-wave-row-not-pinned debug session for the empirical proof)
 *   - Cell classes: waveboard-cell waveboard-cell--{healthy|watch|atrisk|failing|na}
 *   - Cell title: "{status} ({completed}/{applicable} days)" or "Not applicable"
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`
 *     (D-78 grep gate).
 *   - Direct calls to `scoring.js` or raw IDB (use repo facade only).
 */

import { mount } from '../../util/mount.js';
import { t, displayName } from '../../i18n/index.js';
import { todayLocal, formatLocalYMD } from '../../util/date.js';
import { mountWavePlanning } from './wavePlanning.js';

/**
 * Earliest-possible-date sentinel for full-history score_snapshots range
 * queries. Matches the "earliest possible date" convention already used by
 * `js/db/repo.js`'s `getLatestSnapshot` and `js/io/seed.js`'s `effectiveFrom`
 * fallback.
 *
 * @type {string}
 */
const SNAPSHOT_EPOCH = '0000-01-01';

// ---------------------------------------------------------------------------
// ISO week helpers (internal, not exported)
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
 * @returns {string} e.g. "2026-W26"
 */
export function isoWeekKey(dateYMD) {
  const { year, week } = getISOWeek(dateYMD);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Convert an ISO week key to a short label.
 *
 * @param {string} key - e.g. "2026-W26"
 * @returns {string} e.g. "W26"
 */
function isoWeekLabel(key) {
  return 'W' + key.split('-W')[1];
}

/**
 * Build an array of ISO week keys spanning from the week containing
 * `startYMD` through the week containing `endYMD`, inclusive, in
 * chronological order.
 *
 * Steps one calendar week at a time from the Monday of the start week to
 * the Monday of the end week, so the result is always chronological with
 * no possible duplicate entries.
 *
 * @param {string} startYMD - Range start date in YYYY-MM-DD format.
 * @param {string} endYMD - Range end date in YYYY-MM-DD format.
 * @returns {string[]} Array of isoWeekKey strings, chronological, no dupes.
 */
export function weeksInRange(startYMD, endYMD) {
  const keys = [];
  let cursor = weekMonday(isoWeekKey(startYMD));
  const endMonday = weekMonday(isoWeekKey(endYMD));

  while (cursor <= endMonday) {
    keys.push(isoWeekKey(cursor));
    const [y, m, d] = cursor.split('-').map(Number);
    const next = new Date(y, m - 1, d + 7);
    cursor = formatLocalYMD(next);
  }

  return keys;
}

/**
 * Return the YYYY-MM-DD date for the Monday of a given ISO week key.
 *
 * @param {string} key - e.g. "2026-W26"
 * @returns {string} e.g. "2026-06-22"
 */
function weekMonday(key) {
  const [yearStr, wStr] = key.split('-W');
  const year = Number(yearStr);
  const week = Number(wStr);
  // Jan 4th is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const jan4DayOfWeek = jan4.getDay() || 7;
  // Monday of week 1
  const w1Monday = new Date(jan4);
  w1Monday.setDate(jan4.getDate() - (jan4DayOfWeek - 1));
  // Monday of target week
  const result = new Date(w1Monday);
  result.setDate(w1Monday.getDate() + (week - 1) * 7);
  return formatLocalYMD(result);
}

/**
 * Return an array of 7 YYYY-MM-DD date strings for all days in a given
 * ISO week (Monday through Sunday).
 *
 * @param {string} key - ISO week key e.g. "2026-W26"
 * @returns {string[]} 7 date strings
 */
function weekDays(key) {
  const monday = weekMonday(key);
  const [y, m, d] = monday.split('-').map(Number);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(y, m - 1, d + i);
    days.push(formatLocalYMD(dt));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Status helpers (internal)
// ---------------------------------------------------------------------------

/** @type {{ [key: string]: number }} */
const STATUS_RANK = { Healthy: 1, Watch: 2, 'At-risk': 3, Failing: 4 };

/**
 * Return the worst (highest rank) of two S1 status strings.
 * Unknown/null statuses have rank 0 (beaten by any known status).
 *
 * @param {string|null} a
 * @param {string|null} b
 * @returns {string|null}
 */
export function worstStatus(a, b) {
  return (STATUS_RANK[a] ?? 0) >= (STATUS_RANK[b] ?? 0) ? a : b;
}

/**
 * Convert an S1 status string to a CSS modifier slug.
 * 'At-risk' → 'atrisk' (no hyphen in CSS token, matches tokens.css naming).
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function statusSlug(status) {
  return ({ Healthy: 'healthy', Watch: 'watch', 'At-risk': 'atrisk', Failing: 'failing' })[status] ?? 'na';
}

// ---------------------------------------------------------------------------
// buildWaveboardHeader
// ---------------------------------------------------------------------------

/**
 * Build the header row for the wave-board heat-map grid.
 *
 * Returns a `<tr>` description with N+1 `<th>` children:
 *   - First column: "Habit" (sticky column header, class waveboard-sticky-column)
 *   - Remaining columns: one per ISO week with label "W26", "W27", etc.
 *
 * @param {{ weeks: string[], showArchived?: boolean }} args
 *   - `weeks`: array of isoWeekKey strings in chronological order
 *   - `showArchived`: unused in header, included for API symmetry
 * @returns {{ tag: string, children: object[] }}
 */
export function buildWaveboardHeader({ weeks }) {
  const habitTh = {
    tag: 'th',
    attrs: { class: 'waveboard-sticky-column' },
    text: t('desktop.waveboard.habit'),
  };

  const weekThs = weeks.map(w => ({
    tag: 'th',
    text: isoWeekLabel(w),
  }));

  return {
    tag: 'tr',
    children: [habitTh, ...weekThs],
  };
}

// ---------------------------------------------------------------------------
// buildWaveboardRows
// ---------------------------------------------------------------------------

/**
 * Build all body rows for the wave-board heat-map.
 *
 * Returns an array of `<tr>` description objects:
 *   - One wave header row per wave group (full-width, class analytics-wave-header;
 *     label text wrapped in an inner `<span class="wave-header-label">` so
 *     the CSS sticky rule has a non-colspan'd element to target)
 *   - One habit row per visible habit
 *     - First cell: habit name (sticky column)
 *     - One cell per week: colored by worst S1 status in that week
 *     - Archived habits: shown with class analytics-row--archived when showArchived
 *     - Archived habits: cells rendered as N/A regardless of data
 *
 * @param {{
 *   habitsByWave: Array<{ waveNumber: number, waveName: string, habits: object[] }>,
 *   cellData: Map<string, Map<string, { status: string, applicable: number, completed: number }>>,
 *   weeks: string[],
 *   showArchived: boolean
 * }} args
 * @returns {object[]}
 */
export function buildWaveboardRows({ habitsByWave, cellData, weeks, showArchived }) {
  /** @type {object[]} */
  const rows = [];

  for (const waveGroup of habitsByWave) {
    // Wave header row — spans all columns (habit col + week cols).
    // The label lives in an inner <span class="wave-header-label"> rather
    // than directly as the <td>'s text: a colspan'd cell is exactly as wide
    // as the whole scrollable table, leaving `position: sticky` zero room
    // to move the box (verified empirically — see waveboard-wave-row-not-
    // pinned debug session). The inner span is the actual sticky target;
    // css/desktop.css pins the span, not the td.
    rows.push({
      tag: 'tr',
      attrs: { class: 'analytics-wave-header' },
      children: [
        {
          tag: 'td',
          attrs: { colspan: String(weeks.length + 1) },
          children: [
            {
              tag: 'span',
              attrs: { class: 'wave-header-label' },
              text: t('catalog.wave', { n: waveGroup.waveNumber }),
            },
          ],
        },
      ],
    });

    // Habit rows
    for (const habit of waveGroup.habits) {
      const isArchived = habit.status === 'archived';
      if (isArchived && !showArchived) continue;

      const rowClass = [
        'waveboard-row',
        ...(isArchived ? ['analytics-row--archived'] : []),
      ].join(' ');

      // Sticky name cell
      const nameCell = {
        tag: 'td',
        attrs: { class: 'waveboard-sticky-column' },
        text: displayName(habit),
      };

      // One cell per week
      const weekCells = weeks.map(week => {
        // Archived habits always render as N/A (visual graying)
        const weekCell = isArchived ? undefined : cellData.get(habit.id)?.get(week);

        if (!weekCell) {
          return {
            tag: 'td',
            attrs: {
              class: 'waveboard-cell waveboard-cell--na',
              title: t('desktop.waveboard.notApplicable'),
            },
            text: '',
          };
        }

        const CELL_STATUS_I18N = { Healthy: 'desktop.status.healthy', Watch: 'desktop.status.watch', 'At-risk': 'desktop.status.atRisk', Failing: 'desktop.status.failing' };
        const slug = statusSlug(weekCell.status);
        return {
          tag: 'td',
          attrs: {
            class: `waveboard-cell waveboard-cell--${slug}`,
            title: t('desktop.waveboard.cellTitle', {
              status: weekCell.status ? (t(CELL_STATUS_I18N[weekCell.status]) ?? weekCell.status) : t('desktop.waveboard.gracePeriod'),
              completed: weekCell.completed,
              applicable: weekCell.applicable,
            }),
          },
          text: '',
        };
      });

      rows.push({
        tag: 'tr',
        attrs: { class: rowClass },
        children: [nameCell, ...weekCells],
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// mountWaveboard
// ---------------------------------------------------------------------------

/**
 * Mount the Wave-board heat-map view into `parent` and subscribe to store
 * changes.
 *
 * Idempotency guard: if `parent.dataset.mounted === 'waveboard'`, returns
 * immediately without rebuilding the skeleton (D-115 pattern).
 *
 * Data fetch sequence (D-118):
 *   1. `repo.getAllHabits()`  → habit list + wave grouping
 *   2. Score snapshots range query over the full existing range (from a
 *      fixed epoch sentinel through today) from score_snapshots
 *   3. Build weeks array: ISO week keys derived from the earliest date
 *      actually returned by the query, through today
 *   4. Build cellData Map from snapshot rows (worst S1 status per week per habit)
 *   5. Render via `buildWaveboardHeader` + `buildWaveboardRows` + `mount()`
 *
 * Wave-board ALWAYS uses S1 status — active scoringModel has no effect (D-118).
 * Subscribes to store.subscribe for reactivity on habit definition changes.
 *
 * @param {Element} parent - The panel element to mount into.
 * @param {{ repo: object, store: object }} deps - repo facade + store handle.
 * @returns {void}
 */
export function mountWaveboard(parent, { repo, store }) {
  // Idempotency guard — skeleton is built only once (D-115 pattern).
  if (parent.dataset.mounted === 'waveboard') return;
  parent.dataset.mounted = 'waveboard';

  mountWavePlanning(parent, { repo, store });

  let showArchived = false;

  // Score Matrix heading.
  const heatmapHeading = parent.ownerDocument.createElement('h2');
  heatmapHeading.setAttribute('class', 'waveboard-heatmap-heading');
  heatmapHeading.textContent = t('desktop.waveboard.scoreMatrix');
  parent.appendChild(heatmapHeading);

  // "Show archived" toggle above the grid.
  const toggleLabel = parent.ownerDocument.createElement('label');
  toggleLabel.setAttribute('class', 'waveboard-archived-toggle');
  const toggleCheckbox = parent.ownerDocument.createElement('input');
  toggleCheckbox.setAttribute('type', 'checkbox');
  toggleCheckbox.addEventListener('change', () => {
    showArchived = toggleCheckbox.checked;
    renderGrid();
  });
  toggleLabel.appendChild(toggleCheckbox);
  toggleLabel.appendChild(parent.ownerDocument.createTextNode(' ' + t('desktop.showArchived')));
  parent.appendChild(toggleLabel);

  // Scrollable container for the grid.
  const waveboardContainer = parent.ownerDocument.createElement('div');
  waveboardContainer.setAttribute('class', 'waveboard-container');
  parent.appendChild(waveboardContainer);

  // Data state — populated on first render and refreshed on notify.
  /** @type {object[]} */
  let cachedHabits = [];
  /**
   * cellData: Map<habitId, Map<isoWeekKey, { status, applicable, completed }>>
   * @type {Map<string, Map<string, { status: string, applicable: number, completed: number }>>}
   */
  let cachedCellData = new Map();
  /** @type {string[]} */
  let cachedWeeks = [];

  /**
   * Build habitsByWave grouping from cachedHabits, sorted by wave number
   * then by habit creation order within wave.
   *
   * @returns {Array<{ waveNumber: number, waveName: string, habits: object[] }>}
   */
  function buildHabitsByWave() {
    /** @type {Map<number, { waveNumber: number, waveName: string, habits: object[] }>} */
    const waveMap = new Map();
    for (const habit of cachedHabits) {
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
    return Array.from(waveMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, group]) => group);
  }

  /** Clear a container element's children safely (D-78 — no innerHTML). */
  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /** Re-render the grid from cached state. */
  function renderGrid() {
    clearChildren(waveboardContainer);

    const habitsByWave = buildHabitsByWave();
    const headerDesc = buildWaveboardHeader({ weeks: cachedWeeks });
    const bodyRows = buildWaveboardRows({
      habitsByWave,
      cellData: cachedCellData,
      weeks: cachedWeeks,
      showArchived,
    });

    // Build the table description and mount it.
    const tableDesc = {
      tag: 'table',
      attrs: { class: 'waveboard-grid' },
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

    mount(tableDesc, waveboardContainer);
  }

  /**
   * Fetch fresh data from IDB and re-render the grid.
   *
   * @returns {Promise<void>}
   */
  async function refresh() {
    try {
      // 1. Habit catalog.
      cachedHabits = await repo.getAllHabits();

      // 2. Fetch all snapshot rows over the full possible history range.
      const today = todayLocal();
      /** @type {object[]} */
      let snapshotRows = [];
      try {
        snapshotRows = await repo.getSnapshotsInRange(SNAPSHOT_EPOCH, today);
      } catch (_e) {
        // Non-fatal — no snapshots yet.
      }

      // 3. Derive the displayed week range from the earliest snapshot date
      // actually returned (fallback: today, so a zero-snapshot install still
      // renders exactly the current week).
      let earliestDate = today;
      for (const row of snapshotRows) {
        if (row.date && row.date < earliestDate) earliestDate = row.date;
      }
      cachedWeeks = weeksInRange(earliestDate, today);

      // 4. Build cellData from snapshot rows.
      // Each row: { habitId, date, s1Status, ... }
      // cellData: Map<habitId, Map<isoWeekKey, { status, applicable, completed }>>
      cachedCellData = new Map();
      for (const row of snapshotRows) {
        if (!row.habitId || !row.date) continue;
        const week = isoWeekKey(row.date);
        if (!cachedWeeks.includes(week)) continue;

        if (!cachedCellData.has(row.habitId)) {
          cachedCellData.set(row.habitId, new Map());
        }
        const habitMap = cachedCellData.get(row.habitId);

        if (!habitMap.has(week)) {
          habitMap.set(week, {
            status: row.s1Status,
            applicable: (row.applicableToday ?? true) ? 1 : 0,
            completed: row.loggedToday ? 1 : 0,
          });
        } else {
          const existing = habitMap.get(week);
          existing.applicable += (row.applicableToday ?? true) ? 1 : 0;
          existing.completed += row.loggedToday ? 1 : 0;
          existing.status = worstStatus(existing.status, row.s1Status);
        }
      }
    } catch (_e) {
      // Non-fatal — render with whatever we have.
    }

    renderGrid();
  }

  // Subscribe to store notifications for reactive updates (habit definition changes).
  store.subscribe(async () => {
    await refresh();
  });

  // Initial render.
  refresh();
}
