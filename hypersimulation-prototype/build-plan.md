# Marswalk at the Gale Boxwork - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app that plans and replays one astronaut walk at the boxwork ridges in Gale crater on one 3D scene (1 m terrain, 25 cm image), to the quality gate in spec section 8.

**Architecture:** Python scripts cut small data files from two USGS GeoTIFFs and three NASA archives into `app/public/data/`. A no-build ES-module web app (three.js vendored, no bundler, no server) reads only those files. Pure logic (geometry, planner, constraints, replay) lives in DOM-free modules tested with `node --test`; rendering and UI modules sit on top.

**Tech Stack:** Python 3 (numpy, Pillow, pinned and hash-verified in `tools/.venv`), three.js (vendored file, MIT, version and SHA-256 recorded), plain ES modules, plain CSS, `node --test`, `python -m unittest`.

**Spec:** `hackathons/nasa-space-apps-2026/spec.md` (DRAFT v4). Rules: `hackathons/nasa-space-apps-2026/challenge-brief.md`, `hackathons/nasa-space-apps-2026/submission-checklist.md`. Sources: `hackathons/nasa-space-apps-2026/resource-catalogue.md` sections 8, 10, 11, 12.

All paths below are relative to `hackathons/nasa-space-apps-2026/` unless they start with `docs/`. Repo root: `/Users/ardasarikaya/Desktop/Business/Arda-AI-OS/.claude/worktrees/product-walkthrough-pitch-3a623d`. Branch: `hackathon/nasa-marswalk-app`. Workers commit to this branch and never push.

## Global Constraints

- Only KEEP-list sources (catalogue section 8). No Leaflet, no GDAL, no Cesium ion, no globe library, no 2D map library.
- The running app makes no request to any host other than its own. No NASA, USGS, font or CDN call at run time.
- No invented metric. Every number on screen has a unit and one of: source with sol, "assumption", or "scenario".
- Team inputs (stations, no-go zones, human-only tasks, walking speed, work time per station, partner spacing, hazard start time) are placeholders: flagged `placeholder: true` in `team-inputs.json` and shown on screen with the word "PLACEHOLDER". Never presented as team input.
- English UI. SI units only. Temperature in degrees Celsius only. Dose with its time base. Sol and local Mars time on every measured value.
- No em-dash anywhere (code, copy, README, commit messages). Use " - ".
- Every commit message ends with the line `AI-written: Claude (Anthropic), reviewed by the team.` plus the Co-Authored-By line.
- No NASA logo, flag or mission patch. No AI-made image. The image is greyscale; any tint is labelled "tinted greyscale".
- Downloaded NASA and USGS files are untrusted data. They go to `/Users/ardasarikaya/marswalk-data-raw/` (outside the repo, outside any script directory). Run every Python that reads them as `tools/.venv/bin/python -I`. Never commit them. Never print free text from them beyond column headers.
- Python installs: only numpy and Pillow, exact versions with `--require-hashes` in `tools/requirements.txt`. A third package needs the orchestrator's word.
- No recursive rm, no hard reset, absolute paths in commands, comment only to state a constraint that the code does not show.
- No default browser controls and no default library markers on screen. One type family (self-hosted, open licence, licence named), one size scale, one colour set.
- Helmet view: at most three actions (next, acknowledge, return to rover), each a large target and a key; at most six items in fixed places; red = return now, amber = caution, each with an icon shape and a word; missing data shows "NO DATA" with dashes.
- Vertical scale is true by default; a labelled 2x switch.
- Project licence: Apache-2.0 for code. All derived image, terrain and slope files: CC BY-SA 3.0 IGO (both USGS products contain HRSC data; credit Calef and Parker / USGS and ESA/DLR/FU Berlin; catalogue section 12).
- Batch sizes: the cut area is fixed by the spec (core 1,024 m, surround 2,048 m, one chosen sol). No other batch run without the orchestrator's word.
- Check context7 (`/mrdoob/three.js`) for the current three.js API before writing three.js code.

## Review Focus

1. A data file fails to load or is cut short (slow line, 404 on the host): the app shows the designed error screen with the file name and a retry, never a blank canvas. Test in Task 6.
2. No WebGL, or a lost WebGL context mid-run: the 2D view takes over from the same files with the same route and stations. Test in Task 6.
3. A station placed inside a no-go zone, on a cell above the slope cap, or on a no-data cell: the planner answers "no route" and names the station and the limit; it does not hang or snap the station silently. Test in Task 8.
4. REMS or RAD value missing for an hour of the chosen sol: the display shows "NO DATA" with dashes for that value, never zero and never the last value without its time. Test in Tasks 4 and 10.
5. A team-inputs file edited by hand with a missing field or a wrong type: the app names the bad field on the error screen and falls back to the committed placeholders; it does not crash. Test in Task 7.

---

## Data contract (all tasks rely on this)

Local frame: origin at the core centre, the pixel corner of the 25 cm image nearest to lon 137.383, lat -4.803. `x` = metres east, `y` = metres north. In three.js: X = east, Y = up (height), Z = -north. Heights are in metres on the terrain file's own vertical datum.

`app/public/data/scene.json`:

```json
{
  "origin": {"lon": 0, "lat": 0},
  "metres_per_degree": {"lon": 0, "lat": 0},
  "core": {"size_m": 1024, "image_m_per_px": 0.25, "dem_m_per_px": 1,
           "tiles": [["ortho/core_0_0.webp", "ortho/core_0_1.webp"], ["ortho/core_1_0.webp", "ortho/core_1_1.webp"]],
           "tile_px": 2048, "half_res": "ortho/core_half.webp",
           "dem": "dem_core.bin", "dem_samples": 1025, "slope": "slope_core.bin", "slope_cells": 1024},
  "surround": {"size_m": 2048, "image": "ortho/surround.webp", "image_m_per_px": 1,
               "dem": "dem_surround.bin", "dem_samples": 513, "dem_m_per_px": 4},
  "overview": "ortho/overview.webp",
  "height": {"offset_m": 0, "scale_m": 0, "nodata": 65535},
  "slope": {"scale_deg": 0.25, "nodata": 255},
  "sources": [{"id": "", "title": "", "url": "", "licence": "", "credit": ""}]
}
```

