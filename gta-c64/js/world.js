// SPDX-License-Identifier: GPL-2.0-or-later
// The city map: tile grid, generation, collision queries and the fixed locations. No drawing, so it runs without a browser.
import {
  BLD,
  FOUNT,
  GRASS,
  LOT,
  MW,
  NB,
  PB,
  PI,
  PLAZA,
  ROAD,
  SHOPS,
  SPECIAL,
  TREE,
  WALK,
  WATER,
} from './config.js';
import { mulberry } from './util.js';

export const map = new Uint8Array(MW * MW),
  bid = new Uint16Array(MW * MW),
  bcol = new Uint8Array(MW * MW);
export const tile = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MW ? WATER : map[ty * MW + tx]);
export const tileAt = (x, y) => tile(Math.floor(x / 16), Math.floor(y / 16));
const solidT = (t) => t === BLD || t === WATER || t === TREE || t === FOUNT;
export const solidAt = (x, y) => solidT(tileAt(x, y));
/** Water a car can end up in: the canal and the fountain pools. */
export const isWater = (t) => t === WATER || t === FOUNT;
export const waterAt = (x, y) => isWater(tileAt(x, y));
/** What stops a car: buildings and trees. Water does not; it floods the car instead. */
export const wallAt = (x, y) => {
  const t = tileAt(x, y);
  return solidT(t) && !isWater(t);
};
/** The closest spot to (x, y) that can be stood on, searching outwards in rings. Null if there is none nearby. */
export function nearestLand(x, y) {
  for (let r = 0; r <= 200; r += 4) {
    for (let i = 0; i < 16; i++) {
      const px = x + Math.cos((i / 16) * Math.PI * 2) * r,
        py = y + Math.sin((i / 16) * Math.PI * 2) * r;
      if (!solidAt(px, py) && !solidAt(px - 3, py - 3) && !solidAt(px + 3, py + 3)) return { x: px, y: py };
    }
  }
  return null;
}
export const signs = [],
  parkSpots = [];
export const decals = { ctx: { fillStyle: '', fillRect() {} } };
export const loc = (bx, by) => ({ x: (bx * PB + 7) * 16, y: (by * PB + 2) * 16 + 8 });
export const HOSP = loc(1, 1),
  COPS = loc(6, 2),
  CHOP = loc(6, 6),
  PAINT = loc(1, 6),
  HALL = loc(2, 5);
export const JOBPTS = [loc(2, 2), loc(5, 4), loc(3, 7), loc(7, 0), loc(0, 4)];
export function genMap() {
  const rnd = mulberry(64064);
  let nb = 1;
  const BC = [2, 4, 8, 9, 10, 12, 14, 3, 6];
  let shopI = 0;
  const fill = (x0, y0, w, h, t, col) => {
    const id = t === BLD ? nb++ : 0;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const i = y * MW + x;
        map[i] = t;
        bid[i] = id;
        bcol[i] = col || 0;
      }
  };
  const bld = (x0, y0, w, h) => {
    const col = BC[Math.floor(rnd() * BC.length)];
    fill(x0, y0, w, h, BLD, col);
    if (w === 8 && rnd() < 0.75)
      signs.push({
        x: x0 * 16,
        y: y0 * 16,
        w: w * 16,
        h: h * 16,
        txt: SHOPS[shopI++ % SHOPS.length],
        tc: [3, 12, 10, 14].includes(col) ? 0 : 1,
      });
  };
  for (let y = 0; y < MW; y++)
    for (let x = 0; x < MW; x++) {
      const mx = x % PB,
        my = y % PB;
      map[y * MW + x] =
        mx < 2 || my < 2 ? ROAD : mx === 2 || mx === 11 || my === 2 || my === 11 ? WALK : GRASS;
    }
  for (let by = 0; by < NB; by++)
    for (let bx = 0; bx < NB; bx++) {
      const ox = bx * PB + 3,
        oy = by * PB + 3,
        sp = SPECIAL[bx + ',' + by];
      if (bx === 4) {
        fill(ox, oy, 8, 8, WATER);
        continue;
      }
      if (sp) {
        fill(ox, oy, 8, 8, BLD, sp.col);
        signs.push({ x: ox * 16, y: oy * 16, w: 128, h: 128, txt: sp.txt, tc: sp.tc, cross: sp.cross });
        continue;
      }
      const r = rnd();
      if (r < 0.13) {
        fill(ox, oy, 8, 8, GRASS);
        for (let y = oy; y < oy + 8; y++)
          for (let x = ox; x < ox + 8; x++) if (rnd() < 0.16) map[y * MW + x] = TREE;
      } else if (r < 0.25) {
        fill(ox, oy, 8, 8, LOT);
        for (let i = 0; i < 8; i++) {
          if (rnd() < 0.45) parkSpots.push({ x: (ox + i) * 16 + 8, y: (oy + 1) * 16, a: PI / 2 });
          if (rnd() < 0.45) parkSpots.push({ x: (ox + i) * 16 + 8, y: (oy + 7) * 16, a: -PI / 2 });
        }
      } else if (r < 0.32) {
        fill(ox, oy, 8, 8, PLAZA);
        fill(ox + 3, oy + 3, 2, 2, FOUNT);
      } else {
        const q = rnd();
        if (q < 0.3) bld(ox, oy, 8, 8);
        else if (q < 0.5) {
          bld(ox, oy, 8, 4);
          bld(ox, oy + 4, 8, 4);
        } else if (q < 0.65) {
          bld(ox, oy, 4, 8);
          bld(ox + 4, oy, 4, 8);
        } else
          for (let j = 0; j < 2; j++)
            for (let i = 0; i < 2; i++) {
              const z = rnd();
              if (z < 0.14) {
                fill(ox + i * 4, oy + j * 4, 4, 4, GRASS);
                map[(oy + j * 4 + 1) * MW + ox + i * 4 + 2] = TREE;
              } else if (z < 0.24) fill(ox + i * 4, oy + j * 4, 4, 4, PLAZA);
              else bld(ox + i * 4, oy + j * 4, 4, 4);
            }
      }
    }
}
