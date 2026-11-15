# Martian Map 0.3 — evidence to excursion

Date: 2026-11-14. Status: Complete locally. The user requested continued implementation from the feature list after 0.2.

## Goal and selected scope

Implement the next five connected requests: FR-002 geological map, FR-010 geological science targets, FR-011 explainable route comparisons, FR-012 guided demo entry, and FR-014 map-data provenance. Preserve the existing 0.2 work and newer backlog requests. Public deployment, observation editing/replanning, spatial environmental maps and forecasts remain separate backlog work.

Success means a user can enter a curated Gale science example, inspect evidence and mapped units, choose between two source-backed geological targets, compute routes, understand measured differences through linked profiles/map highlights, and enter the existing surface view. Free exploration and reset remain available.

## Data and approach

- Bundle regional extracts around Gale and Jezero from the USGS-owned Tanaka et al. (2014), SIM 3292 feature service. Preserve unit identifiers, official descriptions/colors, contact classifications, source CRS and 1:20,000,000 map scale. Prepare spherical east-positive degree geometry with explicit clipping bounds, generalization and source hashes. This is regional geological context, not local traversability or a precise outcrop survey. Preserve missing coverage rather than infer units.
- Curate Rocknest and Yellowknife Bay visit-area targets using NASA geological descriptions and actual NASA/JPL Curiosity Sol 56/125 georeferenced waypoints. These locate rover visits, not the exact sand scoop, drilled rock or contact footprint. Show their evidence, question, limitations and coordinate source; snap destinations to the existing 5 m planner grid only after checking prepared terrain and constraints.
- Share layer visibility, unit/target selection and provenance between Explore and planner. Render real regional polygons/contacts on the globe, with inspection/legend and a context-view control. Render their intersection with the local patch in the planner. Do not draw invented local geological contacts.
- Add per-edge route profiles computed from the same numeric terrain, conservative slopes, grade-dependent duration and objective formula as search. Use cumulative outbound distance for profile selection and exact edge endpoints for map highlighting. Explain actual metric/cost differences, configured constraints, exclusions and return-inclusive condition evaluations. Do not attribute a detour to a particular exclusion without a counterfactual search.
- Offer a one-click prepared science entry and direct `?demo=yellowknife` link. Preconfigure the selected target, noon historical conditions, a stop and useful layers; guide inspection → comparison → surface view through contextual controls. Keep this as navigation guidance, without mission scores, sample management or debriefs.
- Present provenance by category: published observations, published geological interpretations, terrain-derived values, and editable demonstration assumptions. Include source/product, units, time, coverage, resolution/scale, uncertainty and how each affects decisions.

## Milestones and verification

| Milestone | Status | Required evidence |
| --- | --- | --- |
| Verified geology/target package | Complete | Real source retrieval; CRS/coverage/hole handling; source hashes; both targets inside numeric coverage and routable; reproducible preparation. |
| Geological inspection and targets | Complete | Globe/local layer controls, polygon and contact inspection, legend, shared target destination and region isolation; missing-data recovery. |
| Route explanations and linked profiles | Complete | Edge sums agree with route totals; A*/Dijkstra invariants retained; profile/map selection agree; explanations use actual differences, not generic claims. |
| Guided science flow and provenance | Complete | Fresh/direct example entry → inspect → compare → HUD → reset/free explore; science/condition dates remain distinct; responsive visual inspection. |
| Release review | Complete | Appropriate frontend/API/browser tests and production build pass; evidence and docs/backlog/package version updated. |

## Risks and boundaries

An initial direct publication download returned HTTP 403; a browser User-Agent subsequently retrieved the 809 MB GIS archive. The bounded, USGS-owned ArcGIS feature service is the checked extraction source used here, avoiding a full GIS archive in the app. Broad geological units may not vary across the 2 km patch. Mission waypoint locations and published site descriptions are separate evidence from the global geology; their precision must not imply an exact sample/outcrop footprint. Historical weather remains Sol 10 and is not contemporaneous with later rover visits. Surface rocks/geometry will not be invented to illustrate interpreted geology. Existing Cesium bundle size and upstream basemap availability remain known limitations.

## Next milestone

The five selected requests are complete locally. Observation editing/replanning, public demo deployment and remaining environmental-layer/forecast requests remain separate backlog work.

## Completion review — 2026-11-14

Reviewed using the repository's review-feature skill. The five selected requests and all release milestones are complete locally.

- **FR-002:** bundled reproducible USGS-owned regional units and contacts around Gale/Jezero, with original IDs, interpretations, colors, classifications, CRS and scale. Verified real rendering on the Mars globe and the local patch; unit/contact picking, legends, shared visibility/opacity and region isolation pass. Polygon holes and bounds are tested. Contact opacity follows the shared control, including zero opacity; clipping edges are not presented as contacts.
- **FR-010:** source-backed Rocknest and Yellowknife Bay visit areas retain NASA waypoint coordinates, sol/RMC, geological questions/evidence and limitations. Both exact snapped endpoints and directed returns are verified on the prepared DEM. The global map assigns the same broad AHi unit to both; local geological distinctions come from mission evidence, not an invented map boundary. Target changes clear stale routes/profile highlights.
- **FR-011:** each profile/edge record uses the search's own terrain and cost calculations. Tests verify vertex alignment, cumulative distance/time and cost-contribution sums. Actual alternative differences, active constraints and return-inclusive condition differences are shown; no guaranteed maximum-slope improvement or causal exclusion detour is asserted. The profile slider/graph highlights the exact map edge, with navigation shortcuts between views.
- **FR-012:** one-click and `?demo=yellowknife` entry, evidence inspection, target comparison, route comparison, surface destination, guided reset, and continuing free exploration pass. Loading failure/retry and region isolation pass. No mission scoring/sample management/debrief flow was added.
- **FR-014:** local data inspection and global-basemap source notes distinguish observations, interpretations, derived values and editable assumptions, with quantity/units, time, coverage, resolution/scale, source/product, effect and uncertainty. Legacy imports without classification/time remain unknown. Kept later rover visits distinct from Sol 10 weather. Made detailed local geology and provenance expandable after mobile inspection to reduce scrolling.

Verification: production build, **34 frontend tests**, **19 API tests**, and all **7 browser scenarios** pass. After final inspection/link/provenance/opacity refinements, the affected science and globe scenarios were rerun (**3 passed**). Existing Cesium/Three bundle-size and Starlette test-client deprecation warnings remain. Local preview/API and bundled science asset were checked on port 5273; no public deployment is claimed. No source observations or terrain arrays were replaced.

Evidence: [verification/source record](../evidence/v03/verification.json), [geological globe](../evidence/v03/v03-geology-globe.png), [guided planner](../evidence/v03/v03-guided-planner.png), [linked map segment](../evidence/v03/v03-profile-map.png), [route explanation](../evidence/v03/v03-route-explanation.png), [provenance](../evidence/v03/v03-provenance.png), [surface destination](../evidence/v03/v03-science-hud.png), [mobile](../evidence/v03/v03-mobile.png). See [science data](../science-data.md) for source references and reproduction.
