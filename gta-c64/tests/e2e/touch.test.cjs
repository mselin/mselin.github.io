// SPDX-License-Identifier: GPL-2.0-or-later
// The game on a phone: steering by holding a finger on the screen, the icon buttons, and full screen.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('./helpers.cjs');

const PHONE = 'Pixel 8 Pro landscape';
let game, cdp;

beforeEach(async () => {
  game = await openGame({ device: PHONE });
  cdp = await game.page.context().newCDPSession(game.page);
});
afterEach(async () => {
  const errors = game.errors;
  await game.close();
  assert.deepEqual(errors, [], 'the page logged errors');
});

/**
 * Put fingers on the screen at page positions. The list is every finger that stays down, by position in the
 * list: a finger missing from it is lifted, and touchEnd lifts them all.
 */
const fingers = (type, points) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
/** Where a point in the city is on the page. */
const onPage = (wx, wy) =>
  game.page.evaluate(
    ([wx, wy]) => {
      const s = window.sleazeburg,
        r = document.getElementById('c').getBoundingClientRect(),
        k = r.width / 384;
      return [r.left + (32 + wx - s.G.camX) * k, r.top + (36 + wy - s.G.camY) * k];
    },
    [wx, wy],
  );
const centre = async (selector) => {
  const b = await game.page.locator(selector).boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};
/** Tap the screen to get past the boot and title screens. */
async function startByTouch() {
  await game.page.touchscreen.tap(400, 200);
  await game.until((s) => s.G.screen === 'title');
  await game.page.touchscreen.tap(400, 200);
  await game.until((s) => s.G.screen === 'play');
}
/** Hold a finger at a fixed offset from the player (or their car) for a while, following them as they move. */
async function hold(dx, dy, ms) {
  const at = () => game.read((s) => ({ x: (s.P.car || s.P).x, y: (s.P.car || s.P).y }));
  let p = await at();
  await fingers('touchStart', [await onPage(p.x + dx, p.y + dy)]);
  for (const end = Date.now() + ms; Date.now() < end;) {
    await game.wait(100);
    p = await at();
    await fingers('touchMove', [await onPage(p.x + dx, p.y + dy)]);
  }
}
/** Put the player in a sports car, stopped on an open avenue, facing south. */
const intoCar = () =>
  game.read((s) => {
    const c = s.mkCar(s.KIND.sports, 2 * 192 + 8, 250, Math.PI / 2, 2);
    s.G.cars.push(c);
    s.P.car = c;
    s.P.x = c.x;
    s.P.y = c.y;
  });
const car = () =>
  game.read((s) => {
    const c = s.P.car;
    return { x: c.x, y: c.y, fwd: c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a) };
  });

test('on a phone the game fills the screen and the buttons are labelled icons, with no arrow pad', async () => {
  const layout = await game.page.evaluate(() => {
    const r = document.getElementById('c').getBoundingClientRect();
    return {
      gameHeight: (r.height * 200) / 272,
      viewport: window.innerHeight,
      buttons: [...document.querySelectorAll('#pad button')].map((b) => ({
        label: b.getAttribute('aria-label'),
        key: b.dataset.k || b.id,
        icon: !!b.querySelector('svg rect'),
        text: b.textContent.trim(),
      })),
    };
  });
  assert.ok(
    Math.abs(layout.gameHeight - layout.viewport) < 2,
    `game ${layout.gameHeight}px in ${layout.viewport}px`,
  );
  const keys = layout.buttons.map((b) => b.key).sort();
  assert.deepEqual(keys, ['bfull', 'esc', 'fire', 'hb', 'music', 'next', 'radio', 'use']);
  for (const b of layout.buttons) {
    assert.ok(b.label && b.icon && !b.text, `${b.key}: a labelled icon, not text`);
  }
});

