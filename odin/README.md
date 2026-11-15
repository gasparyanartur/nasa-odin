# ODIN

O.D.I.N. (Offworld Discovery Intelligence Network) lets you plan and walk a science excursion on real Mars terrain, from mission station to astronaut helmet.

**Live site:** https://gasparyanartur.github.io/nasa-odin/

ODIN is the entry of team Clanker Lovers to NASA Space Apps 2026, challenge "Interplanetary Survival Guide: Martian Map". GitHub Actions publishes the site on every push to `master`.

The application is a **laptop simulation operated with mouse and keyboard**. Station, Tablet and HUD are the astronaut's interfaces inside that simulation. **Tablet means the simulated astronaut's device, not a physical tablet or a touch-first device target.**

## What it does

Start at the suggested Gale - Mount Sharp Boxwork site for detailed terrain, colour orbital imagery and saved Curiosity and route examples. Gale - Bradbury offers another prepared walking area. Jezero offers orbital exploration around Perseverance's landing site; local planning terrain is not prepared there.

### Station

- Choose a region on the globe or in the site list. **Enter surface** starts free exploration on either prepared Gale site without planning a route. **Open tablet** opens the astronaut's local workspace.
- After you pick a prepared region, step **02 / Choose your task** offers the walk presets: Geology walk, Safety watch, Water and chemistry search and Custom (`src/marswalk/WalkChoice.tsx`). Each card lists the features it turns on; a feature without data in the region reads "Not in this region". The choice is kept in this browser (with blocked storage it lasts until reload).
- **Datasets & map layers** holds basemaps, geology and environmental layers. **Data & history** holds analysis.
- **Environmental explorer** (Data & history): global Odyssey GRS potassium and thorium composition and water-equivalent hydrogen, dated MCS surface-temperature soundings, and 19 sols of Curiosity temperature and radiation records. Compare observed values with an explicitly simulated Sol 29 daily-profile outlook and its held-out errors. **Use snapshot as fixed mission assumptions** applies an available Gale reading or forecast without changing the mission clock. Composition is separate from radiation dose, and sparse observations remain unknown.
- **Historical timeline:** play, pause or scrub 24 hourly REMS medians of Sol 10. Scrubbing clears the previous plan. Planning pauses replay and uses its selected departure time. Hourly values are held within each bin; gaps and times after Sol 10 remain unknown. Scene lighting is illustrative and does not follow the timeline.
- **Start guided Gale example** opens a source-backed science destination at Yellowknife Bay with demonstration assumptions. **Continue free exploration** keeps your setup; **Reset guided example** restores it.
- **Guided tour:** on the first visit the Station offers "Take the 2 minute tour". It never starts by itself; **Tour** beside the Station and Tablet help marks starts it again. A drawn pointer moves to each real control and clicks it, and the app answers as it does for you. **Let me do it** hands the clicks to you; Skip tour or Esc ends it at once. It runs a route preview but never starts a walk, a hazard or pointer lock (`src/tour/steps.ts`, anchors in [docs/tour-anchors.md](docs/tour-anchors.md)).

### Tablet

A flat device overlay above the paused surface. Primary actions stay in the fixed footer; detailed panels scroll on their own.

