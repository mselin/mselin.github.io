// SPDX-License-Identifier: GPL-2.0-or-later
// The wanted level: crimes raise it, losing the police lowers it. Also the paint shop, district names and news ticker.
import { CCOLS, DISTRICTS, HEATMSG, HT, KIND, NEWS, NOTICE, STOLEN_CRUISER_HEAT } from './config.js';
import { R, hyp, pick } from './util.js';
import { PAINT, districtAt } from './world.js';
import { sfx, tone } from './audio.js';
import { G, P, msg, ppos } from './state.js';
import { down } from './player.js';

let district = '';
let newsT = 12;
let paintCd = 0;
export function resetHeat() {
  district = '';
  newsT = 12;
  paintCd = 0;
}
export function crime(n) {
  G.heatPts = Math.min(230, G.heatPts + n);
  G.heatCool = 0;
  let h = 0;
  for (let i = 1; i < 6; i++) if (G.heatPts >= HT[i]) h = i;
  if (h > G.heat) {
    G.heat = h;
    msg(HEATMSG[h]);
    sfx.alarm();
  }
}
export function updHeat(dt) {
  const p = ppos();
  let near = false;
  for (const c of G.cars)
    if (c.ai === 'cop' && hyp(c.x - p.x, c.y - p.y) < NOTICE.car) {
      near = true;
      break;
    }
  if (!near)
    for (const q of G.peds)
      if (q.type === 'cop' && hyp(q.x - p.x, q.y - p.y) < NOTICE.foot) {
        near = true;
        break;
      }
  // The police know their own cruisers, and know the player is not one of them. A patrol car in ordinary
  // traffic notices too: there are police about even before the player has any heat.
  if (G.screen === 'play' && P.car && P.car.kind === KIND.police && G.heat < STOLEN_CRUISER_HEAT) {
    const patrol = G.cars.some(
      (c) =>
        c !== P.car &&
        c.ai === 'traffic' &&
        c.kind === KIND.police &&
        c.driver &&
        !c.dead &&
        hyp(c.x - p.x, c.y - p.y) < NOTICE.patrol,
    );
    if (near || patrol) {
      crime(HT[STOLEN_CRUISER_HEAT] - G.heatPts);
      msg('THE COPS KNOW THAT CRUISER. THEY DO NOT KNOW YOU.');
    }
  }
  if (G.heat > 0) {
    if (near) G.heatCool = 0;
    else {
      G.heatCool += dt;
      if (G.heatCool > 9) {
        G.heat--;
        G.heatPts = HT[G.heat];
        G.heatCool = 0;
        msg(G.heat ? 'HEAT DROPPING. THEY FOUND A BIGGER FISH.' : 'HEAT GONE. THE CASE HAS BEEN "MISFILED".');
      }
    }
    if (near) {
      G.sirenT -= dt;
      if (G.sirenT <= 0) {
        G.sirenT = 0.7;
        tone(620, 620, 0.33, 'square', 0.07);
        tone(830, 830, 0.33, 'square', 0.07, 0.35);
      }
    }
  }
  // cop cars boxing in
  if (P.car && G.heat > 0 && G.screen === 'play' && hyp(P.car.vx, P.car.vy) < 12) {
    let boxed = false;
    for (const c of G.cars) if (c.ai === 'cop' && hyp(c.x - p.x, c.y - p.y) < 24) boxed = true;
    if (boxed) {
      P.car.bust += dt * 0.5;
      if (P.car.bust > 1) {
        P.car.bust = 0;
        down('busted', 'BOXED IN. LIKE YOUR CAREER PROSPECTS.');
      }
    }
  }
  // paint shop
  paintCd -= dt;
  if (
    P.car &&
    paintCd <= 0 &&
    hyp(p.x - PAINT.x, p.y - PAINT.y) < 16 &&
    (G.heat > 0 || P.car.hp < P.car.kind.hp - 5)
  ) {
    paintCd = 4;
    if (G.cash >= 200) {
      G.cash -= 200;
      G.heat = 0;
      G.heatPts = 0;
      P.car.hp = P.car.kind.hp;
      P.car.burn = 0;
      if (P.car.kind.col == null) P.car.col = pick(CCOLS.filter((c) => c !== P.car.col));
      sfx.good();
      msg('PAINT & PRAY: NEW COLOUR, SAME SINS. -$200');
    } else msg('PAINT & PRAY: NO CASH, NO ABSOLUTION.');
  }
  const dn = DISTRICTS[districtAt(p.x, p.y)];
  if (dn !== district) {
    district = dn;
    G.pops.push({ x: 0, y: 0, t: dn, col: 1, l: 2.5, hud: true });
  }
  newsT -= dt;
  if (newsT <= 0) {
    newsT = 22 + R() * 15;
    if (G.msgT <= 0) msg(pick(NEWS));
  }
}
