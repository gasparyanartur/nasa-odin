# Feature backlog feasibility

Assessed 13 November 2026 against the current code and primary data sources. This is a feasibility assessment and suggested ordering, not an approved implementation plan. The user clarified FR-009: temperature and radiation should affect route planning.

## Overall assessment

All nine ideas have a feasible prototype version. The presentation features are mostly engineering work. Environmental maps and forecasts depend on what the data actually measures, its spatial coverage and its timestamps. A useful first release can combine better visuals, geology, historical conditions and departure-time comparisons without building a new climate or radiation model.

Effort below is relative engineering scope, not a measured delivery estimate. “Small” means a bounded change to an existing component; “medium” includes new shared state or a data preparation path; “large” includes substantial modeling, algorithms or validation. Browser performance and full source coverage have not been benchmarked in this assessment.

| Request | Feasible first version | Relative effort | Main constraint |
| --- | --- | --- | --- |
| FR-001: Mars-looking Mars | Color global basemap, improved local materials, sky and lighting | Small–medium | Orbital texture and a 5 m terrain grid cannot resolve ground-level rocks |
| FR-002: Geological map | Global geologic units, legend and unit inspection | Medium | Global map scale is too coarse for local walking decisions |
| FR-003: Radioactivity map | Historical RAD site context; separately, coarse K/Th composition maps | Medium for display; large for local exposure modeling | Radioactive composition and astronaut exposure are different quantities |
| FR-004: Temperature map | Historical site temperatures first; regional observed thermal or climate-model layer next | Medium | Air temperature, ground temperature and brightness temperature differ |
| FR-005: Optional realistic HUD | Toggleable visor framing, heading/waypoint cues and existing mission readings | Small–medium | Operational resemblance needs a reference; biomedical readings need a model |
| FR-006: Simulation resolution | Low/medium/high graphics quality | Small for render scale; medium for terrain/texture levels | Display detail must remain separate from routing and collision resolution |
| FR-007: Timelapse | Shared historical conditions timeline with play/pause/scrub | Medium | Environmental playback, walking speed and lighting currently lack a shared absolute clock |
| FR-008: Simulated forecast | Historical replay, then a climatological or fitted baseline with uncertainty | Medium for replay; large for validated forecasting | One bundled sol cannot establish predictive skill or forecast solar events |
| FR-009: Conditions affect planning | Evaluate full excursions and compare departure times under changing conditions | Medium for candidate evaluation; large for constrained optimization | Current search ignores environmental fields and checks budgets afterward |

## What already exists

- [WalkingScene.tsx](../../src/mission/WalkingScene.tsx) builds the entire 401 × 401 ground mesh, uses the prepared grayscale orthoimage with a color tint, fixed fog and fixed lights. It already runs through React Three Fiber.
- [catalog.ts](../../src/datasets/catalog.ts) defines MOLA/CTX basemaps and three regional overlays. [definition.ts](../../src/datasets/definition.ts) accepts WMTS imagery; arbitrary geologic vector layers need another path. [controller.ts](../../src/globe/controller.ts) already handles separate local image overlays.
- [environment.json](../../public/gale/environment.json) contains 24 hourly temperature records from Sol 10, all with non-null temperatures, and one mean RAD detector E rate derived from 26 observations. It does not contain a spatial temperature field or a radiation time series.
- [App.tsx](../../src/App.tsx) lets the user choose a historical hour, copies conditions into fixed mission settings, shows an existing HUD and supports 1×/5×/20× walking pace. The hour selector does not make conditions evolve during an excursion.
- [planner.py](../../server/planner.py) optimizes distance or a terrain penalty. [app.py](../../server/app.py) checks departure temperature and return-inclusive time/dose budgets after finding routes. Dose is duration multiplied by a uniform rate. These checks do not find the lowest-exposure path or guarantee a feasible route under resource limits.

## FR-001: Mars-looking Mars

There are two separate opportunities. Globally, add a real color basemap: Mars Trek lists the [Viking color mosaic](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars), and its [WMTS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml) and one level-zero JPEG tile returned HTTP 200 in this assessment. The service declares the same EPSG:104905 reference used by the existing dataset definitions, with eight matrix levels; the tile response permits cross-origin access. This makes it a strong integration candidate, although full coverage and in-app rendering remain untested.

