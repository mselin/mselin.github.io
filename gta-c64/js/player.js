// SPDX-License-Identifier: GPL-2.0-or-later
// The player on foot and at the wheel: movement, weapons, getting in and out of cars, dying and getting arrested.
import { DIRS, JACK, KIND } from './config.js';
import { hyp, pick } from './util.js';
import { COPS, HOSP, footClear, waterAt } from './world.js';
import { noise, sfx } from './audio.js';
import { G, K, P, bigText, edge, msg } from './state.js';
import { mkPed } from './entities.js';
import { crime } from './heat.js';
import { carPhys, sidePos } from './cars.js';
import { killPed, scare } from './peds.js';
import { failJob } from './missions.js';
import { radio } from './radio.js';

let downKind = '';
let skidT = 0;
export function hurt(n, why) {
  if (G.screen !== 'play') return;
  P.hp -= n;
  P.hitT = 0.4;
  if (P.hp <= 0) {
    P.hp = 0;
    down('dead', why);
  }
}
export function down(kind, why) {
  G.screen = 'down';
  downKind = kind;
  G.downT = 3.2;
  if (P.car) {
    P.car.driver = false;
    P.car = null;
  }
  if (kind === 'dead') {
    bigText('FLATLINED', why || 'THOUGHTS AND PRAYERS HAVE BEEN DISPATCHED', 2, 3.2);
    sfx.bad();
  } else {
    bigText('BUSTED', why || 'YOU HAVE THE RIGHT TO REMAIN BROKE', 14, 3.2);
    sfx.bad();
  }
  if (G.job) failJob(null);
}
export function respawn() {
  // Arrested with nothing left to confiscate: the game ends here.
  if (downKind === 'busted' && G.cash === 0) {
    G.screen = 'over';
    G.banner = null;
    return;
  }
  const L = downKind === 'dead' ? HOSP : COPS;
  P.x = L.x;
  P.y = L.y;
  P.hp = 100;
  P.car = null;
  G.heat = 0;
  G.heatPts = 0;
  G.cars = G.cars.filter((c) => c.ai !== 'cop');
  G.peds = G.peds.filter((p) => p.type !== 'cop');
  G.bullets = [];
  G.screen = 'play';
  if (downKind === 'dead') {
    const bill = Math.min(G.cash, 500);
    G.cash -= bill;
    msg('ST. INVOICE HOSPITAL: AMBULANCE RIDE -$' + bill + ' (OUT OF NETWORK)');
  } else {
    const f = Math.floor(G.cash * 0.2);
    G.cash -= f;
    P.ammo = 0;
    msg('CIVIL ASSET FORFEITURE: -$' + f + '. YOUR AMMO IS NOW "EVIDENCE"');
  }
}
function enterCar() {
  let best = null,
    bd = 19;
  for (const c of G.cars) {
    if (c.dead || c.flooded) continue;
    const d = hyp(c.x - P.x, c.y - P.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (!best) return;
  const c = best;
  if (c.driver) {
    const s = sidePos(c) || { x: c.x, y: c.y };
    const q = mkPed(s.x, s.y, 'civ');
    q.flee = 6;
    G.peds.push(q);
    crime(c.kind === KIND.police ? 16 : 4);
    msg(c.kind === KIND.police ? 'OFFICER: "THAT IS A COMPANY CAR!"' : pick(JACK));
  }
  c.vx = c.ai === 'traffic' ? DIRS[c.dir][0] * c.sp : c.vx;
  c.vy = c.ai === 'traffic' ? DIRS[c.dir][1] * c.sp : c.vy;
  c.ai = null;
  c.driver = false;
  c.parked = false;
  P.car = c;
  sfx.door();
  if (G.musicOn) G.pops.push({ x: 0, y: 0, t: 'RADIO: ' + radio[G.station].name, col: 7, l: 2.5, hud: true });
}
function exitCar() {
  const c = P.car;
  if (hyp(c.vx, c.vy) > 45) return;
  const s = sidePos(c);
  if (!s) return;
  P.x = s.x;
  P.y = s.y;
  P.car = null;
  sfx.door();
}
const footHits = (x, y) => !footClear(x, y);
export const WALK_SPEED = 58,
  SWIM_SPEED = 22;
export function updPlayer(dt) {
  if (G.screen !== 'play') return;
  P.hitT -= dt;
  const c = P.car;
  if (c) {
    carPhys(c, (K.up ? 1 : 0) - (K.down ? 1 : 0), (K.right ? 1 : 0) - (K.left ? 1 : 0), dt, !!K.hb);
    if (c.sk) {
      skidT -= dt;
      if (skidT <= 0) {
        skidT = 0.08;
        noise(0.09, Math.min(0.2, 0.06 + c.slide / 600), 2600);
      }
    }
    P.x = c.x;
    P.y = c.y;
    P.a = c.a;
    if (edge.fire) {
      sfx.horn();
      scare(c.x, c.y, 60, 1.5);
    }
    if (edge.use) exitCar();
    if (c.burn > 0 && !c.warned) {
      c.warned = true;
      msg('YOUR CAR IS ON FIRE. THIS IS FINE.');
    }
  } else {
    // In the water the player swims: slowly, and with both hands busy.
    const swim = waterAt(P.x, P.y);
    if (swim && !P.swim) sfx.splash();
    P.swim = swim;
    let dx = (K.right ? 1 : 0) - (K.left ? 1 : 0),
      dy = (K.down ? 1 : 0) - (K.up ? 1 : 0);
    if (dx || dy) {
      const l = hyp(dx, dy);
      dx /= l;
      dy /= l;
      P.a = Math.atan2(dy, dx);
      const s = (swim ? SWIM_SPEED : WALK_SPEED) * dt;
      // Someone who has somehow ended up inside a wall may always walk; otherwise they could never leave.
      const stuck = footHits(P.x, P.y);
      if (stuck || !footHits(P.x + dx * s, P.y)) P.x += dx * s;
      if (stuck || !footHits(P.x, P.y + dy * s)) P.y += dy * s;
      P.anim += dt * 9;
    }
    P.cd -= dt;
    if (K.fire && P.cd <= 0 && !swim) {
      const fx = Math.cos(P.a),
        fy = Math.sin(P.a);
      if (P.ammo > 0) {
        P.ammo--;
        P.cd = 0.22;
        G.bullets.push({ x: P.x + fx * 5, y: P.y + fy * 5, vx: fx * 240, vy: fy * 240, l: 0.55, own: 0 });
        sfx.shot();
        crime(1.5);
        scare(P.x, P.y, 110, 4);
      } else {
        P.cd = 0.35;
        sfx.punch();
        const hx = P.x + fx * 7,
          hy = P.y + fy * 7;
        for (const q of G.peds.slice())
          if (hyp(q.x - hx, q.y - hy) < 7) {
            killPed(q, true);
            break;
          }
      }
    }
    if (edge.use) enterCar();
    for (const o of G.cars) {
      const sp = hyp(o.vx, o.vy);
      if (sp > 45 && P.hitT <= 0 && hyp(o.x - P.x, o.y - P.y) < 9) {
        hurt(sp * 0.28, 'A PEDESTRIAN. IN THIS ECONOMY?');
        sfx.squish();
        const nx = P.x + o.vx * 0.06,
          ny = P.y + o.vy * 0.06;
        if (!footHits(nx, ny)) {
          P.x = nx;
          P.y = ny;
        }
      }
    }
  }
}
