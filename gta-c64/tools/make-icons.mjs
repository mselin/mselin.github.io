// SPDX-License-Identifier: GPL-2.0-or-later
// Draws the game's icons, the ones a browser shows in its tab and a phone on its home screen, and writes them to
// assets/. They are made from the game's own letter shapes and colours, like the title screen: an "S" in the
// title's raster-bar colours, a yellow "64" beside it, and a bar above and below. The smallest has only the S.
//
//   node tools/make-icons.mjs          writes the files
//   node tools/make-icons.mjs --check  only says whether the files are up to date (the tests use this)
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { PAL } from '../js/config.js';
import { GLYPHS } from '../js/glyphs.js';

// The title screen's raster-bar colours, top to bottom (render.js).
const BARS = [2, 8, 7, 13, 3, 14, 4, 10, 1, 10, 4, 14, 3, 13, 7, 8];
const YELLOW = 7;

/** Put a glyph on the grid at (x, y), `scale` pixels to a dot, coloured row by row by `colour(y)`. */
function glyph(grid, ch, x, y, scale, colour) {
  GLYPHS[ch].forEach((row, r) => {
    for (let b = 0; b < 5; b++)
      if (row & (16 >> b))
        for (let i = 0; i < scale; i++)
          for (let j = 0; j < scale; j++)
            grid[y + r * scale + i][x + b * scale + j] = colour(y + r * scale + i);
  });
}

/** The 16 by 16 picture, for screens that show the icon at its actual size: only the S, with no room for more. */
export function picture16() {
  const grid = Array.from({ length: 16 }, () => new Array(16).fill(0));
  glyph(grid, 'S', 3, 1, 2, (y) => BARS[(y - 1 + 2) % 16]);
  return grid;
}

/** The 32 by 32 picture, as palette indexes. */
export function picture() {
  const grid = Array.from({ length: 32 }, () => new Array(32).fill(0));
  // The S, 15 by 21, in the raster colours from the brown at its top to the white across its middle.
  glyph(grid, 'S', 2, 5, 3, (y) => BARS[(y - 5 + 1) % 16]);
  // "64" in yellow, sitting on the same line as the bottom of the S, as on the title screen.
  glyph(grid, '6', 19, 19, 1, () => YELLOW);
  glyph(grid, '4', 25, 19, 1, () => YELLOW);
  // A raster bar above and below.
  for (let x = 0; x < 32; x++) {
    grid[1][x] = 14;
    grid[3][x] = 4;
    grid[28][x] = 4;
    grid[30][x] = 14;
  }
  return grid;
}

/** An RGB PNG of the picture, each pixel `scale` pixels wide, with `pad` pixels of black round it. */
export function png(grid, scale, pad = 0) {
  const n = grid.length * scale + 2 * pad,
    rgb = PAL.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))),
    raw = Buffer.alloc(n * (n * 3 + 1));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const gy = Math.floor((y - pad) / scale),
        gx = Math.floor((x - pad) / scale),
        inside = y >= pad && x >= pad && gy < grid.length && gx < grid.length,
        c = rgb[inside ? grid[gy][gx] : 0];
      c.forEach((v, i) => (raw[y * (n * 3 + 1) + 1 + x * 3 + i] = v));
    }
  const chunk = (type, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(n, 0);
  head.writeUInt32BE(n, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, not interlaced
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/**
 * Whether two PNG files hold the same picture: the same header and the same pixels once unpacked. (Comparing the
 * files byte for byte would not do: another version of zlib may pack the same pixels differently.)
 */
export function samePicture(a, b) {
  const unpack = (png) => {
    const parts = { IHDR: [], IDAT: [] };
    for (let pos = 8; pos < png.length;) {
      const len = png.readUInt32BE(pos),
        type = png.subarray(pos + 4, pos + 8).toString('latin1');
      parts[type]?.push(png.subarray(pos + 8, pos + 8 + len));
      pos += 12 + len;
    }
    return Buffer.concat([...parts.IHDR, inflateSync(Buffer.concat(parts.IDAT))]);
  };
  try {
    return unpack(a).equals(unpack(b));
  } catch (e) {
    return false;
  }
}

/** Every icon file, by its path under the game's folder. */
export function icons() {
  const grid = picture();
  return {
    'assets/icon-16.png': png(picture16(), 1),
    'assets/icon-32.png': png(grid, 1),
    // Phones round the corners of a home-screen icon off, so this one has a black margin to round off.
    'assets/icon-180.png': png(grid, 5, 10),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../', import.meta.url),
    check = process.argv.includes('--check');
  let stale = 0;
  for (const [path, bytes] of Object.entries(icons())) {
    const url = new URL(path, root);
    let same = false;
    try {
      same = samePicture(readFileSync(url), bytes);
    } catch (e) {
      /* missing */
    }
    if (same) continue;
    if (check) {
      console.log(`${path} is out of date: run node tools/make-icons.mjs`);
      stale++;
    } else {
      writeFileSync(url, bytes);
      console.log(`wrote ${path}`);
    }
  }
  process.exit(stale ? 1 : 0);
}
