# Sourdough Calculator

Scale a sourdough recipe by loaf weight and loaf count. Single static page, no build step.

Enter the recipe either as baker's percentages (hydration, starter and salt relative to flour) or as
dough shares (flour, starter and salt as a share of the total, water is what remains). The page shows
grams per ingredient (total and per loaf), baker's percentages, the dough composition and effective
hydration, which counts the starter's own flour and water at whatever starter hydration you set.

Also on the page:

- Presets and vessel sizes to start from, flour blends with a hydration hint for whole grains, and add-ins.
- A bake-day schedule from start time and dough temperature, with browser notifications and an .ics export.
- Saved recipes alongside the presets in one picker, a bake log view, and JSON import and export.
- Installable PWA (service worker and manifest only register when served over http).

## Develop

Open `index.html` in a browser. No server needed for the calculator itself. To test the PWA bits:

```sh
python3 -m http.server 8765
```

## Test

```sh
node --test
```
