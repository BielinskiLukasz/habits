/**
 * @file Unit tests for `js/views/toast.js` (Phase 03 plan 04 Task 1 —
 * D-08 regression + D-69 + D-70 + D-71 + D-73).
 *
 * Covers the toast primitive's three public surfaces:
 *
 *   - `showUpdateToast()` — LOCKED no-auto-dismiss (D-08 regression guard).
 *   - `showUndoToast({message, undoFn, autoDismissMs?})` — D-69 5s auto-dismiss
 *     + hover-pause, D-70 single-toast invariant, D-71 verb+habit copy +
 *     Undo button click invokes the closure.
 *   - `showErrorToast(message)` — D-73 error variant, 4s auto-dismiss, no
 *     action button.
 *
 * Strategy:
 *   - A `createFakeWindow()` helper installs a fake `globalThis.document`
 *     + `globalThis.window` (no JSDOM — D-26 / no-npm). The fake DOM mirrors
 *     the subset of the DOM API consumed by `toast.js`: createElement,
 *     appendChild, removeChild, firstChild, setAttribute, getAttribute,
 *     addEventListener, dispatchEvent, click(), .remove(), classList.
 *   - A `installFakeClock()` helper monkey-patches `setTimeout` + `clearTimeout`
 *     on `globalThis` so tests advance virtual time via `clock.tick(ms)`.
 *   - Each test calls `freshToast()` (Pattern S7 cache-bust) so module-level
 *     state (`toastEl`, `dismissTimer`) starts clean.
 *
 * Note on freshToast: `js/views/toast.js`'s only static import is `location`
 * (via `location.reload()` inside the Reload button handler). We stub
 * `globalThis.location` once with a fake before the first cache-bust.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Build a fake DOM mirroring the subset toast.js touches. The wrapper exposes
 * `document` + `body` so tests can introspect `document.body.firstChild` /
 * `document.body.children.length` directly.
 *
 * @returns {{ document: object, body: object }}
 */
function createFakeWindow() {
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
        // Concatenate descendants' textContent (good enough for our asserts).
        let out = '';
        for (const c of children) {
          if (c && typeof c.textContent === 'string') out += c.textContent;
          else if (c && c.nodeType === 3) out += c.nodeValue;
        }
        return out || (attributes.textContent || '');
      },
      set textContent(v) {
        attributes.textContent = String(v);
        // Mimic browser: setting textContent wipes child nodes.
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
 * Monkey-patch `globalThis.setTimeout` + `globalThis.clearTimeout` with a
 * virtual clock. `clock.tick(ms)` fires every scheduled callback whose
 * delay has elapsed.
 *
 * @returns {{
 *   tick: (ms: number) => void,
 *   restore: () => void,
 *   pending: () => number,
 * }}
 */
function installFakeClock() {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  let now = 0;
  let nextId = 1;
  /** @type {Map<number, { at: number, fn: Function }>} */
  const tasks = new Map();

  globalThis.setTimeout = (fn, delay = 0) => {
    const id = nextId++;
    tasks.set(id, { at: now + delay, fn });
    return id;
  };
  globalThis.clearTimeout = (id) => {
    tasks.delete(id);
  };

  return {
    tick(ms) {
      const target = now + ms;
      // Repeatedly find the earliest due task and run it, so a callback
      // that schedules a new timer also fires when due within the same tick.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let earliest = null;
        for (const [id, t] of tasks) {
          if (t.at <= target && (!earliest || t.at < earliest.at)) {
            earliest = { id, ...t };
          }
        }
        if (!earliest) break;
        tasks.delete(earliest.id);
        now = earliest.at;
        try { earliest.fn(); } catch (_e) { /* swallow — test isolates */ }
      }
      now = target;
    },
    pending() { return tasks.size; },
    restore() {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    },
  };
}

