/**
 * @file archiveHabit / restoreHabit handlers (CATALOG-05, CATALOG-06).
 *
 * Handles habit lifecycle transitions between 'active' and 'archived' status.
 * These handlers only write to the `habits` store — logs are never touched,
 * preserving full history integrity across the status change.
 *
 * Handler contract (matches markCompleted.js shape):
 *   - Signature: `handle<Event>(event, repo) -> {storeNames, writes, inverse}`
 *   - `storeNames`: `['habits']` — no log or events writes (apply.js auto-adds events + meta)
 *   - `writes`: single `{store:'habits', value: updatedHabit}` entry
 *   - `inverse`: round-trip event for undo (archiveHabit ↔ restoreHabit)
 *   - `broadcastKeys(event) -> {habitId}`: ID-only broadcast (Pitfall 8)
 *
 * Forbidden constructs:
 *   - Direct calls to js/db/repo.js write helpers
 *   - `switch (` statement (Anti-Pattern 4)
 */

/**
 * `archiveHabit` handler — set habit.status to 'archived'.
 *
 * Reads the current habit row for undo capture (Pitfall 7 — prior locked at
 * write-time). Inverse is `restoreHabit` so undo restores 'active' status.
 *
 * @param {{ type: 'archiveHabit', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleArchiveHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  const updated = { ...habit, status: 'archived' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'restoreHabit', payload: { habitId } },
  };
}

handleArchiveHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });

/**
 * `restoreHabit` handler — set habit.status back to 'active'.
 *
 * Inverse is `archiveHabit` so undo re-archives if needed.
 *
 * @param {{ type: 'restoreHabit', payload: { habitId: string } }} event
 * @param {{ getHabit: (id: string) => Promise<object|undefined> }} repo
 * @returns {Promise<{ storeNames: string[], writes: Array<{store: string, value: object}>, inverse: { type: string, payload: object } }>}
 */
export async function handleRestoreHabit(event, repo) {
  const { habitId } = event.payload;
  const habit = await repo.getHabit(habitId);
  const updated = { ...habit, status: 'active' };

  return {
    storeNames: ['habits'],
    writes: [{ store: 'habits', value: updated }],
    inverse: { type: 'archiveHabit', payload: { habitId } },
  };
}

handleRestoreHabit.broadcastKeys = (event) => ({ habitId: event.payload.habitId });
