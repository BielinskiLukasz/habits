/** @file Slot-checklist helper — convert seed-schema slots to runtime array shape. */

/**
 * Convert a seed-schema `slots` value into a runtime array of {name, checked: false}.
 *
 * Handles three input shapes:
 *   - Array → returned as-is (already normalized)
 *   - { kind: 'anonymous', count: N } → N slots named "Slot 1", "Slot 2", …
 *   - { kind: 'labeled', labels: [...] } → labeled slots with those names
 *   - null/undefined → [] (safe default)
 *   - unknown shape → [] (defensive fallback)
 *
 * @param {{ kind?: string, count?: number, labels?: string[] } | Array<{name: string, checked: boolean}> | null} slots
 * @returns {Array<{name: string, checked: boolean}>}
 */
export function normalizeSlotsToArray(slots) {
  if (!slots) return [];
  if (Array.isArray(slots)) return slots;

  if (slots.kind === 'labeled') {
    return (slots.labels ?? []).map((name) => ({ name, checked: false }));
  }

  if (slots.kind === 'anonymous') {
    const count = slots.count ?? 0;
    return Array.from({ length: count }, (_, i) => ({
      name: `Slot ${i + 1}`,
      checked: false,
    }));
  }

  // Unknown shape → safe fallback (don't crash)
  return [];
}
