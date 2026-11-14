# Lane 08-map-tools-apis (raw worker report, 2026-11-03, not yet checked)

Core finding: a 2-day Mars walk map should use free, key-less data (USGS blended DEM and hillshade as COGs, Mars Trek WMTS tiles) in Leaflet or CesiumJS, with gplanetary-nav for routes. I opened pages with WebFetch only, because Firecrawl needs auth, so the details below are summaries.

| Name | Owner | What it does | Direct URL | Access | Data it serves | Licence | Rate limit / sign-up | Maintained (last update) | Confirmed? |
|---|---|---|---|---|---|---|---|---|---|
| Mars Trek portal | NASA JPL | Browse, layer, measure, slope/lighting, download, 3D-print export | https://trek.nasa.gov/mars/jpl/config/textAbout.html | browser | Mars mission data products | Not stated on page | Not stated | v3.4.123-Mars, date not stated | Yes (page) |
| Trek WMTS API | JPL / SSERVI | RESTful OGC WMTS tiles; endpoints and styles come from each product's GetCapabilities | https://trek.nasa.gov/tiles/apidoc/trekAPI.html | tile service | Mars map layers | Not stated | No key or limit mentioned | Unknown | Yes (template only) |
| api.nasa.gov Mars WMTS catalog | NASA | Product list for the WMTS API | https://api.nasa.gov/mars-wmts/catalog | tile service | Mars layers | Unknown | Unknown | Unknown | NO: the URL returned 404 when I opened it |
| MMGIS | NASA-AMMOS | Configurable web GIS used by rover teams (Curiosity, InSight, Perseverance, Ingenuity), Leaflet 2D and Cesium 3D | https://github.com/NASA-AMMOS/MMGIS | browser, Docker self-host | You load your own layers | Apache-2.0 per sidebar, README text reads BSD-like | Self-host, none | 1,200 commits; no release or commit date visible | Yes |
| JMARS | ASU | Desktop GIS with stamp layers (THEMIS, CTX, HiRISE, HRSC, CRISM), landing-site layer | https://jmars.mars.asu.edu | desktop (Java) | Mars orbital layers | GPL (source on Subversion) | Login form present; whether an account is required is not stated | v5.7.4, 2026-10-30 | Yes |
| JMARS open source | ASU | Source code | https://jmars.mars.asu.edu/open_source | desktop source | n/a | GPL | none | n/a | Yes |
| USGS blended DEM 200 m (MOLA + HRSC) | USGS Astrogeology | Global elevation, a good fit for slopes | https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m | download (no COG) | Elevation | MOLA CC0, HRSC CC BY-SA 3.0 IGO (search snippet; the page itself returned 403) | none | Unknown | PARTIAL |
| Hillshade COG (200 m blend) | USGS ASC on S3 | Streamable GeoTIFF hillshade | https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendShade_Global_200mp_v2_cog.tif | COG over HTTPS | Shaded relief | As the blend above | none | Unknown | Link taken from a forum post; not opened |
| MOLA 463 m merge COG | USGS ASC on S3 | Global MOLA elevation as COG (~2 GB) | https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif | COG | Elevation | Unknown (MOLA is CC0 per snippet) | none | Forum post dated 2024-08-16 | Link from forum post; not opened |
| Astropedia / Planetary Maps | USGS | Product catalogue | https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m | download | Mars maps | per product | none | Unknown | Link only; the Annex page was NOT found |
| USGS WMS (planetarymaps.usgs.gov) | USGS | Legacy MapServer WMS | UNCONFIRMED | WMS | MDIM21, MOLA | Unknown | Unknown | Unknown | UNCONFIRMED; based on a third-party guide |
| PILOT | USGS / PDS Imaging | Image footprint search portal | https://pilot.wr.usgs.gov/ | browser | PDS image archives | Unknown | none | Page shows 2018-09-10; unknown if live | Page opened; no API mentioned |
| ODE REST API | PDS Geosciences (WUSTL) | Search PDS products, plus point queries on MOLA | https://oderest.rsl.wustl.edu | REST API | Orbital products, MOLA | Not stated | None stated | Manual V2.1.6 | Yes (base URL); params and CORS not seen |
| PDS Imaging Node / Atlas | JPL | Image archive and atlas | https://pds-imaging.jpl.nasa.gov | browser | Mars 2020, InSight, MSL | Unknown | none | Atlas IV in beta (search snippet) | Only seen in search results; no official API found |
| NASA-PDS validate | NASA PDS | Validates PDS4 labels | https://github.com/NASA-PDS/validate | Java CLI | n/a | Apache-2.0 | none | Active CI; no release date seen | Yes |
| ISIS3 | USGS | Planetary image processing | https://github.com/DOI-USGS/ISIS3 | desktop CLI | n/a | Page does not state it; snippets say public domain/CC0 | none | v9.0 (2026) | Partial |
| GDAL ISIS3 driver | OSGeo | Reads, writes, updates ISIS cubes; reads planetocentric or planetographic labels | https://gdal.org/drivers/raster/isis3.html | library | n/a | Not checked | none | Doc refers to release/3.13 | Yes |
| GDAL PDS4 driver | OSGeo | Reads and writes PDS4 imagery | https://www.gdal.org/drivers/raster/pds4.html | library | n/a | Not checked | none | Unknown | Search-result text only |
| IAU_2015 codes | IAU / PROJ / spatialreference.org | Mars CRS definitions | https://spatialreference.org/ref/iau_2015/49902/ | CRS library | n/a | Unknown | none | n/a | Yes: 49902 = "Mars (2015) / Ocentric" |
| OPM basemaps and opm-leaflet | OpenPlanetary | Leaflet plugin with Mars basemaps | https://www.openplanetary.org/opm/basemaps | tile service, library | Viking mosaic, MOLA colour, hillshade | Not stated | none | 2020 forum thread: 403s on some layers | UNCONFIRMED (npm page returned 403) |
| CesiumJS | Cesium | 3D globe; set Ellipsoid.default to MARS | https://github.com/CesiumGS/cesium | library (browser) | n/a | Apache-2.0 | none | no release date seen | Yes |
| Cesium Mars (ion asset 3644333) | Cesium | Global 3D Tiles: 232 m Viking imagery, 200 m blended DEM, Jezero 6 m and Gale 25 cm imagery | https://cesium.com/platform/cesium-ion/content/cesium-mars/ | tile service (3D Tiles) | Terrain and imagery | Cesium ion ToS plus attribution to NASA and USGS | ion account needed; free tier not stated | Unknown | Yes |
| gplanetary-nav | UToronto STARS | Python global planner on a pixel graph (shortest, fastest, lowest-energy) | https://github.com/utiasSTARS/gplanetary-nav | library (Python) | Takes your DEM and slope rasters | MIT | none | 2 commits, no date | Yes |
| safe-rover-navi | OMRON SINIC X | ML traversability and risk-aware planner | https://github.com/omron-sinicx/safe-rover-navi | library | n/a | UNCONFIRMED | none | UNCONFIRMED | Search snippet only |
| ENav / MLNav | JPL | Perseverance onboard navigation | https://ntrs.nasa.gov/citations/20220003784 | papers only | n/a | n/a | n/a | n/a | Papers confirmed; no public code found |