- Tile `core_r_c`: row 0 is north, column 0 is west. `overview.webp` is the whole surround at 512 px (first paint).
- `dem_*.bin`: little-endian Uint16, row 0 north, `height_m = offset_m + v * scale_m`.
- `slope_core.bin`: Uint8, 1,024 x 1,024 cells of 1 m, `slope_deg = v * 0.25`, values above 63.5 clamp to 254.
- `waypoints.json`: `{"source": {...}, "waypoints": [{"sol", "x", "y", "lon", "lat", "elev_geoid_m", "dem_height_m", "pitch_deg", "roll_deg", "tilt_deg", "yaw_deg", "site", "drive", "dist_km", "in_campaign": true}]}` for every waypoint inside the surround.
- `conditions.json`: `{"sol", "earth_date", "source": {...}, "hours": [{"lmst_hour": 0, "ground_temp_c": null, "air_temp_c": null, "pressure_pa": null, "uv": null, "n": 0}], "units": {...}}`. `null` means no data.
- `dose.json`: `{"sol", "source": {...}, "dose_rate": {"value": null, "unit": "", "time_base": ""}, "fallback": {"value": 0.210, "plus_minus": 0.040, "unit": "mGy/day", "source": "Hassler et al. 2014", "period": "Gale, 2012 to 2013"}, "dose_equivalent_rate": {"value": 0.64, "plus_minus": 0.12, "unit": "mSv/day", "source": "Hassler et al. 2014"}}`.
- `sep-event.json`: the DONKI event `2025-05-13T18:14:00-SEP-001` fields plus `"note": "Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario."`.
- `team-inputs.json`: `{"placeholder": true, "signed_off_by": null, "base": {"x", "y", "label", "assumption": true}, "walking_speed_m_s": {"value", "placeholder": true}, "work_time_min_per_station": {"value", "placeholder": true}, "partner_trail_m": {"value", "placeholder": true}, "hazard_start_min": {"value", "placeholder": true}, "stations": [{"id": 1, "x", "y", "kind": "ridge|hollow", "on_path": false, "task": "", "photo": null, "placeholder": true}], "no_go": [{"id", "label", "polygon": [[x, y]], "placeholder": true}], "drill_sites": [{"name", "x", "y", "sol", "kind", "reported": "", "source_url": "", "position_note": "approximate"}]}`.

Module interfaces (ES modules in `app/src/`):

- `geo.js`: `toLocal(lon, lat, scene) -> {x, y}`, `toLonLat(x, y, scene)`, `distance(a, b) -> m`, `bearingDeg(a, b) -> 0..360 from north clockwise`.
- `terrain.js`: `loadTerrain(scene, fetchBin) -> Terrain`; `Terrain.heightAt(x, y) -> m | null`, `Terrain.slopeAt(x, y) -> deg | null`, `Terrain.core` and `Terrain.surround` typed arrays.
- `planner.js`: `planRoute({terrain, base, stations, noGo, limits}) -> {ok: true, legs: [{from, to, path: [[x, y]], distance_m, climb_m, descent_m, max_slope_deg, bearing_deg}], total_m} | {ok: false, blocking: {limit: "slope_cap" | "no_go" | "rover_range" | "no_data", station_id, detail}}`; `planReturn({terrain, from, base, noGo, limits})` same leg shape. `limits = {slope_cap_deg: 15, rover_range_m: 2000}`.
- `constraints.js`: `buildConstraints({route, inputs, dose}) -> [{id, label, value, unit, limit, limit_unit, margin, pass, body, source, provenance: "source" | "assumption" | "scenario"}]`.
- `replay.js`: `buildTimeline({route, inputs}) -> Timeline`; `Timeline.stateAt(t_s) -> {pos: {x, y}, heading_deg, leg_index, at_station: id | null, next_station: id | null, dist_to_next_m, bearing_to_next_deg, dist_to_base_m, dist_to_partner_m, suit_time_left_s, lmst_hour, mode: "walk" | "work" | "return" | "done"}`; `Timeline.triggerHazard(t_s)`.
- `provenance.js`: `num(value, unit, prov, detail) -> HTMLElement` (the only way a number reaches the screen; renders "NO DATA" with dashes for `null`); `audit(root) -> [{text, reason}]` (every text node holding a digit sits inside a `num` element or an element marked `data-nonmetric` such as a station name).
- `state.js`: one store, `getState()`, `setState(patch)`, `subscribe(fn)`; fields `view: "plan" | "walk"`, `renderer: "3d" | "2d"`, `layers`, `route`, `inputs`, `t`, `hazard`, `exaggeration: 1 | 2`.

---

### Task 1: Data toolchain and image, terrain and slope cuts

Model: opus. Reason: a hand-written BigTIFF, PackBits and LZW range reader fails silently by metres if the georeference is read wrong.

**Files:**
- Create: `tools/requirements.txt`, `tools/README.md`, `tools/geotiff_range.py`, `tools/cut_scene.py`, `tools/tests/test_geotiff_range.py`, `tools/tests/test_cut_scene.py`
- Create (output): `app/public/data/scene.json`, `app/public/data/ortho/*.webp`, `app/public/data/dem_core.bin`, `app/public/data/dem_surround.bin`, `app/public/data/slope_core.bin`
- Create: `data-checks.md` (section "Cuts")

