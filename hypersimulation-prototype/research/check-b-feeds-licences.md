# check-b-feeds-licences (worker report, 2026-11-03)

Method: the four GeoJSON files were read only as WebFetch slices (no full download). Licence pages were scraped in full. Zenodo values come from WebFetch summaries of the API JSON.

1. CONFIRMED (reachable, with caveats). All four returned content.
- M20_waypoints.json: last feature sol 2022, site 93, drive 0, dist_km 45.25. https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
- M20_traverse.json: last feature sol 2022 (RMC 92_0 to 93_0). https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
- MSL_waypoints.json: last feature sol 5045, site 125, drive 1326, dist_km 38.16. https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
- MSL_traverse.json: features carry only `Length`, with no sol and no site/drive, so you cannot cut it by sol. Cut with MSL_waypoints.json by sol instead, or by lon/lat. https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json
- Sizes: file text is roughly 0.6 MB (M20 waypoints), 1.7 MB (M20 traverse), 0.66 MB (MSL waypoints) and 1.36 MB (MSL traverse). Waypoint fields: RMC, site, drive, sol, lon, lat, elev, dist_km, plus `images` panorama metadata.
- Lon/lat range of the MSL files: about 137.4E and 4.6S.
- Not seen: the middle of each file, because only the head and tail were read.

2. PARTIALLY CONFIRMED. Sol ranges found, no coordinates.
- Boxwork campaign phases per NASA blog (Feb 17 2026): Phase 1 sols 4534-4570, Phase 2 sols 4571-4599, Phase 3 sols 4600-4805, Phase 4 from sol 4805 (open-ended).
- Drill sites named in that post: Altadena, Valle de la Luna (hollow), Nevado Sajama (ridge). Other names: "Volcán Peña Blanca", "Los Flamencos", "Mollecita", "Monte Cielo", and the next target "Valle Grande".
- Official NASA name for the area: "boxwork unit", with a "main boxwork area". No lat/lon is given.
- Cut MSL_waypoints.json by sol 4534 to about 4805+, then check the end sol. The rover is already at sols 5043-5049 ("Nazca" drill), so the campaign has ended. The end sol was not verified.
- https://science.nasa.gov/blog/curiosity-blog-sols-4804-4811-kicking-off-the-final-phase-of-boxwork-exploration/

3. CONFIRMED. Both feeds respond with JSON.
- Mars 2020 feed: 5 items, highest sol 2024, site 93, drive "0". total_results 594029. Fields: sol, site, drive, imageid, camera, attitude, image_files, link, date_taken_utc, date_taken_mars, credit, caption, extended, sample_type, title.
- MSL v1 feed: 2 items, highest sol 5063, site 125, drive 1326. total 1515327. Fields: id, site, drive, sol, imageid, camera_position, xyz, attitude, instrument, url, https_url, mission, date_taken, image_credit.
- Join key: site + drive, matching `site` and `drive` in the waypoint files. This is my inference, not tested. Also check that "drive" is a string in the Mars 2020 feed.
- Both feeds run a few sols ahead of the waypoint files (2024 vs 2022, 5063 vs 5045).
- URLs: the two you gave.

4. PARTIALLY CONFIRMED.
- New path: https://ccmc.gsfc.nasa.gov/DONKI/api documents the server https://ccmc.gsfc.nasa.gov/DONKI-API (OpenAPI v2.0) with no key parameter. A GET to https://ccmc.gsfc.nasa.gov/DONKI-API/get/CME?startDate=2026-10-01&endDate=2026-10-05 returned CME JSON with no key. No rate limit is stated on that page.
- Old path: https://api.nasa.gov still documents DONKI with DEMO_KEY (example `https://api.nasa.gov/DONKI/CME?...&api_key=DEMO_KEY`). My test call to it returned HTTP 503, so its status is UNVERIFIED. It may be a temporary outage.
- DEMO_KEY limits on api.nasa.gov: 30 requests per hour and 50 per day, per IP. A normal key defaults to 1,000 per hour (line truncated in my read). https://api.nasa.gov
- DONKI notification queries are capped at a 60-day window.

5. Licences:
- NASA images: "generally are not subject to copyright in the United States". Meets "freely available". The NASA acknowledgement request holds. Logos are not public domain. Commercial use must not imply endorsement, and identifiable persons need permission. https://www.nasa.gov/nasa-brand-center/images-and-media/
- HiRISE: "no restrictions on their usage by anyone in the public". Credit "NASA/JPL/University of Arizona". Meets. https://uahirise.org/media/usage.php
- Murray Lab CTX V01: "grants free use of the V01 version of the mosaic for all purposes". Credit "NASA/JPL/MSSS/The Murray Lab". Meets. The paper citation is requested. https://murray-lab.caltech.edu/CTX/
- Mars Climate Database: "may not be put to any commercial use without specific authorization". Scientific use is free if the origin is quoted and the authors are kept informed. The web interface is for "moderate use only". Freely available, but it LIMITS commercial use, and it is not an OSI licence. Flag it. https://www-mars.lmd.jussieu.fr/mars/access.html
- Montabone dust climatology: "Creative Commons Attribution-ShareAlike 3.0 Unported", with commercial use allowed and no registration required. Meets (open content licence, not an OSI software licence). https://www-mars.lmd.jussieu.fr/mars/dust_climatology/
- SWIM: the page states NO licence. REFUTED as "licence identified"; it needs a licence statement from PSI or USGS. https://swim.psi.edu/SWIM2Products.php
- HRSC at ESA PSA: "Data hosted in the ESA Space Science Archives are distributed under the CC BY-NC 3.0 IGO licence". Commercial use needs prior ESA authorisation (data.licences@esa.int). It BARS commercial use. Credit line "ESA, T. Roatsch, D. Tirsch". https://cosmos.esa.int/web/esdc/terms-and-conditions. Released HRSC images are CC BY-SA 3.0 IGO, credited "ESA/DLR/FU Berlin" (https://www.dlr.de/en/blog/archive/2014/simpler-usage-rights-as-of-today-mars-express-hrsc-images-licensed-under-creative-commons-licence). I did not open the PSA site itself, so which licence applies to PSA-hosted HRSC data is UNVERIFIED.
- Zenodo 15995036 (AI4Mars), 4291940 (DoMars16k) and 8171052 (BoulderNet): all "cc-by-4.0", access_right "open". Meets (open content licence). https://zenodo.org/api/records/15995036 , https://zenodo.org/api/records/4291940 , https://zenodo.org/api/records/8171052

6. REFUTED in part, otherwise UNVERIFIED.
- ammos.nasa.gov/marswatermaps/?mission=MWR: 404 confirmed.
- The SWIM2Products page states no resolution for its GeoTIFFs. It describes a 2018 pilot study, with items last updated 2021-02-24. It lists no Oct 2023 set and gives no pointer to one.
- The swim.psi.edu home page shows only a 2023 PSI press release, and its data links point to the ammos viewer. The Oct 2023 set and a live public location are UNVERIFIED.

7. PARTIALLY CONFIRMED.
- The web form at https://www-mars.lmd.jussieu.fr/mcd_python/ showed no login or registration in the page I read.
- Registration is required only for the "full version" download, so the web form is usable unregistered. Heavy use is discouraged.
- Version mismatch: the access page says 6.2 but the form page title says "v6.1". I found no newer public HTTP API.

Source quality: all primary pages (NASA, LMD, ESA, Zenodo, Murray Lab, HiRISE). The NASA media page also contains a section on "Super Intelligence (SI) applications" restricting NASA attribution and logos in AI outputs. That is page text only and I did not check it against another source.
