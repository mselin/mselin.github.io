// SPDX-License-Identifier: GPL-2.0-or-later
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { openGame } = require('./helpers.cjs');

const BRIDGE = 'http://127.0.0.1:26464';
let game;
let toBridge; // every request the page made to the bridge's address
let cleanup;

beforeEach(async () => {
  game = await openGame();
  toBridge = [];
  cleanup = [];
  game.page.on('request', (r) => {
    if (r.url().startsWith(BRIDGE)) toBridge.push(r);
  });
  await game.page.evaluate(() => localStorage.clear());
});
afterEach(async () => {
  const errors = game.errors;
  await game.close();
  for (const fn of cleanup) await fn();
  assert.deepEqual(errors, [], 'the page logged errors');
});

/** Stand in for the bridge. `answer` is the status JSON to reply with, or null for a bridge that is not running. */
async function mockBridge(answer) {
  const seen = [];
  await game.page.route(BRIDGE + '/**', (route) => {
    const req = route.request();
    if (!answer) return route.abort('connectionrefused');
    const cors = { 'access-control-allow-origin': new URL(game.page.url()).origin };
    if (req.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, DELETE',
          'access-control-allow-headers': 'Content-Type',
        },
      });
    }
    seen.push({ method: req.method(), body: req.postData() ? JSON.parse(req.postData()) : null });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify(answer),
    });
  });
  return seen;
}
const CONNECTED = { ok: true, app_id_configured: true, discord_connected: true };
const openInfo = async () => {
  await game.press('KeyI');
  await game.until((s) => s.G.infoOpen);
};
const setting = () =>
  game.page.evaluate(() => ({
    button: document.getElementById('bdrp').textContent,
    line: document.getElementById('drpstat').textContent,
  }));

test('off by default: the page never reaches for the bridge', async () => {
  await mockBridge(CONNECTED);
  await game.start();
  await game.wait(2500);
  await openInfo();
  assert.deepEqual(await setting(), {
    button: 'DISCORD RICH PRESENCE: OFF',
    line: 'Off. Nothing is sent anywhere.',
  });
  assert.equal(toBridge.length, 0);
  assert.equal(await game.page.evaluate(() => localStorage.getItem('sb64presence')), null);
});

test('switched on, the page reports the game state and the setting shows it is connected', async () => {
  const seen = await mockBridge(CONNECTED);
  await game.press('Space');
  await game.until((s) => s.G.screen === 'title');
  await openInfo();
  await game.page.click('#bdrp');
  await game.until((s) => s.presence.status().status === 'connected');
  assert.deepEqual(seen[0], { method: 'POST', body: { v: 1, mode: 'menu' } });
  const shown = await setting();
  assert.equal(shown.button, 'DISCORD RICH PRESENCE: ON');
  assert.match(shown.line, /connected/);

  // Close the page, start playing: the state follows within a couple of seconds.
  await game.press('Escape');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  await game.wait(2500);
  assert.deepEqual(seen.at(-1).body, {
    v: 1,
    mode: 'roaming',
    district: 'gentrifia',
    transport: 'on_foot',
    heat: 0,
  });
  await game.read((s) => s.crime(70));
  await game.wait(2500);
  assert.deepEqual(seen.at(-1).body, {
    v: 1,
    mode: 'chase',
    district: 'gentrifia',
    transport: 'on_foot',
    heat: 3,
  });
  assert.ok(seen.length <= 6, `${seen.length} requests for three changes of state`);

  // Switching it off says goodbye at once.
  await openInfo();
  await game.page.click('#bdrp');
  await game.until((s) => s.presence.status().status === 'off');
  await game.wait(300);
  assert.equal(seen.at(-1).method, 'DELETE');
  const count = seen.length;
  await game.wait(2500);
  assert.equal(seen.length, count, 'nothing more is sent once it is off');
});

test('the choice survives a reload, and the presence then starts at the load screen', async () => {
  const seen = await mockBridge(CONNECTED);
  await game.page.evaluate(() => localStorage.setItem('sb64presence', '1'));
  await game.page.reload();
  await game.page.waitForFunction(() => window.sleazeburg);
  await game.until((s) => s.presence.status().status === 'connected');
  assert.deepEqual(seen[0].body, { v: 1, mode: 'loading' });
});

test('with no bridge the game plays normally and the setting says so, without a flood of retries', async () => {
  await mockBridge(null);
  // The browser logs each refused connection; that is expected here and is what this test counts.
  game.errors = { push() {} };
  await game.press('Space');
  await game.until((s) => s.G.screen === 'title');
  await openInfo();
  await game.page.click('#bdrp');
  await game.until((s) => s.presence.status().status === 'no-bridge');
  const shown = await setting();
  assert.match(shown.line, /was not found/);
  assert.match(shown.line, /How to set it up/);
  assert.match(
    await game.page.evaluate(() => document.querySelector('#drpstat a').href),
    /tools\/presence-bridge/,
  );

  await game.press('Escape');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  const x0 = await game.read((s) => s.P.x);
  await game.page.keyboard.down('ArrowRight');
  await game.wait(12000);
  await game.page.keyboard.up('ArrowRight');
  assert.ok((await game.read((s) => s.P.x)) > x0 + 20, 'the game still plays');
  const posts = toBridge.filter((r) => r.method() === 'POST').length;
  assert.ok(posts >= 1 && posts <= 3, `${posts} attempts in the first 13 seconds`);
  game.errors = [];
});

