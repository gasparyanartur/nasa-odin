# Data check - alignment (Task 2)

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project. Run on 2026-11-14.

Commands, from `hackathons/nasa-space-apps-2026`:

```
tools/.venv/bin/python -I tools/cut_waypoints.py --raw /Users/ardasarikaya/marswalk-data-raw --data app/public/data
tools/.venv/bin/python -I tools/alignment_check.py --data app/public/data --out data-checks/alignment
```

## Waypoints file

- Source: `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json`, saved raw under `/Users/ardasarikaya/marswalk-data-raw/waypoints/` before reading. 1,389 features in the raw file.
- `app/public/data/waypoints.json`: 142 waypoints inside the 2,048 m surround. 65 of them are campaign waypoints (sols 4534 to 4805), the same count as in the raw file.
- x, y are projected local metres of `scene.json` (same frame as the terrain and image).
- Cross-check: the raw `easting` and `northing` match our projection of `lon` and `lat` within 0.003 m and 0.000 m (largest differences over the 65 campaign waypoints).
- Units of `pitch_deg`, `roll_deg`, `tilt_deg`: degrees by inference (catalogue section 12), carried as `tilt_unit_note`. `dist_km` is dropped; `dist_total_m` is kept.
- `dem_height_m` is read from the app's own terrain files (`dem_core.bin` inside the core, `dem_surround.bin` outside), bilinear between samples.

Drill markers (`drill_markers` in `waypoints.json`): the campaign waypoint nearest to the named sol. Neither sol has a waypoint of its own.

| Name | Target sol | Waypoint sol | x (m) | y (m) | Note |
|---|---|---|---|---|---|
| Altadena (at the edge of the boxwork) | 4568 | 4571 | -0.751 | 153.584 | rover position on sol 4571; the drill position is not published |
| Nevado Sajama (on a ridge) | 4803 | 4805 | -93.634 | -286.816 | rover position on sol 4805; the drill position is not published |

## Height check

`dem_height_m - elev_geoid_m` over the 65 campaign waypoints:

| Statistic | Value (m) |
|---|---|
| Median | -0.007 |
| 5th percentile | -0.186 |
| 95th percentile | +0.102 |
| Minimum / maximum | -0.279 / +0.388 |
| Standard deviation after the median is removed (root mean square about the median) | 0.107 |

Stated tolerance: 0.107 m (the standard deviation above). The terrain and the waypoint heights share one vertical datum; no offset is applied. The small spread suggests that the waypoint heights were themselves read from this terrain product. If so, this check confirms the horizontal frame and the file handling, not an independent height measurement.

## Visual check (verdict by the orchestrator)

Files in `data-checks/alignment/`:

- `contact-sheet.png`: all 65 campaign waypoints, 9 columns. Each crop is 64 m x 64 m of the 25 cm colour image, 2x nearest upscale (512 px), with a thin cyan ring of 2 m radius at the waypoint. A caption strip below each crop gives the sol and x, y. Saved as a 128-colour palette PNG (3,678,667 bytes, below the 4 MB limit). The ring, line, white and black are exact palette entries.
- `sample-sol4534.png`, `sample-sol4582.png`, `sample-sol4621.png`, `sample-sol4662.png`, `sample-sol4805.png`: 5 crops at 4x nearest (1,024 px), full colour.
- `tracks-overview.png`: the whole core from the colour image at 2,048 px (0.5 m per px), with all campaign waypoints as small open cyan rings joined by a thin yellow line in sol order. Saved as a 256-colour palette PNG (3,842,022 bytes).

The colour mosaic is dated July 2025 at the latest, and its source image dates per area are not read. Tracks from drives after its images were taken cannot show. Judge the path only against tracks that do show.

No translation was applied to the waypoints (amendment A9 leaves that to the orchestrator's verdict).
