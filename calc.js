(() => {
  const keys = ['flour', 'water', 'starter', 'salt'];
  const common = ['loafGrams', 'loafCount'];

  // Rough extra hydration (percentage points at 100% share) that each flour wants over bread flour.
  const flours = {
    bread: { name: 'Bread flour', absorb: 0 },
    ap: { name: 'All-purpose', absorb: 0 },
    ww: { name: 'Whole wheat', absorb: 10 },
    rye: { name: 'Rye', absorb: 15 },
    spelt: { name: 'Spelt', absorb: 5 },
    semolina: { name: 'Semolina', absorb: 5 },
    other: { name: 'Other', absorb: 0 },
  };

  // Share of a starter that is water, given its hydration (1 = 100%).
  const wet = sh => sh / (1 + sh);
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  const addinShare = addins => sum(addins, x => x.pct) / 100;

  const modes = {
    // Flour, starter and salt as a share of total dough. Add-ins ride on the flour. Water is the remainder.
    dough: {
      fields: ['d_flour', 'd_starter', 'd_salt'],
      run(total, { d_flour: f, d_starter: p, d_salt: s }, { addins }) {
        const pct = { flour: f / 100, starter: p / 100, salt: s / 100 };
        pct.water = 1 - pct.flour * (1 + addinShare(addins)) - pct.starter - pct.salt;
        const grams = {}, bakers = {};
        for (const k of keys) grams[k] = total * pct[k];
        for (const k of keys) bakers[k] = grams.flour ? grams[k] / grams.flour : 0;
        return { pct, grams, bakers, valid: pct.water >= 0 && pct.flour > 0 };
      },
    },
    // Starter and salt relative to flour, plus overall hydration. Flour is solved from the total.
    // With a = water share of the starter and S = pF:
    //   h = (W + aS) / (F + (1-a)S)  =>  W = F * (h * (1 + (1-a)p) - a p)
    bakers: {
      fields: ['b_hydration', 'b_starter', 'b_salt'],
      run(total, { b_hydration: h, b_starter: p, b_salt: s }, { sh, addins }) {
        h /= 100; p /= 100; s /= 100;
        const a = wet(sh);
        const bakers = { flour: 1, water: h * (1 + (1 - a) * p) - a * p, starter: p, salt: s };
        const parts = sum(keys, k => bakers[k]) + addinShare(addins);
        const flour = parts ? total / parts : 0;
        const grams = {}, pct = {};
        for (const k of keys) grams[k] = flour * bakers[k];
        for (const k of keys) pct[k] = total ? grams[k] / total : 0;
        return { pct, grams, bakers, valid: bakers.water >= 0 };
      },
    },
  };

  const hydrationOf = ({ flour, water, starter }, sh = 1) => {
    const a = wet(sh);
    const f = flour + (1 - a) * starter;
    return f ? (water + a * starter) / f : 0;
  };

  const clean = xs => (xs || []).filter(x => Number.isFinite(x.pct) && x.pct > 0);
  const ctxOf = input => ({
    sh: Number.isFinite(input.starterHydration) && input.starterHydration > 0 ? input.starterHydration / 100 : 1,
    addins: clean(input.addins),
    blend: clean(input.blend),
  });
  const valsOf = (mode, input) => Object.fromEntries(modes[mode].fields.map(k => [k, input[k] || 0]));

  function calc(mode, input) {
    const m = modes[mode];
    const ctx = ctxOf(input);
    const ready = [...common, ...m.fields].every(k => Number.isFinite(input[k]));
    const total = (input.loafGrams || 0) * (input.loafCount || 0);
    const r = m.run(total, valsOf(mode, input), ctx);
    const addins = ctx.addins.map(x => ({ name: x.name, bakers: x.pct / 100, grams: r.grams.flour * x.pct / 100, pct: total ? r.pct.flour * x.pct / 100 : 0 }));
    const blend = ctx.blend.map(x => ({ type: x.type, share: x.pct / 100, grams: r.grams.flour * x.pct / 100 }));
    const blendSum = sum(ctx.blend, x => x.pct);
    const absorb = sum(ctx.blend, x => (flours[x.type]?.absorb || 0) * x.pct / 100);
    const hydration = hydrationOf(r.grams, ctx.sh);
    const bakersTotal = sum(keys, k => r.bakers[k]) + addinShare(ctx.addins);
    return { ...r, addins, blend, blendSum, absorb, total, hydration, bakersTotal, sh: ctx.sh, ready, valid: ready && total > 0 && r.valid };
  }

  // The two modes are two views of the same recipe; convert between them.
  const convert = {
    dough(input) {
      const ctx = ctxOf(input);
      const r = modes.dough.run(1, valsOf('dough', input), ctx);
      return { b_hydration: hydrationOf(r.grams, ctx.sh) * 100, b_starter: r.bakers.starter * 100, b_salt: r.bakers.salt * 100 };
    },
    bakers(input) {
      const r = modes.bakers.run(1, valsOf('bakers', input), ctxOf(input));
      return { d_flour: r.pct.flour * 100, d_starter: r.pct.starter * 100, d_salt: r.pct.salt * 100 };
    },
  };

  // Bake-day timeline. start is a timestamp; temp in C; inoculation is starter as a fraction of flour.
  function schedule({ start, temp = 24, inoculation = .2, autolyse = 0, folds = 4, foldEvery = 30, retard = 12, bench = 25, preheat = 45, bake = 45 }) {
    const rate = 2 ** ((temp - 24) / 8) * Math.sqrt(Math.max(inoculation, .02) / .2);
    const bulk = Math.min(16, Math.max(2, 5 / rate)) * (retard ? .85 : 1);
    const proof = Math.min(4, Math.max(1, 2 / rate));
    const MIN = 60000, H = 60 * MIN;
    const steps = [];
    let at = start;
    if (autolyse) { steps.push({ at, label: 'Mix flour and water', detail: `Rest ${autolyse} min` }); at += autolyse * MIN; }
    steps.push({ at, label: autolyse ? 'Add starter and salt' : 'Mix the dough', detail: `Bulk ferment about ${fmtH(bulk)}` });
    const bulkStart = at;
    for (let i = 1; i <= folds; i++) {
      const t = i * foldEvery * MIN;
      if (t < bulk * H) steps.push({ at: bulkStart + t, label: `Stretch and fold ${i} of ${folds}` });
    }
    at = bulkStart + bulk * H;
    steps.push({ at, label: 'Pre-shape', detail: `Bench rest ${bench} min` });
    at += bench * MIN;
    steps.push({ at, label: 'Shape', detail: retard ? `Cold retard ${fmtH(retard)}` : `Final proof about ${fmtH(proof)}` });
    at += (retard || proof) * H;
    steps.push({ at: at - preheat * MIN, label: 'Preheat the oven', detail: 'Dutch oven inside' });
    steps.push({ at, label: 'Bake', detail: `${bake} min, lid off halfway` });
    at += bake * MIN;
    steps.push({ at, label: 'Out of the oven', detail: 'Cool at least 1 h before slicing' });
    steps.sort((a, b) => a.at - b.at);
    return { steps, bulk, proof, end: at };
  }

  function fmtH(h) {
    const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
    return hh ? (mm ? `${hh} h ${mm} min` : `${hh} h`) : `${mm} min`;
  }

  const fields = [...common, ...modes.dough.fields, ...modes.bakers.fields];
  globalThis.Sourdough = { calc, convert, schedule, fmtH, flours, modes, fields, keys };
})();
