// SPDX-License-Identifier: GPL-2.0-or-later
// Keeps traffic, pedestrians, police and pickups populated around the player.
import { BLK, DIRS, GRASS, KIND, MW, NB, PI, PLAZA, WALK, WPX } from './config.js';
import { R, clamp, hyp, mod } from './util.js';
import { map, tileAt } from './world.js';
import { G, P, onScreen, ppos } from './state.js';
import { mkCar, mkPed } from './entities.js';

let spT = 0;
let spP = 0;
let spC = 0;
function nearCar(x, y, r) {
  for (const c of G.cars) if (Math.abs(c.x - x) < r && Math.abs(c.y - y) < r) return true;
  return false;
}
function spawnRoad(cop) {
  const p = ppos();
  for (let tr = 0; tr < 10; tr++) {
    const a = R() * 7,
      d = 220 + R() * 110,
      qx = p.x + Math.cos(a) * d,
      qy = p.y + Math.sin(a) * d,
      vert = R() < 0.5;
    let x, y, dir;
    if (vert) {
      const k = clamp(Math.round((qx - 16) / BLK), 0, NB);
      dir = R() < 0.5 ? 1 : 3;
      x = k * BLK + (dir === 1 ? 8 : 24);
      y = qy;
      if (y < 40 || y > WPX - 40 || mod(y, BLK) < 44 || mod(y, BLK) > BLK - 12) continue;
    } else {
      const k = clamp(Math.round((qy - 16) / BLK), 0, NB);
      dir = R() < 0.5 ? 0 : 2;
      y = k * BLK + (dir === 0 ? 24 : 8);
      x = qx;
      if (x < 40 || x > WPX - 40 || mod(x, BLK) < 44 || mod(x, BLK) > BLK - 12) continue;
    }
    if (onScreen(x, y, 30) || nearCar(x, y, 38)) continue;
    const r = R(),
      kind = cop
        ? KIND.police
        : r < 0.5
          ? KIND.sedan
          : r < 0.65
            ? KIND.van
            : r < 0.8
              ? KIND.taxi
              : r < 0.93
                ? KIND.sports
                : KIND.police;
    const c = mkCar(kind, x, y, (dir * PI) / 2);
    c.dir = dir;
    c.driver = true;
    c.cruise = 48 + R() * 30;
    c.sp = c.cruise;
    c.ai = cop ? 'cop' : 'traffic';
    if (cop) {
      c.vx = DIRS[dir][0] * 60;
      c.vy = DIRS[dir][1] * 60;
    }
    G.cars.push(c);
    return;
  }
}
function spawnPed() {
  const p = ppos();
  for (let tr = 0; tr < 12; tr++) {
    const a = R() * 7,
      d = 120 + R() * 200,
      x = p.x + Math.cos(a) * d,
      y = p.y + Math.sin(a) * d;
    if (onScreen(x, y, 12)) continue;
    const t = tileAt(x, y);
    if (t !== WALK && t !== PLAZA) continue;
    const sc = R() < (G.job && G.job.def.type === 'kill' ? 0.5 : 0.14);
    G.peds.push(mkPed(Math.floor(x / 16) * 16 + 8, Math.floor(y / 16) * 16 + 8, sc ? 'scoot' : 'civ'));
    return;
  }
}
export function placePickup(pk) {
  for (let i = 0; i < 200; i++) {
    const tx = Math.floor(R() * MW),
      ty = Math.floor(R() * MW),
      t = map[ty * MW + tx];
    if (t === WALK || t === GRASS || t === PLAZA) {
      pk.x = tx * 16 + 8;
      pk.y = ty * 16 + 8;
      const r = R();
      pk.type = r < 0.34 ? 'ammo' : r < 0.62 ? 'cash' : r < 0.8 ? 'donut' : 'med';
      pk.v = 50 + Math.floor(R() * 6) * 50;
      pk.t = 0;
      return pk;
    }
  }
  return pk;
}
export function spawner(dt) {
  const p = ppos();
  G.cars = G.cars.filter(
    (c) =>
      c === P.car ||
      c.parked ||
      (G.job && G.job.car === c) ||
      hyp(c.x - p.x, c.y - p.y) < (c.dead || !c.ai ? 380 : 470),
  );
  G.peds = G.peds.filter((q) => hyp(q.x - p.x, q.y - p.y) < 400);
  spT -= dt;
  if (spT <= 0) {
    spT = 0.35;
    if (G.cars.filter((c) => c.ai === 'traffic').length < 13) spawnRoad(false);
  }
  spP -= dt;
  if (spP <= 0) {
    spP = 0.15;
    if (G.peds.length < 24) spawnPed();
  }
  spC -= dt;
  if (spC <= 0 && G.screen === 'play') {
    spC = 2.2;
    const n = G.cars.filter((c) => c.ai === 'cop').length;
    if (G.heat > 0 && n < Math.min(5, G.heat)) spawnRoad(true);
    if (G.heat > 0)
      for (const c of G.cars)
        if (c.ai === 'traffic' && c.kind === KIND.police && hyp(c.x - p.x, c.y - p.y) < 130) {
          c.ai = 'cop';
          c.vx = DIRS[c.dir][0] * c.sp;
          c.vy = DIRS[c.dir][1] * c.sp;
        }
  }
}
