/**
 * @file Unit tests for js/views/settings/builders.js — pure description-tree
 * builders for the Settings panel (D-26 Tier 1, D-61..D-66, D-67, D-71, D-76,
 * D-79).
 *
 * The builders are pure functions returning `{tag, attrs?, text?, children?}`
 * description trees. NO DOM polyfill needed — assertions read the object
 * shape directly.
 *
 * Coverage (Pattern S8):
 *   - `buildStorageCard`: supported / unsupported / loading / persisted-true
 *     / persisted-false branches; data-action="requestPersistence" only when
 *     persisted=false.
 *   - `buildScheduleCard`: <fieldset>/<legend>, Mon/Sun radios with shared
 *     name="weekStart", `checked` set on the active radio, data-action="setWeekStart".
 *   - `buildInstallCard`: 3 labeled subsections (iOS / Android / Desktop)
 *     each with an <h3> (D-64, PWA-07).
 *   - `buildDataCard`: hasUndoToken true/false branches; aria-label on
 *     buttons; disabled state; destructive treatment wrapper.
 *   - `buildAboutCard`: 4 <dt>/<dd> rows for App version / Schema version /
 *     Cache name / Service worker (D-66).
 *   - ARIA per D-79: each card has `<h2>` with id matched by `aria-labelledby`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStorageCard,
  buildScheduleCard,
  buildInstallCard,
  buildDataCard,
  buildAboutCard,
  buildMasteryCard,
} from '../../js/views/settings/builders.js';

/**
 * Helper — find a descendant in a description tree matching `predicate`
 * (depth-first). Returns the first match or `undefined`.
 *
 * @param {object} desc
 * @param {(d: object) => boolean} predicate
 * @returns {object|undefined}
 */
function findDesc(desc, predicate) {
  if (!desc || typeof desc !== 'object') return undefined;
  if (predicate(desc)) return desc;
  for (const c of desc.children ?? []) {
    const m = findDesc(c, predicate);
    if (m) return m;
  }
  return undefined;
}

/**
 * Collect all descendants matching `predicate`.
 * @param {object} desc
 * @param {(d: object) => boolean} predicate
 * @returns {object[]}
 */
function findAll(desc, predicate) {
  /** @type {object[]} */
  const out = [];
  function walk(d) {
    if (!d || typeof d !== 'object') return;
    if (predicate(d)) out.push(d);
    for (const c of d.children ?? []) walk(c);
  }
  walk(desc);
  return out;
}

describe('buildStorageCard — D-62 (persistence + estimate)', () => {
  test('card wrapper has class "settings-card" + aria-labelledby matching <h2> id', () => {
    const out = buildStorageCard({
      supported: true,
      persisted: true,
      estimateUsedMB: '0.4',
      estimateQuotaMB: '600',
    });
    assert.equal(out.tag, 'section');
    assert.equal(out.attrs.class, 'settings-card');
    const labelId = out.attrs['aria-labelledby'];
    assert.ok(labelId, 'aria-labelledby present');
    const h2 = findDesc(out, (d) => d.tag === 'h2');
    assert.ok(h2, '<h2> present');
    assert.equal(h2.attrs.id, labelId, 'h2.id matches aria-labelledby');
    assert.equal(h2.text, 'Storage');
  });

  test('supported=false emits unsupported message and no buttons', () => {
    const out = buildStorageCard({ supported: false });
    const p = findDesc(out, (d) => d.tag === 'p');
    assert.ok(p, 'unsupported <p> rendered');
    assert.match(String(p.text), /unsupported/i);
    const btn = findDesc(out, (d) => d.tag === 'button');
    assert.equal(btn, undefined, 'no buttons when unsupported');
  });

  test('persisted=true → no requestPersistence button; estimate row visible', () => {
    const out = buildStorageCard({
      supported: true,
      persisted: true,
      estimateUsedMB: '0.4',
      estimateQuotaMB: '600',
    });
    const reqBtn = findDesc(
      out,
      (d) => d.tag === 'button' && d.attrs?.['data-action'] === 'requestPersistence',
    );
    assert.equal(reqBtn, undefined, 'no Request persistence button when already persisted');
    // Estimate dd contains the "Using X MB of ~Y MB" text.
    const estDd = findDesc(out, (d) => d.tag === 'dd' && /Using/.test(String(d.text ?? '')));
    assert.ok(estDd, 'estimate dd present');
    assert.match(String(estDd.text), /Using 0\.4 MB of ~600 MB/);
  });

  test('persisted=false → renders data-action="requestPersistence" button', () => {
    const out = buildStorageCard({
      supported: true,
      persisted: false,
      estimateUsedMB: '0.4',
      estimateQuotaMB: '600',
    });
    const reqBtn = findDesc(
      out,
      (d) => d.tag === 'button' && d.attrs?.['data-action'] === 'requestPersistence',
    );
    assert.ok(reqBtn, 'Request persistence button present when persisted=false');
    assert.match(String(reqBtn.text ?? ''), /Request persistence/);
  });

  test('loading state — persisted="loading…" renders the literal in the dd', () => {
    const out = buildStorageCard({
      supported: true,
      persisted: 'loading…',
      estimateUsedMB: 'loading…',
      estimateQuotaMB: 'loading…',
    });
    // Find the persisted dd — searching for any dd whose text contains "loading…"
    const loadingDd = findDesc(
      out,
      (d) => d.tag === 'dd' && String(d.text ?? '') === 'loading…',
    );
    assert.ok(loadingDd, 'loading… dd present');
  });
});

