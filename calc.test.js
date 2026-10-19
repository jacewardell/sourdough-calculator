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

const { schedule, fmtH } = globalThis.Sourdough;

test('starter hydration changes the water split', () => {
  // Stiff 50% starter: 2/3 flour, 1/3 water. 1000 g at 75% hydration, 20% starter, 2% salt.
  const r = calc('bakers', { loafGrams: 1000, loafCount: 1, b_hydration: 75, b_starter: 20, b_salt: 2, starterHydration: 50 });
  const F = r.grams.flour, S = r.grams.starter, W = r.grams.water;
  near((W + S / 3) / (F + 2 * S / 3), 0.75);
  near(r.hydration, 0.75);
  assert.ok(W > calc('bakers', { ...bakers, loafCount: 1, b_hydration: 75, b_starter: 20 }).grams.water);
  assert.equal(calc('bakers', bakers).sh, 1);
});

test('add-ins ride on the flour and take from the water in dough mode', () => {
  const addins = [{ name: 'Seeds', pct: 10 }];
  const d = calc('dough', { ...dough, addins });
  near(d.grams.flour, 960);
  near(d.addins[0].grams, 96);
  near(d.grams.water, 788.8 - 96);
  near(d.total, 2000);
  const b = calc('bakers', { ...bakers, addins });
  near(b.bakersTotal, 2.083333333 + 0.1);
  near(b.grams.flour + b.grams.water + b.grams.starter + b.grams.salt + b.addins[0].grams, 2000);
  near(b.hydration, 0.8408921933);
});

test('blends split the flour and suggest extra hydration', () => {
  const r = calc('bakers', { ...bakers, blend: [{ type: 'bread', pct: 70 }, { type: 'ww', pct: 30 }] });
  near(r.blend[0].grams, 960 * .7);
  near(r.blend[1].grams, 960 * .3);
  near(r.blendSum, 100);
  near(r.absorb, 3);
  near(calc('bakers', bakers).absorb, 0);
});

test('converts with add-ins and starter hydration preserved', () => {
  const input = { ...dough, starterHydration: 80, addins: [{ name: 'Oil', pct: 5 }] };
  const b = convert.dough(input);
  const d = convert.bakers({ ...input, ...b });
  near(d.d_flour, 48); near(d.d_starter, 11.6); near(d.d_salt, 0.96);
});

test('schedule is ordered, warms up faster and shortens bulk before a retard', () => {
  const start = Date.UTC(2026, 0, 1, 9);
  const s = schedule({ start, autolyse: 30, retard: 12 });
  assert.deepEqual(s.steps.map(x => x.at), [...s.steps.map(x => x.at)].sort((a, b) => a - b));
  assert.equal(s.steps[0].label, 'Mix flour and water');
  assert.equal(s.steps[1].at, start + 30 * 60000);
  assert.equal(s.steps.filter(x => x.label.startsWith('Stretch')).length, 4);
  assert.equal(s.steps.at(-1).label, 'Out of the oven');
  assert.ok(schedule({ start, temp: 28 }).bulk < schedule({ start, temp: 22 }).bulk);
  assert.ok(schedule({ start, inoculation: .1 }).bulk > schedule({ start, inoculation: .3 }).bulk);
  assert.ok(schedule({ start, retard: 12 }).bulk < schedule({ start, retard: 0 }).bulk);
  near(schedule({ start, temp: 24, retard: 0 }).bulk, 5);
  assert.equal(fmtH(5.5), '5 h 30 min');
  assert.equal(fmtH(.5), '30 min');
});
