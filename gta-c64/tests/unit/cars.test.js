// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { KIND } from '../../js/config.js';
import { genMap, solidAt } from '../../js/world.js';
import { mkCar } from '../../js/entities.js';
import { carHits, carPhys } from '../../js/cars.js';

const DT = 1 / 60;
const SOUTH = Math.PI / 2;
const speed = (c) => Math.hypot(c.vx, c.vy);
/** A car in the southbound lane of the westmost avenue, clear of the first junction. */
const onRoad = (kind = KIND.sedan) => mkCar(kind, 8, 60, SOUTH);
const drive = (c, seconds, thr, steer = 0, handbrake = false) => {
  for (let i = 0; i < seconds * 60; i++) carPhys(c, thr, steer, DT, handbrake);
};

before(() => genMap());

test('a car accelerates in a straight line up to its top speed', () => {
  const c = onRoad();
  drive(c, 6, 1);
  assert.ok(Math.abs(c.x - 8) < 0.01, 'stays in lane');
  assert.ok(c.y > 500, 'moves down the road');
  assert.ok(speed(c) > KIND.sedan.max * 0.97 && speed(c) <= KIND.sedan.max + 0.01, `speed ${speed(c)}`);
});

test('the sports car is faster than the van', () => {
  const s = onRoad(KIND.sports);
  const v = onRoad(KIND.van);
  drive(s, 3, 1);
  drive(v, 3, 1);
  assert.ok(s.y > v.y + 100);
});

test('a car coasts to a stop, and brakes much sooner', () => {
  const coasting = onRoad();
  const braking = onRoad();
  drive(coasting, 3, 1);
  drive(braking, 3, 1);
  const y0 = coasting.y;
  drive(coasting, 8, 0);
  drive(braking, 0.6, -1);
  assert.ok(speed(coasting) < 1, 'coasting car stops');
  assert.ok(speed(braking) < 20, 'braked hard');
  assert.ok(braking.y - y0 < (coasting.y - y0) / 2);
});

test('holding reverse backs the car up, slower than it drives forward', () => {
  const c = onRoad();
  c.y = 600;
  drive(c, 4, -1);
  assert.ok(c.y < 600);
  assert.ok(speed(c) <= KIND.sedan.max * 0.4 + 0.01);
});

test('gentle steering does not slide, the handbrake at speed does', () => {
  const gentle = onRoad(KIND.sports);
  drive(gentle, 1, 1);
  drive(gentle, 0.3, 1, 0.3);
  assert.ok(gentle.slide < 5, `gentle slide ${gentle.slide}`);
  assert.equal(gentle.sk, null, 'no skid marks');

  const wild = onRoad(KIND.sports);
  drive(wild, 2.5, 1);
  let worst = 0;
  for (let i = 0; i < 20; i++) {
    carPhys(wild, 0, 1, DT, true);
    worst = Math.max(worst, wild.slide);
  }
  assert.ok(worst > 30, `handbrake slide ${worst}`);
  assert.ok(wild.sk, 'leaves skid marks');
});

test('a building stops a car and damages it', () => {
  // Heading east from the second avenue, across the pavement, into the hospital (its wall is at x = 240).
  const c = mkCar(KIND.sedan, 200, 304, 0);
  drive(c, 4, 1);
  assert.ok(!carHits(c, c.x, c.y), 'never ends up inside a wall');
  assert.ok(!solidAt(c.x + c.kind.L / 2 - 4, c.y));
  assert.ok(c.x < 240, `stopped at the wall, x=${c.x}`);
  assert.ok(c.hp < KIND.sedan.hp, 'took damage');
});

test('carHits reports walls, not open road', () => {
  const c = onRoad();
  assert.equal(carHits(c, 8, 60), false);
  assert.equal(carHits(c, 300, 300), true, 'inside the hospital');
});
