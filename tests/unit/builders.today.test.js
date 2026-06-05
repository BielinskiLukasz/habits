/**
 * @file Unit tests for js/views/today/builders.js — pure description-tree
 * builders for the Today view (D-26 Tier 1, D-54, D-55, D-56, D-58, D-76,
 * D-79, D-80).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Coverage:
 *   - `_formatTodayDate(ymd)`: 'Wed 27 May' format on canonical + leap-day +
 *     no-zero-padding dates
 *   - `buildTodayHeader`: tag + class + h1 + date + wave slots
 *   - `buildFooterNav`: 3 anchors, aria-current on active, aria-disabled +
 *     tabindex + title on history (D-80)
 *   - `buildTodayRow`: button + aria-pressed + data-action + ⓘ disclosure
 *     (D-54, D-55, D-79)
 *   - `buildTodayList`: 3 branches — empty / all-done / normal list (D-58)
 *
 * Pattern S8 (D-26 Tier 1) — pure-fn fixture tests.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  _formatTodayDate,
  buildTodayHeader,
  buildFooterNav,
  buildTodayRow,
  buildTodayList,
} from '../../js/views/today/builders.js';

describe('_formatTodayDate — short weekday + day + month-abbrev', () => {
  test('2026-05-27 → "Wed 27 May"', () => {
    assert.equal(_formatTodayDate('2026-05-27'), 'Wed 27 May');
  });

  test('2026-01-01 → "Thu 1 Jan" (no zero-padding on day)', () => {
    assert.equal(_formatTodayDate('2026-01-01'), 'Thu 1 Jan');
  });

  test('2028-02-29 (leap day, Tuesday) → "Tue 29 Feb"', () => {
    assert.equal(_formatTodayDate('2028-02-29'), 'Tue 29 Feb');
  });

  test('2026-12-31 (Thursday) → "Thu 31 Dec"', () => {
    assert.equal(_formatTodayDate('2026-12-31'), 'Thu 31 Dec');
  });
});

describe('buildTodayHeader — date + wave slots', () => {
  test('returns a <header> with class "today-header" containing h1 + date + wave', () => {
    const out = buildTodayHeader({
      date: '2026-05-27',
      wave: { number: 4, name: 'Wave 4', startDate: '2026-04-27' },
    });
    assert.equal(out.tag, 'header');
    assert.equal(out.attrs.class, 'today-header');
    assert.ok(Array.isArray(out.children));

    // h1 with data-app-title attribute, text "Habits".
    const h1 = out.children.find((c) => c.tag === 'h1');
    assert.ok(h1, 'h1 present');
    assert.equal(h1.text, 'Habits');
    assert.ok(
      h1.attrs && 'data-app-title' in h1.attrs,
      'h1 carries data-app-title attribute',
    );

    // Date span with the formatted date.
    const dateSpan = out.children.find(
      (c) => c.tag === 'span' && c.attrs?.class === 'today-date',
    );
    assert.ok(dateSpan, 'today-date span present');
    assert.equal(dateSpan.text, 'Wed 27 May');

    // Wave span carries the wave name.
    const waveSpan = out.children.find(
      (c) => c.tag === 'span' && c.attrs?.class === 'today-wave',
    );
    assert.ok(waveSpan, 'today-wave span present');
    assert.equal(waveSpan.text, 'Wave 4');
  });

  test('wave=null renders an empty wave slot (layout stability)', () => {
    const out = buildTodayHeader({ date: '2026-05-27', wave: null });
    const waveSpan = out.children.find(
      (c) => c.tag === 'span' && c.attrs?.class === 'today-wave',
    );
    assert.ok(waveSpan, 'today-wave span present even when wave is null');
    assert.equal(waveSpan.text, '');
  });
});

describe('buildFooterNav — 4 anchors + aria attributes (D-79, D-80, D-82)', () => {
  test('emits <nav> with aria-label and 4 <a> children in today/history/catalog/settings order', () => {
    const out = buildFooterNav({ activeHash: '#today' });
    assert.equal(out.tag, 'nav');
    assert.equal(out.attrs.class, 'today-footer-nav');
    assert.equal(out.attrs['aria-label'], 'Primary navigation');
    assert.equal(out.children.length, 4);
    assert.equal(out.children[0].tag, 'a');
    assert.equal(out.children[0].attrs.href, '#today');
    assert.equal(out.children[1].tag, 'a');
    assert.equal(out.children[1].attrs.href, '#history');
    assert.equal(out.children[2].tag, 'a');
    assert.equal(out.children[2].attrs.href, '#catalog');
    assert.equal(out.children[3].tag, 'a');
    assert.equal(out.children[3].attrs.href, '#settings');
  });

  test('active link carries aria-current="page"', () => {
    const out = buildFooterNav({ activeHash: '#settings' });
    const settingsLink = out.children.find((c) => c.attrs?.href === '#settings');
    assert.equal(settingsLink.attrs['aria-current'], 'page');
    const todayLink = out.children.find((c) => c.attrs?.href === '#today');
    assert.equal(
      todayLink.attrs['aria-current'],
      undefined,
      'non-active link omits aria-current',
    );
  });

  test('catalog link carries aria-current="page" when active', () => {
    const out = buildFooterNav({ activeHash: '#catalog' });
    const catalogLink = out.children.find((c) => c.attrs?.href === '#catalog');
    assert.ok(catalogLink, 'catalog link present');
    assert.equal(catalogLink.attrs['aria-current'], 'page');
  });

  test('link text labels are lowercase: today / history / catalog / settings', () => {
    const out = buildFooterNav({ activeHash: '#today' });
    assert.equal(out.children[0].text, 'today');
    assert.equal(out.children[1].text, 'history');
    assert.equal(out.children[2].text, 'catalog');
    assert.equal(out.children[3].text, 'settings');
  });
});

describe('buildTodayRow — uncompleted row (D-53, D-54, D-79)', () => {
  test('emits <li class="today-row"> with a button carrying aria-pressed="false" + data-action="markComplete"', () => {
    const habit = { id: 'h1', name: 'Drink water', name_pl: 'Picie wody' };
    const out = buildTodayRow({ habit, completed: false });
    assert.equal(out.tag, 'li');
    assert.equal(out.attrs.class, 'today-row');

    const btn = out.children.find((c) => c.tag === 'button' && c.attrs?.class === 'today-row-tap');
    assert.ok(btn, 'tap button present');
    assert.equal(btn.attrs['aria-pressed'], 'false');
    assert.equal(btn.attrs['data-action'], 'markComplete');
    assert.equal(btn.attrs['data-habit-id'], 'h1');

    // No ✓ glyph when uncompleted; name span carries habit.name.
    const glyph = (btn.children ?? []).find((c) => c.attrs?.class === 'today-row-glyph');
    assert.equal(glyph, undefined, 'no glyph in uncompleted row');
    const name = (btn.children ?? []).find((c) => c.attrs?.class === 'today-row-name');
    assert.ok(name, 'name span present');
    assert.equal(name.text, 'Drink water');
  });

  test('emits ⓘ disclosure button when habit.name_pl is truthy (D-55, D-79)', () => {
    const habit = { id: 'h1', name: 'Drink water', name_pl: 'Picie wody' };
    const out = buildTodayRow({ habit, completed: false });
    const info = out.children.find((c) => c.tag === 'button' && c.attrs?.class === 'today-row-info');
    assert.ok(info, 'ⓘ button present when name_pl truthy');
    assert.equal(info.attrs['aria-label'], 'Show original Polish name');
    assert.equal(info.attrs['aria-expanded'], 'false');
    assert.equal(info.attrs['data-action'], 'togglePolish');
    assert.equal(info.attrs['data-habit-id'], 'h1');
    assert.equal(info.text, 'ⓘ');
  });

  test('omits ⓘ disclosure button when habit.name_pl is null/undefined', () => {
    const habit = { id: 'h1', name: 'English-only', name_pl: null };
    const out = buildTodayRow({ habit, completed: false });
    const info = out.children.find((c) => c.attrs?.class === 'today-row-info');
    assert.equal(info, undefined, 'no ⓘ when name_pl null');

    const habit2 = { id: 'h2', name: 'No PL field' };
    const out2 = buildTodayRow({ habit: habit2, completed: false });
    const info2 = out2.children.find((c) => c.attrs?.class === 'today-row-info');
    assert.equal(info2, undefined, 'no ⓘ when name_pl missing entirely');
  });
});

describe('buildTodayRow — completed row (D-54, D-79)', () => {
  test('row carries today-row + today-row--completed classes', () => {
    const habit = { id: 'h1', name: 'Drink water', name_pl: 'Picie wody' };
    const out = buildTodayRow({ habit, completed: true });
    assert.equal(out.attrs.class, 'today-row today-row--completed');
  });

  test('button carries aria-pressed="true" + data-action="markUncomplete" + data-habit-id', () => {
    // Phase 03 plan 03 Task 3: the closure-lookup contract — Today view
    // reads `data-habit-id` off the tap button on completed rows too so the
    // markUncomplete handler can dispatch the right `apply({type, payload:
    // {habitId, date}})`. The uncompleted variant of this test (above) already
    // pinned `data-habit-id`; this is the symmetric guard for completed rows.
    const habit = { id: 'h1', name: 'Drink water' };
    const out = buildTodayRow({ habit, completed: true });
    const btn = out.children.find((c) => c.attrs?.class === 'today-row-tap');
    assert.equal(btn.attrs['aria-pressed'], 'true');
    assert.equal(btn.attrs['data-action'], 'markUncomplete');
    assert.equal(btn.attrs['data-habit-id'], 'h1');
  });

  test('completed row emits the ✓ glyph span + strikethrough name class', () => {
    const habit = { id: 'h1', name: 'Drink water' };
    const out = buildTodayRow({ habit, completed: true });
    const btn = out.children.find((c) => c.attrs?.class === 'today-row-tap');
    const glyph = btn.children.find((c) => c.attrs?.class === 'today-row-glyph');
    assert.ok(glyph, '✓ glyph present in completed row');
    assert.equal(glyph.text, '✓');
    const name = btn.children.find(
      (c) => c.attrs?.class === 'today-row-name today-row-name--completed',
    );
    assert.ok(name, 'name carries strikethrough class');
    assert.equal(name.text, 'Drink water');
  });
});

describe('buildTodayList — three branches (D-58)', () => {
  test('empty state A: no applicable habits → "No habits scheduled today."', () => {
    const out = buildTodayList({ habits: [], allCompleted: false, totalApplicable: 0 });
    assert.equal(out.tag, 'div');
    assert.equal(out.attrs.class, 'today-empty');
    assert.equal(out.text, 'No habits scheduled today.');
  });

  test('empty state B: all completed → "All done today — see you tomorrow." + N of N counter', () => {
    const out = buildTodayList({ habits: [], allCompleted: true, totalApplicable: 3 });
    assert.equal(out.tag, 'div');
    assert.equal(out.attrs.class, 'today-empty today-empty--done');
    assert.ok(Array.isArray(out.children));
    assert.equal(out.children[0].tag, 'p');
    assert.equal(out.children[0].text, 'All done today — see you tomorrow.');
    assert.equal(out.children[1].tag, 'p');
    assert.equal(out.children[1].attrs.class, 'today-counter');
    assert.equal(out.children[1].text, '3 of 3');
  });

  test('list branch: returns <ul class="today-list"> with one row per habit', () => {
    const habits = [
      { habit: { id: 'h1', name: 'A' }, completed: false },
      { habit: { id: 'h2', name: 'B' }, completed: true },
    ];
    const out = buildTodayList({ habits });
    assert.equal(out.tag, 'ul');
    assert.equal(out.attrs.class, 'today-list');
    assert.equal(out.attrs['aria-label'], "Today's habits");
    assert.equal(out.children.length, 2);
    assert.equal(out.children[0].tag, 'li');
    // First row uncompleted → markComplete action.
    const btn1 = out.children[0].children.find((c) => c.attrs?.class === 'today-row-tap');
    assert.equal(btn1.attrs['data-action'], 'markComplete');
    // Second row completed → markUncomplete action.
    const btn2 = out.children[1].children.find((c) => c.attrs?.class === 'today-row-tap');
    assert.equal(btn2.attrs['data-action'], 'markUncomplete');
  });
});
