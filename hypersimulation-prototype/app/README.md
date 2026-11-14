# Marswalk at the Gale boxwork

Status: working build. Every number carries its origin; values with no source are labelled "assumption" (the labels show with "Show sources" on, and always in Details).

## What it is

A static web app that plans and then replays one astronaut walk at the boxwork ridges on Mount Sharp in Gale crater, Mars. It is built for the NASA Space Apps 2026 challenge "Interplanetary Survival Guide: Martian Map".

- One 3D scene of the walk area: the real terrain shape at 1 m, covered with the real orbit image at 25 cm (colour mosaic by default, greyscale on request).
- Seen from above, the scene is the plan map. Seen from eye height, it is the view behind a helmet display.
- The crew plans a route through science stations, checks it against named limits, and replays the walk with values that Curiosity measured on one named Mars day at its own position in this area.
- The helmet display is a labelled simulation. It is not live data and not real augmented reality.
- The app makes no request to NASA, USGS or any other host while it runs. All data is cut ahead of time into files that sit next to the app.

## Run it locally

```
python3 -m http.server 8642 --bind 127.0.0.1 --directory app
```

Run this from the project folder (`hackathons/nasa-space-apps-2026/`), then open http://127.0.0.1:8642/ in a browser. The server listens on this computer only.

## How to use

The app opens as a guided story in five steps, one thing per screen. Press the large Next button (or the Right arrow key, or Enter) to go on, Back (or the Left arrow key) to go back, or pick a step in the stepper at the top.

1. **Place:** the boxwork ridges of Mount Sharp in 3D, tilted and turning slowly (any touch, click or key stops the turn).
2. **Plan:** the route from the crew rover through eight stations, seen from above. A filled square is a ridge station, an open square a hollow. Pick a station tag to read its task. The chips Slope, Rover path and Height switch those layers.
3. **Walk:** the first-person view with the helmet display; the walk plays at once at 60 times real time. A station card opens on arrival and the walk runs on. The small map at the bottom right shows where you are.
4. **Hazard:** a recorded solar particle event, replayed as a scenario: RETURN NOW, the way back in red, the time to walk back.
5. **Check:** the Curiosity path over the route, and how well our slope map agrees with the tilt the rover measured. "Explore freely" leaves the story; "Print the route card" opens the one-page card.

Top right: "Details" opens a drawer with every panel (limits, timeline, layers, stations, editor, rover check, credits); "Show sources" shows the origin of every number on screen.

Map: drag to move; scroll or pinch to zoom; right drag or shift + drag to turn and tilt; double click to zoom in. The buttons at the bottom right do the same and repeat while held; "Fit route" brings the walk back into view.

Keys: Right or Enter = Next, Left = Back. With the map focused (click it or Tab to it) the arrows move the map; `+` and `-` zoom, `T` tilts, `0` puts north up. In the walk steps: `N` next, `A` acknowledge, `R` return to rover. Escape closes the station card, then Details. The first Tab stop is a link, "Skip to Next".

## Layers

Layer count: 11

The table is read from `layers.json`, the single list that the README, the in-app legends and the credits share. Source ids point to rows in `sources.json`.

| Layer id | Label | Unit | Kind | Source ids |
|---|---|---|---|---|
| `image` | Image | HiRISE colour mosaic or greyscale mosaic, 25 cm per pixel | map | usgs_gale_colour_2025, image_25cm, hrsc |
| `height` | Height | m | map | dem_1m, hrsc |
| `slope` | Slope | deg | map | dem_1m, hrsc, pena_asensio_2024 |
| `thermal` | Thermal (ground brightness temperature) | degC | panel | rems |
| `atmosphere` | Atmosphere (air temperature, pressure, UV) | degC, Pa, W/m2 | panel | rems |
| `radiation` | Radiation (dose rate) | microGy/hour | panel | rad, hassler_2014 |
| `space_weather` | Space weather (scenario) | UTC time of event | panel | donki |
| `rover_path` | Curiosity path | m | map | msl_waypoints |
| `stations` | Stations | m | map | (no source) |
| `no_go` | No-go zones (marked areas and slope cap) | deg | map | pena_asensio_2024 |
| `drill_sites` | Drill sites (rover position, approximate) | m | map | boxwork_blog, msl_waypoints |

