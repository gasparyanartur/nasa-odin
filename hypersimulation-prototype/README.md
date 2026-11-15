# hypersimulation-prototype: the combined app

This folder holds the combined app: the team app's Station, Tablet and HUD with the combined design system, the quiet HUD and the Marswalk content. The Marswalk content is the walk presets, the science stops with their tasks, the hazard areas with a legend, the prepared science walk, the solar storm scenario, the suit limits, saved walks, the sharp imagery and a ground panorama. It was built from the team review call of 2026-11-15, as a full copy of branch `design/exhibit-system-team-feedback`.

The team app in the repository root stays as it is. The two apps sit side by side and can run at the same time.

**It replaces the old static Marswalk app.** That app was in this folder before; it remains in git history at commit 66ee212 (`git show 66ee212:hypersimulation-prototype/README.md`, or `git worktree add ../marswalk-old 66ee212` from the repository root for the full folder).

**`app/` is not part of this app.** `app/public/data/` with `app/DATA-LICENSE.md`, `app/LICENSE` and `app/sources.json` is the donor data of the old app, kept at its old path. The root app's `npm run prepare:boxwork` (`scripts/prepare_boxwork.py`) rebuilds `public/boxwork/` from it, and `docs/evidence/hyper-integration/source-inventory.json` lists its hashes. Do not move or edit these files. Their licence and credit are in `app/DATA-LICENSE.md`.

## What it adds to the team app

