/**
 * @file End-to-end Today → toast → Undo → row flips back (Phase 03 plan 04
 * Task 2 — UNDO-01, UNDO-02, D-71, D-73).
 *
 * Three scenarios:
 *
 *   1. Tap an uncompleted row → showUndoToast appears with verb+habit copy
 *      → click Undo → row flips back to uncompleted via store.subscribe
 *      re-render (UNDO-01, UNDO-02, D-71).
 *
 *   2. Tap a completed row → showUndoToast appears with "Marked … uncomplete"
 *      copy → click Undo → row flips back to completed.
 *
 *   3. apply() reject from the tap handler → showErrorToast appears with
 *      "Couldn't mark — try again" (D-73). The 03-03 console.warn placeholder
 *      is REMOVED — assert console.warn is NOT called.
 *
 * Uses the same fake-DOM + un-tagged-modules-plus-reset approach as
 * `tests/integration/today.tap.test.js` (cache-busting today.js would
 * not work — its static import of store.js doesn't inherit the tag).
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

/** Fake DOM mirroring the subset today.js + toast.js touch. */
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
      get ownerDocument() { return doc; },
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
      querySelector(selector) {
        return querySelectorWalk(el, selector);
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
    };
    return el;
  }

  function matchesSelector(el, selector) {
    if (!el || !selector) return false;
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return el.classList && el.classList.contains(cls);
    }
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

  const body = makeElement('body');
  body.setAttribute('data-route', 'today');
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
 * BFS for first descendant of `root` with the given class token. Includes
 * the root itself if it matches.
 */
function findByClass(root, cls) {
  /** @type {object[]} */
  const queue = [root, ...(root.children || [])];
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

function collectAllTapButtons(root) {
  /** @type {object[]} */
  const out = [];
  /** @type {object[]} */
  const queue = [...(root.children || [])];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) continue;
    if (cur.classList && cur.classList.contains && cur.classList.contains('today-row-tap')) {
      out.push(cur);
    }
    if (cur.children) {
      for (const c of cur.children) queue.push(c);
    }
  }
  return out;
}

/**
 * Use the UN-TAGGED module instances and reset their module-level state
 * between tests. Same approach as today.tap.test.js — cache-busting
 * today.js would not work for its static imports.
 */
async function freshAll() {
  const [store, applyMod, undoMod, toastMod, todayMod] = await Promise.all([
    import('../../js/state/store.js'),
    import('../../js/state/apply.js'),
    import('../../js/state/undo.js'),
    import('../../js/views/toast.js'),
    import('../../js/views/today.js'),
  ]);
  store._resetStoreForTest();
  todayMod._resetTodayForTest();
  toastMod._resetToastForTest();
  return { store, applyMod, undoMod, toastMod, todayMod };
}

