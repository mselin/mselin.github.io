// SPDX-License-Identifier: GPL-2.0-or-later
// Draws every screen: boot, title, the city with its HUD, and the win screen.
import { BX, BY, GOAL, KIND, PAL, PI, SH, SW, VH } from './config.js';
import { R, clamp, hyp, mod } from './util.js';
import { TOUCH, cx, g, scr } from './screen.js';
import { ctext, text } from './font.js';
import { ARW, carSpr, pedSpr } from './sprites.js';
import { CHOP, JOBPTS, PAINT } from './world.js';
import { mapC } from './worldview.js';
import { G, P, onScreen, ppos } from './state.js';
import { npText, radio, radioAudible } from './radio.js';

let camXi = 0;
let camYi = 0;
function drawSpr(fr, a, x, y) {
  const n = fr.length,
    i = mod(Math.round((a / (PI * 2)) * n), n),
    s = fr[0].width;
  g.drawImage(fr[i], Math.round(x - camXi - s / 2), Math.round(y - camYi - s / 2));
}
function marker(x, y, ch, c1, c2) {
  if (!onScreen(x, y, 10)) return;
  const f = Math.floor(G.clock * 4) & 1,
    sx = Math.round(x - camXi),
    sy = Math.round(y - camYi);
  g.fillStyle = PAL[f ? c1 : c2];
  g.fillRect(sx - 6, sy - 6, 12, 12);
  g.fillStyle = PAL[0];
  g.fillRect(sx - 5, sy - 5, 10, 10);
  text(ch, sx - 4, sy - 4, f ? c1 : c2);
}
const PKI = { ammo: ['A', 8, 7], cash: ['$', 5, 13], donut: ['O', 10, 1], med: ['+', 1, 2] };
function drawWorld() {
  camXi = Math.round(G.camX);
  camYi = Math.round(G.camY);
  g.drawImage(mapC, camXi, camYi, SW, VH, 0, 0, SW, VH);
  for (const j of JOBPTS) if (!G.job) marker(j.x, j.y, 'J', 7, 4);
  marker(PAINT.x, PAINT.y, 'P', 3, 1);
  if (G.job && G.job.def.type === 'steal' && G.job.stage === 1) marker(CHOP.x, CHOP.y, 'X', 7, 2);
  if (G.job && G.job.def.type === 'go') marker(G.job.target.x, G.job.target.y, 'X', 7, 2);
  for (const k of G.pickups) {
    if (k.t > 0 || !onScreen(k.x, k.y, 8)) continue;
    if (k.temp != null && k.temp < 4 && Math.floor(G.clock * 8) & 1) continue;
    const d = PKI[k.type],
      sx = Math.round(k.x - camXi) - 4,
      sy = Math.round(k.y - camYi) - 4 + (Math.floor(G.clock * 3 + k.x) & 1);
    g.fillStyle = PAL[0];
    g.fillRect(sx - 1, sy - 1, 10, 10);
    g.fillStyle = PAL[d[1]];
    g.fillRect(sx, sy, 8, 8);
    text(d[0], sx, sy, d[2]);
  }
  for (const p of G.peds)
    if (onScreen(p.x, p.y, 8)) drawSpr(pedSpr(p, Math.floor(p.anim) & 1), Math.atan2(p.dy, p.dx), p.x, p.y);
  if (!P.car && G.screen !== 'down' && !(P.hitT > 0 && Math.floor(G.clock * 20) & 1))
    drawSpr(pedSpr(P, Math.floor(P.anim) & 1), P.a, P.x, P.y);
  for (const c of G.cars) {
    if (!onScreen(c.x, c.y, 20)) continue;
    drawSpr(carSpr(c), c.a, c.x, c.y);
    if (c.kind === KIND.police && !c.dead && c.ai === 'cop' && G.heat > 0) {
      const f = Math.floor(G.clock * 6) & 1,
        sx = Math.round(c.x - camXi),
        sy = Math.round(c.y - camYi);
      g.fillStyle = PAL[f ? 2 : 14];
      g.fillRect(sx - 2, sy - 1, 2, 2);
      g.fillStyle = PAL[f ? 14 : 2];
      g.fillRect(sx, sy - 1, 2, 2);
    }
    if (G.job && G.job.car === c && G.job.stage === 0 && Math.floor(G.clock * 4) & 1)
      text('!', Math.round(c.x - camXi) - 4, Math.round(c.y - camYi) - 20, 7);
  }
  for (const b of G.bullets) {
    g.fillStyle = PAL[b.own ? 1 : 7];
    g.fillRect(Math.round(b.x - camXi), Math.round(b.y - camYi), 2, 2);
  }
  for (const p of G.parts) {
    g.fillStyle = PAL[p.col];
    const s = p.s || 1;
    g.fillRect(Math.round(p.x - camXi), Math.round(p.y - camYi), s, s);
  }
  for (const p of G.pops) {
    if (p.hud) continue;
    const w = p.t.length * 8;
    text(p.t, clamp(Math.round(p.x - camXi - w / 2), 0, SW - w), Math.round(p.y - camYi), p.col);
  }
  // target arrow
  const tg = G.job && G.job.target;
  if (tg && !onScreen(tg.x, tg.y, -12)) {
    const p = ppos(),
      a = Math.atan2(tg.y - p.y, tg.x - p.x);
    const sx = clamp(p.x - camXi + Math.cos(a) * 400, 10, SW - 10),
      sy = clamp(p.y - camYi + Math.sin(a) * 400, 10, VH - 10);
    const fr = ARW[Math.floor(G.clock * 5) & 1];
    g.drawImage(fr[mod(Math.round((a / (PI * 2)) * 16), 16)], Math.round(sx) - 5, Math.round(sy) - 5);
  } else if (!G.job) {
    let bj = null,
      bd = 1e9;
    const p = ppos();
    for (const j of JOBPTS) {
      const d = hyp(j.x - p.x, j.y - p.y);
      if (d < bd) {
        bd = d;
        bj = j;
      }
    }
    if (bj && !onScreen(bj.x, bj.y, -12)) {
      const a = Math.atan2(bj.y - p.y, bj.x - p.x),
        sx = clamp(p.x - camXi + Math.cos(a) * 400, 10, SW - 10),
        sy = clamp(p.y - camYi + Math.sin(a) * 400, 10, VH - 10);
      g.drawImage(ARW[0][mod(Math.round((a / (PI * 2)) * 16), 16)], Math.round(sx) - 5, Math.round(sy) - 5);
    }
  }
  for (const p of G.pops)
    if (p.hud) {
      const w = p.t.length * 8;
      g.fillStyle = PAL[0];
      g.fillRect((SW - w) / 2 - 4, 6, w + 8, 12);
      text(p.t, (SW - w) / 2, 8, p.col);
    }
  if (G.banner) {
    const w = G.banner.t.length * 16;
    g.fillStyle = PAL[0];
    g.fillRect(0, 58, SW, 44);
    g.fillStyle = PAL[G.banner.col];
    g.fillRect(0, 58, SW, 1);
    g.fillRect(0, 101, SW, 1);
    text(G.banner.t, Math.floor((SW - w) / 2), 64, G.banner.col, 2);
    if (G.banner.sub) ctext(G.banner.sub, 88, 1);
  }
  if (G.paused) {
    g.fillStyle = PAL[0];
    g.fillRect(100, 76, 120, 24);
    ctext('PAUSED', 84, 1);
  }
  if (G.quitAsk) {
    g.fillStyle = PAL[14];
    g.fillRect(36, 62, 248, 52);
    g.fillStyle = PAL[6];
    g.fillRect(40, 66, 240, 44);
    ctext('RETURN TO TITLE SCREEN?', 74, 1);
    ctext(TOUCH ? 'FIRE = YES    CAR = NO' : 'Y = YES    N = NO', 92, 7);
  }
  // panel
  g.fillStyle = PAL[0];
  g.fillRect(0, VH, SW, SH - VH);
  g.fillStyle = PAL[11];
  g.fillRect(0, VH, SW, 1);
  text('$' + String(G.cash).padStart(6, '0'), 0, VH + 1, 13);
  text('HEAT', 64, VH + 1, 15);
  for (let i = 0; i < 5; i++)
    text('*', 100 + i * 8, VH + 1, i < G.heat ? (Math.floor(G.clock * 4) & 1 ? 2 : 7) : 11);
  text('HP', 148, VH + 1, 15);
  g.fillStyle = PAL[11];
  g.fillRect(168, VH + 2, 42, 6);
  g.fillStyle = PAL[P.hp > 30 ? 5 : 2];
  g.fillRect(169, VH + 3, Math.round(P.hp * 0.4), 4);
  if (P.car) {
    text('CAR', 216, VH + 1, 15);
    g.fillStyle = PAL[11];
    g.fillRect(244, VH + 2, 32, 6);
    g.fillStyle = PAL[P.car.hp > 40 ? 3 : 2];
    g.fillRect(245, VH + 3, Math.round(clamp(P.car.hp / P.car.kind.hp, 0, 1) * 30), 4);
  }
  text('A' + String(P.ammo).padStart(3, '0'), 288, VH + 1, 7);
  if (G.job) {
    const d = G.job.def,
      t = Math.max(0, Math.ceil(G.job.t)),
      tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    let pr = '';
    if (d.type === 'kill' || d.type === 'wreck') pr = G.job.n + '/' + d.n;
    if (d.type === 'survive') pr = Math.floor(G.job.acc) + '/' + d.n + 'S';
    text(d.t.slice(0, 24), 0, VH + 9, 7);
    text(pr, 216, VH + 9, 1);
    text(tm, 280, VH + 9, t < 15 && Math.floor(G.clock * 4) & 1 ? 2 : 1);
  } else text('NO JOB. FOLLOW THE ARROW TO A "J".', 0, VH + 9, 12);
  if (G.msgT > 0) {
    const w = G.msgTxt.length * 8;
    let x = 0;
    if (w > SW) x = -Math.round(clamp((G.msgAge - 1) * 70, 0, w - SW));
    text(G.msgTxt, x, VH + 17, 1);
  } else if (P.car && radioAudible()) {
    const t = 'RADIO ' + radio[G.station].name + ': ' + npText() + '   ',
      w = t.length * 8;
    if (w <= SW) text(t, 0, VH + 17, 14);
    else {
      const o = Math.floor(G.clock * 45) % w;
      text(t, -o, VH + 17, 14);
      text(t, w - o, VH + 17, 14);
    }
  } else text('ELECTION FUND: $' + G.cash + ' / $' + GOAL, 0, VH + 17, 11);
}
const BARS = [2, 8, 7, 13, 3, 14, 4, 10, 1, 10, 4, 14, 3, 13, 7, 8];
const logoC = document.createElement('canvas');
logoC.width = 240;
logoC.height = 24;
const lg = logoC.getContext('2d');
lg.imageSmoothingEnabled = false;
const SCROLL =
  '        GREETINGS TO ALL PARKING WARDENS, LANDLORDS AND E-SCOOTER ENTHUSIASTS ... THIS GAME WAS NOT CRACKED BY ANYBODY ... ANY RESEMBLANCE TO REAL CITIES IS A COINCIDENCE AND ALSO YOUR FAULT ... ALL CRIMES DEPICTED ARE 8-BIT AND THEREFORE VICTIMLESS ... PRESS FIRE TO BEGIN YOUR CIVIC ENGAGEMENT ...        ';
