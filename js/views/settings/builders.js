/**
 * @file Pure description-tree builders for the Settings panel (D-26 Tier 1,
 * D-61..D-66, D-67, D-71, D-76, D-79).
 *
 * Every builder returns `{tag, attrs?, text?, children?}` — the same shape
 * the `mount()` helper (D-77) consumes. NO DOM access here; that lives in
 * `js/views/settings.js`. Splitting the two halves keeps the builders
 * trivially unit-testable in Node (Pattern S8) and pushes the XSS-safe DOM
 * construction discipline (D-78 grep gate) to a single seam.
 *
 * Action attributes (`data-action="requestPersistence"` etc.) flow through
 * to the `mount(desc, parent, actions)` helper, which binds the matching
 * closure from the `actions` map as a click listener. Builders never own
 * the closures — the mounter wires them.
 *
 * Card wrapper convention (every builder):
 *   <section class="settings-card" aria-labelledby="<id>">
 *     <h2 id="<id>">Title</h2>
 *     ...body...
 *   </section>
 *
 * The `aria-labelledby` ↔ `<h2>.id` pair satisfies D-79 (cards announce
 * their title to screen readers). IDs are static per-card constants —
 * builders are pure so they don't need to thread through state.
 *
 * Loading-state contract (Pattern S5 — async-loaded values from the
 * mounter's perspective): when an input is the literal string `'loading…'`,
 * the builder emits it verbatim into the matching `<dd>` — the mounter
 * mutates `dd.textContent` directly after each Promise resolves so no full
 * re-render is needed.
 *
 * The Reset-data confirm string (D-67) lives in the MOUNTER (it is a
 * clickable behavior — the builder only emits the button).
 *
 * Forbidden constructs in this file:
 *   - Any DOM access (createElement, document.*, etc.) — builders are pure.
 *   - `.innerHTML` family — D-78 grep gate.
 */

/* Stable per-card heading IDs for `aria-labelledby`. */
const STORAGE_LABEL_ID = 'settings-storage-h2';
const SCHEDULE_LABEL_ID = 'settings-schedule-h2';
const INSTALL_LABEL_ID = 'settings-install-h2';
const DATA_LABEL_ID = 'settings-data-h2';
const ABOUT_LABEL_ID = 'settings-about-h2';
const MASTERY_LABEL_ID = 'settings-mastery-h2';

/**
 * Build the Storage card description (D-62, PWA-07 partial).
 *
 * Inputs are plain values — the async resolution (`navigator.storage.persisted()`,
 * `navigator.storage.estimate()`) happens in the mounter; the builder is
 * tested with the post-await snapshot. When an input is the literal
 * string `'loading…'`, the corresponding `<dd>` carries that text verbatim
 * so the mounter can later mutate `dd.textContent` (Pattern S5).
 *
 * When `supported === false`, the card renders a single `<p>` line and no
 * buttons or `<dl>` rows.
 *
 * @param {{ supported?: boolean, persisted?: boolean|string, estimateUsedMB?: string|number, estimateQuotaMB?: string|number }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildStorageCard({
  supported = true,
  persisted = 'loading…',
  estimateUsedMB = 'loading…',
  estimateQuotaMB = 'loading…',
} = {}) {
  /** @type {object[]} */
  const body = [
    { tag: 'h2', attrs: { id: STORAGE_LABEL_ID }, text: 'Storage' },
  ];

  if (!supported) {
    body.push({
      tag: 'p',
      text: 'Storage status unsupported on this browser.',
    });
    return {
      tag: 'section',
      attrs: {
        class: 'settings-card',
        'aria-labelledby': STORAGE_LABEL_ID,
      },
      children: body,
    };
  }

  // Status row.
  const persistedText =
    persisted === 'loading…' ? 'loading…' : persisted === true ? 'yes' : 'no';
  body.push({
    tag: 'dl',
    children: [
      { tag: 'dt', text: 'Persistent' },
      { tag: 'dd', text: persistedText },
    ],
  });

  // Request persistence button — only when persisted === false (NOT loading,
  // NOT true). On `'loading…'` the button is suppressed too; the mounter
  // re-renders after the persisted Promise resolves and the button appears
  // then if applicable.
  if (persisted === false) {
    body.push({
      tag: 'button',
      attrs: {
        class: 'settings-card--destructive',
        'data-action': 'requestPersistence',
      },
      text: 'Request persistence',
    });
  }

  // Estimate row.
  const estimateText =
    estimateUsedMB === 'loading…' || estimateQuotaMB === 'loading…'
      ? 'loading…'
      : `Using ${estimateUsedMB} MB of ~${estimateQuotaMB} MB`;
  body.push({
    tag: 'dl',
    children: [
      { tag: 'dt', text: 'Storage' },
      { tag: 'dd', text: estimateText },
    ],
  });

  return {
    tag: 'section',
    attrs: {
      class: 'settings-card',
      'aria-labelledby': STORAGE_LABEL_ID,
    },
    children: body,
  };
}

