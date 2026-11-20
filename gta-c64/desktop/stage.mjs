// SPDX-License-Identifier: GPL-2.0-or-later
// Copies the game into dist/ for the app to package. Only what the game loads goes in: not the tests, the
// tooling or node_modules, which the folder above also holds.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..');
const dist = join(here, 'dist');
export const FILES = [
  'index.html',
  'terms.html',
  'privacy.html',
  'sidplayer.js',
  'LICENSE',
  'js',
  'assets',
  'radio/stations.json',
  'usbsid-player/LICENSE',
  'usbsid-player/usbsid.esm.js',
  'usbsid-player/usbsid.wasm',
  'usbsid-player/usplayer-audio.js',
  'usbsid-player/usplayer-web.js',
  'tools/presence-bridge/schema.json',
];

rmSync(dist, { recursive: true, force: true });
for (const f of FILES) {
  mkdirSync(dirname(join(dist, f)), { recursive: true });
  cpSync(join(game, f), join(dist, f), { recursive: true });
}
console.log(`staged ${FILES.length} entries in ${dist}`);
