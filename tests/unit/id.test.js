/**
 * @file Unit tests for js/util/id.js (D-42, Pitfall 13).
 *
 * Asserts:
 *   1. Primary path — newId() returns an RFC 4122 v4 UUID via crypto.randomUUID
 *   2. Uniqueness — 100 ids generated have zero collisions
 *   3. First fallback — when crypto.randomUUID is missing, getRandomValues
 *      path produces a valid v4 UUID
 *   4. Last-resort fallback — when BOTH are missing, the Math.random path
 *      still produces a v4 UUID (acknowledged collision risk; documented)
 *
 * Fallback tests save/restore `globalThis.crypto.randomUUID` and
 * `crypto.getRandomValues` so test order does not matter and the
 * test runner's own usage of crypto is not disturbed.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../../js/util/id.js';

const V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('newId — primary path', () => {
  test('returns an RFC 4122 v4 UUID string', () => {
    const id = newId();
    assert.equal(typeof id, 'string');
    assert.match(id, V4_REGEX, `expected v4 UUID, got ${id}`);
  });

  test('100 calls produce 100 distinct values (no collisions)', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(newId());
    assert.equal(ids.size, 100);
  });
});

describe('newId — getRandomValues fallback (no randomUUID)', () => {
  let originalCrypto;

  beforeEach(() => {
    originalCrypto = globalThis.crypto;
    // Build a partial crypto: getRandomValues but NO randomUUID.
    // Why redefine via Object.defineProperty: `crypto` on Node 24+ is a
    // non-writable accessor, so a plain assignment throws.
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: originalCrypto,
    });
  });

  test('returns a v4 UUID via getRandomValues', () => {
    const id = newId();
    assert.match(id, V4_REGEX, `expected v4 UUID from getRandomValues fallback, got ${id}`);
  });
});

describe('newId — Math.random last-resort fallback (no crypto at all)', () => {
  let originalCrypto;

  beforeEach(() => {
    originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: originalCrypto,
    });
  });

  test('returns a v4 UUID via Math.random when no crypto is available', () => {
    const id = newId();
    assert.match(id, V4_REGEX, `expected v4 UUID from Math.random fallback, got ${id}`);
  });
});
