// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MW } from '../../js/config.js';
import { genMap, wallAt, waterAt } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { mkPed } from '../../js/entities.js';
import { SWIM_SPEED, WALK_SPEED, updPlayer } from '../../js/player.js';
import { updPeds } from '../../js/peds.js';

const DT = 1 / 60;
// The canal block east of the first avenues: water from x = 816 to 944, quay on either side.
const MID_CANAL = { x: 880, y: 112 };
const QUAY = { x: 808, y: 112 };

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('water is not a wall for people, but the edge of the map is', () => {
  assert.equal(wallAt(MID_CANAL.x, MID_CANAL.y), false);
  assert.equal(wallAt(-1, 100), true);
  assert.equal(wallAt(100, MW * 16), true);
  assert.equal(wallAt(300, 300), true, 'a building');
});

test('the player can walk off the quay into the canal', () => {
  Object.assign(P, QUAY);
  K.right = true;
  for (let i = 0; i < 60; i++) updPlayer(DT);
  assert.ok(waterAt(P.x, P.y), `in the water at x=${P.x}`);
  assert.equal(P.swim, true);
});

test('swimming is much slower than walking', () => {
  Object.assign(P, MID_CANAL);
  K.left = true;
  const x0 = P.x;
  for (let i = 0; i < 60; i++) updPlayer(DT);
  const swum = x0 - P.x;
  assert.ok(Math.abs(swum - SWIM_SPEED) < 1, `swam ${swum} in a second`);
  assert.ok(SWIM_SPEED < WALK_SPEED / 2);
});

test('the player can swim back out onto dry land', () => {
  Object.assign(P, MID_CANAL);
  K.left = true;
  for (let i = 0; i < 6 * 60 && waterAt(P.x, P.y); i++) updPlayer(DT);
  assert.ok(!waterAt(P.x, P.y), 'reached the quay');
  updPlayer(DT);
  assert.equal(P.swim, false);
});

test('the player cannot shoot while swimming', () => {
  Object.assign(P, MID_CANAL);
  K.fire = true;
  updPlayer(DT);
  assert.equal(P.ammo, 12);
  assert.equal(G.bullets.length, 0);
});

test('a pedestrian who ends up in the water swims to the bank and stays out', () => {
  const p = mkPed(MID_CANAL.x, MID_CANAL.y, 'civ');
  G.peds.push(p);
  let wet = 0;
  for (let i = 0; i < 15 * 60; i++) {
    updPeds(DT);
    if (waterAt(p.x, p.y)) wet = i;
  }
  assert.ok(!waterAt(p.x, p.y), 'out of the water');
  assert.ok(wet > 60, 'it took a while');
  assert.ok(wet < 10 * 60, `stayed out once ashore (last wet at frame ${wet})`);
});

test('a police officer chasing a swimmer is slowed by the water too', () => {
  Object.assign(P, { x: 930, y: 112 });
  G.heat = 1;
  const cop = mkPed(830, 112, 'cop');
  G.peds.push(cop);
  for (let i = 0; i < 60; i++) updPeds(DT);
  const moved = cop.x - 830;
  assert.ok(moved > 5 && moved < cop.spd * 0.5, `moved ${moved} in a second`);
});