The image is the HiRISE colour mosaic by default, or the greyscale mosaic (`?imagery=grey`). The colour is not a true-colour claim. Any tint the app applies to the greyscale image is labelled "tinted greyscale". The thermal value is a ground brightness temperature from the REMS thermopile, not a contact temperature.

## Reproduce every screen

Add options to the address, for example `http://127.0.0.1:8642/?step=4&sources=1`. Options combine with `&`. The address follows the story, so the address of any screen opens that screen again.

| Option | Values | Effect |
|---|---|---|
| `?step=` | `1` to `5` | Open that story step: Place, Plan, Walk, Hazard, Check. Wins over `?view=`, `?t=` and `?hazard=` |
| `?sources=1` | `1` | Show the origin label of every number from the start |
| `?view=` | `walk`, `2d` | `walk` opens step 3; `2d` runs the story in the 2D fallback renderer |
| `?t=` | seconds, 0 or more | Opens the walk (step 3), paused at this replay time; with `?hazard=1` the scenario starts at this time |
| `?hazard=1` | `1` | Opens the hazard step (step 4) |
| `?panel=` | `limits`, `timeline`, `layers`, `stations`, `editor`, `rover`, `credits` | Opens Details on that tab (with step 2, or step 5 for `rover`) |
| `?layer=` | layer ids from the Layers table, comma separated; a leading `-` removes one | Adds those layers to the default ones (image, stations, no-go zones); `?layer=slope,-no_go` adds the slope layer and hides the no-go zones. Each step still sets its own layers |
| `?sheet=` | `route-card` | Open the printable route card once the route is planned |
| `?exag=2` | `2` | Vertical exaggeration of 2 (default is true scale) |
| `?imagery=grey` | `grey` | Greyscale mosaic instead of the colour mosaic |
| `?fps=1` | `1` | Show the measured frame rate |
| `?data=mock` | `mock` | Load the synthetic mock scene. Mock values are labelled "mock" on screen |

The review screenshots in `.impeccable/review/` are `?step=1` to `?step=5` at 1366 x 768 and 390 x 844, `?step=2` at 1920 x 1080, `?step=2&sources=1`, and `?step=2&panel=limits`.

## Known limits

- The orbit image is older than the rover's drive, so it shows no wheel tracks. Alignment is checked two ways: the rover's positions match the map grid within 3 mm, and the rover's heights match the terrain with a spread of about 0.1 m (65 positions). The heights may share a source with the terrain.
- Slope is measured over a 5 m baseline. A rover body tilt and a terrain slope are not the same quantity.
- The thermal value is a ground brightness temperature, not a contact temperature.
- UV values are lower bounds.
- Dose comes from RAD detector B. The daily value is derived by us.
- Weather and dose come from one station, at the rover's position.
- The colour band mix of the HiRISE mosaic is not stated by USGS.
- The frame-rate target is not yet measured on a 2020 laptop.
- There is no public link yet.

## Sources and licences

Every source, with its licence and credit text, is in `sources.json`. In short:

