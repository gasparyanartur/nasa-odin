# Martian Map

Explore Mars through selectable real datasets, inspect geological evidence, choose a science destination, and follow a planned excursion with an astronaut HUD. Gale–Bradbury connects orbital imagery and numeric terrain to route comparison and walking. Jezero offers orbital exploration around Perseverance’s landing site; local planning terrain is not prepared there.

**Run it on your computer:** [Run locally](#run-locally) has every step, from installing Git, Node.js and Python to opening the Martian Map app and the combined app in `hypersimulation-prototype/`.

Version **0.7** integrates the detailed Fable Boxwork surface into the same Station → Tablet → HUD workflow. Select **Gale · Mount Sharp Boxwork** at Station, or open [the Boxwork example](http://127.0.0.1:5173/?demo=boxwork). Compare routes, choose colour/greyscale imagery, walk manually and log site-linked field records. Boxwork has its own terrain, Sol 4600 historical scenario and rover evidence; Bradbury/Yellowknife and the environmental explorer remain available. See [coverage, coordinates, licences and data recovery](docs/boxwork-data.md).

## Try the excursion

Choose **Start guided Gale example** at Station, or open [the prepared Yellowknife Bay example](http://127.0.0.1:5173/?demo=yellowknife). It opens the astronaut Tablet with a source-backed science destination and demonstration assumptions. Inspect evidence, compare routes and enter the HUD. **Continue free exploration** keeps your setup; **Reset guided example** restores it.

Version **0.6** adds **Station → Data & history → Environmental explorer**: inspect global Odyssey GRS potassium/thorium composition and water-equivalent hydrogen, dated MCS surface-temperature soundings, and 19 sols of Curiosity temperature/radiation records. Compare observed values with an explicitly simulated Sol 29 daily-profile outlook and its held-out errors. Select layers on the atlas or Tablet; inspect source, scale, timestamps and uncertainty. **Use snapshot as fixed mission assumptions** explicitly applies an available Gale reading/forecast without changing the mission clock. Composition is separate from radiation dose, and sparse observations remain unknown. See [environmental data, model and validation](docs/environment-data.md).

Version **0.5** adds a personal field layer on **Tablet → Field data** in the prepared Gale area:

- Create geological notes, draw unit polygons/contact lines, declare circular obstacles, or record point temperature (K) and detector dose-rate (µGy/h) readings. Pick/draw on the map, enter local coordinates, or use **Log here** on the HUD to capture the astronaut's simulated position and mission time.
- Save, inspect, edit, hide, delete and undo records. The map and HUD share markers and terrain-following boundaries; press Esc, then select a projected field marker to inspect its source, observation UTC, uncertainty, geometry and simulated context.
- Enable **Restrict routes and walking** on an obstacle to use its 5–500 m radius in outbound/return planning and swept movement checks. Restrictions clear stale routes while retaining position/time; **Compare routes** computes updated alternatives from the configured endpoints. Hiding an annotation leaves an enabled restriction enforced and its boundary visible. Disable or move a restriction surrounding the astronaut to move again.
- Saved records persist in this browser and survive view/region switches. Export **Mars GeoJSON v1** for a backup or transfer; import merges matching IDs and is undoable. Ordinary Earth GeoJSON is rejected. Undo retains the last 20 layer edits for the session; unfinished drafts are not persisted on reload. If browser storage fails, records remain in memory with an export warning. Malformed saved files are preserved until you explicitly replace them.

Geology and readings are user interpretations/point observations, separate from published source layers. Readings do not change the historical scenario or surrounding cells; no terrain, radiation field or forecast is inferred. Only enabled circular obstacles affect planning/movement. Up to 100 records, 100 vertices per geometry and 30 combined manual/field restrictions are supported. Field data is currently unavailable at Jezero. See [field-data effects, recovery and transfer format](docs/field-data.md).

The application is a **laptop simulation operated with mouse and keyboard**. Station, Tablet and HUD are the astronaut’s interfaces inside that simulation. **Tablet means the simulated astronaut’s device, not a physical tablet or a touch-first device target.**

The redesigned interface provides:

- **Station:** choose a region on the globe or in the site list. **Enter surface** starts free exploration on either prepared Gale site without planning a route. **Open tablet** opens the astronaut’s local workspace. **Datasets & map layers** holds basemaps, geology and environmental layers; **Data & history** holds analysis. Jezero supports orbital exploration only.
- **Tablet:** a flat device overlay above the paused surface. **Map** provides local inspection; **Routes** provides habitat-to-destination comparisons and linked terrain profiles; **Field data** provides saved observations and editing; **Display** configures visor, waypoint selections, minimap, clocks, graphics and simulation pace. Open **Layers** or **Inspect data** when needed. Primary actions remain in the fixed footer, while detailed panels scroll independently.
- **HUD / Surface:** click the terrain, use WASD or arrow keys to walk, and move the mouse to look. Esc pauses and releases the mouse. **Open tablet** pauses the mission and retains position, heading, pitch, elapsed time and unfinished field drafts. **Close tablet** or **Return to surface** restores the surface; click terrain to resume. **Log here** records your simulated position. **Pause / menu** provides display settings, Station and an explicit restart.

Free exploration retains habitat navigation, independent return estimates, terrain limits and declared restrictions. A route adds guidance, next-waypoint cues and route-progress warnings. A failed return estimate does not prevent walking; use **Retry return estimate** to try again. Route comparisons still start at the habitat, even after you have walked elsewhere. Choosing a target, comparing/adopting a route, and changing ordinary assumptions or display settings preserve position/time. Placing a new habitat or changing departure restarts the excursion; selecting another region starts a separate setup. Current-position replanning is separate future work.

Maps support drag, mouse-wheel zoom, click inspection/placement and keyboard controls (arrows to pan, +/− to zoom, Home to reset, Enter to inspect the center). Existing touch gestures remain available. Selected waypoint labels project through the actual camera; they are navigation coordinates, not confirmed visible outcrops or terrain-occlusion indicators. Mars LMST is simulated site time; **Live Earth UTC** is the current real-world date/time. Each clock can be hidden without changing time. Terrain and imagery provenance remain available under **Inspect data**.

The redesign implements FR-023/024/025/027. See the [design and verification plan](docs/plans/2026-11-15-ui-redesign.md) for acceptance evidence and remaining usability validation.

Version **0.3** adds a geological science workflow:

- **Geological context:** selectable USGS units and contacts around Gale and Jezero, with the original unit identifiers, descriptions, palette, legend and contact classification. Use **View geological context** at Station to frame the regional map. Click a mapped unit/contact or select it from the legend to inspect it. The local planner shows only the map’s actual intersection with its prepared patch.
- **Science destinations:** compare Rocknest’s windblown material with the Yellowknife Bay entry area’s sedimentary setting. Each target includes NASA geological evidence, a published rover waypoint, visit sol, uncertainties and a destination action. R/Y markers on the local map also select the targets. These locate visit areas, not precise scoop/drill sites.
- **Route explanations:** elevation and terrain-slope profiles use per-edge planner data. Scrub the profile or distance slider to highlight the corresponding map segment and inspect its grade, elevation, slope and duration. Read computed differences, cost contributions and active constraints; a gentler objective does not guarantee a lower maximum slope.
- **Data inspection:** choose imagery, terrain, geology, temperature, radiation or assumptions in **What this data can tell you**. Each shows source/product, quantity, time, coverage, scale/resolution, uncertainty and its effect on planning.

The geology is regional context at **1:20,000,000**, with clipped coverage around the two regions; it is too coarse to identify a local outcrop or derive walking hazards. The two targets share the same broad global-map unit. Their distinct scientific questions come from mission observations, not an invented local geological boundary. Rover visits are Sol 56/125; the Sol 10 weather replay is a separate scenario. These products remain useful offline once the app is loaded; global basemap tiles still need internet access.

Version **0.2** added Viking color imagery and a warmer surface/sky, an optional visor compass and waypoint cue, three drawing-resolution presets, a Sol 10 historical replay, and conditions-aware candidate/departure comparisons.

Station’s historical timeline lets you play, pause or scrub 24 hourly REMS medians. Scrubbing clears the previous plan. Planning pauses replay and uses its selected departure time; the HUD advances LMST from that departure as mission seconds pass. Playback stops at the end of the recorded sol. Hourly values are held within each bin; gaps and times after Sol 10 remain unknown. Scene lighting is illustrative and does not follow the timeline.

Use **Conditions → Historical Sol 10** to evaluate temperature along the outbound trip, optional destination stop and return, or choose **Manual fixed scenario**. In **Compare departure hours**, inspect the same excursion at each of 24 departure times, select a time and compare routes again. Green means within your configured demonstration limits; amber means unknown coverage; orange means a limit is exceeded. This evaluates two terrain candidates, rather than searching for an environmental optimum. Missing observations cannot establish feasibility.

**Graphics** controls drawing pixels: Low uses 65% of native resolution (density capped at 1), Medium native resolution (cap 1), and High the device density (cap 2). All retain the same measured terrain, texture, routing and collision data. The visor provides navigation cues from simulated position; it does not add physiological measurements.

The optional Explore exclusion tool marks user-declared 40 m restricted areas; **Clear exclusions** removes these manual circles. Edit or disable field-layer restrictions in Field data. These are not measurements of actual hazards. The habitat is a demonstration location, not a real structure on Mars.

## Run locally

The repository holds two separate apps:

- **Martian Map** (repository root): the Station, Tablet and HUD app described above. It needs Git, Node.js and Python.
- **Combined app** (`hypersimulation-prototype/`): this Station, Tablet and HUD app with the combined design system, the quiet HUD and the Marswalk content (walk presets, science stops, hazard areas, the prepared science walk, the storm scenario). It uses the same setup as Martian Map. It replaces the old static Marswalk app, which remains in git history at commit 66ee212. See [its README](hypersimulation-prototype/README.md).

These steps assume a computer with none of these tools installed. Skip any step you have already done.

### Step 1: Install Git, Node.js and Python (once per computer)

npm, the command that installs and runs Martian Map, comes with Node.js. It is not a separate download.

**Windows**

1. **Git:** download the installer from [git-scm.com/downloads/win](https://git-scm.com/downloads/win), run it and keep every default option.
2. **Node.js and npm:** download the **LTS** Windows installer from [nodejs.org](https://nodejs.org/en/download), run it and keep the default options. You don't need the optional "Tools for Native Modules".
3. **Python:** download the latest Python 3 installer from [python.org/downloads](https://www.python.org/downloads/). On the installer's first screen, tick **Add python.exe to PATH**, then click **Install Now**. If that box is not ticked, the `python` command won't work.
4. Open PowerShell: press the Windows key, type `PowerShell` and press Enter. If PowerShell was already open, close it and open a new window, because only new windows find newly installed programs.
5. Check that each of these commands prints a version number:

   ```powershell
   git --version
   node --version
   npm --version
   python --version
   ```

   - If `npm` fails with "running scripts is disabled on this system", run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer `Y`, and try again.
   - If `python` opens the Microsoft Store or prints nothing, Python is not on PATH. Uninstall Python, then install it again with **Add python.exe to PATH** ticked.

**macOS**

1. Open Terminal: press Cmd+Space, type `Terminal` and press Enter.
2. **Git:** run `git --version`. If Git is missing, macOS offers to install the command line developer tools. Click **Install**, wait for it to finish, then run `git --version` again.
3. **Node.js and npm:** download the **LTS** macOS installer from [nodejs.org](https://nodejs.org/en/download) and run it.
4. **Python:** download the latest Python 3 macOS installer from [python.org/downloads](https://www.python.org/downloads/) and run it.
5. Close Terminal, open a new one, and check that each of these commands prints a version number:

   ```bash
   git --version
   node --version
   npm --version
   python3 --version
   ```

**Linux:** install Git, Node.js 22.17 or newer (from [nodejs.org](https://nodejs.org/en/download) or your distribution) and Python 3.12 or newer with its `venv` module. On Debian or Ubuntu, `sudo apt install git python3 python3-venv` covers Git and Python.

Martian Map needs Node.js 22.17 or newer and Python 3.12 or newer. The LTS Node.js and latest Python offered on those sites are new enough.

### Step 2: Get access to the repository (once)

1. If you don't have a GitHub account, create a free one at [github.com](https://github.com/signup).
2. The repository is private. Send your GitHub username to the repository owner, `gasparyanartur`, and ask to be added as a collaborator.
3. GitHub emails you an invitation. Open it and click **Accept invitation**. The invitation is also at [github.com/gasparyanartur/nasa-martian-map/invitations](https://github.com/gasparyanartur/nasa-martian-map/invitations) once it has been sent.

### Step 3: Download the code (once)

In PowerShell (Windows) or Terminal (macOS/Linux), run:

```bash
git clone -c core.autocrlf=input https://github.com/gasparyanartur/nasa-martian-map.git
cd nasa-martian-map
```

This creates a `nasa-martian-map` folder inside the folder your terminal is in, which is your user folder unless you `cd` somewhere else first.

The first time, Git asks you to sign in to GitHub:

- **Windows:** a sign-in window opens. Choose **Sign in with your browser** and approve the request on GitHub. Git remembers this.
- **macOS and Linux:** Git asks for a username and a password. Enter your GitHub username. GitHub does not accept your account password here, so create a token instead: go to [github.com/settings/tokens](https://github.com/settings/tokens), choose **Generate new token (classic)**, tick **repo**, click **Generate token**, and paste the token as the password. Nothing appears while you paste; press Enter.

Keep `-c core.autocrlf=input`. By default, Git on Windows converts line endings, which changes file sizes. Both apps reject any terrain data file that isn't the expected size. On macOS and Linux the option changes nothing. If you already cloned on Windows without it, delete the folder and clone again.

To get your teammates' latest changes later, run `git pull` inside the `nasa-martian-map` folder. The default branch is `master`. To switch to another branch, run `git switch <branch-name>`, for example `git switch hypersimulation-prototype`.

### Step 4: Set up Martian Map (once)

From inside the `nasa-martian-map` folder:

Windows (PowerShell):

```powershell
npm ci
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS / Linux:

```bash
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

`npm ci` installs the website's packages into `node_modules/`. The next two lines create a Python environment for this project in `.venv/` and install the route planner's packages into it. Each step can take a few minutes. If you use nvm, run `nvm use` first to switch to the Node.js version in `.nvmrc`.

Run this step again after a `git pull` that changes `package-lock.json` or a `requirements*.txt` file. The combined app uses this same setup.

### Step 5: Run Martian Map

Open a terminal in the folder where you cloned the repository and run:

```bash
cd nasa-martian-map
npm run dev:all
```

Open [the local application](http://127.0.0.1:5173) in your browser. This one command starts Vite and the local Python planner API on port 8100. Keep the terminal open while you use the application. `npm run dev` alone starts only the frontend, so route comparison and return estimates fail; prepared-terrain free exploration remains available.

To keep another checkout running, start this workspace on separate ports:

```bash
API_PORT=8200 WEB_PORT=5273 npm run dev:all
```

In PowerShell, run `$env:API_PORT=8200; $env:WEB_PORT=5273; npm run dev:all` instead. Then open [the separate workspace](http://127.0.0.1:5273).

On Windows, `npm run test:api` and the `prepare:*` scripts still call `.venv/bin/python`. Run their commands from `package.json` directly, using `.venv\Scripts\python.exe` in its place.

For a production preview:

```bash
npm run build
npm run demo
```

Open [the production preview](http://127.0.0.1:4173). Global imagery needs internet access; prepared Gale imagery, terrain and environmental observations are bundled locally. No Cesium ion account is needed. A static-only deployment cannot compute routes: host the Python API and proxy `/api` to it, as the local setup does.

After updating the project, stop the running preview, rebuild, and start `npm run demo` again so the frontend and Python planner use the same version. Refreshing the browser alone does not restart the planner. If it rejects a terrain dataset or an unfamiliar setting, the Tablet now shows the rejected field and a restart hint.

### Step 6: Run the combined app (hypersimulation-prototype/)

Open a terminal in the folder where you cloned the repository and run:

```bash
cd nasa-martian-map/hypersimulation-prototype
npm run dev:all
```

Open [the combined app](http://127.0.0.1:5174) in your browser. It starts its own Vite on port 5174 and its own planner API on port 8101. It needs no `npm install` of its own: it uses the root `node_modules/` and the root `.venv/` from Step 4, unless that folder has its own `.venv/`. [hypersimulation-prototype/README.md](hypersimulation-prototype/README.md) has more detail, including its known limits.

### Run both at once, and stop them

Each app keeps running in its own terminal. To run both, open two terminals: run Step 5 in the first and Step 6 in the second. They use different ports (5173 with 8100, and 5174 with 8101), so both can stay open. To stop an app, click its terminal and press Ctrl+C, or close that terminal.

## Deploy the public demo

The Docker image serves the frontend, prepared local assets and FastAPI planner from one origin. It does not download or regenerate terrain at startup.

```bash
docker build -t martian-map:explore .
docker run --rm -p 127.0.0.1:8373:10000 martian-map:explore
```

Open [the container demo](http://127.0.0.1:8373). `GET /api/health` reports the terrain dataset/version. Missing files and unknown API routes return 404s.

For Render, sign in with GitHub, connect this repository and select the `codex/integrated-explore` branch. Create a **Blueprint** from `render.yaml`, or create a **Docker Web Service** on the Free plan with health check `/api/health`. No database, account system, API secret or custom domain is required. Prepared Gale assets are bundled; global Viking/MOLA/CTX tiles still require external network access. Free services can take about a minute to start after inactivity. See [deployment and release instructions](docs/release.md).

## What the data represents

The local package contains actual USGS Gale DEM/orthoimage crops and historical Curiosity REMS/RAD observations. The 5 m grid is derived from a source DEM with 1 m posts; coarser source material and unresolved hazards remain limitations. Source labels, references, processing and checksums are included in [the manifest](public/gale/manifest.json).

- **Terrain:** numeric elevations, conservative slopes and validity masks drive planning and walking. Globe relief is relative to the patch minimum, not a planetary areoid-to-ellipsoid conversion. Absolute source elevations are reported separately.
- **Weather:** hourly Sol 10 REMS medians with selected reliability flags applied. Missing wind remains missing. Mission wind is an editable assumption, initially zero when no observation is available.
- **Radiation:** the mean observed RAD detector E rate supplies an editable, spatially uniform dose proxy. It is absorbed detector dose, not astronaut dose equivalent. No suit or terrain shielding is inferred.
- **Resources:** walking speed, slope, time, temperature, wind and dose limits are demonstration settings. Duration uses a slope-dependent speed proxy. Historical temperatures are evaluated across the complete round trip and optional stop. Dose includes the stop, remains proportional to elapsed time, and does not vary by departure. Limits guide the candidate recommendation after terrain search; the planner does not guarantee a resource-constrained optimum.

Only the prepared area supports routing and walking. There is no live Mars weather, real astronaut localization, physiological oxygen model or operational safety validation. Scene lighting and surface color are illustrative; geometry and overhead texture come from data.

See [science data and geological evidence](docs/science-data.md), [Gale data and assumptions](docs/gale-data.md), [dataset integration](docs/datasets.md), and [the prototype plan](docs/plans/2026-11-13-gale-prototype.md).

Preliminary feature ideas and open requests live in the [feature backlog](docs/backlog.md).

## Reproduce the data package

Prepared files are included, so the normal demo does not download multi-gigabyte mosaics. To regenerate them:

```bash
npm run prepare:data
# Optional: regenerate the bounded USGS geology and NASA visit-area package
npm run prepare:science
# Optional: regenerate numeric environmental maps, multi-sol history and forecasts
npm run prepare:environment
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

The UI redesign browser suite checks route-free entry, retained pose/time/drafts, route adoption, return failure/retry, modal keyboard access, unsupported/loading states and bounded laptop layouts. The broader browser suite also checks the guided/direct science example, geology/target state, profile/map linkage, provenance and region isolation, plus bounded historical replay, departure-dependent warnings, scrubbing invalidation, stationary mission-clock/return updates, visor controls and drawing resolution changes without position resets. The browser suite starts the same-origin production server on port 8273. It checks region discovery, shared layers, region switching and recovery, real global layer replacement, and Gale routes, manual walking/HUD, pause, reset, exclusions and planner failure. Screenshots are saved under `test-results/`. The global-layer check requires internet access and WebGL.
