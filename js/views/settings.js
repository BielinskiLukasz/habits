/**
 * @file Settings view mounter — composes 5 cards, subscribes to store.notify
 * for live refresh, wires actions (D-60..D-67, D-72, D-75, D-79).
 *
 * Wires the pure description-tree builders (`js/views/settings/builders.js`)
 * into real DOM via `mount()` (D-77). `mountSettings(parent, {repo, store})`
 * performs the initial render, subscribes to the store's chokepoint notify
 * for re-rendering the reactive cards (Schedule + Data) on any (same-tab or
 * cross-tab) mutation, and returns an `unmount()` closure that drops the
 * subscription + clears the panel.
 *
 * Card composition + reactivity:
 *   - Storage card (D-62): async-loaded via Pattern S5. Initial mount renders
 *     `'loading…'`; `loadStorageState()` resolves persisted + estimate and
 *     mutates `dd.textContent` directly.
 *   - Schedule card (D-63): reads `store.getCachedWeekStart()` at mount;
 *     re-renders on notify (`setSetting` broadcast keys.key === 'weekStart'
 *     triggers cache refresh BEFORE this callback fires per D-72).
 *   - Install card (D-64): static, no reactivity.
 *   - Data card (D-65): reads `meta.undoToken` + `repo.getEvent(token)` at
 *     mount; re-renders on every notify (any mutation may have replaced the
 *     most-recent event).
 *   - About card (D-66): mostly static (APP_VERSION); async-loads schemaVersion
 *     via Pattern S5 + cache-name via `caches.keys()` + SW state via
 *     `navigator.serviceWorker.controller`.
 *
 * Action closures (D-75 chokepoint discipline — Schedule writes through
 * apply, NEVER directly to the repo):
 *
 *   - requestPersistence → navigator.storage.persist(); on `false` show
 *     showErrorToast("Browser declined persistence — try clearing site data
 *     or installing").
 *   - setWeekStart → apply({type:'setSetting', payload:{key:'weekStart',
 *     value: evt.currentTarget.value}}).
 *   - undoLastAction → undo(); catch shows showErrorToast.
 *   - resetData → confirm(D-67 prose) → indexedDB.deleteDatabase('habits')
 *     → location.reload().
 *
 * The Reset-data click handler uses the D-67 SETTINGS-flavored prose —
 * intentionally distinct from D-06 verbatim diagnostics text (which stays
 * in `js/views/diagnostics.js`).
 *
 * Card-swap helper:
 *   `replaceCardChildren(cardEl, newDesc, actions)` removes existing children
 *   via a loop and re-mounts. NO `.innerHTML` (D-78).
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` family — D-78 grep gate.
 *   - Direct repo.putSetting / repo.putHabit / repo.put* calls (Anti-Pattern 1).
 *   - `switch` on event-type (Anti-Pattern 4 — the chokepoint handles dispatch).
 */

import { mount } from '../util/mount.js';
import { apply } from '../state/apply.js';
import { undo } from '../state/undo.js';
import { showErrorToast } from './toast.js';
import { APP_VERSION } from '../util/version.js';
import { formatRelative } from '../util/date.js';
import {
  subscribe,
  getCachedWeekStart,
  getCachedSettings,
} from '../state/store.js';
import {
  buildStorageCard,
  buildScheduleCard,
  buildInstallCard,
  buildDataCard,
  buildAboutCard,
  buildMasteryCard,
} from './settings/builders.js';

/* D-67 SETTINGS-flavored Reset-data confirm prose — INTENTIONALLY distinct
 * from D-06 verbatim diagnostics text used in js/views/diagnostics.js. */
const RESET_CONFIRM_D67 =
  'This will delete all your habits and history. Cannot be undone. Continue?';

/** Singleton guards — second mountSettings call is idempotent-by-rerender. */
let _panelEl = null;
let _unsubStore = null;
/** Currently bound parent — used by the subscribe re-render. */
let _currentParent = null;
/** Currently bound deps. */
let _currentDeps = null;

/**
 * Clear every child of `el` without using `.innerHTML = ''` (D-78).
 *
 * @param {object} el
 * @returns {void}
 */
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Replace a card's children — used by the live-refresh path to swap a
 * single card's DOM without rebuilding the whole panel.
 *
 * @param {object} cardEl
 * @param {object} newDesc
 * @param {Record<string, Function>} actions
 */
