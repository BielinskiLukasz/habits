/**
 * @file UUID generation for habits, habit_versions, events (D-42).
 *
 * Primary path is `crypto.randomUUID()` — Baseline Widely Available in 2026
 * evergreen browsers, in Node 20+, and in service workers (Web Crypto API).
 *
 * Defense-in-depth fallback chain (Pitfall 13 — `crypto.randomUUID()` is
 * gated behind a secure context, and Safari's classification of `file://`
 * as a secure context has historically been inconsistent across versions):
 *
 *   1. `crypto.randomUUID()`               — primary; CSPRNG; standards-compliant
 *   2. `crypto.getRandomValues()` + bits   — first fallback; still CSPRNG
 *   3. `Math.random()` + bit twiddling     — last-resort; non-CSPRNG, documented
 *
 * The Math.random branch is a rare path: it only fires on legacy Safari +
 * `file://` where the entire Web Crypto API is unavailable. Collision risk
 * is acknowledged; over multi-year datasets a CSPRNG is preferable, but
 * generating ANY id is better than crashing on the seed write.
 */

/**
 * Generate a new RFC 4122 v4 UUID string.
 *
 * @returns {string} A v4 UUID like `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
 */
export function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    return uuidV4FromGetRandomValues();
  }
  // Last-resort fallback (Math.random — collision risk acknowledged; only
  // fires on very old browsers in non-secure contexts where Web Crypto is
  // entirely unavailable).
  return uuidV4FromMathRandom();
}

/**
 * RFC 4122 v4 UUID built from 16 random bytes via crypto.getRandomValues,
 * with the version + variant bits set per §4.4.
 *
 * @returns {string}
 */
function uuidV4FromGetRandomValues() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // Version = 4 (high nibble of byte 6); Variant = 10xx (high two bits of byte 8).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return (
    `${h.slice(0, 4).join('')}-` +
    `${h.slice(4, 6).join('')}-` +
    `${h.slice(6, 8).join('')}-` +
    `${h.slice(8, 10).join('')}-` +
    `${h.slice(10, 16).join('')}`
  );
}

/**
 * RFC 4122 v4 UUID built from Math.random — last-resort path only.
 *
 * @returns {string}
 */
function uuidV4FromMathRandom() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
