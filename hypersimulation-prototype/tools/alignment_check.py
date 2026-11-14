"""Alignment check: rover waypoints against the colour image and the terrain.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Usage (from hackathons/nasa-space-apps-2026):
  tools/.venv/bin/python -I tools/alignment_check.py --data app/public/data --out data-checks/alignment

Writes a contact sheet of all campaign waypoints (64 m crops of the 25 cm colour
image, 2x nearest upscale, 2 m ring, sol in a caption strip below each crop),
5 sample crops at 4x, a tracks overview of the core, and prints the height
statistics of dem_height_m - elev_geoid_m as JSON.
"""

import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

CROP_M = 64.0
RING_M = 2.0
CAPTION_PX = 22
SHEET_COLS = 9
SHEET_MAX = 4 * 1024 * 1024
RING = (0, 255, 255)
LINE = (255, 220, 0)


def load_core(data, scene):
    tiles = scene["imagery"]["colour"]["tiles"]
    tp = scene["core"]["tile_px"]
    n = len(tiles)
    core = np.zeros((n * tp, n * tp, 3), np.uint8)
    for r, row in enumerate(tiles):
        for c, rel in enumerate(row):
            with Image.open(os.path.join(data, rel)) as im:
                core[r * tp:(r + 1) * tp, c * tp:(c + 1) * tp] = np.asarray(im.convert("RGB"))
    return core


def to_pixel(x, y, scene):
    m = scene["core"]["image_m_per_px"]
    half = scene["core"]["size_m"] / 2.0
    return (x + half) / m, (half - y) / m


def crop_at(core, col, row, size):
    c0 = int(round(col)) - size // 2
    r0 = int(round(row)) - size // 2
    out = np.zeros((size, size, 3), np.uint8)
    h, w = core.shape[:2]
    ys, ye = max(r0, 0), min(r0 + size, h)
    xs, xe = max(c0, 0), min(c0 + size, w)
    out[ys - r0:ye - r0, xs - c0:xe - c0] = core[ys:ye, xs:xe]
    return out, col - c0, row - r0


def crop_tile(core, wp, scene, scale):
    m = scene["core"]["image_m_per_px"]
    size = int(CROP_M / m)
    col, row = to_pixel(wp["x"], wp["y"], scene)
    crop, cx, cy = crop_at(core, col, row, size)
    img = Image.fromarray(crop).resize((size * scale, size * scale), Image.NEAREST)
    tile = Image.new("RGB", (size * scale, size * scale + CAPTION_PX), (0, 0, 0))
    tile.paste(img, (0, 0))
    d = ImageDraw.Draw(tile)
    rr = RING_M / m * scale
    px, py = cx * scale, cy * scale
    d.ellipse([px - rr, py - rr, px + rr, py + rr], outline=RING, width=1)
    font = ImageFont.load_default(size=16)
    d.text((6, size * scale + 3), "sol %d   x %.1f m  y %.1f m" % (wp["sol"], wp["x"], wp["y"]),
           fill=(255, 255, 255), font=font)
    return tile


def save_png_capped(img, path, cap):
    img.save(path, format="PNG", optimize=True)
    if os.path.getsize(path) <= cap:
        return "RGB"
    rgb = np.asarray(img)
    keep = [RING, LINE, (255, 255, 255), (0, 0, 0)]
    masks = [np.all(rgb == np.array(c, np.uint8), axis=2) for c in keep]
    for colours in (256, 192, 128, 96, 64):
        base = colours - len(keep)
        q = img.quantize(colors=base, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = q.getpalette()[:3 * base]
        for c in keep:
            pal += list(c)
        idx = np.array(q, dtype=np.uint8)
        for k, m in enumerate(masks):
            idx[m] = base + k
        out = Image.fromarray(idx, mode="P")
        out.putpalette(pal)
        out.save(path, format="PNG", optimize=True)
        if os.path.getsize(path) <= cap:
            break
    return "palette %d (overlay colours kept exact)" % colours


def height_stats(waypoints):
    d = np.array([w["dem_height_m"] - w["elev_geoid_m"] for w in waypoints
                  if w["in_campaign"] and w["dem_height_m"] is not None and w["elev_geoid_m"] is not None])
    med = float(np.median(d))
    return {
        "n": int(d.size), "median_m": med,
        "p5_m": float(np.percentile(d, 5)), "p95_m": float(np.percentile(d, 95)),
        "std_after_median_removed_m": float(np.sqrt(np.mean((d - med) ** 2))),
        "min_m": float(d.min()), "max_m": float(d.max()),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    data = os.path.abspath(args.data)
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(data, "scene.json")) as fh:
        scene = json.load(fh)
    with open(os.path.join(data, "waypoints.json")) as fh:
        doc = json.load(fh)
    camp = [w for w in doc["waypoints"] if w["in_campaign"]]
    core = load_core(data, scene)

    tiles = [crop_tile(core, w, scene, 2) for w in camp]
    tw, th = tiles[0].size
    rows = -(-len(tiles) // SHEET_COLS)
    sheet = Image.new("RGB", (SHEET_COLS * tw + (SHEET_COLS - 1) * 4, rows * th + (rows - 1) * 4), (0, 0, 0))
    for k, t in enumerate(tiles):
        sheet.paste(t, ((k % SHEET_COLS) * (tw + 4), (k // SHEET_COLS) * (th + 4)))
    sheet_mode = save_png_capped(sheet, os.path.join(out, "contact-sheet.png"), SHEET_MAX)

    picks = [camp[i] for i in np.linspace(0, len(camp) - 1, 5).round().astype(int)]
    samples = []
    for w in picks:
        name = "sample-sol%d.png" % w["sol"]
        crop_tile(core, w, scene, 4).save(os.path.join(out, name), format="PNG", optimize=True)
        samples.append(name)

    half = Image.fromarray(core).resize((core.shape[1] // 2, core.shape[0] // 2), Image.BOX)
    d = ImageDraw.Draw(half)
    pts = [tuple(v / 2 for v in to_pixel(w["x"], w["y"], scene)) for w in camp]
    d.line(pts, fill=LINE, width=1)
    for px, py in pts:
        d.ellipse([px - 3, py - 3, px + 3, py + 3], outline=RING, width=1)
    tracks_mode = save_png_capped(half, os.path.join(out, "tracks-overview.png"), SHEET_MAX)

    en = [abs(w["easting"] - (w["x"] + scene["origin_projected_m"]["x"])) for w in camp]
    no = [abs(w["northing"] - (w["y"] + scene["origin_projected_m"]["y"])) for w in camp]
    report = {
        "campaign_waypoints": len(camp),
        "height": height_stats(doc["waypoints"]),
        "easting_northing_max_abs_diff_m": [max(en), max(no)],
        "contact_sheet": {"px": list(sheet.size), "mode": sheet_mode,
                          "bytes": os.path.getsize(os.path.join(out, "contact-sheet.png"))},
        "samples": samples,
        "tracks_overview": {"mode": tracks_mode,
                            "bytes": os.path.getsize(os.path.join(out, "tracks-overview.png"))},
    }
    print(json.dumps(report, indent=1))
    return report


if __name__ == "__main__":
    main()
