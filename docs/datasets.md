# Dataset integration

The global globe has one replaceable WMTS basemap slot, alongside independent regional overlays. Viking color, MOLA and CTX are selectable in the UI. The region catalog separates geographic discovery from prepared numeric planning coverage. The initial definition is [the Viking color manifest](../public/datasets/viking.json); [MOLA](../public/datasets/mola.json) remains the downloadable import example. Download that file under **Advanced: import a dataset**, edit it, and load it with **Load dataset JSON**. A supported replacement needs no rebuild and leaves the camera and controls unchanged. Reloading restores the bundled source. See [Gale data](gale-data.md) for numeric terrain, scientific overlays and environmental products.

## Replacing a WMTS source

Copy the manifest and change its identity, descriptive metadata, attribution and provider settings. Read the source service's `WMTSCapabilities.xml`; do not guess endpoints or copy another dataset's tile sizes. The bundled example is directly copyable and includes every required field.

| Field | Meaning |
| --- | --- |
| `id`, `name`, `description` | Dataset identity and sidebar text |
| `source`, `sourceUrl`, `attribution` | Origin, HTTP(S) metadata link and visible credits |
| `resolution` | Honest native/output resolution description |
| `reference` | Currently `EPSG:104905` only: Mars geographic coordinates, east-positive longitude |
| `bounds` | `[west, south, east, north]` in degrees, longitude −180…180 and latitude −90…90 |
| `legend` | Optional source-specific explanatory text; avoid inventing calibrated ranges |
| `provider.type` | Currently `wmts` |
| `provider.url` | Absolute HTTP(S) tile template containing `{TileMatrix}`, `{TileRow}`, `{TileCol}` |
| `provider.layer`, `style`, `format` | WMTS layer/style identifiers and `image/png` or `image/jpeg` |
| `provider.tileMatrixSetID` | Identifier from the capabilities document |
| `provider.tileMatrixLabels` | Ordered zoom identifiers, starting at a whole-globe 2-column × 1-row level |
| `provider.tileWidth`, `tileHeight` | Tile dimensions in pixels |

The adapter uses geographic tiling: each successive level doubles the row and column counts. Bounds clip the imagery coverage. Missing tiles produce an error; areas outside the bounds keep the sphere's base colour. A crossing of the antimeridian must be split/prepared before integration; wrapped bounds are not supported in this MVP. Other coordinate references, polar projections and differently structured tile pyramids need a new adapter or preprocessing. A manifest declares the data reference; it does not reproject or verify the source's claims.

MOLA is supplied as pre-coloured imagery, so its pixels are display values rather than numeric elevations. Global context remains spherical. Physical local relief, elevation inspection and slope come from the separate numeric Gale DEM, never from decoding these colors. Local globe relief uses an explicit patch baseline, not absolute ellipsoid heights.

## Integration boundaries

- `src/datasets/definition.ts`: plain dataset types and runtime validation. No Cesium imports.
- `src/datasets/layer-slot.ts`: one active handle, preserved opacity/visibility, latest-request selection and disposal. No React or Cesium imports.
- `src/globe/wmts.ts`: the WMTS adapter; Cesium is confined to this and the globe controller.
- `src/globe/controller.ts`: owns the viewer, camera, progress reporting and active slot.
- `src/GlobeExplorer.tsx`: displays WMTS metadata and passes validated definitions to the controller.
- `src/mission/data.ts`: numeric dataset/mission contracts, referenced coordinate conversions, sampling and API client.
- `src/App.tsx`: connects global view, local planner, scene and HUD through shared mission state.

A future format extends the definition's provider union and adds an adapter returning `setVisible`, `setOpacity` and `dispose`. The layer slot and selector do not need to understand the new file format. A different renderer can replace the controller behind its existing interface.

## Runtime behavior

Invalid manifests keep the current layer and show the validation error. Valid manifests replace the current layer immediately; tile availability is reported as images arrive. A failed image source may leave the base sphere visible: retry it or import a working manifest. Rapid imports select the newest request; stale work and previous error listeners are disposed. The application stores neither imported files nor user settings across reloads.

## Verified service configuration

The MOLA capabilities describe JPEG, 256-pixel tiles, matrix set `default028mm`, levels 0–7 and Mars reference `EPSG:104905`. The relief product is `Mars_MGS_MOLA_ClrShade_merge_global_463m` from [NASA Mars Trek](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml).

