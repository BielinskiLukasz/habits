/**
 * @file Single source of truth for app version (D-12).
 *
 * Bumping this string forces a new SW cache name (per D-10: cache name is
 * derived from APP_VERSION; bump only on shell-asset changes — index.html,
 * desktop.html, manifest.json, sw.js, icon.svg, anything under css/).
 *
 * Dual-context loadable:
 *   1. Window context — ES module via `import { APP_VERSION } from './js/util/version.js'`.
 *   2. Service-worker context — `importScripts('./js/util/version.js')` in sw.js,
 *      where `export` is silently ignored but the side-effect assignment
 *      `self.APP_VERSION = APP_VERSION` keeps the value readable from the SW global.
 *
 * Bumping the version remains exactly one edit, in exactly one file.
 */

/** @type {string} */
export const APP_VERSION = 'v1';

// Side-effect assignment so the classic SW context (which ignores `export`
// under importScripts) can still read the global.
self.APP_VERSION = APP_VERSION;
