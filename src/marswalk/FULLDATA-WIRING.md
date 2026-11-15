# Wiring the full Boxwork data

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project. Status: data, types and tests are ready; nothing below is wired yet. This file lists the lines a later builder changes. No existing file was edited to write it.

**Wired on 2026-11-15** (the sections below keep the planning notes):

- (a) Tablet map: `SurfaceMap.tsx` with `sharpImagery.ts`. The 1600 px team image up to zoom 2, `colour_half` or `grey_half` above 2, and above 4 only the 0.25 m tiles the view touches. Images the view no longer needs are let go; the map of a closed tablet holds none.
- (b) Helmet minimap on Boxwork: a north-up window centred on the walker, 200 to 300 m across, widened toward the next stop and the next route point, drawn from the tiles it touches. The habitat and the next stop get an edge mark with direction when they are outside the window.
- (c) Walk scene: unchanged loads, now named in `src/mission/surface/plan.ts`. Medium stays the default; it uses the 1 m height grid (`dem_core.bin`) with every second sample in the mesh; the tiles and every 1 m sample stay behind High. While the prepared science walk is followed, walking checks a 1 m grid (`preparedRoute.ts` `walkTerrain`, about 9 MiB).
- Panorama: Look closer shows `pia26559_1024.webp`; the 4096 px file loads only when "Open full size" is pressed.

## What the full data is

- **Imagery, 0.25 m per pixel:** four colour and four grey tiles of 2048 x 2048 px, webp. They already sit in `public/boxwork/detail/ortho/` (copied there by `scripts/prepare_boxwork.py`), byte-identical to the Marswalk app files. They are not duplicated into `public/boxwork/full/`; `full/manifest.json` points at them and stores their sha256. Browsers, `createImageBitmap`, the 2D canvas and three.js all take webp, so no conversion is needed.
- **Half-resolution core image, 0.5 m per pixel:** `colour_core_half.webp` and `grey_core_half.webp`, 2048 x 2048 px, same folder.
- **Height, 1 m:** `public/boxwork/full/height.f32`, 1025 x 1025 float32 little-endian, row 0 north, column 0 west, samples on the grid corners, no-data as NaN (none in this cut). It is `detail/dem_core.bin` decoded once (elevation = -3897 + code x 0.01 m), not resampled.
- **Extent in the team frame:** east -510.202 to +510.202 m, north -512 to +512 m. The Marswalk core is 1024 projected metres square; team x = Marswalk x x 0.9964884795347444. It covers the whole team 1000 m square with a margin of about 10.2 m east and west and 12 m north and south.
- **Panorama:** `public/marswalk/pia26559_4096.webp` (4096 x 1083 px) and `pia26559_1024.webp` (1024 x 271 px), credit NASA/JPL-Caltech/MSSS, details in `public/marswalk/panorama.json`.
- **Helpers:** `src/marswalk/fullData.ts` gives `FULL` (the typed manifest), `tiles()`, `tileFor(xEast, yNorth)`, `loadHeightGrid()`, `heightAt(grid, xEast, yNorth)` and `pickImagerySource(loaded, mode)`.

## How the memory figures are computed

Decoded RGBA image: width x height x 4 bytes. With a full mipmap chain (three.js `generateMipmaps = true`, set in `imageTexture` of `src/mission/surface/scene3d.js`): times 4/3. MiB = 1 048 576 bytes. These are lower bounds: a driver can pad, and `src/mission/surface/renderer.ts` keeps every `ImageBitmap` alive until `dispose()`, so a CPU copy of each image exists as well.

| Image | Size | Decoded | With mipmaps |
| --- | --- | --- | --- |
| One core tile | 2048 x 2048 | 16 MiB | 21.3 MiB |
| Four core tiles | 4 x 2048 x 2048 | 64 MiB | 85.3 MiB |
| Core half or surround | 2048 x 2048 | 16 MiB | 21.3 MiB |
| Overview | 512 x 512 | 1 MiB | 1.3 MiB |
| Team ortho.jpg | 1600 x 1600 | 9.8 MiB | 13.0 MiB |
| Panorama 4096 | 4096 x 1083 | 16.9 MiB | 22.6 MiB |
| Panorama 1024 | 1024 x 271 | 1.1 MiB | 1.4 MiB |

Line numbers below are from the working tree on 2026-11-15, while another builder had uncommitted edits in `App.tsx`, `SurfaceMap.tsx`, `WalkingScene.tsx` and `renderer.ts`. Find each place by the quoted text if the numbers moved.

## (a) Tablet map

Today: `src/mission/SurfaceMap.tsx` line 59-61 loads `OVERLAYS` files (`ortho.jpg` or `ortho-grey.jpg`, 1600 px over the 1000 m team square) and line 71 draws each with `ctx.drawImage(images[index],0,0,size,size)` onto an 800 px canvas. The tablet instance is `src/App.tsx` line 471 (`{data?<SurfaceMap imagery={imagery} environmentLayer=...`).

Change:

1. In `SurfaceMap.tsx` beside the effect at lines 58-63, when `p.data.meta.regionId==='gale-boxwork'` and not `p.mini`, load the four tiles of `tiles()` for the current `p.imagery` (`url.colour` or `url.grey`), each into its own `Image`, and keep a `loaded` record keyed `colour_0_0` and so on.
2. At line 71, for the imagery layer only: call `pickImagerySource(loaded, p.imagery)`. For `full-tiles` draw each tile at its own extent with the existing `pixel()` helper of line 69: `const [x0,y0]=pixel({x:t.extent.west,y:t.extent.north}), [x1,y1]=pixel({x:t.extent.east,y:t.extent.south}); ctx.drawImage(img,x0,y0,x1-x0,y1-y0)`. The tiles reach 10 to 12 m past the canvas square; the canvas clips them. Do not stretch a tile to `0,0,size,size`.
3. Keep `ortho.jpg` drawn first as the fallback until every tile has loaded.

