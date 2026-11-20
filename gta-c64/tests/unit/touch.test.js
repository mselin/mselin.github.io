// SPDX-License-Identifier: GPL-2.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIND } from '../../js/config.js';
import { mkCar } from '../../js/entities.js';
import { carPhys } from '../../js/cars.js';
import { genMap } from '../../js/world.js';
import { driveToward, walkToward } from '../../js/player.js';
import { ICONS, iconSvg } from '../../js/icons.js';

const SOUTH = Math.PI / 2;
/** A car at (100, 100) facing south, moving at `fwd` pixels a second (negative is reversing). */
const carGoing = (fwd = 0) => {
  const c = mkCar(KIND.sedan, 100, 100, SOUTH);
  c.vy = fwd;
  return c;
};

test('on foot the player walks straight at the finger', () => {
  const way = walkToward(100, 100, 130, 140);
  assert.ok(Math.abs(Math.hypot(way.dx, way.dy) - 1) < 1e-9, 'a unit vector');
  assert.ok(Math.abs(way.dx - 0.6) < 1e-9 && Math.abs(way.dy - 0.8) < 1e-9);
  assert.equal(walkToward(100, 100, 103, 102), null, 'a finger on the player means stand still');
});

test('a finger ahead of the car drives it on, faster the further away it is', () => {
  const near = driveToward(carGoing(), 100, 130);
  const far = driveToward(carGoing(), 100, 300);
  assert.ok(near.thr > 0 && near.thr < far.thr, `near ${near.thr}, far ${far.thr}`);
  assert.equal(far.thr, 1);
  assert.equal(far.steer, 0, 'dead ahead needs no steering');
});

test('a finger to one side steers that way, and eases off in a tight turn', () => {
  // Screen y points down, so a car facing south turns towards the east by decreasing its heading angle.
  const east = driveToward(carGoing(60), 200, 160);
  const west = driveToward(carGoing(60), 0, 160);
  assert.ok(east.steer < 0 && west.steer > 0, `east ${east.steer}, west ${west.steer}`);
  const sharp = driveToward(carGoing(60), 0, 110);
  assert.equal(sharp.steer, 1);
  assert.ok(sharp.thr <= 0.4, 'slows for a right-angle turn');
});

test('a finger on the car brakes it, whichever way it is going', () => {
  assert.deepEqual(driveToward(carGoing(120), 104, 104), { thr: -1, steer: 0 });
  assert.deepEqual(driveToward(carGoing(-60), 104, 104), { thr: 1, steer: 0 });
  assert.deepEqual(driveToward(carGoing(0), 104, 104), { thr: 0, steer: 0 });
});

test('a finger behind the car brakes, then reverses towards it', () => {
  assert.deepEqual(
    driveToward(carGoing(120), 100, 20),
    { thr: -1, steer: 0 },
    'brakes in a straight line first',
  );
  const back = driveToward(carGoing(0), 100, 20);
  assert.equal(back.thr, -1);
  assert.ok(Math.abs(back.steer) < 1e-9, 'straight back needs no steering');
  // Let the physics run: holding a finger behind and to one side, the car backs up towards it.
  genMap();
  const c = mkCar(KIND.sedan, 2 * 192 + 8, 300, SOUTH);
  const target = { x: 2 * 192 + 40, y: 200 };
  const gap = () => Math.hypot(target.x - c.x, target.y - c.y);
  const before = gap();
  for (let i = 0; i < 90; i++) {
    const ctl = driveToward(c, target.x, target.y);
    carPhys(c, ctl.thr, ctl.steer, 1 / 60);
  }
  assert.ok(gap() < before - 40, `from ${before} to ${gap()}`);
  assert.ok(c.x > 2 * 192 + 8, 'and its tail swung towards the finger');
});

test('every icon is 16 by 16, uses only colours it knows, and draws something', () => {
  for (const [name, rows] of Object.entries(ICONS)) {
    assert.equal(rows.length, 16, name);
    for (const row of rows) assert.equal(row.length, 16, `${name}: ${row}`);
    const svg = iconSvg(name);
    assert.ok(!svg.includes('undefined'), `${name} uses a letter with no colour`);
    assert.ok((svg.match(/<rect/g) || []).length >= 5, name);
  }
});
