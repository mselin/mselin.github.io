// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DISTRICTS, HT } from '../../js/config.js';
import { BLK } from '../../js/config.js';
import { districtAt, genMap } from '../../js/world.js';
import { G, P, resetState } from '../../js/state.js';
import { down } from '../../js/player.js';
import { BRIDGE, SCHEMA_URL, describe, fit } from '../../js/presence.js';

const schema = JSON.parse(
  readFileSync(new URL('../../tools/presence-bridge/schema.json', import.meta.url), 'utf8'),
);

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  G.infoOpen = false;
});

// ---------- what the game says about itself ----------

test('each screen maps to a mode', () => {
  const mode = (set) => {
    resetState();
    G.screen = 'play';
    set();
    return describe().mode;
  };
  assert.equal(
    mode(() => (G.screen = 'boot')),
    'loading',
  );
  assert.equal(
    mode(() => (G.screen = 'title')),
    'menu',
  );
  assert.equal(
    mode(() => (G.screen = 'win')),
    'victory',
  );
  assert.equal(
    mode(() => (G.screen = 'over')),
    'gameover',
  );
  assert.equal(
    mode(() => {}),
    'roaming',
  );
  assert.equal(
    mode(() => (G.job = { def: {} })),
    'job',
  );
  assert.equal(
    mode(() => (G.heat = 2)),
    'chase',
  );
  assert.equal(
    mode(() => ((G.heat = 2), (G.job = { def: {} }))),
    'chase',
    'the police outrank a job',
  );
  assert.equal(
    mode(() => (G.paused = true)),
    'paused',
  );
  assert.equal(
    mode(() => (G.quitAsk = true)),
    'paused',
  );
  assert.equal(
    mode(() => (G.infoOpen = true)),
    'paused',
  );
  assert.equal(
    mode(() => down('dead')),
    'flatlined',
  );
  assert.equal(
    mode(() => down('busted')),
    'busted',
  );
});

test('a hidden tab counts as paused, whatever the game is showing', () => {
  for (const screen of ['boot', 'title', 'play', 'win']) {
    G.screen = screen;
    assert.equal(describe(true).mode, 'paused');
  }
});

test('district, transport and heat are sent only while playing', () => {
  Object.assign(P, { x: 6 * BLK, y: 6 * BLK });
  G.heat = 3;
  assert.deepEqual(describe(), {
    v: 1,
    mode: 'chase',
    district: 'crypto_docks',
    transport: 'on_foot',
    heat: 3,
  });
  P.swim = true;
  assert.equal(describe().transport, 'swimming');
  P.car = { x: 40, y: 40 };
  assert.deepEqual(
    describe(),
    { v: 1, mode: 'chase', district: 'gentrifia', transport: 'car', heat: 3 },
    'the car is where the player is',
  );
  for (const screen of ['boot', 'title', 'win', 'over']) {
    G.screen = screen;
    assert.deepEqual(Object.keys(describe()), ['v', 'mode'], screen);
  }
  G.screen = 'play';
  G.paused = true;
  assert.deepEqual(describe(), { v: 1, mode: 'paused' });
});

test('districts split the city into the canal and four quarters', () => {
  assert.equal(districtAt(100, 100), 'gentrifia');
  assert.equal(districtAt(100, 5 * BLK), 'debt_valley');
  assert.equal(districtAt(6 * BLK, 100), 'hoa_heights');
  assert.equal(districtAt(6 * BLK, 5 * BLK), 'crypto_docks');
  assert.equal(districtAt(4 * BLK + 50, 300), 'the_moat');
});

// ---------- the game and the bridge agree on the schema ----------

test('the schema lists exactly the districts the game has, by the same names', () => {
  assert.deepEqual(Object.keys(schema.districts).sort(), Object.keys(DISTRICTS).sort());
  for (const [id, name] of Object.entries(schema.districts)) assert.equal(name.toUpperCase(), DISTRICTS[id]);
});

