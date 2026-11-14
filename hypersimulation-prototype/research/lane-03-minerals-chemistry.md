# Lane 03-minerals-chemistry (raw worker report, 2026-11-03, not yet checked)

Note: firecrawl_scrape needs auth this session, so I used WebFetch (summaries; resolutions/numbers come via a summarizer, so tables may be paraphrased). No licence text was found on any page; NASA/PDS licence is UNCONFIRMED for all rows. Nothing downloaded.

| Name | Mission/instrument | Agency | What it shows | Direct URL | Access | Format | Resolution | Coverage | Licence | Size/rate | Confirmed? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OMEGA global maps (7 rasters + hydrous sites) | Mars Express OMEGA | ESA PSA (mirror at PDS GEO) | NIR albedo, pyroxene BD2000, olivine SP1-3, Fe3+ BD530, nanophase ferric, hydrated sites (OMEGA+CRISM, 1855 sites per search snippet) | https://www.cosmos.esa.int/web/psa/mars-maps (files under https://archives.esac.esa.int/psa/ftp/MARS-EXPRESS/OMEGA/MEX-M-OMEGA-5-DDR-GLOBAL-MAPS-V1.0/) | bulk file download; KMZ for Google Earth | GeoTIFF, ISIS cube, PDS IMG; CSV + Shapefile for sites | 44 ppd (1.48 km/px), 14400x7200 px | global map; Jan 2004-Aug 2010 data (snippet) | not stated | not stated | Yes (page opened) |
| TES mineral maps | MGS TES | NASA / ASU | 13 layers: quartz, K-feldspar, plagioclase, amphibole, low/high-Ca pyroxene, olivine, hematite, sulfate, carbonate, sheet silicate+glass, dust, RMS (36 endmembers, Bandfield 2002) | http://tes.mars.asu.edu/products/ (files at http://tes.asu.edu/mineral_map/) | bulk | GeoTIFF (4 ppd, MOLA overlay, ~3 MB each), ENVI, ISIS, ASCII | 1, 2, 4 ppd (4 ppd ~15 km/px, my arithmetic) | global, simple cylindrical | not stated | bulk 2.5-51 MB per file | Yes |
| TES thermal inertia maps + TSDR | MGS TES | NASA PDS GEO | thermal inertia (raw spectra also) | https://pds-geosciences.wustl.edu/missions/mgs/tes.html | bulk/browser; TES Data Tool tes.asu.edu/data_tool/ | PDS | not stated | not stated | not stated | not stated | Partly (page lists, no details) |
| CRISM MRDR (multispectral map tiles, Charts 1-30) | MRO CRISM | NASA PDS GEO | calibrated, mosaicked, map-projected multispectral survey | https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-multispectral-v1/mrocr_3201/ | bulk | PDS4 | ~200 m/px survey (Photojournal), 180 m (news snippet) | near-global, ~86% (snippet, UNCONFIRMED on primary) | not stated | not stated | Yes (volume); res/coverage only secondary |
| CRISM VRDR (VNIR hyperspectral tiles) | MRO CRISM | NASA PDS GEO | VNIR hyperspectral map tiles | https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-vnirhyperspectral-v1/mrocr_7001/ | bulk | PDS4 | not stated | Charts 1-30 | not stated | not stated | Yes (volume) |
| CRISM MTRDR (map-projected targeted) | MRO CRISM | NASA PDS GEO | local hyperspectral map tiles, map-projected with terrain models | https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/ | bulk | PDS4 | 18 m/px targeted (Photojournal) | patches only, 2006-09-30 to 2012-05-21 | not stated | not stated | Yes |
| CRISM TER / TRDR / DDR | MRO CRISM | NASA PDS GEO | targeted cubes (TER, MROCR_6001), reduced (TRDR, 2101-2116), derived (DDR 1001-1014) | https://pds-geosciences.wustl.edu/missions/mro/crism.htm | bulk | PDS4 | not stated | targeted patches, to 2022-05 | not stated | large | Yes |
| CRISM tile browse images (e.g. PIA10201) | MRO CRISM | NASA JPL Photojournal | single tile picture, 1964 tiles of ~300 km, 3 versions each | https://science.nasa.gov/photojournal/crisms-global-mapping-of-mars-part-1 | browser | JPEG, TIFF (5 MB) | ~200 m/px | per tile | not stated | small | Yes |
| Odyssey GRS element concentrations | Mars Odyssey GRS | NASA PDS GEO | Cl, Fe, H2O, K, Si, Th (maps + tables) | https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html | bulk, JPEG browse | .tab + .lbl ASCII, JPEG; PDS4 conversion dated 2026-10-01 (per page) | 2, 5, 10 deg bins (unsmoothed); 5 deg smoothed | global | not stated | small | Yes |
| Odyssey GRS hydrogen special products | Mars Odyssey GRS | NASA PDS GEO | neutron flux maps, hydrogen peaks (search result; WEH maps not found on a page) | https://pds.nasa.gov/data/pds4/releases/geo/odyssey_grs_special-20260120/readme.txt | bulk | ASCII tables | not stated | global | not stated | not stated | Search result only, not opened: UNCONFIRMED |
| MSL APXS, ChemCam (LIBS+RMI), CheMin, SAM, DAN | Curiosity | NASA PDS GEO | point chemistry/mineralogy per target; table of points | https://pds-geosciences.wustl.edu/missions/msl/ (apxs.htm, chemcam.htm, chemin.htm, sam.htm, dan.htm) | bulk, browser | PDS3/PDS4 (CheMin derived PDS4) | spot (APXS ~2 cm spots, snippet) | traverse points; Release 42 covers sols 4710-4843 | not stated | not stated | Yes (page opened) |
| Mars 2020 SuperCam, PIXL, SHERLOC | Perseverance | NASA PDS GEO | point chemistry/organics/mineral per target | https://pds-geosciences.wustl.edu/missions/mars2020/ (supercam.htm, pixl.htm, sherloc.htm: URLs inferred from relative links) | bulk, browser | PIXL CSV tables (snippet); others not stated | spot | traverse points; Release 16 sols 1740-1859 | not stated | 3 releases/yr | Page yes, bundle URLs UNCONFIRMED |
| Analyst's Notebook (MSL + M2020) | Curiosity, Perseverance | NASA PDS | search by sol/location/instrument, links to products, rover traverse data (snippet) | https://an.rsl.wustl.edu/ and https://an.rsl.wustl.edu/m20/ | browser/web app | tables, images | n/a | notebooks through sol 4612 / 1619 per snippet (may be stale) | not stated | not stated | Partly |
| JMARS layers (TES minerals, CRISM/OMEGA footprints) | multiple | ASU | free GIS viewer incl. TES mineral maps; CRISM/OMEGA footprints only | https://jmars.mars.asu.edu/what-jmars (snippets only) | desktop app | n/a | n/a | n/a | not stated | n/a | UNCONFIRMED |

