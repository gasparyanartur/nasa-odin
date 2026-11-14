# Data check - cuts (Task 1)

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project. Read on 2026-11-14 with `tools/geotiff_range.py` (HTTP range requests only).

## Status

- Task 1a (reader, header dump, oracle): done.
- Task 1a first stopped at the A3 centre check (142.2 m to the waypoint centroid, limit 50 m). Orchestrator decision of 2026-11-14: keep the fixed centre; the 50 m check is replaced by "every campaign waypoint inside the core with at least 100 m margin to the core edge". Result: PASS (see "Centre check").
- Task 1b (cuts): done, see "Cuts" below.
- Follow-up of 2026-11-14 (orchestrator): height test bounds widened to the real relief, slope over a 5 m baseline, colour imagery added as the default, greyscale files renamed `grey_*`.

## Step 0 - header requests

| File | Final URL | Size (bytes) | Accept-Ranges | Last-Modified |
|---|---|---|---|---|
| 25 cm image | https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif | 24,356,917,625 | bytes | 2022-11-09 |
| 1 m terrain | https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif | 3,868,256,546 | bytes | 2022-11-09 |

Both `planetarymaps.usgs.gov` URLs answer HTTP 302 to the S3 URL above. No checksum was computed.

## Step 0 - file headers

| Field | 25 cm image | 1 m terrain |
|---|---|---|
| Format | BigTIFF, little-endian | classic TIFF, little-endian |
| Size (px) | 180,000 wide x 280,000 high | 32,980 wide x 57,440 high |
| Layout | tiles 128 x 128 (3,078,516 tiles) | strips of 1 row (57,440 strips) |
| Compression | 32773 (PackBits) | 5 (LZW) |
| Predictor | none (1) | none (1) |
| SampleFormat / BitsPerSample | unsigned / 8, 1 band | float / 32, 1 band |
| Photometric | 3 (palette); the ColorMap is a linear grey ramp (index i maps to grey i on all three channels) | 1 (black is zero) |
| No-data | no GDAL_NODATA tag | -32767 (GDAL_NODATA) |
| Overviews | none | none |
| ModelPixelScale | 0.25, 0.25 m | 1.0, 1.0 m |
| ModelTiepoint (pixel 0, 0) | x 8,126,248.0, y -241,164.0 | x 8,127,993.992786, y -244,781.575189 |
| GTRasterTypeGeoKey | 1 (PixelIsArea) | 2 (PixelIsPoint) |
| Corner of pixel (0, 0) used by the reader | x 8,126,248.0, y -241,164.0 | x 8,127,993.492786, y -244,781.075189 |
| Extent (lon, lat) | 137.09472 to 137.85390, -5.24952 to -4.06858 | 137.12417 to 137.68056, -5.09865 to -4.12960 |
| Other | Orientation 1 | GDAL_METADATA with statistics items (maximum -322.56, mean -3641.76) |

GeoKeys, identical in both files:

- GTModelTypeGeoKey 1 (projected), GTCitationGeoKey "Mars_Equirectangular_clon0"
- ProjectedCSTypeGeoKey 32767, ProjectionGeoKey 32767 (user-defined), ProjCoordTransGeoKey 17 (equirectangular)
- ProjStdParallel1GeoKey 0.0, ProjCenterLatGeoKey 0.0, ProjCenterLongGeoKey 0.0, false easting 0.0, false northing 0.0
- ProjLinearUnitsGeoKey 9001 (metre), GeogAngularUnitsGeoKey 9102 (degree)
- GeogSemiMajorAxisGeoKey 3,396,190.0 m, GeogSemiMinorAxisGeoKey 3,396,190.0 m (sphere), GeogPrimeMeridianLongGeoKey 0.0
- GeogCitationGeoKey "GCS Name = GCS_Mars_2000_Sphere|Datum = D_Mars_2000_Sphere|Ellipsoid = Mars_2000_Sphere_IAU_IAG|Primem = Reference_Meridian"

## Conventions read from the keys

