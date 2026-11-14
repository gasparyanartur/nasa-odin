# Lane 10-suit-mobility-hazards (raw worker report, 2026-11-03, not yet checked)

Lane: human walking limits and hazards. Opened pages: 14 scrapes. Rows marked UNCONFIRMED come from search snippets only. No NASA-STD-3001 text, no Mars suited slope limit and no Mars pressurized-rover slope limit were found.

**1. Usable numbers**
| Parameter | Value and unit | Conditions | Source document | Direct URL | Confirmed? |
|---|---|---|---|---|---|
| Max EVA excursion / walkback distance | 10 km (6.2 mi) | Moon; "assumed, based on Apollo program experience"; rover-failure walkback | Vos, Gernhardt, Lee 2007, SAE 2007-01-3133, Lunar Walkback Test | https://saemobilus.sae.org/content/2007-01-3133 | Yes (abstract) |
| Apollo walkback method | Computed pre-mission from average O2, sublimator feedwater, battery use at constant walking velocity; recalculated in flight from actual use. Apollo 17 limit was "conservative" | Moon | Olthoff 2018, ICES-2018-259 (TU Munich V-SUIT) | https://ttu-ir.tdl.org/handle/2346/74208 | Yes (abstract) |
| Apollo walkback walking speed and metabolic rate | 3.3 km/h and 1440 BTU/h (OCR split the number) | Apollo 15 Bellcomm memo | NASA ALSJ 19790073512 | https://www.nasa.gov/wp-content/uploads/static/history/alsj/19790073512_1979073512.pdf | UNCONFIRMED (snippet; PDF not opened) |
| Apollo LRV design slope | 20-23 deg favorable, max 25 deg | Moon; vehicle, not Mars | Jacob et al., LPSC 2026 abstract, NTRS 20250011301 | https://ntrs.nasa.gov/citations/20250011301 | Yes |
| LRV design speed and achieved speed | Design 9-13 km/h; Apollo 16 report up to 14 km/h; as-traversed speed made good below design; no strong correlation with slope or ruggedness | Moon; 2 mpp LROC NAC DTM | Same | same | Yes |
| Aerobic fitness standard for partial-g surface EVA | VO2pk >= 36.5 ml/kg/min | NASA-STD-3001 as quoted; 4 of 5 test subjects failed it | Strock et al. 2024, NTRS 20230014953 | https://ntrs.nasa.gov/citations/20230014953 | Yes (abstract). The standard itself was not opened. |
| Suited EVA workload, 1/6 g | Average 36% VO2pk (xEMU), 31% (MKIII). xEMU 2 km treadmill traverse at 0% grade: 47.2% VO2pk (max 69.1%). MKIII 0.5 km at 30% grade: 35.4% (max 45.5%) | 6 h simulated EVA, ARGOS offload, xEMU n=3, MKIII n=2 | Same | same | Yes |
| Walking metabolic cost, Mars gravity (unsuited) | VO2 1.00 +/- 0.61 L/min at 1G vs 0.68 +/- 0.33 L/min at 0.38G; HR 118.5 to 106.2 bpm | n=12, LBPP treadmill, 8 min, no suit, no slope | Brown et al. 2018, J Exerc Physiol Online 21(1) | https://kclpure.kcl.ac.uk/portal/en/publications/the-metabolic-cost-of-walking-in-simulated-martian-gravity-and-it/ | Yes. Source text shows the kcal values swapped between the two gravity conditions, so use VO2 only. |
| Rock size-frequency model | F_k(D) = k exp[-q(k) D], q(k) = 1.79 + 0.152/k; k = total rock-covered area fraction; curves flatten at 5-40% abundance | Viking, Pathfinder, MER sites | Golombek et al. 2003, LPSC XXXIV, NTRS 20030111177 | https://ntrs.nasa.gov/citations/20030111177 | Yes |
| Slope cap used in a human least-cost path tool | 15 deg limit; boulders avoided; round trips under 2 h at constant walk; 521 shadowed regions | Moon south pole; 5 m LOLA; travel times from Apollo 12 and 14 EVA data | Pena-Asensio et al. 2024, Acta Astronautica 214:324-342 | https://boris.unibe.ch/194784/ | Yes (abstract) |
| Special Regions criteria | Water activity above 0.5 and temperature above 250 K (-23 C); RSL treated as "Uncertain" Regions, handled as Special until proven otherwise; 50 km buffer shown around RSL in SR-SAG2 Fig. 47 | Mars | Rummel et al. 2014 (SR-SAG2) and NAP 2015 review | https://www.usgs.gov/publications/new-analysis-mars-special-regions-findings-second-mepag-special-regions-science | UNCONFIRMED. The USGS page confirms the paper exists but gives no numbers. |
| Opportunity wheel slip | Up to 50% on steep slopes in Endurance Crater; 2.5% max in an Erebus drive; Spirit sank up to 10 cm | Mars rovers | JPL and news pages, WVU Spirit slip analysis | https://www.jpl.nasa.gov/images/pia06835-slippery-slopes/ | UNCONFIRMED (snippets) |

