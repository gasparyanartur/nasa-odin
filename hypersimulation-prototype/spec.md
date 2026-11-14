# Marswalk at the Gale boxwork - product spec

Status: DRAFT v4 for Arda's approval, 2026-11-14.
- v2: fixes from a premortem review.
- v3: the challenge's optional considerations (section 4a).
- v4: Arda's quality bar of 2026-11-14 ("high-resolution, high-quality, and something that the astronauts can actually use"), after a design discussion with a second reviewer. Main changes: a 3D terrain scene as the core, 25 cm image, our own data files in place of live NASA tiles, interface rules for a suited user, and a quality gate (section 8).

Origin of the idea, stated plainly: the team's idea is a Mars map, a route planner and a helmet display (Arda, 2026-11-14). An AI assistant tested that idea against the available NASA data and recommended to narrow it to one walk at one place; Arda approved that direction on 2026-11-14. The science goal in section 2 is a proposal that the team must confirm or change. The rule to respect: AI must not come up with the idea of the solution, and AI use is described in the submission form.

Team sign-off (to fill): science goal confirmed by ________ on ________; stations picked by ________; one human-only task per station written by ________.

Challenge: NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map". Sources for every data claim: `resource-catalogue.md` (sections 3, 8, 10, 11). Rules: `challenge-brief.md` and `submission-checklist.md`.

## 1. What we build, in one paragraph

A web app that plans and then replays one astronaut walk at the boxwork ridges on Mount Sharp in Gale crater. Its core is one 3D scene of the walk area: the real terrain shape at 1 m, covered with the real orbit image at 25 cm. Seen from above, the scene is the plan map. Seen from eye height, it is the view behind the helmet display. The crew plans a route through science stations, checks it against named limits, and replays the walk with values that Curiosity measured on a named Mars day at its own position in this area.

## 2. Science goal of the walk (PROPOSED, team confirms)

Background from NASA and JPL releases (catalogue section 3.8): the boxwork ridges are 1 to 2 m tall; orbit images show ridges 10 to 20 km long; NASA reports clay in ridge rock and carbonate in hollow rock; Curiosity drilled at three sites (Altadena, Valle de la Luna in a hollow, Nevado Sajama on a ridge) in campaign phases 1 to 3, sols 4534 to 4805.

Goal: test if the ridge and hollow difference holds across several ridge and hollow pairs in the walk area. Some stations lie on the rover path, where rover data exists. Some lie off the path, where a human adds new samples.

Each station carries one task that a human does and Curiosity could not do in the same time. The team writes these tasks. They are the answer to "why send a person".

Open: which mineral was found at which drill site is not in our files. Read the NASA releases before any per-site claim goes on screen.

## 3. The demo story

