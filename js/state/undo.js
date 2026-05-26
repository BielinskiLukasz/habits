/**
 * @file Persistent single-step undo via `meta.undoToken` (D-43, UNDO-02).
 *
 * The undo seam is structurally guaranteed by the chokepoint in `apply.js`:
 *
 *   - Every `apply(event)` writes `meta.undoToken = <event.id>` in the SAME
 *     tx as the data row(s) (D-43, Pitfall 7).
 *   - Every event row carries an `inverse: { type, payload }` field describing
 *     how to undo it (captured at write-time so the prior state is locked in).
 *
 * Therefore `undo()` reduces to:
 *
 *   1. Read `meta.undoToken` from IDB (persistent across reload — A9).
 *   2. Look up the event row by id.
 *   3. Dispatch its inverse through `apply()` so the inverse ALSO writes a
 *      new undoToken + broadcasts + flushes (D-43 — round-trip via the
 *      same chokepoint).
 *
 * Graceful no-op paths (return `null`):
 *   - `meta.undoToken` falsy (null, undefined, '') — nothing to undo.
 *   - Event row missing — corrupted state; fail soft.
 *   - Event has no `inverse` — non-undoable event (reserved for P3+).
 *
 * Configure-based DI (RESEARCH §Open Question 2):
 *   - `configureUndo({ repo })` injects the repo handle; symmetric with
 *     `apply.configure({ repo, broadcast, trackTx })`.
 *   - Both modules are configured with the SAME repo so the undo dispatch
 *     reaches the same store the original event wrote to.
 *
 * Forbidden constructs in this file:
 *   - Direct `js/db/repo.js` write helpers (`putHabit`, `putLog`, `putEvent`,
 *     `putMeta`, `putSetting`) — undo re-enters `apply()` for the write.
 *     DATA-04 / Anti-Pattern 1 / T-02-14 (discipline test).
 */

import { apply as defaultApply } from './apply.js';

/** @type {object|null} */
let _repo = null;

/**
 * Apply-function handle. Defaults to the statically-imported `apply`. Tests
 * inject the same `apply` instance they themselves configured so the repo
 * binding lines up across module-cache boundaries (the cache-bust pattern
 * in tests can fork the import graph; explicit DI prevents the fork).
 *
 * @type {(event: { type: string, payload: object }) => Promise<string>}
 */
let _apply = defaultApply;

/**
 * Inject the repo handle (and optionally a specific `apply` instance for
 * tests). Production boot calls `configureUndo({ repo })`; tests call
 * `configureUndo({ repo, apply })` with the cache-busted apply they wired.
 *
 * @param {{ repo?: object, apply?: (event: { type: string, payload: object }) => Promise<string> }} deps
 * @returns {void}
 */
export function configureUndo(deps) {
  if (deps.repo) _repo = deps.repo;
  if (deps.apply) _apply = deps.apply;
}

/**
 * Pop the most recent undoable event and dispatch its inverse through the
 * chokepoint. Returns the new event id, OR `null` when nothing is undoable.
 *
 * @returns {Promise<string|null>}
 */
export async function undo() {
  if (!_repo) {
    throw new Error('undo: configureUndo({ repo }) not called');
  }
  const token = await _repo.getMeta('undoToken');
  if (!token) return null;
  const evt = await _repo.getEvent(token);
  if (!evt) return null;
  if (!evt.inverse) return null;
  return _apply({ type: evt.inverse.type, payload: evt.inverse.payload });
}
