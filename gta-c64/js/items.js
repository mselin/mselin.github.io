// SPDX-License-Identifier: GPL-2.0-or-later
// Bullets and pickups.
import { DIRS, HIT, HT, KIND, WATER } from './config.js';
import { R, hyp } from './util.js';
import { solidAt, tileAt } from './world.js';
import { sfx } from './audio.js';
import { G, P, msg, pop, ppos } from './state.js';
import { crime } from './heat.js';
import { killPed } from './peds.js';
import { hurt } from './player.js';
import { placePickup } from './spawner.js';

export function updBullets(dt) {
  for (const b of G.bullets) {
    b.l -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (solidAt(b.x, b.y)) {
      const t = tileAt(b.x, b.y);
      if (t !== WATER) {
        b.l = 0;
        G.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, l: 0.15, col: 1 });
        continue;
      }
    }
    if (b.own === 0) {
      for (const p of G.peds.slice())
        if (hyp(p.x - b.x, p.y - b.y) < HIT.shot) {
          killPed(p, true);
          b.l = 0;
          break;
        }
    } else if (!P.car && G.screen === 'play' && hyp(P.x - b.x, P.y - b.y) < HIT.shot) {
      hurt(11, 'RESISTING ARREST. ALLEGEDLY.');
      b.l = 0;
    }
    if (b.l > 0)
      for (const c of G.cars) {
        // Wrecks are spent, and a car on the bottom of the canal is out of reach.
        if (c.dead || (c.flooded && c.sink >= 1)) continue;
        if (hyp(c.x - b.x, c.y - b.y) < 8) {
          if (b.own === 1 && c !== P.car) continue;
          c.hp -= b.own === 0 ? 20 : 7;
          b.l = 0;
          G.parts.push({ x: b.x, y: b.y, vx: (R() - 0.5) * 60, vy: (R() - 0.5) * 60, l: 0.2, col: 7 });
          if (b.own === 0) {
            if (c.ai === 'traffic') {
              c.ai = null;
              c.vx = DIRS[c.dir][0] * c.sp;
              c.vy = DIRS[c.dir][1] * c.sp;
            }
            crime(c.kind === KIND.police ? 5 : 1);
          }
          break;
        }
      }
  }
  G.bullets = G.bullets.filter((b) => b.l > 0);
}
export function updPickups(dt) {
  const p = ppos();
  for (const k of G.pickups) {
    if (k.t > 0) {
      k.t -= dt;
      if (k.t <= 0) placePickup(k);
      continue;
    }
    if (k.temp != null) {
      k.temp -= dt;
    }
    if (G.screen === 'play' && hyp(k.x - p.x, k.y - p.y) < 11) {
      sfx.pick();
      if (k.type === 'cash') {
        G.cash += k.v;
        pop(k.x, k.y - 8, '+$' + k.v, 13);
      } else if (k.type === 'ammo') {
        P.ammo += 12;
        pop(k.x, k.y - 8, '+12 AMMO', 7);
      } else if (k.type === 'med') {
        P.hp = Math.min(100, P.hp + 40);
        G.cash = Math.max(0, G.cash - 20);
        pop(k.x, k.y - 8, 'BANDAGE -$20 COPAY', 1);
      } else if (k.type === 'donut') {
        if (G.heat > 0) {
          G.heat--;
          G.heatPts = HT[G.heat];
          G.heatCool = 0;
          msg('DONUT DEPLOYED. THE LAW IS DISTRACTED.');
        } else pop(k.x, k.y - 8, 'MMM. DONUT.', 10);
      }
      if (k.temp != null) k.temp = -1;
      else k.t = 40 + R() * 30;
    }
  }
  G.pickups = G.pickups.filter((k) => k.temp == null || k.temp > 0);
}
