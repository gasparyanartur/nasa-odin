# AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
"""Write a synthetic MOCK scene in the app data contract. Standard library only.

Mock deviations from the real contract sizes (the loader reads sizes from scene.json): core tiles are 512 px at
1 m per pixel, the surround image is 512 px at 4 m per pixel, the overview is 256 px. Heights, weather, dose and the
event are invented and carry "MOCK" in every source block.
"""
import argparse
import json
import math
import shutil
import struct
import sys
import zlib
from array import array
from pathlib import Path

ORIGIN = {"lon": 137.383, "lat": -4.803}
MPD = {"lon": 59061.0, "lat": 59276.6}
HEIGHT_OFFSET = -3640.0
HEIGHT_SCALE = 0.01
NODATA16 = 65535
RIDGE_PERIOD = 40.0
RIDGE_HALF_WIDTH = 14.0
RIDGE_HEIGHT = 2.0
GLYPH_UNIT = 14.0
GLYPH_X0 = -492.0
GLYPH_Y0 = 492.0
GLYPH_HEIGHT = 10.0
N_GLYPH = ["10001", "11001", "10101", "10011", "10001", "10001", "10001"]
MOCK_SOURCE = {"id": "mock", "title": "MOCK synthetic data, not from NASA or USGS", "url": "", "licence": "MOCK", "credit": "MOCK"}


def ridge(c):
    d = abs((c + RIDGE_PERIOD / 2) % RIDGE_PERIOD - RIDGE_PERIOD / 2)
    if d >= RIDGE_HALF_WIDTH:
        return 0.0
    return RIDGE_HEIGHT * math.cos(math.pi * d / (2 * RIDGE_HALF_WIDTH)) ** 2


def glyph(x, y):
    u = (x - GLYPH_X0) / GLYPH_UNIT
    v = (GLYPH_Y0 - y) / GLYPH_UNIT
    if 0 <= u < 5 and 0 <= v < 7:
        return N_GLYPH[int(v)][int(u)] == "1"
    return False


def base_height(x, y):
    return -3600.0 + 0.03 * x + 0.02 * y


def height(x, y, rx, ry):
    return base_height(x, y) + max(rx, ry) + (GLYPH_HEIGHT if glyph(x, y) else 0.0)


def grey(x, y, rx, ry):
    if glyph(x, y):
        return 250
    return int(70 + 60 * max(rx, ry) / RIDGE_HEIGHT)


def png_bytes(rows, size):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")


def image(path, px, m_per_px, x_left, y_top):
    xs = [x_left + (c + 0.5) * m_per_px for c in range(px)]
    ys = [y_top - (r + 0.5) * m_per_px for r in range(px)]
    rxs = [ridge(x) for x in xs]
    rys = [ridge(y) for y in ys]
    rows = [[grey(xs[c], y, rxs[c], rys[r]) for c in range(px)] for r, y in enumerate(ys)]
    path.write_bytes(png_bytes(rows, px))


def dem(path, n, step, half):
    xs = [-half + step * i for i in range(n)]
    ys = [half - step * j for j in range(n)]
    rxs = [ridge(x) for x in xs]
    rys = [ridge(y) for y in ys]
    vals = array("H")
    grid = []
    for j, y in enumerate(ys):
        row = [height(xs[i], y, rxs[i], rys[j]) for i in range(n)]
        grid.append(row)
        vals.extend(max(0, min(NODATA16 - 1, round((h - HEIGHT_OFFSET) / HEIGHT_SCALE))) for h in row)
    if sys.byteorder == "big":
        vals.byteswap()
    path.write_bytes(vals.tobytes())
    return grid


def slope(path, grid, cells):
    out = bytearray()
    for j in range(cells):
        a, b = grid[j], grid[j + 1]
        for i in range(cells):
            dzdx = ((a[i + 1] + b[i + 1]) - (a[i] + b[i])) / 2.0
            dzdy = ((a[i] + a[i + 1]) - (b[i] + b[i + 1])) / 2.0
            deg = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
            out.append(254 if deg > 63.5 else round(deg / 0.25))
    path.write_bytes(bytes(out))


def dump(path, obj):
    path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")


def waypoints():
    items = []
    for k in range(65):
        x = -180.0 + 5.6 * k
        y = 60.0 * math.sin(k / 10.0)
        h = base_height(x, y) + max(ridge(x), ridge(y))
        items.append({
            "sol": 4534 + 4 * k, "x": round(x, 2), "y": round(y, 2),
            "lon": ORIGIN["lon"] + x / MPD["lon"], "lat": ORIGIN["lat"] + y / MPD["lat"],
            "elev_geoid_m": round(h, 2), "dem_height_m": round(h, 2),
            "pitch_deg": 2.0, "roll_deg": -1.0, "tilt_deg": 2.2, "yaw_deg": round((k * 7) % 360, 1),
            "site": 100 + k // 5, "drive": k, "dist_total_m": round(31000 + 5.6 * k, 1), "in_campaign": True,
        })
    return {"source": MOCK_SOURCE, "tilt_unit_note": "MOCK", "waypoints": items}


