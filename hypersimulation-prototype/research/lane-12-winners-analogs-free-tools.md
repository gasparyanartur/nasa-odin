# Lane 12-winners-analogs-free-tools (raw worker report, 2026-11-03, not yet checked)

Core finding: the 2026 Global Collaborators are confirmed (GoDaddy, Google, Meteomatics, Microsoft, Miro), but no 2026 offer terms are published yet. No past Space Apps winner I found was a Mars surface map. The closest are Moon/Mars 3D-globe and habitat projects. Trek (WMTS tiles) and GIBS are the biggest free reusable map assets.

PART A - Past winners and judging (2022 and 2024 winner pages opened; 2025 page opened)
| Name | What it is | Direct URL | Why it matters | Confirmed? |
|---|---|---|---|---|
| Selene (2022 Galactic Impact, Moonquake Map) | ThreeJS/Blender 3D Moon globe, height map, Apollo markers, first-person view; ReactJS+Node+MongoDB; NASA CGI Moon Kit + LOLA data | https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/selene-5/project | Closest map-style winner; shows 3D globe + topography toggle + persona view + demo video + open code | Yes |
| MARS 3D HOME (2022 Best Mission Concept) | Mars habitat furniture, tools, rover wheel; NASA CHAPEA + NASA 3D models | https://2022.spaceappschallenge.org/challenges/2022-challenges/mars-habitat/teams/mars-3d-home/project | Mars winner built on NASA 3D resources, plausible concept and design | Yes |
| 2022 winners list (10) | Official list incl. Brute Force (Local Impact, Moonquake Map) | https://www.earthdata.nasa.gov/news/nasa-announces-winners-2022-global-space-apps-challenge | Index to all 2022 project pages | Yes |
| 2024 winners (10) | Incl. WMPGang SkyShield (orrery web app), Team I.O. G.R.O.W. (Community Mapping, GIS made simple), TerraTales (storytelling web app) | https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/ | Shows web-app + accessible-GIS entries win; 9,996 submissions | Yes |
| 2025 winners (10) | Incl. PureFlow (Best Mission Concept, habitat resilience vs solar threats), SpaceGenes+ (data viz), Twisters (data pipeline to simple answer) | https://www.spaceappschallenge.org/2025/meet-the-2025-global-winners/ | Latest year; 18,860 teams; no Mars map winner listed | Yes |
| Judging guide 2022 (PDF) | Judging and Awards Guide with criteria section | https://spapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Judging_and_Awards_Guide.pdf (PDF, NOT opened; URL as returned by search: https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Judging_and_Awards_Guide.pdf) | Orchestrator should download and Read it for exact wording | UNCONFIRMED |
| Judging criteria by year (search snippets only, pages not opened) | 2020: Impact, Validity, Relevance. 2019 local: Creativity, Presentation. 2024 guide: four core criteria plus Presentation; "Create Your Own Challenge" ineligible for Global Judging. 2014: impact, creativity, product, sustainability, presentation | https://spaceappschallenge.org/resources/judging-awards-guide (now returns Page Not Found) | The exact 5-name set (Impact, Creativity, Validity, Relevance, Presentation) is NOT confirmed as a single official list | UNCONFIRMED |

PART B - How NASA built comparable maps (all opened)
| Name | What it is | Direct URL | Why it matters | Confirmed? |
|---|---|---|---|---|
| Solar System Treks (Mars Trek) | Browser portals for Moon, Mars, etc.: layers, 3D view, distance, elevation profile, sun-angle, VR flyover, 3D print files | https://trek.nasa.gov and https://trek.nasa.gov/mars | Direct template for a walk-planning map. Tools list "Calculate Distance... freehand your own proposed rover traverse", elevation profile CSV export, sun angle over time | Yes (Mars page body did not render in scrape; features read from trek.nasa.gov) |
| Trek WMTS tile API | "Most of the map layers shown from Treks are available through OGC RESTful WMTS" | https://trek.nasa.gov/tiles | Reusable: pull Mars tile layers straight into Leaflet/OpenLayers/Cesium | Yes (body page lists per-body API docs, e.g. https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) |
| Earthdata GIBS | Free WMTS/WMS/GDAL imagery, 1,000+ products, EPSG:4326/3857 | https://www.earthdata.nasa.gov/gibs | Earth only; the pattern for layer catalog + time slider + map-library docs (https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/). Needs the acknowledgement line | Yes |
| Worldview | Layered Earth viewer built on GIBS | https://www.earthdata.nasa.gov/data/tools/worldview | UX pattern: layer toggles + timeline | Link seen on GIBS page; page itself not opened |
| NASA's Eyes | Immersive solar-system apps | https://eyes.nasa.gov/ | Link seen on trek.nasa.gov; not opened | UNCONFIRMED |
| LROC QuickMap, Artemis traverse tools, Mars 2020/MSL planning views | Not verified. Search found only secondary mentions (QuickMap domain unclear; Artemis geospatial team slope/boulder traverse planning in an NTRS PDF) | https://ntrs.nasa.gov/api/citations/20230006633/downloads/Artemis%20Geospatial%20Data%20Team%20Capabilities%20-%20Strives%20(final).pdf (PDF, not opened) | Slope and boulders are the traverse constraints | UNCONFIRMED |