| Id | What | Licence as read |
|---|---|---|
| `image_25cm` | USGS MSL Gale orthophoto mosaic, 25 cm, v3 | USGS page: credit the authors, use constraints "None", no named licence |
| `usgs_gale_colour_2025` | USGS MSL Gale HiRISE colour mosaic (78 quads, sharpened), July 2025 | USGS: credit the authors, use constraints "None"; our derived files CC BY-SA 3.0 IGO |
| `dem_1m` | USGS MSL Gale DEM mosaic, 1 m, v3 | Same wording as the image |
| `hrsc` | HRSC data inside both USGS products | CC BY-SA 3.0 IGO |
| `rems` | MSL REMS RDR, chosen sol | NASA / PDS public data, no licence stated on the page |
| `rad` | MSL RAD RDR, chosen sol | NASA / PDS public data, no licence stated on the page; "Use of these data is at the user's own risk." |
| `donki` | NASA DONKI solar energetic particle event 2025-05-13 | Provided "as is", prototyping quality, no NASA endorsement |
| `msl_waypoints` | MSL rover waypoints | NASA / PDS public data, no licence stated on the page |
| `panorama` | PIA26559 Mastcam boxwork panorama | NASA content, acknowledge the source, no endorsement implied |
| `boxwork_releases` | NASA and JPL boxwork releases | NASA content, acknowledge the source |
| `boxwork_blog` | Curiosity blog on the boxwork drill sites | NASA content, acknowledge the source |
| `drats_2022` | NASA D-RATS 2022 Test Report | Cited only, nothing copied |
| `nasa_std_3001_v2` | NASA-STD-3001 Vol 2 Rev C | Cited only, nothing copied |
| `nasa_std_3001_v1` | NASA-STD-3001 Vol 1 Rev B, read through the NASA OCHMO brief | Cited only, nothing copied |
| `hassler_2014` | Hassler et al. 2014, Science | Cited only, nothing copied |
| `pena_asensio_2024` | Pena-Asensio et al. 2024 | Cited only, nothing copied |
| `three` | three.js r187, vendored (`vendor/three/VERSION.md`) | MIT |
| `font` | B612 typeface, self-hosted in `public/fonts/` (Intactile Design with Airbus, ENAC and ISAE) | SIL Open Font License 1.1, see `public/fonts/OFL.txt` |

The two USGS pages state no named licence for the image and terrain. Both products contain HRSC data, so we release every derived image, terrain and slope file under CC BY-SA 3.0 IGO. This is the cautious reading. See `DATA-LICENSE.md`.

## Credits

- Calef III, F. J., & Parker, T. (2016), USGS Astrogeology: MSL Gale Merged Orthophoto Mosaic and Merged DEM Mosaic, v3.
- Parker, T., & Calef III, F. J. (2025), USGS Astrogeology: MSL Gale HiRISE colour mosaic (78 quads, sharpened). HiRISE: NASA/JPL-Caltech/University of Arizona.
- ESA/DLR/FU Berlin (HRSC).
- NASA/JPL-Caltech/MSSS: PIA26559 panorama (resized by us).
- NASA/JPL-Caltech: rover waypoints, boxwork releases and blog.
- Gomez-Elvira, J., Mars Science Laboratory Rover Environmental Monitoring Station RDR Data V1.0, MSL-M-REMS-5-MODRDR-V1.0, NASA Planetary Data System, 2013.
- NASA Planetary Data System, MSL RAD RDR.
- NASA CCMC DONKI.
- three.js authors, MIT licence.
- B612 typeface, Copyright 2012 The B612 Project Authors (Intactile Design with Airbus, ENAC and ISAE), SIL Open Font License 1.1.

This project uses no NASA logo, flag or mission patch. NASA does not endorse it.

## Assumptions

No Mars number exists for a suited walk. Each number below carries the body it comes from. A value with no source is labelled "assumption".

| Number | Value | Body | Source and status |
|---|---|---|---|
| Slope cap | 15 degrees | Moon | Pena-Asensio 2024 (abstract read) |
| Distance from the crew rover | 2 km | Earth analog for a lunar rover | NASA D-RATS 2022 test report. The planner enforces it |
| Distance between the two astronauts | 100 m | Earth analog for a lunar rover | NASA D-RATS 2022 test report |
| Total time in suit | 14 hours | Not surface-specific | NASA-STD-3001 Vol 2 Rev C, note under Table 35 |
| Walking speed | 0.7 m/s | Assumption | No sourced value. Set in the editor, labelled "assumption" on screen |
| Work time per station | 25 min | Assumption | No source. Set in the editor, labelled "assumption" on screen |
| Distance between the two astronauts on the walk | 20 m | Assumption | No source. The 100 m limit above is sourced; this planned spacing is not |
| Hazard scenario start | 150 min after the walk starts | Assumption | No source. Replay of a scenario, not a prediction |
| Walk start | 09:00 local Mars time on sol 4600 | Assumption | No source |
| Eye height in the walk view | 1.7 m | Assumption | No source |
| Cosmic ray dose rate | 0.210 +/- 0.040 mGy/day | Mars, Gale, 2012 to 2013 | Hassler 2014. Used only if the per-sol RAD file cannot be read |
| Dose equivalent rate | 0.64 +/- 0.12 mSv/day | Mars, Gale, 2012 to 2013 | Hassler 2014. For the comparison with the career limit |
| Career dose limit | 600 mSv | All | NASA-STD-3001 Vol 1 Rev B, read through the NASA OCHMO brief |