**Interfaces:**
- Produces: the data contract files above. `geotiff_range.open_remote(url, cache_dir) -> RemoteTiff` with `.read_window(col0, row0, width, height) -> numpy.ndarray`, `.pixel_to_lonlat(col, row)`, `.lonlat_to_pixel(lon, lat)`, `.tags`.

- [ ] Step 1: Create `tools/.venv` (git-ignored) with `python3 -m venv`, install numpy and Pillow at exact versions with hashes from `tools/requirements.txt` (`pip install --require-hashes --no-deps`). Record versions and where the hashes came from (PyPI JSON) in `tools/README.md`.
- [ ] Step 2: Write failing unit tests for the reader on synthetic in-memory TIFF bytes built in the test: classic and BigTIFF headers, PackBits tiles, LZW strips with and without the floating point predictor, a window that crosses tile edges, and `pixel_to_lonlat` round trip on an equirectangular georeference with a non-zero standard parallel.
- [ ] Step 3: Implement `geotiff_range.py`: HTTP range requests with `urllib` (merge adjacent ranges, cache raw bytes under `/Users/ardasarikaya/marswalk-data-raw/`), IFD parse, tile and strip decode. Sources: `https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif`, `https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif`. Read the projection from the GeoTIFF keys; do not assume 59.2 km per degree.
- [ ] Step 4: Run `tools/.venv/bin/python -I -m unittest discover -s tools/tests -v`. Expected: all pass.
- [ ] Step 5: Implement `cut_scene.py --lon 137.383 --lat -4.803 --core-m 1024 --surround-m 2048 --out app/public/data --raw /Users/ardasarikaya/marswalk-data-raw`. Core image 4,096 px at 0.25 m in four 2,048 px WebP tiles (quality 90); `core_half.webp` 2,048 px; surround 2,048 px at 1 m (area mean of 4 x 4); overview 512 px. DEM core 1,025 samples at 1 m, surround 513 at 4 m (area mean). Slope by Horn's method on the 1 m DEM. Write `scene.json` with the two USGS source entries (licence and credit text come from catalogue section 12; if section 12 is not there yet, write `"licence": "PENDING"` and report it).
- [ ] Step 6: Tests in `test_cut_scene.py` on the written files: sizes match the contract; no core tile is more than 1 percent black or no-data; DEM height range in the core lies inside -3,700 to -3,500 m; a DEM sample at each core corner equals a direct `read_window` of the source within 0.01 m; the image and DEM windows share the same centre lon and lat within 0.25 m.
- [ ] Step 7: Read only the header of the colour file named at the end of catalogue section 12 (size, pixel scale, bands, extent, whether the core lies inside); report it, cut nothing from it. Write `data-checks.md` section "Cuts": file sizes, total bytes of `app/public/data`, height range, share of core cells above 15 degrees, pixel scale read from each file, projection parameters.
- [ ] Step 8: Commit code, tests, outputs and `data-checks.md`. Add `tools/.venv/` to a `.gitignore` in `hackathons/nasa-space-apps-2026/`.

Acceptance: both unittest files pass; `app/public/data` is under 25 MB in total with no single file above 5 MB; `data-checks.md` section "Cuts" exists.

### Task 2: Rover waypoints and the alignment check

**Files:**
- Create: `tools/cut_waypoints.py`, `tools/alignment_check.py`, `tools/tests/test_waypoints.py`
- Create (output): `app/public/data/waypoints.json`, `data-checks/alignment/*.png`, `data-checks.md` (section "Alignment")

**Interfaces:**
- Consumes: `scene.json`, `geotiff_range`, the core image tiles and `dem_core.bin` from Task 1.
- Produces: `waypoints.json` per the data contract.

- [ ] Step 1: Failing tests: 65 waypoints have `in_campaign: true` (sols 4534 to 4805); all of them fall inside the core; `tilt_deg` values are finite; local `x, y` of the first campaign waypoint converts back to its lon and lat within 0.1 m.
- [ ] Step 2: Implement `cut_waypoints.py` (source `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json`, saved raw first). Units of `pitch`, `roll`, `tilt` per catalogue section 12; if stated as an inference there, carry `"tilt_unit_note"` into the file.
- [ ] Step 3: Implement `alignment_check.py`: for each campaign waypoint write a 64 m x 64 m crop of the 25 cm image with a 2 m radius ring at the waypoint (PNG, 4x upscale, nearest), plus one contact sheet of all 65; compute `dem_height_m - elev_geoid_m` for each and report median, 5th and 95th percentile, and the standard deviation after the median is removed.
- [ ] Step 4: Run the tests and the two scripts. Write `data-checks.md` section "Alignment" with the height statistics and the stated tolerance (the standard deviation), and list the PNG files for the visual check. The visual verdict (tracks within 2 m) is made by the orchestrator from the contact sheet, not by this task.
- [ ] Step 5: Commit.

Acceptance: tests pass; contact sheet exists; height statistics are in `data-checks.md`.

### Task 3: Licences, README skeleton, vendored three.js

**Files:**
- Create: `app/LICENSE` (Apache-2.0 full text), `app/DATA-LICENSE.md`, `app/README.md`, `app/vendor/three/` (the module build files, `LICENSE`, `VERSION.md` with version, source URL, SHA-256 of each file), `app/sources.json`

**Interfaces:**
- Produces: `sources.json`: `[{"id", "title", "provider", "url", "licence", "credit", "used_for", "layer": true | false}]`, the single list that the README table, the in-app credits and the layer legends read.

