(() => {
  const defaults = { loafGrams: 1000, loafCount: 2, starterPct: 11.6, flourPct: 48, saltPct: 0.96 };

  const keys = ['flour', 'water', 'starter', 'salt'];

  function calc({ loafGrams, loafCount, starterPct, flourPct, saltPct }) {
    const total = loafGrams * loafCount;
    const pct = { starter: starterPct / 100, flour: flourPct / 100, salt: saltPct / 100 };
    pct.water = 1 - pct.starter - pct.flour - pct.salt;
    const grams = {}, bakers = {};
    for (const k of keys) grams[k] = total * pct[k];
    for (const k of keys) bakers[k] = grams.flour ? grams[k] / grams.flour : 0;
    const half = grams.starter / 2;
    const hydration = grams.flour + half ? (grams.water + half) / (grams.flour + half) : 0;
    const bakersTotal = keys.reduce((s, k) => s + bakers[k], 0);
    const valid = pct.water >= 0 && pct.flour > 0 && total > 0;
    return { total, pct, grams, bakers, hydration, bakersTotal, valid };
  }

  globalThis.Sourdough = { calc, defaults, keys };
})();