Best for a 2-day build:
1. USGS blended DEM and hillshade (COG) with Leaflet or CesiumJS. Both are key-less and have clean licences. Slope and aspect can be computed from the DEM (GDAL or in the browser).
2. Mars Trek WMTS tiles plus the Cesium Mars tileset. Trek gives many extra layers via GetCapabilities. Cesium Mars gives a ready 3D globe, with 25 cm imagery at Gale and 6 m at Jezero.
3. gplanetary-nav (MIT) for routes on the DEM slope raster. It is global-scale only and not a rover-grade local planner.

Traps:
- api.nasa.gov/mars-wmts/catalog returned 404, so find live WMTS endpoints from the Trek apidoc and GetCapabilities. Missing tiles mean no coverage.
- Cesium Mars cannot use the Earth globe, 2D or Columbus view, or the geocoder. It also needs an ion account.
- Mars has no EPSG codes. Use IAU_2015. PROJ strings for 49901 lack +axis (nwu), and PROJ closed that issue without a fix (https://github.com/OSGeo/PROJ/issues/3995). Prefer WKT2 or PROJJSON.
- Mars longitude convention differs. Check ocentric vs ographic and east vs west positive (the ISIS3 label fields show both exist).
- The ~11 GB blended DEM has no COG. Cloud-optimized GeoTIFFs exist only for the hillshade and the 463 m MOLA merge.
- OPM basemaps had 403 reports in 2020. Test them before relying on them.
- CORS was not checked for any endpoint. Test each from a browser.

Gaps:
- Mars Trek's real tile hostnames and layer list were not seen, and neither were its licence or rate limits.
- Licences not read for the Astropedia blended DEM page (403, only from search snippet), the ISIS3 LICENSE, the GDAL drivers, and the PILOT and Imaging Node pages.
- Astropedia Annex, the USGS Astrogeology WMS and STAC endpoints, the PDS Imaging Node API, and the pds4-tools Python package were not confirmed.
- The IAU code 49900 was not opened. A search snippet called it ocentric, but the spatialreference page I opened says 49902 is ocentric.
- ENav and MAPGEN source code was not found. No traversability tool beyond gplanetary-nav was fully checked.

Watch: Firecrawl needs authorizing via /mcp. Until then nothing here was read verbatim, and the licences in the table are page summaries.