The three places stay the same: Station, Tablet and HUD. The [Marswalk parts](#marswalk-parts-branch-designexhibit-system-team-feedback) section below says what each place shows.

- **Station:** after you pick a prepared region, step **02 / Choose your task** offers the walk presets (`src/marswalk/WalkChoice.tsx`).
- **Tablet:** the tools are Map, Routes, Field data, Display and Look closer. Look closer is new: suit limits, Curiosity's path, saved walks, the solar storm scenario and the ground panorama.
- **HUD:** a quiet HUD. A notice shows for 10 seconds, then moves to a notice list you open with N (`src/mission/HudNotices.tsx`). A feature that is off shows nothing in the helmet.

### HUD keys

The keys work while you walk, with no modifier key held, and not while you type in a field (`src/App.tsx`).

| Key | Action |
|---|---|
| T | Open the tablet (Look closer when the notice list is open, else Map) |
| L | Log here: start a field record at your position |
| M | Open or close the pause menu |
| N | Open or close the notice list |
| X | Dismiss the storm notice, or else the latest notice |
| C | During the storm scenario: cancel the way back, or restart it |
| R | Retry the return estimate after it failed |

WASD or the arrow keys walk, the mouse looks, and Esc pauses and releases the mouse, as in the team app.

### Design system (`src/design/`)

- `tokens.css`: the colour, type and spacing names. Every other stylesheet reads these names.
- `skin.css`: the "Exhibit" skin over the Station, Tablet and HUD structure, loaded last. It puts no filter, blend mode or colour layer over Mars imagery, terrain or maps.
- `icons.tsx`: line pictograms on a 24 x 24 grid. The word beside a pictogram carries its meaning.
- `InfoMark.tsx`: the small round "i" beside a switch, layer or option. It says what the item does and where its data comes from. It opens on click, hover or keyboard focus and closes on Escape.
- Faces: Gloock for headings and Overpass for text, local files in `public/fonts/`, SIL Open Font License 1.1 (licence texts beside them).

### Marswalk modules (`src/marswalk/`)

Typed modules with data in `public/marswalk/`. [The module README](src/marswalk/README.md) describes each one; [EVIDENCE.md](src/marswalk/EVIDENCE.md) names the file behind each per-region availability entry.

- Walk presets (Geology walk, Safety watch, Water and chemistry search, Custom). Each feature has an availability entry per region; a feature without data in a region reads "Not in this region".
- Eight science stops with a full task for the tablet and a short line for the helmet, plus the crew rover and the drill sites.
- Two hazard areas drawn by the Marswalk team (assumption), hatched, with a legend. The planner gets them as circles, an approximation that can also block open ground just outside an area.
- The prepared science walk: planned ahead of time by the old Marswalk planner on the 1 m grid. It is the default science walk on Boxwork.
- The solar storm scenario: a replayed DONKI event, labelled scenario.
- Four sourced suit limits, checked against the chosen route.
- Saved walks, compared with Curiosity's path (Boxwork only), the chosen route and the latest other saved walk.
- Sharper Boxwork imagery for the tablet map and the helmet minimap.
- A ground panorama: a real Curiosity photo of the ridges, small first, full size on request.

## Run it beside the root app

From the repository root, after `npm ci` in the root (the root README's Step 4). Routes are planned in a browser Web Worker (`src/mission/planner/`), so running this app needs no Python environment. Then:

```bash
cd hypersimulation-prototype
npm run dev:all
```

Open [the combined app](http://127.0.0.1:5174). Its defaults differ from the root app, so both can run at once:

| | Root app | This folder |
|---|---|---|
| Web (`npm run dev:all`) | 5173 | 5174 |
| Production preview (`npm run demo`) | 4173 | 4174 |
| Browser tests server | 8273 | 8274 |

`WEB_PORT` (and `TEST_PORT` for the browser tests) still override the defaults, as in Step 5 below.

- **No `npm install` needed here.** Node finds the root `node_modules/` from this folder. Running `npm ci` in this folder is optional; it gives the folder its own copy.
- **Python:** only for data preparation (`prepare:*`), the server tests (`test:api`) and the planner reference check (`test:planner:reference`). The files under `server/` stay for those scripts; the app never starts them. These scripts use `hypersimulation-prototype/.venv` when it exists, otherwise the root `.venv` (through `scripts/python.mjs`); create one with `python3 -m venv .venv` and `.venv/bin/python -m pip install -r requirements.txt` inside this folder.

## Tests

- `NODE_OPTIONS=--max-old-space-size=2048 npx vitest run` in this folder: 35 test files, 170 tests, all passed on 2026-11-15 after the browser planner, saved paths and events came over from the root app.
- The server tests (`npm run test:api`), the planner reference check (`npm run test:planner:reference`) and the full browser suite (`npm run test:browser`) were not re-run after that port.

## Known limits

- The planner works on a 5 m grid. The default science walk is a prepared route, planned ahead of time by the old Marswalk planner on the 1 m grid. Re-planning with the 5 m planner can refuse it, because the stops sit on steep ridge walls.
- Hazard areas reach the planner as circles, which can also block open ground just outside an area.
- Hazard areas are drawn and announced, but walking into one is not stopped.
- An event scenario shows in the helmet as a notice only; its details, acknowledgement and **Guide to habitat** are on Tablet → Events.
- Browser tests that need pointer lock fail in headless Chromium on macOS.
- No unfamiliar user has tested the combined app yet.

## AI use

Built with Claude (Anthropic) under Arda's direction. The code and these texts are AI-written, reviewed by a separate AI pass, and not yet reviewed by a human.

The rest of this file is the team app's README as it was copied. Its run steps now cover both apps: Step 5 runs the root app, Step 6 runs this folder. The example links open this folder's app on port 5174.

---

# Martian Map

Explore Mars through selectable real datasets, inspect geological evidence, choose a science destination, and follow a planned excursion with an astronaut HUD. Start at the suggested Gale–Boxwork site for detailed terrain, colour orbital imagery and saved Curiosity/route examples. Gale–Bradbury offers another prepared walking area. Jezero offers orbital exploration around Perseverance’s landing site; local planning terrain is not prepared there.

**Run it on your computer:** [Run locally](#run-locally) has every step, from installing Git, Node.js and Python to opening the root app and this combined app.

Version **0.7** integrates the detailed Fable Boxwork surface into the same Station → Tablet → HUD workflow. Select **Gale · Mount Sharp Boxwork** at Station, or open [the Boxwork example](http://127.0.0.1:5174/?demo=boxwork). Compare routes, choose colour/greyscale imagery, walk manually and log site-linked field records. Boxwork has its own terrain, Sol 4600 historical scenario and rover evidence; Bradbury/Yellowknife and the environmental explorer remain available. See [coverage, coordinates, licences and data recovery](docs/boxwork-data.md).

### Marswalk parts (branch `design/exhibit-system-team-feedback`)

The Marswalk prototype's parts now sit inside the same three places. Nothing opens anywhere else.

- **Station:** after you pick a prepared region, **Choose your task** offers Geology walk, Safety watch, Water and chemistry search and Custom. Each card lists the features it turns on; a feature without data in the region reads "Not in this region". The choice is kept in this browser (with blocked storage it lasts until reload).
- **Tablet → Display:** every feature as a labelled switch, grouped, with an info mark and a state word, beside a small schematic preview of what the helmet then shows. Changing a switch makes the walk Custom. Nothing switches by itself at a stop.
- **Tablet → Map (Boxwork):** the two hazard areas are drawn hatched (one hatch per danger, no tint under the hatch) with a small legend that names the danger and its origin (source, assumption or scenario). The eight science stops and the two placed drill sites are marked; tap a stop for its full task.
- **Tablet → Routes (Boxwork):** the default science walk is the prepared route, "Planned by the Marswalk planner on the 1 m terrain grid" (`src/marswalk/preparedRoute.ts`, `public/marswalk/science-route.json`). While you follow it, each step is checked on the 1 m grid. **Plan it again with the route planner** asks the team planner for nine legs: habitat, Stop 1 to Stop 8 in order, back to the habitat (shortest mode, through the browser planner's return lane, `src/mission/planner/`). The hazard areas go to the planner as restriction circles, at most 30 in total with your own restrictions; the circles can also block open ground just outside an area. A leg may end within 8 m of a stop that is steeper than the slope limit. A refused leg shows the planner's own diagnostics, and the prepared route stays the guidance. With the default 20° slope limit the planner can refuse a leg, because the stops sit on steep ridge walls in the 5 m planning grid.
- **Tablet → Look closer:** the suit limits for the chosen route (value, unit, source), its distance from Curiosity's path, your saved walks with **Compare**, the ground panorama, and **Run the solar storm scenario** (labelled scenario). With Space weather on, the scenario also starts by itself 150 minutes into a walk (an assumption).
- **HUD:** stop marks (number, and the short task for the next stop), an arrival notice "Stop n: ..." through the existing notices, the hazard areas hatched in the minimap and on the ground, a hazard symbol in the status row when you are inside or within 25 m of an area, and the storm as one notice under the compass (X dismisses, C cancels or restarts the way back, which is drawn while you return). Walked positions are kept, one point per 5 m, and saved when the tablet opens or the walk ends. A feature that is off shows nothing in the helmet.

Marswalk data sources and licences (from `src/marswalk/README.md`):

- Science stops and tasks: chosen by the Marswalk team (assumption); relief from the USGS Astrogeology 1 m terrain. Data: Marswalk app `public/data/team-inputs.default.json`, commit d2ed7bb0.
- Hazard areas: drawn by the Marswalk team (assumption); no published source.
- Drill sites: Curiosity rover position on the named sol, NASA Curiosity blog and NASA/JPL MMGIS MSL waypoints.
- Curiosity path: sols 4534 to 4805, NASA/JPL MMGIS MSL waypoints, cut by Marswalk. NASA/PDS public data; no licence is stated on the source page.
- Suit limits: NASA D-RATS 2022 Test Report (NTRS 20230017073), NASA-STD-3001 Vol 2 Rev C (note under Table 35), Pena-Asensio et al. (2024). Only cited sources are used; nothing is copied from them.
- Solar storm scenario: NASA CCMC DONKI event 2025-05-13T18:14:00-SEP-001, provided as is, at prototyping quality and in a research context; no NASA endorsement.
- Feature texts: project code under this repository's licence; each feature names its data owner.
- Faces: Gloock and Overpass, SIL Open Font License 1.1 (licence texts in `public/fonts/`).

## Expedition help, history and events

**Help · controls & symbols** explains each Station/Tablet workspace. Information buttons also work on hover, keyboard focus and click. In this combined app the helmet keeps its quiet HUD: an active event scenario shows as one helmet notice under the compass and in the notice list (key N); the full feed is on **Tablet → Events**.

On **Tablet → Routes → Load previous path**, name and save a snapshot of your actual walk. Toggle saved walks, the historical Curiosity path and prepared plans onto the map and surface. With two visible paths, compare sampled distance; elapsed-time differences apply only to recorded walks. Visibility choices survive reload. Stops count while the simulation runs; Tablet/Station/Esc pause it. Saved history survives reload in this browser, supports deletion and backup download, and is separate from planned route candidates. Restart starts a new trace and retains saved history. Boxwork is the first, suggested site and includes Curiosity’s saved historical traverse plus a prepared ridge route (the Marswalk science walk stays a separate default under Plan new route); Bradbury includes its own planned example and has no registered rover traverse bundled. Different endpoints, dates and vehicle capabilities prevent a fair speed comparison.

On **Tablet → Events**, schedule a solar-particle or local dust scenario after a chosen number of simulated minutes, or use **Trigger now**. Solar highlights exposed terrain outside a 35 m demonstration shelter at the habitat; dust marks a 60 m circle at the trigger setup location. The HUD notices and Tablet share active status; acknowledgement and the log are on Tablet → Events. **Guide to habitat** (Tablet → Events) follows the terrain return estimate, retaining your position and time. Acknowledgement keeps the hazard active; **End scenario** clears its area while retaining its entry. Restart clears current events.

Events are opt-in simulations, not live Mars forecasts or shielding calculations. Hazard areas are advisory; they do not modify measured terrain, walking restrictions or the historical detector-dose proxy. Current traces are unsaved until explicitly saved, history is limited to 20 entries / 12,000 samples per trace, and browser storage failures are shown visibly. Assumptions are captured at save; changing them during a walk does not retroactively create a controlled comparison.

## Try the excursion

Choose **Explore Boxwork →** at Station, or open [the Boxwork example](http://127.0.0.1:5174/?demo=boxwork). Under **Routes**, choose **Plan new route** to set endpoints and calculate terrain guidance, or **Load previous path** to show the saved Curiosity traverse and prepared ridge route on the same map.

For a science-led alternative, choose **Start guided Gale example** at Station, or open [the prepared Yellowknife Bay example](http://127.0.0.1:5174/?demo=yellowknife). It opens the astronaut Tablet with a source-backed science destination and demonstration assumptions. Inspect evidence, compare routes and enter the HUD. **Continue free exploration** keeps your setup; **Reset guided example** restores it.

Version **0.6** adds **Station → Data & history → Environmental explorer**: inspect global Odyssey GRS potassium/thorium composition and water-equivalent hydrogen, dated MCS surface-temperature soundings, and 19 sols of Curiosity temperature/radiation records. Compare observed values with an explicitly simulated Sol 29 daily-profile outlook and its held-out errors. Select layers on the atlas or Tablet; inspect source, scale, timestamps and uncertainty. **Use snapshot as fixed mission assumptions** explicitly applies an available Gale reading/forecast without changing the mission clock. Composition is separate from radiation dose, and sparse observations remain unknown. See [environmental data, model and validation](docs/environment-data.md).

Version **0.5** adds a personal field layer on **Tablet → Field data** in the prepared Gale area:

- Create geological notes, draw unit polygons/contact lines, declare circular obstacles, or record point temperature (K) and detector dose-rate (µGy/h) readings. Pick/draw on the map, enter local coordinates, or use **Log here** on the HUD to capture the astronaut's simulated position and mission time.
- Save, inspect, edit, hide, delete and undo records. The map and HUD share markers and terrain-following boundaries; press Esc, then select a projected field marker to inspect its source, observation UTC, uncertainty, geometry and simulated context.
- Enable **Restrict routes and walking** on an obstacle to use its 5–500 m radius in outbound/return planning and swept movement checks. Restrictions clear stale routes while retaining position/time; **Plan route** computes updated alternatives from the configured endpoints. Hiding an annotation leaves an enabled restriction enforced and its boundary visible. Disable or move a restriction surrounding the astronaut to move again.
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

- **Martian Map** (repository root): the Station, Tablet and HUD app. It needs Git and Node.js. Routing runs in a browser Web Worker; no Python server is needed.
- **Combined app** (`hypersimulation-prototype/`, this folder): the same app with the combined design system and the Marswalk content. It uses the root setup and also needs no Python to run.

These steps assume a computer with none of these tools installed. Skip any step you have already done.

### Step 1: Install Git and Node.js (once per computer)

npm, the command that installs and runs Martian Map, comes with Node.js. It is not a separate download.

**Windows**

1. **Git:** download the installer from [git-scm.com/downloads/win](https://git-scm.com/downloads/win), run it and keep every default option.
2. **Node.js and npm:** download the **LTS** Windows installer from [nodejs.org](https://nodejs.org/en/download), run it and keep the default options. You don't need the optional "Tools for Native Modules".
3. **Optional Python (Marswalk/data tools only):** download the latest Python 3 installer from [python.org/downloads](https://www.python.org/downloads/). On the installer's first screen, tick **Add python.exe to PATH**, then click **Install Now**. If that box is not ticked, the `python` command won't work.
4. Open PowerShell: press the Windows key, type `PowerShell` and press Enter. If PowerShell was already open, close it and open a new window, because only new windows find newly installed programs.
5. Check that each of these commands prints a version number:

   ```powershell
   git --version
   node --version
   npm --version
   ```

   - If `npm` fails with "running scripts is disabled on this system", run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer `Y`, and try again.
   - If `python` opens the Microsoft Store or prints nothing, Python is not on PATH. Uninstall Python, then install it again with **Add python.exe to PATH** ticked.

**macOS**

1. Open Terminal: press Cmd+Space, type `Terminal` and press Enter.
2. **Git:** run `git --version`. If Git is missing, macOS offers to install the command line developer tools. Click **Install**, wait for it to finish, then run `git --version` again.
3. **Node.js and npm:** download the **LTS** macOS installer from [nodejs.org](https://nodejs.org/en/download) and run it.
4. **Optional Python (Marswalk/data tools only):** download the latest Python 3 macOS installer from [python.org/downloads](https://www.python.org/downloads/) and run it.
5. Close Terminal, open a new one, and check that each of these commands prints a version number:

   ```bash
   git --version
   node --version
   npm --version
   ```

**Linux:** install Git, Node.js 22.17 or newer (from [nodejs.org](https://nodejs.org/en/download) or your distribution). Python 3.12 or newer with `venv` is optional for data preparation and reference checks, and Python is needed for the separate Marswalk development server.

Martian Map needs Node.js 22.17 or newer. Python is not required to install, build or run the integrated app.

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

### Step 4: Install the website packages

From the repository folder:

```bash
npm ci
```

This installs the website packages into `node_modules/`. If you use nvm, run `nvm use` first. Run `npm ci` again after an update changes `package-lock.json`. The combined app in `hypersimulation-prototype/` uses this same setup.

### Step 5: Run Martian Map

```bash
npm run dev
```

Open [the local application](http://127.0.0.1:5173). Keep the terminal open while using it. The globe, route comparison, conditions evaluation, return estimates and POV walking all run in your browser. `npm run dev:all` remains an alias for starting this frontend; it no longer starts Python.

On Windows, the `prepare:*` and `test:api` scripts in the root still call `.venv/bin/python`. Run their commands from `package.json` directly, using `.venv\Scripts\python.exe` in its place. In `hypersimulation-prototype/` these scripts go through `scripts/python.mjs`, which also finds the Windows path.

For another checkout, use `WEB_PORT=5273 npm run dev:all` (PowerShell: `$env:WEB_PORT=5273; npm run dev:all`) and open port 5273.

For a production preview:

```bash
npm run build
npm run demo
```

Open [the production preview](http://127.0.0.1:4173). Global imagery needs internet access; prepared terrain, imagery and environmental observations are bundled. No Cesium ion account is needed. After changing source, rebuild and restart the preview; reload the browser to use the new build.

### Step 6: Run the combined app (hypersimulation-prototype/)

Open a terminal in the folder where you cloned the repository and run:

```bash
cd nasa-martian-map/hypersimulation-prototype
npm run dev:all
```

Open [the combined app](http://127.0.0.1:5174) in your browser. It starts its own Vite on port 5174; routes are planned in the browser, so no Python process starts. It uses the root `node_modules/` from Step 4. For its production preview, run `npm run build` and `npm run demo` in this folder and open [the preview](http://127.0.0.1:4174).

### Run both at once, and stop them

Each app keeps running in its own terminal. To run both, open two terminals: run Step 5 in the first and Step 6 in the second. They use different ports (5173 and 5174), so both can stay open. To stop an app, click its terminal and press Ctrl+C, or close that terminal.

## Deploy the public demo

`npm run build` produces a complete static website under `dist/`, including datasets, Cesium assets and the browser planner worker. Serve that directory over HTTP/HTTPS; no API, Python process, secrets or database is needed. Opening `index.html` directly as a `file://` URL is unsupported because the app loads modules, workers and data files.

FR-029 tracks setting up Cloudflare static hosting and publishing the public URL; it is not deployed by FR-028. See the [deployment plan](docs/plans/2026-11-15-demo-deployment.md) and [release instructions](docs/release.md).

For a local files-only acceptance check after building:

```bash
node scripts/serve-static.mjs --port 8373
```

Open [the static demo](http://127.0.0.1:8373). Missing files and `/api/*` return errors. The optional Docker image serves this same static build, without the old FastAPI backend:

```bash
docker build -t martian-map:static .
docker run --rm -p 127.0.0.1:8373:10000 martian-map:static
```

Field records stay in the visitor's browser for that hostname; use export/import to transfer them to another browser or domain. Hardware-accelerated WebGL is needed for practical POV performance. Public hosting does not move rendering to a server.

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

Prepared files are included, so the normal demo needs no Python installation and does not download multi-gigabyte mosaics. To regenerate data or run the offline Python reference checks, first create `.venv` and install `requirements.txt`:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

On Windows, use `python` and `.venv\Scripts\python.exe`; run the Python commands in the `prepare:*` scripts directly with that executable. To regenerate data:

```bash
npm run prepare:data
# Optional: regenerate the bounded USGS geology and NASA visit-area package
npm run prepare:science
# Optional: regenerate numeric environmental maps, multi-sol history and forecasts
npm run prepare:environment
# After regenerating either terrain package, rebuild the saved path library
npm run prepare:paths
```

This uses HTTP range requests against USGS rasters and downloads PDS environmental products. It can take several minutes and needs network access. Source records are cached under the repository's `tmp/`. It fails if usable data or verified radiation units are unavailable; it does not generate replacement terrain.

## Verification

```bash
npm test
npm run build
# Optional offline parity verification (requires the Python environment above):
npm run test:planner:reference
npm run test:api
```

In `hypersimulation-prototype/`, `npm run test:api` fails as written; see [Known limits](#known-limits) at the top of this file.

For browser checks, install local Chromium once and then run:

```bash
mkdir -p tmp/browser
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npx playwright install chromium
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npm run test:browser
# On a machine with GPU acceleration, run the POV checks using hardware:
TEST_HARDWARE=1 TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npm run test:browser
```

The UI redesign browser suite checks route-free entry, retained pose/time/drafts, route adoption, return failure/retry, modal keyboard access, unsupported/loading states and bounded laptop layouts. The broader browser suite also checks the guided/direct science example, geology/target state, profile/map linkage, provenance and region isolation, plus bounded historical replay, departure-dependent warnings, scrubbing invalidation, stationary mission-clock/return updates, visor controls and drawing resolution changes without position resets. The browser suite serves production files only on port 8273 (8274 when run in `hypersimulation-prototype/`), with no backend. Set `TEST_PORT` and `STATIC_DIR` for an isolated build/check. Worker observation and fault injection replace the old API mocks. The dedicated static test checks that no runtime `/api` requests are made. It checks region discovery, shared layers, region switching and recovery, real global layer replacement, and Gale routes, manual walking/HUD, pause, reset, exclusions and planner failure. Screenshots are saved under `test-results/`. The global-layer check requires internet access and WebGL.
