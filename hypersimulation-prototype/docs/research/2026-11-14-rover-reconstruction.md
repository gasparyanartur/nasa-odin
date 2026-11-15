# One-site rover reconstruction: available data and recipes

Checked 14 November 2026. Research and static code/data inspection only: no reconstruction training, dependency installation, browser integration or geometric validation was performed.

The Mars paper discussed here is **MaRF: Representing Mars as Neural Radiance Fields**. Its recipe is useful, but the repository does not supply a prepared Martian terrain scene. A newer project, **Martian World Model / M3arsSynth**, supplies a concrete two-image Mars demo and reconstruction code. This is the strongest small neural-reconstruction candidate found in this audit; it is not yet a verified runnable scene.

## What MaRF actually supplies

Inspected [the official repository](https://github.com/lrnzgiusti/MaRF) at commit `d0f82447772f669810e7406cbec9a2f6517389b6` (8 November 2024).

- `data/rover_prepared/` contains 98 JPEG images and a `transforms.json` with 92 camera frames. All referenced image paths exist.
- The images show a rover display indoors on Earth. The unprepared folder contains byte-identical copies of the same 98 photographs. These are useful for checking a reconstruction toolchain, but do not provide a Mars destination. See an [actual bundled frame](https://github.com/lrnzgiusti/MaRF/blob/d0f82447772f669810e7406cbec9a2f6517389b6/data/rover_prepared/images/frame_00003.jpg).
- No trained scene snapshots or additional Mars image sets were found in the checked repository tree; the GitHub releases endpoint returned an empty list. The exact Mars image selections and poses underlying the paper's Figure 7 were not found.

The [preprocessing recipe](https://github.com/lrnzgiusti/MaRF/tree/d0f82447772f669810e7406cbec9a2f6517389b6/scripts/preprocessing) downloads images/labels, filters them, estimates cameras with COLMAP, then uses Instant-NGP. It is a recipe for preparing a new scene, not a georeferenced, trained scene asset. The code has an MIT license.

The Mastcam-Z archive path used by `pull_sols.py` is still accessible: [Sol 59 browse directory](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_mastcamz_ops_raw/browse/sol/00059/ids/edr/zcam/) returned HTTP 200 and image/XML links. This verifies access, not reconstruction coverage. The helper does not implement a Curiosity downloader. Its COLMAP invocation changes into the Instant-NGP scripts directory without forwarding the chosen image/output paths; adapt that invocation before reuse. The example filtering thresholds also need to suit the chosen camera images rather than being copied blindly.

The [paper](https://arxiv.org/html/2212.01672v1) explicitly reports camera-alignment artifacts in its Perseverance result. Reported optimization times are not end-to-end download, camera recovery or app-integration timings.

## Concrete small-scene candidate: Perseverance Sol 23

Inspected [Martian World Model](https://github.com/loongfeili/Martian-World-Model) at commit `f5d9cfd7082e24e952239037d0722b35af6c0529` (6 August 2025).

Its `assets/demo/images/` contains a real left/right Perseverance Navcam pair, both 1196 × 899 pixels, approximately 451 KiB combined:

| Image | Repository file | SHA-256 of inspected JPEG |
| --- | --- | --- |
| Left | `NLF_0023_0668989581_615ECM_N0030792NCAM03023_15_095J01_1200.jpg` | `d31a731e08f7aba6bd2d493b6d1bf6a04d7fe5435da4e2539b2699634d52f40a` |
| Right | `NRF_0023_0668989581_615ECM_N0030792NCAM03023_15_095J01_1200.jpg` | `15f7917c046aa02c756b96bdccdaf7278db106e44be985d70574d6159fc5c74f` |

Corresponding NASA browse products are accessible:

- [Original left PNG](https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00023/ids/edr/browse/ncam/NLF_0023_0668989581_615ECM_N0030792NCAM03023_15_095J01.png)
- [Original right PNG](https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00023/ids/edr/browse/ncam/NRF_0023_0668989581_615ECM_N0030792NCAM03023_15_095J01.png)

Both NASA URLs returned HTTP 206, `image/png`, and valid PNG signatures to bounded range requests. The author's JPEGs were downloaded and visually inspected; the full NASA PNGs were not downloaded or compared pixel-for-pixel. Exact planetary registration and calibrated camera labels have not been established in this audit. This is a Jezero/Perseverance candidate, not data for the current Gale patch.

The checked [demo script](https://github.com/loongfeili/Martian-World-Model/blob/f5d9cfd7082e24e952239037d0722b35af6c0529/scripts/infer.sh) selects `assets/demo`, two input views, 2,000 Gaussian optimization iterations and a `zoom_in_out` trajectory. It calls geometry initialization, scene training and rendering. No MarsGen video-generator training is necessary for this reconstruction branch. These are configuration values, not measured performance or a quality guarantee.

The [geometry code](https://github.com/loongfeili/Martian-World-Model/blob/f5d9cfd7082e24e952239037d0722b35af6c0529/init_geo.py) uses VGGT intrinsics, learned image correspondences, Metric3D depth and PnP camera estimation. Thus its geometry includes learned priors and must not be presented as independently surveyed terrain. A stereo pair supports a limited inspection view; free movement around unseen surfaces remains unsupported.

Static reproducibility gaps:

- GIM weights require a separate download. VGGT is loaded from a local path absent from the repository; Metric3D also fetches pretrained weights.
- `.gitmodules` lists four dependencies, but the inspected tree has no gitlink entries or populated dependency directories. Do not assume `git clone --recursive` supplies them; fetch and pin compatible dependencies explicitly.
- The script requires both its root-path edit and a GPU argument; the README command omits that argument. It has no fail-fast setting, so later stages can run after earlier failures.
- No trained demo splat/checkpoint or browser viewer is bundled. Export/rendering integration is additional work.
- No top-level license was found, and GitHub reports no identified repository license. The separately released dataset is CC BY 4.0; that is not a license for all code and dependencies. Code redistribution terms remain unresolved.

These observations make the project a promising reproduction starting point, not a verified one-command package.

## What the larger M3arsSynth download contains

The [released dataset](https://huggingface.co/datasets/LongfeiLi/M3arsSynth) currently exposes `annotation.json`, train/validation video folders and corresponding camera-text folders. Sample validation files were listed successfully through the API. The inspected release does not expose a top-level collection of original stereo inputs or trained per-scene splats.

Its clips are rendered from reconstructions, and its poses describe virtual camera trajectories. They can support a labeled derived-visualization experiment, but are not additional rover observations. Re-fitting a scene from these clips would reproduce an existing reconstruction rather than establish new measured geometry. Prefer the bundled original-input pair for the first experiment.

## Existing mesh alternative: Mont Mercou

The [LPSC 2025 study](https://www.hou.usra.edu/meetings/lpsc2025/pdf/2074.pdf) describes a Curiosity outcrop reconstruction using 6,825 images over sols 3047–3117, camera models and rover localization. It links a [lower-resolution full model](https://skfb.ly/psYyq). A separate [cropped printable model](https://sketchfab.com/3d-models/mont-mercou-on-mars-3d-printable-model-4b987155177345528286ac196d74fa68) is listed for download under CC Attribution-NonCommercial, with stated original dimensions of 29.2 × 23.2 × 9.67 m.

This is a ready-model alternative for showing real rover-derived geology, not a NeRF reproduction. The printable crop has been modified for printing and should not be assumed to preserve all scientific geometry. The full model's short link returned a challenge response during direct inspection; no model download, asset format, file-specific license or in-app rendering was verified. Neither the paper's complete prepared camera set nor its preprocessing code was located in the checked sources.

## Recommendation and evidence boundary

For a small neural-reconstruction experiment, start from the named Sol 23 pair and the Martian World Model reconstruction branch. First establish whether a trained scene renders acceptably within a modest camera-motion envelope. Browser packaging and a correctly registered map pin are separate unverified steps. Keep route costs and collision on the existing validated terrain contract until reconstructed geometry is independently checked.

For a geology-first demonstration using an existing asset, investigate the full Mont Mercou mesh as the alternative. MaRF remains useful background and preprocessing reference, but its included Earth scene does not fulfill the requested Mars demonstration.

Local audit inputs, source excerpts, downloaded starter images, HTTP checks and hashes are under the ignored `tmp/marf-audit/`. No external authors were contacted, and no app behavior or backlog status was changed by this investigation.
