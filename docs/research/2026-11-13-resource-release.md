# Martian Map resource release — 13 November 2026

Checked at approximately 17:00 UTC. The official resource tab is now populated. Its page metadata reports publication at **03:46:20 UTC on 13 November**. The extracted challenge-details text is identical to the repository's saved pre-release version. The change is the resource list; the objectives have not changed in that comparison.

The release supports keeping the existing Gale prototype. The most useful next addition would be a scientifically motivated destination with source evidence and surface photographs. This is an investigation and recommendation, not an implementation plan or a completed feature.

## What was released

The [official Resources tab](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources) currently lists exactly five links:

| Resource | What it supplies | Relevance to this project |
| --- | --- | --- |
| [JPL Mars Trek](https://trek.nasa.gov/mars/) | Mars exploration portal and layered orbital data | Confirms the existing globe/source-service direction. Our MOLA display already uses Trek WMTS. This link does not provide a new prepared local numeric terrain package. |
| [USGS-NASA planetary geologic maps](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | A searchable gallery of published geological maps | Useful for geological context and science objectives. Follow individual map metadata to establish scale, coverage, references and usable GIS products. |
| [Curiosity's Proposed Path up Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | A dated route animation and annotated scientific regions | The most direct design reference: connect a proposed route to named regions and their scientific interest. Published **15 May 2019**, rather than a new 2026 route dataset. |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | Earth satellite imagery exploration | Interface inspiration for layer controls, dates, comparison and source discovery. Its Earth observations are not Mars weather or terrain inputs. |
| [Perseverance raw images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Ground-camera image browsing | Supports the brief's suggestion to show what an explorer will see. Perseverance imagery belongs to Jezero; a Gale experience needs corresponding Curiosity observations. |

There is no downloadable challenge-specific dataset bundle, required API, specified EVA model, or new mandatory technology in this resource-tab snapshot. The main brief continues to suggest three or more data types; HUDs, particular locations and historical scenarios remain options. This comparison does not establish the event's separate eligibility, submission or judging rules.

## Findings behind the links

**USGS is a catalog, not one ready-to-use Gale layer.** I followed the page into its public ArcGIS application and queried the gallery's backing catalog. The current interactive list contains 22 records, including the 2014 global map (SIM 3292) and the 2020 Jezero/Nili Planum map (SIM 3464). A separate title query for “Gale” returned zero records. That only describes this gallery query; it does not establish that no Gale geological mapping exists elsewhere. These catalog footprints are map discovery records, not the geological-unit polygons themselves.

Concrete catalog starting points are the [global map's interactive resource](https://doi.org/10.5066/P9PBKSGE) and the [Jezero/Nili Planum resource](https://doi.org/10.5066/P9CZYIO7). The catalog describes the latter as a 1:75,000 map; neither its scale nor location makes it a substitute for the prepared Bradbury terrain patch. Product downloads and local registration were not tested in this investigation.

**The route example explains the intended integration well.** NASA identifies HiRISE, CRISM and CTX from MRO, plus HRSC from Mars Express, as inputs to the [2019 Mount Sharp visual](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/). It associates the traverse with scientific regions. This is useful precedent for explaining why the astronaut is walking somewhere. It does not supply astronaut mobility costs or prove safe passage through the current Bradbury patch.

**Surface images need location and date context.** The official gallery link is Perseverance-specific. Substituting those images into Gale would misrepresent the location. The release does not require switching the demonstration to Jezero.

## Comparison with the current prototype

I inspected `README.md`, `public/gale/manifest.json`, and `src/App.tsx` in the working tree.

The prototype already combines local orbital imagery/topography with historical Curiosity REMS and RAD observations, compares routes, and provides a walking HUD. At the mission level, MRO supplies orbital source material and MSL supplies the rover observations; the global MOLA layer adds MGS context. Elevation and slope are derived from the same topographic source and should not be counted as independent instrument data types.

The visible science gap is concrete: the initial destination is an arbitrary local offset, **600 m east and 450 m north**, and the planner exposes a generic destination. There is no named science target, observation task, target-specific evidence panel, or associated ground photograph in this flow. Navigation waypoints guide movement; they are not scientific stops.

My recommendation is to retain Gale and give one excursion a defensible scientific question, such as investigating evidence for ancient water transport near Bradbury Landing. NASA's [Curiosity's Roadside Discoveries](https://science.nasa.gov/photojournal/curiositys-roadside-discoveries/) documents Goulburn, Link and Hottah and explains their pebbly-outcrop evidence. Its [early traverse map](https://science.nasa.gov/resource/curiosity-rovers-traverse-august-through-november-2012-2/) documents Rocknest, Glenelg and Yellowknife Bay as other nearby science context.

Those are candidates, not verified map coordinates in our application. Before selecting a target, establish its coordinates from a suitable mission localization source, check that it falls inside the existing 2 × 2 km patch, verify a route, and attach the corresponding observation/date/credit. Do not place a precise marker by eye from a presentation image. Mount Sharp boxwork is a different location from the current Bradbury patch.

For that excursion, the useful product change would be a target card explaining the scientific question, actual evidence, proposed observation and expected surface view, with a declared time allowance for science. Route comparison could then show the time available for the task and return. Our existing Sol 10 environmental measurements must retain their dates: the later outcrop discoveries and photographs cannot be presented as simultaneous Sol 10 observations. A hypothetical excursion using explicitly dated historical evidence is consistent with the brief.

## Verification and saved evidence

All five linked resource roots returned HTTP 200. Their interactive applications were not comprehensively exercised; root access does not establish downstream tile, image, download or GIS usability. NASA's route page and the USGS gallery configuration/catalog were inspected beyond their roots.

Evidence is saved under repository-local `tmp/resources-2026-11-13/`: the official response, extracted resources/details, previous-details comparison, access checks, ArcGIS configuration/query responses and `release-summary.json` with hashes. The official site was unreadable through the web extractor; direct retrieval recovered its embedded Next.js content. Local certificate-chain verification failed, so direct public-page requests used a certificate-verification bypass, recorded in the evidence. No application behavior was changed or retested.
