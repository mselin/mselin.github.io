// SPDX-License-Identifier: GPL-2.0-or-later
// Small maths and random-number helpers.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
  mod = (a, n) => ((a % n) + n) % n,
  hyp = Math.hypot;
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const R = Math.random,
  pick = (a) => a[Math.floor(R() * a.length)];
export function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
