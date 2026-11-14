"""Cut the Marswalk scene (image, terrain, slope) from the USGS Gale mosaics.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Usage (from hackathons/nasa-space-apps-2026):
  tools/.venv/bin/python -I tools/cut_scene.py --lon 137.383 --lat -4.803 --core-m 1024 \
      --surround-m 2048 --out app/public/data --raw /Users/ardasarikaya/marswalk-data-raw
  tools/.venv/bin/python -I tools/cut_scene.py --refresh-files --out app/public/data

Local frame: projected metres of the file projection, origin at the 25 cm image
pixel corner nearest to (--lon, --lat), x east, y north. Sample positions follow
plan amendment A4.
"""

import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geotiff_range as g  # noqa: E402

ORTHO_URL = "https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif"
DEM_URL = "https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif"
COLOUR_URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif"
IMAGE_M = 0.25
TILE_PX = 2048
NODATA16 = 65535
SLOPE_SCALE = 0.25
SLOPE_NODATA = 255
SLOPE_BASELINE_M = 5
SCALES = (0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1)
MAX_FETCH = 2 * 1024 ** 3
GREY_QUALITY = 90
COLOUR_QUALITY = 85
COLOUR_QUALITY_MIN = 75
COLOUR_TILE_MAX = 1_800_000
COLOUR_OVERVIEW_MAX = 120_000
COLOUR_SOURCE_ID = "usgs_gale_colour_2025"
GREY_SOURCE_ID = "image_25cm"
SLOPE_METHOD = ("Horn's method on the 1 m terrain block-averaged to 5 m (no-data skipped), "
                "with true ground spacing, then bilinear back to the 1 m cell centres.")


def grey_lut(tif):
    """Palette index to grey. Identity unless the ColorMap says otherwise."""
    cm = tif.tags.get(320)
    if not cm or tif.tags.get(262) != 3:
        return None
    r, gg, b = (np.array(cm[k * 256:(k + 1) * 256], dtype=np.int64) >> 8 for k in range(3))
    if np.array_equal(r, gg) and np.array_equal(r, b):
        if np.array_equal(r, np.arange(256)):
            return None
        return r.astype(np.uint8)
    return np.clip(np.round(0.299 * r + 0.587 * gg + 0.114 * b), 0, 255).astype(np.uint8)


def block_mean(img, k, nodata=0):
    """k x k area mean of a uint8 image; `nodata` pixels are skipped."""
    h, w = img.shape
    a = img.reshape(h // k, k, w // k, k).astype(np.float64)
    valid = a != nodata
    s = (a * valid).sum(axis=(1, 3))
    n = valid.sum(axis=(1, 3))
    out = np.where(n > 0, s / np.maximum(n, 1), nodata)
    return np.clip(np.round(out), 0, 255).astype(np.uint8)


def block_mean_rgb(img, k):
    """k x k area mean of an RGB uint8 image; pixels black on all bands are skipped."""
    h, w, c = img.shape
    a = img.reshape(h // k, k, w // k, k, c).astype(np.float64)
    valid = (a.max(axis=4, keepdims=True) > 0)
    s = (a * valid).sum(axis=(1, 3))
    n = valid.sum(axis=(1, 3))
    out = np.where(n > 0, s / np.maximum(n, 1), 0)
    return np.clip(np.round(out), 0, 255).astype(np.uint8)


def float_block_mean(vals, axis_pairs):
    """Mean over the given axes skipping NaN; all-NaN gives NaN."""
    with np.errstate(invalid="ignore"):
        n = np.isfinite(vals).sum(axis=axis_pairs)
        s = np.nansum(vals, axis=axis_pairs)
        return np.where(n > 0, s / np.maximum(n, 1), np.nan)


def horn_slope_deg(z, dx, dy):
    """Horn's method on a grid (row 0 north, column 0 west). Output is 2 smaller per axis."""
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    gg, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + gg)) / (8.0 * dx)
    dzdy = ((a + 2 * b + c) - (gg + 2 * h + i)) / (8.0 * dy)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy)))


