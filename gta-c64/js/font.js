// SPDX-License-Identifier: GPL-2.0-or-later
// The 8x8 bitmap font and text drawing.
import { PAL, SW } from './config.js';
import { g } from './screen.js';
import { GLYPHS } from './glyphs.js';

const F = GLYPHS;
const CH = Object.keys(F),
  CHI = {};
CH.forEach((c, i) => (CHI[c] = i));
const fontC = [];
function atlas(col) {
  if (fontC[col]) return fontC[col];
  const c = document.createElement('canvas');
  c.width = CH.length * 8;
  c.height = 8;
  const q = c.getContext('2d');
  q.fillStyle = PAL[col];
  CH.forEach((ch, i) =>
    F[ch].forEach((row, r) => {
      for (let b = 0; b < 5; b++) if (row & (16 >> b)) q.fillRect(i * 8 + 1 + b, r, 1, 1);
    }),
  );
  return (fontC[col] = c);
}
export function text(s, x, y, col, sc, ctx) {
  s = String(s).toUpperCase();
  sc = sc || 1;
  ctx = ctx || g;
  const a = atlas(col);
  for (let i = 0; i < s.length; i++) {
    const k = CHI[s[i]];
    if (k !== undefined) ctx.drawImage(a, k * 8, 0, 8, 8, x + i * 8 * sc, y, 8 * sc, 8 * sc);
  }
}
export const ctext = (s, y, col, sc) =>
  text(s, Math.floor((SW - String(s).length * 8 * (sc || 1)) / 2), y, col, sc);
