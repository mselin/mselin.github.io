// SPDX-License-Identifier: GPL-2.0-or-later
// Sound effects, engine noise and the built-in tune, all synthesised with Web Audio.
import { R, clamp } from './util.js';
import { G } from './state.js';

let AC = null;
let master = null;
let inMus = false;
let noiseBuf = null;
let eng = null;
let engG = null;
let mT = 0;
let mS = 0;
export function initAudio() {
  if (AC) {
    if (AC.state === 'suspended') AC.resume();
    return;
  }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.22;
    master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    eng = AC.createOscillator();
    eng.type = 'sawtooth';
    eng.frequency.value = 40;
    const lp = AC.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    engG = AC.createGain();
    engG.gain.value = 0;
    eng.connect(lp);
    lp.connect(engG);
    engG.connect(master);
    eng.start();
  } catch (e) {
    AC = null;
  }
}
export function tone(f0, f1, dur, type, vol, delay) {
  if (!AC || !(inMus ? G.musicOn : G.fxOn)) return;
  try {
    const t = AC.currentTime + (delay || 0),
      o = AC.createOscillator(),
      gn = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(vol || 0.3, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn);
    gn.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) {}
}
export function noise(dur, vol, fq, delay) {
  if (!AC || !(inMus ? G.musicOn : G.fxOn)) return;
  try {
    const t = AC.currentTime + (delay || 0),
      s = AC.createBufferSource(),
      f = AC.createBiquadFilter(),
      gn = AC.createGain();
    s.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.value = fq || 2000;
    gn.gain.setValueAtTime(vol || 0.4, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(gn);
    gn.connect(master);
    s.start(t, R() * 0.5, dur + 0.05);
  } catch (e) {}
}
export const sfx = {
  shot() {
    noise(0.09, 0.5, 5000);
    tone(900, 150, 0.09, 'square', 0.2);
  },
  punch() {
    noise(0.06, 0.4, 900);
  },
  crash(v) {
    noise(0.22, clamp(v, 0.2, 0.7), 1400);
  },
  splash() {
    noise(0.5, 0.5, 900);
    noise(0.2, 0.3, 3500);
  },
  boom() {
    noise(0.9, 0.9, 500);
    tone(120, 30, 0.6, 'triangle', 0.5);
  },
  pick() {
    tone(660, 1320, 0.09, 'square', 0.25);
    tone(990, 1980, 0.09, 'square', 0.2, 0.08);
  },
  horn() {
    tone(310, 310, 0.22, 'square', 0.25);
    tone(390, 390, 0.22, 'square', 0.2);
  },
  squish() {
    noise(0.12, 0.5, 700);
    tone(200, 60, 0.12, 'triangle', 0.3);
  },
  door() {
    noise(0.05, 0.3, 800);
    tone(140, 90, 0.06, 'square', 0.15, 0.04);
  },
  good() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'square', 0.25, i * 0.1));
  },
  bad() {
    [330, 262, 196, 131].forEach((f, i) => tone(f, f, 0.2, 'sawtooth', 0.2, i * 0.16));
  },
  alarm() {
    tone(500, 900, 0.12, 'square', 0.25);
    tone(500, 900, 0.12, 'square', 0.25, 0.15);
  },
};
export function engineSound(on, speed) {
  if (!AC || !engG) return;
  engG.gain.value = on && G.fxOn ? 0.05 : 0;
  eng.frequency.value = 38 + speed * 0.55;
}
const BASS = [
  45, 0, 45, 57, 0, 45, 0, 57, 41, 0, 41, 53, 0, 41, 0, 53, 43, 0, 43, 55, 0, 43, 0, 55, 40, 0, 40, 52, 0, 40,
  47, 52,
];
const LEAD = [
  69, 72, 76, 72, 69, 72, 76, 81, 65, 69, 72, 69, 65, 69, 72, 77, 67, 71, 74, 71, 67, 71, 74, 79, 64, 67, 71,
  67, 76, 74, 71, 67,
];
const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
export function music(dt) {
  mT -= dt;
  if (mT > 0) return;
  inMus = true;
  mT += 0.14;
  if (mT < 0) mT = 0.14;
  const s = mS++ % 32;
  if (BASS[s]) tone(mf(BASS[s]), 0, 0.13, 'triangle', 0.4);
  tone(mf(LEAD[s]), 0, 0.1, 'square', 0.09);
  if (s % 4 === 0) tone(110, 40, 0.08, 'sine', 0.5);
  if (s % 8 === 4) noise(0.07, 0.25, 6000);
  else if (s % 2) noise(0.02, 0.08, 9000);
  inMus = false;
}