- [ ] Step 1: Download three.js r187 (npm version 0.187.0; confirm on the registry) from the npm registry tarball, verify the registry `integrity` hash, copy only `build/three.module.min.js`, `build/three.core.min.js` (if the release has it), the `examples/jsm/controls/MapControls.js` and `OrbitControls.js` addons, and `LICENSE`. Record SHA-256 of each in `VERSION.md`.
- [ ] Step 2: Write `sources.json` from catalogue sections 3, 8 and 12 for: the 25 cm image, the 1 m terrain, REMS, RAD, DONKI, MSL waypoints, the Mastcam panorama, the boxwork releases, D-RATS 2022, NASA-STD-3001 Vol 2 Rev C, the OCHMO dose brief, Hassler 2014, Pena-Asensio 2024, three.js, the font. A licence not read on its page is written as "NASA / PDS public data, no licence stated on the page".
- [ ] Step 3: Write `app/README.md` with sections: What it is, Run it locally (`python3 -m http.server 8642 --bind 127.0.0.1 --directory app`), Layers (table generated from `sources.json` rows with `layer: true`), Sources and licences, Credits, Assumptions table (spec section 5, each with its body), Team inputs and placeholders, Design model (Apollo traverse maps and cuff checklists, Artemis traverse planning), Interface rules (spec 5a wording: "designed against named NASA human-systems rules"), AI use, Project licence, Rebuild the data.
- [ ] Step 3b: `tools/fetch_panorama.py`: download PIA26559.jpg (URL in catalogue section 12) to the raw directory, write `app/public/media/pia26559_4096.webp` (4,096 px wide) and `pia26559_1024.webp`, with a `media/credits.json` entry (credit NASA/JPL-Caltech/MSSS, page URL, "resized"). Do not quote the sol numbers from the NASA page.
- [ ] Step 4: A check script `tools/check_readme.py` (stdlib only): every `sources.json` id appears in the README; the README layer count equals the count of `layer: true` rows; no em-dash in `app/` text files; exit 1 on failure. Run it.
- [ ] Step 5: Commit.

Acceptance: `python3 -I tools/check_readme.py` exits 0; SHA-256 values in `VERSION.md` match the files.

### Task 4: Weather, dose and space weather for the chosen sol

**Files:**
- Create: `tools/cut_conditions.py`, `tools/tests/test_conditions.py`
- Create (output): `app/public/data/conditions.json`, `app/public/data/dose.json`, `app/public/data/sep-event.json`, `data-checks.md` (section "Chosen sol")

**Interfaces:**
- Consumes: file locations, column layouts and units from catalogue section 12.
- Produces: the three JSON files per the data contract.

- [ ] Step 1: Failing tests on small fixture tables written by hand in the test (not copies of NASA files): missing markers become `null`; hourly means use only rows whose quality flag allows it; an hour with no rows yields `null` and `n: 0`; Kelvin converts to Celsius; the dose rate carries its unit and time base as strings from the source document.
- [ ] Step 2: Implement `cut_conditions.py --sol N`. Choice of the sol: the first sol at or after 4600 for which the REMS file and the RAD file both exist and at least 20 of 24 hours have ground temperature. Record in `data-checks.md` which sols were tried and why the chosen one won.
- [ ] Step 3: If the RAD dose unit is not stated in the documents (section 12 says NOT FOUND), write `dose_rate.value: null` and keep the Hassler fallback; never guess a unit.
- [ ] Step 4: Write `sep-event.json` from the DONKI call in section 12, saved raw first.
- [ ] Step 5: Run tests and the script; write `data-checks.md` section "Chosen sol": sol, Earth date and its source, hours with data per field, value ranges with units, files read with URLs.
- [ ] Step 6: Commit.

Acceptance: tests pass; `conditions.json` has 24 hour entries; every value in the three files has a unit in the file.

### Task 5: Visual design system (impeccable, full machinery)

Run by the orchestrator through the `impeccable` skill, on mock data, in parallel with Tasks 1 to 4.

**Files:**
- Create: `app/design/` (brief, tokens, screen designs as static HTML mock-ups), `app/src/styles/tokens.css`, `app/src/styles/base.css`, `app/public/fonts/` (font files and licence)

**Produces:** tokens (one type family, one size scale, one colour set, focus ring, hazard red and amber with icon shapes), and designed mock-ups for: loading with progress, plan view with layer list, legends and credits, constraints table, route card (print), station card, helmet display (walk, work, caution, return now), rover check panel, error, empty, "no route", 2D fallback, the three sizes 1366 x 768, 1920 x 1080, 390 x 844.

Acceptance: the mock-ups open from `app/design/index.html`; the helmet display follows every rule of spec 5a; the orchestrator has checked each mock-up in the browser preview at the three sizes.

### Task 6: App shell, loader, 3D scene, 2D fallback, speed test

**Files:**
- Create: `app/index.html`, `app/src/main.js`, `app/src/state.js`, `app/src/geo.js`, `app/src/terrain.js`, `app/src/loader.js`, `app/src/scene3d.js`, `app/src/view2d.js`, `app/src/perf.js`, `app/src/ui/progress.js`, `app/src/ui/error.js`
- Test: `app/tests/geo.test.js`, `app/tests/terrain.test.js`, `app/tests/loader.test.js`, `app/tests/state.test.js`
- Create: `tools/make_mock_scene.py` (writes a synthetic `app/public/data-mock/` in the contract format so this task does not wait for Task 1; `?data=mock` selects it)

