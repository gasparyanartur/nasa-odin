# Feature backlog

Preliminary feature ideas. Requests remain unprioritized unless linked to an implementation plan. The [0.2 release](plans/2026-11-14-next-version.md) and [0.3 science release](plans/2026-11-14-science-release.md) each implement five selected features locally; public deployment remains on the [current roadmap](plans/2026-11-13-hackathon-roadmap.md).

See the [feasibility assessment](research/2026-11-13-backlog-feasibility.md) for data sources, implementation constraints and a suggested order.

The [0.6 environmental release](plans/2026-11-14-environment-release.md) adds numeric maps, multi-sol records and evaluated simulated outlooks for FR-003/004/008. See [data coverage and model limits](environment-data.md).

| ID | Feature request | Notes | Status |
| --- | --- | --- | --- |
| FR-001 | Mars-looking Mars | Viking color basemap; warmer surface, sky and fog. Local color/lighting remain illustrative. | Complete · [0.2](plans/2026-11-14-next-version.md) |
| FR-002 | Geological map | Add selectable, inspectable geological units and contacts with a legend and source information. Support geological science target selection (FR-010). The 0.3 release supplies regional USGS context at 1:20M; precise local contacts remain limited by source scale. | Complete · [0.3](plans/2026-11-14-science-release.md) |
| FR-003 | Radioactivity map | Global GRS potassium/thorium composition bins plus separate historical RAD detector-rate site observations. Preserve source scale, uncertainties and gaps; composition is not astronaut exposure. | Complete · [0.6](plans/2026-11-14-environment-release.md) |
| FR-004 | Temperature map | Dated MCS surface-temperature soundings and multi-sol REMS air-temperature site observations, with inspection, units, time and coverage. | Complete · [0.6](plans/2026-11-14-environment-release.md) |
| FR-005 | Astronaut-realistic HUD overlay | Optional visor compass and next-waypoint cue, using simulated mission position. | Complete · [0.2](plans/2026-11-14-next-version.md) |
| FR-006 | Resolution option for the simulation | Three drawing-resolution presets; preserve measured terrain, collision and route resolution. | Complete · [0.2](plans/2026-11-14-next-version.md) |
| FR-007 | Timelapse | Play/pause/scrub the bundled Sol 10 hourly site observations; bounded history with a shared departure/mission clock. | Complete · [0.2](plans/2026-11-14-next-version.md) |
| FR-008 | Simulated forecast for radioactivity and temperature | Next-sol air-temperature and RAD detector-rate profiles fitted to prior historical sols; show held-out errors, training spread and unknown hours. No solar-event or spatial exposure prediction. | Complete · [0.6](plans/2026-11-14-environment-release.md) |
| FR-009 | Conditions affect route planning | Evaluate two terrain candidates plus dwell/return, compare 24 departures, and recommend using configured limits. Full environmental path optimization remains later scope. | Complete · [0.2](plans/2026-11-14-next-version.md) |
| FR-010 | Geological science target selection | Use geological data to help users identify and compare scientifically interesting locations, such as mapped units or contacts. Explain what each target could help investigate, the supporting evidence and uncertainty; let users select it as an excursion destination. Depends on FR-002 and suitable local data coverage. | Complete · [0.3](plans/2026-11-14-science-release.md) |
| FR-011 | Explainable route comparisons | Link elevation/slope profiles and highlighted map sections to route metrics. Explain why alternatives differ and which configured constraints or conditions affect the result. Use computed differences rather than generic recommendations. | Complete · [0.3](plans/2026-11-14-science-release.md) |
| FR-012 | Guided demo entry | One-click entry into a curated Gale example with a geological science objective, prepared endpoints, useful layers and sensible assumptions. Guide users through inspecting the map, comparing routes and entering the surface view; retain free exploration and an easy reset. | Complete · [0.3](plans/2026-11-14-science-release.md) |
| FR-013 | Simulated restriction and replanning | Let users introduce a clearly labeled simulated exclusion, recompute routes and compare the original and revised paths, distance, time and relevant constraints. Explain what caused the change; distinguish declared restrictions from measured hazards. | Requested |
| FR-014 | Explainable map data and provenance | Make observations, derived layers and scenario assumptions distinguishable. Inspection should show sources, units, acquisition/model time, coverage, resolution and uncertainty, plus why a layer matters to target selection or routing. | Complete · [0.3](plans/2026-11-14-science-release.md) |
| FR-015 | Reliable public demo | Publish and verify the integrated app, including a direct prepared-example entry, startup/loading feedback, failure recovery and a public recording fallback. Verify fresh-browser access and startup after inactivity. Extends the existing publish-and-present milestone in the [roadmap](plans/2026-11-13-hackathon-roadmap.md). | Requested |
| FR-016 | Location-linked data logging and scene updates | Add, import or edit georeferenced data, including observations logged during an excursion at the current simulated position or a picked location. Use supported data types to update the map and simulation, including visible annotations, mapped features and declared obstacles. Explain each change and retain its source, time, extent and uncertainty. See the scope below. | Complete · [0.5](plans/2026-11-14-field-data.md) |
| FR-017 | Station, tablet and HUD views | Reorganize the interface around three contexts: a station computer for overall datasets and historical analysis; an astronaut tablet for the local region map and Explore; and the simulator HUD for in-scene information. Preserve the selected region, route, waypoints and scenario when switching views. See the view split below. | Complete · [0.4](plans/2026-11-14-station-tablet-hud.md) |
| FR-018 | More realistic HUD presentation | Extend FR-005 with transparent/translucent HUD elements, Mars solar time, an Earth clock where appropriate, and waypoints projected into the simulated field of view. Keep information legible and the terrain visible. Implemented as live Earth UTC with date, explained on the tablet and optional on the HUD. | Complete · [0.4](plans/2026-11-14-station-tablet-hud.md) |
| FR-019 | Touch-friendly tablet exploration and HUD controls | Put Explore in the tablet view, with large touch targets and touch-accessible map/layer inspection. Let the astronaut configure HUD visibility from the tablet, including waypoint and time displays. Keep tablet/HUD settings and displayed mission information consistent. | Complete · [0.4](plans/2026-11-14-station-tablet-hud.md) |
| FR-020 | SuperCam-style chemical and moisture HUD overlay | Highlight the locations of scientifically interesting chemicals/minerals in the astronaut's field of view, with particular interest in moisture and water-related indicators. Select substances/layers from the tablet, inspect supporting evidence and create science waypoints. Use georeferenced observations or explicitly labeled interpretations/simulations; preserve actual measurement footprints and uncertainty. See the scope below. | Requested |

