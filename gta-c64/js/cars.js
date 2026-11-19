// SPDX-License-Identifier: GPL-2.0-or-later
// Car handling, collisions, traffic and police driving, damage and explosions.
import { BLK, DIRS, GRASS, GRIP, KIND, LOT, NB, PAL, PI, PLAZA, ROAD, WALK, WPX } from './config.js';
import { R, angDiff, clamp, hyp, mod, pick } from './util.js';
import { decals, nearestLand, solidAt, tileAt, wallAt, waterAt } from './world.js';
import { sfx } from './audio.js';
import { G, P, msg, onScreen, pop, ppos } from './state.js';
import { mkPed } from './entities.js';
import { crime } from './heat.js';
import { killPed } from './peds.js';
import { hurt } from './player.js';
import { failJob } from './missions.js';

export function carHits(c, x, y) {
  const h = c.kind.L / 2 - 4,
    cs = Math.cos(c.a),
    sn = Math.sin(c.a);
  for (let t = -1; t <= 1; t++) {
    const px = x + cs * h * t,
      py = y + sn * h * t;
    if (wallAt(px - 4, py - 4) || wallAt(px + 4, py - 4) || wallAt(px - 4, py + 4) || wallAt(px + 4, py + 4))
      return true;
  }
  return false;
}
function impact(c, spd) {
  if (spd > 55) {
    c.hp -= (spd - 55) * 0.14;
    if (onScreen(c.x, c.y, 10)) {
      sfx.crash(spd / 300);
      for (let i = 0; i < 4; i++)
        G.parts.push({ x: c.x, y: c.y, vx: (R() - 0.5) * 80, vy: (R() - 0.5) * 80, l: 0.3, col: 7 });
    }
  }
}
function skid(c, on) {
  const h = c.kind.L / 2 - 4,
    w = c.kind.W / 2 - 2,
    cs = Math.cos(c.a),
    sn = Math.sin(c.a),
    bx = c.x - cs * h,
    by = c.y - sn * h,
    p = [bx - sn * w, by + cs * w, bx + sn * w, by - cs * w];
  if (on && c.sk) {
    for (let i = 0; i < 4; i += 2) {
      const x0 = c.sk[i],
        y0 = c.sk[i + 1],
        x1 = p[i],
        y1 = p[i + 1],
        n = Math.max(1, Math.ceil(hyp(x1 - x0, y1 - y0)));
      if (n > 12) continue;
      for (let q = 1; q <= n; q++) {
        const x = Math.floor(x0 + ((x1 - x0) * q) / n),
          y = Math.floor(y0 + ((y1 - y0) * q) / n),
          t = tileAt(x, y);
        if (t === ROAD || t === LOT) decals.ctx.fillStyle = PAL[0];
        else if (t === WALK || t === PLAZA) decals.ctx.fillStyle = PAL[12];
        else if (t === GRASS) decals.ctx.fillStyle = PAL[9];
        else continue;
        decals.ctx.fillRect(x, y, 1, 1);
      }
    }
    if (R() < 0.25 && onScreen(c.x, c.y, 10))
      G.parts.push({
        x: bx + (R() - 0.5) * 6,
        y: by + (R() - 0.5) * 6,
        vx: (R() - 0.5) * 14,
        vy: (R() - 0.5) * 14 - 6,
        l: 0.4,
        col: R() < 0.5 ? 15 : 12,
        s: 2,
      });
  }
  c.sk = on ? p : null;
}
/**
 * A car whose middle is over water floods: the engine dies for good and it settles where it is.
 * It does not catch fire or blow up from this. A driver gets out and swims to the nearest dry land.
 */