def slope_1m(sample, half_core, gs_x):
    """Slope at the 1 m cell centres from a 1 m grid of heights."""
    k = np.arange(int(2 * half_core) + 2)
    gx, gy = np.meshgrid(-half_core - 0.5 + k, half_core + 0.5 - k)
    return horn_slope_deg(sample(gx, gy), 1.0 * gs_x, 1.0)


def slope_baseline(sample, half_core, baseline, gs_x):
    """Slope over `baseline` metres, returned at the 1 m cell centres.

    `sample(x, y)` gives heights at local positions. Heights are averaged over
    baseline x baseline blocks of 1 m samples, Horn's method runs on that grid
    with true ground spacing, and the result is interpolated back.
    """
    if baseline % 2 != 1:
        raise ValueError("baseline must be an odd number of metres")
    ext = math.ceil((half_core + baseline) / baseline) * baseline
    centres = np.arange(-ext, ext + baseline / 2, baseline, dtype=np.float64)
    n = len(centres)
    offs = np.arange(baseline, dtype=np.float64) - (baseline - 1) / 2
    sx = centres[None, :, None, None] + offs[None, None, None, :]
    sy = centres[::-1][:, None, None, None] + offs[::-1][None, None, :, None]
    sx, sy = np.broadcast_arrays(sx, sy)
    z = float_block_mean(sample(sx, sy), (2, 3)).reshape(n, n)
    s = horn_slope_deg(z, baseline * gs_x, float(baseline))
    first = -ext + baseline
    cells = int(2 * half_core)
    cx = -half_core + 0.5 + np.arange(cells)
    u = (cx - first) / baseline
    v = ((ext - baseline) - (half_core - 0.5 - np.arange(cells))) / baseline
    uu, vv = np.meshgrid(u, v)
    return g.bilinear_from_window(s, uu, vv, None, np.nan)


def encode_slope(deg):
    v = np.round(deg / SLOPE_SCALE)
    v = np.minimum(v, 254)
    return np.where(np.isfinite(deg), v, SLOPE_NODATA).astype(np.uint8)


def slope_stats(deg):
    v = deg[np.isfinite(deg)]
    return {"above_15": float((v > 15).mean()), "between_10_15": float(((v > 10) & (v <= 15)).mean()),
            "median": float(np.median(v)), "max": float(v.max())}


def pick_height_encoding(*arrays):
    vals = np.concatenate([a[np.isfinite(a)].ravel() for a in arrays])
    lo, hi = float(vals.min()), float(vals.max())
    offset = math.floor(lo) - 1.0
    for s in SCALES:
        if (hi - offset) / s <= NODATA16 - 1:
            return offset, s, lo, hi
    raise ValueError("height range too large for Uint16")


def encode_height(h, offset, scale):
    v = np.round((h - offset) / scale)
    return np.where(np.isfinite(h), v, NODATA16).astype("<u2")


class DemSampler:
    """Bilinear terrain sampling in the local frame from one cached window."""

    def __init__(self, dem, origin_model, half_extent_m):
        self.dem = dem
        self.ox, self.oy = origin_model
        c_min, r_min = dem.model_to_pixel(self.ox - half_extent_m, self.oy + half_extent_m)
        c_max, r_max = dem.model_to_pixel(self.ox + half_extent_m, self.oy - half_extent_m)
        self.c0 = int(math.floor(c_min)) - 2
        self.r0 = int(math.floor(r_min)) - 2
        w = int(math.ceil(c_max)) + 2 - self.c0
        h = int(math.ceil(r_max)) + 2 - self.r0
        est, _ = dem.estimate_window_bytes(self.c0, self.r0, w, h)
        if est > MAX_FETCH:
            raise SystemExit("terrain window needs %d bytes, above the 2 GB stop limit" % est)
        win = dem.read_window(self.c0, self.r0, w, h).astype(np.float64)
        if dem.nodata is not None:
            win[win == dem.nodata] = np.nan
        self.win = win

    def to_pixel(self, x, y):
        x0, a, b, y0, c, d = self.dem.affine
        mx = self.ox + np.asarray(x, dtype=np.float64)
        my = self.oy + np.asarray(y, dtype=np.float64)
        det = a * d - b * c
        col = (d * (mx - x0) - b * (my - y0)) / det
        row = (-c * (mx - x0) + a * (my - y0)) / det
        return col, row

    def sample(self, x, y):
        col, row = self.to_pixel(x, y)
        return g.bilinear_from_window(self.win, col - 0.5 - self.c0, row - 0.5 - self.r0, None, np.nan)


