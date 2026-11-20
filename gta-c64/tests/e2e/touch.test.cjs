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
/**
 * Put the player in a sports car, stopped on an open avenue, facing south. Moving traffic is cleared away for
 * the rest of the test, as it spawns: a car that wanders into the avenue can stop the test car dead.
 */
const intoCar = () =>
  game.read((s) => {
    const c = s.mkCar(s.KIND.sports, 2 * 192 + 8, 250, Math.PI / 2, 2);
    const clear = () => (s.G.cars = s.G.cars.filter((o) => o === c || o.parked));
    clear();
    setInterval(clear, 50);
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

test('FR-10, FR-11, FR-14, FR-15: the game fills the screen, no button covers it, and the buttons are labelled icons of a usable size', async () => {
  await game.page.evaluate(() => document.getElementById('ibtn').scrollIntoView());
  const layout = await game.page.evaluate(() => {
    const r = document.getElementById('c').getBoundingClientRect(),
      k = r.width / 384;
    // The game area inside the canvas: 320 by 200 game pixels, 32 in from the left and 36 down.
    const area = {
      left: r.left + 32 * k,
      top: r.top + 36 * k,
      right: r.left + 352 * k,
      bottom: r.top + 236 * k,
    };
    const shown = [document.getElementById('ibtn'), ...document.querySelectorAll('#pad button')].filter(
      (b) => b.getClientRects().length > 0,
    );
    return {
      area,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      buttons: [...document.querySelectorAll('#pad button')].map((b) => ({
        label: b.getAttribute('aria-label'),
        key: b.dataset.k || b.id,
        icon: !!b.querySelector('svg rect'),
        text: b.textContent.trim(),
      })),
      boxes: shown.map((b) => {
        const q = b.getBoundingClientRect();
        return { key: b.dataset.k || b.id, left: q.left, top: q.top, right: q.right, bottom: q.bottom };
      }),
    };
  });
  const { area, viewport } = layout;
  const fills = Math.min(
    viewport.width - (area.right - area.left),
    viewport.height - (area.bottom - area.top),
  );
  assert.ok(
    Math.abs(fills) < 2,
    `the game area should meet the screen edge: ${JSON.stringify({ area, viewport })}`,
  );
  const keys = layout.buttons.map((b) => b.key).sort();
  assert.deepEqual(keys, ['bfull', 'esc', 'fire', 'hb', 'music', 'next', 'radio', 'use'], 'no arrow buttons');
  for (const b of layout.buttons) {
    assert.ok(b.label && b.icon && !b.text, `${b.key}: a labelled icon, not text`);
  }
  for (const b of layout.boxes) {
    assert.ok(b.right - b.left >= 44 && b.bottom - b.top >= 44, `${b.key} is at least 44 by 44`);
    const overlaps = b.left < area.right && b.right > area.left && b.top < area.bottom && b.bottom > area.top;
    assert.ok(!overlaps, `${b.key} covers the game area`);
  }
});

test('FR-01, FR-02, FR-06: holding a finger beside the player walks them to it, and lifting it stops them', async () => {
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

test('FR-03, FR-04, FR-05: in a car, a finger ahead drives, on the car brakes, behind reverses', async () => {
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

test('FR-12: in a car the fire button becomes the horn and the handbrake appears', async () => {
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

test('FR-08: one finger can steer while another fires', async () => {
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

test('FR-13: the full-screen button switches full screen on and off', async () => {
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

test('FR-18: on a desktop nothing changes: no touch buttons, no notice, and a mouse held on the game does not steer', async () => {
  await game.close();
  game = await openGame();
  assert.equal(await game.page.locator('#pad').isVisible(), false);
  assert.equal(await game.page.locator('#rotate').isVisible(), false);
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

test('FR-07: the cross shows where the finger is', async () => {
  await startByTouch();
  const p = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  await fingers('touchStart', [await onPage(p.x + 70, p.y + 20)]);
  await game.wait(150);
  const at = await game.read((s) => s.touch.at);
  // The cross is drawn in yellow (#b8c76f) through the finger's spot, inside the 32 by 36 border.
  const pixel = await game.page.evaluate(
    ([x, y]) => [
      ...document
        .getElementById('c')
        .getContext('2d')
        .getImageData(32 + x, 36 + y, 1, 1).data,
    ],
    [Math.round(at.x), Math.round(at.y)],
  );
  assert.deepEqual(pixel, [0xb8, 0xc7, 0x6f, 255]);
  await fingers('touchEnd', []);
});

test('FR-08: a second finger on the screen, not on a button, does not take over the steering', async () => {
  await startByTouch();
  const p = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  const right = await onPage(p.x + 80, p.y),
    left = await onPage(p.x - 80, p.y);
  await fingers('touchStart', [right]);
  await game.wait(200);
  await fingers('touchStart', [right, left]);
  await game.wait(600);
  assert.ok((await game.read((s) => s.P.x)) > p.x + 15, 'still walking towards the first finger');
  await fingers('touchEnd', []);
});

test('FR-09: the tap that starts the game does not steer', async () => {
  await startByTouch();
  const p = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  await game.wait(600);
  assert.deepEqual(await game.read((s) => ({ x: s.P.x, y: s.P.y })), p);
  assert.equal(await game.read((s) => s.touch.at), null);
});

test('FR-09: steering stops when play is interrupted, and a finger still down does not restart it', async () => {
  await startByTouch();
  await game.read((s) => (s.G.cash = 500)); // so being busted costs a fine rather than the game
  const p = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  const spot = await onPage(p.x + 80, p.y);
  await fingers('touchStart', [spot]);
  await game.until((s) => s.touch.at);
  await game.read((s) => s.down('busted'));
  await game.until((s) => s.G.screen === 'down' && !s.touch.at);
  // The same finger, still down and moving, through the arrest and back into play.
  await game.until((s) => s.G.screen === 'play', 10000);
  const after = await game.read((s) => ({ x: s.P.x, y: s.P.y }));
  for (let i = 0; i < 6; i++) {
    await fingers('touchMove', [[spot[0] + (i % 2), spot[1]]]);
    await game.wait(100);
  }
  assert.equal(await game.read((s) => s.touch.at), null);
  assert.deepEqual(await game.read((s) => ({ x: s.P.x, y: s.P.y })), after, 'did not move');
  // A new touch steers again.
  await fingers('touchEnd', []);
  await fingers('touchStart', [await onPage(after.x + 80, after.y)]);
  await game.until((s) => s.touch.at);
  await fingers('touchEnd', []);
});

test('FR-16: the dialogs on a touch screen answer to the buttons they name', async () => {
  await startByTouch();
  // "Return to title screen? GUN = YES  CAR = NO"
  await game.page.touchscreen.tap(...(await centre('#pad [data-k=esc]')));
  await game.until((s) => s.G.quitAsk);
  await game.page.touchscreen.tap(...(await centre('#pad [data-k=use]')));
  await game.until((s) => !s.G.quitAsk && s.G.screen === 'play');
  await game.page.touchscreen.tap(...(await centre('#pad [data-k=esc]')));
  await game.until((s) => s.G.quitAsk);
  await game.page.touchscreen.tap(...(await centre('#pad [data-k=fire]')));
  await game.until((s) => s.G.screen === 'title');
  // "New game? TAP = YES  CAR = NO", after being busted with no money. The answer waits a second.
  await game.page.touchscreen.tap(400, 200);
  await game.until((s) => s.G.screen === 'play');
  await game.read((s) => s.down('busted'));
  await game.until((s) => s.G.screen === 'over', 10000);
  for (let i = 0; i < 20 && (await game.screen()) === 'over'; i++) {
    await game.page.touchscreen.tap(400, 200);
    await game.wait(200);
  }
  assert.equal(await game.screen(), 'play', 'a tap on the screen means yes');
  await game.read((s) => s.down('busted'));
  await game.until((s) => s.G.screen === 'over', 10000);
  for (let i = 0; i < 20 && (await game.screen()) === 'over'; i++) {
    await game.page.touchscreen.tap(...(await centre('#pad [data-k=use]')));
    await game.wait(200);
  }
  assert.equal(await game.screen(), 'title', 'the car button means no');
});

test('FR-16: changing station with the music off says to tap the music button', async () => {
  await startByTouch();
  await game.page.touchscreen.tap(...(await centre('#pad [data-k=radio]')));
  await game.until((s) => /RADIO:/.test(s.G.msgTxt));
  const text = await game.read((s) => s.G.msgTxt);
  assert.match(text, /TAP THE NOTE/);
  assert.doesNotMatch(text, /PRESS/);
});

test('FR-17: held upright, the game asks to be turned sideways', async () => {
  await game.close();
  game = await openGame({ device: 'Pixel 8 Pro' });
  const notice = game.page.locator('#rotate');
  assert.equal(await notice.isVisible(), true);
  assert.match(await notice.innerText(), /SIDEWAYS/);
  // Turning the phone sideways makes it go away, and back upright brings it back.
  await game.page.setViewportSize({ width: 921, height: 448 });
  assert.equal(await notice.isVisible(), false);
  await game.page.setViewportSize({ width: 448, height: 921 });
  assert.equal(await notice.isVisible(), true);
  // Tapping it dismisses it for the rest of the visit, and the game plays upright.
  await game.page.touchscreen.tap(224, 460);
  assert.equal(await notice.isVisible(), false);
  await game.page.setViewportSize({ width: 921, height: 448 });
  await game.page.setViewportSize({ width: 448, height: 921 });
  assert.equal(await notice.isVisible(), false);
  await game.page.touchscreen.tap(224, 200);
  await game.until((s) => s.G.screen === 'title');
});
