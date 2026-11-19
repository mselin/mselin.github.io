// SPDX-License-Identifier: GPL-2.0-or-later
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HT } from '../../js/config.js';
import { G } from '../../js/state.js';
import { crime } from '../../js/heat.js';

beforeEach(() => {
  G.heat = 0;
  G.heatPts = 0;
});

test('small crimes add up to the first heat level', () => {
  crime(HT[1] - 1);
  assert.equal(G.heat, 0);
  crime(1);
  assert.equal(G.heat, 1);
});

test('one big crime can jump several levels and announces the new one', () => {
  crime(HT[3]);
  assert.equal(G.heat, 3);
  assert.match(G.msgTxt, /^HEAT 3/);
});

test('heat tops out at five', () => {
  for (let i = 0; i < 50; i++) crime(100);
  assert.equal(G.heat, 5);
  assert.ok(G.heatPts <= 230);
});

test('committing a crime resets the cool-down', () => {
  G.heatCool = 8;
  crime(1);
  assert.equal(G.heatCool, 0);
});
