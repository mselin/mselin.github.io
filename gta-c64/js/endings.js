// SPDX-License-Identifier: GPL-2.0-or-later
// The two end-of-game pictures: behind bars (arrested with no money) and the mayor's office (election bought).
// Each is drawn once from rectangles, in double-wide pixels like C64 multicolour mode, then shown with a few moving details.
import { PAL, SW } from './config.js';
import { TOUCH, g } from './screen.js';
import { ctext, text } from './font.js';
import { G } from './state.js';

const ART_Y = 18; // the picture sits between a title line and three caption lines
const ART_H = 150;
const cache = {};

/** Build a picture once. `paint` gets B(colour, x, y, w, h) working in 160-wide pixels, and the 320-wide context. */
function picture(name, paint) {
  if (cache[name]) return cache[name];
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = ART_H;
  const q = c.getContext('2d');
  const B = (col, x, y, w, h) => {
    q.fillStyle = PAL[col];
    q.fillRect(x * 2, y, w * 2, h);
  };
  paint(B, q);
  return (cache[name] = c);
}
/** A chequered fill, for stubble, bruises and shading. */
function dither(B, col, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if ((x + y) & 1) B(col, x, y, 1, 1);
}

function paintJail(B, q) {
  // Cell wall
  B(12, 0, 0, 160, ART_H);
  for (let y = 0, row = 0; y < ART_H; y += 10, row++) {
    B(11, 0, y, 160, 1);
    for (let x = (row % 2) * 10; x < 160; x += 20) B(11, x, y, 1, 10);
  }
  dither(B, 11, 0, 0, 160, 10);
  dither(B, 11, 0, 120, 160, 30);
  // Height lines, as on a mugshot wall
  for (let i = 0; i < 6; i++) B(0, 0, 24 + i * 22, 9, 1);

  // Shoulders in the red shirt
  B(0, 32, 110, 96, 40);
  B(2, 34, 112, 92, 38);
  B(12, 32, 110, 6, 3);
  B(12, 122, 110, 6, 3);
  dither(B, 0, 34, 132, 92, 18);
  B(0, 60, 112, 2, 12);
  B(0, 98, 112, 2, 12);
  // Neck and torn collar
  B(0, 68, 98, 24, 16);
  B(10, 70, 98, 20, 20);
  B(8, 70, 104, 20, 2);
  B(10, 74, 116, 12, 5);
  B(10, 77, 121, 6, 3);

  // Head
  B(0, 55, 40, 50, 64);
  B(10, 57, 42, 46, 60);
  B(12, 55, 98, 3, 6);
  B(12, 102, 98, 3, 6);
  B(0, 58, 100, 3, 3);
  B(0, 99, 100, 3, 3);
  // Ears
  B(0, 51, 64, 5, 16);
  B(10, 53, 66, 3, 12);
  B(0, 104, 64, 5, 16);
  B(10, 104, 66, 3, 12);
  // Hair, slept on
  B(0, 55, 34, 50, 14);
  B(0, 59, 30, 7, 5);
  B(0, 70, 28, 9, 7);
  B(0, 84, 30, 7, 5);
  B(0, 95, 32, 6, 4);
  B(0, 57, 48, 9, 5);
  B(0, 92, 48, 11, 3);
  // Plaster on the forehead
  B(1, 61, 51, 15, 6);
  B(15, 61, 56, 15, 1);
  B(15, 66, 51, 1, 6);
  B(15, 71, 51, 1, 6);
  // Brows: one resigned, one swollen
  B(0, 61, 61, 13, 2);
  B(0, 60, 62, 3, 2);
  B(0, 86, 59, 14, 2);
  // His right eye: open, tired
  B(1, 62, 66, 11, 5);
  B(0, 66, 66, 4, 5);
  B(1, 67, 67, 1, 1);
  B(8, 62, 72, 11, 1);
  // His left eye: black, swollen shut
  B(4, 83, 62, 19, 14);
  B(6, 85, 64, 15, 10);
  B(0, 87, 69, 11, 2);
  dither(B, 4, 81, 76, 22, 5);
  // Nose, slightly rearranged, with a nosebleed
  B(8, 82, 72, 2, 10);
  B(8, 75, 81, 10, 2);
  B(2, 82, 83, 2, 4);
  // Bruised cheek
  dither(B, 4, 59, 77, 9, 8);
  // Stubble
  dither(B, 9, 59, 86, 42, 14);
  B(10, 68, 86, 24, 8);
  // Mouth: a flat line with a split lip
  B(0, 69, 89, 22, 2);
  B(0, 67, 90, 2, 2);
  B(0, 91, 90, 2, 2);
  B(2, 85, 91, 5, 3);
  B(2, 88, 94, 2, 5);

  // Booking board
  B(0, 50, 115, 60, 23);
  B(1, 51, 116, 58, 21);
  text('NO.', 108, 119, 0, 1, q);
  text('0064', 168, 119, 0, 1, q);
  text('SLZ', 108, 128, 11, 1, q);
  text('P.D.', 168, 128, 11, 1, q);

  // The bars, and both fists around them
  for (let x = 12; x < 160; x += 32) {
    B(0, x - 1, 0, 7, ART_H);
    B(15, x, 0, 5, ART_H);
    B(1, x, 0, 1, ART_H);
    B(11, x + 4, 0, 1, ART_H);
  }
  for (const y of [8, 140]) {
    B(0, 0, y - 1, 160, 8);
    B(15, 0, y, 160, 6);
    B(1, 0, y, 160, 1);
    B(11, 0, y + 5, 160, 1);
  }
  for (const fx of [41, 105]) {
    B(0, fx - 1, 104, 13, 18);
    B(10, fx, 105, 11, 16);
    for (let i = 0; i < 3; i++) B(8, fx, 109 + i * 4, 11, 1);
    B(2, fx + 6, 106, 3, 2);
  }
}

