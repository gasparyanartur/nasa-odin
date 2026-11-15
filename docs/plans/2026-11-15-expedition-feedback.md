# Expedition help, traverse history and events

Date: 2026-11-15. Status: Complete locally — including follow-up feedback. Implementation requested with the feedback.

## Goal and scope

Implement FR-030/031/032 as one shared Station → Tablet → HUD experience. Make controls and quantities explainable on hover/focus and through deliberate help buttons; fit the HUD inside the visor with a circular minimap and translucent left-hand information cards. Save actual walked traces locally, compare saved traces and reference rover geometry on the route map. Provide opt-in expedition hazard scenarios, visible areas, mission-time scheduling and return guidance through a shared HUD/Tablet event feed.

Published rover geometry is used only where the loaded site already provides it (Boxwork). Different endpoints and vehicle capabilities prevent a fair speed/performance comparison. Hazard scenarios are illustrative, not forecasts or astronaut radiation/shelter models. Existing historical weather and detector-dose calculations retain their meaning. No deployment, wider-area planning or FR-013 journal/replanning implementation is included.

## Approach and acceptance

| Milestone | Deliverable and verification | Status |
| --- | --- | --- |
| Help and visor | Contextual explanations for navigation, map tools, planning assumptions, field tools and display; keyboard/click access; round north-up minimap; compact HUD and left event cards checked at laptop sizes | Complete locally |
| Traverse history | Record movement and pauses in mission time; explicitly save partial/completed walks with dataset/version and assumptions; persist across reload; compare two saved traces on the map with distance/time differences; optional source-linked rover reference; reject incompatible/corrupt history | Complete locally |
| Expedition events | Optional timed/instant solar-particle and local dust scenarios; dangerous area on map and surface; same active state, acknowledgement and history on HUD/Tablet; return guidance retains pose/time; restart clears current scenarios | Complete locally |
| Completion review | Build, unit coverage of recording/persistence/event boundaries and browser flows for saving/comparison/reload, timed hazards/pause/acknowledgement/return, help and visor layout; inspect saved screenshots | Complete locally |

## Decisions and limits

Browser history is local to this browser, bounded and deletable; save errors must be visible. Recorded distance is a sampled horizontal trace, elapsed time includes stationary simulated time, and saving does not imply destination completion. Reset starts a fresh trace without deleting saved history. Dataset/version mismatches cannot be silently overlaid. Source evidence is not converted into an invented rover time series.

Solar events affect the exposed demonstration area outside a labeled habitat shelter radius; local dust has a bounded declared footprint. Neither is a measured spatial field or a new impassable terrain restriction. Return instructions use the existing independently computed terrain return path; unavailable paths remain explicit.

## Next milestone

No required work remains in this feedback bundle. Public hosting and the earlier redesign’s unfamiliar-user/performance gates remain separately tracked.


## Completion review — 2026-11-15

Implemented all three backlog requests and reviewed the shared flows. Added six contextual control guides, local information buttons and hover/focus explanations, with tooltips positioned above scrolling panels. The compact visor has a circular north-up map with rim markers, comfortable telemetry/action insets and translucent left event cards. Tablet Events shares the same warnings, scenario state and acknowledgement.

Executed walks retain sampled geometry, running-clock duration, site/version, endpoints and assumptions at save. Saving does not teleport, reset or claim completion. History persists locally, supports two-trace overlays/differences, deletion (including archived site/version entries), backup and visible storage errors. Boxwork exposes the existing published Curiosity reference and its sampled distance; Bradbury explicitly reports that no registered reference is bundled.

Solar-particle and local-dust scenarios can trigger immediately or after a chosen mission interval. Active areas appear on the map and measured surface, with a clear shelter hole in the solar exposure mask. Acknowledgement retains the hazard; ending retains its log and removes its area. Habitat-return guidance uses the current terrain return path and preserves pose/time. Review separated renderer retries from excursion restarts so a recovered display retains active events and the current trace; a deliberate restart clears the feed while keeping saved walks.

Verification: production build, **76 frontend unit tests**, **33 offline Python reference/API tests**, and **12 relevant browser scenarios** passed across focused runs. The browser checks cover the three new workflows, both Boxwork integration cases, both context/map cases and all five UI redesign cases. The final hazard run includes context loss/reopening and restart; the final context run verifies projection changes, clocks, retained pose/time and dual-clock layout. Earlier overlapping software-WebGL runs encountered capture/geometry timeouts. The test now captures a settled paused frame, then resumes for the original movement/projection assertions; pointer-lock setup explicitly converges on the intended heading. No application behavior assertion was removed.

Inspected Station help, saved-route comparison, rover controls, Tablet Events, the translucent HUD and the hazard hatch, including the four laptop viewport sizes. Reduced advisory cross-hatch opacity to retain terrain visibility. See the [evidence index](../evidence/expedition-feedback/README.md) and [verification record](../evidence/expedition-feedback/verification.json). A final ordinary production build matches the isolated build used for the last recovery/context checks. The existing large Cesium/Three chunk warning remains.

