# Integrated Gale prototype

Status: Complete for the approved prototype scope. Approved in conversation: Gale crater, manually walkable scene, globe → route comparison → HUD workflow. This plan extends the modular globe MVP without discarding its manifest import controls.

## Goal and success criteria

A user explores a global Mars map, enters a prepared real Gale area, inspects layers, selects endpoints, compares terrain-aware routes, and walks a selected route with an updating HUD. Data provenance, coverage, references, and environmental/resource assumptions remain visible.

## Approach

Retain React/TypeScript/Vite and Cesium. Prepare an approximately 2 × 2 km Gale patch from the USGS numeric DEM and orthoimage with Python/Rasterio/NumPy. Use one coordinate transform and numeric dataset across map, FastAPI/A* planner, Three.js/React Three Fiber walking scene and React HUD. Store prepared assets locally; global imagery still uses remote WMTS. Historical REMS and RAD observations inform explicitly configured environmental scenarios, not invented spatial hazard fields. No physiological suit model or real localization is promised.

## Milestones

- [x] Globe foundation: build/tests and production browser verification of real layers, imports, recovery and controls.
- [x] Data: reproducible crop, valid mask, slope, aligned imagery, weather/radiation observations, source metadata and audit.
- [x] Map: scientific overlays, inspection, coverage, endpoint selection and preserved dataset imports.
- [x] Routing: shortest/gentler alternatives, constraints, exposure/duration estimates and directed return route.
- [x] Walking/HUD: manual movement constrained by terrain/coverage, minimap, next waypoint, conditions, off-route/return alerts and shared state.
- [x] Handoff: repeatable startup, example/reset, tests, browser inspection, documentation and completion review.

## Interfaces and scope

Dataset manifests identify referenced display/numeric assets and source metadata. A local route API accepts endpoints and explicit settings and returns referenced geometry, metrics, warnings and dataset version. Mission state retains route, simulated position/heading, elapsed time and settings. Inputs outside usable coverage fail clearly. Terrain costs are directed; no diagonal corner cutting. Shortest and gentler objectives report the same metrics. Mission limits are checked, without claiming exhaustive resource-constrained optimization.

## Verification

Compare A* with Dijkstra on small representative maps. Test barriers, nodata, disconnected/invalid endpoints, direction-dependent costs and return paths. Test coordinate round trips and surface sampling. Browser-check the actual data, layer toggles, route computation, manual movement, HUD updates, reset and failure paths. Build and focused existing tests must pass. Review each milestone against evidence before marking complete.

## Current state and next milestone

All six prototype milestones are implemented. The local package contains real prepared terrain/imagery and dated environmental observations. The global explorer, local planner, two route alternatives, manual scene and HUD share numeric geometry and mission state. Startup, reproduction and constraints are documented in the README and [Gale data guide](../gale-data.md). Physical localization, physiological modeling and other regions are outside this completed prototype scope.

## Review

Reviewed 13 November 2026 using the repository's completion-review workflow.

- TypeScript/production build passed; 20 Vitest tests and 9 Python planner/API tests passed. Python checks include real Gale geometry, A*/Dijkstra agreement, nodata/barriers, no corner cutting, directed duration/return, budgets and blocked-habitat handling.
- Both browser scenarios passed: real MOLA/CTX swap with controls/errors/recovery, and the complete Gale mission flow. The mission scenario was rerun after fixes and includes actual keyboard movement, HUD updates, pause, a textured-ground regression, exclusions, reset and API failure.
- Visual inspection covered the prepared orthoimage, planner, walking HUD and mobile planner. Corrected first pointer-lock motion, explicit Escape handling and a material recompilation bug when the texture arrived after first paint. Matched planner interpolation clearance to the walking sampler. Removed temporary scene debugging.
- Source crop: 401 × 401 at 5 m, 100% valid numeric cells, elevations −4529.28 to −4491.35 m. Source references, processing and checksums retained. REMS missing wind stays missing; RAD uses 26 all-zero-QC detector observations. Numeric coverage does not establish complete fine-hazard coverage.
- Evidence: [verification record](../evidence/verification.json), [planner](../evidence/gale-planner.png), [walking HUD](../evidence/gale-walking-hud.png), [mobile planner](../evidence/gale-mobile.png).
- Intentional limits remain visible: historical site conditions, fixed-rate detector-dose proxy, explicit demonstration limits, unresolved small hazards, relative globe relief baseline, illustrative lighting and no physiological/localization model. Global imagery needs network access. Walking uses desktop keyboard/mouse. Vite reports a large Cesium/Three.js bundle warning; no runtime failure was observed in the checked flows.
