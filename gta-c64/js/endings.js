// SPDX-License-Identifier: GPL-2.0-or-later
// The two end-of-game screens: behind bars (arrested with no money) and the mayor's office (election bought).
// The pictures are bitmap files in assets/. They are 320x150 and use double-wide pixels and the 16 C64 colours,
// like C64 multicolour mode; a test checks that they stay that way. Only the cigar smoke is drawn by code.
import { PAL, SW } from './config.js';
import { TOUCH, g } from './screen.js';
import { ctext } from './font.js';
import { G } from './state.js';

const ART_Y = 18; // the picture sits between a title line and three caption lines
/** Start loading a picture from assets/. It is fetched once, when the game starts. */
function load(file) {
  const img = new Image();
  img.src = new URL('../assets/' + file, import.meta.url).href;
  return img;
}
const PICTURE = { over: load('ending-jail.png'), win: load('ending-office.png') };
/** Draw a picture if it has arrived. Until then the screen stays black behind the captions. */
function show(img) {
  if (img.complete && img.naturalWidth) g.drawImage(img, 0, ART_Y);
}
/** Whether both pictures have loaded. For the tests. */
export const endingsLoaded = () =>
  Object.values(PICTURE).every((img) => img.complete && img.naturalWidth > 0);

function drawSmoke() {
  // Three puffs rising from the cigar, each fading from light to dark grey.
  for (let i = 0; i < 3; i++) {
    const t = (G.clock * 0.35 + i / 3) % 1;
    const x = 126 + Math.sin(t * 5 + i * 2) * 4 + t * 5,
      y = ART_Y + 62 - t * 44,
      s = 2 + Math.floor(t * 5);
    g.fillStyle = PAL[t < 0.5 ? 15 : 12];
    g.fillRect(Math.round(x) * 2, Math.round(y), s * 2, s);
    g.fillRect(Math.round(x + 1) * 2, Math.round(y - s / 2), s, s);
  }
  // The cigar tip glows.
  g.fillStyle = PAL[Math.floor(G.clock * 3) & 1 ? 2 : 8];
  g.fillRect(126 * 2, ART_Y + 64, 2, 3);
}

/** Draw the 'over' or 'win' screen. */
export function drawEnding(kind) {
  const win = kind === 'win';
  g.fillStyle = PAL[0];
  g.fillRect(0, 0, SW, 200);
  if (win) {
    show(PICTURE.win);
    drawSmoke();
    ctext('ELECTION PURCHASED', 1, 7, 2);
    ctext('YOU ARE NOW MAYOR OF SLEAZEBURG.', 171, 1);
    ctext('NOTHING WILL CHANGE. CHEERS.', 180, 15);
  } else {
    show(PICTURE.over);
    ctext('BUSTED AND BROKE', 1, 10, 2);
    ctext('NO MONEY. NO BAIL. NO LAWYER.', 171, 1);
    ctext('THE SYSTEM WORKS. FOR SOMEBODY.', 180, 15);
  }
  if (Math.floor(G.clock * 2) & 1)
    ctext(TOUCH ? 'NEW GAME?  FIRE = YES  CAR = NO' : 'NEW GAME?   Y = YES   N = NO', 191, 13);
}