/** Fresh import per test so toast.js module-level state is clean. */
async function freshToast() {
  const url = new URL('../../js/views/toast.js', import.meta.url);
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

/** @type {{ document: object, body: object }|null} */
let win = null;
/** @type {ReturnType<typeof installFakeClock>|null} */
let clock = null;
const origDocument = globalThis.document;
const origLocation = globalThis.location;

beforeEach(() => {
  win = createFakeWindow();
  globalThis.document = win.document;
  // Stub location.reload so showUpdateToast's Reload button is callable
  // without crashing the test runner. `globalThis.location` is read-only on
  // some Node versions; assign via defineProperty if needed.
  try {
    globalThis.location = { reload: () => {} };
  } catch (_e) {
    Object.defineProperty(globalThis, 'location', {
      value: { reload: () => {} },
      configurable: true,
      writable: true,
    });
  }
  clock = installFakeClock();
});

afterEach(() => {
  if (clock) clock.restore();
  clock = null;
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

describe('D-08 regression — showUpdateToast remains no-auto-dismiss', () => {
  test('mounted toast survives 60 seconds of virtual time', async () => {
    const { showUpdateToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUpdateToast();
    assert.ok(win.body.firstChild, 'toast mounted');
    clock.tick(60_000);
    assert.ok(win.body.firstChild, 'toast STILL mounted after 60s (D-08 LOCKED)');
  });

  test('second showUpdateToast() call is a no-op (idempotent guard preserved)', async () => {
    const { showUpdateToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUpdateToast();
    const first = win.body.firstChild;
    showUpdateToast();
    assert.equal(win.body.children.length, 1, 'still exactly one toast');
    assert.equal(win.body.firstChild, first, 'same toast element retained');
  });
});

describe('showUndoToast — D-69 + D-71 (verb+habit copy + 5s auto-dismiss)', () => {
  test('renders with verb+habit copy + Undo + dismiss', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUndoToast({ message: 'Marked Spacer rano complete', undoFn: () => {} });
    const t = win.body.firstChild;
    assert.ok(t, 'toast mounted');
    assert.ok(t.className.includes('toast'), 'has "toast" class');
    assert.ok(t.textContent.includes('Marked Spacer rano complete'), 'message rendered');
    assert.ok(t.textContent.includes('Undo'), 'Undo action label rendered');
    assert.ok(t.textContent.includes('×'), 'dismiss glyph rendered');
    assert.equal(t.getAttribute('role'), 'status', 'role=status preserved');
    assert.equal(t.getAttribute('aria-live'), 'polite', 'aria-live=polite preserved');
  });

  test('auto-dismisses after 5 seconds (D-69)', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUndoToast({ message: 'x', undoFn: () => {} });
    assert.ok(win.body.firstChild, 'mounted');
    clock.tick(4999);
    assert.ok(win.body.firstChild, 'still mounted at 4999ms');
    clock.tick(2);
    assert.equal(win.body.firstChild, null, 'removed after 5001ms');
  });

  test('hover (pointerenter) pauses the timer (D-69)', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUndoToast({ message: 'x', undoFn: () => {} });
    const t = win.body.firstChild;
    assert.ok(t);
    clock.tick(2000);
    // Dispatch pointerenter → timer pauses.
    t.dispatchEvent({ type: 'pointerenter' });
    clock.tick(10_000);
    assert.ok(win.body.firstChild, 'still mounted after 12s of hover');
    // Pointerleave → fresh 5s timer.
    t.dispatchEvent({ type: 'pointerleave' });
    clock.tick(4999);
    assert.ok(win.body.firstChild, 'still mounted 4999ms after pointerleave');
    clock.tick(2);
    assert.equal(win.body.firstChild, null, 'removed 5001ms after pointerleave');
  });

  test('Undo click invokes undoFn and dismisses the toast', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    let called = 0;
    showUndoToast({ message: 'x', undoFn: () => { called++; } });
    // Find the .toast-action button (BFS).
    const actionBtn = findByClass(win.body, 'toast-action');
    assert.ok(actionBtn, 'action button rendered');
    actionBtn.click();
    assert.equal(called, 1, 'undoFn invoked exactly once');
    assert.equal(win.body.firstChild, null, 'toast removed after action click');
  });

  test('second showUndoToast replaces the first (D-70 single-toast)', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUndoToast({ message: 'first', undoFn: () => {} });
    showUndoToast({ message: 'second', undoFn: () => {} });
    assert.equal(win.body.children.length, 1, 'exactly one toast mounted');
    assert.ok(
      win.body.firstChild.textContent.includes('second'),
      'visible message is the latest',
    );
    // Original toast's auto-dismiss timer should have been cleared — there is
    // exactly one pending timer (the new toast's 5s) instead of two.
    assert.equal(clock.pending(), 1, 'only the latest auto-dismiss timer is live');
  });

  test('undoFn throw shows error toast', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUndoToast({ message: 'x', undoFn: () => { throw new Error('boom'); } });
    const actionBtn = findByClass(win.body, 'toast-action');
    actionBtn.click();
    // After the click, an error-variant toast replaces the undo toast.
    const after = win.body.firstChild;
    assert.ok(after, 'error toast mounted');
    assert.ok(
      after.className.includes('toast--error'),
      `expected error variant; got className="${after.className}"`,
    );
    assert.ok(
      after.textContent.includes("Couldn't undo — try again"),
      'error message rendered',
    );
  });

  test('undoFn returning null is silent (no error toast)', async () => {
    const { showUndoToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showUndoToast({ message: 'x', undoFn: () => null });
    const actionBtn = findByClass(win.body, 'toast-action');
    actionBtn.click();
    // Action-click dismisses the undo toast; no error toast appears.
    assert.equal(win.body.firstChild, null, 'no toast after silent null undo');
  });
});

describe('showErrorToast — D-73 (error variant, 4s auto-dismiss, no action)', () => {
  test('renders with toast--error class and auto-dismisses after 4s', async () => {
    const { showErrorToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showErrorToast("Couldn't mark — try again");
    const t = win.body.firstChild;
    assert.ok(t, 'mounted');
    assert.ok(t.className.includes('toast--error'), 'error variant class');
    assert.ok(
      t.textContent.includes("Couldn't mark — try again"),
      'error message rendered',
    );
    clock.tick(3999);
    assert.ok(win.body.firstChild, 'still mounted at 3999ms');
    clock.tick(2);
    assert.equal(win.body.firstChild, null, 'removed after 4001ms');
  });

  test('no .toast-action button (error toast has no action)', async () => {
    const { showErrorToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showErrorToast('x');
    const actionBtn = findByClass(win.body, 'toast-action');
    assert.equal(actionBtn, null, 'no action button on error toast');
  });

  test('dismiss button removes the error toast', async () => {
    const { showErrorToast, _resetToastForTest } = await freshToast();
    _resetToastForTest();

    showErrorToast('x');
    const close = findByClass(win.body, 'toast-close');
    assert.ok(close, 'dismiss button rendered');
    close.click();
    assert.equal(win.body.firstChild, null, 'toast removed after dismiss click');
  });
});

describe('XSS-safety: toast.js source contains no .innerHTML family tokens', () => {
  test('no .innerHTML / .outerHTML / .insertAdjacentHTML in js/views/toast.js', () => {
    const path = fileURLToPath(new URL('../../js/views/toast.js', import.meta.url));
    const src = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.equal(
      src.match(/\.(innerHTML|outerHTML|insertAdjacentHTML)\b/),
      null,
      'D-78: no unsafe-HTML setter introduced',
    );
  });
});

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
