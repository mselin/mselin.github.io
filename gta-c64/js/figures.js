// SPDX-License-Identifier: GPL-2.0-or-later
// People on foot as pixel grids, seen from above: passers-by, police, scooter riders, cultists and the player.
// No drawing, so the tests can check them; sprites.js turns each grid into 16 rotated frames.

/** A person is drawn on a FIG x FIG grid, facing right: one row per line across the shoulders, left to right. */
export const FIG = 14;
/** Every rotated frame is FRAME pixels square: room for the figure turned any way round, plus its outlines. */
export const FRAME = 18;
/**
 * The outlines drawn round a figure once it is turned, innermost first: black for everyone, and round that,
 * for the player alone, a white one. Nobody else is ever drawn with white round them.
 */
export const OUTLINE = [0],
  PLAYER_OUTLINE = [0, 1];
/** What a police officer on foot wears: a light blue shirt, navy trousers and a white cap. */
export const COP = { shirt: 14, legs: 6, cap: 1 };
/** The darker palette colour that shades each colour: the back of the shoulders and the sleeves. */
export const SHADE = [0, 15, 9, 12, 6, 9, 0, 8, 9, 0, 2, 0, 11, 5, 6, 12];

// The letters: S shirt, s its shade, K skin, H hair, L trousers, C cap, P cap peak, G cap badge, V hood,
// D scooter deck, T handlebar, W wheels. A dot is empty.
// Shoulders across, the head over them and poking out in front, so the outline shows which way someone faces.
// Mid-stride: the left hand swings forward and the left foot trails behind. The other stride is this one mirrored.
const WALK = [
  '..............',
  '..............',
  '......ssK.....',
  '.....sSSS.....',
  '....LSSSS.....',
  '....LSSSS.....',
  '.....SSSS.....',
  '.....SSSS.....',
  '.....SSSS.....',
  '.....SSSS.....',
  '.....sSSS.....',
  '.....Kss......',
  '..............',
  '..............',
];
// Standing on the deck, both hands on the handlebar.
const SCOOT = [
  '..............',
  '..............',
  '......ss......',
  '.....sSSss....',
  '.....SSSS.KT..',
  '.....SSSS..T..',
  '.WDDDSSSS..TW.',
  '.WDDDSSSS..TW.',
  '.....SSSS..T..',
  '.....SSSS.KT..',
  '.....sSSss....',
  '......ss......',
  '..............',
  '..............',
];
// A long robe that hides the legs, hands held out in front.
const ROBE = [
  '..............',
  '..............',
  '......ss......',
  '....sSSSS.....',
  '...sSSSSSK....',
  '...sSSSSS.....',
  '...sSSSSS.....',
  '...sSSSSS.....',
  '...sSSSSS.....',
  '...sSSSSSK....',
  '....sSSSS.....',
  '......ss......',
  '..............',
  '..............',
];
// Heads, drawn over the shoulders from row 5: [left edge, rows]. Hair on the crown and the face to the front;
// a police cap with its badge and peak; a hood that hangs down the back.
const HAIR = [6, ['.HHH.', 'HHHKK', 'HHHKK', '.HHH.']];
const CAP = [6, ['.CCC.', 'CCCGP', 'CCCGP', '.CCC.']];
const HOOD = [5, ['..VVV', 'VVVVK', 'VVVVK', '..VVV']];
const HEAD_Y = 5;

/** How someone is drawn: 'player', 'cop', 'scoot', 'cult', or 'civ' for everyone else. */
export const lookOf = (p) => (['player', 'cop', 'scoot', 'cult'].includes(p.type) ? p.type : 'civ');

/**
 * The grid for a person, one palette index per pixel (-1 for empty), facing right.
 * `f` is the walking frame, 0 or 1.
 */
export function figure(p, f) {
  const look = lookOf(p),
    body = look === 'scoot' ? SCOOT : look === 'cult' ? ROBE : WALK,
    [hx, head] = look === 'cop' ? CAP : look === 'cult' ? HOOD : HAIR,
    col = {
      S: p.shirt,
      s: SHADE[p.shirt],
      K: p.skin,
      H: p.hair,
      L: p.legs ?? 11,
      C: p.hair, // a police officer's "hair" is the cap
      P: 0,
      G: 7,
      V: p.hair, // and a cultist's is the hood
      D: 12,
      T: 12,
      W: 0,
    },
    a = new Int8Array(FIG * FIG).fill(-1),
    // Walkers alternate strides; riders and cultists hold still.
    flip = f && body === WALK;
  for (let y = 0; y < FIG; y++) {
    const row = body[flip ? FIG - 1 - y : y],
      hrow = head[y - HEAD_Y];
    for (let x = 0; x < FIG; x++) {
      let ch = row[x];
      if (hrow && x >= hx && x < hx + hrow.length && hrow[x - hx] !== '.') ch = hrow[x - hx];
      if (ch !== '.') a[y * FIG + x] = col[ch];
    }
  }
  return a;
}
/** The outlines for a person, innermost first. */
export const outlineOf = (p) => (lookOf(p) === 'player' ? PLAYER_OUTLINE : OUTLINE);