## Science and demo scope

FR-010–FR-020 were requested on 14 November 2026. They are separate from the 0.2 implementation plan. FR-002/010/011/012/014 are selected for the [0.3 science release](plans/2026-11-14-science-release.md); FR-017–FR-019 are selected for the [0.4 interface release](plans/2026-11-14-station-tablet-hud.md). FR-016 is selected for the [0.5 field-data release](plans/2026-11-14-field-data.md). FR-003/004/008 are selected for the [0.6 environmental release](plans/2026-11-14-environment-release.md). Other requests remain unprioritized.

The service focuses on maps, geological interpretation, science target selection and excursion planning. Geological data should help users decide where to investigate and explain the evidence behind that choice. Check local coverage and map scale before suggesting targets; a broad geological unit does not establish a precise outcrop, sample composition or traversability.

Location-linked observation logging and editing the map/simulation are in scope. Broader sample-management workflows, mission scoring, completion tracking and mission debrief/report generation belong in another tool or remain out of scope.

### FR-016: From observations to scene changes

Support the loop: explore a location → add or revise data → see the corresponding map/scene change → use it in later inspection and planning. Users should also be able to add or alter supported data before entering the simulation.

Examples of useful behavior:

- Log a geological observation at a point, or draw a unit/contact boundary; show it on the map and as an inspectable annotation or overlay in the surface scene. Distinguish a user's interpretation from a published geological unit.
- Mark an obstacle or impassable patch; show its declared extent in the scene and, when configured as a restriction, update routing and movement checks consistently. Connect this to FR-013 replanning.
- Add a temperature or radiation reading with its location, timestamp and units; make it inspectable in both views. Any modeled influence beyond the observation's coverage must be explicit rather than silently turning a point into a spatial field.

