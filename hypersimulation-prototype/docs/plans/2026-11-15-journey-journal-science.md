# Journey annotations, journal and science overlays

Date: 2026-11-15. Status: Draft. Investigation/proposal for FR-013 and FR-020, extending the existing FR-016 field records. Application baseline inspected: `06ec58a` (0.7 integration). No implementation is implied by this plan.

## Goal and user decisions

Support a connected exploration loop: walk → annotate a location → revisit the same entry on a map or in a journal → inspect its evidence in the HUD → optionally navigate to it or change a declared travel restriction. Map and journal are two views of the same saved records. A science overlay is another presentation of georeferenced evidence, not an independent notebook or detector.

The user wants published evidence and user observations as the default science sources. They subsequently raised a possible exception for moisture because local readings are absent. Proposed handling: an optional, clearly labeled **synthetic moisture demo layer**; no fabricated mineral detections or unmarked sensor readings. Whether to include that exception in the first build remains a scope choice. The architecture below accommodates it without making synthetic data a dependency of real-evidence work.

Keep keyboard/mouse and touch workflows. The Tablet remains a functional workspace on desktop as well as on smaller screens. Avoid adding several new permanent sidebars or another top-level application mode; coordinate with FR-023/024/027's layout concerns.

## Current state and gaps

| Area | Verified current behavior | Work required |
| --- | --- | --- |
| Field records | [Model](../../src/field/model.ts) supports geological notes, units/contacts, circular obstacles and point temperature/radiation readings. Records retain source, uncertainty, UTC and simulated position/time. Both Bradbury and Boxwork are supported with separate terrain references. | Add general journey entries, structured mineral/chemical/water-related claims and explicit evidence classes; preserve old records through migration. |
| Map/HUD | [Field workspace](../../src/field/FieldWorkspace.tsx), [map](../../src/mission/SurfaceMap.tsx) and [walking view](../../src/mission/WalkingScene.tsx) share record IDs, marker projection and geometry. Log here captures the current pose and opens the editor. | Add journal projection, shared selection/filtering, science categories and a smaller quick-entry flow. |
| Surface adapter | [SurfaceEngine](../../src/mission/surface/renderer.ts) exposes projection and point/line/polygon overlays. | Add validated terrain picking if users should mark an object in front of them; current-position logging alone does not locate a rock at the crosshair. |
| Restrictions | Saved enabled circles feed planning, return and movement. Geometry changes invalidate stale routes while retaining pose/time. Route failures expose constraint diagnostics. | Retain prior route/constraint snapshots and compare paired searches from a common current position; show cause and metric differences. |
| Planner | [RouteRequest](../../server/app.py) supplies start, goal and settings. Outbound routes return to that start. `App.plan()` still uses the configured endpoints. | Separate current position, original habitat, destination and elapsed time for journey replanning. |
| Persistence | [Store](../../src/field/useFieldStore.ts) and [migration](../../src/field/storage.ts) provide browser persistence, import/export, undo and malformed-storage recovery. | Persist journey association and record revisions/references; include them in transfers without replacing existing data. |
| Science data | [Environmental catalog](../../src/environment/model.ts) already models quantities, units, uncertainties, quality, times and coarse cell/point geometries. | Add suitable published mineral evidence and distinguish actual footprints from display/picking tolerances. Do not use the existing nearest-site lookup as proof of a local chemical detection. |

There is no journal or structured mineral/moisture record type in the inspected app. There is also no paired original/revised route API. The current six field types and route invalidation are foundations, not completion of FR-013/020.

## Data feasibility and the moisture exception

The bundled `public/environment/catalog.json` includes water-equivalent hydrogen, not a local wet-ground reading. Bradbury and Boxwork fall in the **same 5° cell**, bounded by 135–140° E and 5° S–0°. That bin contains 6.382 wt% equivalent water with supplied sigma 1.46; these quantities must retain their source meaning. A single shared regional value cannot explain differences between nearby rocks or provide local moisture contours. See [environmental limitations](../environment-data.md).

The Boxwork Sol 4600 `detail/conditions.json` has **zero populated relative-humidity values across its 24 hours**. Atmospheric relative humidity, subsurface hydrogen, ice, hydrated minerals and soil moisture must remain separate even if further products are imported. This finding concerns the bundled data, not the absence of all potentially relevant Mars archives.