- Projection: equirectangular, sphere radius 3,396,190 m, standard parallel 0 degrees, central longitude 0 degrees. One degree = 59,274.70 projected metres in both axes.
- Latitude type: planetocentric (on a sphere, planetocentric and planetographic latitude are the same).
- Longitude: east-positive (columns grow to the east); the file range 137.09 to 137.85 reads the same in 0 to 360 and in -180 to 180.
- Ground scale at the origin latitude (-4.803 degrees): east-west 0.996488 true metres per projected metre (cos(-4.803) / cos(0)); north-south 1.0.
- Rover waypoints (`MSL_waypoints.json`): their `easting` and `northing` match our projection of their `lon` and `lat` within 3.2 mm (65 campaign waypoints). So the waypoints use the same projection, and the conversion is the identity.
- Grid offset: the image origin pixel corner (column 68,351, row 174,129) falls at terrain pixel position 15,342.257, 39,915.175 (corner convention, after the PixelIsPoint half-pixel shift). The two grids are not aligned; Task 1b must interpolate the terrain (amendment A4).

## Estimated bytes for the cut

| Window | Chunks | Compressed bytes |
|---|---|---|
| Image, surround 2,048 m plus a margin (8,200 x 8,200 px) | 4,290 tiles | 70,668,339 |
| Terrain, surround plus a margin (2,060 x 2,060 px) | 2,060 strips | 161,747,462 (each strip is a full row of 32,980 px) |
| Total | | about 232 MB, below the 2 GB stop limit |

## Centre check

- Campaign waypoints: sols 4534 to 4805, 65 waypoints.
- Centroid (mean of projected x and y): lon 137.381162, lat -4.804542.
- Original A3 check: the fixed centre lon 137.383, lat -4.803 lies 142.2 m from the centroid (108.9 m east, 91.5 m north). Limit 50 m: fail, so the work stopped and was reported.
- The centre of the waypoints' bounding box lies 16.5 m from the fixed centre.
- Replacement check (orchestrator decision, 2026-11-14): every campaign waypoint inside the core with at least 100 m margin to the core edge. The farthest waypoint lies 230.2 m east-west and 338.9 m north-south from the origin. The core half-width is 512 m, so the smallest margin is 173.1 m. **PASS.**
- The centre is kept and snapped to the 25 cm image pixel corner nearest to it: column 68,351, row 174,129, lon 137.3829997, lat -4.8029979 (projected x 8,143,335.75 m, y -284,696.25 m).

## Real-data oracle (amendment A3)

Terrain value by bilinear interpolation between pixel centres at each waypoint position, against `elev_geoid` in `MSL_waypoints.json`:

| Sol | Terrain (m) | elev_geoid (m) | Difference (m) |
|---|---|---|---|
| 4600 | -3632.805 | -3632.878 | +0.073 |
| 4534 | -3657.739 | -3657.644 | -0.095 |
| 4575 | -3644.395 | -3644.423 | +0.028 |
| 4605 | -3631.541 | -3631.479 | -0.062 |
| 4636 | -3607.376 | -3607.128 | -0.248 |
| 4671 | -3608.240 | -3608.263 | +0.023 |

Result: **PASS.** Sol 4600 is within 0.073 m (limit 5 m). No datum offset is needed.

A real read of the image at the origin (256 x 256 px) gave grey values 35 to 173, no zero pixels.

## Colour file header (Step 7, header only, nothing cut)

- File: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif , 1,030,625,379 bytes, Accept-Ranges bytes, Last-Modified 2025-07-25.
- Classic TIFF, cloud-optimised layout: 36,000 x 76,000 px, 3 bands of 8 bit (RGB stored as YCbCr, subsampling 2 x 2), JPEG compression (7) with JPEGTables (142 bytes), tiles 512 x 512 (10,579 tiles).
- Pixel scale 0.25 m. Same projection keys as the two USGS files (equirectangular, sphere 3,396,190 m, standard parallel 0, central longitude 0). Tiepoint x 8,140,000.0, y -270,000.0, PixelIsArea; its pixel grid lines up with the 25 cm image grid (whole-pixel offset).
- Overviews: 8 JPEG levels (18,000 x 38,000 down to 140 x 296) plus a Deflate transparency mask for full resolution and each level.
- Extent: lon 137.32672 to 137.47856, lat -4.87560 to -4.55506.
- Core inside the extent: yes. The core spans columns 11,295 to 15,391 and rows 56,737 to 60,833 of 36,000 x 76,000.
- Pixel probe (report only, nothing put in `app/`):
  - `colour-probe-centre.png`: 512 x 512 px at full resolution (0.25 m, 128 m across), centred on the core centre. No black pixels (share 0.0); mean RGB 113.6, 90.8, 72.9.
  - `colour-probe-core.png`: overview level 4,500 x 9,500 px (2 m per px), 512 x 512 px covering the whole 1,024 m core. No black pixels in any quarter (share 0.0); mean RGB 144.4, 107.2, 85.5.
  - The features match the 25 cm greyscale core. The colour file has real pixels across the whole core. The 1-bit transparency mask was not read (the reader supports 8-bit and wider samples only); "real" here means not black.
  - Colour bytes fetched: 295,762.