Other assumptions that are ours and stay labelled on screen:

- The base is a parked pressurized crew rover at the Curiosity position of sol 4534.
- The terrain file states about 100 m horizontal and about 1 m vertical accuracy (HRSC controlled to MOLA). Relief of about 1 m is at the edge of that stated accuracy.
- The solar particle event was measured near Earth. It is replayed as a scenario. Arrival at Mars is not claimed.
- The caution state starts when a margin drops under 20 percent. This is a design choice, not a NASA value.

## Walk inputs

Stations, no-go zones, tasks, walking speed, work time per station, partner spacing, hazard start and walk start time live in `public/data/team-inputs.json`. Values with no source are labelled "assumption" on screen. They can be changed in the editor or in the file. Editor changes are kept in this browser and win over the file until you press "Reset to the built-in inputs" in the editor. A second committed copy, `public/data/team-inputs.default.json`, is what the app loads when the edited file has a bad field and you choose "Continue with the committed inputs".

## Design model

- Station naming and the printable route card follow the Apollo traverse maps and cuff checklists.
- Traverse planning follows the model of the Artemis traverse planning work.
- These are models for the layout and the way of working. Nothing from those documents is copied.

## Interface rules

The helmet view is designed against named NASA human-systems rules. It was not tested with astronauts, and nobody on the team can test a suited user.

Sources read: NASA-STD-3001 Vol 2 Rev C and the D-RATS 2022 report. Not read: NASA-STD-3001 Vol 2 chapter 10, the Human Integration Design Handbook (NASA/SP-2010-3407) and the NASA SUITS challenge descriptions. A rule is cited to a source only after that source was read. Every rule below is a design choice, except where a read source is named.

| Rule | Status |
|---|---|
| At most three actions (next, acknowledge, return to rover), each a large target and a key; no drag, hover, scroll or typing | design choice |
| Bright strokes on a clear centre, no filled panels over the terrain, large text, high contrast | design choice |
| At most six items in fixed places; order: warning, bearing and distance, time margin, science | design choice |
| Margins, not raw values: suit time left against 14 hours (NASA-STD-3001 Vol 2 Rev C, read), distance to rover against 2 km and to partner against 100 m (D-RATS 2022, read) | the three limits are sourced; showing margins is a design choice |
| SI units only, one temperature unit, dose with its time base, sol and local Mars time on every measured value | design choice |
| Red means return now, amber means caution, each with an icon shape and a word, never colour alone | design choice |
| Missing data shows "NO DATA" with dashes, never zero and never a silent old value; the planner says "no route" and names the blocking limit | design choice |
| True vertical scale by default, with a labelled 2x switch | design choice |

## AI use

- Claude (Anthropic), through Claude Code, wrote the code, the data scripts and this README.
- No image in this project is AI-made. The only images are the USGS orbit images and resized NASA images. Interface icons are inline SVG written for this project.
- Each AI-written commit says so in its message. Each generated script carries the header "AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project."
- A fuller AI-use statement is added before submission.

## Project licence

- Code: Apache-2.0, see `LICENSE`.
- Derived image, terrain and slope files: CC BY-SA 3.0 IGO, see `DATA-LICENSE.md`.
- three.js: MIT, see `vendor/three/LICENSE`.

## Rebuild the data

The data files in `public/data/` and `public/media/` are cut by scripts in `tools/` from files that are downloaded to a folder outside the repository. Downloaded files are treated as untrusted data and are read only by scripts run as `tools/.venv/bin/python -I`. The setup (numpy and Pillow, hash-verified) is in `tools/README.md`. The panorama is made by `tools/fetch_panorama.py`.

Checks: `python3 -I tools/check_readme.py` (add `--final` before the hand-in, which also fails on any open-item marker left in the sources or the text).
