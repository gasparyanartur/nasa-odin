# Personal field data

Version 0.5 implements FR-016 in the prepared Gale footprint. **Tablet → Field data** holds an editable user layer; published geology, observations and terrain files remain unchanged. **HUD → Log here** captures a draft at the simulated astronaut position, Gale sol/LMST and elapsed mission time. It pauses walking by opening the Tablet. Save the draft to persist it; another Log here reopens an unfinished draft rather than replacing it.

## Supported effects

| Record | Geometry | Display and interpretation | Planning / movement |
| --- | --- | --- | --- |
| Geological note | Point | Inspectable user interpretation | None |
| Geological unit | Polygon, one ring | Filled map outline; terrain-following scene outline | None |
| Geological contact | Line | Drawn map / terrain-following scene line | None |
| Declared obstacle | Point + 5–500 m radius | Circular declared extent | Only when **Restrict routes and walking** is enabled |
| Temperature | Point, K | User reading with source/time/uncertainty | None; no spatial or scenario extrapolation |
| Radiation | Point, µGy/h | Absorbed detector dose-rate reading | None; no astronaut dose equivalent or exposure-field update |

Each saved record has an editable title, description, source, uncertainty/limitations and observation UTC. Created/updated UTC and the captured simulated context are retained separately. Coordinate provenance identifies simulated pose, map selection or manual coordinates. A line/polygon marker uses its first vertex as the anchor; the full geometry retains its extent. Projected HUD labels do not establish terrain line of sight or visible outcrop identity.

Enabling, moving, resizing, disabling or deleting an active obstacle clears stale route/return results and aborts outstanding requests. Position and elapsed time are retained. Recompute routes using the configured endpoints, then resume the HUD. This is the existing two-candidate comparison, not full in-place replanning or FR-013's proposed before/after analysis. Outbound/return requests and swept walking checks share the combined manual/field circular exclusions and the terrain's conservative cell-clearance rule. An obstacle surrounding the astronaut must be edited or disabled to allow movement.

Hiding a record affects its annotation/marker. Active restriction boundaries remain visible and enforced. **Explore → Clear exclusions** clears manual 40 m circles only; use Field data to change field restrictions. Scene boundaries follow sampled terrain and omit missing-data segments; they do not modify the DEM or create physical objects.

## Persistence and transfers

Saved records use this origin's browser local storage (`martian-map.field-data.v1`). They survive view/region switches and reload; Jezero does not display Gale records. There is no account or cross-device sync. Undo retains 20 complete layer snapshots for this session, including import/delete/visibility changes. Unfinished drafts and undo history do not survive reload.

Export a backup before clearing browser data. Storage failures leave the current layer in memory with an explicit warning and working export. An unread saved value is preserved until **Replace unread file with current layer** is selected; **Download unread saved file** preserves the original for recovery.

Import accepts up to 2 MB, 100 records and 100 vertices per geometry. The complete file is validated before a single merge by stable record ID. Invalid units, times, duplicate IDs, malformed polygons, unsupported schema/region, coordinates outside valid prepared terrain and more than 30 combined active restrictions are rejected without applying a partial import. Imports record their filename/time while retaining original source and observation metadata. Importing matching IDs updates those records; Undo restores the previous layer.

## Mars GeoJSON v1

Export once to obtain a valid template. This is a planetary, application-specific GeoJSON-shaped interchange; ordinary Earth GeoJSON is deliberately rejected. Its collection requires:

```json
{
  "type": "FeatureCollection",
  "schema": "martian-map-field-data",
  "version": 1,
  "planet": "Mars",
  "reference": "EPSG:104905",
  "features": []
}
```

`reference` uses the existing app's Mars geographic reference identifier. Coordinates are `[east-positive longitude, spherical latitude]` degrees, converted through the prepared terrain's origin and 3,396,190 m sphere. This is not WGS84; keep the planetary wrapper when transferring records. Geometry is `Point`, `LineString`, or `Polygon` with one closed outer ring and no holes.

A feature's `id` equals `properties.id`. Properties contain `regionId: "gale-bradbury"`, `kind` (`note`, `unit`, `contact`, `obstacle`, `temperature`, `radiation`), title, description, source, uncertainty, visible, restrictTravel, createdAt, updatedAt and observedAt (UTC ISO strings ending in Z), and context (`sol`, `lmstHour`, `elapsedS`, `positionSource`). Obstacles add `radiusM`; readings add numeric `value` and exact `units` (`K` or `µGy/h`). Other kinds omit units. Imported provenance may add `importedFrom` and `importedAt`. Use export/import rather than editing local-storage text directly.

## Multi-site storage in 0.7

Boxwork integration adds a backed-up migration to browser field storage v2. Existing Bradbury-only Mars GeoJSON v1 remains readable/exportable; v2 exports add site/dataset references for Boxwork. Records remain scoped to their original site and IDs merge within that scope. The selected-site Tablet rejects imports for another site visibly. See [migration and recovery](boxwork-data.md#personal-observations-and-recovery).
