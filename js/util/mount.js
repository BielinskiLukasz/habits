/**
 * @file Single trusted DOM-construction helper (D-77, Pattern S2/S5).
 *
 * The only sanctioned path in `js/views/` to translate a `{tag, attrs, text,
 * children}` description tree into real DOM. Construction discipline:
 *   - Strings → text nodes via `createTextNode` (NEVER `.innerHTML`)
 *   - Object → `createElement(desc.tag)` + `setAttribute` + `textContent`
 *   - `children` → recursively `mount()` each entry
 *
 * Event delegation: when an attr is `data-action`, the helper looks up
 * `actions[v]` and registers it as a `click` listener (while still setting
 * the `data-action` attribute on the DOM so the attribute remains
 * inspectable for tests + a future global delegated listener).
 *
 * Document source: `parent.ownerDocument` — mount is a pure function of the
 * parent's owning document, which makes it Node-testable via a tiny fake
 * (see tests/unit/mount.test.js) without a `globalThis.document` seam.
 *
 * D-78 grep gate (tests/unit/discipline.xss.test.js) keeps `.innerHTML` /
 * `.outerHTML` / `.insertAdjacentHTML` / `document.write` out of this file
 * AND every other file under `js/`.
 *
 * Forbidden constructs in this file:
 *   - `.innerHTML` / `.outerHTML` / `.insertAdjacentHTML` / `document.write`
 *     (the D-78 grep gate makes them a CI failure).
 *   - Direct reads of `globalThis.document` — pass the parent in.
 */

/**
 * Build DOM from a description tree.
 *
 * Description shape (the `desc` argument):
 *   - `string` → renders a text node carrying that string
 *   - `{tag, text?, attrs?, children?}` → renders an element
 *
 * `actions` is a map from `data-action` attribute values to click handlers.
 * When an attr `data-action: 'markComplete'` is encountered, `actions.markComplete`
 * (if present) is wired as a click listener on the element; the attribute
 * itself is still set on the DOM for inspection and a possible future
 * delegated-click pattern.
 *
 * @param {string | {tag: string, text?: string, attrs?: Record<string, *>, children?: Array<string|object>}} desc
 * @param {object} parent element (must expose ownerDocument + appendChild)
 * @param {Record<string, (e?: Event) => void>} [actions]
 * @returns {object|undefined} the constructed element, or undefined for string children
 */
export function mount(desc, parent, actions = {}) {
  const doc = parent.ownerDocument;
  if (typeof desc === 'string') {
    parent.appendChild(doc.createTextNode(desc));
    return undefined;
  }
  const el = doc.createElement(desc.tag);
  const attrs = desc.attrs ?? {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'data-action') {
      const fn = actions[v];
      if (typeof fn === 'function') {
        el.addEventListener('click', fn);
      }
      el.setAttribute(k, String(v));
    } else {
      el.setAttribute(k, String(v));
    }
  }
  if (desc.text !== undefined) {
    el.textContent = String(desc.text);
  }
  const kids = desc.children ?? [];
  for (const c of kids) {
    mount(c, el, actions);
  }
  parent.appendChild(el);
  return el;
}