PART C - Free tools and credits
| Name | What it is | Direct URL | Why it matters | Confirmed? |
|---|---|---|---|---|
| 2026 Global Collaborators | GoDaddy, Google, Meteomatics, Microsoft, Miro "provide free tools and resources, called Global Offers" | https://www.spaceappschallenge.org/2026/ | Names confirmed; offer terms not yet published (you said Nov 13) | Yes (names); offers UNCONFIRMED |
| Collaborator rules | Global Collaborators must offer a resource available in 25+ countries | https://www.spaceappschallenge.org/become-a-collaborator/ | Explains why offers are broad cloud/design/weather tools | Yes |
| Azure for Students (Microsoft, past-years offer type) | $100 credit within 12 months, no credit card, full-time university students only; Azure Maps, Static Web Apps, Functions free allowances | https://azure.microsoft.com/en-us/free/students | Free hosting + maps for a 2-day build; need a school email | Yes (general offer, not a 2026 Space Apps offer) |
| Google Cloud free trial | Search snippet: $300 credit, 90 days, payment method required | https://docs.cloud.google.com/free | Page not opened. A 2025 "$300 Space Apps credit" claim comes only from a third-party blog | UNCONFIRMED |
| Cesium ion Community | Free 10 GB storage, 15 GB/month streaming; personal, non-commercial and unfunded educational use. Hosts 3D tiles/terrain | https://cesium.com/platform/cesium-ion/pricing/ | Free 3D globe/terrain hosting; no Mars asset verified. Funded research needs paid plan | Yes |
| Miro Education plan | Search snippets: free for students/educators, application required | https://help.miro.com/hc/articles/360017730473 | Whiteboard for planning; terms vary in sources | UNCONFIRMED |
| Google Colab free GPU | Search snippet: T4 ~15 GB, session limits | not opened | Free GPU if needed | UNCONFIRMED |
| Meteomatics | Weather data partner in 2023 (past years only) | https://journalofcyberpolicy.com/?p=153382 (search result, not opened) | Mars weather not applicable; low relevance | UNCONFIRMED |

Winning patterns:
- 2022 Selene: interactive 3D globe with a "feel what astronauts saw" first-person view, a 3D toggle, real NASA datasets cited, a demo video, public code.
- 2025 Twisters and 2024 Team I.O.: complex data turned into a simple answer for ordinary users, with a clear question the app answers.
- Winners cite specific NASA datasets and tools by name (LOLA, CHAPEA, NASA 3D Resources) rather than generic imagery.
- Award categories reward more than code: storytelling, art and technology, mission concept, inspirational each have a global prize.
- Presentation counts: the 2024 guide said to give it equal attention (via search snippet only).

Gaps:
- Judging criteria: no official current list opened; the guide URL now returns Page Not Found. Download the 2022 PDF above.
- 2026 challenge statement and data list not found (NASA article says they were scheduled for Oct 28); the Martian Map challenge is described only in secondary outlets (e.g. https://zilesinopti.ro/?p=892787, not opened). Fetch it from spaceappschallenge.org/2026/challenges once reachable.
- Global Offers page for any year not found. Google/Miro/Colab/Meteomatics terms unverified.
- Mars-specific terrain or tile hosting beyond Trek WMTS not found; Trek tile terms/licence not read.
- LROC QuickMap, Mars 2020/MSL views, Worldview details, Eyes on the Solar System: not opened.
- No Mars-map global winner found in 2022-2025; I did not browse 2023 winners or finalists/nominees pages.
- Prompt-injection check: none seen in fetched pages.