## Cuts (Task 1b)

Command, from `hackathons/nasa-space-apps-2026`:

```
tools/.venv/bin/python -I tools/cut_scene.py --lon 137.383 --lat -4.803 --core-m 1024 --surround-m 2048 --out app/public/data --raw /Users/ardasarikaya/marswalk-data-raw
```

Frame and sampling:

- Local x, y are projected metres of the file projection, origin at the snapped image pixel corner. The core is 1,024 projected m = 4,096 image px. True ground metres per projected metre: x 0.9964884795, y 1.0 (`scene.json` `ground_scale`).
- Greyscale image: read at 0.25 m. The palette is a grey ramp (index i = grey i), so the pixel values are written as they are, in greyscale WebP ("L"), quality 90, method 6. Area means skip value 0 (the image has no no-data tag; 0 is treated as fill).
- Colour image: `MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif`, full resolution (0.25 m) only, no overview level used. Its grid lines up with the 25 cm grid: the origin is colour pixel 13,343, 58,785 exactly. Core tiles, half resolution (2x2 area mean), surround (4x4 area mean, 1 m) and overview (4x4 area mean of the surround, 4 m) are all made from the same 8,192 x 8,192 px read. Area means skip pixels that are black on all three bands. RGB WebP, method 6.
- `scene.json`: `core.tiles`, `core.half_res`, `surround.image` and `overview` point to the colour files; `imagery` holds both sets (`default` colour). The colour source id is `usgs_gale_colour_2025`; the greyscale set uses the existing id `image_25cm` from `app/sources.json`.
- Terrain: bilinear interpolation between source pixel centres at the A4 positions. The terrain file is PixelIsPoint, so its tiepoint is the centre of pixel (0, 0) and the grid corner sits half a pixel up and to the left (GeoTIFF rule, also the GDAL default). With this reading, the origin falls at terrain pixel position 15,342.257, 39,915.175. Reading the tiepoint as a corner instead would move the terrain grid by 0.5 m in x and in y against the image. The oracle (differences under 0.25 m) cannot separate the two readings.
- Surround terrain: each 4 m sample is the mean of 16 bilinear samples at offsets -1.5, -0.5, 0.5 and 1.5 m in x and y (a 4 m area mean); no-data samples are skipped.
- Slope written to `slope_core.bin` (5 m baseline): 1 m bilinear heights averaged over 5 x 5 m blocks centred at x, y = -520, -515, ..., 520 m (no-data skipped), Horn's method on that 5 m grid with true ground spacing dx = 5 x 0.9964884795 m, dy = 5 m, then bilinear back to the 1,024 x 1,024 cell centres of A4. `scene.json` `slope` carries `baseline_m: 5` and a one-sentence `method`.
- Slope at a 1 m baseline (reported only, not written): Horn's method on a 1,026 x 1,026 grid of bilinear heights at cell-centre positions (x = -512.5 + k), dx = 0.9964884795 m, dy = 1 m.
- Heights: `height_m = offset_m + v * scale_m`, offset -3,897.0 m, scale 0.01 m (the smallest step from 0.001, 0.002, 0.005, 0.01 that fits the range). No-data 65535. Quantisation error at most 0.005 m.

Files in `app/public/data` (bytes; `scene.json` `files` lists every file except `scene.json` itself):

