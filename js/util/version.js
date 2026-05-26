/**
 * @file Single source of truth for app version (D-12).
 *
 * Format: Semantic Versioning 2.0.0 — https://semver.org/
 *   MAJOR.MINOR.PATCH (optionally `-prerelease` and/or `+build` suffixes)
 *   - MAJOR — incompatible API or storage-shape changes
 *   - MINOR — backwards-compatible feature additions
 *   - PATCH — backwards-compatible bug fixes or shell-asset-only changes
 *
 * Bumping this string forces a new SW cache name (per D-10: cache name is
 * derived from APP_VERSION as `nawyki-${APP_VERSION}` — bump on any
 * shell-asset change: index.html, desktop.html, manifest.json, sw.js,
 * icon.svg, anything under css/).
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
export const APP_VERSION = '1.0.0';

// Side-effect assignment so the classic SW context (which ignores `export`
// under importScripts) can still read the global.
self.APP_VERSION = APP_VERSION;