export function flood(c) {
  if (c.flooded || c.dead) return;
  c.flooded = true;
  c.ai = null;
  c.driver = false;
  c.parked = false;
  if (onScreen(c.x, c.y, 20)) {
    sfx.splash();
    for (let i = 0; i < 26; i++) {
      const a = R() * 7,
        s = 20 + R() * 70;
      G.parts.push({
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        l: 0.3 + R() * 0.4,
        col: pick([1, 3, 14]),
        s: 2,
      });
    }
  }
  if (P.car === c) {
    const land = nearestLand(c.x, c.y);
    P.car = null;
    if (land) {
      P.x = land.x;
      P.y = land.y;
    }
    msg('YOU SWIM ASHORE. THE CAR DOES NOT. THE WARRANTY DOES NOT COVER THIS.');
  }
  if (G.job && G.job.car === c) failJob('THE LIMO IS NOW A SUBMARINE');
}
export function carPhys(c, thr, steer, dt, hb) {
  if (c.flooded) {
    // Dead in the water: no engine, no steering, just the last of its momentum.
    const drag = Math.max(0, 1 - 5 * dt);
    c.vx *= drag;
    c.vy *= drag;
    if (!carHits(c, c.x + c.vx * dt, c.y + c.vy * dt)) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
    }
    c.slide = 0;
    skid(c, false);
    return;
  }
  const k = c.kind,
    oa = c.a;
  let fx = Math.cos(c.a),
    fy = Math.sin(c.a);
  const f0 = c.vx * fx + c.vy * fy;
  c.a += steer * 3 * clamp(f0 / 55, -1, 1) * (hb ? 1.3 : 1) * dt;
  const emb = carHits(c, c.x, c.y);
  if (c.a !== oa && !emb && carHits(c, c.x, c.y)) c.a = oa;
  fx = Math.cos(c.a);
  fy = Math.sin(c.a);
  let fwd = c.vx * fx + c.vy * fy,
    lat = -c.vx * fy + c.vy * fx;
  const braking = thr < 0 && fwd > 5,
    spin = thr > 0 && fwd < 45 && fwd > -5 && k.acc > 150;
  if (thr > 0) fwd += k.acc * thr * dt;
  else if (thr < 0) fwd -= (fwd > 5 ? k.acc * 2.2 : k.acc * 0.6) * -thr * dt;
  if (hb) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), k.acc * 1.2 * dt);
  fwd -= fwd * 0.5 * dt;
  if (!thr) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 45 * dt);
  const mx = k.max * (c.hp < 40 ? 0.7 : 1);
  fwd = clamp(fwd, -mx * 0.4, mx);
  let grip = GRIP[k.n] * (hb ? 0.28 : braking ? 0.6 : 1) * (c.hp < 40 ? 0.85 : 1);
  if (tileAt(c.x, c.y) === GRASS) grip *= 0.55;
  lat -= Math.sign(lat) * Math.min(Math.abs(lat), grip * dt);
  lat *= Math.max(0, 1 - 1.2 * dt);
  c.slide = Math.abs(lat);
  skid(c, c.slide > 26 || (braking && fwd > 75) || (hb && Math.abs(fwd) > 30) || spin);
  c.vx = fx * fwd - fy * lat;
  c.vy = fy * fwd + fx * lat;
  const nx = c.x + c.vx * dt;
  if (!emb && carHits(c, nx, c.y)) {
    impact(c, Math.abs(c.vx));
    c.vx *= -0.3;
  } else c.x = nx;
  const ny = c.y + c.vy * dt;
  if (!emb && carHits(c, c.x, ny)) {
    impact(c, Math.abs(c.vy));
    c.vy *= -0.3;
  } else c.y = ny;
  c.x = clamp(c.x, 8, WPX - 8);
  c.y = clamp(c.y, 8, WPX - 8);
  if (waterAt(c.x, c.y)) flood(c);
}
function trafficAI(c, dt) {
  const D = DIRS[c.dir];
  let want = c.cruise;
  c.ghost -= dt;
  if (c.ghost <= 0) {
    for (const o of G.cars) {
      if (o === c) continue;
      const rx = o.x - c.x,
        ry = o.y - c.y,
        f = rx * D[0] + ry * D[1];
      if (f > 4 && f < 36 && Math.abs(rx * D[1] - ry * D[0]) < 9) {
        want = 0;
        break;
      }
    }
    if (want) {
      for (const p of G.peds) {
        const rx = p.x - c.x,
          ry = p.y - c.y,
          f = rx * D[0] + ry * D[1];
        if (f > 4 && f < 24 && Math.abs(rx * D[1] - ry * D[0]) < 7) {
          want = 0;
          break;
        }
      }
      if (!P.car) {
        const rx = P.x - c.x,
          ry = P.y - c.y,
          f = rx * D[0] + ry * D[1];
        if (f > 4 && f < 24 && Math.abs(rx * D[1] - ry * D[0]) < 7) want = 0;
      }
    }
  }
  c.sp += clamp(want - c.sp, -220 * dt, 70 * dt);
  c.x += D[0] * c.sp * dt;
  c.y += D[1] * c.sp * dt;
  if (c.sp < 3) {
    c.jam += dt;
    if (c.jam > 3.5) {
      c.ghost = 1.6;
      c.jam = 0;
      if (onScreen(c.x, c.y, 0) && R() < 0.5) sfx.horn();
    }
  } else c.jam = 0;
  const ix = Math.floor(c.x / BLK),
    iy = Math.floor(c.y / BLK),
    inI = c.x - ix * BLK < 32 && c.y - iy * BLK < 32;
  if (inI && !c.inI) {
    const ok = (d) => (d === 0 ? ix < NB : d === 2 ? ix > 0 : d === 1 ? iy < NB : iy > 0);
    const o = [0, 1, 2, 3].filter((d) => d !== (c.dir + 2) % 4 && ok(d));
    c.nd = o.includes(c.dir) && R() < 0.5 ? c.dir : o.length ? pick(o) : (c.dir + 2) % 4;
  }
  if (inI && c.nd != null && c.nd !== c.dir) {
    const X0 = ix * BLK,
      Y0 = iy * BLK;
    if (c.nd === 0 || c.nd === 2) {
      const ty = Y0 + (c.nd === 0 ? 24 : 8);
      if ((c.dir === 1 && c.y >= ty) || (c.dir === 3 && c.y <= ty)) {
        c.y = ty;
        c.dir = c.nd;
      }
    } else {
      const tx = X0 + (c.nd === 1 ? 8 : 24);
      if ((c.dir === 0 && c.x >= tx) || (c.dir === 2 && c.x <= tx)) {
        c.x = tx;
        c.dir = c.nd;
      }
    }
  }
  c.inI = inI;
  c.a += angDiff((c.dir * PI) / 2, c.a) * Math.min(1, 9 * dt);
  c.vx = DIRS[c.dir][0] * c.sp;
  c.vy = DIRS[c.dir][1] * c.sp;
}
function copTarget(c) {
  const p = ppos(),
    dx = p.x - c.x,
    dy = p.y - c.y,
    d = hyp(dx, dy),
    onV = mod(c.x, BLK) < 32,
    onH = mod(c.y, BLK) < 32,
    n = (k) => clamp(k, 0, NB) * BLK + 16;
  if (d < 90 || (!onV && !onH)) return p;
  if (onH && Math.abs(dy) < 28) return p;
  if (onV && Math.abs(dx) < 28) return p;
  const ix = Math.floor(c.x / BLK),
    iy = Math.floor(c.y / BLK);
  if (onV && onH)
    return Math.abs(dx) > Math.abs(dy)
      ? { x: n(ix + Math.sign(dx)), y: n(iy) }
      : { x: n(ix), y: n(iy + Math.sign(dy)) };
  if (onH) {
    const q = (c.x - 16) / BLK;
    return { x: n(Math.abs(dx) < 32 ? Math.round(q) : dx > 0 ? Math.ceil(q) : Math.floor(q)), y: n(iy) };
  }
  const q = (c.y - 16) / BLK;
  return { x: n(ix), y: n(Math.abs(dy) < 32 ? Math.round(q) : dy > 0 ? Math.ceil(q) : Math.floor(q)) };
}
function copAI(c, dt) {
  if (G.heat === 0 || G.screen !== 'play') {
    carPhys(c, 0, 0, dt);
    return;
  }
  const t = copTarget(c),
    p = ppos(),
    d = hyp(p.x - c.x, p.y - c.y),
    df = angDiff(Math.atan2(t.y - c.y, t.x - c.x), c.a),
    spd = hyp(c.vx, c.vy);
  if (c.rev > 0) {
    c.rev -= dt;
    carPhys(c, -1, -Math.sign(df) || 1, dt);
    return;
  }
  if (spd < 8 && d > 26) {
    c.stuck += dt;
    if (c.stuck > 1) {
      c.rev = 0.8;
      c.stuck = 0;
    }
  } else c.stuck = 0;
  let thr = Math.abs(df) > 1.3 ? 0.45 : 1;
  if (d < 24) thr = 0;
  if (G.heat < 3 && d < 60 && spd > 90) thr = 0;
  carPhys(c, thr, clamp(df * 2.5, -1, 1), dt);
  const pspd = P.car ? hyp(P.car.vx, P.car.vy) : 0;
  if (d < 36 && spd < 30 && pspd < 30 && G.peds.filter((q) => q.type === 'cop').length < 4) {
    const s = sidePos(c);
    if (s) {
      G.peds.push(mkPed(s.x, s.y, 'cop'));
      c.ai = null;
      c.driver = false;
      sfx.door();
    }
  }
}
export function sidePos(c) {
  for (const s of [1, -1]) {
    const x = c.x - Math.sin(c.a) * 12 * s,
      y = c.y + Math.cos(c.a) * 12 * s;
    if (!solidAt(x, y)) return { x, y };
  }
  return null;
}
function explode(c) {
  if (c.dead) return;
  c.dead = true;
  c.ai = null;
  c.driver = false;
  c.burn = 0;
  sfx.boom();
  for (let i = 0; i < 34; i++) {
    const a = R() * 7,
      s = R() * 110;
    G.parts.push({
      x: c.x,
      y: c.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      l: 0.4 + R() * 0.6,
      col: pick([7, 8, 2, 1, 0, 12]),
      s: R() < 0.4 ? 3 : 2,
    });
  }
  decals.ctx.fillStyle = PAL[0];
  for (let i = 0; i < 70; i++) {
    const a = R() * 7,
      r = R() * 14;
    decals.ctx.fillRect(Math.floor(c.x + Math.cos(a) * r), Math.floor(c.y + Math.sin(a) * r), 1, 1);
  }
  for (const p of G.peds.slice()) if (hyp(p.x - c.x, p.y - c.y) < 30) killPed(p, false);
  for (const o of G.cars) if (o !== c && !o.dead && hyp(o.x - c.x, o.y - c.y) < 32) o.hp -= 55;
  if (P.car === c) {
    P.car = null;
    hurt(999, 'YOUR NO-CLAIMS BONUS IS GONE. SO ARE YOU.');
  } else if (!P.car && hyp(P.x - c.x, P.y - c.y) < 30) hurt(60);
  if (G.job && G.job.def.type === 'wreck') {
    G.job.n++;
    pop(c.x, c.y - 10, G.job.n + '/' + G.job.def.n, 7);
  }
  if (G.job && G.job.car === c) failJob('THE LIMO IS NOW ABSTRACT ART');
}
export function updCars(dt) {
  for (const c of G.cars) {
    if (c.dead) {
      if (hyp(c.vx, c.vy) > 2) carPhys(c, 0, 0, dt);
      if (R() < dt * 4)
        G.parts.push({ x: c.x, y: c.y, vx: (R() - 0.5) * 8, vy: -14, l: 1, col: R() < 0.5 ? 11 : 12, s: 2 });
      continue;
    }
    if (c === P.car) {
    } else if (c.ai === 'traffic') trafficAI(c, dt);
    else if (c.ai === 'cop') copAI(c, dt);
    else if (hyp(c.vx, c.vy) > 1) carPhys(c, 0, 0, dt);
    else {
      c.vx = c.vy = 0;
    }
    if (c.hp < 45) {
      c.smk -= dt;
      if (c.smk <= 0) {
        c.smk = 0.08;
        G.parts.push({
          x: c.x + Math.cos(c.a) * 7,
          y: c.y + Math.sin(c.a) * 7,
          vx: (R() - 0.5) * 10,
          vy: -18,
          l: 0.7,
          col: c.hp < 20 ? 0 : 12,
          s: 2,
        });
      }
    }
    if (c.hp <= 0 && !c.burn) c.burn = 2.6;
    if (c.burn > 0) {
      c.burn -= dt;
      if (R() < dt * 30)
        G.parts.push({
          x: c.x + (R() - 0.5) * 10,
          y: c.y + (R() - 0.5) * 8,
          vx: 0,
          vy: -25,
          l: 0.35,
          col: pick([7, 8, 2]),
          s: 2,
        });
      if (c.burn <= 0) explode(c);
    }
    if (c === P.car && c.ai !== null) c.ai = null;
  }
  // car-car
  for (let i = 0; i < G.cars.length; i++) {
    const a = G.cars[i];
    for (let j = i + 1; j < G.cars.length; j++) {
      const b = G.cars[j];
      if (Math.abs(a.x - b.x) > 30 || Math.abs(a.y - b.y) > 30) continue;
      const at = a.ai === 'traffic',
        bt = b.ai === 'traffic';
      if (at && bt) continue;
      let best = 0,
        nx = 0,
        ny = 0;
      for (const s of [-1, 1])
        for (const u of [-1, 1]) {
          const ax = a.x + Math.cos(a.a) * 5 * s,
            ay = a.y + Math.sin(a.a) * 5 * s,
            bx = b.x + Math.cos(b.a) * 5 * u,
            by = b.y + Math.sin(b.a) * 5 * u,
            dx = bx - ax,
            dy = by - ay,
            d = hyp(dx, dy) || 0.01,
            ov = 11 - d;
          if (ov > best) {
            best = ov;
            nx = dx / d;
            ny = dy / d;
          }
        }
      if (best <= 0) continue;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny,
        hard = rv < -35;
      const mvA = !at || hard,
        mvB = !bt || hard,
        sh = mvA && mvB ? 0.5 : 1;
      if (hard) {
        for (const c of [a, b])
          if (c.ai === 'traffic') {
            c.ai = null;
            c.vx = DIRS[c.dir][0] * c.sp;
            c.vy = DIRS[c.dir][1] * c.sp;
          }
      }
      if (mvA) {
        const x = a.x - nx * best * sh,
          y = a.y - ny * best * sh;
        if (!carHits(a, x, y) || carHits(a, a.x, a.y)) {
          a.x = x;
          a.y = y;
        }
      }
      if (mvB) {
        const x = b.x + nx * best * sh,
          y = b.y + ny * best * sh;
        if (!carHits(b, x, y) || carHits(b, b.x, b.y)) {
          b.x = x;
          b.y = y;
        }
      }
      if (rv < 0) {
        const im = rv * 0.65;
        if (mvA) {
          a.vx += nx * im;
          a.vy += ny * im;
        }
        if (mvB) {
          b.vx -= nx * im;
          b.vy -= ny * im;
        }
        if (rv < -40) {
          const dm = (-rv - 40) * 0.22;
          // A flooded car is already written off; knocks do not set it alight.
          if (!a.dead && !a.flooded) a.hp -= dm;
          if (!b.dead && !b.flooded) b.hp -= dm;
          if (onScreen(a.x, a.y, 0)) sfx.crash(-rv / 250);
          const mine = a === P.car ? b : b === P.car ? a : null;
          if (mine) {
            crime(mine.kind === KIND.police && mine.driver ? 9 : mine.driver ? 2 : 0.5);
            for (let k = 0; k < 5; k++)
              G.parts.push({
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
                vx: (R() - 0.5) * 90,
                vy: (R() - 0.5) * 90,
                l: 0.3,
                col: 7,
              });
          }
        }
      }
    }
  }
  if (P.car) {
    P.x = P.car.x;
    P.y = P.car.y;
  }
}
