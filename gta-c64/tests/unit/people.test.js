// SPDX-License-Identifier: GPL-2.0-or-later
// People on foot: how big they are drawn, who looks like whom, and hits that match what is on screen.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HIT, KIND } from '../../js/config.js';
import { genMap } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { CIV_HAIR, CIV_LEGS, CIV_SHIRTS, mkCar, mkPed } from '../../js/entities.js';
import { COP, FIG, FRAME, OUTLINE, PLAYER_OUTLINE, figure, lookOf, outlineOf } from '../../js/figures.js';
import { updBullets } from '../../js/items.js';
import { updPeds } from '../../js/peds.js';
import { updPlayer } from '../../js/player.js';
import { updCars } from '../../js/cars.js';

const DT = 1 / 60;
const TYPES = ['civ', 'scoot', 'cop', 'cult'];
/** The filled cells of a figure, as [x, y] pairs. */
const cells = (grid) => [...grid].flatMap((c, i) => (c >= 0 ? [[i % FIG, Math.floor(i / FIG)]] : []));

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('people are drawn about as big as a swimmer: 10 to 12 px across, and fit their frames', () => {
  for (const p of [P, ...TYPES.map((t) => mkPed(0, 0, t))])
    for (const f of [0, 1]) {
      const c = cells(figure(p, f)),
        ys = c.map(([, y]) => y),
        across = Math.max(...ys) - Math.min(...ys) + 1;
      assert.ok(across >= 10 && across <= 12, `${p.type} is ${across} px across`);
      // The farthest corner of any cell from the middle, plus the outlines, must fit inside the frame
      // whichever way the figure is turned.
      const reach = Math.max(
        ...c.map(([x, y]) =>
          Math.hypot(
            Math.max(Math.abs(x - FIG / 2), Math.abs(x + 1 - FIG / 2)),
            Math.max(Math.abs(y - FIG / 2), Math.abs(y + 1 - FIG / 2)),
          ),
        ),
      );
      assert.ok(reach + outlineOf(p).length < FRAME / 2, `${p.type} fits its frame`);
      for (const [x, y] of c) {
        const col = figure(p, f)[y * FIG + x];
        assert.ok(Number.isInteger(col) && col >= 0 && col < 16, `${p.type} uses only the 16 colours`);
      }
    }
});

test('walkers have two strides; scooter riders and cultists hold still', () => {
  const same = (p) => figure(p, 0).every((c, i) => c === figure(p, 1)[i]);
  assert.equal(same(P), false);
  assert.equal(same(mkPed(0, 0, 'civ')), false);
  assert.equal(same(mkPed(0, 0, 'cop')), false);
  assert.equal(same(mkPed(0, 0, 'scoot')), true);
  assert.equal(same(mkPed(0, 0, 'cult')), true);
});

test("no pedestrian can get the player's look or a police officer's", () => {
  assert.equal(lookOf(P), 'player');
  assert.deepEqual(outlineOf(P), PLAYER_OUTLINE);
  const white = PLAYER_OUTLINE.at(-1);
  assert.ok(!OUTLINE.includes(white), 'the white outline is the player alone');
  assert.ok(!CIV_SHIRTS.includes(P.shirt), "nobody else wears the player's jacket");
  assert.ok(!CIV_SHIRTS.includes(COP.shirt) && !CIV_SHIRTS.includes(COP.legs), 'or a police shirt');
  assert.ok(!CIV_LEGS.includes(COP.legs), 'or police trousers');
  assert.ok(!CIV_HAIR.includes(COP.cap), 'or a white police cap');
  for (let i = 0; i < 500; i++) {
    for (const type of ['civ', 'scoot']) {
      const p = mkPed(0, 0, type);
      assert.notEqual(lookOf(p), 'player');
      assert.deepEqual(outlineOf(p), OUTLINE);
      assert.notEqual(p.shirt, P.shirt);
      assert.notEqual(p.shirt, COP.shirt);
      assert.notEqual(p.legs, COP.legs);
      assert.notEqual(p.hair, COP.cap);
      assert.notEqual(p.hair, p.shirt, 'a head never vanishes into the shirt');
    }
    const cop = mkPed(0, 0, 'cop');
    assert.deepEqual([cop.shirt, cop.legs, cop.hair], [COP.shirt, COP.legs, COP.cap]);
    assert.deepEqual(outlineOf(cop), OUTLINE);
  }
  // Once a cult meeting breaks up, its members become ordinary passers-by, still in their robes' colours.
  const cultist = Object.assign(mkPed(0, 0, 'cult'), { type: 'civ' });
  assert.deepEqual(outlineOf(cultist), OUTLINE);
  assert.notEqual(cultist.shirt, COP.shirt);
});

