// SPDX-License-Identifier: GPL-2.0-or-later
// Opt-in Discord Rich Presence.
//
// A web page cannot talk to Discord. What it can do, once the player has switched the setting on, is tell a
// small helper program on the same computer (the "bridge", tools/presence-bridge) what is happening in the
// game, and the bridge passes that on to the player's Discord client.
//
// Three rules shape this file:
//   - Off by default. Until the player turns the setting on, nothing here makes any request at all.
//   - Only a handful of enumerated values are ever sent: never text, names or anything the player typed.
//     The words shown on the profile come from the bridge's own table.
//   - The game never depends on it. Every failure ends in a status line on the information page, and nothing
//     here can throw into the game loop.
import { G, P } from './state.js';
import { districtAt } from './world.js';
import { lastDown } from './player.js';

export const BRIDGE = 'http://127.0.0.1:26464';
/** The one description of what may be sent, shared with the bridge. */
export const SCHEMA_URL = 'tools/presence-bridge/schema.json';
const STORAGE_KEY = 'sb64presence';
const TICK_MS = 1000;
const HEARTBEAT_MS = 10000; // the bridge clears the presence after 30 s of silence
const MIN_GAP_MS = 1000; // changes of state are sent at once, but not more often than this
const TIMEOUT_MS = 4000;
const BACKOFF_MS = [5000, 10000, 20000, 40000, 60000]; // while the bridge cannot be reached

// What the module needs from the outside world, replaceable in the tests.
const env = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  every: (fn, ms) => setInterval(fn, ms),
  cancel: (handle) => clearInterval(handle),
  storage: () => localStorage,
};
/** Replace parts of the environment. For the tests. */
export function configurePresence(overrides) {
  Object.assign(env, overrides);
}

let enabled = false;
// 'off', 'starting', 'connected', 'no-discord', 'no-app-id', 'no-bridge', 'refused' or 'unavailable'
let status = 'off';
let schema = null;
let timer = null;
let lastBody = ''; // the state the bridge last accepted, as sent
let lastSentAt = 0;
let inFlight = false;
let failures = 0;
let retryAt = 0;
let listener = () => {};

/**
 * What the game is doing, as the few enumerated values the bridge accepts.
 * A hidden tab counts as paused: the browser stops drawing it, so nothing is happening.
 */
export function describe(hidden = false) {
  let mode;
  if (hidden) mode = 'paused';
  else if (G.screen === 'boot') mode = 'loading';
  else if (G.screen === 'title') mode = 'menu';
  else if (G.screen === 'win') mode = 'victory';
  else if (G.screen === 'over') mode = 'gameover';
  else if (G.screen === 'down') mode = lastDown() === 'dead' ? 'flatlined' : 'busted';
  else if (G.paused || G.quitAsk || G.infoOpen) mode = 'paused';
  else if (G.heat > 0) mode = 'chase';
  else if (G.job) mode = 'job';
  else mode = 'roaming';
  const state = { v: 1, mode };
  if (mode === 'roaming' || mode === 'job' || mode === 'chase') {
    const at = P.car || P;
    state.district = districtAt(at.x, at.y);
    state.transport = P.car ? 'car' : P.swim ? 'swimming' : 'on_foot';
    state.heat = G.heat;
  }
  return state;
}

/** Make a state fit the schema: anything the schema does not list is left out. Null if the mode is unknown. */
export function fit(state, s) {
  if (!s.modes.includes(state.mode)) return null;
  const out = { v: s.v, mode: state.mode };
  if (Object.hasOwn(s.districts, state.district ?? '')) out.district = state.district;
  if (s.transports.includes(state.transport)) out.transport = state.transport;
  if (Number.isInteger(state.heat)) out.heat = Math.min(s.heat.max, Math.max(s.heat.min, state.heat));
  return out;
}

function setStatus(next) {
  if (next === status) return;
  status = next;
  try {
    listener();
  } catch (e) {
    /* a broken listener is not the game's problem */
  }
}

