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

test('driving into the canal floods the car and puts the player ashore', async () => {
  await game.start();
  await game.read((s) => {
    const car = s.mkCar(s.KIND.sedan, 776, 100, 0, 2);
    s.G.cars = s.G.cars.filter((c) => c.parked);
    s.G.cars.push(car);
    s.P.car = car;
    window.testCar = car;
  });
  await game.page.keyboard.down('ArrowUp');
  await game.until(() => window.testCar.flooded);
  await game.page.keyboard.up('ArrowUp');
  await game.until((s) => !s.P.car);
  await game.wait(1500);
  const car = await game.page.evaluate(() => ({
    dead: window.testCar.dead,
    burn: window.testCar.burn,
    speed: Math.hypot(window.testCar.vx, window.testCar.vy),
  }));
  assert.deepEqual([car.dead, !!car.burn], [false, false], 'the car does not explode');
  assert.ok(car.speed < 2, 'the car has stopped');
  await game.until(() => window.testCar.sink >= 1, 10000);

  // The driver is in the canal (x 816 to 944) and can swim back to the quay.
  const x0 = await game.read((s) => s.P.x);
  assert.ok(x0 > 816 && x0 < 944, `swimming at x=${x0}`);
  assert.equal(await game.read((s) => s.P.swim), true);
  await game.page.keyboard.down('ArrowLeft');
  await game.until((s) => s.P.x < 812 && !s.P.swim, 10000);
  await game.page.keyboard.up('ArrowLeft');

  // The flooded car cannot be taken again.
  await game.read((s) => {
    s.P.x = window.testCar.x;
    s.P.y = window.testCar.y;
  });
  await game.press('KeyE');
  await game.wait(200);
  assert.equal(await game.read((s) => !!s.P.car), false);
});

test('an arrest with money left costs a fine and the game goes on', async () => {
  await game.start();
  await game.read((s) => {
    s.G.cash = 1000;
    s.down('busted');
  });
  await game.until((s) => s.G.screen === 'play' && s.G.cash === 800);
});

test('an arrest with no money ends the game; N returns to the title for a fresh start', async () => {
  await game.start();
  await game.read((s) => {
    s.crime(70);
    s.P.ammo = 3;
    s.down('busted');
  });
  await game.until((s) => s.G.screen === 'over');
  await game.wait(1200);
  await game.press('KeyN');
  await game.until((s) => s.G.screen === 'title');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  const fresh = await game.read((s) => ({
    cash: s.G.cash,
    heat: s.G.heat,
    hp: s.P.hp,
    ammo: s.P.ammo,
    job: s.G.job,
    msg: s.G.msgTxt,
  }));
  assert.deepEqual([fresh.cash, fresh.heat, fresh.hp, fresh.ammo, fresh.job], [0, 0, 100, 12, null]);
  assert.match(fresh.msg, /YOU WAKE UP OUTSIDE/);
});

test('the game-over screen ignores keys for a moment, then Y starts a new game', async () => {
  await game.start();
  await game.read((s) => s.down('busted'));
  await game.until((s) => s.G.screen === 'over');
  await game.press('KeyY');
  await game.wait(200);
  assert.equal(await game.screen(), 'over', 'too early to answer');
  await game.wait(1100);
  await game.press('KeyY');
  await game.until((s) => s.G.screen === 'play' && s.P.hp === 100 && s.G.cars.length > 10);
});

test('reaching the goal shows the victory screen, and Y starts over from nothing', async () => {
  await game.start();
  await game.read((s) => {
    s.G.cash = 24000;
    s.startJob();
    s.passJob();
  });
  await game.until((s) => s.G.screen === 'win');
  await game.wait(1200);
  await game.press('KeyY');
  await game.until((s) => s.G.screen === 'play');
  assert.equal(await game.read((s) => s.G.cash), 0);
  // The second game starts with the first job again.
  await game.read((s) => s.startJob());
  assert.equal(await game.read((s) => s.G.job.def.t), 'PIZZA? SURE.');
});

test('the election fund can also be filled with loose cash, not only by finishing a job', async () => {
  await game.start();
  await game.read((s) => (s.G.cash = 25000));
  await game.until((s) => s.G.screen === 'win');
});

test('delivering the limo leaves the player standing somewhere they can walk from', async () => {
  await game.start();
  await game.read((s) => {
    for (let i = 0; i < 2; i++) {
      s.startJob();
      s.passJob();
    }
    s.G.cash = 0;
    s.startJob();
    if (s.G.job.def.type !== 'steal') throw new Error('expected the limo job');
    const limo = s.G.job.car;
    // Parked hard against the chop shop wall, the worst case for getting out.
    limo.x = 1264;
    limo.y = 1193;
    limo.a = 0;
    s.P.car = limo;
  });
  await game.until((s) => !s.G.job && !s.P.car);
  const x0 = await game.read((s) => s.P.x);
  await game.page.keyboard.down('ArrowLeft');
  await game.until(`(s) => s.P.x < ${x0} - 10`);
});
