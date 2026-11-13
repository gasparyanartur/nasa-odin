# Martian Map

Explore Mars through selectable real datasets, choose a region, and follow a planned excursion with an astronaut HUD. Gale–Bradbury connects orbital imagery and numeric terrain to route comparison and walking. Jezero offers orbital exploration around Perseverance’s landing site; local planning terrain is not prepared there.

## Try the excursion

1. On **Explore**, choose **Gale · Bradbury** or **Jezero** using a globe marker or the region list. The camera flies to the region and its details explain what is available.
2. Choose **MOLA · Global relief** or **CTX · Orbital imagery** in **Global basemap**. Change visibility and opacity without moving the camera. Advanced JSON import remains available.
3. In Gale, select regional imagery, elevation and slope overlays independently. Their legends and opacity controls apply only to the outlined 2 × 2 km prepared footprint. Historical REMS/RAD observations appear as site context.
4. Select **Plan excursion** in Gale. Place a habitat/start and destination, or use the prepared example. Layer settings carry over from Explore.
5. Set the mission assumptions and **Compare routes**. Choose the shortest permitted path or a gentler-terrain alternative. Both include a separately calculated return estimate.
6. Select **Walk selected route**, click the terrain, and use **WASD** and the mouse. **Esc** pauses the mission clock and releases the pointer. **Simulation pace** accelerates movement and mission time together for demonstrations.
7. Return to Explore to inspect the same region and layers. Selecting a different region clears the previous excursion; Jezero clearly indicates that planning and walking are unavailable.

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

Open [the local application](http://127.0.0.1:5173). To keep another checkout running, start this workspace on separate ports:

```bash
API_PORT=8200 WEB_PORT=5273 npm run dev:all
```

Then open [the separate workspace](http://127.0.0.1:5273). One command starts Vite and the local Python planner API on port 8100. Keep both running while using the application. `npm run dev` alone starts only the frontend.

For a production preview:

```bash
npm run build
npm run demo
```

Open [the production preview](http://127.0.0.1:4173). Global imagery needs internet access; prepared Gale imagery, terrain and environmental observations are bundled locally. No Cesium ion account is needed. A static-only deployment cannot compute routes: host the Python API and proxy `/api` to it, as the local setup does.

## Deploy the public demo

The Docker image serves the frontend, prepared local assets and FastAPI planner from one origin. It does not download or regenerate terrain at startup.

```bash
docker build -t martian-map:explore .
docker run --rm -p 127.0.0.1:8373:10000 martian-map:explore
```

Open [the container demo](http://127.0.0.1:8373). `GET /api/health` reports the terrain dataset/version. Missing files and unknown API routes return 404s.

For Render, sign in with GitHub, connect this repository and select the `codex/integrated-explore` branch. Create a **Blueprint** from `render.yaml`, or create a **Docker Web Service** on the Free plan with health check `/api/health`. No database, account system, API secret or custom domain is required. Prepared Gale assets are bundled; global MOLA/CTX tiles still require external network access. Free services can take about a minute to start after inactivity. See [deployment and release instructions](docs/release.md).

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

The browser suite starts the same-origin production server on port 8273. It checks region discovery, shared layers, region switching and recovery, real global layer replacement, and Gale routes, manual walking/HUD, pause, reset, exclusions and planner failure. Screenshots are saved under `test-results/`. The global-layer check requires internet access and WebGL.