function paintGuest(B, x0, dress, hair, glassSide) {
  // Hair, face
  B(0, x0 + 1, 25, 18, 28);
  B(hair, x0 + 2, 26, 16, 26);
  B(10, x0 + 5, 31, 10, 13);
  B(hair, x0 + 5, 30, 10, 3);
  B(0, x0 + 7, 36, 2, 2);
  B(0, x0 + 11, 36, 2, 2);
  B(2, x0 + 8, 41, 4, 1);
  // Neck, shoulders, dress
  B(10, x0 + 8, 44, 4, 5);
  B(0, x0 + 1, 48, 18, 60);
  B(10, x0 + 2, 49, 16, 6);
  B(dress, x0 + 3, 53, 14, 55);
  B(dress, x0 + 2, 55, 16, 4);
  B(0, x0 + 3, 64, 2, 44);
  B(0, x0 + 15, 64, 2, 44);
  B(7, x0 + 7, 49, 6, 1);
  B(1, x0 + 6, 28, 3, 1);
  // Raised arm and a champagne flute
  const ax = glassSide > 0 ? x0 + 18 : x0 - 3;
  B(0, ax - 1, 38, 5, 18);
  B(10, ax, 42, 3, 13);
  B(1, ax - 1, 30, 5, 8);
  B(7, ax, 31, 3, 6);
  B(1, ax + 1, 38, 1, 4);
}

