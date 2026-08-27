/**
 * @file promoteHabit handler (SCHED-04).
 *
 * Handles the promotion of a scheduled habit to active status.
 * This handler only writes to the `habits` store — logs are never touched,
 * preserving full history integrity across the status change.
 *
 * Handler contract (matches archiveHabit.js shape):
 *   - Signature: `handlePromoteHabit(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['habits']` — no log or events writes (apply.js auto-adds events + meta)
 *   - `writes`: single `{store:'habits', value: updatedHabit}` entry
 *   - `inverse`: round-trip event for undo (promoteHabit ↔ demoteHabit)
 *   - `broadcastKeys(event) -> {habitId}`: ID-only broadcast (Pitfall 8)
 *
 * Forbidden constructs:
 *   - Direct calls to js/db/repo.js write helpers
 *   - `switch (` statement (Anti-Pattern 4)
 */

/**
 * `promoteHabit` handler — set habit.status to 'active'.
 *
 * Reads the current habit row for undo capture (Pitfall 7 — prior locked at
 * write-time). Inverse is `demoteHabit` so undo returns to 'scheduled' status.
 *
 * @param {{ type: 'promoteHabit', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handlePromoteHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  if (!habit) throw new Error(`Habit ${habitId} not found`);
  const updated = { ...habit, status: 'active' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'demoteHabit', payload: { habitId } },
  };
}

handlePromoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });

/**
 * `demoteHabit` handler — revert habit.status back to 'scheduled' (undo inverse of promoteHabit).
 *
 * @param {{ type: 'demoteHabit', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleDemoteHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  if (!habit) throw new Error(`Habit ${habitId} not found`);
  const updated = { ...habit, status: 'scheduled' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'promoteHabit', payload: { habitId } },
  };
}

handleDemoteHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
