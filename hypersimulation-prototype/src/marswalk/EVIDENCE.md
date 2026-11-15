# Feature availability per region - evidence

AI-written (Claude, Anthropic). Each line names the file in this repository that the `availability` field in `presets.ts` rests on. Regions: Bradbury = `gale-bradbury`, Boxwork = `gale-boxwork`, Jezero = `jezero` (`src/datasets/catalog.ts`).

## Planning and walking

- `src/datasets/catalog.ts`: Bradbury and Boxwork have `capabilities: {plan: true, walk: true}` and a `terrain` package; Jezero has `{plan: false, walk: false}` and no terrain. Every feature that needs terrain, a route or the helmet view is therefore off in Jezero.

## Map and terrain

- Orbit image: `OVERLAYS` in `src/datasets/catalog.ts` gives Bradbury the greyscale USGS orthophoto ("0.25 m source posts, prepared for display"). Boxwork has HiRISE colour and grey (`public/boxwork/ortho.jpg`, `ortho-grey.jpg`, `detail/scene.json` imagery). Jezero has only the global CTX map.
- Height and slope: `public/gale/manifest.json` (5 m prepared grid, 2 km) and `public/boxwork/manifest.json` (1 m core posts, 5 m analytical grid, 1 km). None for Jezero.
- No-go zones: the two marked zones exist only in the Marswalk data for Boxwork (`public/marswalk/hazards.json`). Bradbury has no marked zones; its planner still applies the slope limit (`server/planner.py`, `permitted`).

## Air and sky

- `public/boxwork/environment.json`: sol 4600, hourly air temperature, ground brightness temperature, pressure, UV lower bound, RAD detector B.
- `public/gale/environment.json`: sol 10, hourly air temperature, pressure and wind fields; no ground temperature and no UV; RAD detector E mean.
- Jezero: `src/StationHistory.tsx` says "Jezero has orbital coverage; a local weather record is not bundled."
- Space weather is a replayed scenario (`storm.ts`), tied to a walk, so it follows walk capability.

## Rocks and science

- Geology units: `public/science/geology.json` has `regions` for `gale-bradbury` (6 units, 8 contacts) and `jezero` (7 units, 13 contacts), none for `gale-boxwork`. `src/GeologyPanel.tsx` shows "The bundled regional geological extract does not cover this site" when the region key is missing. The Gale extract bounds (135 to 140 E, 7 to 2 S) would contain the Boxwork origin, but the app does not use it there; that is an open question, not a feature.
- Ground composition: `public/environment/catalog.json` layers `grs-k`, `grs-th`, `grs-h2o` (Mars Odyssey GRS, unsmoothed 5 x 5 degree bins, global). Available in every region at that coarse scale.
- Stops with tasks and drill sites: Marswalk data for Boxwork only (`public/marswalk/stops.json`). The team app already draws two drill markers for Boxwork from `public/boxwork/evidence.json`. Bradbury has the team science targets Rocknest and Yellowknife Bay (`public/science/geology.json` `targets`), a different feature.
- Curiosity path: `public/boxwork/evidence.json` and `public/marswalk/curiosity-path.json`, sols 4534 to 4805, Boxwork only.

## Records

- 19 sols and next-sol outlook: `public/environment/catalog.json` `history` (sols 10 to 28, Curiosity at Gale, Bradbury area) and `forecast` (issue sol 28, target sol 29). `src/App.tsx` applies a history snapshot only when the region is `gale-bradbury`. Boxwork has a single sol (4600).
- Day timelapse: `src/mission/ScenarioTimeline.tsx` plays the hourly `environment.weather` of the loaded terrain package, so Bradbury (sol 10) and Boxwork (sol 4600).

## Routes and wider area

- Route comparison and replan: `RouteResult.routes` with return routes and restrictions in `src/mission/data.ts`; backlog FR-009 and FR-011 complete (`docs/backlog.md`). Needs planning, so Bradbury and Boxwork.
- Larger area and corridors: backlog FR-021 "Requested". Not built.
- Global maps: `public/datasets/viking.json`, `mola.json`, `ctx.json` are global (bounds -180 to 180), and every region lists all three in `basemapIds`.

## Helmet view

- Compass and next stop: `src/mission/Visor.tsx` (compass track, next waypoint), backlog FR-005 complete.
- Mars and Earth clocks: `MissionClocks` in `src/mission/HudSettings.tsx` (LMST and live Earth UTC), backlog FR-018 complete.
- Chemical and moisture markers: backlog FR-020 "Requested". Not built.

## Notes

- Field notes, readings and obstacles: `src/field/model.ts` `KINDS` (note, unit, contact, obstacle, temperature, radiation) with `regionId` `gale-bradbury` or `gale-boxwork`; backlog FR-016 complete. No Jezero.
- Voice notes: backlog FR-022 "Requested". Not built.