| Candidate evidence | Appropriate use | Coverage/registration gate |
| --- | --- | --- |
| Curiosity CheMin mineral abundance products | Published mineral identifications/abundances attached to their sampled material and acquisition context. | Match actual sample IDs/locations to the prepared site. A nearby rover/drill proxy is approximate context, not the sampled footprint. |
| Curiosity ChemCam derived composition products | Published elemental/oxide composition at analyzed targets; retain calibration/quality and units. | Establish target coordinates and pointing/spot footprint; a rover position does not locate a remote laser target. Composition alone does not uniquely identify a mineral. |
| CRISM/OMEGA mineral evidence | Orbital mineral detections at the product's actual spatial support. | Verify a suitable intersecting product, registration, quality and usable resolution before displaying local highlights. A publicity map/image is not a numeric local layer. |
| Existing Odyssey hydrogen bins | Broad water-related context, with source period, bounds and uncertainty. | Keep them regional; never paint fine chemical boundaries or use them as a local moisture measurement. |
| User observations/interpretations | A user records what they observed or hypothesize, with source, location and limitations. | User-entered evidence remains labeled as such; entering a NASA URL does not promote a record into a verified published catalog. |
| Optional synthetic moisture | A self-consistent demonstration of locating, inspecting and logging a spatial signal. | Explicit opt-in and a persistent synthetic identity in every view, saved entry and export. No claim of calibrated moisture, real water or a live instrument. |

