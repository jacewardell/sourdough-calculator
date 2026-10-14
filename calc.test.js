import { test } from 'node:test';
import assert from 'node:assert/strict';
import './calc.js';
const { calc } = globalThis.Sourdough;
const sample = { loafGrams: 1000, loafCount: 2, starterPct: 11.6, flourPct: 48, saltPct: 0.96 };

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('matches the spreadsheet example', () => {
  const r = calc(sample);
  assert.equal(r.total, 2000);
  near(r.grams.starter, 232);
  near(r.grams.salt, 19.2);
  near(r.grams.flour, 960);
  near(r.grams.water, 788.8);
  near(r.pct.water, 0.3944);
  near(r.bakers.starter, 0.2416666667);
  near(r.bakers.salt, 0.02);
  near(r.bakers.flour, 1);
  near(r.bakers.water, 0.8216666667);
  near(r.bakersTotal, 2.083333333);
  near(r.hydration, 0.8408921933);
  assert.equal(r.valid, true);
});

test('scales with loaf count', () => {
  const r = calc({ ...sample, loafCount: 3 });
  assert.equal(r.total, 3000);
  near(r.grams.flour, 1440);
  near(r.hydration, calc(sample).hydration);
});

test('flags invalid when percentages exceed 100', () => {
  const r = calc({ ...sample, flourPct: 95 });
  assert.ok(r.pct.water < 0);
  assert.equal(r.valid, false);
});

test('does not divide by zero', () => {
  const r = calc({ ...sample, flourPct: 0 });
  assert.equal(r.bakers.water, 0);
  assert.equal(r.valid, false);
});

test('reports not ready when a field is missing', () => {
  const r = calc({ loafGrams: 1000, loafCount: 2 });
  assert.equal(r.ready, false);
  assert.equal(r.valid, false);
  assert.equal(calc(sample).ready, true);
});
