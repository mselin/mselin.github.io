// SPDX-License-Identifier: GPL-2.0-or-later
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BLD, MW, ROAD, WALK, WATER } from '../../js/config.js';
import { CHOP, COPS, HOSP, JOBPTS, PAINT, genMap, map, solidAt, tile, tileAt } from '../../js/world.js';

before(() => genMap());

test('the street grid repeats every 12 tiles', () => {
  for (const [tx, ty] of [
    [0, 0],
    [1, 5],
    [12, 30],
    [40, 13],
    [96, 50],
    [50, 97],
  ]) {
    assert.equal(tile(tx, ty), ROAD, `tile ${tx},${ty}`);
  }
  for (const [tx, ty] of [
    [2, 5],
    [11, 5],
    [5, 2],
    [5, 11],
  ]) {
    assert.equal(tile(tx, ty), WALK, `tile ${tx},${ty}`);
  }
});

test('everything beyond the map edge is water and solid', () => {
  assert.equal(tile(-1, 5), WATER);
  assert.equal(tile(5, MW), WATER);
  assert.ok(solidAt(-20, 100));
  assert.ok(solidAt(100, MW * 16 + 5));
});

test('the canal fills the fifth column of blocks', () => {
  for (let by = 0; by < 8; by++) assert.equal(tile(4 * 12 + 6, by * 12 + 6), WATER);
});

test('the fixed buildings are where the signs say', () => {
  assert.equal(tile(1 * 12 + 6, 1 * 12 + 6), BLD, 'hospital');
  assert.equal(tile(6 * 12 + 6, 2 * 12 + 6), BLD, 'precinct');
});

test('every place the player is sent to stands on open pavement', () => {
  for (const p of [HOSP, COPS, CHOP, PAINT, ...JOBPTS]) {
    assert.equal(tileAt(p.x, p.y), WALK);
    assert.ok(!solidAt(p.x, p.y));
  }
});

test('the generated city is always the same one', () => {
  let sum = 0;
  for (let i = 0; i < map.length; i++) sum = (sum * 31 + map[i]) >>> 0;
  const roads = map.reduce((n, t) => n + (t === ROAD), 0);
  // 18 road rows and 18 road columns of 98 tiles, minus the 324 tiles where they cross.
  assert.equal(roads, 2 * 18 * 98 - 324);
  genMap();
  let again = 0;
  for (let i = 0; i < map.length; i++) again = (again * 31 + map[i]) >>> 0;
  assert.equal(again, sum);
});
