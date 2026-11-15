# Data licence

Code in this folder: Apache-2.0 (see `LICENSE`).

All image, terrain and slope files that this project derives from the two USGS mosaics (`public/data/`, including `ortho/`, `dem_core.bin`, `dem_surround.bin`, `slope_core.bin`) are licensed under CC BY-SA 3.0 IGO: https://creativecommons.org/licenses/by-sa/3.0/igo/

Why this licence: both USGS products contain HRSC data (ESA Mars Express, CC BY-SA 3.0 IGO). The two USGS pages state "Use Constraints: None" and ask to credit the authors. We apply the ShareAlike licence as the cautious reading. A file derived from these files must carry the same licence and the same credit.

Credit to give with any of these files:

- Calef III, F. J., & Parker, T. (2016), USGS Astrogeology. MSL Gale Merged Orthophoto Mosaic and MSL Gale Merged DEM Mosaic, v3.
- ESA/DLR/FU Berlin (HRSC).

Changes made by us: cut to a small area, resampled, and (for slope) computed from the terrain file. The cuts are made by the scripts in `tools/`.

Other data used by the app keeps its own terms; see `sources.json` and the "Sources and licences" section of `README.md`. The panorama in `public/media/` is a NASA image, resized, credit NASA/JPL-Caltech/MSSS. This project uses no NASA logo, flag or mission patch, and NASA does not endorse it.