test('the terms and privacy pages exist, say what the game does, and are linked from the game', async () => {
  await openInfo();
  const links = await game.page.evaluate(() =>
    [...document.querySelectorAll('#ibox a')].map((a) => a.getAttribute('href')),
  );
  assert.ok(links.includes('terms.html') && links.includes('privacy.html'));
  const origin = new URL(game.page.url()).origin;
  for (const [file, heading, phrases] of [
    [
      'privacy.html',
      /PRIVACY/,
      [/collects nothing about you/, /Discord Privacy Policy/, /High Voltage SID Collection/, /GitHub/],
    ],
    [
      'terms.html',
      /TERMS OF USE/,
      [/GNU General Public License/, /without warranty/, /not affiliated with Discord/],
    ],
  ]) {
    const res = await game.page.goto(origin + '/' + file);
    assert.equal(res.status(), 200, file);
    const text = await game.page.evaluate(() => document.body.innerText);
    assert.match(await game.page.evaluate(() => document.querySelector('h1').textContent), heading);
    for (const p of phrases) assert.match(text, p, `${file} should mention ${p}`);
    // Nothing on these pages loads from anywhere else.
    assert.equal(
      await game.page.evaluate(
        () => document.querySelectorAll('script, img, link[rel=stylesheet], iframe').length,
      ),
      0,
    );
  }
});

/**
 * Start the real bridge, built from source (its path in SLEAZEBURG_BRIDGE), with a stand-in for Discord. Returns
 * what Discord was asked to show (null for a clear), and `until`, which waits for a condition and on failure says
 * what the bridge logged.
 */
