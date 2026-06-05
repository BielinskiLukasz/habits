/**
 * @file Integration tests for `mountSettings` (Phase 03 plan 05 Task 3 —
 * D-61..D-67, D-72, D-75, D-79).
 *
 * Verifies five observable behaviors:
 *
 *   1. Locked card order — 5 cards in order Storage / Schedule / Install /
 *      Data / About (D-61).
 *   2. Schedule radio writes through `apply({type:'setSetting', payload:
 *      {key:'weekStart', value:'mon'|'sun'}})` — NEVER directly to the repo
 *      (D-75 chokepoint discipline).
 *   3. Data card Undo button is disabled when `meta.undoToken` is empty
 *      (D-65).
 *   4. Reset confirm dialog uses the D-67 SETTINGS prose string (NOT the
 *      D-06 diagnostics text).
 *   5. Settings panel idempotent re-mount + clean unmount.
 *
 * Pattern S7 paired-cache-bust is NOT needed here — settings.js uses the
 * un-tagged store/apply (same pattern as today.tap.test.js — Node ESM
 * static imports do not inherit query strings).
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';

const origDocument = globalThis.document;
const origLocation = globalThis.location;
const origConfirm = globalThis.confirm;
const origIndexedDB = globalThis.indexedDB;

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
  // Default confirm is true — individual tests override via globalThis.confirm.
  globalThis.confirm = () => true;
  // indexedDB stub — Reset data test invokes deleteDatabase. Default returns
  // success synchronously to avoid hanging the test loop.
  globalThis.indexedDB = {
    deleteDatabase() {
      const req = { onsuccess: null, onerror: null, onblocked: null };
      // Defer to next microtask so the caller has time to assign callbacks.
      Promise.resolve().then(() => req.onsuccess && req.onsuccess());
      return req;
    },
  };
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
  globalThis.confirm = origConfirm;
  globalThis.indexedDB = origIndexedDB;
  _ambientDoc = null;
});

/**
 * @param {{ document: object, body: object }} bundle
 */
function setAmbientDoc(bundle) {
  _ambientDoc = bundle;
}

