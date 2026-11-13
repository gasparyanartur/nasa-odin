# Martian Map — submission draft

Draft only. Confirm the team name, final public links, development dates and eligibility before copying this into the official project form. No submission has been made.

## Project summary

Martian Map brings real Mars datasets into one exploration flow. Choose a region on the globe, inspect its imagery and terrain, then plan an excursion and follow it with an astronaut HUD. Gale–Bradbury supports the complete workflow. Jezero provides orbital exploration and clearly shows where local planning data is unavailable.

## What it does

The map lets an explorer switch between MOLA shaded relief and CTX orbital imagery, select a region, and inspect the available data. Inside the prepared Gale area, imagery, elevation and slope have independent visibility and opacity controls. Historical Curiosity temperature, pressure and radiation observations provide additional site context.

The excursion planner compares a shortest permitted route with a gentler-terrain alternative. Both include a separately computed return route and estimates based on explicit mission assumptions. The walking scene uses the same numeric terrain as the planner, with a minimap, waypoints, simulated position and return estimates.

The contribution is the connection between discovery, data inspection, planning and execution. Region capabilities and data coverage remain visible throughout the flow.

## NASA and partner data

- **Mars Global Surveyor / MOLA:** global color shaded relief served through [Mars Trek](https://trek.nasa.gov/mars/). This is display imagery, not numeric height data.
- **Mars Reconnaissance Orbiter / CTX:** the approximately 5 m/pixel Caltech orbital mosaic for regional context. Its uncontrolled registration is identified in the interface; it is not substituted for the local planning terrain.
- **USGS Gale terrain and orthoimage mosaics:** the prepared 2 × 2 km Bradbury patch supplies numeric elevations, conservative slope and aligned overhead imagery. Product identifiers, references, processing and checksums are in [the manifest](../public/gale/manifest.json).
- **Mars Science Laboratory / REMS and RAD:** historical Sol 10 site observations from Curiosity. Radiation is an absorbed detector-dose proxy, not astronaut dose equivalent. Missing wind remains unavailable.
- **Jezero location:** Perseverance landing coordinates from Bell et al. (2022), [NASA record](https://ntrs.nasa.gov/citations/20230016428). No Jezero numeric planning terrain or Gale environmental observations are represented there.

See [Gale data and assumptions](gale-data.md) for product-level environmental references and quality checks. Imagery, terrain, atmosphere and radiation are distinct data types; elevation and slope share the same topographic source.

## Tools and implementation

React and TypeScript provide the interface, Cesium renders the globe, Three.js/React Three Fiber render the walking scene, and FastAPI/NumPy provide terrain-aware A* routing. Python/Rasterio prepare the source terrain package. A single Docker service serves the application, prepared assets and route API.

OpenAI Codex assisted with implementation, tests, documentation and recording automation. AI assistance does not replace the cited scientific data, and the terrain is not generated. Review this disclosure against the final set of tools used before submission.

## Limits and further work

Only the Gale patch supports planning and walking. The source data does not resolve all boot-scale obstacles or surface strength. Historical observations are not live spatial weather. Walking speed, environmental limits and exposure estimates are demonstration assumptions; there is no suit physiology, real localization, shielding model or operational safety validation. Budgets are checked after route optimization.

The next extensions are additional verified terrain packages and science stops with source-linked surface observations. These are future work, not features of this release.

## Links to fill after publication

- Public application: pending Render deployment.
- Public demo: pending upload of the 28-second recording.
- Source: this repository, branch `codex/integrated-explore`; confirm that the final source URL is accessible to judges.
- Team name and members: confirm in the official project page.
- Development history and event eligibility: confirm with organizers; this prototype predates the official hackathon start.
