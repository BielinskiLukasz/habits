/**
 * @file Pure catalog view builders (CATALOG-01..07, D-82, D-83, D-87).
 *
 * Every builder returns `{tag, attrs?, text?, children?}` — the same shape
 * the `mount()` helper (D-77) consumes. NO DOM access here; that lives in
 * `js/views/catalog.js`. Splitting the two halves keeps the builders
 * trivially unit-testable in Node (Pattern S8, D-26 Tier 1) and pushes the
 * XSS-safe DOM construction discipline (D-78 grep gate) to a single seam.
 *
 * Forbidden constructs in this file:
 *   - Any DOM access (createElement, document.*, etc.) — builders are pure.
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Calls to `apply`, `repo`, or `store` — pure description trees only.
 */

/**
 * Build the Catalog header description: a `<header class="catalog-header">`
 * containing `<h1>Catalog</h1>` and a "New habit" button (`data-action="create"`).
 * Touch target >= 44×44px enforced via CSS class (NFR-06, D-79).
 *
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildCatalogHeader() {
  return {
    tag: 'header',
    attrs: { class: 'catalog-header' },
    children: [
      { tag: 'h1', text: 'Catalog' },
      {
        tag: 'button',
        attrs: {
          class: 'catalog-btn catalog-btn--create',
          'data-action': 'create',
          'aria-label': 'Create new habit',
        },
        text: 'New habit',
      },
    ],
  };
}

/**
 * Build a description for one habit row in the catalog list.
 *
 * Displays: habit name (primary), Wave N badge, status badge, current stage
 * label (if any). When `masteryState.isMastered` is true, adds the
 * `habit-row--mastered` class and a "Mastered" badge (D-85, MASTERY-03).
 *
 * Buttons emitted: Edit + Archive (active habits) or Restore (archived).
 * When the current stage has `allowManual: true`, an "Advance stage" button
 * is also emitted (STAGE-01, D-84).
 *
 * All buttons carry `data-habit-id` so the mounter can identify the target
 * without DOM traversal.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   wave: number,
 *   status: 'active' | 'mastered' | 'archived',
 *   stages: Array<{ label: string, allowManual?: boolean }>,
 *   currentStageIndex: number,
 * }} habit
 * @param {{ isMastered: boolean }} masteryState
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildHabitListItem(habit, masteryState) {
  const isMastered = masteryState?.isMastered === true;
  const rowClass = isMastered
    ? 'catalog-habit-row habit-row--mastered'
    : 'catalog-habit-row';

  const stages = habit.stages ?? [];
  const stageIndex = habit.currentStageIndex ?? 0;
  const currentStage = stages[stageIndex];
  const stageLabel = currentStage?.label ?? '';

  /** @type {object[]} */
  const children = [];

  // Primary info block: name + badges.
  const badgeChildren = [
    { tag: 'span', attrs: { class: 'catalog-habit-wave' }, text: `Wave ${habit.wave}` },
    { tag: 'span', attrs: { class: 'catalog-habit-status' }, text: habit.status },
  ];
  if (stageLabel) {
    badgeChildren.push({
      tag: 'span',
      attrs: { class: 'catalog-habit-stage' },
      text: stageLabel,
    });
  }
  if (isMastered) {
    badgeChildren.push({
      tag: 'span',
      attrs: { class: 'catalog-habit-mastered-badge' },
      text: 'Mastered',
    });
  }

  children.push({
    tag: 'div',
    attrs: { class: 'catalog-habit-info' },
    children: [
      { tag: 'span', attrs: { class: 'catalog-habit-name' }, text: habit.name },
      { tag: 'div', attrs: { class: 'catalog-habit-badges' }, children: badgeChildren },
    ],
  });

  // Action buttons block.
  /** @type {object[]} */
  const actionBtns = [];

  // Edit button.
  actionBtns.push({
    tag: 'button',
    attrs: {
      class: 'catalog-btn catalog-btn--edit',
      'data-action': 'edit',
      'data-habit-id': habit.id,
      'aria-label': `Edit ${habit.name}`,
    },
    text: 'Edit',
  });

  // Archive or Restore based on status.
  if (habit.status === 'archived') {
    actionBtns.push({
      tag: 'button',
      attrs: {
        class: 'catalog-btn catalog-btn--restore',
        'data-action': 'restore',
        'data-habit-id': habit.id,
        'aria-label': `Restore ${habit.name}`,
      },
      text: 'Restore',
    });
  } else {
    actionBtns.push({
      tag: 'button',
      attrs: {
        class: 'catalog-btn catalog-btn--archive',
        'data-action': 'archive',
        'data-habit-id': habit.id,
        'aria-label': `Archive ${habit.name}`,
      },
      text: 'Archive',
    });
  }

  // Advance stage button (only when current stage has allowManual=true).
  if (currentStage?.allowManual === true) {
    actionBtns.push({
      tag: 'button',
      attrs: {
        class: 'catalog-btn catalog-btn--advance',
        'data-action': 'advance-stage',
        'data-habit-id': habit.id,
        'aria-label': `Advance stage for ${habit.name}`,
      },
      text: 'Advance stage',
    });
  }

  children.push({
    tag: 'div',
    attrs: { class: 'catalog-habit-actions' },
    children: actionBtns,
  });

  return {
    tag: 'li',
    attrs: {
      class: rowClass,
      'data-habit-id': habit.id,
    },
    children,
  };
}