describe('buildScheduleCard — D-63 (Mon/Sun radio bound to weekStart)', () => {
  test('emits <fieldset> with <legend> "Week starts on" and 2 radios sharing name="weekStart"', () => {
    const out = buildScheduleCard({ weekStart: 'mon' });
    assert.equal(out.tag, 'section');
    assert.equal(out.attrs.class, 'settings-card');

    const h2 = findDesc(out, (d) => d.tag === 'h2');
    assert.ok(h2);
    assert.equal(h2.text, 'Schedule');

    const fieldset = findDesc(out, (d) => d.tag === 'fieldset');
    assert.ok(fieldset, '<fieldset> present');
    const legend = findDesc(fieldset, (d) => d.tag === 'legend');
    assert.ok(legend, '<legend> present');
    assert.match(String(legend.text), /Week starts on/);

    const radios = findAll(out, (d) => d.tag === 'input' && d.attrs?.type === 'radio');
    assert.equal(radios.length, 2);
    for (const r of radios) {
      assert.equal(r.attrs.name, 'weekStart');
      assert.equal(r.attrs['data-action'], 'setWeekStart');
    }
    const values = radios.map((r) => r.attrs.value).sort();
    assert.deepEqual(values, ['mon', 'sun']);
  });

  test('weekStart="mon" → mon radio checked; sun not', () => {
    const out = buildScheduleCard({ weekStart: 'mon' });
    const monRadio = findDesc(
      out,
      (d) => d.tag === 'input' && d.attrs?.value === 'mon',
    );
    const sunRadio = findDesc(
      out,
      (d) => d.tag === 'input' && d.attrs?.value === 'sun',
    );
    assert.ok('checked' in (monRadio.attrs ?? {}), 'mon radio carries checked attr');
    assert.equal(sunRadio.attrs.checked, undefined);
  });

  test('weekStart="sun" → sun radio checked; mon not', () => {
    const out = buildScheduleCard({ weekStart: 'sun' });
    const monRadio = findDesc(
      out,
      (d) => d.tag === 'input' && d.attrs?.value === 'mon',
    );
    const sunRadio = findDesc(
      out,
      (d) => d.tag === 'input' && d.attrs?.value === 'sun',
    );
    assert.ok('checked' in (sunRadio.attrs ?? {}), 'sun radio carries checked attr');
    assert.equal(monRadio.attrs.checked, undefined);
  });
});

describe('buildInstallCard — D-64 + PWA-07 (3 labeled install subsections)', () => {
  test('emits exactly 3 <h3> sections (iOS / Android / Desktop)', () => {
    const out = buildInstallCard();
    assert.equal(out.tag, 'section');
    assert.equal(out.attrs.class, 'settings-card');

    const h2 = findDesc(out, (d) => d.tag === 'h2');
    assert.ok(h2);
    assert.equal(h2.text, 'Install');

    const h3s = findAll(out, (d) => d.tag === 'h3');
    assert.equal(h3s.length, 3, 'three h3 subsections');
    const labels = h3s.map((h) => h.text);
    assert.ok(
      labels.some((l) => /iOS/i.test(String(l))),
      'iOS subsection present',
    );
    assert.ok(
      labels.some((l) => /Android/i.test(String(l))),
      'Android subsection present',
    );
    assert.ok(
      labels.some((l) => /Desktop/i.test(String(l))),
      'Desktop subsection present',
    );
  });
});