- **Map:** local inspection. On Boxwork the two hazard areas are drawn hatched (one hatch per danger, no tint under the hatch) with a legend that names the danger and its origin (source, assumption or scenario). The eight science stops and the two placed drill sites are marked; tap a stop for its full task. Maps support drag, mouse-wheel zoom, click inspection and keyboard controls (arrows to pan, +/- to zoom, Home to reset, Enter to inspect the center).
- **Routes:** habitat-to-destination comparisons with linked elevation and slope profiles. Scrub a profile to highlight the map segment and read its grade, elevation, slope and duration, plus cost contributions and active constraints. On Boxwork the default science walk is the prepared science walk (see [How the route planner works](#how-the-route-planner-works)). **Load previous path** saves a named snapshot of your actual walk and shows saved walks, Curiosity's historical path and prepared plans on the map and surface. With two visible paths you compare sampled distance; elapsed-time differences apply only to recorded walks.
- **Field data:** geological notes, unit polygons and contact lines, circular obstacles, and point temperature (K) and detector dose-rate (µGy/h) readings. Save, edit, hide, delete and undo records. Export and import **Mars GeoJSON v1**; ordinary Earth GeoJSON is rejected. Field data is not available at Jezero. Details: [docs/field-data.md](docs/field-data.md).
- **Display:** every feature as a labelled switch, grouped, with an info mark and a state word, beside a small preview of what the helmet then shows. Changing a switch makes the walk Custom. Nothing switches by itself at a stop. Display also sets visor, waypoints, minimap, clocks, graphics and simulation pace.
- **Look closer:** the suit limits for the chosen route (value, unit, source), its distance from Curiosity's path, your saved walks with **Compare**, a ground panorama (a real Curiosity photo of the ridges, small first, full size on request), and **Run the solar storm scenario** (labelled scenario). With Space weather on, the scenario also starts by itself 150 minutes into a walk (an assumption).
- **Events:** schedule a solar-particle or local dust scenario, or use **Trigger now**. Solar highlights exposed terrain outside a 35 m demonstration shelter at the habitat; dust marks a 60 m circle at the trigger location. **Guide to habitat** follows the terrain return estimate. Events are opt-in simulations. They are not live Mars forecasts or shielding calculations.

### Helmet HUD

- Click the terrain, walk with WASD or the arrow keys, and look with the mouse. Esc pauses and releases the mouse. Opening the tablet pauses the mission and keeps position, heading, pitch, elapsed time and unfinished field drafts.
- A quiet HUD: a notice shows for 10 seconds, then moves to a notice list you open with N (`src/mission/HudNotices.tsx`). A feature that is off shows nothing in the helmet.
- Stop marks (number, and the short task for the next stop), an arrival notice "Stop n: ...", the hazard areas hatched in the minimap and on the ground, and a hazard symbol in the status row when you are inside or within 25 m of an area.
- The solar storm shows as one notice under the compass; the way back is drawn while you return.
- Walked positions are kept, one point per 5 m, and saved when the tablet opens or the walk ends.
- A failed return estimate does not stop walking; **Retry return estimate** tries again.

The keys work with no modifier key held, and not while you type in a field (`src/App.tsx`).

| Key | Action |
|---|---|
| T | Open the tablet (Look closer when the notice list is open, else Map) |
| L | Log here: start a field record at your position |
| M | Open or close the pause menu |
| N | Open or close the notice list |
| X | Dismiss the storm notice, or else the latest notice |
| C | During the storm scenario: cancel the way back, or restart it |
| R | Retry the return estimate after it failed |

### Design system (`src/design/`)

- `tokens.css`: the colour, type and spacing names. Every other stylesheet reads these names.
- `skin.css`: the "Exhibit" skin over the Station, Tablet and HUD, loaded last. It puts no filter, blend mode or colour layer over Mars imagery, terrain or maps.
- `icons.tsx`: line pictograms on a 24 x 24 grid. The word beside a pictogram carries its meaning.
- `InfoMark.tsx`: the small round "i" beside a switch, layer or option. It says what the item does and where its data comes from.

## Run it locally

You need Git and Node.js 22.17 or newer. npm comes with Node.js.

```bash
git clone -c core.autocrlf=input https://github.com/gasparyanartur/nasa-odin.git
cd nasa-odin/odin
npm install
npm run dev
```

Open http://localhost:5174. Keep the terminal open; press Ctrl+C to stop.

- Keep `-c core.autocrlf=input`. Git on Windows otherwise converts line endings, which changes file sizes, and the app rejects any terrain data file that is not the expected size.
- Routes are planned in a browser Web Worker (`src/mission/planner/`), so running the app needs no Python.
- Production preview: `npm run build`, then `npm run demo`, then open http://127.0.0.1:4174.
- `npm run build` produces a complete static website under `dist/`. Serve it over HTTP or HTTPS; no API, Python process, secrets or database is needed. Opening `index.html` as a `file://` URL does not work. To serve below a folder, as GitHub Pages does, build with `VITE_BASE=/nasa-odin/ npx vite build`.
- Hardware-accelerated WebGL is needed for practical walking performance.

**Python (optional):** only for data preparation (`prepare:*`), the server tests (`test:api`) and the planner reference check (`test:planner:reference`). These scripts use `odin/.venv` (through `scripts/python.mjs`, which also finds the Windows path). Create it with `python3 -m venv .venv` and `.venv/bin/python -m pip install -r requirements.txt` inside this folder. Data preparation uses HTTP range requests against USGS rasters and downloads PDS products; it needs network access and can take several minutes. It fails if usable data or verified radiation units are unavailable and never generates replacement terrain.

## Data and sources

Source labels, references, processing and checksums are in [the manifest](public/gale/manifest.json).

- **Terrain:** actual USGS Gale DEM and orthoimage crops. The 5 m planning grid is derived from a source DEM with 1 m posts. Globe relief is relative to the patch minimum, not a planetary areoid-to-ellipsoid conversion.
- **Weather:** hourly Sol 10 Curiosity REMS medians with selected reliability flags applied. Missing wind remains missing; mission wind is an editable assumption.
- **Radiation:** the mean observed RAD detector E rate gives an editable, spatially uniform dose proxy. It is absorbed detector dose, not astronaut dose equivalent. No suit or terrain shielding is inferred.
- **Geology:** USGS units and contacts around Gale and Jezero at **1:20,000,000**, with original identifiers, descriptions and palette. It is regional context, too coarse to identify a local outcrop or derive walking hazards.
- **Science destinations:** Rocknest and the Yellowknife Bay entry area, each with NASA geological evidence, a published rover waypoint, visit sol (56 and 125) and uncertainties. They locate visit areas, not precise scoop or drill sites.
- **Imagery:** Viking colour imagery and global basemap tiles; sharper Boxwork imagery for the tablet map and the helmet minimap.
- **Science stops and tasks:** chosen by the team (assumption); relief from the USGS Astrogeology 1 m terrain.
- **Hazard areas:** drawn by the team (assumption); no published source.
- **Drill sites:** Curiosity rover position on the named sol, NASA Curiosity blog and NASA/JPL MMGIS MSL waypoints.
- **Curiosity path:** sols 4534 to 4805, NASA/JPL MMGIS MSL waypoints, cut by the team. NASA/PDS public data; no licence is stated on the source page.
- **Suit limits:** NASA D-RATS 2022 Test Report (NTRS 20230017073), NASA-STD-3001 Vol 2 Rev C (note under Table 35), Pena-Asensio et al. (2024). Only cited sources are used; nothing is copied from them.
- **Solar storm scenario:** NASA CCMC DONKI event 2025-05-13T18:14:00-SEP-001, replayed, provided as is, at prototyping quality and in a research context; no NASA endorsement.
- **Faces:** Gloock (headings) and Overpass (text), local files in `public/fonts/`, SIL Open Font License 1.1 (licence texts beside them).
- **Feature texts:** project code under this repository's licence; each feature names its data owner.

More detail:

- [Boxwork coverage, coordinates, licences and data recovery](docs/boxwork-data.md)
- [Environmental data, model and validation](docs/environment-data.md)
- [Science data and geological evidence](docs/science-data.md)
- [Gale data and assumptions](docs/gale-data.md)
- [Dataset integration](docs/datasets.md)
- [Module notes](src/marswalk/README.md) and [per-region availability evidence](src/marswalk/EVIDENCE.md) for the walk presets, stops, hazards and suit limits (data in `public/marswalk/`)

## How the route planner works

- The planner runs in a browser Web Worker on a 5 m grid. Numeric elevations, conservative slopes and validity masks drive planning and walking.
- Duration uses a slope-dependent speed proxy. Walking speed, slope, time, temperature, wind and dose limits are demonstration settings. Limits guide the candidate recommendation after the terrain search; the planner does not guarantee a resource-constrained optimum. A gentler objective does not guarantee a lower maximum slope.
- **Compare departure hours** checks the same excursion at each of 24 departure times against the Sol 10 record. Green means within your limits, amber means unknown coverage, orange means a limit is exceeded. This compares two terrain candidates; it does not search for an environmental optimum.
- **The prepared science walk** is the default on Boxwork (`src/marswalk/preparedRoute.ts`, `public/marswalk/science-route.json`). It was planned ahead of time on the 1 m terrain grid. While you follow it, each step is checked on the 1 m grid.
- **Plan it again with the route planner** asks for nine legs: habitat, Stop 1 to Stop 8 in order, back to the habitat (shortest mode, through the return lane). A leg may end within 8 m of a stop that is steeper than the slope limit. A refused leg shows the planner's own diagnostics, and the prepared route stays the guidance.
- Hazard areas go to the planner as restriction circles, at most 30 in total with your own restrictions. Field obstacles with **Restrict routes and walking** use their 5-500 m radius in planning and in movement checks. The manual exclusion tool marks user-declared 40 m areas.
- Route comparisons start at the habitat, even after you have walked elsewhere. Replanning from the current position is not built.

## Known limits

- The planner works on a 5 m grid derived from 1 m terrain. With the default 20° slope limit it can refuse a leg of the science walk, because the stops sit on steep ridge walls.
- Hazard areas reach the planner as circles, which can also block open ground just outside an area.
- Hazard areas are drawn and announced, but walking into one is not stopped. They are advisory and do not change measured terrain or the dose proxy.
- An event scenario shows in the helmet as a notice only; its details, acknowledgement and **Guide to habitat** are on Tablet → Events.
- Only the prepared area supports routing and walking. There is no live Mars weather, real astronaut localization, physiological oxygen model or operational safety validation.
- Global imagery needs internet access. Prepared terrain, imagery and environmental observations are bundled.
- Scene lighting and surface colour are illustrative; geometry and overhead texture come from data. The habitat is a demonstration location.
- Waypoint labels are navigation coordinates, not confirmed visible outcrops or terrain-occlusion indicators. Mars LMST is simulated site time.
- Field data: up to 100 records, 100 vertices per geometry and 30 combined manual and field restrictions. Saved history: 20 entries and 12,000 samples per trace. Records stay in the visitor's browser for that hostname; use export and import to move them.
- Different endpoints, dates and vehicle capabilities prevent a fair speed comparison with Curiosity's path.
- Browser tests that need pointer lock fail in headless Chromium on macOS.
- No unfamiliar user has tested ODIN yet.

## Tests

- `NODE_OPTIONS=--max-old-space-size=2048 npx vitest run` in this folder: 40 test files, 259 tests, all passed on 2026-11-15. The tour's unit tests cover its state machine, its storage and its card placement; the tour itself was not played in a browser for this count.
- The server tests (`npm run test:api`), the planner reference check (`npm run test:planner:reference`) and the full browser suite (`npm run test:browser`) were not re-run for that count. In this folder `npm run test:api` fails as written.
- Browser suite setup:

```bash
mkdir -p tmp/browser
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npx playwright install chromium
TMPDIR="$PWD/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browser" npm run test:browser
```

The browser suite serves production files on port 8274 (`TEST_PORT` overrides it), with no backend, and checks that no runtime `/api` requests are made. Set `TEST_HARDWARE=1` on a machine with GPU acceleration to run the walking checks on hardware. The global-layer check needs internet access and WebGL. Screenshots go to `test-results/`.

## AI use

Built with Claude (Anthropic) under Arda's direction. The code and these texts are AI-written, reviewed by a separate AI pass, and not yet reviewed by a human.

## Licence

Apache-2.0, see [LICENSE](../LICENSE). Third-party data keeps its own terms, listed in [Data and sources](#data-and-sources).
