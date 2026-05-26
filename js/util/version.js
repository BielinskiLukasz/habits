/**
 * @file Single source of truth for app version (D-12).
 *
 * Format: Semantic Versioning 2.0.0 — https://semver.org/
 *   MAJOR.MINOR.PATCH (optionally `-prerelease` and/or `+build` suffixes)
 *
 * CURRENT PHASE — Initial Development (`0.y.z`)
 *   Per SemVer §4: "Major version zero (0.y.z) is for initial development.
 *   Anything MAY change at any time. The public API SHOULD NOT be considered
 *   stable." During this phase:
 *     - PATCH (0.1.0 → 0.1.1) — bug fix, refactor, shell-asset-only change
 *     - MINOR (0.1.0 → 0.2.0) — phase completion, breaking change, new feature
 *     - MAJOR stays at 0 until the v1.0 milestone (Phase 6) is sealed
 *   After v1.0 ships, standard MAJOR/MINOR/PATCH rules apply.
 *
 * See VERSIONING.md at the project root for the full policy.
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
export const APP_VERSION = '0.1.0';

// Side-effect assignment so the classic SW context (which ignores `export`
// under importScripts) can still read the global.
self.APP_VERSION = APP_VERSION;