describe('buildDataCard — D-65 (Undo + Reset)', () => {
  test('hasUndoToken=false → Undo button is disabled + preview "Nothing to undo"', () => {
    const out = buildDataCard({
      lastEvent: '',
      hasUndoToken: false,
      relativeTime: '',
    });
    assert.equal(out.tag, 'section');
    assert.equal(out.attrs.class, 'settings-card');

    const undoBtn = findDesc(
      out,
      (d) => d.tag === 'button' && d.attrs?.['data-action'] === 'undoLastAction',
    );
    assert.ok(undoBtn, 'Undo button present');
    assert.equal(undoBtn.attrs['aria-label'], 'Undo last action');
    assert.ok('disabled' in (undoBtn.attrs ?? {}), 'disabled attr present');

    const nothing = findDesc(
      out,
      (d) => d.tag === 'p' && /Nothing to undo/.test(String(d.text ?? '')),
    );
    assert.ok(nothing, '"Nothing to undo." preview present');
  });

  test('hasUndoToken=true → enabled Undo button + verb+habit preview (D-71)', () => {
    const out = buildDataCard({
      lastEvent: 'marked Drink water complete',
      hasUndoToken: true,
      relativeTime: '2 minutes ago',
    });
    const undoBtn = findDesc(
      out,
      (d) => d.tag === 'button' && d.attrs?.['data-action'] === 'undoLastAction',
    );
    assert.ok(undoBtn);
    assert.equal(undoBtn.attrs['aria-label'], 'Undo last action');
    assert.equal(undoBtn.attrs.disabled, undefined, 'NOT disabled');

    // Preview line contains the verb+habit and the relative-time string.
    const preview = findDesc(
      out,
      (d) => d.tag === 'p' && /Last:/.test(String(d.text ?? '')),
    );
    assert.ok(preview, 'preview line present');
    assert.match(String(preview.text), /marked Drink water complete/);
    assert.match(String(preview.text), /2 minutes ago/);
  });

  test('Reset block carries .settings-card--destructive wrapper + Reset button + aria-label', () => {
    const out = buildDataCard({
      lastEvent: '',
      hasUndoToken: false,
      relativeTime: '',
    });
    const destructive = findDesc(
      out,
      (d) => d.attrs?.class === 'settings-card--destructive',
    );
    assert.ok(destructive, 'destructive wrapper present');
    const resetBtn = findDesc(
      destructive,
      (d) => d.tag === 'button' && d.attrs?.['data-action'] === 'resetData',
    );
    assert.ok(resetBtn, 'Reset data button inside destructive wrapper');
    assert.equal(resetBtn.attrs['aria-label'], 'Reset data');
    assert.match(String(resetBtn.text ?? ''), /Reset data/);
  });
});

describe('buildAboutCard — D-66 (4 rows: app/schema/cache/SW)', () => {
  test('emits <dl> with 4 dt/dd pairs in locked order', () => {
    const out = buildAboutCard({
      appVersion: '0.2.0',
      schemaVersion: '1',
      cacheName: 'habits-0.2.0',
      swState: 'controlled',
    });
    assert.equal(out.tag, 'section');
    assert.equal(out.attrs.class, 'settings-card');

    const h2 = findDesc(out, (d) => d.tag === 'h2');
    assert.ok(h2);
    assert.equal(h2.text, 'About');

    const dl = findDesc(out, (d) => d.tag === 'dl');
    assert.ok(dl, '<dl> present');
    const dts = findAll(dl, (d) => d.tag === 'dt');
    const dds = findAll(dl, (d) => d.tag === 'dd');
    assert.equal(dts.length, 4, '4 dt rows');
    assert.equal(dds.length, 4, '4 dd rows');
    const labels = dts.map((d) => d.text);
    assert.deepEqual(
      labels,
      ['App version', 'Schema version', 'Cache name', 'Service worker'],
      'labels in locked order',
    );

    // Values appear in the dd rows.
    const ddTexts = dds.map((d) => String(d.text));
    assert.ok(ddTexts.includes('0.2.0'));
    assert.ok(ddTexts.includes('1'));
    assert.ok(ddTexts.includes('habits-0.2.0'));
    assert.ok(ddTexts.includes('controlled'));
  });

  test('loading state — any input may be "loading…" and renders verbatim', () => {
    const out = buildAboutCard({
      appVersion: '0.2.0',
      schemaVersion: 'loading…',
      cacheName: 'loading…',
      swState: 'loading…',
    });
    const dds = findAll(out, (d) => d.tag === 'dd');
    const loadingCount = dds.filter((d) => String(d.text) === 'loading…').length;
    assert.equal(loadingCount, 3, '3 dd rows show "loading…" verbatim');
  });
});

