// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { KIND } from '../../js/config.js';
import { genMap, nearestLand, solidAt, wallAt, waterAt } from '../../js/world.js';
import { mkCar, sinkStage } from '../../js/entities.js';
import { carHits, carPhys, sinkStep, wetness } from '../../js/cars.js';
import { G, P } from '../../js/state.js';

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
  // Towards the middle of the road: the other way is the edge of the map, 8 pixels off.
  drive(gentle, 0.3, 1, -0.3);
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

/** A car on the avenue west of the canal, pointing east at the water (which starts at x = 816). */
const atCanal = (kind = KIND.sedan) => mkCar(kind, 776, 100, 0);

test('water does not block a car the way a wall does', () => {
  assert.ok(waterAt(880, 100) && solidAt(880, 100), 'the canal is water, and nobody walks on it');
  assert.equal(wallAt(880, 100), false);
  assert.equal(wallAt(300, 300), true, 'a building is a wall');
  assert.equal(carHits(atCanal(), 880, 100), false);
});

test('a car driven into the canal floods, stops, and does not blow up', () => {
  const c = atCanal();
  drive(c, 3, 1);
  assert.equal(c.flooded, true);
  assert.ok(c.x > 816 && c.x < 944, `came to rest in the canal, x=${c.x}`);
  assert.ok(speed(c) < 1, 'stopped');
  assert.equal(c.hp, KIND.sedan.hp, 'no damage');
  assert.equal(c.dead, false);
  assert.ok(!c.burn, 'not on fire');
});

test('a flooded car no longer responds to the controls', () => {
  const c = atCanal();
  drive(c, 6, 1);
  const { x, y, a } = c;
  drive(c, 2, 1, 1);
  drive(c, 2, -1, -1, true);
  assert.equal(c.a, a, 'does not turn');
  assert.ok(Math.hypot(c.x - x, c.y - y) < 0.5, 'does not move');
});

test('the driver of a flooding car is left swimming where it went down', () => {
  const c = atCanal();
  P.car = c;
  drive(c, 3, 1);
  assert.equal(P.car, null, 'no longer in the car');
  assert.ok(waterAt(P.x, P.y), 'in the water');
  assert.ok(Math.hypot(P.x - c.x, P.y - c.y) < 40, 'where the car went in');
  assert.equal(P.swim, true);
  assert.match(G.msgTxt, /SWIM FOR IT/);
});

test('nearestLand finds the bank from the middle of the canal', () => {
  const land = nearestLand(880, 112);
  assert.ok(land && !solidAt(land.x, land.y));
  assert.deepEqual(nearestLand(8, 60), { x: 8, y: 60 }, 'already on land');
});

test('wetness counts how much of the car is over water', () => {
  const c = atCanal();
  assert.equal(wetness(c), 0);
  c.x = 812; // nose over the edge
  assert.equal(wetness(c), 1 / 3);
  c.x = 818; // nose and middle
  assert.equal(wetness(c), 2 / 3);
  c.x = 830;
  assert.equal(wetness(c), 1);
});

test('a car with only its nose in the water is slowed, not flooded, and can back out', () => {
  const c = atCanal();
  c.x = 812;
  drive(c, 1.5, -1);
  assert.equal(c.flooded, false);
  assert.ok(c.x < 800, `reversed onto the quay, x=${c.x}`);
  assert.equal(wetness(c), 0);
});

test('water slows a car down before it floods', () => {
  const c = atCanal(KIND.sports);
  c.x = 700;
  let dry = 0,
    deepest = Infinity;
  for (let i = 0; i < 600 && !c.flooded; i++) {
    if (wetness(c) === 0) dry = speed(c);
    carPhys(c, 1, 0, DT);
    if (wetness(c) >= 2 / 3) deepest = Math.min(deepest, speed(c));
  }
  assert.ok(dry > 60, `arrived at speed ${dry}`);
  assert.ok(deepest < dry * 0.8, `slowed from ${dry} to ${deepest} while wading in`);
  assert.equal(c.flooded, true);
});

test('a flooded car sinks in stages and then stays down', () => {
  const c = atCanal();
  assert.equal(sinkStage(c), 0);
  drive(c, 3, 1);
  assert.equal(c.flooded, true);
  const seen = new Set();
  for (let i = 0; i < 6 * 60; i++) {
    sinkStep(c, DT);
    seen.add(sinkStage(c));
  }
  assert.deepEqual([...seen], [1, 2, 3], 'awash, then under, then on the bottom');
  assert.equal(c.sink, 1);
  assert.equal(c.dead, false);
});