function replaceCardChildren(cardEl, newDesc, actions) {
  // The new description includes a wrapper <section>; we only want its
  // children injected into the existing cardEl. Iterate desc.children.
  clearChildren(cardEl);
  // Apply any wrapper attrs (e.g. updated aria-labelledby) — defensive only.
  if (newDesc.attrs) {
    for (const [k, v] of Object.entries(newDesc.attrs)) {
      cardEl.setAttribute(k, String(v));
    }
  }
  for (const c of newDesc.children ?? []) {
    mount(c, cardEl, actions);
  }
}

/**
 * Compute the Storage card inputs from the current `navigator.storage`
 * state. Returns the initial-render snapshot; the mounter later mutates
 * `dd.textContent` directly when the async Promises resolve (Pattern S5).
 *
 * @returns {{ supported: boolean, persisted: boolean|string, estimateUsedMB: string, estimateQuotaMB: string }}
 */
function initialStorageSnapshot() {
  const supported =
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.persisted === 'function';
  if (!supported) {
    return {
      supported: false,
      persisted: 'unsupported',
      estimateUsedMB: 'unsupported',
      estimateQuotaMB: 'unsupported',
    };
  }
  return {
    supported: true,
    persisted: 'loading…',
    estimateUsedMB: 'loading…',
    estimateQuotaMB: 'loading…',
  };
}

/**
 * After Storage card mounts, resolve the async values + mutate the live
 * <dd> textContent. Pattern S5 — no full re-render.
 *
 * @param {object} cardEl
 */
function loadStorageStateAsync(cardEl) {
  if (typeof navigator === 'undefined') return;
  if (!navigator.storage || typeof navigator.storage.persisted !== 'function') return;

  // Find the two dd nodes inside the card. The first dd is "Persistent",
  // the second is "Storage".
  const dds = cardEl.querySelectorAll('dd');
  const persistedDd = dds[0];
  const estimateDd = dds[1];

  // persisted()
  navigator.storage
    .persisted()
    .then((value) => {
      if (persistedDd) persistedDd.textContent = value ? 'yes' : 'no';
    })
    .catch(() => {
      if (persistedDd) persistedDd.textContent = 'unknown';
    });

  // estimate()
  if (typeof navigator.storage.estimate === 'function') {
    navigator.storage
      .estimate()
      .then((est) => {
        if (estimateDd && est && typeof est.usage === 'number' && typeof est.quota === 'number') {
          const usedMB = (est.usage / 1_000_000).toFixed(1);
          const quotaMB = Math.round(est.quota / 1_000_000);
          estimateDd.textContent = `Using ${usedMB} MB of ~${quotaMB} MB`;
        }
      })
      .catch(() => {
        if (estimateDd) estimateDd.textContent = 'unknown';
      });
  }
}

/**
 * After About card mounts, resolve schemaVersion + cacheName + swState
 * (Pattern S5). Mutates the live <dd> textContent directly.
 *
 * @param {object} cardEl
 * @param {object} repo
 */
function loadAboutStateAsync(cardEl, repo) {
  const dds = cardEl.querySelectorAll('dd');
  // dd order: App version (already set) / Schema version / Cache name / SW.
  const schemaDd = dds[1];
  const cacheDd = dds[2];
  const swDd = dds[3];

  // Schema version (from settings store).
  if (repo && typeof repo.getSetting === 'function') {
    repo
      .getSetting('schemaVersion')
      .then((row) => {
        if (schemaDd) schemaDd.textContent = row?.value != null ? String(row.value) : 'n/a';
      })
      .catch(() => {
        if (schemaDd) schemaDd.textContent = 'n/a';
      });
  } else if (schemaDd) {
    schemaDd.textContent = 'n/a';
  }

  // Cache name (filter caches.keys() for /^habits-/).
  if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
    caches
      .keys()
      .then((keys) => {
        const match = keys.find((k) => /^habits-/.test(k));
        if (cacheDd) cacheDd.textContent = match || 'none';
      })
      .catch(() => {
        if (cacheDd) cacheDd.textContent = 'none';
      });
  } else if (cacheDd) {
    cacheDd.textContent = 'unsupported';
  }

  // SW state.
  if (swDd) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      swDd.textContent = 'unsupported';
    } else if (navigator.serviceWorker.controller) {
      swDd.textContent = 'controlled';
    } else {
      swDd.textContent = 'registered';
    }
  }
}

