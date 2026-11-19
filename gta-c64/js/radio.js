// SPDX-License-Identifier: GPL-2.0-or-later
// The radio: built-in tune, SID stations streamed from HVSC, and a tape deck for a local .sid file.
import { initAudio, music, tone } from './audio.js';
import { G, P, msg } from './state.js';
import { fontSafe, parseStations, shuffle } from './playlist.js';

let engP = null;
let sidReady = false;
let sidPlaying = false;
let sidBusy = false;
let sidSub = 0;
let sidSongs = 1;
let loadSeq = 0;
let radioTried = false;
let needTune = true;
let sidInput = null;
let radioListener = () => {};
export const radio = [
  { name: 'SID FM', tagline: 'THE HOUSE BAND. ALL THREE VOICES, ALL THE TIME', builtin: true },
  { name: 'RADIO OFF', tagline: 'ENJOY THE ENGINE NOISE' },
];
const radioWant = () =>
  G.musicOn &&
  !G.paused &&
  (G.screen === 'title' || G.screen === 'win' || G.screen === 'over' || (G.screen === 'play' && !!P.car));
export const radioAudible = () => {
  const st = radio[G.station];
  return G.musicOn && (st.builtin || (!!st.tracks && sidReady && sidPlaying));
};
export function npText() {
  const st = radio[G.station];
  if (st.builtin) return 'SLEAZEBURG THEME - THE HOUSE BAND';
  const t = G.nowPlaying;
  if (!t) return '...';
  return fontSafe(
    (t.title || 'UNTITLED') + ' - ' + (t.author || 'UNKNOWN') + (t.released ? ' (' + t.released + ')' : ''),
  );
}
export function sidVol() {
  if (G.sidPlayer) G.sidPlayer.setVolume(G.musicOn && !G.paused ? 0.9 : 0);
}
function sidLoadLib() {
  return (
    engP ||
    (engP = import('../sidplayer.js').then((m) =>
      // ready() rejects where the emulator cannot run at all, for example with WebAssembly switched off.
      m.ready().then(() => {
        G.sidPlayer = m;
        sidVol();
      }),
    ))
  );
}
// A tune that has not arrived in this long is skipped, so a stalled download cannot leave the radio tuning for ever.
const FETCH_TIMEOUT_MS = 15000;
// After this many tunes in a row fail to start, the browser evidently cannot play them at all.
const MAX_PLAY_FAILURES = 3;
let playFails = 0;
const GAVE_UP = Symbol('gave up');
/** Stop trying SID stations and go back to the built-in tune, saying why. */
function giveUp() {
  playFails = 0;
  G.station = 0;
  silence();
  msg('RADIO: THIS BROWSER CANNOT PLAY SID TUNES. BACK TO THE HOUSE BAND.');
  radioListener();
}
function trackBytes(t) {
  return t.bytes
    ? Promise.resolve(t.bytes)
    : fetch(t.url, { signal: AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined })
        .then((r) => {
          if (!r.ok) throw 0;
          return r.arrayBuffer();
        })
        .then((b) => {
          const d = new Uint8Array(b),
            m = String.fromCharCode(d[0], d[1], d[2], d[3]);
          if (m !== 'PSID' && m !== 'RSID') throw 0;
          return (t.bytes = d);
        });
}
function playTrack(st, fails) {
  const t = st.tracks[st.i],
    seq = ++loadSeq;
  sidReady = false;
  sidPlaying = false;
  sidBusy = false;
  // The player comes first: if this browser cannot run it, there is no point downloading any tunes.
  sidLoadLib()
    .then(
      () => trackBytes(t),
      () => {
        if (seq === loadSeq) giveUp();
        return GAVE_UP;
      },
    )
    .then((b) => (b === GAVE_UP ? b : G.sidPlayer.load(b, t.sub != null ? t.sub + 1 : 0)))
    .then((info) => {
      if (seq !== loadSeq || info === GAVE_UP) return;
      G.nowPlaying = t;
      sidSub = info.song - 1;
      sidSongs = info.songs;
      t.title = t.title || info.title;
      t.author = t.author || info.author;
      t.released = t.released || info.released;
      sidReady = true;
      sidVol();
      if (G.screen === 'play' && radioWant()) msg(st.name + ': ' + npText());
      radioListener();
    })
    .catch(() => {
      if (seq !== loadSeq) return;
      if (fails + 1 < st.tracks.length) {
        advance(st);
        playTrack(st, fails + 1);
      } else msg(st.name + ': DEAD AIR. NO PLAYABLE TUNES FOUND.');
    });
}
function advance(st) {
  st.i++;
  if (st.i >= st.tracks.length) {
    st.i = 0;
    if (st.tracks.length > 2) {
      const last = st.tracks[st.tracks.length - 1];
      shuffle(st.tracks);
      if (st.tracks[0] === last) st.tracks.push(st.tracks.shift());
    }
  }
}
export function silence() {
  loadSeq++;
  if (G.sidPlayer) G.sidPlayer.halt();
  sidPlaying = false;
  sidReady = false;
  sidBusy = false;
  G.nowPlaying = null;
  needTune = true;
}
export function radioStation() {
  G.station = (G.station + 1) % radio.length;
  const st = radio[G.station];
  silence();
  msg(
    'RADIO: ' +
      st.name +
      (st.tagline ? ' - ' + st.tagline : '') +
      (G.musicOn ? '' : ' (MUSIC IS OFF - PRESS M)'),
  );
  tone(900, 400, 0.05, 'square', 0.15);
  radioListener();
}
function sidStart() {
  sidPlaying = true;
  sidBusy = true;
  const seq = loadSeq;
  G.sidPlayer
    .play()
    .then(() => {
      playFails = 0;
    })
    .catch(() => {
      if (seq !== loadSeq) return;
      sidPlaying = false;
      if (++playFails >= MAX_PLAY_FAILURES) {
        // Rather than work through the whole playlist failing each one.
        giveUp();
        return;
      }
      msg(radio[G.station].name + ': THAT TUNE WOULD NOT PLAY.');
      radioNext(true);
    })
    .then(() => {
      if (seq === loadSeq) sidBusy = false;
    });
}
export function radioNext(auto) {
  const st = radio[G.station];
  if (!st.tracks || !G.sidPlayer || !G.musicOn) return;
  if (st.tracks.length === 1) {
    if (!sidReady || sidBusy) return;
    sidSub = (sidSub + 1) % sidSongs;
    sidBusy = true;
    sidPlaying = false;
    const seq = loadSeq;
    G.sidPlayer.setSong(sidSub + 1).then(() => {
      if (seq === loadSeq) sidBusy = false;
    });
    if (sidSongs > 1 && !auto) msg(st.name + ': TUNE ' + (sidSub + 1) + '/' + sidSongs);
    return;
  }
  advance(st);
  playTrack(st, 0);
}
let tendT = 0;
/** Once a second, let the SID player check whether the device is keeping up, and pass on what it says. */
function tendPlayer(dt) {
  tendT += dt;
  if (tendT < 1) return;
  tendT = 0;
  const verdict = G.sidPlayer.tend();
  if (verdict === 'eased') msg('RADIO: SLOW GOING ON THIS DEVICE. SID PLAYER SWITCHED TO ECONOMY MODE.');
  else if (verdict === 'struggling')
    msg(
      'RADIO: THIS DEVICE CANNOT KEEP UP WITH THE SID PLAYER. IF YOUR BROWSER HAS JIT SWITCHED OFF, ALLOW IT FOR THIS SITE.',
    );
  if (verdict !== 'ok') radioListener();
}
export function radioTick(dt) {
  const st = radio[G.station],
    want = radioWant();
  if (st.builtin && want) music(dt);
  if (want && st.tracks && needTune) {
    needTune = false;
    playTrack(st, 0);
  }
  if (G.sidPlayer && sidReady && !sidBusy) {
    const w = want && !!st.tracks;
    if (w && !sidPlaying) sidStart();
    else if (!w && sidPlaying) {
      sidPlaying = false;
      G.sidPlayer.pause();
    } else if (w && G.nowPlaying && G.sidPlayer.timeMs() > G.nowPlaying.secs * 1000) radioNext(true);
    else if (w) tendPlayer(dt);
  }
}
export function setMusic(on) {
  G.musicOn = on;
  try {
    localStorage.setItem('sb64music', on ? '1' : '0');
  } catch (e) {}
  sidVol();
  if (G.screen === 'play') msg(on ? 'MUSIC ON. RADIO: ' + radio[G.station].name : 'MUSIC OFF.');
  radioListener();
}
export function setFx(on) {
  G.fxOn = on;
  if (G.screen === 'play') msg(on ? 'SOUND EFFECTS ON.' : 'SOUND EFFECTS OFF.');
  radioListener();
}
export function radioInit() {
  if (radioTried) return;
  radioTried = true;
  fetch('radio/stations.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw 0;
      return r.json();
    })
    .then((j) => {
      const add = parseStations(j);
      for (const s of add) shuffle(s.tracks);
      if (add.length) {
        radio.splice(1, 0, ...add);
        if (G.station === 0) {
          G.station = 1;
          silence();
        } else G.station += add.length;
        radioListener();
      }
    })
    .catch(() => {});
}
function sidFile(f) {
  if (!f) return;
  if (!/\.(sid|psid|dat)$/i.test(f.name)) {
    msg('THE TAPE DECK ONLY PLAYS .SID FILES. STANDARDS, PLEASE.');
    return;
  }
  let k = radio.findIndex((s) => s.tape);
  if (k < 0) {
    k = radio.length - 1;
    radio.splice(k, 0, { name: 'TAPE DECK', tagline: 'YOUR OWN CASSETTE', tape: true, tracks: [], i: 0 });
  }
  const tk = { bytes: null, sub: null, secs: 600, title: '', author: '', released: '', id: 0 };
  radio[k].tracks = [tk];
  radio[k].i = 0;
  f.arrayBuffer().then((b) => {
    tk.bytes = new Uint8Array(b);
    G.station = radio.findIndex((s) => s.tape);
    silence();
    if (!G.musicOn) setMusic(true);
    radioListener();
  });
}
export function pickSidFile() {
  if (sidInput) sidInput.click();
}
export function onRadioChange(fn) {
  radioListener = fn;
}
export function initRadio() {
  sidInput = document.getElementById('sidfile');
  try {
    G.musicOn = localStorage.getItem('sb64music') === '1';
  } catch (e) {}
  sidInput.addEventListener('change', () => {
    sidFile(sidInput.files[0]);
    sidInput.value = '';
  });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => {
    e.preventDefault();
    initAudio();
    sidFile(e.dataTransfer.files[0]);
  });
}
export function radioState() {
  const st = radio[G.station];
  return {
    station: st.name,
    stations: radio.map((s) => s.name),
    track: G.nowPlaying
      ? {
          title: G.nowPlaying.title,
          author: G.nowPlaying.author,
          released: G.nowPlaying.released,
          id: G.nowPlaying.id,
          secs: G.nowPlaying.secs,
        }
      : null,
    ready: sidReady,
    playing: sidPlaying,
    busy: sidBusy,
    song: sidSub + 1,
    songs: sidSongs,
    audible: radioAudible(),
    timeMs: G.sidPlayer ? G.sidPlayer.timeMs() : 0,
    health: G.sidPlayer ? G.sidPlayer.health() : null,
    level: G.sidPlayer ? G.sidPlayer.level() : 0,
  };
}
