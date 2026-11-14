# Check D: browser access test (main session, 2026-11-03)

Every endpoint below returned HTTP 200 and `Access-Control-Allow-Origin: *` for a request from another origin, so a web page can read it directly. The COG files and path files also return `Accept-Ranges: bytes`.

- `HiRISE_Global` in Trek is served from `astro.arcgis.com` (Esri), not from a NASA host. Its WMTS capabilities point there, so its terms are Esri's to state.
- Rover waypoint files, read in full: M20 708 features, highest sol 2022, height fields `elev_geoid` and `elev_radii`, has `images`. MSL 1,386 features, highest sol 5045, height field `elev_geoid`, no `images`. Neither has a field named `elev`.
- Not tested: pixel values inside the COG files, so whether the MOLA COG holds raw heights is still open.

```
date: 2026-11-03T22:53Z
command: curl -sI -m 15 -H "Origin: https://example.com" <url> (STAC and feeds: GET with -D -, body discarded)
== https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/0/0/0.jpg
HTTP/1.1 200 OK
Accept-Ranges: bytes
Content-Length: 52978
Access-Control-Allow-Origin: *
== https://astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE/MapServer/tile/0/0/0
HTTP/1.1 200 OK
Content-Length: 46671
Access-Control-Allow-Origin: *
== https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Accept-Ranges: bytes
Content-Length: 1929690228
== https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendShade_Global_200mp_v2_cog.tif
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Accept-Ranges: bytes
Content-Length: 500475105
== https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
HTTP/2 200 
content-length: 603126
access-control-allow-origin: *
accept-ranges: bytes
== https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
HTTP/2 200 
content-length: 1723218
access-control-allow-origin: *
accept-ranges: bytes
== https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
HTTP/2 200 
content-length: 663670
access-control-allow-origin: *
accept-ranges: bytes
== https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json
HTTP/2 200 
content-length: 1355867
access-control-allow-origin: *
accept-ranges: bytes
== https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms
HTTP/2 200 
access-control-allow-origin: *
== https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020,ingenuity&feedtype=json&ver=1.2&num=1&page=0&order=sol+desc
HTTP/2 200 
access-control-allow-origin: *
== https://mars.nasa.gov/api/v1/raw_image_items/?order=sol+desc&per_page=1&page=0&condition_1=msl:mission
HTTP/2 200 
access-control-allow-origin: *
== https://ccmc.gsfc.nasa.gov/DONKI-API/get/CME?startDate=2026-10-01&endDate=2026-10-02
HTTP/1.1 200 
Access-Control-Allow-Origin: *
```