/**
 * Build the Data card description from current repo state. Synchronous —
 * the caller awaits the repo lookups outside this function.
 *
 * Branches on `eventRow.type` (D-72 notify-driven re-render):
 *   - 'markCompleted'   → "marked <name> complete"
 *   - 'markUncompleted' → "marked <name> uncomplete"
 *   - 'setSetting'      → "changed <key> to <value>"
 *   - fallback          → raw event type slug (never reaches the "(habit)" path)
 *
 * @param {object|undefined} eventRow
 * @param {string|undefined} habitName
 * @returns {object} description
 */
function buildDataCardFromState(eventRow, habitName) {
  if (!eventRow) {
    return buildDataCard({ lastEvent: '', hasUndoToken: false, relativeTime: '' });
  }
  const relativeTime = formatRelative(eventRow.at);
  let lastEvent;
  if (eventRow.type === 'markCompleted') {
    lastEvent = 'marked ' + (habitName ?? '(habit)') + ' complete';
  } else if (eventRow.type === 'markUncompleted') {
    lastEvent = 'marked ' + (habitName ?? '(habit)') + ' uncomplete';
  } else if (eventRow.type === 'setSetting') {
    lastEvent = 'changed ' + eventRow.payload.key + ' to ' + eventRow.payload.value;
  } else {
    lastEvent = eventRow.type;
  }
  return buildDataCard({
    lastEvent,
    hasUndoToken: true,
    relativeTime,
  });
}

/**
 * Read the current Data card inputs from repo + cache.
 *
 * @param {object} repo
 * @param {object} store
 * @returns {Promise<{ eventRow: object|undefined, habitName: string|undefined }>}
 */
async function readDataCardInputs(repo, store) {
  const token = await repo.getMeta('undoToken');
  if (!token) return { eventRow: undefined, habitName: undefined };
  const eventRow = await repo.getEvent(token);
  if (!eventRow) return { eventRow: undefined, habitName: undefined };
  const habitId = eventRow.payload?.habitId;
  if (!habitId) return { eventRow, habitName: undefined };
  // Read from cache first (canonical post-notify per Pitfall 2), fall back to repo.
  const cached = store.getCachedHabits
    ? store.getCachedHabits().find((h) => h.id === habitId)
    : undefined;
  if (cached) return { eventRow, habitName: cached.name };
  const habit = await repo.getHabit(habitId);
  return { eventRow, habitName: habit?.name };
}

/**
 * Build the global `actions` map shared by every card. Uses the
 * module-scope `_currentDeps` so the live-refresh subscribe path uses the
 * same closures.
 *
 * @returns {Record<string, Function>}
 */
function buildActions() {
  return {
    /**
     * navigator.storage.persist() retry (D-62). Shows an error toast when
     * the browser declines.
     */
    requestPersistence: async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.storage ||
        typeof navigator.storage.persist !== 'function'
      ) {
        showErrorToast('Storage persistence not supported');
        return;
      }
      try {
        const ok = await navigator.storage.persist();
        if (!ok) {
          showErrorToast(
            'Browser declined persistence — try clearing site data or installing',
          );
        }
        // Refresh the Storage card status.
        if (_panelEl) {
          const storageCard = _panelEl.querySelector('.settings-card');
          if (storageCard) loadStorageStateAsync(storageCard);
        }
      } catch (_e) {
        showErrorToast("Couldn't request persistence");
      }
    },

    /**
     * Mon/Sun radio change → chokepoint write (D-75). Reads the value from
     * the clicked input element; dispatches through `apply()`.
     */
    setWeekStart: (evt) => {
      const value = evt?.currentTarget?.value ?? evt?.target?.value;
      if (value !== 'mon' && value !== 'sun') return;
      apply({ type: 'setSetting', payload: { key: 'weekStart', value } }).catch(
        () => {
          showErrorToast("Couldn't change week start — try again");
        },
      );
    },

    /**
     * Undo button (D-65). When `undo()` returns null (nothing to undo) the
     * button was already disabled, so this is a no-op. When `undo()` throws,
     * surface via showErrorToast.
     */
    undoLastAction: async () => {
      try {
        const r = await undo();
        if (r === null) return;
      } catch (_e) {
        showErrorToast("Couldn't undo — try again");
      }
    },

    /**
     * Reset data (D-65, D-67). The confirm string is the SETTINGS prose —
     * intentionally distinct from D-06 verbatim diagnostics text.
     */
    resetData: async () => {
      const confirmed = globalThis.confirm
        ? globalThis.confirm(RESET_CONFIRM_D67)
        : false;
      if (!confirmed) return;
      try {
        await new Promise((resolve, reject) => {
          const req = globalThis.indexedDB.deleteDatabase('habits');
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => resolve();
        });
      } catch (_e) {
        // Swallow — proceed with reload regardless.
      }
      if (globalThis.location && typeof globalThis.location.reload === 'function') {
        globalThis.location.reload();
      }
    },

    /**
     * Mastery threshold number input change (SETTINGS-01, D-86). Reads the
     * integer value from the input and dispatches through apply().
     * Wired as a `change` listener by `wireMasteryInputs()` after mount.
     */
    setMasteryThreshold: (evt) => {
      const raw = evt?.currentTarget?.value ?? evt?.target?.value;
      const value = parseInt(raw, 10);
      if (isNaN(value)) return;
      apply({ type: 'setMasteryThreshold', payload: { value } }).catch(() => {
        showErrorToast("Couldn't change mastery threshold — try again");
      });
    },

    /**
     * Mastery window number input change (SETTINGS-01, D-86). Reads the
     * integer value from the input and dispatches through apply().
     * Wired as a `change` listener by `wireMasteryInputs()` after mount.
     */
    setMasteryWindow: (evt) => {
      const raw = evt?.currentTarget?.value ?? evt?.target?.value;
      const value = parseInt(raw, 10);
      if (isNaN(value)) return;
      apply({ type: 'setMasteryWindow', payload: { value } }).catch(() => {
        showErrorToast("Couldn't change mastery window — try again");
      });
    },
  };
}