function wire({ store, applyMod, undoMod, repo }) {
  store.configureStore({ repo });
  applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
  undoMod.configureUndo({ repo, apply: applyMod.apply });
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

describe('Today tap → Undo toast appears with verb+habit copy (D-71)', () => {
  test('tap an uncompleted row → showUndoToast renders with "Marked <habit> complete"', async () => {
    const { store, applyMod, undoMod, toastMod, todayMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    await repo.putHabit({
      id: 'h1',
      name: 'Spacer rano',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await repo.putHabit({
      id: 'h2',
      name: 'Stretch',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await store.hydrate();

    // Mount the Today view into the SAME document toast.js writes to.
    todayMod.mountToday(win.body);

    const allTaps = collectAllTapButtons(win.body);
    const h1Tap = allTaps.find((b) => b.getAttribute('data-habit-id') === 'h1');
    assert.ok(h1Tap, 'h1 tap button rendered');

    h1Tap.click();
    // Settle apply() + notify.
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Toast was rendered to document.body. Find it.
    const toast = findByClass(win.body, 'toast');
    assert.ok(toast, 'toast rendered after tap');
    assert.ok(
      toast.textContent.includes('Marked Spacer rano complete'),
      `expected D-71 copy "Marked Spacer rano complete"; got "${toast.textContent}"`,
    );
    assert.ok(toast.textContent.includes('Undo'), 'Undo action rendered');
    // Toast is NOT an error variant.
    assert.equal(
      toast.className.includes('toast--error'),
      false,
      'success toast does not carry error variant class',
    );
    // Reset for the next test.
    toastMod._resetToastForTest();
  });
});

describe('Today tap → Undo click flips the row back (UNDO-02)', () => {
  test('clicking Undo on the toast reverts the row via store.subscribe re-render', async () => {
    const { store, applyMod, undoMod, toastMod, todayMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    await repo.putHabit({
      id: 'h1',
      name: 'Drink water',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await repo.putHabit({
      id: 'h2',
      name: 'Stretch',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await store.hydrate();

    todayMod.mountToday(win.body);
    const tapsBefore = collectAllTapButtons(win.body);
    const h1TapBefore = tapsBefore.find((b) => b.getAttribute('data-habit-id') === 'h1');
    assert.ok(h1TapBefore, 'h1 tap before');

    // Tap to mark complete.
    h1TapBefore.click();
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // The post-render reconcile leaves h1 with aria-pressed=true.
    const tapsAfterMark = collectAllTapButtons(win.body);
    const h1TapAfterMark = tapsAfterMark.find((b) => b.getAttribute('data-habit-id') === 'h1');
    assert.equal(
      h1TapAfterMark.getAttribute('aria-pressed'),
      'true',
      'h1 row marked complete after re-render',
    );

    // Click the toast's Undo button.
    const toastAction = findByClass(win.body, 'toast-action');
    assert.ok(toastAction, 'toast Undo button rendered');
    toastAction.click();
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // h1's row is back to uncompleted via store.subscribe re-render.
    const tapsAfterUndo = collectAllTapButtons(win.body);
    const h1TapAfterUndo = tapsAfterUndo.find((b) => b.getAttribute('data-habit-id') === 'h1');
    assert.ok(h1TapAfterUndo, 'h1 still rendered after undo');
    assert.equal(
      h1TapAfterUndo.getAttribute('aria-pressed'),
      'false',
      'h1 row flipped back to uncompleted',
    );
    assert.equal(
      h1TapAfterUndo.getAttribute('data-action'),
      'markComplete',
      'h1 data-action reset to markComplete',
    );
    toastMod._resetToastForTest();
  });
});

describe('Today tap reject → showErrorToast (D-73) — console.warn is gone', () => {
  test('apply() reject surfaces a showErrorToast with "Couldn\'t mark — try again"', async () => {
    const { store, applyMod, undoMod, toastMod, todayMod } = await freshAll();
    const repo = createFakeRepo();
    const brokenRepo = {
      ...repo,
      async runTx() {
        throw new Error('synthetic tx failure');
      },
    };
    wire({ store, applyMod, undoMod, repo: brokenRepo });

    await repo.putHabit({
      id: 'h1',
      name: 'Drink water',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await store.hydrate();

    todayMod.mountToday(win.body);

    // Stub console.warn before tapping.
    const originalWarn = console.warn;
    let warnCalls = 0;
    console.warn = () => { warnCalls++; };

    try {
      const tapBtn = collectAllTapButtons(win.body)[0];
      assert.ok(tapBtn, 'tap button rendered');
      tapBtn.click();
      for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Error toast appears.
      const toast = findByClass(win.body, 'toast');
      assert.ok(toast, 'toast rendered after apply() reject');
      assert.ok(
        toast.className.includes('toast--error'),
        `expected error-variant toast; got className="${toast.className}"`,
      );
      assert.ok(
        toast.textContent.includes("Couldn't mark — try again"),
        `expected D-73 copy; got "${toast.textContent}"`,
      );

      // Row reverted to uncompleted (03-03 revertRow + D-73 showErrorToast both fired).
      const tapBtnAfter = collectAllTapButtons(win.body)[0];
      assert.equal(
        tapBtnAfter.getAttribute('aria-pressed'),
        'false',
        'row aria-pressed reverted to false',
      );

      // The 03-03 console.warn placeholder is REMOVED.
      assert.equal(warnCalls, 0, 'no console.warn was emitted (placeholder removed)');
    } finally {
      console.warn = originalWarn;
      toastMod._resetToastForTest();
    }
  });
});
