---
slug: 260705-settings-nav-desktop
date: 2026-07-05
status: in-progress
---

# Add Settings nav item to desktop.html sidebar

## Goal
Wire a Settings route into desktop.html so the existing mountSettings() view is reachable from the desktop sidebar.

## Tasks

- [ ] Add `<a href="#settings">` link to sidebar nav in `desktop.html`
- [ ] Add `<section data-route="settings">` panel in `desktop.html` (hidden by default)
- [ ] Import `mountSettings` in `desktop.js`
- [ ] Query `settingsPanel` element in `desktop.js`
- [ ] Add `settingsPanel` to `show()` panel array
- [ ] Add `#settings` route in `mountRoutes` call
- [ ] Commit atomically

## Files
- `desktop.html`
- `js/desktop.js`
