/**
 * @file In-memory wave catalog loaded from seed/waves.json (D-56, D-57).
 *
 * Phase 03 keeps the wave catalog OFF the IDB — `seed/waves.json` is fetched
 * at boot (via SWR per D-81) and held in module-level state. Phase 04 will
 * promote the catalog to an IDB `waves` store + a v1→v2 migration once
 * WAVE-06 needs user-extensibility; until then mutating the catalog requires
 * editing the seed file.
 *
 * `bootWaves()` is idempotent-by-overwrite: re-calling it replaces `_waves`
 * wholesale, which is structurally safe — there is no row-level identity to
 * preserve in-memory.
 *
 * Configure-based DI (RESEARCH §Open Question 2):
 *   - `configureWave({fetch})` injects a fetch function; production omits it
 *     and falls back to `globalThis.fetch`.
 *   - Tests inject a `fakeFetchFor(payload)`-shaped function so they can
 *     exercise `currentWave` on a synthetic 3-wave fixture or the real
 *     seed file.
 *
 * Defensive-copy invariant (Threat T-03-02):
 *   - `getAllWaves()` returns `[..._waves]` so callers cannot mutate the
 *     internal catalog through the returned array.
 *
 * Forbidden constructs in this file:
 *   - Direct `js/db/repo.js` write helpers — wave data is in-memory in P3.
 *   - `.innerHTML` family — D-78 grep gate covers this file too.
 */

/** @type {Array<{number: number, name: string, startDate: string, theme?: string}>} */
let _waves = [];

/** @type {((url: string) => Promise<{json: () => Promise<object>}>) | null} */
let _fetch = null;

/**
 * Inject dependencies. `deps.fetch` overwrites the module-level fetch when
 * the `fetch` key is PRESENT (even when its value is null) — this lets tests
 * reset the injection between cases. Production passes a real fetch once at
 * boot.
 *
 * @param {{ fetch?: ((url: string) => Promise<{json: () => Promise<object>}>) | null }} deps
 * @returns {void}
 */
export function configureWave(deps) {
  if (Object.prototype.hasOwnProperty.call(deps, 'fetch')) {
    _fetch = deps.fetch ?? null;
  }
}

/**
 * Load the wave catalog from `./seed/waves.json` into module state. Validates
 * the top-level shape before assigning — mirrors `js/io/seed.js`'s defensive
 * `seed: malformed` pattern (Threat T-03-01).
 *
 * @returns {Promise<void>}
 */
export async function bootWaves() {
  const fetchFn = _fetch ?? globalThis.fetch ?? null;
  if (!fetchFn) {
    throw new Error('wave: no fetch available (configureWave({fetch}) or globalThis.fetch)');
  }
  const res = await fetchFn('./seed/waves.json');
  const data = await res.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.waves) ||
    data.schemaVersion !== 1
  ) {
    throw new Error('wave: malformed');
  }
  _waves = data.waves;
}

/**
 * Highest-numbered wave whose `startDate <= date`. Returns null when no wave
 * qualifies (e.g. before Wave 0 starts).
 *
 * @param {string} date YYYY-MM-DD
 * @returns {object|null}
 */
export function currentWave(date) {
  return _waves
    .filter((w) => w.startDate <= date)
    .sort((a, b) => b.number - a.number)[0] ?? null;
}

/**
 * Get a wave by number.
 *
 * @param {number} number
 * @returns {object|null}
 */
export function getWave(number) {
  return _waves.find((w) => w.number === number) ?? null;
}

/**
 * Defensive copy of the full wave catalog. Mutations to the returned array do
 * NOT leak into module state.
 *
 * @returns {Array<object>}
 */
export function getAllWaves() {
  return [..._waves];
}

/**
 * Test-only: clear the in-memory catalog so `beforeEach` can start from a
 * pristine state.
 *
 * @returns {void}
 */
export function _resetWavesForTest() {
  _waves = [];
}
