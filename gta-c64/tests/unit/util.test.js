// SPDX-License-Identifier: GPL-2.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angDiff, clamp, hash, mod, mulberry } from '../../js/util.js';

test('clamp keeps a value inside its range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(42, 0, 10), 10);
});

test('mod is never negative', () => {
  assert.equal(mod(7, 5), 2);
  assert.equal(mod(-1, 5), 4);
  assert.equal(mod(-10, 5), 0);
});

test('angDiff takes the short way round', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  close(angDiff(0.2, 0.1), 0.1);
  close(angDiff(0.1, 2 * Math.PI - 0.1), 0.2);
  close(angDiff(-3, 3), 2 * Math.PI - 6);
});

test('mulberry is a repeatable generator of numbers in [0, 1)', () => {
  const a = mulberry(64064);
  const b = mulberry(64064);
  for (let i = 0; i < 200; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(mulberry(1)(), mulberry(2)());
});

test('hash is stable and unsigned', () => {
  assert.equal(hash(3, 4), hash(3, 4));
  assert.notEqual(hash(3, 4), hash(4, 3));
  assert.ok(hash(-5, 9) >= 0);
});