**2. Datasets and models**
| Name | What it gives | Direct URL | Format | Licence | Confirmed? |
|---|---|---|---|---|---|
| HiRISE DTMs | 1,338 stereo terrain models, listed on the page; slope maps from ISIS3 slpmap on a 3x3 window | https://www.uahirise.org/dtm/ | GeoTIFF/IMG via the PDS directory https://hirise-pds.lpl.arizona.edu/ | Terms not read; see https://uahirise.org/media/usage.php | Yes (list). Format and licence not opened. |
| ASU Mars Global Data Sets | Viking IRTM rock abundance (rocks over 15 cm, 1 ppd / 60 km), TES thermal inertia, TES dust cover index, MOLA shaded relief and roughness, THEMIS IR 100 m | https://www.mars.asu.edu/data | Per-layer download pages; JMARS layers | Not stated on page | Yes (listing). Per-layer formats not opened. |
| Mars Trek (NASA JPL) | Web portal for layered Mars data at high resolution | https://trek.nasa.gov/mars/ | Web viewer | Not stated | Page text is only the description. Slope layers and API UNCONFIRMED. |
| PDS MGS TES thermal inertia maps | Source of the rock-abundance proxy (rock = thermal inertia of 1250 or more in SI units) | https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html | PDS3 labels plus images | PDS open data (not read) | UNCONFIRMED (snippet only) |
| Peña-Asensio traverse pipeline and atlas | Python least-cost path: Monte Carlo plus minimum-cost path over cumulative slope; also scores temperature, illumination, bearing capacity and line of sight | https://boris.unibe.ch/194784/ (open access) | Paper; code location UNCONFIRMED | Open access; licence not read | Method yes; code link not found |
| SEXTANT (BASALT/Minerva) | Route optimisation between stations on cost of distance, EVA time or explorer energy | https://ntrs.nasa.gov/citations/20190001439 | Paper | NTRS public | UNCONFIRMED (snippet) |
| Kim et al. 2024 (IEEE EMBC), NTRS 20240001423 | Metabolic workload estimator for EVA traverses, using slope grade, load, speed and body weight; PDF is on NTRS | https://ntrs.nasa.gov/citations/20240001423 | PDF | Page says "Portions may include copyright protected material" | Page opened, equation not read |
| D-RATS 2022 test report (XM-23-003) | Pressurized rover field-test report, 2023; "Portions may include copyright protected material" | https://ntrs.nasa.gov/citations/20230017073 | PDF | As stated | Page opened. Slope and speed figures not read, since PDFs are for you to download. |

PDFs for you to read (I did not open them):
- https://ntrs.nasa.gov/api/citations/20240001423/downloads/IEEE%20EMBC%202024.pdf
- https://ntrs.nasa.gov/api/citations/20230017073/downloads/D-RATS%202022%20Test%20Report%20Final.pdf
- https://bhp.engr.tamu.edu/wp-content/uploads/sites/212/2022/02/Kluis-et-al.-2022-A-METHODOLOGY-FOR-ANALYZING-AND-IMPROVING-EVA-PERFORMANCE.pdf (Mark III suit at varying speed, incline and gravity)
- https://www.nasa.gov/wp-content/uploads/static/history/alsj/19790073512_1979073512.pdf
- https://yugu.faculty.wvu.edu/files/d/6ec90de4-d996-405b-b2e7-61b5ec354ad6/spirit_slip_analysis_istvstemplate__copy___to_be_submitted_.pdf

**Best for a 2-day build:**
1. HiRISE DTMs plus ASU rock abundance: slope and block hazard layers you can use as-is. Slope comes from the DTM and the rock hazard from the Golombek exponential model.
2. The Peña-Asensio method (min-cost path on slope, hard 15 deg cap, boulder mask): a template for the router. It is lunar, so swap the gravity and metabolic terms.
3. Strock et al. 2024 and Brown et al. 2018: real xEMU workload percentages and a 0.38G walking-cost ratio. Brown gives VO2 of roughly 0.68 of the 1G value, which you can use to scale an energy cost per metre.

**Gaps:**
- No Mars suited walking speed or walkback number found. The 10 km, 3.3 km/h and 15 deg figures are Moon or Apollo-era.
- No NASA number for max safe slope for suited crew on Mars or for a Mars pressurized rover. The 20-25 deg figure is the Apollo LRV.
- No tested slope-versus-metabolic equation at 0.38g with a suit. Kim 2024 and Kluis 2022 probably hold one; I did not read them.
- xEMU/AxEMU consumables and EVA duration: not found. NASA-STD-3001 not opened. NEEMO: nothing found. BASALT: only a SEXTANT/timeline snippet. Desert RATS: no slope or speed number.
- Dust, regolith bearing capacity and a global Mars trafficability dataset: not found. Only rover slip anecdotes (UNCONFIRMED).
- RSL and Special Regions: no downloadable polygon file located, and the numeric criteria above are UNCONFIRMED.
- Licences are mostly not stated on the pages. NTRS records say "Public Use Permitted" or "Portions may include copyright protected material" per record.
- Scrapes returned no instruction-like text.
