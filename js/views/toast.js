// js/views/toast.js — Toast primitive (D-08).
//
// This is the shared toast primitive used by Plan 03's update notification
// (showUpdateToast) and intended to be reused by future Undo notifications.
// The no-auto-dismiss behavior is INTENTIONAL and LOCKED per D-08: the toast
// persists until the user explicitly reloads or dismisses it.
//
// All dynamic content is rendered via `textContent` + `setAttribute` — never
// the unsafe-HTML setter (i-n-n-e-r-H-T-M-L). P1 has no user input, but the
// discipline is established here so P3+ (which will render Polish user-content
// habit names through this primitive when it hosts Undo) inherits the XSS-safe
// pattern by default (V5 partial / V14 partial; mitigates future tampering at
// this surface).

// Module-level reference — the single-toast invariant guard. A second
// showUpdateToast() call while a toast is already mounted is a no-op.
let toastEl = null;

export function showUpdateToast() {
  // Idempotent re-entry guard: if a toast is already mounted, do nothing.
  if (toastEl) return;

  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');

  // Message span — built with textContent (no unsafe-HTML setter).
  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = 'New version ready';

  // Reload action button — built with textContent (no unsafe-HTML setter).
  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'toast-action';
  reloadBtn.textContent = 'Reload';
  reloadBtn.addEventListener('click', () => {
    location.reload();
  });

  // Dismiss button — visible "×" glyph + aria-label for screen readers.
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    toastEl.remove();
    toastEl = null;
  });

  toastEl.appendChild(msg);
  toastEl.appendChild(reloadBtn);
  toastEl.appendChild(closeBtn);

  document.body.appendChild(toastEl);
}
