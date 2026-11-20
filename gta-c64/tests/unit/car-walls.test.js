// SPDX-License-Identifier: GPL-2.0-or-later
// Cars and walls: a car never goes into or through a building, a tree or the edge of the map. Hitting one stops
// it, bounces it back a little and, above a gentle bump, damages it.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { KIND, MW } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { mulberry } from '../../js/util.js';
import { mkCar } from '../../js/entities.js';
import { carHits, carPhys } from '../../js/cars.js';

const DT = 1 / 60;
const NORTH = -Math.PI / 2,
  EAST = 0,
  WEST = Math.PI;
// The hospital, St. Invoice, fills tiles 15 to 22 both ways: x and y from 240 to 368. Pavement runs round it.
const HOSPITAL = { left: 240, right: 368, top: 240, bottom: 368 };
const speed = (c) => Math.hypot(c.vx, c.vy);
/** Drive for `seconds`, checking after every step that the car is clear of every wall, and calling `each`. */
function drive(c, seconds, thr, steer = 0, hb = false, each = () => {}) {
  for (let i = 0; i < seconds * 60; i++) {
    carPhys(c, thr, steer, DT, hb);
    assert.ok(
      !carHits(c, c.x, c.y),
      `in a wall at ${c.x.toFixed(1)},${c.y.toFixed(1)}, heading ${c.a.toFixed(2)}`,
    );
    each();
  }
}
const inHospital = (c) =>
  c.x > HOSPITAL.left && c.x < HOSPITAL.right && c.y > HOSPITAL.top && c.y < HOSPITAL.bottom;

before(() => genMap());

test('steering into a wall while driving along it does not take the car into the building', () => {
  // On the pavement west of the hospital, heading north up its wall, steering towards it at full speed:
  // how the player drove through St. Invoice.
  for (const kind of [KIND.sedan, KIND.sports, KIND.police, KIND.van, KIND.limo]) {
    const c = mkCar(kind, HOSPITAL.left - 9, HOSPITAL.bottom - 4, NORTH);
    c.vy = -kind.max * 0.9;
    // It scrapes up the wall (and the faster cars round the corner at the top): never into the building.
    const notInside = () =>
      assert.ok(!inHospital(c), `${kind.n} inside the hospital at ${c.x.toFixed(1)},${c.y.toFixed(1)}`);
    drive(c, 2, 1, 1, false, notInside);
    // Reversing gets it off the wall again.
    const { x, y } = c;
    drive(c, 1.5, -1, 0, false, notInside);
    assert.ok(
      Math.hypot(c.x - x, c.y - y) > 15,
      `${kind.n} stuck against the wall at ${x.toFixed(1)},${y.toFixed(1)}`,
    );
  }
});

test('hitting a building head on stops the car, bounces it back a little and damages it', () => {
  const c = mkCar(KIND.sports, HOSPITAL.left - 60, 300, EAST);
  c.vx = 200;
  let hitAt = null;
  for (let i = 0; i < 60 && hitAt === null; i++) {
    carPhys(c, 1, 0, DT);
    if (c.vx < 0) hitAt = c.x;
  }
  assert.ok(hitAt !== null, 'it hit the wall');
  assert.ok(c.vx < -20 && c.vx > -100, `bounced back at ${c.vx.toFixed(1)}, a little`);
  assert.ok(c.hp < KIND.sports.hp - 10, `took damage: hp ${c.hp.toFixed(1)}`);
  assert.ok(c.x < HOSPITAL.left && !carHits(c, c.x, c.y));
  drive(c, 1, 0);
  assert.ok(c.x < hitAt, 'and it rolled back away from the wall');
});

test('a gentle bump does no damage', () => {
  const c = mkCar(KIND.sedan, HOSPITAL.left - 20, 300, EAST);
  c.vx = 25;
  drive(c, 2, 0.05);
  assert.equal(c.hp, KIND.sedan.hp);
  assert.ok(c.x < HOSPITAL.left);
});

test('the edge of the map is a wall too', () => {
  const c = mkCar(KIND.sports, 40, 24, WEST);
  c.vx = -200;
  drive(c, 2, 1);
  assert.ok(c.x > 0 && c.x < 40);
  const d = mkCar(KIND.sports, MW * 16 - 40, 24, EAST);
  d.vx = 200;
  drive(d, 2, 1);
  assert.ok(d.x < MW * 16);
});

test('a car somehow overlapping a wall is moved out, not let through it', () => {
  const c = mkCar(KIND.sedan, HOSPITAL.left + 3, 300, EAST); // its nose is in the hospital
  assert.ok(carHits(c, c.x, c.y));
  c.vx = 150;
  carPhys(c, 1, 0, DT);
  assert.ok(!carHits(c, c.x, c.y), 'out of the wall after one step');
  assert.ok(c.x < HOSPITAL.left, `and on the outside, at x=${c.x.toFixed(1)}`);
  drive(c, 2, 1);
  assert.ok(c.x < HOSPITAL.left, 'and it stays outside');
});

test('random driving near buildings never puts any car in a wall', () => {
  // Starting spots on the pavements round several blocks, every car type, random throttle, steering and handbrake.
  const rnd = mulberry(1986);
  const spots = [
    [HOSPITAL.left - 9, 300],
    [HOSPITAL.right + 9, 300],
    [300, HOSPITAL.top - 9],
    [300, HOSPITAL.bottom + 9],
    [600, 232],
    [1000, 616],
    [1240, 1100],
  ];
  const kinds = Object.values(KIND);
  for (let run = 0; run < 400; run++) {
    const [x, y] = spots[run % spots.length];
    const c = mkCar(kinds[run % kinds.length], x, y, rnd() * Math.PI * 2);
    if (carHits(c, c.x, c.y)) continue; // a start that does not fit there
    for (let step = 0; step < 240; step++) {
      if (step % 20 === 0) {
        c.thr = rnd() * 2.4 - 0.8;
        c.steer = rnd() * 2 - 1;
        c.hbOn = rnd() < 0.2;
      }
      carPhys(c, Math.max(-1, Math.min(1, c.thr)), c.steer, DT, c.hbOn);
      assert.ok(
        !carHits(c, c.x, c.y),
        `run ${run} step ${step}: ${c.kind.n} in a wall at ${c.x.toFixed(1)},${c.y.toFixed(1)}`,
      );
    }
  }
});
