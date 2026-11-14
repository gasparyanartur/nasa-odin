# Lane 02-terrain-elevation (raw worker report, 2026-11-03, not yet checked)

Lane: Mars terrain and elevation. 13 entries below were each confirmed on a page I opened (scraped). The gaps are listed at the end.

| Name | Mission/instr | Agency | Shows | URL | Access | Format | Res | Coverage | Licence | Size/rate | Confirmed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MOLA MEGDR (PDS4 bundle) | MGS/MOLA | NASA PDS Geosciences | Global topography, radius, areoid, counts | https://pds-geosciences.wustl.edu/missions/mgs/megdr.html | bulk (HTTP dirs), ODE | .img + .xml/.lbl/.hdr | 4,16,32,64,128 ppd; polar 128/256/512 ppd | Global; 128 ppd tiles span 88N-88S, polar maps separate | not stated on page (Astropedia lists MOLA as CC0) | per-file sizes not shown | Y |
| MOLA PEDR | MGS/MOLA | NASA PDS Geosciences | Raw altimetry shot tracks (version L) | https://pds-geosciences.wustl.edu/missions/mgs/pedr.html | bulk, ODE query (lat/lon/orbit, table or shapefile) | PDS binary tables | ~300 m along-track spacing (from CTX page) | Tracks only, gaps between orbits | not stated | not shown | Y |
| MOLA 128 ppd global merged COG | MGS/MOLA | USGS | Global MOLA DEM, cloud-optimised | https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif | bulk, range reads (GDAL vsis3, QGIS) | COG GeoTIFF | 128 ppd | Global, 88-90 deg gap filled | not stated | ~2 GB | Y (USGS staff post; file not opened) |
| MOLA-HRSC blended DEM v2 | MGS/MOLA + MEX/HRSC | USGS Astrogeology | Global elevation | https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m | bulk | GeoTIFF 16-bit, simple cylindrical | 200 m/px | Global; HRSC covers 44% | MOLA CC0, HRSC CC BY-SA 3.0 IGO; cite authors | 11 GB (planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif) | Y |
| MOLA-HRSC blended shaded relief COG | same | USGS | Hillshade of blend | https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendShade_Global_200mp_v2_cog.tif | bulk, range reads | COG | 200 m | Global | not stated | not shown | Y (via forum post) |
| JMARS HRSC/MOLA layers | derived from blend | ASU | Slope, azimuth, elevation, shaded and coloured relief | https://jmars.asu.edu/node/2607 | desktop browser app | in-app numeric maps | 200 m | Global | not stated | n/a | Y (only slope source I found) |
| HRSC DTMs (Level 4) | MEX/HRSC | ESA PSA, DLR, FU Berlin, NASA PDS | Stereo DTMs + orthoimages | https://sci.esa.int/web/mars-express/-/42328-hrsc-high-level-data-products-available | browser (HRSCview), archive | not stated | ~50 m grid per blend page | 12% in 2008; 44% used in 2017 blend | CC BY-SA 3.0 IGO (per Astropedia) | n/a | Partial: 2008 page, no current status |
| CTX DTMs, USGS controlled | MRO/CTX | USGS | 20 m DTMs, hillshade, orthos, error images | https://stac.astrogeology.usgs.gov/docs/data/mars/ctxdtms | STAC API, S3 (no account), browser, web map | COG GeoTIFF | 20 m post, ~3-5 m vertical | 4,815 DTMs (Apr 2023 announcement); partial | CC0 | aws s3 ls --no-sign-request s3://astrogeo-ard/mars/mro/ctx/controlled/usgs/ | Y |
| HiRISE DTMs, all PDS-delivered | MRO/HiRISE | USGS STAC; UArizona | 1-2 m DTMs, 0.25 m orthos, hillshade, figure-of-merit | https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/ | STAC API, browser, web map | COG GeoTIFF | 1-2 m post | "over 900" (STAC, Jul 2023); UArizona lists 1,338 entries (Oct 2026) | CC0 | not shown | Y |
| UArizona HiRISE DTM catalog | MRO/HiRISE | Univ. Arizona LPL | Browsable DTM list and map | https://www.uahirise.org/dtm/ | browser | n/a | n/a | "Page 1 of 56 (1,338 images)" | not checked | n/a | Y |
| Mars 2020 TRN CTX DTM mosaic (Jezero) | MRO/CTX | USGS | Jezero DTM | https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic | bulk | GeoTIFF | 20 m | Jezero only, 18.2-18.7N, 77.2-77.7E | "Please cite authors" | 9.3 MB | Y |
| MSL Gale merged DEM v3 | HRSC+CTX+HiRISE | USGS | Gale crater DEM | https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m | bulk | GeoTIFF 32-bit | 1 m | Gale only, -5.1 to -4.1N, 137.1-137.7E | "Please credit authors" | 3.6 GB | Y |
| Cesium Mars 3D Tiles | derived from USGS blend | Cesium (commercial) | Ready 3D terrain tileset | https://cesium.com/platform/cesium-ion/content/cesium-mars/ | tile service (needs ion account) | 3D Tiles | Global 200 m; Jezero 20 m; Gale 1 m | Global | Cesium ToS + attribution | not stated | Y; not NASA, needs sign-up |
| Mars Trek WMTS | NASA JPL | NASA | Tile service (MOLA layers claimed) | https://api.nasa.gov/mars-wmts/catalog | WMTS tiles | png/jpg | n/a | n/a | not found | not found | Partial: service exists (a Viking layer's capabilities XML loaded); elevation layers not confirmed |

Richest locations:
- Jezero: 20 m CTX mosaic; a paper cites a 1 m HiRISE DTM there. Cesium Mars lists 20 m terrain.
- Gale: 1 m merged DEM (3.6 GB), the densest single product I opened.
- Elsewhere: the UArizona list names Nili Fossae, Juventae Chasma, Chryse Planitia, Maja Valles and Ares Vallis. These are only the 20 newest entries on page 1, not a density ranking.
- Near the equator CTX DTMs overlap most (HiRISE-paired). I did not map their density.

Best for a 2-day build:
1. MOLA-HRSC blended DEM (200 m): global, CC0 / CC BY-SA, GDAL-readable. The 11 GB file is heavy, so use the 2 GB MOLA COG for a first pass. JMARS has slope for it.
2. CTX DTMs via the STAC API or S3 (no account): 20 m, CC0, 4,815 DTMs, queryable by bounding box. Good for a walk-scale layer around a chosen site.
3. Gale or Jezero DEMs: 1 m or 20 m, small enough to hillshade and compute slope locally. They also give a ground-truth site to demo.

Gaps:
- No downloadable global slope or roughness raster found. JMARS shows slope in-app only. Aharonson 2001, Kreslavsky/Head roughness and the PGDA MOLA catalog are leads only, not opened.
- Mars Trek layer list, elevation or slope tiles, licence and rate limits: trek.nasa.gov/mars/ rendered empty and api.nasa.gov/mars-wmts/catalog returned 404.
- HRSC DTM current coverage and file URLs: the PDS and PSA pages were not opened, and the 2008 and 2017 percentages are dated. HRSC level-3 mosaic mentioned in a search result was not opened.
- Ready 3D meshes: the UT Austin Jezero delta STL dataverse loaded empty (no files visible), so UNCONFIRMED. Sketchfab Mars models and NASA 3D Resources glb files were not opened.
- MOLA MEGDR and PEDR licence not stated on the PDS pages. The 2 GB COG and shaded-relief COG came from a USGS staff forum post, not USGS pages.
- Rate limits: no limits found for any listed service.
- Page text contained no injection attempts.
