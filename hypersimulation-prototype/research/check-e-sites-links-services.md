# check-e-sites-links-services (worker report, 2026-11-04)

Credits used: about 21. Method limit: I had no shell or jq, only Grep and Read, so the big saved files were mined with regex snippets. I can only partly confirm item 1's zone table and nothing for the 2015 limits, and I could not check the ODE rate limit or the RAD current sol range.

1. EXPLORATION ZONES: PARTIAL.
Source text: the saved abstracts file (path in your brief). The zone table below is incomplete; the file holds about 20 or more zones, so parse it with python/jq. Pairings are by adjacency in the text.
| Zone | Centre as printed | Reason |
|---|---|---|
| East Melas | "~11.7 S"; "293.367°E -11.684°N" (same text block; the name is paired by adjacency) | RSL/ISRU water, Valles Marineris |
| Gale (Yun, El Camino College) | 4.6°S 137°E | MSL results, science and resource ROIs |
| Gale (another proposal) | 137.4019° lon, -4.5965° lat; 100 km EZ plus 25 km EZ | centre of the MSL landing ellipse |
| Meridiani Planum (NASA Ames) | 3°10'26.25"S, 4°31'2.33"W | Noachian and Hesperian science ROIs, Victoria and Endeavour craters |
| Southern Meridiani (probable) | lat -3.0 to -6.2, lon -36.7 to -33.6 as printed. The hit does not name a zone, so Southern Meridiani is my guess. | not captured |
| ISRU-ground-truth zone (unnamed) | 22.3°N, 48.3°W | resource confirmation; "latitude near 30°N" is cited for near-surface ice |
| Unnamed, abstract text not attributed to a name | 17.747°N 77.037°E | flat basaltic lava flows |
| Unnamed | 13°S 175°E | not captured |
| Unnamed | 10°N 162°E | not captured |
| Unnamed | -18.83°N 310.79°E (as printed) | not captured |
- Zones named in the file with no coordinates captured: Hebrus Valles, Hypanis (northern Xanthe), Chryse Planitia, Jezero watershed/Isidis/Syrtis, Sinus Meridiani, Aeolis Palus.
- The hub says an EZ lies within about 100 km (60 miles) of the landing site. The LPI page says "approximately 100 kilometers".
- Latitude and elevation limits set in 2015: NOT FOUND on the hub or the LPI home page. The First Announcement PDF likely holds them; read it with Read: https://www.nasa.gov/wp-content/uploads/2015/06/first-landing-site-announcement.pdf
- Hub: https://www.nasa.gov/missions/nasa-seeks-ideas-for-where-on-mars-the-next-giant-leap-will-take-place/ (also lists the Second Announcement and the Rubric PDFs). LPI: https://www.hou.usra.edu/meetings/explorationzone2015/

2. DEMs: CONFIRMED.
- Gale 1 m merged DEM v3, 3.6 GB, GeoTIFF: https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif
  - Page: Use Constraints "None"; Access Constraints "Please credit authors" (Parker and Calef).
  - Extent: lat -5.098652 to -4.129605, lon 137.124167 to 137.680559.
  - Vertical accuracy about 1 m. Equirectangular, planetocentric.
- Mars 2020 TRN CTX DTM mosaic. The file is 20 m/pixel, not 1 m: https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
  - Index: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/index.html
  - I did not read the file size.
- Jezero HiRISE DTM at 1 m: NOT FOUND (not searched beyond these pages).

3. MEDA and REMS: CONFIRMED.
- MEDA: page header says "Feb 19, 2021 (Ls 6.1 MY 36) to [ongoing]", page last updated 15 Oct 2026. The derived-data folder runs to sol_1740_1859, last sol directory sol_1859. The folder was modified 2026-08-11. Some sols are skipped (e.g. 1767-1768, 1778-1779). Other levels (calibrated, raw) were not checked.
  - https://pdsatmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html
  - https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/sol_1740_1859/
  - Data are CSV tables.
- REMS: header says "Aug 7, 2012 (Sol 1) to March 22, 2025 (Sol 04488)[ongoing]", but the reduced-data line says "RDR data files for sols 1-4843". The page was last updated 3 Aug 2026. The two figures conflict; treat 4843 as the newer. Cadence is 1 Hz, 5-minute samples hourly plus extra 60-minute samples.
  - https://atmos.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html

