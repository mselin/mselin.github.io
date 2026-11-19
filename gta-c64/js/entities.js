// SPDX-License-Identifier: GPL-2.0-or-later
// Constructors for cars and pedestrians.
import { CCOLS, DIRS } from './config.js';
import { R, pick } from './util.js';

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
  };
}
export function mkPed(x, y, type) {
  const d = pick(DIRS);
  return {
    x,
    y,
    dx: d[0],
    dy: d[1],
    type,
    spd: type === 'scoot' ? 52 : type === 'cop' ? 47 : 15 + R() * 8,
    shirt: type === 'cop' ? 6 : type === 'scoot' ? 13 : pick([4, 6, 8, 3, 7, 14, 10, 9, 5, 1]),
    hair: type === 'cop' ? 1 : pick([0, 9, 8, 7, 0]),
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
