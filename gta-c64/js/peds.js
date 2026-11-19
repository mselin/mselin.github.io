// SPDX-License-Identifier: GPL-2.0-or-later
// Pedestrians and police on foot.
import { DIRS, GRASS, LOT, PAL, PLAZA, ROAD, WALK } from './config.js';
import { R, hyp } from './util.js';
import { decals, nearestLand, solidAt, tileAt, wallAt, waterAt } from './world.js';
import { sfx } from './audio.js';
import { G, P, msg, onScreen, pop, ppos } from './state.js';
import { crime } from './heat.js';
import { down } from './player.js';

let immunity = false;
export function resetPeds() {
  immunity = false;
}
/** Leave a mark on the ground where someone died. */
function stain(p) {
  decals.ctx.fillStyle = PAL[2];
  for (let k = 0; k < 12; k++)
    decals.ctx.fillRect(
      Math.floor(p.x + (R() - 0.5) * 9),
      Math.floor(p.y + (R() - 0.5) * 9),
      1 + (R() < 0.3),
      1,
    );
  decals.ctx.fillStyle = PAL[p.shirt];
  decals.ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 2, 3, 4);
}
export function killPed(p, byPlayer) {
  const i = G.peds.indexOf(p);
  if (i < 0) return;
  G.peds.splice(i, 1);
  if (!waterAt(p.x, p.y)) stain(p);
  if (onScreen(p.x, p.y, 10)) sfx.squish();
  if (byPlayer) {
    crime(p.type === 'cop' ? 28 : 6);
    if (G.job && G.job.def.type === 'kill' && p.type === 'scoot') {
      G.job.n++;
      pop(p.x, p.y - 8, G.job.n + '/' + G.job.def.n, 7);
    } else if (p.type === 'scoot') pop(p.x, p.y - 8, '+$0 (PUBLIC SERVICE)', 13);
    else if (R() < 0.4)
      G.pickups.push({ x: p.x, y: p.y, type: 'cash', v: 10 + Math.floor(R() * 9) * 10, temp: 20, t: 0 });
  }
}
export function scare(x, y, r, t) {
  for (const q of G.peds)
    if (q.type !== 'cop' && hyp(q.x - x, q.y - y) < r) {
      q.flee = t;
      q.fx = x;
      q.fy = y;
    }
}
export const SWIM_FACTOR = 0.4;
function pedMove(p, vx, vy, dt) {
  // Water is not a wall for people, but it is slow going.
  if (waterAt(p.x, p.y)) {
    vx *= SWIM_FACTOR;
    vy *= SWIM_FACTOR;
  }
  const nx = p.x + vx * dt,
    ny = p.y + vy * dt;
  let ok = false;
  if (!wallAt(nx, p.y)) {
    p.x = nx;
    ok = true;
  }
  if (!wallAt(p.x, ny)) {
    p.y = ny;
    ok = true;
  }
  return ok;
}
function pedPref(t, p) {
  return t === WALK || t === PLAZA || t === GRASS || (p.jay && (t === ROAD || t === LOT));
}
function pedPick(p) {
  const here = tileAt(p.x, p.y);
  p.jay = here === ROAD || here === LOT || R() < 0.1;
  const o = [0, 1, 2, 3].sort(() => R() - 0.5);
  let ch = null;
  for (const i of o) {
    const d = DIRS[i];
    if (d[0] === -p.dx && d[1] === -p.dy && R() < 0.8) continue;
    if (pedPref(tileAt(p.x + d[0] * 9, p.y + d[1] * 9), p)) {
      ch = d;
      break;
    }
  }
  if (!ch)
    for (const i of o) {
      const d = DIRS[i];
      if (!solidAt(p.x + d[0] * 9, p.y + d[1] * 9)) {
        ch = d;
        p.jay = true;
        break;
      }
    }
  if (ch) {
    p.dx = ch[0];
    p.dy = ch[1];
  }
  p.t = 1 + R() * 5;
}
export function updPeds(dt) {
  const pl = ppos();
  for (const p of G.peds.slice()) {
    p.anim += dt * p.spd * 0.15;
    if (p.type === 'cop' && G.heat > 0 && G.screen === 'play') {
      const dx = pl.x - p.x,
        dy = pl.y - p.y,
        d = hyp(dx, dy) || 1;
      p.dx = dx / d;
      p.dy = dy / d;
      if (d > 6) pedMove(p, p.dx * p.spd, p.dy * p.spd, dt);
      p.cd -= dt;
      if (G.heat >= 3 && d < 95 && p.cd <= 0) {
        p.cd = 1.1 + R() * 0.6;
        G.bullets.push({
          x: p.x,
          y: p.y,
          vx: p.dx * 200 + (R() - 0.5) * 40,
          vy: p.dy * 200 + (R() - 0.5) * 40,
          l: 0.6,
          own: 1,
        });
        if (onScreen(p.x, p.y, 0)) sfx.shot();
      }
      if (!P.car && d < 7) down('busted');
      else if (P.car && d < 13 && hyp(P.car.vx, P.car.vy) < 22) {
        P.car.bust += dt;
        if (P.car.bust > 0.7) {
          P.car.bust = 0;
          down('busted', 'PLEASE STEP OUT OF THE STOLEN VEHICLE');
        }
      }
      continue;
    }
    if (p.flee > 0) {
      p.flee -= dt;
      const dx = p.x - p.fx,
        dy = p.y - p.fy,
        d = hyp(dx, dy) || 1;
      p.dx = dx / d;
      p.dy = dy / d;
      if (!pedMove(p, p.dx * 48, p.dy * 48, dt)) {
        p.fx = p.x + (R() - 0.5) * 20;
        p.fy = p.y + (R() - 0.5) * 20;
      }
      if (p.flee <= 0) {
        p.dx = 1;
        p.dy = 0;
        pedPick(p);
      }
      continue;
    }
    if (waterAt(p.x, p.y)) {
      // Nobody is in the water on purpose: head for the nearest bank, slowly.
      p.landT = (p.landT || 0) - dt;
      if (!p.land || p.landT <= 0) {
        p.land = nearestLand(p.x, p.y);
        p.landT = 1;
      }
      if (p.land) {
        const dx = p.land.x - p.x,
          dy = p.land.y - p.y,
          d = hyp(dx, dy) || 1;
        p.dx = dx / d;
        p.dy = dy / d;
        pedMove(p, p.dx * 45, p.dy * 45, dt);
      }
      p.t = 0;
      continue;
    }
    p.land = null;
    p.t -= dt;
    if (p.t <= 0 || !pedPref(tileAt(p.x + p.dx * 9, p.y + p.dy * 9), p)) pedPick(p);
    if (!solidAt(p.x + p.dx * 4, p.y + p.dy * 4)) {
      p.x += p.dx * p.spd * dt;
      p.y += p.dy * p.spd * dt;
    }
  }
  // run over
  for (const c of G.cars) {
    const sp = hyp(c.vx, c.vy);
    if (sp < 30) continue;
    const fx = c.x + Math.cos(c.a) * 6,
      fy = c.y + Math.sin(c.a) * 6;
    for (const p of G.peds.slice())
      if (hyp(p.x - c.x, p.y - c.y) < 8 || hyp(p.x - fx, p.y - fy) < 7) {
        const mine = c === P.car;
        killPed(p, mine);
        if (c.ai === 'cop' && !immunity) {
          immunity = true;
          msg('POLICE STATEMENT: "THE PEDESTRIAN WAS RESISTING."');
        }
      }
  }
}
