# check-a-map-services (worker report, 2026-11-03)

Budget: ~120K tokens, stopped early. Firecrawl ran out of credits mid-run (resets 2026-11-04 03:48 UTC), so a few pages were read through WebFetch summaries only. WebFetch gives no HTTP headers.

1. Mars Trek WMTS: CONFIRMED (corrected)
- Real GetCapabilities URL pattern: https://trek.nasa.gov/tiles/Mars/EQ/{Layer}/1.0.0/WMTSCapabilities.xml. Opened and valid for the four layers below.
- Viking colour: layer Mars_Viking_MDIM21_ClrMosaic_global_232m, JPEG, zoom 0-7. The worker/search-result name "Viking_MDIM21_ClrMosaic_global_232m" returns 404; the "Mars_" prefix is required.
- THEMIS day IR: THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018, PNG, zoom 0-9. A THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018 layer is also listed.
- CTX: Gale_CTX_BlockAdj_dd, PNG, zoom 0-1 only in its capabilities. There are many regional CTX mosaics, plus a "curiosity_ctx_mosaic" layer.
- HiRISE: HiRISE_Global capabilities load, PNG, zoom 0-17, ArcGIS MapServer-style ResourceURL (.../MapServer/tile/{z}/{row}/{col}). Regional HiRISE mosaics (curiosity_hirise_mosaic and others) are also listed.
- Elevation and slope: Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw (colour-shaded 200 m blend; JPEG per capabilities, zoom 0-8), Mars_MGS_MOLA_ClrShade_merge_global_463m, mola_roughness (PNG, zoom 0-1 only), plus many CTX_ClrSlope_8bit_*_24mp_* regional slope layers. These are rendered images, not raw elevation values.
- Real tile: https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/0/0/0.jpg returned a 51.7 KB JPEG.
- API key: none needed for direct trek.nasa.gov access (the tile fetched with no key). The apidoc page and /tiles (a redirect page) state no licence, key or rate limit. Capabilities for THEMIS has no AccessConstraints or Fees.
- Capabilities quirks: MatrixWidth/Height are written as "2.0", and the ResourceURL has a double slash (1.0.0//{Style}). Strict clients may reject this.
- https://api.nasa.gov/mars-wmts/catalog: my fetch timed out. The 404 report is UNVERIFIED from here, but the direct host works so it is not needed.
- URLs: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars , https://trek.nasa.gov/tiles , the capabilities URLs above.

2. USGS STAC: PARTIALLY CONFIRMED
- The API is live. Root: https://stac.astrogeology.usgs.gov/api/ (id usgs-stac-api, STAC 1.1.0). It advertises item-search with GET/POST plus fields, sort, query, filter and CQL2 spatial functions, so bbox search is supported. I did not run a bbox query because I may not add query strings.
- The CTX docs page states "CC0-1.0 license" (https://stac.astrogeology.usgs.gov/docs/data/mars/ctxdtms). The HiRISE page also states CC0.
- Collection ids: CTX is mro_ctx_controlled_usgs_dtms (CC0-1.0). HiRISE is mro_hirise_socet_dtms (CC0-1.0).
- The HiRISE docs page links to .../collections/mro_hirise_controlled_socet_dtms, which returns 404. That link is wrong.
- Counts: neither collection page nor the CTX docs page shows an item count (numberMatched was absent). The HiRISE docs page says "over 900 DTMs", last updated July 2023, which is stale.
- The 4,815 CTX figure is not on the docs page I read.
- The API has 18 collections (https://stac.astrogeology.usgs.gov/api/collections).
- CTX collection extent: lat -65.4 to 65.9, temporal 2023-04-18 to 2025-07-04.
- URLs: https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/ , https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms

3. COG files on asc-pds-services: UNVERIFIED (not opened)
- I did not fetch the multi-GB files, and I have no HEAD tool.
- The only evidence is a USGS staff post (Trent Hare, 2024-08-16), quoted: "we have not made a COG version of the original elevation DEM data." The same post names mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif (MOLA 128 ppd) and Mars_HRSC_MOLA_BlendShade_Global_200mp_v2_cog.tif (hillshade only).
- So a COG of the full 200 m blended DEM: REFUTED as of that post. Only a hillshade COG is mentioned. The 11 GB plain GeoTIFF on planetarymaps.usgs.gov is the elevation source.
- URL: https://openplanetary.discourse.group/t/looking-for-mars-dem-tiles/804

4. Cesium Mars: PARTIALLY CONFIRMED
- The page table says: global imagery 232 m, global terrain 200 m, Jezero imagery 6 m, Jezero terrain 20 m, Gale imagery 25 cm, Gale terrain 1 m.
- Asset is ion ID 3644333, 3D Tiles. The sources are USGS products.
- It requires a Cesium ion account.
- Community plan: the Cesium Global 3D Content ToS lists Cesium Mars as covered content. The pricing page says every plan includes global 3D imagery, terrain and buildings, but does not name Mars. It also lists Community as "Personal and non-commercial use" and allows exploratory and unfunded educational use. The pricing FAQ requires a paid licence for a funded company, a government project or funded research. Whether a public hackathon project is allowed is not stated on any page I opened. I did not open the Content Usage and Attribution Guide.
- Community quotas: 10 GB storage, 15 GB/month streaming.
- URLs: https://cesium.com/platform/cesium-ion/content/cesium-mars/ , https://cesium.com/platform/cesium-ion/pricing/ , https://cesium.com/legal/cesium-global-3d-content-tos/

5. MMGIS: CONFIRMED / PARTIAL
- Licence: Apache License 2.0, "Copyright 2020 California Institute of Technology" (https://github.com/NASA-AMMOS/MMGIS/blob/development/LICENSE).
- Latest release: v5.2.24, 2026-08-03 (https://github.com/NASA-AMMOS/MMGIS/releases).
- Hosted demo: none found. The README has a demo video and docs at nasa-ammos.github.io/MMGIS. A web search found no public live demo.

6. gplanetary-nav: CONFIRMED
- Licence: MIT.
- Only 2 commits: 2023-06-19 and 2025-01-30 ("Updated citation"). Effectively unmaintained (https://github.com/utiasSTARS/gplanetary-nav/commits/main).
- Alternatives:
  - GRASS r.walk plus r.path. The manual says r.walk computes anisotropic cumulative cost over an elevation raster plus a friction raster, with a Naismith-style walk formula and uphill/downhill asymmetry. The GRASS 8.4 manual is the reference (https://grass.osgeo.org/grass84/manuals/r.walk.html).
  - skimage.graph.route_through_array: I could not open its docs. UNVERIFIED.

7. ODE REST: CONFIRMED (with caveats)
- Product count (HiRISE RDRV11, lat 0-10, lon 1-5): status Success, count 353 (the live2 URL from the page).
- GDS query=molapedr (lat 0-0.01, lon 0-0.01): Finished, with 95 CSV files listed, and the result files expire after 30 days. It returns file links, not inline values.
- No direct point-elevation endpoint is documented. MOLA PEDR via GDS is the closest.
- The page gives no numeric limit. The manual (ODE_REST_V2.1.6.pdf) was not opened. Download it and read it with Read (https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf) for limits.
- URL: https://oderest.rsl.wustl.edu

8. CORS: UNVERIFIED
- No page I found documents CORS for Trek or the USGS S3 bucket, and my tools return no headers.
- To settle it, run curl -I with an Origin header against a Trek tile and against a COG on S3.
- A fallback is a same-origin proxy for the tiles.

Source quality: Trek, USGS STAC and Cesium are primary pages. The Trek apidoc was read from a saved scrape. The ODE and STAC collection details are WebFetch summaries.
