// SPDX-License-Identifier: GPL-2.0-or-later
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { openGame, testTune } = require('./helpers.cjs');
const stations = require('../../radio/stations.json');

let game;
beforeEach(async () => {
  game = await openGame();
  // Start from the default every time; the choice is otherwise remembered between visits.
  await game.page.evaluate(() => localStorage.clear());
  await game.press('Space');
  await game.until((s) => s.G.screen === 'title');
});
afterEach(async () => {
  const errors = game.errors;
  await game.close();
  assert.deepEqual(errors, [], 'the page logged errors');
});

const radio = () => game.read((s) => s.radioState());

test('music is off by default and nothing is fetched from HVSC', async () => {
  await game.until((s) => s.radio.length > 2);
  await game.wait(500);
  const r = await radio();
  assert.equal(await game.read((s) => s.G.musicOn), false);
  assert.equal(r.audible, false);
  assert.equal(r.station, stations.stations[0].name);
  assert.deepEqual(game.hvscRequests, []);
});

test('M turns the radio on at the title screen, with credits from the playlist', async () => {
  await game.press('KeyM');
  await game.until((s) => s.radioState().playing && s.radioState().timeMs > 300, 15000);
  const r = await radio();
  assert.equal(game.hvscRequests.length, 1);
  const listed = stations.stations[0].tracks.find((t) => t.id === r.track.id);
  assert.ok(listed, 'the playing track is from the first station');
  assert.equal(r.track.title, listed.title);
  assert.equal(r.track.author, listed.author);
  assert.equal(r.track.released, listed.released);
  assert.ok(game.hvscRequests[0].endsWith(listed.hvsc), game.hvscRequests[0]);
  assert.ok(r.level > 0.01, `audible output, level ${r.level}`);

  await game.press('KeyM');
  await game.until((s) => !s.radioState().playing);
});

test('N moves to another tune and R to another station', async () => {
  await game.press('KeyM');
  await game.until((s) => s.radioState().playing, 15000);
  const first = await radio();

  await game.press('KeyN');
  await game.until(`(s) => s.radioState().playing && s.radioState().track.id !== ${first.track.id}`, 15000);
  assert.equal((await radio()).station, first.station);

  await game.press('KeyR');
  await game.until(
    `(s) => s.radioState().playing && s.radioState().station !== ${JSON.stringify(first.station)}`,
    15000,
  );
  const second = await radio();
  assert.equal(second.station, stations.stations[1].name);
  assert.ok(stations.stations[1].tracks.some((t) => t.id === second.track.id));
});

test('a station holds every listed tune exactly once, whatever the shuffle', async () => {
  await game.until((s) => s.radio.length > 2);
  const want = stations.stations[0].tracks.map((t) => t.id).sort();
  const order = await game.read((s) => s.radio[1].tracks.map((t) => t.id));
  assert.deepEqual([...order].sort(), want);
});

test('a track that reaches its length gives way to the next', async () => {
  await game.press('KeyM');
  await game.until((s) => s.radioState().playing, 15000);
  const first = await radio();
  await game.read((s) => (s.G.nowPlaying.secs = 1));
  await game.until(`(s) => s.radioState().playing && s.radioState().track.id !== ${first.track.id}`, 15000);
});

test('in the game the radio plays in a car and stops on foot', async () => {
  await game.press('KeyM');
  await game.until((s) => s.radioState().playing, 15000);
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play' && !s.radioState().playing);
  await game.page.keyboard.down('ArrowRight');
  await game.wait(500);
  await game.page.keyboard.up('ArrowRight');
  await game.press('KeyE');
  await game.until((s) => s.P.car && s.radioState().playing);
  await game.press('KeyE');
  await game.until((s) => !s.P.car && !s.radioState().playing);
});

test('a .sid file from disk plays on the tape deck with its own credits', async () => {
  await game.page.setInputFiles('#sidfile', {
    name: 'mine.sid',
    mimeType: 'application/octet-stream',
    buffer: testTune('My Tune', 'Me', '2026 Home'),
  });
  await game.until(
    (s) => s.radioState().station === 'TAPE DECK' && s.radioState().playing && !s.radioState().busy,
    15000,
  );
  const r = await radio();
  assert.equal(await game.read((s) => s.G.musicOn), true, 'loading a file turns music on');
  assert.deepEqual(
    [r.track.title, r.track.author, r.track.released, r.songs],
    ['My Tune', 'Me', '2026 Home', 2],
  );
  await game.press('KeyN');
  await game.until((s) => s.radioState().song === 2 && s.radioState().playing);
});

test('the information page credits the music and links each tune to HVSC', async () => {
  await game.press('KeyI');
  await game.until((s) => s.G.infoOpen);
  const info = await game.page.evaluate(() => ({
    text: document.querySelector('#ibox').innerText,
    tuneLinks: [...document.querySelectorAll('#plist a')].map((a) => a.href),
    hvsc: !!document.querySelector('#ibox a[href="https://www.hvsc.c64.org/"]'),
  }));
  const total = stations.stations.reduce((n, s) => n + s.tracks.length, 0);
  assert.equal(info.tuneLinks.length, total);
  assert.ok(info.tuneLinks.every((h) => /^https:\/\/www\.hvsc\.c64\.org\/search\?sid=\d+$/.test(h)));
  assert.ok(info.hvsc, 'links to the HVSC home page');
  assert.match(info.text, /Rob Hubbard/);
  assert.match(info.text, /USBSID-Player/);
  await game.press('Escape');
  await game.until((s) => !s.G.infoOpen);
});