Locally, improve the sky, surface material detail, exposure and lighting. The prepared texture is 1024 pixels across 2 km, roughly 1.95 m per display pixel, and terrain posts are 5 m apart. Simply increasing screen resolution will not produce close-up surface detail. A detail material can add visual grain; any added rocks or geometry remain illustrative unless grounded in a finer measured asset. Keep them out of analytical slope and hazard layers. Start with a visual target based on rover imagery, then compare screenshots at ground and globe scales.

## FR-002: Geological map

The [USGS 2014 geologic map of Mars](https://pubs.usgs.gov/sim/3292/) is a concrete starting point: a 1:20,000,000 map with a downloadable [GIS database](https://pubs.usgs.gov/sim/3292/downloads/sim3292_database.zip). The publication page was retrieved successfully and its GIS link inspected; the database itself has not been downloaded or audited.

Prepare a projected/rasterized display layer or simplified polygons with unit IDs, ages, descriptions and a legend. Rendering a raster is simpler; polygon inspection needs feature picking and geometry handling beyond the current WMTS schema. Preserve coordinate conventions and categorical units when preparing the layer. At this scale it is globe/regional context; it may show little variation across the prepared 2 km patch. Detailed Gale geology requires a separately verified regional map. Geological units alone should not become walking-speed or bearing-strength penalties.

## FR-003: Radioactivity map

Define the requested quantity before implementation:

- **Radioactive element distribution:** Odyssey GRS has [potassium and thorium concentration maps](https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html). Published products use bins of 2°, 5° or 10°, with smoothed products also available. These are coarse composition products, not local astronaut-dose maps. A static science overlay is feasible.
- **Ionizing radiation exposure:** expand the existing [Curiosity RAD archive](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MSL-M-RAD-3-RDR-V1.0) ingestion to preserve timestamps, quality flags and detector quantity. Display observations at their site/time or use an explicitly labeled scenario across the patch. The current single-site mean cannot justify a spatial heatmap.
- **UV:** REMS measures ultraviolet radiation, separately from RAD's ionizing-radiation quantities. Do not combine them into one numeric scale.

Terrain shielding is scientifically plausible: [Ehresmann et al. (2021)](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2021JE006851) measured a reduction near a Martian butte. That result does not establish a general conversion from visible sky or sunlight shadow to dose. A quantitative local exposure layer would need a radiation model, geometry and validation. Recommend historical RAD context first; treat terrain-dependent shielding as later research.

## FR-004: Temperature map

Use the existing REMS air-temperature series for historical site playback. The [REMS archive](https://atmos.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html) also distinguishes ground temperature and UV, with intermittent sampling and quality information. A rover series is not a spatial map.

For a spatial observation layer, [THEMIS IRBTR](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Mars_Odyssey/THEMIS/ODTSDP/IR/IRBTR.htm) provides numeric infrared brightness temperatures, nominally about 100 m pixels from the documented image width. Products are not map-projected, so local coverage, acquisition time, calibration, projection and alignment require preparation. A convenient grayscale THEMIS mosaic should not be interpreted directly as temperature. Brightness temperature is also distinct from near-surface air temperature.

For a continuous time-selectable view, the [Mars Climate Database](https://www-mars.lmd.jussieu.fr/mars/info_web/index.html) supplies simulated meteorological fields. Its [access notes](https://www-mars.lmd.jussieu.fr/mars/access.html) describe averaged, interpolated outputs that smooth variability and extremes. It is a climate/scenario source, not live weather or independent 5 m microclimate measurements. Precompute a bounded regional package instead of using the moderate-use web interface as an app backend. The full database requires registration, and its terms require specific authorization for commercial use. No MCD data package or local thermal footprint was audited here.

## FR-005 and FR-006: HUD and resolution

The HUD is already implemented as HTML over the walking canvas. An optional immersive presentation can reuse heading, route progress, elapsed time, return estimate and detector-dose proxy. Visor framing, a horizon/compass strip and projected waypoint cues are feasible. [NASA's Joint AR work](https://ntrs.nasa.gov/citations/20250011653) provides a relevant operational reference; it does not make our browser HUD a validated spacesuit interface. Keep warnings legible and label any new simulated suit telemetry.

Start resolution controls with render scale/device-pixel-ratio caps and antialiasing choices; later add texture and mesh levels if profiling supports them. Retain the same authoritative terrain, sampling and collision checks across graphics settings. Changing the planning grid is a separate feature because coarsening can alter slopes, exclusions and connectivity. Higher graphics quality must not claim finer measured terrain. Verify quality presets with screenshot comparisons and frame-time measurements on a specified device.

## FR-007 and FR-008: Timelapse and simulated forecast

Build one shared scenario clock containing the chosen historical epoch, elapsed mission time and playback state. Keep manual-walking pace explicit. A timeline can drive maps, charts and HUD conditions together; scrubbing while walking needs a defined reset/recompute policy. Lighting should follow the same clock only after implementing Mars solar geometry; the current light is fixed.

Begin with the 24 bundled weather bins. Preserve gaps and source timestamps, and label interpolation between observations. Expand RAD ingestion before showing time-varying radiation. This produces a useful historical replay without claiming prediction.

For an actual temperature forecast experiment, collect multiple sols, use a persistence/diurnal baseline and optionally MCD context, then evaluate on later, held-out time periods at a defined horizon. Report error and uncertainty separately for air and ground temperature. A curve fitted to the bundled sol is only a scenario.

Radiation needs a separate treatment. [RAD observations and modeling](https://arxiv.org/abs/1507.03473) relate background dose variation to atmospheric pressure and solar modulation, while the [butte study](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2021JE006851) also describes sporadic solar energetic particle events. Historical cycles alone do not support predicting those events. Replaying a recorded event or adding a labeled event scenario is feasible; forecasting its occurrence is outside the evidence available here.

## FR-009: Conditions affect route planning

This is feasible, but a colored overlay alone does not change the search. Evaluate conditions at the position and arrival time along the outward route, science stops and return. Accumulated detector-dose proxy becomes `sum(rate(position, time) × duration)`; temperature can contribute configurable feasibility limits or a clearly defined exposure penalty. Do not infer suit thermal load or oxygen consumption directly from ambient temperature.

With a constant, spatially uniform dose rate, minimizing dose is equivalent to minimizing duration. The current shortest-distance and gentler-terrain modes do not explicitly minimize duration, so even that objective would be a real algorithm change. If conditions vary only by time across the whole patch, departure-time comparisons and excursion duration are usually more informative than spatial detours. If valid spatial differences or modeled shelters are available, route geometry can matter too.

The first useful step is to evaluate existing route candidates under a shared conditions timeline and compare several departure times. Label this as candidate evaluation: rejecting two routes does not establish that no feasible route exists. A later static spatial cost field can support new route alternatives. Fully time-dependent, resource-constrained search is larger work: arrival time and remaining budgets affect future choices, so the current single best cost per terrain cell is insufficient in general. Waiting/shelter actions, stops, return feasibility and clock-triggered recomputation also need explicit handling. The existing return refresh is mostly displacement-triggered and would need to react when conditions change while stationary.

## Suggested order and open decisions

1. Improve global/local appearance, add graphics presets and an optional HUD presentation. These directly improve the current experience without waiting for new environmental data.
2. Add global geology and a shared historical timeline. Preserve provenance, gaps, units and real spatial scale.
3. Expand REMS/RAD historical coverage and evaluate route candidates/departure times under that timeline. This is the smallest useful version of conditions affecting planning.
4. Add one verified spatial thermal product or a precomputed climate scenario. Audit actual coverage before committing to a fine local map.
5. Consider new environmental route optimization and validated temperature prediction. Keep terrain radiation transport and solar-event forecasting as research items.

The remaining product choices are whether “radioactivity” means composition, exposure or both; whether temperature means air, ground or both; whether timelapse follows a historical sol or a mission; and the visual reference for the HUD. The proposed first resolution control means graphics quality. These interpretations are recommendations, not user-approved scope.

## Verification boundaries

Reviewed current source and bundled metadata; checked primary archive/product documentation; retrieved the geology publication page, Viking WMTS metadata and one real Viking tile. Raw access records are under repository-local `tmp/backlog-feasibility/` (ignored scratch data). Source discovery and one tile establish a plausible integration path, not complete coverage, numerical alignment, scientific validity or runtime performance. No application code was changed or new models trained.
