/**
 * @file Integration tests for the Settings backup nag banner UI (Plan 05-06,
 * EXPORT-08, D-101, D-102).
 *
 * Tests cover the full nag visibility and dismissal lifecycle via the
 * Settings view:
 *
 *   - No lastBackupDate → nag not shown
 *   - lastBackupDate 7+ days ago, not dismissed → nag shown
 *   - lastBackupDate 7+ days ago, dismissed <7 days ago → nag not shown
 *   - Click dismissNag button → nag hidden, localStorage updated
 *   - After 7 days of dismissal → nag reappears
 *   - After export (lastBackupDate = today) → nag hidden (days = 0)
 *   - Reset-data clears nag:lastDismissed from localStorage
 *   - Nag persists across reload (localStorage state survives mount-unmount)
 *
 * Strategy: inject fake-repo, fake-localStorage via configureBackupNag(),
 * use fake-document for DOM, and call refreshLiveCards() via store.notify()
 * to drive the reactive re-render (mirrors settings.dataCard.test.js pattern).
 *
 * Framework: node --test (D-23); no DOM polyfill.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { configureBackupNag } from '../../js/io/backup-nag.js';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as YYYY-MM-DD using local calendar (same as date.js formatLocalYMD).
 * @param {Date} d
 * @returns {string}
 */
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's YYYY-MM-DD string (local calendar). */
function todayStr() {
  return ymd(new Date());
}

/**
 * Return YYYY-MM-DD for N calendar days before today.
 * @param {number} n
 * @returns {string}
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

// ---------------------------------------------------------------------------
// Fake localStorage
// ---------------------------------------------------------------------------

/**
 * Create an in-memory fake localStorage.
 * @returns {{ getItem: Function, setItem: Function, removeItem: Function, clear: Function }}
 */
function createFakeLocalStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    has(key) { return store.has(key); },
  };
}

// ---------------------------------------------------------------------------
// Minimal fake DOM (mirrors settings.dataCard.test.js)
// ---------------------------------------------------------------------------

