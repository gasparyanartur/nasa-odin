# Martian Map 0.6 — environmental maps and simulated forecasts

Date: 2026-11-14. Status: Complete locally. The user requested implementation of FR-003, FR-004 and FR-008, with more real data and a foundation for FR-020.

## Goal and scope

Add inspectable radiation/composition and temperature maps, expand the single-sol historical record, and provide explicitly simulated temperature and detector-radiation forecasts fitted to historical observations. Preserve the existing station/tablet/HUD and personal field-data work.

## Approach

- Prepare a versioned, local numeric layer catalog. Include actual Odyssey GRS unsmoothed 5° potassium/thorium concentrations, preserving uncertainty and below-background/missing values; these are composition, not astronaut exposure. Include a one-day MRO/MCS surface-temperature observation sample with source coordinates, timestamps and retrieval flags. No spatial interpolation across unobserved areas.
- Expand Curiosity REMS air temperature and RAD detector E records over Sols 10–28. Retain per-hour accepted sample counts and source hashes. Use rover waypoint context with explicitly approximate location, not RAD's placeholder zero coordinates. Preserve missing bins and different instrument time conventions.
- Fit a simple recent-sol daily-profile baseline separately for temperature and radiation. Use only earlier sols at each issuance; compare against previous-sol persistence on later held-out sols. Publish coverage, MAE and historical spread without claiming solar-event prediction or calibrated astronaut dosimetry. Forecasts cover one following sol and remain site scenarios.
- Share selected layer, opacity, observation/forecast time and inspected sample across station analysis, globe and tablet. Provide units, legend, coverage, quality and provenance. The scalar catalog is reusable for later chemical/HUD layers; FR-020 itself remains separate.
- Keep analysis time distinct from the active excursion's Sol 10 clock. An explicit action may copy a selected Gale temperature/dose snapshot into fixed manual mission assumptions; inspecting layers or forecasts never silently changes route settings. Do not infer radiation shielding or environmental path costs from composition.

## Milestones

| Milestone | Status | Evidence |
| --- | --- | --- |
| Source-backed environmental package | Complete | 7,776 GRS bins, 1,104 retained MCS soundings, 456 hourly REMS/RAD records over 19 sols and 109 hashed source records. Source flags, coordinate limitations and missing bins remain explicit. |
| Causal forecast baseline | Complete | Prior-seven-sol hourly median; 24 temperature and 13 RAD forecast hours. Forward-only fitting and paired held-out evaluation verified by tests. |
| Integrated maps and inspection | Complete | Verified station map, rendered globe overlay, tablet layer/inspection, shared epoch/opacity, retry, and explicit adoption of fixed mission assumptions. |
| Completion review | Complete | 46 frontend tests, 23 Python tests, production build and all 17 distinct browser scenarios passing across runs; visual evidence and documented limitations. |

## Risks and boundaries

Global composition cells are hundreds of kilometers across. MCS is a dated sample of orbital soundings, not continuous or present-day local weather; surface temperature differs from REMS air temperature. Historical rover positions may only provide sol-level context. RAD reports an instrument dose rate, not astronaut dose equivalent. A small historical baseline can perform poorly; report its actual results and retain unknown values. No fabricated fine-resolution field replaces missing measurements. No new paid service or runtime remote scientific API is needed.

## Next milestone

The bounded 0.6 release is complete locally. FR-020 can reuse the scalar-layer contract for future chemical/HUD data; it still needs its own verified observations, spatial registration and interface work. Publication remains on the existing roadmap.

## Completion review — 2026-11-14

Reviewed against this plan using the repository's review-feature skill. Source data, unit conversion, missing-data handling, causal fitting, visual rendering and mission-state boundaries were inspected.

- Actual PDS products are bundled through reproducible preparation with source hashes. GRS composition/detector dose and MCS surface/REMS air temperatures remain distinct. GRS labels leave latitude convention unspecified; the app exposes its spherical-display assumption. MCS geometry and numeric values are filtered while remaining source quality codes are retained without claiming all are good.
- The Sol 29 outlook uses Sols 22–28 only. Rolling predictions for held-out Sols 24–28 compare matched target hours: temperature MAE 2.544 versus persistence 2.887 K (120 hours); RAD MAE 0.702 versus 1.194 µGy/h (42 paired hours). Historical spread is not presented as a calibrated prediction interval; 11 RAD forecast hours remain unknown.
- Browser checks verify real source-package loading, numeric sample inspection, rendered globe pixels, local overlay and sample selection, station/tablet state agreement, no implicit route changes, explicit fixed-snapshot adoption, load failure/retry and mobile width. Existing science, field-data, walking, timeline, globe, keyboard and touch flows remain passing across the recorded runs.
- Fixed a tablet sizing regression by keeping environmental controls in the sidebar. Corrected new test selectors to target the intended controls. An initial software-rendered movement timeout passed unchanged on its focused rerun. All 17 distinct browser scenarios pass across the full and focused runs; no claim is made that the first full run was clean. The existing large Cesium/Three bundle warning remains.
- Package/API version, preparation command, README, environmental data documentation and backlog are updated. No source terrain, original mission Sol 10 package or saved field observations were replaced. No public deployment is claimed.

Evidence: [verification](../evidence/v06/verification.json), [composition and history](../evidence/v06/v06-composition.png), [rendered globe](../evidence/v06/v06-global.png), [forecast](../evidence/v06/v06-forecast.png), [local tablet overlay](../evidence/v06/v06-tablet-layer.png), and [data/model details](../environment-data.md).
