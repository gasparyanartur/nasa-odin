# Martian Map

Explore Mars, plan a local excursion, and follow it on foot with an astronaut HUD. The prototype connects a global globe to a real 2 × 2 km terrain patch around Curiosity's Bradbury landing area in Gale crater.

## Try the excursion

1. Open **Explore** to rotate the globe, replace its imagery dataset, or fly to Gale.
2. Open **Plan excursion**. Inspect the orbital imagery, slope and elevation. Place a habitat/start and destination, or use the prepared example.
3. Set the mission assumptions and **Compare routes**. Choose the shortest permitted path or a gentler-terrain alternative. Both include a separately calculated return estimate.
4. Select **Walk selected route**, click the terrain, and use **WASD** and the mouse. **Esc** pauses the mission clock and releases the pointer. The optional **Simulation pace** control accelerates movement and mission time together for demonstrations.
5. Follow the HUD's minimap and waypoints. Return estimates update as you move. Reset the excursion to start again.

The optional exclusion tool marks user-declared 40 m restricted areas. These are not measurements of actual hazards. The habitat is a demonstration location, not a real structure on Mars.

## Run locally

Use Node 22.23.4 (`.nvmrc`) and Python 3.12 or newer. From the repository root:

```bash
nvm use
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run dev:all
```

Open [the local application](http://127.0.0.1:5173). One command starts Vite and the local Python planner API on port 8100. Keep both running while using the application. `npm run dev` alone starts only the frontend.

For a production preview:

```bash
npm run build
npm run demo
```

Open [the production preview](http://127.0.0.1:4173). Global imagery needs internet access; prepared Gale imagery, terrain and environmental observations are bundled locally. No Cesium ion account is needed. A static-only deployment cannot compute routes: host the Python API and proxy `/api` to it, as the local setup does.

## What the data represents

The local package contains actual USGS Gale DEM/orthoimage crops and historical Curiosity REMS/RAD observations. The 5 m grid is derived from a source DEM with 1 m posts; coarser source material and unresolved hazards remain limitations. Source labels, references, processing and checksums are included in [the manifest](public/gale/manifest.json).

- **Terrain:** numeric elevations, conservative slopes and validity masks drive planning and walking. Globe relief is relative to the patch minimum, not a planetary areoid-to-ellipsoid conversion. Absolute source elevations are reported separately.
- **Weather:** hourly Sol 10 REMS medians with selected reliability flags applied. Missing wind remains missing. Mission wind is an editable assumption, initially zero when no observation is available.
- **Radiation:** the mean observed RAD detector E rate supplies an editable, spatially uniform dose proxy. It is absorbed detector dose, not astronaut dose equivalent. No suit or terrain shielding is inferred.
- **Resources:** walking speed, slope, time, temperature, wind and dose limits are demonstration settings. Duration uses a slope-dependent speed proxy. Budgets are checked after optimization; the planner does not guarantee a resource-constrained optimum.

Only the prepared area supports routing and walking. There is no live Mars weather, real astronaut localization, physiological oxygen model or operational safety validation. Scene lighting and surface color are illustrative; geometry and overhead texture come from data.

See [Gale data and assumptions](docs/gale-data.md), [dataset integration](docs/datasets.md), and [the prototype plan](docs/plans/2026-11-13-gale-prototype.md).

## Reproduce the data package

Prepared files are included, so the normal demo does not download multi-gigabyte mosaics. To regenerate them:

```bash
npm run prepare:data
```

This uses HTTP range requests against USGS rasters and downloads PDS environmental products. It can take several minutes and needs network access. Source records are cached under the repository's `tmp/`. It fails if usable data or verified radiation units are unavailable; it does not generate replacement terrain.

## Verification

```bash
npm test
npm run test:api
npm run build
```

For browser checks, install local Chromium once and then run:

```bash
mkdir -p tmp/browser
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npx playwright install chromium
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npm run test:browser
```

The browser suite starts the production frontend and API, checks real global layer replacement and recovery, then exercises Gale layers, routes, manual walking/HUD, pause, reset, exclusions and planner failure. Screenshots are saved under `test-results/`. The global-layer check requires internet access and WebGL.
