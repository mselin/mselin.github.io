// SPDX-License-Identifier: GPL-2.0-or-later
// Car, pedestrian and arrow sprites, pre-rotated from small pixel grids.
import { PI, RGB } from './config.js';
import { hash } from './util.js';

function mkSprite(src, w, h, NA, S) {
  const fr = [];
  for (let a = 0; a < NA; a++) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const q = c.getContext('2d'),
      id = q.createImageData(S, S),
      an = (a / NA) * PI * 2,
      cs = Math.cos(an),
      sn = Math.sin(an);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - S / 2,
          dy = y + 0.5 - S / 2,
          sx = Math.floor(cs * dx + sn * dy + w / 2),
          sy = Math.floor(-sn * dx + cs * dy + h / 2);
        if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
          const p = src[sy * w + sx];
          if (p >= 0) {
            const o = (y * S + x) * 4,
              c3 = RGB[p];
            id.data[o] = c3[0];
            id.data[o + 1] = c3[1];
            id.data[o + 2] = c3[2];
            id.data[o + 3] = 255;
          }
        }
      }
    q.putImageData(id, 0, 0);
    fr.push(c);
  }
  return fr;
}
function carSrc(k, col) {
  const L = k.L,
    W = k.W,
    wr = col < 0,
    body = wr ? 11 : col,
    a = new Int8Array(L * W).fill(body),
    m = W >> 1;
  const set = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < L && y < W) a[y * L + x] = c;
  };
  for (let x = 0; x < L; x++) {
    set(x, 0, 0);
    set(x, W - 1, 0);
  }
  for (let y = 0; y < W; y++) {
    set(0, y, 0);
    set(L - 1, y, 0);
  }
  [
    [0, 0],
    [L - 1, 0],
    [0, W - 1],
    [L - 1, W - 1],
  ].forEach((p) => set(p[0], p[1], -1));
  const gl = wr ? 0 : 3;
  for (let y = 2; y < W - 2; y++) {
    for (let x = L - 9; x < L - 6; x++) set(x, y, gl);
    if (k.n !== 'van') {
      set(3, y, gl);
      set(4, y, gl);
    }
  }
  if (k.n === 'limo')
    for (let x = 7; x < L - 10; x += 3) {
      set(x, 1, gl);
      set(x, W - 2, gl);
    }
  if (!wr) {
    if (k.n === 'sports') for (let x = 1; x < L - 1; x++) if (a[m * L + x] === body) set(x, m, 1);
    if (k.n === 'taxi') for (let x = 6; x < L - 9; x++) set(x, m, x & 1 ? 0 : 1);
    if (k.n === 'police') {
      for (let y = 1; y < W - 1; y++) {
        for (let x = L - 5; x < L - 1; x++) set(x, y, 6);
        for (let x = 1; x < 3; x++) set(x, y, 6);
      }
    }
    if (k.n === 'limo')
      for (let x = 1; x < L - 1; x++) {
        if (a[2 * L + x] === body) set(x, 2, 4);
        if (a[(W - 3) * L + x] === body) set(x, W - 3, 4);
      }
    set(L - 1, 2, 7);
    set(L - 1, W - 3, 7);
    set(0, 2, 2);
    set(0, W - 3, 2);
  } else for (let i = 0; i < a.length; i++) if (a[i] === 11 && hash(i, 7) % 3 === 0) a[i] = 0;
  return a;
}
const sprC = {};
export function carSpr(c) {
  const key = c.kind.n + (c.dead ? 'w' : c.col) + (c.flooded ? 'f' : '');
  if (sprC[key]) return sprC[key];
  const src = carSrc(c.kind, c.dead ? -2 : c.col);
  // Underwater: every other pixel is left out, so the water shows through.
  if (c.flooded)
    for (let i = 0; i < src.length; i++) if (((i % c.kind.L) + Math.floor(i / c.kind.L)) & 1) src[i] = -1;
  return (sprC[key] = mkSprite(src, c.kind.L, c.kind.W, 32, 34));
}
function pedSrc(shirt, hair, skin, scoot, f) {
  const a = new Int8Array(64).fill(-1),
    set = (x, y, c) => (a[y * 8 + x] = c);
  if (scoot) {
    for (let x = 0; x < 8; x++)
      if (x < 2 || x > 4) {
        set(x, 3, 12);
        set(x, 4, 12);
      }
    for (let y = 2; y < 6; y++) set(6, y, 0);
  }
  for (let y = 1; y < 7; y++) {
    set(2, y, shirt);
    set(3, y, shirt);
  }
  set(3, 3, hair);
  set(3, 4, hair);
  set(4, 3, skin);
  set(4, 4, skin);
  if (!scoot) {
    if (f) {
      set(1, 1, skin);
      set(4, 6, skin);
    } else {
      set(4, 1, skin);
      set(1, 6, skin);
    }
  } else {
    set(4, 1, skin);
    set(4, 6, skin);
  }
  return a;
}
const pedC = {};
export function pedSpr(p, f) {
  const key = p.shirt + '_' + p.hair + '_' + p.skin + '_' + (p.type === 'scoot' ? 1 : 0) + '_' + f;
  return (
    pedC[key] || (pedC[key] = mkSprite(pedSrc(p.shirt, p.hair, p.skin, p.type === 'scoot', f), 8, 8, 16, 12))
  );
}
export const ARW = (() => {
  const rows = ['...#...', '...##..', '######.', '#######', '######.', '...##..', '...#...'];
  return [1, 7].map((col) => {
    const a = new Int8Array(49);
    rows.forEach((r, y) => [...r].forEach((ch, x) => (a[y * 7 + x] = ch === '#' ? col : -1)));
    return mkSprite(a, 7, 7, 16, 11);
  });
})();
