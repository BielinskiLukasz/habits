/**
 * @file Unit tests for js/util/mount.js (D-77).
 *
 * `mount(desc, parent, actions)` is the single trusted DOM-construction seam
 * for the codebase (D-77, Pattern S2). It MUST construct elements via
 * `parent.ownerDocument.createElement` / `createTextNode` + textContent +
 * setAttribute — never `.innerHTML` family (D-78 grep gate covers this).
 *
 * Tests use a hand-rolled fake document that exposes:
 *   - createElement(tag) returning a fake element with appendChild, setAttribute,
 *     addEventListener, plus a `_listeners` map for assertion
 *   - createTextNode(text) returning a fake text node carrying nodeValue
 *
 * Pattern S8 (D-26 Tier 1) — pure-builder tests, no jsdom dependency.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../../js/util/mount.js';

/**
 * Tiny fake document that supports the surface `mount()` requires.
 * Each element exposes:
 *   - tagName, textContent, attributes, children, _listeners
 * Each text node exposes:
 *   - nodeType: 3, nodeValue
 *
 * @returns {{ createFakeParent: () => object, document: object }}
 */
function createFakeDom() {
  function makeElement(tag) {
    /** @type {Record<string, string>} */
    const attributes = {};
    /** @type {Map<string, Set<Function>>} */
    const listeners = new Map();
    /** @type {Array<object>} */
    const children = [];
    const el = {
      tagName: String(tag).toUpperCase(),
      textContent: '',
      attributes,
      children,
      _listeners: listeners,
      get ownerDocument() { return doc; },
      appendChild(node) {
        children.push(node);
        return node;
      },
      setAttribute(k, v) {
        attributes[k] = String(v);
      },
      getAttribute(k) {
        return attributes[k];
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
    };
    return el;
  }

  const doc = {
    createElement(tag) { return makeElement(tag); },
    createTextNode(text) {
      return { nodeType: 3, nodeValue: String(text) };
    },
  };

  return {
    document: doc,
    createFakeParent() {
      // The "parent" needs an ownerDocument that resolves createElement /
      // createTextNode, plus its own appendChild + children for assertions.
      return makeElement('div');
    },
  };
}

describe('mount — string child', () => {
  test('appends a text node with the string value', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const ret = mount('hello world', parent, {});
    assert.equal(parent.children.length, 1);
    assert.equal(parent.children[0].nodeType, 3);
    assert.equal(parent.children[0].nodeValue, 'hello world');
    assert.equal(ret, undefined, 'string children return undefined');
  });
});

describe('mount — empty element', () => {
  test('mount({tag: "div"}) appends a div with no children/text', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const el = mount({ tag: 'div' }, parent, {});
    assert.equal(parent.children.length, 1);
    assert.equal(el.tagName, 'DIV');
    assert.equal(el.textContent, '');
    assert.equal(el.children.length, 0);
  });
});

describe('mount — element with text', () => {
  test('sets textContent (never .innerHTML)', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const el = mount({ tag: 'div', text: 'hello' }, parent, {});
    assert.equal(el.textContent, 'hello');
    // No HTML parsing — textContent is plain string assignment.
    assert.equal(el.tagName, 'DIV');
  });
});

describe('mount — attrs via setAttribute', () => {
  test('aria-label propagates verbatim', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const el = mount(
      { tag: 'button', attrs: { 'aria-label': 'Dismiss' } },
      parent,
      {},
    );
    assert.equal(el.getAttribute('aria-label'), 'Dismiss');
  });

  test('non-string attribute values are coerced via String()', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const el = mount(
      { tag: 'button', attrs: { 'tabindex': -1, 'aria-pressed': true } },
      parent,
      {},
    );
    assert.equal(el.getAttribute('tabindex'), '-1');
    assert.equal(el.getAttribute('aria-pressed'), 'true');
  });
});

describe('mount — data-action click delegation', () => {
  test('attaches click handler from actions[v] and retains data-action attr', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    let calls = 0;
    const fn = () => { calls++; };
    const el = mount(
      { tag: 'button', attrs: { 'data-action': 'markComplete' } },
      parent,
      { markComplete: fn },
    );
    assert.equal(el.getAttribute('data-action'), 'markComplete');
    assert.ok(el._listeners.has('click'), 'click listener registered');
    const set = el._listeners.get('click');
    assert.equal(set.size, 1);
    // Verify the listener calls the action.
    for (const listener of set) listener();
    assert.equal(calls, 1);
  });

  test('data-action with no matching actions entry still sets the attribute but registers no listener', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const el = mount(
      { tag: 'button', attrs: { 'data-action': 'noSuchAction' } },
      parent,
      {},
    );
    assert.equal(el.getAttribute('data-action'), 'noSuchAction');
    assert.equal(el._listeners.has('click'), false);
  });
});

describe('mount — children recursion', () => {
  test('renders a <ul> with two <li> children carrying text', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const ul = mount(
      {
        tag: 'ul',
        children: [
          { tag: 'li', text: 'a' },
          { tag: 'li', text: 'b' },
        ],
      },
      parent,
      {},
    );
    assert.equal(ul.tagName, 'UL');
    assert.equal(ul.children.length, 2);
    assert.equal(ul.children[0].tagName, 'LI');
    assert.equal(ul.children[0].textContent, 'a');
    assert.equal(ul.children[1].tagName, 'LI');
    assert.equal(ul.children[1].textContent, 'b');
  });

  test('string children inside children[] append text nodes', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const span = mount(
      { tag: 'span', children: ['hello ', { tag: 'b', text: 'world' }] },
      parent,
      {},
    );
    assert.equal(span.children.length, 2);
    assert.equal(span.children[0].nodeType, 3);
    assert.equal(span.children[0].nodeValue, 'hello ');
    assert.equal(span.children[1].tagName, 'B');
    assert.equal(span.children[1].textContent, 'world');
  });
});

describe('mount — return value', () => {
  test('returns the constructed element when desc is an object', () => {
    const { createFakeParent } = createFakeDom();
    const parent = createFakeParent();
    const el = mount({ tag: 'p', text: 'hi' }, parent, {});
    assert.equal(el.tagName, 'P');
    // The same element is the one appended to parent.
    assert.equal(parent.children[0], el);
  });
});
