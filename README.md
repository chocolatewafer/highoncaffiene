# Sparsh Nidhi — portfolio

A scroll-driven 3D portfolio built around an espresso machine.

## Run it

```
npm install
npm run dev        # http://localhost:5173  (add ?dev to skip the loader)
npm run build      # static site in dist/
npm run preview    # serve dist/ at http://localhost:4173
npm run model      # rebuild public/models/machine.glb from blender/machine.py (Blender at D:\Software\Blender)
```

`dist/` uses relative paths, so it works on GitHub Pages, a sub-folder or any static host.

## Where things live

| What | File |
| --- | --- |
| Espresso machine model (Blender script) | `blender/machine.py` → `public/models/machine.glb` |
| 3D scene: lights, camera path, pour, steam, film look | `src/scene.js` |
| Canvas-made textures (wood, wall, gauges, crema) | `src/textures.js` |
| Page logic: loader, scroll story, sections, cursor | `src/main.js` |
| CV text: roles, projects, fallback repo list | `src/data.js` |
| Line-art drawings on the work cards | `src/art.js` |
| Made-up café sound (no audio files) | `src/sound.js` |
| The six coffee-maker pages in the Brew Lab | `public/lab/` |
| Café still frame (Higgsfield, Soul Cinema) | `public/img/cafe.jpg` |

To change the scroll story, edit the `data-a` / `data-b` ranges on each `.beat` in `index.html` and the matching `KEYS` camera stops in `src/scene.js`.

## Hosting

Live at **https://highoncaffiene.com**, served by GitHub Pages from this repo.
Every push to `main` rebuilds and publishes the site (see `.github/workflows/pages.yml`) in about a minute.
`public/CNAME` tells GitHub which domain to use. The DNS records are at Hostinger: four `A` records for `@` that point to GitHub, and a `www` record that points to `chocolatewafer.github.io`.
