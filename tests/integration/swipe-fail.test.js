/**
 * @file Regression test for the LOG4-02 / LOG4-03 swipe-fail dispatch bug
 * (Phase 13.1, D-01, D-02, D-05).
 *
 * Before this phase's fix, both Today's `handleMarkFailTap` and History's
 * `'history-swipe-fail'` action handler dispatched `apply({type:
 * 'markUncompleted', ...})` for the swipe-left "Fail" button — which DELETES
 * the log row (returns it to the undefined/not-logged state) instead of
 * writing `{status:'failed'}`. This test drives the real Fail button through
 * a real DOM click, through the real `apply()` chokepoint, against a fake
 * repo + fake document (mirroring `tests/integration/today.tap.test.js`'s
 * `createFakeDocument()` / `freshAll()` / `wire()` pattern — no mocked
 * dispatch, no new DOM/test infrastructure).
 *
 * RED (pre-fix): `log.status` assertion fails because the log row is
 * `undefined` (deleted).
 * GREEN (post-fix): `log.status === 'failed'` and `log.definitionVersion
 * === null`.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

/**
 * Toast rendering (`js/views/toast.js`) reads the global `document`
 * reference. Stub `globalThis.document` with the active test's fake-document
 * body so toasts can mount without a ReferenceError — same shim as
 * `today.tap.test.js`.
 */
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

/**
 * Each test calls this with the fake-doc bundle it just built so the
 * ambient `globalThis.document` proxy resolves to the correct fake body.
 * @param {{ document: object, body: object }} bundle
 */
function setAmbientDoc(bundle) {
  _ambientDoc = bundle;
}

/**
 * Hand-rolled fake DOM — same shape/limits as `today.tap.test.js`'s
 * `createFakeDocument()`. `querySelector` supports ONLY `.class` or
 * tag-name selectors (no attribute selectors), which is why both describe
 * blocks below locate the Fail button via `.today-row__action--fail`
 * rather than `[data-action="swipeFail"]`.
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
          fn({ type: 'click', currentTarget: el });
        }
      },
      querySelector(selector) {
        return querySelectorWalk(el, selector);
      },
      querySelectorAll(selector) {
        return querySelectorWalkAll(el, selector);
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

  function querySelectorWalkAll(root, selector) {
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
  return { document: doc, body };
}

/**
 * Use the UN-TAGGED module instances and reset their module-level state
 * between tests (same rationale as `today.tap.test.js`: static imports
 * inside `today.js`/`history.js` don't inherit a cache-busting query
 * string, so tests must share the un-tagged modules).
 */
async function freshAll() {
  const [store, applyMod, undoMod, todayMod, historyMod, toastMod] = await Promise.all([
    import('../../js/state/store.js'),
    import('../../js/state/apply.js'),
    import('../../js/state/undo.js'),
    import('../../js/views/today.js'),
    import('../../js/views/history.js'),
    import('../../js/views/toast.js'),
  ]);
  store._resetStoreForTest();
  todayMod._resetTodayForTest();
  toastMod._resetToastForTest();
  return { store, applyMod, undoMod, todayMod, historyMod, toastMod };
}

/**
 * Wire all modules onto the SAME repo + SAME store instance + SAME apply
 * instance — the production wiring shape from main.js, specialized for
 * tests with fakes.
 */
function wire({ store, applyMod, undoMod, repo }) {
  store.configureStore({ repo });
  applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
  undoMod.configureUndo({ repo, apply: applyMod.apply });
}

describe('Today swipe-fail -> markFailed -> log status stays \'failed\' (not deleted)', () => {
  test('tapping the Fail action on a Today row writes status:failed instead of deleting the log', async () => {
    const { store, applyMod, undoMod, todayMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    const today = todayLocal();
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
    todayMod.mountToday(body);

    const row = body.querySelector('.today-row');
    assert.ok(row, 'today row rendered');
    const failBtn = row.querySelector('.today-row__action--fail');
    assert.ok(failBtn, 'Fail action button rendered');
    assert.equal(failBtn.getAttribute('data-habit-id'), 'h1');

    failBtn.click();
    // Let the async apply() tx settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const log = repo._stores.logs.get(JSON.stringify(['h1', today]));
    assert.ok(log, 'log row survives the Fail action (not deleted)');
    assert.equal(log.status, 'failed', 'log status is failed');
    assert.equal(log.definitionVersion, null);
  });
});

describe('History swipe-fail -> markFailed -> log status stays \'failed\' (not deleted)', () => {
  test('tapping the Fail action on a History row writes status:failed instead of deleting the log', async () => {
    const { store, applyMod, undoMod, historyMod } = await freshAll();
    const repo = createFakeRepo();
    wire({ store, applyMod, undoMod, repo });

    const today = todayLocal();
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
    historyMod.mountHistory(body, { repo, store });
    // Initial render() is fire-and-forget async — await a macrotask tick.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const row = body.querySelector('.history-habit-row');
    assert.ok(row, 'history habit row rendered');
    const failBtn = row.querySelector('.today-row__action--fail');
    assert.ok(failBtn, 'Fail action button rendered');
    assert.equal(failBtn.getAttribute('data-habit-id'), 'h1');

    failBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const log = repo._stores.logs.get(JSON.stringify(['h1', today]));
    assert.ok(log, 'log row survives the Fail action (not deleted)');
    assert.equal(log.status, 'failed', 'log status is failed');
  });
});
