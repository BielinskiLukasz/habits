/**
 * @file Wave Planning accordion section builder (WAVE-01, WAVE-02, WAVE-03, WAVE-04).
 * Renders per-wave rows with startDate, active/scheduled counts, health badge,
 * and collapsible habit lists with a Promote action for scheduled habits.
 *
 * D-26 Tier 1 / Pattern S8: `buildWavePlanningSection` is a pure function.
 * Caller pre-filters archived habits before passing (D-11).
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write` (D-78).
 *   - Direct `indexedDB.*` calls — use repo facade only (Anti-Pattern 1).
 *   - `switch` on cadence or event type — use dispatch tables (Anti-Pattern 4).
 */

import { worstStatus, statusSlug, isoWeekKey } from './waveboard.js';
import { apply } from '../../state/apply.js';
import { getCachedHabits } from '../../state/store.js';
import { getAllWaves } from '../../domain/wave.js';
import { todayLocal } from '../../util/date.js';
import { mount } from '../../util/mount.js';

// ---------------------------------------------------------------------------
// Cadence summary — dispatch table, no switch (Anti-Pattern 4)
// ---------------------------------------------------------------------------

/** @type {{ [key: string]: string }} */
const DOW_LABEL = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

/**
 * Compact cadence label for display in Wave Planning habit rows.
 *
 * @param {{ type: string, n?: number, days?: string[] }|undefined} cadence
 * @returns {string}
 */
function cadenceSummary(cadence) {
  if (!cadence) return '';
  const TYPE_LABEL = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    'every-n-days': `Every ${cadence.n} days`,
    'day-of-week-subset': cadence.days?.map(d => DOW_LABEL[d] ?? d).join('/'),
  };
  const result = TYPE_LABEL[cadence.type];
  if (result === undefined) return cadence.type;
  return result;
}

// ---------------------------------------------------------------------------
// Health badge (D-05, D-06)
// ---------------------------------------------------------------------------

/** @type {{ [key: string]: string }} */
const STATUS_LABEL = { Healthy: 'Healthy', Watch: 'Watch', 'At-risk': 'At Risk', Failing: 'Failing' };

/**
 * Build a health badge description node for a wave.
 * Badge is Upcoming when no habits have status === 'active' (D-06).
 * Badge is No data when active habits exist but no snapshots found (D-05).
 *
 * @param {object[]} waveHabits - Habits in this wave (no archived).
 * @param {string} currentWeekKey - ISO week key e.g. '2026-W01'.
 * @param {Map<string, Map<string, string>>} snapshotsByWeek - Map<habitId, Map<weekKey, s1Status>>.
 * @returns {{ tag: string, attrs: object, text: string }}
 */
function buildHealthBadge(waveHabits, currentWeekKey, snapshotsByWeek) {
  const activeOnly = waveHabits.filter(h => h.status === 'active');
  if (activeOnly.length === 0) {
    return { tag: 'span', attrs: { class: 'waveplanning-badge waveplanning-badge--upcoming' }, text: 'Upcoming' };
  }
  let worst = null;
  for (const h of activeOnly) {
    const weekMap = snapshotsByWeek.get(h.id);
    const s1 = weekMap?.get(currentWeekKey) ?? null;
    worst = worstStatus(worst, s1);
  }
  if (worst === null) {
    return { tag: 'span', attrs: { class: 'waveplanning-badge waveplanning-badge--na' }, text: 'No data' };
  }
  const slug = statusSlug(worst);
  const label = STATUS_LABEL[worst] ?? worst;
  return { tag: 'span', attrs: { class: `waveplanning-badge waveplanning-badge--${slug}` }, text: label };
}

// ---------------------------------------------------------------------------
// Habit row builders
// ---------------------------------------------------------------------------

