// SPDX-License-Identifier: GPL-2.0-or-later
// Shared game state, the player, held keys, and the on-screen message helpers.
import { PI, SW, VH } from './config.js';
import { HOSP } from './world.js';

/** The parts of the state that belong to one game, as they are when it starts. */
const freshGame = () => ({
  paused: false,
  cars: [],
  peds: [],
  bullets: [],
  parts: [], // particles
  pickups: [],
  pops: [], // floating texts
  cash: 0,
  heat: 0,
  heatPts: 0, // crime points; heat is the level they add up to
  heatCool: 0,
  camX: 0,
  camY: 0,
  msgTxt: '', // the message on the bottom line of the HUD
  msgT: 0,
  msgAge: 0,
  banner: null, // large centre-screen text, or null
  downT: 0,
  sirenT: 0,
  job: null, // the active job, or null
  quitAsk: false, // the return-to-title dialog is open
});
const freshPlayer = () => ({
  x: HOSP.x,
  y: HOSP.y,
  a: PI / 2,
  hp: 100,
  ammo: 12,
  car: null,
  cd: 0,
  anim: 0,
  hitT: 0,
  shirt: 2,
  hair: 0,
  skin: 10,
  type: 'civ',
  swim: false, // in the water
});
// Everything about the running game that more than one module changes.
export const G = {
  fxOn: true,
  musicOn: false,
  // 'boot', 'title', 'play', 'down' (dead or arrested, about to respawn), 'over' (arrested broke) or 'win'
  screen: 'boot',
  bootT: 0,
  clock: 0,
  sidPlayer: null, // the SID player module once it has loaded
  station: 0, // index of the tuned radio station
  nowPlaying: null, // the radio track that is loaded, or null
  infoOpen: false, // the information page is open
  ...freshGame(),
};
export const K = {},
  edge = {};
/** Where a finger is held on the game screen, in screen pixels (0-319 across, 0-199 down), or null.
 * Set by input.js; on a touch screen it steers the player instead of the arrow keys. */
export const touch = { at: null };
export const P = freshPlayer();
/** Put the game and the player back to how a new game starts. Sound settings and the radio are left alone. */
export function resetState() {
  Object.assign(G, freshGame());
  Object.assign(P, freshPlayer());
}
export function msg(s) {
  G.msgTxt = s.toUpperCase();
  G.msgT = Math.max(4, s.length * 0.14 + 1.5);
  G.msgAge = 0;
}
export function bigText(t, sub, col, dur) {
  G.banner = { t, sub, col, d: dur || 2.5 };
}
export function pop(x, y, t, col) {
  G.pops.push({ x, y, t, col: col || 1, l: 1.2 });
}
export const ppos = () => P.car || P;
export const onScreen = (x, y, m) =>
  x > G.camX - m && x < G.camX + SW + m && y > G.camY - m && y < G.camY + VH + m;
