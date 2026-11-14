# Martian Map 0.4 — station, tablet and visor

Date: 2026-11-14. Status: Complete locally. Implementation requested for FR-017–FR-019.

## Goal and scope

Separate functional contexts while keeping one mission: Station provides the planetary atlas, dataset comparison and historical analysis; Tablet provides local Explore, scientific inspection, route planning and HUD configuration; HUD provides translucent in-scene navigation and clocks. Switching contexts preserves region, layers, target, route, scenario, position, heading and elapsed mission time. Leaving the HUD pauses walking; returning resumes from that position. Explicit scenario/endpoint edits still invalidate incompatible routes.

Observation editing is FR-016, still future work. Tablet will identify that boundary and offer existing location/data inspection, without implying a log editor or inventing observations. No new terrain, weather, physiological data or planner algorithm is introduced.

## Approach and decisions

- Keep mission and HUD configuration in the application shell. Provide Station Atlas/History and Tablet Explore/HUD setup workspaces with clear navigation and mission context. Preserve the globe instance across navigation.
- Keep dataset source/resolution comparisons at Station. Move the 24-hour REMS historical replay to Station History; Tablet retains departure selection. History changes explicitly reset a plan, while view changes and display switches do not.
- Add bounded map pan/zoom with pointer capture, pinch and wheel, plus visible zoom/reset buttons. A tap inspects or places in map coordinates; dragging never places a point. Controls use spaced 44–48 px touch targets and map inspection remains available without hover.
- Project selected waypoint coordinates through the actual Three camera, including pitch and viewport aspect. Hide projected labels outside the field of view; retain a directional cue for the next route waypoint. Labels are navigation overlays, not claims that a target/outcrop is visible through terrain. Habitat, destination, next route waypoint and source-backed science targets have independent selections.
- Tablet controls visor, waypoint visibility/selections, minimap and clock displays. Mars clock is simulated site LMST with a Sol 10 historical anchor (or explicitly manual scenario), advancing by the existing Mars-sol conversion. Earth clock is live current UTC with date, visibly distinct from historical/simulated Mars time. Tablet always explains both clocks; each HUD clock is independently optional.

## Milestones

| Outcome | Status | Evidence required |
| --- | --- | --- |
| Functional Station/Tablet/HUD shell | Complete | Atlas/history and local Explore/configuration, retained region/route/scenario/pose across switches, honest unsupported-region states. |
| Touch exploration | Complete | Pan/pinch/zoom, bounded extent, tap inspection/placement after transform, drag cancellation; desktop/tablet/phone visual inspection. |
| Projected visor and shared settings | Complete | Camera-aligned labels, behind-camera hiding, selections/toggles and clocks survive view switches without resets. |
| Completion review | Complete | Relevant geometry and API regression suites, production build, full browser acceptance, screenshots and updated documentation/backlog. |

## Risks and boundaries

Software WebGL can render slowly; clock checks use simulated time rather than fragile frame counts. Canvas map transforms must apply identically to images, routes, highlights and picking. Large controls increase page length: Tablet should prioritize the map and use distinct setup context. Jezero has orbital context but no prepared local terrain; the Tablet must explain this rather than offer fictitious local coverage. Existing Cesium/Three bundle-size limitations remain. No public deployment is implied.

## Next milestone

FR-017–FR-019 are complete locally. Personal observation editing (FR-016), public deployment (FR-015) and the other unselected backlog items remain separate work.


## Completion review — 2026-11-14

Reviewed with the repository's review-feature skill against FR-017–FR-019.

- **FR-017:** Station owns the planetary atlas, source/resolution/acquisition comparisons and historical Sol 10 analysis. Tablet owns local Explore, geology/evidence inspection, targets, route planning and HUD configuration. HUD owns walking and translucent in-scene information. Region, layers, target, selected route, waypoint choices, pose and scenario survive view switches. Returning through “Walk selected route” resumes instead of resetting. Tablet displays the current astronaut position on its map and the retained simulated position, elapsed time and site LMST. Jezero has an honest unsupported-local-terrain context and cannot enter walking.
- **FR-018:** Marker diamonds use the active Three camera, including pitch, perspective and viewport aspect; off-screen/behind-camera points are hidden. Captions move separately to prevent collisions while diamonds stay at their projected coordinates. Navigation labels do not establish terrain line of sight or precise outcrop visibility. Translucent panels and optional minimap/visor leave terrain visible. Mars time is explicitly a Gale historical/manual scenario with a Sol 10 anchor and retained elapsed time; Earth time is live current UTC with date. Clock visibility is independent of time state.
- **FR-019:** Pointer capture supports bounded drag/pinch/wheel map navigation, visible zoom/full-area controls, keyboard access and tap inspection/placement. Dragging never places a destination. Picking and every rendered layer share the viewport transform; closely spaced target taps choose the nearest science marker. Larger, spaced labels/controls support touch. Tablet configures each marker category/science target, compass/frame, minimap, Mars/Earth clocks, quality and pace without invalidating a route or resetting pose/time.

Review fixes included preserving scenario time outside the HUD, restoring view pitch, returning Reset to Explore, avoiding hidden-map redraws during walking, replacing cached controller lock checks with element-specific pointer-lock handling, guarding cursor recentering/unlock motion, and correcting mobile map controls, clock/compass spacing and overlapping waypoint captions. Removed input diagnostics after tracing and repeating the walking flow. No terrain arrays, scientific observations or search/collision algorithms were changed. Observation logging/editing remains FR-016, visibly identified as unavailable rather than represented by a nonfunctional editor.

Verification: production TypeScript/build passes; **36 frontend tests**, **19 API tests**, and the complete **9-scenario browser suite** pass. Two repeated instrumented walking/reset flows passed during diagnosis. After the final phone clock layout refinement, both affected context/touch scenarios passed again. The phone scene was then checked once more with both clocks and a settled projected waypoint. Desktop, 1024 px tablet and 390 px phone screenshots were inspected. Browser checks cover transformed pinch/drag/tap placement, nearest science-target taps, projected markers turning out of/into view, route/scenario/pose/time retention, display switches, date-bearing live UTC, clock separation on phones, source failures/recovery, route explanations, walking/reset and historical departure evaluation. Existing large Cesium/Three bundle and Starlette test-client warnings remain. No public deployment is claimed.

Evidence: [verification record](../evidence/v04/verification.json), [Station atlas](../evidence/v04/v04-station-atlas.png), [Station history](../evidence/v04/v04-station-history.png), [Tablet routes](../evidence/v04/v04-tablet-routes.png), [Tablet HUD setup](../evidence/v04/v04-tablet-setup.png), [projected HUD](../evidence/v04/v04-projected-hud.png), [touch Tablet](../evidence/v04/v04-tablet-touch.png), [phone Tablet](../evidence/v04/v04-tablet-mobile.png), [phone HUD](../evidence/v04/v04-hud-mobile.png), [both phone clocks](../evidence/v04/v04-hud-mobile-dual-clock.png).