def save_webp(img, path, quality):
    mode = "L" if img.ndim == 2 else "RGB"
    Image.fromarray(img, mode=mode).save(path, format="WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def save_webp_capped(images_paths, start, floor, cap_bytes):
    """Save every image at one shared quality, the highest from `start` down to `floor` that keeps each under the cap."""
    q = start
    while True:
        sizes = [save_webp(img, path, q) for img, path in images_paths]
        if max(sizes) <= cap_bytes or q <= floor:
            return q, sizes
        q -= 1


def refresh_files(out):
    """Write the byte length of every file under `out` (except scene.json) into scene.json."""
    path = os.path.join(out, "scene.json")
    with open(path) as fh:
        scene = json.load(fh)
    files = {}
    for d, dirs, names in os.walk(out):
        dirs.sort()
        for n in sorted(names):
            if n.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(d, n), out).replace(os.sep, "/")
            if rel == "scene.json":
                continue
            files[rel] = os.path.getsize(os.path.join(d, n))
    scene["files"] = files
    with open(path, "w") as fh:
        json.dump(scene, fh, indent=2)
        fh.write("\n")
    return files


def write_tiles(core, prefix, out, quality_args):
    tiles = []
    jobs = []
    n_tiles = core.shape[0] // TILE_PX
    for tr in range(n_tiles):
        row = []
        for tc in range(n_tiles):
            rel = "ortho/%score_%d_%d.webp" % (prefix, tr, tc)
            jobs.append((core[tr * TILE_PX:(tr + 1) * TILE_PX, tc * TILE_PX:(tc + 1) * TILE_PX],
                         os.path.join(out, rel)))
            row.append(rel)
        tiles.append(row)
    q, sizes = save_webp_capped(jobs, *quality_args)
    return tiles, q, sizes


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--lon", type=float)
    ap.add_argument("--lat", type=float)
    ap.add_argument("--core-m", type=int)
    ap.add_argument("--surround-m", type=int)
    ap.add_argument("--out", required=True)
    ap.add_argument("--raw")
    ap.add_argument("--refresh-files", action="store_true",
                    help="only rewrite the files byte map of an existing scene.json")
    args = ap.parse_args(argv)
    out = os.path.abspath(args.out)
    if args.refresh_files:
        files = refresh_files(out)
        print(json.dumps({"files": len(files), "total_bytes": sum(files.values())}))
        return files
    for name in ("lon", "lat", "core_m", "surround_m", "raw"):
        if getattr(args, name) is None:
            ap.error("--%s is required for a cut" % name.replace("_", "-"))
    if args.core_m != 1024 or args.surround_m != 2048:
        raise SystemExit("the cut area is fixed by the spec: core 1024 m, surround 2048 m")

    os.makedirs(os.path.join(out, "ortho"), exist_ok=True)
    ortho = g.open_remote(ORTHO_URL, args.raw)
    dem = g.open_remote(DEM_URL, args.raw)
    colour = g.open_remote(COLOUR_URL, args.raw)
    for t in (ortho, dem, colour):
        if t.proj is None or t.proj["name"] != "equirectangular":
            raise SystemExit("unexpected projection")
    if ortho.proj != dem.proj or ortho.proj != colour.proj or ortho.affine[1] != IMAGE_M:
        raise SystemExit("projections differ; the frame would need a reprojection")
    if colour.affine[1] != IMAGE_M:
        raise SystemExit("colour file full resolution is not 0.25 m")

    c, r = ortho.lonlat_to_pixel(args.lon, args.lat)
    oc, orr = int(round(c)), int(round(r))
    origin_model = ortho.pixel_to_model(oc, orr)
    olon, olat = ortho.pixel_to_lonlat(oc, orr)
    cc, cr = colour.model_to_pixel(*origin_model)
    if abs(cc - round(cc)) > 1e-6 or abs(cr - round(cr)) > 1e-6:
        raise SystemExit("colour pixel grid does not line up with the 25 cm image grid")
    cc, cr = int(round(cc)), int(round(cr))

    core_px = int(args.core_m / IMAGE_M)
    sur_px = int(args.surround_m / IMAGE_M)
    k0 = (sur_px - core_px) // 2
    for t, (pc, pr) in ((ortho, (oc, orr)), (colour, (cc, cr))):
        est, _ = t.estimate_window_bytes(pc - sur_px // 2, pr - sur_px // 2, sur_px, sur_px)
        if est > MAX_FETCH:
            raise SystemExit("image window needs %d bytes, above the 2 GB stop limit" % est)

    big = ortho.read_window(oc - sur_px // 2, orr - sur_px // 2, sur_px, sur_px, fill=0)
    lut = grey_lut(ortho)
    if lut is not None:
        big = lut[big]
    core = big[k0:k0 + core_px, k0:k0 + core_px]
    grey_tiles, _, _ = write_tiles(core, "grey_", out, (GREY_QUALITY, GREY_QUALITY, 1 << 62))
    save_webp(block_mean(core, 2), os.path.join(out, "ortho/grey_core_half.webp"), GREY_QUALITY)
    grey_sur = block_mean(big, 4)
    save_webp(grey_sur, os.path.join(out, "ortho/grey_surround.webp"), GREY_QUALITY)
    save_webp(block_mean(grey_sur, 4), os.path.join(out, "ortho/grey_overview.webp"), GREY_QUALITY)
    grey_zero = float((core == 0).mean())
    del big, core, grey_sur

    cbig = colour.read_window(cc - sur_px // 2, cr - sur_px // 2, sur_px, sur_px, fill=0)
    ccore = cbig[k0:k0 + core_px, k0:k0 + core_px]
    colour_tiles, q_tiles, tile_sizes = write_tiles(
        ccore, "colour_", out, (COLOUR_QUALITY, COLOUR_QUALITY_MIN, COLOUR_TILE_MAX))
    save_webp(block_mean_rgb(ccore, 2), os.path.join(out, "ortho/colour_core_half.webp"), COLOUR_QUALITY)
    colour_sur = block_mean_rgb(cbig, 4)
    save_webp(colour_sur, os.path.join(out, "ortho/colour_surround.webp"), COLOUR_QUALITY)
    q_over, over_sizes = save_webp_capped(
        [(block_mean_rgb(colour_sur, 4), os.path.join(out, "ortho/colour_overview.webp"))],
        COLOUR_QUALITY, 50, COLOUR_OVERVIEW_MAX)
    colour_black = float((ccore.max(axis=2) == 0).mean())
    del cbig, ccore, colour_sur

    half_core = args.core_m / 2.0
    half_sur = args.surround_m / 2.0
    sampler = DemSampler(dem, origin_model, half_sur + 4)

    n_core = args.core_m + 1
    i = np.arange(n_core)
    xx, yy = np.meshgrid(-half_core + i, half_core - i)
    dem_core = sampler.sample(xx, yy)

    n_sur = args.surround_m // 4 + 1
    i = np.arange(n_sur)
    offs = np.array([-1.5, -0.5, 0.5, 1.5])
    sx = (-half_sur + 4 * i)[None, :, None, None] + offs[None, None, None, :]
    sy = (half_sur - 4 * i)[:, None, None, None] + offs[None, None, :, None]
    sx, sy = np.broadcast_arrays(sx, sy)
    dem_sur = float_block_mean(sampler.sample(sx, sy), (2, 3))

    lat_ts = ortho.proj["lat_ts_deg"]
    gs_x = math.cos(math.radians(olat)) / math.cos(math.radians(lat_ts))
    slope_1 = slope_1m(sampler.sample, half_core, gs_x)
    slope_5 = slope_baseline(sampler.sample, half_core, SLOPE_BASELINE_M, gs_x)

    offset, scale, lo, hi = pick_height_encoding(dem_core, dem_sur)
    encode_height(dem_core, offset, scale).tofile(os.path.join(out, "dem_core.bin"))
    encode_height(dem_sur, offset, scale).tofile(os.path.join(out, "dem_surround.bin"))
    encode_slope(slope_5).tofile(os.path.join(out, "slope_core.bin"))

    R = ortho.proj["semi_major_m"]
    colour_set = {"label": "HiRISE colour mosaic (USGS, July 2025)",
                  "note": ("Colour strips fused to the HiRISE RED mosaic and slightly sharpened by the authors. "
                           "USGS does not state the band mix; this is not a true-colour claim."),
                  "source_id": COLOUR_SOURCE_ID, "tiles": colour_tiles,
                  "half_res": "ortho/colour_core_half.webp", "surround": "ortho/colour_surround.webp",
                  "overview": "ortho/colour_overview.webp"}
    grey_set = {"label": "HiRISE RED mosaic, greyscale", "source_id": GREY_SOURCE_ID, "tiles": grey_tiles,
                "half_res": "ortho/grey_core_half.webp", "surround": "ortho/grey_surround.webp",
                "overview": "ortho/grey_overview.webp"}
    scene = {
        "origin": {"lon": olon, "lat": olat},
        "origin_projected_m": {"x": origin_model[0], "y": origin_model[1]},
        "metres_per_degree": {"lon": R * math.cos(math.radians(lat_ts)) * math.pi / 180.0,
                              "lat": R * math.pi / 180.0},
        "ground_scale": {"x": gs_x, "y": 1.0},
        "lat_type": ortho.lat_type(),
        "lon_direction": "east_positive" if ortho.lon_direction() == "east" else "west_positive",
        "projection": {"name": "equirectangular", "radius_m": R, "standard_parallel": lat_ts,
                       "central_lon": ortho.proj["lon0_deg"]},
        "core": {"size_m": args.core_m, "image_m_per_px": IMAGE_M, "dem_m_per_px": 1,
                 "tiles": colour_tiles, "tile_px": TILE_PX, "half_res": colour_set["half_res"],
                 "dem": "dem_core.bin", "dem_samples": n_core, "slope": "slope_core.bin",
                 "slope_cells": args.core_m},
        "surround": {"size_m": args.surround_m, "image": colour_set["surround"], "image_m_per_px": 1,
                     "dem": "dem_surround.bin", "dem_samples": n_sur, "dem_m_per_px": 4},
        "overview": colour_set["overview"],
        "imagery": {"default": "colour", "colour": colour_set, "grey": grey_set},
        "height": {"offset_m": offset, "scale_m": scale, "nodata": NODATA16},
        "slope": {"scale_deg": SLOPE_SCALE, "nodata": SLOPE_NODATA, "baseline_m": SLOPE_BASELINE_M,
                  "method": SLOPE_METHOD},
        "sources": [COLOUR_SOURCE_ID, GREY_SOURCE_ID, "dem_1m", "hrsc"],
        "files": {},
    }
    with open(os.path.join(out, "scene.json"), "w") as fh:
        json.dump(scene, fh, indent=2)
        fh.write("\n")
    files = refresh_files(out)

    report = {
        "origin_pixel_image": [oc, orr],
        "origin_pixel_colour": [cc, cr],
        "origin_pixel_dem": [float(v) for v in sampler.to_pixel(0.0, 0.0)],
        "height_core_m": [float(np.nanmin(dem_core)), float(np.nanmax(dem_core))],
        "height_surround_m": [float(np.nanmin(dem_sur)), float(np.nanmax(dem_sur))],
        "height_all_m": [lo, hi],
        "nodata_core": int((~np.isfinite(dem_core)).sum()),
        "nodata_surround": int((~np.isfinite(dem_sur)).sum()),
        "slope_1m": slope_stats(slope_1),
        "slope_5m": slope_stats(slope_5),
        "grey_zero_share_core": grey_zero,
        "colour_black_share_core": colour_black,
        "colour_tile_quality": q_tiles,
        "colour_tile_sizes": tile_sizes,
        "colour_overview_quality": q_over,
        "colour_overview_size": over_sizes[0],
        "files": files,
        "total_bytes": sum(files.values()),
        "bytes_fetched": ortho.source.bytes_fetched + dem.source.bytes_fetched + colour.source.bytes_fetched,
    }
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    main()