test('the schema covers every mode, transport and heat level the game can report', () => {
  const emitted = new Set();
  for (const screen of ['boot', 'title', 'win', 'over', 'play']) {
    for (const heat of [0, 1]) {
      for (const job of [null, {}]) {
        resetState();
        Object.assign(G, { screen, heat, job });
        emitted.add(describe().mode);
      }
    }
  }
  for (const kind of ['dead', 'busted']) {
    resetState();
    G.screen = 'play';
    down(kind);
    emitted.add(describe().mode);
  }
  emitted.add(describe(true).mode);
  assert.deepEqual([...emitted].sort(), [...schema.modes].sort());
  assert.deepEqual([...schema.transports].sort(), ['car', 'on_foot', 'swimming']);
  assert.deepEqual([schema.heat.min, schema.heat.max], [0, HT.length - 1]);
  assert.equal(describe().v, schema.v);
});

test('fit leaves out anything the schema does not list', () => {
  assert.deepEqual(fit({ v: 1, mode: 'chase', district: 'gentrifia', transport: 'car', heat: 2 }, schema), {
    v: 1,
    mode: 'chase',
    district: 'gentrifia',
    transport: 'car',
    heat: 2,
  });
  assert.deepEqual(
    fit({ v: 1, mode: 'chase', district: 'downtown', transport: 'jetpack', heat: 99 }, schema),
    {
      v: 1,
      mode: 'chase',
      heat: 5,
    },
  );
  assert.equal(fit({ v: 1, mode: 'dancing' }, schema), null);
  assert.deepEqual(
    fit({ v: 1, mode: 'menu', district: 'toString' }, schema),
    { v: 1, mode: 'menu' },
    'no inherited names',
  );
});

// ---------- talking to the bridge ----------