Keep published source data intact and store user additions/corrections in an editable layer with clear provenance. Allow changes to be undone, hidden and removed. Explain which data types change scene appearance, which affect planning/movement and which are annotations only; the first version's supported types, import formats and persistence remain open choices. Terrain/geometry edits, if supported, must keep the displayed surface, sampling, collision and planner aligned. Reuse FR-014 provenance and distinguish simulated position/time from real field measurements.

### FR-017–FR-019: Station, tablet and HUD split

| View | Intended context and functionality |
| --- | --- |
| Station computer | Explore overall Mars data, compare datasets and inspect historical records and trends from the station. |
| Astronaut tablet | Explore the local region through its map, layers, science targets and route information. Access location-linked logging/editing (FR-016) and configure what appears in the HUD. |
| Simulator HUD | Show transparent/translucent navigation and time information over the surface scene, including waypoints projected at their scene locations. Use the selections and visibility settings configured on the tablet. |

Explore is available in the tablet context; broad data exploration and history remain available on the station computer. The tablet interface should be astronaut touch friendly: large, well-spaced controls, readable labels, touch pan/zoom and inspection, and access to actions without requiring hover or precise mouse input. These are functional views, not just screen-size variants.

Tablet controls should include waypoint visibility/selection and time-display visibility. Toggling a display must not reset the mission, change the underlying scenario clock or lose collected data. Keep region, mission position, route, waypoint selections, observations and time context consistent when moving between tablet and HUD.

Show Mars local solar time with its site/sol context. The 0.4 release uses live Earth UTC with date on Tablet HUD setup, optionally displayed on the HUD. Distinguish the scenario's historical/simulated time from the current real-world clock. FR-018 extends the completed 0.2 visor feature rather than treating the full requested HUD as already delivered.

### FR-020: Chemical and moisture-interest overlay

Offer a SuperCam-inspired science layer: choose a chemical, mineral or water-related indicator on the tablet, then see projected markers or highlighted measured areas in the HUD. Selecting a highlight should explain the detection/interpretation, source instrument, observation time, quantity/units where available, spatial footprint and confidence or quality flags. Let users turn a location into a science waypoint (FR-010) and add supported location-linked readings through FR-016. Reuse FR-014 provenance and FR-018/019 projection and display controls.

Prioritize moisture-related science while keeping distinct quantities separate: current moisture, water ice, hydrogen indicators and hydrated minerals are not interchangeable. In particular, a hydrated-mineral detection must not be labeled as present-day liquid water or wet ground. [CRISM/OMEGA mineral mapping](https://www.esa.int/media/global-map-of-hydrated-minerals-on-mars) provides an example of water-related mineral evidence; it does not by itself establish a live moisture reading.

The [SuperCam reference](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) motivates remote chemical/mineral inspection. This request does not assume a camera image alone can identify chemicals or that the simulator already has a working spectrometer. Candidate sources to assess include geolocated rover analyses and orbital mineral products; usable coverage and registration within the selected scene must be checked before choosing a dataset. Keep point measurements as point/footprint evidence, show missing coverage as unknown and avoid inventing precise chemical boundaries from coarse data. A simulated scan interaction, if added, must identify its scenario data separately from actual instrument observations.

Keep observations, derived layers and simulations distinguishable. Historical site observations alone do not establish spatial map coverage or forecast accuracy.

Add new requests with the next `FR-` ID. Keep open questions here; link a plan from `docs/plans/` when a feature is selected for implementation.
