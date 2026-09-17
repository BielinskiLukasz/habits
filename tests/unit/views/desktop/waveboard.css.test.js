/**
 * @file Regression test for the waveboard wave-header sticky-pinning scope
 * (O9H-waveboard-wave-header-sticky).
 *
 * Pattern S6 (source-text parsing, matching tests/integration/sw.shell.test.js):
 * this project has no CSS test harness (no CSSOM/DOM style computation), so
 * the test regex-parses css/desktop.css directly instead.
 *
 * Two rules share the `.analytics-wave-header td` selector fragment:
 *   1. `.waveboard-grid .analytics-wave-header td` — scoped to the
 *      horizontally-scrolling waveboard heat-map; MUST be sticky-pinned so
 *      the "Wave N — {name}" label stays visible at the left edge.
 *   2. `.analytics-wave-header td` (bare) — shared by the plain,
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
  test('.waveboard-grid .analytics-wave-header td is sticky-pinned at the left edge', () => {
    const match = css.match(/\.waveboard-grid\s+\.analytics-wave-header\s+td\s*\{([^}]*)\}/);
    assert.ok(match, 'expected a `.waveboard-grid .analytics-wave-header td` rule in css/desktop.css');
    assert.match(match[1], /position:\s*sticky/);
    assert.match(match[1], /left:\s*0/);
  });

  test('bare .analytics-wave-header td (plain analytics table) stays non-sticky', () => {
    const match = css.match(/^[ \t]*\.analytics-wave-header td\s*\{([^}]*)\}/m);
    assert.ok(match, 'expected the shared `.analytics-wave-header td` rule in css/desktop.css');
    assert.doesNotMatch(match[1], /position:\s*sticky/);
  });
});
