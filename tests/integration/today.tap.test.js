/**
 * @file Integration tests for Today row tap-to-log (Phase 03 plan 03 Task 3 —
 * D-53, NFR-02, D-79).
 *
 * Verifies the four observable behaviors of `mountToday`'s tap wiring:
 *
 *   1. Optimistic flip — tapping an uncompleted row flips
 *      `aria-pressed` + `today-row--completed` + `data-action` synchronously,
 *      BEFORE the underlying `apply()` tx resolves (NFR-02 <100 ms).
 *   2. apply() round-trip — after the tx commits, the log row is
 *      `{habitId, date, completed: true|false, definitionVersion: null}`
 *      (NEVER deleted; D-74 audit-log preservation).
 *   3. revertRow on apply() reject — when the tx fails, the row's prior
 *      `aria-pressed` / class list / data-action are restored
 *      synchronously inside the catch block (D-53).
 *   4. Reconcile on subscribe — `store.subscribe(render)` (wired in 03-02
 *      `mountToday`) fires after `notify()` re-hydrates the cache, and the
 *      next render rebuilds the row from canonical state.
 *
 * Pattern S7 paired-cache-bust across `apply.js` + `store.js` + `today.js`
 * + `undo.js` with the SAME query tag so all four share module instances.
 * The fake-document built here implements the subset of DOM the mount()
 * helper + today.js consume: ownerDocument, createElement, createTextNode,
 * appendChild, removeChild, firstChild, setAttribute, getAttribute,
 * classList, querySelector, closest, addEventListener, click, click chain
 * via `_listeners.get('click')`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from '../helpers/fake-idb.js';
import { todayLocal } from '../../js/util/date.js';

/**
 * Hand-rolled fake DOM with the subset of the DOM API consumed by
 * `js/util/mount.js`, `js/views/today.js`, and the tap-handling logic
 * landing in Task 3. Supports:
 *
 *   - createElement(tag) returning an element with: appendChild,
 *     removeChild, firstChild, setAttribute, getAttribute, addEventListener,
 *     classList ({add, remove, contains}), querySelector (one-level class +
 *     tag selectors), closest (walks parentNode chain).
 *   - createTextNode(text) → {nodeType: 3, nodeValue}
 *   - `el.click()` synchronously dispatches each click listener with a
 *     fake event carrying `currentTarget = el`.
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
      closest(selector) {
        // Walk up parentNode chain checking selector match on each ancestor.
        let cur = el;
        while (cur) {
          if (matchesSelector(cur, selector)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      // For test introspection — read-only.
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
    // tag selector
    return el.tagName === selector.toUpperCase();
  }

  function querySelectorWalk(root, selector) {
    // BFS through descendants; return first match (NOT the root itself —
    // matches real DOM semantics for descendant queries).
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

  doc = {
    createElement(tag) { return makeElement(tag); },
    createTextNode(text) {
      return { nodeType: 3, nodeValue: String(text), _setParent() {} };
    },
  };
  const body = makeElement('section');
  body.setAttribute('data-route', 'today');
  return { document: doc, body };
}

/**
 * Use the UN-TAGGED module instances and reset their module-level state
 * between tests. Cache-busting `today.js` would not work — its static
 * `import { subscribe, getCachedHabits, ... } from '../state/store.js'`
 * does NOT inherit a parent query string (Node ESM behavior), so a
 * cache-busted today.js would still bind to the UN-tagged store and see
 * an empty cache. Resetting + sharing the un-tagged module across tests
 * is the simplest correct path.
 */
async function freshAll() {
  const [store, applyMod, undoMod, todayMod] = await Promise.all([
    import('../../js/state/store.js'),
    import('../../js/state/apply.js'),
    import('../../js/state/undo.js'),
    import('../../js/views/today.js'),
  ]);
  // Reset module-level state so each test starts fresh.
  store._resetStoreForTest();
  todayMod._resetTodayForTest();
  return { store, applyMod, undoMod, todayMod };
}

/**
 * Wire all four modules onto the SAME repo + the SAME store instance + the
 * SAME apply instance. This is the production wiring shape from main.js,
 * specialized for tests with fakes.
 */
function wire({ store, applyMod, undoMod, repo }) {
  store.configureStore({ repo });
  // No notify-DI needed — we are on the un-tagged modules, so apply.js's
  // static `import { notify } from './store.js'` resolves to the SAME
  // store instance the test inspects.
  applyMod.configure({ repo, broadcast: () => {}, trackTx: () => {} });
  undoMod.configureUndo({ repo, apply: applyMod.apply });
}

