"""Cut the MSL rover waypoints inside the Marswalk surround into waypoints.json.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Usage (from hackathons/nasa-space-apps-2026):
  tools/.venv/bin/python -I tools/cut_waypoints.py --raw /Users/ardasarikaya/marswalk-data-raw \
      --data app/public/data [--fetch]

The raw file is saved under <raw>/waypoints/MSL_waypoints.json before it is read
(--fetch downloads it when missing). x, y are projected local metres of scene.json.
"""

import argparse
import json
import math
import os
import sys
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_scene as cs  # noqa: E402
import geotiff_range as g  # noqa: E402

SOURCE_URL = "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json"
CAMPAIGN = (4534, 4805)
TILT_NOTE = "degrees by inference from yaw and yaw_rad"
DRILLS = [("Altadena", 4568, "at the edge of the boxwork"), ("Nevado Sajama", 4803, "on a ridge")]


def raw_path(raw):
    return os.path.join(raw, "waypoints", "MSL_waypoints.json")


def fetch_raw(raw):
    path = raw_path(raw)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": g.USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    with open(path + ".part", "wb") as fh:
        fh.write(data)
    os.replace(path + ".part", path)
    return path


def load_features(path):
    with open(path) as fh:
        doc = json.load(fh)
    return [f["properties"] for f in doc["features"]]


def lonlat_to_local(lon, lat, scene):
    p = scene["projection"]
    R = p["radius_m"]
    x = R * math.radians(lon - p["central_lon"]) * math.cos(math.radians(p["standard_parallel"]))
    y = R * math.radians(lat)
    return x - scene["origin_projected_m"]["x"], y - scene["origin_projected_m"]["y"]


def local_to_lonlat(x, y, scene):
    p = scene["projection"]
    R = p["radius_m"]
    X = x + scene["origin_projected_m"]["x"]
    Y = y + scene["origin_projected_m"]["y"]
    lon = p["central_lon"] + math.degrees(X / (R * math.cos(math.radians(p["standard_parallel"]))))
    return lon, math.degrees(Y / R)


def is_campaign(sol):
    return CAMPAIGN[0] <= sol <= CAMPAIGN[1]


class SceneTerrain:
    """Heights from the app's own terrain files, bilinear between samples."""

    def __init__(self, data, scene):
        h = scene["height"]
        self.half_core = scene["core"]["size_m"] / 2.0
        self.half_sur = scene["surround"]["size_m"] / 2.0
        self.sur_step = scene["surround"]["dem_m_per_px"]

        def load(name, n):
            raw = np.fromfile(os.path.join(data, name), "<u2").reshape(n, n)
            return np.where(raw == h["nodata"], np.nan, h["offset_m"] + raw.astype(np.float64) * h["scale_m"])

        self.core = load(scene["core"]["dem"], scene["core"]["dem_samples"])
        self.sur = load(scene["surround"]["dem"], scene["surround"]["dem_samples"])

    def height(self, x, y):
        if abs(x) <= self.half_core and abs(y) <= self.half_core:
            u, v, win = x + self.half_core, self.half_core - y, self.core
        elif abs(x) <= self.half_sur and abs(y) <= self.half_sur:
            u, v, win = (x + self.half_sur) / self.sur_step, (self.half_sur - y) / self.sur_step, self.sur
        else:
            return None
        n = win.shape[0]
        u = min(max(u, 0.0), n - 1 - 1e-9)
        v = min(max(v, 0.0), n - 1 - 1e-9)
        val = float(g.bilinear_from_window(win, np.array([u]), np.array([v]))[0])
        return None if math.isnan(val) else val


def num(p, key):
    v = p.get(key)
    return float(v) if isinstance(v, (int, float)) else None


def build(features, scene, terrain):
    half = scene["surround"]["size_m"] / 2.0
    out = []
    for p in sorted(features, key=lambda q: (q["sol"], q.get("site", 0), q.get("drive", 0))):
        x, y = lonlat_to_local(p["lon"], p["lat"], scene)
        if abs(x) > half or abs(y) > half:
            continue
        out.append({
            "sol": int(p["sol"]), "x": round(x, 3), "y": round(y, 3),
            "lon": p["lon"], "lat": p["lat"],
            "elev_geoid_m": num(p, "elev_geoid"),
            "dem_height_m": None if terrain.height(x, y) is None else round(terrain.height(x, y), 3),
            "pitch_deg": num(p, "pitch"), "roll_deg": num(p, "roll"), "tilt_deg": num(p, "tilt"),
            "yaw_deg": num(p, "yaw"), "site": p.get("site"), "drive": p.get("drive"),
            "dist_total_m": num(p, "dist_total_m"),
            "easting": num(p, "easting"), "northing": num(p, "northing"),
            "in_campaign": is_campaign(int(p["sol"])),
        })
    return out


def drill_markers(waypoints):
    camp = [w for w in waypoints if w["in_campaign"]]
    marks = []
    for name, sol, context in DRILLS:
        best = min(camp, key=lambda w: (abs(w["sol"] - sol), -(w["drive"] or 0)))
        marks.append({"name": name, "context": context, "sol_of_waypoint": best["sol"],
                      "x": best["x"], "y": best["y"],
                      "note": "rover position on sol %d; the drill position is not published" % best["sol"]})
    return marks


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--raw", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--fetch", action="store_true")
    args = ap.parse_args(argv)
    data = os.path.abspath(args.data)
    path = raw_path(args.raw)
    if not os.path.exists(path):
        if not args.fetch:
            raise SystemExit("raw waypoints file missing; run with --fetch")
        fetch_raw(args.raw)
    with open(os.path.join(data, "scene.json")) as fh:
        scene = json.load(fh)
    features = load_features(path)
    waypoints = build(features, scene, SceneTerrain(data, scene))
    camp_raw = sum(1 for p in features if is_campaign(int(p["sol"])))
    doc = {
        "source": {"id": "msl_waypoints", "url": SOURCE_URL,
                   "features_in_raw_file": len(features), "campaign_sols": list(CAMPAIGN),
                   "campaign_count": sum(1 for w in waypoints if w["in_campaign"]),
                   "campaign_count_raw": camp_raw},
        "tilt_unit_note": TILT_NOTE,
        "frame": "x, y in projected local metres of scene.json (x east, y north)",
        "waypoints": waypoints,
        "drill_markers": drill_markers(waypoints),
    }
    with open(os.path.join(data, "waypoints.json"), "w") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    files = cs.refresh_files(data)
    print(json.dumps({"waypoints": len(waypoints), "campaign": doc["source"]["campaign_count"],
                      "campaign_raw": camp_raw, "drill_markers": doc["drill_markers"],
                      "waypoints_bytes": files["waypoints.json"]}, indent=1))
    return doc


if __name__ == "__main__":
    main()
