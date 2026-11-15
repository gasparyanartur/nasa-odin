# Boxwork terrain integration

The Boxwork site is a separate Mount Sharp area, not a replacement for Bradbury. Select **Gale · Mount Sharp Boxwork** at Station, or open `?demo=boxwork` to start on the Tablet with connected demonstration endpoints. Compare the two routes, enter the HUD, walk manually, log a field record and return to the Tablet. The existing `?demo=yellowknife` example remains available.

## Data and coordinates

`public/boxwork/manifest.json` identifies `gale-boxwork-v1` and lists input SHA-256 hashes. Rebuild it from the committed donor package with `npm run prepare:boxwork`; no download or external raw-data path is required. The original Fable application remains under `hypersimulation-prototype/` for reference.

The supplied display core is 1,024 projected metres across, with 1,025 × 1,025 height samples and four 2,048 px colour or greyscale image tiles at 0.25 m/pixel. A 2,048 m surround provides visual context at lower detail. Processed colour is not a true-colour claim. Source post spacing and centimetre height encoding do not establish source accuracy. See the preserved source catalogue, data licence and original alignment report.

Mission positions use ground metres east/north. The source uses projected metres at a zero-degree standard parallel; multiply projected eastings by `ground_scale.x = 0.9964884795347444` and northings by 1. The renderer adapter performs the inverse when sampling or drawing on the original grids. All map, route, field and geographic conversions use the same ground-metre frame. Terrain and textures are north-first, with height samples on corners and the donor slope product in cells.

The analytical footprint is a 1,000 × 1,000 ground-metre square wholly inside the display core, sampled at 5 m (201 × 201). Heights are bilinear samples of the original encoded DEM. Analytical slope retains the maximum native ground-space gradient in an 8 × 8 sample neighborhood around each node; validity reserves that neighborhood. Routing additionally reserves the bilinear interpolation footprint. This is deliberately conservative and may disconnect ridge destinations at a 20° limit. It is distinct from the donor's smoothed 5 m-baseline slope product. The default endpoints are simulated choices in connected terrain, not named sampling locations.

Routing and swept walking use this same analytical grid, slope policy, nodata and circular restrictions. The camera follows the finer display DEM. Infilled display heights, mesh skirts and the surround never authorize walking. Medium displays Boxwork at a 2 m mesh stride with 0.5 m/pixel imagery, and High at the full supplied 1 m posts and 0.25 m/pixel tiles; Low also reduces drawing pixels. Software graphics can use a 4 m display stride in Medium/Low to reduce drawing work; High retains full detail. Analytical sampling is unchanged. Bradbury keeps its existing data and accuracy limitations.

## Science and time

Sol 4600 REMS air temperature, ground brightness temperature, pressure and UV are preserved with sample counts and original condition files. The mission uses air temperature, converted from Celsius to kelvin. Ground brightness temperature is a separate quantity; UV remains a lower bound. Humidity and wind are unavailable. Hourly means are held within their bins without wrapping or extrapolating past the recorded sol.

The fixed mission radiation proxy uses the supplied RAD detector B mean, 6.96852 µGy/h from 86 observations, with its source identified. Original hourly records and detector E remain inspectable in `detail/dose.json`; these are not astronaut dose equivalent, terrain shielding or solar-event forecasts.

The Station environmental explorer's early-mission observations and Sol 29 forecast remain separate analysis data. They are not assigned to Boxwork, and snapshot adoption is offered only for Bradbury. The Boxwork mission clock starts from its Sol 4600 scenario; live Earth UTC remains independent.

The published rover campaign path and approximate drill-location proxies appear as context overlays. The Tablet evidence panel explains their source and uncertainty; HUD setup offers their projected navigation labels. A proxy marker is a nearby published rover position, not a precise drill coordinate. The bundled geological extract does not cover Boxwork, and the app says so rather than stretching Bradbury's geology into the new site.

## Personal observations and recovery

Field storage v2 supports both prepared sites. Existing v1 records are validated and backed up before saving the new store, retaining the original storage value. A failed storage migration retains valid records in memory and reports the problem; malformed payloads remain downloadable and are never overwritten automatically.

Bradbury-only exports retain Mars GeoJSON v1 compatibility. Exports containing Boxwork use v2 with explicit site/dataset references. Imports validate those references and preserve site identity; the Tablet imports records for its selected site. IDs are scoped by site when merging. Notes, readings, drawings, undo and active restrictions retain their existing behavior. Point readings do not become spatial fields or replace the historical scenario.

## Runtime and credits

The native Three.js renderer is adapted into the existing React application; there is one npm Three.js runtime and no embedded standalone donor app. The current route/return API, Station, Tablet and HUD remain the system. Overview imagery loads first, then the surround, intermediate core image and full tiles. Errors preserve the mission; the Tablet remains available if 3D cannot run. Source credits and licences are bundled under `public/boxwork/`; see also [renderer provenance](../src/mission/surface/NOTICE.md).

Public deployment, cross-patch/regional routing, chemical overlays, audio notes, the donor's scripted hazard/tour and a broader interface redesign remain separate scope. Local browser checks on software rendering do not establish performance on the donor's target laptop.

Renderer teardown releases geometry, textures, event listeners and the WebGL context; repeated view switching does not retain an abandoned surface context. The original donor source remains unchanged.


## Local verification and remaining performance gates

The [integration review](plans/2026-11-14-hypersimulation-integration.md#implementation-review--2026-11-14) links passing numerical/API/browser evidence and screenshots. All 20 browser cases pass across recorded full and affected focused runs; earlier failed runs remain identified. The intended integrated-GPU laptop has not been tested. A cold 10 Mbit/s desktop run measured 4.62 s Tablet readiness, above the provisional 3 s target. The available RTX 3090 delivered 36.7 RAF/s in a bounded Medium-mode sample; forced software rendering was much slower. These observations do not establish target-laptop performance. Startup optimization and target-device measurement remain open in the plan.

## Understanding unavailable routes

The preset Boxwork traverse is connected at the default 20° limit. The checked walking footprints reach 18.4° at the habitat and 15.9° at the destination. A lower slope limit can therefore reject the preset before searching for a path. These are conservative analytical footprint slopes, not just the inclination at a single visible point.

When a comparison fails, the Tablet reports which endpoint is blocked and the slope, missing-data boundary or exclusion responsible. If both endpoints are usable but disconnected, it checks whether removing slope constraints or exclusions restores connectivity, or whether invalid terrain still separates them. These explanatory checks do not change mission settings or create a relaxed route.

“Reset example excursion” restores endpoints and default mission settings. Saved field restrictions remain active, even if their annotations are hidden. The failure panel names those records and opens them in Field data for review. Manual exclusions can be removed with “Clear exclusions.” Temperature, time and dose limits produce evaluations after a terrain path is found; they do not cause the blocked-terrain error.