Map layer vs points: easy layers = OMEGA global GeoTIFFs, TES GeoTIFFs, GRS element grids (convert .tab to raster), CRISM MRDR tiles (PDS4 cubes, heavy). Points only = ChemCam, APXS, CheMin, SAM, SHERLOC, PIXL, SuperCam, DAN (tables per sol/target; plot by rover location).

Richest locations:
- Curiosity traverse, Gale crater: APXS 700+ spots over >20 km in 2301 sols (snippet, study); all MSL instruments active through sol 4843 (MSL page). Densest point chemistry on Mars.
- Perseverance traverse, Jezero: PIXL, SHERLOC, SuperCam through sol 1859 (M2020 page). Jezero CRISM carbonate claim UNCONFIRMED.
- Hematite and olivine sites: TES mapped about 3% olivine-rich and 3% coarse hematite (search snippet; hematite led to Opportunity site). Not opened on a primary page.
- Odyssey GRS: hydrogen/water signal strongest at high latitudes (general knowledge, not sourced here).

Best for a 2-day build:
1. OMEGA global GeoTIFFs (ESA PSA): ready-made 1.48 km rasters, ready for web map overlay, no conversion.
2. TES mineral maps 4 ppd GeoTIFFs (ASU): 13 layers incl. carbonate, hematite, sulfate; ~3 MB each. Coarse, but fast.
3. MSL/M2020 point tables (PDS GEO / Analyst's Notebook) plus GRS element grids: pins on the map for where chemistry was actually measured, and a water/chlorine layer for resource planning. CRISM MRDR is the high-res option but needs PDS4 cube handling.

Gaps:
- Licence/terms and API rate limits: not stated on any opened page.
- Mars Trek WMTS layers: the https://api.nasa.gov/mars-wmts/catalog URL returned 404; trek.nasa.gov/mars page body empty. Cannot confirm any ready tile service with mineral layers (a search snippet describes a Mars Trek WMTS API, UNCONFIRMED).
- USGS Astropedia CRISM/mineral mosaics: not found.
- CRISM exact resolution/coverage on primary PDS pages (only Photojournal and news): 180 vs 200 m discrepancy, 86% unverified; 90 m map mentioned in news only.
- GRS WEH map location, MSL/M2020 per-instrument pages (apxs.htm etc.) not opened, so file formats per instrument not confirmed.
- Wiki-style pages of ChemCam, SuperCam, SHERLOC specifics (units, table columns) not read.