/**
 * Build the Schedule card description (D-63, D-51).
 *
 * Mon/Sun radios share `name="weekStart"` so native browser semantics enforce
 * single-select. Each radio carries `data-action="setWeekStart"` so the
 * mounter wires a single change-handler that reads `evt.target.value` and
 * dispatches `apply({type:'setSetting', payload:{key:'weekStart', value}})`
 * (D-75 chokepoint discipline — never call `repo.putSetting` directly).
 *
 * @param {{ weekStart: 'mon'|'sun' }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildScheduleCard({ weekStart }) {
  /** @param {'mon'|'sun'} value */
  function radio(value, label) {
    /** @type {Record<string, string>} */
    const attrs = {
      type: 'radio',
      name: 'weekStart',
      value,
      'data-action': 'setWeekStart',
    };
    if (weekStart === value) attrs.checked = '';
    return {
      tag: 'label',
      children: [
        { tag: 'input', attrs },
        { tag: 'span', text: ` ${label}` },
      ],
    };
  }

  return {
    tag: 'section',
    attrs: {
      class: 'settings-card',
      'aria-labelledby': SCHEDULE_LABEL_ID,
    },
    children: [
      { tag: 'h2', attrs: { id: SCHEDULE_LABEL_ID }, text: 'Schedule' },
      {
        tag: 'fieldset',
        attrs: { class: 'settings-radio-group' },
        children: [
          { tag: 'legend', text: 'Week starts on' },
          radio('mon', 'Monday'),
          radio('sun', 'Sunday'),
        ],
      },
    ],
  };
}

