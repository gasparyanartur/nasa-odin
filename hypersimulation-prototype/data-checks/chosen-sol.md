# Chosen sol

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project. Checked 2026-11-14.

## Result

- Chosen sol: 4600. Sols tried: 4600 only. It passed on the first try, so no later sol was downloaded.
- Why it won (rule: first sol at or after 4600 with a REMS file, a RAD file and at least 20 of 24 hours of ground temperature): REMS file exists, RAD file exists, ground temperature has 24 of 24 hours.
- Earth date: 2025-07-15 (UTC). Source: NASA raw image feed, field `date_taken` of the newest image of sol 4600 (2025-07-15T16:57:02Z). A sol straddles two UTC dates. The RAD file name for this sol starts at 2025-196 01:01 UTC, which is also 2025-07-15.

## Hours with data (LMST hour, 24 possible)

| Field | Hours with data | Range of hourly means |
|---|---|---|
| ground brightness temperature | 24 | -102.6 to -6.9 degrees Celsius |
| air temperature (AMBIENT_TEMP) | 24 | -80.2 to -23.4 degrees Celsius |
| pressure | 24 | 714.4 to 761.3 Pa |
| UV_ABC | 20 (no data in hours 9, 10, 13, 14) | 0.0 to 7.9 W/m2 |
| relative humidity | 0 | no data |

Hour = the HH of the LMST text. Parse: `^(\d{5})M(\d{2}):`, group 2. Example `04600M13:59:59.999` gives hour 13. Rows whose sol part is not 4600 are skipped. Hourly value = mean of the 1 Hz rows that pass the flags (count `n` per field in the file).

## REMS column positions and label cross-check

- The PDS3 label (.LBL) only points to a structure file (MODRDR6.FMT) that is not in the sol folder. The names and order were read from the PDS4 label of the same product (.xml). Result: names and order match section 12 of the catalogue for all 40 columns (checked: LMST, BRIGHTNESS_TEMP, GTS_CONFIDENCE_LEVEL, AMBIENT_TEMP, its flag, UV_ABC, UVS flag, humidity, HS flag, PRESSURE, PS flag). Difference: none.
- The flag strings are right-aligned with blanks inside the quotes. Byte 0 is the left end of the stripped string.

## Flag rule (a deviation from the plain rule, decided here)

Plain rule ("a value counts only if its flag string has no 0") leaves zero values: GTS byte 0 (ASIC power supply) is 0 in every row, and the other strings always carry some 0 for a state, not a fault (for example night, no global irradiance). So each value is guarded by the bytes that name a fault. A byte must be `1`; `X` (unknown) counts as not good. Meanings are from the PDS4 label.

| Value | Flag column | Required bytes |
|---|---|---|
| ground brightness temperature (col 8) | GTS_CONFIDENCE_LEVEL (col 11) | 1 recalibration quality, 2 rover still |
| air temperature (col 16) | AMBIENT_TEMP_CONFIDENCE_LEVEL (col 17) | 2 power supply in range, 7 error under 5 K, 8 reliable |
| pressure (col 38) | PS_CONFIDENCE_LEVEL (col 40) | 1 no shadow effect |
| UV_ABC (col 21) | UVS_CONFIDENCE_LEVEL (col 30) | 2 arm stowed, 3 no shadow |
| relative humidity (col 31) | HS_CONFIDENCE_LEVEL (col 36) | 0 reliable, 1 quality good, 2 in range |

Not required, on purpose: GTS byte 0 (always 0) and byte 3 (shadow in the field of view); air temperature bytes 0, 1, 3, 4, 5, 6; pressure byte 0 (which oscillator, not quality); UV bytes 0, 1 (global versus diffuse light, one is always 0) and 4 (dust attenuation).