describe('Today tap — optimistic flip happens BEFORE apply() resolves (NFR-02, D-53)', () => {
  test('tap an uncompleted row → aria-pressed="true" + today-row--completed BEFORE awaiting tx', async () => {
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

    const { body } = createFakeDocument();
    todayMod.mountToday(body);

    // The Today list is rendered into `body`. Find the first tap button.
    const tapBtn = body.querySelector('.today-row-tap');
    assert.ok(tapBtn, 'tap button rendered for h1');
    assert.equal(tapBtn.getAttribute('aria-pressed'), 'false', 'starts uncompleted');
    assert.equal(tapBtn.getAttribute('data-action'), 'markComplete');
    assert.equal(tapBtn.getAttribute('data-habit-id'), 'h1');

    // Synchronously click — the handler returns a promise but the optimistic
    // flip runs SYNCHRONOUSLY before the first `await apply(...)`.
    const clickPromise = (() => {
      tapBtn.click();
      // Right after click() returns (before any microtask runs), the
      // optimistic flip MUST already be in place per NFR-02 <100 ms.
      assert.equal(
        tapBtn.getAttribute('aria-pressed'),
        'true',
        'aria-pressed flipped synchronously',
      );
      assert.equal(
        tapBtn.getAttribute('data-action'),
        'markUncomplete',
        'data-action flipped synchronously',
      );
      // Row carries the completed class.
      const row = body.querySelector('.today-row');
      assert.ok(
        row.classList.contains('today-row--completed'),
        'row carries today-row--completed class synchronously',
      );
      return Promise.resolve();
    })();
    await clickPromise;

    // Now let the apply tx (which fired inside the click handler) settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Canonical IDB state: the log row is {completed: true, definitionVersion: null}.
    const log = repo._stores.logs.get(JSON.stringify(['h1', today]));
    assert.ok(log, 'log row written by apply()');
    assert.equal(log.completed, true);
    assert.equal(log.definitionVersion, null);
  });
});

describe('Today tap — tap a completed row → flip back + write {completed: false}', () => {
  test('completed row → tap → aria-pressed="false" + log row {completed:false} (NOT delete)', async () => {
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
    // Pre-seed a completed log so the row renders as completed.
    await repo.putLog({ habitId: 'h1', date: today, completed: true, definitionVersion: null });
    await store.hydrate();

    const { body } = createFakeDocument();
    todayMod.mountToday(body);

    const tapBtn = body.querySelector('.today-row-tap');
    assert.ok(tapBtn, 'tap button rendered');
    assert.equal(tapBtn.getAttribute('aria-pressed'), 'true', 'starts completed');
    assert.equal(tapBtn.getAttribute('data-action'), 'markUncomplete');

    tapBtn.click();
    // Synchronous optimistic flip back to uncompleted.
    assert.equal(tapBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(tapBtn.getAttribute('data-action'), 'markComplete');

    // Settle the tx.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Log row exists with {completed: false} (D-74 — NOT delete).
    const log = repo._stores.logs.get(JSON.stringify(['h1', today]));
    assert.ok(log, 'log row still exists after markUncompleted (D-74)');
    assert.equal(log.completed, false);
    assert.equal(log.definitionVersion, null);
  });
});

describe('Today tap — apply() reject triggers revertRow (D-53)', () => {
  test('when apply() rejects, prior state is restored on the row', async () => {
    const { store, applyMod, undoMod, todayMod } = await freshAll();
    const repo = createFakeRepo();
    // Inject a broken runTx that always rejects — every apply() call fails.
    const brokenRepo = {
      ...repo,
      async runTx() {
        throw new Error('synthetic tx failure');
      },
    };
    wire({ store, applyMod, undoMod, repo: brokenRepo });

    const today = todayLocal();
    await repo.putHabit({
      id: 'h1',
      name: 'Drink water',
      status: 'active',
      cadence: { type: 'daily' },
    });
    await store.hydrate();

    const { body } = createFakeDocument();
    todayMod.mountToday(body);

    const tapBtn = body.querySelector('.today-row-tap');
    const rowEl = body.querySelector('.today-row');
    assert.ok(tapBtn);
    assert.ok(rowEl);

    // Capture prior state BEFORE the optimistic flip.
    const priorAriaPressed = tapBtn.getAttribute('aria-pressed');
    const priorDataAction = tapBtn.getAttribute('data-action');
    const priorClassList = rowEl.className;

    // Click — synchronous optimistic flip, then await rejects, then revertRow.
    tapBtn.click();
    // The optimistic flip ran synchronously.
    assert.equal(tapBtn.getAttribute('aria-pressed'), 'true');

    // Let the rejected promise settle so the catch block runs.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // After revert, the row matches its prior state.
    assert.equal(
      tapBtn.getAttribute('aria-pressed'),
      priorAriaPressed,
      'aria-pressed reverted to prior value',
    );
    assert.equal(
      tapBtn.getAttribute('data-action'),
      priorDataAction,
      'data-action reverted to prior value',
    );
    assert.equal(rowEl.className, priorClassList, 'class list reverted to prior value');
  });
});

describe('Today tap — post-tap re-render reconciles via store.subscribe()', () => {
  test('after apply() resolves, the store.subscribe(render) re-renders against the canonical cache', async () => {
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

    const { body } = createFakeDocument();
    todayMod.mountToday(body);

    const tapBtn = body.querySelector('.today-row-tap');
    tapBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // After the apply tx + the post-notify re-render fires, the row STILL
    // shows the completed treatment because notify() refreshed cache.logs
    // with the new {completed: true} row.
    const tapBtnAfter = body.querySelector('.today-row-tap');
    assert.ok(tapBtnAfter, 'still has a tap button after re-render');
    assert.equal(
      tapBtnAfter.getAttribute('aria-pressed'),
      'true',
      'post-render row reflects canonical IDB state (completed)',
    );
    assert.equal(
      tapBtnAfter.getAttribute('data-action'),
      'markUncomplete',
      'post-render data-action reflects canonical IDB state',
    );
  });
});
