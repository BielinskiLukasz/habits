/**
 * @file Pure log-state cycle function for the 4-state swipe model (D-04, D-05).
 * Dispatches via the NEXT_STATE table — NO switch statement (Anti-Pattern 4).
 *
 * Cycle order: null/undefined → 'completed' → 'failed' → 'skipped' → null.
 * Both null and undefined are treated as the same "uncompleted" state and
 * advance to 'completed'. The discipline test in tests/unit/logStatus.test.js
 * enforces:
 *   - the `NEXT_STATE` identifier is present in the source
 *   - no `switch (` keyword anywhere in this file
 *
 * Forbidden constructs in this file:
 *   - `switch` statement on status values (Anti-Pattern 4)
 *   - `indexedDB.*` / `repo.*` calls — pure module (D-04 / D-05).
 *   - `.innerHTML` family — D-78 grep gate covers this file too.
 */

// NO switch statement — use a lookup object (Anti-Pattern 4)
const NEXT_STATE = {
  null: 'completed',
  completed: 'failed',
  failed: 'skipped',
  skipped: null,
};

/**
 * Advance a log status by one step in the 4-state cycle.
 * undefined/null → 'completed' → 'failed' → 'skipped' → null.
 *
 * @param {string|null|undefined} currentStatus - current log status
 * @returns {string|null} next status in cycle, or null for unknown inputs
 */
export function nextLogState(currentStatus) {
  const key = String(currentStatus ?? null);
  return Object.prototype.hasOwnProperty.call(NEXT_STATE, key)
    ? NEXT_STATE[key]
    : null;
}