Consequences to show on screen:
- UV: byte 4 (dust attenuation under 10 percent) is 0 in every row of this sol. UV values are therefore lower bounds, and the file says so.
- Humidity: byte 0 is 0 and byte 1 is X in the file, so no humidity value passes. It is null for all 24 hours.
- Ground brightness temperature: the stated long-term uncertainty in the file is 5 to 13 K (larger at night). Night hourly means include single rows as low as about 85 K that passed the flags; the hourly mean is used, no outlier filter was added.
- Ground value is a thermopile brightness temperature, not a contact temperature.

## RAD dose

- File layout (read from the real file, not from the SIS or a .FMT; no dose .FMT exists in the folder): each `[DOSIMETRY_TOTAL_DOSE_B: NN]` and `[DOSIMETRY_TOTAL_DOSE_E: NN]` header is followed by one blank line and one number. Not confirmed by any document: that this number is the dose rate and not a total. The SIS says only that "the total dose for the B and E detectors are given in microGray / hour". The unit is from the SIS; the one-number layout is from the file.
- Observation start time is read from `START_OBS_MARS="<sol> H:MM:SS"` of the same `[OBSERVATION: NN]`. In this file the last observation reads "4600 0:05:50" after "4600 23:49:11": the clock wrapped but the sol number did not change. That observation is dropped (the first backward step ends the sol).
- 87 observations carry dose sections; 86 are inside the sol (about every 16.6 minutes, hours 0 to 23 all covered).
- Detector: B (value mean 6.969 microGray/hour, n_obs 86). The SIS does not say which detector to prefer; B is the first one it lists. This is our choice. Detector E: 6.615 microGray/hour (n_obs 86), given in `dose.json` as `other_detector`.
- Derived daily rate (our calculation, mean of the 24 hourly means x 24 / 1000): B 0.167 mGy/day, E 0.159 mGy/day.
- Plausibility against Hassler et al. 2014 (0.210 +/- 0.040 mGy/day, Gale 2012 to 2013 average): 0.167 mGy/day is 0.043 below 0.210, about the stated +/- 0.040 edge. Not forced. The two numbers may count different things (detector, period, solar cycle); we did not check how Hassler defined the number.
- ERRATA.TXT: no mention of sol 4600. TIMING_ERRORS.TXT: no entry for the file of sol 4600 (searched for 4600 and the file name).

## Space weather

- DONKI SEP call (section 12) returned one event: `2025-05-13T18:14:00-SEP-001`, eventTime 2025-05-13T18:14Z, instrument SOHO: COSTEP 15.8-39.8 MeV, linked events FLR and CME. Written to `sep-event.json` with the note "Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario." The notification text of the event is not copied.

## Files read (raw copies in /Users/ardasarikaya/marswalk-data-raw/)

- REMS: https://atmos.nmsu.edu/PDS/data/PDS4/msl_rems_bundle/data_calibrated/SOL_04489_04612/SOL04600/RME_805808741RMD46000000000_______P1.TAB (13.9 MB, 37,289 rows, 40 fields), plus the .LBL and .xml of the same name.
- RAD: https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_04489_04612/RAD_RDR_2025_196_01_01_4600_V00.TXT (70.8 MB), https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DOCUMENT/RAD_RDR_SIS.HTM, https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/ERRATA.TXT, https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DOCUMENT/TIMING_ERRORS.TXT.
- DONKI: https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2025-05-10&endDate=2025-05-16
- Raw image feed (date only): https://mars.nasa.gov/api/v1/raw_image_items/?order=sol+desc&per_page=1&condition_1=msl:mission&condition_2=4600:sol:in
- Folder listings (REMS sol folder, RAD folder) were read to find file names.

## Reproduce

`python3 -I tools/cut_conditions.py --sol 4600 --rems-tab ... --rems-xml ... --rad-txt ... --feed-json ... --donki-json ... --rems-url ... --rad-url ... --donki-url ... --out-dir app/public/data` (offline; the raw files are passed in). Tests: `python3 -I tools/tests/test_conditions.py -v` (18 tests, hand-written fixtures).
