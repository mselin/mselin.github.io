// SPDX-License-Identifier: GPL-2.0-or-later
// Draws the generated map once onto an off-screen canvas, which also receives decals (skid marks, scorch marks).
import { BLD, FOUNT, GRASS, LOT, MW, NB, PAL, PB, PLAZA, ROAD, TREE, WALK, WATER, WPX } from './config.js';
import { hash } from './util.js';
import { text } from './font.js';
import { bcol, bid, decals, map, signs, tile } from './world.js';

export const mapC = document.createElement('canvas');
mapC.width = mapC.height = WPX;
const mctx = mapC.getContext('2d');
decals.ctx = mctx;
export function renderMap() {
  const m = mctx;
  for (let ty = 0; ty < MW; ty++)
    for (let tx = 0; tx < MW; tx++) {
      const i = ty * MW + tx,
        t = map[i],
        px = tx * 16,
        py = ty * 16,
        h = hash(tx, ty);
      const Rc = (c, x, y, w, hh) => {
        m.fillStyle = PAL[c];
        m.fillRect(px + x, py + y, w, hh);
      };
      if (t === ROAD) {
        Rc(11, 0, 0, 16, 16);
        Rc(0, h % 13, (h >> 4) % 14, 2, 1);
        Rc(12, (h >> 8) % 15, (h >> 12) % 15, 1, 1);
        const v = tx % PB < 2,
          hz = ty % PB < 2;
        if (v && !hz) {
          const my = ty % PB;
          if (my === 2 || my === 11) {
            for (let x = 1; x < 16; x += 4) Rc(1, x, 3, 2, 10);
          } else if (tx % PB === 0) {
            Rc(7, 15, 2, 1, 6);
            Rc(7, 15, 10, 1, 5);
          }
        }
        if (hz && !v) {
          const mx = tx % PB;
          if (mx === 2 || mx === 11) {
            for (let y = 1; y < 16; y += 4) Rc(1, 3, y, 10, 2);
          } else if (ty % PB === 0) {
            Rc(7, 2, 15, 6, 1);
            Rc(7, 10, 15, 5, 1);
          }
        }
      } else if (t === WALK) {
        Rc(15, 0, 0, 16, 16);
        Rc(12, 0, 0, 16, 1);
        Rc(12, 0, 0, 1, 16);
        Rc(12, 8, 8, 1, 1);
      } else if (t === BLD) {
        const c = bcol[i],
          id = bid[i];
        Rc(c, 0, 0, 16, 16);
        const dk = c === 0 ? 11 : 0;
        if (h % 7 === 0) {
          Rc(12, 5, 5, 6, 6);
          Rc(0, 5, 5, 6, 1);
          Rc(0, 5, 5, 1, 6);
          Rc(15, 7, 7, 2, 2);
        } else if (h % 11 === 0) {
          Rc(0, 4, 4, 8, 6);
          Rc(3, 5, 5, 6, 4);
        } else if (h % 5 === 0) {
          Rc(dk, 3, ((h >> 5) % 12) + 2, 1, 1);
          Rc(dk, 11, ((h >> 9) % 12) + 2, 1, 1);
        }
        const nbr = (dx, dy) => {
          const x = tx + dx,
            y = ty + dy;
          return x >= 0 && y >= 0 && x < MW && y < MW && bid[y * MW + x] === id;
        };
        if (!nbr(-1, 0)) {
          Rc(0, 0, 0, 1, 16);
          Rc(1, 1, 0, 1, 16);
        }
        if (!nbr(1, 0)) {
          Rc(0, 15, 0, 1, 16);
          Rc(dk, 14, 0, 1, 16);
        }
        if (!nbr(0, -1)) {
          Rc(0, 0, 0, 16, 1);
          Rc(1, 0, 1, 16, 1);
        }
        if (!nbr(0, 1)) {
          Rc(0, 0, 15, 16, 1);
          Rc(dk, 0, 14, 16, 1);
        }
      } else if (t === GRASS || t === TREE) {
        Rc(5, 0, 0, 16, 16);
        for (let k = 0; k < 5; k++) Rc(13, (h >> (k * 3)) % 16, (h >> (k * 4 + 1)) % 16, 1, 1);
        if (t === TREE) {
          m.fillStyle = PAL[0];
          m.beginPath();
          m.arc(px + 8, py + 8, 7.5, 0, 7);
          m.fill();
          m.fillStyle = PAL[13];
          m.beginPath();
          m.arc(px + 8, py + 8, 6.2, 0, 7);
          m.fill();
          for (let k = 0; k < 9; k++) Rc(5, 4 + ((h >> (k * 2)) % 8), 4 + ((h >> (k * 3)) % 8), 1, 1);
          Rc(9, 7, 7, 2, 2);
        }
      } else if (t === WATER) {
        Rc(6, 0, 0, 16, 16);
        Rc(14, h % 10, (h >> 4) % 14, 4, 1);
        Rc(14, (h >> 8) % 10, (h >> 12) % 14, 3, 1);
      } else if (t === LOT) {
        Rc(11, 0, 0, 16, 16);
        const ly = (ty % PB) - 3;
        if (ly < 2 || ly > 5) Rc(1, 0, 0, 1, 16);
        Rc(12, (h >> 3) % 15, (h >> 7) % 15, 1, 1);
      } else if (t === PLAZA || t === FOUNT) {
        Rc(12, 0, 0, 16, 16);
        Rc(15, 0, 0, 8, 8);
        Rc(15, 8, 8, 8, 8);
      }
    }
  // fountains
  for (let by = 0; by < NB; by++)
    for (let bx = 0; bx < NB; bx++) {
      const x = bx * PB + 7,
        y = by * PB + 7;
      if (tile(x, y) === FOUNT) {
        const px = x * 16,
          py = y * 16;
        m.fillStyle = PAL[0];
        m.beginPath();
        m.arc(px, py, 15, 0, 7);
        m.fill();
        m.fillStyle = PAL[3];
        m.beginPath();
        m.arc(px, py, 13, 0, 7);
        m.fill();
        m.fillStyle = PAL[1];
        m.fillRect(px - 2, py - 2, 4, 4);
      }
    }
  // shadows
  m.fillStyle = PAL[0];
  for (let ty = 0; ty < MW; ty++)
    for (let tx = 0; tx < MW; tx++) {
      if (map[ty * MW + tx] === BLD) continue;
      const px = tx * 16,
        py = ty * 16;
      if (tile(tx - 1, ty) === BLD)
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 5; x++) if ((x + y) & 1) m.fillRect(px + x, py + y, 1, 1);
      if (tile(tx, ty - 1) === BLD)
        for (let x = 0; x < 16; x++)
          for (let y = 0; y < 5; y++) if ((x + y) & 1) m.fillRect(px + x, py + y, 1, 1);
    }
  for (const s of signs) {
    const w = s.txt.length * 8;
    const x = s.x + Math.floor((s.w - w) / 2),
      y = s.y + Math.floor(s.h / 2) - (s.cross ? 26 : 4);
    m.fillStyle = PAL[s.tc === 0 ? 1 : 0];
    m.fillRect(x - 3, y - 3, w + 5, 13);
    text(s.txt, x, y, s.tc === 0 ? 0 : s.tc || 1, 1, m);
    if (s.cross) {
      m.fillStyle = PAL[2];
      m.fillRect(s.x + 56, s.y + 62, 16, 40);
      m.fillRect(s.x + 44, s.y + 74, 40, 16);
    }
  }
}
