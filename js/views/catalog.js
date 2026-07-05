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
 *   - Evaluates mastery for each habit by reading `isMastered` from the latest
 *     `score_snapshots` row (pre-computed by scoreSnapshots.js at log-write time).
 *   - Sorts: active first, then archived; within each group by wave asc.
 *   - Renders catalog header + habit list.
 *   - Wires action handlers via mount() actions map for all CRUD operations.
 *   - Subscribe to store.subscribe(render) for live re-renders.
 *   - Add/Edit panels open inside `<dialog id="catalog-modal">` via dialog.showModal();
 *     closed via dialog.close() + clearChildren(dialog) in _closeOpenPanel.
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
import {
  subscribe,
  getCachedHabits,
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
 * Evaluate mastery state for all habits by reading pre-computed `isMastered`
 * values from the `score_snapshots` IDB store via `repo.getLatestSnapshot`.
 *
 * Rationale: calling `evaluateMastery(habit, [], today, ctx)` with an empty
 * logs array always returned `isMastered: false` for every active habit because
 * `completedCount` is always 0. The correct approach is to read the value that
 * `scoreSnapshots.js::writeHabitSnapshots` already computed from the real log
 * history when the user last wrote a completion.
 *
 * Falls back to `false` for habits that have never had a log written (no
 * snapshot row exists yet).
 *
 * For habits with `status === 'mastered'` (permanently promoted in the IDB
 * model), we return `isMastered: true` directly — they may not have a
 * recent snapshot if they were promoted before the scoring system was active.
 *
 * @param {object[]} habits
 * @param {{ repo: object }} deps
 * @returns {Promise<Map<string, { isMastered: boolean }>>}
 */
async function evaluateMasteryForCatalog(habits, deps) {
  const { repo } = deps;
  const results = new Map();
  for (const habit of habits) {
    // Permanently mastered habits are promoted in the IDB model — shortcut.
    if (habit.status === 'mastered') {
      results.set(habit.id, { isMastered: true });
      continue;
    }
    // Read the pre-computed isMastered flag from the latest score_snapshot row.
    // Falls back to false when no snapshot exists (habit has no log history yet).
    try {
      const snap = await repo.getLatestSnapshot(habit.id);
      results.set(habit.id, { isMastered: snap?.isMastered === true });
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

  // Load habits from cache first; fall back to repo if cache is cold.
  let habits = getCachedHabits ? getCachedHabits() : [];
  if (!habits.length && repo && typeof repo.getAllHabits === 'function') {
    try {
      habits = await repo.getAllHabits();
    } catch (_e) {
      habits = [];
    }
  }

  const masteryMap = await evaluateMasteryForCatalog(habits, deps);
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
     * Open the create panel in the catalog modal dialog.
     */
    create: () => {
      const dialog = document.getElementById('catalog-modal');
      // Remove any open panel first (closes dialog if open).
      _closeOpenPanel(parent);
      const today = todayLocal();
      const panelDesc = buildCreatePanel(today);
      const panelActions = buildActions(parent, deps);
      if (dialog) {
        clearChildren(dialog);
        mount(panelDesc, dialog, panelActions);
        dialog.showModal();
      }
    },

    /**
     * Open the edit panel for a habit in the catalog modal dialog.
     * Reads `data-habit-id` from the button.
     */
    edit: (evt) => {
      const habitId = evt?.currentTarget?.getAttribute('data-habit-id')
        ?? evt?.target?.getAttribute('data-habit-id');
      if (!habitId) return;
      const habits = getCachedHabits ? getCachedHabits() : [];
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const dialog = document.getElementById('catalog-modal');
      // Remove any open panel first (closes dialog if open).
      _closeOpenPanel(parent);
      const panelDesc = buildEditPanel(habit);
      const panelActions = buildActions(parent, deps);
      if (dialog) {
        clearChildren(dialog);
        mount(panelDesc, dialog, panelActions);
        dialog.showModal();
      }
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
 * Close the catalog modal dialog and clear its contents. Also removes any
 * residual inline panel from parent (resilience fallback — after the dialog
 * refactor this branch is always a noop).
 *
 * @param {object} parent
 */
function _closeOpenPanel(parent) {
  const dialog = document.getElementById('catalog-modal');
  if (dialog?.open) {
    dialog.close();
    clearChildren(dialog);
  }
  // Resilience fallback: remove any inline panel that may have been mounted
  // before the dialog refactor (should always be a noop in production).
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
