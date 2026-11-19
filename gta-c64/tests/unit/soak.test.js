// SPDX-License-Identifier: GPL-2.0-or-later
// A long, seeded, unattended play session run without a browser. It presses keys at random and checks,
// every step, that the game stays in a sane state. It exists to catch the bugs nobody thought to test for.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let first = true;
/** Play `minutes` of game time from `seed` and return what happened. */
async function play(seed, minutes) {
  // The game takes its randomness from Math.random when its modules load, so seed it first.
  let a = seed;
  Math.random = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const [{ genMap, footClear }, { G, K, P, edge }, { initWorld, update }, { crime }, { WPX }] =
    await Promise.all([
      import('../../js/world.js'),
      import('../../js/state.js'),
      import('../../js/game.js'),
      import('../../js/heat.js'),
      import('../../js/config.js'),
    ]);
  if (first) {
    genMap();
    initWorld();
    G.screen = 'title';
    first = false;
  } else G.screen = 'over'; // a later run begins by answering "new game?" like a player would
  const DT = 1 / 30,
    KEYS = ['up', 'down', 'left', 'right', 'fire', 'hb'],
    seen = { screens: new Set(), maxCars: 0, maxPeds: 0, maxParts: 0, drove: 0, swam: 0, jobs: 0, stuck: 0 };
  let lastJob = null,
    still = 0,
    lastX = 0,
    lastY = 0;
  for (let step = 0; step < minutes * 60 * 30; step++) {
    // Change what is held every half second or so; tap the one-shot keys now and then.
    if (step % 15 === 0)
      for (const k of KEYS) K[k] = Math.random() < (k === 'up' ? 0.7 : k === 'fire' ? 0.2 : 0.3);
    if (Math.random() < 0.02) edge.use = true;
    if (G.screen !== 'play' && G.screen !== 'down' && Math.random() < 0.05) edge.fire = edge.yes = true;
    if (step % 2000 === 1000) crime(40);
    if (step % 5000 === 2500) G.cash += 800;
    update(DT);
    for (const k in edge) delete edge[k];

    const where = `step ${step}, seed ${seed}, screen ${G.screen}`;
    seen.screens.add(G.screen);
    for (const [name, v] of [
      ['P.x', P.x],
      ['P.y', P.y],
      ['cash', G.cash],
      ['camX', G.camX],
      ['camY', G.camY],
    ])
      assert.ok(Number.isFinite(v), `${name} is ${v} at ${where}`);
    assert.ok(P.x >= 0 && P.x <= WPX && P.y >= 0 && P.y <= WPX, `player off the map at ${where}`);
    assert.ok(G.cash >= 0, `negative cash at ${where}`);
    assert.ok(G.heat >= 0 && G.heat <= 5, `heat ${G.heat} at ${where}`);
    assert.ok(P.hp >= 0 && P.hp <= 100, `hp ${P.hp} at ${where}`);
    for (const c of G.cars)
      assert.ok(Number.isFinite(c.x + c.y + c.a + c.vx + c.vy + c.hp), `a car went non-finite at ${where}`);
    for (const p of G.peds) assert.ok(Number.isFinite(p.x + p.y), `a pedestrian went non-finite at ${where}`);
    assert.ok(G.cars.length < 110, `${G.cars.length} cars at ${where}`);
    assert.ok(G.peds.length < 60, `${G.peds.length} pedestrians at ${where}`);
    assert.ok(G.parts.length < 3000 && G.bullets.length < 300, `runaway particles or bullets at ${where}`);
    if (P.car) assert.ok(G.cars.includes(P.car), `driving a car that no longer exists at ${where}`);
    if (G.job && G.job.car) assert.ok(G.cars.includes(G.job.car), `the job car vanished at ${where}`);

    seen.maxCars = Math.max(seen.maxCars, G.cars.length);
    seen.maxPeds = Math.max(seen.maxPeds, G.peds.length);
    seen.maxParts = Math.max(seen.maxParts, G.parts.length);
    if (P.car) seen.drove++;
    if (P.swim) seen.swam++;
    if (G.job && G.job !== lastJob) seen.jobs++;
    lastJob = G.job;
    // On foot in open play, holding a direction, the player must not be wedged inside a wall for long.
    if (G.screen === 'play' && !P.car && !footClear(P.x, P.y)) {
      still = P.x === lastX && P.y === lastY ? still + 1 : 0;
      seen.stuck = Math.max(seen.stuck, still);
    } else still = 0;
    lastX = P.x;
    lastY = P.y;
  }
  return seen;
}

for (const seed of [64, 1982, 8580]) {
  test(`twenty minutes of random play stays sane (seed ${seed})`, async () => {
    const seen = await play(seed, 20);
    assert.ok(seen.screens.has('play'), 'the game was played');
    assert.ok(seen.drove > 500, `drove for ${seen.drove} steps`);
    assert.ok(seen.stuck < 150, `stuck in a wall for ${seen.stuck} steps`);
  });
}
