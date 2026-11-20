// SPDX-License-Identifier: GPL-2.0-or-later
// Keyboard, pointer and touch-button input.
import { BX, BY } from './config.js';
import { cv } from './screen.js';
import { initAudio } from './audio.js';
import { G, K, P, edge, touch } from './state.js';
import { pickSidFile, radioInit, radioNext, radioStation, setFx, setMusic, sidVol } from './radio.js';
import { infoToggle } from './info.js';
import { iconSvg } from './icons.js';

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
  initTouch();
  document.querySelectorAll('#pad [data-icon]').forEach((el) => (el.innerHTML = iconSvg(el.dataset.icon)));
  document.querySelectorAll('#pad button').forEach((b) => {
    const k = b.dataset.k;
    if (!k) return;
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

// ---------- touch steering ----------
// A finger held on the screen during play steers the player: see driveToward and walkToward in player.js.
// Only touch and pen count, so a mouse on a desktop behaves as it always has. The buttons sit outside the
// steering area, so a second finger can fire or brake while the first steers.
let steering = null; // the pointer doing the steering
function aim(e) {
  // From the page to the game screen: the canvas is 384 by 272, with the 320 by 200 game screen inside a border.
  const r = cv.getBoundingClientRect();
  touch.at = {
    x: ((e.clientX - r.left) * 384) / r.width - BX,
    y: ((e.clientY - r.top) * 272) / r.height - BY,
  };
}
function release(e) {
  if (e.pointerId !== steering) return;
  steering = null;
  touch.at = null;
}
function initTouch() {
  const area = document.getElementById('wrap');
  area.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || steering !== null) return;
    if (G.screen !== 'play' || G.infoOpen || G.quitAsk) return;
    steering = e.pointerId;
    try {
      area.setPointerCapture(e.pointerId);
    } catch (_) {}
    aim(e);
  });
  area.addEventListener('pointermove', (e) => {
    if (e.pointerId === steering) aim(e);
  });
  area.addEventListener('pointerup', release);
  area.addEventListener('pointercancel', release);
  area.addEventListener('lostpointercapture', release);

  // A phone held upright is asked to turn sideways (FR-17); a tap puts the notice away for the rest of the visit.
  const rotate = document.getElementById('rotate');
  rotate.addEventListener('click', () => rotate.classList.add('gone'));

  // Full screen hides the browser's own bars; on a phone it also turns the game sideways where that is allowed.
  const full = document.getElementById('bfull');
  const root = document.documentElement;
  if (!document.fullscreenEnabled || !root.requestFullscreen) full.hidden = true;
  full.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await root.requestFullscreen({ navigationUI: 'hide' });
        if (screen.orientation && screen.orientation.lock)
          await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (_) {
      /* refused: the game carries on as it was */
    }
  });
}

const pad = document.getElementById('pad');
let padCar = null;
/** Show the buttons that make sense right now: the horn instead of the gun, and the handbrake, in a car. */
export function syncPad() {
  const car = P.car ? '1' : '0';
  if (car !== padCar) pad.dataset.car = padCar = car;
  // Steering ends when play does (a crash, an arrest, game over, back to the title), and the finger that was
  // steering cannot pick it up again: the player lifts it and touches again (FR-09).
  if (G.screen !== 'play' && steering !== null) {
    steering = null;
    touch.at = null;
  }
}