/**
 * Wire `change` event listeners on the mastery threshold + window number
 * inputs. Called after the mastery card is mounted — mount.js wires only
 * `click` via `data-action`; number inputs need `change` (SETTINGS-01).
 *
 * Finds inputs by `data-key` attribute within `cardEl`, so this function
 * is safe to call on re-renders by passing the fresh card element.
 *
 * @param {object} cardEl — the mastery card element (section[data-card="mastery"])
 * @param {Record<string, Function>} actions — the shared actions map
 */
function wireMasteryInputs(cardEl, actions) {
  if (!cardEl) return;
  const thresholdInput = cardEl.querySelector('[data-key="masteryThreshold"]');
  if (thresholdInput && typeof actions.setMasteryThreshold === 'function') {
    thresholdInput.addEventListener('change', actions.setMasteryThreshold);
  }
  const windowInput = cardEl.querySelector('[data-key="masteryWindow"]');
  if (windowInput && typeof actions.setMasteryWindow === 'function') {
    windowInput.addEventListener('change', actions.setMasteryWindow);
  }
}

/**
 * Refresh the Data card + Schedule card after a notify event. Both cards
 * read from cache (canonical post-notify state — Pitfall 2 / D-72). The
 * other three cards are static or async-resolved once at mount and don't
 * need to participate in the live-refresh loop.
 */
async function refreshLiveCards() {
  if (!_panelEl || !_currentDeps) return;
  const { repo, store } = _currentDeps;
  const actions = buildActions();
  const cards = _panelEl.querySelectorAll('.settings-card');
  // Order: Storage[0] / Schedule[1] / Install[2] / Data[3] / About[4].
  const scheduleCard = cards[1];
  const dataCard = cards[3];

  if (scheduleCard) {
    const newSchedule = buildScheduleCard({
      weekStart: store.getCachedWeekStart ? store.getCachedWeekStart() : 'mon',
    });
    replaceCardChildren(scheduleCard, newSchedule, actions);
  }

  if (dataCard) {
    const { eventRow, habitName } = await readDataCardInputs(repo, store);
    const newData = buildDataCardFromState(eventRow, habitName);
    replaceCardChildren(dataCard, newData, actions);
  }
}

/**
 * Mount the Settings panel into `parent`. Subscribes to the store's notify
 * channel so any mutation (same-tab or cross-tab) re-renders the reactive
 * cards (Schedule + Data per D-72). Returns an `unmount()` closure that
 * drops the subscription and clears the panel.
 *
 * Idempotent: a second call without unmount re-renders against the live
 * parent without registering a duplicate subscription.
 *
 * @param {object} parent
 * @param {{ repo: object, store: object }} deps
 * @returns {() => void} unmount
 */