/**
 * Build a li.waveplanning-habit-row for an active or mastered habit.
 *
 * @param {object} habit
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function buildActiveHabitRow(habit) {
  const stages = habit.stages ?? [];
  const stageIndex = habit.currentStageIndex ?? 0;
  const stageLabel = stages[stageIndex]?.label ?? '';
  return {
    tag: 'li',
    attrs: { class: 'waveplanning-habit-row' },
    children: [
      { tag: 'span', attrs: { class: 'waveplanning-habit-name' }, text: habit.name },
      { tag: 'span', attrs: { class: 'waveplanning-habit-status' }, text: habit.status },
      { tag: 'span', attrs: { class: 'waveplanning-habit-stage' }, text: stageLabel },
      { tag: 'span', attrs: { class: 'waveplanning-habit-cadence' }, text: cadenceSummary(habit.cadence) },
    ],
  };
}

/**
 * Build a li.waveplanning-scheduled-row for a scheduled habit.
 *
 * @param {object} habit
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function buildScheduledHabitRow(habit) {
  return {
    tag: 'li',
    attrs: { class: 'waveplanning-scheduled-row' },
    children: [
      { tag: 'span', attrs: { class: 'waveplanning-habit-name' }, text: habit.name },
      { tag: 'span', attrs: { class: 'waveplanning-scheduled-date' }, text: habit.startDate ?? '' },
      {
        tag: 'button',
        attrs: {
          class: 'waveplanning-promote-btn',
          'aria-label': `Promote ${habit.name} to active`,
          'data-habit-id': habit.id,
        },
        text: 'Promote to active',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Habit list builder
// ---------------------------------------------------------------------------

/**
 * Build the ul.waveplanning-habit-list for one wave.
 *
 * @param {object} wave
 * @param {object[]} activeHabits - active + mastered habits in this wave.
 * @param {object[]} scheduledHabits - scheduled habits in this wave.
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function buildHabitList(wave, activeHabits, scheduledHabits) {
  const children = [...activeHabits.map(buildActiveHabitRow)];

  if (scheduledHabits.length > 0) {
    children.push({ tag: 'h3', attrs: { class: 'waveplanning-scheduled-heading' }, text: 'Scheduled' });
    children.push(...scheduledHabits.map(buildScheduledHabitRow));
  }

  if (activeHabits.length + scheduledHabits.length === 0) {
    children.push({ tag: 'li', attrs: { class: 'waveplanning-empty' }, text: 'No habits in this wave.' });
  }

  return {
    tag: 'ul',
    attrs: { class: 'waveplanning-habit-list', id: `wave-${wave.number}-list`, hidden: '' },
    children,
  };
}

// ---------------------------------------------------------------------------
// Wave item builder
// ---------------------------------------------------------------------------

/**
 * Build a div.waveplanning-wave for one wave.
 *
 * @param {object} wave
 * @param {object[]} habits - All habits for this wave (no archived).
 * @param {string} currentWeekKey
 * @param {Map<string, Map<string, string>>} snapshotsByWeek
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function buildWaveItem(wave, habits, currentWeekKey, snapshotsByWeek) {
  const waveHabits = habits.filter(h => Number(h.wave) === wave.number);
  const activeHabits = waveHabits.filter(h => h.status === 'active' || h.status === 'mastered');
  const scheduledHabits = waveHabits.filter(h => h.status === 'scheduled');

  const countsText = `${activeHabits.length} active · ${scheduledHabits.length} scheduled`;
  const badgeDesc = buildHealthBadge(waveHabits, currentWeekKey, snapshotsByWeek);

  const headerButton = {
    tag: 'button',
    attrs: {
      class: 'waveplanning-wave-header',
      'aria-expanded': 'false',
      'aria-controls': `wave-${wave.number}-list`,
      'aria-label': `Toggle habit list for Wave ${wave.number}`,
      'data-wave-number': String(wave.number),
    },
    children: [
      { tag: 'span', attrs: { class: 'waveplanning-chevron' }, text: '▶' },
      { tag: 'span', attrs: { class: 'waveplanning-wave-name' }, text: wave.name },
      {
        tag: 'span',
        attrs: { class: 'waveplanning-wave-meta' },
        children: [
          { tag: 'span', attrs: { class: 'waveplanning-wave-date' }, text: wave.startDate ?? '' },
          { tag: 'span', attrs: { class: 'waveplanning-wave-counts' }, text: countsText },
          badgeDesc,
        ],
      },
    ],
  };

  const habitList = buildHabitList(wave, activeHabits, scheduledHabits);

  return {
    tag: 'div',
    attrs: { class: 'waveplanning-wave' },
    children: [headerButton, habitList],
  };
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build the Wave Planning section description tree.
 * Pure function — no DOM access, no async, no side effects.
 *
 * @param {{
 *   waves: object[],
 *   habits: object[],
 *   currentWeekKey: string,
 *   snapshotsByWeek: Map<string, Map<string, string>>
 * }} args
 *   - waves: from getAllWaves()
 *   - habits: from getCachedHabits(), pre-filtered (no archived, D-11)
 *   - currentWeekKey: ISO week key for current week e.g. '2026-W26'
 *   - snapshotsByWeek: Map<habitId, Map<weekKey, s1Status>>
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildWavePlanningSection({ waves, habits, currentWeekKey, snapshotsByWeek }) {
  const waveItems = (waves ?? []).map(wave => buildWaveItem(wave, habits, currentWeekKey, snapshotsByWeek));
  return {
    tag: 'section',
    attrs: { class: 'waveplanning', 'aria-label': 'Wave Planning' },
    children: [
      { tag: 'h2', attrs: { class: 'waveplanning-title' }, text: 'Wave Planning' },
      ...waveItems,
    ],
  };
}

// ---------------------------------------------------------------------------
// Live mount
// ---------------------------------------------------------------------------

/**
 * Mounts the Wave Planning accordion section into parent element.
 * @param {HTMLElement} parent
 * @param {{ repo: object, store: object }} deps
 */
