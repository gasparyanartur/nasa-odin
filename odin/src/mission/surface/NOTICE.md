# Surface renderer origin

`scene3d.js`, `terrain.js` and `fit.js` are adapted from the Fable-generated Marswalk prototype in `odin/app/src/` (the old static app, now in git history at commit 66ee212). Original AI-use headers are retained. That project's code is licensed under Apache-2.0; the full licence is preserved in `public/boxwork/LICENSE` and the original prototype.

Integration changes use the application's npm Three.js runtime, preserve manual camera/navigation semantics, expose navigation projection separately from terrain occlusion, and support the existing floating-point terrain package. The original standalone application remains available for reference in git history at commit 66ee212.

Three.js is MIT licensed. Prepared orbital imagery, DEM and derived files retain the donor's CC BY-SA 3.0 IGO data notices, source catalogue and credits under `public/boxwork/`.
