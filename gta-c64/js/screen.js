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
function fit() {
  const s = Math.min(innerWidth / 384, innerHeight / 272);
  const k = s >= 1 ? Math.floor(s) : s;
  cv.style.width = 384 * k + 'px';
  cv.style.height = 272 * k + 'px';
}
addEventListener('resize', fit);
fit();
export const TOUCH = matchMedia('(pointer:coarse)').matches;
