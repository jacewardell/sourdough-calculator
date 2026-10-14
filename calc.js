(() => {
  const keys = ['flour', 'water', 'starter', 'salt'];
  const common = ['loafGrams', 'loafCount'];

  const modes = {
    // Flour, starter and salt as a share of total dough. Water is the remainder.
    dough: {
      fields: ['d_flour', 'd_starter', 'd_salt'],
      run(total, { d_flour: f, d_starter: p, d_salt: s }) {
        const pct = { flour: f / 100, starter: p / 100, salt: s / 100 };
        pct.water = 1 - pct.flour - pct.starter - pct.salt;
        const grams = {}, bakers = {};
        for (const k of keys) grams[k] = total * pct[k];
        for (const k of keys) bakers[k] = grams.flour ? grams[k] / grams.flour : 0;
        return { pct, grams, bakers, valid: pct.water >= 0 && pct.flour > 0 };
      },
    },
    // Starter and salt relative to flour, plus overall hydration. Flour is solved from the total.
    //   h = (W + S/2) / (F + S/2)  =>  W = F * (h * (1 + p/2) - p/2)
    //   T = F + W + S + salt       =>  F = T / (1 + h * (1 + p/2) + p/2 + s)
    bakers: {
      fields: ['b_hydration', 'b_starter', 'b_salt'],
      run(total, { b_hydration: h, b_starter: p, b_salt: s }) {
        h /= 100; p /= 100; s /= 100;
        const bakers = { flour: 1, water: h * (1 + p / 2) - p / 2, starter: p, salt: s };
        const sum = keys.reduce((a, k) => a + bakers[k], 0);
        const flour = sum ? total / sum : 0;
        const grams = {}, pct = {};
        for (const k of keys) grams[k] = flour * bakers[k];
        for (const k of keys) pct[k] = total ? grams[k] / total : 0;
        return { pct, grams, bakers, valid: bakers.water >= 0 };
      },
    },
  };

  const hydrationOf = ({ flour, water, starter }) => flour + starter / 2 ? (water + starter / 2) / (flour + starter / 2) : 0;

  function calc(mode, input) {
    const m = modes[mode];
    const fields = [...common, ...m.fields];
    const ready = fields.every(k => Number.isFinite(input[k]));
    const total = (input.loafGrams || 0) * (input.loafCount || 0);
    const vals = Object.fromEntries(fields.map(k => [k, input[k] || 0]));
    const r = m.run(total, vals);
    const hydration = hydrationOf(r.grams);
    const bakersTotal = keys.reduce((a, k) => a + r.bakers[k], 0);
    return { ...r, total, hydration, bakersTotal, ready, valid: ready && total > 0 && r.valid };
  }

  // The two modes are two views of the same recipe; convert between them.
  const convert = {
    dough(input) {
      const r = modes.dough.run(1, input);
      return { b_hydration: hydrationOf(r.grams) * 100, b_starter: r.bakers.starter * 100, b_salt: r.bakers.salt * 100 };
    },
    bakers(input) {
      const r = modes.bakers.run(1, input);
      return { d_flour: r.pct.flour * 100, d_starter: r.pct.starter * 100, d_salt: r.pct.salt * 100 };
    },
  };

  const fields = [...common, ...modes.dough.fields, ...modes.bakers.fields];
  globalThis.Sourdough = { calc, convert, modes, fields, keys };
})();
