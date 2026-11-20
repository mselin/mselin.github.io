// SPDX-License-Identifier: GPL-2.0-or-later
// FR-16: on a touch screen, no text about the controls names a key, and every prompt fits its space.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS } from '../../js/glyphs.js';
import { HELP, TOUCH } from '../../js/help.js';

const KEY_NAMES =
  /\b(PRESS|SPACE|ARROWS?|WASD|ENTER|ESC|SHIFT)\b|(^|\s)[A-Z] (=|-|PAUSE|MUSIC|INFO|STATION|NEXT|TO)\b/;
const ROOM = { line: 40, title: 34, dialog: 28 }; // characters: a screen line, a title-screen column, the dialog box

/** Every text in both sets, with the room it has. */
function texts(set) {
  return [
    ...set.controls.map((t) => [t, ROOM.title]),
    [set.start, ROOM.line],
    [set.musicOff, ROOM.line],
    [set.confirm, ROOM.dialog],
    [set.newGame, ROOM.line],
  ];
}

test('touch-screen texts name no keys', () => {
  for (const [t] of texts(HELP.touch)) assert.doesNotMatch(t, KEY_NAMES, t);
  assert.doesNotMatch(HELP.touch.radioMusicOff, KEY_NAMES);
});

test('keyboard texts still name the keys', () => {
  const all = texts(HELP.keys)
    .map(([t]) => t)
    .join(' / ');
  for (const key of [
    'ARROWS',
    'SPACE',
    'E / ENTER',
    'P PAUSE',
    'M MUSIC',
    'Y = YES',
    'N = NO',
    'PRESS FIRE',
  ]) {
    assert.ok(all.includes(key), `${key} in: ${all}`);
  }
  assert.match(HELP.keys.radioMusicOff, /PRESS M/);
});

test('every text fits its space and uses only letters the game font has', () => {
  for (const set of [HELP.touch, HELP.keys]) {
    for (const [t, room] of texts(set)) {
      assert.ok(t.length <= room, `${t.length} > ${room}: ${t}`);
      for (const ch of t) assert.ok(ch === ' ' || ch in GLYPHS, `${ch} in ${t}`);
    }
    assert.equal(set.controls.length, 5, 'the title screen has room for five lines');
  }
});

test('the touch prompts name the buttons and taps that answer them', () => {
  assert.match(HELP.touch.confirm, /GUN = YES/);
  assert.match(HELP.touch.confirm, /CAR = NO/);
  assert.match(HELP.touch.newGame, /TAP = YES/);
  assert.match(HELP.touch.newGame, /CAR = NO/);
  assert.match(HELP.touch.musicOff, /NOTE/);
});

test('without a touch screen (as here, in Node) the game is not in touch mode', () => {
  assert.equal(TOUCH, false);
});
