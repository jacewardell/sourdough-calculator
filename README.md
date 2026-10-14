# Sourdough Calculator

Scale a sourdough recipe by loaf weight and loaf count. Single static page, no build step.

Inputs are flour, starter and salt as a share of total dough weight. Water is whatever is left.
The page shows grams per ingredient (total and per loaf), baker's percentages relative to flour,
and effective hydration, which counts half the starter as flour and half as water (100% hydration starter).

## Develop

Open `index.html` in a browser. No server needed.

## Test

```sh
node --test
```
