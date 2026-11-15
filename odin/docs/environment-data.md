# Environmental maps, history and simulated outlook

Version 0.6 implements FR-003, FR-004 and FR-008 with a locally bundled, numeric data package. Open **Station → Data & history** for the environmental explorer. Select a layer, click a map cell/sounding or choose a sample in the inspection list, and inspect its quantity, units, location, time, source and uncertainty. The same layer selection/opacity is available on the Station atlas and **Tablet → Explore → Environmental observations & forecast layers**.

## Published spatial layers

| Layer | Quantity | Coverage and preparation |
| --- | --- | --- |
| Odyssey GRS potassium | Mass fraction, weight percent | 2,592 unsmoothed 5° bins; 2,575 nonnegative numeric values |
| Odyssey GRS thorium | Mass fraction, ppm | 2,592 bins; 2,468 nonnegative numeric values; source weight percent multiplied by 10,000 |
| Odyssey GRS water-equivalent hydrogen | Equivalent water mass fraction, weight percent | 2,592 bins; 1,496 nonnegative numeric values; a hydrogen proxy, not current liquid water/moisture |
| MRO MCS surface temperature | Retrieved surface temperature, K | 1,104 retained soundings from six four-hour products on 1 April 2015; each keeps its own UTC and source LTST |

GRS source: [PDS elemental concentration archive](https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html), [5° data and labels](https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/unsmoothed/5x5/). Acquisitions span 4 June 2002–3 April 2005. The label's concentration sigma is retained and converted with the same unit factor. Missing sentinel values and negative background-subtracted concentrations display as unknown/below background; raw values remain in the package. Errors including correction factors are not substituted for the supplied sigma. Unsmoothed bin spacing does not establish independent spatial resolution or precise chemical contacts.

Source bin centers are preserved, with longitudes normalized from 0…360° to −180…180°. The GRS table labels do not specify the latitude convention: the app displays those centers in its spherical Mars frame without a fine datum correction and exposes that limitation. Cells are the original accumulation bins. A single cell covering the whole local patch remains coarse regional context. **Potassium/thorium composition is not a dose map and does not change route costs.**

MCS source: [PDS surface-temperature archive description](https://pdsatmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/surface_ground_temp.html), [actual 2015-04-01 DDR products](https://atmos.nmsu.edu/PDS/data/MROM_2104/DATA/2015/201504/20150401/) and [product SIS](https://atmos.nmsu.edu/PDS/data/MROM_2104/DOCUMENT/DP_SIS.ASC). Parse profile-summary records rather than atmospheric pressure-level rows. Select good geometry (`Gqual=0`), finite positive surface temperatures below 400 K, finite nonnegative uncertainty below 100 K and valid coordinates. Preserve `surf_qual` and `Obs_qual` explicitly; the inspected SIS leaves surface-quality values unspecified, so the app does not certify every retrieval flag as good. Missing values are omitted. The source's areocentric latitude/east longitude and individual times are retained. The plotted point is a sounding-location glyph, not a measured footprint or reconstructed temperature image. No interpolation fills gaps, and the dated soundings are not simultaneous. These temperatures are distinct from REMS air temperature.

## Expanded Curiosity record

The package includes **19 sols, 10–28**, with **456 hourly records**. Original [REMS calibrated products](https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/data_calibrated/SOL_00001_00089/) and [RAD RDR products](https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_00000_00089/) are downloaded with labels. Each sol retains its exact product URLs.

- REMS: ambient-temperature reliability byte 8 must equal `1`, with finite physical values between 100 and 350 K; compute unweighted hourly medians in LMST, retain accepted counts and first/last source spacecraft-clock values. Other confidence flags are not claimed to have all passed. The Kelvin unit is checked against the XML label.
- RAD: all-zero QC, finite nonnegative detector E dose rates, checked label units `microGray / Hour`; compute unweighted hourly medians using `START_OBS_MARS` bins belonging to the selected sol. Preserve missing bins. These are the archive's instrument Mars-hour bins; precise alignment with REMS LMST is not asserted. Absorbed detector dose is distinct from astronaut dose equivalent, terrain radioactivity and UV.
- Site context: use the last published [NASA/JPL rover waypoint](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json) at or before the sol. This is approximate sol-level context, without a reported error bound or per-reading localization. RAD's placeholder zero rover coordinates are not used. Site points do not imply a spatial air-temperature or dose field.

Select a sol/hour to inspect observations and coverage. Site temperature/radiation layers follow this selection. MCS and GRS retain their own fixed acquisition periods. Changing the analysis epoch never changes the excursion's independent Sol 10 clock, personal field data or route settings.

## Simulated next-sol profiles

The published outlook is **Sol 29**, issued after **Sol 28**, fitted to **Sols 22–28**. For each instrument hour, predict the median of the previous seven sols' available hourly medians. Require at least three observations; otherwise leave the forecast unknown. Temperature has 24 predicted hours; RAD has 13. Training observations' 10th–90th percentile spread is shown as historical variability, **not a calibrated prediction interval**.

The fixed method is evaluated at rolling issuance dates before held-out Sols 24–28. For every target sol, training includes only its preceding seven sols, never that sol or later data. Previous-sol persistence is compared on exactly the same target hours with available predictions and observations:

| Quantity | Daily-profile MAE | Persistence MAE | Matched target hours |
| --- | --- | --- | --- |
| REMS air temperature | 2.544 K | 2.887 K | 120 |
| RAD detector E rate | 0.702 µGy/h | 1.194 µGy/h | 42 |

All-available model evaluation also retains 46 RAD target hours (MAE 1.045 µGy/h); the UI's paired comparison uses the stricter shared mask. Results are a small, correlated historical diagnostic rather than evidence of operational forecast skill. Site movement, instrument selection and sampling gaps remain limitations. No atmospheric dynamics, spatial prediction, shielding or solar-event forecast is modeled.

## Using a snapshot in a mission

In Gale, **Use snapshot as fixed mission assumptions** explicitly copies the selected air temperature and detector rate into the existing manual fixed scenario and invalidates stale routes. It is disabled if either value is missing. As with editing mission assumptions, this resets elapsed mission time; position and the Sol 10 clock anchor remain unchanged. The UI explains this effect and identifies the observation/forecast sol and instrument hour copied. Subsequent browsing does not alter those fixed assumptions. This does not make a time-varying forecast drive the planner. Return checks and the HUD use the existing manual scenario semantics.

## Data contract and reproduction

`public/environment/catalog.json` contains a versioned scalar-layer catalog, hourly site records, forecasts, validation and **109 source URL/SHA-256 records**. `summary.json` provides counts and model results. `src/environment/model.ts` defines common quantities, units, coordinates, optional bin bounds, time, uncertainty, quality and source links for reuse by future FR-020 chemical/HUD layers. No chemical sensor or moisture detection is inferred from these layers.

Run `npm run prepare:environment` with the repository Python environment. The source products total several hundred megabytes and remain in ignored `tmp/environment-release/sources/`; the bundled catalog is about 2 MB. Preparation reuses cached originals, fails on source/label errors, and never substitutes synthetic measurements. Regeneration does not overwrite the original Sol 10 mission package or user field records. Delete an individual cached source to refresh it. Tests verify forward-only fitting, sparse-hour behavior, matched evaluation masks, actual unit conversions, footprints and package structure.