function createFakeDocument() {
  /** @type {object} */
  let doc;
  function makeElement(tag) {
    /** @type {Record<string, string>} */
    const attributes = {};
    /** @type {Map<string, Set<Function>>} */
    const listeners = new Map();
    /** @type {Array<object>} */
    const children = [];
    /** @type {string[]} */
    const classes = [];
    /** @type {object|null} */
    let parentNode = null;
    function syncClassFromAttr() {
      const attrClass = attributes.class || '';
      classes.length = 0;
      for (const c of attrClass.split(/\s+/).filter(Boolean)) classes.push(c);
    }
    const el = {
      tagName: String(tag).toUpperCase(),
      textContent: '',
      get children() { return children; },
      get firstChild() { return children[0]; },
      get parentNode() { return parentNode; },
      _setParent(p) { parentNode = p; },
      get ownerDocument() { return doc; },
      _listeners: listeners,
      appendChild(node) {
        children.push(node);
        if (node && typeof node._setParent === 'function') node._setParent(el);
        return node;
      },
      removeChild(node) {
        const idx = children.indexOf(node);
        if (idx >= 0) children.splice(idx, 1);
        if (node && typeof node._setParent === 'function') node._setParent(null);
        return node;
      },
      remove() {
        if (parentNode && typeof parentNode.removeChild === 'function') {
          parentNode.removeChild(el);
        }
      },
      setAttribute(k, v) {
        attributes[k] = String(v);
        if (k === 'class') syncClassFromAttr();
      },
      getAttribute(k) { return attributes[k]; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attributes, k); },
      removeAttribute(k) { delete attributes[k]; },
      get className() { return attributes.class || ''; },
      set className(v) {
        attributes.class = String(v);
        syncClassFromAttr();
      },
      classList: {
        add(c) {
          if (!classes.includes(c)) classes.push(c);
          attributes.class = classes.join(' ');
        },
        remove(c) {
          const idx = classes.indexOf(c);
          if (idx >= 0) classes.splice(idx, 1);
          attributes.class = classes.join(' ');
        },
        contains(c) { return classes.includes(c); },
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        const set = listeners.get(type);
        if (set) set.delete(fn);
      },
      click() {
        const set = listeners.get('click');
        if (!set) return;
        for (const fn of set) fn({ type: 'click', currentTarget: el, target: el });
      },
      get value() { return attributes.value; },
      set value(v) { attributes.value = String(v); },
      querySelector(selector) {
        return querySelectorWalk(el, selector);
      },
      querySelectorAll(selector) {
        return querySelectorAllWalk(el, selector);
      },
      closest(selector) {
        let cur = el;
        while (cur) {
          if (matchesSelector(cur, selector)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      focus() {},
    };
    return el;
  }

  function matchesSelector(el, selector) {
    if (!el || !selector) return false;
    selector = selector.trim();
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return el.classList && el.classList.contains(cls);
    }
    const attrMatch = selector.match(/^\[([\w-]+)(?:=['"]?([^'"\]]*)['"]?)?\]$/);
    if (attrMatch) {
      const [, key, val] = attrMatch;
      const got = el.getAttribute ? el.getAttribute(key) : undefined;
      if (val === undefined) return got !== undefined && got !== null;
      return got === val;
    }
    return el.tagName === selector.toUpperCase();
  }

  function querySelectorWalk(root, selector) {
    const queue = [...(root.children || [])];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (matchesSelector(cur, selector)) return cur;
      if (cur.children) for (const c of cur.children) queue.push(c);
    }
    return null;
  }

  function querySelectorAllWalk(root, selector) {
    /** @type {object[]} */
    const out = [];
    const queue = [...(root.children || [])];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (matchesSelector(cur, selector)) out.push(cur);
      if (cur.children) for (const c of cur.children) queue.push(c);
    }
    return out;
  }

  doc = {
    createElement(tag) { return makeElement(tag); },
    createTextNode(text) {
      return { nodeType: 3, nodeValue: String(text), _setParent() {} };
    },
  };
  const body = makeElement('section');
  body.setAttribute('data-route', 'settings');
  return { document: doc, body };
}

// ---------------------------------------------------------------------------
// Module import helpers
// ---------------------------------------------------------------------------

const origDocument = globalThis.document;
const origLocation = globalThis.location;
const origLocalStorage = globalThis.localStorage;

/** @type {{ document: object, body: object }|null} */
let _ambientDoc = null;

function setAmbientDoc(bundle) {
  _ambientDoc = bundle;
}

beforeEach(() => {
  _ambientDoc = null;
  globalThis.document = {
    get body() { return _ambientDoc?.body; },
    createElement(tag) { return _ambientDoc?.document.createElement(tag); },
    createTextNode(t) { return _ambientDoc?.document.createTextNode(t); },
  };
  try {
    globalThis.location = { reload: () => {} };
  } catch (_e) {
    Object.defineProperty(globalThis, 'location', {
      value: { reload: () => {} },
      configurable: true,
      writable: true,
    });
  }
});

afterEach(() => {
  // Reset backup-nag DI so each test starts clean.
  configureBackupNag({ repo: null, localStorage: null, today: null });
  globalThis.document = origDocument;
  if (origLocation) {
    try {
      globalThis.location = origLocation;
    } catch (_e) {
      Object.defineProperty(globalThis, 'location', {
        value: origLocation,
        configurable: true,
        writable: true,
      });
    }
  }
  _ambientDoc = null;
});

/**
 * Fresh-import all relevant modules (cache-busted via query-string) so each
 * test starts with isolated singleton state (mirrors settings.dataCard.test.js).
 */
async function freshAll() {
  const [store, applyMod, undoMod, settingsMod, toastMod] = await Promise.all([
    import('../../js/state/store.js'),
    import('../../js/state/apply.js'),
    import('../../js/state/undo.js'),
    import('../../js/views/settings.js'),
    import('../../js/views/toast.js'),
  ]);
  store._resetStoreForTest();
  settingsMod._resetSettingsForTest();
  toastMod._resetToastForTest();
  return { store, applyMod, undoMod, settingsMod, toastMod };
}

