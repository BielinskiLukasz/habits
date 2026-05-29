/**
 * @file Integration test for the Settings Data card live refresh (Phase 03
 * plan 05 Task 3 — D-65, D-72).
 *
 * After mountSettings is mounted, a peer-tab broadcast representing a new
 * `markCompleted` event MUST trigger the Data card preview to update to
 * reflect the new `meta.undoToken`. The mechanism:
 *
 *   1. mountSettings subscribes to `store.notify(refreshDataCard)` on mount
 *      (D-72).
 *   2. A `store.notify({event, keys})` call refreshes the affected cache
 *      keys (Pitfall 2 — notify-driven cache refresh) and fans out to
 *      subscribers.
 *   3. The Data card re-reads `meta.undoToken` → `repo.getEvent(token)`
 *      and re-renders the preview line.
 *
 * Strategy: simulate a peer-tab mutation by directly seeding repo state
 * (a new event + meta.undoToken row) and then calling `store.notify(...)`
 * — exactly what `js/platform/sync.js` does when it receives a peer broadcast.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

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
 * Same fake DOM shape used by settings.mount.test.js — minimal subset of the
 * DOM API needed by mount() + settings.js + toast.js.
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

describe('Settings Data card — live refresh on cross-tab broadcast (D-72)', () => {
  test('peer-tab markCompleted broadcast triggers Data card preview update', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    // Seed a habit so the habit-name lookup resolves to "Drink water".
    await repo.putHabit({
      id: 'h1',
      name: 'Drink water',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    // Initially the Undo button is disabled (no meta.undoToken).
    let undoBtn = body.querySelector('[data-action="undoLastAction"]');
    assert.ok(undoBtn, 'Undo button rendered');
    assert.ok(undoBtn.hasAttribute('disabled'), 'disabled before any action');

    // Simulate a peer-tab markCompleted: directly seed an event row + meta.undoToken,
    // then call store.notify({event, keys}) — exactly what sync.js does on
    // broadcast receive.
    const today = todayLocal();
    const eventRow = {
      id: 'evt-1',
      at: new Date().toISOString(),
      type: 'markCompleted',
      payload: { habitId: 'h1', date: today },
      inverse: { type: 'restoreLogRow', payload: { habitId: 'h1', date: today, prior: undefined } },
    };
    await repo.putEvent(eventRow);
    await repo.putMeta('undoToken', 'evt-1');
    // Also write the log row so the cache refresh has something to find.
    await repo.putLog({ habitId: 'h1', date: today, completed: true, definitionVersion: null });

    // Fire the same notify shape that sync.js's broadcast-receive path uses.
    await store.notify({ event: 'markCompleted', keys: { habitId: 'h1', date: today } });
    // The Settings subscriber kicks off an async readDataCardInputs() that
    // is fire-and-forget from notify's perspective. Settle the microtask
    // queue so the inner repo lookups + DOM swap complete before assertions.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // After the notify-driven refresh + subscribe fan-out, the Data card
    // preview should reflect the new undoToken — verb+habit copy via D-71.
    undoBtn = body.querySelector('[data-action="undoLastAction"]');
    assert.ok(undoBtn, 'Undo button still present');
    assert.equal(
      undoBtn.hasAttribute('disabled'),
      false,
      'Undo button NOT disabled after meta.undoToken populated',
    );

    // Preview text contains the verb+habit and a relative-time string.
    const preview = body.querySelector('.settings-data-undo');
    assert.ok(preview, 'preview container present');
    // Walk down to find the <p> whose text contains "Last:" or "marked".
    const previewText = collectAllText(preview);
    assert.match(
      previewText,
      /marked/i,
      'preview text mentions "marked"',
    );
    assert.match(
      previewText,
      /Drink water/,
      'preview text contains habit name',
    );
  });
});

describe('Settings Data card — setSetting event label (Gap 1 fix)', () => {
  test('setSetting event renders "changed <key> to <value>" not "marked (habit) complete"', async () => {
    const { store, applyMod, undoMod, settingsMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    await store.hydrate();

    const fakeDoc = createFakeDocument();
    const { body } = fakeDoc;
    setAmbientDoc(fakeDoc);
    settingsMod.mountSettings(body, { repo, store });

    // Seed a setSetting event + matching undoToken (no habitId in payload).
    const eventRow = {
      id: 'evt-set-1',
      at: new Date().toISOString(),
      type: 'setSetting',
      payload: { key: 'weekStart', value: 'mon' },
      inverse: { type: 'setSetting', payload: { key: 'weekStart', value: 'sun' } },
    };
    await repo.putEvent(eventRow);
    await repo.putMeta('undoToken', 'evt-set-1');

    await store.notify({ event: 'setSetting', keys: { key: 'weekStart' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const preview = body.querySelector('.settings-data-undo');
    assert.ok(preview, 'preview container present');
    const previewText = collectAllText(preview);
    assert.match(previewText, /changed weekStart to mon/, 'preview shows setSetting label');
    assert.doesNotMatch(previewText, /\(habit\)/, 'no stray "(habit)" in preview');
    assert.doesNotMatch(previewText, /^marked /, 'does not start with "marked"');
  });
});

/**
 * Helper: collect all textContent + text descriptions from a fake-DOM
 * subtree. Walks recursively appending element text and text-node values.
 */
function collectAllText(root) {
  /** @type {string[]} */
  const parts = [];
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      parts.push(String(node.nodeValue ?? ''));
      return;
    }
    if (node.textContent && (!node.children || node.children.length === 0)) {
      parts.push(String(node.textContent));
    }
    if (node.children) {
      for (const c of node.children) walk(c);
    }
  }
  walk(root);
  return parts.join(' ');
}