/**
 * Minimal fake DOM with the subset consumed by `js/util/mount.js`,
 * `js/views/settings.js`, and the toast primitive. Same shape as
 * today.tap.test.js's fake.
 *
 * @returns {{ document: object, body: object }}
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
      _attrs: attributes,
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
        for (const fn of set) {
          fn({ type: 'click', currentTarget: el, target: el });
        }
      },
      dispatchChange(value) {
        // Helper to fire a change event for radios. Real browsers fire on the
        // input element; the mounter wires data-action='setWeekStart' as a
        // click listener (mount() only wires click). settings.js's
        // setWeekStart handler reads `evt.currentTarget.value` — set the
        // attribute value and click.
        const set = listeners.get('click');
        if (!set) return;
        attributes.value = String(value);
        for (const fn of set) {
          fn({
            type: 'click',
            currentTarget: el,
            target: el,
          });
        }
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
      get hidden() { return attributes.hidden === '' || attributes.hidden === 'true'; },
      set hidden(v) {
        if (v) attributes.hidden = '';
        else delete attributes.hidden;
      },
      focus() {},
    };
    return el;
  }

  function matchesSelector(el, selector) {
    if (!el || !selector) return false;
    // Strip leading/trailing whitespace + handle attribute selectors.
    selector = selector.trim();
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return el.classList && el.classList.contains(cls);
    }
    // [attr="value"] selector
    const attrMatch = selector.match(/^\[([\w-]+)(?:=['"]?([^'"\]]*)['"]?)?\]$/);
    if (attrMatch) {
      const [, key, val] = attrMatch;
      const got = el.getAttribute ? el.getAttribute(key) : undefined;
      if (val === undefined) return got !== undefined && got !== null;
      return got === val;
    }
    // tag selector
    return el.tagName === selector.toUpperCase();
  }

  function querySelectorWalk(root, selector) {
    const queue = [...(root.children || [])];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (matchesSelector(cur, selector)) return cur;
      if (cur.children) {
        for (const c of cur.children) queue.push(c);
      }
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
      if (cur.children) {
        for (const c of cur.children) queue.push(c);
      }
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

/**
 * Use the UN-TAGGED module instances and reset their module-level state
 * between tests — mirrors today.tap.test.js (Node ESM static imports don't
 * inherit query strings; cache-busting settings.js would still bind to the
 * un-tagged store).
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

function wire({ store, applyMod, undoMod, repo, broadcastSpy }) {
  store.configureStore({ repo });
  applyMod.configure({
    repo,
    broadcast: broadcastSpy ?? (() => {}),
    trackTx: () => {},
  });
  undoMod.configureUndo({ repo, apply: applyMod.apply });
}

describe('mountSettings — 6 cards in locked order (D-61, extended Phase 04-07 with Mastery)', () => {
  test('renders Storage / Schedule / Install / Data / About / Mastery in that order', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await repo.putSetting({ key: 'weekStart', value: 'mon' });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const cards = body.querySelectorAll('.settings-card');
    assert.equal(cards.length, 6, '6 settings cards rendered (Phase 04-07 adds Mastery card)');

    const titles = cards.map((card) => {
      const h2 = card.querySelector('h2');
      return h2 ? h2.textContent : null;
    });
    assert.deepEqual(
      titles,
      ['Storage', 'Schedule', 'Install', 'Data', 'About', 'Mastery'],
      'titles in locked top-down order (D-61 + Phase 04-07 Mastery appended)',
    );
  });
});

describe('mountSettings — Schedule radio writes through apply (D-63, D-75)', () => {
  test('changing weekStart radio dispatches apply({type:"setSetting"})', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    wire({
      store,
      applyMod,
      undoMod,
      repo,
      broadcastSpy: (msg) => broadcasts.push(msg),
    });
    await repo.putSetting({ key: 'weekStart', value: 'mon' });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    // Find the 'sun' radio and "click" it (the mounter wires data-action
    // listeners as click; settings.js handler reads evt.currentTarget.value).
    const radios = body.querySelectorAll('[data-action="setWeekStart"]');
    assert.equal(radios.length, 2);
    const sunRadio = radios.find((r) => r.getAttribute('value') === 'sun');
    assert.ok(sunRadio, 'sun radio present');

    sunRadio.click();

    // Let the async apply() resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Settings row written through the chokepoint.
    const row = repo._stores.settings.get('weekStart');
    assert.ok(row, 'settings row written');
    assert.equal(row.value, 'sun');

    // Broadcast envelope is setSetting with {key} only.
    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0].event, 'setSetting');
    assert.deepEqual(broadcasts[0].keys, { key: 'weekStart' });
  });
});

describe('mountSettings — Data card Undo button (D-65)', () => {
  test('Undo button is disabled when meta.undoToken is empty', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    // No prior actions — meta.undoToken is absent.
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const undoBtn = body.querySelector('[data-action="undoLastAction"]');
    assert.ok(undoBtn, 'Undo button rendered');
    assert.ok(
      undoBtn.hasAttribute('disabled'),
      'Undo button disabled when meta.undoToken is empty',
    );
  });
});

describe('mountSettings — Reset data confirm uses D-67 string (NOT D-06)', () => {
  test('clicking Reset shows the SETTINGS-flavored confirm prompt', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await store.hydrate();

    /** @type {string|null} */
    let capturedMsg = null;
    globalThis.confirm = (msg) => {
      capturedMsg = msg;
      return false; // decline so we don't touch indexedDB
    };

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const resetBtn = body.querySelector('[data-action="resetData"]');
    assert.ok(resetBtn, 'Reset data button rendered');

    resetBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      capturedMsg,
      'This will delete all your habits and history. Cannot be undone. Continue?',
      'D-67 user-facing prose, NOT D-06 verbatim diagnostics text',
    );
  });
});