/** A fresh copy of the module with a fake clock, fake storage and a recording fetch. */
async function rig(options = {}) {
  const m = await import('../../js/presence.js?rig=' + Math.random());
  const r = {
    m,
    clock: 1_000_000,
    calls: [], // every request made, in order
    stored: { ...options.stored },
    bridge: options.bridge || 'ok', // 'ok', 'down', or an HTTP status to answer with
    reply: { ok: true, app_id_configured: true, discord_connected: true },
    statuses: [],
  };
  m.configurePresence({
    now: () => r.clock,
    hidden: () => !!r.hidden,
    every: () => 'timer',
    cancel: () => {},
    storage: () => {
      if (options.storageThrows) throw new Error('storage is blocked');
      return { getItem: (k) => r.stored[k] ?? null, setItem: (k, v) => (r.stored[k] = v) };
    },
    fetch: async (url, init = {}) => {
      r.calls.push({ url, method: init.method || 'GET', body: init.body, init });
      if (url === SCHEMA_URL) return { ok: true, json: async () => schema };
      if (r.bridge === 'down') throw new TypeError('Failed to fetch');
      if (r.bridge !== 'ok') return { ok: false, status: r.bridge, json: async () => ({}) };
      return { ok: true, json: async () => r.reply };
    },
  });
  m.onPresenceChange(() => r.statuses.push(m.presenceStatus().status));
  /** Let seconds pass, ticking once for each as the page's timer does. */
  r.pass = async (seconds) => {
    for (let i = 0; i < seconds; i++) {
      r.clock += 1000;
      await m.tick();
    }
  };
  r.toBridge = () => r.calls.filter((c) => c.url.startsWith(BRIDGE));
  return r;
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('off by default: nothing is requested, however long the game runs', async () => {
  const r = await rig();
  r.m.initPresence();
  await r.pass(120);
  assert.deepEqual(r.calls, []);
  assert.deepEqual(r.m.presenceStatus(), { enabled: false, status: 'off' });
});

test('turning it on sends the state, then a heartbeat every ten seconds', async () => {
  const r = await rig();
  r.m.initPresence();
  r.m.setPresence(true);
  await settle();
  assert.equal(r.stored.sb64presence, '1');
  assert.deepEqual(
    r.calls.map((c) => c.method + ' ' + c.url),
    ['GET ' + SCHEMA_URL, 'POST ' + BRIDGE + '/v1/presence'],
  );
  const first = r.toBridge()[0];
  assert.deepEqual(JSON.parse(first.body), {
    v: 1,
    mode: 'roaming',
    district: 'gentrifia',
    transport: 'on_foot',
    heat: 0,
  });
  assert.equal(first.init.headers['Content-Type'], 'application/json');
  assert.equal(first.init.credentials, 'omit');
  assert.equal(r.m.presenceStatus().status, 'connected');

  await r.pass(60);
  assert.equal(r.toBridge().length, 7, 'one post, then six heartbeats in a minute');
  assert.ok(r.toBridge().every((c) => c.body === first.body));
});

test('a change of state is sent within a second, not at the next heartbeat', async () => {
  const r = await rig();
  r.m.setPresence(true);
  await settle();
  await r.pass(3);
  G.heat = 2;
  await r.pass(1);
  const posts = r.toBridge();
  assert.equal(posts.length, 2);
  assert.equal(JSON.parse(posts[1].body).mode, 'chase');
});

test('the status line follows what the bridge reports', async () => {
  const r = await rig();
  r.m.setPresence(true);
  await settle();
  r.reply = { ok: true, app_id_configured: true, discord_connected: false };
  await r.pass(10);
  assert.equal(r.m.presenceStatus().status, 'no-discord');
  r.reply = { ok: true, app_id_configured: false, discord_connected: false };
  await r.pass(10);
  assert.equal(r.m.presenceStatus().status, 'no-app-id');
  assert.deepEqual(r.statuses, ['starting', 'connected', 'no-discord', 'no-app-id']);
});

test('with no bridge the game carries on and the retries back off', async () => {
  const r = await rig({ bridge: 'down' });
  r.m.setPresence(true);
  await settle();
  assert.equal(r.m.presenceStatus().status, 'no-bridge');
  await r.pass(300);
  const tries = r.toBridge().length;
  assert.ok(tries >= 5 && tries <= 9, `${tries} attempts in five minutes`);
  // Then the player starts the bridge.
  r.bridge = 'ok';
  await r.pass(61);
  assert.equal(r.m.presenceStatus().status, 'connected');
});

test('a bridge that refuses the game is reported and not hammered', async () => {
  const r = await rig({ bridge: 403 });
  r.m.setPresence(true);
  await settle();
  assert.equal(r.m.presenceStatus().status, 'refused');
  await r.pass(60);
  assert.ok(r.toBridge().length <= 4);
});

test('turning it off says goodbye once and then stays silent', async () => {
  const r = await rig();
  r.m.setPresence(true);
  await settle();
  r.m.setPresence(false);
  await settle();
  const last = r.calls.at(-1);
  assert.equal(last.method + ' ' + last.url, 'DELETE ' + BRIDGE + '/v1/presence');
  assert.equal(last.init.keepalive, true);
  assert.equal(r.stored.sb64presence, '0');
  const count = r.calls.length;
  await r.pass(60);
  assert.equal(r.calls.length, count);
  assert.equal(r.m.presenceStatus().status, 'off');
});

test('turning it off before the bridge was ever reached sends nothing to it', async () => {
  const r = await rig({ bridge: 'down' });
  r.m.setPresence(true);
  await settle();
  r.calls.length = 0;
  r.m.setPresence(false);
  await settle();
  assert.deepEqual(r.calls, []);
});

test('the choice is remembered from an earlier visit', async () => {
  const on = await rig({ stored: { sb64presence: '1' } });
  on.m.initPresence();
  await settle();
  assert.equal(on.toBridge().length, 1);
  const off = await rig({ stored: { sb64presence: '0' } });
  off.m.initPresence();
  await settle();
  assert.deepEqual(off.calls, []);
});

test('blocked storage does not break the setting or the game', async () => {
  const r = await rig({ storageThrows: true });
  r.m.initPresence();
  assert.equal(r.m.presenceStatus().enabled, false);
  r.m.setPresence(true);
  await settle();
  assert.equal(r.m.presenceStatus().status, 'connected');
});

test('a hidden tab is reported as paused', async () => {
  const r = await rig();
  r.m.setPresence(true);
  await settle();
  r.hidden = true;
  await r.pass(1);
  assert.deepEqual(JSON.parse(r.toBridge().at(-1).body), { v: 1, mode: 'paused' });
});