/**
 * Build the edit panel description pre-populated with an existing habit's fields.
 *
 * Renders form fields for: name (text), name_pl (text, optional), wave (number),
 * cadence type (select), cadence sub-fields, targetType (select), target (number),
 * startDate (date), stages list with "Add stage" button, per-habit mastery
 * override section (D-87).
 *
 * All inputs carry `data-field` attrs matching the field name.
 * "Save" button carries `data-action="save-edit"`.
 * "Cancel" button carries `data-action="cancel-edit"`.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   name_pl?: string | null,
 *   wave: number,
 *   cadence: { type: string, n?: number, days?: string[] },
 *   targetType: 'binary' | 'numeric' | 'slot-checklist',
 *   target?: number | null,
 *   startDate?: string,
 *   stages?: Array<{ label: string, target?: number }>,
 *   masteryThresholdOverride?: number | null,
 *   masteryWindowOverride?: number | null,
 * }} habit
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildEditPanel(habit) {
  const stages = habit.stages ?? [];
  const hasCustomMastery =
    habit.masteryThresholdOverride != null || habit.masteryWindowOverride != null;

  return {
    tag: 'div',
    attrs: { class: 'catalog-edit-panel', 'data-panel': 'edit', 'data-habit-id': habit.id },
    children: [
      { tag: 'h2', text: 'Edit habit' },

      // Name.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'edit-name' }, text: 'Name' },
          {
            tag: 'input',
            attrs: {
              id: 'edit-name',
              type: 'text',
              'data-field': 'name',
              value: habit.name ?? '',
            },
          },
        ],
      },

      // Polish name (optional).
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'edit-name-pl' }, text: 'Polish name (optional)' },
          {
            tag: 'input',
            attrs: {
              id: 'edit-name-pl',
              type: 'text',
              'data-field': 'name_pl',
              value: habit.name_pl ?? '',
            },
          },
        ],
      },

      // Wave.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'edit-wave' }, text: 'Wave' },
          {
            tag: 'input',
            attrs: {
              id: 'edit-wave',
              type: 'number',
              min: '0',
              max: '9',
              'data-field': 'wave',
              value: String(habit.wave ?? 1),
            },
          },
        ],
      },

      // Cadence type.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'edit-cadence-type' }, text: 'Cadence type' },
          _buildCadenceTypeSelect(habit.cadence ?? { type: 'daily' }, 'edit-cadence-type'),
        ],
      },

      // Target type.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'edit-target-type' }, text: 'Target type' },
          _buildTargetTypeSelect(habit.targetType ?? 'binary', 'edit-target-type'),
        ],
      },

      // Target (shown for numeric/slot-checklist).
      ...(habit.targetType === 'numeric' || habit.targetType === 'slot-checklist'
        ? [
            {
              tag: 'div',
              attrs: { class: 'catalog-form-row' },
              children: [
                { tag: 'label', attrs: { for: 'edit-target' }, text: 'Target count' },
                {
                  tag: 'input',
                  attrs: {
                    id: 'edit-target',
                    type: 'number',
                    min: '1',
                    'data-field': 'target',
                    value: habit.target != null ? String(habit.target) : '',
                  },
                },
              ],
            },
          ]
        : []),

      // Start date.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'edit-start-date' }, text: 'Start date' },
          {
            tag: 'input',
            attrs: {
              id: 'edit-start-date',
              type: 'date',
              'data-field': 'startDate',
              value: habit.startDate ?? '',
            },
          },
        ],
      },

      // Stages section.
      {
        tag: 'div',
        attrs: { class: 'catalog-stages-section' },
        children: [
          { tag: 'h3', text: 'Stages' },
          {
            tag: 'ul',
            attrs: { class: 'catalog-stages-list' },
            children: stages.map((stage, idx) => _buildStageRow(stage, idx)),
          },
          {
            tag: 'button',
            attrs: {
              class: 'catalog-btn catalog-btn--add-stage',
              'data-action': 'add-stage',
            },
            text: 'Add stage',
          },
        ],
      },

      // Per-habit mastery override (D-87).
      {
        tag: 'div',
        attrs: { class: 'catalog-mastery-override' },
        children: [
          { tag: 'h3', text: 'Custom mastery' },
          {
            tag: 'label',
            attrs: { class: 'catalog-form-row catalog-form-row--checkbox' },
            children: [
              {
                tag: 'input',
                attrs: {
                  type: 'checkbox',
                  'data-key': 'customMastery',
                  'data-field': 'customMastery',
                  ...(hasCustomMastery ? { checked: '' } : {}),
                },
              },
              { tag: 'span', text: 'Override global mastery settings' },
            ],
          },
          {
            tag: 'div',
            attrs: {
              class: 'catalog-mastery-override-fields',
              ...(hasCustomMastery ? {} : { hidden: '' }),
            },
            children: [
              {
                tag: 'div',
                attrs: { class: 'catalog-form-row' },
                children: [
                  {
                    tag: 'label',
                    attrs: { for: 'edit-mastery-threshold' },
                    text: 'Threshold (%)',
                  },
                  {
                    tag: 'input',
                    attrs: {
                      id: 'edit-mastery-threshold',
                      type: 'number',
                      min: '1',
                      max: '100',
                      'data-field': 'masteryThresholdOverride',
                      value:
                        habit.masteryThresholdOverride != null
                          ? String(habit.masteryThresholdOverride)
                          : '',
                    },
                  },
                ],
              },
              {
                tag: 'div',
                attrs: { class: 'catalog-form-row' },
                children: [
                  {
                    tag: 'label',
                    attrs: { for: 'edit-mastery-window' },
                    text: 'Window (days)',
                  },
                  {
                    tag: 'input',
                    attrs: {
                      id: 'edit-mastery-window',
                      type: 'number',
                      min: '1',
                      max: '365',
                      'data-field': 'masteryWindowOverride',
                      value:
                        habit.masteryWindowOverride != null
                          ? String(habit.masteryWindowOverride)
                          : '',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },

      // Save / Cancel buttons.
      {
        tag: 'div',
        attrs: { class: 'catalog-panel-actions' },
        children: [
          {
            tag: 'button',
            attrs: {
              class: 'catalog-btn catalog-btn--save',
              'data-action': 'save-edit',
            },
            text: 'Save',
          },
          {
            tag: 'button',
            attrs: {
              class: 'catalog-btn catalog-btn--cancel',
              'data-action': 'cancel-edit',
            },
            text: 'Cancel',
          },
        ],
      },
    ],
  };
}

/**
 * Build the create panel description with empty/default fields.
 *
 * Same shape as `buildEditPanel` but uses empty name, wave=1, cadence type
 * 'daily', targetType 'binary', startDate = todayYMD, empty stages.
 * "Save" button uses `data-action="save-create"`.
 * "Cancel" button uses `data-action="cancel-create"`.
 *
 * @param {string} todayYMD — YYYY-MM-DD string for the startDate default
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildCreatePanel(todayYMD) {
  return {
    tag: 'div',
    attrs: { class: 'catalog-edit-panel catalog-create-panel', 'data-panel': 'create' },
    children: [
      { tag: 'h2', text: 'New habit' },

      // Name.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'create-name' }, text: 'Name' },
          {
            tag: 'input',
            attrs: {
              id: 'create-name',
              type: 'text',
              'data-field': 'name',
              value: '',
            },
          },
        ],
      },

      // Polish name (optional).
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'create-name-pl' }, text: 'Polish name (optional)' },
          {
            tag: 'input',
            attrs: {
              id: 'create-name-pl',
              type: 'text',
              'data-field': 'name_pl',
              value: '',
            },
          },
        ],
      },

      // Wave.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'create-wave' }, text: 'Wave' },
          {
            tag: 'input',
            attrs: {
              id: 'create-wave',
              type: 'number',
              min: '0',
              max: '9',
              'data-field': 'wave',
              value: '1',
            },
          },
        ],
      },

      // Cadence type.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'create-cadence-type' }, text: 'Cadence type' },
          _buildCadenceTypeSelect({ type: 'daily' }, 'create-cadence-type'),
        ],
      },

      // Target type.
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'create-target-type' }, text: 'Target type' },
          _buildTargetTypeSelect('binary', 'create-target-type'),
        ],
      },

      // Start date (defaults to today).
      {
        tag: 'div',
        attrs: { class: 'catalog-form-row' },
        children: [
          { tag: 'label', attrs: { for: 'create-start-date' }, text: 'Start date' },
          {
            tag: 'input',
            attrs: {
              id: 'create-start-date',
              type: 'date',
              'data-field': 'startDate',
              value: todayYMD ?? '',
            },
          },
        ],
      },

      // Stages section (empty on create).
      {
        tag: 'div',
        attrs: { class: 'catalog-stages-section' },
        children: [
          { tag: 'h3', text: 'Stages' },
          { tag: 'ul', attrs: { class: 'catalog-stages-list' }, children: [] },
          {
            tag: 'button',
            attrs: {
              class: 'catalog-btn catalog-btn--add-stage',
              'data-action': 'add-stage',
            },
            text: 'Add stage',
          },
        ],
      },

      // Per-habit mastery override (D-87) — unchecked on create.
      {
        tag: 'div',
        attrs: { class: 'catalog-mastery-override' },
        children: [
          { tag: 'h3', text: 'Custom mastery' },
          {
            tag: 'label',
            attrs: { class: 'catalog-form-row catalog-form-row--checkbox' },
            children: [
              {
                tag: 'input',
                attrs: {
                  type: 'checkbox',
                  'data-key': 'customMastery',
                  'data-field': 'customMastery',
                },
              },
              { tag: 'span', text: 'Override global mastery settings' },
            ],
          },
          {
            tag: 'div',
            attrs: { class: 'catalog-mastery-override-fields', hidden: '' },
            children: [
              {
                tag: 'div',
                attrs: { class: 'catalog-form-row' },
                children: [
                  {
                    tag: 'label',
                    attrs: { for: 'create-mastery-threshold' },
                    text: 'Threshold (%)',
                  },
                  {
                    tag: 'input',
                    attrs: {
                      id: 'create-mastery-threshold',
                      type: 'number',
                      min: '1',
                      max: '100',
                      'data-field': 'masteryThresholdOverride',
                      value: '',
                    },
                  },
                ],
              },
              {
                tag: 'div',
                attrs: { class: 'catalog-form-row' },
                children: [
                  {
                    tag: 'label',
                    attrs: { for: 'create-mastery-window' },
                    text: 'Window (days)',
                  },
                  {
                    tag: 'input',
                    attrs: {
                      id: 'create-mastery-window',
                      type: 'number',
                      min: '1',
                      max: '365',
                      'data-field': 'masteryWindowOverride',
                      value: '',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },

      // Save / Cancel buttons.
      {
        tag: 'div',
        attrs: { class: 'catalog-panel-actions' },
        children: [
          {
            tag: 'button',
            attrs: {
              class: 'catalog-btn catalog-btn--save',
              'data-action': 'save-create',
            },
            text: 'Save',
          },
          {
            tag: 'button',
            attrs: {
              class: 'catalog-btn catalog-btn--cancel',
              'data-action': 'cancel-create',
            },
            text: 'Cancel',
          },
        ],
      },
    ],
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Build a `<select data-field="cadence-type">` description with cadence options,
 * pre-selecting the current type.
 *
 * @param {{ type: string }} cadence
 * @param {string} id
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function _buildCadenceTypeSelect(cadence, id) {
  const options = [
    { value: 'daily', text: 'Daily' },
    { value: 'weekly', text: 'Weekly' },
    { value: 'monthly', text: 'Monthly' },
    { value: 'every-n-days', text: 'Every N days' },
    { value: 'day-of-week-subset', text: 'Specific days' },
  ];
  return {
    tag: 'select',
    attrs: { id, 'data-field': 'cadence-type' },
    children: options.map((opt) => ({
      tag: 'option',
      attrs: {
        value: opt.value,
        ...(cadence?.type === opt.value ? { selected: '' } : {}),
      },
      text: opt.text,
    })),
  };
}

/**
 * Build a `<select data-field="targetType">` description with target type options,
 * pre-selecting the current type.
 *
 * @param {string} targetType
 * @param {string} id
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function _buildTargetTypeSelect(targetType, id) {
  const options = [
    { value: 'binary', text: 'Binary (done/not done)' },
    { value: 'numeric', text: 'Numeric (count)' },
    { value: 'slot-checklist', text: 'Slot checklist' },
  ];
  return {
    tag: 'select',
    attrs: { id, 'data-field': 'targetType' },
    children: options.map((opt) => ({
      tag: 'option',
      attrs: {
        value: opt.value,
        ...(targetType === opt.value ? { selected: '' } : {}),
      },
      text: opt.text,
    })),
  };
}

/**
 * Build a stage row description for the stages list inside an edit panel.
 *
 * @param {{ label: string, target?: number }} stage
 * @param {number} idx — stage index for stable key in attrs
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
function _buildStageRow(stage, idx) {
  return {
    tag: 'li',
    attrs: { class: 'catalog-stage-row', 'data-stage-index': String(idx) },
    children: [
      {
        tag: 'input',
        attrs: {
          type: 'text',
          'data-field': 'stage-label',
          'data-stage-index': String(idx),
          value: stage.label ?? '',
          placeholder: 'Stage label',
        },
      },
      {
        tag: 'input',
        attrs: {
          type: 'number',
          'data-field': 'stage-target',
          'data-stage-index': String(idx),
          value: stage.target != null ? String(stage.target) : '',
          placeholder: 'Target (optional)',
        },
      },
    ],
  };
}
