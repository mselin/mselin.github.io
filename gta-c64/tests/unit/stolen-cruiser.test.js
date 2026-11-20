// SPDX-License-Identifier: GPL-2.0-or-later
// Driving a police car where the police can see it: they know their own cruisers, and know the player is not
// one of them. The heat goes up to at least STOLEN_CRUISER_HEAT.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HT, KIND, NOTICE, STOLEN_CRUISER_HEAT } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { mkCar, mkPed } from '../../js/entities.js';
import { crime, updHeat } from '../../js/heat.js';

const X = 488,
  Y = 600; // on a road, away from the paint shop
let mine;

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.cars = [];
  G.peds = [];
  mine = mkCar(KIND.police, X, Y, 0);
  G.cars.push(mine);
  P.car = mine;
  P.x = X;
  P.y = Y;
});

/** A police car on patrol in ordinary traffic, `d` pixels east of the player. */
function patrol(d) {
  const c = mkCar(KIND.police, X + d, Y, 0);
  c.ai = 'traffic';
  c.driver = true;
  G.cars.push(c);
  return c;
}
/** A police car already chasing, `d` pixels east of the player. */
function chaser(d) {
  const c = mkCar(KIND.police, X + d, Y, 0);
  c.ai = 'cop';
  G.cars.push(c);
  return c;
}

test('a patrol car in traffic spots the stolen cruiser, even with no heat at all', () => {
  assert.equal(G.heat, 0);
  patrol(NOTICE.patrol - 10);
  updHeat(1 / 30);
  assert.equal(G.heat, STOLEN_CRUISER_HEAT);
  assert.equal(STOLEN_CRUISER_HEAT, 2);
  assert.match(G.msgTxt, /KNOW THAT CRUISER/);
});

test('so does a police car already chasing, or an officer on foot', () => {
  chaser(NOTICE.car - 10);
  updHeat(1 / 30);
  assert.equal(G.heat, 2);

  resetState();
  G.screen = 'play';
  G.cars = [mine];
  P.car = mine;
  P.x = X;
  P.y = Y;
  G.peds = [mkPed(X + NOTICE.foot - 10, Y, 'cop')];
  updHeat(1 / 30);
  assert.equal(G.heat, 2);
});

test('at heat 1 it goes up to 2', () => {
  crime(HT[1]);
  assert.equal(G.heat, 1);
  patrol(60);
  updHeat(1 / 30);
  assert.equal(G.heat, 2);
});

test('more heat than that is left as it is', () => {
  crime(HT[4]);
  patrol(60);
  updHeat(1 / 30);
  assert.equal(G.heat, 4);
});

test('police too far away do not notice', () => {
  patrol(NOTICE.patrol + 10);
  chaser(NOTICE.car + 10);
  G.peds = [mkPed(X - NOTICE.foot - 10, Y, 'cop')];
  updHeat(1 / 30);
  assert.equal(G.heat, 0);
});

test('an empty or wrecked police car notices nothing', () => {
  const empty = patrol(60);
  empty.driver = false;
  const wreck = patrol(-60);
  wreck.dead = true;
  updHeat(1 / 30);
  assert.equal(G.heat, 0);
});

test('only a police car gives the player away, and only while driving it', () => {
  P.car = mkCar(KIND.sedan, X, Y, 0);
  G.cars = [P.car];
  patrol(60);
  updHeat(1 / 30);
  assert.equal(G.heat, 0, 'an ordinary car');

  P.car = null;
  updHeat(1 / 30);
  assert.equal(G.heat, 0, 'on foot');
});
