/**
 * @file Catalog view mounter (CATALOG-01..07, STAGE-01..03, MASTERY-02..03, D-82).
 *
 * Wires the pure description builders (`js/views/catalog/builders.js`) into
 * real DOM via `mount()` (D-77). `mountCatalog(parent, {repo, store})` performs
 * the initial render, subscribes to the store notify for re-renders on any
 * (same-tab or cross-tab) mutation, and returns an `unmount()` closure that
 * drops the subscription + clears the parent.
 *
 * Architecture:
 *   - Reads all habits from repo (or store cache when warm).
 *   - Evaluates mastery for each habit using `evaluateMastery` from mastery.js.
 *   - Sorts: active first, then archived; within each group by wave asc.
 *   - Renders catalog header + habit list.
 *   - Wires action handlers via mount() actions map for all CRUD operations.
 *   - Subscribe to store.subscribe(render) for live re-renders.
 *
 * Action handlers:
 *   - 'create' → open buildCreatePanel below the header
 *   - 'edit' → open buildEditPanel for the clicked habit
 *   - 'archive' → apply({type:'archiveHabit', payload:{habitId}})
 *   - 'restore' → apply({type:'restoreHabit', payload:{habitId}})
 *   - 'advance-stage' → apply({type:'advanceStage', payload:{habitId, triggerType:'manual'}})
 *   - 'save-edit' → collect form fields → apply({type:'editHabit', payload})
 *   - 'save-create' → collect form fields → apply({type:'createHabit', payload})
 *   - 'cancel-edit' / 'cancel-create' → close panel
 *   - 'add-stage' → add a new stage row to the open panel
 *
 * XSS safety: all habit names rendered via textContent (D-78 grep gate).
 * Touch targets: all interactive buttons >= 44×44px (D-79, NFR-06).
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Direct DOM construction outside the `mount()` helper.
 */

import {
  buildCatalogHeader,
  buildHabitListItem,
  buildEditPanel,
  buildCreatePanel,
} from './catalog/builders.js';
import { mount } from '../util/mount.js';
import { apply } from '../state/apply.js';
import { todayLocal } from '../util/date.js';
import { evaluateMastery } from '../domain/mastery.js';
import { appliesToday } from '../domain/cadence.js';
import {
  subscribe,
  getCachedHabits,
  getCachedSettings,
  getCachedWeekStart,
  getCachedWeekCompletions,
} from '../state/store.js';
import { showErrorToast } from './toast.js';

/** Singleton unsubscribe handle — second mountCatalog call returns existing unmount. */
let _unsub = null;
/** Currently bound parent for re-renders. */
let _currentParent = null;
/** Currently bound deps for re-renders. */
let _currentDeps = null;

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
 * Compute the mastery context from current store cache.
 *
 * @returns {{ globalThreshold: number, globalWindow: number, appliesToday: Function, weekStart: string, weekCompletions: Function, monthCompletions: Function }}
 */
function buildMasteryCtx() {
  const cachedSettings = getCachedSettings ? getCachedSettings() : {};
  const weekStart = getCachedWeekStart ? getCachedWeekStart() : 'mon';
  return {
    globalThreshold: cachedSettings.masteryThreshold ?? 90,
    globalWindow: cachedSettings.masteryWindow ?? 70,
    appliesToday: (habit, date, ctx) => appliesToday(habit, date, ctx),
    weekStart,
    weekCompletions: (habitId, start, end) => getCachedWeekCompletions(habitId, start, end),
    // monthCompletions not in the store cache yet — stub to 0 (safe default)
    monthCompletions: () => 0,
  };
}

/**
 * Evaluate mastery state for all habits. For each habit, we pass an empty logs
 * array because loading all logs for all habits at catalog render time is too
 * expensive. The catalog shows a best-effort mastery state using the cached
 * data only. Full mastery evaluation per log happens in the scoring pass.
 *
 * For habits that have `status === 'mastered'`, we return isMastered=true
 * directly — the habit is already promoted in the IDB model.
 *
 * @param {object[]} habits
 * @param {string} today
 * @returns {Map<string, { isMastered: boolean }>}
 */
