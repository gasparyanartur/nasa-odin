# Martian Map

A Mars exploration project combining an interactive 3D globe, route planning, and an astronaut heads-up display (HUD). The goal is to bring data from multiple missions into a shared workflow: explore an area, plan an excursion, and follow the route with local information available along the way.

**Status:** Preliminary planning and research. The repository currently contains background research and a feasibility assessment; the application has not been implemented. The scope and technology choices below are provisional.

## Major components

### 1. Interactive 3D map

An interactive globe displaying different layers of Mars data. Users will be able to explore the surface, toggle layers, inspect locations, and select points for route planning.

Potential layers include:

- Orbital imagery, elevation, and terrain slope.
- Geological units, mineralogical evidence, and science targets.
- Environmental observations and modeled conditions, such as temperature, dust, and radiation context.
- Dataset footprints, showing where information is available.

### 2. Route planning

Select two points and plan a route between them, accounting for terrain and relevant hazards. The planner should support comparisons between routes based on distance, slope, estimated travel time, and exposure under the selected environmental scenario.

Dangerous climate conditions, radiation, restricted areas, and missing terrain data should inform route costs or exclusions where suitable data and models are available. Route results should expose the assumptions behind the comparison, including any resource limits and return requirements.

### 3. Astronaut HUD

A display that uses the astronaut's location to present nearby information and navigation guidance. Planned elements include:

- A minimap with the current position and planned route.
- Heading, next waypoint, and remaining distance.
- Local terrain and environmental conditions.
- Alerts for approaching hazards or changing conditions.

Ideally, the HUD will be demonstrated in an interactive 3D scene where the user moves across the terrain. The scene would supply a simulated position and heading; integration with physical localization hardware remains a separate future step.

## Intended demonstration

1. Explore Mars on the globe and inspect the available data layers.
2. Select a start and destination within a prepared local area.
3. Plan and compare routes under chosen terrain and environmental assumptions.
4. Enter the interactive scene and follow a route while the HUD updates with location.

The initial demonstration would combine a global view with detailed planning and movement in one bounded area. Jezero and Gale are candidate locations; the choice depends on overlapping terrain, imagery, and science data.

## Data and technical direction

Candidate inputs include CTX and HiRISE imagery, numeric terrain models, geological maps, CRISM mineralogical products, and rover environmental observations. Each layer should retain its source, date, resolution, coverage, and coordinate reference. Measurements, derived quantities, and simulated conditions should be identifiable in the interface.

The current feasibility study suggests React/TypeScript and CesiumJS for the globe, Python geospatial tools for data preparation and routing, and potentially Three.js for the local scene. These are proposals; no stack is configured yet. The map, planner, and HUD should share consistent terrain, coordinates, route, and scenario time.

