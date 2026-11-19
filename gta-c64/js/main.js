// SPDX-License-Identifier: GPL-2.0-or-later
// Entry point: builds the world, wires up input and runs the frame loop.
import { KIND } from './config.js';
import { cv } from './screen.js';
import { genMap } from './world.js';
import { renderMap } from './worldview.js';
import { G, K, P, edge } from './state.js';
import { mkCar } from './entities.js';
import { crime } from './heat.js';
import { passJob, startJob } from './missions.js';
import { down } from './player.js';
import { initWorld, onMapReset, update } from './game.js';
import { draw } from './render.js';
import { initRadio, radio, radioState, silence } from './radio.js';
import { initInfo } from './info.js';
import { initInput } from './input.js';

genMap();
renderMap();
onMapReset(renderMap);
initWorld();
initInput();
initInfo();
initRadio();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
  } catch (e) {
    console.error(e);
  }
  for (const k in edge) delete edge[k];
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
cv.focus();

// A handle on the running game, for the browser tests and for poking at it from the console.
window.sleazeburg = { G, P, K, KIND, mkCar, crime, down, startJob, passJob, radio, radioState, silence };
