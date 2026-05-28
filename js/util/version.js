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
 * derived from APP_VERSION as `habits-${APP_VERSION}` — bump on any
 * shell-asset change: index.html, desktop.html, manifest.json, sw.js,
 * icon.svg, anything under css/).
 *
 * Loaded by BOTH the window context and the module service worker as a plain
 * ES module — `import { APP_VERSION } from './js/util/version.js'` works
 * verbatim in either. `sw.js` is registered with `{ type: 'module' }` by
 * `js/platform/sw-register.js`, which is what makes this single-source
 * arrangement possible (D-12). The earlier classic-SW + `importScripts(...)`
 * approach was broken because `importScripts` evaluates as classic script
 * and `export const` is a SyntaxError there.
 *
 * Bumping the version remains exactly one edit, in exactly one file.
 */

/** @type {string} */
export const APP_VERSION = '0.3.0';

// Convenience side-effect assignment — exposes APP_VERSION on `self` /
// `globalThis` for ad-hoc DevTools probing in either context. Not relied on
// by any code path (the module import is the canonical accessor).
//
// Why `globalThis` (not bare `self`): Node 20+ runs this module from
// `tests/unit/_smoke.test.js` per D-23/D-38, and `self` is undefined in
// Node. `globalThis` is defined in every JS runtime (window,
// ServiceWorkerGlobalScope, Node 12+) and equals `self` in both browser and
// service-worker contexts, so the DevTools `self.APP_VERSION` probe keeps
// working unchanged.
globalThis.APP_VERSION = APP_VERSION;
