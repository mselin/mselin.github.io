// SPDX-License-Identifier: GPL-2.0-or-later
// The icons a browser shows in its tab and a phone on its home screen. They are drawn by tools/make-icons.mjs,
// and every page names them: a page that does not makes the browser ask for /favicon.ico, which is not there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { icons, picture, picture16, samePicture } from '../../tools/make-icons.mjs';
import { PAL } from '../../js/config.js';

const here = (path) => new URL('../../' + path, import.meta.url);
const ICONS = {
  'assets/icon-16.png': 16,
  'assets/icon-32.png': 32,
  'assets/icon-180.png': 180,
};

test('the icon files are what tools/make-icons.mjs draws', () => {
  const made = icons();
  assert.deepEqual(Object.keys(made).sort(), Object.keys(ICONS).sort());
  for (const [path, bytes] of Object.entries(made))
    assert.ok(
      readFileSync(here(path)).equals(bytes),
      `${path} is out of date: run node tools/make-icons.mjs`,
    );
});

test('each icon is the size its name says, and square', () => {
  for (const [path, size] of Object.entries(ICONS)) {
    const png = readFileSync(here(path));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], path);
  }
});

test('the icons use only the C64 colours, and more than two of them', () => {
  for (const grid of [picture(), picture16()]) {
    const used = new Set(grid.flat());
    for (const c of used) assert.ok(c >= 0 && c < PAL.length, `colour ${c}`);
    assert.ok(used.size > 2, `${used.size} colours`);
  }
});

for (const page of ['index.html', 'terms.html', 'privacy.html'])
  test(`${page} names the icons, and they exist`, () => {
    const html = readFileSync(here(page), 'utf8');
    for (const [rel, path, sizes] of [
      ['icon', 'assets/icon-32.png', '32x32'],
      ['icon', 'assets/icon-16.png', '16x16'],
      ['apple-touch-icon', 'assets/icon-180.png', null],
    ]) {
      const tag = html.match(new RegExp(`<link rel="${rel}" href="${path}"[^>]*>`));
      assert.ok(tag, `${page} has no <link rel="${rel}" href="${path}">`);
      if (sizes) assert.match(tag[0], new RegExp(`sizes="${sizes}"`));
      assert.ok(existsSync(here(path)), `${path} is missing`);
    }
  });
