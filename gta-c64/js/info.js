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

import { onPresenceChange, presenceStatus, setPresence } from './presence.js';

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
    // How hard the emulator is working: useful when the sound is choppy on a phone.
    const h = G.sidPlayer && G.sidPlayer.health();
    if (h && h.load > 0)
      row(
        'SID player',
        'Using ' +
          Math.round(h.load * 100) +
          '% of the time it has' +
          (h.economy ? ', in economy mode' : '') +
          (h.struggling
            ? '. This device cannot keep up, so the sound breaks up. If your browser has JIT switched off (some hardened browsers do by default), allow it for this site.'
            : '.'),
      );
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
const BRIDGE_HELP =
  'https://github.com/mselin/mselin.github.io/tree/main/gta-c64/tools/presence-bridge#readme';
// What the player is told for each state the Discord setting can be in.
const PRESENCE_TEXT = {
  off: 'Off. Nothing is sent anywhere.',
  starting: 'On: looking for the helper program ...',
  connected: 'On, and connected. Your Discord profile shows what you are doing in the game.',
  'no-discord':
    'On. The helper program is running, but it cannot reach Discord. Is the Discord desktop app open on this computer?',
  'no-app-id': 'On, but the helper program has no Discord application ID set, so nothing is shown.',
  'no-bridge':
    "On, but the helper program was not found. It is optional, and you install and run it yourself. If it is running, your browser may be stopping this page from reaching it: allow this site to access devices on your local network in the browser's site settings.",
  refused:
    'On, but the helper program turned this game away. It may be a different version from the one this game expects.',
  unavailable: 'On, but the game could not load its own presence settings. Reloading the page may help.',
};
function presenceRender() {
  if (!G.infoOpen) return;
  const { enabled, status } = presenceStatus();
  $('bdrp').textContent = 'DISCORD RICH PRESENCE: ' + (enabled ? 'ON' : 'OFF');
  const line = $('drpstat');
  line.textContent = PRESENCE_TEXT[status] || '';
  if (status === 'no-bridge' || status === 'refused' || status === 'no-app-id') {
    const a = el('a', 'How to set it up');
    a.href = BRIDGE_HELP;
    a.target = '_blank';
    a.rel = 'noopener';
    line.append(' ', a, '.');
  }
}
export function infoToggle() {
  G.infoOpen = !G.infoOpen;
  $('info').classList.toggle('on', G.infoOpen);
  for (const k in K) K[k] = false;
  if (G.infoOpen) {
    infoRender();
    presenceRender();
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
  // Turning this on is the first time the page reaches for the player's own computer, so it only ever
  // happens from this click.
  $('bdrp').addEventListener('click', () => setPresence(!presenceStatus().enabled));
  onPresenceChange(presenceRender);
  onRadioChange(infoRender);
}