function drawTitle() {
  g.fillStyle = PAL[0];
  g.fillRect(0, 0, SW, SH);
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, 240, 24);
  text('SLEAZEBURG', 0, 0, 1, 3, lg);
  lg.globalCompositeOperation = 'source-atop';
  for (let y = 0; y < 24; y++) {
    lg.fillStyle = PAL[BARS[mod(y + Math.floor(G.clock * 14), BARS.length)]];
    lg.fillRect(0, y, 240, 1);
  }
  for (let i = 0; i < 6; i++) {
    g.fillStyle = PAL[BARS[mod(i + Math.floor(G.clock * 6), BARS.length)]];
    g.fillRect(0, 12 + i * 2, SW, 1);
    g.fillRect(0, 68 + i * 2, SW, 1);
  }
  g.drawImage(logoC, 40, 30);
  text('64', 264, 58, 7);
  ctext('A TOTALLY ORIGINAL CRIME SATIRE', 86, 15);
  ctext('8 BITS. 16 COLOURS. 0 SCRUPLES.', 96, 12);
  text('ARROWS / WASD   WALK - DRIVE', 48, 116, 3);
  text('SPACE           FIRE - HORN', 48, 126, 3);
  text('E / ENTER       "BORROW" CAR', 48, 136, 3);
  text('P PAUSE         I INFO - CREDITS', 48, 146, 3);
  text('M MUSIC ON/OFF  R STATION  N NEXT', 48, 156, 14);
  {
    const t = G.musicOn
      ? radioAudible()
        ? 'NOW PLAYING: ' + npText()
        : 'TUNING IN ...'
      : 'MUSIC IS OFF - PRESS M TO TURN IT ON';
    if (t.length <= 40) ctext(t, 166, G.musicOn ? 7 : 12);
    else {
      const u = t + '     ',
        w = u.length * 8,
        o = Math.floor(G.clock * 45) % w;
      text(u, -o, 166, 7);
      text(u, w - o, 166, 7);
    }
  }
  if (Math.floor(G.clock * 2) & 1) ctext('PRESS FIRE TO COMMIT CRIMES', 176, 1);
  const off = Math.floor(G.clock * 60) % (SCROLL.length * 8);
  text(SCROLL, -off, 188, 13);
  if (off > SCROLL.length * 8 - SW) text(SCROLL, SCROLL.length * 8 - off, 188, 13);
}
function drawBoot() {
  g.fillStyle = PAL[6];
  g.fillRect(0, 0, SW, SH);
  const t = G.bootT,
    c = 14;
  text('    **** SLEAZEBURG 64 BASIC V2 ****', 0, 8, c);
  text(' 64K RAM SYSTEM  38911 MORAL BYTES FREE', 0, 24, c);
  if (t > 0.7) text('READY.', 0, 40, c);
  const cmd = 'LOAD"CRIME",8,1';
  if (t > 1.1) text(cmd.slice(0, Math.floor((t - 1.1) * 14)), 0, 48, c);
  if (t > 2.5) text('SEARCHING FOR CRIME', 0, 64, c);
  if (t > 3.3) text('LOADING', 0, 72, c);
  if (t > 5.4) text('READY.', 0, 80, c);
  if (t > 5.4) text('RUN', 0, 88, c);
  if (Math.floor(t * 3) & 1) {
    g.fillStyle = PAL[c];
    const y = t < 0.7 ? 40 : t < 2.5 ? 48 : t < 5.4 ? 80 : 96;
    const x = t > 1.1 && t < 2.5 ? Math.min(cmd.length, Math.floor((t - 1.1) * 14)) * 8 : 0;
    if (t < 2.5 || t > 5.4) g.fillRect(x, y, 8, 8);
  }
}
function drawWin() {
  g.fillStyle = PAL[0];
  g.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = PAL[BARS[mod(i + Math.floor(G.clock * 8), BARS.length)]];
    g.fillRect(0, 20 + i * 2, SW, 1);
  }
  ctext('ELECTION', 44, 7, 2);
  ctext('PURCHASED', 64, 7, 2);
  ctext('YOU ARE NOW MAYOR OF SLEAZEBURG.', 96, 1);
  ctext('NOTHING WILL CHANGE.', 108, 15);
  ctext('THE POTHOLES SEND THEIR REGARDS.', 120, 12);
  if (Math.floor(G.clock * 2) & 1) ctext('PRESS FIRE TO CONTINUE (NOW LEGAL)', 160, 13);
}
export function draw() {
  let border = 0;
  if (G.screen === 'boot') {
    drawBoot();
    border = 14;
  } else if (G.screen === 'title') drawTitle();
  else if (G.screen === 'win') drawWin();
  else {
    drawWorld();
    if (G.heat > 0 && G.sirenT > 0 && G.sirenT < 0.7) border = Math.floor(G.clock * 2) & 1 ? 2 : 6;
  }
  cx.fillStyle = PAL[border];
  cx.fillRect(0, 0, 384, 272);
  if (G.screen === 'boot' && G.bootT > 3.3 && G.bootT < 5.4) {
    for (let y = 0; y < 272;) {
      const h = 2 + Math.floor(R() * 10);
      cx.fillStyle = PAL[Math.floor(R() * 16)];
      cx.fillRect(0, y, 384, h);
      y += h;
    }
  }
  cx.drawImage(scr, BX, BY);
}
