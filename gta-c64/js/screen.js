// SPDX-License-Identifier: GPL-2.0-or-later
// The canvas: a 320x200 game screen drawn inside a 384x272 bordered display, scaled to fit the window.
import { SH, SW } from './config.js';

export const cv = document.getElementById('c'),
  cx = cv.getContext('2d');
export const scr = document.createElement('canvas');
scr.width = SW;
scr.height = SH;
export const g = scr.getContext('2d');
cx.imageSmoothingEnabled = false;
g.imageSmoothingEnabled = false;
export const TOUCH = matchMedia('(pointer:coarse)').matches;
function fit() {
  let k;
  if (TOUCH) {
    // Phones and tablets: every pixel counts, so the 320x200 game fills the screen and the decorative border
    // runs off its edges. The game stays centred, because it sits in the middle of the canvas.
    k = Math.min(innerWidth / SW, innerHeight / SH);
  } else {
    // Elsewhere, the whole C64 screen with its border, in whole-pixel steps while there is room.
    const s = Math.min(innerWidth / 384, innerHeight / 272);
    k = s >= 1 ? Math.floor(s) : s;
  }
  cv.style.width = 384 * k + 'px';
  cv.style.height = 272 * k + 'px';
}
addEventListener('resize', fit);
fit();