4. RAD RDR: PARTIAL.
- Format: "All RDR data files are ASCII text (TXT), and each file contains one Mars day (sol) of data."
- Cadence: raw accumulation "canonically ~15 minutes". The SIS says "a minimum of 15 minutes of observation per hour" is needed for science.
- Dose field: the Dosimetry section holds "DOSIMETRY_TOTAL_DOSE_B" and "..._E" (B and E detectors) plus LET and DWE (dose weighted equivalent). I did not capture the units.
- Sol range in the MSLRAD_1002 volume: SOL_00000_00089 to SOL_00708_00804, last modified 2015-04-30. A current sol range: NOT FOUND (that volume is only an early snapshot).
- https://pds-ppi.igpp.ucla.edu/archive1/MSLRAD_1002/DOCUMENT/RAD_RDR_SIS.HTM and https://pds-ppi.igpp.ucla.edu/archive1/MSLRAD_1002/DATA/

5. ODE REST V2.1.6: PARTIAL.
- Output: "output= or o=" accepts XML (default) or JSON, with a jsonp callback. Query results also have KML and Shapefile coverage queries.
- Result limit: "limit=#" defaults to 100 for product queries and 1 for browse and thumbnail queries. Use an offset to page through longer results.
- Rate limit or maximum result cap: NOT FOUND in my regex pass; I did not read the whole PDF. Saved text is at /Users/ardasarikaya/.claude/projects/-Users-ardasarikaya-Desktop-Business-Arda-AI-OS--claude-worktrees-nice-vaughan-48d3f0/37ee352c-5a12-469a-870d-5f5d3a6063ee/tool-results/mcp-12333db2-6471-4b0e-9131-7b0f7f6134aa-firecrawl_scrape-1793747797102.txt
- PDF: https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf. Search it for "Table 7".

6. CESIUM: PARTIAL.
- The Content Usage and Attribution Guide never mentions the Community plan or Mars. It defers to the Plan FAQ and requires "prominently display the Cesium ion logo" plus data attribution. https://cesium.com/learn/ion/content-usage-and-attribution-guide/
- The Plan FAQ lists what the free Community account can be used for. Verbatim items: "Non-commercial personal projects" and "Unfunded educational activities". https://cesium.com/platform/cesium-ion/pricing/
  - A paid account is needed for "funded educational research" or if you exceed usage limits (Community: 15 GB streaming/month).
  - A public open-source student project looks allowed only if it is unfunded and non-commercial.
  - The FAQ is silent on the project being public or open source. Mars is not in the FAQ. If the team has hackathon prize or sponsor funding, ask Cesium.
- The Cesium Mars content page was not read: https://cesium.com/platform/cesium-ion/content/cesium-mars/. Third-party terms: https://cesium.com/legal/third-party-terms/

7. TREK AND ESRI: PARTIAL.
- Esri OnMars HiRISE terms of use: NOT FOUND. The astro.arcgis.com item page was not fetched.
- Another NASA-hosted Trek HiRISE layer: CONFIRMED. https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/WMTSCapabilities.xml
  - WGS84 bounds -4.9254743 to -4.2489588 lat, 137.1224669 to 137.7298129 lon (Gale).
  - Tile size 256, PNG, EPSG:104905 (as printed).
- HiRISE_Global capabilities: https://trek.nasa.gov/tiles/Mars/EQ/HiRISE_Global/1.0.0/WMTSCapabilities.xml
  - Whole globe, tile size 512, PNG, with a note labelling the layer "HiRISE Global Uncontrolled".
- CTX_ClrSlope layers for Gale and Jezero: NOT FOUND. https://api.nasa.gov/mars-wmts/catalog returned 404. Next try is the Trek API doc page.

8. SWIM: PARTIAL.
- The licence or reuse statement on the swim.psi.edu home and SWIM2 products pages: NOT FOUND. Nothing from PSI, JPL or USGS found in this pass.
- Oct 2023 data set location: NOT FOUND. The home page links the products pages (SWIM 2.0, 1.0, pilot, SWIM4MIM) and "NASA Mars Water Resource Maps".
  - https://swim.psi.edu/
  - https://swim.psi.edu/SWIM2Products.php (SWIM 2.0 products last updated 2021-02-24)
  - https://ammos.nmsu.edu (not fetched)

Source quality: all agency or vendor primary pages. Nothing is peer-reviewed.

## Browser access test of the two new terrain files (main session, 2026-11-04)

```
== https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif
HTTP/2 302 
== https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
HTTP/2 302 
```

Following the redirect:

```
== https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif
HTTP/2 302 
location: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Accept-Ranges: bytes
Content-Length: 3868256546
== https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
HTTP/2 302 
location: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Accept-Ranges: bytes
Content-Length: 9662387
```
