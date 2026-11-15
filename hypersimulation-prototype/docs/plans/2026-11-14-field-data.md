# Martian Map 0.5 — editable field data

Date: 2026-11-14. Status: Complete. FR-016 implementation requested after committing/pushing/tagging 0.4 (`f068d3e`, `v0.4`).

## Goal and success criteria

Support local exploration → add/revise georeferenced data → inspect the same record and geometry on Tablet/HUD → use declared restrictions in subsequent planning and movement. Keep published source data immutable. Logs survive view/region switches and browser reload; edits, deletion and import can be undone.

## Scope and decisions

The first supported area is the prepared Gale footprint. Support point geological notes, drawn geological unit interpretations (polygons), drawn contacts (lines), circular obstacles, and point temperature (K) / detector dose-rate (µGy/h) readings. User records carry title, description, attribution/source, uncertainty/limitations, observation UTC, creation/update UTC, coordinate provenance, and captured simulated Gale sol/LMST/elapsed context. No record is presented as a new NASA/USGS observation or a precise outcrop boundary from source data.

Circular obstacles have a 5–500 m declared radius and a separate travel-restriction switch. Use the existing exclusion geometry in both planner/return requests and swept browser collision. Constraint edits invalidate stale routes/return estimates while retaining the astronaut's pose/time. Display hiding changes annotations only; active restriction outlines remain visible so a hidden note does not create an invisible barrier. Temperature/radiation readings and geology are annotations/visual interpretations, without extrapolation or changing the historical scenario, DEM, slopes, dose model or scene lighting.

Use local browser persistence and a versioned Mars GeoJSON FeatureCollection (`planet: Mars`, `reference: EPSG:104905`, east-positive lon/lat). Export and import all supported records. Validate the whole import before applying it; merge by stable record ID with an undoable operation. Imported files must explicitly use the Mars schema; ordinary Earth GeoJSON is rejected. Store schema version/region/provenance and preserve timestamps. Detect malformed storage without silently overwriting it, show storage failures and retain in-memory data/export access. Browser-local storage is not cross-device sync.

Tablet gains Field data: map picking/current-pose capture, multi-tap line/polygon drawing, numeric coordinate editing, record list/detail/edit, visibility, restriction toggle, delete/undo and import/export. HUD projects selectable record markers and draws actual terrain-following line/polygon/circle boundaries. Pause with Esc to inspect markers; Log here opens a draft at the current simulated pose/time. Geometry edits are bounded overlays; DEM/terrain editing and arbitrary environmental fields are outside this version's supported types. FR-013 full before/after restriction comparison remains separate; FR-016 restrictions still use the existing recomputation flow.

## Milestones and verification

| Outcome | Status | Evidence |
| --- | --- | --- |
| Validated field model and durable editing | Complete | Six model-contract tests; browser atomic import, reload, undo, unread-storage and quota recovery checks. |
| Tablet authoring and inspection | Complete | Four field-data browser flows: all six kinds, drawn geometry, live pose capture, editing, transfers, persistence and region isolation. Desktop/phone screenshots; negative decimal keyboard input verified. |
| Shared map/scene and restriction effects | Complete | Shared map and terrain-following scene boundaries; HUD inspection; outbound/return request payloads and rerouted candidates; swept collision unit check; hidden active restrictions; retained live pose/time. |
| Completion review | Complete | Build, 42 frontend tests, 19 API tests and all 13 browser cases passed across bounded runs. Final field/editor build passed all four field cases. [Verification](../evidence/v05/verification.json). |

## Risks and boundaries

Bound all records to prepared terrain and preserve missing-data errors. Reject malformed/nonfinite geometry, invalid polygons, units, times, unsupported regions and excessive records/vertices. Avoid untrusted HTML. Restriction changes must abort stale requests and must not reset mission position or time. User field layers and recorded readings remain distinct from published regional geology and historical site data. An obstacle added around the astronaut may prevent further movement: explain this and allow disabling/editing it instead of teleporting the astronaut.

## Completion review — 2026-11-14

Reviewed against the full supported-type scope above. Added explicit uncertainty metadata and preserved import provenance through type changes. Protected unfinished drafts, enabled normal negative/decimal keyboard input, and kept crowded HUD captions above the metrics without moving their projected anchors. Disabled point-position replacement for drawn geometry. Clarified manual versus field restrictions and completed [user documentation](../field-data.md).

Production build, 42 frontend and 19 API tests pass. All 13 browser acceptance cases passed across bounded runs; an initial camera-baseline timing failure was fixed by measuring after the painted frame and pointer-lock recentering. The final projection/editor regression passed six cases, followed by all four field-data cases against the final editor build. Inspected [desktop](../evidence/v05/v05-field-tablet.png), [phone](../evidence/v05/v05-field-mobile.png), [HUD records](../evidence/v05/v05-field-hud.png) and [scene geometry](../evidence/v05/v05-field-scene-geometry.png). The six published data checksums match 0.4. Detailed counts, boundaries and results are in [verification.json](../evidence/v05/verification.json).

No required FR-016 work remains for this supported-type version. Browser-local storage, Gale-only coverage, annotation-only readings/geology and configured-endpoint recomputation are explicit product limits. The prior 0.4 release was committed, pushed and tagged before this work; the 0.5 implementation is a separate local change.

## Next milestone

FR-016 is complete. Full restriction-change route comparison/replanning remains FR-013 in the backlog.


## Tablet map follow-up review — 2026-11-14

Fixed the reported oversized/cropped map in Explore and Field data. The canvas now fits the available width and height without stretching or changing geographic coverage. Window/pane resizing and notices update its display size while preserving map zoom/pan. Point symbols and scale stay legible. Wide screens with a mouse use compact Explore controls; mouse drag/wheel/click and keyboard arrows, +/−, Home and Enter remain supported alongside touch.

Build and 42 frontend tests pass. Eight affected context, touch, field-data and map/input browser checks passed; both new map checks passed again against the final build, including an added restriction notice. Inspected 1440×1000, 1024×768, 800×700 and 390×844 layouts. Status remains Complete locally. [Verification](../evidence/v05/tablet-map-fix/verification.json), [desktop map](../evidence/v05/tablet-map-fix/tablet-map-1440-Explore.png), [smaller desktop map](../evidence/v05/tablet-map-fix/tablet-map-1024-Explore.png).
