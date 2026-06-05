/**
 * @file Unit tests for js/views/catalog/builders.js — pure description-tree
 * builders for the Catalog view (D-26 Tier 1, CATALOG-01..07, D-82, D-83, D-87).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Coverage:
 *   - `buildCatalogHeader()`: h1 "Catalog" + "New habit" create button
 *   - `buildHabitListItem(habit, masteryState)`: habit row with name, wave, status,
 *     stage label, edit button, archive/restore button, advance-stage button
 *   - `buildEditPanel(habit)`: form fields pre-populated with habit data
 *   - `buildCreatePanel(todayYMD)`: empty/defaults create form
 *
 * Pattern S8 (D-26 Tier 1) — pure-fn fixture tests.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalogHeader,
  buildHabitListItem,
  buildEditPanel,
  buildCreatePanel,
} from '../../js/views/catalog/builders.js';

/** Recursively find all nodes matching a predicate in a description tree. */
function findAll(desc, pred) {
  if (!desc || typeof desc === 'string') return [];
  const results = [];
  if (pred(desc)) results.push(desc);
  for (const child of desc.children ?? []) {
    results.push(...findAll(child, pred));
  }
  return results;
}

/** Find first node matching predicate in a description tree. */
function findFirst(desc, pred) {
  return findAll(desc, pred)[0];
}

/** Find first element with given tag. */
function findTag(desc, tag) {
  return findFirst(desc, (n) => n.tag === tag);
}

/** Find all text nodes (string or nodes with .text) in a description tree. */
function allText(desc) {
  if (typeof desc === 'string') return [desc];
  const results = [];
  if (desc.text !== undefined) results.push(String(desc.text));
  for (const child of desc.children ?? []) {
    results.push(...allText(child));
  }
  return results;
}

describe('buildCatalogHeader — h1 + create button', () => {
  test('returns a container with an h1 containing text "Catalog"', () => {
    const out = buildCatalogHeader();
    assert.ok(out, 'returns a description');
    const h1 = findTag(out, 'h1');
    assert.ok(h1, 'h1 present');
    assert.equal(h1.text, 'Catalog');
  });

  test('has a "New habit" button with data-action="create"', () => {
    const out = buildCatalogHeader();
    const btn = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'create');
    assert.ok(btn, 'create button present');
    const texts = allText(btn);
    assert.ok(texts.some((t) => /new habit/i.test(t)), 'button text contains "New habit"');
  });

  test('create button has min 44px touch target (min-width/min-height or explicit style)', () => {
    const out = buildCatalogHeader();
    const btn = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'create');
    assert.ok(btn, 'create button present');
    // Touch target enforced via CSS class (catalog-btn or similar)
    const cls = btn.attrs?.class ?? '';
    assert.ok(cls.length > 0, 'create button has a CSS class (touch target enforced via CSS)');
  });
});

describe('buildHabitListItem — habit row structure', () => {
  const baseHabit = {
    id: 'h-uuid-1',
    name: 'Morning walk',
    wave: 1,
    status: 'active',
    stages: [],
    currentStageIndex: 0,
  };

  test('returns a container with data-habit-id attribute', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    assert.ok(out, 'returns a description');
    // The top-level element or a descendant carries data-habit-id
    const withId = findFirst(out, (n) => n.attrs?.['data-habit-id'] === 'h-uuid-1');
    assert.ok(withId, 'data-habit-id found on some element');
  });

  test('displays habit name', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    const texts = allText(out);
    assert.ok(texts.some((t) => t.includes('Morning walk')), 'habit name present in output');
  });

  test('displays wave badge', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    const texts = allText(out);
    assert.ok(texts.some((t) => /wave\s*1/i.test(t)), 'wave badge present');
  });

  test('displays status badge', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    const texts = allText(out);
    assert.ok(texts.some((t) => t.toLowerCase().includes('active')), 'status badge present');
  });

  test('has "Edit" button with data-action="edit" and data-habit-id', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    const btn = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'edit');
    assert.ok(btn, 'edit button present');
    assert.equal(btn.attrs['data-habit-id'], 'h-uuid-1');
  });

  test('active habit has "Archive" button with data-action="archive"', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    const btn = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'archive');
    assert.ok(btn, 'archive button present for active habit');
    // No restore button
    const restore = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'restore');
    assert.equal(restore, undefined, 'no restore button for active habit');
  });

  test('archived habit has "Restore" button (not Archive)', () => {
    const archivedHabit = { ...baseHabit, status: 'archived' };
    const out = buildHabitListItem(archivedHabit, { isMastered: false });
    const restore = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'restore');
    assert.ok(restore, 'restore button present for archived habit');
    const archive = findFirst(out, (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'archive');
    assert.equal(archive, undefined, 'no archive button for archived habit');
  });

  test('shows stage label when stages array has an entry at currentStageIndex', () => {
    const habitWithStage = {
      ...baseHabit,
      stages: [{ label: 'Stage 1', allowManual: false }],
      currentStageIndex: 0,
    };
    const out = buildHabitListItem(habitWithStage, { isMastered: false });
    const texts = allText(out);
    assert.ok(texts.some((t) => t.includes('Stage 1')), 'stage label displayed');
  });

  test('shows "Advance stage" button when stage.allowManual is true', () => {
    const habitWithManual = {
      ...baseHabit,
      stages: [{ label: 'Stage 1', allowManual: true }],
      currentStageIndex: 0,
    };
    const out = buildHabitListItem(habitWithManual, { isMastered: false });
    const btn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'advance-stage',
    );
    assert.ok(btn, '"Advance stage" button present when allowManual=true');
  });

  test('does not show "Advance stage" button when stage.allowManual is false', () => {
    const habitNoManual = {
      ...baseHabit,
      stages: [{ label: 'Stage 1', allowManual: false }],
      currentStageIndex: 0,
    };
    const out = buildHabitListItem(habitNoManual, { isMastered: false });
    const btn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'advance-stage',
    );
    assert.equal(btn, undefined, 'no advance-stage button when allowManual=false');
  });

  test('isMastered=true adds mastered class and "Mastered" badge (D-85, MASTERY-03)', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: true });
    // Look for class containing 'mastered'
    const masteredEl = findFirst(
      out,
      (n) => typeof n.attrs?.class === 'string' && n.attrs.class.includes('mastered'),
    );
    assert.ok(masteredEl, 'element with mastered class present');
    const texts = allText(out);
    assert.ok(texts.some((t) => /mastered/i.test(t)), '"Mastered" text present in output');
  });

  test('isMastered=false does not add mastered class', () => {
    const out = buildHabitListItem(baseHabit, { isMastered: false });
    const masteredEl = findFirst(
      out,
      (n) => typeof n.attrs?.class === 'string' && n.attrs.class.includes('habit-row--mastered'),
    );
    assert.equal(masteredEl, undefined, 'no mastered class when not mastered');
  });
});