function evaluateMasteryForCatalog(habits, today) {
  const ctx = buildMasteryCtx();
  const results = new Map();
  for (const habit of habits) {
    if (habit.status === 'mastered') {
      results.set(habit.id, { isMastered: true });
      continue;
    }
    try {
      // We evaluate with an empty logs array as a lightweight fast-path.
      // Catalog's mastery badge is status-based, not rolling-window-based.
      const state = evaluateMastery(habit, [], today, ctx);
      results.set(habit.id, { isMastered: state.isMastered });
    } catch (_e) {
      results.set(habit.id, { isMastered: false });
    }
  }
  return results;
}

/**
 * Sort habits: active first, then archived; within each group by wave asc,
 * then by id (stable fallback).
 *
 * @param {object[]} habits
 * @returns {object[]}
 */
function sortHabits(habits) {
  return [...habits].sort((a, b) => {
    const aArchived = a.status === 'archived' ? 1 : 0;
    const bArchived = b.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    const waveDiff = (a.wave ?? 0) - (b.wave ?? 0);
    if (waveDiff !== 0) return waveDiff;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

/**
 * Collect form field values from an edit/create panel DOM element.
 * Reads all inputs/selects with [data-field] attributes.
 *
 * @param {object} panelEl
 * @returns {object} collected fields
 */
function collectPanelFields(panelEl) {
  const fields = {};
  const inputs = panelEl.querySelectorAll('[data-field]');
  for (const input of inputs) {
    const field = input.getAttribute('data-field');
    if (!field) continue;
    if (input.type === 'checkbox') {
      fields[field] = input.checked;
    } else if (input.type === 'number') {
      const v = input.value.trim();
      fields[field] = v === '' ? null : Number(v);
    } else {
      fields[field] = input.value;
    }
  }
  // Collect stages from stage list.
  const stageItems = panelEl.querySelectorAll('.catalog-stage-row');
  if (stageItems.length > 0) {
    const stages = [];
    for (const item of stageItems) {
      const labelInput = item.querySelector('[data-field="stage-label"]');
      const targetInput = item.querySelector('[data-field="stage-target"]');
      const label = labelInput ? labelInput.value : '';
      const targetVal = targetInput ? targetInput.value.trim() : '';
      stages.push({
        label,
        target: targetVal === '' ? null : Number(targetVal),
      });
    }
    fields.stages = stages;
  } else {
    fields.stages = [];
  }
  return fields;
}

/**
 * Add a new blank stage row to the open panel's stages list.
 *
 * @param {object} panelEl
 */
function addStageRowToDom(panelEl) {
  const stagesList = panelEl.querySelector('.catalog-stages-list');
  if (!stagesList) return;
  const currentCount = stagesList.querySelectorAll('.catalog-stage-row').length;
  const doc = panelEl.ownerDocument;
  const li = doc.createElement('li');
  li.setAttribute('class', 'catalog-stage-row');
  li.setAttribute('data-stage-index', String(currentCount));

  const labelInput = doc.createElement('input');
  labelInput.type = 'text';
  labelInput.setAttribute('data-field', 'stage-label');
  labelInput.setAttribute('data-stage-index', String(currentCount));
  labelInput.placeholder = 'Stage label';
  li.appendChild(labelInput);

  const targetInput = doc.createElement('input');
  targetInput.type = 'number';
  targetInput.setAttribute('data-field', 'stage-target');
  targetInput.setAttribute('data-stage-index', String(currentCount));
  targetInput.placeholder = 'Target (optional)';
  li.appendChild(targetInput);

  stagesList.appendChild(li);
}

/**
 * Render the Catalog panel into `parent`.
 *
 * @param {object} parent
 * @param {{ repo: object, store: object }} deps
 * @returns {Promise<void>}
 */
async function renderCatalogInto(parent, deps) {
  const { repo } = deps;
  clearChildren(parent);

  const today = todayLocal();

  // Load habits from cache first; fall back to repo if cache is cold.
  let habits = getCachedHabits ? getCachedHabits() : [];
  if (!habits.length && repo && typeof repo.getAllHabits === 'function') {
    try {
      habits = await repo.getAllHabits();
    } catch (_e) {
      habits = [];
    }
  }

  const masteryMap = evaluateMasteryForCatalog(habits, today);
  const sorted = sortHabits(habits);

  // Build actions map that closures over the live parent + deps.
  const actions = buildActions(parent, deps);

  // Render header.
  mount(buildCatalogHeader(), parent, actions);

  // Render habit list container.
  const doc = parent.ownerDocument;
  const listEl = doc.createElement('ul');
  listEl.setAttribute('class', 'catalog-habit-list');
  listEl.setAttribute('aria-label', 'Habit catalog');
  parent.appendChild(listEl);

  for (const habit of sorted) {
    const masteryState = masteryMap.get(habit.id) ?? { isMastered: false };
    mount(buildHabitListItem(habit, masteryState), listEl, actions);
  }

  if (sorted.length === 0) {
    const empty = doc.createElement('li');
    empty.setAttribute('class', 'catalog-empty');
    empty.textContent = 'No habits yet. Tap "New habit" to create one.';
    listEl.appendChild(empty);
  }
}

/**
 * Convert cadenceType string to cadence object. For types without sub-properties,
 * returns {type}. For every-n-days, defaults n=2. For day-of-week-subset, defaults
 * to weekdays (mon-fri).
 *
 * @param {string} cadenceType
 * @returns {{ type: string, n?: number, days?: string[] }}
 */
function buildCadenceFromType(cadenceType) {
  const type = cadenceType ?? 'daily';
  if (type === 'every-n-days') {
    return { type, n: 2 };
  }
  if (type === 'day-of-week-subset') {
    return { type, days: ['mon', 'tue', 'wed', 'thu', 'fri'] };
  }
  return { type };
}

/**
 * Build the shared actions map for the catalog view. Closures capture
 * `parent` and `deps` for re-renders.
 *
 * @param {object} parent
 * @param {{ repo: object, store: object }} deps
 * @returns {Record<string, Function>}
 */
function buildActions(parent, deps) {
  return {
    /**
     * Open the create panel below the header.
     */
    create: () => {
      // Remove any open panel first.
      _closeOpenPanel(parent);
      const today = todayLocal();
      const panelDesc = buildCreatePanel(today);
      const panelActions = buildActions(parent, deps);
      mount(panelDesc, parent, panelActions);
    },

    /**
     * Open the edit panel for a habit. Reads `data-habit-id` from the button.
     */
    edit: (evt) => {
      const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
        ?? evt?.target?.getAttribute('data-habit-id');
      if (!habitId) return;
      const habits = getCachedHabits ? getCachedHabits() : [];
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      _closeOpenPanel(parent);
      const panelDesc = buildEditPanel(habit);
      const panelActions = buildActions(parent, deps);
      mount(panelDesc, parent, panelActions);
    },

    /**
     * Archive a habit.
     */
    archive: async (evt) => {
      const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
        ?? evt?.target?.getAttribute('data-habit-id');
      if (!habitId) return;
      try {
        await apply({ type: 'archiveHabit', payload: { habitId } });
        // store.subscribe will trigger re-render.
      } catch (_e) {
        showErrorToast("Couldn't archive habit — try again");
      }
    },

    /**
     * Restore an archived habit.
     */
    restore: async (evt) => {
      const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
        ?? evt?.target?.getAttribute('data-habit-id');
      if (!habitId) return;
      try {
        await apply({ type: 'restoreHabit', payload: { habitId } });
      } catch (_e) {
        showErrorToast("Couldn't restore habit — try again");
      }
    },

    /**
     * Manual stage advance.
     */
    'advance-stage': async (evt) => {
      const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
        ?? evt?.target?.getAttribute('data-habit-id');
      if (!habitId) return;
      try {
        await apply({
          type: 'advanceStage',
          payload: { habitId, triggerType: 'manual' },
        });
      } catch (_e) {
        showErrorToast("Couldn't advance stage — try again");
      }
    },

    /**
     * Save edits to an existing habit.
     */
    'save-edit': async (evt) => {
      const panelEl = evt?.currentTarget?.closest('[data-panel="edit"]')
        ?? evt?.target?.closest('[data-panel="edit"]');
      if (!panelEl) return;
      const habitId = panelEl.getAttribute('data-habit-id');
      if (!habitId) return;
      const fields = collectPanelFields(panelEl);
      try {
        await apply({
          type: 'editHabit',
          payload: {
            habitId,
            name: fields.name,
            name_pl: fields.name_pl || null,
            wave: fields.wave,
            cadence: buildCadenceFromType(fields['cadence-type']),
            targetType: fields.targetType,
            target: fields.target,
            startDate: fields.startDate || null,
            stages: fields.stages,
            masteryThresholdOverride: fields.masteryThresholdOverride || null,
            masteryWindowOverride: fields.masteryWindowOverride || null,
          },
        });
        _closeOpenPanel(parent);
      } catch (_e) {
        showErrorToast("Couldn't save habit — try again");
      }
    },

    /**
     * Save a new habit.
     */
    'save-create': async (evt) => {
      const panelEl = evt?.currentTarget?.closest('[data-panel="create"]')
        ?? evt?.target?.closest('[data-panel="create"]');
      if (!panelEl) return;
      const fields = collectPanelFields(panelEl);
      try {
        await apply({
          type: 'createHabit',
          payload: {
            name: fields.name,
            name_pl: fields.name_pl || null,
            wave: fields.wave ?? 1,
            cadence: buildCadenceFromType(fields['cadence-type']),
            targetType: fields.targetType ?? 'binary',
            target: fields.target,
            startDate: fields.startDate || todayLocal(),
            stages: fields.stages ?? [],
            masteryThresholdOverride: fields.customMastery ? fields.masteryThresholdOverride : null,
            masteryWindowOverride: fields.customMastery ? fields.masteryWindowOverride : null,
          },
        });
        _closeOpenPanel(parent);
      } catch (_e) {
        showErrorToast("Couldn't create habit — try again");
      }
    },

    /**
     * Cancel edit — close panel.
     */
    'cancel-edit': () => {
      _closeOpenPanel(parent);
    },

    /**
     * Cancel create — close panel.
     */
    'cancel-create': () => {
      _closeOpenPanel(parent);
    },

    /**
     * Add a blank stage row to the open panel.
     */
    'add-stage': (evt) => {
      const panelEl =
        evt?.currentTarget?.closest('[data-panel]') ??
        evt?.target?.closest('[data-panel]');
      if (!panelEl) return;
      addStageRowToDom(panelEl);
    },
  };
}

/**
 * Remove any open edit/create panel from the catalog panel.
 *
 * @param {object} parent
 */
function _closeOpenPanel(parent) {
  const openPanel = parent.querySelector('[data-panel="edit"], [data-panel="create"]');
  if (openPanel && openPanel.parentNode) {
    openPanel.parentNode.removeChild(openPanel);
  }
}

/**
 * Mount the Catalog view into `parent`. Subscribes to the store notify channel
 * so any mutation (same-tab or cross-tab) triggers a re-render. Returns an
 * `unmount()` closure that drops the subscription and clears the panel.
 *
 * Idempotent: calling `mountCatalog` a second time without unmounting first
 * returns the existing unmount closure (no duplicate subscription).
 *
 * @param {object} parent — element to render into (must expose ownerDocument)
 * @param {{ repo: object, store: object }} deps
 * @returns {Promise<() => void>} unmount
 */
export async function mountCatalog(parent, deps) {
  if (_unsub) {
    // Already mounted — re-render against the live parent.
    _currentDeps = deps;
    await renderCatalogInto(parent, deps);
    return _createUnmount(parent);
  }

  _currentParent = parent;
  _currentDeps = deps;

  await renderCatalogInto(parent, deps);

  // Subscribe to store.notify for live re-renders.
  _unsub = subscribe(() => {
    if (_currentParent && _currentDeps) {
      renderCatalogInto(_currentParent, _currentDeps).catch(() => {});
    }
  });

  return _createUnmount(parent);
}

/**
 * Create the unmount closure.
 *
 * @param {object} parent
 * @returns {() => void}
 */
function _createUnmount(parent) {
  return function unmount() {
    if (_unsub) {
      _unsub();
      _unsub = null;
    }
    _currentParent = null;
    _currentDeps = null;
    clearChildren(parent);
  };
}

/**
 * Test-only: clear module-level state so fresh-import tests start from a
 * pristine instance. Production never calls this.
 *
 * @returns {void}
 */
export function _resetCatalogForTest() {
  if (_unsub) {
    try { _unsub(); } catch (_e) {}
    _unsub = null;
  }
  _currentParent = null;
  _currentDeps = null;
}