The shipped CTX definition is `public/datasets/ctx.json`; the older `tests/fixtures/` copy remains an import-test fixture. It uses the actual ArcGIS tile endpoint advertised by [the CTX capabilities](https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/WMTSCapabilities.xml) and 512-pixel tiles, demonstrating that source and tile layout are replaceable. The shipped definition is copied into `dist/`. CTX is an uncontrolled display mosaic; it is not the registered local orthoimage or numeric elevation source.

## Local route API

`POST /api/routes` accepts `datasetId: "gale-bradbury-v1"` or `"gale-boxwork-v1"`, local-meter `start` and `goal` objects (`x` east, `y` north), and `settings`. It returns shortest/gentler geometries, geographic copies, metrics, directed return routes, warnings, settings and dataset version. Geographic geometry is planetary, not Earth GeoJSON: source sphere/vertical metadata accompanies it.

Settings expose speed, maximum slope, excursion duration, fixed dose-rate proxy and budget, temperature/wind with departure limits, and up to 30 local circular exclusions (`x`, `y`, `radius`). Invalid values, blocked/disconnected points and unsupported dataset IDs return HTTP 422. Reference details are in the dataset manifest. No-data is never assigned a low-cost default.

`POST /api/return` accepts the same coordinate/settings contract plus route `mode` and `elapsedS`. Here `start` is the current astronaut and `goal` the habitat. It returns a current directed return estimate and budget warnings, or `atHabitat`. `GET /api/health` reports the loaded dataset/version. Vite dev/preview proxy `/api` to port 8100; production hosting needs the equivalent reverse proxy.

## Regions and overlay state

`src/datasets/catalog.ts` defines Gale–Bradbury and Jezero, location sources, basemap references, and explicit planning/walking capabilities. Gale’s exact prepared bounds come from its terrain manifest. Jezero’s marker uses the Perseverance landing position in Bell et al. (2022), [NASA record](https://ntrs.nasa.gov/citations/20230016428); its camera extent is illustrative, not a terrain-data footprint.

`App` owns selection, basemap visibility/opacity, overlay visibility/opacity, and the region’s mission. Region changes abort pending requests and clear incompatible mission state. Navigating between Explore, Plan and HUD preserves the selected region and settings. Prepared arrays load only when a plannable region is selected.

Regional imagery, elevation and slope render in that order above the global basemap; route annotations sit above them. Both globe overlays and planner images use the manifest footprint and shared settings. The HUD minimap deliberately keeps its navigation imagery visible independently. REMS/RAD remain dated contextual observations with original sources; Jezero never inherits Gale observations. Layer controls are session-only.

The default Viking MDIM 2.1 color layer uses the [NASA Mars Trek capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml): full −180…180°, −90…90° coverage, EPSG:104905, JPEG, 256-pixel tiles and geographic levels 0–7. Capabilities and a real level-zero tile were rechecked on 2026-11-14; browser acceptance verifies successful tile loading. This is processed global display imagery, not numeric terrain.

## Geological context and science targets

Version 0.3 adds a separate vector path for the bounded [USGS geological context package](../public/science/geology.json). These polygons and contacts are not WMTS basemaps and do not change the numeric terrain. Gale/Jezero have explicit regional bounds, legend/inspection and shared visibility/opacity. The planner displays only the intersection with its actual footprint; source clipping boundaries are not contacts. [Science data](science-data.md) documents CRS, source scale, processing, waypoints and uncertainty. Target selection updates the shared excursion destination; switching regions clears incompatible target/profile state.

Definitions may optionally include `dataKind` (`observation`, `derived`, or `unknown`) and `acquisitionNote`. Bundled definitions classify processed imagery separately from derived MOLA relief and explicitly identify the lack of per-pixel acquisition times in the tile service. Older imported definitions retain unknown classification/time rather than being silently promoted to observations.

## Boxwork package

The catalog also includes Mount Sharp Boxwork as a separate prepared site. Its renderer uses the supplied finer DEM and tiled colour/grey imagery, while routing/movement use the declared 1 km ground-metre analytical footprint. The API loads terrain and historical conditions by dataset ID; health reports both dataset versions. See [Boxwork data and reference contracts](boxwork-data.md).