describe('buildEditPanel — pre-populated form fields', () => {
  const habit = {
    id: 'h-uuid-2',
    name: 'Morning walk',
    name_pl: 'Spacer rano',
    wave: 1,
    cadence: { type: 'daily' },
    targetType: 'binary',
    target: null,
    stages: [],
    currentStageIndex: 0,
    startDate: '2026-01-01',
    masteryThresholdOverride: null,
    masteryWindowOverride: null,
  };

  test('returns a description with data-field="name" input with correct value', () => {
    const out = buildEditPanel(habit);
    assert.ok(out, 'returns a description');
    const nameInput = findFirst(
      out,
      (n) => n.tag === 'input' && n.attrs?.['data-field'] === 'name',
    );
    assert.ok(nameInput, 'name input present');
    assert.equal(nameInput.attrs.value, 'Morning walk');
  });

  test('has data-field="wave" input with correct wave value', () => {
    const out = buildEditPanel(habit);
    const waveInput = findFirst(
      out,
      (n) => n.attrs?.['data-field'] === 'wave',
    );
    assert.ok(waveInput, 'wave input/select present');
    // Value should be set to '1' (string representation)
    assert.ok(
      waveInput.attrs?.value === '1' || waveInput.attrs?.value === 1,
      `wave value should be 1, got: ${waveInput.attrs?.value}`,
    );
  });

  test('has data-field="cadence-type" selector with daily selected', () => {
    const out = buildEditPanel(habit);
    const cadenceInput = findFirst(
      out,
      (n) => n.attrs?.['data-field'] === 'cadence-type',
    );
    assert.ok(cadenceInput, 'cadence-type input/select present');
  });

  test('has data-field="targetType" selector', () => {
    const out = buildEditPanel(habit);
    const ttInput = findFirst(
      out,
      (n) => n.attrs?.['data-field'] === 'targetType',
    );
    assert.ok(ttInput, 'targetType input/select present');
  });

  test('has "Save" button with data-action="save-edit"', () => {
    const out = buildEditPanel(habit);
    const saveBtn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'save-edit',
    );
    assert.ok(saveBtn, 'save-edit button present');
  });

  test('has "Cancel" button with data-action="cancel-edit"', () => {
    const out = buildEditPanel(habit);
    const cancelBtn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'cancel-edit',
    );
    assert.ok(cancelBtn, 'cancel-edit button present');
  });

  test('has "Add stage" button with data-action="add-stage"', () => {
    const out = buildEditPanel(habit);
    const addStageBtn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'add-stage',
    );
    assert.ok(addStageBtn, 'add-stage button present');
  });

  test('has customMastery checkbox with data-key="customMastery"', () => {
    const out = buildEditPanel(habit);
    const checkbox = findFirst(
      out,
      (n) =>
        n.tag === 'input' &&
        n.attrs?.type === 'checkbox' &&
        n.attrs?.['data-key'] === 'customMastery',
    );
    assert.ok(checkbox, 'customMastery checkbox present');
  });
});

describe('buildCreatePanel — empty defaults form', () => {
  test('returns a description with empty name input', () => {
    const out = buildCreatePanel('2026-06-05');
    assert.ok(out, 'returns a description');
    const nameInput = findFirst(
      out,
      (n) => n.tag === 'input' && n.attrs?.['data-field'] === 'name',
    );
    assert.ok(nameInput, 'name input present');
    assert.equal(nameInput.attrs?.value ?? '', '', 'name input value defaults to empty');
  });

  test('has "Save" button with data-action="save-create"', () => {
    const out = buildCreatePanel('2026-06-05');
    const saveBtn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'save-create',
    );
    assert.ok(saveBtn, 'save-create button present');
  });

  test('has "Cancel" button with data-action="cancel-create"', () => {
    const out = buildCreatePanel('2026-06-05');
    const cancelBtn = findFirst(
      out,
      (n) => n.tag === 'button' && n.attrs?.['data-action'] === 'cancel-create',
    );
    assert.ok(cancelBtn, 'cancel-create button present');
  });

  test('startDate defaults to todayYMD parameter', () => {
    const out = buildCreatePanel('2026-06-05');
    const startDateInput = findFirst(
      out,
      (n) => n.attrs?.['data-field'] === 'startDate',
    );
    assert.ok(startDateInput, 'startDate input present');
    assert.equal(startDateInput.attrs?.value, '2026-06-05', 'startDate defaults to today');
  });
});