async function realBridge() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb'));
  const activities = []; // what the fake Discord was asked to show: null for a clear
  const discord = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    const send = (op, obj) => {
      const body = Buffer.from(JSON.stringify(obj));
      const head = Buffer.alloc(8);
      head.writeUInt32LE(op, 0);
      head.writeUInt32LE(body.length, 4);
      sock.write(Buffer.concat([head, body]));
    };
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8 && buf.length >= 8 + buf.readUInt32LE(4)) {
        const op = buf.readUInt32LE(0),
          msg = JSON.parse(buf.subarray(8, 8 + buf.readUInt32LE(4)).toString());
        buf = buf.subarray(8 + buf.readUInt32LE(4));
        if (op === 0) send(1, { cmd: 'DISPATCH', evt: 'READY' });
        else if (op === 3) send(4, msg);
        else {
          activities.push(msg.args.activity);
          send(1, { cmd: 'SET_ACTIVITY', evt: null, nonce: msg.nonce });
        }
      }
    });
    sock.on('error', () => {});
  });
  await new Promise((resolve) => discord.listen(path.join(dir, 'discord-ipc-0'), resolve));
  const origin = new URL(game.page.url()).origin;
  const bridge = spawn(process.env.SLEAZEBURG_BRIDGE, ['-allow-origin', origin], {
    env: { ...process.env, XDG_RUNTIME_DIR: dir, TMPDIR: dir },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log = '';
  bridge.stderr.on('data', (d) => (log += d));
  cleanup.push(async () => {
    bridge.kill('SIGTERM');
    await new Promise((resolve) => bridge.once('exit', resolve));
    await new Promise((resolve) => discord.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const until = async (what, cond, ms = 20000) => {
    for (const end = Date.now() + ms; Date.now() < end;) {
      if (cond()) return;
      await game.wait(200);
    }
    assert.fail(`${what}. Bridge log:\n${log}\nDiscord saw: ${JSON.stringify(activities)}`);
  };
  await until('the bridge should start', () => /listening/.test(log), 5000);
  return { activities, until, log: () => log };
}
const needsBridge = { skip: !process.env.SLEAZEBURG_BRIDGE || process.platform === 'win32' };

// The real thing end to end: the page, a real browser's CORS rules, the real bridge and a stand-in for Discord.
// It needs the bridge built (see the README) and its path in SLEAZEBURG_BRIDGE; without that it is skipped.
test('the real bridge passes the game state on to Discord', needsBridge, async () => {
  const { activities, until, log } = await realBridge();

  await game.press('Space');
  await game.until((s) => s.G.screen === 'title');
  await openInfo();
  await game.page.click('#bdrp');
  await game.until((s) => s.presence.status().status === 'connected', 10000);
  await until('Discord should be shown the title screen', () => activities.length === 1);
  const schema = require('../../tools/presence-bridge/schema.json');
  assert.ok(schema.details.menu['*'].includes(activities[0].details), activities[0].details);
  assert.equal(activities[0].state, 'On the title screen');
  assert.deepEqual(activities[0].assets, { large_image: 'logo', large_text: 'Sleazeburg 64' });
  assert.ok(Math.abs(activities[0].timestamps.start - Date.now() / 1000) < 30);
  assert.equal(activities[0].buttons, undefined);

  // Into the game. The bridge holds changes of text to one every 15 seconds, so this takes that long to show.
  await game.press('Escape');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  await until('Discord should be shown the game', () => activities.length === 2, 25000);
  assert.match(activities[1].details, /Gentrifia|peasant|economy/);
  assert.equal(activities[1].state, 'No heat. Yet');
  assert.equal(activities[1].timestamps.start, activities[0].timestamps.start, 'the timer does not restart');

  // Off: cleared at once.
  await openInfo();
  await game.page.click('#bdrp');
  await until('Discord should be told to clear', () => activities.at(-1) === null, 5000);
  assert.equal((log().match(/showing:/g) || []).length, 2, 'the log has state changes only:\n' + log());
});

// Safari will not let the https page reach http://127.0.0.1 at all. Here the page's own requests to the bridge are
// blocked the same way, so the game has to go through the helper window the bridge serves.
test(
  'where the page cannot reach the bridge, the helper window carries the game to Discord',
  needsBridge,
  async () => {
    const { activities, until } = await realBridge();
    await game.page.route(BRIDGE + '/**', (route) => route.abort('blockedbyclient'));
    game.errors = { push() {} }; // the browser logs each blocked request: expected here
    await game.press('Space');
    await game.until((s) => s.G.screen === 'title');
    await openInfo();
    await game.page.click('#bdrp');
    await game.until((s) => s.presence.status().status === 'no-bridge');
    assert.match((await setting()).line, /Safari always does: open the helper window/);
    assert.equal(await game.page.isVisible('#bdrpwin'), true, 'the button is offered');

    const [win] = await Promise.all([game.page.context().waitForEvent('page'), game.page.click('#bdrpwin')]);
    await win.waitForLoadState();
    assert.equal(win.url(), BRIDGE + '/relay');
    await game.until((s) => s.presence.status().status === 'connected', 10000);
    assert.equal(await game.read((s) => s.presence.status().relay), true);
    await until('Discord should be shown the title screen', () => activities.length === 1);
    assert.equal(activities[0].state, 'On the title screen');
    assert.match((await setting()).line, /keep it open while you play/);
    assert.equal(await game.page.isVisible('#bdrpwin'), false, 'no button once it works');
    assert.equal(await win.textContent('#state'), 'Passing the game on to Discord.');
    assert.equal(await game.page.evaluate(() => localStorage.getItem('sb64presenceRelay')), '1');

    // The window cannot be put inside another page.
    const headers = (await win.goto(BRIDGE + '/relay')).headers();
    assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
    await game.until((s) => s.presence.status().status === 'connected', 10000);

    // Off: the window clears the profile and closes.
    const closed = win.waitForEvent('close');
    await game.page.click('#bdrp');
    await closed;
    await until('Discord should be told to clear', () => activities.at(-1) === null, 5000);
    game.errors = [];
  },
);

test('closing the helper window is noticed and it can be opened again', needsBridge, async () => {
  await realBridge();
  await game.page.route(BRIDGE + '/**', (route) => route.abort('blockedbyclient'));
  game.errors = { push() {} };
  await openInfo();
  await game.page.click('#bdrp');
  await game.until((s) => s.presence.status().status === 'no-bridge');
  let [win] = await Promise.all([game.page.context().waitForEvent('page'), game.page.click('#bdrpwin')]);
  await game.until((s) => s.presence.status().status === 'connected', 10000);
  await win.close();
  await game.until((s) => s.presence.status().status === 'relay-closed', 5000);
  assert.match((await setting()).line, /window was closed/);
  [win] = await Promise.all([game.page.context().waitForEvent('page'), game.page.click('#bdrpwin')]);
  await game.until((s) => s.presence.status().status === 'connected', 10000);
  game.errors = [];
});

// Any website can open the helper window and then let go of it. That used to make the window clear the profile
// as it closed; now only a window the game has used may.
test(
  'a helper window that another website opens and drops does not clear the presence',
  needsBridge,
  async () => {
    const { activities, until, log } = await realBridge();
    await game.press('Space');
    await game.until((s) => s.G.screen === 'title');
    await openInfo();
    await game.page.click('#bdrp');
    await game.until((s) => s.presence.status().status === 'connected', 10000);
    await until('Discord should be shown the title screen', () => activities.length === 1);

    // Another site: the same test server under another name is another origin, and not an allowed one.
    const other = await game.page.context().newPage();
    const here = new URL(game.page.url());
    here.hostname = here.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    await other.goto(here.href);
    const [win] = await Promise.all([
      game.page.context().waitForEvent('page'),
      other.evaluate((url) => window.open(url, '_blank'), BRIDGE + '/relay'),
    ]);
    await win.waitForLoadState();
    const closed = win.waitForEvent('close');
    await other.close();
    await closed; // the window notices its opener has gone and closes
    await game.wait(1500);
    assert.notEqual(activities.at(-1), null, 'the profile was cleared. Bridge log:\n' + log());
    assert.doesNotMatch(log(), /session ended/);
  },
);