| File | Bytes | Note |
|---|---|---|
| ortho/colour_core_0_0.webp | 1,181,780 | quality 85 (cap 1.8 MB kept, no step down) |
| ortho/colour_core_0_1.webp | 1,211,836 | quality 85 |
| ortho/colour_core_1_0.webp | 1,257,606 | quality 85 |
| ortho/colour_core_1_1.webp | 1,278,910 | quality 85 |
| ortho/colour_core_half.webp | 1,443,572 | quality 85 |
| ortho/colour_surround.webp | 1,402,534 | quality 85 |
| ortho/colour_overview.webp | 63,424 | quality 85 (cap 120 KB) |
| ortho/grey_core_0_0.webp | 889,548 | quality 90 |
| ortho/grey_core_0_1.webp | 927,548 | quality 90 |
| ortho/grey_core_1_0.webp | 937,480 | quality 90 |
| ortho/grey_core_1_1.webp | 938,818 | quality 90 |
| ortho/grey_core_half.webp | 1,089,604 | quality 90 |
| ortho/grey_surround.webp | 1,168,966 | quality 90 |
| ortho/grey_overview.webp | 68,930 | quality 90 |
| dem_core.bin | 2,101,250 | |
| dem_surround.bin | 526,338 | |
| slope_core.bin | 1,048,576 | 5 m baseline |
| waypoints.json | 56,611 | Task 2 |
| conditions.json, dose.json, sep-event.json, team-inputs.json | 18,180 | other tasks |
| scene.json | 3,620 | |
| Total | 17,615,131 | |

- `du -sk app/public/data`: 17,252 KiB (limit 25 MB). The largest file is `dem_core.bin`, 2,101,250 bytes (limit 5 MB).
- Colour checks (tests): tiles are RGB, 2,048 px, black share under 1 percent (core 0.0005 percent). The luminance of colour tile (0, 0) and (1, 1) correlates with the greyscale tile above 0.8; a vertically flipped colour tile correlates below 0.5 (same place, same orientation).
- Pixel scale read from each file: image 0.25 m, terrain 1.0 m.
- Projection parameters: equirectangular, sphere radius 3,396,190 m, standard parallel 0, central longitude 0, false easting and northing 0.
- No-data: 0 cells in the core terrain, 0 samples in the surround terrain. Share of image value 0 in the core: 0.0036 percent.

### Height range

- Core terrain: -3,718.67 to -3,464.59 m (1st to 99th percentile -3,700.4 to -3,497.1 m; median -3,633.7 m).
- Surround terrain: -3,895.66 to -3,379.64 m.
- The first plan bound (-3,700 to -3,500 m) failed on the real data at both ends. The heights are not a reader fault: the waypoint oracle passes (under 0.25 m), and a hillshade of the core terrain matches the core image feature by feature (no mirror, no shift seen). The core reaches the lower ground to the north-west and the higher slopes to the south-east.
- Test now (orchestrator decision): the core range lies inside -3,800 to -3,400 m and contains the rover box range -3,658 to -3,605 m. Pass.

### Slope

| Baseline | Above 15 degrees | 10 to 15 degrees | Median | Maximum |
|---|---|---|---|---|
| 1 m (reported only) | 40.3 percent | 21.7 percent | 12.5 degrees | 75.0 degrees |
| 5 m (written to `slope_core.bin`) | 30.2 percent | 20.2 percent | 10.1 degrees | 56.0 degrees |

- Shares are of the 1,024 x 1,024 core cells. The 5 m baseline matches the grid of the study behind the 15 degree limit (Pena-Asensio 2024, 5 m LOLA).
- The 1 m slope map shows metre-scale texture from the stereo terrain. The 5 m baseline lowers the median from 12.5 to 10.1 degrees and the share above 15 degrees from 40.3 to 30.2 percent.

## Bytes fetched

About 258 MB in total, cached under `/Users/ardasarikaya/marswalk-data-raw/tiff/`: 233,699,562 bytes for the image and terrain (estimate before the cut: 232 MB), then 23,926,239 bytes for the colour window on the second run (image and terrain came from the cache). No source file was downloaded whole.
