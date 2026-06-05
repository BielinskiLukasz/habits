/**
 * @file Unit tests for buildNumericRow and buildSlotRow builders in
 * js/views/today/builders.js (D-26 Tier 1, LOG-02..06, D-88, D-89).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed.
 *
 * Coverage:
 *   - `buildNumericRow`: progress display, +/- buttons, complete state class
 *   - `buildSlotRow`: collapsed progress, expand toggle, slot toggles
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNumericRow,
  buildSlotRow,
} from '../../js/views/today/builders.js';

/**
 * Walk a description tree to find the first descendant matching a predicate.
 * @param {object|string} desc
 * @param {(d: object) => boolean} pred
 * @returns {object|undefined}
 */
function findDeep(desc, pred) {
  if (typeof desc === 'string') return undefined;
  if (pred(desc)) return desc;
  for (const child of (desc.children ?? [])) {
    const found = findDeep(child, pred);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Collect all descendants matching a predicate.
 * @param {object|string} desc
 * @param {(d: object) => boolean} pred
 * @returns {object[]}
 */
function collectDeep(desc, pred) {
  if (typeof desc === 'string') return [];
  const result = pred(desc) ? [desc] : [];
  for (const child of (desc.children ?? [])) {
    result.push(...collectDeep(child, pred));
  }
  return result;
}

describe('buildNumericRow — numeric counter (D-88, LOG-05)', () => {
  test('shows progress "3 / 5" text from count and habit.target', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Gratitude', target: 5 }, { count: 3 });
    const progress = collectDeep(out, (d) => String(d.text ?? '').includes('3 / 5'));
    assert.ok(progress.length > 0, 'progress shows "3 / 5"');
  });

  test('has data-progress attribute', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Gratitude', target: 5 }, { count: 3 });
    const progressEl = findDeep(out, (d) => d.attrs?.['data-progress'] !== undefined);
    assert.ok(progressEl, 'data-progress element present');
  });

  test('shows "0 / 7" when log is null', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Water', target: 7 }, null);
    const progress = collectDeep(out, (d) => String(d.text ?? '').includes('0 / 7'));
    assert.ok(progress.length > 0, 'null log shows "0 / 7"');
  });

  test('has log-increment button with data-action="log-increment" and data-habit-id', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Water', target: 7 }, null);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'log-increment');
    assert.ok(btn, 'log-increment button present');
    assert.equal(btn.attrs['data-habit-id'], 'h1');
  });

  test('has log-decrement button with data-action="log-decrement" and data-habit-id', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Water', target: 7 }, null);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'log-decrement');
    assert.ok(btn, 'log-decrement button present');
    assert.equal(btn.attrs['data-habit-id'], 'h1');
  });

  test('row has habit-row--complete class when count >= target', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Water', target: 5 }, { count: 5 });
    assert.ok(
      String(out.attrs?.class ?? '').includes('habit-row--complete'),
      'complete class present when count === target',
    );
  });

  test('row does NOT have habit-row--complete class when count < target', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Water', target: 5 }, { count: 3 });
    assert.ok(
      !String(out.attrs?.class ?? '').includes('habit-row--complete'),
      'complete class absent when count < target',
    );
  });

  test('shows habit name', () => {
    const out = buildNumericRow({ id: 'h1', name: 'Gratitude', target: 5 }, { count: 3 });
    const nameEl = collectDeep(out, (d) => String(d.text ?? '').includes('Gratitude'));
    assert.ok(nameEl.length > 0, 'habit name shown');
  });
});

describe('buildSlotRow — slot-checklist (D-89, LOG-03)', () => {
  test('shows "0 / 3 slots" progress when log is null', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      null,
    );
    const progress = collectDeep(out, (d) => String(d.text ?? '').includes('0 / 3'));
    assert.ok(progress.length > 0, 'null log shows "0 / 3 slots" or "0 / 3"');
  });

  test('has toggle-slots button with data-action and data-habit-id', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      null,
    );
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'toggle-slots');
    assert.ok(btn, 'toggle-slots button present');
    assert.equal(btn.attrs['data-habit-id'], 'h1');
  });

  test('has hidden slot-list div with slot toggles', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      null,
    );
    const slotList = findDeep(out, (d) => d.attrs?.class === 'slot-list');
    assert.ok(slotList, 'slot-list div present');
    assert.ok(slotList.attrs['hidden'] !== undefined, 'slot-list is hidden by default');
    const toggles = collectDeep(slotList, (d) => d.attrs?.['data-action'] === 'toggle-slot');
    assert.equal(toggles.length, 3, 'one toggle per slot');
  });

  test('slot toggles carry data-slot-index', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      null,
    );
    const slotList = findDeep(out, (d) => d.attrs?.class === 'slot-list');
    const toggles = collectDeep(slotList, (d) => d.attrs?.['data-action'] === 'toggle-slot');
    assert.equal(String(toggles[0].attrs['data-slot-index']), '0');
    assert.equal(String(toggles[1].attrs['data-slot-index']), '1');
    assert.equal(String(toggles[2].attrs['data-slot-index']), '2');
  });

  test('slot toggle carries data-habit-id', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }] },
      null,
    );
    const slotList = findDeep(out, (d) => d.attrs?.class === 'slot-list');
    const toggle = findDeep(slotList, (d) => d.attrs?.['data-action'] === 'toggle-slot');
    assert.equal(toggle.attrs['data-habit-id'], 'h1');
  });

  test('shows slot name as label text', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      null,
    );
    const breakfast = collectDeep(out, (d) => String(d.text ?? '').includes('Breakfast'));
    assert.ok(breakfast.length > 0, 'slot name rendered as text');
  });

  test('shows correct count when some slots are checked', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      { slots: [{ name: 'Breakfast', checked: true }, { name: 'Lunch', checked: false }, { name: 'Dinner', checked: false }] },
    );
    const progress = collectDeep(out, (d) => String(d.text ?? '').includes('1 / 3'));
    assert.ok(progress.length > 0, 'shows "1 / 3" when 1 of 3 checked');
  });

  test('row has habit-row--complete class when all slots checked', () => {
    const out = buildSlotRow(
      { id: 'h1', name: 'Meals', target: 3, slots: [{ name: 'Breakfast' }, { name: 'Lunch' }, { name: 'Dinner' }] },
      { slots: [{ name: 'Breakfast', checked: true }, { name: 'Lunch', checked: true }, { name: 'Dinner', checked: true }] },
    );
    assert.ok(
      String(out.attrs?.class ?? '').includes('habit-row--complete'),
      'complete class present when all slots checked',
    );
  });
});
