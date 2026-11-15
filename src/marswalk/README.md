# Marswalk parts for Martian Map

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project. Status: typed, tested modules with data. Nothing here is wired into the UI yet.

These modules bring the parts of the Marswalk app (Arda's prototype) that Martian Map did not have: presets, science stops with tasks, hatched no-go zones, the solar particle event scenario, the sourced suit limits and saved walked paths. They are pure TypeScript with no React, no Cesium and no network calls. Data files sit in `public/marswalk/`.

## The coordinate frame

Marswalk and the team Boxwork package share one origin (137.38299966521333 E, 4.802997938337184 S, planetocentric, radius 3396190 m). Marswalk stores projected metres (equirectangular, standard parallel 0). The team app stores ground metres east and north. The link is `x_team = x_marswalk * 0.9964884795347444` (the cosine of the origin latitude, `ground_scale.x` in `public/boxwork/detail/scene.json`) and `y_team = y_marswalk`. This is the same rule `scripts/prepare_boxwork.py` uses for `public/boxwork/evidence.json`.

`stops.test.ts` proves it three ways: the direct rule, a round trip through Mars longitude and latitude with the team's own `geoToLocal` and `localToGeo`, and the NASA waypoint longitudes and latitudes, which land within 1 cm of the converted Curiosity path and match `evidence.json`. Every stop, the crew rover and both placed drill sites lie inside the 1 km prepared area on valid terrain. Every JSON point also keeps its original Marswalk coordinate (`marswalk`), so a reviewer can check any value.

## Modules

**`frame.ts`** converts between the two frames and measures distances (point to segment, point to polyline). Use it for any new Marswalk value. Origin: the two scene files named above.

**`presets.ts`** ports the Marswalk feature switches, groups and the missions Geology walk, Safety watch, Water and chemistry search and Custom. Regions are the team's three: Gale Bradbury, Gale Boxwork and Jezero. Each feature keeps `info` and `source` and has an `availability` entry per region with a note; `EVIDENCE.md` lists the files behind every entry. A setup keeps the user's choices and `effective()` shows a feature only where its data exists. A Custom choice therefore survives a region change. Presets change only through `pickMission`, `pickRegion` or `toggleFeature`, never by stop. To wire: keep a `Setup` in state (and in localStorage through `normal()` on load), render `FEATURES` grouped by `GROUPS` with an info mark per row, then feed `overlaysFor(setup)` into the overlay settings and `hudPatch(setup)` into `HudSettings`. Licence line: feature text is project code (the team's licence); each `source` names the data owner.

**`stops.ts`** with `public/marswalk/stops.json` holds the eight Boxwork science stops (full `task` plus a `short` of at most six words for the helmet), the crew rover base and the three drill sites. Valle de la Luna has `x: null, y: null`, because NASA did not publish its position. Stop positions and tasks are Marswalk team choices (`origin: "assumption"`); the relief values come from the USGS 1 m terrain. Drill sites are the Curiosity rover position on the named sol (NASA Curiosity blog and NASA/JPL MMGIS waypoints). To wire: draw `STOPS` as map marks (filled square for a ridge, open square for a hollow), show `task` on the tablet and `helmetLine(stop, i, n)` in the helmet. Data: Marswalk `public/data/team-inputs.default.json`, commit d2ed7bb0.

**`hazards.ts`** with `public/marswalk/hazards.json` holds the two marked no-go zones as polygons: "Scarp edge west of the boxwork" (`scarp_edge`) and "Dark loose material, footing unknown" (`loose_ground`). Both are drawn by the Marswalk team, so `origin` is "assumption". `LEGEND` maps each hatch id to its danger: one hatch per zone kind, plus the two slope hatches of Marswalk (10 to 15 degrees caution, above 15 degrees blocked). `toRestrictions(zones, budget)` turns the polygons into the circles the team planner accepts (`server/app.py`: radius 5 to 500 m, at most 30 per request). Each circle circumscribes a grid cell that touches the zone, so together they cover every zone completely. The test checks this, and checks that no circle reaches a stop or the crew rover. To wire: pass `budget = 30 - (user restrictions + field restrictions)`. With the full budget of 30 the zones take 29 slots, on a 31 m grid with circles of 21.93 m radius, so a circle can block open ground up to two radii (43.86 m) beyond a zone edge. Add `plannerExclusions(r)` to `settings.exclusions` and draw the polygons with their hatch, never the circles.

**`storm.ts`** is the solar particle event scenario: the DONKI event `2025-05-13T18:14:00-SEP-001`, measured near Earth and replayed at 150 min into the walk (an assumption). The pure functions are `advance` (trigger plus fade), `dismiss`, `reopen`, `cancelReturn`, `resumeReturn` and `message`. The warning card fades to the side list after `AUTO_FADE.value` = 10000 ms. That value is the team's "about 10 seconds" from the review call of 2026-11-15, a design choice. Every message carries `label: "scenario"`. To wire: call `advance(state, elapsedS, Date.now())` on each mission clock tick, show the card while `warning === 'shown'`, list it while `'listed'`, and request the way back from the return route API while `returning` is true. Licence line: DONKI is provided as is, at prototyping quality, with no NASA endorsement.

**`limits.ts`** holds the four sourced suit limits, each with value, unit, body and source text:

- 2000 m from the crew rover (NASA D-RATS 2022).
- 14 h total time in the suit (NASA-STD-3001 Vol 2 Rev C, note under Table 35).
- 100 m between the two astronauts (NASA D-RATS 2022).
- 15 degree slope cap (Pena-Asensio et al. 2024, a Moon value).

`checkPath` checks a walked or planned path against them. A missing input reads "no data", never a pass. The caution state at a margin under 20 percent is a Marswalk design choice. To wire: pass the route points or the walk samples, the crew rover position, the partner distances if measured, and `slope: {at: p => sample(data, p)?.slope, stepM: data.meta.stepM / 2}`. Only cited sources are used; nothing is copied from them.

**`pathlog.ts`** with `public/marswalk/curiosity-path.json` saves walked paths and compares them with a reference. Use `startWalk`, `appendSample` (ordered, finite, no repeats), `closeWalk`, `saveWalk`, `listWalks` and `deleteWalk`. Storage sits behind `WalkStore`. `localStore()` falls back to memory when the browser blocks storage or a write fails, and it reports `persistent: false`. `compareWithReference` returns the maximum and mean separation in metres from each sample to the reference line. The Curiosity reference path covers sols 4534 to 4805 (65 points, NASA/JPL MMGIS MSL waypoints, cut by Marswalk). To wire: append the HUD pose on each step, close the walk on return, then show the walk list and its separation from `curiosityLine()` or from another saved walk on the tablet. Licence line: NASA/PDS public data, no licence stated on the source page.

## Tests

`npx vitest run src/marswalk`. The tests read `public/boxwork/` and `public/marswalk/`.

## Open questions

- Geology for Boxwork: the Gale geology extract geographically contains the Boxwork site, but the team app keys it to Bradbury only. Should Boxwork show it too? Until then it is "not available" there.
- Restriction budget: covering both zones takes 29 of the 30 planner circles and still over-covers the edges. A polygon restriction in the planner would be exact and free the slots. This needs a server change, which is outside this folder.
- A radiation hazard area was proposed in the team call. No source gives a radiation area at the Boxwork, so none exists here. The radiation danger is the time-based scenario in `storm.ts`.
- The second zone hatch (`hatch-loose`) and the 10 degree caution step are design choices with no source.
- Career dose (600 mSv, NASA-STD-3001 Vol 1 Rev B via the OCHMO brief) is a Marswalk limit too. It is not ported here because it is a dose limit, not a walk limit.
