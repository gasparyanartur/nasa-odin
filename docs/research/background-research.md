**Martian Map — background research**

Update, 13 November 2026: the official resources have been released. See the [resource-release investigation](2026-11-13-resource-release.md) for the five links, verified changes and implications for the current Gale prototype. The note below preserves the earlier research snapshot.

Researched on 31 October 2026. This note separates the official challenge, available scientific data, documented precedents, and suggested project directions. Suggestions are research conclusions, not additional NASA requirements. This is background preparation; no application has been implemented.

**What the challenge asks**

Create a local Mars exploration map integrating multiple NASA missions to support an astronaut's science excursion. The brief suggests three or more data types. Static maps, interactive interfaces, historical scenarios, future predictions and time-independent geology views are allowed. The resource tab announces release on 13 November; project work starts at the hackathon. [Official challenge](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/).

My suggested framing: choose a scientific question and a manageable area, then make the evidence behind each exploration decision inspectable.

The strongest distinguishing question is: **what decision does combining the data enable for this specific Marswalk?** An attractive collection of layers alone does not demonstrate that benefit.

**Physical and operational background**

Mars has about 38% of Earth's gravity, a predominantly carbon-dioxide atmosphere, surface pressure far below Earth's, and a solar day about 24 hours 40 minutes long. A mapping interface needs Mars-aware distance calculations and local-time handling; an excursion needs explicit life-support and return assumptions. These planetary facts do not establish a validated astronaut walking-speed or oxygen-consumption model. [NASA Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html).

