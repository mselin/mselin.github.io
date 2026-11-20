// SPDX-License-Identifier: GPL-2.0-or-later
// Constructors for cars and pedestrians.
import { CCOLS, DIRS } from './config.js';
import { R, pick } from './util.js';
import { COP } from './figures.js';

export function mkCar(kind, x, y, a, col) {
  return {
    x,
    y,
    a,
    vx: 0,
    vy: 0,
    kind,
    col: col != null ? col : kind.col != null ? kind.col : pick(CCOLS),
    hp: kind.hp,
    ai: null,
    driver: false,
    dir: 0,
    sp: 0,
    cruise: 0,
    inI: false,
    nd: null,
    jam: 0,
    burn: 0,
    dead: false,
    stuck: 0,
    rev: 0,
    parked: false,
    bust: 0,
    smk: 0,
    ghost: 0,
    flooded: false,
    used: false, // the player has driven it
    idle: 0, // seconds an abandoned car has sat still
    sink: 0, // 0 afloat to 1 on the bottom, once flooded
  };
}
/**
 * How far under a flooded car is, as drawn: 0 not in the water, 1 awash to the sills,
 * 2 water over the bodywork, 3 on the bottom.
 */
export const sinkStage = (c) => (!c.flooded ? 0 : c.sink < 0.3 ? 1 : c.sink < 0.75 ? 2 : 3);
/**
 * What ordinary passers-by may wear. Never the police light blue (14) or navy (6), or the player's yellow (7),
 * and never a white cap: those looks are kept for the police and the player, so they stand out in a crowd.
 */
export const CIV_SHIRTS = [4, 8, 3, 2, 10, 9, 5, 1],
  CIV_HAIR = [0, 9, 8, 7, 0],
  CIV_LEGS = [11, 9, 0, 12];
export function mkPed(x, y, type) {
  const d = pick(DIRS),
    // Scooter riders wear light green and cultists purple robes with the hood up.
    // A police officer's "hair" is a white cap.
    shirt = type === 'cop' ? COP.shirt : type === 'scoot' ? 13 : type === 'cult' ? 4 : pick(CIV_SHIRTS);
  let hair = type === 'cop' ? COP.cap : type === 'cult' ? 14 : pick(CIV_HAIR);
  // A head the same colour as the shirt would vanish into the shoulders.
  while (hair === shirt) hair = pick(CIV_HAIR);
  return {
    x,
    y,
    dx: d[0],
    dy: d[1],
    type,
    spd: type === 'scoot' ? 52 : type === 'cop' ? 47 : type === 'cult' ? 0 : 15 + R() * 8,
    shirt,
    hair,
    legs: type === 'cop' ? COP.legs : pick(CIV_LEGS),
    skin: pick([10, 10, 8]),
    t: R() * 3,
    flee: 0,
    fx: 0,
    fy: 0,
    jay: false,
    anim: R() * 9,
    cd: 1,
  };
}