/**
 * Build the Install card description (D-64, PWA-07).
 *
 * Three labeled subsections. No JS platform detection — user picks the
 * section that matches their device. Each subsection has its own `<h3>` so
 * screen-reader users navigate by heading level.
 *
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildInstallCard() {
  return {
    tag: 'section',
    attrs: {
      class: 'settings-card',
      'aria-labelledby': INSTALL_LABEL_ID,
    },
    children: [
      { tag: 'h2', attrs: { id: INSTALL_LABEL_ID }, text: 'Install' },
      {
        tag: 'section',
        attrs: { 'aria-labelledby': 'settings-install-ios' },
        children: [
          { tag: 'h3', attrs: { id: 'settings-install-ios' }, text: 'iOS Safari' },
          {
            tag: 'p',
            children: [
              { tag: 'span', text: 'Tap the Share button, then ' },
              { tag: 'strong', text: 'Add to Home Screen' },
              { tag: 'span', text: '.' },
            ],
          },
        ],
      },
      {
        tag: 'section',
        attrs: { 'aria-labelledby': 'settings-install-android' },
        children: [
          { tag: 'h3', attrs: { id: 'settings-install-android' }, text: 'Android Chrome' },
          {
            tag: 'p',
            children: [
              { tag: 'span', text: 'Open the menu, then ' },
              { tag: 'strong', text: 'Install app' },
              { tag: 'span', text: '.' },
            ],
          },
        ],
      },
      {
        tag: 'section',
        attrs: { 'aria-labelledby': 'settings-install-desktop' },
        children: [
          { tag: 'h3', attrs: { id: 'settings-install-desktop' }, text: 'Desktop browsers' },
          {
            tag: 'p',
            text: 'Look for the install icon in the URL bar, or use the browser menu.',
          },
        ],
      },
    ],
  };
}

/**
 * Build the Data card description (D-65, D-71, SETTINGS-03, EXPORT-08).
 *
 * Three sub-blocks:
 *   (a) Backup status — "Last backup: N days ago" (or "Never") read-only
 *       display row, plus export/import action buttons. If `shouldShowNag`
 *       is true, a dismissible nag banner appears at the top of this section
 *       (D-101, D-102 / EXPORT-08).
 *   (b) Undo last action — button + preview text. When `hasUndoToken=false`
 *       the button is disabled and preview reads `"Nothing to undo."`.
 *       When `hasUndoToken=true` the button is enabled and preview reads
 *       `"Last: <lastEvent> · <relativeTime>"` (D-71).
 *   (c) Reset data — destructive-red button wrapped in
 *       `.settings-card--destructive`. The Reset confirm string (D-67) lives
 *       in the mounter, not the builder.
 *
 * All buttons carry `aria-label` for the verb only (D-79); the visible
 * text mirrors the label so sighted users see the same affordance.
 *
 * The `<input type="file">` for JSON import carries `data-action="importJSON"`
 * so the mounter can locate it via querySelector for `change` event wiring
 * (mount.js wires only `click` for data-action; file inputs need `change`).
 *
 * @param {{
 *   lastEvent: string,
 *   hasUndoToken: boolean,
 *   relativeTime: string,
 *   lastBackupDays?: number|null,
 *   shouldShowNag?: boolean,
 * }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildDataCard({
  lastEvent,
  hasUndoToken,
  relativeTime,
  lastBackupDays = null,
  shouldShowNag = false,
}) {
  /** @type {object[]} */
  const cardChildren = [
    { tag: 'h2', attrs: { id: DATA_LABEL_ID }, text: 'Data' },
  ];

  // --- Backup section (SETTINGS-03, EXPORT-08) ---

  /** @type {object[]} */
  const backupChildren = [];

  // Nag banner (D-101, D-102) — only shown when ≥7 days since last backup
  // and dismissal has expired.
  if (shouldShowNag) {
    backupChildren.push({
      tag: 'div',
      attrs: { class: 'nag-banner', role: 'alert' },
      children: [
        {
          tag: 'span',
          text:
            lastBackupDays === null
              ? 'No backup found. Export your data now.'
              : `Last backup: ${lastBackupDays} days ago. Export your data now.`,
        },
        {
          tag: 'button',
          attrs: {
            'data-action': 'dismissNag',
            'aria-label': 'Dismiss backup nag',
            class: 'nag-banner__dismiss',
            title: 'Dismiss',
          },
          text: '×',
        },
      ],
    });
  }

  // Last backup status row.
  backupChildren.push({
    tag: 'dl',
    children: [
      { tag: 'dt', text: 'Last backup' },
      {
        tag: 'dd',
        text:
          lastBackupDays === null ? 'Never' : `${lastBackupDays} days ago`,
      },
    ],
  });

  // Export buttons.
  backupChildren.push({
    tag: 'button',
    attrs: {
      'data-action': 'exportJSON',
      'aria-label': 'Export JSON backup',
      class: 'settings-export-btn',
    },
    text: 'Export JSON',
  });
  backupChildren.push({
    tag: 'button',
    attrs: {
      'data-action': 'exportCSV',
      'aria-label': 'Export CSV',
      class: 'settings-export-btn',
    },
    text: 'Export CSV',
  });

  // Import file input — carries data-action so the mounter can locate it
  // via `[data-action="importJSON"]` and attach a `change` listener.
  backupChildren.push({
    tag: 'input',
    attrs: {
      type: 'file',
      accept: 'application/json',
      'data-action': 'importJSON',
      id: 'import-file-input',
      'aria-label': 'Import JSON backup file',
    },
  });

  cardChildren.push({
    tag: 'div',
    attrs: { class: 'settings-data-backup' },
    children: backupChildren,
  });

  // --- Undo section ---

  /** @type {object[]} */
  const undoChildren = [];
  if (hasUndoToken) {
    undoChildren.push({
      tag: 'p',
      text: `Last: ${lastEvent} · ${relativeTime}`,
    });
    undoChildren.push({
      tag: 'button',
      attrs: {
        'data-action': 'undoLastAction',
        'aria-label': 'Undo last action',
      },
      text: 'Undo last action',
    });
  } else {
    undoChildren.push({ tag: 'p', text: 'Nothing to undo.' });
    undoChildren.push({
      tag: 'button',
      attrs: {
        'data-action': 'undoLastAction',
        'aria-label': 'Undo last action',
        disabled: '',
      },
      text: 'Undo last action',
    });
  }

  cardChildren.push({
    tag: 'div',
    attrs: { class: 'settings-data-undo' },
    children: undoChildren,
  });

  // --- Reset section ---

  cardChildren.push({
    tag: 'div',
    attrs: { class: 'settings-card--destructive' },
    children: [
      {
        tag: 'button',
        attrs: {
          'data-action': 'resetData',
          'aria-label': 'Reset data',
        },
        text: 'Reset data',
      },
      { tag: 'p', text: 'This deletes everything stored on this device.' },
    ],
  });

  return {
    tag: 'section',
    attrs: {
      class: 'settings-card',
      'aria-labelledby': DATA_LABEL_ID,
    },
    children: cardChildren,
  };
}