function wire({ store, applyMod, undoMod, repo }) {
  store.configureStore({ repo });
  applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
  undoMod.configureUndo({ repo, apply: applyMod.apply });
}

/**
 * Wait for async re-renders: two setTimeout(0) ticks settle the microtask
 * queue enough for fire-and-forget refreshLiveCards() to complete.
 */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Settings backup nag — visibility based on lastBackupDate', () => {
  test('Test 1: nag not shown when no lastBackupDate setting', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    wire({ store, applyMod, undoMod, repo });
    // No lastBackupDate row in repo; configure backup-nag to use fake LS + today
    configureBackupNag({ repo, localStorage: fakeLS, today: todayStr() });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    const nagBanner = body.querySelector('.nag-banner');
    assert.equal(nagBanner, null, 'nag-banner should not be rendered when no backup date');
  });

  test('Test 2: nag shown when lastBackupDate is 7+ days ago and not dismissed', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();
    // Seed the lastBackupDate setting 7 days ago
    await repo.putSetting({ key: 'lastBackupDate', value: daysAgo(7) });
    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    const nagBanner = body.querySelector('.nag-banner');
    assert.ok(nagBanner, 'nag-banner should be shown when backup is 7+ days old');
  });

  test('Test 3: nag not shown when backup is 7+ days old but dismissed <7 days ago', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();
    await repo.putSetting({ key: 'lastBackupDate', value: daysAgo(10) });
    // Dismissed 3 days ago — has not yet reached the 7-day reappearance threshold
    fakeLS.setItem('nag:lastDismissed', daysAgo(3));
    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    const nagBanner = body.querySelector('.nag-banner');
    assert.equal(nagBanner, null, 'nag-banner should be hidden when dismissed within 7 days');
  });

  test('Test 4: nag reappears when dismissal was >7 days ago', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();
    await repo.putSetting({ key: 'lastBackupDate', value: daysAgo(14) });
    // Dismissed 8 days ago — past the 7-day reappearance window
    fakeLS.setItem('nag:lastDismissed', daysAgo(8));
    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    const nagBanner = body.querySelector('.nag-banner');
    assert.ok(nagBanner, 'nag-banner should reappear after 7 days of dismissal');
  });
});

describe('Settings backup nag — dismiss button', () => {
  test('Test 5: click dismissNag button → nag hidden and localStorage updated', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();
    await repo.putSetting({ key: 'lastBackupDate', value: daysAgo(7) });
    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    // Nag should be visible before dismissal
    const nagBefore = body.querySelector('.nag-banner');
    assert.ok(nagBefore, 'nag should be visible before click');

    // Find and click the dismiss button
    const dismissBtn = body.querySelector('[data-action="dismissNag"]');
    assert.ok(dismissBtn, 'dismiss button must exist inside nag-banner');
    dismissBtn.click();
    await settle();

    // After dismissal, localStorage should record today and nag should be gone
    const stored = fakeLS.getItem('nag:lastDismissed');
    assert.equal(stored, today, 'localStorage nag:lastDismissed should be set to today');

    const nagAfter = body.querySelector('.nag-banner');
    assert.equal(nagAfter, null, 'nag-banner should be hidden after dismiss click');
  });
});

describe('Settings backup nag — export clears nag', () => {
  test('Test 6: after lastBackupDate updated to today, nag disappears on refresh', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();
    // Start: backup is 7 days old — nag should show
    await repo.putSetting({ key: 'lastBackupDate', value: daysAgo(7) });
    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    const nagBefore = body.querySelector('.nag-banner');
    assert.ok(nagBefore, 'nag visible before export');

    // Simulate export: update lastBackupDate to today via apply + store.notify
    await repo.putSetting({ key: 'lastBackupDate', value: today });
    // Force store notify to trigger refresh
    await store.notify({ event: 'setSetting', keys: { key: 'lastBackupDate' } });
    await settle();

    const nagAfter = body.querySelector('.nag-banner');
    assert.equal(nagAfter, null, 'nag should disappear after lastBackupDate updated to today');
  });
});

