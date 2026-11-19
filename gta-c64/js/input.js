// SPDX-License-Identifier: GPL-2.0-or-later
// Keyboard, pointer and touch-button input.
import { cv } from './screen.js';
import { initAudio } from './audio.js';
import { G, K, edge } from './state.js';
import { pickSidFile, radioInit, radioNext, radioStation, setFx, setMusic, sidVol } from './radio.js';
import { infoToggle } from './info.js';

const KM = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'fire',
  KeyX: 'hb',
  ShiftLeft: 'hb',
  ShiftRight: 'hb',
  KeyE: 'use',
  Enter: 'use',
  KeyP: 'pause',
  KeyM: 'music',
  KeyF: 'fx',
  KeyL: 'sid',
  KeyN: 'next',
  KeyR: 'radio',
  KeyI: 'info',
  Escape: 'esc',
  KeyY: 'yes',
};
function press(k) {
  initAudio();
  radioInit();
  if (G.sidPlayer) G.sidPlayer.unlock();
  if (k === 'info' || (k === 'esc' && G.infoOpen)) {
    infoToggle();
    return;
  }
  if (G.infoOpen) return;
  if (G.quitAsk) {
    if (k === 'yes' || k === 'fire') {
      G.quitAsk = false;
      G.paused = false;
      G.screen = 'title';
      for (const q in K) K[q] = false;
      sidVol();
    } else if (k === 'next' || k === 'esc' || k === 'use') G.quitAsk = false;
    return;
  }
  if (G.screen === 'win' || G.screen === 'over') {
    // The end screens ask "new game?": only yes, no and the music switch do anything.
    if (k === 'yes' || k === 'fire') edge.yes = true;
    else if (k === 'next' || k === 'use' || k === 'esc') edge.no = true;
    else if (k === 'music') setMusic(!G.musicOn);
    return;
  }
  if (k === 'esc') {
    if (G.screen === 'play') {
      G.quitAsk = true;
      for (const q in K) K[q] = false;
    }
    return;
  }
  if (!K[k]) edge[k] = true;
  K[k] = true;
  if (k === 'music') setMusic(!G.musicOn);
  if (k === 'fx') setFx(!G.fxOn);
  if (k === 'sid') pickSidFile();
  if (k === 'next') radioNext();
  if (k === 'radio') radioStation();
}
export function initInput() {
  addEventListener('keydown', (e) => {
    const k = KM[e.code];
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (G.infoOpen && k !== 'info' && k !== 'esc') return;
    if (k) {
      e.preventDefault();
      if (!e.repeat) press(k);
    }
  });
  addEventListener('keyup', (e) => {
    const k = KM[e.code];
    if (k) {
      e.preventDefault();
      K[k] = false;
    }
  });
  addEventListener('blur', () => {
    for (const k in K) K[k] = false;
  });
  cv.addEventListener('pointerdown', () => {
    cv.focus();
    initAudio();
    radioInit();
    if (G.sidPlayer) G.sidPlayer.unlock();
    if (G.screen !== 'play' && G.screen !== 'down' && !G.infoOpen) edge.fire = true;
  });
  document.querySelectorAll('#pad button').forEach((b) => {
    const k = b.dataset.k;
    const up = (e) => {
      e.preventDefault();
      K[k] = false;
      b.classList.remove('on');
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(k);
      b.classList.add('on');
      try {
        b.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
