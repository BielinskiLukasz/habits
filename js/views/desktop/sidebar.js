/** @file Desktop sidebar collapse/expand toggle — persists to localStorage.
 *
 * Manages the `.desktop-sidebar--collapsed` modifier on the sidebar nav element
 * and keeps nav links out of keyboard tab order while collapsed.
 * Preference persisted at key `habits:sidebar-collapsed` in localStorage.
 */

/**
 * Mount the sidebar toggle button behaviour. Reads stored preference, applies
 * initial state, and wires click + keyboard activation on the toggle button.
 *
 * @param {HTMLElement} sidebarEl - The .desktop-sidebar nav element.
 * @returns {void}
 */
export function mountSidebarToggle(sidebarEl) {
  const btn = sidebarEl.querySelector('#sidebar-toggle');
  if (!btn) return;

  const links = sidebarEl.querySelectorAll('.desktop-sidebar-link');

  const stored = localStorage.getItem('habits:sidebar-collapsed');
  let collapsed = stored === 'true';

  /**
   * Apply the collapsed or expanded state to the sidebar.
   *
   * @param {boolean} isCollapsed - Whether the sidebar should be collapsed.
   * @returns {void}
   */
  function applyState(isCollapsed) {
    sidebarEl.classList.toggle('desktop-sidebar--collapsed', isCollapsed);
    btn.setAttribute('aria-expanded', String(!isCollapsed));
    btn.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    const icon = btn.querySelector('.desktop-sidebar-toggle-icon');
    if (icon) icon.textContent = isCollapsed ? '›' : '‹';
    for (const link of links) {
      if (isCollapsed) {
        link.setAttribute('tabindex', '-1');
      } else {
        link.removeAttribute('tabindex');
      }
    }
  }

  // Apply initial state (from stored preference) without persisting again.
  applyState(collapsed);

  btn.addEventListener('click', () => {
    collapsed = !collapsed;
    applyState(collapsed);
    localStorage.setItem('habits:sidebar-collapsed', String(collapsed));
  });
}