describe('Settings backup nag — Reset-data clears nag:lastDismissed', () => {
  test('Test 7: Reset-data action calls localStorage.removeItem("nag:lastDismissed")', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();

    // Seed dismissal state
    fakeLS.setItem('nag:lastDismissed', daysAgo(3));

    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    // Wire fake globalThis.localStorage so settings.js resetData uses it
    const origGlobalLS = globalThis.localStorage;
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        value: fakeLS,
        configurable: true,
        writable: true,
      });
    } catch (_e) {
      globalThis.localStorage = fakeLS;
    }

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    settingsMod.mountSettings(body, { repo, store });
    await settle();

    // Simulate resetData confirm + IDB delete (fake IDB via fake-repo, no real IDB)
    // We need to stub confirm to return true + indexedDB to return a no-op request
    const origConfirm = globalThis.confirm;
    const origIndexedDB = globalThis.indexedDB;
    try {
      globalThis.confirm = () => true;
      globalThis.indexedDB = {
        deleteDatabase() {
          return {
            set onsuccess(fn) { fn(); },
            set onerror(_fn) {},
            set onblocked(_fn) {},
          };
        },
      };

      // Trigger resetData action by finding and clicking the reset button
      const resetBtn = body.querySelector('[data-action="resetData"]');
      assert.ok(resetBtn, 'reset button must exist');
      resetBtn.click();
      await settle();

      // nag:lastDismissed should have been cleared
      const stored = fakeLS.getItem('nag:lastDismissed');
      assert.equal(stored, null, 'nag:lastDismissed should be cleared after Reset-data');
    } finally {
      globalThis.confirm = origConfirm;
      globalThis.indexedDB = origIndexedDB;
      // Restore globalThis.localStorage
      try {
        Object.defineProperty(globalThis, 'localStorage', {
          value: origGlobalLS,
          configurable: true,
          writable: true,
        });
      } catch (_e) {
        globalThis.localStorage = origGlobalLS;
      }
    }
  });
});

describe('Settings backup nag — localStorage persistence across remount', () => {
  test('Test 8: dismissed nag state persists across Settings unmount and remount', async () => {
    // Simulate: dismiss nag on first mount, unmount, remount — nag should
    // remain hidden because localStorage is still set from the first session.
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    const fakeLS = createFakeLocalStorage();
    const today = todayStr();
    await repo.putSetting({ key: 'lastBackupDate', value: daysAgo(7) });
    wire({ store, applyMod, undoMod, repo });
    configureBackupNag({ repo, localStorage: fakeLS, today });

    await store.hydrate();
    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    // First mount — nag visible
    const unmount = settingsMod.mountSettings(body, { repo, store });
    await settle();
    assert.ok(body.querySelector('.nag-banner'), 'nag visible on first mount');

    // Click dismiss
    const dismissBtn = body.querySelector('[data-action="dismissNag"]');
    assert.ok(dismissBtn, 'dismiss button present');
    dismissBtn.click();
    await settle();

    // localStorage now has nag:lastDismissed = today
    assert.equal(fakeLS.getItem('nag:lastDismissed'), today, 'localStorage updated after dismiss');

    // Unmount
    unmount();

    // Remount — nag should NOT reappear because localStorage still says dismissed today
    const fakeDoc2 = createFakeDocument();
    const { body: body2 } = fakeDoc2;
    setAmbientDoc(fakeDoc2);
    settingsMod.mountSettings(body2, { repo, store });
    await settle();

    const nagAfterRemount = body2.querySelector('.nag-banner');
    assert.equal(nagAfterRemount, null, 'nag should stay hidden on remount (localStorage dismissal persists)');
  });
});