**Source checks on 2026-11-15:** [PDS CheMin](https://pds-geosciences.wustl.edu/missions/msl/chemin.htm) describes mineral abundance from X-ray diffraction of sampled material; [PDS ChemCam](https://pds-geosciences.wustl.edu/missions/msl/chemcam.htm) and its [derived-data description](https://an.rsl.wustl.edu/help/Content/About%20the%20data/Data%20sets/MSL/ChemCam%20data%20sets.htm) distinguish calibrated spectra/derived composition from raw products. [ESA's mineral mapping description](https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/New_water_map_of_Mars_will_prove_invaluable_for_future_exploration) supports hydrated-mineral evidence, not current moisture. [NASA/JPL Boxwork evidence](https://www.jpl.nasa.gov/news/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/) describes minerals associated with ancient groundwater. [PDS DAN](https://pds-geosciences.wustl.edu/missions/msl/dan.htm) is another candidate for water-related subsurface evidence; suitability and derived-product interpretation need a separate audit. These source checks establish candidates, not verified point/footprint coverage inside either prepared scene.

### Moisture annotations — user clarification 2026-11-15

Moisture is a first-class annotation category in the proposed core workflow, independent of whether a synthetic background layer is included. Offer **Add annotation → Moisture** from current-position logging, a picked map/scene point or a drawn patch. A user can record a qualitative interpretation such as “possible moisture beneath this overhang,” with a description and supporting evidence, without inventing a sensor value.

Retain the point/area geometry, journey, time and location context through the shared record system. Support a qualitative assessment and optional value only when its quantity, units and source are supplied. An appearance-based interpretation remains distinct from a measured water-content value; atmospheric humidity remains a separate quantity. Default to a user interpretation when there is no measurement or linked published observation.

The saved entry appears as a selectable moisture pin/patch on the map, a chronological journal entry and an optional moisture highlight in the HUD. Selecting it in any view opens the same record, and editing or removing it updates all views. The user can filter moisture entries separately from geology and other readings. An authored area describes the user's declared extent, not a measured moisture field beyond that evidence.

When the user logs a reading from the optional synthetic layer, copy its synthetic identity and scenario reference into the entry rather than treating it as a real observation. Logging and manually annotating moisture must work even with that layer disabled. Moisture annotations do not automatically alter terrain appearance, collision or route costs; an explicit, linked restriction can separately initiate FR-013's comparison.

### Proposed synthetic-moisture behavior

If included, use a named, versioned, site-bounded authored scenario. Show **Moisture — synthetic demo** when enabled. A low/medium/high presentation or unitless demo index is preferable to inventing calibrated percent water content. Keep this quantity separate from measured soil moisture and atmospheric humidity.

The same scenario geometry/sampler supplies the map, HUD and logged values. Its position must remain fixed across camera motion, repeated inspection and reload; use an exported scenario identity/version/seed or authored patches. Outside its footprint is unknown. Do not generate unrelated random readings each time the user looks at a point, derive apparent groundwater truth from DEM lows, or copy GRS values into local patches.

Logging it creates a record that permanently says **synthetic scenario**, including its location, time and scenario reference. Disabling the layer does not delete or relabel past entries. This layer changes visualization and logging only; it does not modify terrain, collision, environmental exposure or route costs. A user can separately declare a restriction, with that decision attributed to the user rather than inferred from moisture.

## One record system, several views

Extend the existing field-data store and use a common evidence view over published catalogs and personal records. Keep published products immutable. A journal entry can link to a published observation or snapshot its displayed value/provenance; it must not become an editable duplicate of the source product.

A record needs a stable ID and revision, site/dataset/version and coordinate reference, geometry/footprint, record category, source evidence class, observation time, creation/update time, captured simulated context, and uncertainty/quality. Typed claims identify the substance/quantity and either a value with units or a qualitative interpretation. Several claims may refer to one location; each retains its own basis. Missing values remain unknown rather than zero or “not detected.”

Distinguish **published observation**, **user observation**, **user interpretation** and the optional **synthetic moisture scenario** in presentation and transfers. Preserve original observation time separately from when a user recorded/imported it. For published data retain instrument, product/sample ID, original source links, footprint and positional uncertainty. Do not invent numerical confidence from prose quality flags.

Add a lightweight journey ID/name so the journal can group entries from an excursion. This is organization for observations, not mission scoring, sample inventory or debrief automation. Notes remain available across pause/resume, resets and site switches; resetting an excursion starts a new journey association without deleting the old one. Keep historical site/dataset coordinates, even when the user is currently at another site.

Map, journal and HUD resolve the same selected record ID. Editing from either authoring view updates all presentations; deletion/undo/import operate on the common store. Visibility/filtering changes presentation only. Preserve existing per-site exclusions, backup/migration behavior and storage-failure export. A new schema must read v1/v2 data, preserve original backups and reject incompatible/newer imports atomically rather than dropping unsupported claims.

## Intended interaction

1. **During walking:** Note here captures pose and mission time immediately and pauses to a compact editor. A general note does not require a scientific measurement. Preserve a draft across view changes. Attach structured data only when the user has a value/source or a linked observation.
2. **Annotate a target:** offer a deliberate mark-location action. For a scene click/crosshair, add a terrain hit-test through the current renderer adapter and convert to the authoritative ground-metre frame. Record `scene-pick` separately from astronaut position, reject sky and outside-prepared-coverage hits, and explain when only a contextual point can be located.
3. **Tablet → Field data:** a Map / Journal switch presents the same collection. The map emphasizes geometry and location. The journal shows a chronological journey list with text/data summaries, site/time, evidence badges and restriction state. Search/filter by journey, site, category/substance and evidence class. Show on map, inspect in HUD and edit operate on the same entry.
4. **Science overlays:** select a few substances/indicators and evidence classes in one compact Tablet control. HUD shows sparse projected markers and supported footprints; a selected highlight opens a small evidence card. Unknown coverage remains unknown. Coarse regional values use a contextual readout, not a precise point glowing on a rock. Consider near/selected records first to prevent label clutter.
5. **Use the record:** create a destination waypoint from a supported location, or explicitly enable a declared obstacle as a restriction. Validate prepared terrain and constraints before planning. A journal's historical record can be located/selected without teleporting the astronaut or changing mission time.

A future voice recording (FR-022) can attach to the same record. Do not make microphone access or transcription a dependency of the text/data/journal work.

## FR-013: comparable restriction changes during a journey

A note that says “possible wet patch” is not automatically a travel barrier. Only a deliberately enabled obstacle restriction changes the shared planner/return/movement mask. Save its record ID/revision and before/after geometry as the reason for replanning.

Retain the last route and constraint snapshot when a restriction changes, while marking that route stale and preventing it from becoming the active guidance under incompatible constraints. For the comparison, freeze one **current pose, current elapsed time, destination, habitat, terrain version and non-restriction settings**. Compute baseline and revised remaining routes from that common origin, using old and new restriction sets respectively. Preserve the earlier full route as optional historical context, but never subtract its full-trip metrics from a new remaining-trip route and call that a detour.

Separate `origin/current position` from `habitat` in the route contract. The revised outbound path starts at the captured astronaut position, and the return still ends at the original habitat. Retain time and detector-dose already consumed, evaluate future travel/remaining dwell/return at the proper scenario time, and expose remaining versus total resource values. Do not reset clocks, double-count elapsed time or wrap missing historical coverage into another sol.

Show old/new paths and measured changes in remaining distance/time, return-inclusive totals and relevant constraints. Compare shortest with shortest and gentler with gentler. Hold other settings fixed when attributing changes to the restriction; if several settings changed, describe them together. A possible “unchanged route” outcome is useful evidence too. No connected route, blocked current position/destination/habitat and missing data need explicit outcomes; never silently remove an obstacle, reuse a stale path or teleport to escape it.

Store an optional concise comparison event in the same journey journal, referencing the causal record revision and frozen route snapshots. Adopting a valid revised route updates guidance/return consistently while preserving pose/heading/pitch/time. Another move, edit, site change or dataset change invalidates a pending comparison response through request/snapshot identity. Deleting or undoing a restriction requires another comparison; display hiding alone does not.

## Milestones and acceptance evidence

| Milestone | Deliverable | Evidence required | Status |
| --- | --- | --- | --- |
| Shared record/journal foundation | Backward-compatible typed claims, evidence classes, journey grouping and Map / Journal switch over the existing store. | Old v1/v2 imports/storage survive migration; create/edit/delete/undo/transfer/reload; one selected record and content across views and sites. | Proposed |
| Journey annotations and F13 | Fast current-position logging, validated target marking, causal restriction snapshots and fair paired replanning. | Same current origin/settings for comparison; correct separate habitat/elapsed accounting; original/revised geometry and metric deltas; no-route, unchanged-route, undo, stale-response and movement consistency cases. | Proposed |
| Moisture annotations | Point/patch authoring with qualitative interpretation or sourced measurement; the same saved entry in map, journal and HUD. | Create/edit/filter/delete/undo/reload/transfer; identity and geometry agree across views; works with the synthetic layer disabled; synthetic captures retain their label. | Proposed |
| Published science evidence and F20 | One bounded, verified mineral/chemical source package connected to records, Tablet selection and HUD markers/footprints. | Source/product/sample hashes, unit/quality retention, actual coverage/registration and location support; no fine detail from coarse cells; selected evidence shared across map/journal/HUD. | Proposed |
| Optional moisture demo exception | Separately enabled synthetic moisture, consistently sampled and clearly retained as synthetic in entries/transfers. | Stable location/value across views/reload/export; unknown outside footprint; visible evidence labels after layer changes; no effect on routing/science source data. | Proposed / optional |
| Usability and completion review | Compact map/journal/evidence flow with desktop and touch support. | Keyboard/mouse/touch, narrow-window map fitting, HUD label density, draft preservation, storage recovery; meaningful model/API/browser checks and visual inspection. | Proposed |

## Risks, choices and recommended order

Start with the common records and Map / Journal view, including manually authored moisture annotations, then finish F13 using those records. Audit a small mineral-data package before committing to precise HUD highlights. Implement F20 only for evidence that passes its coverage/registration gate; if Boxwork lacks suitable target localization, show honest context and user interpretations rather than relocating detections from Bradbury or Jezero. The optional moisture layer can demonstrate the spatial interaction without pretending to fill that evidence gap.

Keep rendering behind the existing surface adapter, including Boxwork's ground/projected conversion. Detailed visual terrain outside the analytical footprint does not authorize walking or an arbitrary route waypoint. Avoid a generalized spectroscopy pipeline, terrain editing, chemical-dependent travel costs, cloud synchronization, broad UI redesign or automatic voice-to-hazard conversion in this increment.

Open implementation choices: the first published product and verified local subset, how much target positioning uncertainty the HUD should display, and whether the optional synthetic-moisture exception ships in the first increment. The requested investigation is complete; implementation milestones remain Proposed.