**Interfaces:**
- Consumes: the data contract; tokens from Task 5 when present (else neutral placeholders in `tokens.css` that Task 5 replaces).
- Produces: `geo.js`, `terrain.js`, `state.js` per the interfaces above. `scene3d.js`: `createScene3d(canvas, {scene, terrain, textures}) -> {setView("plan" | "walk"), setExaggeration(1 | 2), setLayer(id, on), setOverlay(id, object), flyTo(x, y), setEye({x, y, heading_deg}), pick(clientX, clientY) -> {x, y} | null, onContextLost(fn), dispose()}`. `view2d.js`: the same method names on a 2D canvas (walk view = heading-up map). `loader.js`: `loadAll(base, onProgress) -> {scene, terrain, textures, waypoints, conditions, dose, sep, inputs, sources}`; rejects with `{file, status}`. `perf.js`: `measureFps(ms) -> Promise<number>`.

- [ ] Step 1: Failing tests: `bearingDeg` north = 0, east = 90; `toLocal` and `toLonLat` round trip within 0.01 m; `heightAt` bilinear on a 3 x 3 grid, `null` on no-data and outside; `slopeAt` decodes `v * 0.25`; `loadAll` with a fake fetch reports progress as bytes loaded over bytes total and rejects with the file name on a 404 and on a body shorter than `Content-Length`.
- [ ] Step 2: Implement the pure modules; run `cd app && node --test tests/`. Expected: pass.
- [ ] Step 3: `scene3d.js`: core mesh 1,025 x 1,025 vertices as four chunks that match the four image tiles; surround mesh 513 x 513 with the core area cut out or set below; textures greyscale with the correct colour space, anisotropic filtering, mipmaps; first paint uses `overview.webp` on the surround mesh, then tiles replace it as they arrive; phones (`matchMedia("(max-width: 600px)")` or `devicePixelRatio` cost) load `core_half.webp`. Plan view: orthographic camera straight down, north up, MapControls with pan, zoom and tilt; keys: arrows pan, `+` and `-` zoom, `T` tilt, `N` north up. Walk view: perspective camera at 1.7 m eye height (labelled as an assumption in `sources.json` notes) above `heightAt`. Renders on demand in plan view (no idle loop).
- [ ] Step 4: `view2d.js` from the same textures on a 2D canvas, same keys. Start-up logic in `main.js`: no WebGL2 and no WebGL -> 2D; `?view=2d` -> 2D; after first paint `measureFps(2000)` while a short scripted tilt runs; below 24 fps at half resolution -> 2D with a notice; context lost -> 2D with a notice. `?fps=1` shows a live frame rate readout.
- [ ] Step 5: Progress state (bytes and file label) and the error screen (file name, HTTP status, retry button) from the Task 5 designs.
- [ ] Step 6: Commit.

Acceptance: `node --test` passes; with `?data=mock` the page shows the scene; the orchestrator verifies in the browser: first paint, tilt, 2x switch, `?view=2d`, a forced 404 shows the error screen, no console errors.

### Task 7: Team inputs, editor, layers, legends, credits

**Files:**
- Create: `app/public/data/team-inputs.json` (placeholders), `app/src/inputs.js`, `app/src/layers.js`, `app/src/ui/layer-panel.js`, `app/src/ui/legend.js`, `app/src/ui/credits.js`, `app/src/ui/editor.js`, `app/src/ui/conditions-panel.js`, `app/src/provenance.js`
- Test: `app/tests/inputs.test.js`, `app/tests/provenance.test.js`

**Interfaces:**
- Consumes: `loader`, `scene3d` / `view2d` (`setLayer`, `setOverlay`, `pick`), `sources.json`.
- Produces: `inputs.js`: `validateInputs(obj) -> {ok: true, inputs} | {ok: false, field, problem}`; `saveLocal(inputs)`, `loadLocal()`, `exportJson(inputs) -> Blob`. `provenance.js` per the interfaces above. Layer ids: `image`, `height`, `slope`, `thermal`, `atmosphere`, `radiation`, `space_weather`, `rover_path`, `stations`, `no_go`, `drill_sites`.

- [ ] Step 1: Failing tests: `validateInputs` names the first bad field for a missing `stations`, a station with `kind: "peak"`, a polygon with two points, a negative speed; `num(null, "degC", "source", ...)` renders "NO DATA"; `audit` flags a bare "15 deg" text node and passes the same text built with `num`.
- [ ] Step 2: Placeholder inputs: base at the sol 4534 waypoint; 6 stations, 3 on the rover path at campaign waypoints and 3 off the path, alternating ridge and hollow as far as the image shows; each task text is exactly "PLACEHOLDER - the team writes this task"; no no-go polygons except one clearly labelled "PLACEHOLDER no-go zone"; speed, work time, partner spacing and hazard start are placeholders with `placeholder: true`. Drill sites from catalogue section 12 with `position_note: "approximate"`; a mineral statement only where section 12 gives one with a URL, else "see NASA release" with the URL.
- [ ] Step 3: Layers: `height` as a hypsometric tint with contour lines every 5 m; `slope` as three classes (under 10 degrees, 10 to 15, above 15 = blocked) with a pattern for the blocked class, never colour alone; `thermal`, `atmosphere`, `radiation`, `space_weather` as panels fed by `conditions.json`, `dose.json`, `sep-event.json` with sol and local Mars time on each value; each layer has a legend with units and an on-screen credit from `sources.json`.
- [ ] Step 4: Editor (plan view only): place, move and delete stations; set ridge or hollow; write the task; draw and delete no-go polygons; set walking speed, work time per station, partner spacing; export and import JSON. Editing a placeholder item clears its `placeholder` flag. A banner counts the remaining placeholders. All controls are custom-styled, reachable by keyboard and by touch.
- [ ] Step 5: Run `node --test`; commit.

Acceptance: tests pass; in the browser each of the 11 layers switches on and off with legend and credit; a broken `team-inputs.json` shows the named field and loads the committed placeholders.

### Task 8: Route planner, constraints table, route card

Model: sonnet. The algorithm is standard; the tests pin the behaviour.

