/**
 * @file Toast primitive (D-08, D-69, D-70, D-71, D-73). Shared by Plan 03's
 * SW-update notification and Plan 03-04's Undo / Error notifications.
 *
 * Three public surfaces:
 *
 *   - `showUpdateToast()` — LOCKED no-auto-dismiss per D-08. The toast
 *     persists until the user clicks Reload or × (the SW-update path).
 *     Idempotent: re-entrant calls while an update toast is mounted are
 *     no-ops.
 *
 *   - `showUndoToast({message, undoFn, autoDismissMs = 5000})` — D-69:
 *     auto-dismisses after 5 seconds; pointerenter clears the timer,
 *     pointerleave restarts a fresh 5s timer. D-70: a second showUndoToast
 *     while one is mounted REPLACES the prior (single-toast invariant).
 *     D-71: caller composes verb+habit copy (e.g. "Marked Drink water
 *     complete"). Clicking Undo invokes `undoFn` and dismisses the toast.
 *     When `undoFn` throws or returns a rejected promise, an error-variant
 *     toast surfaces ("Couldn't undo — try again").
 *
 *   - `showErrorToast(message)` — D-73: error variant (`toast toast--error`).
 *     4s auto-dismiss. No action button. Used by Today's apply()-reject
 *     path and by showUndoToast's catch chain.
 *
 * All dynamic content is rendered via `textContent` + `setAttribute` —
 * never the unsafe-HTML setter (D-78 grep gate enforces this in CI).
 *
 * Accessibility: every toast wrapper carries `role="status" aria-live="polite"`.
 * Dismiss button has `aria-label="Dismiss"` per D-79.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`
 *     — D-78 grep gate.
 *   - Auto-dismiss on the update-toast path — D-08 LOCKED.
 */

// Single-toast invariant guard (D-70) — every new _showToast call replaces
// the current toast, clearing its timer. `toastEl === null` means "no toast
// currently mounted."
let toastEl = null;

/** @type {ReturnType<typeof setTimeout>|null} */
let dismissTimer = null;

/**
 * Remove the current toast (if any) and clear any pending auto-dismiss timer.
 * Idempotent — safe to call when nothing is mounted.
 *
 * @returns {void}
 */
function _dismissToast() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (toastEl) {
    toastEl.remove();
    toastEl = null;
  }
}

/**
 * Internal helper — builds the toast DOM and registers timers/listeners per
 * the options. Always replaces any existing toast (D-70).
 *
 * @param {{
 *   message: string,
 *   action?: { label: string, fn: () => void },
 *   autoDismissMs?: number,
 *   variant?: string,
 * }} opts
 * @returns {object} the mounted toast element
 */
function _showToast({ message, action, autoDismissMs, variant }) {
  // D-70: clear prior toast + timer BEFORE mounting the new one.
  _dismissToast();

  toastEl = document.createElement('div');
  toastEl.className = variant ? `toast toast--${variant}` : 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');

  // Message span — textContent (no unsafe-HTML setter).
  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = String(message);
  toastEl.appendChild(msg);

  // Optional action button — invokes the closure then dismisses the toast.
  if (action && typeof action.fn === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'toast-action';
    actionBtn.textContent = String(action.label);
    actionBtn.addEventListener('click', () => {
      // Capture the closure before _dismissToast runs (paranoia: defensive
      // against re-entrant timer ticks).
      const fn = action.fn;
      _dismissToast();
      try {
        const result = fn();
        if (result && typeof result.then === 'function') {
          result.catch(() => {
            showErrorToast("Couldn't undo — try again");
          });
        }
      } catch (_err) {
        showErrorToast("Couldn't undo — try again");
      }
    });
    toastEl.appendChild(actionBtn);
  }

  // Always append a dismiss button (× glyph + aria-label).
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    _dismissToast();
  });
  toastEl.appendChild(closeBtn);

  // Auto-dismiss timer + hover-pause / hover-leave-restart (D-69).
  if (typeof autoDismissMs === 'number' && autoDismissMs > 0) {
    dismissTimer = setTimeout(() => {
      _dismissToast();
    }, autoDismissMs);
    toastEl.addEventListener('pointerenter', () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    });
    toastEl.addEventListener('pointerleave', () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        _dismissToast();
      }, autoDismissMs);
    });
  }

  document.body.appendChild(toastEl);
  return toastEl;
}

/**
 * Show the "New version ready" toast with Reload and Dismiss actions.
 *
 * LOCKED per D-08: NO `autoDismissMs` — the SW-update toast persists until
 * the user clicks Reload or ×. Idempotent: re-entrant calls while an update
 * toast is mounted are no-ops (the user already saw it).
 *
 * @returns {void}
 */
export function showUpdateToast() {
  // Idempotent re-entry guard: if a toast (any variant) is mounted, do
  // nothing. The user already has feedback on screen.
  if (toastEl) return;

  // NOTE: NO `autoDismissMs` passed to _showToast — D-08 LOCKED.
  _showToast({
    message: 'New version ready',
    action: { label: 'Reload', fn: () => location.reload() },
  });
}

/**
 * Show an Undo toast (D-69, D-71). Caller composes the message
 * (e.g. `"Marked Drink water complete"`); the toast renders "<message> Undo ×"
 * and auto-dismisses after 5s. Hover pauses the timer.
 *
 * Clicking Undo invokes `undoFn` and dismisses the toast. When `undoFn`
 * throws or returns a rejected promise, an error-variant toast surfaces
 * ("Couldn't undo — try again", D-73). When `undoFn` returns `null`
 * (single-step model — nothing to undo), no error toast is shown.
 *
 * @param {{ message: string, undoFn: () => unknown, autoDismissMs?: number }} opts
 * @returns {void}
 */
export function showUndoToast({ message, undoFn, autoDismissMs = 5000 }) {
  _showToast({
    message,
    action: { label: 'Undo', fn: undoFn },
    autoDismissMs,
  });
}

/**
 * Show an error-variant toast (D-73). 4s auto-dismiss; no action button.
 * Used by Today's apply()-reject path and by showUndoToast's catch chain.
 *
 * @param {string} message
 * @returns {void}
 */
export function showErrorToast(message) {
  _showToast({
    message,
    autoDismissMs: 4000,
    variant: 'error',
  });
}

/**
 * Test-only: force-clear module-level toast state. Mirrors the
 * `_resetTodayForTest` / `_resetStoreForTest` pattern. Production NEVER
 * calls this.
 *
 * @returns {void}
 */
export function _resetToastForTest() {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  toastEl = null;
}
