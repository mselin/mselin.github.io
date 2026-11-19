// SPDX-License-Identifier: GPL-2.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, P, resetState } from '../../js/state.js';
import { HOSP } from '../../js/world.js';

test('resetState starts a new game but keeps the sound settings and the radio', () => {
  Object.assign(G, {
    cash: 5000,
    heat: 4,
    heatPts: 150,
    job: { t: 1 },
    banner: { t: 'X' },
    paused: true,
    quitAsk: true,
  });
  G.cars.push({});
  G.pops.push({});
  Object.assign(G, { musicOn: true, fxOn: false, station: 2, screen: 'over' });
  Object.assign(P, { x: 1, y: 2, hp: 3, ammo: 0, car: {} });

  resetState();

  assert.deepEqual(
    [G.cash, G.heat, G.heatPts, G.job, G.banner, G.paused, G.quitAsk],
    [0, 0, 0, null, null, false, false],
  );
  assert.deepEqual([G.cars, G.pops, G.peds], [[], [], []]);
  assert.deepEqual([P.x, P.y, P.hp, P.ammo, P.car], [HOSP.x, HOSP.y, 100, 12, null]);
  assert.deepEqual([G.musicOn, G.fxOn, G.station, G.screen], [true, false, 2, 'over'], 'left alone');
  G.musicOn = false;
  G.fxOn = true;
  G.station = 0;
  G.screen = 'boot';
});
