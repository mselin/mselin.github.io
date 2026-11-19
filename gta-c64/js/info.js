// SPDX-License-Identifier: GPL-2.0-or-later
// The information page: controls, now playing, playlist and credits.
import { cv } from './screen.js';
import { initAudio } from './audio.js';
import { G, K } from './state.js';
import { HVSC } from './playlist.js';
import {
  onRadioChange,
  pickSidFile,
  radio,
  radioInit,
  radioNext,
  radioStation,
  setFx,
  setMusic,
} from './radio.js';

const $ = (id) => document.getElementById(id),
  el = (tag, txt) => {
    const e = document.createElement(tag);
    if (txt != null) e.textContent = txt;
    return e;
  };
function hvscLink(t, label) {
  const a = el('a', label);
  a.href = HVSC + '/search?sid=' + t.id;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}
function infoRender() {
  if (!G.infoOpen) return;
  $('bmus').textContent = 'MUSIC: ' + (G.musicOn ? 'ON' : 'OFF');
  $('bfx').textContent = 'SOUND FX: ' + (G.fxOn ? 'ON' : 'OFF');
  const st = radio[G.station],
    now = $('now');
  now.textContent = '';
  const row = (k, v) => {
    now.appendChild(el('dt', k));
    const d = el('dd');
    if (typeof v === 'string') d.textContent = v;
    else d.appendChild(v);
    now.appendChild(d);
  };
  row('Station', st.name + (G.musicOn ? '' : ' (music is off)'));
  if (st.builtin) {
    row('Title', 'Sleazeburg Theme');
    row('Author', 'The house band (built into the game)');
  } else if (st.tracks) {
    const t = G.nowPlaying || st.tracks[st.i];
    row('Title', t.title || '(shown once the tune has loaded)');
    if (t.author) row('Author', t.author);
    if (t.released) row('Released', t.released);
    if (t.id) row('Source', hvscLink(t, 'This tune in the High Voltage SID Collection'));
  }
  const pl = $('plist');
  pl.textContent = '';
  const ss = radio.filter((s) => s.tracks && !s.tape);
  if (ss.length) pl.appendChild(el('h2', 'PLAYLIST'));
  for (const s of ss) {
    pl.appendChild(el('h3', s.name + (s.tagline ? ' - ' + s.tagline : '')));
    const ul = el('ul');
    for (const t of s.tracks.slice().sort((x, y) => (x.title || '').localeCompare(y.title || ''))) {
      const li = el('li');
      if (t.id) li.appendChild(hvscLink(t, t.title || 'Untitled'));
      else li.appendChild(el('span', t.title || t.url.split('/').pop()));
      li.appendChild(
        document.createTextNode(
          (t.author ? ' by ' + t.author : '') + (t.released ? ' (' + t.released + ')' : ''),
        ),
      );
      ul.appendChild(li);
    }
    pl.appendChild(ul);
  }
}
export function infoToggle() {
  G.infoOpen = !G.infoOpen;
  $('info').classList.toggle('on', G.infoOpen);
  for (const k in K) K[k] = false;
  if (G.infoOpen) {
    infoRender();
    $('iclose').focus();
  } else cv.focus();
}
export function initInfo() {
  $('ibtn').addEventListener('click', () => {
    initAudio();
    radioInit();
    infoToggle();
  });
  $('iclose').addEventListener('click', infoToggle);
  $('info').addEventListener('click', (e) => {
    if (e.target === $('info')) infoToggle();
  });
  $('bmus').addEventListener('click', () => {
    initAudio();
    if (G.sidPlayer) G.sidPlayer.unlock();
    setMusic(!G.musicOn);
  });
  $('bfx').addEventListener('click', () => setFx(!G.fxOn));
  $('bst').addEventListener('click', radioStation);
  $('bnx').addEventListener('click', () => radioNext());
  $('bld').addEventListener('click', pickSidFile);
  onRadioChange(infoRender);
}
