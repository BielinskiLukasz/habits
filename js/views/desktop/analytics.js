/**
 * @file Analytics view for desktop shell (DESKTOP-03, D-116, SCORING-02,
 * SCORING-03). Reads from score_snapshots — never calls scoring.js.
 *
 * Exports three functions:
 *   - `buildAnalyticsHeader` — pure description tree for dashboard + model selector
 *   - `buildAnalyticsTable`  — pure description tree for habit table grouped by wave
 *   - `mountAnalytics`       — live DOM mount; subscribes to store; reads IDB
 *
 * D-116: the Analytics view reads from `score_snapshots` IDB store ONLY —
 * it never calls scoring.js directly (SCORING-08). Per-habit snapshot rows
 * carry `{s1Score, s1Status, s2Score, s3Score}` written at log-write time by
 * `js/io/scoreSnapshots.js` (06-02) via the `onLogWrite` DI seam (06-03).
 *
 * D-117: reactive model switching. The view subscribes to `store.subscribe(render)`
 * so that when the active scoring model changes via the Settings radio group,
 * `store.notify()` fans out and the view re-reads the model and re-renders
 * the score column header + values.
 *
 * D-26 Tier 1 / Pattern S8: builders are pure functions (no DOM access).
 * `mountAnalytics` wires them into real DOM via `mount()` from `js/util/mount.js`.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`
 *     (D-78 grep gate).
 *   - Direct calls to `scoring.js` or raw IDB (use repo facade only).
 */

import { mount } from '../../util/mount.js';
import { getWave } from '../../domain/wave.js';
import { t, displayName } from '../../i18n/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert an s1Status string to a CSS slug for the badge modifier class.
 * Returns 'na' for unknown/null statuses.
 *
 * @param {string|null|undefined} s1Status
 * @returns {string}
 */
function statusSlug(s1Status) {
  return ({ Healthy: 'healthy', Watch: 'watch', 'At-risk': 'atrisk', Failing: 'failing' })[s1Status] ?? 'na';
}

/**
 * Compute the wave aggregate score text for the wave header row (D-116, DESKTOP-03).
 * Averages pre-computed per-habit scores from `score_snapshots` — no raw log access.
 *
 * @param {{ habits: object[] }} waveGroup
 * @param {Map<string, object>} snapshots - Map of habitId → snapshot row
 * @param {'S1'|'S2'|'S3'} scoringModel
 * @returns {string} e.g. "avg S1: 87%" or "avg S2: 0.80" or "" when no data
 */
