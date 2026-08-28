/**
 * @file Unit tests for js/views/history/builders.js — pure description-tree
 * builders for the History view (D-26 Tier 1, HISTORY-01..06, D-90).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Coverage:
 *   - `buildHistoryHeader`: date display, prev/next buttons, disabled state on next
 *   - `buildHistoryHabitRow`: completion states — ✓, "–", numeric "X / Y", slots
 *   - `buildBulkActionBar`: bulk-mark-uncompleted button
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHistoryHeader,
  buildHistoryHabitRow,
  buildBulkActionBar,
} from '../../js/views/history/builders.js';

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
 * Collect all descendants (including desc itself) matching a predicate.
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

describe('buildHistoryHeader — date stepper (HISTORY-01, D-90)', () => {
  test('returns a container with a prev-day button', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'prev-day');
    assert.ok(btn, 'prev-day button present');
    assert.equal(btn.attrs['aria-label'], 'Previous day');
  });

  test('returns a container with a next-day button', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'next-day');
    assert.ok(btn, 'next-day button present');
  });

  test('next button has disabled attr when canGoForward is false', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'next-day');
    assert.ok(btn.attrs['disabled'] !== undefined, 'disabled attr present when canGoForward=false');
  });

  test('next button is NOT disabled when canGoForward is true', () => {
    const out = buildHistoryHeader('2026-06-03', true);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'next-day');
    assert.equal(btn.attrs['disabled'], undefined, 'disabled attr absent when canGoForward=true');
  });

  test('has a date display span with class history-date', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const span = findDeep(out, (d) => d.attrs?.class === 'history-date');
    assert.ok(span, 'history-date span present');
  });

  test('has a toggle-calendar button', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'toggle-calendar');
    assert.ok(btn, 'toggle-calendar button present');
    assert.equal(btn.attrs['aria-expanded'], 'false');
  });

  test('has a hidden calendar div with a date input', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const calDiv = findDeep(out, (d) => d.attrs?.class === 'history-calendar');
    assert.ok(calDiv, 'history-calendar div present');
    assert.ok(calDiv.attrs['hidden'] !== undefined, 'calendar div is hidden by default');
    const input = findDeep(calDiv, (d) => d.tag === 'input' && d.attrs?.['data-action'] === 'pick-date');
    assert.ok(input, 'pick-date input inside calendar div');
  });

  test('date display reflects the passed selectedDate string', () => {
    const out = buildHistoryHeader('Thu 4 Jun 2026', true);
    const span = findDeep(out, (d) => d.attrs?.class === 'history-date');
    assert.equal(span.text, 'Thu 4 Jun 2026');
  });

  test('prev-day button has accessible aria-label', () => {
    const out = buildHistoryHeader('2026-06-04', false);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'prev-day');
    assert.ok(btn.attrs['aria-label'], 'aria-label present on prev-day button');
  });

  test('next-day button has accessible aria-label', () => {
    const out = buildHistoryHeader('2026-06-04', true);
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'next-day');
    assert.ok(btn.attrs['aria-label'], 'aria-label present on next-day button');
  });
});

describe('buildHistoryHabitRow — completion states (HISTORY-02, HISTORY-06)', () => {
  test('completed binary log shows ✓ text', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Walk', wave: 1 },
      { status: 'completed' },
      { name: 'Walk', targetType: 'binary' },
    );
    // Find a text node or span with ✓
    const checkmark = findDeep(out, (d) => d.text === '✓' || (typeof d === 'string' && d === '✓'));
    const textCheck = collectDeep(out, (d) => String(d.text ?? '').includes('✓') || String(d.text ?? '') === '✓');
    assert.ok(checkmark || textCheck.length > 0, 'completed row shows ✓');
  });

  test('null/missing log shows "–" (no log)', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Walk', wave: 1 },
      null,
      { name: 'Walk', targetType: 'binary' },
    );
    const dash = collectDeep(out, (d) => String(d.text ?? '').includes('–'));
    assert.ok(dash.length > 0, 'missing log shows "–"');
  });

  test('numeric log shows "X / Y" from count and version.target', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Water', wave: 1 },
      { count: 3 },
      { name: 'Water', targetType: 'numeric', target: 7 },
    );
    const progress = collectDeep(out, (d) => String(d.text ?? '').includes('3 / 7'));
    assert.ok(progress.length > 0, 'numeric row shows "3 / 7"');
  });

  test('uses version.name for historical accuracy (HISTORY-06)', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Current Name', wave: 1 },
      { status: 'failed' },
      { name: 'Historical Name', targetType: 'binary' },
    );
    const nameEl = collectDeep(out, (d) => String(d.text ?? '').includes('Historical Name'));
    assert.ok(nameEl.length > 0, 'version.name used for historical accuracy');
  });

  test('toggle-log button has data-habit-id and data-action', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Walk', wave: 1 },
      { status: 'completed' },
      { name: 'Walk', targetType: 'binary' },
    );
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'toggle-log');
    assert.ok(btn, 'toggle-log button present');
    assert.equal(btn.attrs['data-habit-id'], 'h1');
  });

  test('slot log shows "X / Y slots" from slots array', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Meals', wave: 1 },
      { slots: [{ name: 'Breakfast', checked: true }, { name: 'Lunch', checked: false }, { name: 'Dinner', checked: false }] },
      { name: 'Meals', targetType: 'slot-checklist', target: 3 },
    );
    const progress = collectDeep(out, (d) => String(d.text ?? '').includes('1 / 3'));
    assert.ok(progress.length > 0, 'slot row shows "1 / 3 slots"');
  });

  test('data-date attribute is set on toggle-log button', () => {
    const out = buildHistoryHabitRow(
      { id: 'h1', name: 'Walk', wave: 1 },
      { status: 'completed' },
      { name: 'Walk', targetType: 'binary' },
      '2026-06-04',
    );
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'toggle-log');
    assert.ok(btn, 'toggle-log button present');
    assert.equal(btn.attrs['data-date'], '2026-06-04');
  });
});

describe('buildBulkActionBar — bulk action (HISTORY-04)', () => {
  test('returns a container with bulk-mark-uncompleted button', () => {
    const out = buildBulkActionBar();
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'bulk-mark-uncompleted');
    assert.ok(btn, 'bulk-mark-uncompleted button present');
  });

  test('bulk action button has accessible label text', () => {
    const out = buildBulkActionBar();
    const btn = findDeep(out, (d) => d.attrs?.['data-action'] === 'bulk-mark-uncompleted');
    assert.ok(btn.text || (btn.children && btn.children.length > 0), 'button has text or children');
  });
});
