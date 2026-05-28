/**
 * @file Integration test for the Undo-toast → undo() round-trip (Phase 03
 * plan 04 Task 2 — UNDO-02, D-69, D-71).
 *
 * Verifies that clicking the toast's Undo action invokes the closure
 * (which calls `undo()`), the inverse `restoreLogRow` event lands in the
 * same chokepoint, the cache refreshes via notify, and the log row is
 * reverted to its prior state.
 *
 * Pattern S7 paired-cache-bust import of `js/state/apply.js`,
 * `js/state/store.js`, `js/state/undo.js`, and `js/views/toast.js` with
 * the SAME query tag so they share module instances. Standalone DOM stub
 * mirrors the subset toast.js consumes.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

/** Minimal fake DOM mirroring the subset toast.js + click handlers consume. */
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
      _attrs: attributes,
      get children() { return children; },
      get firstChild() { return children[0] ?? null; },
      get parentNode() { return parentNode; },
      _setParent(p) { parentNode = p; },
      _listeners: listeners,
      get textContent() {
        let out = '';
        for (const c of children) {
          if (c && typeof c.textContent === 'string') out += c.textContent;
          else if (c && c.nodeType === 3) out += c.nodeValue;
        }
        return out || (attributes.textContent || '');
      },
      set textContent(v) {
        attributes.textContent = String(v);
        children.length = 0;
      },
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
      dataset: {},
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        const set = listeners.get(type);
        if (set) set.delete(fn);
      },
      dispatchEvent(event) {
        const set = listeners.get(event.type);
        if (set) {
          for (const fn of set) fn(event);
        }
        return true;
      },
      click() {
        const set = listeners.get('click');
        if (!set) return;
        for (const fn of set) fn({ type: 'click', currentTarget: el });
      },
    };
    return el;
  }

  const body = makeElement('body');
  doc = {
    body,
    createElement(tag) { return makeElement(tag); },
    createTextNode(text) {
      return { nodeType: 3, nodeValue: String(text), _setParent() {} };
    },
  };
  return { document: doc, body };
}

/**
 * BFS the fake DOM tree for the first descendant whose className contains
 * the requested class token.
 */
function findByClass(root, cls) {
  /** @type {object[]} */
  const queue = [...(root.children || [])];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) continue;
    if (cur.classList && cur.classList.contains && cur.classList.contains(cls)) {
      return cur;
    }
    if (cur.children) {
      for (const c of cur.children) queue.push(c);
    }
  }
  return null;
}

/** @type {{ document: object, body: object }|null} */
let win = null;
const origDocument = globalThis.document;
const origLocation = globalThis.location;

beforeEach(() => {
  win = createFakeDocument();
  globalThis.document = win.document;
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
  win = null;
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
});

/**
 * Fresh import of the four entangled modules with the SAME query tag so
 * they share instances (Pattern S7). Avoids the Node ESM static-import
 * cross-binding problem.
 */
async function freshModules() {
  const tag = `?t=${Date.now()}-${Math.random()}`;
  const storeUrl = new URL('../../js/state/store.js', import.meta.url);
  storeUrl.search = tag;
  const applyUrl = new URL('../../js/state/apply.js', import.meta.url);
  applyUrl.search = tag;
  const undoUrl = new URL('../../js/state/undo.js', import.meta.url);
  undoUrl.search = tag;
  const toastUrl = new URL('../../js/views/toast.js', import.meta.url);
  toastUrl.search = tag;
  const [storeMod, applyMod, undoMod, toastMod] = await Promise.all([
    import(storeUrl.href),
    import(applyUrl.href),
    import(undoUrl.href),
    import(toastUrl.href),
  ]);
  return { storeMod, applyMod, undoMod, toastMod };
}

describe('Toast Undo click → undo() → log row reverted (UNDO-02)', () => {
  test('clicking the toast Undo button invokes undo() and reverts the log row', async () => {
    const { storeMod, applyMod, undoMod, toastMod } = await freshModules();
    const repo = createFakeRepo();
    storeMod.configureStore({ repo });
    // Inject the cache-busted notify into apply so subscribers fire on THIS
    // store instance (Pitfall 9 variant — see 03-03 SUMMARY).
    applyMod.configure({
      repo,
      broadcast: () => {},
      trackTx: () => {},
      notify: storeMod.notify,
    });
    undoMod.configureUndo({ repo, apply: applyMod.apply });

    // Seed a habit + hydrate so the cache is warm.
    const today = todayLocal();
    await repo.putHabit({
      id: 'h1',
      name: 'Drink water',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await storeMod.hydrate();

    // Mark complete through the chokepoint.
    await applyMod.apply({
      type: 'markCompleted',
      payload: { habitId: 'h1', date: today },
    });

    // Verify the log row was written.
    const logBefore = repo._stores.logs.get(JSON.stringify(['h1', today]));
    assert.ok(logBefore, 'log row written by markCompleted');
    assert.equal(logBefore.completed, true);

    // Show the Undo toast wired to undo().
    toastMod._resetToastForTest();
    toastMod.showUndoToast({
      message: 'Marked Drink water complete',
      undoFn: () => undoMod.undo(),
    });

    // Find + click the action button. The click handler calls undo() which
    // awaits internally; we wait for the resulting promise to settle before
    // asserting.
    const actionBtn = findByClass(win.body, 'toast-action');
    assert.ok(actionBtn, 'toast Undo action rendered');
    actionBtn.click();

    // Let the dispatched undo() (and its internal await apply(restoreLogRow))
    // settle. Three microtask ticks cover: undo() body await, apply() body
    // await runTx, await notify().
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Toast is removed after action click.
    assert.equal(win.body.firstChild, null, 'toast removed after Undo click');

    // restoreLogRow with no prior row → log row DELETED from store.
    const logAfter = repo._stores.logs.get(JSON.stringify(['h1', today]));
    assert.equal(
      logAfter,
      undefined,
      'log row reverted to prior state (undefined) by restoreLogRow',
    );
  });
});
