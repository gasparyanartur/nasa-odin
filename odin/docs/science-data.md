# Geological context and science destinations

Version 0.3 bundles `public/science/geology.json`. Normal app startup does not query the geological service or download a GIS archive. These data are separate from the numeric Gale DEM and are not used as hazard or walking-speed fields.

## Published geological interpretation

The source is Tanaka et al. (2014), *Geologic map of Mars*, [USGS SIM 3292](https://doi.org/10.3133/sim3292), source scale 1:20,000,000. The checked [USGS-owned feature service](https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Tanaka_et_al_2014_Mars_Global_Map_Features/FeatureServer) is associated with [USGS ArcGIS item 1c7697dbadaf49058bdf3afc9121aad3](https://www.arcgis.com/home/item.html?id=1c7697dbadaf49058bdf3afc9121aad3), owner `mahunter@usgs.gov_USGS`. The service's unit descriptions, interpretations, colors and contact classifications are retained; these are the publisher's regional interpretation, not new field observations.

The preparation script requests polygons from layer 3 and contacts from layer 1 in ArcGIS 104971, `GCS_Mars_2000_Sphere`, radius 3,396,190 m. The service transforms its source Robinson projection into spherical latitude and east-positive longitude. On a sphere, geographic and planetocentric latitude agree. The app creates Cesium positions explicitly on the Mars ellipsoid and converts to the local frame using the same origin/radius as its terrain. It never treats the coordinates as an Earth WGS84 raster.

Prepared regional bounds, in west/south/east/north degrees:

| Region | Bounds | Included features |
| --- | --- | --- |
| Gale | 135, −7, 140, −2 | 6 unit features, 8 contact features |
| Jezero | 75, 16, 80, 21 | 7 unit features, 13 contact features |

Service generalization is 0.001 degree (roughly 59 m at the equator); this tolerance does not establish that positional accuracy. Geometry is clipped to the declared bounds, preserving polygon holes and multipart features. Clipping edges are not drawn as geological contacts. Published contact classes are retained; approximate contacts use dashed strokes. The app does not have complete global geological coverage.

The 2 km Gale patch and both science waypoints fall in broad unit `AHi`, the Amazonian and Hesperian impact unit. The global interpretation includes post-impact sedimentary infill, but cannot separate the local Rocknest drift from Yellowknife Bay bedrock or locate their exact contacts. Target selection uses the separate mission evidence below. No geology-based route penalty, inferred bearing strength, new sample composition or artificial local unit boundary is introduced.

## Curated rover visit areas

Coordinates come from the checked [NASA/JPL MSL waypoint feed](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json). The package retains the original longitude/latitude, rover motion counter and sol, then converts/snaps the planning endpoint to the existing 5 m terrain grid. Both endpoints have valid measured terrain and pass the default 20° limit. Their actual route connectivity and directed returns are tested against the prepared terrain.

| Visit-area target | Published waypoint | Coordinate (east longitude, north latitude) | Snapped local endpoint |
| --- | --- | --- | --- |
| Rocknest | Sol 56, RMC 4_3474 | 137.4483509°, −4.59001667° | 395 E, −30 N m |
| Yellowknife Bay entry | Sol 125, RMC 5_1398 | 137.4493306°, −4.58963671° | 450 E, −10 N m |

NASA's [Rocknest view from Sol 52](https://science.nasa.gov/resource/rocknest-from-sol-52-location/) describes the windblown material and arrival four sols later. The [Rocknest workplace description](https://science.nasa.gov/resource/curiositys-rocknest-workplace/) describes the drift beside dark cobbles. This motivates a question about wind sorting and accumulation.

NASA's [Yellowknife Bay entry report](https://www.jpl.nasa.gov/images/pia16553-looking-back-at-entry-into-yellowknife-bay/) identifies entry on Sol 125. The [later geological interpretation](https://astrobiology.nasa.gov/news/dating-on-the-shores-of-a-habitable-martian-lake/) describes a former lake-bed setting. This motivates a question about water and sediment deposition. The chosen waypoint is an entry-area visit location, not a drill site or the measured outline of a bedrock unit.

The waypoint feed gives no positional error bound or latitude convention. The package explicitly reports this limitation and uses the published coordinates in the spherical Mars frame. Coordinate decimal precision and the 5 m snapping grid must not be interpreted as absolute localization accuracy. Both rover visits occurred in 2012, on later sols than the Sol 10 environmental replay; the guide keeps those dates distinct.

## Route explanations

Each returned route now includes one profile point per route vertex and one segment record per edge, using the planner's own numeric cells and `Terrain.edge` calculation. Cumulative distance and seconds sum to the route metrics. Segment grade is directed elevation change divided by horizontal edge length; terrain slope is the conservative maximum local surface gradient. These are intentionally distinct quantities.

Shortest search minimizes 3D length. Gentler search minimizes length × (1 + 4 × (terrain slope / slope limit)² + 8 × uphill grade). Segment cost records retain length, slope penalty and uphill penalty contributions. The UI reports actual differences in distance, time, ascent and maximum local slope, including when the gentler objective produces the same route or a higher maximum slope. A highlighted profile segment uses the exact pair of corresponding route vertices on the map.

The explanations show active constraints and declared exclusions, without claiming a particular detour was caused by a restriction unless a counterfactual search was performed. Environmental evaluation and recommendation remain post-search comparisons of the available terrain candidates. No new optimizer is claimed.

## Reproduction and provenance

Install `requirements.txt` and run `npm run prepare:science`. The data-preparation-only Shapely dependency handles clipping and polygon topology; the app runtime does not require it. The script caches original responses under repository-local `tmp/science-sources/`, validates the USGS item owner and response completeness/CRS, and records source URLs and SHA-256 hashes in the package. It fails on unavailable sources rather than generating replacements. Delete the corresponding ignored cache file to refresh an individual source.

The app's inspector separates source observations, geological interpretations, derived terrain/slope and editable scenario assumptions. It reports quantity, units, source/product, observation/model time, coverage, resolution/scale, uncertainty and influence on decisions. The simulated astronaut position and habitat remain demonstration state; no physiological measurements, mission scores, sample management or debrief workflow is added.