function paintOffice(B, q, guests) {
  // Panelled wall
  B(9, 0, 0, 160, ART_H);
  for (let x = 0; x < 160; x += 16) B(8, x, 0, 1, 70);
  B(8, 0, 70, 160, 40);
  B(0, 0, 70, 160, 1);
  for (let x = 8; x < 160; x += 24) {
    B(9, x, 76, 18, 30);
    B(0, x, 76, 18, 1);
  }
  // Window on the city he now owns
  B(0, 27, 7, 42, 52);
  B(15, 28, 8, 40, 50);
  B(6, 30, 10, 36, 46);
  B(1, 56, 14, 6, 6);
  B(6, 58, 14, 4, 3);
  for (const [x, y, w] of [
    [30, 34, 7],
    [38, 26, 8],
    [47, 38, 6],
    [54, 30, 12],
  ]) {
    B(0, x, y, w, 56 - y);
    for (let wy = y + 3; wy < 54; wy += 5)
      for (let wx = x + 1; wx < x + w - 1; wx += 3) if ((wx * 7 + wy * 3) % 5 < 3) B(7, wx, wy, 1, 2);
  }
  B(15, 47, 10, 2, 46);
  B(15, 30, 32, 36, 2);
  // His own portrait fund
  B(0, 89, 3, 32, 30);
  B(7, 90, 4, 30, 28);
  B(5, 92, 6, 26, 24);
  text('$', 198, 10, 13, 2, q);

  guests();

  // Wing chair
  B(0, 72, 34, 62, 78);
  B(2, 74, 36, 58, 76);
  for (const [x, y] of [
    [80, 42],
    [98, 42],
    [116, 42],
    [89, 52],
    [107, 52],
  ])
    B(0, x, y, 2, 2);
  B(10, 74, 36, 58, 1);

  // The fat cat: pinstripe suit, white front, red tie
  B(0, 68, 70, 68, 42);
  B(11, 70, 72, 64, 40);
  for (let x = 72; x < 134; x += 4) B(12, x, 72, 1, 40);
  B(1, 91, 74, 22, 38);
  B(0, 89, 74, 2, 34);
  B(0, 113, 74, 2, 34);
  B(2, 100, 74, 4, 24);
  B(2, 98, 96, 8, 6);
  for (let y = 80; y < 110; y += 8) B(15, 107, y, 2, 2);
  // Paw on the belly, with a gold ring
  B(0, 76, 92, 14, 10);
  B(8, 77, 93, 12, 8);
  B(7, 83, 93, 3, 8);
  // Head
  B(0, 78, 36, 48, 38);
  B(8, 80, 38, 44, 34);
  B(0, 76, 46, 4, 20);
  B(8, 78, 48, 3, 16);
  B(0, 124, 46, 4, 20);
  B(8, 123, 48, 3, 16);
  for (const ex of [80, 112]) {
    B(0, ex, 27, 12, 12);
    B(8, ex + 2, 29, 8, 10);
    B(10, ex + 4, 31, 4, 7);
  }
  for (const [x, h] of [
    [95, 6],
    [101, 9],
    [107, 6],
  ])
    B(9, x, 38, 2, h);
  // Smug, half-closed eyes
  B(0, 86, 49, 11, 2);
  B(0, 85, 47, 2, 3);
  B(0, 107, 49, 11, 2);
  B(0, 116, 47, 2, 3);
  B(13, 89, 51, 5, 1);
  B(13, 110, 51, 5, 1);
  // Muzzle, nose, grin, whiskers
  B(1, 91, 55, 22, 15);
  B(10, 100, 56, 4, 3);
  B(0, 101, 59, 2, 3);
  B(0, 95, 63, 14, 1);
  B(0, 94, 62, 1, 1);
  B(0, 109, 62, 1, 1);
  for (const y of [57, 61]) {
    B(1, 68, y, 14, 1);
    B(1, 122, y, 14, 1);
  }
  // Cigar
  B(0, 107, 63, 20, 5);
  B(9, 108, 64, 16, 3);
  B(7, 112, 64, 2, 3);
  B(15, 124, 64, 2, 3);

  // Desk, with his feet up on it
  B(0, 0, 104, 160, 1);
  B(10, 0, 105, 160, 11);
  B(8, 0, 116, 160, 34);
  B(0, 0, 116, 160, 1);
  for (const [x, w] of [
    [4, 62],
    [72, 84],
  ]) {
    B(0, x, 121, w, 26);
    B(9, x + 1, 122, w - 2, 24);
    B(7, x + w / 2 - 3, 132, 6, 2);
  }
  // Two pinstriped legs stretched across the desk, crossed at the ankle
  B(0, 40, 91, 36, 15);
  B(11, 40, 92, 36, 13);
  for (let x = 42; x < 76; x += 4) B(12, x, 92, 1, 13);
  B(0, 40, 98, 36, 1);
  B(1, 37, 92, 3, 13);
  // Shoe soles, facing us
  for (const [x, y] of [
    [25, 80],
    [15, 86],
  ]) {
    B(0, x, y + 2, 13, 22);
    B(0, x + 2, y, 9, 26);
    B(8, x + 2, y + 2, 9, 22);
    B(8, x + 1, y + 4, 11, 12);
    B(9, x + 3, y + 17, 7, 6);
    B(10, x + 4, y + 4, 2, 9);
  }
  // Campaign funds
  for (const [x, y, n] of [
    [82, 108, 3],
    [98, 106, 4],
    [50, 110, 2],
  ]) {
    for (let i = 0; i < n; i++) {
      B(0, x - 1, y - i * 3 - 1, 16, 4);
      B(5, x, y - i * 3, 14, 3);
      B(13, x + 5, y - i * 3, 4, 3);
    }
  }
  // Champagne on ice
  B(0, 133, 88, 20, 22);
  B(15, 134, 90, 18, 19);
  B(12, 134, 90, 3, 19);
  B(1, 138, 92, 2, 14);
  B(1, 134, 87, 18, 4);
  B(3, 136, 88, 4, 2);
  B(3, 145, 88, 4, 2);
  B(0, 140, 62, 8, 26);
  B(5, 141, 68, 6, 20);
  B(5, 143, 60, 2, 9);
  B(7, 142, 58, 4, 5);
  B(1, 142, 76, 4, 6);
  for (const x of [120, 127]) {
    B(1, x, 93, 5, 8);
    B(7, x + 1, 94, 3, 6);
    B(1, x + 2, 101, 1, 6);
    B(1, x, 107, 5, 1);
  }
}

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
    g.drawImage(
      picture('office', (B, q) =>
        paintOffice(B, q, () => {
          paintGuest(B, 3, 3, 7, 1);
          paintGuest(B, 137, 4, 0, -1);
        }),
      ),
      0,
      ART_Y,
    );
    drawSmoke();
    ctext('ELECTION PURCHASED', 1, 7, 2);
    ctext('YOU ARE NOW MAYOR OF SLEAZEBURG.', 171, 1);
    ctext('NOTHING WILL CHANGE. CHEERS.', 180, 15);
  } else {
    g.drawImage(picture('jail', paintJail), 0, ART_Y);
    ctext('BUSTED AND BROKE', 1, 10, 2);
    ctext('NO MONEY. NO BAIL. NO LAWYER.', 171, 1);
    ctext('THE SYSTEM WORKS. FOR SOMEBODY.', 180, 15);
  }
  if (Math.floor(G.clock * 2) & 1)
    ctext(TOUCH ? 'NEW GAME?  FIRE = YES  CAR = NO' : 'NEW GAME?   Y = YES   N = NO', 191, 13);
}