Human field science also involves choosing targets, changing priorities, collecting samples, and coordinating with support teams under delayed communications. BASALT field trials studied these workflows using simulated Mars operations on terrestrial volcanic terrain. This is a particularly useful operational reference because it evaluates more than navigation alone. [BASALT operations concepts](https://ntrs.nasa.gov/citations/20170000363), [science communication under latency](https://pmc.ncbi.nlm.nih.gov/articles/PMC6442240/).

**The data landscape**

There is no single uniform, current, high-resolution Mars dataset. The inputs are a mixture of orbital rasters, local stereo terrain models, rover measurements, interpreted geological polygons, and model output. Their spatial coverage and acquisition dates differ.

CTX, HiRISE and CRISM are three instruments on the same mission, Mars Reconnaissance Orbiter. For integration across NASA missions, consider also Mars Global Surveyor/MOLA, Mars Odyssey/THEMIS, or Mars 2020/MEDA. The table identifies the mission for each input so that instrument diversity is not mistaken for mission diversity.

| Information | Mission / product | Scale and coverage | Use in a Marswalk tool | Key limitation |
|---|---|---|---|---|
| Regional optical context | MRO Context Camera (CTX), Murray Lab global mosaic | About 5 m/pixel; almost global | Basemap, landforms, regional orientation | A mosaic of observations from different times; insufficient for many individual obstacles |
| Detailed optical imagery | MRO HiRISE map-projected images and orthoimages | Commonly 0.25–0.5 m/pixel; selected footprints | Identify boulders, scarps, dunes, outcrops and landmarks | Coverage and alignment vary; a pixel is not an independently resolved object |
| Global elevation | MGS MOLA gridded DEM | Common global grid about 463 m/pixel | Regional relief and elevation context | Far too coarse to establish foot-scale traversability |
| Intermediate elevation | Mars Express HRSC and MOLA blend | 200 m output grid; underlying source quality varies | Regional terrain presentation | Output grid spacing does not imply new 200 m measurements everywhere |
| Local elevation | HiRISE stereo DTMs, curated Jezero mosaics | Typically 1–2 m post spacing for HiRISE DTMs | Slope, relief, terrain profiles and local route costs | Not every stereo pair has a DTM; artifacts and unresolved hazards remain |
| Thermal characteristics | Mars Odyssey THEMIS IR; thermal inertia products | IR nominally about 100 m/pixel | Compare thermal behavior and surface materials | Brightness images and thermal inertia are different products; acquisition time matters |
| Mineralogical evidence | MRO CRISM targeted map-projected products, especially MTRDR | Targeted observations, commonly tens of meters per pixel | Select science stops near mineralogical units | Spectral signatures require interpretation; coverage is incomplete |
| Geological context | USGS published geological maps and GIS databases | Product-specific cartographic scales | Contacts, geological units, scientific rationale | Geological interpretation, not a direct instrument measurement at every point |
| Local weather | Perseverance MEDA; Curiosity REMS | Rover-local measurements over time | Historical conditions, environmental context | Not a planet-wide weather grid; check sensor flags and data release dates |
| Regional atmospheric scenarios | NASA Ames reference Mars climate simulations | Model grids varying by run | Seasonal and local-time context away from rover stations | Simulated climate, not measured current weather or a validated street-scale forecast |
| Ionizing radiation | Curiosity RAD reduced data records | Surface time series along Curiosity's mission | Historical event context, radiation-related scenarios | Not a measured spatial radiation map for Jezero or arbitrary routes |
| Ground-level observations | Navcam, Hazcam, Mastcam/Mastcam-Z; rover localization products | Along rover traverses and selected targets | Preview destinations and connect orbital features to surface views | Perspective, pose and location must be reconciled before map overlay |
| Chemistry and subsurface science | Curiosity ChemCam/APXS/CheMin; Perseverance SuperCam/PIXL/SHERLOC/RIMFAX | Individual observations, targets or along-track measurements | Explain why a stop is scientifically useful | Sparse measurements cannot be treated as continuous chemistry or subsurface layers |
| Potential water resources | SWIM derived ice-consistency products; associated radar/thermal/geomorphic evidence | Regional resource assessment | Resource-focused exploration scenarios | Evidence for potential subsurface ice is not guaranteed accessible water at a waypoint |

Sources and useful access routes for that table:

- **CTX:** [Caltech's mosaic announcement and access links](https://www.caltech.edu/about/news/scientists-unveil-a-57-terapixel-global-image-of-mars). The published mosaic covers 99.5% of the surface between 88°S and 88°N and combines 110,000 images. Use the individual product metadata when precise registration matters.
- **HiRISE:** [DTM explanation and known artifacts](https://www.uahirise.org/dtm/about.php), [DTM footprint map](https://www.uahirise.org/hiwish/maps/dtms.jsp), [using DTM files](https://www.uahirise.org/dtm/howto.php). DTMs use PDS raster formats; GDAL conversion to GeoTIFF is documented.
- **MOLA / HRSC:** [USGS foundational Mars data inventory](https://fdp.astrogeology.usgs.gov/fdp/mars/), [200 m HRSC/MOLA blended product metadata](https://astrogeology.usgs.gov/search/map/Mars/Topography/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendShade_Global_200mp_v2.lbl.xml).
- **Jezero prepared products:** [USGS landing-site product collection](https://astrogeology.usgs.gov/search/map/mars-2020-jezero-crater-landing-site-products). Includes CTX/HiRISE terrain and orthorectified mosaics. These are especially promising because alignment and mission-specific preparation have already been performed. Download and inspect the selected product's footprint and metadata before fixing the demo area.
- **THEMIS:** [instrument resolution](https://themis-data.asu.edu/faq/what-resolution-themis-camera), [ASU global data products](https://www.mars.asu.edu/data/), [thermal-inertia processing explanation](https://marstherm.psi.edu/themis_documentation.php). Thermal inertia can inform material interpretation, but it does not directly measure how much a boot will sink.
- **CRISM:** [PDS MTRDR bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amro_crism_mtrdr&version=1.0), [derived-product definitions](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Mars%20Reconnaissance%20Orbiter%20%28MRO%29/CRISM/Derived.htm), [JCAT tutorial](https://pds-geosciences.wustl.edu/missions/mro/jcat/jcat_1.1/JCAT_Tutorial.pdf). MTRDR includes corrected spectral cubes, summary parameters and browse products. Browse colors are not quantitative mineral concentrations.
- **Geology:** [USGS Planetary Geologic Mapping](https://www.usgs.gov/special-topics/planetary-geologic-mapping/), [Jezero / Nili Planum map and explanation](https://pubs.usgs.gov/sim/3464/sim3464_pamphlet.pdf), [2014 global geologic map](https://www.usgs.gov/maps/geologic-map-mars).
- **Weather:** [MEDA data and documentation](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html), [REMS data and documentation](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html). MEDA science tables are CSV except SkyCam images; its derived products are a sensible first stop. MEDA's Radiation and Dust Sensor measures optical/UV radiation and dust; do not confuse it with Curiosity RAD's ionizing-radiation measurements.
- **Climate:** [NASA Ames reference outputs](https://data.nas.nasa.gov/mcmcref/), [AmesGCM source and documentation](https://github.com/nasa/AmesGCM). An alternative is the [Mars Climate Database](https://www-mars.lmd.jussieu.fr/mars/access.html): its web interface is intended for moderate use, its output is interpolated model climatology, and its published terms require specific authorization for commercial use.
- **Radiation:** [RAD archive collection](https://pds-ppi.igpp.ucla.edu/collection/MSL-M-RAD-3-RDR-V1.0%3ADATA), [RAD reduced-data specification](https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DOCUMENT/RAD_RDR_SIS.HTM), [2024 solar-storm example](https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/). Keep absorbed dose and dose equivalent distinct when interpreting products.
- **Rover observations and localization:** [Perseverance PDS mission index](https://pds-geosciences.wustl.edu/missions/mars2020/), [Curiosity PDS mission index](https://pds-geosciences.wustl.edu/missions/msl/), [Analyst's Notebook](https://an.rsl.wustl.edu/). PLACES products and observation geometry are useful starting points for connecting measurements to maps. Science archives have scheduled releases; availability should not be described as real-time telemetry.
- **Ice:** [SWIM project and downloadable products](https://swim.psi.edu/), [NASA explanation of its relevance to human landing sites](https://www.nasa.gov/centers-and-facilities/jpl/where-should-future-astronauts-land-on-mars-follow-the-water/).
- **Names:** [USGS Mars gazetteer and GIS downloads](https://planetarynames.wr.usgs.gov/Page/MARS/target). Mission nicknames for rocks and informal places are not all IAU-approved names.
- **Sun / viewing geometry:** [NAIF SPICE overview](https://naif.jpl.nasa.gov/naif/index), [SPICE tutorials](https://naif.jpl.nasa.gov/naif/tutorials.html). Surface shadows additionally require terrain geometry; a Sun vector alone does not establish local shade.

**Practical data access, checked directly**

Use the [Mars Trek WMTS catalog](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) for display layers and [Mars Orbital Data Explorer](https://ode.rsl.wustl.edu/mars/) for scientific-product discovery. [ODE's REST documentation](https://oderest.rsl.wustl.edu/) describes geographic searches, JSON/XML metadata, footprints, observation times, resolution, labels and product-file links.

On 31 October I verified:

| Check | Result | What this establishes |
|---|---|---|
| CTX WMTS capabilities | HTTP 200, XML, CORS `*` | The service publishes accessible tile metadata |
| CTX root tile | HTTP 200, PNG, CORS `*` | At least one tile can be retrieved without authentication |
| MOLA color-shade WMTS capabilities | HTTP 200, XML, CORS `*` | Accessible metadata for a global context display layer |
| ODE HiRISE RDRV11 search | Success; 135 matching products | Archive records exist in the chosen Jezero search box |
| ODE CRISM MTRDR search | Success; 7 matching products | Mineralogical products exist in that search box |

The ODE box was 77.3–77.6°E, 18.3–18.6°N. Counts are product matches under the query's defaults, not unique image counts, independent acquisitions, full-box coverage, DTM availability, or usable route coverage. A footprint audit is still needed. I did not download full scientific rasters or test a complete map application. The saved responses are in the workspace's `tmp/` directory.

Capabilities URLs:

```text
https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/WMTSCapabilities.xml
https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml
```

Read each capabilities document rather than guessing tile paths: the CTX metadata currently points to an ArcGIS service, while the MOLA metadata points to Trek tiles. Both declare `EPSG:104905`. A shaded-relief JPEG is a visualization, not a numeric elevation grid from which to calculate slope.

**Existing solutions and what to learn from them**

| System | Documented capabilities | Relevance and limits |
|---|---|---|
| [NASA Mars Trek](https://trek.nasa.gov/mars/jpl/config/textAbout.html) | Multi-mission layer browsing, metadata, 3D views, distance/elevation/slope/lighting analysis | Essential baseline. A new layered viewer should explain the astronaut decision it adds |
| [JMARS](https://jmars.asu.edu/JMARS%20Layer) | Scientific desktop GIS, image footprints, numeric maps, profiles, custom maps and 3D | Useful for checking datasets and scientific relationships before building a custom interface |
| [PDS Analyst's Notebook](https://an.rsl.wustl.edu/) | Integrates landed-mission sequence information, engineering/science observations and documentation | Strong reference for observation context and target dossiers |
| [Minerva / BASALT](https://ntrs.nasa.gov/citations/20170002363) | Traverse optimization, timelines, procedures, monitoring, data archiving, visualization and search in simulated human Mars science campaigns | Closest operational precedent found; the field setting was Earth, not Mars |
| [SEXTANT](https://dspace.mit.edu/entities/publication/2a7eeac5-5ecd-427e-848f-6e1077196850) and [PEXTANT](https://pextant.readthedocs.io/en/latest/) | Astronaut/rover traverse planning by distance, time or energy, with terrain; SEXTANT also studies lighting/thermal effects | Resource-aware EVA routing has substantial precedent. Legacy code/documentation needs an installability audit before reuse |
| [OnSight](https://www.jpl.nasa.gov/news/mars-virtual-reality-software-wins-nasa-award/) | Curiosity-data-based immersive 3D terrain and collaborative science discussion | Strong precedent for previewing a site as a field geologist; historical system, not a verified current public service |
| [Where is Perseverance?](https://science.nasa.gov/mission/mars-2020-perseverance/location-map/) | Rover traverse, stops and orbital basemaps | Useful location/waypoint interface reference; vehicle history is not an astronaut safety map |
| [Perseverance ENav / mobility](https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-2020-rover/m2020mobility/) | Onboard terrain assessment and autonomous driving | Geometry-based traversability and rover-specific constraints are established; human walking needs different assumptions |
| [JPL AI-planned drives](https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-first-ai-planned-drive-on-mars/) | December 2025 demonstrations used vision-language models with orbital images and terrain slopes to generate waypoints, followed by engineering validation | An AI that proposes Mars routes is not by itself novel; this was a rover demonstration, not astronaut certification |
| [Mars Global Localization](https://science.nasa.gov/photojournal/mars-global-localization-pinpoints-perseverances-location/) | In February 2026, Perseverance matched ground-camera terrain to orbital imagery onboard | Important precedent if considering visual localization. A displayed moving marker still needs a localization source |

Relevant hackathon and community projects:

- [Space Apps Challenge Lab](https://github.com/Hadisovic/space-apps-challenge-lab) includes a Martian Map concept with habitat placement, science stops, A* routing, route modes, elevation profiles and EVA estimates. Its README explicitly identifies Mars terrain as a deterministic demo model and resources as proxies. It is a useful interface comparator, not evidence that the same workflow works on real Mars terrain. Its claims have been reviewed at README level; I have not run or audited its code.
- [MARSasAPP / G-FLAME, Space Apps 2020](https://2020.spaceappschallenge.org/challenges/connect/can-you-hear-me-now/teams/g-flame/) proposed astronaut communications, activity flags on a Mars Trek-linked map, and locally available information. The submission page establishes the concept; it does not establish deployment or validated operational performance.
- [MarsPathfinder](https://github.com/gowrijsuria/MarsPathfinder) is a separate educational algorithm visualizer with A*, Dijkstra, terrain costs and multiple destinations. Its generated obstacles make it useful for algorithm explanation, not a source of real Martian hazards.

I did not establish an exhaustive inventory of past Space Apps projects or a completed prior submission to this exact 2026 challenge. Search also surfaced a `mars-traverse` mirror, but its purported original GitHub repository returned 404; it is excluded as a verified reusable solution.

**Optional machine-learning material**

[AI4Mars](https://data.nasa.gov/dataset/ai4mars-a-dataset-for-terrain-aware-autonomous-driving-on-mars) provides rover-view terrain labels; the [CVPR workshop paper](https://openaccess.thecvf.com/content/CVPR2021W/AI4Space/papers/Swan_AI4MARS_A_Dataset_for_Terrain-Aware_Autonomous_Driving_on_Mars_CVPRW_2021_paper.pdf) describes soil, bedrock, sand and big-rock classes. This could support annotated ground-view previews or a perception experiment. Rover-view labels do not transfer automatically to orbital imagery, and material class alone does not establish astronaut safety.

[MARTIAN](https://github.com/nasa-jpl/martian) is a JPL Blender framework using HiRISE DTMs and orthoimages to render aerial views under controlled camera and lighting settings. It is relevant to synthetic imagery and visual localization. Rendered surfaces do not add measurements of unresolved boulders or surface strength.

[Machine Learning Based Path Planning for Improved Rover Navigation](https://ntrs.nasa.gov/citations/20220003784) discusses using learned terrain costs to reduce expensive rover clearance evaluations. [MLNav](https://arxiv.org/abs/2203.04563) extends that direction. These are methodological references; their evaluation setting and rover constraints differ from a human EVA.

**Candidate demonstration locations**

| Location | Scientific story | Available starting points | Tradeoff |
|---|---|---|---|
| Jezero crater, a small part of the delta/floor or rover-explored area | Ancient environments, sedimentary relationships and scientifically motivated sampling | Prepared USGS terrain/ortho mosaics, geological mapping, Perseverance images and traverse, MEDA, CRISM | Strong starting candidate; no co-located Curiosity RAD measurement and no uniform guarantee of local data coverage |
| Gale crater / Mount Sharp, particularly a verified boxwork area | Groundwater alteration and resistant mineral ridges | Curiosity observations, chemistry, REMS, RAD and orbital data | Rich multi-mission story; verify that the exact boxwork location overlaps suitable terrain and spectral products |
| Arcadia Planitia or Deuteronilus Mensae | Potential subsurface ice and future resource assessment | SWIM and orbital evidence | Interesting resource mission; less rover-level ground context and potentially more inference |

Sources: [Jezero mission map](https://science.nasa.gov/mission/mars-2020-perseverance/location-map/), [Curiosity's boxwork investigation](https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-mars-rover-starts-unpacking-boxwork-formations/), [NASA's SWIM explanation](https://www.nasa.gov/centers-and-facilities/jpl/where-should-future-astronauts-land-on-mars-follow-the-water/).

My first choice for a technical proof of concept would be a small Jezero area with a confirmed shared footprint between a prepared terrain mosaic, detailed optical imagery, and geological/spectral evidence. Gale is attractive if the scientific story centers on boxwork and co-located Curiosity environmental measurements. These are exploration areas for a hypothetical surface mission, not recommendations for approved human landing sites.

**Important technical and scientific boundaries**

1. **Registration comes before routing.** Check projection, planetocentric versus planetographic latitude, east versus west longitude, 0–360 versus ±180 longitude, reference radius and vertical datum. The [USGS Mars coordinate explanation](https://planetarynames.wr.usgs.gov/Page/MARS/system) documents the two historical coordinate conventions. Use a suitable local metric projection and Mars dimensions for distance and slope calculations.
2. **The scientific raster and the display tile serve different jobs.** Quantitative slope needs numeric heights and the correct horizontal units. Deriving slope from an RGB hillshade or color elevation legend is not sound.
3. **Grid spacing is not effective resolution or accuracy.** A 1 m DTM can have interpolation, stereo artifacts and gaps. Computing a slope on it does not certify every meter as traversable. [HiRISE DTM guide](https://www.uahirise.org/dtm/about.php), [Jezero DTM quality study](https://pubs.usgs.gov/publication/70212659).
4. **A common grid does not create missing detail.** Resampling coarse thermal or climate data onto fine imagery changes display sampling, not observation resolution. Preserve each layer's original scale and footprint.
5. **Different dates should remain visible.** Separate static geology, dated terrain images, historical sensor measurements and modeled conditions. A historical scenario is often easier to substantiate than a claim about current conditions.
6. **Unknown coverage should affect confidence.** A reasonable prototype can identify unobserved terrain, block it, or penalize it explicitly. Treating missing data as zero hazard hides the core uncertainty.
7. **Terrain shade is not automatically ionizing-radiation shelter.** Shielding needs material thickness and radiation transport assumptions. Curiosity has measured terrain-related radiation changes, but that does not license a universal shade-to-dose conversion. [NASA discussion](https://www.nasa.gov/centers-and-facilities/jpl/how-nasas-curiosity-rover-is-making-mars-safer-for-astronauts/).
8. **EVA resources need declared assumptions.** A time, oxygen or battery estimate should identify the suit/vehicle scenario, activity durations, speed/cost model, and reserve policy. Avoid presenting guessed constants as NASA-certified limits.
9. **Rover history is evidence about a vehicle.** A rover path can provide a comparator and known observations. It is not ground truth for a suited person's preferred or safe route.
10. **Separate route planning from localization.** A route can be computed with no onboard navigation sensor. Knowing where the astronaut actually is requires a separate localization design and uncertainty estimate.

**Promising project directions — suggestions**

- A locally detailed science-EVA planner: pick science targets, compare route alternatives, inspect slope/uncertainty, include science-stop durations, and show a feasible return under explicit assumptions.
- An evidence inspector: selecting a waypoint opens the orbital image, terrain profile, geological interpretation, relevant rover photographs, observation dates and source products that explain the decision.
- A scenario explorer: demonstrate how a changed time budget, blocked passage, uncertain terrain area or historical environmental event changes the plan. Keep observed conditions separate from simulated constraints.

These directions have precedent. A defensible project contribution would be a well-executed, accessible integration for a specific local mission, with transparent data support and clear uncertainty. There is no basis here for claiming the first Mars route planner or first astronaut EVA planner.

**Prioritized reading**

Read these first:

1. [Official challenge](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) — scope and optional features; revisit the resource tab on 13 November.
2. [Minerva: User-Centered Science Operations Software Capability for Future Human Exploration, 2017](https://ntrs.nasa.gov/citations/20170002363) — the closest integrated operational predecessor found.
3. [Future Needs for Science-Driven Geospatial and Temporal EVA Planning and Execution, 2019](https://journals.sagepub.com/doi/10.1089/ast.2018.1838) — findings from BASALT; [NASA-hosted manuscript](https://humansystems.arc.nasa.gov/publications/BASALT_Marquez_etal_2019_web.pdf).
4. [SEXTANT thesis, 2010](https://dspace.mit.edu/entities/publication/2a7eeac5-5ecd-427e-848f-6e1077196850) — terrain, activity points, time/energy objectives and illumination.
5. [Map a Mars Rover Driving Route](https://www.jpl.nasa.gov/edu/resources/project/map-a-mars-rover-driving-route/) — approachable introduction to relating science objectives and terrain in Mars Trek.
6. [HiRISE DTMs: explanation and artifacts](https://www.uahirise.org/dtm/about.php) — required background before trusting a high-resolution surface model.

Then follow the selected scientific direction:

7. [Jezero landing-site products](https://astrogeology.usgs.gov/search/map/mars-2020-jezero-crater-landing-site-products) and [Jezero geology pamphlet](https://pubs.usgs.gov/sim/3464/sim3464_pamphlet.pdf).
8. [Curiosity's boxwork investigation](https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-mars-rover-starts-unpacking-boxwork-formations/) — an accessible explanation of the scientific example in the challenge.
9. [CRISM derived products](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Mars%20Reconnaissance%20Orbiter%20%28MRO%29/CRISM/Derived.htm) and [JCAT tutorial](https://pds-geosciences.wustl.edu/missions/mro/jcat/jcat_1.1/JCAT_Tutorial.pdf) — what spectral data can support.
10. [MEDA guide](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html) or [REMS guide](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html) — variables, file types and quality information.
11. [How Curiosity is making Mars safer for astronauts](https://www.nasa.gov/centers-and-facilities/jpl/how-nasas-curiosity-rover-is-making-mars-safer-for-astronauts/) — readable radiation context.
12. [Mars coordinate systems](https://planetarynames.wr.usgs.gov/Page/MARS/system) and [USGS planetary GIS tutorials](https://www.usgs.gov/special-topics/planetary-geologic-mapping/planetary-mapping-and-gis-tutorials) — data integration foundations.
13. [ODE REST documentation](https://oderest.rsl.wustl.edu/) and [Mars Trek WMTS catalog](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) — practical discovery and display access.
14. [AI4Mars paper](https://openaccess.thecvf.com/content/CVPR2021W/AI4Space/papers/Swan_AI4MARS_A_Dataset_for_Terrain-Aware_Autonomous_Driving_on_Mars_CVPRW_2021_paper.pdf), [MARTIAN code](https://github.com/nasa-jpl/martian), and [JPL's AI-planned drive report](https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-first-ai-planned-drive-on-mars/) — optional perception, synthetic-data and AI-planning paths.

**What remains to establish before choosing the build**

The official 2026 resource list has not yet been released. Exact shared data coverage, scientific raster sizes, registration quality, and an appropriate local mission scenario still need inspection. No complete environment, scientific raster processing pipeline, candidate algorithm, or EVA resource model was implemented or validated in this research pass. This note does not assess the event's full submission or judging rules.