// Chrome asks the player's permission before a public page may reach this computer, and wants the request to
// say that is where it is going. Browsers that know the option but not this value reject it outright, so try
// it once on a request that is never sent.
let addressSpace = null;
function loopbackOption() {
  if (addressSpace) return addressSpace;
  addressSpace = {};
  try {
    new Request(BRIDGE, { targetAddressSpace: 'loopback' });
    addressSpace = { targetAddressSpace: 'loopback' };
  } catch (e) {
    /* this browser spells it differently: go without */
  }
  return addressSpace;
}

function request(method, body, farewell) {
  const init = { method, mode: 'cors', credentials: 'omit', cache: 'no-store', ...loopbackOption() };
  if (body) {
    init.body = body;
    init.headers = { 'Content-Type': 'application/json' };
  }
  // A farewell is sent as the page goes away, so it must be allowed to outlive it.
  if (farewell) init.keepalive = true;
  else if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
    init.signal = AbortSignal.timeout(TIMEOUT_MS);
  return env.fetch(BRIDGE + '/v1/presence', init);
}

function failed(why) {
  failures++;
  retryAt = env.now() + BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1];
  lastBody = '';
  setStatus(why);
}

/** One step: send the state if it changed or a heartbeat is due. Runs once a second while the setting is on. */
export async function tick() {
  if (!enabled || inFlight) return;
  if (env.now() < retryAt) return;
  inFlight = true;
  try {
    if (!schema) {
      const res = await env.fetch(SCHEMA_URL);
      if (!res.ok) throw new Error('schema');
      schema = await res.json();
    }
  } catch (e) {
    failed('unavailable');
    inFlight = false;
    return;
  }
  try {
    const state = fit(describe(env.hidden()), schema);
    if (!state || !enabled) return;
    const body = JSON.stringify(state);
    const since = env.now() - lastSentAt;
    if (body === lastBody ? since < HEARTBEAT_MS : since < MIN_GAP_MS) return;
    const res = await request('POST', body, false);
    if (!enabled) return; // switched off while the request was in the air
    if (!res.ok) {
      failed('refused');
      return;
    }
    const reply = await res.json();
    lastBody = body;
    lastSentAt = env.now();
    failures = 0;
    setStatus(!reply.app_id_configured ? 'no-app-id' : !reply.discord_connected ? 'no-discord' : 'connected');
  } catch (e) {
    if (enabled) failed('no-bridge');
  } finally {
    inFlight = false;
  }
}

function start() {
  if (enabled) return;
  enabled = true;
  failures = 0;
  retryAt = 0;
  lastBody = '';
  lastSentAt = 0;
  setStatus('starting');
  timer = env.every(() => tick(), TICK_MS);
  tick();
}

function stop() {
  if (!enabled) return;
  enabled = false;
  env.cancel(timer);
  timer = null;
  // Only say goodbye to a bridge that has heard from this page.
  if (lastSentAt) request('DELETE', null, true).catch(() => {});
  lastBody = '';
  lastSentAt = 0;
  setStatus('off');
}

/** Switch the feature on or off and remember the choice. Call it from a click: turning it on is the first
 * time the page reaches for the player's own computer, and the browser may ask their permission. */
export function setPresence(on) {
  try {
    env.storage().setItem(STORAGE_KEY, on ? '1' : '0');
  } catch (e) {
    /* private browsing or blocked storage: the choice lasts until the page closes */
  }
  if (on) start();
  else stop();
}

/** Whether the setting is on, and how it is going. */
export const presenceStatus = () => ({ enabled, status });

/** Be told when the status changes. */
export function onPresenceChange(fn) {
  listener = fn;
}

/** Call once when the game loads. Starts only if the player turned the setting on during an earlier visit. */
export function initPresence() {
  let stored = null;
  try {
    stored = env.storage().getItem(STORAGE_KEY);
  } catch (e) {
    /* no storage: stay off */
  }
  if (typeof addEventListener === 'function') {
    // Hiding the tab is a change of state, and the drawing loop that would notice it stops with the tab.
    addEventListener('visibilitychange', () => tick());
    addEventListener('pagehide', () => {
      if (enabled && lastSentAt) request('DELETE', null, true).catch(() => {});
    });
  }
  if (stored === '1') start();
}