Cost: 64 MiB decoded for one mode. Gain: the canvas shows 1000 m / 800 px = 1.25 m per canvas pixel at zoom 1, divided by the zoom (`src/mission/mapViewport.ts` caps zoom at 8). The 1600 px ortho (0.625 m per pixel) limits sharpness above zoom 2, the core half image (0.5 m) above zoom 2.5, the tiles (0.25 m) only above zoom 5. A cheaper middle step: load only `colour_half` (16 MiB) at zoom above 2, and the tile under the view (`tileFor` of the view centre, 16 MiB) at zoom above 4.

## (b) Round helmet minimap

Today: `src/App.tsx` line 286, `<SurfaceMap ... overlays={{...defaultOverlays(),imagery:{visible:true,opacity:1}}} ... mini/>`. It is the same component with `mini`, so it draws the full 1000 m square at zoom 1 (the wheel handler at `SurfaceMap.tsx` line 56 is off for `mini`).

Change: none is useful as long as the minimap shows the whole square. At 1.25 m per canvas pixel the 1600 px ortho (0.625 m per pixel) is already sharper than the canvas. Full tiles would add 64 MiB to a second `SurfaceMap` instance (it decodes its own images) with no visible gain. Only if the minimap becomes a rover-centred zoomed view (for example 200 m across) does `colour_half` (0.5 m, 16 MiB) or the one tile under the rover (`tileFor(pose.x, pose.y)`, 16 MiB) pay off; that change goes in the same places as (a), gated on `p.mini` and the pose.

## (c) Walk scene texture

Today the walk scene already uses the Marswalk detail data for Boxwork, because `manifest.json` has `detail`. In `src/mission/surface/renderer.ts`: line 29 loads the overview, line 56 the surround, line 57 `core_half`, and line 58 loads the four 0.25 m tiles only when `quality==='high'`. The quality starts at `'medium'` (`src/App.tsx` line 79, `useState<GraphicsQuality>('medium')`) and the scene is rebuilt on change (`App.tsx` line 275, `key={...-${quality}-${imagery}}`).

Change, pick one:

- Leave it. The user already gets the full tiles by choosing High in the HUD settings.
- Load the full tiles at Medium too: in `renderer.ts` line 58 change `quality==='high'` to `quality!=='low'`.

Cost of the walk scene textures (one imagery mode): overview 1.3 + surround 21.3 + core half 21.3 = 44 MiB at Low and Medium; plus four tiles 85.3 = 129.3 MiB at High. The core half texture stays on the GPU after the tiles arrive (`addImage` in `scene3d.js` keeps `images.core_half`). Switching the imagery mode rebuilds the scene, so two modes are never on the GPU together.

## (d) Walk scene mesh

Today the mesh already uses the 1 m Marswalk height: `renderer.ts` lines 27-28 load `detail/dem_core.bin` (1025 x 1025 uint16) and build `createTerrain`; `scene3d.js` `setCoreTerrain` builds four chunks of 513 x 513 samples. The sample stride comes from `displayStride` in `scene3d.js`: 1 when `lowDetail` is false, 2 when it is true (4 on a software renderer). `renderer.ts` line 38 sets `lowDetail:quality==='low'||(!!data.meta.detail&&quality==='medium')`, so on Boxwork only High draws every 1 m sample.

Change: none is needed to use 1 m height. `full/height.f32` is the same samples as float32, for code outside the 3D scene (HUD elevation readout, profile charts) through `loadHeightGrid()` and `heightAt()`. Do not feed it to `createTerrain`: that path expects the uint16 encoding of `dem_core.bin`.

Cost of the core mesh (positions float32 x 3, uv float32 x 2 shared, index uint32; skirt vertices left out):

- Stride 1 (High): 4 x 263 169 vertices. Positions 12.0 MiB, uv 2.0 MiB, full index 6.0 MiB, second level-of-detail index 1.5 MiB: about 21.5 MiB.
- Stride 2 (Low and Medium): 4 x 66 049 vertices. Positions 3.0 MiB, uv 0.5 MiB, index 1.5 MiB: about 5 MiB.
- CPU side, either stride: `dem_core.bin` 2 MiB plus the float heights `fillNoData` builds, 4 MiB.

## Recommendation for a laptop with built-in graphics

Built-in graphics share system memory, so these figures come out of the laptop's RAM. No measurement was made on such a laptop; the advice follows from the figures above only.

- Tablet map: keep the 1600 px ortho as the default and load `colour_half` (16 MiB) when the zoom passes 2. Load single tiles (16 MiB each) only for the view at zoom above 4, never all four by default.
- Helmet minimap: keep the 1600 px ortho. Full data shows no gain at its scale.
- Walk scene texture: keep Medium as the default (44 MiB); the tiles stay behind High (129.3 MiB).
- Walk scene mesh: keep stride 2 at Medium (about 5 MiB); stride 1 stays behind High (about 21.5 MiB).
- Panorama: show `pia26559_1024.webp` (1.1 MiB) first and swap to the 4096 px file (16.9 MiB decoded) only when it opens full screen.
