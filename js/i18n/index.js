/**
 * @file i18n module for Nawyki — t(key, subs?), getLang(), setLang(lang).
 * Reads lang preference from localStorage('habits-lang') on module init;
 * defaults to 'en' when localStorage is absent (Node test environment) or
 * value is invalid. setLang() writes to localStorage and calls
 * location.reload() — simple full-page refresh strategy avoids partial-update
 * bugs. No dynamic imports; en.js and pl.js are static imports at module
 * load time (T-i18n-01: validate against VALID Set; T-i18n-02: guard setLang
 * against out-of-range values).
 */

import { EN } from './en.js';
import { PL } from './pl.js';

/** @type {Record<string, Record<string, string>>} */
const LOCALES = { en: EN, pl: PL };

/** @type {Set<string>} */
const VALID = new Set(Object.keys(LOCALES));

/** @type {Storage|null} */
const _storage = typeof localStorage !== 'undefined' ? localStorage : null;

/**
 * Determine the initial language from localStorage, falling back to 'en'
 * when localStorage is unavailable (Node) or the stored value is invalid.
 *
 * @returns {'en'|'pl'}
 */
function _resolveInitialLang() {
  const stored = _storage?.getItem('habits-lang') ?? '';
  return VALID.has(stored) ? /** @type {'en'|'pl'} */ (stored) : 'en';
}

/** @type {'en'|'pl'} */
let _lang = _resolveInitialLang();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the currently active locale key.
 *
 * @returns {'en'|'pl'}
 */
export function getLang() {
  return _lang;
}

/**
 * Switch the active locale, persist the preference to localStorage, and reload
 * the page. When `lang` is not a valid locale key the call is a no-op.
 * In Node (no globalThis.location) the reload is silently skipped — only the
 * localStorage write (when available) and the internal `_lang` update happen.
 *
 * @param {'en'|'pl'} lang
 * @returns {void}
 */
export function setLang(lang) {
  if (!VALID.has(lang)) return;
  _lang = /** @type {'en'|'pl'} */ (lang);
  _storage?.setItem('habits-lang', lang);
  globalThis.location?.reload?.();
}

/**
 * Look up `key` in the current locale dictionary. Falls back to the English
 * dictionary when the key is missing from the active locale, then falls back
 * to the key itself when not found in English either. Applies `{name}`
 * placeholder substitution from `subs` when provided.
 *
 * @param {string} key
 * @param {Record<string, string|number>} [subs] - Optional substitution map.
 * @returns {string}
 */
export function t(key, subs) {
  let result = LOCALES[_lang]?.[key] ?? LOCALES['en']?.[key] ?? key;
  if (subs) {
    for (const k of Object.keys(subs)) {
      result = result.replace('{' + k + '}', String(subs[k]));
    }
  }
  return result;
}

/**
 * Return the display name for a habit, using the Polish name when the current
 * locale is 'pl' and name_pl is set.
 *
 * @param {{ name: string, name_pl?: string|null }} habit
 * @returns {string}
 */
export function displayName(habit) {
  return getLang() === 'pl' ? (habit.name_pl ?? habit.name) : habit.name;
}

/**
 * Apply t() to every element in the document that has a data-i18n attribute,
 * setting its textContent to the translated string. Call once at boot after
 * the DOM is ready to translate static HTML headings and nav links.
 *
 * @returns {void}
 */
export function applyStaticTranslations() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Reset the module-level language state to `lang` (default 'en'). Exported
 * for unit tests only — mirrors the `_resetXxxForTest()` pattern used across
 * the codebase (Pattern S8, D-26 Tier 1). Does NOT touch localStorage or
 * call location.reload().
 *
 * @param {'en'|'pl'} [lang='en']
 * @returns {void}
 */
export function _resetLangForTest(lang = 'en') {
  _lang = /** @type {'en'|'pl'} */ (VALID.has(lang) ? lang : 'en');
}
