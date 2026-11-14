# tools - data preparation for the Marswalk app

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

## Python environment

```
python3 -m venv tools/.venv
tools/.venv/bin/pip install --require-hashes --no-deps -r tools/requirements.txt
```

Two packages only, exact versions, hash-checked by pip:

| Package | Version | Hashes listed |
|---|---|---|
| numpy | 2.5.4 | cp314 macOS arm64 wheels (11_0 and 14_0) and the sdist |
| Pillow | 13.0.0 | cp314 macOS arm64 wheel (11_0) and the sdist |

The sha256 values come from the PyPI JSON API (`https://pypi.org/pypi/<name>/json`, read on 2026-11-14). On another platform, add the hash of that platform's wheel from the same API.

`tools/.venv/` is git-ignored.

## Untrusted downloads

Every byte fetched from NASA or USGS hosts is cached under `/Users/ardasarikaya/marswalk-data-raw/` (outside the repository). Run every script that reads it as `tools/.venv/bin/python -I`.

## geotiff_range.py

Reads windows of a remote GeoTIFF through HTTP range requests, without downloading the whole file.

- `open_remote(url, cache_dir) -> RemoteTiff`: follows the redirect, requires `Accept-Ranges: bytes`, caches raw ranges under `cache_dir/tiff/<file name>/`.
- `RemoteTiff.read_window(col0, row0, width, height)`: numpy array of the pixels.
- `RemoteTiff.pixel_to_lonlat(col, row)`, `RemoteTiff.lonlat_to_pixel(lon, lat)`: corner convention (pixel (c, r) covers c..c+1, r..r+1). The projection is read from the GeoTIFF keys (equirectangular or geographic). `GTRasterTypeGeoKey = 2` (PixelIsPoint) shifts the grid by half a pixel.
- `RemoteTiff.bilinear(cols, rows)`: interpolation between pixel centres; a no-data neighbour gives NaN.
- `RemoteTiff.estimate_window_bytes(...)`: compressed bytes a window needs.
- `RemoteTiff.describe()`: header facts (numbers and short strings, capped at 300 characters).
- Supported: classic TIFF and BigTIFF, tiles and strips, compression 1, 5 (LZW), 7 (JPEG through Pillow), 8 and 32946 (Deflate), 32773 (PackBits); predictors 1, 2, 3. Any other compression raises.
- At most 8 connections at a time; adjacent ranges are merged (gap up to 64 KiB, at most 32 MiB per request).

## cut_scene.py

Cuts the scene files of the data contract into `app/public/data/` (image tiles, terrain, slope, `scene.json`). The cut area is fixed: centre lon 137.383, lat -4.803, core 1,024 m, surround 2,048 m. About 232 MB of ranges are fetched on the first run; later runs read the cache.

```
tools/.venv/bin/python -I tools/cut_scene.py --lon 137.383 --lat -4.803 --core-m 1024 --surround-m 2048 --out app/public/data --raw /Users/ardasarikaya/marswalk-data-raw
```

Frame, sampling and results: `data-checks/cuts.md`. It also cuts the colour mosaic (`MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif`) into `ortho/colour_*.webp`; the greyscale set is `ortho/grey_*.webp`. `--refresh-files --out app/public/data` rewrites only the `files` byte map of `scene.json`.

## cut_waypoints.py and alignment_check.py

```
tools/.venv/bin/python -I tools/cut_waypoints.py --raw /Users/ardasarikaya/marswalk-data-raw --data app/public/data
tools/.venv/bin/python -I tools/alignment_check.py --data app/public/data --out data-checks/alignment
```

`cut_waypoints.py` writes `app/public/data/waypoints.json` (every waypoint inside the surround, campaign flag for sols 4534 to 4805, drill markers) from the raw file saved under `<raw>/waypoints/` (`--fetch` downloads it when missing). `alignment_check.py` writes the contact sheet, 5 sample crops and the tracks overview, and prints the height statistics. Results: `data-checks/alignment.md`.

## Tests

```
tools/.venv/bin/python -I -m unittest discover -s tools/tests -v
```

`test_geotiff_range.py` builds synthetic TIFF bytes in memory (no network). `test_cut_scene.py` checks the helpers and the written files; its source comparison needs the USGS host (raw bytes come from the cache).
