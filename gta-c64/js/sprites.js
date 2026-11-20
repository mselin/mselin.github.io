// SPDX-License-Identifier: GPL-2.0-or-later
// Car, pedestrian and arrow sprites, pre-rotated from small pixel grids.
import { PI, RGB } from './config.js';
import { hash } from './util.js';
import { sinkStage } from './entities.js';
import { FIG, FRAME, figure, lookOf, outlineOf } from './figures.js';

/**
 * Turn a w x h grid of palette indexes (-1 for empty) into NA frames, S pixels square, each turned a step
 * further round. `k` is how many grid cells make one screen pixel. Each colour in `rings` draws an outline
 * round the turned figure, innermost first, so outlines stay unbroken whichever way the figure faces.
 */
function mkSprite(src, w, h, NA, S, rings = [], k = 1) {
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
        const dx = (x + 0.5 - S / 2) * k,
          dy = (y + 0.5 - S / 2) * k,
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
    for (const col of rings) outline(id.data, S, RGB[col]);
    q.putImageData(id, 0, 0);
    fr.push(c);
  }
  return fr;
}
/** Colour every empty pixel that has a filled one beside it, above it or below it. */
function outline(d, S, c3) {
  const on = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[(y * S + x) * 4 + 3] === 255,
    ring = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)))
        ring.push((y * S + x) * 4);
  for (const o of ring) d.set([c3[0], c3[1], c3[2], 255], o);
}
/**
 * Double an n x n grid with Scale2x, which rounds off its stair-steps. Turning a smoothed grid gives rounder,
 * steadier shapes than turning the blocky original, while every pixel drawn is still one palette colour.
 */
function scale2x(src, n) {
  const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? -1 : src[y * n + x]),
    m = n * 2,
    out = new Int8Array(m * m);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const p = at(x, y),
        a = at(x, y - 1),
        b = at(x + 1, y),
        c = at(x - 1, y),
        d = at(x, y + 1),
        o = y * 2 * m + x * 2;
      out[o] = c === a && c !== d && a !== b ? a : p;
      out[o + 1] = a === b && a !== c && b !== d ? b : p;
      out[o + m] = d === c && d !== b && c !== a ? c : p;
      out[o + m + 1] = b === d && b !== a && d !== c ? d : p;
    }
  return out;
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
/**
 * Redraw a car's pixels as seen through water. Stage 1: the waterline laps round the edge.
 * Stage 2: water over the bodywork, so every other pixel is water and the rim is gone.
 * Stage 3: on the bottom, a dark shape with only the glass catching the light, and ripples across the top.
 */
function submerge(src, L, W, stage) {
  const at = (x, y) => (x < 0 || y < 0 || x >= L || y >= W ? -1 : src[y * L + x]);
  const out = src.slice();
  for (let y = 0; y < W; y++)
    for (let x = 0; x < L; x++) {
      const i = y * L + x,
        p = src[i];
      if (p < 0) continue;
      const edge = at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0,
        rim = x < 2 || y < 2 || x >= L - 2 || y >= W - 2,
        light = [1, 3, 7, 13, 15].includes(p),
        odd = (x + y) & 1;
      if (stage === 1) {
        if (edge) out[i] = 14;
      } else if (stage === 2) {
        if (edge) out[i] = 6;
        else if (rim) out[i] = odd ? 14 : 6;
        else if (odd) out[i] = 6;
        else if (light) out[i] = 14;
      } else {
        if (rim) out[i] = edge ? -1 : 6;
        else out[i] = p === 3 ? 14 : odd ? 0 : 6; // only the glass still catches the light
      }
    }
  if (stage === 3) {
    const m = W >> 1;
    for (const [x0, y, n] of [
      [3, 2, 4],
      [L - 9, W - 3, 5],
      [7, m, 3],
    ])
      for (let x = x0; x < x0 + n; x++) out[y * L + x] = 14;
  }
  return out;
}
const sprC = {};
export function carSpr(c) {
  const stage = sinkStage(c),
    key = c.kind.n + (c.dead ? 'w' : c.col) + (stage ? 'f' + stage : '');
  if (sprC[key]) return sprC[key];
  let src = carSrc(c.kind, c.dead ? -2 : c.col);
  if (stage) src = submerge(src, c.kind.L, c.kind.W, stage);
  return (sprC[key] = mkSprite(src, c.kind.L, c.kind.W, 32, 34));
}
const pedC = {};
/** Someone on foot facing 16 ways round, in walking frame `f` (0 or 1). See figures.js for the pixel art. */
export function pedSpr(p, f) {
  const key = [lookOf(p), p.shirt, p.hair, p.skin, p.legs, f].join('_');
  if (pedC[key]) return pedC[key];
  // Smoothed three times over: eight grid cells to a screen pixel.
  let src = figure(p, f);
  for (let n = FIG; n < FIG * 8; n *= 2) src = scale2x(src, n);
  return (pedC[key] = mkSprite(src, FIG * 8, FIG * 8, 16, FRAME, outlineOf(p), 8));
}
export const ARW = (() => {
  const rows = ['...#...', '...##..', '######.', '#######', '######.', '...##..', '...#...'];
  return [1, 7].map((col) => {
    const a = new Int8Array(49);
    rows.forEach((r, y) => [...r].forEach((ch, x) => (a[y * 7 + x] = ch === '#' ? col : -1)));
    return mkSprite(a, 7, 7, 16, 11);
  });
})();