**Files:**
- Create: `app/src/planner.js`, `app/src/constraints.js`, `app/src/ui/constraints-table.js`, `app/src/ui/route-card.js`, `app/src/styles/print.css`, `app/src/ui/no-route.js`
- Test: `app/tests/planner.test.js`, `app/tests/constraints.test.js`

**Interfaces:** `planRoute`, `planReturn`, `buildConstraints` per the interfaces above.

- [ ] Step 1: Failing planner tests on small synthetic grids: a wall of 20 degree cells with one gap -> the path goes through the gap; a closed wall -> `{ok: false, blocking: {limit: "slope_cap", station_id}}`; a no-go polygon over the only gap -> `limit: "no_go"`; a station 2,100 m from base -> `limit: "rover_range"`; a station on a no-data cell -> `limit: "no_data"`; a station inside a no-go polygon -> `limit: "no_go"` with that station id; no path cell lies in a no-go polygon or above 15 degrees; the route ends at base; the 1,024 x 1,024 worst case finishes under 2 s per leg in Node.
- [ ] Step 2: Implement A* on the 1 m slope grid, 8 neighbours, binary heap, octile heuristic. Step cost = horizontal distance x (1 + (slope / 15)^2). Blocked: slope above the cap, no-data, inside a no-go polygon, farther than `rover_range_m` from base. Fixed station order, then back to base. On failure, re-run with one limit lifted at a time to name the blocking limit. Run in a Web Worker in the browser; the same module runs in Node for tests.
- [ ] Step 3: Failing constraints tests, then implement. Rows: slope cap (max slope on route against 15 degrees, Moon, Pena-Asensio 2024); farthest point from the crew rover against 2 km (Earth analog for a lunar rover, D-RATS 2022); partner spacing against 100 m (D-RATS 2022; the value is a placeholder, provenance "assumption"); total time in suit against 14 hours (NASA-STD-3001 Vol 2 Rev C, note under Table 35; computed from placeholder speed and work time, so the row carries the assumption flag); dose for the walk (rate from `dose.json` or the fallback, times duration) and its share of the 600 mSv career limit using 0.64 mSv/day (Hassler 2014, Gale 2012 to 2013). Each row: value, limit, margin, source, body, pass or fail, assumption flag.
- [ ] Step 4: Route card: per leg bearing, distance, climb, steepest slope, time; totals; station list with tasks; the limits; printable on one A4 page in black on white (`print.css`), with the sources line and the placeholder warning when any placeholder remains.
- [ ] Step 5: The "no route" screen names the limit and the station and offers "open the editor".
- [ ] Step 6: Run `node --test`; commit.

Acceptance: tests pass; in the browser the placeholder stations yield a route drawn on the scene, or the "no route" screen names the limit.

### Task 9: Helmet display replay, hazard scenario, return path

**Files:**
- Create: `app/src/replay.js`, `app/src/ui/hud.js`, `app/src/ui/station-card.js`, `app/src/hazard.js`, `app/src/styles/hud.css`
- Test: `app/tests/replay.test.js`, `app/tests/hazard.test.js`

**Interfaces:** `buildTimeline`, `Timeline.stateAt`, `Timeline.triggerHazard` per the interfaces above. `hazard.js`: `hazardState(t_s, inputs, sep) -> {active, level: "none" | "caution" | "return", label}`.

- [ ] Step 1: Failing tests: `stateAt(0)` is at base; at the end of leg 1 `at_station` is 1 and `mode` is "work" for the work time; `suit_time_left_s` = 14 h minus `t`; `dist_to_base_m` is the straight line; after `triggerHazard(t)` the mode is "return", the path is `planReturn` from the current position, and `stateAt` reaches base; a `null` conditions hour yields `null` values, not the previous hour.
- [ ] Step 2: Implement. Replay speed steps 1x, 10x, 60x (labelled "replay speed", marked `data-nonmetric`).
- [ ] Step 3: HUD over the walk view, six fixed items in this order: warning; bearing and distance to the next station; time margin (suit time left against 14 h); distance to rover against 2 km; distance to partner against 100 m; science (station id, kind, measured ground temperature with sol and local Mars time). Bright strokes, no filled panels over the terrain centre. Three actions with keys: Next (`N`), Acknowledge (`A`), Return to rover (`R`). The label "SIMULATION" is always visible.
- [ ] Step 4: Station card on arrival: task, kind, measured conditions, photo or the designed "no photo picked" state, credit. Acknowledge closes it.
- [ ] Step 5: Hazard: at `hazard_start_min` (placeholder) or from a plan-side "start scenario" control, the HUD shows red "RETURN NOW" with its icon and word, the event id and date from `sep-event.json`, the words "scenario - measured near Earth, arrival at Mars not claimed", and the return path with distance and walk-back time. Amber "CAUTION" state when a margin drops under 20 percent (the 20 percent is a design choice, labelled so in the README).
- [ ] Step 6: Run `node --test`; commit.

Acceptance: tests pass; in the browser the walk runs from base through all stations and back, and the hazard return works, by keyboard only and by touch only.

### Task 10: Rover check, states, audit, responsive, README final

**Files:**
- Create: `app/src/rovercheck.js`, `app/src/ui/rover-panel.js`, `app/src/ui/states.js`, `app/tests/rovercheck.test.js`, `tools/check_offline.py`
- Modify: `app/README.md`, `app/sources.json`, `app/src/main.js`

**Interfaces:** `roverCheck(waypoints, terrain, cap_deg) -> {n, share_under_cap, pairs: [{sol, dem_slope_deg, rover_tilt_deg}], median_abs_diff_deg, note}`.

