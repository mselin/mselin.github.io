// SPDX-License-Identifier: GPL-2.0-or-later
// Pixel-art icons for the touch buttons, drawn 16 by 16 in the C64 palette like everything else in the game.
// Each row is a string: '.' is transparent and the other letters are colours from COLOURS below.
import { PAL } from './config.js';

const COLOURS = { W: PAL[1], Y: PAL[7], G: PAL[15], D: PAL[12], C: PAL[3] };

export const ICONS = {
  // A pistol, firing.
  fire: [
    '................',
    '................',
    '............Y..Y',
    '.GGGGGGGGGG..YY.',
    '.WWWWWWWWWWDYWWY',
    '.WWWWWWWWWW..YY.',
    '.WWWWWDD....Y..Y',
    '.WWWW.D.D.......',
    '.WWWW..DD.......',
    '.WWWW...........',
    'WWWW............',
    'WWWW............',
    'WWW.............',
    'WWW.............',
    '................',
    '................',
  ],
  // A horn and its noise: what the fire button does from inside a car.
  horn: [
    '................',
    '................',
    '......W....W....',
    '.....WW.....W...',
    '....WWW..W...W..',
    '.WWWWWW...W..W..',
    '.WWWWWW...W...W.',
    '.WWWWWW...W...W.',
    '.WWWWWW...W...W.',
    '.WWWWWW...W..W..',
    '....WWW..W...W..',
    '.....WW.....W...',
    '......W....W....',
    '................',
    '................',
    '................',
  ],
  // A car: get in, or get out.
  use: [
    '................',
    '................',
    '................',
    '....WWWWWWW.....',
    '...WCCCWCCCW....',
    '..WCCCCWCCCCW...',
    '.WWWWWWWWWWWWWW.',
    'WWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWW',
    'WW.DD.WWWW.DD.WW',
    '..DDDD....DDDD..',
    '...DD......DD...',
    '................',
    '................',
    '................',
    '................',
  ],
  // The parking brake warning light: a P in a circle, with brackets.
  hb: [
    '................',
    '................',
    '.....WWWWWW.....',
    '....W......W....',
    '.W.W..WWW...W.W.',
    'W..W..W..W..W..W',
    'W.W...W..W...W.W',
    'W.W...WWW....W.W',
    'W.W...W......W.W',
    'W..W..W.....W..W',
    '.W.W..W.....W.W.',
    '....W......W....',
    '.....WWWWWW.....',
    '................',
    '................',
    '................',
  ],
  // Back to the title screen.
  esc: [
    '................',
    '.......WW.......',
    '......WWWW......',
    '.....WWWWWW.....',
    '....WWWWWWWW....',
    '...WWWWWWWWWW...',
    '..WWWWWWWWWWWW..',
    '...WWWWWWWWWW...',
    '...WWWWWWWWWW...',
    '...WWWW..WWWW...',
    '...WWWW..WWWW...',
    '...WWWW..WWWW...',
    '...WWWW..WWWW...',
    '................',
    '................',
    '................',
  ],
  // Skip to the next tune.
  next: [
    '................',
    '................',
    '................',
    '................',
    '.W.....W.....W..',
    '.WW....WW....W..',
    '.WWW...WWW...W..',
    '.WWWW..WWWW..W..',
    '.WWWW..WWWW..W..',
    '.WWW...WWW...W..',
    '.WW....WW....W..',
    '.W.....W.....W..',
    '................',
    '................',
    '................',
    '................',
  ],
  // The next radio station.
  radio: [
    '................',
    '............W...',
    '...........W....',
    '..........W.....',
    '.........W......',
    '.WWWWWWWWWWWWWW.',
    '.W............W.',
    '.W.DDDD..YYY..W.',
    '.W.DDDD.Y...Y.W.',
    '.W.DDDD.Y...Y.W.',
    '.W.DDDD..YYY..W.',
    '.W............W.',
    '.WWWWWWWWWWWWWW.',
    '................',
    '................',
    '................',
  ],
  // Music on or off.
  music: [
    '................',
    '.....WWWWWWWWW..',
    '.....WWWWWWWWW..',
    '.....W.......W..',
    '.....W.......W..',
    '.....W.......W..',
    '.....W.......W..',
    '.....W.......W..',
    '.....W.......W..',
    '..WWWW....WWWW..',
    '.WWWWW...WWWWW..',
    '.WWWWW...WWWWW..',
    '..WWW.....WWW...',
    '................',
    '................',
    '................',
  ],
  // Full screen.
  full: [
    '................',
    '.WWWWW....WWWWW.',
    '.WWWWW....WWWWW.',
    '.WW..........WW.',
    '.WW..........WW.',
    '.WW..........WW.',
    '................',
    '................',
    '................',
    '................',
    '.WW..........WW.',
    '.WW..........WW.',
    '.WW..........WW.',
    '.WWWWW....WWWWW.',
    '.WWWWW....WWWWW.',
    '................',
  ],
};

/** An icon as SVG markup: one rectangle per run of same-coloured pixels, kept sharp at any size. */
export function iconSvg(name) {
  const rows = ICONS[name];
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.')
        rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${COLOURS[ch]}"/>`;
      x = end;
    }
  });
  return `<svg viewBox="0 0 16 16" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}
