/**
 * @file Integration verification for i18n module persistence and cross-shell
 * consistency (I18N-03). Tests use in-memory setLang/getLang round-trips and
 * fs.readFileSync structural assertions because localStorage is unavailable in
 * Node at module-init time.
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang, getLang, _resetLangForTest } from '../../js/i18n/index.js';

// Reset to English after any test that calls setLang so tests are order-independent.
afterEach(() => _resetLangForTest('en'));

// ---------------------------------------------------------------------------
// 1. setLang round-trip (in-memory, no localStorage)
// ---------------------------------------------------------------------------

describe('setLang persistence round-trip (in-memory)', () => {
  afterEach(() => _resetLangForTest('en'));

  it('_resetLangForTest("en") + setLang("pl") → getLang() returns "pl"', () => {
    _resetLangForTest('en');
    setLang('pl');
    assert.equal(getLang(), 'pl');
  });

  it('_resetLangForTest("en") + setLang("en") → getLang() returns "en"', () => {
    _resetLangForTest('en');
    setLang('en');
    assert.equal(getLang(), 'en');
  });

  it('_resetLangForTest("pl") + setLang("en") → getLang() returns "en" (switching back from pl)', () => {
    _resetLangForTest('pl');
    setLang('en');
    assert.equal(getLang(), 'en');
  });
});

// ---------------------------------------------------------------------------
// 2. Storage key structural assertion
// ---------------------------------------------------------------------------

describe('storage key structural assertion', () => {
  const source = readFileSync(new URL('../../js/i18n/index.js', import.meta.url), 'utf-8');

  it('js/i18n/index.js contains the storage key "habits-lang"', () => {
    assert.ok(
      source.includes('habits-lang'),
      'Expected js/i18n/index.js to contain the localStorage key "habits-lang"',
    );
  });

  it('js/i18n/index.js contains a setItem call (setLang writes to storage)', () => {
    assert.ok(
      source.includes('setItem'),
      'Expected js/i18n/index.js to contain a setItem call in setLang()',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-shell applyStaticTranslations adoption
// ---------------------------------------------------------------------------

describe('cross-shell applyStaticTranslations adoption', () => {
  it('js/main.js imports and calls applyStaticTranslations from ./i18n/index.js', () => {
    const src = readFileSync(new URL('../../js/main.js', import.meta.url), 'utf-8');
    assert.ok(
      src.includes('applyStaticTranslations'),
      'Expected js/main.js to reference applyStaticTranslations',
    );
    assert.ok(
      src.includes('./i18n/index.js'),
      'Expected js/main.js to import from ./i18n/index.js',
    );
  });

  it('js/desktop.js imports and calls applyStaticTranslations from ./i18n/index.js', () => {
    const src = readFileSync(new URL('../../js/desktop.js', import.meta.url), 'utf-8');
    assert.ok(
      src.includes('applyStaticTranslations'),
      'Expected js/desktop.js to reference applyStaticTranslations',
    );
    assert.ok(
      src.includes('./i18n/index.js'),
      'Expected js/desktop.js to import from ./i18n/index.js',
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Locale key parity (en.js vs pl.js)
// ---------------------------------------------------------------------------

describe('locale key parity (en.js vs pl.js)', () => {
  it('en.js and pl.js have the same number of keys', async () => {
    const { EN } = await import('../../js/i18n/en.js');
    const { PL } = await import('../../js/i18n/pl.js');
    assert.equal(
      Object.keys(EN).length,
      Object.keys(PL).length,
      `Key count mismatch: EN has ${Object.keys(EN).length} keys, PL has ${Object.keys(PL).length} keys`,
    );
  });

  it('every key in en.js exists in pl.js (no EN-only orphan keys)', async () => {
    const { EN } = await import('../../js/i18n/en.js');
    const { PL } = await import('../../js/i18n/pl.js');
    const missing = Object.keys(EN).filter(k => !(k in PL));
    assert.equal(
      missing.length,
      0,
      `EN keys missing from PL: ${missing.join(', ')}`,
    );
  });

  it('every key in pl.js exists in en.js (no PL-only orphan keys)', async () => {
    const { EN } = await import('../../js/i18n/en.js');
    const { PL } = await import('../../js/i18n/pl.js');
    const missing = Object.keys(PL).filter(k => !(k in EN));
    assert.equal(
      missing.length,
      0,
      `PL keys missing from EN: ${missing.join(', ')}`,
    );
  });
});