- [ ] Step 1: Failing tests then implement `roverCheck`: DEM slope at each campaign waypoint (mean over a 3 m footprint) against the rover's `tilt_deg`; share of waypoints under the cap; median absolute difference. The panel shows a scatter drawn on a canvas with axis labels and units, the three numbers with provenance, and the honest note that a 1 m terrain slope and a rover body tilt are not the same quantity.
- [ ] Step 2: `window.__marswalk = {audit, state, fps}`; `audit()` walks every screen state and returns violations. `tools/check_offline.py`: greps `app/` for any absolute `http` URL used by code at run time (links in credits are allowed only in `href`).
- [ ] Step 3: Designed states for empty (no stations), loading, error, "no route". Focus visible on every control. Layout at 1366 x 768, 1920 x 1080, 390 x 844 with no overlap and no sideways scroll.
- [ ] Step 4: README final: layer table equals the working layers; assumptions table; placeholders list; AI-use section (which tool, for what, which files); "how to reproduce every demo screenshot" with the URL parameters for each view (`?view=`, `?t=`, `?layer=`, `?hazard=1`).
- [ ] Step 5: Run `node --test`, `python3 -I tools/check_readme.py`, `python3 -I tools/check_offline.py`; commit.

Acceptance: all three commands pass; `__marswalk.audit()` returns an empty list on every screen.

### Task 11: Review (separate worker, premortem first)

One reviewer, not an author of any task. Brief opens with "list how this breaks". It fires the Review Focus cases, re-runs every verification command in this plan, checks the spec section 8 lines one by one against the code, and commits fixes with the `review:` prefix. A second worker does any fix pass that the reviewer only reports.

Verification commands (all from `hackathons/nasa-space-apps-2026/`):
- `tools/.venv/bin/python -I -m unittest discover -s tools/tests -v`
- `cd app && node --test tests/`
- `python3 -I tools/check_readme.py`
- `python3 -I tools/check_offline.py`
- `grep -rn $'—' app tools data-checks.md` returns nothing.

### Task 12: Quality gate in the browser (orchestrator)

The orchestrator runs spec section 8 line by line in the browser preview and records evidence (DOM checks, console, network list, screenshots) in `quality-gate.md`. Lines that need the public link or a second device are listed there as team steps.

---

## Amendments after the premortem (2026-11-14). These override the text above where they differ.

**A1. Commits and shared files.** Workers in one wave run in the same working tree and do NOT run any git command that writes (no add, no commit). The orchestrator commits after each wave. Commit trailer is `AI-written: Claude (Anthropic).` (no "reviewed by the team"). Data check reports are separate files: `data-checks/cuts.md`, `data-checks/alignment.md`, `data-checks/chosen-sol.md`. Only the integration tasks (6c, 10) edit `app/src/main.js` and `app/index.html`. Task 6 writes `app/src/styles/tokens.fallback.css`; Task 5 owns `tokens.css`.

**A2. Hosting.** Arda's call of 2026-11-14: work locally in this repository; the app folder is copied to a team repository later. No task deploys. `app/` and `tools/` must stay self-contained (no import or path that leaves `hackathons/nasa-space-apps-2026/`). `app/public/data-mock/` is never part of a deploy; with `?data=mock` a fixed "MOCK DATA" banner shows and every value has provenance "mock", which the audit fails.

**A3. Task 1 split and hardening.**
- 1a (reader): Step 0 first: HEAD each URL (follow the redirect, use the final S3 URL, require `Accept-Ranges: bytes`), then dump both headers to `data-checks/cuts.md`: classic or BigTIFF, tile or strip layout and size, Compression, Predictor, SampleFormat, BitsPerSample, all GeoKeys and any WKT or GDAL metadata, no-data value, overviews, and the estimated bytes to fetch for the cut. Support compression codes 1, 5, 8 and 32946 (zlib from the stdlib), 32773, and 7 through Pillow with JPEGTables. Any other code, or an estimate above 2 GB: stop and report. Never state that a checksum was verified.
- Record the latitude type (planetocentric or planetographic) and the longitude direction and range from the keys. Convert waypoint lon and lat with the same convention. If the fixed centre lies more than 50 m from the centroid of the campaign waypoints after conversion, stop and report; do not move the centre silently.
- Real-data oracle in Task 1 acceptance: the DEM value at the sol 4600 waypoint (lon 137.3796858, lat -4.804189) is within 5 m of its `elev_geoid` -3632.878 m, or the constant offset between the two datums is measured on 5 campaign waypoints and stated.
- 1b (cuts) follows 1a.