describe('Settings builders — A11y baseline (D-79)', () => {
  test('every card has an <h2> referenced by aria-labelledby on the wrapper', () => {
    const cards = [
      buildStorageCard({ supported: true, persisted: true, estimateUsedMB: '0', estimateQuotaMB: '0' }),
      buildScheduleCard({ weekStart: 'mon' }),
      buildInstallCard(),
      buildDataCard({ lastEvent: '', hasUndoToken: false, relativeTime: '' }),
      buildAboutCard({ appVersion: '0', schemaVersion: '0', cacheName: 'n', swState: 'n' }),
      buildMasteryCard({ masteryThreshold: 90, masteryWindow: 70 }),
    ];
    for (const card of cards) {
      const labelId = card.attrs?.['aria-labelledby'];
      assert.ok(labelId, `card aria-labelledby present for ${card.attrs?.class}`);
      const h2 = findDesc(card, (d) => d.tag === 'h2');
      assert.ok(h2, '<h2> present');
      assert.equal(h2.attrs?.id, labelId, '<h2> id matches aria-labelledby');
    }
  });
});

describe('buildMasteryCard — SETTINGS-01 (D-86)', () => {
  test('returns section with data-card="mastery"', () => {
    const card = buildMasteryCard({ masteryThreshold: 90, masteryWindow: 70 });
    assert.equal(card.tag, 'section');
    assert.equal(card.attrs['data-card'], 'mastery');
  });

  test('threshold input has data-key="masteryThreshold", type="number", value="90"', () => {
    const card = buildMasteryCard({ masteryThreshold: 90, masteryWindow: 70 });
    const input = findDesc(card, (d) => d.tag === 'input' && d.attrs?.['data-key'] === 'masteryThreshold');
    assert.ok(input, 'masteryThreshold input present');
    assert.equal(input.attrs['type'], 'number');
    assert.equal(input.attrs['value'], '90');
    assert.equal(input.attrs['min'], '1');
    assert.equal(input.attrs['max'], '100');
  });

  test('window input has data-key="masteryWindow", type="number", value="70"', () => {
    const card = buildMasteryCard({ masteryThreshold: 90, masteryWindow: 70 });
    const input = findDesc(card, (d) => d.tag === 'input' && d.attrs?.['data-key'] === 'masteryWindow');
    assert.ok(input, 'masteryWindow input present');
    assert.equal(input.attrs['type'], 'number');
    assert.equal(input.attrs['value'], '70');
    assert.equal(input.attrs['min'], '1');
    assert.equal(input.attrs['max'], '365');
  });

  test('defaults to 90 and 70 when no args provided', () => {
    const card = buildMasteryCard();
    const tInput = findDesc(card, (d) => d.tag === 'input' && d.attrs?.['data-key'] === 'masteryThreshold');
    const wInput = findDesc(card, (d) => d.tag === 'input' && d.attrs?.['data-key'] === 'masteryWindow');
    assert.equal(tInput?.attrs?.value, '90', 'threshold defaults to 90');
    assert.equal(wInput?.attrs?.value, '70', 'window defaults to 70');
  });

  test('defaults to 90 and 70 when null is passed', () => {
    const card = buildMasteryCard({ masteryThreshold: null, masteryWindow: null });
    const tInput = findDesc(card, (d) => d.tag === 'input' && d.attrs?.['data-key'] === 'masteryThreshold');
    const wInput = findDesc(card, (d) => d.tag === 'input' && d.attrs?.['data-key'] === 'masteryWindow');
    assert.equal(tInput?.attrs?.value, '90', 'threshold defaults to 90 when null');
    assert.equal(wInput?.attrs?.value, '70', 'window defaults to 70 when null');
  });
});