test('holding a finger beside the player walks them to it, and lifting it stops them', async () => {
  await startByTouch();
  const start = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  await hold(80, 0, 1200);
  const walked = await game.read((s) => ({ x: s.P.x, y: s.P.y, aim: !!s.touch.at }));
  assert.ok(walked.x > start.x + 40, `walked from ${start.x} to ${walked.x}`);
  assert.ok(Math.abs(walked.y - start.y) < 3, 'straight towards the finger');
  assert.ok(walked.aim);
  await fingers('touchEnd', []);
  await game.wait(200);
  const stopped = await game.read((s) => ({ x: s.P.x, aim: s.touch.at }));
  await game.wait(500);
  assert.equal(await game.read((s) => s.P.x), stopped.x, 'stands still once the finger is lifted');
  assert.equal(stopped.aim, null);
});

test('in a car: a finger ahead drives, on the car brakes, behind reverses', async () => {
  await startByTouch();
  await intoCar();
  await game.wait(400); // let the camera catch up with the car
  // A phone screen is under 100 game pixels from the car to the edge, so the finger stays within 60.
  await hold(0, 60, 1500);
  const fast = await car();
  assert.ok(fast.fwd > 150, `driving forward at ${fast.fwd}`);
  await hold(0, 0, 2000);
  assert.ok(Math.abs((await car()).fwd) < 5, 'stopped');
  await hold(0, -60, 1200);
  assert.ok((await car()).fwd < -40, 'reversing');
  await fingers('touchEnd', []);
});

test('in a car the fire button becomes the horn and the handbrake appears', async () => {
  await startByTouch();
  const shown = () =>
    game.page.evaluate(() => ({
      gun: window.getComputedStyle(document.querySelector('#pad .gun')).display,
      horn: window.getComputedStyle(document.querySelector('#pad .horn')).display,
      hb: window.getComputedStyle(document.querySelector('#pad [data-k=hb]')).display,
    }));
  assert.deepEqual(await shown(), { gun: 'block', horn: 'none', hb: 'none' });
  await intoCar();
  await game.wait(200);
  assert.deepEqual(await shown(), { gun: 'none', horn: 'block', hb: 'block' });
  await game.page.touchscreen.tap(...(await centre('#pad [data-k=fire]')));
  await game.wait(200);
  assert.equal(await game.read((s) => s.P.ammo), 12, 'the horn fires no bullets');
});

test('one finger can steer while another fires', async () => {
  await startByTouch();
  const start = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  const steer = await onPage(start.x + 80, start.y);
  await fingers('touchStart', [steer]);
  await game.wait(300);
  await fingers('touchStart', [steer, await centre('#pad [data-k=fire]')]);
  await game.until((s) => s.P.ammo < 12);
  // Leave only the steering finger down. (A touchEnd would lift every finger.)
  await fingers('touchMove', [steer]);
  await game.wait(300);
  const now = await game.read((s) => ({ x: s.P.x, aim: !!s.touch.at }));
  assert.ok(now.x > start.x + 20, 'still walking while firing');
  assert.ok(now.aim, 'lifting the firing finger does not stop the steering');
  await fingers('touchEnd', []);
});

test('the full-screen button switches full screen on and off', async () => {
  const enabled = await game.page.evaluate(() => document.fullscreenEnabled);
  assert.equal(
    await game.page.locator('#bfull').isVisible(),
    enabled,
    'shown only where full screen is possible',
  );
  if (!enabled) return;
  await game.page.touchscreen.tap(...(await centre('#bfull')));
  await game.page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  await game.page.touchscreen.tap(...(await centre('#bfull')));
  await game.page.waitForFunction(() => document.fullscreenElement === null);
});

test('on a desktop nothing changes: no touch buttons, and a mouse held on the game does not steer', async () => {
  await game.close();
  game = await openGame();
  assert.equal(await game.page.locator('#pad').isVisible(), false);
  await game.start();
  const x0 = await game.read((s) => s.P.x);
  const box = await game.page.locator('#c').boundingBox();
  await game.page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await game.page.mouse.down();
  await game.wait(800);
  await game.page.mouse.up();
  assert.equal(await game.read((s) => s.P.x), x0);
  assert.equal(await game.read((s) => s.touch.at), null);
});