**A4. Sample positions (data contract).** DEM core sample (i, j), i = column 0..1024, j = row 0..1024: x = -512 + i, y = 512 - j, bilinear from source pixel centres. Slope cell (i, j) centre: x = -511.5 + i, y = 511.5 - j. Core image pixel (c, r) centre: x = -512 + 0.125 + 0.25 c, y = 512 - 0.125 - 0.25 r. Surround DEM sample: x = -1024 + 4 i, y = 1024 - 4 j. Surround image pixel centre: x = -1024 + 0.5 + c. `scene.json` also carries `"ground_scale"` (true ground metres per projected metre at the origin latitude, from the projection's standard parallel), `"lat_type"`, `"lon_direction"`, and `"files": {"<path>": <bytes>}` for every data file. `scene.json` `sources` holds source ids only; the full rows live in `app/sources.json`. Area means skip no-data.

**A5. Contract changes.**
- `waypoints.json`: use `dist_total_m` (drop `dist_km`); add `"tilt_unit_note": "degrees by inference from yaw and yaw_rad"`; `easting` and `northing` are kept and cross-checked against lon and lat in Task 2. The campaign count is whatever sols 4534 to 4805 give; the test asserts it equals the count in the raw file and reports it.
- `conditions.json` hour entry: `{"lmst_hour", "ground_brightness_temp_c", "air_temp_c", "pressure_pa", "uv_abc_w_m2", "rel_humidity_pct", "n": {"<field>": count}}`. On-screen label: "ground brightness temperature" (REMS thermopile, not a contact temperature). UV values with a bad confidence flag are `null`.
- `dose.json`: `dose_rate` = `{"value", "unit": "microGy/hour", "detector": "B" | "E", "n_obs", "derived_daily": {"value", "unit": "mGy/day", "method": "mean of the sol's hourly values x 24, derived by us"}}`. The RAD unit is stated in the SIS. If the row layout of the dose lines cannot be confirmed from a real file, `value: null` and the Hassler fallback shows with its dates.
- `team-inputs.json`: add `"start_lmst_hour": {"value", "placeholder": true}`. Placeholder flags are per field: each station has `"placeholder": {"position": true, "kind": true, "task": true}`. An edit clears only the flag of the field that was edited. `signed_off_by` stays `null` until a team member fills it.
- `drill_sites`: Altadena and Nevado Sajama markers sit at the rover waypoint nearest to the imaging sol (4568 and 4803), `position_note: "rover position on sol N; the drill position is not published"`. Valle de la Luna is listed in the panel with no marker ("position not published"). `reported` is always "Minerals for this site are not in the NASA releases we read - see the release" plus the URL. No per-site mineral claim.
- `provenance.js`: provenance values are `"measured"` (requires `{sol, lmst}` and a source id; `num()` throws without them), `"source"` (requires a source id), `"derived"` (requires a method string and source ids), `"assumption"`, `"scenario"`, `"mock"`. No number is drawn into a canvas or WebGL; every label with a digit is a DOM `num()` element or carries `data-nonmetric` (ids, counts of items, byte progress, HTTP status).
- `scene3d` and `view2d`: `setOverlay(id, {kind: "line" | "points" | "polygon", coords: [[x, y]], style})` for both renderers. No Object3D crosses the interface.
- `replay.js`: `buildTimeline({route, inputs, conditions})`; `Timeline.triggerHazard(t_s, returnLeg)`; the caller computes `planReturn`. LMST hour = `start_lmst_hour` + t_s / 3698.97 (one Mars hour in seconds; 88,775.244 s per sol / 24).
- `state.js` parses URL options at start: `view` (plan, walk, 2d), `data`, `layer` (comma list), `t` (seconds), `hazard` (1), `exag` (1, 2), `fps` (1), `panel`. Unit tested. Every demo screenshot is reproducible from these.
- `app/layers.json` (Task 3): the 11 layer ids with `label`, `unit`, `kind` ("map" or "panel"), `source_ids`. `layers.js`, the README table and `check_readme.py` all read it. `check_readme.py` also checks a licence and a credit for every source and the README section headings.
- Keys: plan view uses arrows, `+`, `-`, `T` tilt, `0` north up. Walk view uses `N` next, `A` acknowledge, `R` return to rover only.

**A6. Task 6 split.** 6a: pure modules (`geo`, `terrain`, `state` with URL options, `loader`, `provenance`, `inputs`), `tools/make_mock_scene.py` (the mock image and DEM carry an "N" glyph in the north-west corner so a mirrored axis shows), placeholder `team-inputs.json`. 6b: `scene3d.js` (phones use every second DEM sample, 513 x 513; MapControls damping off; render on change, on texture load and on resize; `measureFps` skips a 500 ms warm-up). 6c: `view2d.js`, start-up fallback logic, progress and error screens, `main.js`, `index.html`. First-view set (three.js, app code, `scene.json`, `overview.webp`, `dem_surround.bin`, fonts, CSS) is at most 2.5 MB over the wire; the loader checks each file's length against `scene.json` `files` and computes progress from it.

**A7. Tasks 7 to 10.** 7b: layers, legends, credits, panels. 7c: editor. 8 and 9: pure logic first (wave 1), UI later. Task 8 adds `app/src/planner.worker.js` (relative imports only, no import map) and a "planning" state; the whole placeholder route plans in 10 s or less. Task 9 shows the panorama (PIA26559) in the station card as a credited context image. Interface rules of spec 5a are written in the README as "design choice" unless the named source was read (NASA-STD-3001 Vol 2 Rev C and D-RATS 2022 were read). Add NASA-STD-3001 Vol 1 Rev B (read through the OCHMO brief) to `sources.json`. Papers and standards have licence text "cited only, nothing copied".

**A8. Extra acceptance checks (Task 10 and Task 12).** Audit states: plan, each of the 11 layers, no-route, empty, error, loading, walk, work, caution, return now, rover check, 2D plan, print card. At each of the three sizes: `document.documentElement.scrollWidth <= innerWidth`, no two HUD boxes intersect, one computed font family, no native `select` or `input[type=range]` without the app's class. Print preview of the route card fits one A4 page. First view time at 10 Mbit/s with the cache off is recorded in `quality-gate.md`.

**A9. Alignment remedy (Task 2).** If the contact sheet shows a constant shift, measure it on 5 waypoints, apply one documented translation to the waypoints layer only (never to the image or terrain), and state it on screen in the rover check panel. Else record "fail". Keep only the contact sheet and 5 sample crops in the repository.

**A10. Waves.** Wave 1: 1a, 3, 4, 5, 6a, 8-pure, 9-pure. Wave 2: 1b, 6b, 6c, then 2. Wave 3: 7b, 7c, 8-UI, 9-HUD, 10-pure. Wave 4: 10 integration, 11 review, 12 gate. Cut order if time runs short: rover check panel, panorama, contour lines, replay speed steps, 2D walk replay (keep the 2D plan view), no-go drawing in the editor (keep JSON import), 3D on phones (phones get 2D).
