import { test } from 'node:test';
import assert from 'node:assert/strict';
import './calc.js';
const { calc, convert } = globalThis.Sourdough;

const loaves = { loafGrams: 1000, loafCount: 2 };
const dough = { ...loaves, d_flour: 48, d_starter: 11.6, d_salt: 0.96 };
const bakers = { ...loaves, b_hydration: 84.08921933, b_starter: 24.16666667, b_salt: 2 };

const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

function matchesSheet(r) {
  assert.equal(r.total, 2000);
  near(r.grams.flour, 960);
  near(r.grams.water, 788.8);
  near(r.grams.starter, 232);
  near(r.grams.salt, 19.2);
  near(r.pct.water, 0.3944);
  near(r.bakers.starter, 0.2416666667);
  near(r.bakers.salt, 0.02);
  near(r.bakers.water, 0.8216666667);
  near(r.bakersTotal, 2.083333333);
  near(r.hydration, 0.8408921933);
  assert.equal(r.valid, true);
}

test('dough mode reproduces the spreadsheet', () => matchesSheet(calc('dough', dough)));
test('bakers mode reproduces the spreadsheet', () => matchesSheet(calc('bakers', bakers)));

test('scales with loaf count', () => {
  near(calc('dough', { ...dough, loafCount: 3 }).grams.flour, 1440);
  near(calc('bakers', { ...bakers, loafCount: 3 }).grams.flour, 1440);
});

test('dough mode is invalid when percentages exceed 100', () => {
  const r = calc('dough', { ...dough, d_flour: 95 });
  assert.ok(r.pct.water < 0);
  assert.equal(r.valid, false);
});

test('bakers mode is invalid when hydration is too low for the starter', () => {
  const r = calc('bakers', { ...bakers, b_hydration: 5, b_starter: 50 });
  assert.ok(r.bakers.water < 0);
  assert.equal(r.valid, false);
});

test('only the active mode fields need to be present', () => {
  assert.equal(calc('dough', dough).ready, true);
  assert.equal(calc('dough', bakers).ready, false);
  assert.equal(calc('bakers', bakers).ready, true);
  assert.equal(calc('bakers', loaves).ready, false);
});

test('converts dough shares to baker\'s percentages and back', () => {
  const b = convert.dough(dough);
  near(b.b_hydration, 84.08921933);
  near(b.b_starter, 24.16666667);
  near(b.b_salt, 2);
  const d = convert.bakers(b);
  near(d.d_flour, 48);
  near(d.d_starter, 11.6);
  near(d.d_salt, 0.96);
});
