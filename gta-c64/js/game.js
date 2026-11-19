// SPDX-License-Identifier: GPL-2.0-or-later
// Game flow: world setup and the per-frame update.
import { GOAL, KIND, SW, VH, WPX } from './config.js';
import { R, clamp, hyp } from './util.js';
import { HOSP, parkSpots } from './world.js';
import { engineSound } from './audio.js';
import { renderMap } from './worldview.js';
import { G, P, edge, msg, ppos, resetState } from './state.js';
import { mkCar } from './entities.js';
import { resetHeat, updHeat } from './heat.js';
import { updCars } from './cars.js';
import { resetPeds, updPeds } from './peds.js';
import { respawn, updPlayer } from './player.js';
import { resetMissions, updJob } from './missions.js';
import { placePickup, spawner } from './spawner.js';
import { updBullets, updPickups } from './items.js';
import { radioTick, sidVol } from './radio.js';

let started = false;
let endT = 0;
/** Throw the finished game away: fresh state, a clean map without skid marks, cars and pickups back in place. */
function resetGame() {
  resetState();
  resetMissions();
  resetHeat();
  resetPeds();
  renderMap();
  initWorld();
  started = false;
}
function startGame() {
  G.screen = 'play';
  if (started) {
    msg('BACK TO WORK. THE ELECTION WILL NOT BUY ITSELF.');
    return;
  }
  started = true;
  msg(
    'YOU WAKE UP OUTSIDE ST. INVOICE HOSPITAL. BUY THE ELECTION: $' +
      GOAL +
      '. FIND A FLASHING "J" FOR JOBS.',
  );
}
export function update(dt) {
  G.clock += dt;
  radioTick(dt);
  if (G.screen === 'boot') {
    G.bootT += dt;
    if (G.bootT > 6.2 || edge.fire || edge.use) G.screen = 'title';
    return;
  }
  if (G.screen === 'title') {
    if (edge.fire || edge.use) startGame();
    return;
  }
  if (G.screen === 'win' || G.screen === 'over') {
    // New game? Answers are ignored for the first second, so a held key cannot skip the picture.
    endT += dt;
    if (endT > 1 && (edge.yes || edge.fire)) {
      resetGame();
      startGame();
    } else if (endT > 1 && edge.no) {
      resetGame();
      G.screen = 'title';
    }
    return;
  }
  endT = 0;
  if (edge.pause) {
    G.paused = !G.paused;
    sidVol();
  }
  if (G.paused || G.infoOpen || G.quitAsk) {
    engineSound(false, 0);
    return;
  }
  updPlayer(dt);
  updCars(dt);
  updPeds(dt);
  updBullets(dt);
  updPickups(dt);
  updHeat(dt);
  if (G.screen === 'play') updJob(dt);
  // The election fund can fill from a job or from loose cash; either way that is the game won.
  if (G.screen === 'play' && G.cash >= GOAL) {
    G.job = null;
    G.screen = 'win';
  }
  spawner(dt);
  if (G.screen === 'down') {
    G.downT -= dt;
    if (G.downT <= 0) respawn();
  }
  for (const p of G.parts) {
    p.l -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  G.parts = G.parts.filter((p) => p.l > 0);
  for (const p of G.pops) {
    p.l -= dt;
    if (!p.hud) p.y -= 10 * dt;
  }
  G.pops = G.pops.filter((p) => p.l > 0);
  if (G.msgT > 0) {
    G.msgT -= dt;
    G.msgAge += dt;
  }
  if (G.banner) {
    G.banner.d -= dt;
    if (G.banner.d <= 0) G.banner = null;
  }
  const p = ppos(),
    lx = P.car ? P.car.vx * 0.3 : 0,
    ly = P.car ? P.car.vy * 0.3 : 0;
  const tx = clamp(p.x + lx - SW / 2, 0, WPX - SW),
    ty = clamp(p.y + ly - VH / 2, 0, WPX - VH);
  G.camX += (tx - G.camX) * Math.min(1, 6 * dt);
  G.camY += (ty - G.camY) * Math.min(1, 6 * dt);
  engineSound(!!P.car && G.screen === 'play', P.car ? hyp(P.car.vx, P.car.vy) : 0);
}
export function initWorld() {
  for (const s of parkSpots) {
    const r = R(),
      c = mkCar(r < 0.6 ? KIND.sedan : r < 0.8 ? KIND.van : KIND.sports, s.x, s.y, s.a);
    c.parked = true;
    G.cars.push(c);
  }
  const c = mkCar(KIND.sedan, HOSP.x + 40, HOSP.y, 0, 14);
  c.parked = true;
  G.cars.push(c);
  for (let i = 0; i < 34; i++) G.pickups.push(placePickup({}));
  G.camX = clamp(P.x - SW / 2, 0, WPX - SW);
  G.camY = clamp(P.y - VH / 2, 0, WPX - VH);
}
