# Martian Map 0.2 — surface experience and historical conditions

Date: 2026-11-14. Status: Complete locally. Implementation requested by the user, including selection of 4–5 backlog features.

## Goal and scope

Deliver five connected improvements: FR-001 Mars appearance, FR-005 optional visor HUD, FR-006 graphics quality, FR-007 historical timelapse, and FR-009 conditions affecting route evaluation. Reuse the existing checkout and preserve its uncommitted backlog/research/README work. Publication is outside this local app update.

Success means a real Viking color basemap and improved local scene; a toggleable navigation visor; graphics presets that preserve terrain/collision/routing; a bounded Sol 10 replay; and return-inclusive condition evaluation plus departure comparisons that influence the recommended candidate.

## Approach and boundaries

- Add Viking through the existing WMTS catalog, retaining MOLA/CTX and upstream error recovery. Preserve measured local geometry/texture; warm material, sky and fog are illustrative. Fixed scene illumination is not solar geometry.
- Offer low/medium/high drawing resolution and a visor compass/waypoint cue. Keep measured 5 m geometry, movement, collision, route settings and mission time identical between presets. No invented physiological telemetry.
- One departure clock drives the historical panel, route evaluation and HUD's advancing LMST. Replay previews hourly REMS medians and stops at the end of the bundled sol. Hold medians within each observed hour, preserve missing values and never wrap/extrapolate to another sol. Scrubbing clears stale plans; starting planning pauses replay. Walking advances the same clock from departure and pauses on Esc.
- Evaluate both terrain candidates and their returns over all crossed hourly bins, including optional destination dwell. Compare the same excursions at all 24 departure hours. Temperature, unknown coverage, time and detector-dose budgets determine warnings and candidate recommendation. RAD remains a spatially uniform fixed detector proxy; no invented radiation field or forecast. Report candidate evaluation, not environmental path optimization or proof that no feasible route exists.
- Recheck current Viking capabilities and tile responses. Use existing REMS/RAD files with their original provenance; do not regenerate data.

## Milestones and evidence

| Milestone | Status | Completion evidence |
| --- | --- | --- |
| Surface presentation (FR-001/005/006) | Complete | Real color tile rendering; ground/visor screenshots; toggle and drawing-resolution changes without mission reset; desktop/mobile inspection. |
| Shared historical clock (FR-007) | Complete | Play/pause/scrub/end behavior, missing values, stale-plan invalidation, HUD advancing LMST and pause. |
| Environmental candidate evaluation (FR-009) | Complete | Bin-crossing/cold interval/coverage/dwell/return tests; actual departure-dependent decisions; dose/time budgets; stationary clock-triggered return refresh. |
| Release verification | Complete | Frontend/API tests, production build, browser regressions and new acceptance journey; README/backlog/version updates and completion review. |

## Risks and decisions

Site measurements are context applied uniformly to a demonstration excursion. Ambient temperature is not suit thermal load. Unknown observations cannot establish feasibility. All departures remain within historical Sol 10; trips past its end are marked unknown. Drawing resolution affects sharpness/performance, not source resolution. The global basemap depends on external NASA tile availability. Existing public deployment work remains separate.

## Next milestone

The selected 0.2 scope is complete. Public deployment remains on the existing hackathon roadmap; remaining geology, spatial environmental layers and forecasts are separate follow-up work.

## Completion review — 2026-11-14

Reviewed with the repository's review-feature skill. All four milestones are complete locally.

- FR-001: added the default Viking color basemap using rechecked NASA capabilities and successful real JPEG tile responses; retained MOLA/CTX and their recovery/import checks. The warm local material, sky and fog use the same measured geometry and texture.
- FR-005/006: visor compass/waypoint cues and three drawing-density presets work without resetting mission position. Inspected desktop and 390 × 844 mobile screens; fixed compass/minimap overlap and hid the waypoint card behind pause instructions. No measured terrain resolution changed.
- FR-007: verified historical replay, pause, scrub, end boundary and stale-plan invalidation. Explore context, route departure and HUD share LMST. Missing observations remain missing. Fixed the earlier renderer-frame time cap: elapsed monotonic time is retained and movement uses at most 0.1-second simulated collision steps. Focus loss and hidden pages pause walking.
- FR-009: hourly overlap evaluation includes outward travel, optional dwell and separately calculated return; 24 departure alternatives change temperature feasibility. Time and uniform detector-dose budgets contribute to warnings and recommendation. Tests cover cold-bin crossings, missing bins/sol end, zero-duration unknown departures, stationary returns and recommendation changes. Full environmental route optimization remains outside this release.
- Verification: production build, 28 frontend tests and 17 API tests pass. All five browser scenarios pass across targeted runs; after final scene/mobile fixes both mission scenarios were rerun and passed. An initial new-flow check used an inadequate wall-time timeout under software WebGL; the revised test verifies actual simulated seconds, and also checks monotonic elapsed time against pointer-lock duration. Build retains the existing Cesium/Three bundle-size warning. No public deployment is claimed.

Evidence: [verification record](../evidence/v02/verification.json), [Viking access check](../evidence/v02/viking-access.json), [planner](../evidence/v02/v02-planner.png), [timeline](../evidence/v02/v02-timeline.png), [active visor](../evidence/v02/v02-visor-active.png), [paused visor](../evidence/v02/v02-visor.png), [mobile](../evidence/v02/v02-visor-mobile.png). Local preview health and route API were checked on port 5273. README, data documentation, package/API version and backlog statuses are updated.