export function mountSettings(parent, deps) {
  if (_panelEl) {
    // Already mounted — just re-render the live cards. The existing parent
    // stays bound; callers that need to switch parents must unmount first.
    _currentDeps = deps;
    refreshLiveCards();
    return _unmount;
  }

  const { repo, store } = deps;
  _currentParent = parent;
  _currentDeps = deps;

  // Build the panel wrapper.
  _panelEl = parent.ownerDocument.createElement('section');
  _panelEl.setAttribute('class', 'settings-panel');

  // H1 for focus-on-route-change (D-79) — the router already focuses the
  // h1 in `index.html`, so we don't need to add another. We DO append a
  // visible top heading inside the panel for screen-reader context.
  // The index.html `<section data-route="settings">` itself carries an
  // <h1>; settings.js mounts INSIDE that section so the h1 is preserved.
  // We just append the cards.

  const actions = buildActions();

  // Storage card.
  const storageInputs = initialStorageSnapshot();
  const storageDesc = buildStorageCard(storageInputs);
  const storageCardEl = mount(storageDesc, _panelEl, actions);

  // Schedule card.
  const weekStart = (store.getCachedWeekStart
    ? store.getCachedWeekStart()
    : 'mon');
  const scheduleDesc = buildScheduleCard({ weekStart });
  mount(scheduleDesc, _panelEl, actions);

  // Install card.
  mount(buildInstallCard(), _panelEl, actions);

  // Data card — synchronous initial render with hasUndoToken=false; the
  // async repo read fills it in via refreshLiveCards() below.
  mount(
    buildDataCard({ lastEvent: '', hasUndoToken: false, relativeTime: '' }),
    _panelEl,
    actions,
  );

  // About card.
  const aboutDesc = buildAboutCard({
    appVersion: APP_VERSION,
    schemaVersion: 'loading…',
    cacheName: 'loading…',
    swState: 'loading…',
  });
  const aboutCardEl = mount(aboutDesc, _panelEl, actions);

  // Mastery card (SETTINGS-01, D-86) — reads threshold + window from cache;
  // falls back to defaults (90%, 70 days) when no override has been set.
  const cachedSettings = store.getCachedSettings ? store.getCachedSettings() : {};
  const masteryDesc = buildMasteryCard({
    masteryThreshold: cachedSettings.masteryThreshold ?? null,
    masteryWindow: cachedSettings.masteryWindow ?? null,
  });
  const masteryCardEl = mount(masteryDesc, _panelEl, actions);

  parent.appendChild(_panelEl);

  // Wire change listeners on mastery inputs (mount.js wires only click;
  // number inputs fire change, not click).
  if (masteryCardEl) {
    wireMasteryInputs(masteryCardEl, actions);
  }

  // Pattern S5 async-loaders (mutate dd.textContent after Promise resolves).
  if (storageInputs.supported && storageCardEl) {
    loadStorageStateAsync(storageCardEl);
  }
  if (aboutCardEl) {
    loadAboutStateAsync(aboutCardEl, repo);
  }

  // Initial async fill of the Data card.
  refreshLiveCards();

  // Subscribe to notify for live-refresh (D-72). The subscriber is async-
  // tolerant: we fire-and-forget the refresh; cache is already reconciled
  // before the subscriber fan-out runs (notify awaits refreshHydratedKeys
  // first per Pitfall 2).
  _unsubStore = subscribe(() => {
    refreshLiveCards();
  });

  return _unmount;
}

/**
 * Unmount closure shared across mount calls. Cleans up the subscription +
 * removes the panel from its parent.
 *
 * @returns {void}
 */
function _unmount() {
  if (_unsubStore) {
    _unsubStore();
    _unsubStore = null;
  }
  if (_panelEl && _currentParent) {
    try {
      _currentParent.removeChild(_panelEl);
    } catch (_e) {
      /* swallow — parent may have been re-parented */
    }
  }
  _panelEl = null;
  _currentParent = null;
  _currentDeps = null;
}

/**
 * Test-only: force-clear module-level state so fresh-import tests start
 * from a pristine instance. Mirrors `_resetTodayForTest` / `_resetStoreForTest`.
 *
 * @returns {void}
 */
export function _resetSettingsForTest() {
  if (_unsubStore) {
    try { _unsubStore(); } catch (_e) {}
    _unsubStore = null;
  }
  _panelEl = null;
  _currentParent = null;
  _currentDeps = null;
}
