/**
 * @file Integration tests for the Settings Mastery card (Phase 04 plan 07 Task 2 —
 * SETTINGS-01, MASTERY-01, D-86).
 *
 * Verifies four observable behaviors:
 *
 *   1. mountSettings renders a card with `data-card="mastery"`.
 *   2. Card contains two number inputs: data-key="masteryThreshold" and
 *      data-key="masteryWindow".
 *   3. Default values displayed: threshold=90, window=70 when no settings row exists.
 *   4. Changing threshold input fires apply call with type:'setMasteryThreshold'.
 *
 * Uses the UN-TAGGED module instances and reset their module-level state
 * between tests — mirrors settings.mount.test.js (Node ESM static imports
 * don't inherit query strings).
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
  globalThis.confirm = () => false;
  globalThis.indexedDB = {
    deleteDatabase() {
      const req = { onsuccess: null, onerror: null, onblocked: null };
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
  _ambientDoc = null;
});

/**
 * @param {{ document: object, body: object }} bundle
 */
function setAmbientDoc(bundle) {
  _ambientDoc = bundle;
}

/**
 * Minimal fake DOM matching settings.mount.test.js.
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
        const set = listeners.get('change');
        if (!set) return;
        attributes.value = String(value);
        for (const fn of set) {
          fn({ type: 'change', currentTarget: el, target: el });
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

describe('mountSettings — Mastery card present (SETTINGS-01)', () => {
  test('renders a card with data-card="mastery"', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const masteryCard = body.querySelector('[data-card="mastery"]');
    assert.ok(masteryCard, 'mastery card with data-card="mastery" rendered');
  });
});

describe('mountSettings — Mastery card inputs', () => {
  test('contains number input with data-key="masteryThreshold"', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const thresholdInput = body.querySelector('[data-key="masteryThreshold"]');
    assert.ok(thresholdInput, 'masteryThreshold input rendered');
    assert.equal(thresholdInput.getAttribute('type'), 'number', 'input type is number');
  });

  test('contains number input with data-key="masteryWindow"', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const windowInput = body.querySelector('[data-key="masteryWindow"]');
    assert.ok(windowInput, 'masteryWindow input rendered');
    assert.equal(windowInput.getAttribute('type'), 'number', 'input type is number');
  });
});

describe('mountSettings — Mastery card default values', () => {
  test('threshold input defaults to 90 when no settings row exists', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await store.hydrate(); // no masteryThreshold row in repo

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const thresholdInput = body.querySelector('[data-key="masteryThreshold"]');
    assert.ok(thresholdInput, 'input present');
    const valAttr = thresholdInput.getAttribute('value');
    assert.equal(String(valAttr), '90', 'default threshold value is 90');
  });

  test('window input defaults to 70 when no settings row exists', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });
    await store.hydrate(); // no masteryWindow row in repo

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const windowInput = body.querySelector('[data-key="masteryWindow"]');
    assert.ok(windowInput, 'input present');
    const valAttr = windowInput.getAttribute('value');
    assert.equal(String(valAttr), '70', 'default window value is 70');
  });
});

describe('mountSettings — Mastery card change events fire apply', () => {
  test('changing threshold input dispatches apply({type:"setMasteryThreshold"})', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    wire({ store, applyMod, undoMod, repo, broadcastSpy: (msg) => broadcasts.push(msg) });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const thresholdInput = body.querySelector('[data-key="masteryThreshold"]');
    assert.ok(thresholdInput, 'input present');

    // Fire a change event with value 85.
    thresholdInput.dispatchChange('85');

    // Let async apply() resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const row = repo._stores.settings.get('masteryThreshold');
    assert.ok(row, 'settings row written');
    assert.equal(row.value, 85, 'threshold written as number 85');

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0].event, 'setMasteryThreshold');
    assert.deepEqual(broadcasts[0].keys, { key: 'masteryThreshold' });
  });

  test('changing window input dispatches apply({type:"setMasteryWindow"})', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    /** @type {object[]} */
    const broadcasts = [];
    wire({ store, applyMod, undoMod, repo, broadcastSpy: (msg) => broadcasts.push(msg) });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    const windowInput = body.querySelector('[data-key="masteryWindow"]');
    assert.ok(windowInput, 'input present');

    // Fire a change event with value 60.
    windowInput.dispatchChange('60');

    await new Promise((resolve) => setTimeout(resolve, 0));

    const row = repo._stores.settings.get('masteryWindow');
    assert.ok(row, 'settings row written');
    assert.equal(row.value, 60, 'window written as number 60');

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0].event, 'setMasteryWindow');
    assert.deepEqual(broadcasts[0].keys, { key: 'masteryWindow' });
  });
});
