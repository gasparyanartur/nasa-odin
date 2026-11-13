# Gale data package

## Coverage and geometry

The patch is centered at 137.4417°E, −4.5895°N near Curiosity's Bradbury landing location. A 401 × 401 grid samples a 2,000 × 2,000 m area at 5 m spacing. The local frame is equirectangular on the source's 3,396,190 m sphere, with its standard parallel, central latitude and longitude at the patch origin. East is positive X and north positive Y; Three.js uses X east, Y up, Z south. Arrays are little-endian Float32 in row-major north-to-south order.

Sources:

- [USGS Gale DEM mosaic v3](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m): `MSL_Gale_DEM_Mosaic_1m_v3.tif`.
- [USGS Gale orthophoto v3](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm): `MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif`.

The DEM is MOLA-controlled. Its catalog identifies the landing stereo pair as `PSP_009505_1755` / `PSP_009571_1755` (G2). Mosaics include CTX, HRSC and MOLA fill outside HiRISE coverage; nominal output spacing is not uniform independent accuracy. These are composite observations, not a single acquisition or current surface survey. Acquisition/control information remains that documented by the source catalogs.

`scripts/prepare_gale.py` crops at native DEM spacing, corrects the east-west gradient scale for latitude, computes native slope, and reprojects into the local frame. Height uses bilinear resampling; each planning cell conservatively retains the maximum native slope. Any invalid source sample invalidates the output planning cell. The prepared crop has 100% valid numeric cells and elevations from approximately −4,529.28 to −4,491.35 m. This verifies numeric coverage, not boot-scale traversability.

The 1024-pixel texture is resampled for display and does not expose full native 25 cm detail. Texture and terrain use the same local extent. Areoid elevations remain in the numeric arrays. Scene and globe relief subtract the patch minimum: an explicit relative baseline, not an areoid-to-ellipsoid transformation.

## Environmental records

`scripts/prepare_environment.py` reads the PDS products and labels. Source URLs, selection counts and hashes are in `environment.json`:

- REMS `RME_398334213RMD00100000000_______PA`: Sol 10, 2012-08-15/16. Hourly medians use LMST. Missing values are excluded; ambient-temperature reliability byte 8, pressure shadow byte 1, and wind reliability byte 5 must equal `1`. Other flags are retained in the audit, not claimed to have all passed. Noon has 300 retained temperature/pressure samples, with medians 249.38 K and 719.41 Pa. Wind is unavailable.
- RAD `RAD_RDR_2012_228_20_41_0010_V00`: detector E rates from 26 observations with all-zero QC. Label units are `microGray / Hour`. Their unweighted mean is approximately 8.11042 µGy/h. This is a detector observation mean, not continuous whole-sol coverage or human dosimetry.

Weather is site-level historical context. Mission conditions are fixed for each planned excursion; edits are scenario assumptions. Radiation is integrated over estimated/simulated time at a fixed rate. Uniform radiation does not justify arbitrary spatial detours. UV is distinct from ionizing-radiation dose.

## Routing and walking

Eight-connected A* uses an implicit metric grid. Nodata, declared exclusions and above-limit slopes are blocked. Diagonals require both adjacent cardinal cells to be permitted. Exclusions include a conservative half-cell-diagonal margin. Shortest cost is 3D edge length; gentler cost adds squared local slope and uphill grade penalties. Flat Euclidean distance is an admissible heuristic for both.

Estimated duration is `3D distance / configured speed × (1 + 3 × uphill grade + 1.5 × downhill grade)`. This is a demonstration proxy, not calibrated Mars gait. The walking controller applies the same grade-dependent slowdown and checks swept movement against terrain/exclusions. Return estimates are recomputed after approximately 25 m of displacement (5 m near the habitat). The mission clock pauses when the pointer is released.

Departure temperature/wind, return-inclusive time and detector-dose proxy budgets produce warnings. Budget checks follow optimization and do not establish that no other feasible route exists. Route results retain settings, dataset ID and version.

## Files and reproduction

`manifest.json` describes references, coverage, sources, limitations and checksums. `height.f32`, `slope.f32`, `valid.u8` drive browser/API sampling. `terrain.tif` is the referenced inspection raster. `ortho.jpg`, `slope.png`, and `elevation.png` are display assets. `environment.json` contains reduced historical records and quality metadata.

Run `npm run prepare:data` to regenerate the package. Full original rasters are not checked in. No synthetic terrain or observations replace measurements.
