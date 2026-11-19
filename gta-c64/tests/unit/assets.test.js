// SPDX-License-Identifier: GPL-2.0-or-later
// The picture files in assets/ are meant to be edited in a paint program. These tests keep an edited picture
// usable by the game: the right size, only the sixteen C64 colours, and double-wide pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PAL } from '../../js/config.js';

/** Decode an 8-bit, non-interlaced PNG (truecolour, with or without alpha, or palette) to RGBA pixels. */
function decodePng(buf) {
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', 'a PNG file');
  let pos = 8,
    head,
    palette;
  const data = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos),
      type = buf.subarray(pos + 4, pos + 8).toString('latin1'),
      body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR')
      head = {
        w: body.readUInt32BE(0),
        h: body.readUInt32BE(4),
        depth: body[8],
        colour: body[9],
        interlace: body[12],
      };
    if (type === 'PLTE') palette = body;
    if (type === 'IDAT') data.push(body);
    pos += 12 + len;
  }
  assert.equal(head.depth, 8, 'eight bits per channel');
  assert.equal(head.interlace, 0, 'not interlaced');
  const channels = { 2: 3, 6: 4, 3: 1 }[head.colour];
  assert.ok(channels, `colour type ${head.colour} is not supported: save as RGB, RGBA or indexed`);
  const raw = inflateSync(Buffer.concat(data)),
    stride = head.w * channels,
    px = new Uint8Array(head.w * head.h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < head.h; y++) {
    const filter = raw[y * (stride + 1)],
      line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0,
        b = prev[i],
        c = i >= channels ? prev[i - channels] : 0;
      let predict = 0;
      if (filter === 1) predict = a;
      else if (filter === 2) predict = b;
      else if (filter === 3) predict = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        predict = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + predict) & 255;
    }
    for (let x = 0; x < head.w; x++) {
      const o = (y * head.w + x) * 4,
        s = x * channels;
      if (channels === 1)
        px.set([palette[line[s] * 3], palette[line[s] * 3 + 1], palette[line[s] * 3 + 2], 255], o);
      else px.set([line[s], line[s + 1], line[s + 2], channels === 4 ? line[s + 3] : 255], o);
    }
    prev = line;
  }
  return { ...head, px };
}

const C64 = new Set(PAL.map((hex) => hex.toLowerCase()));
const hex = (px, o) =>
  '#' + [px[o], px[o + 1], px[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');

for (const file of ['ending-jail.png', 'ending-office.png']) {
  const img = decodePng(readFileSync(new URL('../../assets/' + file, import.meta.url)));

  test(`${file} is 320 by 150`, () => {
    assert.deepEqual([img.w, img.h], [320, 150]);
  });

  test(`${file} is fully opaque and uses only the sixteen C64 colours`, () => {
    const strays = new Map();
    for (let o = 0; o < img.px.length; o += 4) {
      assert.equal(img.px[o + 3], 255, 'no transparency');
      const c = hex(img.px, o);
      if (!C64.has(c)) strays.set(c, (strays.get(c) || 0) + 1);
    }
    assert.deepEqual([...strays], [], 'colours outside the palette, with how many pixels use each');
  });

  test(`${file} is drawn in double-wide pixels`, () => {
    let odd = 0;
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x += 2) {
        const o = (y * img.w + x) * 4;
        if (hex(img.px, o) !== hex(img.px, o + 4)) odd++;
      }
    assert.equal(odd, 0, 'pixel pairs whose two halves differ');
  });

  test(`${file} is a picture, not a blank`, () => {
    const seen = new Set();
    for (let o = 0; o < img.px.length; o += 4) seen.add(hex(img.px, o));
    assert.ok(seen.size >= 6, `${seen.size} colours used`);
  });
}
