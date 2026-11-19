// SPDX-License-Identifier: GPL-2.0-or-later
// Jobs: starting, tracking, passing and failing them.
import { CULT, JOBS, KIND, MW, WALK } from './config.js';
import { R, hyp } from './util.js';
import { CHOP, CULT_SPOT, HALL, JOBPTS, map, nearestLand } from './world.js';
import { sfx } from './audio.js';
import { G, P, bigText, msg, onScreen, pop, ppos } from './state.js';
import { mkCar, mkPed } from './entities.js';
import { crime } from './heat.js';
import { sidePos } from './cars.js';

let jobI = 0;
export function resetMissions() {
  jobI = 0;
}
function farSpot(min, max) {
  const p = ppos();
  for (let i = 0; i < 400; i++) {
    const tx = Math.floor(R() * MW),
      ty = Math.floor(R() * MW);
    if (map[ty * MW + tx] !== WALK) continue;
    const x = tx * 16 + 8,
      y = ty * 16 + 8,
      d = hyp(x - p.x, y - p.y);
    if (d > min && d < max) return { x, y };
  }
  return { x: HALL.x, y: HALL.y };
}
export function startJob() {
  const def = JOBS[jobI % JOBS.length],
    lap = Math.floor(jobI / JOBS.length);
  G.job = {
    def,
    t: def.time,
    n: 0,
    acc: 0,
    stage: 0,
    target: null,
    car: null,
    pay: Math.round(def.pay * (1 + lap * 0.5)),
  };
  if (def.type === 'go') G.job.target = farSpot(650, 1300);
  if (def.type === 'find') gatherCult();
  if (def.type === 'steal') {
    const s = farSpot(500, 1100);
    const c = mkCar(KIND.limo, s.x, s.y, 0);
    c.parked = true;
    G.cars.push(c);
    G.job.car = c;
    G.job.target = c;
  }
  bigText(def.t, 'REWARD $' + G.job.pay, 7, 2.5);
  msg(def.txt);
  sfx.pick();
}
const CULT_RING = 20;
/** Stand the cultists in a ring round their spot, facing inwards. They stay put until the job ends. */
function gatherCult() {
  for (let i = 0; i < CULT.members; i++) {
    const a = (i / CULT.members) * Math.PI * 2,
      c = mkPed(CULT_SPOT.x + Math.cos(a) * CULT_RING, CULT_SPOT.y + Math.sin(a) * CULT_RING, 'cult');
    c.dx = -Math.cos(a);
    c.dy = -Math.sin(a);
    G.peds.push(c);
  }
  G.job.chantT = 0;
  G.job.chant = 0;
}
/** When the job ends, found or not, the meeting breaks up and its members walk off like anyone else. */
function disperseCult() {
  for (const q of G.peds)
    if (q.type === 'cult') {
      q.type = 'civ';
      q.spd = 18;
      q.flee = 1.5;
      q.fx = CULT_SPOT.x;
      q.fy = CULT_SPOT.y;
    }
}
export function passJob() {
  G.cash += G.job.pay;
  bigText('JOB DONE', '+$' + G.job.pay + ' (UNDECLARED)', 13, 2.5);
  sfx.good();
  jobI++;
  disperseCult();
  G.job = null;
}
export function failJob(why) {
  if (!G.job) return;
  if (G.job.car && G.job.car !== P.car) G.job.car.parked = false;
  disperseCult();
  G.job = null;
  if (why !== null) {
    bigText('JOB BOTCHED', why || 'TIME IS MONEY AND YOU HAVE NEITHER', 2, 2.5);
    sfx.bad();
  }
}
export function updJob(dt) {
  const p = ppos();
  if (!G.job) {
    for (const j of JOBPTS)
      if (hyp(p.x - j.x, p.y - j.y) < 12 && G.screen === 'play') {
        startJob();
        break;
      }
    return;
  }
  const d = G.job.def;
  G.job.t -= dt;
  if (d.type === 'go' && hyp(p.x - G.job.target.x, p.y - G.job.target.y) < 14) return passJob();
  if ((d.type === 'kill' || d.type === 'wreck') && G.job.n >= d.n) return passJob();
  if (d.type === 'find') {
    // The faithful chant their numbers, which is how a passer-by knows they have the right car park.
    G.job.chantT -= dt;
    if (G.job.chantT <= 0) {
      G.job.chantT = 0.45;
      const who = G.peds.filter((q) => q.type === 'cult');
      const c = who[Math.floor(R() * who.length)];
      if (c && onScreen(c.x, c.y, 0)) pop(c.x, c.y - 10, G.job.chant++ & 1 ? '7' : '6', 7);
    }
    if (hyp(p.x - CULT_SPOT.x, p.y - CULT_SPOT.y) < 44) {
      msg('THE CULT OF 6-7 WELCOMES YOU. 6 + 7 = 13. NOBODY THERE KNOWS WHY THAT MATTERS.');
      return passJob();
    }
  }
  if (d.type === 'survive') {
    if (G.heat >= 2) G.job.acc += dt;
    if (G.job.acc >= d.n) return passJob();
  }
  if (d.type === 'steal') {
    if (G.job.stage === 0 && P.car === G.job.car) {
      G.job.stage = 1;
      G.job.target = CHOP;
      msg('NICE LIMO. NOW THE CHOP SHOP, BEFORE HE NOTICES.');
      crime(10);
    }
    if (G.job.stage === 1 && P.car === G.job.car && hyp(p.x - CHOP.x, p.y - CHOP.y) < 18) {
      const c = G.job.car;
      P.car = null;
      // Step out beside the limo, wherever there is room to stand.
      const out = sidePos(c) || nearestLand(c.x, c.y) || c;
      P.x = out.x;
      P.y = out.y;
      G.cars.splice(G.cars.indexOf(c), 1);
      return passJob();
    }
  }
  if (G.job.t <= 0) failJob();
}
