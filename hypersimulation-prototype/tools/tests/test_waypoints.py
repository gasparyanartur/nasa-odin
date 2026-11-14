"""Tests for cut_waypoints and alignment_check.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

The file checks need app/public/data/waypoints.json; the raw count check also
needs the raw file under /Users/ardasarikaya/marswalk-data-raw/waypoints/.
"""

import json
import math
import os
import sys
import unittest

import numpy as np

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
import alignment_check as ac  # noqa: E402
import cut_waypoints as cw  # noqa: E402

DATA = os.path.join(os.path.dirname(TOOLS), "app", "public", "data")
RAW = "/Users/ardasarikaya/marswalk-data-raw"
HAVE = os.path.exists(os.path.join(DATA, "waypoints.json")) and os.path.exists(os.path.join(DATA, "scene.json"))

SCENE = {"projection": {"radius_m": 3396190.0, "central_lon": 0.0, "standard_parallel": 0.0},
         "origin_projected_m": {"x": 8143335.75, "y": -284696.25}}


class PureTests(unittest.TestCase):
    def test_round_trip(self):
        x, y = cw.lonlat_to_local(137.3796858, -4.804189, SCENE)
        lon, lat = cw.local_to_lonlat(x, y, SCENE)
        self.assertAlmostEqual(lon, 137.3796858, places=10)
        self.assertAlmostEqual(lat, -4.804189, places=10)

    def test_known_easting(self):
        x, y = cw.lonlat_to_local(137.3796858, -4.804189, SCENE)
        self.assertAlmostEqual(x + SCENE["origin_projected_m"]["x"], 8143139.321, delta=0.01)
        self.assertAlmostEqual(y + SCENE["origin_projected_m"]["y"], -284766.85, delta=0.01)

    def test_campaign_bounds(self):
        self.assertTrue(cw.is_campaign(4534) and cw.is_campaign(4805))
        self.assertFalse(cw.is_campaign(4533) or cw.is_campaign(4806))

    def test_height_stats(self):
        wps = [{"in_campaign": True, "dem_height_m": 1.0 + d, "elev_geoid_m": 1.0} for d in (0.1, -0.1, 0.0)]
        s = ac.height_stats(wps)
        self.assertAlmostEqual(s["median_m"], 0.0)
        self.assertAlmostEqual(s["std_after_median_removed_m"], math.sqrt(0.02 / 3))


@unittest.skipUnless(HAVE, "waypoints.json not written yet")
class FileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(DATA, "waypoints.json")) as fh:
            cls.doc = json.load(fh)
        with open(os.path.join(DATA, "scene.json")) as fh:
            cls.scene = json.load(fh)
        cls.camp = [w for w in cls.doc["waypoints"] if w["in_campaign"]]

    def test_campaign_count(self):
        self.assertEqual(len(self.camp), 65)
        self.assertEqual(self.doc["source"]["campaign_count"], len(self.camp))
        path = cw.raw_path(RAW)
        if not os.path.exists(path):
            self.skipTest("raw file not present")
        raw = sum(1 for p in cw.load_features(path) if cw.is_campaign(int(p["sol"])))
        self.assertEqual(raw, len(self.camp))

    def test_campaign_flag_matches_sols(self):
        for w in self.doc["waypoints"]:
            self.assertEqual(w["in_campaign"], 4534 <= w["sol"] <= 4805, w["sol"])

    def test_campaign_inside_core_with_margin(self):
        half = self.scene["core"]["size_m"] / 2.0
        for w in self.camp:
            self.assertLessEqual(max(abs(w["x"]), abs(w["y"])), half - 100.0, w["sol"])

    def test_all_inside_surround(self):
        half = self.scene["surround"]["size_m"] / 2.0
        for w in self.doc["waypoints"]:
            self.assertLessEqual(max(abs(w["x"]), abs(w["y"])), half)

    def test_fields_and_units(self):
        self.assertEqual(self.doc["tilt_unit_note"], "degrees by inference from yaw and yaw_rad")
        for w in self.doc["waypoints"]:
            self.assertNotIn("dist_km", w)
            for key in ("sol", "x", "y", "lon", "lat", "elev_geoid_m", "dem_height_m", "pitch_deg",
                        "roll_deg", "tilt_deg", "yaw_deg", "site", "drive", "dist_total_m", "in_campaign",
                        "easting", "northing"):
                self.assertIn(key, w)
        for w in self.camp:
            self.assertTrue(math.isfinite(w["tilt_deg"]), w["sol"])

    def test_first_campaign_round_trip(self):
        w = self.camp[0]
        lon, lat = cw.local_to_lonlat(w["x"], w["y"], self.scene)
        R = self.scene["projection"]["radius_m"]
        dx = math.radians(lon - w["lon"]) * R
        dy = math.radians(lat - w["lat"]) * R
        self.assertLessEqual(math.hypot(dx, dy), 0.1)

    def test_easting_northing_cross_check(self):
        o = self.scene["origin_projected_m"]
        for w in self.camp:
            self.assertLessEqual(abs(w["easting"] - (w["x"] + o["x"])), 0.05, w["sol"])
            self.assertLessEqual(abs(w["northing"] - (w["y"] + o["y"])), 0.05, w["sol"])

    def test_heights_close_to_geoid(self):
        d = np.array([w["dem_height_m"] - w["elev_geoid_m"] for w in self.camp])
        self.assertLess(float(np.abs(np.median(d))), 5.0)

    def test_drill_markers(self):
        marks = {m["name"]: m for m in self.doc["drill_markers"]}
        self.assertEqual(set(marks), {"Altadena", "Nevado Sajama"})
        sols = {w["sol"] for w in self.camp}
        for name, target in (("Altadena", 4568), ("Nevado Sajama", 4803)):
            m = marks[name]
            self.assertIn(m["sol_of_waypoint"], sols)
            best = min(abs(s - target) for s in sols)
            self.assertEqual(abs(m["sol_of_waypoint"] - target), best)
            self.assertEqual(m["note"], "rover position on sol %d; the drill position is not published"
                             % m["sol_of_waypoint"])


if __name__ == "__main__":
    unittest.main()
