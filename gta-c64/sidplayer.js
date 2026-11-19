// Bridge between Sleazeburg 64 and USBSID-Player (https://github.com/LouDnl/USBSID-Player, GPL-2.0-or-later).
// Loaded on demand, the first time music is turned on. One emulator and one audio output are reused for every tune.
import factory from './usbsid-player/usbsid.esm.js';
import { USBSIDPlayerWeb, NullTransport, countSids, sidModel, isSidHeader } from './usbsid-player/usplayer-web.js';
import { UsPlayerAudio } from './usbsid-player/usplayer-audio.js';

let player = null, audio = null, bytes = null, opts = null, song = 1, started = false, volume = 1, analyser = null;
let chain = Promise.resolve();
// Run operations one after another, so a quick station change cannot interleave two loads.
const queue = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };

async function init() {
  if (player) return;
  const module = await factory({ locateFile: name => new URL('./usbsid-player/' + name, import.meta.url).href });
  player = new USBSIDPlayerWeb(module, new NullTransport());
  audio = new UsPlayerAudio(player);
  audio.setVolume(volume);
}
function haltNow() {
  if (!player) return;
  audio.unrun(); audio.flush(); player.stop();
  started = false;
}

/** Load a tune (Uint8Array). `wantSong` is one-based, 0 for the tune's own default. Resolves to its details; does not start playing. */
export function load(data, wantSong) {
  return queue(async () => {
    await init();
    haltNow();
    bytes = null;
    if (!isSidHeader(data) || !player.loadSID(data)) { player.stop(); throw new Error('not a playable SID tune'); }
    const info = player.info();
    haltNow();
    const def = (data[0x10] << 8) | data[0x11];
    song = wantSong >= 1 && wantSong <= info.songs ? wantSong : (def >= 1 && def <= info.songs ? def : 1);
    bytes = data;
    opts = { chips: countSids(data), model: sidModel(data) };
    return { title: info.name || '', author: info.author || '', released: info.released || '', song, songs: info.songs || 1 };
  });
}
/** Start the loaded tune, or resume it after pause(). */
export function play() {
  return queue(async () => {
    if (!bytes) throw new Error('no tune loaded');
    const fresh = !started;
    if (fresh) {
      if (!player.loadSID(bytes, 0, song)) throw new Error('unable to load this tune');
      if (!await audio.start(opts)) throw new Error('audio output could not be configured');
      started = true;
    }
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    player.pause(false);
    await player.start({ externalClock: true });
    audio.run(player, { skipSilence: fresh });
  });
}
export function pause() { return queue(async () => { if (player && started) { audio.unrun(); player.pause(true); audio.flush(); } }); }
export function halt() { return queue(async () => { haltNow(); bytes = null; }); }
/** Choose another song of the loaded tune (one-based). Call play() afterwards. */
export function setSong(n) { return queue(async () => { haltNow(); song = n; }); }
export function setVolume(v) { volume = v; if (audio) audio.setVolume(v); }
/** Position in the current song in milliseconds. */
export function timeMs() { return player && started ? player.playtimeMs() : 0; }
/** Browsers start audio suspended until the user interacts with the page; call this from a key or pointer event. */
export function unlock() { if (audio && audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); }
/** Peak output level, 0 to 1. Used for testing. */
export function level() {
  if (!audio || !audio.gain) return 0;
  if (!analyser || analyser.context !== audio.ctx) { analyser = audio.ctx.createAnalyser(); analyser.fftSize = 2048; audio.gain.connect(analyser); }
  const buf = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(buf);
  let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
  return peak;
}