function _waveAggText(waveGroup, snapshots, scoringModel) {
  // Only non-archived habits contribute to wave aggregates (DESKTOP-03).
  const activeHabits = waveGroup.habits.filter(h => h.status !== 'archived');

  if (scoringModel === 'S1') {
    const scores = activeHabits
      .map(h => snapshots.get(h.id)?.s1Score)
      .filter(v => v != null);
    if (scores.length === 0) return '';
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return `avg S1: ${avg}%`;
  }

  if (scoringModel === 'S2') {
    const scores = activeHabits
      .map(h => snapshots.get(h.id)?.s2Score)
      .filter(v => v != null);
    if (scores.length === 0) return '';
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return `avg S2: ${avg.toFixed(2)}`;
  }

  // S3
  const scores = activeHabits
    .map(h => snapshots.get(h.id)?.s3Score)
    .filter(v => v != null);
  if (scores.length === 0) return '';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return `avg S3: ${avg.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// buildAnalyticsHeader
// ---------------------------------------------------------------------------

/**
 * Build the top dashboard header for the Analytics view.
 *
 * Returns a description tree containing:
 *   - A status summary row: counts of Healthy / Watch / At-risk / Failing
 *     (always computed from S1 status regardless of active model, per D-116)
 *   - A model selector radio group mirroring the Settings model selector
 *     (secondary display — changing the radio dispatches apply setSetting)
 *
 * @param {{ statusCounts: { Healthy: number, Watch: number, 'At-risk': number, Failing: number }, scoringModel: 'S1'|'S2'|'S3' }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildAnalyticsHeader({ statusCounts, scoringModel }) {
  const statuses = ['Healthy', 'Watch', 'At-risk', 'Failing'];
  const STATUS_I18N = { Healthy: 'desktop.status.healthy', Watch: 'desktop.status.watch', 'At-risk': 'desktop.status.atRisk', Failing: 'desktop.status.failing' };

  const statusSummaryChildren = statuses.map(status => ({
    tag: 'span',
    attrs: {
      class: `analytics-status-count analytics-status-count--${status.toLowerCase().replace('-', '-')}`,
    },
    text: `${t(STATUS_I18N[status])}: ${statusCounts[status] ?? 0}`,
  }));

  // Radio labels for S1, S2, S3 scoring model selector
  const modelRadioLabels = [
    { value: 'S1', label: t('settings.scoring.s1') },
    { value: 'S2', label: t('settings.scoring.s2') },
    { value: 'S3', label: t('settings.scoring.s3') },
  ].map(({ value, label }) => {
    /** @type {Record<string, string>} */
    const radioAttrs = {
      type: 'radio',
      name: 'scoringModel',
      value,
      'data-action': 'setScoringModel',
    };
    if (value === scoringModel) {
      radioAttrs.checked = '';
    }
    return {
      tag: 'label',
      children: [
        { tag: 'input', attrs: radioAttrs },
        label,
      ],
    };
  });

  return {
    tag: 'div',
    attrs: { class: 'analytics-header' },
    children: [
      {
        tag: 'div',
        attrs: { class: 'analytics-status-summary' },
        children: statusSummaryChildren,
      },
      {
        tag: 'div',
        attrs: { class: 'analytics-model-selector' },
        children: [
          { tag: 'span', text: t('desktop.analytics.scoringModel') },
          ...modelRadioLabels,
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// buildAnalyticsTable
// ---------------------------------------------------------------------------

/**
 * Build the habit table description tree, grouped by wave.
 *
 * Layout (D-116, DESKTOP-03):
 *   - thead: Habit / Stage / Rolling % / Mastery / [S2 Score or S3 Score when applicable]
 *   - For each wave: one analytics-wave-header row + one tr per (visible) habit
 *   - Wave header: spans all columns; shows wave name + inline aggregate score
 *   - Archived habits: included at 0.4 opacity via `.analytics-row--archived`
 *     ONLY when `showArchived` is true; otherwise omitted entirely
 *
 * @param {{
 *   habitsByWave: Array<{ waveNumber: number, waveName: string, habits: object[] }>,
 *   snapshots: Map<string, object>,
 *   scoringModel: 'S1'|'S2'|'S3',
 *   showArchived: boolean
 * }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildAnalyticsTable({ habitsByWave, snapshots, scoringModel, showArchived }) {
  const hasModelCol = scoringModel === 'S2' || scoringModel === 'S3';
  const colCount = hasModelCol ? 5 : 4;

  // Build thead
  const theadCols = [t('desktop.analytics.habit'), t('desktop.analytics.stageCol'), t('desktop.analytics.rollingPctCol'), t('desktop.analytics.masteryCol')];
  if (hasModelCol) {
    theadCols.push(t('desktop.analytics.modelScore', { model: scoringModel }));
  }
  const thead = {
    tag: 'thead',
    children: [
      {
        tag: 'tr',
        children: theadCols.map(col => ({ tag: 'th', text: col })),
      },
    ],
  };

  // Build tbody rows: wave headers + habit rows
  /** @type {object[]} */
  const bodyRows = [];

  for (const waveGroup of habitsByWave) {
    // Wave header row (spans all columns)
    const aggText = _waveAggText(waveGroup, snapshots, scoringModel);
    bodyRows.push({
      tag: 'tr',
      attrs: { class: 'analytics-wave-header' },
      children: [
        {
          tag: 'td',
          attrs: { colspan: String(colCount) },
          children: [
            { tag: 'span', attrs: { class: 'analytics-wave-name' }, text: t('catalog.wave', { n: waveGroup.waveNumber }) },
            { tag: 'span', attrs: { class: 'analytics-wave-agg' }, text: aggText },
          ],
        },
      ],
    });

    // Habit rows for this wave
    for (const habit of waveGroup.habits) {
      const isArchived = habit.status === 'archived';
      if (isArchived && !showArchived) continue;

      const snap = snapshots.get(habit.id);
      const s1Score  = snap?.s1Score ?? null;
      const s1Status = snap?.s1Status ?? null;
      const slug = statusSlug(s1Status);
      const badgeI18N = { Healthy: 'desktop.status.healthy', Watch: 'desktop.status.watch', 'At-risk': 'desktop.status.atRisk', Failing: 'desktop.status.failing' };

      /** @type {Record<string, string>} */
      const rowAttrs = { class: 'analytics-row' + (isArchived ? ' analytics-row--archived' : '') };

      const cells = [
        // 1. Habit name
        { tag: 'td', text: displayName(habit) },
        // 2. Stage — derived from currentStageIndex (0-based) + stages array.
        // habit.stage does not exist in the IDB schema; the seed stores
        // `stages: [{label, target, ...}]` and `currentStageIndex: number`.
        { tag: 'td', text: (habit.stages?.length > 0 && habit.currentStageIndex != null) ? t('desktop.analytics.stage', { n: habit.currentStageIndex + 1 }) : '' },
        // 3. Rolling % + S1 badge
        {
          tag: 'td',
          children: [
            { tag: 'span', text: `${s1Score != null ? s1Score : '—'}%` },
            {
              tag: 'span',
              attrs: { class: `score-badge score-badge--${slug}` },
              text: s1Status ? (t(badgeI18N[s1Status]) ?? s1Status) : '—',
            },
          ],
        },
        // 4. Mastery
        { tag: 'td', text: habit.status === 'mastered' ? t('desktop.analytics.mastered') : '' },
      ];

      // 5. Active model score (S2 or S3 column only)
      if (hasModelCol) {
        let modelScoreText;
        if (scoringModel === 'S2') {
          modelScoreText = snap?.s2Score != null ? snap.s2Score.toFixed(2) : '—';
        } else {
          modelScoreText = snap?.s3Score != null ? snap.s3Score.toFixed(2) : '—';
        }
        cells.push({
          tag: 'td',
          attrs: { class: 'analytics-model-score' },
          text: modelScoreText,
        });
      }

      bodyRows.push({
        tag: 'tr',
        attrs: rowAttrs,
        children: cells,
      });
    }
  }

  return {
    tag: 'table',
    attrs: { class: 'analytics-table' },
    children: [thead, ...bodyRows],
  };
}

// ---------------------------------------------------------------------------
// mountAnalytics
// ---------------------------------------------------------------------------

/**
 * Mount the Analytics view into `parent` and subscribe to store changes.
 *
 * Idempotency guard: if `parent.dataset.mounted === 'analytics'`, returns
 * immediately without rebuilding the skeleton (D-115 pattern). On every
 * `store.notify()`, re-reads the active scoringModel from IDB and re-renders
 * the table and header.
 *
 * Data fetch sequence (D-116):
 *   1. `repo.getAllHabits()`              → habit list
 *   2. `repo.getSetting('scoringModel')`  → active model (default 'S1')
 *   3. For each habit: fetch today's snapshot from score_snapshots store
 *   4. Build `snapshots` Map and `habitsByWave` array
 *   5. Render via `buildAnalyticsHeader` + `buildAnalyticsTable` + `mount()`
 *
 * @param {Element} parent - The panel element to mount into.
 * @param {{ repo: object, store: object }} deps - repo facade + store handle.
 * @returns {void}
 */
export function mountAnalytics(parent, { repo, store }) {
  // Idempotency guard — skeleton is built only once (D-115 pattern).
  if (parent.dataset.mounted === 'analytics') return;
  parent.dataset.mounted = 'analytics';

  // Cached state for incremental re-renders.
  let showArchived = false;

  // Container for the header (reactive on model change).
  const headerContainer = parent.ownerDocument.createElement('div');
  headerContainer.setAttribute('class', 'analytics-header-container');
  parent.appendChild(headerContainer);

  // "Show archived" toggle.
  const toggleLabel = parent.ownerDocument.createElement('label');
  toggleLabel.setAttribute('class', 'analytics-archived-toggle');
  const toggleCheckbox = parent.ownerDocument.createElement('input');
  toggleCheckbox.setAttribute('type', 'checkbox');
  toggleCheckbox.addEventListener('change', () => {
    showArchived = toggleCheckbox.checked;
    renderTable();
  });
  toggleLabel.appendChild(toggleCheckbox);
  toggleLabel.appendChild(parent.ownerDocument.createTextNode(' ' + t('desktop.showArchived')));
  parent.appendChild(toggleLabel);

  // Container for the table (reactive on model change + archived toggle).
  const tableContainer = parent.ownerDocument.createElement('div');
  tableContainer.setAttribute('class', 'analytics-table-container');
  parent.appendChild(tableContainer);

  // Data state — populated on first render and refreshed on notify.
  /** @type {object[]} */
  let cachedHabits = [];
  /** @type {Map<string, object>} */
  let cachedSnapshots = new Map();
  /** @type {'S1'|'S2'|'S3'} */
  let cachedModel = 'S1';

  /**
   * Build habitsByWave grouping from cachedHabits.
   *
   * @returns {Array<{ waveNumber: number, waveName: string, habits: object[] }>}
   */
  function buildHabitsByWave() {
    /** @type {Map<number, { waveNumber: number, waveName: string, habits: object[] }>} */
    const waveMap = new Map();
    for (const habit of cachedHabits) {
      const waveNum = habit.wave ?? 0;
      if (!waveMap.has(waveNum)) {
        const waveName = getWave(waveNum)?.name ?? `Wave ${waveNum}`;
        waveMap.set(waveNum, { waveNumber: waveNum, waveName, habits: [] });
      }
      waveMap.get(waveNum).habits.push(habit);
    }
    // Sort by wave number ascending.
    return Array.from(waveMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, group]) => group);
  }

  /**
   * Compute statusCounts from snapshots for the S1 status dashboard.
   * Always counts S1 status regardless of active model (D-116).
   *
   * @returns {{ Healthy: number, Watch: number, 'At-risk': number, Failing: number }}
   */
  function computeStatusCounts() {
    const counts = { Healthy: 0, Watch: 0, 'At-risk': 0, Failing: 0 };
    for (const habit of cachedHabits) {
      if (habit.status === 'archived') continue;
      const snap = cachedSnapshots.get(habit.id);
      const status = snap?.s1Status;
      if (status && status in counts) counts[status]++;
    }
    return counts;
  }

  /** Clear a container element's children safely (D-78 — no innerHTML). */
  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /** Re-render the header container from cached state. */
  function renderHeader() {
    clearChildren(headerContainer);
    const headerDesc = buildAnalyticsHeader({
      statusCounts: computeStatusCounts(),
      scoringModel: cachedModel,
    });
    mount(headerDesc, headerContainer, {
      setScoringModel: (evt) => {
        const value = evt.currentTarget?.value ?? evt.target?.value;
        if (['S1', 'S2', 'S3'].includes(value)) {
          // Import apply lazily to avoid circular dependencies at module level.
          import('../../state/apply.js').then(({ apply }) => {
            apply({ type: 'setSetting', payload: { key: 'scoringModel', value } });
          }).catch(() => {});
        }
      },
    });
  }

  /** Re-render the table container from cached state. */
  function renderTable() {
    clearChildren(tableContainer);
    const tableDesc = buildAnalyticsTable({
      habitsByWave: buildHabitsByWave(),
      snapshots: cachedSnapshots,
      scoringModel: cachedModel,
      showArchived,
    });
    mount(tableDesc, tableContainer);
  }

  /**
   * Fetch fresh data from IDB and re-render both header and table.
   *
   * @returns {Promise<void>}
   */
  async function refresh() {
    try {
      // 1. Habit catalog.
      cachedHabits = await repo.getAllHabits();

      // 2. Active scoring model.
      const modelRow = await repo.getSetting('scoringModel');
      cachedModel = modelRow?.value ?? 'S1';

      // 3. Latest snapshot for each habit — not today's snapshot.
      // Uses repo.getLatestSnapshot() which returns the most recent
      // score_snapshots row for the habit regardless of date. This fixes the
      // UAT-T21-v2 regression where getSnapshot(habitId, today) returned
      // undefined on any day after the last log write: writeHabitSnapshots
      // only runs on log mutation and only writes rows through todayLocal() at
      // write time, so there is no [habitId, today] row on subsequent days.
      // getLatestSnapshot queries the compound keypath range and returns the
      // row with the largest date, giving the Analytics view the freshest
      // available scores even when no log was written today.
      cachedSnapshots = new Map();
      for (const habit of cachedHabits) {
        try {
          const snap = await repo.getLatestSnapshot(habit.id);
          if (snap != null) cachedSnapshots.set(habit.id, snap);
        } catch (_e) {
          // Non-fatal — habit simply has no snapshot yet.
        }
      }
    } catch (_e) {
      // Non-fatal — render with whatever we have.
    }

    renderHeader();
    renderTable();
  }

  // Subscribe to store notifications for reactive model-switch updates (D-117).
  store.subscribe(async () => {
    await refresh();
  });

  // Initial render.
  refresh();
}
