// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BLK, CULT, GOAL, JOBS, LOT } from '../../js/config.js';
import { CULT_SPOT, crossing, footClear, genMap, tileAt } from '../../js/world.js';
import { G, K, P, resetState } from '../../js/state.js';
import { passJob, resetMissions, startJob, updJob } from '../../js/missions.js';
import { spawner } from '../../js/spawner.js';
import { updPeds } from '../../js/peds.js';

const DT = 1 / 60;
const cultists = () => G.peds.filter((p) => p.type === 'cult');
/** Work through the job list until the named one is the active job. */
function startJobNamed(title) {
  resetMissions();
  for (let i = 0; i < JOBS.length; i++) {
    startJob();
    if (G.job.def.t === title) return;
    passJob();
    G.cash = 0;
  }
  throw new Error('no job called ' + title);
}

before(() => genMap());
beforeEach(() => {
  resetState();
  G.screen = 'play';
  for (const k in K) delete K[k];
});

test('every job has what its type needs', () => {
  for (const j of JOBS) {
    assert.ok(j.t.length <= 24, `"${j.t}" fits the HUD`);
    assert.ok(j.time > 0 && j.pay > 0 && j.txt, j.t);
    assert.ok(['go', 'kill', 'steal', 'wreck', 'survive', 'find'].includes(j.type), j.t);
    if (['kill', 'wreck', 'survive'].includes(j.type)) assert.ok(j.n > 0, `${j.t} needs a count`);
  }
});

test('the first run through the jobs pays enough to buy the election', () => {
  const total = JOBS.reduce((n, j) => n + j.pay, 0);
  assert.ok(total >= GOAL, `the jobs pay ${total} against a goal of ${GOAL}`);
});

test('crossings are numbered from the north-west corner, starting at 1', () => {
  assert.deepEqual(crossing(16, 16), { ave: 1, st: 1 });
  assert.deepEqual(crossing(3 * BLK + 20, 16), { ave: 4, st: 1 });
  assert.deepEqual(crossing(5 * BLK + 16, 6 * BLK + 16), { ave: 6, st: 7 });
  assert.deepEqual(crossing(99999, -50), { ave: 9, st: 1 }, 'clamped to the map');
});

test('the cult of 6-7 gathers in the car park by avenue 6 and street 7', () => {
  startJobNamed('THE CULT OF 6-7');
  assert.equal(G.job.target, null, 'no arrow: the player has to count streets');
  assert.deepEqual([G.job.def.time, G.job.pay], [167, 6700]);
  assert.equal(cultists().length, CULT.members);
  assert.equal(tileAt(CULT_SPOT.x, CULT_SPOT.y), LOT);
  for (const c of cultists()) {
    assert.ok(footClear(c.x, c.y), 'standing in the open');
    assert.ok(Math.hypot(c.x - CULT_SPOT.x, c.y - CULT_SPOT.y) < 30);
  }
  // Their spot is the block south-east of the crossing in the clue.
  const corner = { x: 5 * BLK + 16, y: 6 * BLK + 16 };
  assert.deepEqual(crossing(corner.x, corner.y), { ave: CULT.ave, st: CULT.st });
  assert.ok(
    CULT_SPOT.x > corner.x &&
      CULT_SPOT.y > corner.y &&
      Math.hypot(CULT_SPOT.x - corner.x, CULT_SPOT.y - corner.y) < 160,
  );
});

test('the cult stays put and waits, however far away the player is', () => {
  startJobNamed('THE CULT OF 6-7');
  const before = cultists().map((c) => [c.x, c.y]);
  for (let i = 0; i < 120; i++) {
    spawner(DT);
    updPeds(DT);
  }
  assert.ok(Math.hypot(P.x - CULT_SPOT.x, P.y - CULT_SPOT.y) > 400, 'the player starts far away');
  assert.deepEqual(
    cultists().map((c) => [c.x, c.y]),
    before,
  );
});

test('standing at the crossing is not enough; walking into the gathering finishes the job', () => {
  startJobNamed('THE CULT OF 6-7');
  Object.assign(P, { x: 5 * BLK + 16, y: 6 * BLK + 16 });
  updJob(DT);
  assert.ok(G.job, 'still looking');
  Object.assign(P, CULT_SPOT);
  updJob(DT);
  assert.equal(G.job, null);
  assert.equal(G.cash, 6700);
  assert.match(G.msgTxt, /6 \+ 7 = 13/);
  assert.equal(cultists().length, 0, 'the meeting breaks up');
  assert.equal(G.peds.length, CULT.members, 'and its members walk off as ordinary people');
});

test('running out of time loses the cult', () => {
  startJobNamed('THE CULT OF 6-7');
  G.job.t = 0.01;
  updJob(DT);
  assert.equal(G.job, null);
  assert.equal(G.cash, 0);
  assert.equal(cultists().length, 0);
});
