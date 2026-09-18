/**
 * @file Regression test for the s1-weekly-period-premature delivery-path
 * defect (second root cause, found during reopened human-verify investigation).
 *
 * Bug: js/desktop.js's '#settings' route mounts Settings with a store object
 * that omits `notify` (`{ subscribe, getCachedWeekStart, getCachedSettings,
 * getCachedHabits }` — contrast js/main.js, which passes the full store
 * module namespace). js/views/settings.js's `recomputeScores` action guarded
 * its cross-view refresh signal behind `typeof store.notify === 'function'`,
 * so on the desktop shell this silently no-op'd: `rebuildAllSnapshots`
 * correctly rewrote `score_snapshots` in IndexedDB, but nothing told the
 * already-mounted (idempotent-mount, D-115) Analytics/Waveboard views to
 * re-fetch it — the user saw a byte-identical, stale S1 score even after a
 * successful recompute.
 *
 * This test mounts Settings with a store object shaped EXACTLY like
 * js/desktop.js's (missing `notify`), registers a `store.subscribe` spy the
 * same way js/views/desktop/analytics.js / waveboard.js do, triggers the
 * Recompute Scores action, and asserts the spy fires. Before the fix this
 * fails (spy never called); after the fix it passes.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

const origDocument = globalThis.document;
const origLocation = globalThis.location;

/** @type {{ document: object, body: object }|null} */
let _ambientDoc = null;

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

function setAmbientDoc(bundle) {
  _ambientDoc = bundle;
}

/**
 * Same minimal fake DOM shape used by settings.dataCard.test.js /
 * settings.backup-nag.test.js — just enough of the DOM API for mount() +
 * settings.js + toast.js, plus `_listeners` exposed so the test can await
 * the click handler directly instead of racing setTimeout ticks.
 */
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

describe('Settings Recompute Scores — desktop-shaped store wiring (s1-weekly-period-premature delivery path)', () => {
  test('recomputeScores must fan out store.subscribe callbacks even when mounted with a store object missing `notify` (mirrors js/desktop.js #settings wiring)', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    await repo.putHabit({
      id: 'w1',
      name: 'Weekly review',
      status: 'active',
      cadence: { type: 'weekly' },
      createdAt: '2020-01-01',
    });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);

    // Mirror js/desktop.js's '#settings' route wiring EXACTLY (D-115):
    // `{ subscribe, getCachedWeekStart, getCachedSettings, getCachedHabits }`
    // — deliberately omits `notify`, unlike js/main.js which passes the full
    // store module namespace.
    const desktopShapedStore = {
      subscribe: store.subscribe,
      getCachedWeekStart: store.getCachedWeekStart,
      getCachedSettings: store.getCachedSettings,
      getCachedHabits: store.getCachedHabits,
    };

    settingsMod.mountSettings(body, { repo, store: desktopShapedStore });

    // Simulate what js/views/desktop/analytics.js and waveboard.js do on
    // mount: subscribe to the canonical singleton store for reactive
    // refresh of already-rendered data.
    let notifyFanOutCount = 0;
    store.subscribe(() => { notifyFanOutCount++; });

    const recomputeBtn = body.querySelector('[data-action="recomputeScores"]');
    assert.ok(recomputeBtn, 'Recompute Scores button must be rendered');

    // Await the click handler directly (rather than racing setTimeout ticks)
    // so the async recomputeScores action fully completes before asserting.
    const clickHandlers = recomputeBtn._listeners.get('click');
    assert.ok(clickHandlers && clickHandlers.size > 0, 'button must have a click handler wired');
    for (const fn of clickHandlers) {
      await fn({ type: 'click', currentTarget: recomputeBtn, target: recomputeBtn });
    }

    assert.ok(
      notifyFanOutCount > 0,
      'store.subscribe callbacks (e.g. Analytics/Waveboard refresh) must fire after ' +
      'Recompute Scores completes, even when the mounting shell (desktop.js) omitted ' +
      '`notify` from the store object passed to mountSettings — otherwise already-' +
      'mounted desktop views never re-read the freshly recomputed score_snapshots rows.'
    );
  });
});