export function mountWavePlanning(parent, { repo, store }) {
  // Idempotency guard
  if (parent.dataset.wavePlanningMounted) return;
  parent.dataset.wavePlanningMounted = 'true';

  // Container + separator
  const container = document.createElement('div');
  container.className = 'waveplanning-wrapper';
  parent.appendChild(container);

  const sep = document.createElement('hr');
  sep.className = 'waveplanning-heatmap-separator';
  parent.appendChild(sep);

  // Delegated accordion listener (attached ONCE)
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button.waveplanning-wave-header');
    if (!btn) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    const listId = btn.getAttribute('aria-controls');
    const list = document.getElementById(listId);
    if (!list) return;
    if (expanded) {
      list.setAttribute('hidden', '');
    } else {
      list.removeAttribute('hidden');
    }
  });

  // Delegated promote listener (attached ONCE)
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.waveplanning-promote-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const habitId = btn.dataset.habitId;
    try {
      await apply({ type: 'promoteHabit', payload: { habitId } });
    } catch (_err) {
      btn.disabled = false;
      const errSpan = document.createElement('span');
      errSpan.className = 'waveplanning-promote-error';
      errSpan.textContent = 'Failed — try again';
      btn.parentNode.insertBefore(errSpan, btn.nextSibling);
      setTimeout(() => errSpan.remove(), 3000);
    }
  });

  function saveExpandedState() {
    const state = new Map();
    container.querySelectorAll('button.waveplanning-wave-header').forEach(btn => {
      state.set(btn.dataset.waveNumber, btn.getAttribute('aria-expanded') === 'true');
    });
    return state;
  }

  function restoreExpandedState(state) {
    container.querySelectorAll('button.waveplanning-wave-header').forEach(btn => {
      if (state.get(btn.dataset.waveNumber) === true) {
        btn.setAttribute('aria-expanded', 'true');
        const list = document.getElementById(btn.getAttribute('aria-controls'));
        if (list) list.removeAttribute('hidden');
      }
    });
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  async function rerenderSection() {
    const expandedState = saveExpandedState();
    clearChildren(container);

    const waves = getAllWaves();
    // Read directly from repo (same as the heatmap) — bypasses cache timing
    // issues that caused all wave counts to show 0 while the heatmap was correct.
    let allHabits;
    try {
      allHabits = await repo.getAllHabits();
    } catch (_e) {
      allHabits = getCachedHabits();
    }
    const habits = allHabits.filter(h => h.status !== 'archived');

    const today = todayLocal();
    const sevenDaysAgoDate = new Date(today);
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
    const sevenDaysAgo = sevenDaysAgoDate.toISOString().slice(0, 10);

    let snapshotRows = [];
    try {
      snapshotRows = await repo.getSnapshotsInRange(sevenDaysAgo, today);
    } catch (_e) {
      snapshotRows = [];
    }

    // Build snapshotsByWeek: Map<habitId, Map<weekKey, s1Status>>
    const snapshotsByWeek = new Map();
    for (const row of snapshotRows) {
      if (!snapshotsByWeek.has(row.habitId)) snapshotsByWeek.set(row.habitId, new Map());
      snapshotsByWeek.get(row.habitId).set(isoWeekKey(row.date), row.s1Status);
    }

    const currentWeekKey = isoWeekKey(today);
    const desc = buildWavePlanningSection({ waves, habits, currentWeekKey, snapshotsByWeek });
    mount(desc, container);
    restoreExpandedState(expandedState);
  }

  store.subscribe(async () => { await rerenderSection(); });

  rerenderSection(); // fire-and-forget initial render
}
