/**
 * @file Regression test for the waveboard wave-header sticky-pinning scope
 * (O9H-waveboard-wave-header-sticky; revised for waveboard-wave-row-not-pinned).
 *
 * Pattern S6 (source-text parsing, matching tests/integration/sw.shell.test.js):
 * this project has no CSS test harness (no CSSOM/DOM style computation), so
 * the test regex-parses css/desktop.css directly instead.
 *
 * A colspan'd <td> (the wave-header row spans every column) is exactly as
 * wide as the whole scrollable table, so `position: sticky` applied
 * directly to the <td> has zero room to move it — verified empirically
 * against real Chromium during the waveboard-wave-row-not-pinned debug
 * session (getComputedStyle reported position:sticky/left:0 correctly, but
 * the box tracked scrollLeft exactly, i.e. never actually stuck). The fix
 * pins an inner `<span class="wave-header-label">` instead of the <td>
 * itself. NOTE: this file can only verify the CSS *text* is structured
 * correctly — it cannot verify the resulting browser-rendered behavior.
 * See tests/unit/views/desktop/waveboard.builders.test.js for the
 * accompanying structural test on the builder's DOM description tree.
 *
 * Three rules matter here:
 *   1. `.waveboard-grid .analytics-wave-header td .wave-header-label` —
 *      scoped to the horizontally-scrolling waveboard heat-map; MUST be
 *      sticky-pinned so the "Wave N" label stays visible at the left edge.
 *   2. `.waveboard-grid .analytics-wave-header td` (the outer colspan cell)
 *      — MUST NOT itself carry position:sticky (that's the original bug).
 *   3. `.analytics-wave-header td` (bare) — shared by the plain,
 *      non-scrolling desktop analytics table (js/views/desktop/analytics.js);
 *      MUST stay non-sticky, since that table never scrolls horizontally.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const css = readFileSync(join(ROOT, 'css', 'desktop.css'), 'utf8');

describe('waveboard wave-header sticky scoping (css/desktop.css)', () => {
  test('.waveboard-grid .analytics-wave-header td .wave-header-label is sticky-pinned at the left edge', () => {
    const match = css.match(/\.waveboard-grid\s+\.analytics-wave-header\s+td\s+\.wave-header-label\s*\{([^}]*)\}/);
    assert.ok(match, 'expected a `.waveboard-grid .analytics-wave-header td .wave-header-label` rule in css/desktop.css');
    assert.match(match[1], /position:\s*sticky/);
    assert.match(match[1], /left:\s*0/);
  });

  test('.waveboard-grid .analytics-wave-header td (the outer colspan cell) does NOT carry position:sticky itself', () => {
    const match = css.match(/\.waveboard-grid\s+\.analytics-wave-header\s+td\s*\{([^}]*)\}/);
    assert.ok(match, 'expected a `.waveboard-grid .analytics-wave-header td` rule in css/desktop.css');
    assert.doesNotMatch(match[1], /position:\s*sticky/,
      'the colspan td itself must not be the sticky target — a colspan cell has zero room for sticky to move it (see waveboard-wave-row-not-pinned debug session)');
  });

  test('bare .analytics-wave-header td (plain analytics table) stays non-sticky', () => {
    const match = css.match(/^[ \t]*\.analytics-wave-header td\s*\{([^}]*)\}/m);
    assert.ok(match, 'expected the shared `.analytics-wave-header td` rule in css/desktop.css');
    assert.doesNotMatch(match[1], /position:\s*sticky/);
  });
});
