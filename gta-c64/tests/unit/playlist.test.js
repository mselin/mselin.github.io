// SPDX-License-Identifier: GPL-2.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HVSC_BASE, fontSafe, parseStations, shuffle } from '../../js/playlist.js';

const one = (track, extra = {}) =>
  parseStations({ stations: [{ name: 'Test FM', tracks: [track] }], ...extra });

test('an HVSC path becomes a download address on the HVSC site', () => {
  const [st] = one({
    hvsc: '/MUSICIANS/H/Hubbard_Rob/Commando.sid',
    id: 149387,
    title: 'Commando',
    subtune: 2,
    seconds: 61,
  });
  assert.equal(st.name, 'TEST FM');
  assert.deepEqual(st.tracks[0], {
    url: HVSC_BASE + '/MUSICIANS/H/Hubbard_Rob/Commando.sid',
    sub: 1,
    secs: 61,
    title: 'Commando',
    author: '',
    released: '',
    id: 149387,
  });
});

test('a local file is read from the radio folder', () => {
  const [st] = one({ file: 'my tunes/demo.sid' });
  assert.equal(st.tracks[0].url, 'radio/my%20tunes/demo.sid');
});

test('missing subtune and length fall back to the tune default and three minutes', () => {
  const [st] = one({ hvsc: '/A/b.sid' });
  assert.equal(st.tracks[0].sub, null);
  assert.equal(st.tracks[0].secs, 180);
  assert.equal(st.tracks[0].id, 0);
});

test('unsafe or malformed tracks are dropped', () => {
  for (const bad of [
    { hvsc: '/../secret.sid' },
    { hvsc: 'MUSICIANS/no-leading-slash.sid' },
    { hvsc: '/MUSICIANS/x.mp3' },
    { hvsc: 'https://evil.example/x.sid' },
    { file: '../x.sid' },
    { file: '/etc/x.sid' },
    { hvsc: 42 },
    null,
    {},
  ]) {
    assert.deepEqual(one(bad), [], JSON.stringify(bad));
  }
});

test('stations without playable tracks are hidden', () => {
  const out = parseStations({
    stations: [{ name: 'Empty', tracks: [] }, { name: 'Full', tracks: [{ hvsc: '/a.sid' }] }, null],
  });
  assert.deepEqual(
    out.map((s) => s.name),
    ['FULL'],
  );
});

test('only HVSC itself or a folder on this site is accepted as the base address', () => {
  const url = (hvscBase) => one({ hvsc: '/a.sid' }, { hvscBase })[0].tracks[0].url;
  assert.equal(url('https://hvsc.c64.org/download/C64Music'), 'https://hvsc.c64.org/download/C64Music/a.sid');
  assert.equal(url('radio/hvsc'), 'radio/hvsc/a.sid');
  assert.equal(url('https://evil.example/music'), HVSC_BASE + '/a.sid');
  assert.equal(url('../../elsewhere'), HVSC_BASE + '/a.sid');
});

test('garbage input gives an empty list', () => {
  for (const j of [null, undefined, 7, 'x', {}, { stations: 'no' }]) assert.deepEqual(parseStations(j), []);
});

test('fontSafe upper-cases and strips accents the game font cannot draw', () => {
  assert.equal(fontSafe('Chris Hülsbeck'), 'CHRIS HULSBECK');
  assert.equal(fontSafe('László Simon'), 'LASZLO SIMON');
});

test('shuffle keeps every item', () => {
  const a = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual([...shuffle([...a])].sort(), a);
});

test('the shipped playlist is valid and fully credited', () => {
  const json = JSON.parse(readFileSync(new URL('../../radio/stations.json', import.meta.url), 'utf8'));
  const stations = parseStations(json);
  const listed = json.stations.reduce((n, s) => n + s.tracks.length, 0);
  const kept = stations.reduce((n, s) => n + s.tracks.length, 0);
  assert.ok(listed > 0);
  assert.equal(kept, listed, 'every listed track should survive validation');
  const ids = new Set();
  for (const s of stations) {
    assert.ok(s.name.length > 0 && s.name.length <= 20, s.name);
    for (const t of s.tracks) {
      assert.ok(t.url.startsWith(HVSC_BASE + '/'), t.url);
      assert.ok(t.title && t.author && t.released, `credits for ${t.url}`);
      assert.ok(t.id > 0, `HVSC id for ${t.title}`);
      assert.ok(t.secs >= 20, `length for ${t.title}`);
      assert.ok(!ids.has(t.id), `duplicate ${t.title}`);
      ids.add(t.id);
    }
  }
});