def conditions():
    hours = []
    for h in range(24):
        missing = h in (2, 3)
        day = max(0.0, math.sin((h - 6) / 12.0 * math.pi))
        entry = {
            "lmst_hour": h,
            "ground_brightness_temp_c": None if missing else round(-70 + 60 * day, 1),
            "air_temp_c": None if missing else round(-75 + 45 * day, 1),
            "pressure_pa": None if missing else round(740 + 8 * math.sin(h / 24 * 2 * math.pi), 1),
            "uv_abc_w_m2": round(0.4 * day, 3) if 7 <= h <= 17 else None,
            "rel_humidity_pct": None if missing else round(30 - 20 * day, 1),
        }
        entry["n"] = {k: (0 if entry[k] is None else 60) for k in entry if k != "lmst_hour"}
        hours.append(entry)
    return {
        "sol": 4600, "earth_date": "MOCK", "source": MOCK_SOURCE, "hours": hours,
        "units": {"ground_brightness_temp_c": "degC", "air_temp_c": "degC", "pressure_pa": "Pa",
                  "uv_abc_w_m2": "W/m2", "rel_humidity_pct": "percent"},
    }


def dose():
    return {
        "sol": 4600, "source": MOCK_SOURCE,
        "dose_rate": {"value": 21.5, "unit": "microGy/hour", "detector": "B", "n_obs": 24,
                      "derived_daily": {"value": 0.516, "unit": "mGy/day",
                                        "method": "MOCK: mean of the sol's hourly values x 24, derived by us"}},
        "fallback": {"value": 0.210, "plus_minus": 0.040, "unit": "mGy/day", "source": "Hassler et al. 2014",
                     "period": "Gale, 2012 to 2013"},
        "dose_equivalent_rate": {"value": 0.64, "plus_minus": 0.12, "unit": "mSv/day", "source": "Hassler et al. 2014"},
    }


def sep_event():
    return {
        "source": MOCK_SOURCE, "id": "MOCK-SEP-001", "startTime": "MOCK", "link": "",
        "note": "MOCK event. Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario.",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="output folder, for example app/public/data-mock")
    out = Path(ap.parse_args().out)
    (out / "ortho").mkdir(parents=True, exist_ok=True)

    tile_px, tile_m = 512, 512.0
    names = [[f"ortho/core_{r}_{c}.png" for c in range(2)] for r in range(2)]
    for r in range(2):
        for c in range(2):
            image(out / names[r][c], tile_px, tile_m / tile_px, -512.0 + c * tile_m, 512.0 - r * tile_m)
    image(out / "ortho/core_half.png", 512, 2.0, -512.0, 512.0)
    image(out / "ortho/surround.png", 512, 4.0, -1024.0, 1024.0)
    image(out / "ortho/overview.png", 256, 8.0, -1024.0, 1024.0)

    grid = dem(out / "dem_core.bin", 1025, 1.0, 512.0)
    slope(out / "slope_core.bin", grid, 1024)
    dem(out / "dem_surround.bin", 513, 4.0, 1024.0)

    dump(out / "waypoints.json", waypoints())
    dump(out / "conditions.json", conditions())
    dump(out / "dose.json", dose())
    dump(out / "sep-event.json", sep_event())

    team = out.parent / "data" / "team-inputs.json"
    if team.exists():
        shutil.copyfile(team, out / "team-inputs.json")

    files = {}
    for p in sorted(out.rglob("*")):
        if p.is_file() and p.name != "scene.json":
            files[p.relative_to(out).as_posix()] = p.stat().st_size

    dump(out / "scene.json", {
        "origin": ORIGIN, "metres_per_degree": MPD, "ground_scale": {"x": 1.0, "y": 1.0},
        "lat_type": "MOCK", "lon_direction": "MOCK",
        "core": {"size_m": 1024, "image_m_per_px": tile_m / tile_px, "dem_m_per_px": 1, "tiles": names,
                 "tile_px": tile_px, "half_res": "ortho/core_half.png", "dem": "dem_core.bin",
                 "dem_samples": 1025, "slope": "slope_core.bin", "slope_cells": 1024},
        "surround": {"size_m": 2048, "image": "ortho/surround.png", "image_m_per_px": 4,
                     "dem": "dem_surround.bin", "dem_samples": 513, "dem_m_per_px": 4},
        "overview": "ortho/overview.png",
        "height": {"offset_m": HEIGHT_OFFSET, "scale_m": HEIGHT_SCALE, "nodata": NODATA16},
        "slope": {"scale_deg": 0.25, "nodata": 255},
        "sources": ["mock"],
        "mock": True,
        "files": files,
    })
    total = sum(files.values()) + (out / "scene.json").stat().st_size
    print(f"mock scene written to {out}: {len(files)} files, {total} bytes")
    if total > 4 * 1024 * 1024:
        sys.exit("mock scene is over 4 MB")


if __name__ == "__main__":
    main()
