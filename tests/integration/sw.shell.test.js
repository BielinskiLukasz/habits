/**
 * @file SHELL coverage regression guard (D-81) — extracts the `SHELL` array
 * from `sw.js` via source-text parsing and asserts every P3-introduced
 * shell-asset file is present (belt-and-suspenders with the manual D-81 review).
 *
 * Why source-text parsing (not module import): importing `sw.js` would also
 * register a real Service-Worker `install` / `activate` handler on the
 * Node-global `self`, which is undesirable. Parsing the file's text is the
 * lighter-weight contract and matches the Pattern S6 grep-discipline shape
 * established by `tests/unit/discipline.xss.test.js`.
 *
 * The test owns a LOCKED list of P3-required entries. When P4 adds files
 * under `js/views/` or `js/state/apply/` etc., the planner MUST extend the
 * locked list (or document an SWR exception inline) — this is intentional:
 * the failure of this test on a future commit is the surface that catches
 * SHELL drift early.
 *
 * Also pins the P2 baseline so an accidental delete from `SHELL` is caught
 * by the test rather than by an offline-boot regression in production.
 *
 * D-81 SWR exception: `seed/waves.json` is intentionally NOT in SHELL — it
 * is runtime-cached via stale-while-revalidate, matching the existing
 * `seed/habits.json` treatment under D-11.
 */

import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {describe, test} from 'node:test';
import {strict as assert} from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Extract the `SHELL` array entries from `sw.js` source text.
 *
 * Strategy: match `const SHELL = [` … `];`, then for each line inside, strip
 * `// …` comments and surrounding whitespace, drop trailing commas, drop
 * wrapping quotes. The result is a Set of normalized entry strings.
 *
 * Limitation: block comments inside the SHELL array are NOT stripped. The
 * current `sw.js` SHELL has only line-style inline comments, and the rest
 * of the codebase follows the same convention, so this is acceptable.
 * Adding block comments inside SHELL would require extending the parser.
 *
 * @param {string} src - raw contents of `sw.js`
 * @returns {Set<string>} normalized SHELL entries
 */