(Added 2026-11-14, Arda's decision: the app opens as a guided story, one step per screen with a large Next button, in the five steps below. All detail panels sit behind one Details button.)

1. **The place:** the 3D scene of the ridges, tilted, at full detail. This is the first image of the demo.
2. **Plan:** the crew switches data layers, sees stations and no-go zones, gets a route, and reads the constraints table and the route card.
3. **Walk:** the camera drops to eye height and follows the route. The helmet display sits on top: bearing and distance to the next station, margins, measured conditions, and the station card on arrival.
4. **Hazard:** a recorded solar particle event arrives as a scenario. The display turns to "return now" and shows the way back to the crew rover.
5. **Check against the rover:** the Curiosity path on the same scene, and how well our slope data agrees with the tilt that the rover measured.

The demo for the form is 30 seconds of video or 7 slides. Judges may never open the app, so the first 10 seconds or the first two slides must show step 1, a station card and the hazard return. The team decides the format.

## 4. Scope

### Definitions

- **Walk area:** a core of about 1 km by 1 km around lon 137.383, lat -4.803, inside a surround of about 2 km by 2 km. The 65 rover waypoints of sols 4534 to 4805 lie in 0.43 km by 0.66 km inside the core.
- **Base:** a parked pressurized crew rover, the start and end of the walk. PROPOSED position: the Curiosity position on sol 4534. An assumption, labelled on screen.
- **Chosen sol:** one Mars day inside sols 4534 to 4805 whose weather and dose files exist. All "measured" values come from that sol.
- **Station:** a science stop picked by a team member on the image, marked ridge or hollow, named "Station 1, 2, ..." as on Apollo traverse maps.
- **No-go zone:** an area marked by a team member as an obstacle (large rocks, scarps), plus every cell above the slope cap.
- **Margin:** a limit minus the current value. The displays show margins.

### In

| Part | Content | Proven today |
|---|---|---|
| Image | Cut from `MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif` (USGS, 24.4 GB, 0.25 m, greyscale). Core at 25 cm, surround at 1 m. Our own files, hosted with the app | File exists, readable in pieces; three tiles at the ridges hold real pixels (second reviewer). Licence page not read |
| Terrain | Cut from `MSL_Gale_DEM_Mosaic_1m_v3.tif` (USGS, 3.9 GB, 1 m). Core mesh at 1 m, surround at 4 m | Readable; heights at the rover box run -3,661 to -3,573 m; small-scale relief of about 1 m is present. Not proven that this relief is the ridges |
| Slope | Computed from the terrain cut | - |
| Thermal | REMS ground temperature by hour, chosen sol (MSL) | Folders for sols 4489 to 4843 exist; files not opened |
| Atmospheric | REMS air temperature, pressure, UV in one "conditions on sol N" panel | Same |
| Radiation | RAD dose for the chosen sol (MSL) | Folders to sol 4843 exist; units not captured |
| Space weather | The solar particle event of 2025-05-13 from NASA DONKI, replayed as a scenario | Event exists; measured near Earth; arrival at Mars is not claimed |
| Mineral findings | Markers at the three drill sites with what NASA reported. Not a map layer | Positions approximate |
| Stations | 6 to 8, picked by the team; each with a ridge or hollow tag, one human-only task, and a station card | - |
| Station card | Photo, task, measured conditions, and for on-path stations the rover photo picked by hand. The 360-degree Mastcam ridge panorama of May 2025 as one credited image | Photos not yet picked |
| Obstacles | No-go zones from the team plus the slope cap | - |
| Route planner | Lowest-cost path through the stations in a fixed order on the slope grid, inside 2 km of the crew rover | - |
| Constraints table | One row per limit: value, limit, source, pass or fail, assumption flag. It replaces a single go or no-go verdict | - |
| Route card | A printable page: per leg the bearing, distance, climb, steepest slope and time. It works when the display fails | - |
| Helmet display | Eye-height camera over the terrain with the display on top; section 5a rules | - |
| Rover check | Curiosity path as a layer; share of the path under the slope cap; our slope at each waypoint against the rover's own measured tilt (the path file carries `pitch`, `roll`, `tilt`) | Fields exist in the path file; comparison not run |
| Documentation | README from the first build step: sources, licences, credits, assumptions table, AI-use statement | - |

Data kinds: optical, topographic, thermal, atmospheric, radiation, space weather. The challenge suggests at least three. NASA missions: MRO (image, terrain), MSL (weather, dose, photos, path), the solar missions behind DONKI. The terrain file also holds ESA HRSC data.

### 4a. The challenge's optional considerations

| Consideration | In the spec |
|---|---|
| Display format | Plan view and helmet display. No tablet view |
| Static, interactive, or a tool for other places | Interactive, one place. The data scripts take the area as an input; no second place is built or claimed |
| Maps from other NASA missions as a model | Station naming and the route card follow the Apollo traverse maps and cuff checklists; the README names them and the Artemis traverse planning work as the model |
| Time frame | A named past sol for weather and dose |
| Point-of-view images | Station cards with rover photos and the Mastcam panorama; the eye-height view over real terrain |
| Rovers, or astronauts in pairs | Base is a crew rover with a 2 km limit; two astronauts within 100 m of each other (NASA D-RATS 2022, Earth analog for a lunar rover) |

### Out

- A planet globe, planet-wide layers, routes between any two points on Mars. This drops the globe of the team's first idea; the reason is that every hour goes into the walk area. Arda can overrule this.
- (Changed 2026-11-14.) Colour imagery was out when this spec was written, because the only colour strip known then missed the rover path. A July 2025 USGS colour mosaic was found later and passed every check (catalogue section 12): the app now uses it as the default image, with the greyscale mosaic as a second mode. USGS does not state the band mix, so the app never calls it true colour.
- Live data, real augmented reality, health monitoring. The helmet display is a labelled simulation.
- A mineral map, machine-learning rock detection, ice maps, a second site, accounts, a server.
- Live calls to NASA services while the app runs. Judging runs into December; the app must work if a NASA service is down.

## 5. Honest numbers (shown in the app and the README)

No Mars number exists for a suited walk. Each number carries the body it comes from.

| Number | Value | Body | Source and status |
|---|---|---|---|
| Slope cap | 15 degrees | Moon | Pena-Asensio 2024 (abstract read) |
| Distance from the crew rover | 2 km | Earth analog for a lunar rover | NASA D-RATS 2022 test report. The planner enforces it |
| Distance between the two astronauts | 100 m | Earth analog for a lunar rover | NASA D-RATS 2022 test report |
| Total time in suit | 14 hours | Not surface-specific | NASA-STD-3001 Vol 2 Rev C, note under Table 35 |
| Walking speed | Set by the team | Assumption | No sourced value |
| Work time per station | Set by the team | Assumption | No source |
| Cosmic ray dose rate | 0.210 +/- 0.040 mGy/day | Mars, Gale, 2012 to 2013 | Hassler 2014. Only if the per-sol RAD file cannot be read |
| Dose equivalent rate | 0.64 +/- 0.12 mSv/day | Mars, Gale, 2012 to 2013 | Hassler 2014. For the comparison with the career limit |
| Career dose limit | 600 mSv | All | NASA-STD-3001 Vol 1 Rev B, read through the NASA OCHMO brief |

Rule: no invented metric. A value with no source is labelled "assumption" and is set by a team member, not by the builder.

## 5a. Interface rules for a suited user

Wording for the submission: "designed against named NASA human-systems rules". Not "tested with astronauts"; nobody on the team can test a suited user.

Sources we hold: NASA-STD-3001 Vol 2 Rev C and the D-RATS 2022 report. Sources named from memory and not yet read: NASA-STD-3001 Vol 2 chapter 10 "Crew Interfaces", the "Human Integration Design Handbook" (NASA/SP-2010-3407), the NASA SUITS challenge descriptions. A rule is cited to a source only after that source is read; until then it is listed as a design choice.

- **Input:** the helmet view has at most three actions (next, acknowledge, return to rover). Each is a large target and a key. No drag, hover, scroll or typing.
- **Glare:** bright strokes on a clear centre; no filled panels over the terrain; large text; high contrast.
- **Attention:** at most six items in fixed places. Order: warning, bearing and distance, time margin, science.
- **Margins, not raw values:** suit time left against 14 hours, distance to rover against 2 km, distance to partner against 100 m.
- **Units:** SI only, one temperature unit, dose with its time base, sol and local Mars time on every measured value.
- **Hazards:** red means return now, amber means caution, each with an icon shape and a word. Never colour alone.
- **Missing data:** "NO DATA" with dashes, never zero and never a silent old value. A substitute shows its source and date. The planner says "no route" and names the limit that blocks it.
- **Vertical scale:** true scale by default; a labelled 2x switch. Ridges of 1 to 2 m look flat at true scale, and an unlabelled stretch is an invented picture.

## 6. How it is built (decided by the builder, for the record)

- A static web app in English. No server. A static host gives the public link from the first build step.
- One 3D scene in local metres with three.js (licence file to be read and named first). The default camera looks straight down, so the same scene is the plan map. No globe library and no 2D map library.
- Scene budget: core 1 km at 25 cm image and 1 m mesh; surround at 1 m image and 4 m mesh; image split into textures of 2,048 px; half resolution on phones.
- Fallback: a device with no 3D support, or a failed speed test, gets a top-down 2D image view built from the same files. Never a blank page.
- Data is cut ahead of time by scripts in the repository (Python with numpy and Pillow; no GDAL needed, per the second reviewer's test). Every number traces to its NASA file.
- Route planner: A* search on the slope grid, in the browser.
- Visual design goes through the full frontend design pipeline, started on mock data while the data is cut.
- Only KEEP-list sources from catalogue section 8.
- Licences: a named open licence for the project from step 1. The terrain file contains HRSC data (CC BY-SA 3.0 IGO, credit ESA/DLR/FU Berlin), so the terrain and slope files we derive carry that ShareAlike licence. The image file's licence page is read in step 0 before any cut is published.
- AI use: each AI-written commit says so in its message; the README has an AI-use section.

## 7. Build order (riskiest unknown first)

0. **Data.** Cut image, terrain and slope files for the walk area. Check that the 65 waypoints sit on the visible rover tracks within 2 m and that the path file heights agree with the terrain within a stated tolerance. Open one REMS and one RAD file for a campaign sol, record fields and units, fix the chosen sol. Read the licences (image file, three.js). In parallel: visual design on mock data.
1. **3D scene test** on the weakest laptop available and on a phone, with the README and the public link. If it fails the speed test, the 2D fallback becomes the core and the remaining steps continue on it.
2. **Stations, no-go zones, planner, constraints table, route card.**
3. **Helmet display replay, hazard scenario, return path.**
4. **Rover check layer.**
5. **Quality gate** (section 8), README final, demo material.

Minimum entry: steps 0 to 3 plus step 5. If time runs short, cut step 4 first.

## 8. Quality gate: what "done" means

Product:
- A public link opens the app with no login. A team member tests it in a private window in Chrome and Firefox.
- All demo story steps that were built work in one run without a reload.
- The planner returns a route through all stations that stays out of every no-go zone and inside 2 km of the rover, or says "no route" and names the blocking limit.
- (Changed 2026-11-14, Arda's decision after he used the app: the labels made the screen cluttered.) Every number on screen has a unit and carries one of: source with sol, "assumption", or "scenario". The label shows when "Show sources" is on, and always in the Details view. One automated check proves that every number carries its label.
- The README lists every source with licence and credit, the assumptions table, the project licence, and the AI use. Its layer count equals the working layer count.
- `submission-checklist.md` passes, apart from the steps only the team can do.

Polish (each line is a test):
1. First usable view within 3 seconds on a 10 Mbit/s line, with a progress state while the terrain loads.
2. With trek.nasa.gov, the PDS sites and DONKI blocked in the browser tools, every screen still works.
3. 30 frames per second or more on a 2020 laptop with built-in graphics; with no 3D support the 2D view loads.
4. The rover waypoints sit on the visible tracks within 2 m.
5. Every layer has a legend with units and an on-screen credit.
6. Empty, loading, error and "no route" each have a designed screen; no console errors in a full run.
7. The full demo story runs by keyboard only and by touch only, with visible focus.
8. The layout works at 1366 x 768, 1920 x 1080 and 390 x 844 with no overlap and no sideways scroll.
9. One type family, one size scale, one colour set on all screens; no default browser controls and no default library markers.
10. Every screenshot in the demo can be made again from the public link.

## 9. What the team does, not the builder

- Confirm or change the science goal and sign the line at the top.
- Pick the stations, mark the no-go zones, write one human-only task per station.
- Set walking speed and work time per station.
- Confirm the photos picked for the station cards.
- Record the demo, fill the form, tick the two declaration boxes, submit.
- Say when the repository goes public.

## 10. Known risks

| Risk | Effect | Answer |
|---|---|---|
| The 3D scene is slow on a judge's device | Blank or stuttering first view | Speed test in step 1; 2D fallback from the same files |
| Image and terrain are misaligned by metres | Visible error at 25 cm | Waypoint-on-tracks check in step 0 |
| The 1 m relief is not the ridges | Ridges look flat | True scale by default with a labelled 2x switch; the 25 cm image shows the ridges in any case |
| RAD or REMS file format unclear | Wrong values | Read the format document in step 0; else the published averages with their dates |
| Team inputs arrive late (stations, tasks, speeds) | Planner and cards half-built | The builder places clearly labelled placeholder stations so the build does not wait; the team replaces them |
| Weather and dose come from one station | A critical judge sees a viewer, not a mission tool | Honest wording; margins and the constraints table; one human-only task per station |
| The site is the challenge's own example | Other teams pick it too | 25 cm and 1 m depth, measured data, the rover tilt check, interface rules |
| The demo hides the product | Judges see 30 seconds or 7 slides only | Demo opens with the scene, a station card and the hazard return |
| The idea is judged as AI-made | Rule breach | The team confirms the goal, picks stations, writes the tasks, sets the assumptions, and describes the AI use in the form |