test("a police officer's white cap and gold badge are drawn, and no passer-by wears the uniform", () => {
  const has = (p, col) => [0, 1].some((f) => figure(p, f).includes(col));
  const cop = mkPed(0, 0, 'cop');
  assert.ok(has(cop, COP.cap) && has(cop, 7), 'white cap, gold badge');
  for (let i = 0; i < 200; i++) assert.equal(has(mkPed(0, 0, 'civ'), COP.shirt), false);
});

// A pedestrian on the pavement beside the hospital's west wall, or on the street north of it.
const PAVEMENT = { x: 226, y: 304 };
const STREET = { x: 300, y: 208 };
const standing = (x, y) => Object.assign(mkPed(x, y, 'civ'), { spd: 0, t: 9 });

test('a bullet hits someone it passes within HIT.shot of: their shoulders, as drawn', () => {
  const shoot = (dx, own) => {
    G.peds = [standing(PAVEMENT.x, PAVEMENT.y)];
    G.cars = [];
    Object.assign(P, { x: PAVEMENT.x, y: PAVEMENT.y, hp: 100 });
    G.bullets = [{ x: PAVEMENT.x + dx, y: PAVEMENT.y, vx: 0, vy: 0, l: 0.5, own }];
    updBullets(DT);
    return own ? P.hp < 100 : G.peds.length === 0;
  };
  assert.ok(HIT.shot > 5.5 && HIT.shot < 7);
  assert.equal(shoot(5.5, 0), true, 'the player shoots a pedestrian in the shoulder');
  assert.equal(shoot(-5.5, 0), true, 'either shoulder');
  assert.equal(shoot(7, 0), false, 'a near miss');
  assert.equal(shoot(5.5, 1), true, 'a police bullet hits the player the same way');
  assert.equal(shoot(7, 1), false);
});

test('a moving car runs over someone it passes within HIT.car of its middle', () => {
  const pass = (dy) => {
    const c = mkCar(KIND.sedan, STREET.x, STREET.y, 0);
    c.vx = 60;
    G.cars = [c];
    G.peds = [standing(STREET.x, STREET.y + dy)];
    updPeds(DT);
    return G.peds.length === 0;
  };
  assert.equal(pass(9.5), true, 'the side of the car catches their shoulder');
  assert.equal(pass(10.5), false, 'but not someone a pixel clear');
  // Its front reaches HIT.nose past the point 6 px ahead of its middle.
  const front = (dx) => {
    const c = mkCar(KIND.sedan, STREET.x, STREET.y, 0);
    c.vx = 60;
    G.cars = [c];
    G.peds = [standing(STREET.x + dx, STREET.y)];
    updPeds(DT);
    return G.peds.length === 0;
  };
  assert.equal(front(14.5), true, 'the bumper is 10 px ahead and a person 5 px deep');
  assert.equal(front(15.5), false);
});

test('the player on foot is hit by a car passing within HIT.car', () => {
  const pass = (dy) => {
    resetState();
    G.screen = 'play';
    const c = mkCar(KIND.sedan, STREET.x, STREET.y, 0);
    c.vx = 60;
    G.cars = [c];
    Object.assign(P, { x: STREET.x, y: STREET.y + dy });
    updPlayer(DT);
    return P.hp < 100;
  };
  assert.equal(pass(9.5), true);
  assert.equal(pass(10.5), false);
});

test('traffic brakes for anyone close enough to its line that it would hit them', () => {
  const brakes = (dy, who) => {
    resetState();
    const c = mkCar(KIND.sedan, STREET.x, STREET.y + 8, 0);
    Object.assign(c, { ai: 'traffic', dir: 0, driver: true, cruise: 60, sp: 60 });
    G.cars = [c];
    G.peds = [];
    Object.assign(P, { x: 2000, y: 2000 });
    if (who === 'ped') G.peds.push(standing(c.x + 20, c.y + dy));
    else Object.assign(P, { x: c.x + 20, y: c.y + dy });
    updCars(DT);
    return c.sp < 60;
  };
  for (const who of ['ped', 'player']) {
    assert.equal(brakes(8, who), true, `${who} 8 px off its line`);
    assert.equal(brakes(-8, who), true);
    assert.equal(brakes(12, who), false, `${who} well clear`);
  }
});