/**
 * Build the About card description (D-66).
 *
 * 4 rows in locked order: App version → Schema version → Cache name →
 * Service worker. Inputs accept the literal `'loading…'` for Pattern S5
 * (the mounter mutates `dd.textContent` after async resolution).
 *
 * @param {{ appVersion: string, schemaVersion: string, cacheName: string, swState: string }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildAboutCard({ appVersion, schemaVersion, cacheName, swState }) {
  return {
    tag: 'section',
    attrs: {
      class: 'settings-card',
      'aria-labelledby': ABOUT_LABEL_ID,
    },
    children: [
      { tag: 'h2', attrs: { id: ABOUT_LABEL_ID }, text: 'About' },
      {
        tag: 'dl',
        attrs: { class: 'settings-about' },
        children: [
          { tag: 'dt', text: 'App version' },
          { tag: 'dd', text: String(appVersion) },
          { tag: 'dt', text: 'Schema version' },
          { tag: 'dd', text: String(schemaVersion) },
          { tag: 'dt', text: 'Cache name' },
          { tag: 'dd', text: String(cacheName) },
          { tag: 'dt', text: 'Service worker' },
          { tag: 'dd', text: String(swState) },
        ],
      },
    ],
  };
}

/**
 * Build the Mastery card description (SETTINGS-01, MASTERY-01, D-86).
 *
 * Two rows:
 *   - Completion threshold: number input (min=1, max=100, default 90%) with
 *     `data-key="masteryThreshold"` and `data-action="setMasteryThreshold"`.
 *   - Rolling window: number input (min=1, max=365, default 70 days) with
 *     `data-key="masteryWindow"` and `data-action="setMasteryWindow"`.
 *
 * HTML input min/max attributes restrict invalid range per T-04-07 threat
 * mitigation. The builder is pure (no DOM access, no imports from apply.js).
 * Change events are wired by the mounter.
 *
 * @param {{ masteryThreshold?: number|null, masteryWindow?: number|null }} args
 * @returns {{ tag: string, attrs: object, children: object[] }}
 */
export function buildMasteryCard({ masteryThreshold, masteryWindow } = {}) {
  const thresholdValue = masteryThreshold != null ? masteryThreshold : 90;
  const windowValue = masteryWindow != null ? masteryWindow : 70;

  return {
    tag: 'section',
    attrs: {
      class: 'settings-card',
      'aria-labelledby': MASTERY_LABEL_ID,
      'data-card': 'mastery',
    },
    children: [
      { tag: 'h2', attrs: { id: MASTERY_LABEL_ID }, text: 'Mastery' },
      {
        tag: 'div',
        attrs: { class: 'mastery-row' },
        children: [
          {
            tag: 'label',
            attrs: { for: 'mastery-threshold-input' },
            text: 'Completion threshold',
          },
          {
            tag: 'div',
            attrs: { class: 'mastery-input-group' },
            children: [
              {
                tag: 'input',
                attrs: {
                  id: 'mastery-threshold-input',
                  type: 'number',
                  min: '1',
                  max: '100',
                  step: '1',
                  value: String(thresholdValue),
                  'data-key': 'masteryThreshold',
                  'data-action': 'setMasteryThreshold',
                  'aria-label': 'Mastery completion threshold %',
                },
              },
              { tag: 'span', text: '%' },
            ],
          },
        ],
      },
      {
        tag: 'div',
        attrs: { class: 'mastery-row' },
        children: [
          {
            tag: 'label',
            attrs: { for: 'mastery-window-input' },
            text: 'Rolling window',
          },
          {
            tag: 'div',
            attrs: { class: 'mastery-input-group' },
            children: [
              {
                tag: 'input',
                attrs: {
                  id: 'mastery-window-input',
                  type: 'number',
                  min: '1',
                  max: '365',
                  step: '1',
                  value: String(windowValue),
                  'data-key': 'masteryWindow',
                  'data-action': 'setMasteryWindow',
                  'aria-label': 'Mastery rolling window days',
                },
              },
              { tag: 'span', text: 'days' },
            ],
          },
        ],
      },
    ],
  };
}
