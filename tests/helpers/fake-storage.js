/**
 * @file Fake `navigator.storage` for testing `navigator.storage.persist()` (D-25, DATA-03).
 *
 * Used by `tests/integration/seed.persist.test.js` to assert that the seed
 * loader calls `persist()` exactly once on first run (per D-41) and does NOT
 * re-call it on subsequent boots (per Pitfall 11). Spy counters (`_persistCalls`)
 * expose call counts to the test.
 *
 * The `persistResult` option lets a test simulate Chrome's engagement-metrics
 * "false" path (Pitfall 3) — code that treats false as user-denial would
 * surface here.
 */

/**
 * @param {{ persistResult?: boolean }} [opts]
 * @returns {{
 *   storage: { persist: () => Promise<boolean>, persisted: () => Promise<boolean> },
 *   _persistCalls: number,
 *   _persistedCalls: number,
 * }}
 */
export function createFakeStorage(opts = {}) {
  const persistResult = opts.persistResult === undefined ? true : opts.persistResult;
  const state = {
    storage: null, // assigned below; closure captures `state` for spy mutation
    _persistCalls: 0,
    _persistedCalls: 0,
  };
  state.storage = {
    async persist() {
      state._persistCalls++;
      return persistResult;
    },
    async persisted() {
      state._persistedCalls++;
      return persistResult;
    },
  };
  return state;
}
