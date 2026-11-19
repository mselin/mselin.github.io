// SPDX-License-Identifier: GPL-2.0-or-later
// Regression tests for faults found in code review.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KIND } from '../../js/config.js';
import { footClear, genMap, wallAt, waterAt } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { mkCar } from '../../js/entities.js';
import { carPhys, sidePos } from '../../js/cars.js';
import { updPlayer } from '../../js/player.js';
import { updBullets } from '../../js/items.js';

const DT = 1 / 60;
// The hospital's west wall is at x = 240; the pavement beside it runs from x = 224.
const WALL_X = 240;

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('footClear needs room for the whole footprint, not just the middle', () => {
  assert.equal(wallAt(WALL_X - 1, 304), false, 'the middle is on the pavement');
  assert.equal(footClear(WALL_X - 1, 304), false, 'but the feet overlap the wall');
  assert.equal(footClear(WALL_X - 4, 304), true);
});

test('getting out of a car parked tight against a wall never leaves the player in it', () => {
  // Facing north, so one door opens onto the wall and its 12 px step lands a pixel short of it.
  for (const x of [225, 227, 229, 231, 233]) {
    for (const a of [-Math.PI / 2, Math.PI / 2, 0.4, 2]) {
      const spot = sidePos(mkCar(KIND.sedan, x, 304, a));
      assert.ok(spot, `a way out at x=${x}, a=${a}`);
      assert.ok(footClear(spot.x, spot.y), `room to stand at x=${x}, a=${a}`);
    }
  }
});

test('a player who is inside a wall anyway can walk back out', () => {
  Object.assign(P, { x: WALL_X + 1, y: 304 });
  K.left = true;
  for (let i = 0; i < 30; i++) updPlayer(DT);
  assert.ok(P.x < WALL_X - 3, `walked out to x=${P.x}`);
  K.left = false;
  K.right = true;
  for (let i = 0; i < 60; i++) updPlayer(DT);
  assert.ok(P.x <= WALL_X - 3, 'and cannot walk back in');
});

test('a wreck pushed into the canal floods like any other car', () => {
  const c = mkCar(KIND.sedan, 800, 100, 0);
  c.dead = true;
  c.vx = 140;
  for (let i = 0; i < 120; i++) carPhys(c, 0, 0, DT);
  assert.ok(waterAt(c.x, c.y));
  assert.equal(c.flooded, true);
});

test('water puts out a burning car before it can explode', () => {
  const c = mkCar(KIND.sedan, 790, 100, 0);
  c.hp = 0;
  c.burn = 2;
  for (let i = 0; i < 180; i++) carPhys(c, 1, 0, DT);
  assert.equal(c.flooded, true);
  assert.equal(c.burn, 0);
  assert.ok(c.hp > 0, 'no longer about to catch fire again');
});

test('bullets hit a car that is still sinking, but pass over one on the bottom', () => {
  const shoot = (sink) => {
    const c = mkCar(KIND.sedan, 880, 112, 0);
    c.flooded = true;
    c.sink = sink;
    G.cars = [c];
    G.bullets = [{ x: 880, y: 112, vx: 0, vy: 0, l: 0.5, own: 0 }];
    updBullets(DT);
    return { hp: c.hp, bullets: G.bullets.length };
  };
  assert.deepEqual(shoot(0.2), { hp: KIND.sedan.hp - 20, bullets: 0 });
  assert.deepEqual(shoot(1), { hp: KIND.sedan.hp, bullets: 1 });
});
