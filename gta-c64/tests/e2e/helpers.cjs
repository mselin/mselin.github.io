// SPDX-License-Identifier: GPL-2.0-or-later
// Shared set-up for the browser tests: a local server, a headless Chromium page, and a stand-in for HVSC.
const { chromium, devices } = require('playwright');
const { serve } = require('../server.cjs');

/**
 * A tiny two-song PSID tune made for the tests, so no real music is stored in the repository.
 * Each song switches voice 1 on at full volume; the play routine does nothing.
 */
function testTune(title = 'Test Tune', author = 'Nobody', released = '2026 Tests') {
  const head = Buffer.alloc(0x7c);
  head.write('PSID', 0, 'latin1');
  head.writeUInt16BE(2, 4); // version
  head.writeUInt16BE(0x7c, 6); // data offset
  head.writeUInt16BE(0x1000, 0x0a); // init address
  head.writeUInt16BE(0x1020, 0x0c); // play address
  head.writeUInt16BE(2, 0x0e); // songs
  head.writeUInt16BE(1, 0x10); // start song
  head.write(title, 0x16, 'latin1');
  head.write(author, 0x36, 'latin1');
  head.write(released, 0x56, 'latin1');
  const code = Buffer.alloc(2 + 0x21);
  // Load address $1000, then: LDA #$0F STA $D418  LDA #$F0 STA $D406  LDA #$20 STA $D401  LDA #$21 STA $D404  RTS
  Buffer.from([
    0x00, 0x10, 0xa9, 0x0f, 0x8d, 0x18, 0xd4, 0xa9, 0xf0, 0x8d, 0x06, 0xd4, 0xa9, 0x20, 0x8d, 0x01, 0xd4,
    0xa9, 0x21, 0x8d, 0x04, 0xd4, 0x60,
  ]).copy(code);
  code[2 + 0x20] = 0x60; // play: RTS
  return Buffer.concat([head, code]);
}

/**
 * Open the game in a fresh page.
 * Requests to HVSC are answered locally with the test tune and counted in `game.hvscRequests`.
 * `options.browserArgs` adds Chromium command-line switches; `options.device` emulates a phone or tablet.
 */
async function openGame(options = {}) {
  const server = await serve(0);
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', ...(options.browserArgs || [])],
  });
  // options.device names a phone or tablet from Playwright's list, for the touch-screen tests.
  const context = await browser.newContext(
    options.device ? devices[options.device] : { viewport: { width: 960, height: 680 } },
  );
  const page = await context.newPage();
  const game = { page, errors: [], hvscRequests: [] };
  page.on('pageerror', (e) => game.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') game.errors.push(m.text());
  });
  await page.route('https://www.hvsc.c64.org/**', (route) => {
    game.hvscRequests.push(decodeURI(new URL(route.request().url()).pathname));
    route.fulfill({ body: testTune(), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(server.url);
  try {
    await page.waitForFunction(() => window.sleazeburg, null, { timeout: 15000 });
  } catch (e) {
    // The game did not start. Close everything, or the open browser keeps the test process alive for ever,
    // and say why.
    await browser.close();
    await server.close();
    throw new Error('the game did not start: ' + (game.errors.join('; ') || e.message));
  }

  /** Run a function in the page with the game handle as its argument. */
  game.read = (fn, arg) => page.evaluate(`(${fn})(window.sleazeburg, ${JSON.stringify(arg ?? null)})`);
  game.screen = () => game.read((s) => s.G.screen);
  game.press = (key) => page.keyboard.press(key);
  game.wait = (ms) => page.waitForTimeout(ms);
  /** Wait until a condition on the game handle holds. */
  game.until = (fn, timeout = 8000) => page.waitForFunction(`(${fn})(window.sleazeburg)`, null, { timeout });
  /**
   * Press a key every 300 ms until a condition holds. For prompts that ignore input for a moment of game time,
   * which on a slow machine is longer than the same moment on the clock.
   */
  game.pressUntil = async (key, fn, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      if (await page.evaluate(`(${fn})(window.sleazeburg)`)) return;
    }
    throw new Error(`pressing ${key} never led to: ${fn}`);
  };
  /** Skip the boot screen and the title screen. */
  game.start = async () => {
    await game.press('Space');
    await game.until((s) => s.G.screen === 'title');
    await game.press('Space');
    await game.until((s) => s.G.screen === 'play');
  };
  game.close = async () => {
    await browser.close();
    await server.close();
  };
  return game;
}

module.exports = { openGame, testTune };