function extractShell(src) {
  const m = src.match(/const SHELL\s*=\s*\[([\s\S]*?)\];/);
  if (!m) throw new Error('sw.js SHELL array not found');
  const entries = m[1]
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map((l) => l.replace(/,$/, '').trim())
    .map((l) => l.replace(/^['"]|['"]$/g, ''));
  return new Set(entries);
}

// P2 baseline — every entry that was in SHELL at the end of Phase 2 plan 05.
// An accidental delete of any of these is a regression that breaks the
// offline-first boot. Pinned here so the discipline test catches it.
const P2_BASELINE = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  './icon.svg',
  './css/main.css',
  './css/tokens.css',
  './css/reset.css',
  './css/base.css',
  './css/components.css',
  './css/today.css',
  './js/main.js',
  './js/desktop.js',
  './js/util/version.js',
  './js/platform/sw-register.js',
  './js/views/diagnostics.js',
  './js/views/toast.js',
  './js/util/date.js',
  './js/util/id.js',
  './js/db/idb.js',
  './js/db/schema.js',
  './js/db/repo.js',
  './js/state/store.js',
  './js/state/apply.js',
  './js/state/apply/markCompleted.js',
  './js/state/undo.js',
  './js/platform/sync.js',
  './js/platform/lifecycle.js',
  './js/io/seed.js',
  './seed/habits.json',
];

// P3-required entries (D-81). Files introduced during plans 03-01..03-05
// that are part of the app shell at startup and therefore must be precached.
//
// Already-in-baseline (e.g. `./css/today.css`) are NOT duplicated here.
// `seed/waves.json` is intentionally NOT in this list (SWR exception).
const P3_REQUIRED = [
  './js/router.js',
  './js/views/today.js',
  './js/views/today/builders.js',
  './js/views/settings.js',
  './js/views/settings/builders.js',
  './js/domain/cadence.js',
  './js/domain/wave.js',
  './js/util/mount.js',
  './js/state/apply/markUncompleted.js',
  './js/state/apply/setSetting.js',
  './css/settings.css',
];

// P4-required entries — files introduced during Phase 4 plans 04-01..04-09
// that are part of the app shell at startup and therefore must be precached.
//
// Intentional SWR exceptions (NOT in this list):
//   - `seed/waves.json` — runtime-fetched via stale-while-revalidate (D-81)
// All JS files under /js/ are technically SWR-eligible too, but new view/
// domain/apply modules are precached here to guarantee they are available
// on the very first offline load (boot path requires them synchronously).
const P4_REQUIRED = [
  './js/views/catalog.js',
  './js/views/catalog/builders.js',
  './js/views/history.js',
  './js/views/history/builders.js',
  './js/state/apply/createHabit.js',
  './js/state/apply/editHabit.js',
  './js/state/apply/archiveHabit.js',
  './js/state/apply/advanceStage.js',
  './js/state/apply/logNumeric.js',
  './js/state/apply/logSlot.js',
  './js/state/apply/setMasteryThreshold.js',
  './js/state/apply/setMasteryWindow.js',
  './js/domain/mastery.js',
  './js/domain/stage.js',
  './js/domain/waveAggregates.js',
  './css/catalog.css',
  './css/history.css',
];

// P6-required entries — files introduced during Phase 6 plans 06-01..06-07
// that are part of the app shell at startup and therefore must be precached.
//
// Note: `./desktop.html` is already in the P2 baseline — it is NOT duplicated here.
// desktop.css: desktop layout and scoring status CSS tokens.
// scoring.js, scoreSnapshots.js: domain + IO modules written on every log write.
// views/desktop/*: desktop-only view modules, route-dispatched from desktop.js.
const P6_REQUIRED = [
  './css/desktop.css',
  './js/domain/scoring.js',
  './js/io/scoreSnapshots.js',
  './js/views/desktop/analytics.js',
  './js/views/desktop/waveboard.js',
  './js/views/desktop/planning.js',
];

describe('D-81 SHELL coverage', () => {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const shell = extractShell(src);

  test('P2 baseline entries are still present (no accidental deletes)', () => {
    const missing = P2_BASELINE.filter((e) => !shell.has(e));
    assert.deepEqual(
      missing,
      [],
      `P2 baseline regression: ${missing.join(', ')} missing from SHELL`,
    );
  });

  test('P3 required entries are all present', () => {
    const missing = P3_REQUIRED.filter((e) => !shell.has(e));
    assert.deepEqual(
      missing,
      [],
      `D-81 SHELL coverage gap: ${missing.join(', ')} not present in sw.js SHELL — add them or document the SWR exception in this test.`,
    );
  });

  test('P4 required entries are all present', () => {
    const missing = P4_REQUIRED.filter((e) => !shell.has(e));
    assert.deepEqual(
      missing,
      [],
      `D-81 SHELL coverage gap (P4): ${missing.join(', ')} not present in sw.js SHELL — add them or document the SWR exception in this test.`,
    );
  });

  test('P6 required entries are all present', () => {
    const missing = P6_REQUIRED.filter((e) => !shell.has(e));
    assert.deepEqual(
      missing,
      [],
      `D-81 SHELL coverage gap (P6): ${missing.join(', ')} not present in sw.js SHELL — add them or document the SWR exception in this test.`,
    );
  });

  test('seed/waves.json is NOT in SHELL (D-81 SWR exception)', () => {
    assert.equal(
      shell.has('./seed/waves.json'),
      false,
      'D-81: seed/waves.json must be SWR-cached, not precached',
    );
  });

  test('every SHELL entry resolves to a real file on disk (T-03-41 mitigation)', () => {
    // The `./` directory-root entry is satisfied by `index.html` on
    // default-document servers; assert directory existence rather than a
    // literal `./` file.
    const missing = [];
    for (const entry of shell) {
      if (entry === './') {
        if (!existsSync(ROOT)) missing.push(entry);
        continue;
      }
      const rel = entry.replace(/^\.\//, '');
      if (!existsSync(join(ROOT, rel))) missing.push(entry);
    }
    assert.deepEqual(
      missing,
      [],
      `SHELL contains entries that do not exist on disk (would 404 on install): ${missing.join(', ')}`,
    );
  });
});
