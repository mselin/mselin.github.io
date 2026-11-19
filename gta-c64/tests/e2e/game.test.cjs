// SPDX-License-Identifier: GPL-2.0-or-later
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('./helpers.cjs');

let game;
beforeEach(async () => {
  game = await openGame();
});
afterEach(async () => {
  const errors = game.errors;
  await game.close();
  assert.deepEqual(errors, [], 'the page logged errors');
});

test('boots, shows the title, and starts on fire', async () => {
  assert.equal(await game.screen(), 'boot');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'title');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  const world = await game.read((s) => ({ cars: s.G.cars.length, hp: s.P.hp, cash: s.G.cash }));
  assert.ok(world.cars > 10, 'parked cars exist');
  assert.equal(world.hp, 100);
  assert.equal(world.cash, 0);
  await game.until((s) => s.G.peds.length > 5 && s.G.cars.some((c) => c.ai === 'traffic'));
});

test('the player walks, takes a car and drives it', async () => {
  await game.start();
  const x0 = await game.read((s) => s.P.x);
  await game.page.keyboard.down('ArrowRight');
  await game.wait(500);
  await game.page.keyboard.up('ArrowRight');
  assert.ok((await game.read((s) => s.P.x)) > x0 + 15, 'walked right');

  await game.press('KeyE');
  await game.until((s) => s.P.car);
  await game.page.keyboard.down('ArrowUp');
  await game.until((s) => Math.hypot(s.P.car.vx, s.P.car.vy) > 60);
  await game.page.keyboard.up('ArrowUp');
  await game.until((s) => Math.hypot(s.P.car.vx, s.P.car.vy) < 40);
  await game.press('KeyE');
  await game.until((s) => !s.P.car);
});

test('the handbrake makes a fast car slide and leave skid marks', async () => {
  await game.start();
  await game.read((s) => {
    const car = s.mkCar(s.KIND.sports, 2 * 192 + 8, 250, Math.PI / 2, 2);
    s.G.cars = s.G.cars.filter((c) => c.parked);
    s.G.cars.push(car);
    s.P.car = car;
  });
  await game.page.keyboard.down('ArrowUp');
  await game.until((s) => Math.hypot(s.P.car.vx, s.P.car.vy) > 180);
  assert.equal(await game.read((s) => !!s.P.car.sk), false, 'no marks while driving straight');
  await game.page.keyboard.down('KeyX');
  await game.page.keyboard.down('ArrowLeft');
  await game.until((s) => s.P.car.slide > 30 && s.P.car.sk);
});

test('crime raises the heat and brings the police', async () => {
  await game.start();
  await game.read((s) => s.crime(70));
  assert.equal(await game.read((s) => s.G.heat), 3);
  await game.until((s) => s.G.cars.some((c) => c.ai === 'cop'), 15000);
});

test('a job starts with a timer and a target', async () => {
  await game.start();
  await game.read((s) => s.startJob());
  const job = await game.read((s) => ({ title: s.G.job.def.t, t: s.G.job.t, hasTarget: !!s.G.job.target }));
  assert.equal(job.title, 'PIZZA? SURE.');
  assert.ok(job.t > 60 && job.hasTarget);
});

test('Esc asks before returning to the title screen, and the game is kept', async () => {
  await game.start();
  await game.read((s) => (s.G.cash = 1234));
  await game.press('Escape');
  await game.until((s) => s.G.quitAsk);
  const frozenAt = await game.read((s) => s.G.clock);
  await game.wait(300);
  assert.equal(await game.screen(), 'play');
  await game.press('KeyN');
  await game.until((s) => !s.G.quitAsk);
  assert.equal(await game.screen(), 'play');
  assert.ok(frozenAt > 0);

  await game.press('Escape');
  await game.press('KeyY');
  await game.until((s) => s.G.screen === 'title');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  assert.equal(await game.read((s) => s.G.cash), 1234);
});