No feedback deliverable remains open. These are local functional/visual checks with software-rendered Chromium, not target-laptop frame-rate, unfamiliar-user or public-hosting validation. Existing historical conditions, scientific source layers, field restrictions and detector-dose semantics are retained. Hazard areas remain explicitly simulated/advisory and rover geometry is not treated as an astronaut performance benchmark.


## Follow-up feedback — 2026-11-15

Make Boxwork the first, preselected and visibly suggested site. Present historical Curiosity geometry, prepared terrain plans and personal walks as previous-path records in one map panel, with independent, persisted visibility switches shared with the HUD. Include a reproducible planned example and preserve the distinction between unknown rover elapsed time, estimated plan time and actual recorded walk time. Separate this library from the blue **Plan route** action, including matching help and labels.

The visor correction must check the curved rounded boundary, including status text and projected captions, rather than only its enclosing rectangle. Verify the follow-up through build/unit checks, direct path loading/toggling/reload and actual route planning, plus visual/layout checks on both sites and at short laptop heights. Status: Complete locally.


## Follow-up completion review — 2026-11-15

Completed all four follow-up requests. Boxwork is first, preselected and suggested, with a direct entry action. Previous paths is one library for personal recorded walks, the exact published Curiosity positions/sols and prepared terrain-valid plans for both walking sites. Each path has its own persisted visibility switch, with matching map, circular minimap and surface overlays. Loading a path preserves the astronaut and current guidance. Historical rover travel time remains unavailable; prepared plans show estimates and are explicitly not executed walks. The reproducible `prepare:paths` command rebuilds these assets.

Renamed and recoloured the planning action to blue **Plan route**. It opens the resulting route alternatives even when the path library was open. Updated help, examples and current browser scenarios to use that label. Corrected an unpositioned surface-loading message, moved peripheral controls inward using viewport-relative vertical margins, and bounded projected markers/captions by the actual curved visor shape. Removed the duplicate path-panel title during visual review.

Verification: production build, **86 frontend unit tests in 20 files**, and **7 distinct focused browser scenarios** passed across two runs. The first run covers recording/comparison/reload, scheduled hazards/return/recovery, help and layout, plus both follow-up cases. The final run repeats both follow-up cases on the final build and passes both Boxwork regression cases, including manual walking, shared clocks, field records and browser-planner recovery. Unit checks verify exact historical source geometry, provenance rejection, valid example-route segments and curved containment. Path-library regeneration and local documentation links also passed. The pre-existing large Cesium/Three bundle warning remains; no target-device performance claim is made.

Inspected the saved-path panel and both site HUDs, including a compact 800 × 700 window. The automated geometry matrix covers six sizes from 800 × 700 to 2560 × 1440 on each site, with both clocks and projected captions. See the [follow-up evidence](../evidence/expedition-feedback/README.md#follow-up-review) and [verification record](../evidence/expedition-feedback/followup-verification.json). No required follow-up item remains open.


## Startup correction — 2026-11-15

The normal `/` entry starts at the global Mars view with no region selected. Boxwork remains first and suggested; choosing Explore Boxwork enters its Tablet. Explicit `?demo=boxwork` and `?demo=yellowknife` links retain their direct-entry behavior. This supersedes the earlier preselected-Boxwork decision.

Review: production build and the focused startup → suggested Boxwork → planning/path-library browser scenario passed. The check asserts no selected region and no Tablet on ordinary startup, then confirms the suggested entry still works.


## Unified Routes follow-up — 2026-11-15

Status: Complete locally. Merge saved-path loading and new planning under Routes with a prominent choice between **Plan new route** and **Load previous path**. Both use the same route sidebar and map, retaining loaded path switches and current guidance across mode changes. Remove the disconnected map-toolbar library and side panel. Keep recording, saving and comparing previous walks available in the saved-path mode.


Review: removed the standalone map-panel library and placed saved walks, historical paths and prepared examples in the Routes sidebar. The pinned workflow selector keeps **Plan new route** and **Load previous path** accessible while browsing the library. Switching retains loaded overlays, current guidance and astronaut pose/time. Updated contextual help, documentation and browser helpers.

Production build and all **86 frontend unit tests** passed. Four distinct relevant browser scenarios passed across runs: actual walking/saving/comparison/reload/deletion, suggested Boxwork and saved-library switching, both-site curved visor checks, and planning/adoption with retained pose, layers and profile access. The broader initial browser run was interrupted after the saved-walk scenario passed; the final focused run passed all three selected scenarios on the final build. Inspected the updated [Routes screenshot](../evidence/expedition-feedback/previous-paths-followup.png), including the visible mode selector. See the [verification record](../evidence/expedition-feedback/routes-verification.json). No required work remains for this follow-up.
